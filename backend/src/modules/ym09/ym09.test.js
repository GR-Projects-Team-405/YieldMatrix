import test from 'node:test';
import assert from 'node:assert/strict';

import ym09Router from './routes.js';
import * as defaultController from './controller.js';
import { createYm09Controller } from './controller.js';
import { createYm09Service } from './ym09.service.js';
import { createYm09Repository } from './ym09.repository.js';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  AUDIT_ACTION_IMAGE_DELETE,
  AUDIT_ACTION_IMAGE_UPDATE,
  LISTING_STATUS,
  VALID_LISTING_STATUSES,
  VALID_LISTING_TRANSITIONS,
  createBadGatewayError,
  createServiceUnavailableError,
} from './ym09.constants.js';
import { createYm09CloudinaryStorage } from './ym09.cloudinary.js';
import {
  buildListingCloudinaryPublicId,
  validateCreateListingPayload,
  validateDateRange,
  validateImageConfirmPayload,
  validateImageUploadRequestPayload,
  validateKgQuantity,
  validateListQueryParams,
  validateListingId,
  validatePositiveIntegerCents,
  validateUpdateListingPayload,
} from './ym09.validation.js';
import {
  SQL_FIND_BATCH_ENCUMBRANCE,
  SQL_FIND_BATCH_ENCUMBRANCE_FOR_REASSIGN,
  SQL_FIND_LISTING_BY_ID,
  SQL_FIND_LISTING_BY_ID_NO_IMAGE,
  SQL_FIND_LISTING_DETAILS_HEADER,
  SQL_FIND_LISTING_DETAILS_HEADER_NO_IMAGE,
  SQL_FIND_LISTING_OWNER_STATUS_NO_IMAGE,
  SQL_FIND_LISTINGS_BY_FARMER,
  SQL_FIND_LISTINGS_BY_FARMER_NO_IMAGE,
  SQL_LOCK_LISTING_FOR_UPDATE_NO_IMAGE,
  SQL_UPDATE_LISTING_IN_PLACE_NO_IMAGE,
  SQL_UPDATE_LISTING_STATUS_NO_IMAGE,
  buildEncumberedKgCaseSql,
} from './ym09.sql.js';

const FARMER_A_ID = '11111111-1111-1111-1111-111111111111';
const FARMER_PENDING_ID = '22222222-2222-4222-8222-222222222222';
const FARMER_SUSPENDED_ID = '33333333-3333-4333-8333-333333333333';
const FARMER_B_ID = '99999999-9999-4999-8999-999999999999';
const BUYER_USER_ID = '44444444-4444-4444-8444-444444444444';

const LISTING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LISTING_B_ID = 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BATCH_A_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BATCH_B_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BATCH_OTHER_FARMER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const FARM_A_ID = 'f1111111-1111-1111-1111-111111111111';
const FARM_B_ID = 'f9999999-9999-4999-8999-999999999999';
const REQUEST_ID = 'req-test-123';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

/**
 * In-memory relational simulator mirroring schema.sql & ym09.sql.js semantics
 * so all GET/PUT handlers execute realistic queries, stock math, row locks, and rollbacks.
 */
