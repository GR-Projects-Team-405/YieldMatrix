import { randomUUID } from 'node:crypto';
import pool from '../../config/db.js';

const BUYER_DEMO = '22222222-2222-2222-2222-222222222222';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOLD_HOURS = 4;
const HOLD_MINUTES = 30;

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export function requireUuid(value, field = 'id') {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(422, 'Invalid input', { [field]: 'Must be a UUID' });
  }
  return value;
}

function moneyValue(kg, unitPriceCents) {
  return Math.round(Number(kg) * Number(unitPriceCents));
}

function contractReference(orderId) {
  return `YM16-SC-${String(orderId).replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

async function audit(client, { actorId, action, targetType, targetId, requestId, reason, changes }) {
  await client.query(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [actorId, action, targetType, targetId, requestId || null, reason || null, JSON.stringify(changes || {})],
  );
}

async function expireHolds(client) {
  const { rows } = await client.query(
    `SELECT r.id, r.allocation_id, a.order_id
     FROM reservations r
     JOIN allocations a ON a.id = r.allocation_id
     JOIN orders o ON o.id = a.order_id
     WHERE r.status = 'active' AND r.expires_at <= now()
       AND o.operation_key LIKE 'ym16:%'`,
  );
  for (const row of rows) {
    await client.query(
      `UPDATE reservations SET status = 'expired', terminal_at = now() WHERE id = $1 AND status = 'active'`,
      [row.id],
    );
    await client.query(
      `UPDATE allocations SET status = 'expired', decision_reason = 'Reservation hold expired'
       WHERE id = $1 AND status = 'held'`,
      [row.allocation_id],
    );
  }
  const orders = [...new Set(rows.map((row) => row.order_id))];
  for (const orderId of orders) {
    const { rows: remaining } = await client.query(
      `SELECT COUNT(*)::int AS active_holds
       FROM reservations r JOIN allocations a ON a.id = r.allocation_id
       WHERE a.order_id = $1 AND r.status = 'active'`,
      [orderId],
    );
    if (remaining[0].active_holds === 0) {
      await client.query(
        `UPDATE orders SET status = 'expired', updated_at = now()
         WHERE id = $1 AND status IN ('awaiting_suppliers', 'ready_to_confirm')`,
        [orderId],
      );
      await releaseEscrow(client, { orderId, actorId: BUYER_DEMO, requestId: null, reason: 'Hold expired' });
    }
  }
}

async function getBuyerWallet(client, buyerId) {
  const { rows } = await client.query(
    `SELECT id, available_cents, held_cents, pending_payout_cents, simulated, currency
     FROM wallets WHERE owner_id = $1 FOR UPDATE`,
    [buyerId],
  );
  if (!rows[0]) throw new HttpError(409, 'Agri Wallet is not provisioned for this buyer');
  return rows[0];
}

async function findEscrowEntry(client, orderId) {
  const { rows } = await client.query(
    `SELECT id, amount_cents, event_type FROM wallet_journal_entries
     WHERE event_reference = $1 AND event_type = 'hold'`,
    [`ym16:escrow:${orderId}`],
  );
  return rows[0] || null;
}

async function findReversal(client, entryId) {
  const { rows } = await client.query(
    `SELECT id FROM wallet_journal_entries WHERE reversal_of = $1`,
    [entryId],
  );
  return rows[0] || null;
}

async function placeEscrow(client, { orderId, allocationId, buyerId, amountCents, actorId, requestId }) {
  if (amountCents <= 0) throw new HttpError(422, 'Escrow amount must be positive');
  const existing = await findEscrowEntry(client, orderId);
  if (existing) return existing;
  const wallet = await getBuyerWallet(client, buyerId);
  if (Number(wallet.available_cents) < amountCents) {
    throw new HttpError(409, 'Insufficient Agri Wallet available balance to place a simulated escrow hold');
  }
  const entryId = randomUUID();
  await client.query(
    `INSERT INTO wallet_journal_entries
      (id, event_type, event_reference, operation_key, amount_cents, order_id, allocation_id, actor_id)
     VALUES ($1, 'hold', $2, $3, $4, $5, $6, $7)`,
    [entryId, `ym16:escrow:${orderId}`, `ym16:escrow-hold:${orderId}`, amountCents, orderId, allocationId, actorId],
  );
  await client.query(
    `INSERT INTO wallet_journal_lines (entry_id, wallet_id, bucket, side, amount_cents) VALUES
      ($1, $2, 'available', 'debit', $3),
      ($1, $2, 'held', 'credit', $3)`,
    [entryId, wallet.id, amountCents],
  );
  await client.query(
    `UPDATE wallets SET available_cents = available_cents - $2, held_cents = held_cents + $2 WHERE id = $1`,
    [wallet.id, amountCents],
  );
  const { rows: allocs } = await client.query(
    `SELECT id, agreed_value_cents FROM allocations WHERE order_id = $1`,
    [orderId],
  );
  for (const alloc of allocs) {
    await client.query(
      `UPDATE allocations SET funded_cents = $2, held_cents = $2 WHERE id = $1 AND funded_cents = 0`,
      [alloc.id, Number(alloc.agreed_value_cents)],
    );
  }
  await audit(client, {
    actorId, action: 'ym16.escrow.hold', targetType: 'orders', targetId: orderId, requestId,
    reason: 'Simulated escrow hold for reservation',
    changes: { amountCents, simulated: true },
  });
  return { id: entryId, amount_cents: amountCents };
}

async function releaseEscrow(client, { orderId, actorId, requestId, reason }) {
  const hold = await findEscrowEntry(client, orderId);
  if (!hold) return null;
  if (await findReversal(client, hold.id)) return null;
  const { rows: orderRows } = await client.query(`SELECT buyer_id FROM orders WHERE id = $1`, [orderId]);
  const wallet = await getBuyerWallet(client, orderRows[0].buyer_id);
  const amountCents = Number(hold.amount_cents);
  const entryId = randomUUID();
  await client.query(
    `INSERT INTO wallet_journal_entries
      (id, event_type, event_reference, operation_key, amount_cents, order_id, reversal_of, actor_id)
     VALUES ($1, 'reversal', $2, $3, $4, $5, $6, $7)`,
    [entryId, `ym16:escrow-release:${orderId}`, `ym16:escrow-release:${orderId}`, amountCents, orderId, hold.id, actorId],
  );
  await client.query(
    `INSERT INTO wallet_journal_lines (entry_id, wallet_id, bucket, side, amount_cents) VALUES
      ($1, $2, 'held', 'debit', $3),
      ($1, $2, 'available', 'credit', $3)`,
    [entryId, wallet.id, amountCents],
  );
  await client.query(
    `UPDATE wallets SET available_cents = available_cents + $2, held_cents = held_cents - $2 WHERE id = $1`,
    [wallet.id, amountCents],
  );
  await client.query(
    `UPDATE allocations
     SET held_cents = 0,
         refunded_cents = funded_cents
     WHERE order_id = $1`,
    [orderId],
  );
  await audit(client, {
    actorId, action: 'ym16.escrow.release', targetType: 'orders', targetId: orderId, requestId,
    reason: reason || 'Simulated escrow release',
    changes: { amountCents, simulated: true },
  });
  return { id: entryId, amount_cents: amountCents };
}

async function loadOrderForBuyer(client, orderId, buyerId) {
  const { rows } = await client.query(
    `SELECT o.*, w.available_cents AS wallet_available_cents, w.held_cents AS wallet_held_cents, w.simulated AS wallet_simulated
     FROM orders o
     LEFT JOIN wallets w ON w.owner_id = o.buyer_id
     WHERE o.id = $1 AND o.buyer_id = $2 AND o.operation_key LIKE 'ym16:%'`,
    [orderId, buyerId],
  );
  if (!rows[0]) throw new HttpError(404, 'Reservation not found');
  return rows[0];
}

function workflowStage(orderStatus, items) {
  if (orderStatus === 'confirmed' || orderStatus === 'in_fulfilment' || orderStatus === 'delivered' || orderStatus === 'closed') {
    return 'confirmed';
  }
  if (orderStatus === 'expired' || orderStatus === 'cancelled') return orderStatus;
  const responses = items.filter((item) => item.responseKind && item.responseKind !== 'pending');
  if (orderStatus === 'ready_to_confirm') return 'evaluation';
  if (orderStatus === 'awaiting_suppliers' && responses.length === items.length && items.length > 0) return 'evaluation';
  if (orderStatus === 'awaiting_suppliers') return 'countdown';
  return 'review';
}

function mapItem(row) {
  const terms = row.original_terms || {};
  const requestedKg = Number(row.agreed_kg);
  const requestedPrice = Number(row.agreed_unit_price_cents);
  const offeredKg = Number(terms.offered_kg ?? row.commitment_kg ?? requestedKg);
  const offeredPrice = Number(terms.offered_unit_price_cents ?? row.commitment_price ?? requestedPrice);
  return {
    allocationId: row.allocation_id,
    reservationId: row.reservation_id,
    commitmentId: row.commitment_id,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    farmName: row.farm_name,
    farmDistrict: row.farm_district,
    pickupAddress: row.pickup_address,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    batchId: row.batch_id,
    crop: row.crop_name,
    grade: row.grade_name,
    requestedKg,
    requestedUnitPriceCents: requestedPrice,
    requestedValueCents: Number(row.agreed_value_cents),
    offeredKg,
    offeredUnitPriceCents: offeredPrice,
    offeredValueCents: moneyValue(offeredKg, offeredPrice),
    allocationStatus: row.allocation_status,
    reservationStatus: row.reservation_status,
    commitmentStatus: row.commitment_status,
    responseKind: terms.responseKind || 'pending',
    notes: terms.notes || '',
    quality: {
      moisture: terms.moisture || null,
      sizeClass: terms.sizeClass || null,
      label: terms.qualityLabel || row.grade_name,
    },
    imageTone: terms.imageTone || 'produce',
    expiresAt: row.expires_at,
    decisionReason: row.decision_reason,
  };
}

async function loadItems(client, orderId) {
  const { rows } = await client.query(
    `SELECT a.id AS allocation_id, a.farmer_id, a.batch_id, a.agreed_kg, a.agreed_unit_price_cents, a.agreed_value_cents,
            a.status AS allocation_status, a.decision_reason, a.funded_cents, a.held_cents,
            r.id AS reservation_id, r.status AS reservation_status, r.held_kg, r.expires_at, r.created_at AS hold_created_at,
            fc.id AS commitment_id, fc.status AS commitment_status, fc.quantity_kg AS commitment_kg,
            fc.agreed_unit_price_cents AS commitment_price, fc.original_terms, fc.window_start, fc.window_end,
            u.name AS farmer_name, f.name AS farm_name, f.district AS farm_district, f.pickup_address,
            f.latitude, f.longitude, c.name AS crop_name, g.name AS grade_name, hb.planned_harvest_date
     FROM allocations a
     JOIN users u ON u.id = a.farmer_id
     JOIN harvest_batches hb ON hb.id = a.batch_id
     JOIN farms f ON f.id = hb.farm_id
     JOIN crops c ON c.id = hb.crop_id
     JOIN grades g ON g.id = hb.grade_id
     LEFT JOIN reservations r ON r.allocation_id = a.id AND r.status IN ('active', 'consumed', 'released', 'expired')
     LEFT JOIN future_commitments fc ON fc.id = a.future_commitment_id
     WHERE a.order_id = $1
     ORDER BY a.created_at`,
    [orderId],
  );
  return rows;
}

async function loadAudit(client, orderId) {
  const { rows } = await client.query(
    `SELECT id, actor_id, action, reason, safe_changes, occurred_at
     FROM audit_logs
     WHERE target_id = $1 AND target_type IN ('orders', 'reservations', 'allocations')
     ORDER BY occurred_at DESC
     LIMIT 20`,
    [orderId],
  );
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    reason: row.reason,
    changes: row.safe_changes,
    occurredAt: row.occurred_at,
  }));
}

async function loadLedger(client, orderId) {
  const { rows } = await client.query(
    `SELECT e.id, e.event_type, e.event_reference, e.amount_cents, e.occurred_at, e.operation_key
     FROM wallet_journal_entries e
     WHERE e.order_id = $1
     ORDER BY e.occurred_at`,
    [orderId],
  );
  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    reference: row.event_reference,
    amountCents: Number(row.amount_cents),
    occurredAt: row.occurred_at,
    operationKey: row.operation_key,
    simulated: true,
  }));
}

export async function serializeReservation(client, order, requestId) {
  const itemRows = await loadItems(client, order.id);
  const items = itemRows.map(mapItem);
  const stage = workflowStage(order.status, items);
  const activeHold = itemRows.find((row) => row.reservation_status === 'active');
  const expiresAt = activeHold?.expires_at || itemRows[0]?.expires_at || null;
  const remainingSeconds = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
  const requestedKg = items.reduce((sum, item) => sum + item.requestedKg, 0);
  const committedKg = items
    .filter((item) => item.responseKind === 'accepted' || item.responseKind === 'counter' || item.allocationStatus === 'supplier_accepted' || item.allocationStatus === 'committed')
    .reduce((sum, item) => sum + (item.responseKind === 'pending' ? 0 : item.offeredKg), 0);
  const requestedCents = items.reduce((sum, item) => sum + item.requestedValueCents, 0);
  const committedCents = items
    .filter((item) => item.responseKind !== 'pending' && item.allocationStatus !== 'declined')
    .reduce((sum, item) => sum + item.offeredValueCents, 0);
  const acceptedCount = items.filter((item) => item.allocationStatus === 'supplier_accepted' || item.allocationStatus === 'committed' || item.commitmentStatus === 'accepted').length;
  const pendingCount = items.filter((item) => item.responseKind === 'pending' && item.allocationStatus === 'held').length;
  const harvestDates = itemRows.map((row) => row.window_start || row.planned_harvest_date).filter(Boolean);
  const auditTrail = await loadAudit(client, order.id);
  const ledger = await loadLedger(client, order.id);
  const holdEntry = ledger.find((entry) => entry.eventType === 'hold');
  const maps = {
    harvest: items.filter((item) => item.latitude != null).map((item) => ({
      name: item.farmName,
      district: item.farmDistrict,
      latitude: item.latitude,
      longitude: item.longitude,
    })),
    depot: { name: order.destination, district: order.destination_district, latitude: order.destination_latitude, longitude: order.destination_longitude },
  };
  return {
    module: 'YM16',
    requestId,
    order: {
      id: order.id,
      status: order.status,
      destination: order.destination,
      destinationDistrict: order.destination_district,
      deliveryDate: order.delivery_date,
      createdAt: order.created_at,
      contractReference: contractReference(order.id),
      cancellationReason: order.cancellation_reason,
    },
    workflow: {
      stage,
      steps: [
        { id: 'review', label: 'Review', complete: stage !== 'review' },
        { id: 'countdown', label: 'Hold', complete: ['evaluation', 'confirmed'].includes(stage) },
        { id: 'evaluation', label: 'Responses', complete: stage === 'confirmed' },
        { id: 'confirmed', label: 'Locked', complete: stage === 'confirmed' },
      ],
    },
    countdown: {
      expiresAt,
      remainingSeconds,
      expired: order.status === 'expired' || (Boolean(expiresAt) && remainingSeconds === 0 && order.status === 'awaiting_suppliers'),
    },
    summary: {
      requestedKg,
      committedKg,
      requestedCents,
      committedCents,
      priceVariancePct: requestedCents ? Number((((committedCents - requestedCents) / requestedCents) * 100).toFixed(1)) : 0,
      acceptedCount,
      pendingCount,
      supplierCount: items.length,
      escrowState: holdEntry ? (ledger.some((entry) => entry.eventType === 'reversal') ? 'released' : 'held') : 'not_placed',
    },
    produce: {
      title: 'Mixed highland allotment',
      harvestWindow: harvestDates.length ? `${harvestDates[0]} Ã¢â‚¬â€œ ${order.delivery_date}` : order.delivery_date,
      quality: 'Grade A inspected lots',
      deliveryHub: order.destination,
    },
    items,
    logistics: {
      inspectionWindow: '06:00Ã¢â‚¬â€œ10:00 at farm gate',
      disputeProtection: '48-hour buyer acceptance window after weighbridge',
      coldChain: 'Ambient highland produce, tarped loads',
      geofence: 'Depot 2.5 km radius around nominated hub',
      geofenceRadiusKm: 2.5,
    },
    escrow: {
      simulated: true,
      requestedCents,
      lockedCents: holdEntry && !ledger.some((entry) => entry.eventType === 'reversal') ? holdEntry.amountCents : 0,
      walletAvailableCents: Number(order.wallet_available_cents || 0),
      walletHeldCents: Number(order.wallet_held_cents || 0),
      ledger,
    },
    maps,
    audit: auditTrail,
    confirmation: order.status === 'confirmed' || order.status === 'in_fulfilment' ? {
      contractReference: contractReference(order.id),
      confirmedAt: order.updated_at,
      reservedKg: committedKg || requestedKg,
      lockedCents: holdEntry?.amountCents || requestedCents,
      execution: [
        { title: 'Telemetry monitoring', detail: 'Batch GPS and custody events remain on the shared trace record.' },
        { title: 'Pre-loading quality check', detail: 'Grade A inspection at pickup before weighbridge handover.' },
        { title: 'Weighbridge calibration', detail: 'Hub scale certificate required before escrow can move to settlement.' },
        { title: 'Escrow release on acceptance', detail: 'Simulated hold releases only after authorised buyer acceptance in later modules.' },
      ],
    } : null,
  };
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* keep original error */ }
    throw error;
  } finally {
    client.release();
  }
}

async function lookupCropGrade(client, cropName, gradeName) {
  const { rows: crops } = await client.query(`SELECT id FROM crops WHERE name = $1`, [cropName]);
  const { rows: grades } = await client.query(`SELECT id FROM grades WHERE name = $1`, [gradeName]);
  if (!crops[0] || !grades[0]) throw new HttpError(409, `Reference data missing for ${cropName} / ${gradeName}`);
  return { cropId: crops[0].id, gradeId: grades[0].id };
}

export async function listReservations(buyerId) {
  return withTransaction(async (client) => {
    await expireHolds(client);
    const { rows } = await client.query(
      `SELECT o.id, o.status, o.created_at, o.agreed_total_cents, o.destination, o.delivery_date,
              COALESCE(SUM(a.agreed_kg), 0) AS requested_kg
       FROM orders o
       LEFT JOIN allocations a ON a.order_id = o.id
       WHERE o.buyer_id = $1 AND o.operation_key LIKE 'ym16:%'
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [buyerId],
    );
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      destination: row.destination,
      deliveryDate: row.delivery_date,
      requestedKg: Number(row.requested_kg),
      agreedTotalCents: Number(row.agreed_total_cents),
      contractReference: contractReference(row.id),
    }));
  });
}

