import pool from '../../config/db.js';

// YM28 · Umindu Isith · Buyer wallet & reconciliation

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_EVENT_TYPES = new Set([
  'funding',
  'hold',
  'settlement',
  'refund',
  'payout_hold',
  'payout',
  'payout_release',
  'reversal',
]);
const MAX_SINGLE_FUNDING_CENTS = 10000000000n; // LKR 100,000,000.00 cap per simulated top-up

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function parsePagination(query) {
  const rawPage = query.page ?? '1';
  const rawLimit = query.limit ?? '20';
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isInteger(page) || page < 1) {
    return { error: 'page must be a positive integer.' };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { error: 'limit must be an integer between 1 and 100.' };
  }
  return { page, limit, offset: (page - 1) * limit };
}

// DR-06: strict decimal parsing to integer LKR cents without float rounding or silent truncation
function parseLkrToCents(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { error: 'Amount in LKR is required.' };
  }
  const normalized = String(raw).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { error: 'Enter a valid positive LKR amount with at most 2 decimal places.' };
  }
  const [wholePart, fracPart = ''] = normalized.split('.');
  const cents = BigInt(wholePart) * 100n + BigInt(fracPart.padEnd(2, '0'));
  if (cents <= 0n) {
    return { error: 'Amount must be greater than LKR 0.00.' };
  }
  if (cents > MAX_SINGLE_FUNDING_CENTS) {
    return { error: 'Amount exceeds the single simulated funding limit of LKR 100,000,000.00.' };
  }
  return { cents };
}

