import pg from 'pg';
import pool from '../../config/db.js';

// Ensure Neon PostgreSQL connections use direct SSL negotiation
pg.defaults.sslnegotiation = 'direct';
process.env.PGSSLNEGOTIATION = 'direct';
if (pool?.options) {
  pool.options.sslnegotiation = 'direct';
}

// YM04 · Chamasha Saminidi Stuwart · Reference data & audit

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

function getValidUuidOrNull(id) {
  return isValidUuid(id) ? id : null;
}

async function verifyApprovedAdmin(userId, clientOrPool = pool) {
  if (!isValidUuid(userId)) return null;
  const { rows } = await clientOrPool.query(
    "SELECT id, name, email, role FROM users WHERE id = $1 AND role = 'admin' AND approval_status = 'approved'",
    [userId]
  );
  return rows[0] || null;
}

/**
 * GET /api/ym04/status
 * Preserves the scaffold status check intact.
 */
export async function getStatus(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({
      module: 'YM04',
      owner: 'Chamasha Saminidi Stuwart',
      status: 'scaffold',
      user: rows[0],
      requestId: req.requestId
    });
  } catch (error) {
    console.error('YM04 getStatus error:', error);
    next(error);
  }
}

/**
 * GET /api/ym04/overview
 * Returns summary counts and lists of crops & grades ordered alphabetically.
 */
export async function getOverview(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const [cropsResult, gradesResult] = await Promise.all([
      pool.query('SELECT id, name, active FROM crops ORDER BY name ASC'),
      pool.query('SELECT id, name, description, active FROM grades ORDER BY name ASC')
    ]);

    const crops = cropsResult.rows;
    const grades = gradesResult.rows;

    const totalCrops = crops.length;
    const activeCrops = crops.filter((c) => c.active).length;
    const inactiveCrops = totalCrops - activeCrops;

    const totalGrades = grades.length;
    const activeGrades = grades.filter((g) => g.active).length;
    const inactiveGrades = totalGrades - activeGrades;

    return res.json({
      totalCrops,
      activeCrops,
      inactiveCrops,
      totalGrades,
      activeGrades,
      inactiveGrades,
      summary: {
        totalCrops,
        activeCrops,
        inactiveCrops,
        totalGrades,
        activeGrades,
        inactiveGrades
      },
      crops,
      grades,
      requestId: req.requestId
    });
  } catch (error) {
    console.error('YM04 getOverview error:', error);
    next(error);
  }
}

/**
 * GET /api/ym04/crops
 * Supports query params: search (ILIKE on name), status (all | active | inactive), page (default 1), limit (default 10, max 50).
 */