export async function getReservation(buyerId, orderId, requestId) {
  return withTransaction(async (client) => {
    await expireHolds(client);
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    return serializeReservation(client, order, requestId);
  });
}

export async function submitReservation(buyerId, orderId, actorId, requestId) {
  return withTransaction(async (client) => {
    await expireHolds(client);
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    if (order.status !== 'draft') throw new HttpError(409, 'Only a draft reservation can be submitted for farmer response');
    const items = await loadItems(client, orderId);
    if (!items.length) throw new HttpError(409, 'Reservation has no harvest allocations');
    const amountCents = items.reduce((sum, row) => sum + Number(row.agreed_value_cents), 0);
    await placeEscrow(client, {
      orderId, allocationId: items[0].allocation_id, buyerId, amountCents, actorId, requestId,
    });
    for (const row of items) {
      await client.query(
        `INSERT INTO reservations (allocation_id, held_kg, status, operation_key, expires_at)
         VALUES ($1, $2::numeric, 'active', $3, now() + ($4 || ' hours')::interval + ($5 || ' minutes')::interval)`,
        [row.allocation_id, row.agreed_kg, `ym16:reservation:${row.allocation_id}`, String(HOLD_HOURS), String(HOLD_MINUTES)],
      );
    }
    await client.query(
      `UPDATE orders SET status = 'awaiting_suppliers', updated_at = now() WHERE id = $1 AND status = 'draft'`,
      [orderId],
    );
    await audit(client, {
      actorId, action: 'ym16.reservation.submitted', targetType: 'orders', targetId: orderId, requestId,
      reason: 'Submitted batch reservation; simulated escrow hold placed',
      changes: { amountCents, holdHours: HOLD_HOURS, simulated: true },
    });
    const updated = await loadOrderForBuyer(client, orderId, buyerId);
    return serializeReservation(client, updated, requestId);
  });
}

