
import jwt from 'jsonwebtoken';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountRestrictedError extends Error {
  constructor(approvalStatus) {
    super('Account access is restricted');
    this.name = 'AccountRestrictedError';
    this.approvalStatus = approvalStatus;
  }
}

const LOGIN_ROLES = new Set(['farmer', 'buyer', 'driver']);

export async function authenticateUser({
  pool,
  verifyPassword,
  dummyHash,
  email,
  password,
  jwtSecret,
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

  if (typeof jwtSecret !== 'string' || !jwtSecret) {
    throw new Error('JWT secret is not configured');
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
        name,
        email,
        role,
        approval_status,
        password_hash,
        session_version
      FROM users
      WHERE email = $1
    `,
    [normalizedEmail]
  );

  const user = rows[0];

  const eligible =
    user &&
    LOGIN_ROLES.has(user.role) &&
    typeof user.password_hash === 'string' &&
    user.password_hash.length > 0;

  // Verify a dummy hash when no eligible account exists.
  // This reduces user-enumeration timing differences.
  const storedHash = eligible
    ? user.password_hash
    : dummyHash;

  const matches = await verifyPassword(password, storedHash);

  if (!eligible || !matches) {
    throw new InvalidCredentialsError();
  }

  if (user.approval_status !== 'approved') {
    throw new AccountRestrictedError(
      user.approval_status
    );
  }

  const token = jwt.sign(
    {
      role: user.role,
      name: user.name,
      session_version: user.session_version,
    },
    jwtSecret,
    {
      subject: user.id,
      expiresIn: '30m',
      algorithm: 'HS256',
      issuer: 'yieldmatrix',
      audience: 'yieldmatrix-web',
    }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
  };
}