function createStatefulMockDb({
  users,
  farms,
  batches,
  listings,
  allocations = [],
  orders = [],
  auditLogs = [],
}) {
  const state = {
    users: structuredClone(users),
    farms: structuredClone(farms),
    batches: structuredClone(batches),
    listings: structuredClone(listings),
    allocations: structuredClone(allocations),
    orders: structuredClone(orders),
    auditLogs: structuredClone(auditLogs),
  };

  function computeBatchStockFromAllocations(batchId) {
    let reservedKg = 0;
    let committedKg = 0;
    let disputedCount = 0;

    for (const al of state.allocations) {
      if (al.batch_id !== batchId) continue;

      if (al.status === 'held' || al.status === 'supplier_accepted') {
        reservedKg += Number(al.agreed_kg);
      } else if (al.status === 'committed') {
        const uncollected = Math.max(0, Number(al.committed_kg) - Number(al.picked_up_kg || 0));
        reservedKg += uncollected;
        committedKg += uncollected;
      } else if (al.status === 'disputed') {
        const uncollected = Math.max(0, Number(al.committed_kg) - Number(al.picked_up_kg || 0));
        reservedKg += uncollected;
        disputedCount += 1;
      }
      // picked_up, handed_over, accepted, partially_accepted, resolved, declined, expired, cancelled => 0
    }

    return { reservedKg, committedKg, disputedCount };
  }

  function executeQuery(sql, params = [], dbState = state, trace = []) {
    // 1. Approved farmer lookup
    if (sql.includes('FROM users') && sql.includes('approval_status = $3')) {
      const [id, role, approvalStatus] = params;
      const found = dbState.users.find(
        (u) => u.id === id && u.role === role && u.approval_status === approvalStatus
      );
      return { rows: found ? [{ ...found }] : [] };
    }

    // 2. GET /produce
    if (sql.includes('ORDER BY l.created_at DESC') && sql.includes('WHERE hb.farmer_id = $1')) {
      const [farmerId] = params;
      const rows = dbState.listings
        .map((l) => {
          const hb = dbState.batches.find((b) => b.id === l.batch_id);
          if (!hb || hb.farmer_id !== farmerId) return null;
          const farm = dbState.farms.find((f) => f.id === hb.farm_id);
          const { reservedKg, committedKg } = computeBatchStockFromAllocations(l.batch_id);
          return {
            id: l.id,
            batchId: l.batch_id,
            offeredKg: String(l.offered_kg),
            unitPriceCents: String(l.unit_price_cents),
            validFrom: l.valid_from,
            validUntil: l.valid_until,
            status: l.status,
            imageKey: l.image_key ?? null,
            createdAt: l.created_at,
            cropName: hb.crop_name,
            gradeName: hb.grade_name,
            farmName: farm.name,
            farmId: farm.id,
            district: farm.district,
            reservedKg: String(reservedKg),
            committedKg: String(committedKg),
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { rows };
    }

    // 3. GET /produce/:id/details header (must match before GET /produce/:id)
    if (sql.includes('hb.sellable_kg AS "sellableKg"')) {
      const [listingId, farmerId] = params;
      const l = dbState.listings.find((item) => item.id === listingId);
      const hb = l ? dbState.batches.find((b) => b.id === l.batch_id) : null;
      if (!l || !hb || hb.farmer_id !== farmerId) return { rows: [] };
      const farm = dbState.farms.find((f) => f.id === hb.farm_id);
      const { reservedKg, committedKg } = computeBatchStockFromAllocations(l.batch_id);
      return {
        rows: [
          {
            id: l.id,
            batchId: l.batch_id,
            offeredKg: String(l.offered_kg),
            unitPriceCents: String(l.unit_price_cents),
            validFrom: l.valid_from,
            validUntil: l.valid_until,
            status: l.status,
            imageKey: l.image_key ?? null,
            createdAt: l.created_at,
            cropName: hb.crop_name,
            gradeName: hb.grade_name,
            farmName: farm.name,
            farmId: farm.id,
            district: farm.district,
            farmerId: hb.farmer_id,
            batchNumber: `HB-${hb.id.slice(0, 8).toUpperCase()}`,
            actualKg: String(hb.actual_kg),
            sellableKg: String(hb.sellable_kg),
            reservedKg: String(reservedKg),
            committedKg: String(committedKg),
          },
        ],
      };
    }

    // 4. GET /produce/:id
    if (sql.includes('WHERE l.id = $1 AND hb.farmer_id = $2')) {
      const [listingId, farmerId] = params;
      const l = dbState.listings.find((item) => item.id === listingId);
      const hb = l ? dbState.batches.find((b) => b.id === l.batch_id) : null;
      if (!l || !hb || hb.farmer_id !== farmerId) return { rows: [] };
      const farm = dbState.farms.find((f) => f.id === hb.farm_id);
      const { reservedKg, committedKg } = computeBatchStockFromAllocations(l.batch_id);
      return {
        rows: [
          {
            id: l.id,
            batchId: l.batch_id,
            offeredKg: String(l.offered_kg),
            unitPriceCents: String(l.unit_price_cents),
            validFrom: l.valid_from,
            validUntil: l.valid_until,
            status: l.status,
            imageKey: l.image_key ?? null,
            createdAt: l.created_at,
            cropName: hb.crop_name,
            gradeName: hb.grade_name,
            farmName: farm.name,
            farmId: farm.id,
            district: farm.district,
            farmerId: hb.farmer_id,
            batchNumber: `HB-${hb.id.slice(0, 8).toUpperCase()}`,
            actualKg: String(hb.actual_kg),
            sellableKg: String(hb.sellable_kg),
            reservedKg: String(reservedKg),
            committedKg: String(committedKg),
          },
        ],
      };
    }

    // 5. Listing allocations
    if (sql.includes('AS "allocatedKg"')) {
      const [batchId, farmerId, createdAt, validUntil] = params;
      const startMs = new Date(createdAt).getTime();
      const endMs = new Date(validUntil).getTime();
      const rows = dbState.allocations
        .filter((a) => {
          const t = new Date(a.created_at).getTime();
          return a.batch_id === batchId && a.farmer_id === farmerId && t >= startMs && t <= endMs;
        })
        .map((a) => ({
          id: a.id,
          orderId: a.order_id,
          allocatedKg: String(a.agreed_kg),
          agreedUnitPriceCents: String(a.agreed_unit_price_cents),
          agreedValueCents: String(Math.round(Number(a.agreed_kg) * Number(a.agreed_unit_price_cents))),
          status: a.status,
          allocatedOn: a.created_at,
          buyerName: a.buyer_name || 'Verified Buyer',
        }));
      return { rows };
    }

    // 6. Listing orders
    if (sql.includes('AS "orderKg"')) {
      const [batchId, farmerId, createdAt, validUntil] = params;
      const startMs = new Date(createdAt).getTime();
      const endMs = new Date(validUntil).getTime();
      const rows = [];
      for (const a of dbState.allocations) {
        const t = new Date(a.created_at).getTime();
        if (a.batch_id === batchId && a.farmer_id === farmerId && t >= startMs && t <= endMs) {
          const ord = dbState.orders.find((o) => o.id === a.order_id);
          if (ord) {
            rows.push({
              id: ord.id,
              orderDate: ord.created_at,
              status: ord.status,
              allocationValueCents: String(
                Math.round(Number(a.agreed_kg) * Number(a.agreed_unit_price_cents))
              ),
              orderKg: String(a.agreed_kg),
              buyerName: a.buyer_name || 'Verified Buyer',
            });
          }
        }
      }
      return { rows };
    }

    // 7. Listing audit logs
    if (sql.includes('FROM audit_logs al')) {
      const [listingId] = params;
      return {
        rows: dbState.auditLogs
          .filter((log) => log.target_type === 'listing' && log.target_id === listingId)
          .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
          .map((log) => ({
            id: log.id,
            action: log.action,
            safeChanges: log.safe_changes,
            timestamp: log.occurred_at,
            reason: log.reason,
            actorName: log.actor_name || 'Demo Farmer',
          })),
      };
    }

    // 8. FOR UPDATE OF l
    if (sql.includes('FOR UPDATE OF l')) {
      const [listingId] = params;
      trace.push(`LOCK_LISTING:${listingId}`);
      const l = dbState.listings.find((item) => item.id === listingId);
      if (!l) return { rows: [] };
      const hb = dbState.batches.find((b) => b.id === l.batch_id);
      return {
        rows: [
          {
            ...l,
            farmer_id: hb.farmer_id,
            farm_id: hb.farm_id,
          },
        ],
      };
    }

    // 8b. Listing owner & status preflight (used for upload-url preflight)
    if (sql.includes('hb.farmer_id') && sql.includes('WHERE l.id = $1') && !sql.includes('FOR UPDATE')) {
      const [listingId] = params;
      const l = dbState.listings.find((item) => item.id === listingId);
      if (!l) return { rows: [] };
      const hb = dbState.batches.find((b) => b.id === l.batch_id);
      return {
        rows: [
          {
            id: l.id,
            status: l.status,
            image_key: l.image_key ?? null,
            farmer_id: hb.farmer_id,
          },
        ],
      };
    }

    // 9. FOR UPDATE on harvest_batches
    if (sql.includes('FROM harvest_batches') && sql.includes('FOR UPDATE')) {
      const [batchId] = params;
      trace.push(`LOCK_BATCH:${batchId}`);
      const hb = dbState.batches.find((b) => b.id === batchId);
      return { rows: hb ? [{ ...hb }] : [] };
    }

    // 10. Farm lookup
    if (sql.includes('FROM farms') && sql.includes('WHERE id = $1')) {
      const [farmId] = params;
      const farm = dbState.farms.find((f) => f.id === farmId);
      return { rows: farm ? [{ ...farm }] : [] };
    }

    // 11. Active listing check (single batch)
    if (sql.includes('FROM listings') && !sql.includes('id <> $2') && sql.includes("status = 'active'")) {
      const [batchId] = params;
      const found = dbState.listings.find(
        (l) => l.batch_id === batchId && l.status === 'active'
      );
      return { rows: found ? [{ id: found.id }] : [] };
    }

    // 12. Batch encumbrance (blocking_kg, committed_kg, disputed_count)
    if (sql.includes('AS blocking_kg')) {
      const [batchId] = params;
      const { reservedKg, committedKg, disputedCount } = computeBatchStockFromAllocations(batchId);
      return {
        rows: [
          {
            blocking_kg: String(reservedKg),
            committed_kg: String(committedKg),
            disputed_count: String(disputedCount),
          },
        ],
      };
    }

    // 14. Other active listing check
    if (sql.includes('FROM listings') && sql.includes('id <> $2')) {
      const [batchId, excludeId] = params;
      const found = dbState.listings.find(
        (l) => l.batch_id === batchId && l.status === 'active' && l.id !== excludeId
      );
      return { rows: found ? [{ id: found.id }] : [] };
    }

    // 15. Insert listing (enforces one_active_listing_per_batch PG 23505)
    if (sql.includes('INSERT INTO listings')) {
      const [batchId, unitPriceCents, offeredKg, validFrom, validUntil, status] = params;
      trace.push(`INSERT_LISTING:${batchId}`);
      if (
        status === 'active' &&
        dbState.listings.some((l) => l.batch_id === batchId && l.status === 'active')
      ) {
        const pgErr = new Error('duplicate key value violates unique constraint "one_active_listing_per_batch"');
        pgErr.code = '23505';
        pgErr.constraint = 'one_active_listing_per_batch';
        throw pgErr;
      }
      const newId = `aaaaaaa${dbState.listings.length + 3}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
      dbState.listings.push({
        id: newId,
        batch_id: batchId,
        unit_price_cents: Number(unitPriceCents),
        offered_kg: Number(offeredKg),
        valid_from: validFrom,
        valid_until: validUntil,
        status,
        image_key: null,
        created_at: '2026-11-25T12:00:00Z',
      });
      return { rows: [{ id: newId }] };
    }

    // 15b. Update listing image_key only
    if (sql.includes('UPDATE listings') && sql.includes('SET image_key = $1')) {
      const [imageKey, listingId] = params;
      trace.push(`UPDATE_IMAGE_KEY:${listingId}`);
      const target = dbState.listings.find((l) => l.id === listingId);
      target.image_key = imageKey ?? null;
      return {
        rows: [
          {
            id: target.id,
            imageKey: target.image_key,
          },
        ],
      };
    }

    // 16. Update listing status only
    if (sql.includes('UPDATE listings') && sql.includes('SET status = $1')) {
      const [status, listingId] = params;
      trace.push(`UPDATE_STATUS:${listingId}`);
      const target = dbState.listings.find((l) => l.id === listingId);
      if (
        status === 'active' &&
        dbState.listings.some((l) => l.batch_id === target.batch_id && l.status === 'active' && l.id !== listingId)
      ) {
        const pgErr = new Error('duplicate key value violates unique constraint "one_active_listing_per_batch"');
        pgErr.code = '23505';
        pgErr.constraint = 'one_active_listing_per_batch';
        throw pgErr;
      }
      target.status = status;
      return {
        rows: [
          {
            id: target.id,
            batchId: target.batch_id,
            offeredKg: String(target.offered_kg),
            unitPriceCents: String(target.unit_price_cents),
            validFrom: target.valid_from,
            validUntil: target.valid_until,
            status: target.status,
            imageKey: target.image_key ?? null,
            createdAt: target.created_at,
          },
        ],
      };
    }

    // 17. Update listing in place
    if (sql.includes('UPDATE listings')) {
      const [batchId, offeredKg, unitPriceCents, validFrom, validUntil, status, listingId] = params;
      trace.push(`UPDATE_LISTING:${listingId}`);
      const target = dbState.listings.find((l) => l.id === listingId);
      target.batch_id = batchId;
      target.offered_kg = Number(offeredKg);
      target.unit_price_cents = Number(unitPriceCents);
      target.valid_from = validFrom;
      target.valid_until = validUntil;
      target.status = status;
      return {
        rows: [
          {
            id: target.id,
            batchId: target.batch_id,
            offeredKg: String(target.offered_kg),
            unitPriceCents: String(target.unit_price_cents),
            validFrom: target.valid_from,
            validUntil: target.valid_until,
            status: target.status,
            imageKey: target.image_key ?? null,
            createdAt: target.created_at,
          },
        ],
      };
    }

    // 18. Insert audit log (handles both price-only SQL and generic 6-param SQL)
    if (sql.includes('INSERT INTO audit_logs')) {
      if (params.length === 6) {
        const [actorId, action, listingId, requestId, reason, safeChangesJson] = params;
        trace.push(`INSERT_AUDIT:${action}:${listingId}`);
        dbState.auditLogs.push({
          id: `audit-${dbState.auditLogs.length + 1}`,
          actor_id: actorId,
          action,
          target_type: 'listing',
          target_id: listingId,
          request_id: requestId,
          reason,
          safe_changes: JSON.parse(safeChangesJson),
          occurred_at: '2026-11-25T12:01:00Z',
        });
        return { rows: [] };
      }
      const [actorId, listingId, requestId, reason, safeChangesJson] = params;
      trace.push(`INSERT_AUDIT:update_listing_price:${listingId}`);
      dbState.auditLogs.push({
        id: `audit-${dbState.auditLogs.length + 1}`,
        actor_id: actorId,
        action: 'update_listing_price',
        target_type: 'listing',
        target_id: listingId,
        request_id: requestId,
        reason,
        safe_changes: JSON.parse(safeChangesJson),
        occurred_at: '2026-11-25T10:30:00Z',
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled mock SQL: ${sql}`);
  }

  const lastTrace = [];

  const pool = {
    async query(sql, params) {
      return executeQuery(sql, params, state, lastTrace);
    },
    async connect() {
      let snapshot = null;
      let mutated = false;
      const client = {
        released: false,
        async query(sql, params) {
          if (sql === 'BEGIN') {
            lastTrace.push('BEGIN');
            snapshot = structuredClone(state);
            mutated = false;
            return { rows: [] };
          }
          if (sql === 'COMMIT') {
            lastTrace.push('COMMIT');
            snapshot = null;
            mutated = false;
            return { rows: [] };
          }
          if (sql === 'ROLLBACK') {
            lastTrace.push('ROLLBACK');
            if (snapshot && mutated) {
              Object.assign(state, snapshot);
            }
            snapshot = null;
            mutated = false;
            return { rows: [] };
          }
          if (sql.includes('INSERT ') || sql.includes('UPDATE ')) {
            mutated = true;
          }
          return executeQuery(sql, params, state, lastTrace);
        },
        release() {
          client.released = true;
          lastTrace.push('RELEASE');
        },
      };
      return client;
    },
  };

  return { pool, state, lastTrace };
}

function buildBaselineFixture(allocationOverrides = []) {
  return {
    users: [
      { id: FARMER_A_ID, name: 'Demo Farmer', role: 'farmer', approval_status: 'approved' },
      { id: FARMER_B_ID, name: 'Other Farmer', role: 'farmer', approval_status: 'approved' },
      { id: FARMER_PENDING_ID, name: 'Pending Farmer', role: 'farmer', approval_status: 'pending' },
      { id: FARMER_SUSPENDED_ID, name: 'Suspended Farmer', role: 'farmer', approval_status: 'suspended' },
      { id: BUYER_USER_ID, name: 'Demo Buyer', role: 'buyer', approval_status: 'approved' },
    ],
    farms: [
      { id: FARM_A_ID, farmer_id: FARMER_A_ID, name: 'Green Valley Farm', district: 'Nuwara Eliya', status: 'active' },
      { id: FARM_B_ID, farmer_id: FARMER_B_ID, name: 'Hilltop Farm', district: 'Kandy', status: 'active' },
    ],
    batches: [
      {
        id: BATCH_A_ID,
        farm_id: FARM_A_ID,
        farmer_id: FARMER_A_ID,
        crop_name: 'Tomato',
        grade_name: 'Grade A',
        status: 'harvested',
        actual_kg: 150,
        sellable_kg: 120,
      },
      {
        id: BATCH_B_ID,
        farm_id: FARM_A_ID,
        farmer_id: FARMER_A_ID,
        crop_name: 'Carrot',
        grade_name: 'Grade A',
        status: 'harvested',
        actual_kg: 90,
        sellable_kg: 80,
      },
      {
        id: BATCH_OTHER_FARMER_ID,
        farm_id: FARM_B_ID,
        farmer_id: FARMER_B_ID,
        crop_name: 'Potato',
        grade_name: 'Grade B',
        status: 'harvested',
        actual_kg: 100,
        sellable_kg: 90,
      },
    ],
    listings: [
      {
        id: LISTING_ID,
        batch_id: BATCH_A_ID,
        offered_kg: 100,
        unit_price_cents: 32000,
        valid_from: new Date('2026-11-10T00:00:00Z'),
        valid_until: new Date('2026-11-30T23:59:59Z'),
        status: 'active',
        created_at: '2026-11-10T08:00:00Z',
      },
      {
        id: LISTING_B_ID,
        batch_id: BATCH_OTHER_FARMER_ID,
        offered_kg: 90,
        unit_price_cents: 25000,
        valid_from: new Date('2026-11-10T00:00:00Z'),
        valid_until: new Date('2026-11-30T23:59:59Z'),
        status: 'active',
        created_at: '2026-11-10T09:00:00Z',
      },
    ],
    allocations: allocationOverrides,
    orders: [
      { id: 'ord-1', created_at: '2026-11-12T12:00:00Z', status: 'in_fulfilment' },
      { id: 'ord-2', created_at: '2026-11-13T12:00:00Z', status: 'delivered' },
    ],
    auditLogs: [
      {
        id: 'audit-init-1',
        actor_id: FARMER_A_ID,
        action: 'update_listing_price',
        target_type: 'listing',
        target_id: LISTING_ID,
        safe_changes: { unit_price_cents: { old: 30000, new: 32000 } },
        occurred_at: '2026-11-11T09:00:00Z',
        reason: 'Market update',
      },
    ],
  };
}

function wire(
  pool,
  cloudinaryStorage = createMockCloudinaryStorage(),
  imageStorageEnabled = true
) {
  const repository = createYm09Repository(pool, { imageStorageEnabled });
  const service = createYm09Service({
    repository,
    cloudinaryStorage,
    imageStorageEnabled,
  });
  return createYm09Controller(service);
}

function createMockCloudinaryStorage(overrides = {}) {
  const assets = new Map();
  for (const item of overrides.initialAssets || []) {
    if (typeof item === 'string') {
      assets.set(item, { resourceType: 'image', format: 'jpg', bytes: 1024 });
    } else if (item && item.publicId) {
      assets.set(item.publicId, {
        resourceType: item.resourceType ?? 'image',
        format: item.format ?? 'jpg',
        bytes: item.bytes ?? 1024,
      });
    }
  }
  const deletedPublicIds = [];
  const cloudName = overrides.cloudName ?? 'demo-yieldmatrix';
  const apiKey = overrides.apiKey ?? 'mock-api-key';
  const configured = overrides.configured ?? true;

  return {
    assets,
    deletedPublicIds,
    getBaseFolder() {
      return 'yieldmatrix/produce';
    },
    buildPublicImageUrl(publicId) {
      if (!configured || !publicId || !cloudName) {
        return null;
      }
      return `https://res.cloudinary.com/${cloudName}/image/upload/${String(publicId).replace(/^\/+/, '')}`;
    },
    async generateUploadSignature({ folder, publicId }) {
      if (!configured) {
        throw createServiceUnavailableError('Cloudinary produce image storage is not configured on the server.');
      }
      return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        cloudName,
        apiKey,
        timestamp: 1795671000,
        signature: `mock-sig-${publicId}`,
        folder,
        publicId,
        fullPublicId: `${folder}/${publicId}`,
      };
    },
    async verifyImageAssetExists(fullPublicId) {
      if (!configured) {
        throw createServiceUnavailableError('Cloudinary produce image storage is not configured on the server.');
      }
      if (overrides.failVerifyError) {
        throw overrides.failVerifyError;
      }
      const meta = assets.get(fullPublicId);
      if (!meta) {
        return { exists: false };
      }
      return {
        exists: true,
        resourceType: meta.resourceType,
        format: meta.format,
        bytes: meta.bytes,
        secureUrl: `https://res.cloudinary.com/${cloudName}/image/upload/${fullPublicId}.${meta.format}`,
      };
    },
    async deleteImageAsset(fullPublicId) {
      if (!configured) {
        throw createServiceUnavailableError('Cloudinary produce image storage is not configured on the server.');
      }
      if (overrides.failDeleteForIds?.includes(fullPublicId) || overrides.failDelete) {
        throw createBadGatewayError('Failed to delete produce image from Cloudinary.');
      }
      deletedPublicIds.push(fullPublicId);
      assets.delete(fullPublicId);
      return { deleted: true };
    },
  };
}

// =========================================================================
// 1. Structural & Route Preservation Tests
// =========================================================================

test('routes.js binds listing CRUD, status, and Cloudinary image signature/confirm/delete routes', () => {
  assert.equal(typeof defaultController.getStatus, 'function');
  assert.equal(typeof defaultController.getProduceListings, 'function');
  assert.equal(typeof defaultController.getProduceListingById, 'function');
  assert.equal(typeof defaultController.getProduceListingDetails, 'function');
  assert.equal(typeof defaultController.createProduceListing, 'function');
  assert.equal(typeof defaultController.updateProduceListing, 'function');
  assert.equal(typeof defaultController.updateProduceListingStatus, 'function');
  assert.equal(typeof defaultController.requestProduceImageSignature, 'function');
  assert.equal(typeof defaultController.confirmProduceImageUpload, 'function');
  assert.equal(typeof defaultController.deleteProduceImage, 'function');

  const registeredRoutes = ym09Router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
    }));

  assert.deepEqual(registeredRoutes, [
    { path: '/status', methods: ['get'] },
    { path: '/produce', methods: ['get'] },
    { path: '/produce', methods: ['post'] },
    { path: '/produce/:id/details', methods: ['get'] },
    { path: '/produce/:id', methods: ['get'] },
    { path: '/produce/:id', methods: ['put'] },
    { path: '/produce/:id/status', methods: ['patch'] },
    { path: '/produce/:id/image/signature', methods: ['post'] },
    { path: '/produce/:id/image/confirm', methods: ['post'] },
    { path: '/produce/:id/image', methods: ['delete'] },
  ]);
});

