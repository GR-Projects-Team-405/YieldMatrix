
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRegistrationApprovalStatus,
} from './approvalStatusService.js';

import {
  InvalidCredentialsError,
} from './loginService.js';

const account = {
  id: '11111111-1111-1111-1111-111111111111',
  role: 'farmer',
  approval_status: 'pending',
  approval_reason: null,
  password_hash: 'stored-test-hash',
};

const base = {
  email: 'farmer@example.com',
  password: 'ExamplePassword2026!',
  dummyHash: 'dummy-test-hash',
};

function mockPool(user = account) {
  const queries = [];

  return {
    queries,

    async query(sql, params) {
      queries.push({ sql, params });

      return {
        rows: user ? [user] : [],
      };
    },
  };
}

const verifyPassword = async (password, hash) =>
  password === base.password &&
  hash === 'stored-test-hash';

test('returns pending Farmer approval status', async () => {
  const result = await getRegistrationApprovalStatus({
    ...base,
    pool: mockPool(),
    verifyPassword,
  });

  assert.equal(result.role, 'farmer');
  assert.equal(result.approvalStatus, 'pending');
  assert.equal(result.reason, null);
  assert.equal(result.registrationId, account.id);
});

test('returns approved Buyer status', async () => {
  const result = await getRegistrationApprovalStatus({
    ...base,
    pool: mockPool({
      ...account,
      role: 'buyer',
      approval_status: 'approved',
    }),
    verifyPassword,
  });

  assert.equal(result.approvalStatus, 'approved');
  assert.equal(result.role, 'buyer');
});

test('returns rejected Driver status with reason', async () => {
  const result = await getRegistrationApprovalStatus({
    ...base,
    pool: mockPool({
      ...account,
      role: 'driver',
      approval_status: 'rejected',
      approval_reason: 'Incomplete licence documents',
    }),
    verifyPassword,
  });

  assert.equal(result.approvalStatus, 'rejected');
  assert.equal(
    result.reason,
    'Incomplete licence documents'
  );
});

test('returns suspended status', async () => {
  const result = await getRegistrationApprovalStatus({
    ...base,
    pool: mockPool({
      ...account,
      approval_status: 'suspended',
      approval_reason: 'Account under review',
    }),
    verifyPassword,
  });

  assert.equal(result.approvalStatus, 'suspended');
});

test('rejects an unknown email', async () => {
  let checkedHash;

  await assert.rejects(
    getRegistrationApprovalStatus({
      ...base,
      pool: mockPool(null),
      verifyPassword: async (_password, hash) => {
        checkedHash = hash;
        return false;
      },
    }),
    InvalidCredentialsError
  );

  assert.equal(checkedHash, 'dummy-test-hash');
});

test('rejects an incorrect password', async () => {
  await assert.rejects(
    getRegistrationApprovalStatus({
      ...base,
      password: 'WrongPassword2026!',
      pool: mockPool(),
      verifyPassword,
    }),
    InvalidCredentialsError
  );
});

test('rejects Admin account lookup', async () => {
  await assert.rejects(
    getRegistrationApprovalStatus({
      ...base,
      pool: mockPool({
        ...account,
        role: 'admin',
      }),
      verifyPassword,
    }),
    InvalidCredentialsError
  );
});

test('does not expose password hashes', async () => {
  const result = await getRegistrationApprovalStatus({
    ...base,
    pool: mockPool(),
    verifyPassword,
  });

  assert.equal(result.password_hash, undefined);
  assert.equal(result.password, undefined);
});

test('uses normalized and parameterized email lookup', async () => {
  const pool = mockPool();

  await getRegistrationApprovalStatus({
    ...base,
    email: ' FARMER@EXAMPLE.COM ',
    pool,
    verifyPassword,
  });

  assert.equal(
    pool.queries[0].params[0],
    'farmer@example.com'
  );

  assert.match(
    pool.queries[0].sql,
    /WHERE email = \$1/
  );
});
