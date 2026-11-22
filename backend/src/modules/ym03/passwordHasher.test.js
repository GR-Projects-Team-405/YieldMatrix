
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
