import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createApprovalStatusHandler,
} from './approvalStatusController.js';

import {
  InvalidCredentialsError,
} from './loginService.js';

import {
  createLoginRateLimiter,
} from './loginRateLimiter.js';

const credentials = {
  email: 'farmer@example.com',
  password: 'ExamplePassword2026!',
};

function setup({
  lookupStatus = async () => ({
    registrationId:
      '11111111-1111-1111-1111-111111111111',
    role: 'farmer',
    approvalStatus: 'pending',
    reason: null,
  }),
} = {}) {
  const calls = [];

  const handler = createApprovalStatusHandler({
    dbPool: {},
    passwordVerifier: async () => true,
    dummyHashProvider: async () => 'dummy-hash',
    rateLimiter: createLoginRateLimiter(),
    lookupStatus: async (args) => {
      calls.push(args);
      return lookupStatus(args);
    },
  });

  async function submit(body = credentials) {
    const res = {
      statusCode: 200,
      body: null,

      status(code) {
        this.statusCode = code;
        return this;
      },

      json(value) {
        this.body = value;
        return this;
      },
    };

    let forwardedError;

    await handler(
      {
        body,
        ip: '127.0.0.1',
        requestId: 'test-request',
      },
      res,
      (error) => {
        forwardedError = error;
      }
    );

    return { res, forwardedError };
  }

  return { calls, submit };
}

test('returns pending approval status', async () => {
  const app = setup();
  const { res } = await app.submit();

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.role, 'farmer');
  assert.equal(res.body.approvalStatus, 'pending');
  assert.equal(res.body.reason, null);
});

test('normalizes email', async () => {
  const app = setup();

  await app.submit({
    ...credentials,
    email: ' FARMER@EXAMPLE.COM ',
  });

  assert.equal(
    app.calls[0].email,
    'farmer@example.com'
  );
});

test('rejects invalid email', async () => {
  const app = setup();

  const { res } = await app.submit({
    ...credentials,
    email: 'invalid',
  });

  assert.equal(res.statusCode, 422);
  assert.equal(app.calls.length, 0);
});

test('rejects additional request fields', async () => {
  const app = setup();

  const { res } = await app.submit({
    ...credentials,
    role: 'admin',
  });

  assert.equal(res.statusCode, 422);
  assert.equal(app.calls.length, 0);
});

test('rejects incorrect credentials', async () => {
  const app = setup({
    lookupStatus: async () => {
      throw new InvalidCredentialsError();
    },
  });

  const { res } = await app.submit();

  assert.equal(res.statusCode, 401);
  assert.equal(
    res.body.error,
    'Email or password is incorrect'
  );
});

test('rate limits repeated failed attempts', async () => {
  const app = setup({
    lookupStatus: async () => {
      throw new InvalidCredentialsError();
    },
  });

  for (let i = 0; i < 5; i += 1) {
    const { res } = await app.submit();
    assert.equal(res.statusCode, 401);
  }

  const { res } = await app.submit();

  assert.equal(res.statusCode, 429);
  assert.equal(app.calls.length, 5);
});

test('forwards unexpected database errors', async () => {
  const app = setup({
    lookupStatus: async () => {
      throw new Error('Database unavailable');
    },
  });

  const { forwardedError } = await app.submit();

  assert.equal(
    forwardedError?.message,
    'Database unavailable'
  );
});
