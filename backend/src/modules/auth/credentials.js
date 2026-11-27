import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const HASH_BYTES = 64;
const DUMMY_HASH = `scrypt$16384$8$1$${Buffer.alloc(16, 17).toString('base64url')}$${Buffer.alloc(HASH_BYTES, 29).toString('base64url')}`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_ROLES = new Set(['farmer', 'buyer', 'driver', 'admin']);

export class AuthInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthInputError';
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') throw new AuthInputError('Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new AuthInputError('Enter a valid email address.');
  return email;
}

export function validateBuyerRegistration(body) {
  if (!isObject(body) || Object.keys(body).some((key) => !['name', 'email', 'password'].includes(key))) {
    throw new AuthInputError('Enter your name, email address and password.');
  }
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) {
    throw new AuthInputError('Name must be between 2 and 80 characters.');
  }
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) {
    throw new AuthInputError('Password must be between 12 and 128 characters.');
  }
  return { name: body.name.trim(), email: normalizeEmail(body.email), password: body.password };
}

export function validateLogin(body) {
  if (!isObject(body) || Object.keys(body).some((key) => !['email', 'password', 'role'].includes(key))) {
    throw new AuthInputError('Enter your email address and password.');
  }
  if (typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128) {
    throw new AuthInputError('Enter your email address and password.');
  }
  let role;
  if (body.role !== undefined) {
    if (typeof body.role !== 'string' || !ALLOWED_ROLES.has(body.role)) throw new AuthInputError('Choose a valid account role.');
    role = body.role;
  }
  return { email: normalizeEmail(body.email), password: body.password, role };
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, HASH_BYTES, SCRYPT_OPTIONS);
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, encodedHash) {
  const encoded = typeof encodedHash === 'string' ? encodedHash : DUMMY_HASH;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' || parts[1] !== '16384' || parts[2] !== '8' || parts[3] !== '1') {
    await scrypt(password, Buffer.alloc(16), HASH_BYTES, SCRYPT_OPTIONS);
    return false;
  }
  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length !== 16 || expected.length !== HASH_BYTES) return false;
    const actual = await scrypt(password, salt, HASH_BYTES, SCRYPT_OPTIONS);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
