import { randomUUID } from 'node:crypto';
import pool from '../../config/db.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FarmerWalletUnavailableError extends Error {
  constructor() {
    super('Approved simulated farmer wallet is unavailable');
    this.name = 'FarmerWalletUnavailableError';
  }
}

export class InvalidPayoutRequestError extends Error {
  constructor() {
    super('Payout amount and idempotency key are invalid');
    this.name = 'InvalidPayoutRequestError';
  }
}

export class InsufficientWalletBalanceError extends Error {
  constructor() {
    super('Available wallet balance is insufficient');
    this.name = 'InsufficientWalletBalanceError';
  }
}

export class PayoutIdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used for a different request');
    this.name = 'PayoutIdempotencyConflictError';
  }
}

export function toSafeCents(value) {
  let cents;
  if (typeof value === 'bigint') {
    cents = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    cents = BigInt(value);
  } else if (typeof value === 'number' && Number.isSafeInteger(value)) {
    cents = BigInt(value);
  } else {
    throw new TypeError('Invalid LKR cents value');
  }

  if (cents < 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('LKR cents exceed the safe integer range');
  }
  return Number(cents);
}

function mapDate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid database date');
  return date.toISOString().slice(0, 10);
}

function mapPayoutStatus(status) {
  if (status === 'pending') return 'pending';
  if (status === 'completed') return 'confirmed';
  if (status === 'rejected') return 'failed';
  throw new TypeError('Unsupported payout status');
}

function assertRows(result) {
  if (!result || !Array.isArray(result.rows)) throw new TypeError('Invalid database query result');
  return result.rows;
}

