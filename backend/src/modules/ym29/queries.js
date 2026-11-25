// YM29 · Yasindu Janapriya · Parameterised PostgreSQL queries against existing YieldMatrix tables.
// Zero schema changes — targets users, crops, grades, market_observations, forecast_runs, audit_logs.

import pool from '../../config/db.js';
import { buildCompositeKey } from './csvValidator.js';

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export async function getApprovedUser(userId, role) {
  const { rows } = await pool.query(
    'SELECT id, name, role, district FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
    [userId, role, 'approved'],
  );
  return rows[0] || null;
}

export async function getActiveCrops() {
  const { rows } = await pool.query(
    'SELECT id, name FROM crops WHERE active = true ORDER BY name ASC',
  );
  return rows;
}

export async function getActiveGrades() {
  const { rows } = await pool.query(
    'SELECT id, name, description FROM grades WHERE active = true ORDER BY name ASC',
  );
  return rows;
}

export async function getLatestForecastRun(cropId, district) {
  const { rows } = await pool.query(
    `SELECT fr.*, c.name AS crop_name
     FROM forecast_runs fr
     JOIN crops c ON c.id = fr.crop_id
     WHERE fr.crop_id = $1 AND fr.district = $2
     ORDER BY fr.generated_at DESC
     LIMIT 1`,
    [cropId, district],
  );
  return rows[0] || null;
}

export async function getLatestForecastRunsAll() {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (fr.crop_id, fr.district)
       fr.*, c.name AS crop_name
     FROM forecast_runs fr
     JOIN crops c ON c.id = fr.crop_id
     ORDER BY fr.crop_id, fr.district, fr.generated_at DESC`,
  );
  return rows;
}

export async function getPriceStatsForSelection(cropId, gradeId, district, windowUntilIso) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::INTEGER AS observation_count,
       PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_per_kg_cents) AS p25_cents,
       PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price_per_kg_cents) AS median_cents,
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_per_kg_cents) AS p75_cents,
       MAX(observation_date) AS latest_date,
       BOOL_OR(sample_data) AS any_sample_data,
       MIN(source) AS primary_source
     FROM market_observations
     WHERE is_current = true
       AND crop_id = $1
       AND grade_id = $2
       AND district = $3
       AND observation_date BETWEEN ($4::DATE - 13) AND $4::DATE`,
    [cropId, gradeId, district, windowUntilIso],
  );
  return rows[0] || null;
}

export async function getPriceStatsByAllGrades(cropId, district, windowUntilIso) {
  const { rows } = await pool.query(
    `SELECT
       g.id AS grade_id,
       g.name AS grade_name,
       COUNT(mo.id)::INTEGER AS observation_count,
       PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY mo.price_per_kg_cents) AS p25_cents,
       PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY mo.price_per_kg_cents) AS median_cents,
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY mo.price_per_kg_cents) AS p75_cents,
       MAX(mo.observation_date) AS latest_date,
       BOOL_OR(mo.sample_data) AS any_sample_data,
       MIN(mo.source) AS primary_source
     FROM grades g
     LEFT JOIN market_observations mo
       ON mo.grade_id = g.id
      AND mo.is_current = true
      AND mo.crop_id = $1
      AND mo.district = $2
      AND mo.observation_date BETWEEN ($3::DATE - 13) AND $3::DATE
     WHERE g.active = true
     GROUP BY g.id, g.name
     ORDER BY g.name ASC`,
    [cropId, district, windowUntilIso],
  );
  return rows;
}

export async function getMarketIndexPriceRows(windowUntilIso) {
  const { rows } = await pool.query(
    `SELECT
       c.id AS crop_id,
       c.name AS crop_name,
       g.id AS grade_id,
       g.name AS grade_name,
       mo.district,
       COUNT(*)::INTEGER AS observation_count,
       PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY mo.price_per_kg_cents) AS p25_cents,
       PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY mo.price_per_kg_cents) AS median_cents,
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY mo.price_per_kg_cents) AS p75_cents,
       MAX(mo.observation_date) AS latest_date,
       MIN(mo.source) AS primary_source,
       BOOL_OR(mo.sample_data) AS any_sample_data
     FROM market_observations mo
     JOIN crops c ON c.id = mo.crop_id
     JOIN grades g ON g.id = mo.grade_id
     WHERE mo.is_current = true
       AND mo.observation_date BETWEEN ($1::DATE - 13) AND $1::DATE
     GROUP BY c.id, c.name, g.id, g.name, mo.district
     ORDER BY c.name ASC, mo.district ASC, g.name ASC
     LIMIT 30`,
    [windowUntilIso],
  );
  return rows;
}