test('server.js imports YM09 routes cleanly without error', async () => {
  const serverModule = await import('../../server.js');
  assert.ok(serverModule.app);
});

test('constants define valid listing statuses and transition map', () => {
  assert.deepEqual(VALID_LISTING_STATUSES, ['draft', 'active', 'paused', 'expired', 'closed']);
  assert.deepEqual(VALID_LISTING_TRANSITIONS[LISTING_STATUS.CLOSED], []);
  assert.ok(VALID_LISTING_TRANSITIONS[LISTING_STATUS.DRAFT].includes(LISTING_STATUS.ACTIVE));
  assert.ok(VALID_LISTING_TRANSITIONS[LISTING_STATUS.ACTIVE].includes(LISTING_STATUS.PAUSED));
});

test('ym09.sql.js uses identical canonical stock subqueries across all GET endpoints (zero scope drift)', () => {
  const canonicalExpr = buildEncumberedKgCaseSql('a');
  assert.ok(SQL_FIND_LISTINGS_BY_FARMER.includes(canonicalExpr));
  assert.ok(SQL_FIND_LISTING_BY_ID.includes(canonicalExpr));
  assert.ok(SQL_FIND_LISTING_DETAILS_HEADER.includes(canonicalExpr));
  assert.ok(SQL_FIND_BATCH_ENCUMBRANCE.includes(canonicalExpr));
  assert.ok(SQL_FIND_BATCH_ENCUMBRANCE_FOR_REASSIGN.includes(canonicalExpr));

  // Verify reservedKg/committedKg calculation no longer restricts stock by [l.created_at, l.valid_until]
  const detailsHeaderSubqueries = SQL_FIND_LISTING_DETAILS_HEADER.slice(
    SQL_FIND_LISTING_DETAILS_HEADER.indexOf('COALESCE((')
  );
  assert.equal(detailsHeaderSubqueries.includes('a.created_at >='), false);
  assert.equal(detailsHeaderSubqueries.includes('SUM(GREATEST(0, a.committed_kg - a.picked_up_kg))'), true);
});

test('ym09.validation enforces strict kg precision without silent rounding and validates fields/dates', () => {
  assert.equal(validateKgQuantity(100), 100);
  assert.equal(validateKgQuantity('12.345'), 12.345);
  assert.throws(() => validateKgQuantity(10.1234), /at most 3 decimal places/i);
  assert.throws(() => validateKgQuantity('10.1234'), /at most 3 decimal places/i);
  assert.throws(() => validateKgQuantity(0), /greater than 0/i);
  assert.throws(() => validateKgQuantity(1e-7), /at most 3 decimal places/i);

  assert.equal(validatePositiveIntegerCents(32000), 32000);
  assert.throws(() => validatePositiveIntegerCents(320.5), /integer/i);
  assert.throws(() => validatePositiveIntegerCents(0), /integer/i);

  assert.equal(validateListingId(LISTING_ID), LISTING_ID);
  assert.throws(() => validateListingId('not-a-uuid'), /Invalid listing ID format/i);

  assert.throws(() => validateDateRange('2026-02-30', '2026-03-05'), /valid calendar date/i);
  assert.throws(() => validateDateRange('2026-11-20', '2026-11-20'), /strictly after/i);

  assert.throws(
    () => validateUpdateListingPayload({ farmerId: FARMER_A_ID, unitPriceCents: 1000 }),
    /Unsupported request field/i
  );
  assert.throws(() => validateUpdateListingPayload({}), /at least one updatable field/i);
  assert.throws(
    () => validateCreateListingPayload({ batchId: BATCH_A_ID, offeredKg: 25, unitPriceCents: 1000, validFrom: '2026-11-20', validUntil: '2026-11-30' }),
    /Missing required/i
  );
  assert.ok(validateCreateListingPayload({
    farmId: FARM_A_ID,
    batchId: BATCH_A_ID,
    offeredKg: 25.5,
    unitPriceCents: 32000,
    validFrom: '2026-11-20T00:00:00Z',
    validUntil: '2026-11-30T23:59:59Z',
  }));
  assert.throws(() => validateListQueryParams({ pageSize: '101' }), /between 1 and 100/i);
});

// =========================================================================
// 2. Task 1 – Approval & Ownership Enforcement Tests
// =========================================================================

test('unauthenticated requests return 401 across all YM09 handlers', async () => {
  const { pool } = createStatefulMockDb(buildBaselineFixture());
  const controller = wire(pool);

  const r1 = createMockRes();
  await controller.getStatus({ requestId: REQUEST_ID }, r1, () => {});
  assert.equal(r1.statusCode, 401);

  const r2 = createMockRes();
  await controller.getProduceListings({ query: {}, requestId: REQUEST_ID }, r2, () => {});
  assert.equal(r2.statusCode, 401);

  const r3 = createMockRes();
  await controller.getProduceListingById({ params: { id: LISTING_ID }, requestId: REQUEST_ID }, r3, () => {});
  assert.equal(r3.statusCode, 401);

  const r4 = createMockRes();
  await controller.getProduceListingDetails({ params: { id: LISTING_ID }, requestId: REQUEST_ID }, r4, () => {});
  assert.equal(r4.statusCode, 401);

  const r5 = createMockRes();
  await controller.updateProduceListing(
    { params: { id: LISTING_ID }, body: { unitPriceCents: 35000 }, requestId: REQUEST_ID },
    r5,
    () => {}
  );
  assert.equal(r5.statusCode, 401);
});

test('pending, suspended, and non-farmer accounts receive 403 on all YM09 GET and PUT endpoints', async () => {
  const { pool } = createStatefulMockDb(buildBaselineFixture());
  const controller = wire(pool);

  const deniedCallers = [
    { id: FARMER_PENDING_ID, role: 'farmer', label: 'pending farmer' },
    { id: FARMER_SUSPENDED_ID, role: 'farmer', label: 'suspended farmer' },
    { id: BUYER_USER_ID, role: 'buyer', label: 'non-farmer role' },
  ];

  for (const user of deniedCallers) {
    const rStatus = createMockRes();
    await controller.getStatus({ user, requestId: REQUEST_ID }, rStatus, () => {});
    assert.equal(rStatus.statusCode, 403, `${user.label} should get 403 on GET /status`);

    const rList = createMockRes();
    await controller.getProduceListings({ user, query: {}, requestId: REQUEST_ID }, rList, () => {});
    assert.equal(rList.statusCode, 403, `${user.label} should get 403 on GET /produce`);

    const rById = createMockRes();
    await controller.getProduceListingById(
      { params: { id: LISTING_ID }, user, requestId: REQUEST_ID },
      rById,
      () => {}
    );
    assert.equal(rById.statusCode, 403, `${user.label} should get 403 on GET /produce/:id`);

    const rDetails = createMockRes();
    await controller.getProduceListingDetails(
      { params: { id: LISTING_ID }, user, requestId: REQUEST_ID },
      rDetails,
      () => {}
    );
    assert.equal(rDetails.statusCode, 403, `${user.label} should get 403 on GET /produce/:id/details`);

    const rPut = createMockRes();
    await controller.updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        body: { unitPriceCents: 35000 },
        requestId: REQUEST_ID,
      },
      rPut,
      () => {}
    );
    assert.equal(rPut.statusCode, 403, `${user.label} should get 403 on PUT /produce/:id`);
  }
});

