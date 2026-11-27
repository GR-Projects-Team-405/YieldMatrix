/**
 * Pure database-row to API DTO mappers for YieldMatrix Module YM09 – Produce Listings.
 * Ensures consistent camelCase naming and numeric conversions from PostgreSQL strings.
 */
import { ym09CloudinaryStorage } from './ym09.cloudinary.js';

function resolvePublicImageUrl(
  imageKey,
  resolveImageUrl = ym09CloudinaryStorage.buildPublicImageUrl
) {
  if (!imageKey) return null;
  const resolved = typeof resolveImageUrl === 'function' ? resolveImageUrl(imageKey) : null;
  return resolved || null;
}

function stripInternalImageKey(row) {
  const { imageKey: _ignoredImageKey, ...rest } = row;
  return rest;
}

function computeStockMetrics(row) {
  const offeredKg = parseFloat(row.offeredKg ?? '0');
  const reservedKg = parseFloat(row.reservedKg ?? '0');
  const committedKg = parseFloat(row.committedKg ?? '0');
  const availableKg = Math.max(0, offeredKg - reservedKg);
  const unitPriceCents = parseInt(row.unitPriceCents, 10);

  return {
    offeredKg,
    reservedKg,
    committedKg,
    availableKg,
    unitPriceCents,
  };
}

export function mapProduceListingRow(row, resolveImageUrl) {
  return {
    ...stripInternalImageKey(row),
    ...computeStockMetrics(row),
    imageUrl: resolvePublicImageUrl(row.imageKey, resolveImageUrl),
  };
}

export function mapProduceListingByIdRow(row, resolveImageUrl) {
  return {
    ...stripInternalImageKey(row),
    actualKg:
      row.actualKg !== undefined && row.actualKg !== null
        ? parseFloat(row.actualKg)
        : undefined,
    sellableKg:
      row.sellableKg !== undefined && row.sellableKg !== null
        ? parseFloat(row.sellableKg)
        : undefined,
    ...computeStockMetrics(row),
    imageUrl: resolvePublicImageUrl(row.imageKey, resolveImageUrl),
  };
}

export function mapUpdatedListingRow(row, resolveImageUrl) {
  return {
    id: row.id,
    batchId: row.batchId,
    offeredKg: parseFloat(row.offeredKg ?? '0'),
    unitPriceCents: parseInt(row.unitPriceCents, 10),
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    status: row.status,
    imageUrl: resolvePublicImageUrl(row.imageKey, resolveImageUrl),
    createdAt: row.createdAt,
  };
}

export function mapAllocationDisplayStatus(status) {
  if (['accepted', 'resolved'].includes(status)) return 'Completed';
  if (['supplier_accepted'].includes(status)) return 'Confirmed';
  if (['committed', 'picked_up', 'handed_over'].includes(status)) return 'Committed';
  if (['disputed'].includes(status)) return 'Disputed';
  if (['declined', 'cancelled', 'expired'].includes(status)) return 'Declined';
  return 'Pending';
}

export function mapAllocationRow(row) {
  return {
    id: row.id,
    orderId: row.orderId,
    buyerName: row.buyerName || 'Verified Buyer',
    allocatedKg: parseFloat(row.allocatedKg ?? '0'),
    agreedUnitPriceCents: parseInt(row.agreedUnitPriceCents, 10),
    agreedValueCents: parseInt(row.agreedValueCents, 10),
    status: row.status,
    displayStatus: mapAllocationDisplayStatus(row.status),
    allocatedOn: row.allocatedOn,
  };
}

export function mapOrderDisplayStatus(status) {
  if (['delivered', 'closed'].includes(status)) return 'Completed';
  if (['confirmed', 'in_fulfilment'].includes(status)) return 'Confirmed';
  if (['cancelled', 'expired'].includes(status)) return 'Cancelled';
  return 'Processing';
}

export function mapOrderRow(row) {
  const orderValueCents =
    row.allocationValueCents !== null && row.allocationValueCents !== undefined
      ? parseInt(row.allocationValueCents, 10)
      : null;

  return {
    id: row.id,
    buyerName: row.buyerName || 'Verified Buyer',
    orderKg: parseFloat(row.orderKg ?? '0'),
    orderValueCents,
    status: row.status,
    displayStatus: mapOrderDisplayStatus(row.status),
    orderDate: row.orderDate,
  };
}