export async function findExistingObservationKeys(candidates, client = pool) {
  if (!candidates || candidates.length === 0) return new Set();
  const existing = new Set();
  const chunkSize = 1000;

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    const cropIds = chunk.map((c) => c.cropId);
    const gradeIds = chunk.map((c) => c.gradeId);
    const districts = chunk.map((c) => c.district);
    const dates = chunk.map((c) => c.observationDate);
    const sources = chunk.map((c) => c.source);

    const { rows } = await client.query(
      `SELECT mo.crop_id, mo.grade_id, mo.district, mo.observation_date::TEXT AS observation_date, mo.source
       FROM market_observations mo
       JOIN unnest($1::UUID[], $2::UUID[], $3::TEXT[], $4::DATE[], $5::TEXT[])
         AS k(crop_id, grade_id, district, observation_date, source)
         ON mo.crop_id = k.crop_id
        AND mo.grade_id = k.grade_id
        AND mo.district = k.district
        AND mo.observation_date = k.observation_date
        AND mo.source = k.source
       WHERE mo.is_current = true`,
      [cropIds, gradeIds, districts, dates, sources],
    );

    for (const row of rows) {
      existing.add(
        buildCompositeKey(row.crop_id, row.grade_id, row.district, row.observation_date.slice(0, 10), row.source),
      );
    }
  }

  return existing;
}

export async function commitMarketUpload({
  uploadId,
  rows,
  importedBy,
  sampleData,
  fileName,
  checksum,
  dateRange,
  sources,
  crops,
  districts,
  requestId,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-check duplicates inside the transaction to prevent concurrent race conditions
    const candidates = rows.map((r) => ({
      cropId: r.crop_id,
      gradeId: r.grade_id,
      district: r.district,
      observationDate: r.observation_date,
      source: r.source,
    }));
    const existingSet = await findExistingObservationKeys(candidates, client);
    if (existingSet.size > 0) {
      await client.query('ROLLBACK');
      const conflictError = new Error(
        `Commit rejected: ${existingSet.size} row(s) now duplicate existing market observations.`,
      );
      conflictError.code = 'YM29_DUPLICATE_CONFLICT';
      throw conflictError;
    }

    // Batch insert (500 rows * 8 params = 4,000 params per batch)
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = [];
      const placeholders = batch.map((row, idx) => {
        const base = idx * 8;
        values.push(
          row.crop_id,
          row.grade_id,
          row.district,
          row.observation_date,
          row.source,
          row.demand_kg,
          row.price_per_kg_cents,
          sampleData,
        );
        return `($${base + 1}::UUID, $${base + 2}::UUID, $${base + 3}::TEXT, $${base + 4}::DATE, $${base + 5}::TEXT, require_kg($${base + 6}::NUMERIC), $${base + 7}::BIGINT, $${base + 8}::BOOLEAN, $${batch.length * 8 + 1}::UUID)`;
      });
      values.push(importedBy);

      await client.query(
        `INSERT INTO market_observations
           (crop_id, grade_id, district, observation_date, source, demand_kg, price_per_kg_cents, sample_data, imported_by)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
    }

    const safeChanges = {
      file_name: fileName,
      checksum_sha256: checksum,
      row_count: rows.length,
      sample_data: Boolean(sampleData),
      date_from: dateRange?.from || null,
      date_until: dateRange?.until || null,
      sources: sources || [],
      crops: crops || [],
      districts: districts || [],
      status: 'approved',
    };

    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
       VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB)`,
      [
        importedBy,
        'market_data.import_committed',
        'market_upload',
        uploadId,
        requestId || null,
        `Approved and published ${rows.length} market observation rows`,
        JSON.stringify(safeChanges),
      ],
    );

    await client.query('COMMIT');
    return { insertedCount: rows.length, safeChanges };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* Ignore rollback errors after failed transaction */
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function recordUploadRejection({
  uploadId,
  actorId,
  reason,
  metadata,
  requestId,
}) {
  const safeChanges = {
    file_name: metadata.fileName,
    checksum_sha256: metadata.checksum,
    total_rows: metadata.totalRows,
    valid_rows: metadata.validCount,
    duplicate_rows: metadata.duplicateCount,
    error_rows: metadata.errorCount,
    status: 'rejected',
  };

  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
     VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB)`,
    [
      actorId,
      'market_data.import_rejected',
      'market_upload',
      uploadId,
      requestId || null,
      reason,
      JSON.stringify(safeChanges),
    ],
  );
  return safeChanges;
}

export async function getAdminObservationStats() {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::INTEGER AS total_observations,
       COUNT(DISTINCT (crop_id, district))::INTEGER AS active_series_count,
       COUNT(DISTINCT source)::INTEGER AS source_count,
       MIN(observation_date) AS earliest_date,
       MAX(observation_date) AS latest_date,
       MAX(imported_at) AS last_imported_at,
       BOOL_OR(sample_data) AS has_sample_data
     FROM market_observations
     WHERE is_current = true`,
  );

  const seriesRes = await pool.query(
    `SELECT
       c.name AS crop,
       mo.district,
       COUNT(DISTINCT mo.observation_date)::INTEGER AS observed_days,
       MIN(mo.observation_date) AS earliest_date,
       MAX(mo.observation_date) AS latest_date
     FROM market_observations mo
     JOIN crops c ON c.id = mo.crop_id
     WHERE mo.is_current = true
     GROUP BY c.name, mo.district
     ORDER BY c.name ASC, mo.district ASC`,
  );

  return {
    totals: rows[0] || null,
    series: seriesRes.rows,
  };
}

export async function getAdminUploadAuditHistory(limit = 30) {
  const { rows } = await pool.query(
    `SELECT
       al.id,
       al.target_id AS upload_id,
       al.action,
       al.reason,
       al.safe_changes,
       al.occurred_at,
       u.name AS actor_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     WHERE al.target_type = 'market_upload'
     ORDER BY al.occurred_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}