function formatCentsToLkr(centsValue) {
  const big = BigInt(centsValue ?? 0);
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${frac}`;
}

function rejectUnsupportedFields(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  const unsupported = Object.keys(body).filter((key) => !allowedFields.includes(key));
  return unsupported;
}

async function requireApprovedUser(db, userId, expectedRole) {
  const { rows } = await db.query(
    `SELECT id, name, email, role, approval_status
     FROM users
     WHERE id = $1 AND role = $2 AND approval_status = 'approved'`,
    [userId, expectedRole]
  );
  return rows[0] || null;
}

async function getWalletForUser(db, userId, accountType) {
  const { rows } = await db.query(
    `SELECT id, owner_id, account_type, currency, available_cents, held_cents,
            pending_payout_cents, simulated, created_at
     FROM wallets
     WHERE owner_id = $1 AND account_type = $2`,
    [userId, accountType]
  );
  return rows[0] || null;
}

function bucketToColumn(bucket) {
  if (bucket === 'available') return 'available_cents';
  if (bucket === 'held') return 'held_cents';
  if (bucket === 'pending_payout') return 'pending_payout_cents';
  return null;
}

// ---------------------------------------------------------------------------
// 0. Base module status check (kept for Developer Guide verification)
// ---------------------------------------------------------------------------
export async function getStatus(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!rows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }
    return res.json({
      module: 'YM28',
      owner: 'Umindu Isith',
      status: 'active',
      simulated: true,
      user: rows[0],
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// 1. BUYER: Wallet overview & summary (FR-WAL-01, FR-WAL-07)
// ---------------------------------------------------------------------------
export async function getBuyerWallet(req, res, next) {
  try {
    const account = await requireApprovedUser(pool, req.user.id, 'buyer');
    if (!account) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const wallet = await getWalletForUser(pool, req.user.id, 'buyer');
    if (!wallet) {
      return res.status(404).json({
        error: 'Simulated buyer wallet not found for this account.',
        requestId: req.requestId,
      });
    }

    const [metricsResult, activeOrdersResult] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN e.event_type = 'funding' THEN l.amount_cents ELSE 0 END), 0)::BIGINT AS total_funded_cents,
           COALESCE(SUM(CASE WHEN e.event_type = 'settlement' AND l.side = 'debit' THEN l.amount_cents ELSE 0 END), 0)::BIGINT AS total_settled_cents,
           COALESCE(SUM(CASE WHEN e.event_type = 'refund' AND l.bucket = 'available' AND l.side = 'credit' THEN l.amount_cents ELSE 0 END), 0)::BIGINT AS total_refunded_cents,
           COUNT(DISTINCT e.id)::INT AS total_transaction_count
         FROM wallet_journal_lines l
         JOIN wallet_journal_entries e ON e.id = l.entry_id
         WHERE l.wallet_id = $1`,
        [wallet.id]
      ),
      pool.query(
        `SELECT
           COUNT(DISTINCT o.id)::INT AS held_order_count,
           COUNT(a.id)::INT AS held_allocation_count,
           COALESCE(SUM(a.held_cents), 0)::BIGINT AS allocation_held_cents
         FROM allocations a
         JOIN orders o ON o.id = a.order_id
         WHERE o.buyer_id = $1 AND a.held_cents > 0`,
        [req.user.id]
      ),
    ]);

    const metrics = metricsResult.rows[0];
    const activeHolds = activeOrdersResult.rows[0];

    return res.json({
      simulated: true,
      simulationNotice:
        'Simulated Agri Wallet — all funding, order holds, settlements and refunds are local demonstration records in LKR. No bank credentials or real payment networks are used.',
      wallet: {
        id: wallet.id,
        ownerId: wallet.owner_id,
        ownerName: account.name,
        accountType: wallet.account_type,
        currency: wallet.currency,
        availableCents: wallet.available_cents,
        heldCents: wallet.held_cents,
        pendingPayoutCents: wallet.pending_payout_cents,
        totalBalanceCents: (BigInt(wallet.available_cents) + BigInt(wallet.held_cents)).toString(),
        simulated: wallet.simulated,
        createdAt: wallet.created_at,
      },
      summary: {
        totalFundedCents: metrics.total_funded_cents,
        totalSettledCents: metrics.total_settled_cents,
        totalRefundedCents: metrics.total_refunded_cents,
        totalTransactionCount: metrics.total_transaction_count,
        heldOrderCount: activeHolds.held_order_count,
        heldAllocationCount: activeHolds.held_allocation_count,
        allocationHeldCents: activeHolds.allocation_held_cents,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// 2. BUYER: Paginated wallet transaction history (FR-WAL-07, NFR-QUAL-02)
// ---------------------------------------------------------------------------
export async function getBuyerTransactions(req, res, next) {
  try {
    const account = await requireApprovedUser(pool, req.user.id, 'buyer');
    if (!account) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const wallet = await getWalletForUser(pool, req.user.id, 'buyer');
    if (!wallet) {
      return res.status(404).json({ error: 'Buyer wallet not found.', requestId: req.requestId });
    }

    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({
        error: pagination.error,
        fieldErrors: { pagination: pagination.error },
        requestId: req.requestId,
      });
    }

    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    if (eventType && !VALID_EVENT_TYPES.has(eventType)) {
      return res.status(400).json({
        error: 'Invalid eventType filter.',
        fieldErrors: { eventType: 'Unsupported event type.' },
        requestId: req.requestId,
      });
    }

    const conditions = ['EXISTS (SELECT 1 FROM wallet_journal_lines wl WHERE wl.entry_id = e.id AND wl.wallet_id = $1)'];
    const params = [wallet.id];

    if (eventType) {
      params.push(eventType);
      conditions.push(`e.event_type = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(e.event_reference ILIKE $${params.length} OR e.id::TEXT ILIKE $${params.length} OR COALESCE(e.order_id::TEXT, '') ILIKE $${params.length})`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::INT AS total
       FROM wallet_journal_entries e
       WHERE ${whereClause}`,
      params
    );

    const listParams = [...params, pagination.limit, pagination.offset];
    const { rows } = await pool.query(
      `SELECT
         e.id,
         e.event_type,
         e.event_reference,
         e.operation_key,
         e.currency,
         e.amount_cents,
         e.order_id,
         e.allocation_id,
         e.reversal_of,
         e.occurred_at,
         e.recorded_at,
         rev.id AS reversed_by_id,
         COALESCE(SUM(CASE WHEN l.bucket = 'available' THEN CASE WHEN l.side = 'credit' THEN l.amount_cents ELSE -l.amount_cents END ELSE 0 END), 0)::BIGINT AS available_delta_cents,
         COALESCE(SUM(CASE WHEN l.bucket = 'held' THEN CASE WHEN l.side = 'credit' THEN l.amount_cents ELSE -l.amount_cents END ELSE 0 END), 0)::BIGINT AS held_delta_cents
       FROM wallet_journal_entries e
       JOIN wallet_journal_lines l ON l.entry_id = e.id AND l.wallet_id = $1
       LEFT JOIN wallet_journal_entries rev ON rev.reversal_of = e.id
       WHERE ${whereClause}
       GROUP BY e.id, rev.id
       ORDER BY e.occurred_at DESC, e.recorded_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const total = countResult.rows[0].total;
    return res.json({
      simulated: true,
      transactions: rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        eventReference: row.event_reference,
        currency: row.currency,
        amountCents: row.amount_cents,
        availableDeltaCents: row.available_delta_cents,
        heldDeltaCents: row.held_delta_cents,
        orderId: row.order_id,
        allocationId: row.allocation_id,
        reversalOf: row.reversal_of,
        reversedById: row.reversed_by_id,
        occurredAt: row.occurred_at,
        recordedAt: row.recorded_at,
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// 3. BUYER: Single transaction detail with ownership check (FR-WAL-07, FR-ACC-09)
// ---------------------------------------------------------------------------
export async function getBuyerTransactionDetail(req, res, next) {
  try {
    const account = await requireApprovedUser(pool, req.user.id, 'buyer');
    if (!account) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { entryId } = req.params;
    if (!isUuid(entryId)) {
      return res.status(400).json({ error: 'Invalid transaction ID format.', requestId: req.requestId });
    }

    const wallet = await getWalletForUser(pool, req.user.id, 'buyer');
    if (!wallet) {
      return res.status(404).json({ error: 'Buyer wallet not found.', requestId: req.requestId });
    }

    // Strict ownership: buyer can only view entries that touch their own wallet
    const entryResult = await pool.query(
      `SELECT
         e.id, e.event_type, e.event_reference, e.operation_key, e.currency,
         e.amount_cents, e.order_id, e.allocation_id, e.reversal_of,
         e.occurred_at, e.recorded_at,
         actor.name AS actor_name,
         actor.role AS actor_role,
         rev.id AS reversed_by_id
       FROM wallet_journal_entries e
       JOIN users actor ON actor.id = e.actor_id
       LEFT JOIN wallet_journal_entries rev ON rev.reversal_of = e.id
       WHERE e.id = $1
         AND EXISTS (
           SELECT 1 FROM wallet_journal_lines wl
           WHERE wl.entry_id = e.id AND wl.wallet_id = $2
         )`,
      [entryId, wallet.id]
    );

    const entry = entryResult.rows[0];
    if (!entry) {
      return res.status(404).json({ error: 'Transaction not found.', requestId: req.requestId });
    }

    const linesResult = await pool.query(
      `SELECT l.id, l.wallet_id, l.bucket, l.side, l.amount_cents, l.created_at,
              w.account_type,
              CASE WHEN l.wallet_id = $2 THEN 'Your Buyer Wallet'
                   WHEN w.account_type = 'simulation_source' THEN 'Simulation Source'
                   ELSE initcap(w.account_type) || ' Wallet'
              END AS wallet_label
       FROM wallet_journal_lines l
       JOIN wallets w ON w.id = l.wallet_id
       WHERE l.entry_id = $1
       ORDER BY l.side DESC, l.created_at ASC`,
      [entryId, wallet.id]
    );

    let orderInfo = null;
    if (entry.order_id) {
      const orderRes = await pool.query(
        `SELECT id, destination, destination_district, delivery_date, agreed_total_cents, status, cancellation_reason
         FROM orders
         WHERE id = $1 AND buyer_id = $2`,
        [entry.order_id, req.user.id]
      );
      orderInfo = orderRes.rows[0] || null;
    }

    let allocationInfo = null;
    if (entry.allocation_id) {
      const allocRes = await pool.query(
        `SELECT a.id, a.order_id, a.batch_id, a.agreed_kg, a.agreed_unit_price_cents,
                a.agreed_value_cents, a.accepted_kg, a.funded_cents, a.settled_cents,
                a.refunded_cents, a.held_cents, a.status, f.name AS farmer_name
         FROM allocations a
         JOIN orders o ON o.id = a.order_id
         JOIN users f ON f.id = a.farmer_id
         WHERE a.id = $1 AND o.buyer_id = $2`,
        [entry.allocation_id, req.user.id]
      );
      allocationInfo = allocRes.rows[0] || null;
    }

    return res.json({
      simulated: true,
      transaction: {
        id: entry.id,
        eventType: entry.event_type,
        eventReference: entry.event_reference,
        currency: entry.currency,
        amountCents: entry.amount_cents,
        orderId: entry.order_id,
        allocationId: entry.allocation_id,
        reversalOf: entry.reversal_of,
        reversedById: entry.reversed_by_id,
        actorName: entry.actor_name,
        actorRole: entry.actor_role,
        occurredAt: entry.occurred_at,
        recordedAt: entry.recorded_at,
        lines: linesResult.rows.map((l) => ({
          id: l.id,
          walletLabel: l.wallet_label,
          accountType: l.account_type,
          isOwnWallet: l.wallet_id === wallet.id,
          bucket: l.bucket,
          side: l.side,
          amountCents: l.amount_cents,
          createdAt: l.created_at,
        })),
        order: orderInfo
          ? {
              id: orderInfo.id,
              destination: orderInfo.destination,
              destinationDistrict: orderInfo.destination_district,
              deliveryDate: orderInfo.delivery_date,
              agreedTotalCents: orderInfo.agreed_total_cents,
              status: orderInfo.status,
              cancellationReason: orderInfo.cancellation_reason,
            }
          : null,
        allocation: allocationInfo
          ? {
              id: allocationInfo.id,
              orderId: allocationInfo.order_id,
              batchId: allocationInfo.batch_id,
              farmerName: allocationInfo.farmer_name,
              agreedKg: allocationInfo.agreed_kg,
              agreedUnitPriceCents: allocationInfo.agreed_unit_price_cents,
              agreedValueCents: allocationInfo.agreed_value_cents,
              acceptedKg: allocationInfo.accepted_kg,
              fundedCents: allocationInfo.funded_cents,
              settledCents: allocationInfo.settled_cents,
              refundedCents: allocationInfo.refunded_cents,
              heldCents: allocationInfo.held_cents,
              status: allocationInfo.status,
            }
          : null,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// 4. BUYER: Create idempotent simulated funding (FR-WAL-02, FR-WAL-04, FR-WAL-10)
// ---------------------------------------------------------------------------
export async function createSimulatedFunding(req, res, next) {
  const unsupported = rejectUnsupportedFields(req.body, ['amountLkr', 'reference', 'operationKey']);
  if (unsupported.length > 0) {
    return res.status(400).json({
      error: `Unsupported request field(s): ${unsupported.join(', ')}`,
      fieldErrors: { payload: `Unsupported fields: ${unsupported.join(', ')}` },
      requestId: req.requestId,
    });
  }

  const parsedAmount = parseLkrToCents(req.body.amountLkr);
  const rawReference = typeof req.body.reference === 'string' ? req.body.reference.trim() : '';
  const rawOpKey =
    (typeof req.body.operationKey === 'string' && req.body.operationKey.trim()) ||
    (typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key'].trim()) ||
    '';

  const fieldErrors = {};
  if (parsedAmount.error) fieldErrors.amountLkr = parsedAmount.error;
  if (rawReference.length > 140) {
    fieldErrors.reference = 'Reference note must be 140 characters or fewer.';
  }
  if (!rawOpKey || rawOpKey.length < 8 || rawOpKey.length > 120) {
    fieldErrors.operationKey = 'A durable operationKey (8–120 characters) is required for idempotent funding.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Please correct the highlighted funding details.',
      fieldErrors,
      requestId: req.requestId,
    });
  }

  const amountCentsStr = parsedAmount.cents.toString();
  const eventReference = rawReference || `Simulated buyer funding - LKR ${formatCentsToLkr(parsedAmount.cents)}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const account = await requireApprovedUser(client, req.user.id, 'buyer');
    if (!account) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    // Lock buyer wallet and simulation source wallet in deterministic order
    const walletsRes = await client.query(
      `SELECT id, owner_id, account_type, currency, available_cents, held_cents, pending_payout_cents, simulated
       FROM wallets
       WHERE (owner_id = $1 AND account_type = 'buyer') OR account_type = 'simulation_source'
       ORDER BY id
       FOR UPDATE`,
      [req.user.id]
    );

    const buyerWallet = walletsRes.rows.find((w) => w.owner_id === req.user.id && w.account_type === 'buyer');
    const sourceWallet = walletsRes.rows.find((w) => w.account_type === 'simulation_source');

    if (!buyerWallet || !sourceWallet) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        error: 'Required simulated wallets are not configured in the database.',
        requestId: req.requestId,
      });
    }

    // Idempotency check (FR-RES-08 / FR-WAL-10)
    const existingRes = await client.query(
      `SELECT id, event_type, event_reference, operation_key, currency, amount_cents, actor_id, occurred_at, recorded_at
       FROM wallet_journal_entries
       WHERE operation_key = $1`,
      [rawOpKey]
    );

    if (existingRes.rows[0]) {
      const existing = existingRes.rows[0];
      const sameOwner = existing.actor_id === req.user.id;
      const sameInput =
        existing.event_type === 'funding' &&
        BigInt(existing.amount_cents) === parsedAmount.cents &&
        existing.event_reference === eventReference;

      await client.query('ROLLBACK');

      if (!sameOwner || !sameInput) {
        return res.status(409).json({
          error: 'This operation key was already used with different funding details.',
          requestId: req.requestId,
        });
      }

      return res.status(200).json({
        idempotentReplay: true,
        simulated: true,
        entry: {
          id: existing.id,
          eventType: existing.event_type,
          eventReference: existing.event_reference,
          operationKey: existing.operation_key,
          currency: existing.currency,
          amountCents: existing.amount_cents,
          occurredAt: existing.occurred_at,
          recordedAt: existing.recorded_at,
        },
        wallet: {
          id: buyerWallet.id,
          availableCents: buyerWallet.available_cents,
          heldCents: buyerWallet.held_cents,
          pendingPayoutCents: buyerWallet.pending_payout_cents,
          currency: buyerWallet.currency,
          simulated: buyerWallet.simulated,
        },
        requestId: req.requestId,
      });
    }

    // Post balanced double-entry journal + update buyer wallet atomically
    const entryInsert = await client.query(
      `INSERT INTO wallet_journal_entries (event_type, event_reference, operation_key, currency, amount_cents, actor_id)
       VALUES ('funding', $1, $2, 'LKR', $3::BIGINT, $4)
       RETURNING id, event_type, event_reference, operation_key, currency, amount_cents, occurred_at, recorded_at`,
      [eventReference, rawOpKey, amountCentsStr, req.user.id]
    );
    const entry = entryInsert.rows[0];

    await client.query(
      `INSERT INTO wallet_journal_lines (entry_id, wallet_id, bucket, side, amount_cents)
       VALUES
         ($1, $2, 'simulation_equity', 'debit', $4::BIGINT),
         ($1, $3, 'available', 'credit', $4::BIGINT)`,
      [entry.id, sourceWallet.id, buyerWallet.id, amountCentsStr]
    );

    const updatedWalletRes = await client.query(
      `UPDATE wallets
       SET available_cents = available_cents + $1::BIGINT
       WHERE id = $2
       RETURNING id, available_cents, held_cents, pending_payout_cents, currency, simulated`,
      [amountCentsStr, buyerWallet.id]
    );
    const updatedWallet = updatedWalletRes.rows[0];

    // Transactional in-app notification (FR-ADM-06, FR-ADM-08)
    await client.query(
      `INSERT INTO notifications (user_id, title, message, category, target_path, channel, status, operation_key)
       VALUES ($1, $2, $3, 'wallet', '/buyer/wallet', 'in_app', 'sent', $4)
       ON CONFLICT (operation_key) DO NOTHING`,
      [
        req.user.id,
        'Simulated wallet funded',
        `Added LKR ${formatCentsToLkr(parsedAmount.cents)} (simulated) to your Buyer Agri Wallet. Ref: ${eventReference}`,
        `ym28:funding:notif:${rawOpKey}`,
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      idempotentReplay: false,
      simulated: true,
      entry: {
        id: entry.id,
        eventType: entry.event_type,
        eventReference: entry.event_reference,
        operationKey: entry.operation_key,
        currency: entry.currency,
        amountCents: entry.amount_cents,
        occurredAt: entry.occurred_at,
        recordedAt: entry.recorded_at,
      },
      wallet: {
        id: updatedWallet.id,
        availableCents: updatedWallet.available_cents,
        heldCents: updatedWallet.held_cents,
        pendingPayoutCents: updatedWallet.pending_payout_cents,
        currency: updatedWallet.currency,
        simulated: updatedWallet.simulated,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 5. BUYER: Held funds by order and allocation (FR-WAL-03, FR-WAL-07)
// ---------------------------------------------------------------------------
export async function getBuyerHeldFunds(req, res, next) {
  try {
    const account = await requireApprovedUser(pool, req.user.id, 'buyer');
    if (!account) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const wallet = await getWalletForUser(pool, req.user.id, 'buyer');
    if (!wallet) {
      return res.status(404).json({ error: 'Buyer wallet not found.', requestId: req.requestId });
    }

    const onlyActive = req.query.includeResolved !== 'true';
    const whereHold = onlyActive
      ? 'o.buyer_id = $1 AND a.held_cents > 0'
      : 'o.buyer_id = $1 AND (a.funded_cents > 0 OR a.held_cents > 0)';

    const { rows } = await pool.query(
      `SELECT
         o.id AS order_id,
         o.destination,
         o.destination_district,
         o.delivery_date,
         o.agreed_total_cents,
         o.status AS order_status,
         o.created_at AS order_created_at,
         a.id AS allocation_id,
         a.batch_id,
         a.farmer_id,
         f.name AS farmer_name,
         a.agreed_kg,
         a.agreed_unit_price_cents,
         a.agreed_value_cents,
         a.committed_kg,
         a.picked_up_kg,
         a.handed_over_kg,
         a.accepted_kg,
         a.funded_cents,
         a.settled_cents,
         a.refunded_cents,
         a.held_cents,
         a.status AS allocation_status
       FROM orders o
       JOIN allocations a ON a.order_id = o.id
       JOIN users f ON f.id = a.farmer_id
       WHERE ${whereHold}
       ORDER BY o.created_at DESC, a.created_at ASC`,
      [req.user.id]
    );

    const ordersMap = new Map();
    let totalAllocationHeld = 0n;
    let totalAllocationFunded = 0n;
    let totalAllocationSettled = 0n;
    let totalAllocationRefunded = 0n;

    for (const row of rows) {
      totalAllocationHeld += BigInt(row.held_cents);
      totalAllocationFunded += BigInt(row.funded_cents);
      totalAllocationSettled += BigInt(row.settled_cents);
      totalAllocationRefunded += BigInt(row.refunded_cents);

      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          orderId: row.order_id,
          destination: row.destination,
          destinationDistrict: row.destination_district,
          deliveryDate: row.delivery_date,
          agreedTotalCents: row.agreed_total_cents,
          orderStatus: row.order_status,
          createdAt: row.order_created_at,
          orderFundedCents: 0n,
          orderSettledCents: 0n,
          orderRefundedCents: 0n,
          orderHeldCents: 0n,
          allocations: [],
        });
      }

      const orderGroup = ordersMap.get(row.order_id);
      orderGroup.orderFundedCents += BigInt(row.funded_cents);
      orderGroup.orderSettledCents += BigInt(row.settled_cents);
      orderGroup.orderRefundedCents += BigInt(row.refunded_cents);
      orderGroup.orderHeldCents += BigInt(row.held_cents);
      orderGroup.allocations.push({
        allocationId: row.allocation_id,
        batchId: row.batch_id,
        farmerId: row.farmer_id,
        farmerName: row.farmer_name,
        agreedKg: row.agreed_kg,
        agreedUnitPriceCents: row.agreed_unit_price_cents,
        agreedValueCents: row.agreed_value_cents,
        committedKg: row.committed_kg,
        pickedUpKg: row.picked_up_kg,
        handedOverKg: row.handed_over_kg,
        acceptedKg: row.accepted_kg,
        fundedCents: row.funded_cents,
        settledCents: row.settled_cents,
        refundedCents: row.refunded_cents,
        heldCents: row.held_cents,
        status: row.allocation_status,
      });
    }

    const orders = Array.from(ordersMap.values()).map((o) => ({
      ...o,
      orderFundedCents: o.orderFundedCents.toString(),
      orderSettledCents: o.orderSettledCents.toString(),
      orderRefundedCents: o.orderRefundedCents.toString(),
      orderHeldCents: o.orderHeldCents.toString(),
    }));

    return res.json({
      simulated: true,
      walletHeldCents: wallet.held_cents,
      totalAllocationHeldCents: totalAllocationHeld.toString(),
      totalAllocationFundedCents: totalAllocationFunded.toString(),
      totalAllocationSettledCents: totalAllocationSettled.toString(),
      totalAllocationRefundedCents: totalAllocationRefunded.toString(),
      holdsAligned: !onlyActive || BigInt(wallet.held_cents) === totalAllocationHeld,
      orders,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// 6. BUYER: Refund details & linked dispute/cancellation context (FR-WAL-06, FR-WAL-07)
// ---------------------------------------------------------------------------
export async function getBuyerRefunds(req, res, next) {
  try {
    const account = await requireApprovedUser(pool, req.user.id, 'buyer');
    if (!account) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const wallet = await getWalletForUser(pool, req.user.id, 'buyer');
    if (!wallet) {
      return res.status(404).json({ error: 'Buyer wallet not found.', requestId: req.requestId });
    }

    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ error: pagination.error, requestId: req.requestId });
    }

    const [countRes, refundEntriesRes, refundedAllocationsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT e.id)::INT AS total,
                COALESCE(SUM(CASE WHEN l.bucket = 'available' AND l.side = 'credit' THEN l.amount_cents ELSE 0 END), 0)::BIGINT AS total_refunded_cents
         FROM wallet_journal_entries e
         JOIN wallet_journal_lines l ON l.entry_id = e.id AND l.wallet_id = $1
         WHERE e.event_type = 'refund'`,
        [wallet.id]
      ),
      pool.query(
        `SELECT
           e.id,
           e.event_reference,
           e.amount_cents,
           e.currency,
           e.order_id,
           e.allocation_id,
           e.occurred_at,
           e.recorded_at,
           o.status AS order_status,
           o.destination_district,
           o.cancellation_reason,
           a.agreed_kg,
           a.accepted_kg,
           a.funded_cents,
           a.settled_cents,
           a.refunded_cents AS allocation_refunded_cents,
           a.held_cents AS allocation_held_cents,
           a.status AS allocation_status,
           f.name AS farmer_name,
           d.id AS dispute_id,
           d.status AS dispute_status,
           d.reason AS dispute_reason,
           d.resolution AS dispute_resolution,
           d.resolved_at AS dispute_resolved_at
         FROM wallet_journal_entries e
         JOIN wallet_journal_lines l ON l.entry_id = e.id AND l.wallet_id = $1 AND l.bucket = 'available' AND l.side = 'credit'
         LEFT JOIN orders o ON o.id = e.order_id AND o.buyer_id = $2
         LEFT JOIN allocations a ON a.id = e.allocation_id
         LEFT JOIN users f ON f.id = a.farmer_id
         LEFT JOIN LATERAL (
           SELECT id, status, reason, resolution, resolved_at
           FROM disputes
           WHERE allocation_id = e.allocation_id
           ORDER BY created_at DESC
           LIMIT 1
         ) d ON true
         WHERE e.event_type = 'refund'
         ORDER BY e.occurred_at DESC
         LIMIT $3 OFFSET $4`,
        [wallet.id, req.user.id, pagination.limit, pagination.offset]
      ),
      pool.query(
        `SELECT
           d.id AS dispute_id,
           d.allocation_id,
           a.order_id,
           f.name AS farmer_name,
           d.disputed_kg,
           d.disputed_cents,
           d.refund_cents,
           d.settlement_cents,
           d.status,
           d.reason,
           d.resolution,
           d.created_at,
           d.resolved_at
         FROM disputes d
         JOIN allocations a ON a.id = d.allocation_id
         JOIN orders o ON o.id = a.order_id
         JOIN users f ON f.id = a.farmer_id
         WHERE o.buyer_id = $1
         ORDER BY d.created_at DESC
         LIMIT 50`,
        [req.user.id]
      ),
    ]);

    const total = countRes.rows[0].total;
    return res.json({
      simulated: true,
      summary: {
        totalRefundCount: total,
        totalRefundedCents: countRes.rows[0].total_refunded_cents,
        openDisputeCount: refundedAllocationsRes.rows.filter((d) => d.status !== 'resolved').length,
      },
      refunds: refundEntriesRes.rows.map((r) => ({
        id: r.id,
        eventReference: r.event_reference,
        amountCents: r.amount_cents,
        currency: r.currency,
        orderId: r.order_id,
        allocationId: r.allocation_id,
        orderStatus: r.order_status,
        destinationDistrict: r.destination_district,
        cancellationReason: r.cancellation_reason,
        farmerName: r.farmer_name,
        agreedKg: r.agreed_kg,
        acceptedKg: r.accepted_kg,
        fundedCents: r.funded_cents,
        settledCents: r.settled_cents,
        allocationRefundedCents: r.allocation_refunded_cents,
        allocationHeldCents: r.allocation_held_cents,
        allocationStatus: r.allocation_status,
        dispute: r.dispute_id
          ? {
              id: r.dispute_id,
              status: r.dispute_status,
              reason: r.dispute_reason,
              resolution: r.dispute_resolution,
              resolvedAt: r.dispute_resolved_at,
            }
          : null,
        occurredAt: r.occurred_at,
        recordedAt: r.recorded_at,
      })),
      disputes: refundedAllocationsRes.rows.map((d) => ({
        id: d.dispute_id,
        allocationId: d.allocation_id,
        orderId: d.order_id,
        farmerName: d.farmer_name,
        disputedKg: d.disputed_kg,
        disputedCents: d.disputed_cents,
        refundCents: d.refund_cents,
        settlementCents: d.settlement_cents,
        status: d.status,
        reason: d.reason,
        resolution: d.resolution,
        createdAt: d.created_at,
        resolvedAt: d.resolved_at,
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// 7. ADMIN: Full platform reconciliation report (FR-WAL-09, DR-03)
// ---------------------------------------------------------------------------
export async function getAdminReconciliation(req, res, next) {
  try {
    const admin = await requireApprovedUser(pool, req.user.id, 'admin');
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const [walletsRes, journalHealthRes, allocationHealthRes, sourceEquityRes] = await Promise.all([
      pool.query(
        `WITH journal_buckets AS (
           SELECT
             wallet_id,
             COALESCE(SUM(CASE WHEN bucket = 'available' THEN CASE WHEN side = 'credit' THEN amount_cents ELSE -amount_cents END ELSE 0 END), 0)::BIGINT AS journal_available_cents,
             COALESCE(SUM(CASE WHEN bucket = 'held' THEN CASE WHEN side = 'credit' THEN amount_cents ELSE -amount_cents END ELSE 0 END), 0)::BIGINT AS journal_held_cents,
             COALESCE(SUM(CASE WHEN bucket = 'pending_payout' THEN CASE WHEN side = 'credit' THEN amount_cents ELSE -amount_cents END ELSE 0 END), 0)::BIGINT AS journal_pending_payout_cents,
             COUNT(DISTINCT entry_id)::INT AS journal_entry_count
           FROM wallet_journal_lines
           GROUP BY wallet_id
         ),
         order_holds AS (
           SELECT
             o.buyer_id AS owner_id,
             COALESCE(SUM(a.held_cents), 0)::BIGINT AS allocation_held_cents,
             COALESCE(SUM(a.funded_cents), 0)::BIGINT AS allocation_funded_cents,
             COALESCE(SUM(a.settled_cents), 0)::BIGINT AS allocation_settled_cents,
             COALESCE(SUM(a.refunded_cents), 0)::BIGINT AS allocation_refunded_cents
           FROM allocations a
           JOIN orders o ON o.id = a.order_id
           GROUP BY o.buyer_id
         ),
         pending_payouts AS (
           SELECT
             wallet_id,
             COALESCE(SUM(amount_cents), 0)::BIGINT AS pending_request_cents
           FROM payout_requests
           WHERE status = 'pending'
           GROUP BY wallet_id
         )
         SELECT
           w.id AS wallet_id,
           w.owner_id,
           u.name AS owner_name,
           u.email AS owner_email,
           w.account_type,
           w.currency,
           w.available_cents,
           w.held_cents,
           w.pending_payout_cents,
           w.simulated,
           COALESCE(jb.journal_available_cents, 0)::BIGINT AS journal_available_cents,
           COALESCE(jb.journal_held_cents, 0)::BIGINT AS journal_held_cents,
           COALESCE(jb.journal_pending_payout_cents, 0)::BIGINT AS journal_pending_payout_cents,
           COALESCE(jb.journal_entry_count, 0) AS journal_entry_count,
           COALESCE(oh.allocation_held_cents, 0)::BIGINT AS allocation_held_cents,
           COALESCE(oh.allocation_funded_cents, 0)::BIGINT AS allocation_funded_cents,
           COALESCE(oh.allocation_settled_cents, 0)::BIGINT AS allocation_settled_cents,
           COALESCE(oh.allocation_refunded_cents, 0)::BIGINT AS allocation_refunded_cents,
           COALESCE(pp.pending_request_cents, 0)::BIGINT AS pending_request_cents
         FROM wallets w
         LEFT JOIN users u ON u.id = w.owner_id
         LEFT JOIN journal_buckets jb ON jb.wallet_id = w.id
         LEFT JOIN order_holds oh ON oh.owner_id = w.owner_id AND w.account_type = 'buyer'
         LEFT JOIN pending_payouts pp ON pp.wallet_id = w.id
         WHERE w.account_type <> 'simulation_source'
         ORDER BY w.account_type, u.name NULLS LAST`
      ),
      pool.query(
        `WITH entry_totals AS (
           SELECT
             e.id,
             e.amount_cents,
             COALESCE(SUM(CASE WHEN l.side = 'debit' THEN l.amount_cents ELSE 0 END), 0)::BIGINT AS debit_cents,
             COALESCE(SUM(CASE WHEN l.side = 'credit' THEN l.amount_cents ELSE 0 END), 0)::BIGINT AS credit_cents
           FROM wallet_journal_entries e
           LEFT JOIN wallet_journal_lines l ON l.entry_id = e.id
           GROUP BY e.id, e.amount_cents
         )
         SELECT
           COUNT(*)::INT AS total_entries,
           COALESCE(SUM(debit_cents), 0)::BIGINT AS total_debit_cents,
           COALESCE(SUM(credit_cents), 0)::BIGINT AS total_credit_cents,
           COUNT(*) FILTER (WHERE debit_cents <> credit_cents OR debit_cents <> amount_cents OR debit_cents = 0)::INT AS imbalanced_entry_count
         FROM entry_totals`
      ),
      pool.query(
        `SELECT
           COUNT(*)::INT AS total_allocations,
           COALESCE(SUM(funded_cents), 0)::BIGINT AS total_funded_cents,
           COALESCE(SUM(settled_cents), 0)::BIGINT AS total_settled_cents,
           COALESCE(SUM(refunded_cents), 0)::BIGINT AS total_refunded_cents,
           COALESCE(SUM(held_cents), 0)::BIGINT AS total_held_cents,
           COUNT(*) FILTER (
             WHERE funded_cents::NUMERIC <> (settled_cents::NUMERIC + refunded_cents + held_cents)
                OR (settled_cents::NUMERIC + refunded_cents) > funded_cents::NUMERIC
           )::INT AS invariant_violation_count
         FROM allocations`
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN l.side = 'debit' THEN l.amount_cents ELSE -l.amount_cents END), 0)::BIGINT AS net_simulated_issued_cents
         FROM wallet_journal_lines l
         JOIN wallets w ON w.id = l.wallet_id
         WHERE w.account_type = 'simulation_source'`
      ),
    ]);

    const mismatches = [];
    let totalUserWalletCents = 0n;
    let totalWalletAvailableCents = 0n;
    let totalWalletHeldCents = 0n;
    let totalWalletPendingPayoutCents = 0n;

    const wallets = walletsRes.rows.map((w) => {
      const availableVariance = BigInt(w.available_cents) - BigInt(w.journal_available_cents);
      const heldVariance = BigInt(w.held_cents) - BigInt(w.journal_held_cents);
      const pendingVariance = BigInt(w.pending_payout_cents) - BigInt(w.journal_pending_payout_cents);
      const orderHoldVariance =
        w.account_type === 'buyer' ? BigInt(w.held_cents) - BigInt(w.allocation_held_cents) : 0n;
      const payoutRequestVariance = BigInt(w.pending_payout_cents) - BigInt(w.pending_request_cents);

      totalWalletAvailableCents += BigInt(w.available_cents);
      totalWalletHeldCents += BigInt(w.held_cents);
      totalWalletPendingPayoutCents += BigInt(w.pending_payout_cents);
      totalUserWalletCents += BigInt(w.available_cents) + BigInt(w.held_cents) + BigInt(w.pending_payout_cents);

      const walletIssues = [];
      if (availableVariance !== 0n) {
        walletIssues.push(`Available balance differs from journal by LKR ${formatCentsToLkr(availableVariance)}`);
      }
      if (heldVariance !== 0n) {
        walletIssues.push(`Held balance differs from journal by LKR ${formatCentsToLkr(heldVariance)}`);
      }
      if (pendingVariance !== 0n) {
        walletIssues.push(`Pending payout balance differs from journal by LKR ${formatCentsToLkr(pendingVariance)}`);
      }
      if (orderHoldVariance !== 0n) {
        walletIssues.push(`Buyer wallet held funds differ from order allocations by LKR ${formatCentsToLkr(orderHoldVariance)}`);
      }
      if (payoutRequestVariance !== 0n) {
        walletIssues.push(`Pending payout balance differs from pending payout requests by LKR ${formatCentsToLkr(payoutRequestVariance)}`);
      }

      if (walletIssues.length > 0) {
        mismatches.push({
          scope: 'wallet',
          walletId: w.wallet_id,
          ownerName: w.owner_name,
          accountType: w.account_type,
          issues: walletIssues,
        });
      }

      return {
        walletId: w.wallet_id,
        ownerId: w.owner_id,
        ownerName: w.owner_name,
        ownerEmail: w.owner_email,
        accountType: w.account_type,
        currency: w.currency,
        availableCents: w.available_cents,
        heldCents: w.held_cents,
        pendingPayoutCents: w.pending_payout_cents,
        journalAvailableCents: w.journal_available_cents,
        journalHeldCents: w.journal_held_cents,
        journalPendingPayoutCents: w.journal_pending_payout_cents,
        allocationHeldCents: w.allocation_held_cents,
        allocationFundedCents: w.allocation_funded_cents,
        allocationSettledCents: w.allocation_settled_cents,
        allocationRefundedCents: w.allocation_refunded_cents,
        pendingRequestCents: w.pending_request_cents,
        journalEntryCount: w.journal_entry_count,
        availableVarianceCents: availableVariance.toString(),
        heldVarianceCents: heldVariance.toString(),
        pendingVarianceCents: pendingVariance.toString(),
        orderHoldVarianceCents: orderHoldVariance.toString(),
        payoutRequestVarianceCents: payoutRequestVariance.toString(),
        isBalanced: walletIssues.length === 0,
        issues: walletIssues,
      };
    });

    const journalHealth = journalHealthRes.rows[0];
    const allocationHealth = allocationHealthRes.rows[0];
    const netSimulatedIssuedCents = BigInt(sourceEquityRes.rows[0].net_simulated_issued_cents);
    const systemConservationVariance = netSimulatedIssuedCents - totalUserWalletCents;

    if (journalHealth.imbalanced_entry_count > 0) {
      mismatches.push({
        scope: 'journal',
        issues: [`${journalHealth.imbalanced_entry_count} journal entry(ies) have debits != credits.`],
      });
    }
    if (allocationHealth.invariant_violation_count > 0) {
      mismatches.push({
        scope: 'allocation',
        issues: [`${allocationHealth.invariant_violation_count} allocation(s) failed funded = settled + refunded + held check.`],
      });
    }
    if (systemConservationVariance !== 0n) {
      mismatches.push({
        scope: 'conservation',
        issues: [
          `Total issued simulated equity differs from sum of all user wallets by LKR ${formatCentsToLkr(systemConservationVariance)}.`,
        ],
      });
    }

    return res.json({
      simulated: true,
      generatedAt: new Date().toISOString(),
      reconciliationStatus: mismatches.length === 0 ? 'balanced' : 'mismatch_detected',
      mismatchCount: mismatches.length,
      mismatches,
      summary: {
        totalJournalEntries: journalHealth.total_entries,
        totalDebitCents: journalHealth.total_debit_cents,
        totalCreditCents: journalHealth.total_credit_cents,
        imbalancedEntryCount: journalHealth.imbalanced_entry_count,
        netSimulatedIssuedCents: netSimulatedIssuedCents.toString(),
        totalUserWalletCents: totalUserWalletCents.toString(),
        systemConservationVarianceCents: systemConservationVariance.toString(),
        totalWalletAvailableCents: totalWalletAvailableCents.toString(),
        totalWalletHeldCents: totalWalletHeldCents.toString(),
        totalWalletPendingPayoutCents: totalWalletPendingPayoutCents.toString(),
        totalAllocations: allocationHealth.total_allocations,
        totalOrderFundedCents: allocationHealth.total_funded_cents,
        totalOrderSettledCents: allocationHealth.total_settled_cents,
        totalOrderRefundedCents: allocationHealth.total_refunded_cents,
        totalOrderHeldCents: allocationHealth.total_held_cents,
        allocationInvariantViolations: allocationHealth.invariant_violation_count,
      },
      wallets,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// 8. ADMIN: Paginated platform journal ledger (FR-WAL-09, FR-WAL-10)
// ---------------------------------------------------------------------------
export async function getAdminJournals(req, res, next) {
  try {
    const admin = await requireApprovedUser(pool, req.user.id, 'admin');
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ error: pagination.error, requestId: req.requestId });
    }

    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const conditions = [];
    const params = [];

    if (eventType) {
      if (!VALID_EVENT_TYPES.has(eventType)) {
        return res.status(400).json({ error: 'Invalid eventType filter.', requestId: req.requestId });
      }
      params.push(eventType);
      conditions.push(`e.event_type = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(e.event_reference ILIKE $${params.length} OR e.id::TEXT ILIKE $${params.length} OR e.operation_key ILIKE $${params.length} OR COALESCE(e.order_id::TEXT, '') ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM wallet_journal_entries e ${whereClause}`,
      params
    );

    const listParams = [...params, pagination.limit, pagination.offset];
    const entriesRes = await pool.query(
      `SELECT
         e.id,
         e.event_type,
         e.event_reference,
         e.operation_key,
         e.currency,
         e.amount_cents,
         e.order_id,
         e.allocation_id,
         e.reversal_of,
         e.occurred_at,
         e.recorded_at,
         u.name AS actor_name,
         u.role AS actor_role,
         rev.id AS reversed_by_id
       FROM wallet_journal_entries e
       JOIN users u ON u.id = e.actor_id
       LEFT JOIN wallet_journal_entries rev ON rev.reversal_of = e.id
       ${whereClause}
       ORDER BY e.occurred_at DESC, e.recorded_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const entryIds = entriesRes.rows.map((e) => e.id);
    const linesByEntry = new Map();

    if (entryIds.length > 0) {
      const linesRes = await pool.query(
        `SELECT l.id, l.entry_id, l.wallet_id, l.bucket, l.side, l.amount_cents,
                w.account_type, COALESCE(u.name, 'Simulation Source') AS owner_name
         FROM wallet_journal_lines l
         JOIN wallets w ON w.id = l.wallet_id
         LEFT JOIN users u ON u.id = w.owner_id
         WHERE l.entry_id = ANY($1::uuid[])
         ORDER BY l.side DESC, l.created_at ASC`,
        [entryIds]
      );
      for (const line of linesRes.rows) {
        if (!linesByEntry.has(line.entry_id)) linesByEntry.set(line.entry_id, []);
        linesByEntry.get(line.entry_id).push({
          id: line.id,
          walletId: line.wallet_id,
          ownerName: line.owner_name,
          accountType: line.account_type,
          bucket: line.bucket,
          side: line.side,
          amountCents: line.amount_cents,
        });
      }
    }

    const total = countRes.rows[0].total;
    return res.json({
      simulated: true,
      journals: entriesRes.rows.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        eventReference: e.event_reference,
        operationKey: e.operation_key,
        currency: e.currency,
        amountCents: e.amount_cents,
        orderId: e.order_id,
        allocationId: e.allocation_id,
        reversalOf: e.reversal_of,
        reversedById: e.reversed_by_id,
        actorName: e.actor_name,
        actorRole: e.actor_role,
        occurredAt: e.occurred_at,
        recordedAt: e.recorded_at,
        canReverse: e.event_type !== 'reversal' && !e.reversed_by_id,
        lines: linesByEntry.get(e.id) || [],
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// 9. ADMIN: Immutable reversal (+ optional funding replacement) (FR-WAL-10, FR-ADM-04)
// ---------------------------------------------------------------------------
export async function reverseJournalEntry(req, res, next) {
  const { entryId } = req.params;
  if (!isUuid(entryId)) {
    return res.status(400).json({ error: 'Invalid journal entry ID.', requestId: req.requestId });
  }

  const unsupported = rejectUnsupportedFields(req.body, ['reason', 'operationKey', 'replacementAmountLkr']);
  if (unsupported.length > 0) {
    return res.status(400).json({
      error: `Unsupported request field(s): ${unsupported.join(', ')}`,
      requestId: req.requestId,
    });
  }

  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const rawOpKey =
    (typeof req.body.operationKey === 'string' && req.body.operationKey.trim()) ||
    (typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key'].trim()) ||
    '';
  const hasReplacement =
    req.body.replacementAmountLkr !== undefined &&
    req.body.replacementAmountLkr !== null &&
    String(req.body.replacementAmountLkr).trim() !== '';

  const fieldErrors = {};
  if (reason.length < 5 || reason.length > 300) {
    fieldErrors.reason = 'Provide a clear audit reason (5–300 characters).';
  }
  if (!rawOpKey || rawOpKey.length < 8 || rawOpKey.length > 120) {
    fieldErrors.operationKey = 'A durable operationKey (8–120 characters) is required.';
  }

  let replacementCents = null;
  if (hasReplacement) {
    const parsed = parseLkrToCents(req.body.replacementAmountLkr);
    if (parsed.error) {
      fieldErrors.replacementAmountLkr = parsed.error;
    } else {
      replacementCents = parsed.cents;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Please correct the highlighted reversal fields.',
      fieldErrors,
      requestId: req.requestId,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const admin = await requireApprovedUser(client, req.user.id, 'admin');
    if (!admin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    // Idempotency replay check
    const existingReversalRes = await client.query(
      `SELECT id, event_type, event_reference, amount_cents, reversal_of, actor_id, occurred_at
       FROM wallet_journal_entries
       WHERE operation_key = $1`,
      [rawOpKey]
    );

    if (existingReversalRes.rows[0]) {
      const existing = existingReversalRes.rows[0];
      await client.query('ROLLBACK');
      if (existing.reversal_of === entryId && existing.actor_id === req.user.id) {
        return res.status(200).json({
          idempotentReplay: true,
          simulated: true,
          reversalEntry: existing,
          requestId: req.requestId,
        });
      }
      return res.status(409).json({
        error: 'Operation key already used for a different journal action.',
        requestId: req.requestId,
      });
    }

    const origRes = await client.query(
      `SELECT id, event_type, event_reference, amount_cents, order_id, allocation_id, reversal_of
       FROM wallet_journal_entries
       WHERE id = $1
       FOR UPDATE`,
      [entryId]
    );
    const original = origRes.rows[0];
    if (!original) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Journal entry not found.', requestId: req.requestId });
    }
    if (original.event_type === 'reversal') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'A reversal entry cannot itself be reversed.',
        requestId: req.requestId,
      });
    }
    if (hasReplacement && original.event_type !== 'funding') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Inline replacement amounts are only supported when correcting simulated funding entries.',
        fieldErrors: { replacementAmountLkr: 'Only supported for funding entries.' },
        requestId: req.requestId,
      });
    }

    const alreadyReversedRes = await client.query(
      'SELECT id FROM wallet_journal_entries WHERE reversal_of = $1',
      [entryId]
    );
    if (alreadyReversedRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'This journal entry has already been reversed.',
        requestId: req.requestId,
      });
    }

    const linesRes = await client.query(
      `SELECT id, wallet_id, bucket, side, amount_cents
       FROM wallet_journal_lines
       WHERE entry_id = $1`,
      [entryId]
    );
    const originalLines = linesRes.rows;
    if (originalLines.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Original journal entry has no lines to reverse.', requestId: req.requestId });
    }

    const walletIds = [...new Set(originalLines.map((l) => l.wallet_id))].sort();
    const lockedWalletsRes = await client.query(
      `SELECT id, owner_id, account_type, available_cents, held_cents, pending_payout_cents
       FROM wallets
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR UPDATE`,
      [walletIds]
    );
    const walletMap = new Map(lockedWalletsRes.rows.map((w) => [w.id, w]));

    // Compute bucket deltas for reversal (+ optional replacement) and verify no bucket drops below 0
    const bucketDeltas = new Map();
    const addDelta = (walletId, bucket, delta) => {
      const col = bucketToColumn(bucket);
      if (!col) return;
      const key = `${walletId}:${col}`;
      bucketDeltas.set(key, (bucketDeltas.get(key) || 0n) + delta);
    };

    const reversedLines = originalLines.map((line) => {
      const flippedSide = line.side === 'debit' ? 'credit' : 'debit';
      const amt = BigInt(line.amount_cents);
      if (line.bucket !== 'simulation_equity') {
        addDelta(line.wallet_id, line.bucket, flippedSide === 'credit' ? amt : -amt);
      }
      return {
        wallet_id: line.wallet_id,
        bucket: line.bucket,
        side: flippedSide,
        amount_cents: amt.toString(),
      };
    });

    let targetBuyerWalletId = null;
    let sourceWalletId = null;
    if (hasReplacement && replacementCents !== null) {
      const userLine = originalLines.find((l) => l.bucket === 'available');
      const sourceLine = originalLines.find((l) => l.bucket === 'simulation_equity');
      if (!userLine || !sourceLine) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Could not identify funding wallets for replacement entry.',
          requestId: req.requestId,
        });
      }
      targetBuyerWalletId = userLine.wallet_id;
      sourceWalletId = sourceLine.wallet_id;
      addDelta(targetBuyerWalletId, 'available', replacementCents);
    }

    for (const [key, delta] of bucketDeltas.entries()) {
      const [walletId, col] = key.split(':');
      const wallet = walletMap.get(walletId);
      const nextVal = BigInt(wallet[col]) + delta;
      if (nextVal < 0n) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Reversal blocked: ${wallet.account_type} wallet ${col.replace('_cents', '')} balance would become negative (LKR ${formatCentsToLkr(nextVal)}).`,
          requestId: req.requestId,
        });
      }
    }

    // 1. Insert immutable reversal entry and flipped lines
    const reversalRef = `Reversal of ${original.event_reference} (${reason})`.slice(0, 240);
    const revEntryRes = await client.query(
      `INSERT INTO wallet_journal_entries
         (event_type, event_reference, operation_key, currency, amount_cents, order_id, allocation_id, reversal_of, actor_id)
       VALUES ('reversal', $1, $2, 'LKR', $3::BIGINT, $4, $5, $6, $7)
       RETURNING id, event_type, event_reference, operation_key, amount_cents, reversal_of, occurred_at`,
      [
        reversalRef,
        rawOpKey,
        original.amount_cents,
        original.order_id,
        original.allocation_id,
        original.id,
        req.user.id,
      ]
    );
    const reversalEntry = revEntryRes.rows[0];

    for (const rLine of reversedLines) {
      await client.query(
        `INSERT INTO wallet_journal_lines (entry_id, wallet_id, bucket, side, amount_cents)
         VALUES ($1, $2, $3, $4, $5::BIGINT)`,
        [reversalEntry.id, rLine.wallet_id, rLine.bucket, rLine.side, rLine.amount_cents]
      );
    }

    // 2. Optional linked replacement funding entry (FR-WAL-10)
    let replacementEntry = null;
    if (hasReplacement && replacementCents !== null && targetBuyerWalletId && sourceWalletId) {
      const repRef = `Replacement funding (LKR ${formatCentsToLkr(replacementCents)}) - ${reason}`.slice(0, 240);
      const repRes = await client.query(
        `INSERT INTO wallet_journal_entries
           (event_type, event_reference, operation_key, currency, amount_cents, actor_id)
         VALUES ('funding', $1, $2, 'LKR', $3::BIGINT, $4)
         RETURNING id, event_type, event_reference, operation_key, amount_cents, occurred_at`,
        [repRef, `${rawOpKey}:replacement`, replacementCents.toString(), req.user.id]
      );
      replacementEntry = repRes.rows[0];

      await client.query(
        `INSERT INTO wallet_journal_lines (entry_id, wallet_id, bucket, side, amount_cents)
         VALUES
           ($1, $2, 'simulation_equity', 'debit', $4::BIGINT),
           ($1, $3, 'available', 'credit', $4::BIGINT)`,
        [replacementEntry.id, sourceWalletId, targetBuyerWalletId, replacementCents.toString()]
      );
    }

    // 3. Apply net bucket updates to affected user wallets
    for (const [key, delta] of bucketDeltas.entries()) {
      if (delta === 0n) continue;
      const [walletId, col] = key.split(':');
      await client.query(
        `UPDATE wallets SET ${col} = ${col} + $1::BIGINT WHERE id = $2`,
        [delta.toString(), walletId]
      );
    }

    // 4. Write immutable audit event (FR-ADM-04, FR-ADM-05)
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
       VALUES ($1, $2, 'wallet_journal_entry', $3, $4, $5, $6::jsonb)`,
      [
        req.user.id,
        replacementEntry ? 'wallet_journal_reversal_and_replacement' : 'wallet_journal_reversal',
        original.id,
        isUuid(req.requestId) ? req.requestId : null,
        reason,
        JSON.stringify({
          originalEntryId: original.id,
          originalEventType: original.event_type,
          originalAmountCents: original.amount_cents,
          reversalEntryId: reversalEntry.id,
          replacementEntryId: replacementEntry ? replacementEntry.id : null,
          replacementAmountCents: replacementEntry ? replacementEntry.amount_cents : null,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      idempotentReplay: false,
      simulated: true,
      reversalEntry,
      replacementEntry,
      requestId: req.requestId,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
}