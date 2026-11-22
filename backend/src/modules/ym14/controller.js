import pool from '../../config/db.js';
import {
  fetchOfferById,
  fetchOfferComparisonByDemandId,
  acceptOffer as acceptOfferService,
  declineOffer as declineOfferService,
} from './offerService.js';
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
 * GET /api/ym14/offers/compare/:demandId
 * FR-YM14-02: Multi-offer side-by-side comparison for a given buyer demand.
 */
export async function getOfferComparison(req, res, next) {
  try {
    const { demandId } = req.params;
    if (!demandId || typeof demandId !== 'string') {
      return res.status(400).json({ error: 'Valid demand ID is required', requestId: req.requestId });
    }

    const comparison = await fetchOfferComparisonByDemandId(demandId, req.user.id);
    return res.json({
      ...comparison,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ym14/offers/:id/accept
 * FR-YM14-01 / FR-YM14-03: Accept offer, create forward commitment, and lock wallet escrow.
 */
export async function acceptOffer(req, res, next) {
  try {
    const { id } = req.params;
    const { operationKey } = req.body || {};

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid offer ID is required', requestId: req.requestId });
    }

    const result = await acceptOfferService({
      offerId: id,
      buyerId: req.user.id,
      operationKey,
    });

    return res.status(201).json({
      ...result,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message, requestId: req.requestId });
    }
    next(error);
  }
}

/**
 * POST /api/ym14/offers/:id/decline
 * FR-YM14-01: Decline an offer with a mandatory reason.
 */
export async function declineOffer(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, operationKey } = req.body || {};

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid offer ID is required', requestId: req.requestId });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({
        error: 'A decline reason is mandatory',
        fields: { reason: 'Please select or provide a decline reason.' },
        requestId: req.requestId,
      });
    }

    const result = await declineOfferService({
      offerId: id,
      buyerId: req.user.id,
      reason,
      operationKey,
    });

    return res.json({
      ...result,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message, requestId: req.requestId });
    }
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
