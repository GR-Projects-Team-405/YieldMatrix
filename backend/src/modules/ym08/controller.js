import pool from '../../config/db.js';
// YM08 · Imalka Deshan · Harvest management

const KG_RE = /^\d{1,9}(\.\d{1,3})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EDIT_STATUSES = ['planned', 'ready', 'harvested', 'cancelled'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM08', owner: 'Imalka Deshan', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getMyHarvestBatches(req, res, next) {
  try {
    const account = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, 'farmer', 'approved']
    );
    if (!account.rows[0]) {
      return res.status(403).json({
        error: 'Account is not approved',
        requestId: req.requestId
      });
    }

    const { rows } = await pool.query(
      `SELECT hb.id,
              c.name AS crop_name,
              g.name AS grade_name,
              f.name AS farm_name,
              hb.planned_kg,
              hb.actual_kg,
              COALESCE(hb.actual_kg, hb.planned_kg) AS quantity_kg,
              COALESCE(hb.actual_harvest_date, hb.planned_harvest_date)::text AS harvest_date,
              hb.status
       FROM harvest_batches hb
       JOIN farms f ON f.id = hb.farm_id AND f.farmer_id = hb.farmer_id
       JOIN crops c ON c.id = hb.crop_id
       JOIN grades g ON g.id = hb.grade_id
       WHERE hb.farmer_id = $1
       ORDER BY COALESCE(hb.actual_harvest_date, hb.planned_harvest_date) DESC`,
      [req.user.id]
    );

    res.json({ batches: rows, requestId: req.requestId });
  } catch (error) {
    console.error('YM08 harvest-batches error:', error.code, error.message);
    next(error);
  }
}

export async function getBatchFormOptions(req, res, next) {
  try {
    const farms = await pool.query(
      "SELECT id, name FROM farms WHERE farmer_id = $1 AND status = 'active' ORDER BY name",
      [req.user.id]
    );
    const crops = await pool.query('SELECT id, name FROM crops WHERE active = true ORDER BY name');
    const grades = await pool.query('SELECT id, name FROM grades WHERE active = true ORDER BY name');
    res.json({
      farms: farms.rows,
      crops: crops.rows,
      grades: grades.rows,
      requestId: req.requestId
    });
  } catch (error) {
    console.error('YM08 form-options error:', error.code, error.message);
    next(error);
  }
}

export async function createHarvestBatch(req, res, next) {
  try {
    const { farmId, cropId, gradeId, plannedKg, plannedHarvestDate } = req.body ?? {};

    if (!farmId || !cropId || !gradeId || !plannedKg || !plannedHarvestDate) {
      return res.status(400).json({ error: 'All fields are required', requestId: req.requestId });
    }
    const raw = String(plannedKg);
    if (!KG_RE.test(raw) || Number(raw) <= 0) {
      return res.status(400).json({
        error: 'Quantity must be positive with up to 3 decimals',
        requestId: req.requestId
      });
    }
    if (!DATE_RE.test(String(plannedHarvestDate))) {
      return res.status(400).json({ error: 'Invalid date', requestId: req.requestId });
    }

    const account = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, 'farmer', 'approved']
    );
    if (!account.rows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    // Ownership: the farm must belong to the logged-in farmer.
    const farm = await pool.query(
      'SELECT id FROM farms WHERE id = $1 AND farmer_id = $2',
      [farmId, req.user.id]
    );
    if (!farm.rows[0]) {
      return res.status(403).json({ error: 'Farm not found for this farmer', requestId: req.requestId });
    }

    const { rows } = await pool.query(
      `INSERT INTO harvest_batches
         (farm_id, farmer_id, crop_id, grade_id, planned_kg, planned_harvest_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status`,
      [farmId, req.user.id, cropId, gradeId, raw, plannedHarvestDate]
    );

    res.status(201).json({ batch: rows[0], requestId: req.requestId });
  } catch (error) {
    console.error('YM08 create batch error:', error.code, error.message);
    next(error);
  }
}

export async function getHarvestBatch(req, res, next) {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Batch not found', requestId: req.requestId });
    }
    const { rows } = await pool.query(
      `SELECT hb.id, hb.farm_id, hb.crop_id, hb.grade_id,
              c.name AS crop_name, g.name AS grade_name, f.name AS farm_name,
              hb.planned_kg::text AS planned_kg,
              hb.actual_kg::text AS actual_kg,
              hb.sellable_kg::text AS sellable_kg,
              hb.planned_harvest_date::text AS planned_harvest_date,
              hb.actual_harvest_date::text AS actual_harvest_date,
              hb.status, hb.revision,
              hb.created_at
       FROM harvest_batches hb
       JOIN farms f ON f.id = hb.farm_id
       JOIN crops c ON c.id = hb.crop_id
       JOIN grades g ON g.id = hb.grade_id
       WHERE hb.id = $1 AND hb.farmer_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Batch not found', requestId: req.requestId });
    }
    res.json({ batch: rows[0], requestId: req.requestId });
  } catch (error) {
    console.error('YM08 get batch error:', error.code, error.message);
    next(error);
  }
}

export async function updateHarvestBatch(req, res, next) {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Batch not found', requestId: req.requestId });
    }
    const { plannedKg, plannedHarvestDate, actualKg, actualHarvestDate, status, revision } = req.body ?? {};

    if (!KG_RE.test(String(plannedKg ?? '')) || Number(plannedKg) <= 0) {
      return res.status(400).json({ error: 'Planned quantity must be positive with up to 3 decimals', requestId: req.requestId });
    }
    if (!DATE_RE.test(String(plannedHarvestDate ?? ''))) {
      return res.status(400).json({ error: 'Invalid planned date', requestId: req.requestId });
    }
    if (!EDIT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', requestId: req.requestId });
    }
    const hasActual = actualKg !== undefined && actualKg !== null && actualKg !== '';
    if (hasActual && (!KG_RE.test(String(actualKg)) || Number(actualKg) < 0)) {
      return res.status(400).json({ error: 'Actual quantity must be non-negative with up to 3 decimals', requestId: req.requestId });
    }
    if (actualHarvestDate && !DATE_RE.test(String(actualHarvestDate))) {
      return res.status(400).json({ error: 'Invalid actual date', requestId: req.requestId });
    }
    if (status === 'harvested' && (!hasActual || !actualHarvestDate)) {
      return res.status(400).json({ error: 'Actual quantity and date are required when harvested', requestId: req.requestId });
    }
    if (!Number.isInteger(revision)) {
      return res.status(400).json({ error: 'Revision is required', requestId: req.requestId });
    }

    const account = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, 'farmer', 'approved']
    );
    if (!account.rows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    // Ownership + optimistic concurrency (revision) + only editable states.
    const { rows } = await pool.query(
      `UPDATE harvest_batches
          SET planned_kg = $1, planned_harvest_date = $2,
              actual_kg = $3, actual_harvest_date = $4,
              status = $5, revision = revision + 1
        WHERE id = $6 AND farmer_id = $7 AND revision = $8
          AND status IN ('planned','ready')
        RETURNING id, status, revision`,
      [
        String(plannedKg), plannedHarvestDate,
        hasActual ? String(actualKg) : null,
        actualHarvestDate || null,
        status, req.params.id, req.user.id, revision
      ]
    );
    if (!rows[0]) {
      return res.status(409).json({
        error: 'Batch was changed, is not editable, or was not found. Reload and try again.',
        requestId: req.requestId
      });
    }
    res.json({ batch: rows[0], requestId: req.requestId });
  } catch (error) {
    console.error('YM08 update batch error:', error.code, error.message);
    next(error);
  }
}