async function decideAllocation(client, { order, allocationId, actorId, requestId, decision, reason }) {
  if (!['accept', 'decline', 'accept-counter'].includes(decision)) {
    throw new HttpError(422, 'Invalid input', { decision: 'Must be accept, decline or accept-counter' });
  }
  if (order.status !== 'awaiting_suppliers' && order.status !== 'ready_to_confirm') {
    throw new HttpError(409, 'Farmer responses can only be decided while the reservation hold is open');
  }
  const items = await loadItems(client, order.id);
  const row = items.find((item) => item.allocation_id === allocationId);
  if (!row) throw new HttpError(404, 'Allocation not found on this reservation');
  if (row.allocation_status !== 'held') throw new HttpError(409, 'This supplier allocation has already been decided');
  const terms = row.original_terms || {};
  if (decision === 'accept-counter' && terms.responseKind !== 'counter') {
    throw new HttpError(409, 'This supplier has not submitted a counter-offer');
  }
  if (decision === 'accept' && terms.responseKind === 'counter') {
    throw new HttpError(409, 'Use accept-counter for a priced counter-offer');
  }
  if (decision === 'decline') {
    await client.query(
      `UPDATE allocations SET status = 'declined', decision_reason = $2 WHERE id = $1 AND status = 'held'`,
      [allocationId, reason || 'Buyer declined supplier response'],
    );
    await client.query(
      `UPDATE future_commitments SET status = 'rejected', decision_reason = $2 WHERE id = $1 AND status = 'proposed'`,
      [row.commitment_id, reason || 'Buyer declined supplier response'],
    );
    await client.query(
      `UPDATE reservations SET status = 'released', terminal_at = now() WHERE allocation_id = $1 AND status = 'active'`,
      [allocationId],
    );
  } else {
    const offeredValue = moneyValue(terms.offered_kg || row.agreed_kg, terms.offered_unit_price_cents || row.agreed_unit_price_cents);
    if (offeredValue > Number(row.agreed_value_cents)) {
      throw new HttpError(409, 'Counter-offer exceeds the escrowed allocation value and cannot be accepted');
    }
    await client.query(
      `UPDATE allocations SET status = 'supplier_accepted', decision_reason = $2 WHERE id = $1 AND status = 'held'`,
      [allocationId, reason || (decision === 'accept-counter' ? 'Buyer accepted counter-offer within escrow cap' : 'Buyer accepted farmer terms')],
    );
    await client.query(
      `UPDATE future_commitments
       SET status = 'accepted',
           decisions = decisions || $2::jsonb
       WHERE id = $1 AND status = 'proposed'`,
      [row.commitment_id, JSON.stringify([{ at: new Date().toISOString(), decision, actorId }])],
    );
  }
  await audit(client, {
    actorId, action: `ym16.response.${decision}`, targetType: 'orders', targetId: order.id, requestId,
    reason: reason || `Buyer ${decision} supplier allocation`,
    changes: { allocationId, decision },
  });

  const remaining = await loadItems(client, order.id);
  const undecided = remaining.filter((item) => item.allocation_status === 'held');
  const accepted = remaining.filter((item) => item.allocation_status === 'supplier_accepted');
  if (undecided.length === 0 && accepted.length > 0 && order.status === 'awaiting_suppliers') {
    await client.query(`UPDATE orders SET status = 'ready_to_confirm', updated_at = now() WHERE id = $1`, [order.id]);
  }
  if (undecided.length === 0 && accepted.length === 0) {
    await client.query(
      `UPDATE orders SET status = 'cancelled', cancellation_reason = $2, updated_at = now()
       WHERE id = $1 AND status IN ('awaiting_suppliers', 'ready_to_confirm')`,
      [order.id, 'All supplier responses were declined'],
    );
    await releaseEscrow(client, { orderId: order.id, actorId, requestId, reason: 'All allocations declined' });
  }
}

