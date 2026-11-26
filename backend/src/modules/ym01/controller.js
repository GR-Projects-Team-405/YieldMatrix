import pool from '../../config/db.js';
import {
  getCategories,
  getDistricts,
  getHarvestDetails,
  getHarvestTraceability,
  getHarvests,
  getLanding,
} from './service.js';
import { PUBLIC_ROLES } from './constants.js';
import { InputError, validateCatalogueQuery, validateUuid } from './validation.js';

function failure(res, status, message, requestId) {
  return res.status(status).json({ success: false, message, data: null, requestId });
}

// Keep this existing protected endpoint and its response/auth behavior intact.
export async function getStatus(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved'],
    );
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM01', owner: 'Aathil Hakam', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
}

export async function landing(req, res) {
  try {
    const data = await getLanding();
    return res.json({ success: true, message: 'Landing page information retrieved successfully', data, requestId: req.requestId });
  } catch {
    return failure(res, 500, 'Unable to retrieve landing page information', req.requestId);
  }
}

export async function harvests(req, res) {
  try {
    const result = await getHarvests(validateCatalogueQuery(req.query));
    return res.json({ success: true, message: 'Harvest listings retrieved successfully', ...result, requestId: req.requestId });
  } catch (error) {
    if (error instanceof InputError) return failure(res, 400, error.message, req.requestId);
    return failure(res, 500, 'Unable to retrieve harvest listings', req.requestId);
  }
}

export async function harvestDetails(req, res) {
  try {
    const id = validateUuid(req.params.id);
    const data = await getHarvestDetails(id);
    if (!data) return failure(res, 404, 'Public harvest listing not found', req.requestId);
    return res.json({ success: true, message: 'Harvest details retrieved successfully', data, requestId: req.requestId });
  } catch (error) {
    if (error instanceof InputError) return failure(res, 400, error.message, req.requestId);
    return failure(res, 500, 'Unable to retrieve harvest details', req.requestId);
  }
}

export async function harvestTraceability(req, res) {
  try {
    const token = validateUuid(req.params.id);
    const data = await getHarvestTraceability(token);
    if (data === null) return failure(res, 404, 'Public harvest trace not found', req.requestId);
    return res.json({
      success: true,
      message: data.length ? 'Public traceability retrieved successfully' : 'No public traceability events found',
      data,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error instanceof InputError) return failure(res, 400, error.message, req.requestId);
    return failure(res, 500, 'Unable to retrieve public traceability', req.requestId);
  }
}

export async function categories(req, res) {
  try {
    const data = await getCategories();
    return res.json({ success: true, message: 'Active crop categories retrieved successfully', data, requestId: req.requestId });
  } catch {
    return failure(res, 500, 'Unable to retrieve crop categories', req.requestId);
  }
}

export async function districts(req, res) {
  try {
    const data = await getDistricts();
    return res.json({ success: true, message: 'Public listing districts retrieved successfully', data, requestId: req.requestId });
  } catch {
    return failure(res, 500, 'Unable to retrieve districts', req.requestId);
  }
}

export function roles(req, res) {
  return res.json({ success: true, message: 'Platform roles retrieved successfully', data: PUBLIC_ROLES, requestId: req.requestId });
}
