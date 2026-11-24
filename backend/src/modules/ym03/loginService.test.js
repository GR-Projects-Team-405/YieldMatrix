
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import {
  authenticateUser,
  InvalidCredentialsError,
  AccountRestrictedError,
} from './loginService.js';

const user = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Test Farmer',
  email: 'farmer@example.com',
  role: 'farmer',
  approval_status: 'approved',
  password_hash: 'stored-hash',
};

function mockPool(account = user) {
  const queries = [];

  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      return {
        rows: account ? [account] : [],
      };
    },
  };
}

const base = {
  email: 'farmer@example.com',
  password: 'CorrectPassword2026!',
  jwtSecret: 'test-only-secret-not-for-production',
  dummyHash: 'dummy-hash',
};

function verifier(password, hash) {
  return Promise.resolve(
    password === base.password &&
    hash === 'stored-hash'
  );
}

test('authenticates an approved Farmer', async () => {
  const pool = mockPool();

  const result = await authenticateUser({
    ...base,
    pool,
    verifyPassword: verifier,
  });

  assert.equal(result.user.role, 'farmer');

  const claims = jwt.verify(result.token, base.jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'yieldmatrix',
    audience: 'yieldmatrix-web',
  });

  assert.equal(claims.sub, user.id);
  assert.equal(claims.role, 'farmer');

  assert.equal(result.user.password_hash, undefined);
});

test('authenticates approved Buyer and Driver roles', async () => {
  for (const role of ['buyer', 'driver']) {
    const result = await authenticateUser({
      ...base,
      pool: mockPool({ ...user, role }),
      verifyPassword: verifier,
    });

    assert.equal(result.user.role, role);
  }
});

test('rejects an unknown account', async () => {
  let verifiedHash;

  await assert.rejects(
    authenticateUser({
      ...base,
      pool: mockPool(null),
      verifyPassword: async (_password, hash) => {
        verifiedHash = hash;
        return false;
      },
    }),
    InvalidCredentialsError
  );

  assert.equal(verifiedHash, 'dummy-hash');
});

test('rejects an incorrect password', async () => {
  await assert.rejects(
    authenticateUser({
      ...base,
      pool: mockPool(),
      password: 'IncorrectPassword2026!',
      verifyPassword: verifier,
    }),
    InvalidCredentialsError
  );
});

test('rejects pending, rejected and suspended accounts', async () => {
  for (const approval_status of [
    'pending',
    'rejected',
    'suspended',
  ]) {
    await assert.rejects(
      authenticateUser({
        ...base,
        pool: mockPool({ ...user, approval_status }),
        verifyPassword: verifier,
      }),
      (error) =>
        error instanceof AccountRestrictedError &&
        error.approvalStatus === approval_status
    );
  }
});

test('does not permit Admin login through YM-03', async () => {
  await assert.rejects(
    authenticateUser({
      ...base,
      pool: mockPool({ ...user, role: 'admin' }),
      verifyPassword: verifier,
    }),
    InvalidCredentialsError
  );
});

test('uses a parameterized email lookup', async () => {
  const pool = mockPool();

  await authenticateUser({
    ...base,
    email: ' FARMER@EXAMPLE.COM ',
    pool,
    verifyPassword: verifier,
  });

  assert.equal(
    pool.queries[0].params[0],
    'farmer@example.com'
  );

  assert.match(pool.queries[0].sql, /WHERE email = \$1/);
});

test('rejects a missing JWT secret', async () => {
  await assert.rejects(
    authenticateUser({
      ...base,
      pool: mockPool(),
      jwtSecret: '',
      verifyPassword: verifier,
    }),
    /JWT secret is not configured/
  );
});