export function extractPriceHistoryAndAuditEvents(auditRows) {
  const priceHistory = [];
  const priceActivity = [];

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

    const parsedOld =
      oldCents !== undefined && oldCents !== null ? parseInt(oldCents, 10) : undefined;
    const parsedNew =
      newCents !== undefined && newCents !== null ? parseInt(newCents, 10) : undefined;

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

      priceActivity.push({
        id: `act-${log.id}`,
        eventType: 'price_update',
        title: 'Listing price updated',
        description: `Price changed from LKR ${(parsedOld / 100).toFixed(0)} / kg to LKR ${(parsedNew / 100).toFixed(0)} / kg.`,
        timestamp: log.timestamp,
      });
    } else if (
      log.action === 'update_listing_status' &&
      changes.status &&
      typeof changes.status === 'object' &&
      changes.status.old &&
      changes.status.new
    ) {
      priceActivity.push({
        id: `act-${log.id}`,
        eventType: 'status_change',
        title: 'Listing status updated',
        description: `Listing status changed from ${changes.status.old} to ${changes.status.new}.`,
        timestamp: log.timestamp,
      });
    } else if (log.action === 'update_listing_image') {
      priceActivity.push({
        id: `act-${log.id}`,
        eventType: 'listing_updated',
        title: 'Produce image updated',
        description: log.reason || 'Produce listing image was uploaded or replaced.',
        timestamp: log.timestamp,
      });
    } else if (log.action === 'delete_listing_image') {
      priceActivity.push({
        id: `act-${log.id}`,
        eventType: 'listing_updated',
        title: 'Produce image removed',
        description: log.reason || 'Produce listing image was removed.',
        timestamp: log.timestamp,
      });
    } else if (log.action === 'update_listing') {
      const updatedFields = Object.keys(changes);
      priceActivity.push({
        id: `act-${log.id}`,
        eventType: 'listing_updated',
        title: 'Listing details updated',
        description:
          log.reason ||
          (updatedFields.length > 0
            ? `Updated fields: ${updatedFields.join(', ')}.`
            : 'Produce listing details updated by farmer.'),
        timestamp: log.timestamp,
      });
    }
  });

  return { priceHistory, priceActivity };
}

function mapAllocationsToActivityEvents(allocations) {
  return allocations.map((al) => {
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

    return {
      id: `act-al-${al.id}`,
      eventType,
      title,
      description: `${al.allocatedKg} kg allocated to ${al.buyerName} (${al.id}).`,
      timestamp: al.allocatedOn,
    };
  });
}

function mapOrdersToActivityEvents(orders) {
  return orders.map((ord) => {
    let title = 'Order placed';
    let eventType = 'order_placed';

    if (['delivered', 'closed'].includes(ord.status)) {
      title = 'Order completed';
      eventType = 'order_completed';
    } else if (['in_fulfilment'].includes(ord.status)) {
      title = 'Order in fulfillment';
      eventType = 'status_change';
    }

    return {
      id: `act-ord-${ord.id}`,
      eventType,
      title,
      description: `${ord.orderKg} kg order placed by ${ord.buyerName} (${ord.id}).`,
      timestamp: ord.orderDate,
    };
  });
}

export function buildSortedActivityLog({
  listingId,
  createdAt,
  offeredKg,
  unitPriceCents,
  priceActivity,
  allocations,
  orders,
}) {
  const activityLog = [
    {
      id: `act-created-${listingId}`,
      eventType: 'listing_created',
      title: 'Listing created',
      description: `Produce listing published with ${offeredKg} kg at LKR ${(unitPriceCents / 100).toFixed(0)} / kg.`,
      timestamp: createdAt,
    },
    ...priceActivity,
    ...mapAllocationsToActivityEvents(allocations),
    ...mapOrdersToActivityEvents(orders),
  ];

  const uniqueActivityMap = new Map();
  activityLog.forEach((event) => {
    if (!uniqueActivityMap.has(event.id)) {
      uniqueActivityMap.set(event.id, event);
    }
  });

  return Array.from(uniqueActivityMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function mapListingDetailsResponse({
  listingRow,
  allocationRows,
  orderRows,
  auditRows,
  resolveImageUrl,
}) {
  const stock = computeStockMetrics(listingRow);
  const allocations = allocationRows.map(mapAllocationRow);
  const orders = orderRows.map(mapOrderRow);
  const { priceHistory, priceActivity } = extractPriceHistoryAndAuditEvents(auditRows);
  const priceTrend = [];

  const activityLog = buildSortedActivityLog({
    listingId: listingRow.id,
    createdAt: listingRow.createdAt,
    offeredKg: stock.offeredKg,
    unitPriceCents: stock.unitPriceCents,
    priceActivity,
    allocations,
    orders,
  });

  return {
    ...stripInternalImageKey(listingRow),
    ...stock,
    imageUrl: resolvePublicImageUrl(listingRow.imageKey, resolveImageUrl),
    batchNumber: listingRow.batchNumber,
    allocations,
    orders,
    priceHistory,
    priceTrend,
    activityLog,
  };
}
