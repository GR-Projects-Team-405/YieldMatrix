import pool from '../../config/db.js';

const listFields = 'id, name, district, status, created_at';
const detailFields = `${listFields}, pickup_address, latitude, longitude`;
const textLimits = { name: 120, district: 100, pickup_address: 500 };
const coordinateLimits = { latitude: 90, longitude: 180 };

function reply(req, res, status, body) {
  return res.status(status).json({ ...body, requestId: req.requestId });
}

export async function requireApprovedFarmer(req, res, next) {
  try {
    const { rows: [farmer] } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, 'farmer', 'approved']
    );
    if (!farmer) return reply(req, res, 403, { error: 'Account is not approved' });
    req.ym07Farmer = farmer;
    next();
  } catch (error) {
    next(error);
  }
}

export function getStatus(req, res) {
  return reply(req, res, 200, {
    module: 'YM07', owner: 'Hathiff Haleem', status: 'scaffold', user: req.ym07Farmer
  });
}

export function validateFarmId(req, res, next) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(req.params.farmId)) {
    return reply(req, res, 400, { error: 'farmId must be a valid UUID' });
  }
  next();
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateProfile(body, creating) {
  if (!isObject(body) || Object.keys(body).length === 0) {
    return { error: 'Send a JSON object with at least one farm field' };
  }

  const fields = Object.create(null);
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(textLimits, key) && !Object.hasOwn(coordinateLimits, key)) {
      fields[key] = 'Unsupported field';
    }
  }

  const profile = {};
  for (const [key, max] of Object.entries(textLimits)) {
    if (!creating && !Object.hasOwn(body, key)) continue;
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!value || value.length > max || value.includes('\0')) {
      fields[key] = `Enter text between 1 and ${max} characters without null characters`;
    } else {
      profile[key] = value;
    }
  }

  const hasLatitude = Object.hasOwn(body, 'latitude');
  const hasLongitude = Object.hasOwn(body, 'longitude');
  if (hasLatitude || hasLongitude) {
    if (!hasLatitude || !hasLongitude || (body.latitude === null) !== (body.longitude === null)) {
      fields.coordinates = 'Provide both coordinates, or set both to null';
    } else {
      for (const [key, max] of Object.entries(coordinateLimits)) {
        const value = body[key];
        if (value !== null && (typeof value !== 'number' || Math.abs(value) > max ||
            !/^-?\d+(?:\.\d{1,6})?$/.test(String(value)))) {
          fields[key] = `Enter a number from -${max} to ${max} with at most six decimal places`;
        } else {
          profile[key] = value;
        }
      }
    }
  }
  if (Object.keys(fields).length) return { error: 'Invalid farm fields', fields };
  return { profile };
}

function positiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return number <= maximum ? number : null;
}

export async function listFarms(req, res, next) {
  const page = positiveInteger(req.query.page, 1, 1_000_000);
  const limit = positiveInteger(req.query.limit, 20, 100);
  const { search = '', status } = req.query;
  if (Object.keys(req.query).some(key => !['page', 'limit', 'search', 'status'].includes(key)) ||
      !page || !limit || typeof search !== 'string' || search.length > 120 || search.includes('\0') ||
      (status !== undefined && status !== 'active' && status !== 'inactive')) {
    return reply(req, res, 400, { error: 'Invalid farm list query' });
  }
  try {
    const { rows: [result] } = await pool.query(
      `WITH owned AS (
         SELECT ${listFields} FROM farms WHERE farmer_id = $1
       ), filtered AS (
         SELECT * FROM owned
         WHERE ($2::text IS NULL OR status = $2)
           AND (strpos(lower(name), lower($3)) > 0 OR strpos(lower(district), lower($3)) > 0)
       ), page_rows AS (
         SELECT * FROM filtered ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5
       )
       SELECT COALESCE((SELECT json_agg(p ORDER BY p.created_at DESC, p.id DESC)
                        FROM page_rows p), '[]'::json) AS farms,
              (SELECT count(*)::int FROM filtered) AS total,
              json_build_object('total', count(*)::int,
                'active', (count(*) FILTER (WHERE status = 'active'))::int,
                'archived', (count(*) FILTER (WHERE status = 'inactive'))::int,
                'districts', count(DISTINCT district)::int) AS summary
       FROM owned`,
      [req.user.id, status ?? null, search.trim(), limit, (page - 1) * limit]
    );
    return reply(req, res, 200, {
      farms: result.farms, summary: result.summary,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) }
    });
  } catch (error) {
    next(error);
  }
}