export async function decideFarmerResponse(buyerId, orderId, allocationId, decision, reason, actorId, requestId) {
  return withTransaction(async (client) => {
    await expireHolds(client);
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    await decideAllocation(client, { order, allocationId, actorId, requestId, decision, reason });
    const updated = await loadOrderForBuyer(client, orderId, buyerId);
    return serializeReservation(client, updated, requestId);
  });
}

export async function confirmReservation(buyerId, orderId, actorId, requestId) {
  return withTransaction(async (client) => {
    await expireHolds(client);
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    if (order.status !== 'ready_to_confirm') {
      throw new HttpError(409, 'Reservation is not ready to confirm. Accept remaining farmer responses first.');
    }
    const items = await loadItems(client, orderId);
    const accepted = items.filter((item) => item.allocation_status === 'supplier_accepted');
    if (!accepted.length) throw new HttpError(409, 'No accepted supplier allocations to confirm');
    for (const row of accepted) {
      const terms = row.original_terms || {};
      const committedKg = Math.min(Number(row.agreed_kg), Number(terms.offered_kg || row.agreed_kg)).toFixed(3);
      await client.query(
        `UPDATE allocations SET status = 'committed', committed_kg = $2::numeric WHERE id = $1 AND status = 'supplier_accepted'`,
        [row.allocation_id, committedKg],
      );
      await client.query(
        `UPDATE reservations SET status = 'consumed', terminal_at = now() WHERE allocation_id = $1 AND status = 'active'`,
        [row.allocation_id],
      );
      await client.query(
        `UPDATE future_commitments SET status = 'ready_to_fulfil' WHERE id = $1 AND status = 'accepted'`,
        [row.commitment_id],
      );
    }
    await client.query(`UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1 AND status = 'ready_to_confirm'`, [orderId]);
    await audit(client, {
      actorId, action: 'ym16.reservation.confirmed', targetType: 'orders', targetId: orderId, requestId,
      reason: 'Confirmed reservation and consumed active holds. Escrow remains a simulated wallet hold.',
      changes: { contractReference: contractReference(orderId), accepted: accepted.length, simulated: true },
    });
    const updated = await loadOrderForBuyer(client, orderId, buyerId);
    return serializeReservation(client, updated, requestId);
  });
}

