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