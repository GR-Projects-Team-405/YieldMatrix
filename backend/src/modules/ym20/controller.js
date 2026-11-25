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