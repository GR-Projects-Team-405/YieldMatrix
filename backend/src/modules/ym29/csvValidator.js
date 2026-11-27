// YM29 · Yasindu Janapriya · Zero-dependency strict CSV parser & validator.
// Enforces SRS rules: max 10,000 rows, whole-file rejection on ANY invalid or duplicate row,
// full grade names (Grade A/B/C), require_kg precision (max 3 decimals), and LKR cents conversion.

import { createHash } from 'node:crypto';
import { ALLOWED_DISTRICTS, normalizeDistrict } from './weatherService.js';
import { getColomboTodayIso } from './analytics.js';

export const MAX_CSV_ROWS = 10000;
export const REQUIRED_COLUMNS = ['crop', 'grade', 'district', 'date', 'demand_kg', 'price_per_kg', 'source'];

const DEMAND_KG_REGEX = /^\d+(\.\d{1,3})?$/;
const PRICE_LKR_REGEX = /^\d+(\.\d{1,2})?$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * RFC-4180 compatible CSV parser supporting quoted fields, escaped quotes (""), and CRLF/LF.
 */
export function parseCsvText(rawText) {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: unclosed quoted field');
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Strip trailing completely empty lines
  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

function isValidPastOrTodayDate(dateStr, todayIso) {
  const match = ISO_DATE_REGEX.exec(dateStr);
  if (!match) return { valid: false, reason: 'Invalid date format (expected YYYY-MM-DD)' };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return { valid: false, reason: 'Calendar date does not exist' };
  }
  if (dateStr > todayIso) {
    return { valid: false, reason: `Date ${dateStr} is in the future (today is ${todayIso})` };
  }
  return { valid: true };
}

