
import { validateRegistration } from './validation.js';

export async function registerAccount(req, res, next) {
  try {
    const result = validateRegistration(req.body);

    if (!result.valid) {
      return res.status(400).json({
        error: 'Registration validation failed',
        fields: result.errors,
        requestId: req.requestId,
      });
    }

    // Database registration is intentionally disabled until
    // the shared schema and YM-02 authentication contract
    // are confirmed.

    return res.status(501).json({
      error: 'Registration is not yet available',
      code: 'REGISTRATION_NOT_IMPLEMENTED',
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}
