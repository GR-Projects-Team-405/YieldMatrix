import pool from '../../config/db.js';

const DISTRICT_COORDS = {
  Colombo: { lat: 6.9271, lon: 79.8612 },
  'Colombo Wholesale Market': { lat: 6.9417, lon: 79.8634 },
  Kandy: { lat: 7.2906, lon: 80.6337 },
  Gampaha: { lat: 7.0873, lon: 80.0144 },
  Kurunegala: { lat: 7.4863, lon: 80.3623 },
  'Nuwara Eliya': { lat: 6.9497, lon: 80.7891 },
};

const MONTH_MAP = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function haversineKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null ||
    Number.isNaN(Number(lat1)) ||
    Number.isNaN(Number(lon1)) ||
    Number.isNaN(Number(lat2)) ||
    Number.isNaN(Number(lon2))
  ) {
    return null;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(Number(lat1))) *
      Math.cos(toRad(Number(lat2))) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(1));
}

function isValidThreeDecimalNumber(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return false;
    const str = String(value);
    const parts = str.split('.');
    return parts.length === 1 || parts[1].length <= 3;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return false;
    const parts = trimmed.split('.');
    return parts.length === 1 || parts[1].length <= 3;
  }
  return false;
}

function parseDeliveryDateMs(deliveryWindow) {
  if (!deliveryWindow) return null;

  const isoMatch = deliveryWindow.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const dt = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? null : dt.getTime();
  }

  const namedMatch = deliveryWindow.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (namedMatch) {
    const day = Number(namedMatch[1]);
    const monthIdx = MONTH_MAP[namedMatch[2].slice(0, 3).toLowerCase()];
    const year = Number(namedMatch[3]);
    if (monthIdx !== undefined) {
      const dt = new Date(Date.UTC(year, monthIdx, day, 12, 0, 0));
      return Number.isNaN(dt.getTime()) ? null : dt.getTime();
    }
  }

  return null;
}

function isCompatibleWithDeliveryWindow(row, deliveryDateMs) {
  if (deliveryDateMs === null) return true;

  const validFromMs = row.valid_from ? new Date(row.valid_from).getTime() : null;
  const validUntilMs = row.valid_until ? new Date(row.valid_until).getTime() : null;

  if (validFromMs !== null && !Number.isNaN(validFromMs) && deliveryDateMs < validFromMs - 86400000) {
    return false;
  }
  if (validUntilMs !== null && !Number.isNaN(validUntilMs) && deliveryDateMs > validUntilMs + 86400000) {
    return false;
  }

  const harvestDateRaw = row.actual_harvest_date || row.planned_harvest_date;
  if (harvestDateRaw) {
    const harvestMs = new Date(harvestDateRaw).getTime();
    if (!Number.isNaN(harvestMs) && deliveryDateMs < harvestMs - 86400000) {
      return false;
    }
  }

  return true;
}

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
      module: 'YM15',
      owner: 'Nadisha Buddhini',
      status: 'active',
      user: rows[0],
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