export async function getCrops(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      params.push(`%${req.query.search.trim()}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }

    const status = (req.query.status || 'all').toString().toLowerCase();
    if (status === 'active') {
      conditions.push('active = true');
    } else if (status === 'inactive') {
      conditions.push('active = false');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summaryPromise = pool.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE active = true)::int AS active,
        count(*) FILTER (WHERE active = false)::int AS inactive
      FROM crops
    `);
    const countPromise = pool.query(`SELECT count(*)::int AS total FROM crops ${whereClause}`, params);
    const listParams = [...params, limit, offset];
    const listPromise = pool.query(
      `SELECT id, name, active FROM crops ${whereClause} ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    );

    const [summaryRes, countRes, listRes] = await Promise.all([summaryPromise, countPromise, listPromise]);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;
    const summary = summaryRes.rows[0] || { total: 0, active: 0, inactive: 0 };

    return res.json({
      crops: listRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      summary,
      requestId: req.requestId
    });
  } catch (error) {
    console.error('YM04 getCrops error:', error);
    next(error);
  }
}

/**
 * POST /api/ym04/crops
 * Creates a crop and inserts an audit log within a single transaction.
 */
export async function createCrop(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { name, active, reason } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({
        error: 'Crop name is required and must not exceed 100 characters',
        requestId: req.requestId
      });
    }

    const trimmedName = name.trim();
    const isActive = active !== undefined ? Boolean(active) : true;
    const auditReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'New crop added to system';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertRes = await client.query(
        'INSERT INTO crops (name, active) VALUES ($1, $2) RETURNING id, name, active',
        [trimmedName, isActive]
      );
      const createdCrop = insertRes.rows[0];

      const safeChanges = {
        targetName: createdCrop.name,
        status: 'Success',
        previousValues: null,
        newValues: {
          name: createdCrop.name,
          active: createdCrop.active
        },
        changeDescription: `A new crop '${createdCrop.name}' was added to the system.`
      };

      await client.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          admin.id,
          'Created',
          'Crop',
          createdCrop.id,
          getValidUuidOrNull(req.requestId),
          auditReason,
          JSON.stringify(safeChanges)
        ]
      );

      await client.query('COMMIT');
      return res.status(201).json({
        crop: createdCrop,
        requestId: req.requestId
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      if (txError.code === '23505') {
        return res.status(409).json({
          error: 'A crop with this name already exists',
          requestId: req.requestId
        });
      }
      console.error('YM04 createCrop txError:', txError);
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('YM04 createCrop error:', error);
    next(error);
  }
}

/**
 * PATCH /api/ym04/crops/:id
 * Updates crop name and/or active status and logs audit entry within a single transaction.
 */
export async function updateCrop(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid ID format', requestId: req.requestId });
    }

    const { name, active, reason } = req.body || {};
    if (name === undefined && active === undefined) {
      return res.status(400).json({
        error: 'At least one field (name or active) must be provided for update',
        requestId: req.requestId
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        return res.status(400).json({
          error: 'Crop name must be a non-empty string not exceeding 100 characters',
          requestId: req.requestId
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingRes = await client.query(
        'SELECT id, name, active FROM crops WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (!existingRes.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Crop not found', requestId: req.requestId });
      }
      const existing = existingRes.rows[0];

      const updatedName = name !== undefined ? name.trim() : existing.name;
      const updatedActive = active !== undefined ? Boolean(active) : existing.active;

      const action = (existing.active === true && updatedActive === false) ? 'Deactivated' : 'Updated';
      const defaultReason = action === 'Deactivated'
        ? `Crop '${updatedName}' deactivated`
        : `Crop '${updatedName}' updated`;
      const auditReason = typeof reason === 'string' && reason.trim() ? reason.trim() : defaultReason;

      const updateRes = await client.query(
        'UPDATE crops SET name = $1, active = $2 WHERE id = $3 RETURNING id, name, active',
        [updatedName, updatedActive, id]
      );
      const updatedCrop = updateRes.rows[0];

      const safeChanges = {
        targetName: updatedCrop.name,
        status: 'Success',
        previousValues: {
          name: existing.name,
          active: existing.active
        },
        newValues: {
          name: updatedCrop.name,
          active: updatedCrop.active
        },
        changeDescription: action === 'Deactivated'
          ? `Crop '${updatedCrop.name}' was deactivated.`
          : `Crop '${updatedCrop.name}' was updated.`
      };

      await client.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          admin.id,
          action,
          'Crop',
          updatedCrop.id,
          getValidUuidOrNull(req.requestId),
          auditReason,
          JSON.stringify(safeChanges)
        ]
      );

      await client.query('COMMIT');
      return res.json({
        crop: updatedCrop,
        requestId: req.requestId
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      if (txError.code === '23505') {
        return res.status(409).json({
          error: 'A crop with this name already exists',
          requestId: req.requestId
        });
      }
      console.error('YM04 updateCrop txError:', txError);
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('YM04 updateCrop error:', error);
    next(error);
  }
}

/**
 * GET /api/ym04/grades
 * Supports query params: search (ILIKE on name or description), status (all | active | inactive), page, limit.
 */
export async function getGrades(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      params.push(`%${req.query.search.trim()}%`);
      conditions.push(`(name ILIKE $${params.length} OR COALESCE(description, '') ILIKE $${params.length})`);
    }

    const status = (req.query.status || 'all').toString().toLowerCase();
    if (status === 'active') {
      conditions.push('active = true');
    } else if (status === 'inactive') {
      conditions.push('active = false');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summaryPromise = pool.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE active = true)::int AS active,
        count(*) FILTER (WHERE active = false)::int AS inactive
      FROM grades
    `);
    const countPromise = pool.query(`SELECT count(*)::int AS total FROM grades ${whereClause}`, params);
    const listParams = [...params, limit, offset];
    const listPromise = pool.query(
      `SELECT id, name, description, active FROM grades ${whereClause} ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    );

    const [summaryRes, countRes, listRes] = await Promise.all([summaryPromise, countPromise, listPromise]);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;
    const summary = summaryRes.rows[0] || { total: 0, active: 0, inactive: 0 };

    return res.json({
      grades: listRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      summary,
      requestId: req.requestId
    });
  } catch (error) {
    console.error('YM04 getGrades error:', error);
    next(error);
  }
}

/**
 * POST /api/ym04/grades
 * Creates a grade standard and records audit entry within a single transaction.
 */
export async function createGrade(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { name, description = null, active = true, reason } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({
        error: 'Grade name is required and must not exceed 100 characters',
        requestId: req.requestId
      });
    }

    const trimmedName = name.trim();
    const trimmedDescription = typeof description === 'string' && description.trim() ? description.trim() : null;
    const isActive = active !== undefined ? Boolean(active) : true;
    const auditReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'New grade standard added to system';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertRes = await client.query(
        'INSERT INTO grades (name, description, active) VALUES ($1, $2, $3) RETURNING id, name, description, active',
        [trimmedName, trimmedDescription, isActive]
      );
      const createdGrade = insertRes.rows[0];

      const safeChanges = {
        targetName: createdGrade.name,
        status: 'Success',
        previousValues: null,
        newValues: {
          name: createdGrade.name,
          description: createdGrade.description,
          active: createdGrade.active
        },
        changeDescription: `A new quality grade '${createdGrade.name}' was added to the system.`
      };

      await client.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          admin.id,
          'Created',
          'Grade',
          createdGrade.id,
          getValidUuidOrNull(req.requestId),
          auditReason,
          JSON.stringify(safeChanges)
        ]
      );

      await client.query('COMMIT');
      return res.status(201).json({
        grade: createdGrade,
        requestId: req.requestId
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      if (txError.code === '23505') {
        return res.status(409).json({
          error: 'A grade with this name already exists',
          requestId: req.requestId
        });
      }
      console.error('YM04 createGrade txError:', txError);
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('YM04 createGrade error:', error);
    next(error);
  }
}

/**
 * PATCH /api/ym04/grades/:id
 * Updates grade parameters and logs audit entry within a single transaction.
 */
export async function updateGrade(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid ID format', requestId: req.requestId });
    }

    const { name, description, active, reason } = req.body || {};
    if (name === undefined && description === undefined && active === undefined) {
      return res.status(400).json({
        error: 'At least one field (name, description, or active) must be provided for update',
        requestId: req.requestId
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        return res.status(400).json({
          error: 'Grade name must be a non-empty string not exceeding 100 characters',
          requestId: req.requestId
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingRes = await client.query(
        'SELECT id, name, description, active FROM grades WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (!existingRes.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Grade not found', requestId: req.requestId });
      }
      const existing = existingRes.rows[0];

      const updatedName = name !== undefined ? name.trim() : existing.name;
      const updatedDescription = description !== undefined
        ? (typeof description === 'string' && description.trim() ? description.trim() : null)
        : existing.description;
      const updatedActive = active !== undefined ? Boolean(active) : existing.active;

      const action = (existing.active === true && updatedActive === false) ? 'Deactivated' : 'Updated';
      const defaultReason = action === 'Deactivated'
        ? `Grade '${updatedName}' deactivated`
        : `Grade '${updatedName}' updated`;
      const auditReason = typeof reason === 'string' && reason.trim() ? reason.trim() : defaultReason;

      const updateRes = await client.query(
        'UPDATE grades SET name = $1, description = $2, active = $3 WHERE id = $4 RETURNING id, name, description, active',
        [updatedName, updatedDescription, updatedActive, id]
      );
      const updatedGrade = updateRes.rows[0];

      const safeChanges = {
        targetName: updatedGrade.name,
        status: 'Success',
        previousValues: {
          name: existing.name,
          description: existing.description,
          active: existing.active
        },
        newValues: {
          name: updatedGrade.name,
          description: updatedGrade.description,
          active: updatedGrade.active
        },
        changeDescription: action === 'Deactivated'
          ? `Grade '${updatedGrade.name}' was deactivated.`
          : `Grade '${updatedGrade.name}' was updated.`
      };

      await client.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          admin.id,
          action,
          'Grade',
          updatedGrade.id,
          getValidUuidOrNull(req.requestId),
          auditReason,
          JSON.stringify(safeChanges)
        ]
      );

      await client.query('COMMIT');
      return res.json({
        grade: updatedGrade,
        requestId: req.requestId
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      if (txError.code === '23505') {
        return res.status(409).json({
          error: 'A grade with this name already exists',
          requestId: req.requestId
        });
      }
      console.error('YM04 updateGrade txError:', txError);
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('YM04 updateGrade error:', error);
    next(error);
  }
}

/**
 * GET /api/ym04/audit-logs
 * Read-only log query with filters (search, action, actor, targetType, dateFrom, dateTo) and pagination.
 */
export async function getAuditLogs(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      params.push(`%${req.query.search.trim()}%`);
      const pIdx = params.length;
      conditions.push(`(
        COALESCE(a.safe_changes->>'targetName', c.name, g.name, '') ILIKE $${pIdx}
        OR a.action ILIKE $${pIdx}
        OR COALESCE(a.reason, '') ILIKE $${pIdx}
        OR COALESCE(u.name, '') ILIKE $${pIdx}
        OR COALESCE(u.email, '') ILIKE $${pIdx}
        OR a.id::text ILIKE $${pIdx}
      )`);
    }

    if (typeof req.query.action === 'string' && req.query.action.trim() && req.query.action.toLowerCase() !== 'all') {
      params.push(req.query.action.trim());
      conditions.push(`a.action ILIKE $${params.length}`);
    }

    if (typeof req.query.actor === 'string' && req.query.actor.trim() && req.query.actor.toLowerCase() !== 'all') {
      const actorVal = req.query.actor.trim();
      if (isValidUuid(actorVal)) {
        params.push(actorVal);
        conditions.push(`u.id = $${params.length}`);
      } else {
        params.push(`%${actorVal}%`);
        const pIdx = params.length;
        conditions.push(`(u.name ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR COALESCE(u.role, '') ILIKE $${pIdx})`);
      }
    }

    if (typeof req.query.targetType === 'string' && req.query.targetType.trim() && req.query.targetType.toLowerCase() !== 'all') {
      let tType = req.query.targetType.trim();
      if (tType.toLowerCase() === 'crops') tType = 'Crop';
      if (tType.toLowerCase() === 'grades') tType = 'Grade';
      params.push(tType);
      conditions.push(`a.target_type ILIKE $${params.length}`);
    }

    if (typeof req.query.dateFrom === 'string' && req.query.dateFrom.trim()) {
      params.push(req.query.dateFrom.trim());
      conditions.push(`a.occurred_at >= $${params.length}::timestamptz`);
    }

    if (typeof req.query.dateTo === 'string' && req.query.dateTo.trim()) {
      const dTo = req.query.dateTo.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dTo)) {
        params.push(dTo);
        conditions.push(`a.occurred_at < ($${params.length}::date + INTERVAL '1 day')`);
      } else {
        params.push(dTo);
        conditions.push(`a.occurred_at <= $${params.length}::timestamptz`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summaryPromise = pool.query(`
      SELECT
        count(*)::int AS "totalEvents",
        count(*) FILTER (WHERE (a.occurred_at AT TIME ZONE 'Asia/Colombo')::date = (now() AT TIME ZONE 'Asia/Colombo')::date)::int AS "todayEvents",
        count(*) FILTER (WHERE a.target_type IN ('Crop', 'Grade'))::int AS "referenceChanges",
        count(*) FILTER (WHERE u.role = 'admin' OR a.actor_id IS NOT NULL)::int AS "adminActions"
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
    `);

    const countSql = `
      SELECT count(*)::int AS total
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN crops c ON a.target_id = c.id AND a.target_type = 'Crop'
      LEFT JOIN grades g ON a.target_id = g.id AND a.target_type = 'Grade'
      ${whereClause}
    `;
    const countPromise = pool.query(countSql, params);

    const listSql = `
      SELECT
        a.id,
        a.actor_id,
        u.name AS actor_name,
        u.email AS actor_email,
        u.role AS actor_role,
        a.action,
        a.target_type,
        a.target_id,
        a.request_id,
        a.reason,
        a.safe_changes,
        COALESCE(a.safe_changes->>'targetName', c.name, g.name, a.target_type) AS resolved_target_name,
        a.occurred_at,
        a.recorded_at
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN crops c ON a.target_id = c.id AND a.target_type = 'Crop'
      LEFT JOIN grades g ON a.target_id = g.id AND a.target_type = 'Grade'
      ${whereClause}
      ORDER BY a.occurred_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const listParams = [...params, limit, offset];
    const listPromise = pool.query(listSql, listParams);

    const [summaryRes, countRes, listRes] = await Promise.all([summaryPromise, countPromise, listPromise]);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;
    const summary = summaryRes.rows[0] || {
      totalEvents: 0,
      todayEvents: 0,
      referenceChanges: 0,
      adminActions: 0
    };

    const events = listRes.rows.map((row) => {
      const targetName = row.resolved_target_name || row.safe_changes?.targetName || 'Unknown';
      const actor = row.actor_name || 'System';
      let rawStatus = row.safe_changes?.status;
      if (typeof rawStatus === 'object' && rawStatus !== null) {
        rawStatus = rawStatus.status || rawStatus.label || rawStatus.name || rawStatus.value || 'Success';
      }
      const status = typeof rawStatus === 'string' && rawStatus.trim() ? rawStatus.trim() : (rawStatus ? String(rawStatus) : 'Success');

      return {
        id: row.id,
        actor,
        actorEmail: row.actor_email || null,
        actorRole: row.actor_role || null,
        actorId: row.actor_id || null,
        actorAvatar: actor.charAt(0).toUpperCase() || 'S',
        action: row.action,
        target: targetName,
        targetName,
        targetType: row.target_type,
        targetId: row.target_id,
        targetRecordId: row.target_id,
        requestId: row.request_id,
        reason: row.reason,
        status,
        safeChanges: row.safe_changes || {},
        previousValues: row.safe_changes?.previousValues || null,
        newValues: row.safe_changes?.newValues || null,
        changeDescription: row.safe_changes?.changeDescription || null,
        occurredAt: row.occurred_at,
        recordedAt: row.recorded_at,
        dateTime: new Date(row.occurred_at).toLocaleString('en-GB', {
          timeZone: 'Asia/Colombo',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        exactTimestamp: new Date(row.occurred_at).toLocaleString('en-GB', {
          timeZone: 'Asia/Colombo',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        timestamp: new Date(row.occurred_at).getTime()
      };
    });

    return res.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      summary,
      requestId: req.requestId
    });
  } catch (error) {
    console.error('YM04 getAuditLogs error:', error);
    next(error);
  }
}

/**
 * GET /api/ym04/audit-logs/:id
 * Returns full event detail for a given audit log ID.
 */
export async function getAuditLogById(req, res, next) {
  try {
    const admin = await verifyApprovedAdmin(req.user?.id);
    if (!admin) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid ID format', requestId: req.requestId });
    }

    const { rows } = await pool.query(
      `SELECT
         a.id,
         a.actor_id,
         u.name AS actor_name,
         u.email AS actor_email,
         u.role AS actor_role,
         a.action,
         a.target_type,
         a.target_id,
         a.request_id,
         a.reason,
         a.safe_changes,
         COALESCE(a.safe_changes->>'targetName', c.name, g.name, a.target_type) AS resolved_target_name,
         a.occurred_at,
         a.recorded_at
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_id = u.id
       LEFT JOIN crops c ON a.target_id = c.id AND a.target_type = 'Crop'
       LEFT JOIN grades g ON a.target_id = g.id AND a.target_type = 'Grade'
       WHERE a.id = $1`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Audit event not found', requestId: req.requestId });
    }

    const row = rows[0];
    const targetName = row.resolved_target_name || row.safe_changes?.targetName || 'Unknown';
    const actor = row.actor_name || 'System';
    let rawStatus = row.safe_changes?.status;
    if (typeof rawStatus === 'object' && rawStatus !== null) {
      rawStatus = rawStatus.status || rawStatus.label || rawStatus.name || rawStatus.value || 'Success';
    }
    const status = typeof rawStatus === 'string' && rawStatus.trim() ? rawStatus.trim() : (rawStatus ? String(rawStatus) : 'Success');

    const event = {
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      targetRecordId: row.target_id,
      targetName,
      target: targetName,
      reason: row.reason,
      status,
      safeChanges: row.safe_changes || {},
      previousValues: row.safe_changes?.previousValues || null,
      newValues: row.safe_changes?.newValues || null,
      changeDescription: row.safe_changes?.changeDescription || null,
      occurredAt: row.occurred_at,
      recordedAt: row.recorded_at,
      requestId: row.request_id,
      actor,
      actorEmail: row.actor_email || null,
      actorRole: row.actor_role || (row.actor_id ? null : 'system'),
      actorId: row.actor_id || null,
      actorAvatar: actor.charAt(0).toUpperCase() || 'S',
      dateTime: new Date(row.occurred_at).toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      exactTimestamp: new Date(row.occurred_at).toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      timestamp: new Date(row.occurred_at).getTime()
    };

    return res.json({
      event,
      ...event,
      requestId: req.requestId
    });
  } catch (error) {
    console.error('YM04 getAuditLogById error:', error);
    next(error);
  }
}
