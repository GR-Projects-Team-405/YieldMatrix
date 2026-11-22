
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

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
    password,
    salt,
    KEY_LENGTH,
    { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }
  );

  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('hex'),
    derivedKey.toString('hex'),
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

  if (parts.length !== 6) return false;

  const [algorithm, cost, blockSize, parallelism, saltHex, hashHex] =
    parts;

  if (
    algorithm !== 'scrypt' ||
    cost !== String(N) ||
    blockSize !== String(R) ||
    parallelism !== String(P) ||
    !/^[a-f0-9]{32}$/.test(saltHex) ||
    !/^[a-f0-9]{128}$/.test(hashHex)
  ) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const original = Buffer.from(hashHex, 'hex');

  const calculated = await scrypt(
    password,
    salt,
    KEY_LENGTH,
    { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }
  );

  return timingSafeEqual(original, calculated);
}
