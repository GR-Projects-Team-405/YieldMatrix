import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthInputError,
  hashPassword,
  normalizeEmail,
  validateBuyerRegistration,
  validateLogin,
  verifyPassword,
} from '../src/modules/auth/credentials.js';

test('normalizes valid email addresses and rejects malformed values', () => {
  assert.equal(normalizeEmail('  Buyer@Example.com '), 'buyer@example.com');
  assert.throws(() => normalizeEmail('not-an-email'), AuthInputError);
  assert.throws(() => normalizeEmail('x'.repeat(250) + '@example.com'), AuthInputError);
});

test('validates and normalizes Buyer registration fields', () => {
  assert.deepEqual(validateBuyerRegistration({ name: '  Buyer Name ', email: 'BUYER@example.com', password: 'a-secure-password-123' }), {
    name: 'Buyer Name',
    email: 'buyer@example.com',
    password: 'a-secure-password-123',
  });
  assert.throws(() => validateBuyerRegistration({ name: 'B', email: 'buyer@example.com', password: 'short' }), AuthInputError);
  assert.throws(() => validateBuyerRegistration({ name: 'Buyer', email: 'buyer@example.com', password: 'a-secure-password-123', role: 'admin' }), AuthInputError);
});

test('validates login role and required credentials', () => {
  assert.deepEqual(validateLogin({ email: 'buyer@example.com', password: 'pass', role: 'buyer' }), {
    email: 'buyer@example.com', password: 'pass', role: 'buyer',
  });
  assert.throws(() => validateLogin({ email: 'buyer@example.com', password: 'pass', role: 'root' }), AuthInputError);
  assert.throws(() => validateLogin({ email: 'buyer@example.com', password: 'pass', extra: 'value' }), AuthInputError);
});

test('stores passwords as salted scrypt hashes and verifies them safely', async () => {
  const hash = await hashPassword('a-secure-password-123');
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(hash, 'a-secure-password-123');
  assert.equal(await verifyPassword('a-secure-password-123', hash), true);
  assert.equal(await verifyPassword('another-password-456', hash), false);
  assert.equal(await verifyPassword('a-secure-password-123', null), false);
});