test('cross-farmer access to listings, details (allocations/orders/priceHistory/activity), and target batches is blocked', async () => {
  const { pool } = createStatefulMockDb(
    buildBaselineFixture([
      {
        id: 'al-other',
        order_id: 'ord-1',
        batch_id: BATCH_OTHER_FARMER_ID,
        farmer_id: FARMER_B_ID,
        agreed_kg: 15,
        agreed_unit_price_cents: 25000,
        committed_kg: 15,
        picked_up_kg: 0,
        status: 'committed',
        created_at: '2026-11-11T10:00:00Z',
      },
    ])
  );
  const controller = wire(pool);
  const farmerA = { id: FARMER_A_ID, role: 'farmer' };

  // Farmer A GET /produce returns ONLY Farmer A's listing (not Farmer B's)
  const rList = createMockRes();
  await controller.getProduceListings({ user: farmerA, query: {}, requestId: REQUEST_ID }, rList, () => {});
  assert.equal(rList.statusCode, 200);
  assert.deepEqual(rList.body.data.map((d) => d.id), [LISTING_ID]);

  // Farmer A cannot read Farmer B's listing via GET /produce/:id or GET /produce/:id/details
  const rOtherById = createMockRes();
  await controller.getProduceListingById(
    { params: { id: LISTING_B_ID }, user: farmerA, requestId: REQUEST_ID },
    rOtherById,
    () => {}
  );
  assert.equal(rOtherById.statusCode, 404);

  const rOtherDetails = createMockRes();
  await controller.getProduceListingDetails(
    { params: { id: LISTING_B_ID }, user: farmerA, requestId: REQUEST_ID },
    rOtherDetails,
    () => {}
  );
  assert.equal(rOtherDetails.statusCode, 404);

  // Farmer A cannot update Farmer B's listing -> 403
  const rOtherPut = createMockRes();
  await controller.updateProduceListing(
    {
      params: { id: LISTING_B_ID },
      user: farmerA,
      body: { unitPriceCents: 29000 },
      requestId: REQUEST_ID,
    },
    rOtherPut,
    () => {}
  );
  assert.equal(rOtherPut.statusCode, 403);
  assert.match(rOtherPut.body.error, /do not own/i);

  // Farmer A cannot reassign their own draft listing onto Farmer B's harvest batch -> 403
  const dbWithDraft = buildBaselineFixture();
  dbWithDraft.listings[0].status = 'draft';
  const controllerDraft = wire(createStatefulMockDb(dbWithDraft).pool);
  const rForeignBatch = createMockRes();
  await controllerDraft.updateProduceListing(
    {
      params: { id: LISTING_ID },
      user: farmerA,
      body: { batchId: BATCH_OTHER_FARMER_ID, offeredKg: 50 },
      requestId: REQUEST_ID,
    },
    rForeignBatch,
    () => {}
  );
  assert.equal(rForeignBatch.statusCode, 403);
  assert.match(rForeignBatch.body.error, /does not belong to your account/i);
});

// =========================================================================
// 3. Task 2 – Canonical DR-01 Stock Calculation Across ALL GET Endpoints
// =========================================================================

test('DR-01 canonical stock matches across GET /produce, GET /produce/:id, and GET /produce/:id/details for all allocation lifecycles', async () => {
  // Complex multi-allocation batch scenario covering EVERY requirement:
  // offeredKg = 100
  // 1) held: agreed 10 -> reserved +10, committed +0
  // 2) supplier_accepted: agreed 12.5 -> reserved +12.5, committed +0
  // 3) committed (uncollected): agreed 15, committed 15, picked_up 0 -> reserved +15, committed +15
  // 4) committed (partial pickup): agreed 20, committed 20, picked_up 7.5 -> reserved +12.5, committed +12.5
  // 5) committed/picked_up (fully picked up): agreed 10, committed 10, picked_up 10 -> reserved +0, committed +0
  // 6) disputed (partial pickup): agreed 18, committed 18, picked_up 8 -> reserved +10, committed +0
  // 7) cancelled / expired / declined / accepted -> reserved +0, committed +0
  // 8) pre-listing timestamp allocation (still on same batch): must stay consistent across all 3 GET endpoints!
  // Expected totals:
  // reservedKg = 10 + 12.5 + 15 + 12.5 + 0 + 10 = 60
  // committedKg = 15 + 12.5 = 27.5
  // availableKg = 100 - 60 = 40 (committed NOT counted twice!)
  const allocations = [
    {
      id: 'al-held',
      order_id: 'ord-1',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 10,
      agreed_unit_price_cents: 32000,
      committed_kg: 0,
      picked_up_kg: 0,
      status: 'held',
      created_at: '2026-11-11T10:00:00Z',
    },
    {
      id: 'al-accepted',
      order_id: 'ord-1',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 12.5,
      agreed_unit_price_cents: 32000,
      committed_kg: 0,
      picked_up_kg: 0,
      status: 'supplier_accepted',
      created_at: '2026-11-12T10:00:00Z',
    },
    {
      id: 'al-committed-full',
      order_id: 'ord-1',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 15,
      agreed_unit_price_cents: 32000,
      committed_kg: 15,
      picked_up_kg: 0,
      status: 'committed',
      created_at: '2026-11-13T10:00:00Z',
    },
    {
      id: 'al-committed-partial-pickup',
      order_id: 'ord-2',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 20,
      agreed_unit_price_cents: 32000,
      committed_kg: 20,
      picked_up_kg: 7.5,
      status: 'committed',
      created_at: '2026-11-14T10:00:00Z',
    },
    {
      id: 'al-picked-up-complete',
      order_id: 'ord-2',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 10,
      agreed_unit_price_cents: 32000,
      committed_kg: 10,
      picked_up_kg: 10,
      status: 'picked_up',
      created_at: '2026-11-14T12:00:00Z',
    },
    {
      id: 'al-disputed-partial',
      order_id: 'ord-2',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 18,
      agreed_unit_price_cents: 32000,
      committed_kg: 18,
      picked_up_kg: 8,
      status: 'disputed',
      created_at: '2026-11-15T10:00:00Z',
    },
    {
      id: 'al-cancelled',
      order_id: 'ord-1',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 50,
      agreed_unit_price_cents: 32000,
      committed_kg: 0,
      picked_up_kg: 0,
      status: 'cancelled',
      created_at: '2026-11-15T11:00:00Z',
    },
    {
      id: 'al-expired',
      order_id: 'ord-1',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 40,
      agreed_unit_price_cents: 32000,
      committed_kg: 0,
      picked_up_kg: 0,
      status: 'expired',
      created_at: '2026-11-08T11:00:00Z', // earlier than listing created_at
    },
  ];

  const { pool } = createStatefulMockDb(buildBaselineFixture(allocations));
  const controller = wire(pool);
  const user = { id: FARMER_A_ID, role: 'farmer' };

  const resList = createMockRes();
  await controller.getProduceListings({ user, query: {}, requestId: REQUEST_ID }, resList, () => {});

  const resById = createMockRes();
  await controller.getProduceListingById(
    { params: { id: LISTING_ID }, user, requestId: REQUEST_ID },
    resById,
    () => {}
  );

  const resDetails = createMockRes();
  await controller.getProduceListingDetails(
    { params: { id: LISTING_ID }, user, requestId: REQUEST_ID },
    resDetails,
    () => {}
  );

  const listStock = resList.body.data[0];
  const byIdStock = resById.body.data;
  const detailsStock = resDetails.body.data;

  for (const view of [listStock, byIdStock, detailsStock]) {
    assert.equal(view.offeredKg, 100);
    assert.equal(view.reservedKg, 60);
    assert.equal(view.committedKg, 27.5);
    assert.equal(view.availableKg, 40);
  }

  // Details also executes cleanly with priceHistory and sorted activityLog
  assert.equal(detailsStock.priceHistory.length, 1);
  assert.ok(detailsStock.activityLog.length >= 2);
});

// =========================================================================
// 4. Task 3 – Same-Batch Update Stock Validation & Transaction Safety Tests
// =========================================================================

test('PUT /produce/:id same-batch scenarios: quantity increase, decrease, price-only, dates, status, holds/commitments/disputes', async () => {
  const user = { id: FARMER_A_ID, role: 'farmer' };

  // Fixture: Batch sellable_kg = 120, listing offered_kg = 100, status = 'active'
  // Encumbrance: 10 held + 20 uncollected committed + 10 uncollected disputed = 40 kg blocking
  const baseAllocations = [
    {
      id: 'al-h',
      order_id: 'ord-1',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 10,
      agreed_unit_price_cents: 32000,
      committed_kg: 0,
      picked_up_kg: 0,
      status: 'held',
      created_at: '2026-11-12T10:00:00Z',
    },
    {
      id: 'al-c',
      order_id: 'ord-1',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 25,
      agreed_unit_price_cents: 32000,
      committed_kg: 25,
      picked_up_kg: 5,
      status: 'committed',
      created_at: '2026-11-12T11:00:00Z',
    },
    {
      id: 'al-d',
      order_id: 'ord-2',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 15,
      agreed_unit_price_cents: 32000,
      committed_kg: 15,
      picked_up_kg: 5,
      status: 'disputed',
      created_at: '2026-11-13T11:00:00Z',
    },
  ];

  // 1a. Same-batch quantity increase within batch.sellable_kg (100 -> 120) succeeds
  {
    const { pool, state, lastTrace } = createStatefulMockDb(buildBaselineFixture(baseAllocations));
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { offeredKg: 120 },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.offeredKg, 120);
    assert.ok(lastTrace.includes(`LOCK_BATCH:${BATCH_A_ID}`));
    assert.ok(lastTrace.includes('COMMIT'));
    // Historical agreed allocation price & kg remain untouched
    assert.equal(state.allocations[1].agreed_kg, 25);
    assert.equal(state.allocations[1].agreed_unit_price_cents, 32000);
  }

  // 1b. Same-batch quantity increase exceeding batch.sellable_kg (100 -> 125 > 120) fails with 400 + ROLLBACK
  {
    const { pool, state, lastTrace } = createStatefulMockDb(buildBaselineFixture(baseAllocations));
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { offeredKg: 125 },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /exceeds available harvest batch sellable stock/i);
    assert.ok(lastTrace.includes('ROLLBACK'));
    assert.equal(state.listings[0].offered_kg, 100);
  }

  // 1c. Same-batch quantity increase fails with 400 if harvest batch is not 'harvested'
  {
    const fx = buildBaselineFixture(baseAllocations);
    fx.batches[0].status = 'depleted';
    const { pool } = createStatefulMockDb(fx);
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { offeredKg: 110 },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /harvested status before increasing/i);
  }

  // 2a. Same-batch quantity decrease DOWN TO active obligations (100 -> 40) succeeds
  {
    const { pool, state } = createStatefulMockDb(buildBaselineFixture(baseAllocations));
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { offeredKg: 40 },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 200);
    assert.equal(state.listings[0].offered_kg, 40);
  }

  // 2b. Same-batch quantity decrease BELOW active holds/commitments/disputes (100 -> 39.5 < 40) fails with 409 + ROLLBACK
  {
    const { pool, state, lastTrace } = createStatefulMockDb(buildBaselineFixture(baseAllocations));
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { offeredKg: 39.5 },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /Cannot reduce offered quantity.*40 kg/i);
    assert.ok(lastTrace.includes('ROLLBACK'));
    assert.equal(state.listings[0].offered_kg, 100);
  }

  // 3. Price-only edit while active holds, commitments, and disputed allocations exist succeeds & audits without changing allocations
  {
    const { pool, state } = createStatefulMockDb(buildBaselineFixture(baseAllocations));
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { unitPriceCents: 38000 },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.unitPriceCents, 38000);
    assert.equal(state.auditLogs.length, 2);
    assert.equal(state.allocations[0].agreed_unit_price_cents, 32000);
    assert.equal(state.allocations[1].agreed_unit_price_cents, 32000);
  }

  // 4. Availability dates update succeeds when valid, rejects invalid range
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture(baseAllocations));
    const controller = wire(pool);

    const badDateRes = createMockRes();
    await controller.updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { validFrom: '2026-12-05', validUntil: '2026-11-30' },
      },
      badDateRes,
      () => {}
    );
    assert.equal(badDateRes.statusCode, 400);

    const okDateRes = createMockRes();
    await controller.updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { validFrom: '2026-11-12', validUntil: '2026-12-10' },
      },
      okDateRes,
      () => {}
    );
    assert.equal(okDateRes.statusCode, 200);
  }

  // 5. Status transitions: active -> paused succeeds; closed -> active rejected (409); activating when another active listing exists -> 409
  {
    const fx = buildBaselineFixture(baseAllocations);
    const { pool, state } = createStatefulMockDb(fx);
    const controller = wire(pool);

    const pauseRes = createMockRes();
    await controller.updateProduceListing(
      { params: { id: LISTING_ID }, user, requestId: REQUEST_ID, body: { status: 'paused' } },
      pauseRes,
      () => {}
    );
    assert.equal(pauseRes.statusCode, 200);
    assert.equal(state.listings[0].status, 'paused');

    const closeRes = createMockRes();
    await controller.updateProduceListing(
      { params: { id: LISTING_ID }, user, requestId: REQUEST_ID, body: { status: 'closed' } },
      closeRes,
      () => {}
    );
    assert.equal(closeRes.statusCode, 200);
    assert.equal(state.listings[0].status, 'closed');

    const reactivateClosedRes = createMockRes();
    await controller.updateProduceListing(
      { params: { id: LISTING_ID }, user, requestId: REQUEST_ID, body: { status: 'active' } },
      reactivateClosedRes,
      () => {}
    );
    assert.equal(reactivateClosedRes.statusCode, 409);
    assert.match(reactivateClosedRes.body.error, /Invalid listing status transition/i);
  }

  // 5b. Activating a draft listing fails with 409 if the same batch already has another active listing
  {
    const fx = buildBaselineFixture([]);
    const secondListingId = 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    fx.listings.push({
      id: secondListingId,
      batch_id: BATCH_A_ID,
      offered_kg: 20,
      unit_price_cents: 32000,
      valid_from: new Date('2026-11-10T00:00:00Z'),
      valid_until: new Date('2026-11-30T23:59:59Z'),
      status: 'draft',
      created_at: '2026-11-11T08:00:00Z',
    });
    const { pool, state } = createStatefulMockDb(fx);
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      { params: { id: secondListingId }, user, requestId: REQUEST_ID, body: { status: 'active' } },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /already has an active produce listing/i);
    assert.equal(state.listings.find((l) => l.id === secondListingId).status, 'draft');
  }
});

