import pool from '../../config/db.js';
// YM17 · Nimesh De Alwis · Farmer allocations
// Task 01A: two read-only endpoints (allocation inbox list + summary cards).
// Every query is parameterised and scoped to req.user.id; no writes, no expiry side effects.

// Mirrors the allocations.status CHECK constraint in backend/database/schema.sql.
const ALLOCATION_STATUSES = Object.freeze([
  'held', 'supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted',
  'partially_accepted', 'disputed', 'resolved', 'declined', 'expired', 'cancelled',
]);

// Whitelisted sort keys. Values are static SQL fragments, never raw user input.
const SORTS = Object.freeze({
  newest: 'a.created_at DESC, a.id DESC',
  oldest: 'a.created_at ASC, a.id ASC',
  expiry: 'r.expires_at ASC NULLS LAST, a.created_at DESC, a.id DESC',
});

// Provisional only: the schema defines a 30 minute reservation window but no
// "expiring soon" rule. Requires product confirmation before release.
// Cards must be counted with the DB clock (now()), never the API server clock.
const EXPIRING_SOON_MINUTES = 10;

// Read-side "response eligibility" filters for GET /allocations. They only
// NARROW which rows are returned; they never write, never release and never
// expire anything (expiry transitions belong to the YM16 reservation worker).
// Each value mirrors an existing summary predicate exactly, so a filtered list
// and its summary card can never disagree:
//   pending  = held + live hold + deadline not passed  (= pendingResponses)
//   expiring = pending + deadline inside the window    (= expiringSoon)
//   expired  = stored 'expired' OR still `held` while a reservation exists
//              that is no longer live (released/expired/consumed) or whose
//              deadline has already passed. A held row with no reservation at
//              all is not "expired" — it simply has no hold and stays visible
//              under the unfiltered list. The stored status is reported
//              untouched: a held row stays status='held' in the DTO so the
//              client can distinguish the persisted state from its effective
//              response eligibility.
const ELIGIBILITY_FILTERS = Object.freeze(['pending', 'expiring', 'expired']);

// Read-side farmer-DECISION filter for GET /allocations (Inbox "Accepted" tab).
// A closed allowlist on its own parameter: `status` keeps its stored-status
// meaning and `eligibility` keeps its reservation-condition meaning, so
// neither is overloaded to express a decision.
const DECISION_FILTERS = Object.freeze(['accepted']);

// Genuine farmer acceptance for the Inbox Accepted tab (SRS FR-RES-04: a
// missing farmer response is never acceptance).
// - Authoritative evidence is the append-only audit event
//   `audit_logs.action = 'allocation.accepted'`; an operational status
//   (supplier_accepted, committed, picked_up, handed_over, accepted,
//   partially_accepted, resolved) is NEVER used as proof of acceptance.
// - Identical audit identification and semantics to Allocation History's
//   decision lateral (HISTORY_DECISION_LATERAL): target_type = 'allocation',
//   the two farmer decision actions, and the EARLIEST event wins
//   (occurred_at ASC, id ASC per DR-07), so an allocation that was declined
//   first is not silently re-counted as accepted later.
// - Written as a scalar subquery (at most one row, LIMIT 1) instead of a join
//   — the duplicate-safe equivalent of an EXISTS check — so duplicate audit
//   records can never multiply allocation rows or corrupt counts, pagination
//   or sorting. No decision event at all yields NULL, which never equals
//   'allocation.accepted'.
const FARMER_ACCEPTED_PREDICATE = `(
  SELECT al.action
    FROM audit_logs al
   WHERE al.target_type = 'allocation'
     AND al.target_id = a.id
     AND al.action IN ('allocation.accepted', 'allocation.declined')
   ORDER BY al.occurred_at ASC, al.id ASC
   LIMIT 1
) = 'allocation.accepted'`;

// Statuses that mean the allocation has progressed beyond `held` in fulfilment.
// Used ONLY by the dashboard summary card (the PROGRESSED ALLOCATIONS metric).
// KNOWN LIMITATION (documented, deliberately unchanged): an operational status
// is the allocation's CURRENT state, single-valued so it can be counted once,
// but it is not proof of a farmer decision — disputed/resolved are excluded
// because current state alone cannot prove acceptance either. The Inbox
// Accepted tab therefore never consults this list: it filters on the
// audit-backed FARMER_ACCEPTED_PREDICATE above.
const ACCEPTED_STATUSES = Object.freeze([
  'supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted', 'partially_accepted',
]);

// Highest OFFSET we will ever send to PostgreSQL. Keeps (page - 1) * limit far
// below the int64 boundary and inside Number.MAX_SAFE_INTEGER.
const MAX_OFFSET = 10_000_000;

const MAX_SEARCH_LENGTH = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shared FROM clause: every join is at most one row, so no allocation can duplicate.
// The lateral reservation pick prefers the authoritative active hold, then the most
// recent one, and always LIMIT 1 so the cardinality stays one.
const BASE_FROM = `
  FROM allocations a
  JOIN orders o ON o.id = a.order_id
  JOIN users u ON u.id = o.buyer_id
  JOIN harvest_batches hb ON hb.id = a.batch_id AND hb.farmer_id = a.farmer_id
  JOIN crops c ON c.id = hb.crop_id
  JOIN grades g ON g.id = hb.grade_id
  LEFT JOIN LATERAL (
    SELECT rr.status, rr.expires_at
    FROM reservations rr
    WHERE rr.allocation_id = a.id
    ORDER BY (rr.status = 'active') DESC, rr.created_at DESC
    LIMIT 1
  ) r ON true`;