export async function getFarm(req, res, next) {
  try {
    const { rows: [farm] } = await pool.query(
      `SELECT ${detailFields}, COALESCE((
         SELECT json_agg(json_build_object(
           'id', b.id, 'crop_name', c.name, 'reserved_kg', a.held_kg::text,
           'uncollected_kg', a.uncollected_kg::text
         ) ORDER BY b.created_at DESC, b.id DESC)
         FROM harvest_batches b
         JOIN crops c ON c.id = b.crop_id
         JOIN batch_availability a ON a.batch_id = b.id
         WHERE b.farm_id = f.id AND b.farmer_id = f.farmer_id
       ), '[]'::json) AS harvest_batches
       FROM farms f WHERE f.id = $1 AND f.farmer_id = $2`,
      [req.params.farmId, req.user.id]
    );
    if (!farm) return reply(req, res, 404, { error: 'Farm not found' });
    return reply(req, res, 200, { farm });
  } catch (error) {
    next(error);
  }
}

async function writeFarm(req, res, next, operation) {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize this module's writes per farmer. The schema has no unique farm-name constraint.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('ym07:farm:' || $1::text, 0))", [req.user.id]);
      const { status, body } = await operation(client);
      await client.query('COMMIT');
      return reply(req, res, status, body);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}

async function duplicateName(client, farmerId, name, exceptId = null) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM farms
     WHERE farmer_id = $1 AND lower(btrim(name)) = lower($2)
       AND ($3::uuid IS NULL OR id <> $3)
     LIMIT 1`,
    [farmerId, name, exceptId]
  );
  return rowCount > 0;
}

async function lockOwnedFarm(client, farmerId, farmId) {
  const { rows: [farm] } = await client.query(
    `SELECT ${detailFields} FROM farms WHERE id = $1 AND farmer_id = $2 FOR UPDATE`,
    [farmId, farmerId]
  );
  return farm;
}

const notFound = { status: 404, body: { error: 'Farm not found' } };
const duplicate = { status: 409, body: { error: 'You already have a farm with this name' } };

export function createFarm(req, res, next) {
  const { profile, ...validation } = validateProfile(req.body, true);
  if (!profile) return reply(req, res, 400, validation);
  return writeFarm(req, res, next, async client => {
    const farmerId = req.user.id;
    if (await duplicateName(client, farmerId, profile.name)) return duplicate;
    const { rows: [farm] } = await client.query(
      `INSERT INTO farms (farmer_id, name, district, pickup_address, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${detailFields}`,
      [farmerId, profile.name, profile.district, profile.pickup_address,
        profile.latitude ?? null, profile.longitude ?? null]
    );
    return { status: 201, body: { farm } };
  });
}

export function updateFarm(req, res, next) {
  const { profile, ...validation } = validateProfile(req.body, false);
  if (!profile) return reply(req, res, 400, validation);
  return writeFarm(req, res, next, async client => {
    const { farmId } = req.params;
    const farmerId = req.user.id;
    const current = await lockOwnedFarm(client, farmerId, farmId);
    if (!current) return notFound;
    if (profile.name && profile.name !== current.name &&
        await duplicateName(client, farmerId, profile.name, farmId)) return duplicate;
    const updated = { ...current, ...profile };
    const { rows: [farm] } = await client.query(
      `UPDATE farms SET name = $3, district = $4, pickup_address = $5, latitude = $6, longitude = $7
       WHERE id = $1 AND farmer_id = $2 RETURNING ${detailFields}`,
      [farmId, farmerId, updated.name, updated.district, updated.pickup_address,
        updated.latitude, updated.longitude]
    );
    return { status: 200, body: { farm } };
  });
}

export function archiveFarm(req, res, next) {
  if (req.body !== undefined && (!isObject(req.body) || Object.keys(req.body).length)) {
    return reply(req, res, 400, { error: 'Archiving does not accept fields' });
  }
  return writeFarm(req, res, next, async client => {
    const { farmId } = req.params;
    const farmerId = req.user.id;
    const current = await lockOwnedFarm(client, farmerId, farmId);
    if (!current) return notFound;
    if (current.status === 'inactive') return { status: 200, body: { farm: current } };

    // Farms with batch history need an agreed cross-module stock and archive policy.
    const { rowCount } = await client.query(
      'SELECT 1 FROM harvest_batches WHERE farm_id = $1 AND farmer_id = $2 LIMIT 1',
      [farmId, farmerId]
    );
    if (rowCount) return { status: 409, body: { error: 'A farm with linked harvest batches cannot be archived yet' } };

    const { rows: [farm] } = await client.query(
      `UPDATE farms SET status = 'inactive' WHERE id = $1 AND farmer_id = $2 RETURNING ${detailFields}`,
      [farmId, farmerId]
    );
    return { status: 200, body: { farm } };
  });
}