test('PUT /produce/:id batch reassignment blocks holds/disputes and verifies target batch stock & locks', async () => {
  const user = { id: FARMER_A_ID, role: 'farmer' };

  // Reassignment blocked when active obligations exist
  {
    const fx = buildBaselineFixture([
      {
        id: 'al-hold-reassign',
        order_id: 'ord-1',
        batch_id: BATCH_A_ID,
        farmer_id: FARMER_A_ID,
        agreed_kg: 15,
        agreed_unit_price_cents: 32000,
        committed_kg: 0,
        picked_up_kg: 0,
        status: 'held',
        created_at: '2026-11-12T10:00:00Z',
      },
    ]);
    const { pool, lastTrace } = createStatefulMockDb(fx);
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { batchId: BATCH_B_ID, offeredKg: 50 },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /15 kg/);
    assert.ok(lastTrace.includes('ROLLBACK'));
  }

  // Reassignment succeeds when zero holds/disputes and target batch has sufficient uncommitted stock
  {
    const fx = buildBaselineFixture([]);
    const { pool, state, lastTrace } = createStatefulMockDb(fx);
    const res = createMockRes();
    await wire(pool).updateProduceListing(
      {
        params: { id: LISTING_ID },
        user,
        requestId: REQUEST_ID,
        body: { batchId: BATCH_B_ID, offeredKg: 75 },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 200);
    assert.equal(state.listings[0].batch_id, BATCH_B_ID);
    assert.equal(state.listings[0].offered_kg, 75);
    assert.ok(lastTrace.includes(`LOCK_BATCH:${BATCH_A_ID}`));
    assert.ok(lastTrace.includes(`LOCK_BATCH:${BATCH_B_ID}`));
    assert.ok(lastTrace.includes('COMMIT'));
  }
});

test('PUT /produce/:id rolls back safely and releases client even if database update fails and ROLLBACK rejects', async () => {
  const dbError = new Error('Simulated connection drop');
  const mockClient = {
    released: false,
    async query(sql) {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'ROLLBACK') throw new Error('Rollback socket closed');
      if (sql.includes('FOR UPDATE OF l')) {
        return {
          rows: [
            {
              id: LISTING_ID,
              batch_id: BATCH_A_ID,
              offered_kg: '50.000',
              unit_price_cents: '30000',
              valid_from: new Date('2026-11-15T00:00:00Z'),
              valid_until: new Date('2026-11-30T23:59:59Z'),
              status: 'active',
              farmer_id: FARMER_A_ID,
              farm_id: FARM_A_ID,
            },
          ],
        };
      }
      if (sql.includes('FROM harvest_batches') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: BATCH_A_ID,
              farmer_id: FARMER_A_ID,
              farm_id: FARM_A_ID,
              status: 'harvested',
              sellable_kg: '100',
            },
          ],
        };
      }
      if (sql.includes('AS blocking_kg')) {
        return { rows: [{ blocking_kg: '0', committed_kg: '0', disputed_count: '0' }] };
      }
      if (sql.includes('UPDATE listings')) {
        throw dbError;
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {
      mockClient.released = true;
    },
  };

  const pool = {
    async query() {
      return {
        rows: [{ id: FARMER_A_ID, role: 'farmer', approval_status: 'approved' }],
      };
    },
    async connect() {
      return mockClient;
    },
  };

  const res = createMockRes();
  let forwarded = null;
  await wire(pool).updateProduceListing(
    {
      params: { id: LISTING_ID },
      user: { id: FARMER_A_ID, role: 'farmer' },
      requestId: REQUEST_ID,
      body: { unitPriceCents: 31000 },
    },
    res,
    (err) => {
      forwarded = err;
    }
  );

  assert.equal(forwarded, dbError);
  assert.equal(mockClient.released, true);
});


// =========================================================================
// 5. Phase 3 Task A – Create Produce Listing API (POST /api/ym09/produce)
// =========================================================================

test('POST /produce creates listing, writes audit log, and returns 201 camelCase DTO', async () => {
  const fx = buildBaselineFixture();
  const { pool, state, lastTrace } = createStatefulMockDb(fx);
  const controller = wire(pool);
  const farmerA = { id: FARMER_A_ID, role: 'farmer' };

  const res = createMockRes();
  await controller.createProduceListing(
    {
      user: farmerA,
      requestId: REQUEST_ID,
      body: {
        farmId: FARM_A_ID,
        batchId: BATCH_B_ID,
        offeredKg: 60.125,
        unitPriceCents: 28000,
        validFrom: '2026-11-25',
        validUntil: '2026-12-10',
      },
    },
    res,
    () => {}
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.requestId, REQUEST_ID);
  assert.equal(res.body.data.batchId, BATCH_B_ID);
  assert.equal(res.body.data.farmId, FARM_A_ID);
  assert.equal(res.body.data.cropName, 'Carrot');
  assert.equal(res.body.data.offeredKg, 60.125);
  assert.equal(res.body.data.availableKg, 60.125);
  assert.equal(res.body.data.reservedKg, 0);
  assert.equal(res.body.data.unitPriceCents, 28000);
  assert.equal(res.body.data.status, 'active');

  assert.equal(state.listings.length, 3);
  assert.equal(state.auditLogs.at(-1).action, 'create_listing');
  assert.ok(lastTrace.includes(`LOCK_BATCH:${BATCH_B_ID}`));
  assert.ok(lastTrace.includes('COMMIT'));
});

test('POST /produce enforces auth, approval, farm/batch ownership, eligibility, precision, dates, and stock bounds', async () => {
  const validBody = {
    farmId: FARM_A_ID,
    batchId: BATCH_B_ID,
    offeredKg: 50,
    unitPriceCents: 28000,
    validFrom: '2026-11-25',
    validUntil: '2026-12-10',
  };
  const farmerA = { id: FARMER_A_ID, role: 'farmer' };

  // 1. Unauthenticated -> 401
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const res = createMockRes();
    await wire(pool).createProduceListing({ body: validBody, requestId: REQUEST_ID }, res, () => {});
    assert.equal(res.statusCode, 401);
  }

  // 2. Unapproved farmer -> 403
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const res = createMockRes();
    await wire(pool).createProduceListing(
      { user: { id: FARMER_PENDING_ID, role: 'farmer' }, body: validBody, requestId: REQUEST_ID },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 403);
  }

  // 3. Non-farmer user -> 403
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const res = createMockRes();
    await wire(pool).createProduceListing(
      { user: { id: BUYER_USER_ID, role: 'buyer' }, body: validBody, requestId: REQUEST_ID },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 403);
  }

  // 4. Foreign farm -> 403
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const res = createMockRes();
    await wire(pool).createProduceListing(
      {
        user: farmerA,
        body: { ...validBody, farmId: FARM_B_ID },
        requestId: REQUEST_ID,
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /Farm does not belong/i);
  }

  // 5. Foreign harvest batch -> 403
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const res = createMockRes();
    await wire(pool).createProduceListing(
      {
        user: farmerA,
        body: { ...validBody, batchId: BATCH_OTHER_FARMER_ID },
        requestId: REQUEST_ID,
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /Harvest batch does not belong/i);
  }

  // 6. Farm and batch mismatch (farmer owns both Farm 2 and Batch B on Farm A) -> 400
  {
    const fx = buildBaselineFixture();
    const FARM_A2_ID = 'f2222222-2222-4222-8222-222222222222';
    fx.farms.push({
      id: FARM_A2_ID,
      farmer_id: FARMER_A_ID,
      name: 'Second Owned Farm',
      district: 'Matale',
      status: 'active',
    });
    const { pool } = createStatefulMockDb(fx);
    const res = createMockRes();
    await wire(pool).createProduceListing(
      {
        user: farmerA,
        body: { ...validBody, farmId: FARM_A2_ID },
        requestId: REQUEST_ID,
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /does not match/i);
  }

  // 7. Planned batch & Archived/depleted/cancelled batch -> 400
  for (const batchStatus of ['planned', 'ready', 'depleted', 'cancelled']) {
    const fx = buildBaselineFixture();
    fx.batches[1].status = batchStatus;
    const { pool } = createStatefulMockDb(fx);
    const res = createMockRes();
    await wire(pool).createProduceListing(
      { user: farmerA, body: validBody, requestId: REQUEST_ID },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 400, `Status ${batchStatus} must be rejected`);
    assert.match(res.body.error, /harvested status before listing/i);
  }

  // 8. Validation errors: invalid UUID, price, quantity, >3 decimals, invalid date range
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const controller = wire(pool);

    for (const [label, badBody] of [
      ['invalid farmId UUID', { ...validBody, farmId: 'farm-001' }],
      ['invalid batchId UUID', { ...validBody, batchId: 'batch-001' }],
      ['zero price', { ...validBody, unitPriceCents: 0 }],
      ['float price', { ...validBody, unitPriceCents: 280.5 }],
      ['zero quantity', { ...validBody, offeredKg: 0 }],
      ['negative quantity', { ...validBody, offeredKg: -10 }],
      ['>3 decimal places (no silent rounding)', { ...validBody, offeredKg: 10.1234 }],
      ['invalid calendar date', { ...validBody, validFrom: '2026-02-30' }],
      ['validUntil <= validFrom', { ...validBody, validFrom: '2026-11-30', validUntil: '2026-11-25' }],
    ]) {
      const res = createMockRes();
      await controller.createProduceListing({ user: farmerA, body: badBody, requestId: REQUEST_ID }, res, () => {});
      assert.equal(res.statusCode, 400, `Expected 400 for ${label}`);
    }
  }

  // 9. Duplicate active listing -> 409 Conflict
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const res = createMockRes();
    await wire(pool).createProduceListing(
      { user: farmerA, body: { ...validBody, batchId: BATCH_A_ID }, requestId: REQUEST_ID },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /already has an active produce listing/i);
  }

  // 10. Insufficient sellable stock (0 sellable or offered > sellable - holds) -> 400
  {
    const fxZero = buildBaselineFixture();
    fxZero.batches[1].sellable_kg = 0;
    const resZero = createMockRes();
    await wire(createStatefulMockDb(fxZero).pool).createProduceListing(
      { user: farmerA, body: validBody, requestId: REQUEST_ID },
      resZero,
      () => {}
    );
    assert.equal(resZero.statusCode, 400);

    const fxHeld = buildBaselineFixture([
      {
        id: 'al-b-hold',
        order_id: 'ord-1',
        batch_id: BATCH_B_ID,
        farmer_id: FARMER_A_ID,
        agreed_kg: 45,
        agreed_unit_price_cents: 28000,
        committed_kg: 0,
        picked_up_kg: 0,
        status: 'held',
        created_at: '2026-11-24T10:00:00Z',
      },
    ]);
    // Batch B has 80 sellable - 45 held = 35 available; requesting 50 fails
    const resOver = createMockRes();
    await wire(createStatefulMockDb(fxHeld).pool).createProduceListing(
      { user: farmerA, body: validBody, requestId: REQUEST_ID },
      resOver,
      () => {}
    );
    assert.equal(resOver.statusCode, 400);
    assert.match(resOver.body.error, /exceeds available uncommitted stock.*35 kg/i);
  }
});