/* --------------------- allocation history (Task 04B-1) ------------------- */

// History scope: every operational status EXCEPT the pending one. `held` rows
// stay in the inbox (a missing reservation never implies expired/cancelled),
// and this endpoint derives nothing from reservation state at all.
// Mirrors the allocations.status CHECK minus 'held'.
const HISTORY_STATUSES = Object.freeze([
  'supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted',
  'partially_accepted', 'declined', 'expired', 'cancelled', 'disputed', 'resolved',
]);

// History returns no hold column, so only creation-order sorts exist. Static
// fragments plus the id tiebreaker keep pagination deterministic.
const HISTORY_SORTS = Object.freeze({
  newest: 'a.created_at DESC, a.id DESC',
  oldest: 'a.created_at ASC, a.id ASC',
});

// Bounds the raw comma-separated status filter before it is split into tokens.
const MAX_STATUS_FILTER_LENGTH = 200;

// The farmer's ORIGINAL decision, read from the append-only audit trail only:
// - earliest event wins (audit_logs.occurred_at is the original timestamp per
//   DR-07; recorded_at is retry bookkeeping and is never selected),
// - LIMIT 1 keeps the join at exactly one row, so neither history rows nor the
//   summary counts can be multiplied by duplicate audit events,
// - a missing event stays NULL: never inferred from the current status, from
//   allocations.created_at or from allocations.decision_reason (FR-RES-04).
const HISTORY_DECISION_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT al.action, al.occurred_at, al.reason
      FROM audit_logs al
     WHERE al.target_type = 'allocation'
       AND al.target_id = a.id
       AND al.action IN ('allocation.accepted', 'allocation.declined')
     ORDER BY al.occurred_at ASC, al.id ASC
     LIMIT 1
  ) d ON true`;

// Exactly the tables the DTO needs. No reservations (holds are irrelevant once
// a row is history) and no wallet/payout/settlement tables: §16 keeps
// allocation, order and financial states separate.
const HISTORY_JOINS = `
  FROM allocations a
  JOIN orders o ON o.id = a.order_id
  JOIN users u ON u.id = o.buyer_id
  JOIN harvest_batches hb ON hb.id = a.batch_id AND hb.farmer_id = a.farmer_id
  JOIN crops c ON c.id = hb.crop_id
  JOIN grades g ON g.id = hb.grade_id`;

const HISTORY_FROM = `${HISTORY_JOINS}
  ${HISTORY_DECISION_LATERAL}`;

// The four summary cards read only allocations + the decision lateral, so they
// are independent of the table's search/status/sort/pagination filters.
const HISTORY_SUMMARY_FROM = `FROM allocations a
  ${HISTORY_DECISION_LATERAL}`;

// "declined, expired" -> ['declined','expired']: trimmed, empty tokens dropped,
// duplicates collapsed, every token validated against the history allowlist.
// 'held' is not in HISTORY_STATUSES, so it is rejected here with its own 400.
function readHistoryStatuses(raw) {
  const input = readOptionalString(raw);
  if (input.error) return { error: `status ${input.error}` };
  if (input.value === null) return { statuses: [] };
  if (input.value.length > MAX_STATUS_FILTER_LENGTH) return { error: 'status filter is too long' };
  const tokens = input.value.split(',').map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) return { statuses: [] }; // "?status= , ," behaves like omitted
  const unique = [...new Set(tokens)];
  for (const token of unique) {
    if (HISTORY_STATUSES.includes(token)) continue;
    if (token === 'held') {
      return { error: "status must not include 'held': pending allocations are not part of history" };
    }
    return { error: `status must be one of: ${HISTORY_STATUSES.join(', ')}` };
  }
  return { statuses: unique };
}

/* ----------------------------- small helpers ----------------------------- */

function badRequest(req, res, message) {
  return res.status(400).json({ error: message, requestId: req.requestId });
}

// Existing approved-account rule, reused by all three YM17 endpoints.
async function getApprovedFarmer(req) {
  const { rows } = await pool.query(
    'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
    [req.user.id, req.user.role, 'approved'],
  );
  return rows[0] || null;
}

function parsePositiveInt(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

// Empty/whitespace-only optional filters are treated exactly like an omitted
// filter, so "?status=" and no ?status behave identically. Non-string values
// (repeated params such as ?status=a&status=b) are still rejected.
// The frontend should prefer omitting unused filters entirely.
function readOptionalString(raw) {
  if (raw === undefined) return { value: null };
  if (typeof raw !== 'string') return { error: 'must be a single value' };
  const value = raw.trim();
  return { value: value === '' ? null : value };
}

// Makes user text a literal substring instead of letting % and _ act as wildcards.
function escapeLike(value) {
  return value.replace(/[!%_]/g, (char) => `!${char}`);
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

/* ------------------------------- endpoint 1 ------------------------------ */

function mapAllocationRow(row) {
  return {
    allocationId: row.id,
    orderId: row.order_id,
    buyerName: row.buyer_name,
    batchId: row.batch_id,
    // Public batch display reference when the platform has one (see
    // PROPOSALS.md); NULL is rendered as "no reference available". The
    // allocation/order operation keys are idempotency internals and are
    // deliberately never returned.
    batchDisplayId: row.batch_display_id ?? null,
    cropName: row.crop_name,
    gradeName: row.grade_name,
    agreedKg: row.agreed_kg,
    agreedUnitPriceCents: row.agreed_unit_price_cents,
    agreedValueCents: row.agreed_value_cents,
    status: row.status,
    reservationStatus: row.reservation_status ?? null,
    reservationExpiresAt: row.reservation_expires_at ? toIso(row.reservation_expires_at) : null,
    createdAt: toIso(row.created_at),
  };
}

export async function getAllocations(req, res, next) {
  try {
    const farmer = await getApprovedFarmer(req);
    if (!farmer) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

    // ---- validate query parameters (reject instead of silently coercing) ----
    const pageInput = readOptionalString(req.query.page);
    if (pageInput.error) return badRequest(req, res, `page ${pageInput.error}`);
    const page = pageInput.value === null ? 1 : parsePositiveInt(pageInput.value);
    if (page === null) return badRequest(req, res, 'page must be a positive integer');

    const limitInput = readOptionalString(req.query.limit);
    if (limitInput.error) return badRequest(req, res, `limit ${limitInput.error}`);
    const limit = limitInput.value === null ? 10 : parsePositiveInt(limitInput.value);
    if (limit === null || limit > 100) {
      return badRequest(req, res, 'limit must be a positive integer no greater than 100');
    }

    // Validate the offset arithmetic before any query runs: (page - 1) * limit
    // must be a safe non-negative integer, otherwise OFFSET could wrap silently
    // into a completely different (and wrong) page of results.
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
      return badRequest(req, res, 'page is too large for the requested limit');
    }

    const statusInput = readOptionalString(req.query.status);
    if (statusInput.error) return badRequest(req, res, `status ${statusInput.error}`);
    const status = statusInput.value;
    if (status !== null && !ALLOCATION_STATUSES.includes(status)) {
      return badRequest(req, res, `status must be one of: ${ALLOCATION_STATUSES.join(', ')}`);
    }

    const sortInput = readOptionalString(req.query.sort);
    if (sortInput.error) return badRequest(req, res, `sort ${sortInput.error}`);
    const sort = sortInput.value === null ? 'newest' : sortInput.value.toLowerCase();
    if (!SORTS[sort]) return badRequest(req, res, 'sort must be one of: newest, oldest, expiry');

    const searchInput = readOptionalString(req.query.search);
    if (searchInput.error) return badRequest(req, res, `search ${searchInput.error}`);
    const search = searchInput.value;
    if (search !== null && search.length > MAX_SEARCH_LENGTH) {
      return badRequest(req, res, `search must be at most ${MAX_SEARCH_LENGTH} characters`);
    }

    // Response-eligibility filter: a closed whitelist, rejected instead of
    // silently coerced. It composes with every other filter (AND semantics)
    // and is evaluated with the PostgreSQL clock, exactly like the summary.
    const eligibilityInput = readOptionalString(req.query.eligibility);
    if (eligibilityInput.error) return badRequest(req, res, `eligibility ${eligibilityInput.error}`);
    const eligibility = eligibilityInput.value;
    if (eligibility !== null && !ELIGIBILITY_FILTERS.includes(eligibility)) {
      return badRequest(req, res, `eligibility must be one of: ${ELIGIBILITY_FILTERS.join(', ')}`);
    }

    // Farmer-decision filter: a separate parameter with its own closed
    // allowlist, rejected instead of silently coerced (same treatment as
    // eligibility), so a decision can never be smuggled through `status` or
    // `eligibility`.
    const decisionInput = readOptionalString(req.query.decision);
    if (decisionInput.error) return badRequest(req, res, `decision ${decisionInput.error}`);
    const decision = decisionInput.value;
    if (decision !== null && !DECISION_FILTERS.includes(decision)) {
      return badRequest(req, res, `decision must be one of: ${DECISION_FILTERS.join(', ')}`);
    }

    // Crop filter is validated against the real crops table, by id or by name.
    let cropId = null;
    const cropInput = readOptionalString(req.query.crop);
    if (cropInput.error) return badRequest(req, res, `crop ${cropInput.error}`);
    if (cropInput.value !== null) {
      const crop = cropInput.value;
      if (crop.length > MAX_SEARCH_LENGTH) {
        return badRequest(req, res, 'crop must be an existing crop id or name');
      }
      const { rows } = await pool.query(
        UUID_PATTERN.test(crop)
          ? 'SELECT id FROM crops WHERE id = $1'
          : 'SELECT id FROM crops WHERE lower(name) = lower($1)',
        [crop],
      );
      if (!rows[0]) return badRequest(req, res, 'crop does not match an existing crop');
      cropId = rows[0].id;
    }

    // ---- build one WHERE clause shared by the list and the count ----
    const params = [req.user.id];
    let where = 'WHERE a.farmer_id = $1';
    if (status) {
      params.push(status);
      where += ` AND a.status = $${params.length}`;
    }
    if (cropId) {
      params.push(cropId);
      where += ` AND c.id = $${params.length}`;
    }
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      const index = params.length;
      where += ` AND (a.operation_key ILIKE $${index} ESCAPE '!'`
        + ` OR a.id::text ILIKE $${index} ESCAPE '!'`
        + ` OR u.name ILIKE $${index} ESCAPE '!'`
        + ` OR c.name ILIKE $${index} ESCAPE '!')`;
    }
    // Effective-response eligibility (read-only). `r` is the single row the
    // BASE_FROM lateral already picked (active hold preferred, then newest),
    // so these predicates agree with the summary's active-only lateral.
    if (eligibility === 'pending') {
      where += ` AND a.status = 'held' AND r.status = 'active' AND r.expires_at > now()`;
    } else if (eligibility === 'expiring') {
      params.push(EXPIRING_SOON_MINUTES);
      where += ` AND a.status = 'held' AND r.status = 'active' AND r.expires_at > now()`
        + ` AND r.expires_at <= now() + make_interval(mins => $${params.length})`;
    } else if (eligibility === 'expired') {
      where += ` AND (a.status = 'expired'`
        + ` OR (a.status = 'held' AND r.status IS NOT NULL`
        + ` AND (r.status IS DISTINCT FROM 'active' OR r.expires_at <= now())))`;
    }
    // Genuine farmer decision (audit-backed). AND semantics with every other
    // filter — the same composition rule eligibility uses — applied to the
    // single WHERE shared by the count and the page, so counts, pagination and
    // the DTO (operation keys still never selected) behave exactly as before.
    if (decision === 'accepted') {
      where += ` AND ${FARMER_ACCEPTED_PREDICATE}`;
    }

    const { rows: countRows } = await pool.query(
      `SELECT count(*) AS total ${BASE_FROM} ${where}`,
      params,
    );
    const total = Number(countRows[0].total);

    params.push(limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const { rows } = await pool.query(
      `SELECT
         a.id,
         a.order_id,
         u.name AS buyer_name,
         a.batch_id,
         to_jsonb(hb)->>'display_id' AS batch_display_id,
         c.name AS crop_name,
         g.name AS grade_name,
         a.agreed_kg,
         a.agreed_unit_price_cents,
         a.agreed_value_cents,
         a.status,
         a.created_at,
         r.status AS reservation_status,
         r.expires_at AS reservation_expires_at
       ${BASE_FROM}
       ${where}
       ORDER BY ${SORTS[sort]}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params,
    );

    return res.json({
      allocations: rows.map(mapAllocationRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------- endpoint 2 ------------------------------ */

export async function getSummary(req, res, next) {
  try {
    const farmer = await getApprovedFarmer(req);
    if (!farmer) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

    // One pass over the farmer's allocations; FILTER keeps each card a single
    // count and guarantees an allocation can never be counted twice per card.
    // The lateral subquery only ever returns an ACTIVE reservation, so a
    // non-null r.expires_at means "has an active hold".
    //   pending    = held AND that active hold has not expired yet
    //   expiring   = pending AND the hold expires within the 10 minute window
    //                (strictly in the future, so overdue/past holds are excluded)
    //   accepted   = accepted-status set only, per the limitation noted above
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE a.status = 'held'
             AND r.expires_at IS NOT NULL
             AND r.expires_at > now()
         ) AS pending_responses,
         COUNT(*) FILTER (WHERE a.status IN ('${ACCEPTED_STATUSES.join("', '")}')) AS accepted_allocations,
         COUNT(*) FILTER (WHERE a.status = 'declined') AS declined_allocations,
         COUNT(*) FILTER (
           WHERE a.status = 'held'
             AND r.expires_at IS NOT NULL
             AND r.expires_at > now()
             AND r.expires_at <= now() + make_interval(mins => $2::int)
         ) AS expiring_soon
       FROM allocations a
       LEFT JOIN LATERAL (
         SELECT rr.expires_at
         FROM reservations rr
         WHERE rr.allocation_id = a.id AND rr.status = 'active'
         LIMIT 1
       ) r ON true
       WHERE a.farmer_id = $1`,
      [req.user.id, EXPIRING_SOON_MINUTES],
    );

    const row = rows[0];
    return res.json({
      summary: {
        pendingResponses: Number(row.pending_responses),
        acceptedAllocations: Number(row.accepted_allocations),
        declinedAllocations: Number(row.declined_allocations),
        expiringSoon: Number(row.expiring_soon),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/* ---------------------------- history endpoint --------------------------- */

// DTO mapper for GET /allocations/history. The two status dimensions stay
// separate: farmerDecision comes only from the audit event, operationalStatus
// is the untouched current allocations.status. NUMERIC/BIGINT stay strings
// (no arithmetic here), timestamps are ISO instants.
function mapHistoryRow(row) {
  return {
    allocationId: row.id,
    orderId: row.order_id,
    buyerName: row.buyer_name,
    batchId: row.batch_id,
    batchDisplayId: row.batch_display_id ?? null,
    cropName: row.crop_name,
    gradeName: row.grade_name,
    agreedKg: row.agreed_kg,
    agreedUnitPriceCents: row.agreed_unit_price_cents,
    agreedValueCents: row.agreed_value_cents,
    farmerDecision:
      row.decision_action === 'allocation.accepted'
        ? 'accepted'
        : row.decision_action === 'allocation.declined'
          ? 'declined'
          : null,
    farmerDecisionAt: row.decision_at ? toIso(row.decision_at) : null,
    farmerDecisionReason: row.audit_reason ?? null,
    operationalStatus: row.operational_status,
    orderStatus: row.order_status,
    createdAt: toIso(row.created_at),
  };
}

/**
 * Task 04B-1: read-only Farmer Allocation History.
 *
 * Selection: a.farmer_id = caller AND a.status <> 'held'. Ownership comes
 * from req.user.id only (never from a query parameter), a missing reservation
 * never implies expired/cancelled, and legacy rows without audit events are
 * still returned with null decision fields.
 *
 * Three parameterised reads, no writes:
 *   1. summary cards   - farmer scope only, independent of every table filter;
 *                        accepted/declined come from EXISTS-style audit facts
 *                        via the LIMIT-1 lateral (no duplicate counting),
 *                        expired from the operational status.
 *   2. filtered count  - same WHERE as the page, no audit join at all.
 *   3. the page itself - joins only what the DTO needs; never reservations,
 *                        wallets, payouts or settlement data.
 */
export async function getAllocationHistory(req, res, next) {
  try {
    // Same approved-account gate as every other YM17 endpoint.
    const farmer = await getApprovedFarmer(req);
    if (!farmer) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

    // ---- validate query parameters (reject instead of silently coercing) ----
    const pageInput = readOptionalString(req.query.page);
    if (pageInput.error) return badRequest(req, res, `page ${pageInput.error}`);
    const page = pageInput.value === null ? 1 : parsePositiveInt(pageInput.value);
    if (page === null) return badRequest(req, res, 'page must be a positive integer');

    const limitInput = readOptionalString(req.query.limit);
    if (limitInput.error) return badRequest(req, res, `limit ${limitInput.error}`);
    const limit = limitInput.value === null ? 10 : parsePositiveInt(limitInput.value);
    if (limit === null || limit > 100) {
      return badRequest(req, res, 'limit must be a positive integer no greater than 100');
    }

    // Validate the offset arithmetic before any query runs (same guard as the
    // inbox): (page - 1) * limit must stay a safe non-negative integer.
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
      return badRequest(req, res, 'page is too large for the requested limit');
    }

    const statusResult = readHistoryStatuses(req.query.status);
    if (statusResult.error) return badRequest(req, res, statusResult.error);
    const statuses = statusResult.statuses;

    const sortInput = readOptionalString(req.query.sort);
    if (sortInput.error) return badRequest(req, res, `sort ${sortInput.error}`);
    const sort = sortInput.value === null ? 'newest' : sortInput.value.toLowerCase();
    if (!HISTORY_SORTS[sort]) return badRequest(req, res, 'sort must be one of: newest, oldest');

    const searchInput = readOptionalString(req.query.search);
    if (searchInput.error) return badRequest(req, res, `search ${searchInput.error}`);
    const search = searchInput.value;
    if (search !== null && search.length > MAX_SEARCH_LENGTH) {
      return badRequest(req, res, `search must be at most ${MAX_SEARCH_LENGTH} characters`);
    }

    // ---- 1. summary cards: farmer scope only, never filtered ----
    // The lateral returns at most one decision event (LIMIT 1), so accepted and
    // declined can never double-count, and a row can only fall in one of them.
    // total counts every non-held row; expired is an operational outcome only.
    const { rows: summaryRows } = await pool.query(
      `SELECT
         COUNT(*) AS total_historical,
         COUNT(*) FILTER (WHERE d.action = 'allocation.accepted') AS accepted,
         COUNT(*) FILTER (WHERE d.action = 'allocation.declined') AS declined,
         COUNT(*) FILTER (WHERE a.status = 'expired') AS expired
       ${HISTORY_SUMMARY_FROM}
       WHERE a.farmer_id = $1 AND a.status <> 'held'`,
      [req.user.id],
    );
    const summary = summaryRows[0];

    // ---- shared WHERE: ownership is always $1, scope predicate always present ----
    const params = [req.user.id];
    let where = "WHERE a.farmer_id = $1 AND a.status <> 'held'";
    if (statuses.length > 0) {
      params.push(statuses);
      where += ` AND a.status = ANY($${params.length}::text[])`;
    }
    if (search) {
      // escapeLike makes % and _ literal, so the user's text cannot widen the match.
      params.push(`%${escapeLike(search)}%`);
      const index = params.length;
      where += ` AND (a.operation_key ILIKE $${index} ESCAPE '!'`
        + ` OR a.id::text ILIKE $${index} ESCAPE '!'`
        + ` OR u.name ILIKE $${index} ESCAPE '!'`
        + ` OR c.name ILIKE $${index} ESCAPE '!')`;
    }

    // ---- 2. filtered count (no audit join: counting cannot multiply) ----
    const { rows: countRows } = await pool.query(
      `SELECT count(*) AS total ${HISTORY_JOINS} ${where}`,
      params,
    );
    const total = Number(countRows[0].total);

    params.push(limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    // ---- 3. the requested page ----
    const { rows } = await pool.query(
      `SELECT
         a.id,
         a.order_id,
         u.name AS buyer_name,
         a.batch_id,
         to_jsonb(hb)->>'display_id' AS batch_display_id,
         c.name AS crop_name,
         g.name AS grade_name,
         a.agreed_kg,
         a.agreed_unit_price_cents,
         a.agreed_value_cents,
         a.status AS operational_status,
         o.status AS order_status,
         a.created_at,
         d.action AS decision_action,
         d.occurred_at AS decision_at,
         d.reason AS audit_reason
       ${HISTORY_FROM}
       ${where}
       ORDER BY ${HISTORY_SORTS[sort]}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params,
    );

    return res.json({
      allocations: rows.map(mapHistoryRow),
      summary: {
        totalHistoricalAllocations: Number(summary.total_historical),
        accepted: Number(summary.accepted),
        declined: Number(summary.declined),
        expired: Number(summary.expired),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------- endpoint 3 ------------------------------ */

// Task 02A: read-only Allocation Details for ONE allocation.
// Ownership is enforced inside the query itself (a.farmer_id = caller), so a
// missing id and someone else's id are indistinguishable to the caller (404).
// No writes, no expiry side effects: nothing here updates reservations,
// allocations, stock, orders or wallets, and no operation_key is ever returned.
//
// The lateral reservation pick is identical to BASE_FROM in the inbox list:
// it prefers the authoritative active hold, then the most recent one, and
// LIMIT 1 keeps the cardinality at exactly one row even when an allocation has
// several historical reservations.
const DETAIL_FROM = `
  FROM allocations a
  JOIN orders o ON o.id = a.order_id
  JOIN users u ON u.id = o.buyer_id
  JOIN harvest_batches hb ON hb.id = a.batch_id AND hb.farmer_id = a.farmer_id
  JOIN farms f ON f.id = hb.farm_id AND f.farmer_id = hb.farmer_id
  JOIN crops c ON c.id = hb.crop_id
  JOIN grades g ON g.id = hb.grade_id
  LEFT JOIN LATERAL (
    SELECT rr.status, rr.expires_at, rr.held_kg
    FROM reservations rr
    WHERE rr.allocation_id = a.id
    ORDER BY (rr.status = 'active') DESC, rr.created_at DESC
    LIMIT 1
  ) r ON true`;

// Eligibility is evaluated with the PostgreSQL clock (now()), never the API
// server clock, so the indicator cannot drift from the expiry worker. This is
// informational only: the future decision endpoint MUST revalidate every
// condition inside its own transaction before changing anything.
const ELIGIBILITY_SELECT = `
  (a.status = 'held' AND r.status = 'active' AND r.expires_at > now()) AS can_respond,
  CASE
    WHEN a.status <> 'held'
      THEN 'This allocation is no longer awaiting your response (status: ' || a.status || ').'
    WHEN r.status IS NULL OR r.expires_at IS NULL
      THEN 'No reservation is attached to this allocation.'
    WHEN r.status <> 'active'
      THEN 'The reservation for this allocation is ' || r.status || '.'
    WHEN r.expires_at <= now()
      THEN 'The reservation for this allocation has expired.'
    ELSE NULL
  END AS response_unavailable_reason`;

function mapAllocationDetailRow(row) {
  return {
    allocationId: row.id,
    orderId: row.order_id,
    batchId: row.batch_id,
    batchDisplayId: row.batch_display_id ?? null,
    buyerName: row.buyer_name,
    cropName: row.crop_name,
    gradeName: row.grade_name,
    farmName: row.farm_name,
    farmDistrict: row.farm_district,
    agreedKg: row.agreed_kg,
    agreedUnitPriceCents: row.agreed_unit_price_cents,
    agreedValueCents: row.agreed_value_cents,
    status: row.status,
    decisionReason: row.decision_reason ?? null,
    reservationStatus: row.reservation_status ?? null,
    reservationExpiresAt: row.reservation_expires_at ? toIso(row.reservation_expires_at) : null,
    reservationHeldKg: row.reservation_held_kg ?? null,
    orderStatus: row.order_status,
    orderDeliveryDate: row.order_delivery_date,
    orderDestinationDistrict: row.order_destination_district,
    createdAt: toIso(row.created_at),
    canRespond: row.can_respond === true,
    responseUnavailableReason: row.response_unavailable_reason ?? null,
  };
}

/**
 * Shared detail read used by GET /allocations/:allocationId and by the decline
 * response. Always scoped to the owning farmer; returns undefined when the
 * allocation is missing or belongs to someone else.
 */
async function loadAllocationDetail(allocationId, farmerId) {
  const { rows } = await pool.query(
    `SELECT
       a.id,
       a.order_id,
       a.batch_id,
       to_jsonb(hb)->>'display_id' AS batch_display_id,
       u.name AS buyer_name,
       c.name AS crop_name,
       g.name AS grade_name,
       f.name AS farm_name,
       f.district AS farm_district,
       a.agreed_kg,
       a.agreed_unit_price_cents,
       a.agreed_value_cents,
       a.status,
       a.decision_reason,
       a.created_at,
       o.status AS order_status,
       o.delivery_date AS order_delivery_date,
       o.destination_district AS order_destination_district,
       r.status AS reservation_status,
       r.expires_at AS reservation_expires_at,
       r.held_kg AS reservation_held_kg,
       ${ELIGIBILITY_SELECT}
     ${DETAIL_FROM}
     WHERE a.id = $1 AND a.farmer_id = $2
     LIMIT 1`,
    [allocationId, farmerId],
  );
  return rows[0];
}

export async function getAllocationDetails(req, res, next) {
  try {
    // Malformed ids are rejected before any query reaches PostgreSQL, so a
    // typo can never be mistaken for "not found".
    const { allocationId } = req.params;
    if (typeof allocationId !== 'string' || !UUID_PATTERN.test(allocationId)) {
      return badRequest(req, res, 'allocationId must be a valid UUID');
    }

    // Same approved-account gate as the inbox, summary and status endpoints.
    const farmer = await getApprovedFarmer(req);
    if (!farmer) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

    const row = await loadAllocationDetail(allocationId, req.user.id);
    // Missing and not-owned are the same answer: the caller learns nothing
    // about whether an allocation with that id exists for anyone else.
    if (!row) return res.status(404).json({ error: 'Allocation not found', requestId: req.requestId });

    return res.json({
      allocation: mapAllocationDetailRow(row),
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------- endpoint 4 ------------------------------ */

// Task 03B-1: farmer decline. One transaction moves BOTH the allocation
// (held -> declined) and its live hold (active -> released), so the two can
// never disagree. Nothing else is touched: no order status, no stock figure,
// no wallet value, no other module.
//
// The transition itself is guarded twice: the allocation row is locked with
// FOR UPDATE before anything is read, and both UPDATEs are conditional on the
// expected current state, so a duplicate decision or a double release affects
// 0 rows and is answered with 409 instead of writing again.
const MAX_REASON_LENGTH = 500;

/** Body check: reason is required, a single trimmed string of 1..500 chars. */
function readDecisionReason(body) {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'reason is required' };
  }
  if (typeof body.reason !== 'string') return { error: 'reason is required' };
  const value = body.reason.trim();
  if (value.length < 1 || value.length > MAX_REASON_LENGTH) {
    return { error: `reason must be between 1 and ${MAX_REASON_LENGTH} characters` };
  }
  return { value };
}

/** req.requestId is a server-generated UUID; only then may it be audit FK data. */
function safeRequestId(requestId) {
  return typeof requestId === 'string' && UUID_PATTERN.test(requestId) ? requestId : null;
}

function conflict(req, res, message, status) {
  return res.status(409).json({ error: message, status, requestId: req.requestId });
}

export async function declineAllocation(req, res, next) {
  // ---- input validation (400) before any database work ----
  const { allocationId } = req.params;
  if (typeof allocationId !== 'string' || !UUID_PATTERN.test(allocationId)) {
    return badRequest(req, res, 'allocationId must be a valid UUID');
  }
  const reasonInput = readDecisionReason(req.body);
  if (reasonInput.error) return badRequest(req, res, reasonInput.error);
  const reason = reasonInput.value;

  // Same approved-account gate as the three read endpoints.
  let farmer;
  try {
    farmer = await getApprovedFarmer(req);
  } catch (error) {
    return next(error);
  }
  if (!farmer) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ownership + row lock. Missing and not-owned are both 404.
    const { rows: allocationRows } = await client.query(
      'SELECT id, status FROM allocations WHERE id = $1 AND farmer_id = $2 FOR UPDATE',
      [allocationId, req.user.id],
    );
    const allocation = allocationRows[0];
    if (!allocation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Allocation not found', requestId: req.requestId });
    }

    // 2. Already decided (or moved on) -> no second write.
    if (allocation.status !== 'held') {
      await client.query('ROLLBACK');
      return conflict(req, res, 'This allocation has already been decided', allocation.status);
    }

    // 3. The live hold, locked, with expiry judged by the PostgreSQL clock.
    const { rows: reservationRows } = await client.query(
      `SELECT id, status, expires_at, (expires_at > now()) AS unexpired
         FROM reservations
        WHERE allocation_id = $1 AND status = 'active'
        FOR UPDATE`,
      [allocationId],
    );
    const reservation = reservationRows[0];
    if (!reservation) {
      await client.query('ROLLBACK');
      return conflict(req, res, 'No active reservation is attached to this allocation', allocation.status);
    }
    if (reservation.unexpired !== true) {
      await client.query('ROLLBACK');
      return conflict(req, res, 'The reservation for this allocation has expired', allocation.status);
    }

    // 4. held -> declined, only if it is still held (duplicate guard).
    const { rowCount: allocationUpdated } = await client.query(
      `UPDATE allocations
          SET status = 'declined', decision_reason = $2
        WHERE id = $1 AND status = 'held'`,
      [allocationId, reason],
    );
    if (allocationUpdated !== 1) {
      await client.query('ROLLBACK');
      return conflict(req, res, 'This allocation has already been decided', allocation.status);
    }

    // 5. active -> released + terminal_at (the schema CHECK requires it),
    //    only if the hold is still active (double-release guard).
    const { rowCount: reservationReleased } = await client.query(
      `UPDATE reservations
          SET status = 'released', terminal_at = now()
        WHERE allocation_id = $1 AND status = 'active'`,
      [allocationId],
    );
    if (reservationReleased !== 1) {
      await client.query('ROLLBACK');
      return conflict(req, res, 'The reservation for this allocation could not be released', allocation.status);
    }

    // 6. Append-only decision trail: actor, action, ids, request id, reason and
    //    only the status changes. No contacts, credentials, keys or money.
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
       VALUES ($1, 'allocation.declined', 'allocation', $2, $3, $4, $5::jsonb)`,
      [
        req.user.id,
        allocationId,
        safeRequestId(req.requestId),
        reason,
        JSON.stringify({
          allocation: { status: { from: 'held', to: 'declined' } },
          reservation: { status: { from: 'active', to: 'released' } },
        }),
      ],
    );

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Connection already gone; the pool discards it.
    }
    return next(error);
  } finally {
    client.release();
  }

  // Committed: answer with the same detail shape as GET /allocations/:id.
  try {
    const row = await loadAllocationDetail(allocationId, req.user.id);
    if (!row) return res.status(404).json({ error: 'Allocation not found', requestId: req.requestId });
    return res.json({ allocation: mapAllocationDetailRow(row), requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------- endpoint 5 ------------------------------ */

// Task 03B-2: farmer accept. Same guards, lock order and transaction shape as
// decline, with one SRS-critical difference: the live hold STAYS ACTIVE.
// Acceptance only moves the allocation (held -> supplier_accepted); the
// reservation is deliberately never written here (not consumed, released or
// expired), so the stock stays protected until the buyer confirmation
// workflow decides its fate. No order, stock or wallet statement runs either.
export async function acceptAllocation(req, res, next) {
  // Malformed ids are rejected before any query reaches PostgreSQL.
  const { allocationId } = req.params;
  if (typeof allocationId !== 'string' || !UUID_PATTERN.test(allocationId)) {
    return badRequest(req, res, 'allocationId must be a valid UUID');
  }
  // Accept takes no request body; nothing to validate.

  // Same approved-account gate as the read endpoints and decline.
  let farmer;
  try {
    farmer = await getApprovedFarmer(req);
  } catch (error) {
    return next(error);
  }
  if (!farmer) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ownership + row lock (consistent order: allocation, then reservation).
    const { rows: allocationRows } = await client.query(
      'SELECT id, status FROM allocations WHERE id = $1 AND farmer_id = $2 FOR UPDATE',
      [allocationId, req.user.id],
    );
    const allocation = allocationRows[0];
    if (!allocation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Allocation not found', requestId: req.requestId });
    }

    // 2. Already decided (accepted, declined, expired…) -> no second write.
    if (allocation.status !== 'held') {
      await client.query('ROLLBACK');
      return conflict(req, res, 'This allocation has already been decided', allocation.status);
    }

    // 3. The live hold, locked, expiry judged by the PostgreSQL clock.
    const { rows: reservationRows } = await client.query(
      `SELECT id, status, expires_at, (expires_at > now()) AS unexpired
         FROM reservations
        WHERE allocation_id = $1 AND status = 'active'
        FOR UPDATE`,
      [allocationId],
    );
    const reservation = reservationRows[0];
    if (!reservation) {
      await client.query('ROLLBACK');
      return conflict(req, res, 'No active reservation is attached to this allocation', allocation.status);
    }
    if (reservation.unexpired !== true) {
      await client.query('ROLLBACK');
      return conflict(req, res, 'The reservation for this allocation has expired', allocation.status);
    }

    // 4. held -> supplier_accepted, only while it is still held (duplicate and
    //    conflicting-decision guard). Any stale decision_reason is cleared.
    const { rowCount: allocationUpdated } = await client.query(
      `UPDATE allocations
          SET status = 'supplier_accepted', decision_reason = NULL
        WHERE id = $1 AND status = 'held'`,
      [allocationId],
    );
    if (allocationUpdated !== 1) {
      await client.query('ROLLBACK');
      return conflict(req, res, 'This allocation has already been decided', allocation.status);
    }

    // 5. SRS rule: the reservation row is NOT updated. It stays `active` so
    //    batch_availability keeps deducting the held kg (schema.sql:507).

    // 6. Append-only acceptance trail: actor, action, ids, request id and only
    //    the status change. No contacts, credentials, keys or money.
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
       VALUES ($1, 'allocation.accepted', 'allocation', $2, $3, NULL, $4::jsonb)`,
      [
        req.user.id,
        allocationId,
        safeRequestId(req.requestId),
        JSON.stringify({
          allocation: { status: { from: 'held', to: 'supplier_accepted' } },
          reservation: { status: 'active', action: 'preserved' },
        }),
      ],
    );

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Connection already gone; the pool discards it.
    }
    return next(error);
  } finally {
    client.release();
  }

  // Committed: answer with the same detail shape as GET /allocations/:id.
  try {
    const row = await loadAllocationDetail(allocationId, req.user.id);
    if (!row) return res.status(404).json({ error: 'Allocation not found', requestId: req.requestId });
    return res.json({ allocation: mapAllocationDetailRow(row), requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
}

/* -------------------------------- status --------------------------------- */

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const user = await getApprovedFarmer(req);
    if (!user) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM17', owner: 'Nimesh De Alwis', status: 'scaffold', user, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}
