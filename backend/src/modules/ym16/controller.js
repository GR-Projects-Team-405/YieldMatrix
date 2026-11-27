import {
  HttpError,
  requireUuid,
  listReservations,
  getReservation,
  createReservation,
  submitReservation,
  submitFarmerResponse as submitFarmerResponseToService,
  listFarmerReservations as getFarmerReservations,
  getReservationStatus,
  getReservationEscrow,
  getReservationLedger,
  getReservationAudit,
  decideFarmerResponse,
  confirmReservation,
  messageFarmer,
  getWallet,
} from './service.js';

function handle(error, next, req, res) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: error.message,
      fields: error.fields,
      requestId: req.requestId,
    });
  }
  return next(error);
}

function actor(req) {
  return req.user.id;
}

export async function getStatus(req, res, next) {
  try {
    return res.json({ module: 'YM16', owner: 'Nadula Hatharasingha', status: 'ready', requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function list(req, res, next) {
  try {
    const reservations = await listReservations(req.user.id);
    return res.json({ reservations, requestId: req.requestId });
  } catch (error) { handle(error, next, req, res); }
}

export async function detail(req, res, next) {
  try {
    const payload = await getReservation(req.user.id, requireUuid(req.params.id), req.requestId);
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function create(req, res, next) {
  try {
    const payload = await createReservation(req.user.id, actor(req), req.body, req.requestId);
    return res.status(201).json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function submit(req, res, next) {
  try {
    const payload = await submitReservation(req.user.id, requireUuid(req.params.id), actor(req), req.requestId);
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}


export async function status(req, res, next) {
  try {
    const payload = await getReservationStatus(req.user.id, requireUuid(req.params.id), req.requestId);
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function escrow(req, res, next) {
  try {
    const payload = await getReservationEscrow(req.user.id, requireUuid(req.params.id));
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function ledger(req, res, next) {
  try {
    const payload = await getReservationLedger(req.user.id, requireUuid(req.params.id));
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function auditTrail(req, res, next) {
  try {
    const payload = await getReservationAudit(req.user.id, requireUuid(req.params.id));
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function listFarmerReservations(req, res, next) {
  try {
    const payload = await getFarmerReservations(req.user.id, req.requestId);
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function farmerResponse(req, res, next) {
  try {
    const payload = await submitFarmerResponseToService(
      req.user.id,
      requireUuid(req.params.id),
      req.body,
      actor(req),
      req.requestId,
    );
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function decide(req, res, next) {
  try {
    const decision = req.body?.decision;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const payload = await decideFarmerResponse(
      req.user.id,
      requireUuid(req.params.id),
      requireUuid(req.params.allocationId, 'allocationId'),
      decision,
      reason,
      actor(req),
      req.requestId,
    );
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function confirm(req, res, next) {
  try {
    const payload = await confirmReservation(req.user.id, requireUuid(req.params.id), actor(req), req.requestId);
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function message(req, res, next) {
  try {
    const payload = await messageFarmer(
      req.user.id,
      requireUuid(req.params.id),
      requireUuid(req.params.allocationId, 'allocationId'),
      req.body,
      actor(req),
      req.requestId,
    );
    return res.json(payload);
  } catch (error) { handle(error, next, req, res); }
}

export async function wallet(req, res, next) {
  try {
    const payload = await getWallet(req.user.id);
    return res.json({ ...payload, requestId: req.requestId });
  } catch (error) { handle(error, next, req, res); }
}
