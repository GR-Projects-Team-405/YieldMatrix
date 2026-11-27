
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLoginHandler,
} from './loginController.js';

import {
  InvalidCredentialsError,
  AccountRestrictedError,
} from './loginService.js';

import {
  createLoginRateLimiter,
} from './loginRateLimiter.js';

const validLogin = {
  email: 'farmer@example.com',
  password: 'ExamplePassword2026!',
};

function createResponse() {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },
  };
}

function setup({
  authenticate = async () => ({
    token: 'test-token',
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Test Farmer',
      role: 'farmer',
    },
  }),
  limiter = createLoginRateLimiter(),
} = {}) {
  const calls = [];

  const handler = createLoginHandler({
    dbPool: {},
    passwordVerifier: async () => true,
    dummyHashProvider: async () => 'dummy-hash',
    jwtSecret: () => 'test-only-secret',
    limiter,

    authenticate: async (args) => {
      calls.push(args);
      return authenticate(args);
    },
  });

  async function submit(body = validLogin) {
    const res = createResponse();
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

  return { submit, calls };
}

test('returns token for successful authentication', async () => {
  const app = setup();
  const { res } = await app.submit();

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.token, 'test-token');
  assert.equal(res.body.user.role, 'farmer');
  assert.equal(res.body.requestId, 'test-request');
});

test('normalizes email before authentication', async () => {
  const app = setup();

  await app.submit({
    ...validLogin,
    email: ' FARMER@EXAMPLE.COM ',
  });

  assert.equal(app.calls[0].email, 'farmer@example.com');
});

test('rejects invalid email', async () => {
  const app = setup();
  const { res } = await app.submit({
    ...validLogin,
    email: 'invalid',
  });

  assert.equal(res.statusCode, 422);
  assert.equal(app.calls.length, 0);
});

test('rejects unexpected request fields', async () => {
  const app = setup();
  const { res } = await app.submit({
    ...validLogin,
    role: 'admin',
  });

  assert.equal(res.statusCode, 422);
  assert.equal(app.calls.length, 0);
});

test('returns 401 for invalid credentials', async () => {
  const app = setup({
    authenticate: async () => {
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

test('returns 403 for pending accounts', async () => {
  const app = setup({
    authenticate: async () => {
      throw new AccountRestrictedError('pending');
    },
  });

  const { res } = await app.submit();

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.approvalStatus, 'pending');
});

test('rate limits after five failed attempts', async () => {
  const app = setup({
    authenticate: async () => {
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

test('forwards unexpected server errors', async () => {
  const app = setup({
    authenticate: async () => {
      throw new Error('Database failure');
    },
  });

  const { forwardedError } = await app.submit();

  assert.equal(forwardedError?.message, 'Database failure');
});
