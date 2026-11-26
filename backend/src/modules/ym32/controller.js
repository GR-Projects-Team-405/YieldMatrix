import pool from '../../config/db.js';
// YM32 · Sewmini Wijesiri · Profile

const SRI_LANKA_DISTRICTS = new Set([
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
  'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
  'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
  'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
  'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
]);

const ALLOWED_UPDATE_FIELDS = new Set(['name', 'phone', 'district']);

function isValidSriLankanPhone(phone) {
  const sanitized = phone.replace(/[\s\-()]/g, '');
  return /^(?:0[1-9]\d{8}|\+94[1-9]\d{8})$/.test(sanitized);
}

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM32', owner: 'Sewmini Wijesiri', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getProfile(req, res, next) {
  try {
    const query = `
      SELECT id, name, email, role, approval_status, phone, district, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const { rows } = await pool.query(query, [req.user.id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found', requestId: req.requestId });
    }
    return res.json({ profile: rows[0], requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(422).json({
        error: 'Invalid input',
        fields: { body: 'Request body must be a JSON object' },
        requestId: req.requestId,
      });
    }

    const fields = {};
    const incomingKeys = Object.keys(req.body);

    // Reject requests containing unknown or protected fields
    for (const key of incomingKeys) {
      if (!ALLOWED_UPDATE_FIELDS.has(key)) {
        fields[key] = `Field '${key}' cannot be modified or is not supported`;
      }
    }

    if (Object.keys(fields).length > 0) {
      return res.status(422).json({
        error: 'Invalid input',
        fields,
        requestId: req.requestId,
      });
    }

    // Validate name: required non-empty string
    const rawName = req.body.name;
    if (typeof rawName !== 'string' || rawName.trim().length === 0) {
      fields.name = 'Full name is required and cannot be empty';
    }
    const name = typeof rawName === 'string' ? rawName.trim() : '';

    // Validate phone: optional string, must match Sri Lankan format when provided
    let phone = null;
    if (req.body.phone !== undefined && req.body.phone !== null) {
      if (typeof req.body.phone !== 'string') {
        fields.phone = 'Phone number must be a string';
      } else {
        const trimmedPhone = req.body.phone.trim();
        if (trimmedPhone.length > 0) {
          if (!isValidSriLankanPhone(trimmedPhone)) {
            fields.phone = 'Invalid Sri Lankan phone number format (e.g. 07XXXXXXXX or +947XXXXXXXX)';
          } else {
            phone = trimmedPhone;
          }
        }
      }
    }

    // Validate district: optional string, must match 25 Sri Lankan districts when provided
    let district = null;
    if (req.body.district !== undefined && req.body.district !== null) {
      if (typeof req.body.district !== 'string') {
        fields.district = 'District must be a string';
      } else {
        const trimmedDistrict = req.body.district.trim();
        if (trimmedDistrict.length > 0) {
          if (!SRI_LANKA_DISTRICTS.has(trimmedDistrict)) {
            fields.district = 'Invalid Sri Lankan district name';
          } else {
            district = trimmedDistrict;
          }
        }
      }
    }

    if (Object.keys(fields).length > 0) {
      return res.status(422).json({
        error: 'Validation failed',
        fields,
        requestId: req.requestId,
      });
    }

    // Update query strictly scoped to req.user.id
    const updateQuery = `
      UPDATE users
      SET
        name = $1,
        phone = $2,
        district = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING
        id,
        name,
        email,
        role,
        approval_status,
        phone,
        district,
        created_at,
        updated_at;
    `;

    const { rows } = await pool.query(updateQuery, [name, phone, district, req.user.id]);

    if (!rows[0]) {
      return res.status(404).json({
        error: 'User not found',
        requestId: req.requestId,
      });
    }

    return res.json({
      profile: rows[0],
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}


