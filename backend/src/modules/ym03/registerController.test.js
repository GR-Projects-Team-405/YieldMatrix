
import test from 'node:test';
import assert from 'node:assert/strict';

import { registerAccount } from './registerController.js';

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },
  };
}

async function executeRegistration(body) {
  const req = {
    body,
    requestId: 'ym03-test-request',
  };

  const res = createMockResponse();
  let nextError = null;

  await registerAccount(req, res, (error) => {
    nextError = error;
  });

  return { res, nextError };
}

const validFarmer = {
  role: 'farmer',
  fullName: 'Test Farmer',
  email: 'farmer@example.com',
  phone: '0771234567',
  district: 'Nuwara Eliya',
  password: 'ExamplePassword2026!',
  farmName: 'Test Farm',
  pickupAddress: 'Test Pickup Address',
};

test('rejects registration without required fields', async () => {
  const { res, nextError } = await executeRegistration({});

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.error,
    'Registration validation failed'
  );
});

test('rejects public admin registration', async () => {
  const { res } = await executeRegistration({
    ...validFarmer,
    role: 'admin',
  });

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.fields.role);
});

test('rejects invalid email addresses', async () => {
  const { res } = await executeRegistration({
    ...validFarmer,
    email: 'invalid-email',
  });

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.fields.email);
});

test('rejects short passwords', async () => {
  const { res } = await executeRegistration({
    ...validFarmer,
    password: 'short123',
  });

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.fields.password);
});

test('does not create valid accounts yet', async () => {
  const { res, nextError } =
    await executeRegistration(validFarmer);

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 501);
  assert.equal(
    res.body.code,
    'REGISTRATION_NOT_IMPLEMENTED'
  );
});

test('does not expose registration passwords', async () => {
  const { res } = await executeRegistration(validFarmer);

  const response = JSON.stringify(res.body);

  assert.equal(response.includes(validFarmer.password), false);
  assert.equal(response.includes('password_hash'), false);
});

test('includes request ID in API responses', async () => {
  const { res } = await executeRegistration(validFarmer);

  assert.equal(res.body.requestId, 'ym03-test-request');
});