export async function createReservation(buyerId, actorId, body, requestId) {
  const commitmentIds = body?.commitmentIds;
  const destination = typeof body?.destination === 'string' ? body.destination.trim() : '';
  const destinationDistrict = typeof body?.destinationDistrict === 'string' ? body.destinationDistrict.trim() : '';
  const deliveryDate = typeof body?.deliveryDate === 'string' ? body.deliveryDate : '';
  if (!Array.isArray(commitmentIds) || commitmentIds.length === 0 || commitmentIds.length > 100) {
    throw new HttpError(422, 'Invalid input', { commitmentIds: 'Provide one or more commitment IDs' });
  }
  for (const commitmentId of commitmentIds) requireUuid(commitmentId, 'commitmentIds');
  if (!destination || !destinationDistrict || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    throw new HttpError(422, 'Invalid input', { destination, destinationDistrict, deliveryDate: 'Valid destination and delivery date are required' });
  }

  return withTransaction(async (client) => {
    const { rows: commitments } = await client.query(
      `SELECT fc.id, fc.quantity_kg, fc.agreed_unit_price_cents, fc.batch_id, fc.farmer_id
       FROM future_commitments fc
       WHERE fc.id = ANY($1::uuid[]) AND fc.buyer_id = $2 AND fc.status = 'proposed'
       FOR UPDATE`,
      [commitmentIds, buyerId],
    );
    if (commitments.length !== commitmentIds.length) {
      throw new HttpError(409, 'One or more commitments are unavailable or already assigned');
    }
    const { rows: existing } = await client.query(
      `SELECT allocation_id FROM allocations WHERE future_commitment_id = ANY($1::uuid[]) LIMIT 1`,
      [commitmentIds],
    );
    if (existing[0]) throw new HttpError(409, 'A commitment is already assigned to a reservation');

    const orderId = randomUUID();
    let totalCents = 0;
    await client.query(
      `INSERT INTO orders (
        id, buyer_id, destination, destination_district, delivery_date, agreed_total_cents, status, operation_key
      ) VALUES ($1, $2, $3, $4, $5::date, 0, 'draft', $6)`,
      [orderId, buyerId, destination, destinationDistrict, deliveryDate, `ym16:order:${orderId}`],
    );
    for (const commitment of commitments) {
      const allocationId = randomUUID();
      const kg = Number(commitment.quantity_kg);
      const price = Number(commitment.agreed_unit_price_cents);
      totalCents += Math.round(kg * price);
      await client.query(
        `INSERT INTO allocations (
          id, order_id, batch_id, farmer_id, future_commitment_id, agreed_kg,
          agreed_unit_price_cents, status, operation_key
        ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7, 'held', $8)`,
        [allocationId, orderId, commitment.batch_id, commitment.farmer_id, commitment.id,
          kg.toFixed(3), price, `ym16:allocation:${allocationId}`],
      );
    }
    await client.query(`UPDATE orders SET agreed_total_cents = $2, updated_at = now() WHERE id = $1`, [orderId, totalCents]);
    await audit(client, {
      actorId, action: 'ym16.reservation.created', targetType: 'orders', targetId: orderId, requestId,
      reason: 'Created reservation from existing commitments',
      changes: { commitmentIds, agreedTotalCents: totalCents },
    });
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    return serializeReservation(client, order, requestId);
  });
}