function lkrStringToCents(priceStr) {
  const [whole, frac = ''] = priceStr.split('.');
  const centsStr = `${whole}${frac.padEnd(2, '0')}`;
  const value = Number(centsStr);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

export function buildCompositeKey(cropId, gradeId, district, observationDate, source) {
  return `${cropId}|${gradeId}|${district}|${observationDate}|${source}`;
}

export async function validateMarketCsv({
  csvText,
  fileName,
  crops,
  grades,
  findExistingKeys,
}) {
  if (typeof csvText !== 'string' || csvText.trim().length === 0) {
    return {
      fatalError: 'Uploaded CSV file is empty.',
    };
  }

  const checksum = createHash('sha256').update(csvText, 'utf8').digest('hex');

  let matrix;
  try {
    matrix = parseCsvText(csvText);
  } catch (err) {
    return {
      fatalError: err.message || 'CSV could not be parsed.',
    };
  }

  if (matrix.length < 2) {
    return {
      fatalError: 'CSV must include a header row and at least one data row.',
    };
  }

  const rawHeaders = matrix[0].map((h) => h.trim().toLowerCase());
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !rawHeaders.includes(col));
  if (missingColumns.length > 0) {
    return {
      fatalError: `Missing required CSV columns: ${missingColumns.join(', ')}. Required headers: ${REQUIRED_COLUMNS.join(', ')}.`,
      missingColumns,
    };
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > MAX_CSV_ROWS) {
    return {
      fatalError: `CSV contains ${dataRows.length.toLocaleString('en-US')} rows, exceeding the maximum limit of ${MAX_CSV_ROWS.toLocaleString('en-US')} rows.`,
    };
  }

  const headerIndex = Object.fromEntries(rawHeaders.map((h, i) => [h, i]));
  const cropMap = new Map(crops.map((c) => [c.name.trim().toLowerCase(), c]));
  const gradeMap = new Map(grades.map((g) => [g.name.trim().toLowerCase(), g]));
  const allowedGradeNames = grades.map((g) => g.name).join(', ');
  const allowedDistrictNames = ALLOWED_DISTRICTS.map((d) => d.name).join(', ');
  const todayIso = getColomboTodayIso();

  const seenInFile = new Map();
  const parsedEntries = [];
  const candidateKeysForDb = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const rowNumber = i + 2; // 1-indexed including header row
    const cells = dataRows[i];
    const getCell = (col) => (cells[headerIndex[col]] ?? '').trim();

    const rawCrop = getCell('crop');
    const rawGrade = getCell('grade');
    const rawDistrict = getCell('district');
    const rawDate = getCell('date');
    const rawDemand = getCell('demand_kg');
    const rawPrice = getCell('price_per_kg');
    const rawSource = getCell('source');

    const issues = [];
    let isDuplicate = false;

    const matchedCrop = cropMap.get(rawCrop.toLowerCase()) || null;
    if (!matchedCrop) {
      issues.push({ field: 'crop', message: `Unknown or inactive crop "${rawCrop || '(empty)'}"` });
    }

    // Strict full grade match (e.g. "Grade A", "Grade B", "Grade C")
    const matchedGrade = gradeMap.get(rawGrade.toLowerCase()) || null;
    if (!matchedGrade) {
      issues.push({ field: 'grade', message: `Invalid grade "${rawGrade || '(empty)'}". Expected one of: ${allowedGradeNames}` });
    }

    const matchedDistrict = normalizeDistrict(rawDistrict);
    if (!matchedDistrict) {
      issues.push({ field: 'district', message: `Unknown district "${rawDistrict || '(empty)'}". Expected one of: ${allowedDistrictNames}` });
    }

    const dateCheck = isValidPastOrTodayDate(rawDate, todayIso);
    if (!dateCheck.valid) {
      issues.push({ field: 'date', message: dateCheck.reason });
    }

    let parsedDemand = null;
    if (!DEMAND_KG_REGEX.test(rawDemand)) {
      issues.push({ field: 'demand_kg', message: `Invalid demand_kg "${rawDemand || '(empty)'}" (must be non-negative with at most 3 decimal places)` });
    } else {
      parsedDemand = Number(rawDemand);
      if (!Number.isFinite(parsedDemand) || parsedDemand < 0 || parsedDemand >= 1000000000) {
        issues.push({ field: 'demand_kg', message: 'demand_kg must be between 0 and 999,999,999.999' });
      }
    }

    let priceCents = null;
    if (!PRICE_LKR_REGEX.test(rawPrice)) {
      issues.push({ field: 'price_per_kg', message: `Invalid price_per_kg "${rawPrice || '(empty)'}" (must be non-negative LKR with at most 2 decimal places)` });
    } else {
      priceCents = lkrStringToCents(rawPrice);
      if (priceCents === null) {
        issues.push({ field: 'price_per_kg', message: 'price_per_kg exceeds safe integer limit' });
      }
    }

    if (!rawSource || rawSource.length > 120) {
      issues.push({ field: 'source', message: 'Source is required (1 to 120 characters)' });
    }

    let compositeKey = null;
    if (matchedCrop && matchedGrade && matchedDistrict && dateCheck.valid && rawSource) {
      compositeKey = buildCompositeKey(matchedCrop.id, matchedGrade.id, matchedDistrict, rawDate, rawSource);
      if (seenInFile.has(compositeKey)) {
        isDuplicate = true;
        issues.push({
          field: 'duplicate',
          message: `Duplicate key within CSV (matches row #${seenInFile.get(compositeKey)})`,
        });
      } else {
        seenInFile.set(compositeKey, rowNumber);
        candidateKeysForDb.push({
          cropId: matchedCrop.id,
          gradeId: matchedGrade.id,
          district: matchedDistrict,
          observationDate: rawDate,
          source: rawSource,
          compositeKey,
        });
      }
    }

    parsedEntries.push({
      rowNumber,
      raw: {
        crop: matchedCrop?.name || rawCrop,
        grade: matchedGrade?.name || rawGrade,
        district: matchedDistrict || rawDistrict,
        date: rawDate,
        demand_kg: rawDemand,
        price_per_kg: rawPrice,
        source: rawSource,
      },
      normalized:
        issues.length === 0
          ? {
              crop_id: matchedCrop.id,
              grade_id: matchedGrade.id,
              district: matchedDistrict,
              observation_date: rawDate,
              demand_kg: rawDemand,
              price_per_kg_cents: priceCents,
              source: rawSource,
            }
          : null,
      compositeKey,
      isDuplicate,
      issues,
    });
  }

  // Check against existing current rows in PostgreSQL (strict duplicate rejection)
  let existingDbKeySet = new Set();
  if (candidateKeysForDb.length > 0 && typeof findExistingKeys === 'function') {
    existingDbKeySet = await findExistingKeys(candidateKeysForDb);
  }

  let validCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  const validatedRows = [];
  const allDisplayRows = [];
  const flaggedRows = [];
  const issueBreakdown = {};

  let minDate = null;
  let maxDate = null;
  const uniqueSources = new Set();
  const uniqueCrops = new Set();
  const uniqueDistricts = new Set();

  for (const entry of parsedEntries) {
    if (entry.compositeKey && existingDbKeySet.has(entry.compositeKey)) {
      entry.isDuplicate = true;
      entry.normalized = null;
      entry.issues.push({
        field: 'duplicate',
        message: 'Duplicate record already exists in market_observations',
      });
    }

    const hasError = entry.issues.length > 0;
    if (hasError) {
      errorCount += 1;
      if (entry.isDuplicate) duplicateCount += 1;
      for (const issue of entry.issues) {
        issueBreakdown[issue.field] = (issueBreakdown[issue.field] || 0) + 1;
      }
    } else {
      validCount += 1;
      validatedRows.push(entry.normalized);
      if (!minDate || entry.normalized.observation_date < minDate) minDate = entry.normalized.observation_date;
      if (!maxDate || entry.normalized.observation_date > maxDate) maxDate = entry.normalized.observation_date;
      uniqueSources.add(entry.normalized.source);
      uniqueCrops.add(entry.raw.crop);
      uniqueDistricts.add(entry.raw.district);
    }

    const displayRow = {
      row_number: entry.rowNumber,
      date: entry.raw.date,
      crop: entry.raw.crop,
      district: entry.raw.district,
      grade: entry.raw.grade,
      demand_kg: entry.raw.demand_kg,
      price_per_kg: entry.raw.price_per_kg,
      source: entry.raw.source,
      status: hasError ? (entry.isDuplicate ? 'duplicate' : 'error') : 'valid',
      issues: entry.issues.map((item) => item.message),
    };

    allDisplayRows.push(displayRow);
    if (hasError) flaggedRows.push(displayRow);
  }

  return {
    fatalError: null,
    fileName,
    checksum,
    totalRows: dataRows.length,
    validCount,
    duplicateCount,
    errorCount,
    canApprove: errorCount === 0 && validCount > 0,
    dateRange: { from: minDate, until: maxDate },
    sources: Array.from(uniqueSources),
    crops: Array.from(uniqueCrops),
    districts: Array.from(uniqueDistricts),
    issueBreakdown,
    rows: allDisplayRows,
    flaggedRows,
    validatedRows,
  };
}
