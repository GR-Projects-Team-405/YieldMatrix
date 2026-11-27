
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDriverRegistration,
} from './driverRegistrationService.js';

import {
  RegistrationConflictError,
} from './registrationService.js';

const driverData = {
  role: 'driver',
  fullName: 'Test Driver',
  email: 'test.driver@example.com',
  phone: '+94771234567',
  district: 'Kandy',
  password: 'TestDriver2026!Secure',
  operatingArea: 'Kandy',
  vehicleType: 'lgv',
  registrationNumber: 'WP-AB-1234',
  licenceNumber: 'B1234567',
  capacityKg: 1500,
};

function createMockPool({
  failAt = null,
  conflict = null,
} = {}) {
  const queries = [];
  let released = false;

  const client = {
    async query(sql, params) {
      const text = sql.trim();
      queries.push({ text, params });

      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) {
        return { rows: [] };
      }

      if (text.startsWith('INSERT INTO users')) {
        if (conflict === 'email') {
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
            id: '33333333-3333-3333-3333-333333333333',
            role: 'driver',
            approval_status: 'pending',
          }],
        };
      }

      if (text.startsWith('INSERT INTO driver_profiles')) {
        if (failAt === 'profile') {
          throw new Error('Driver profile insert failed');
        }

        return {
          rows: [{ user_id: params[0] }],
        };
      }

      if (text.startsWith('INSERT INTO vehicles')) {
        if (conflict === 'registrationNumber') {
          throw Object.assign(new Error('Duplicate vehicle'), {
            code: '23505',
            constraint: 'vehicles_registration_key',
          });
        }

        if (failAt === 'vehicle') {
          throw new Error('Vehicle insert failed');
        }

        return {
          rows: [{
            id: '55555555-5555-5555-5555-555555555555',
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

test('creates pending Driver, profile and vehicle atomically', async () => {
  const pool = createMockPool();

  const result = await createDriverRegistration({
    pool,
    hashPassword,
    data: driverData,
  });

  assert.equal(result.role, 'driver');
  assert.equal(result.approvalStatus, 'pending');

  assert.deepEqual(
    pool.queries.map((query) => query.text.split(/\s+/)[0]),
    ['BEGIN', 'INSERT', 'INSERT', 'INSERT', 'COMMIT']
  );

  assert.equal(pool.released, true);

  const userInsert = pool.queries.find(
    (query) => query.text.startsWith('INSERT INTO users')
  );

  assert.equal(userInsert.params[3], 'pending');
  assert.equal(userInsert.params[4], 'mock-secure-password-hash');
  assert.notEqual(userInsert.params[4], driverData.password);
});

test('saves the Driver licence and operating area', async () => {
  const pool = createMockPool();

  await createDriverRegistration({
    pool,
    hashPassword,
    data: driverData,
  });

  const profileInsert = pool.queries.find(
    (query) =>
      query.text.startsWith('INSERT INTO driver_profiles')
  );

  assert.equal(profileInsert.params[1], 'Kandy');
  assert.equal(profileInsert.params[2], 'B1234567');
});

test('saves correct vehicle registration and capacity', async () => {
  const pool = createMockPool();

  await createDriverRegistration({
    pool,
    hashPassword,
    data: driverData,
  });

  const vehicleInsert = pool.queries.find(
    (query) => query.text.startsWith('INSERT INTO vehicles')
  );

  assert.equal(vehicleInsert.params[1], 'WP-AB-1234');
  assert.equal(vehicleInsert.params[2], 'lgv');
  assert.equal(vehicleInsert.params[3], 1500);
});

test('rolls back if Driver profile insertion fails', async () => {
  const pool = createMockPool({ failAt: 'profile' });

  await assert.rejects(
    createDriverRegistration({
      pool,
      hashPassword,
      data: driverData,
    }),
    /Driver profile insert failed/
  );

  assert.equal(pool.queries.at(-1).text, 'ROLLBACK');
  assert.equal(pool.released, true);
});

test('rolls back if vehicle insertion fails', async () => {
  const pool = createMockPool({ failAt: 'vehicle' });

  await assert.rejects(
    createDriverRegistration({
      pool,
      hashPassword,
      data: driverData,
    }),
    /Vehicle insert failed/
  );

  assert.equal(pool.queries.at(-1).text, 'ROLLBACK');
  assert.equal(pool.released, true);
});

test('handles duplicate email', async () => {
  const pool = createMockPool({ conflict: 'email' });

  await assert.rejects(
    createDriverRegistration({
      pool,
      hashPassword,
      data: driverData,
    }),
    (error) =>
      error instanceof RegistrationConflictError &&
      error.field === 'email'
  );

  assert.equal(pool.queries.at(-1).text, 'ROLLBACK');
});

test('handles duplicate vehicle registration', async () => {
  const pool = createMockPool({
    conflict: 'registrationNumber',
  });

  await assert.rejects(
    createDriverRegistration({
      pool,
      hashPassword,
      data: driverData,
    }),
    (error) =>
      error instanceof RegistrationConflictError &&
      error.field === 'registrationNumber'
  );

  assert.equal(pool.queries.at(-1).text, 'ROLLBACK');
});

test('rejects unsupported roles without database writes', async () => {
  const pool = createMockPool();

  await assert.rejects(
    createDriverRegistration({
      pool,
      hashPassword,
      data: { ...driverData, role: 'admin' },
    }),
    /Expected validated Driver registration/
  );

  assert.equal(pool.queries.length, 0);
});

test('rejects invalid vehicle capacity', async () => {
  const pool = createMockPool();

  await assert.rejects(
    createDriverRegistration({
      pool,
      hashPassword,
      data: { ...driverData, capacityKg: -100 },
    }),
    /Invalid validated Driver profile/
  );

  assert.equal(pool.queries.length, 0);
});

test('rejects invalid password hashing', async () => {
  const pool = createMockPool();

  await assert.rejects(
    createDriverRegistration({
      pool,
      hashPassword: async () => driverData.password,
      data: driverData,
    }),
    /Password hashing failed/
  );

  assert.equal(pool.queries.length, 0);
});
