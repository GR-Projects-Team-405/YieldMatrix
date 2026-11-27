
import { InvalidCredentialsError } from './loginService.js';

const ALLOWED_ROLES = new Set([
  'farmer',
  'buyer',
  'driver',
]);

export async function getRegistrationApprovalStatus({
  pool,
  verifyPassword,
  dummyHash,
  email,
  password,
}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('Database pool is required');
  }

  if (typeof verifyPassword !== 'function') {
    throw new Error('Password verifier is required');
  }

  if (typeof dummyHash !== 'string' || !dummyHash) {
    throw new Error('Dummy password hash is required');
  }

  const normalizedEmail =
    typeof email === 'string'
      ? email.trim().toLowerCase()
      : '';

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    normalizedEmail.length > 254 ||
    typeof password !== 'string' ||
    password.length === 0 ||
    password.length > 128
  ) {
    throw new InvalidCredentialsError();
  }

  const { rows } = await pool.query(
    `
      SELECT
        id,
        role,
        approval_status,
        approval_reason,
        password_hash
      FROM users
      WHERE email = $1
    `,
    [normalizedEmail]
  );

  const user = rows[0];

  const eligible =
    user &&
    ALLOWED_ROLES.has(user.role) &&
    typeof user.password_hash === 'string' &&
    user.password_hash.length > 0;

  // Unknown accounts use the dummy hash so that
  // the password-verification path is still executed.
  const hashToCheck = eligible
    ? user.password_hash
    : dummyHash;

  const verified = await verifyPassword(
    password,
    hashToCheck
  );

  if (!eligible || !verified) {
    throw new InvalidCredentialsError();
  }

  return {
    registrationId: user.id,
    role: user.role,
    approvalStatus: user.approval_status,
    reason:
      ['rejected', 'suspended'].includes(
        user.approval_status
      )
        ? user.approval_reason ?? null
        : null,
  };
}