test('POST /produce handles concurrent duplicate creation with batch FOR UPDATE serialization and 23505 fallback', async () => {
  // 1. Concurrent parallel requests queued behind harvest_batch FOR UPDATE mutex: first wins (201), second loses (409)
  {
    const fx = buildBaselineFixture();
    const baseDb = createStatefulMockDb(fx);
    let batchLockQueue = Promise.resolve();

    const serializedPool = {
      query: baseDb.pool.query,
      async connect() {
        const innerClient = await baseDb.pool.connect();
        let releaseLock = null;
        return {
          async query(sql, params) {
            if (sql.includes('FROM harvest_batches') && sql.includes('FOR UPDATE')) {
              const prevLock = batchLockQueue;
              batchLockQueue = new Promise((resolve) => {
                releaseLock = resolve;
              });
              await prevLock;
              return innerClient.query(sql, params);
            }
            const out = await innerClient.query(sql, params);
            return out;
          },
          release() {
            if (releaseLock) {
              releaseLock();
              releaseLock = null;
            }
            innerClient.release();
          },
        };
      },
    };

    const controller = wire(serializedPool);
    const farmerA = { id: FARMER_A_ID, role: 'farmer' };
    const body = {
      farmId: FARM_A_ID,
      batchId: BATCH_B_ID,
      offeredKg: 40,
      unitPriceCents: 28000,
      validFrom: '2026-11-25',
      validUntil: '2026-12-10',
    };

    const res1 = createMockRes();
    const res2 = createMockRes();
    await Promise.all([
      controller.createProduceListing({ user: farmerA, body, requestId: 'req-1' }, res1, () => {}),
      controller.createProduceListing({ user: farmerA, body, requestId: 'req-2' }, res2, () => {}),
    ]);

    const statuses = [res1.statusCode, res2.statusCode].sort();
    assert.deepEqual(statuses, [201, 409]);
    assert.equal(baseDb.state.listings.filter((l) => l.batch_id === BATCH_B_ID).length, 1);
  }

  // 2. Database unique constraint (23505) during INSERT translates into 409 + ROLLBACK
  {
    const fx = buildBaselineFixture();
    const baseDb = createStatefulMockDb(fx);
    let rolledBack = false;
    let released = false;
    const racePool = {
      query: baseDb.pool.query,
      async connect() {
        const client = await baseDb.pool.connect();
        return {
          async query(sql, params) {
            if (sql.includes('INSERT INTO listings')) {
              const pgErr = new Error('unique constraint violation');
              pgErr.code = '23505';
              pgErr.constraint = 'one_active_listing_per_batch';
              throw pgErr;
            }
            if (sql === 'ROLLBACK') rolledBack = true;
            return client.query(sql, params);
          },
          release() {
            released = true;
            client.release();
          },
        };
      },
    };

    const res = createMockRes();
    await wire(racePool).createProduceListing(
      {
        user: { id: FARMER_A_ID, role: 'farmer' },
        requestId: REQUEST_ID,
        body: {
          farmId: FARM_A_ID,
          batchId: BATCH_B_ID,
          offeredKg: 40,
          unitPriceCents: 28000,
          validFrom: '2026-11-25',
          validUntil: '2026-12-10',
        },
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 409);
    assert.equal(rolledBack, true);
    assert.equal(released, true);
  }
});

test('POST /produce rolls back created listing if audit write fails mid-transaction', async () => {
  const fx = buildBaselineFixture();
  const baseDb = createStatefulMockDb(fx);
  const failingPool = {
    query: baseDb.pool.query,
    async connect() {
      const client = await baseDb.pool.connect();
      return {
        async query(sql, params) {
          if (sql.includes('INSERT INTO audit_logs')) {
            throw new Error('Audit write failure');
          }
          return client.query(sql, params);
        },
        release() {
          client.release();
        },
      };
    },
  };

  let forwarded = null;
  const res = createMockRes();
  await wire(failingPool).createProduceListing(
    {
      user: { id: FARMER_A_ID, role: 'farmer' },
      requestId: REQUEST_ID,
      body: {
        farmId: FARM_A_ID,
        batchId: BATCH_B_ID,
        offeredKg: 40,
        unitPriceCents: 28000,
        validFrom: '2026-11-25',
        validUntil: '2026-12-10',
      },
    },
    res,
    (err) => {
      forwarded = err;
    }
  );

  assert.equal(forwarded?.message, 'Audit write failure');
  assert.equal(baseDb.state.listings.length, 2); // Rolled back cleanly
});

// =========================================================================
// 6. Phase 3 Task B – Status Management API (PATCH /api/ym09/produce/:id/status)
// =========================================================================

test('PATCH /produce/:id/status supports pause, reactivation, archive, audit logging, and preserves allocations', async () => {
  const allocations = [
    {
      id: 'al-keep',
      order_id: 'ord-1',
      batch_id: BATCH_A_ID,
      farmer_id: FARMER_A_ID,
      agreed_kg: 30,
      agreed_unit_price_cents: 32000,
      committed_kg: 30,
      picked_up_kg: 0,
      status: 'committed',
      created_at: '2026-11-12T10:00:00Z',
    },
  ];
  const fx = buildBaselineFixture(allocations);
  const { pool, state } = createStatefulMockDb(fx);
  const controller = wire(pool);
  const farmerA = { id: FARMER_A_ID, role: 'farmer' };

  // 1. active -> paused
  const pauseRes = createMockRes();
  await controller.updateProduceListingStatus(
    { params: { id: LISTING_ID }, user: farmerA, body: { status: 'paused' }, requestId: REQUEST_ID },
    pauseRes,
    () => {}
  );
  assert.equal(pauseRes.statusCode, 200);
  assert.equal(pauseRes.body.data.status, 'paused');

  // 2. paused -> active (reactivation when stock & batch eligible)
  const reactivateRes = createMockRes();
  await controller.updateProduceListingStatus(
    { params: { id: LISTING_ID }, user: farmerA, body: { status: 'active' }, requestId: REQUEST_ID },
    reactivateRes,
    () => {}
  );
  assert.equal(reactivateRes.statusCode, 200);
  assert.equal(reactivateRes.body.data.status, 'active');

  // 3. active -> closed (archive)
  const archiveRes = createMockRes();
  await controller.updateProduceListingStatus(
    { params: { id: LISTING_ID }, user: farmerA, body: { status: 'closed' }, requestId: REQUEST_ID },
    archiveRes,
    () => {}
  );
  assert.equal(archiveRes.statusCode, 200);
  assert.equal(archiveRes.body.data.status, 'closed');

  // 4. Verify audit logs recorded status changes & Details returns allocations + orders untouched
  const statusAudits = state.auditLogs.filter((l) => l.action === 'update_listing_status');
  assert.equal(statusAudits.length, 3);
  assert.equal(state.allocations[0].agreed_kg, 30);
  assert.equal(state.allocations[0].agreed_unit_price_cents, 32000);

  const detailsRes = createMockRes();
  await controller.getProduceListingDetails(
    { params: { id: LISTING_ID }, user: farmerA, requestId: REQUEST_ID },
    detailsRes,
    () => {}
  );
  assert.equal(detailsRes.statusCode, 200);
  assert.equal(detailsRes.body.data.allocations.length, 1);
  assert.ok(detailsRes.body.data.activityLog.some((e) => e.eventType === 'status_change'));
});

test('PATCH /produce/:id/status rejects invalid status/transitions, unauthorized callers, insufficient stock, and duplicate active listing', async () => {
  const farmerA = { id: FARMER_A_ID, role: 'farmer' };

  // 1. Invalid status / unknown extra field -> 400
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const controller = wire(pool);
    const badStatus = createMockRes();
    await controller.updateProduceListingStatus(
      { params: { id: LISTING_ID }, user: farmerA, body: { status: 'archived' }, requestId: REQUEST_ID },
      badStatus,
      () => {}
    );
    assert.equal(badStatus.statusCode, 400);

    const extraField = createMockRes();
    await controller.updateProduceListingStatus(
      { params: { id: LISTING_ID }, user: farmerA, body: { status: 'paused', offeredKg: 10 }, requestId: REQUEST_ID },
      extraField,
      () => {}
    );
    assert.equal(extraField.statusCode, 400);
  }

  // 2. Foreign listing -> 403 & unapproved farmer -> 403
  {
    const { pool } = createStatefulMockDb(buildBaselineFixture());
    const controller = wire(pool);
    const foreignRes = createMockRes();
    await controller.updateProduceListingStatus(
      { params: { id: LISTING_B_ID }, user: farmerA, body: { status: 'paused' }, requestId: REQUEST_ID },
      foreignRes,
      () => {}
    );
    assert.equal(foreignRes.statusCode, 403);

    const unapprovedRes = createMockRes();
    await controller.updateProduceListingStatus(
      {
        params: { id: LISTING_ID },
        user: { id: FARMER_PENDING_ID, role: 'farmer' },
        body: { status: 'paused' },
        requestId: REQUEST_ID,
      },
      unapprovedRes,
      () => {}
    );
    assert.equal(unapprovedRes.statusCode, 403);
  }

  // 3. Invalid transitions (closed -> active, expired -> active, draft -> paused) -> 409
  {
    const fx = buildBaselineFixture();
    fx.listings[0].status = 'closed';
    const closedRes = createMockRes();
    await wire(createStatefulMockDb(fx).pool).updateProduceListingStatus(
      { params: { id: LISTING_ID }, user: farmerA, body: { status: 'active' }, requestId: REQUEST_ID },
      closedRes,
      () => {}
    );
    assert.equal(closedRes.statusCode, 409);

    fx.listings[0].status = 'draft';
    const draftPauseRes = createMockRes();
    await wire(createStatefulMockDb(fx).pool).updateProduceListingStatus(
      { params: { id: LISTING_ID }, user: farmerA, body: { status: 'paused' }, requestId: REQUEST_ID },
      draftPauseRes,
      () => {}
    );
    assert.equal(draftPauseRes.statusCode, 409);
  }

  // 4. Insufficient sellable stock during reactivation (paused -> active when sellable_kg < offered_kg) -> 400
  {
    const fx = buildBaselineFixture();
    fx.listings[0].status = 'paused';
    fx.batches[0].sellable_kg = 50; // offered_kg is 100
    const res = createMockRes();
    await wire(createStatefulMockDb(fx).pool).updateProduceListingStatus(
      { params: { id: LISTING_ID }, user: farmerA, body: { status: 'active' }, requestId: REQUEST_ID },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /insufficient eligible harvest batch sellable stock/i);
  }

  // 5. Duplicate active listing on same batch during reactivation (paused -> active) -> 409
  {
    const fx = buildBaselineFixture();
    const pausedSecondId = 'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    fx.listings.push({
      id: pausedSecondId,
      batch_id: BATCH_A_ID,
      offered_kg: 20,
      unit_price_cents: 32000,
      valid_from: new Date('2026-11-10T00:00:00Z'),
      valid_until: new Date('2026-11-30T23:59:59Z'),
      status: 'paused',
      created_at: '2026-11-11T08:00:00Z',
    });
    const res = createMockRes();
    await wire(createStatefulMockDb(fx).pool).updateProduceListingStatus(
      { params: { id: pausedSecondId }, user: farmerA, body: { status: 'active' }, requestId: REQUEST_ID },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /already has an active produce listing/i);
  }
});

