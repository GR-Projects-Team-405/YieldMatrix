
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFarmerRegistration,
  RegistrationConflictError,
} from './registrationService.js';

const farmer = {
  role: 'farmer',
  fullName: 'Test Farmer',
  email: 'test@example.com',
  password: 'ExamplePassword2026!',
  phone: '+94771234567',
  district: 'Nuwara Eliya',
  farmName: 'Test Farm',
  pickupAddress: 'Test Pickup Address',
};

function makeDatabaseMock(failure = null) {
  const queries = [];
  let released = false;

  const client = {
    async query(sql, params = []) {
      const statement = sql.trim();
      queries.push({ sql: statement, params });

      if (
        statement.includes('INSERT INTO users') &&
        failure === 'duplicate-email'
      ) {
        const error = new Error('Unique constraint violated');
        error.code = '23505';
        error.constraint = 'users_email_key';
        throw error;
      }

      if (
        statement.includes('INSERT INTO farms') &&
        failure === 'farm-error'
      ) {
        throw new Error('Farm insert failed');
      }

      if (statement.includes('INSERT INTO users')) {
        return {
          rows: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              role: 'farmer',
              approval_status: 'pending',
            },
          ],
        };
      }

      if (statement.includes('INSERT INTO farms')) {
        return {
          rows: [
            {
              id: '22222222-2222-2222-2222-222222222222',
            },
          ],
        };
      }

      return { rows: [] };
    },

    release() {
      released = true;
    },
  };

  return {
    pool: {
      async connect() {
        return client;
      },
    },
    queries,
    wasReleased: () => released,
  };
}

const mockHash = async () =>
  'test-only-password-hash-not-for-production';

test('creates pending farmer and farm atomically', async () => {
  const db = makeDatabaseMock();

  const result = await createFarmerRegistration({
    pool: db.pool,
    hashPassword: mockHash,
    data: farmer,
  });

  assert.equal(result.role, 'farmer');
  assert.equal(result.approvalStatus, 'pending');

  const commands = db.queries.map((q) => q.sql);

  assert.equal(commands[0], 'BEGIN');
  assert.match(commands[1], /INSERT INTO users/);
  assert.match(commands[2], /INSERT INTO farms/);
  assert.equal(commands[3], 'COMMIT');

  assert.equal(db.wasReleased(), true);
});

test('never stores plaintext passwords', async () => {
  const db = makeDatabaseMock();

  await createFarmerRegistration({
    pool: db.pool,
    hashPassword: mockHash,
    data: farmer,
  });

  const userInsert = db.queries.find((q) =>
    q.sql.includes('INSERT INTO users')
  );

  assert.ok(userInsert);
  assert.ok(userInsert.params.includes(
    'test-only-password-hash-not-for-production'
  ));
  assert.equal(
    userInsert.params.includes(farmer.password),
    false
  );
});

test('rolls back if farm insert fails', async () => {
  const db = makeDatabaseMock('farm-error');

  await assert.rejects(
    createFarmerRegistration({
      pool: db.pool,
      hashPassword: mockHash,
      data: farmer,
    }),
    /Farm insert failed/
  );

  const commands = db.queries.map((q) => q.sql);

  assert.ok(commands.includes('ROLLBACK'));
  assert.equal(commands.includes('COMMIT'), false);
  assert.equal(db.wasReleased(), true);
});

test('handles duplicate email conflict', async () => {
  const db = makeDatabaseMock('duplicate-email');

  await assert.rejects(
    createFarmerRegistration({
      pool: db.pool,
      hashPassword: mockHash,
      data: farmer,
    }),
    (error) => {
      assert.ok(error instanceof RegistrationConflictError);
      assert.equal(error.field, 'email');
      return true;
    }
  );

  assert.ok(
    db.queries.some((q) => q.sql === 'ROLLBACK')
  );
  assert.equal(db.wasReleased(), true);
});

test('does not accept non-farmer registration', async () => {
  const db = makeDatabaseMock();

  await assert.rejects(
    createFarmerRegistration({
      pool: db.pool,
      hashPassword: mockHash,
      data: { ...farmer, role: 'admin' },
    }),
    /Expected validated Farmer registration/
  );

  assert.equal(db.queries.length, 0);
});

test('rejects invalid password hashing result', async () => {
  const db = makeDatabaseMock();

  await assert.rejects(
    createFarmerRegistration({
      pool: db.pool,
      hashPassword: async (password) => password,
      data: farmer,
    }),
    /Password hashing failed/
  );

  assert.equal(db.queries.length, 0);
});