export function createDatabaseStore(databasePool) {
  async function getOwnedWallet(farmerId) {
    const result = await databasePool.query(
      `SELECT w.id, w.available_cents, w.pending_payout_cents, w.currency
       FROM public.wallets AS w
       JOIN public.users AS u ON u.id = w.owner_id
       WHERE u.id = $1
         AND u.role = 'farmer'
         AND u.approval_status = 'approved'
         AND w.account_type = 'farmer'
         AND w.simulated = TRUE
         AND w.currency = 'LKR'
       LIMIT 2`,
      [farmerId],
    );
    const rows = assertRows(result);
    if (rows.length !== 1) throw new FarmerWalletUnavailableError();
    return rows[0];
  }

  async function getWallet(farmerId) {
    const wallet = await getOwnedWallet(farmerId);
    return {
      summary: {
        availableBalance: toSafeCents(wallet.available_cents),
        pendingPayout: toSafeCents(wallet.pending_payout_cents),
        pendingSettlements: null,
        totalEarned: null,
      },
      remainingRequestable: toSafeCents(wallet.available_cents),
    };
  }

  function mapPayout(row) {
    return {
      id: String(row.id),
      date: mapDate(row.created_at ?? row.date),
      amount: toSafeCents(row.amount_cents),
      bankLabel: 'Not stored',
      status: mapPayoutStatus(row.status),
      reference: String(row.id),
    };
  }

  function operationKeyFor(farmerId, idempotencyKey) {
    return `ym27:payout:v1:${farmerId}:${idempotencyKey.toLowerCase()}`;
  }

  function mapPayoutResult(row, replayed) {
    return { payout: mapPayout(row), replayed };
  }

  async function findExistingPayout(operationKey) {
    const result = await databasePool.query(
      `SELECT id, wallet_id, amount_cents, status, created_at
       FROM public.payout_requests
       WHERE operation_key = $1
       LIMIT 1`,
      [operationKey],
    );
    return assertRows(result)[0] ?? null;
  }

  async function createPayout({ farmerId, amountCents, idempotencyKey }) {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0
      || typeof idempotencyKey !== 'string' || !uuidPattern.test(idempotencyKey)) {
      throw new InvalidPayoutRequestError();
    }

    const amount = BigInt(amountCents);
    const operationKey = operationKeyFor(farmerId, idempotencyKey);
    const requestId = randomUUID();
    let client;
    let transactionOpen = false;
    let walletId;

    try {
      client = await databasePool.connect();
      await client.query('BEGIN');
      transactionOpen = true;

      const walletResult = await client.query(
        `SELECT w.id, w.available_cents, w.pending_payout_cents
         FROM public.users AS u
         JOIN public.wallets AS w ON w.owner_id = u.id
         WHERE u.id = $1
           AND u.role = 'farmer'
           AND u.approval_status = 'approved'
           AND w.account_type = 'farmer'
           AND w.simulated = TRUE
           AND w.currency = 'LKR'
         FOR UPDATE OF u, w`,
        [farmerId],
      );
      const wallets = assertRows(walletResult);
      if (wallets.length !== 1) throw new FarmerWalletUnavailableError();
      const wallet = wallets[0];
      walletId = String(wallet.id);

      const existingResult = await client.query(
        `SELECT id, wallet_id, amount_cents, status, created_at
         FROM public.payout_requests
         WHERE operation_key = $1
         FOR UPDATE`,
        [operationKey],
      );
      const existing = assertRows(existingResult)[0];
      if (existing) {
        if (String(existing.wallet_id) !== walletId
          || BigInt(existing.amount_cents) !== amount) {
          throw new PayoutIdempotencyConflictError();
        }
        await client.query('COMMIT');
        transactionOpen = false;
        return mapPayoutResult(existing, true);
      }

      if (BigInt(wallet.available_cents) < amount) {
        throw new InsufficientWalletBalanceError();
      }

      const updateResult = await client.query(
        `UPDATE public.wallets
         SET available_cents = available_cents - $2::bigint,
             pending_payout_cents = pending_payout_cents + $2::bigint
         WHERE id = $1
           AND available_cents >= $2::bigint
         RETURNING id`,
        [walletId, amountCents],
      );
      if (updateResult.rowCount !== 1) throw new InsufficientWalletBalanceError();

      const holdOperationKey = `${operationKey}:hold`;
      const journalResult = await client.query(
        `INSERT INTO public.wallet_journal_entries
           (event_type, event_reference, operation_key, currency, amount_cents, actor_id)
         VALUES ('payout_hold', $1, $2, 'LKR', $3::bigint, $4)
         RETURNING id`,
        [`YM27 payout request ${requestId}`, holdOperationKey, amountCents, farmerId],
      );
      const journalRows = assertRows(journalResult);
      if (journalRows.length !== 1) throw new TypeError('Payout journal entry was not created');
      const journalEntryId = String(journalRows[0].id);

      await client.query(
        `INSERT INTO public.wallet_journal_lines
           (entry_id, wallet_id, bucket, side, amount_cents)
         VALUES
           ($1, $2, 'available', 'debit', $3::bigint),
           ($1, $2, 'pending_payout', 'credit', $3::bigint)`,
        [journalEntryId, walletId, amountCents],
      );

      const payoutResult = await client.query(
        `INSERT INTO public.payout_requests
           (id, wallet_id, amount_cents, status, journal_entry_id, operation_key, simulated)
         VALUES ($1, $2, $3::bigint, 'pending', $4, $5, TRUE)
         RETURNING id, wallet_id, amount_cents, status, created_at`,
        [requestId, walletId, amountCents, journalEntryId, operationKey],
      );
      const payoutRows = assertRows(payoutResult);
      if (payoutRows.length !== 1) throw new TypeError('Payout request was not created');

      await client.query('COMMIT');
      transactionOpen = false;
      return mapPayoutResult(payoutRows[0], false);
    } catch (error) {
      if (transactionOpen && client) {
        try {
          await client.query('ROLLBACK');
          transactionOpen = false;
        } catch (rollbackError) {
          client.release(rollbackError);
          client = undefined;
          throw new AggregateError([error, rollbackError], 'Payout transaction and rollback failed');
        }
      }
      if (client) {
        client.release();
        client = undefined;
      }

      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        const existing = await findExistingPayout(operationKey);
        if (existing) {
          if (String(existing.wallet_id) !== walletId
            || BigInt(existing.amount_cents) !== amount) {
            throw new PayoutIdempotencyConflictError();
          }
          return mapPayoutResult(existing, true);
        }
      }
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  async function getTransactions(farmerId) {
    const wallet = await getOwnedWallet(farmerId);
    const result = await databasePool.query(
      `SELECT wl.id AS line_id,
              je.id AS journal_entry_id,
              TO_CHAR(je.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              je.event_type,
              je.event_reference,
              je.allocation_id,
              wl.bucket,
              wl.side,
              wl.amount_cents,
              pr.status AS payout_status
       FROM public.wallet_journal_lines AS wl
       JOIN public.wallet_journal_entries AS je ON je.id = wl.entry_id
       JOIN public.wallets AS w ON w.id = wl.wallet_id
       JOIN public.users AS u ON u.id = w.owner_id
       LEFT JOIN LATERAL (
         SELECT pr.status
         FROM public.payout_requests AS pr
         WHERE pr.journal_entry_id = je.id
           AND pr.wallet_id = w.id
         ORDER BY pr.created_at DESC, pr.id
         LIMIT 1
       ) AS pr ON TRUE
       WHERE wl.wallet_id = $1
         AND u.id = $2
         AND u.role = 'farmer'
         AND u.approval_status = 'approved'
         AND w.account_type = 'farmer'
         AND w.simulated = TRUE
         AND w.currency = 'LKR'
       ORDER BY je.occurred_at DESC, wl.created_at DESC, wl.id`,
      [wallet.id, farmerId],
    );

    return assertRows(result).map((row) => {
      if (row.side !== 'credit' && row.side !== 'debit') {
        throw new TypeError('Unsupported journal line side');
      }

      const payoutStatus = row.payout_status === null ? null : mapPayoutStatus(row.payout_status);
      return {
        id: String(row.line_id),
        journalEntryId: String(row.journal_entry_id),
        eventType: String(row.event_type),
        bucket: String(row.bucket),
        date: mapDate(row.date),
        description: String(row.event_reference),
        type: row.side,
        amount: toSafeCents(row.amount_cents),
        status: payoutStatus
          ?? (row.event_type === 'hold' || row.event_type === 'payout_hold' ? 'pending' : 'confirmed'),
        ...(row.event_type === 'settlement' ? { settlementId: String(row.journal_entry_id) } : {}),
      };
    });
  }

  async function getSettlements(farmerId) {
    const wallet = await getOwnedWallet(farmerId);
    const result = await databasePool.query(
      `SELECT je.id AS settlement_id,
              COALESCE(a.order_id, je.order_id)::text AS order_id,
              TO_CHAR(je.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              je.amount_cents AS journal_amount_cents,
              c.name AS produce
       FROM public.wallet_journal_entries AS je
       JOIN public.wallet_journal_lines AS wl
         ON wl.entry_id = je.id
        AND wl.wallet_id = $1
       JOIN public.wallets AS w ON w.id = wl.wallet_id
       JOIN public.users AS u ON u.id = w.owner_id
       LEFT JOIN public.allocations AS a
         ON a.id = je.allocation_id
        AND a.farmer_id = u.id
       LEFT JOIN public.orders AS o
         ON o.id = COALESCE(a.order_id, je.order_id)
       LEFT JOIN public.harvest_batches AS hb
         ON hb.id = a.batch_id
        AND hb.farmer_id = u.id
       LEFT JOIN public.crops AS c ON c.id = hb.crop_id
       WHERE je.event_type = 'settlement'
         AND w.id = $1
         AND u.id = $2
         AND u.role = 'farmer'
         AND u.approval_status = 'approved'
         AND w.account_type = 'farmer'
         AND w.simulated = TRUE
         AND w.currency = 'LKR'
       GROUP BY je.id, a.order_id, je.order_id, je.occurred_at, je.amount_cents, c.name
       ORDER BY je.occurred_at DESC, je.id`,
      [wallet.id, farmerId],
    );

    return assertRows(result).map((row) => mapSettlement(row));
  }

  async function getSettlement(farmerId, settlementId) {
    const wallet = await getOwnedWallet(farmerId);
    const result = await databasePool.query(
      `SELECT je.id AS settlement_id,
              COALESCE(a.order_id, je.order_id)::text AS order_id,
              TO_CHAR(je.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              je.amount_cents AS journal_amount_cents,
              c.name AS produce
       FROM public.wallet_journal_entries AS je
       JOIN public.wallet_journal_lines AS wl
         ON wl.entry_id = je.id
        AND wl.wallet_id = $1
       JOIN public.wallets AS w ON w.id = wl.wallet_id
       JOIN public.users AS u ON u.id = w.owner_id
       LEFT JOIN public.allocations AS a
         ON a.id = je.allocation_id
        AND a.farmer_id = u.id
       LEFT JOIN public.orders AS o
         ON o.id = COALESCE(a.order_id, je.order_id)
       LEFT JOIN public.harvest_batches AS hb
         ON hb.id = a.batch_id
        AND hb.farmer_id = u.id
       LEFT JOIN public.crops AS c ON c.id = hb.crop_id
       WHERE je.event_type = 'settlement'
         AND je.id = $3::uuid
         AND w.id = $1
         AND u.id = $2
         AND u.role = 'farmer'
         AND u.approval_status = 'approved'
         AND w.account_type = 'farmer'
         AND w.simulated = TRUE
         AND w.currency = 'LKR'
       GROUP BY je.id, a.order_id, je.order_id, je.occurred_at, je.amount_cents, c.name
       LIMIT 1`,
      [wallet.id, farmerId, settlementId],
    );
    const rows = assertRows(result);
    return rows.length === 0 ? null : mapSettlement(rows[0]);
  }

  async function getPayouts(farmerId) {
    const wallet = await getOwnedWallet(farmerId);
    const result = await databasePool.query(
      `SELECT pr.id,
              pr.amount_cents,
              pr.status,
              TO_CHAR(pr.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date
       FROM public.payout_requests AS pr
       JOIN public.wallets AS w ON w.id = pr.wallet_id
       JOIN public.users AS u ON u.id = w.owner_id
       WHERE pr.wallet_id = $1
         AND w.id = $1
         AND u.id = $2
         AND u.role = 'farmer'
         AND u.approval_status = 'approved'
         AND w.account_type = 'farmer'
         AND w.simulated = TRUE
         AND w.currency = 'LKR'
       ORDER BY pr.created_at DESC, pr.id`,
      [wallet.id, farmerId],
    );

    return {
      payouts: assertRows(result).map((row) => ({
        ...mapPayout(row),
      })),
      remainingRequestable: toSafeCents(wallet.available_cents),
    };
  }

  return { getWallet, getTransactions, getSettlements, getSettlement, getPayouts, createPayout };
}

function mapSettlement(row) {
  return {
    id: String(row.settlement_id),
    orderId: row.order_id === null ? null : String(row.order_id),
    date: mapDate(row.date),
    grossAmount: null,
    platformFee: null,
    netPaid: null,
    journalAmount: toSafeCents(row.journal_amount_cents),
    status: 'confirmed',
    produce: row.produce === null ? null : String(row.produce),
    quantityKg: null,
  };
}

const databaseStore = createDatabaseStore(pool);
export default databaseStore;