export async function listFarmerReservations(farmerId, requestId) {
  return withTransaction(async (client) => {
    await expireHolds(client);
    const { rows } = await client.query(
      `SELECT DISTINCT o.id, o.created_at
       FROM orders o
       JOIN allocations a ON a.order_id = o.id
       WHERE a.farmer_id = $1 AND o.operation_key LIKE 'ym16:%'
       ORDER BY o.created_at DESC`,
      [farmerId],
    );
    const reservations = [];
    for (const row of rows) {
      const order = await loadOrderForBuyer(client, row.id, await getBuyerIdForOrder(client, row.id));
      const payload = await serializeReservation(client, order, requestId);
      payload.items = payload.items.filter((item) => item.farmerId === farmerId);
      reservations.push(payload);
    }
    return { reservations, requestId };
  });
}

async function getBuyerIdForOrder(client, orderId) {
  const { rows } = await client.query(`SELECT buyer_id FROM orders WHERE id = $1`, [orderId]);
  return rows[0]?.buyer_id;
}

export async function submitFarmerResponse(farmerId, orderId, body, actorId, requestId) {
  const allocationId = typeof body?.allocationId === 'string' ? body.allocationId : '';
  requireUuid(allocationId, 'allocationId');
  const response = body?.response;
  if (!['accept', 'reject', 'counter'].includes(response)) {
    throw new HttpError(422, 'Invalid input', { response: 'Must be accept, reject or counter' });
  }
  const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 500) : '';

  return withTransaction(async (client) => {
    await expireHolds(client);
    const { rows: orderRows } = await client.query(
      `SELECT o.* FROM orders o JOIN allocations a ON a.order_id = o.id
       WHERE o.id = $1 AND a.id = $2 AND a.farmer_id = $3 AND o.operation_key LIKE 'ym16:%'
       FOR UPDATE`,
      [orderId, allocationId, farmerId],
    );
    if (!orderRows[0]) throw new HttpError(404, 'Reservation or allocation not found');
    if (orderRows[0].status !== 'awaiting_suppliers') {
      throw new HttpError(409, 'This reservation is not open for farmer responses');
    }

    const items = await loadItems(client, orderId);
    const row = items.find((item) => item.allocation_id === allocationId);
    if (!row) throw new HttpError(404, 'Allocation not found');
    if (row.reservation_status !== 'active') throw new HttpError(409, 'The reservation hold is not active');
    const terms = row.original_terms || {};
    if (terms.responseKind && terms.responseKind !== 'pending') {
      throw new HttpError(409, 'A response has already been submitted for this allocation');
    }

    let offeredKg = Number(row.agreed_kg);
    let offeredPrice = Number(row.agreed_unit_price_cents);
    if (response === 'counter') {
      offeredKg = Number(body?.offeredKg);
      offeredPrice = Number(body?.offeredUnitPriceCents);
      if (!Number.isFinite(offeredKg) || offeredKg <= 0 || offeredKg > Number(row.agreed_kg)) {
        throw new HttpError(422, 'Invalid input', { offeredKg: 'Counter-offered quantity must be greater than zero and no more than requested quantity' });
      }
      if (!Number.isInteger(offeredPrice) || offeredPrice <= 0) {
        throw new HttpError(422, 'Invalid input', { offeredUnitPriceCents: 'Counter-offered price must be a positive integer in cents' });
      }
      if (Math.round(offeredKg * offeredPrice) > Number(row.agreed_value_cents)) {
        throw new HttpError(422, 'Invalid input', { offeredUnitPriceCents: 'Counter-offer cannot exceed the escrowed allocation value' });
      }
    }

    const responseKind = response === 'accept' ? 'accepted' : response === 'reject' ? 'rejected' : 'counter';
    const nextTerms = {
      ...terms,
      responseKind,
      offered_kg: offeredKg,
      offered_unit_price_cents: offeredPrice,
      notes,
      respondedAt: new Date().toISOString(),
    };
    await client.query(
      `UPDATE future_commitments
       SET original_terms = $2::jsonb,
           quantity_kg = $3::numeric,
           agreed_unit_price_cents = $4
       WHERE id = $1`,
      [row.commitment_id, JSON.stringify(nextTerms), offeredKg.toFixed(3), offeredPrice],
    );
    await audit(client, {
      actorId, action: `ym16.response.${responseKind}`, targetType: 'allocations', targetId: allocationId, requestId,
      reason: notes || `Farmer submitted ${responseKind} response`,
      changes: { allocationId, responseKind, offeredKg, offeredUnitPriceCents: offeredPrice },
    });

    const order = await loadOrderForBuyer(client, orderId, orderRows[0].buyer_id);
    return serializeReservation(client, order, requestId);
  });
}

