import pool from '../../config/db.js';
// YM20 · Praveena Buddini · Order & transaction records
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM20', owner: 'Praveena Buddini', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

const STATUS_BY_EVENT = {
  hold: 'Held',
  refund: 'Refunded',
  reversal: 'Reversed',
};

// Lists wallet journal entries that touch the logged-in user's own wallet.
export async function getMyTransactions(req, res, next) {
  try {
    const account = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!account.rows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { rows } = await pool.query(
      `SELECT e.id, e.event_type, e.event_reference, e.amount_cents::text AS amount_cents,
              e.occurred_at, e.order_id
       FROM wallet_journal_entries e
       WHERE e.event_type IN ('funding','hold','settlement','refund','reversal')
         AND EXISTS (
           SELECT 1 FROM wallet_journal_lines l
           JOIN wallets w ON w.id = l.wallet_id
           WHERE l.entry_id = e.id AND w.owner_id = $1
         )
       ORDER BY e.occurred_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({
      transactions: rows.map((r) => ({
        id: r.id,
        reference: r.event_reference,
        type: r.event_type,
        status: STATUS_BY_EVENT[r.event_type] ?? 'Completed',
        amountCents: r.amount_cents,
        occurredAt: r.occurred_at,
        orderId: r.order_id,
      })),
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One wallet journal entry, only if it touches the logged-in user's own wallet.
export async function getMyTransactionById(req, res, next) {
  try {
    const { id } = req.params;
    if (!UUID_PATTERN.test(id)) {
      return res.status(404).json({ error: 'Transaction not found', requestId: req.requestId });
    }
    const account = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!account.rows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { rows } = await pool.query(
      `SELECT e.id, e.event_type, e.event_reference, e.amount_cents::text AS amount_cents,
              e.occurred_at, e.recorded_at, e.order_id,
              o.status AS order_status, o.destination, o.agreed_total_cents::text AS order_total_cents
       FROM wallet_journal_entries e
       LEFT JOIN orders o ON o.id = e.order_id
       WHERE e.id = $1
         AND EXISTS (
           SELECT 1 FROM wallet_journal_lines l
           JOIN wallets w ON w.id = l.wallet_id
           WHERE l.entry_id = e.id AND w.owner_id = $2
         )`,
      [id, req.user.id]
    );
    const r = rows[0];
    if (!r) {
      return res.status(404).json({ error: 'Transaction not found', requestId: req.requestId });
    }

    res.json({
      transaction: {
        id: r.id,
        reference: r.event_reference,
        type: r.event_type,
        status: STATUS_BY_EVENT[r.event_type] ?? 'Completed',
        amountCents: r.amount_cents,
        occurredAt: r.occurred_at,
        recordedAt: r.recorded_at,
        orderId: r.order_id,
        orderStatus: r.order_status,
        destination: r.destination,
        orderTotalCents: r.order_total_cents,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// One order with its allocations. Buyers see their own orders; farmers see only their own allocation rows.
export async function getMyOrder(req, res, next) {
  try {
    const { id } = req.params;
    if (!UUID_PATTERN.test(id)) {
      return res.status(404).json({ error: 'Order not found', requestId: req.requestId });
    }
    const account = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!account.rows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const isFarmer = req.user.role === 'farmer';
    const orderResult = await pool.query(
      `SELECT o.id, o.status, o.destination, o.destination_district,
              o.delivery_date::text AS delivery_date,
              o.agreed_total_cents::text AS agreed_total_cents, o.created_at
       FROM orders o
       WHERE o.id = $1 AND ${
         isFarmer
           ? 'EXISTS (SELECT 1 FROM allocations x WHERE x.order_id = o.id AND x.farmer_id = $2)'
           : 'o.buyer_id = $2'
       }`,
      [id, req.user.id]
    );
    const o = orderResult.rows[0];
    if (!o) {
      return res.status(404).json({ error: 'Order not found', requestId: req.requestId });
    }

    const allocResult = await pool.query(
      `SELECT a.id, a.status, f.name AS farm, c.name AS crop, g.name AS grade,
              a.agreed_kg::text AS agreed_kg,
              a.agreed_unit_price_cents::text AS unit_price_cents,
              a.agreed_value_cents::text AS value_cents,
              a.funded_cents::text AS funded_cents,
              a.held_cents::text AS held_cents,
              a.settled_cents::text AS settled_cents,
              a.refunded_cents::text AS refunded_cents
       FROM allocations a
       JOIN harvest_batches b ON b.id = a.batch_id
       JOIN crops c ON c.id = b.crop_id
       JOIN grades g ON g.id = b.grade_id
       JOIN farms f ON f.id = b.farm_id
       WHERE a.order_id = $1 ${isFarmer ? 'AND a.farmer_id = $2' : ''}
       ORDER BY f.name`,
      isFarmer ? [id, req.user.id] : [id]
    );

    res.json({
      order: {
        id: o.id,
        status: o.status,
        destination: isFarmer ? o.destination_district : o.destination,
        deliveryDate: o.delivery_date,
        createdAt: o.created_at,
        totalCents: isFarmer ? null : o.agreed_total_cents,
      },
      allocations: allocResult.rows.map((a) => ({
        id: a.id,
        status: a.status,
        farm: a.farm,
        crop: a.crop,
        grade: a.grade,
        agreedKg: a.agreed_kg,
        unitPriceCents: a.unit_price_cents,
        valueCents: a.value_cents,
        fundedCents: a.funded_cents,
        heldCents: a.held_cents,
        settledCents: a.settled_cents,
        refundedCents: a.refunded_cents,
      })),
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}