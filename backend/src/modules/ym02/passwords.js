import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// YM02 · Ashen Ranasingha · Password hashing helper (Node built-in scrypt, no extra package).
// Stored format: scrypt$N$r$p$saltBase64$hashBase64
const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const PARAMS = { N: 2 ** 15, r: 8, p: 3, maxmem: 128 * 1024 * 1024 };

function normalize(password) {
  return password.normalize('NFKC');
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(normalize(password), salt, KEY_LENGTH, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(normalize(password), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Compared against when the account does not exist, so response time does not reveal it.
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));