export async function runBulkMatch(req, res, next) {
  try {
    const { rows: buyerRows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!buyerRows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const body = req.body ?? {};
    const cropName = typeof body.crop === 'string' ? body.crop.trim() : '';
    const gradeName = typeof body.grade === 'string' ? body.grade.trim() : '';
    const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
    const deliveryWindow = typeof body.deliveryWindow === 'string' ? body.deliveryWindow.trim() : '';
    const allowPartial = Boolean(body.allowPartial);

    if (!cropName || !gradeName || !destination) {
      return res.status(400).json({
        error: 'Crop, grade, and destination are required.',
        requestId: req.requestId,
      });
    }

    if (!isValidThreeDecimalNumber(body.requiredKg)) {
      return res.status(400).json({
        error: 'Required quantity must be a positive number with up to 3 decimal places.',
        requestId: req.requestId,
      });
    }

    const requestedKg = Number(Number(body.requiredKg).toFixed(3));

    let maxBudgetLkr = null;
    let maxBudgetCents = null;
    if (body.maxBudgetLkr !== null && body.maxBudgetLkr !== undefined && String(body.maxBudgetLkr).trim() !== '') {
      const budgetNum = Number(body.maxBudgetLkr);
      if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
        return res.status(400).json({
          error: 'Maximum goods total must be a positive number in LKR.',
          requestId: req.requestId,
        });
      }
      maxBudgetLkr = Number(budgetNum.toFixed(2));
      maxBudgetCents = Math.round(maxBudgetLkr * 100);
    }

    const { rows: candidateRows } = await pool.query(
      `SELECT
         l.id AS listing_id,
         l.batch_id,
         l.unit_price_cents,
         l.offered_kg,
         l.valid_from,
         l.valid_until,
         hb.farmer_id,
         hb.farm_id,
         hb.planned_harvest_date,
         hb.actual_harvest_date,
         hb.status AS batch_status,
         COALESCE(ba.available_kg, 0)::NUMERIC(12,3) AS available_kg,
         c.name AS crop_name,
         g.name AS grade_name,
         u.name AS grower_name,
         f.name AS farm_name,
         f.district AS farm_district,
         f.latitude AS farm_latitude,
         f.longitude AS farm_longitude
       FROM listings l
       JOIN harvest_batches hb ON hb.id = l.batch_id
       JOIN crops c ON c.id = hb.crop_id
       JOIN grades g ON g.id = hb.grade_id
       JOIN users u ON u.id = hb.farmer_id
       JOIN farms f ON f.id = hb.farm_id AND f.farmer_id = hb.farmer_id
       LEFT JOIN batch_availability ba ON ba.batch_id = hb.id
       WHERE l.status = 'active'
         AND now() >= l.valid_from
         AND now() <= l.valid_until
         AND u.role = 'farmer'
         AND u.approval_status = 'approved'
         AND f.status = 'active'
         AND c.active = true
         AND g.active = true
         AND lower(c.name) = lower($1)
         AND lower(g.name) = lower($2)
         AND hb.status IN ('ready', 'harvested')`,
      [cropName, gradeName]
    );

    const destCoords = DISTRICT_COORDS[destination] ?? null;
    const deliveryDateMs = parseDeliveryDateMs(deliveryWindow);

    const rankedCandidates = candidateRows
      .filter((row) => isCompatibleWithDeliveryWindow(row, deliveryDateMs))
      .map((row) => {
        const availableByBatch = Math.max(0, Number(row.available_kg ?? 0));
        const offeredCap = Math.max(0, Number(row.offered_kg ?? 0));
        const effectiveAvailableKg = Number(Math.min(availableByBatch, offeredCap).toFixed(3));
        const unitPriceCents = Number(row.unit_price_cents);
        const unitPriceLkr = Number((unitPriceCents / 100).toFixed(2));
        const distanceKm = destCoords
          ? haversineKm(row.farm_latitude, row.farm_longitude, destCoords.lat, destCoords.lon)
          : null;

        return {
          listingId: row.listing_id,
          batchId: row.batch_id,
          batchCode: `BATCH-${String(row.batch_id).slice(0, 8).toUpperCase()}`,
          growerName: row.grower_name,
          farmName: row.farm_name,
          farmDistrict: row.farm_district,
          crop: row.crop_name,
          grade: row.grade_name,
          availableKg: effectiveAvailableKg,
          unitPriceLkr,
          unitPriceCents,
          distanceKm,
        };
      })
      .filter((item) => item.availableKg > 0)
      .sort((a, b) => {
        if (a.unitPriceCents !== b.unitPriceCents) {
          return a.unitPriceCents - b.unitPriceCents;
        }
        const distA = a.distanceKm === null ? Number.POSITIVE_INFINITY : a.distanceKm;
        const distB = b.distanceKm === null ? Number.POSITIVE_INFINITY : b.distanceKm;
        if (distA !== distB) {
          return distA - distB;
        }
        return String(a.listingId).localeCompare(String(b.listingId));
      });

    let remainingNeededKg = requestedKg;
    let runningGoodsTotalCents = 0;
    const selectedAllocations = [];
    const unselectedCandidates = [];

    for (const candidate of rankedCandidates) {
      if (remainingNeededKg <= 0) {
        unselectedCandidates.push({
          id: candidate.listingId,
          growerName: candidate.growerName,
          farmName: candidate.farmName,
          batchCode: candidate.batchCode,
          crop: candidate.crop,
          grade: candidate.grade,
          availableKg: candidate.availableKg,
          unitPriceLkr: candidate.unitPriceLkr,
          distanceKm: candidate.distanceKm,
          statusLabel: 'Not Selected',
          reasonText:
            'Not selected because higher-ranked eligible listings already fulfilled the requested quantity.',
        });
        continue;
      }

      const takeKg = Number(Math.min(remainingNeededKg, candidate.availableKg).toFixed(3));
      const allocationTotalCents = Math.round(takeKg * candidate.unitPriceCents);
      const allocationTotalLkr = Number((allocationTotalCents / 100).toFixed(2));

      if (maxBudgetCents !== null && runningGoodsTotalCents + allocationTotalCents > maxBudgetCents) {
        unselectedCandidates.push({
          id: candidate.listingId,
          growerName: candidate.growerName,
          farmName: candidate.farmName,
          batchCode: candidate.batchCode,
          crop: candidate.crop,
          grade: candidate.grade,
          availableKg: candidate.availableKg,
          unitPriceLkr: candidate.unitPriceLkr,
          distanceKm: candidate.distanceKm,
          statusLabel: 'Over Budget',
          reasonText: `Excluded because adding this batch would exceed the LKR ${maxBudgetLkr.toLocaleString()} budget cap.`,
        });
        continue;
      }

      const rank = selectedAllocations.length + 1;
      remainingNeededKg = Number((remainingNeededKg - takeKg).toFixed(3));
      runningGoodsTotalCents += allocationTotalCents;

      selectedAllocations.push({
        id: candidate.listingId,
        rank,
        growerName: candidate.growerName,
        farmName: candidate.farmName,
        batchCode: candidate.batchCode,
        distanceKm: candidate.distanceKm,
        allocatedKg: takeKg,
        unitPriceLkr: candidate.unitPriceLkr,
        allocationTotalLkr,
        crop: candidate.crop,
        grade: candidate.grade,
        availableKg: candidate.availableKg,
        ruleTag:
          rank === 1
            ? 'Lowest price'
            : candidate.distanceKm !== null
              ? 'Ranked next by price & distance'
              : 'Ranked next by price & listing ID',
      });
    }

    const matchedKg = Number((requestedKg - remainingNeededKg).toFixed(3));
    const shortageKg = remainingNeededKg;
    const goodsTotalLkr = Number((runningGoodsTotalCents / 100).toFixed(2));
    const status = shortageKg === 0 ? 'complete' : 'partial';
    const partialBlocked = status === 'partial' && !allowPartial;
    const matchedPercent = requestedKg > 0 ? Math.min(100, Math.round((matchedKg / requestedKg) * 100)) : 0;
    const shortagePercent = requestedKg > 0 ? Math.max(0, 100 - matchedPercent) : 0;

    return res.json({
      status,
      partialBlocked,
      methodLabel: 'Rule-based method',
      crop: cropName,
      grade: gradeName,
      destination,
      deliveryWindow,
      allowPartial,
      requestedKg,
      matchedKg,
      shortageKg,
      matchedPercent,
      shortagePercent,
      goodsTotalLkr,
      maxBudgetLkr,
      withinBudget: maxBudgetCents === null ? true : runningGoodsTotalCents <= maxBudgetCents,
      growerCount: selectedAllocations.length,
      allocations: selectedAllocations,
      alternatives: unselectedCandidates,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}