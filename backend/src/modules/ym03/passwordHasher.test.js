
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hashPassword,
  verifyPassword,
} from './passwordHasher.js';

const password = 'ExamplePassword2026!';

test('hashes passwords without storing plaintext', async () => {
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(hash.includes(password), false);
});

test('verifies correct passwords', async () => {
  const hash = await hashPassword(password);

  assert.equal(
    await verifyPassword(password, hash),
    true
  );
});

test('rejects incorrect passwords', async () => {
  const hash = await hashPassword(password);

  assert.equal(
    await verifyPassword('WrongPassword2026!', hash),
    false
  );
});

test('generates different hashes for the same password', async () => {
  const first = await hashPassword(password);
  const second = await hashPassword(password);

  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password, second), true);
});

test('rejects invalid password lengths', async () => {
  await assert.rejects(
    hashPassword('short'),
    /Invalid password/
  );
});

test('rejects malformed stored hashes', async () => {
  assert.equal(
    await verifyPassword(password, 'invalid-hash'),
    false
  );
});

test('uses the YM-02 compatible password format', async () => {
  const hash = await hashPassword('ExamplePassword2026!');
  const parts = hash.split('$');

  assert.equal(parts.length, 6);
  assert.equal(parts[0], 'scrypt');
  assert.equal(parts[1], '32768');
  assert.equal(parts[2], '8');
  assert.equal(parts[3], '3');

  assert.equal(
    Buffer.from(parts[4], 'base64').length,
    16
  );

  assert.equal(
    Buffer.from(parts[5], 'base64').length,
    64
  );
});

test('normalizes passwords with NFKC', async () => {
  const hash = await hashPassword(
    'ExamplePassword2026!'
  );

  assert.equal(
    await verifyPassword(
      'ExamplePassword2026!',
      hash
    ),
    true
  );
});

test('verifies NFKC equivalent passwords', async () => {
  const password = 'SecurePassword2026！';
  const normalized = 'SecurePassword2026!';

  const hash = await hashPassword(password);

  assert.equal(
    await verifyPassword(normalized, hash),
    true
  );
});