export async function getReservationStatus(buyerId, orderId, requestId) {
  return withTransaction(async (client) => {
    await expireHolds(client);
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    return serializeReservation(client, order, requestId);
  });
}

export async function getReservationEscrow(buyerId, orderId) {
  return withTransaction(async (client) => {
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    const payload = await serializeReservation(client, order, null);
    return { escrow: payload.escrow, summary: payload.summary, requestId: null };
  });
}

export async function getReservationLedger(buyerId, orderId) {
  return withTransaction(async (client) => {
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    return { ledger: await loadLedger(client, order.id), requestId: null };
  });
}

export async function getReservationAudit(buyerId, orderId) {
  return withTransaction(async (client) => {
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    return { audit: await loadAudit(client, order.id), requestId: null };
  });
}

export async function messageFarmer(buyerId, orderId, allocationId, body, actorId, requestId) {
  const text = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!text || text.length > 500) {
    throw new HttpError(422, 'Invalid input', { message: 'Enter a message up to 500 characters' });
  }
  return withTransaction(async (client) => {
    const order = await loadOrderForBuyer(client, orderId, buyerId);
    const items = await loadItems(client, order.id);
    const row = items.find((item) => item.allocation_id === allocationId);
    if (!row) throw new HttpError(404, 'Allocation not found on this reservation');
    await client.query(
      `INSERT INTO notifications (user_id, title, message, category, target_path, operation_key)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        row.farmer_id,
        'Buyer reservation message',
        text,
        'reservations',
        `/farmer/allocations`,
        `ym16:message:${allocationId}:${randomUUID()}`,
      ],
    );
    await audit(client, {
      actorId, action: 'ym16.message.sent', targetType: 'orders', targetId: orderId, requestId,
      reason: 'In-app message recorded for supplier',
      changes: { allocationId, farmerId: row.farmer_id },
    });
    const updated = await loadOrderForBuyer(client, orderId, buyerId);
    return serializeReservation(client, updated, requestId);
  });
}

export async function getWallet(buyerId) {
  const { rows } = await pool.query(
    `SELECT available_cents, held_cents, pending_payout_cents, simulated, currency FROM wallets WHERE owner_id = $1`,
    [buyerId],
  );
  if (!rows[0]) throw new HttpError(404, 'Agri Wallet not found');
  return {
    availableCents: Number(rows[0].available_cents),
    heldCents: Number(rows[0].held_cents),
    pendingPayoutCents: Number(rows[0].pending_payout_cents),
    simulated: rows[0].simulated,
    currency: rows[0].currency,
  };
}