test('GET /produce/:id returns batchNumber/actualKg/sellableKg, PUT records update_listing audit, and non-UUID requestId sanitizes to null', async () => {
  const fx = buildBaselineFixture();
  const mockDb = createStatefulMockDb(fx);
  const service = createYm09Service({
    repository: createYm09Repository(mockDb.pool),
  });

  const loaded = await service.getFarmerProduceListingById({
    farmerId: FARMER_A_ID,
    listingId: LISTING_ID,
  });
  assert.equal(loaded.batchNumber, `HB-${BATCH_A_ID.slice(0, 8).toUpperCase()}`);
  assert.equal(loaded.actualKg, 150);
  assert.equal(loaded.sellableKg, 120);

  await service.updateFarmerProduceListing({
    farmerId: FARMER_A_ID,
    listingId: LISTING_ID,
    requestId: 'not-a-uuid-request-id',
    payload: { offeredKg: 110 },
  });

  const updateAudit = mockDb.state.auditLogs.find((a) => a.action === 'update_listing');
  assert.ok(updateAudit);
  assert.equal(updateAudit.request_id, null);
  assert.deepEqual(updateAudit.safe_changes.offered_kg, { old: 100, new: 110 });

  const details = await service.getFarmerProduceListingDetails({
    farmerId: FARMER_A_ID,
    listingId: LISTING_ID,
  });
  assert.ok(details.activityLog.some((item) => item.eventType === 'listing_updated'));
});

// =========================================================================
// 7. Cloudinary Produce Image Signature, Confirm, Replacement & Delete Tests
// =========================================================================

test('Cloudinary validation & adapter enforce MIME allowlist, 5 MB limit, scoped public_id, offline SHA-1 signing, and missing env checks', async () => {
  assert.deepEqual(ALLOWED_IMAGE_MIME_TYPES, ['image/jpeg', 'image/png', 'image/webp']);

  const validReq = validateImageUploadRequestPayload({
    contentType: 'IMAGE/WEBP',
    fileSizeBytes: 1024 * 512,
  });
  assert.deepEqual(validReq, { contentType: 'image/webp', fileSizeBytes: 524288 });

  assert.throws(
    () => validateImageUploadRequestPayload({ contentType: 'image/svg+xml', fileSizeBytes: 1024 }),
    (err) => err.statusCode === 400 && /allowed types:\s*jpeg,\s*png,\s*webp/i.test(err.message)
  );
  assert.throws(
    () => validateImageUploadRequestPayload({ contentType: 'image/jpeg', fileSizeBytes: 6 * 1024 * 1024 }),
    (err) => err.statusCode === 400 && /exceeds.*maximum/i.test(err.message)
  );
  assert.throws(
    () => validateImageUploadRequestPayload({ contentType: 'image/jpeg', fileSizeBytes: 1024, extraField: true }),
    (err) => err.statusCode === 400 && /unsupported request field/i.test(err.message)
  );

  const generated = buildListingCloudinaryPublicId(LISTING_ID);
  assert.equal(generated.folder, `yieldmatrix/produce/${LISTING_ID}`);
  assert.match(generated.publicId, /^[a-f0-9-]+$/i);
  assert.equal(generated.fullPublicId, `${generated.folder}/${generated.publicId}`);

  assert.deepEqual(validateImageConfirmPayload({ publicId: generated.fullPublicId }, LISTING_ID), {
    publicId: generated.fullPublicId,
  });
  assert.throws(
    () =>
      validateImageConfirmPayload(
        { publicId: `yieldmatrix/produce/${LISTING_B_ID}/11111111-1111-4111-8111-111111111111` },
        LISTING_ID
      ),
    (err) => err.statusCode === 400 && /invalid cloudinary public id/i.test(err.message)
  );
  assert.throws(
    () =>
      validateImageConfirmPayload(
        { publicId: `yieldmatrix/produce/${LISTING_ID}/../escape` },
        LISTING_ID
      ),
    (err) => err.statusCode === 400
  );
  assert.throws(
    () =>
      validateImageConfirmPayload(
        { publicId: 'https://res.cloudinary.com/demo/image/upload/x' },
        LISTING_ID
      ),
    (err) => err.statusCode === 400
  );

  const unconfigured = createYm09CloudinaryStorage({
    cloudName: '',
    apiKey: '',
    apiSecret: '',
  });
  assert.equal(unconfigured.buildPublicImageUrl('yieldmatrix/produce/x/y'), null);
  await assert.rejects(
    () => unconfigured.generateUploadSignature({ folder: generated.folder, publicId: generated.publicId }),
    (err) => err.statusCode === 503
  );

  const offlineSigned = createYm09CloudinaryStorage({
    cloudName: 'yieldmatrix-demo',
    apiKey: 'test-api-key',
    apiSecret: 'super-secret-value',
  });
  const sigPayload = await offlineSigned.generateUploadSignature({
    folder: generated.folder,
    publicId: generated.publicId,
  });
  assert.equal(sigPayload.uploadUrl, 'https://api.cloudinary.com/v1_1/yieldmatrix-demo/image/upload');
  assert.equal(sigPayload.cloudName, 'yieldmatrix-demo');
  assert.equal(sigPayload.apiKey, 'test-api-key');
  assert.equal(typeof sigPayload.timestamp, 'number');
  assert.match(sigPayload.signature, /^[a-f0-9]{40}$/);
  assert.equal('apiSecret' in sigPayload, false);
  assert.match(
    offlineSigned.buildPublicImageUrl(generated.fullPublicId),
    new RegExp(`^https://res\\.cloudinary\\.com/yieldmatrix-demo/image/upload/.*${generated.fullPublicId}`)
  );
});

test('POST /produce/:id/image/signature generates signed upload parameters and blocks unauthorized/unapproved/closed requests', async () => {
  const farmerA = { id: FARMER_A_ID, role: 'farmer' };
  const farmerB = { id: FARMER_B_ID, role: 'farmer' };
  const buyer = { id: BUYER_USER_ID, role: 'buyer' };

  {
    const fx = buildBaselineFixture();
    const cld = createMockCloudinaryStorage({ cloudName: 'yieldmatrix-test', apiKey: 'key-123' });
    const controller = wire(createStatefulMockDb(fx).pool, cld);
    const res = createMockRes();
    await controller.requestProduceImageSignature(
      {
        params: { id: LISTING_ID },
        user: farmerA,
        body: { contentType: 'image/webp', fileSizeBytes: 250000 },
        requestId: REQUEST_ID,
      },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.cloudName, 'yieldmatrix-test');
    assert.equal(res.body.data.apiKey, 'key-123');
    assert.equal(res.body.data.folder, `yieldmatrix/produce/${LISTING_ID}`);
    assert.match(res.body.data.fullPublicId, new RegExp(`^yieldmatrix/produce/${LISTING_ID}/[a-f0-9-]+$`));
    assert.equal(res.body.data.uploadUrl, 'https://api.cloudinary.com/v1_1/yieldmatrix-test/image/upload');
    assert.ok(res.body.data.signature);
    assert.equal('apiSecret' in res.body.data, false);
  }

  {
    const fx = buildBaselineFixture();
    const controller = wire(createStatefulMockDb(fx).pool);

    const unauthRes = createMockRes();
    await controller.requestProduceImageSignature(
      { params: { id: LISTING_ID }, user: undefined, body: { contentType: 'image/jpeg', fileSizeBytes: 1024 } },
      unauthRes,
      () => {}
    );
    assert.equal(unauthRes.statusCode, 401);

    const pendingRes = createMockRes();
    await controller.requestProduceImageSignature(
      { params: { id: LISTING_ID }, user: { id: FARMER_PENDING_ID, role: 'farmer' }, body: { contentType: 'image/jpeg', fileSizeBytes: 1024 } },
      pendingRes,
      () => {}
    );
    assert.equal(pendingRes.statusCode, 403);

    const buyerRes = createMockRes();
    await controller.requestProduceImageSignature(
      { params: { id: LISTING_ID }, user: buyer, body: { contentType: 'image/jpeg', fileSizeBytes: 1024 } },
      buyerRes,
      () => {}
    );
    assert.equal(buyerRes.statusCode, 403);

    const crossFarmerRes = createMockRes();
    await controller.requestProduceImageSignature(
      { params: { id: LISTING_ID }, user: farmerB, body: { contentType: 'image/jpeg', fileSizeBytes: 1024 } },
      crossFarmerRes,
      () => {}
    );
    assert.equal(crossFarmerRes.statusCode, 403);

    const closedFx = buildBaselineFixture();
    closedFx.listings[0].status = 'closed';
    const closedController = wire(createStatefulMockDb(closedFx).pool);
    const closedRes = createMockRes();
    await closedController.requestProduceImageSignature(
      { params: { id: LISTING_ID }, user: farmerA, body: { contentType: 'image/jpeg', fileSizeBytes: 1024 } },
      closedRes,
      () => {}
    );
    assert.equal(closedRes.statusCode, 409);
  }

  {
    const fx = buildBaselineFixture();
    const cld = createMockCloudinaryStorage({ configured: false });
    const controller = wire(createStatefulMockDb(fx).pool, cld);
    const res = createMockRes();
    await controller.requestProduceImageSignature(
      { params: { id: LISTING_ID }, user: farmerA, body: { contentType: 'image/png', fileSizeBytes: 1024 } },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /not configured/i);
  }
});

