import pool from '../../config/db.js';

// YM09 · Imalka Randev · Produce listings

/**
 * Health / Scaffold status endpoint.
 */
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
      module: 'YM09',
      owner: 'Imalka Randev',
      status: 'active',
      user: rows[0],
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Lists produce listings belonging to the authenticated farmer.
 */
export async function getProduceListings(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.batch_id AS "batchId", l.offered_kg AS "offeredKg",
              l.unit_price_cents AS "unitPriceCents", l.valid_from AS "validFrom",
              l.valid_until AS "validUntil", l.status, l.created_at AS "createdAt",
              c.name AS "cropName", g.name AS "gradeName", f.name AS "farmName", f.id AS "farmId",
              f.district,
              COALESCE((
                SELECT SUM(
                  CASE
                    WHEN a.status IN ('held', 'supplier_accepted') THEN a.agreed_kg
                    WHEN a.status IN ('committed', 'disputed') THEN GREATEST(0, a.committed_kg - a.picked_up_kg)
                    ELSE 0
                  END
                )
                FROM allocations a
                WHERE a.batch_id = l.batch_id
                  AND a.status IN ('held', 'supplier_accepted', 'committed', 'disputed')
              ), 0) AS "reservedKg",
              COALESCE((
                SELECT SUM(a.committed_kg)
                FROM allocations a
                WHERE a.batch_id = l.batch_id
                  AND a.status = 'committed'
              ), 0) AS "committedKg"
       FROM listings l
       JOIN harvest_batches hb ON l.batch_id = hb.id
       JOIN crops c ON hb.crop_id = c.id
       JOIN grades g ON hb.grade_id = g.id
       JOIN farms f ON hb.farm_id = f.id
       WHERE hb.farmer_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );

    const listings = rows.map((r) => {
      const offered = parseFloat(r.offeredKg || '0');
      const reserved = parseFloat(r.reservedKg || '0');
      return {
        ...r,
        offeredKg: offered,
        reservedKg: reserved,
        committedKg: parseFloat(r.committedKg || '0'),
        availableKg: Math.max(0, offered - reserved),
        unitPriceCents: parseInt(r.unitPriceCents, 10),
      };
    });

    return res.json({
      success: true,
      data: listings,
      total: listings.length,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Retrieves a single produce listing by ID.
 */
export async function getProduceListingById(req, res, next) {
  try {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({
        error: 'Invalid listing ID format. Must be a valid UUID.',
        requestId: req.requestId,
      });
    }

    const { rows } = await pool.query(
      `SELECT l.id, l.batch_id AS "batchId", l.offered_kg AS "offeredKg",
              l.unit_price_cents AS "unitPriceCents", l.valid_from AS "validFrom",
              l.valid_until AS "validUntil", l.status, l.created_at AS "createdAt",
              c.name AS "cropName", g.name AS "gradeName", f.name AS "farmName", f.id AS "farmId",
              f.district, hb.farmer_id AS "farmerId",
              COALESCE((
                SELECT SUM(
                  CASE
                    WHEN a.status IN ('held', 'supplier_accepted') THEN a.agreed_kg
                    WHEN a.status IN ('committed', 'disputed') THEN GREATEST(0, a.committed_kg - a.picked_up_kg)
                    ELSE 0
                  END
                )
                FROM allocations a
                WHERE a.batch_id = l.batch_id
                  AND a.status IN ('held', 'supplier_accepted', 'committed', 'disputed')
              ), 0) AS "reservedKg",
              COALESCE((
                SELECT SUM(a.committed_kg)
                FROM allocations a
                WHERE a.batch_id = l.batch_id
                  AND a.status = 'committed'
              ), 0) AS "committedKg"
       FROM listings l
       JOIN harvest_batches hb ON l.batch_id = hb.id
       JOIN crops c ON hb.crop_id = c.id
       JOIN grades g ON hb.grade_id = g.id
       JOIN farms f ON hb.farm_id = f.id
       WHERE l.id = $1 AND hb.farmer_id = $2`,
      [id, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Produce listing not found', requestId: req.requestId });
    }

    const r = rows[0];
    const offered = parseFloat(r.offeredKg || '0');
    const reserved = parseFloat(r.reservedKg || '0');

    return res.json({
      success: true,
      data: {
        ...r,
        offeredKg: offered,
        reservedKg: reserved,
        committedKg: parseFloat(r.committedKg || '0'),
        availableKg: Math.max(0, offered - reserved),
        unitPriceCents: parseInt(r.unitPriceCents, 10),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves comprehensive details for a single produce listing.
 * Includes:
 * 1. Base listing and harvest origin metadata.
 * 2. Authoritative live stock calculations (DR-01).
 * 3. Itemized buyer allocations strictly belonging to this listing's active lifecycle.
 * 4. Linked purchase orders.
 * 5. Audited price changes from audit_logs.
 * 6. Persisted activity events.
 */
export async function getProduceListingDetails(req, res, next) {
  try {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({
        error: 'Invalid listing ID format. Must be a valid UUID.',
        requestId: req.requestId,
      });
    }

    // 1. Fetch listing, harvest batch, crop, grade, and farm
    const { rows: listingRows } = await pool.query(
      `SELECT l.id, l.batch_id AS "batchId", l.offered_kg AS "offeredKg",
              l.unit_price_cents AS "unitPriceCents", l.valid_from AS "validFrom",
              l.valid_until AS "validUntil", l.status, l.created_at AS "createdAt",
              c.name AS "cropName", g.name AS "gradeName", f.name AS "farmName", f.id AS "farmId",
              f.district, hb.farmer_id AS "farmerId",
              COALESCE('HB-' || UPPER(SUBSTRING(hb.id::text, 1, 8)), 'HB-UNKNOWN') AS "batchNumber",
              hb.actual_kg AS "actualKg", hb.sellable_kg AS "sellableKg",
              COALESCE((
                SELECT SUM(
                  CASE
                    WHEN a.status IN ('held', 'supplier_accepted') THEN a.agreed_kg
                    WHEN a.status IN ('committed', 'disputed') THEN GREATEST(0, a.committed_kg - a.picked_up_kg)
                    ELSE 0
                  END
                )
                FROM allocations a
                WHERE a.batch_id = l.batch_id
                  AND a.created_at >= l.created_at
                  AND a.created_at <= l.valid_until
                  AND a.status IN ('held', 'supplier_accepted', 'committed', 'disputed')
              ), 0) AS "reservedKg",
              COALESCE((
                SELECT SUM(a.committed_kg)
                FROM allocations a
                WHERE a.batch_id = l.batch_id
                  AND a.created_at >= l.created_at
                  AND a.created_at <= l.valid_until
                  AND a.status = 'committed'
              ), 0) AS "committedKg"
       FROM listings l
       JOIN harvest_batches hb ON l.batch_id = hb.id
       JOIN crops c ON hb.crop_id = c.id
       JOIN grades g ON hb.grade_id = g.id
       JOIN farms f ON hb.farm_id = f.id
       WHERE l.id = $1 AND hb.farmer_id = $2`,
      [id, req.user.id]
    );

    if (!listingRows[0]) {
      return res.status(404).json({ error: 'Produce listing not found', requestId: req.requestId });
    }

    const r = listingRows[0];
    const offered = parseFloat(r.offeredKg || '0');
    const reserved = parseFloat(r.reservedKg || '0');
    const committed = parseFloat(r.committedKg || '0');
    const available = Math.max(0, offered - reserved);
    const unitPriceCents = parseInt(r.unitPriceCents, 10);

    // 2. Query itemized buyer allocations strictly belonging to this listing's validity window
    const { rows: allocationRows } = await pool.query(
      `SELECT a.id, a.order_id AS "orderId", a.agreed_kg AS "allocatedKg",
              a.agreed_unit_price_cents AS "agreedUnitPriceCents",
              a.agreed_value_cents AS "agreedValueCents",
              a.status, a.created_at AS "allocatedOn",
              u.name AS "buyerName"
       FROM allocations a
       JOIN orders o ON a.order_id = o.id
       JOIN users u ON o.buyer_id = u.id
       WHERE a.batch_id = $1
         AND a.farmer_id = $2
         AND a.created_at >= $3
         AND a.created_at <= $4
       ORDER BY a.created_at DESC`,
      [r.batchId, req.user.id, r.createdAt, r.validUntil]
    );

    const allocations = allocationRows.map((a) => {
      let displayStatus = 'Pending';
      if (['accepted', 'resolved'].includes(a.status)) displayStatus = 'Completed';
      else if (['supplier_accepted'].includes(a.status)) displayStatus = 'Confirmed';
      else if (['committed', 'picked_up', 'handed_over'].includes(a.status)) displayStatus = 'Committed';
      else if (['disputed'].includes(a.status)) displayStatus = 'Disputed';
      else if (['declined', 'cancelled', 'expired'].includes(a.status)) displayStatus = 'Declined';

      return {
        id: a.id,
        orderId: a.orderId,
        buyerName: a.buyerName || 'Verified Buyer',
        allocatedKg: parseFloat(a.allocatedKg || '0'),
        agreedUnitPriceCents: parseInt(a.agreedUnitPriceCents, 10),
        agreedValueCents: parseInt(a.agreedValueCents, 10),
        status: a.status,
        displayStatus,
        allocatedOn: a.allocatedOn,
      };
    });

    // 3. Query confirmed purchase orders linked to these allocations
    // Uses allocation's agreed_value_cents to prevent multi-batch order inflation
    const { rows: orderRows } = await pool.query(
      `SELECT DISTINCT o.id, o.created_at AS "orderDate", o.status,
              a.agreed_value_cents AS "allocationValueCents",
              a.agreed_kg AS "orderKg",
              u.name AS "buyerName"
       FROM orders o
       JOIN allocations a ON a.order_id = o.id
       JOIN users u ON o.buyer_id = u.id
       WHERE a.batch_id = $1
         AND a.farmer_id = $2
         AND a.created_at >= $3
         AND a.created_at <= $4
       ORDER BY o.created_at DESC`,
      [r.batchId, req.user.id, r.createdAt, r.validUntil]
    );

    const orders = orderRows.map((o) => {
      let displayStatus = 'Processing';
      if (['delivered', 'closed'].includes(o.status)) displayStatus = 'Completed';
      else if (['confirmed', 'in_fulfilment'].includes(o.status)) displayStatus = 'Confirmed';
      else if (['cancelled', 'expired'].includes(o.status)) displayStatus = 'Cancelled';

      const orderValueCents = o.allocationValueCents !== null && o.allocationValueCents !== undefined
        ? parseInt(o.allocationValueCents, 10)
        : null;

      return {
        id: o.id,
        buyerName: o.buyerName || 'Verified Buyer',
        orderKg: parseFloat(o.orderKg || '0'),
        orderValueCents,
        status: o.status,
        displayStatus,
        orderDate: o.orderDate,
      };
    });

    // 4. Query genuine audit events for price history and activity log
    const { rows: auditRows } = await pool.query(
      `SELECT al.id, al.action, al.safe_changes AS "safeChanges", al.occurred_at AS "timestamp",
              al.reason,
              u.name AS "actorName"
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       WHERE al.target_type = 'listing' AND al.target_id = $1
       ORDER BY al.occurred_at DESC`,
      [id]
    );

    const priceHistory = [];
    const priceTrend = [];
    const activityLog = [];

    // Base listing created event
    activityLog.push({
      id: `act-created-${id}`,
      eventType: 'listing_created',
      title: 'Listing created',
      description: `Produce listing published with ${offered} kg at LKR ${(unitPriceCents / 100).toFixed(0)} / kg.`,
      timestamp: r.createdAt,
    });

    auditRows.forEach((log) => {
      const changes = log.safeChanges || {};
      let oldCents;
      let newCents;

      if (changes.unit_price_cents && typeof changes.unit_price_cents === 'object') {
        oldCents = changes.unit_price_cents.old ?? changes.unit_price_cents.from;
        newCents = changes.unit_price_cents.new ?? changes.unit_price_cents.to;
      } else if (changes.unit_price_cents !== undefined) {
        newCents = changes.unit_price_cents;
        oldCents = changes.previous_unit_price_cents ?? changes.old_unit_price_cents;
      }

      const parsedOld = oldCents !== undefined && oldCents !== null ? parseInt(oldCents, 10) : undefined;
      const parsedNew = newCents !== undefined && newCents !== null ? parseInt(newCents, 10) : undefined;

      if (
        parsedNew &&
        Number.isInteger(parsedNew) &&
        parsedNew > 0 &&
        parsedOld !== undefined &&
        Number.isInteger(parsedOld) &&
        parsedOld > 0 &&
        parsedNew !== parsedOld
      ) {
        const delta = parsedNew - parsedOld;
        priceHistory.push({
          id: log.id,
          timestamp: log.timestamp,
          unitPriceCents: parsedNew,
          previousUnitPriceCents: parsedOld,
          deltaCents: delta,
          reason: log.reason || undefined,
        });

        activityLog.push({
          id: `act-${log.id}`,
          eventType: 'price_update',
          title: 'Listing price updated',
          description: `Price changed from LKR ${(parsedOld / 100).toFixed(0)} / kg to LKR ${(parsedNew / 100).toFixed(0)} / kg.`,
          timestamp: log.timestamp,
        });
      }
    });

    // Add allocations to activity log with accurate life-cycle labels
    allocations.forEach((al) => {
      let title = 'Allocation created';
      let eventType = 'allocation_created';
      if (['supplier_accepted', 'committed'].includes(al.status)) {
        title = 'Allocation confirmed';
        eventType = 'allocation_confirmed';
      } else if (al.status === 'held') {
        title = 'Allocation requested';
        eventType = 'allocation_created';
      } else if (['declined', 'cancelled'].includes(al.status)) {
        title = 'Allocation cancelled';
        eventType = 'status_change';
      }

      activityLog.push({
        id: `act-al-${al.id}`,
        eventType,
        title,
        description: `${al.allocatedKg} kg allocated to ${al.buyerName} (${al.id}).`,
        timestamp: al.allocatedOn,
      });
    });

    // Add orders to activity log with accurate life-cycle labels
    orders.forEach((ord) => {
      let title = 'Order placed';
      let eventType = 'order_placed';
      if (['delivered', 'closed'].includes(ord.status)) {
        title = 'Order completed';
        eventType = 'order_completed';
      } else if (['in_fulfilment'].includes(ord.status)) {
        title = 'Order in fulfillment';
        eventType = 'status_change';
      }

      activityLog.push({
        id: `act-ord-${ord.id}`,
        eventType,
        title,
        description: `${ord.orderKg} kg order placed by ${ord.buyerName} (${ord.id}).`,
        timestamp: ord.orderDate,
      });
    });

    // Deduplicate and sort activityLog descending by timestamp
    const uniqueActivityMap = new Map();
    activityLog.forEach((ev) => {
      if (!uniqueActivityMap.has(ev.id)) {
        uniqueActivityMap.set(ev.id, ev);
      }
    });
    const sortedActivity = Array.from(uniqueActivityMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return res.json({
      success: true,
      data: {
        ...r,
        offeredKg: offered,
        reservedKg: reserved,
        committedKg: committed,
        availableKg: available,
        unitPriceCents,
        batchNumber: r.batchNumber,
        allocations,
        orders,
        priceHistory,
        priceTrend,
        activityLog: sortedActivity,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates an existing produce listing in-place.
 * Runs in a transaction with row-level locks (FOR UPDATE) to prevent race conditions.
 *
 * Enforces authoritative domain checks:
 * 1. Caller approval and farmer role.
 * 2. Ownership of existing listing.
 * 3. Batch reassignment check:
 *    - Reassignment is rejected (409 Conflict) if existing listing has active allocations or reservations.
 *    - Target batch must exist, belong to farmer, and have status = 'harvested'.
 *    - Target batch must satisfy one_active_listing_per_batch constraint.
 *    - Target batch must have sufficient uncommitted stock.
 * 4. In-place update preserving listing ID and historical traceability.
 */
export async function updateProduceListing(req, res, next) {
  const { id } = req.params;

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({
      error: 'Invalid listing ID format. Must be a valid UUID.',
      requestId: req.requestId,
    });
  }

  const client = await pool.connect();
  try {
    const { batchId, offeredKg, unitPriceCents, validFrom, validUntil, status } = req.body;

    // 1. Verify caller approval
    const { rows: userRows } = await client.query(
      'SELECT id, role, approval_status FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, 'farmer', 'approved']
    );
    if (!userRows[0]) {
      return res.status(403).json({ error: 'Account is not approved for farmer operations', requestId: req.requestId });
    }

    await client.query('BEGIN');

    // 2. Fetch existing listing with row lock (FOR UPDATE OF l)
    const { rows: listingRows } = await client.query(
      `SELECT l.id, l.batch_id, l.offered_kg, l.unit_price_cents, l.valid_from, l.valid_until, l.status,
              hb.farmer_id, hb.farm_id
       FROM listings l
       JOIN harvest_batches hb ON l.batch_id = hb.id
       WHERE l.id = $1
       FOR UPDATE OF l`,
      [id]
    );

    if (!listingRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Produce listing not found', requestId: req.requestId });
    }

    const currentListing = listingRows[0];

    // Verify ownership
    if (currentListing.farmer_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You do not own this produce listing', requestId: req.requestId });
    }

    const targetBatchId = batchId || currentListing.batch_id;

    // 3. Batch Reassignment Check: If batchId changed
    if (targetBatchId !== currentListing.batch_id) {
      // Check active allocations/holds or unresolved disputes on current batch
      // Per SRS FR-FARM-07 & DR-01: Reassignment blocked if active reservations, commitments, or unresolved disputes exist
      const { rows: holdRows } = await client.query(
        `SELECT
           COALESCE(SUM(
             CASE
               WHEN status IN ('held', 'supplier_accepted') THEN agreed_kg
               WHEN status = 'committed' THEN GREATEST(0, committed_kg - picked_up_kg)
               WHEN status = 'disputed' THEN GREATEST(0, committed_kg - picked_up_kg)
               ELSE 0
             END
           ), 0) AS blocking_kg,
           COUNT(*) FILTER (WHERE status = 'disputed') AS disputed_count
         FROM allocations
         WHERE batch_id = $1
           AND status IN ('held', 'supplier_accepted', 'committed', 'disputed')`,
        [currentListing.batch_id]
      );

      const blockingKg = parseFloat(holdRows[0].blocking_kg || '0');
      const disputedCount = parseInt(holdRows[0].disputed_count || '0', 10);

      if (blockingKg > 0 || disputedCount > 0) {
        await client.query('ROLLBACK');
        let errorMsg = `Cannot reassign harvest batch: existing listing has ${blockingKg} kg in active reservations or commitments.`;
        if (disputedCount > 0 && blockingKg === 0) {
          errorMsg = `Cannot reassign harvest batch: existing listing has ${disputedCount} unresolved disputed allocation(s).`;
        } else if (disputedCount > 0) {
          errorMsg = `Cannot reassign harvest batch: existing listing has active commitments or unresolved disputed allocations (${blockingKg} kg encumbered).`;
        }
        return res.status(409).json({
          error: errorMsg,
          requestId: req.requestId,
        });
      }

      // Verify new batch ownership and harvested status
      const { rows: targetBatchRows } = await client.query(
        `SELECT id, farmer_id, farm_id, status, sellable_kg
         FROM harvest_batches
         WHERE id = $1
         FOR UPDATE`,
        [targetBatchId]
      );

      if (!targetBatchRows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Target harvest batch not found', requestId: req.requestId });
      }

      const targetBatch = targetBatchRows[0];
      if (targetBatch.farmer_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Target harvest batch does not belong to your account', requestId: req.requestId });
      }

      if (targetBatch.status !== 'harvested') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Harvest batch must be in harvested status before listing', requestId: req.requestId });
      }

      // Check one_active_listing_per_batch constraint
      const { rows: existingActiveRows } = await client.query(
        `SELECT id FROM listings WHERE batch_id = $1 AND status = 'active' AND id <> $2`,
        [targetBatchId, id]
      );
      if (existingActiveRows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Target harvest batch already has an active produce listing', requestId: req.requestId });
      }

      // Check uncommitted stock on target batch
      const { rows: targetAllocRows } = await client.query(
        `SELECT COALESCE(SUM(
           CASE
             WHEN status IN ('held', 'supplier_accepted') THEN agreed_kg
             WHEN status IN ('committed', 'disputed') THEN GREATEST(0, committed_kg - picked_up_kg)
             ELSE 0
           END
         ), 0) AS target_holds
         FROM allocations
         WHERE batch_id = $1
           AND status IN ('held', 'supplier_accepted', 'committed', 'disputed')`,
        [targetBatchId]
      );
      const targetHolds = parseFloat(targetAllocRows[0].target_holds || '0');
      const targetAvailable = parseFloat(targetBatch.sellable_kg || '0') - targetHolds;

      const qty = offeredKg !== undefined ? parseFloat(offeredKg) : parseFloat(currentListing.offered_kg);
      if (qty > targetAvailable) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Offered quantity (${qty} kg) exceeds available uncommitted stock on the new batch (${targetAvailable} kg)`,
          requestId: req.requestId,
        });
      }
    }

    // 4. Update the listing in-place
    const updatedBatchId = targetBatchId;
    const updatedOfferedKg = offeredKg !== undefined ? offeredKg : currentListing.offered_kg;
    const updatedUnitPrice = unitPriceCents !== undefined ? unitPriceCents : currentListing.unit_price_cents;
    const updatedValidFrom = validFrom || currentListing.valid_from;
    const updatedValidUntil = validUntil || currentListing.valid_until;
    const updatedStatus = status || currentListing.status;

    const { rows: updatedRows } = await client.query(
      `UPDATE listings
       SET batch_id = $1,
           offered_kg = $2,
           unit_price_cents = $3,
           valid_from = $4,
           valid_until = $5,
           status = $6
       WHERE id = $7
       RETURNING id, batch_id, offered_kg, unit_price_cents, valid_from, valid_until, status, created_at`,
      [updatedBatchId, updatedOfferedKg, updatedUnitPrice, updatedValidFrom, updatedValidUntil, updatedStatus, id]
    );

    // Audit price changes if unit price was modified
    const oldPriceInt = parseInt(currentListing.unit_price_cents, 10);
    const newPriceInt = parseInt(updatedUnitPrice, 10);
    if (newPriceInt !== oldPriceInt) {
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes, occurred_at)
         VALUES ($1, 'update_listing_price', 'listing', $2, $3, 'Produce listing unit price updated by farmer', $4, now())`,
        [
          req.user.id,
          id,
          req.requestId,
          JSON.stringify({
            unit_price_cents: {
              old: oldPriceInt,
              new: newPriceInt,
            },
          }),
        ]
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      data: updatedRows[0],
      requestId: req.requestId,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}
