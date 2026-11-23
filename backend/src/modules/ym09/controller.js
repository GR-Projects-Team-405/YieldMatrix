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
                SELECT SUM(a.agreed_kg)
                FROM allocations a
                WHERE a.batch_id = l.batch_id
                  AND a.status IN ('held', 'supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted', 'partially_accepted', 'disputed')
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

/**
 * Retrieves a single produce listing by ID.
 */
export async function getProduceListingById(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT l.id, l.batch_id AS "batchId", l.offered_kg AS "offeredKg",
              l.unit_price_cents AS "unitPriceCents", l.valid_from AS "validFrom",
              l.valid_until AS "validUntil", l.status, l.created_at AS "createdAt",
              c.name AS "cropName", g.name AS "gradeName", f.name AS "farmName", f.id AS "farmId",
              f.district, hb.farmer_id AS "farmerId",
              COALESCE((
                SELECT SUM(a.agreed_kg)
                FROM allocations a
                WHERE a.batch_id = l.batch_id
                  AND a.status IN ('held', 'supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted', 'partially_accepted', 'disputed')
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
  const client = await pool.connect();
  try {
    const { id } = req.params;
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
      // Check active allocations/holds on current batch
      // Per SRS FR-FARM-07 & DR-01: Reassignment blocked if active reservations or commitments exist
      const { rows: holdRows } = await client.query(
        `SELECT COALESCE(SUM(agreed_kg), 0) AS active_holds
         FROM allocations
         WHERE batch_id = $1
           AND status IN ('held', 'supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted', 'partially_accepted', 'disputed')`,
        [currentListing.batch_id]
      );

      const activeHolds = parseFloat(holdRows[0].active_holds || '0');
      if (activeHolds > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Cannot reassign harvest batch: existing listing has ${activeHolds} kg in active reservations or commitments.`,
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
        `SELECT COALESCE(SUM(agreed_kg), 0) AS target_holds
         FROM allocations
         WHERE batch_id = $1
           AND status IN ('held', 'supplier_accepted', 'committed')`,
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
