
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

// Compatible with the supplied YM-02 password format.
const PARAMS = {
  N: 2 ** 15,
  r: 8,
  p: 3,
  maxmem: 128 * 1024 * 1024,
};

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function normalize(password) {
  return password.normalize('NFKC');
}

export async function hashPassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < 15 ||
    password.length > 128
  ) {
    throw new Error('Invalid password');
  }

  const salt = randomBytes(SALT_LENGTH);

  const derivedKey = await scrypt(
    normalize(password),
    salt,
    KEY_LENGTH,
    PARAMS
  );

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derivedKey.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password, storedHash) {
  if (
    typeof password !== 'string' ||
    typeof storedHash !== 'string'
  ) {
    return false;
  }

  const parts = storedHash.split('$');

  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, n, r, p, saltBase64, hashBase64] = parts;

  // Only accept the agreed YM-02 parameters.
  if (
    n !== String(PARAMS.N) ||
    r !== String(PARAMS.r) ||
    p !== String(PARAMS.p) ||
    !/^[A-Za-z0-9+/]{22}==$/.test(saltBase64) ||
    !/^[A-Za-z0-9+/]{86}==$/.test(hashBase64)
  ) {
    return false;
  }

  const salt = Buffer.from(saltBase64, 'base64');
  const expected = Buffer.from(hashBase64, 'base64');

  const calculated = await scrypt(
    normalize(password),
    salt,
    KEY_LENGTH,
    PARAMS
  );

  return timingSafeEqual(expected, calculated);
}
