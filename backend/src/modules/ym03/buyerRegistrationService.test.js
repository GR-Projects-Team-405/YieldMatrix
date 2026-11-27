
import test from 'node:test';
import assert from 'node:assert/strict';

import { createBuyerRegistration } from './buyerRegistrationService.js';
import { RegistrationConflictError } from './registrationService.js';

const buyerData = {
  role: 'buyer',
  fullName: 'Test Buyer',
  email: 'test.buyer@example.com',
  phone: '+94771234567',
  district: 'Colombo',
  password: 'TestBuyer2026!Secure',
  buyerType: 'commercial',
  businessName: 'Test Trading Company',
};

function createMockPool({
  failAt = null,
  conflict = false,
} = {}) {
  const queries = [];
  let released = false;

  const client = {
    async query(sql, params) {
      const text = sql.trim();
      queries.push({ text, params });

      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [] };
      }

      if (text.startsWith('INSERT INTO users')) {
        if (conflict) {
          throw Object.assign(new Error('Duplicate email'), {
            code: '23505',
            constraint: 'users_email_key',
          });
        }

        if (failAt === 'users') {
          throw new Error('User insert failed');
        }

        return {
          rows: [{
            id: '11111111-1111-1111-1111-111111111111',
            role: 'buyer',
            approval_status: 'pending',
          }],
        };
      }

      if (text.startsWith('INSERT INTO buyer_profiles')) {
        if (failAt === 'profile') {
          throw new Error('Profile insert failed');
        }

        return {
          rows: [{
            user_id: params[0],
          }],
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    },

    release() {
      released = true;
    },
  };

  return {
    queries,

    get released() {
      return released;
    },

    async connect() {
      return client;
    },
  };
}

const hashPassword = async () => 'mock-secure-password-hash';

test('creates pending Buyer and profile atomically', async () => {
  const pool = createMockPool();

  const result = await createBuyerRegistration({
    pool,
    hashPassword,
    data: buyerData,
  });

  assert.equal(result.role, 'buyer');
  assert.equal(result.approvalStatus, 'pending');

  assert.deepEqual(
    pool.queries.map((query) => query.text.split(/\s+/)[0]),
    ['BEGIN', 'INSERT', 'INSERT', 'COMMIT']
  );

  assert.equal(pool.released, true);

  const userInsert = pool.queries.find(
    (query) => query.text.startsWith('INSERT INTO users')
  );

  assert.equal(userInsert.params[3], 'pending');
  assert.equal(userInsert.params[4], 'mock-secure-password-hash');
  assert.notEqual(userInsert.params[4], buyerData.password);
});

test('stores commercial business name', async () => {
  const pool = createMockPool();

  await createBuyerRegistration({
    pool,
    hashPassword,
    data: buyerData,
  });

  const profileInsert = pool.queries.find(
    (query) => query.text.startsWith('INSERT INTO buyer_profiles')
  );

  assert.equal(profileInsert.params[1], 'commercial');
  assert.equal(profileInsert.params[2], 'Test Trading Company');
});

test('stores NULL business name for individual Buyer', async () => {
  const pool = createMockPool();

  await createBuyerRegistration({
    pool,
    hashPassword,
    data: {
      ...buyerData,
      buyerType: 'individual',
      businessName: '',
    },
  });

  const profileInsert = pool.queries.find(
    (query) => query.text.startsWith('INSERT INTO buyer_profiles')
  );

  assert.equal(profileInsert.params[1], 'individual');
  assert.equal(profileInsert.params[2], null);
});

test('rolls back when Buyer profile insertion fails', async () => {
  const pool = createMockPool({ failAt: 'profile' });

  await assert.rejects(
    createBuyerRegistration({
      pool,
      hashPassword,
      data: buyerData,
    }),
    /Profile insert failed/
  );

  assert.equal(
    pool.queries.at(-1).text,
    'ROLLBACK'
  );

  assert.equal(pool.released, true);
});

test('handles duplicate email', async () => {
  const pool = createMockPool({ conflict: true });

  await assert.rejects(
    createBuyerRegistration({
      pool,
      hashPassword,
      data: buyerData,
    }),
    (error) =>
      error instanceof RegistrationConflictError &&
      error.field === 'email'
  );

  assert.equal(pool.queries.at(-1).text, 'ROLLBACK');
  assert.equal(pool.released, true);
});

test('rejects invalid Buyer role', async () => {
  const pool = createMockPool();

  await assert.rejects(
    createBuyerRegistration({
      pool,
      hashPassword,
      data: { ...buyerData, role: 'admin' },
    }),
    /Expected validated Buyer registration/
  );

  assert.equal(pool.queries.length, 0);
});

test('rejects invalid password hashing result', async () => {
  const pool = createMockPool();

  await assert.rejects(
    createBuyerRegistration({
      pool,
      hashPassword: async () => buyerData.password,
      data: buyerData,
    }),
    /Password hashing failed/
  );

  assert.equal(pool.queries.length, 0);
});
