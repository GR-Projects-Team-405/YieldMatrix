import pool from '../../config/db.js';

// YM19 · Pasan Kalhara · Acceptance & disputes
// Handles delivery acceptance review, partial acceptance, disputes, stats, notifications, and audit logging.

/**
 * Get module status and user details
 */
export async function getStatus(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({
      module: 'YM19',
      name: 'Acceptance & disputes',
      owner: 'Pasan Kalhara',
      status: 'active',
      user: rows[0],
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Summary metrics for acceptance & disputes dashboard
 */
export async function getSummary(req, res, next) {
  try {
    const isBuyer = req.user.role === 'buyer';
    const params = [isBuyer, req.user.id];

    // Deliveries summary
    const delivQuery = `
      SELECT
        COUNT(*) FILTER (WHERE a.status IN ('handed_over', 'picked_up')) AS pending_acceptance,
        COUNT(*) FILTER (WHERE a.status = 'accepted') AS total_accepted,
        COUNT(*) FILTER (WHERE a.status = 'partially_accepted') AS total_partial,
        COUNT(*) FILTER (WHERE a.status = 'disputed') AS total_disputed,
        COUNT(*) AS total_deliveries
      FROM allocations a
      JOIN orders o ON a.order_id = o.id
      WHERE ($1 = false OR o.buyer_id = $2);
    `;
    const delivRes = await pool.query(delivQuery, params);

    // Disputes summary
    const dispQuery = `
      SELECT
        COUNT(*) FILTER (WHERE d.status = 'open') AS open_disputes,
        COUNT(*) FILTER (WHERE d.status = 'under_review') AS under_review_disputes,
        COUNT(*) FILTER (WHERE d.status = 'resolved') AS resolved_disputes,
        COALESCE(SUM(d.disputed_cents), 0)::BIGINT AS total_disputed_cents,
        COALESCE(SUM(d.settlement_cents), 0)::BIGINT AS total_settlement_cents,
        COALESCE(SUM(d.refund_cents), 0)::BIGINT AS total_refund_cents,
        COUNT(*) AS total_disputes
      FROM disputes d
      JOIN allocations a ON d.allocation_id = a.id
      JOIN orders o ON a.order_id = o.id
      WHERE ($1 = false OR d.raised_by = $2 OR o.buyer_id = $2);
    `;
    const dispRes = await pool.query(dispQuery, params);

    res.json({
      metrics: {
        ...delivRes.rows[0],
        ...dispRes.rows[0]
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get deliveries / allocations awaiting or completed acceptance review for the buyer
 */
export async function getDeliveries(req, res, next) {
  try {
    const isBuyer = req.user.role === 'buyer';
    const { status } = req.query;

    let query = `
      SELECT
        a.id,
        a.order_id,
        a.batch_id,
        a.farmer_id,
        u_farmer.name AS farmer_name,
        u_farmer.email AS farmer_email,
        f.name AS farm_name,
        f.district AS farm_district,
        c.name AS crop_name,
        g.name AS grade_name,
        a.agreed_kg::FLOAT AS agreed_kg,
        a.agreed_unit_price_cents,
        a.agreed_value_cents,
        a.committed_kg::FLOAT AS committed_kg,
        a.picked_up_kg::FLOAT AS picked_up_kg,
        a.handed_over_kg::FLOAT AS handed_over_kg,
        a.accepted_kg::FLOAT AS accepted_kg,
        a.funded_cents,
        a.settled_cents,
        a.refunded_cents,
        a.held_cents,
        a.status AS allocation_status,
        a.created_at,
        o.destination,
        o.delivery_date,
        o.status AS order_status,
        COALESCE(disp.dispute_count, 0)::INT AS dispute_count
      FROM allocations a
      JOIN orders o ON a.order_id = o.id
      JOIN users u_farmer ON a.farmer_id = u_farmer.id
      JOIN harvest_batches b ON a.batch_id = b.id
      JOIN crops c ON b.crop_id = c.id
      JOIN grades g ON b.grade_id = g.id
      LEFT JOIN farms f ON b.farm_id = f.id
      LEFT JOIN (
        SELECT allocation_id, count(*) AS dispute_count
        FROM disputes
        GROUP BY allocation_id
      ) disp ON disp.allocation_id = a.id
      WHERE ($1 = false OR o.buyer_id = $2)
    `;

    const params = [isBuyer, req.user.id];

    if (status && status !== 'all') {
      query += ` AND a.status = $3`;
      params.push(status);
    }

    query += `
      ORDER BY 
        CASE 
          WHEN a.status IN ('handed_over', 'picked_up') THEN 1
          WHEN a.status = 'partially_accepted' THEN 2
          WHEN a.status = 'disputed' THEN 3
          WHEN a.status = 'accepted' THEN 4
          ELSE 5
        END,
        a.created_at DESC;
    `;

    const { rows } = await pool.query(query, params);
    res.json({ deliveries: rows, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

/**
 * Get details for a single allocation for acceptance review
 */
export async function getAllocationDetail(req, res, next) {
  try {
    const { id } = req.params;
    const isBuyer = req.user.role === 'buyer';

    const query = `
      SELECT
        a.id,
        a.order_id,
        a.batch_id,
        a.farmer_id,
        u_farmer.name AS farmer_name,
        u_farmer.email AS farmer_email,
        f.name AS farm_name,
        f.district AS farm_district,
        c.name AS crop_name,
        g.name AS grade_name,
        a.agreed_kg::FLOAT AS agreed_kg,
        a.agreed_unit_price_cents,
        a.agreed_value_cents,
        a.committed_kg::FLOAT AS committed_kg,
        a.picked_up_kg::FLOAT AS picked_up_kg,
        a.handed_over_kg::FLOAT AS handed_over_kg,
        a.accepted_kg::FLOAT AS accepted_kg,
        a.funded_cents,
        a.settled_cents,
        a.refunded_cents,
        a.held_cents,
        a.status AS allocation_status,
        a.created_at,
        o.buyer_id,
        o.destination,
        o.delivery_date,
        o.status AS order_status
      FROM allocations a
      JOIN orders o ON a.order_id = o.id
      JOIN users u_farmer ON a.farmer_id = u_farmer.id
      JOIN harvest_batches b ON a.batch_id = b.id
      JOIN crops c ON b.crop_id = c.id
      JOIN grades g ON b.grade_id = g.id
      LEFT JOIN farms f ON b.farm_id = f.id
      WHERE a.id = $1 AND ($2 = false OR o.buyer_id = $3);
    `;

    const { rows } = await pool.query(query, [id, isBuyer, req.user.id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'Allocation not found or access denied', requestId: req.requestId });
    }

    const disputesQuery = `
      SELECT id, status, disputed_kg::FLOAT as disputed_kg, disputed_cents, reason, resolution, created_at
      FROM disputes
      WHERE allocation_id = $1
      ORDER BY created_at DESC;
    `;
    const disputesRes = await pool.query(disputesQuery, [id]);

    res.json({ allocation: rows[0], disputes: disputesRes.rows, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

/**
 * Full acceptance of delivered quantity
 */
export async function acceptFullDelivery(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    const isBuyer = req.user.role === 'buyer';

    await client.query('BEGIN');

    const allocQuery = `
      SELECT a.*, o.buyer_id, o.status as order_status
      FROM allocations a
      JOIN orders o ON a.order_id = o.id
      WHERE a.id = $1 AND ($2 = false OR o.buyer_id = $3)
      FOR UPDATE OF a;
    `;
    const allocRes = await client.query(allocQuery, [id, isBuyer, req.user.id]);
    if (!allocRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Allocation not found or unauthorized', requestId: req.requestId });
    }

    const alloc = allocRes.rows[0];

    if (alloc.status === 'accepted') {
      await client.query('ROLLBACK');
      return res.json({ message: 'Allocation is already accepted', allocation: alloc, requestId: req.requestId });
    }

    if (['cancelled', 'declined', 'expired'].includes(alloc.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot accept an allocation in '${alloc.status}' status`, requestId: req.requestId });
    }

    const targetAcceptedKg = parseFloat(alloc.handed_over_kg) > 0 ? parseFloat(alloc.handed_over_kg) : parseFloat(alloc.picked_up_kg || alloc.committed_kg);

    if (targetAcceptedKg <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No delivered or committed quantity available to accept', requestId: req.requestId });
    }

    const handedOverKg = Math.max(parseFloat(alloc.handed_over_kg), targetAcceptedKg);

    // If allocation is still picked_up or committed, transition through handed_over first to satisfy workflow trigger
    if (alloc.status === 'picked_up' || alloc.status === 'committed') {
      await client.query(
        `UPDATE allocations SET handed_over_kg = $1, status = 'handed_over' WHERE id = $2;`,
        [handedOverKg.toFixed(3), id]
      );
    }

    const unitPrice = BigInt(alloc.agreed_unit_price_cents);
    const fundedCents = BigInt(alloc.funded_cents || '0');
    
    const settledAmount = BigInt(Math.round(targetAcceptedKg * Number(unitPrice)));
    const finalSettledCents = fundedCents > 0n ? (settledAmount > fundedCents ? fundedCents : settledAmount) : 0n;
    const finalHeldCents = fundedCents > finalSettledCents ? (fundedCents - finalSettledCents) : 0n;

    const updateQuery = `
      UPDATE allocations
      SET
        handed_over_kg = $1,
        accepted_kg = $2,
        settled_cents = $3,
        held_cents = $4,
        status = 'accepted',
        decision_reason = $5
      WHERE id = $6
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [
      handedOverKg.toFixed(3),
      targetAcceptedKg.toFixed(3),
      finalSettledCents.toString(),
      finalHeldCents.toString(),
      notes ? notes.trim() : 'Full delivery accepted by buyer',
      id
    ]);

    // Check parent order completion
    const remainingCheck = await client.query(
      `SELECT count(*) as unaccepted_count FROM allocations WHERE order_id = $1 AND status NOT IN ('accepted', 'cancelled', 'resolved');`,
      [alloc.order_id]
    );

    if (parseInt(remainingCheck.rows[0].unaccepted_count, 10) === 0) {
      await client.query(
        `UPDATE orders SET status = 'delivered', updated_at = now() WHERE id = $1 AND status = 'in_fulfilment';`,
        [alloc.order_id]
      );
    }

    // In-app notification for farmer
    const notifOpKey = `notif:accept:${id}:${Date.now()}`;
    await client.query(
      `INSERT INTO notifications (user_id, title, message, category, target_path, operation_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (operation_key) DO NOTHING;`,
      [
        alloc.farmer_id,
        'Delivery Accepted',
        `Buyer has accepted ${targetAcceptedKg.toFixed(1)} kg for allocation #${id.slice(0, 8)}.`,
        'delivery',
        '/farmer/allocations',
        notifOpKey
      ]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, safe_changes)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        req.user.id,
        'accept_delivery',
        'allocation',
        id,
        notes || 'Full acceptance',
        JSON.stringify({ accepted_kg: targetAcceptedKg, settled_cents: finalSettledCents.toString() })
      ]
    );

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: 'Delivery accepted in full successfully',
      allocation: updated.rows[0],
      requestId: req.requestId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

/**
 * Partial acceptance: accepts partial kg, creates dispute for remainder
 */
export async function acceptPartialDelivery(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { acceptedKg, reason, evidence = [], operationKey } = req.body || {};
    const isBuyer = req.user.role === 'buyer';

    if (acceptedKg === undefined || acceptedKg === null || isNaN(Number(acceptedKg))) {
      return res.status(422).json({ error: 'Valid acceptedKg is required', requestId: req.requestId });
    }

    const acceptedKgNum = parseFloat(acceptedKg);
    if (acceptedKgNum < 0) {
      return res.status(422).json({ error: 'Accepted quantity cannot be negative', requestId: req.requestId });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(422).json({ error: 'Reason for partial acceptance / dispute is required', requestId: req.requestId });
    }

    await client.query('BEGIN');

    const allocQuery = `
      SELECT a.*, o.buyer_id, o.status as order_status
      FROM allocations a
      JOIN orders o ON a.order_id = o.id
      WHERE a.id = $1 AND ($2 = false OR o.buyer_id = $3)
      FOR UPDATE OF a;
    `;
    const allocRes = await client.query(allocQuery, [id, isBuyer, req.user.id]);
    if (!allocRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Allocation not found or unauthorized', requestId: req.requestId });
    }

    const alloc = allocRes.rows[0];
    const availableDelivered = parseFloat(alloc.handed_over_kg) > 0 ? parseFloat(alloc.handed_over_kg) : parseFloat(alloc.picked_up_kg || alloc.committed_kg);

    if (acceptedKgNum >= availableDelivered) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Partial acceptance quantity (${acceptedKgNum} kg) must be less than delivered quantity (${availableDelivered} kg). Use full acceptance instead.`,
        requestId: req.requestId
      });
    }

    const handedOverKg = Math.max(parseFloat(alloc.handed_over_kg), availableDelivered);

    // If allocation is in picked_up or committed, transition through handed_over first
    if (alloc.status === 'picked_up' || alloc.status === 'committed') {
      await client.query(
        `UPDATE allocations SET handed_over_kg = $1, status = 'handed_over' WHERE id = $2;`,
        [handedOverKg.toFixed(3), id]
      );
    }

    const disputedKg = handedOverKg - acceptedKgNum;
    const unitPrice = BigInt(alloc.agreed_unit_price_cents);
    const disputedCents = BigInt(Math.round(disputedKg * Number(unitPrice)));
    const fundedCents = BigInt(alloc.funded_cents || '0');

    const settledAmount = BigInt(Math.round(acceptedKgNum * Number(unitPrice)));
    const finalSettledCents = fundedCents > 0n ? (settledAmount > fundedCents ? fundedCents : settledAmount) : 0n;
    const finalHeldCents = fundedCents > finalSettledCents ? (fundedCents - finalSettledCents) : 0n;

    const opKey = operationKey || `dispute:buyer:${req.user.id}:${alloc.id}:${Date.now()}`;

    const updateAllocQuery = `
      UPDATE allocations
      SET
        handed_over_kg = $1,
        accepted_kg = $2,
        settled_cents = $3,
        held_cents = $4,
        status = 'partially_accepted',
        decision_reason = $5
      WHERE id = $6
      RETURNING *;
    `;

    const updatedAlloc = await client.query(updateAllocQuery, [
      handedOverKg.toFixed(3),
      acceptedKgNum.toFixed(3),
      finalSettledCents.toString(),
      finalHeldCents.toString(),
      `Partial acceptance (${acceptedKgNum} kg accepted, ${disputedKg.toFixed(3)} kg disputed): ${reason.trim()}`,
      id
    ]);

    const insertDisputeQuery = `
      INSERT INTO disputes (
        allocation_id,
        raised_by,
        disputed_kg,
        disputed_cents,
        reason,
        evidence,
        status,
        operation_key
      ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
      RETURNING *;
    `;

    const disputeRes = await client.query(insertDisputeQuery, [
      id,
      req.user.id,
      disputedKg.toFixed(3),
      disputedCents.toString(),
      reason.trim(),
      JSON.stringify(Array.isArray(evidence) ? evidence : [evidence]),
      opKey
    ]);

    // Notification for farmer & admin
    const notifOpKey = `notif:dispute:${id}:${Date.now()}`;
    await client.query(
      `INSERT INTO notifications (user_id, title, message, category, target_path, operation_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (operation_key) DO NOTHING;`,
      [
        alloc.farmer_id,
        'Dispute Opened on Allocation',
        `Buyer partially accepted ${acceptedKgNum} kg. ${disputedKg.toFixed(1)} kg disputed: ${reason.trim()}`,
        'dispute',
        '/farmer/allocations',
        notifOpKey
      ]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, safe_changes)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        req.user.id,
        'partial_accept_dispute',
        'allocation',
        id,
        reason.trim(),
        JSON.stringify({ accepted_kg: acceptedKgNum, disputed_kg: disputedKg, dispute_id: disputeRes.rows[0].id })
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Partial acceptance recorded and dispute raised successfully',
      allocation: updatedAlloc.rows[0],
      dispute: disputeRes.rows[0],
      requestId: req.requestId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

/**
 * Raise a full dispute (100% quantity rejected due to severe damage, spoilage, or wrong produce)
 */
export async function raiseFullDispute(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason, evidence = [], operationKey } = req.body || {};
    const isBuyer = req.user.role === 'buyer';

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(422).json({ error: 'Reason for dispute is required', requestId: req.requestId });
    }

    await client.query('BEGIN');

    const allocQuery = `
      SELECT a.*, o.buyer_id, o.status as order_status
      FROM allocations a
      JOIN orders o ON a.order_id = o.id
      WHERE a.id = $1 AND ($2 = false OR o.buyer_id = $3)
      FOR UPDATE OF a;
    `;
    const allocRes = await client.query(allocQuery, [id, isBuyer, req.user.id]);
    if (!allocRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Allocation not found or unauthorized', requestId: req.requestId });
    }

    const alloc = allocRes.rows[0];
    const availableDelivered = parseFloat(alloc.handed_over_kg) > 0 ? parseFloat(alloc.handed_over_kg) : parseFloat(alloc.picked_up_kg || alloc.committed_kg);

    if (availableDelivered <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No delivered produce available to dispute', requestId: req.requestId });
    }

    const handedOverKg = Math.max(parseFloat(alloc.handed_over_kg), availableDelivered);

    // If allocation is in committed or picked_up, workflow trigger allows transition directly to 'disputed' or through 'handed_over'
    if (alloc.status === 'committed') {
      await client.query(
        `UPDATE allocations SET handed_over_kg = $1, status = 'disputed', decision_reason = $2 WHERE id = $3;`,
        [handedOverKg.toFixed(3), `Disputed by buyer: ${reason.trim()}`, id]
      );
    } else {
      await client.query(
        `UPDATE allocations SET handed_over_kg = $1, accepted_kg = 0, status = 'disputed', decision_reason = $2 WHERE id = $3;`,
        [handedOverKg.toFixed(3), `Disputed by buyer: ${reason.trim()}`, id]
      );
    }

    const disputedKg = handedOverKg;
    const unitPrice = BigInt(alloc.agreed_unit_price_cents);
    const disputedCents = BigInt(Math.round(disputedKg * Number(unitPrice)));
    const opKey = operationKey || `dispute:full:${req.user.id}:${alloc.id}:${Date.now()}`;

    const insertDisputeQuery = `
      INSERT INTO disputes (
        allocation_id,
        raised_by,
        disputed_kg,
        disputed_cents,
        reason,
        evidence,
        status,
        operation_key
      ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
      RETURNING *;
    `;

    const disputeRes = await client.query(insertDisputeQuery, [
      id,
      req.user.id,
      disputedKg.toFixed(3),
      disputedCents.toString(),
      reason.trim(),
      JSON.stringify(Array.isArray(evidence) ? evidence : [evidence]),
      opKey
    ]);

    // Notification for farmer
    const notifOpKey = `notif:dispute:full:${id}:${Date.now()}`;
    await client.query(
      `INSERT INTO notifications (user_id, title, message, category, target_path, operation_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (operation_key) DO NOTHING;`,
      [
        alloc.farmer_id,
        'Delivery Rejected / Disputed',
        `Buyer rejected full delivery of ${disputedKg.toFixed(1)} kg. Reason: ${reason.trim()}`,
        'dispute',
        '/farmer/allocations',
        notifOpKey
      ]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, safe_changes)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        req.user.id,
        'raise_full_dispute',
        'allocation',
        id,
        reason.trim(),
        JSON.stringify({ disputed_kg: disputedKg, disputed_cents: disputedCents.toString(), dispute_id: disputeRes.rows[0].id })
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Full dispute raised successfully',
      dispute: disputeRes.rows[0],
      requestId: req.requestId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

/**
 * Get all disputes raised by the buyer (or all for admin)
 */
export async function getDisputes(req, res, next) {
  try {
    const isBuyer = req.user.role === 'buyer';
    const { status } = req.query;

    let query = `
      SELECT
        d.id,
        d.allocation_id,
        d.raised_by,
        u_buyer.name AS buyer_name,
        u_farmer.name AS farmer_name,
        c.name AS crop_name,
        g.name AS grade_name,
        d.disputed_kg::FLOAT AS disputed_kg,
        d.disputed_cents,
        d.reason,
        d.evidence,
        d.status AS dispute_status,
        d.resolved_kg::FLOAT AS resolved_kg,
        d.settlement_cents,
        d.refund_cents,
        d.resolution,
        d.resolved_by,
        u_resolver.name AS resolver_name,
        d.resolved_at,
        d.operation_key,
        d.created_at,
        a.order_id,
        a.agreed_kg::FLOAT AS agreed_kg,
        a.handed_over_kg::FLOAT AS handed_over_kg,
        a.accepted_kg::FLOAT AS accepted_kg,
        a.agreed_unit_price_cents
      FROM disputes d
      JOIN allocations a ON d.allocation_id = a.id
      JOIN orders o ON a.order_id = o.id
      JOIN users u_buyer ON d.raised_by = u_buyer.id
      JOIN users u_farmer ON a.farmer_id = u_farmer.id
      JOIN harvest_batches b ON a.batch_id = b.id
      JOIN crops c ON b.crop_id = c.id
      JOIN grades g ON b.grade_id = g.id
      LEFT JOIN users u_resolver ON d.resolved_by = u_resolver.id
      WHERE ($1 = false OR d.raised_by = $2 OR o.buyer_id = $2)
    `;

    const params = [isBuyer, req.user.id];

    if (status && status !== 'all' && ['open', 'under_review', 'resolved'].includes(status)) {
      query += ` AND d.status = $3`;
      params.push(status);
    }

    query += ` ORDER BY d.created_at DESC;`;

    const { rows } = await pool.query(query, params);
    res.json({ disputes: rows, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single dispute details
 */
export async function getDisputeDetail(req, res, next) {
  try {
    const { id } = req.params;
    const isBuyer = req.user.role === 'buyer';

    const query = `
      SELECT
        d.id,
        d.allocation_id,
        d.raised_by,
        u_buyer.name AS buyer_name,
        u_farmer.name AS farmer_name,
        u_farmer.email AS farmer_email,
        c.name AS crop_name,
        g.name AS grade_name,
        d.disputed_kg::FLOAT AS disputed_kg,
        d.disputed_cents,
        d.reason,
        d.evidence,
        d.status AS dispute_status,
        d.resolved_kg::FLOAT AS resolved_kg,
        d.settlement_cents,
        d.refund_cents,
        d.resolution,
        d.resolved_by,
        u_resolver.name AS resolver_name,
        d.resolved_at,
        d.operation_key,
        d.created_at,
        a.order_id,
        a.agreed_kg::FLOAT AS agreed_kg,
        a.handed_over_kg::FLOAT AS handed_over_kg,
        a.accepted_kg::FLOAT AS accepted_kg,
        a.agreed_unit_price_cents,
        a.status AS allocation_status,
        o.destination,
        o.delivery_date
      FROM disputes d
      JOIN allocations a ON d.allocation_id = a.id
      JOIN orders o ON a.order_id = o.id
      JOIN users u_buyer ON d.raised_by = u_buyer.id
      JOIN users u_farmer ON a.farmer_id = u_farmer.id
      JOIN harvest_batches b ON a.batch_id = b.id
      JOIN crops c ON b.crop_id = c.id
      JOIN grades g ON b.grade_id = g.id
      LEFT JOIN users u_resolver ON d.resolved_by = u_resolver.id
      WHERE d.id = $1 AND ($2 = false OR d.raised_by = $3 OR o.buyer_id = $3);
    `;

    const { rows } = await pool.query(query, [id, isBuyer, req.user.id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'Dispute not found or unauthorized', requestId: req.requestId });
    }

    res.json({ dispute: rows[0], requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}
