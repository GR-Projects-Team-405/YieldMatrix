import pool from '../../config/db.js';
import { fetchOfferById } from './offerService.js';
import { fetchCommitmentsList, fetchCommitmentById } from './commitmentService.js';

/**
 * Status and diagnostic check endpoint.
 */
export async function getStatus(req, res, next) {
  try {
    let userRow = { id: req.user?.id, name: req.user?.name, role: req.user?.role };
    try {
      const { rows } = await pool.query(
        'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
        [req.user.id, req.user.role, 'approved']
      );
      if (rows && rows[0]) {
        userRow = rows[0];
      }
    } catch (_err) {
      // Offline fallback: verified token identity is used
    }

    return res.json({
      module: 'YM14',
      owner: 'Mohomad Mushrif',
      status: 'active',
      user: userRow,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ym14/offers/:id
 * Retrieves detailed received offer specifications for the authenticated buyer.
 */
export async function getOfferDetails(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid offer ID is required', requestId: req.requestId });
    }

    const offer = await fetchOfferById(id, req.user.id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found or unauthorized', requestId: req.requestId });
    }

    return res.json({
      offer,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ym14/commitments
 * Returns a filterable, paginated produce commitments list for either buyer or farmer.
 */
export async function getCommitmentsList(req, res, next) {
  try {
    const { status, search, page, limit } = req.query;

    const data = await fetchCommitmentsList({
      userId: req.user.id,
      role: req.user.role,
      status: typeof status === 'string' ? status : 'all',
      search: typeof search === 'string' ? search : '',
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    return res.json({
      ...data,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ym14/commitments/:id
 * Retrieves detailed forward contract specifications, stepper state, and audit anchor.
 */
export async function getCommitmentDetails(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid commitment ID is required', requestId: req.requestId });
    }

    const commitment = await fetchCommitmentById(id, req.user.id, req.user.role);
    if (!commitment) {
      return res.status(404).json({ error: 'Commitment not found or unauthorized', requestId: req.requestId });
    }

    return res.json({
      commitment,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}