test('POST /produce/:id/image/confirm validates asset existence/format/size, replaces image, and maps imageUrl across GET endpoints', async () => {
  const farmerA = { id: FARMER_A_ID, role: 'farmer' };
  const initialPublicId = `yieldmatrix/produce/${LISTING_ID}/11111111-1111-4111-8111-111111111111`;
  const replacementPublicId = `yieldmatrix/produce/${LISTING_ID}/22222222-2222-4222-8222-222222222222`;
  const badFormatPublicId = `yieldmatrix/produce/${LISTING_ID}/44444444-4444-4444-8444-444444444444`;
  const oversizedPublicId = `yieldmatrix/produce/${LISTING_ID}/55555555-5555-4555-8555-555555555555`;

  const fx = buildBaselineFixture();
  fx.listings[0].image_key = initialPublicId;
  const cld = createMockCloudinaryStorage({
    cloudName: 'yieldmatrix-cdn',
    initialAssets: [
      { publicId: initialPublicId, resourceType: 'image', format: 'jpg', bytes: 2048 },
      { publicId: badFormatPublicId, resourceType: 'image', format: 'gif', bytes: 2048 },
      { publicId: oversizedPublicId, resourceType: 'image', format: 'png', bytes: 7 * 1024 * 1024 },
    ],
  });
  const mockDb = createStatefulMockDb(fx);
  const controller = wire(mockDb.pool, cld);

  // Missing Cloudinary asset fails confirm with 400 and preserves initialPublicId
  const missingPublicId = `yieldmatrix/produce/${LISTING_ID}/99999999-9999-4999-8999-999999999999`;
  const missingRes = createMockRes();
  await controller.confirmProduceImageUpload(
    { params: { id: LISTING_ID }, user: farmerA, body: { publicId: missingPublicId }, requestId: REQUEST_ID },
    missingRes,
    () => {}
  );
  assert.equal(missingRes.statusCode, 400);
  assert.equal(mockDb.state.listings[0].image_key, initialPublicId);

  // Disallowed format in Cloudinary fails confirm and preserves initialPublicId
  const badFormatRes = createMockRes();
  await controller.confirmProduceImageUpload(
    { params: { id: LISTING_ID }, user: farmerA, body: { publicId: badFormatPublicId }, requestId: REQUEST_ID },
    badFormatRes,
    () => {}
  );
  assert.equal(badFormatRes.statusCode, 400);
  assert.match(badFormatRes.body.error, /unsupported uploaded image format/i);
  assert.equal(mockDb.state.listings[0].image_key, initialPublicId);

  // Oversized asset in Cloudinary fails confirm and preserves initialPublicId
  const oversizedRes = createMockRes();
  await controller.confirmProduceImageUpload(
    { params: { id: LISTING_ID }, user: farmerA, body: { publicId: oversizedPublicId }, requestId: REQUEST_ID },
    oversizedRes,
    () => {}
  );
  assert.equal(oversizedRes.statusCode, 400);
  assert.match(oversizedRes.body.error, /exceeds the maximum/i);
  assert.equal(mockDb.state.listings[0].image_key, initialPublicId);

  // Successful replacement updates image_key and deletes replaced Cloudinary asset
  cld.assets.set(replacementPublicId, { resourceType: 'image', format: 'webp', bytes: 120000 });
  const confirmRes = createMockRes();
  await controller.confirmProduceImageUpload(
    { params: { id: LISTING_ID }, user: farmerA, body: { publicId: replacementPublicId }, requestId: REQUEST_ID },
    confirmRes,
    () => {}
  );
  assert.equal(confirmRes.statusCode, 200);
  assert.equal(confirmRes.body.data.id, LISTING_ID);
  assert.equal(
    confirmRes.body.data.imageUrl,
    `https://res.cloudinary.com/yieldmatrix-cdn/image/upload/${replacementPublicId}`
  );
  assert.equal(mockDb.state.listings[0].image_key, replacementPublicId);
  assert.deepEqual(cld.deletedPublicIds, [initialPublicId]);
  assert.equal(cld.assets.has(initialPublicId), false);

  const imageAudit = mockDb.state.auditLogs.find((log) => log.action === AUDIT_ACTION_IMAGE_UPDATE);
  assert.ok(imageAudit);
  assert.deepEqual(imageAudit.safe_changes.image_key, { old: initialPublicId, new: replacementPublicId });

  const listRes = createMockRes();
  await controller.getProduceListings({ user: farmerA, query: {} }, listRes, () => {});
  assert.equal(listRes.statusCode, 200);
  assert.equal(
    listRes.body.data[0].imageUrl,
    `https://res.cloudinary.com/yieldmatrix-cdn/image/upload/${replacementPublicId}`
  );
  assert.equal('imageKey' in listRes.body.data[0], false);

  const byIdRes = createMockRes();
  await controller.getProduceListingById({ params: { id: LISTING_ID }, user: farmerA }, byIdRes, () => {});
  assert.equal(byIdRes.statusCode, 200);
  assert.equal(
    byIdRes.body.data.imageUrl,
    `https://res.cloudinary.com/yieldmatrix-cdn/image/upload/${replacementPublicId}`
  );
  assert.equal('imageKey' in byIdRes.body.data, false);

  const detailsRes = createMockRes();
  await controller.getProduceListingDetails({ params: { id: LISTING_ID }, user: farmerA }, detailsRes, () => {});
  assert.equal(detailsRes.statusCode, 200);
  assert.equal(
    detailsRes.body.data.imageUrl,
    `https://res.cloudinary.com/yieldmatrix-cdn/image/upload/${replacementPublicId}`
  );
  assert.ok(
    detailsRes.body.data.activityLog.some(
      (item) => item.eventType === 'listing_updated' && item.title === 'Produce image updated'
    )
  );
});

test('DELETE /produce/:id/image handles atomic delete, repeated deletion idempotency, and Cloudinary failure rollback', async () => {
  const farmerA = { id: FARMER_A_ID, role: 'farmer' };
  const existingPublicId = `yieldmatrix/produce/${LISTING_ID}/33333333-3333-4333-8333-333333333333`;

  // 1. Cloudinary failure rolls back DB update so image_key is preserved
  {
    const fx = buildBaselineFixture();
    fx.listings[0].image_key = existingPublicId;
    const cld = createMockCloudinaryStorage({ initialAssets: [existingPublicId], failDelete: true });
    const mockDb = createStatefulMockDb(fx);
    const controller = wire(mockDb.pool, cld);
    const res = createMockRes();
    await controller.deleteProduceImage(
      { params: { id: LISTING_ID }, user: farmerA, requestId: REQUEST_ID },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 502);
    assert.equal(mockDb.state.listings[0].image_key, existingPublicId);
    assert.ok(mockDb.lastTrace.includes('ROLLBACK'));
  }

  // 2. Successful delete clears image_key, removes Cloudinary asset, and subsequent repeated delete is idempotent
  {
    const fx = buildBaselineFixture();
    fx.listings[0].image_key = existingPublicId;
    const cld = createMockCloudinaryStorage({ initialAssets: [existingPublicId] });
    const mockDb = createStatefulMockDb(fx);
    const controller = wire(mockDb.pool, cld);

    const res = createMockRes();
    await controller.deleteProduceImage(
      { params: { id: LISTING_ID }, user: farmerA, requestId: REQUEST_ID },
      res,
      () => {}
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.id, LISTING_ID);
    assert.equal(res.body.data.imageUrl, null);
    assert.equal(res.body.data.removed, true);
    assert.equal(mockDb.state.listings[0].image_key, null);
    assert.deepEqual(cld.deletedPublicIds, [existingPublicId]);
    assert.ok(mockDb.state.auditLogs.some((log) => log.action === AUDIT_ACTION_IMAGE_DELETE));

    // Repeated delete safely returns removed: false without failing
    const repeatRes = createMockRes();
    await controller.deleteProduceImage(
      { params: { id: LISTING_ID }, user: farmerA, requestId: REQUEST_ID },
      repeatRes,
      () => {}
    );
    assert.equal(repeatRes.statusCode, 200);
    assert.equal(repeatRes.body.data.imageUrl, null);
    assert.equal(repeatRes.body.data.removed, false);

    const detailsRes = createMockRes();
    await controller.getProduceListingDetails({ params: { id: LISTING_ID }, user: farmerA }, detailsRes, () => {});
    assert.equal(detailsRes.statusCode, 200);
    assert.equal(detailsRes.body.data.imageUrl, null);
  }
});

test('YM09_IMAGE_STORAGE_ENABLED=false avoids listings.image_key in SQL, returns null imageUrl across CRUD/details, and disables image routes safely', async () => {
  const noImageSqls = [
    SQL_FIND_LISTINGS_BY_FARMER_NO_IMAGE,
    SQL_FIND_LISTING_BY_ID_NO_IMAGE,
    SQL_FIND_LISTING_DETAILS_HEADER_NO_IMAGE,
    SQL_LOCK_LISTING_FOR_UPDATE_NO_IMAGE,
    SQL_FIND_LISTING_OWNER_STATUS_NO_IMAGE,
    SQL_UPDATE_LISTING_IN_PLACE_NO_IMAGE,
    SQL_UPDATE_LISTING_STATUS_NO_IMAGE,
  ];
  for (const sql of noImageSqls) {
    assert.equal(sql.includes('image_key'), false);
  }

  const farmerA = { id: FARMER_A_ID, role: 'farmer' };
  const fx = buildBaselineFixture();
  const mockDb = createStatefulMockDb(fx);

  // Wrap pool & client so ANY query mentioning image_key throws Neon PG 42703 error
  const strictSchemaPool = {
    async query(sql, params) {
      if (String(sql).includes('image_key')) {
        const err = new Error('column l.image_key does not exist');
        err.code = '42703';
        throw err;
      }
      return mockDb.pool.query(sql, params);
    },
    async connect() {
      const client = await mockDb.pool.connect();
      const origQuery = client.query.bind(client);
      client.query = async (sql, params) => {
        if (String(sql).includes('image_key')) {
          const err = new Error('column l.image_key does not exist');
          err.code = '42703';
          throw err;
        }
        return origQuery(sql, params);
      };
      return client;
    },
  };

  const cld = createMockCloudinaryStorage({ cloudName: 'yieldmatrix-cdn' });
  const controller = wire(strictSchemaPool, cld, false);

  // 1. /status reports capabilities.imageStorageEnabled = false
  const statusRes = createMockRes();
  await controller.getStatus({ user: farmerA, requestId: REQUEST_ID }, statusRes, () => {});
  assert.equal(statusRes.statusCode, 200);
  assert.equal(statusRes.body.capabilities.imageStorageEnabled, false);

  // 2. GET /produce succeeds without image_key and returns imageUrl: null + exact DR-01 stock
  const listRes = createMockRes();
  await controller.getProduceListings({ user: farmerA, query: {} }, listRes, () => {});
  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body.data.length, 1);
  assert.equal(listRes.body.data[0].imageUrl, null);
  assert.equal(listRes.body.data[0].offeredKg, 100);
  assert.equal(listRes.body.data[0].reservedKg, 0);
  assert.equal(listRes.body.data[0].availableKg, 100);

  // 3. GET /produce/:id succeeds without image_key
  const byIdRes = createMockRes();
  await controller.getProduceListingById({ params: { id: LISTING_ID }, user: farmerA }, byIdRes, () => {});
  assert.equal(byIdRes.statusCode, 200);
  assert.equal(byIdRes.body.data.imageUrl, null);
  assert.equal(byIdRes.body.data.sellableKg, 120);

  // 4. GET /produce/:id/details succeeds without image_key
  const detailsRes = createMockRes();
  await controller.getProduceListingDetails({ params: { id: LISTING_ID }, user: farmerA }, detailsRes, () => {});
  assert.equal(detailsRes.statusCode, 200);
  assert.equal(detailsRes.body.data.imageUrl, null);
  assert.ok(Array.isArray(detailsRes.body.data.allocations));

  // 5. PUT /produce/:id & PATCH /produce/:id/status & POST /produce succeed without image_key
  const putRes = createMockRes();
  await controller.updateProduceListing(
    { params: { id: LISTING_ID }, user: farmerA, requestId: REQUEST_ID, body: { unitPriceCents: 34000 } },
    putRes,
    () => {}
  );
  assert.equal(putRes.statusCode, 200);
  assert.equal(putRes.body.data.imageUrl, null);
  assert.equal(putRes.body.data.unitPriceCents, 34000);

  const patchRes = createMockRes();
  await controller.updateProduceListingStatus(
    { params: { id: LISTING_ID }, user: farmerA, requestId: REQUEST_ID, body: { status: 'paused' } },
    patchRes,
    () => {}
  );
  assert.equal(patchRes.statusCode, 200);
  assert.equal(patchRes.body.data.imageUrl, null);
  assert.equal(patchRes.body.data.status, 'paused');

  const createRes = createMockRes();
  await controller.createProduceListing(
    {
      user: farmerA,
      requestId: REQUEST_ID,
      body: {
        farmId: FARM_A_ID,
        batchId: BATCH_B_ID,
        offeredKg: 25,
        unitPriceCents: 28000,
        validFrom: '2026-11-20T00:00:00Z',
        validUntil: '2026-11-30T23:59:59Z',
        status: 'active',
      },
    },
    createRes,
    () => {}
  );
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.data.imageUrl, null);

  // 6. Image signature, confirm, and delete return controlled 503 when disabled
  const sigRes = createMockRes();
  await controller.requestProduceImageSignature(
    { params: { id: LISTING_ID }, user: farmerA, body: { contentType: 'image/jpeg', fileSizeBytes: 1024 } },
    sigRes,
    () => {}
  );
  assert.equal(sigRes.statusCode, 503);
  assert.match(sigRes.body.error, /temporarily unavailable|listings\.image_key/i);

  const confirmRes = createMockRes();
  await controller.confirmProduceImageUpload(
    {
      params: { id: LISTING_ID },
      user: farmerA,
      body: { publicId: `yieldmatrix/produce/${LISTING_ID}/11111111-1111-4111-8111-111111111111` },
    },
    confirmRes,
    () => {}
  );
  assert.equal(confirmRes.statusCode, 503);

  const delRes = createMockRes();
  await controller.deleteProduceImage(
    { params: { id: LISTING_ID }, user: farmerA },
    delRes,
    () => {}
  );
  assert.equal(delRes.statusCode, 503);
});
