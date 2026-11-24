
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRegisterAccountHandler,
} from './registerController.js';

import {
  RegistrationConflictError,
} from './registrationService.js';

const base = {
  fullName: 'Test User',
  email: 'test.user@example.com',
  phone: '0771234567',
  district: 'Colombo',
  password: 'SecureTestPassword2026!',
};

const farmer = {
  ...base,
  role: 'farmer',
  farmName: 'Test Farm',
  pickupAddress: 'Test Road, Colombo',
};

const buyer = {
  ...base,
  role: 'buyer',
  buyerType: 'commercial',
  businessName: 'Test Trading',
};

const driver = {
  ...base,
  role: 'driver',
  operatingArea: 'Colombo',
  vehicleType: 'lgv',
  registrationNumber: 'WP-AB-1234',
  licenceNumber: 'B1234567',
  capacityKg: 1500,
};

function createResponse() {
  return {
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
}

function setup({
  enabled = true,
  profiles = true,
  failingService = null,
} = {}) {
  const calls = [];

  function service(role) {
    return async (args) => {
      calls.push({
        role,
        data: args.data,
      });

      if (failingService) {
        throw failingService;
      }

      return {
        registrationId: '11111111-1111-1111-1111-111111111111',
        role,
        approvalStatus: 'pending',
      };
    };
  }

  const handler = createRegisterAccountHandler({
    dbPool: {},
    passwordHasher: async () => 'mock-hash',
    farmerService: service('farmer'),
    buyerService: service('buyer'),
    driverService: service('driver'),
    registrationEnabled: () => enabled,
    profilesEnabled: () => profiles,
  });

  async function submit(body) {
    const res = createResponse();
    let forwardedError;

    await handler(
      {
        body,
        requestId: 'test-request-id',
      },
      res,
      (error) => {
        forwardedError = error;
      }
    );

    if (forwardedError) throw forwardedError;
    return res;
  }

  return { calls, submit };
}

for (const [role, data] of [
  ['farmer', farmer],
  ['buyer', buyer],
  ['driver', driver],
]) {
  test(`routes valid ${role} registration to its service`, async () => {
    const app = setup();

    const response = await app.submit(data);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.role, role);
    assert.equal(response.body.approvalStatus, 'pending');

    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].role, role);
  });
}

test('disabled registration never calls a service', async () => {
  const app = setup({ enabled: false });

  const response = await app.submit(farmer);

  assert.equal(response.statusCode, 501);
  assert.equal(app.calls.length, 0);
});

test('Buyer remains disabled without profile migration', async () => {
  const app = setup({ profiles: false });

  const response = await app.submit(buyer);

  assert.equal(response.statusCode, 501);
  assert.equal(app.calls.length, 0);
});

test('Driver remains disabled without profile migration', async () => {
  const app = setup({ profiles: false });

  const response = await app.submit(driver);

  assert.equal(response.statusCode, 501);
  assert.equal(app.calls.length, 0);
});

test('rejects invalid input before calling a service', async () => {
  const app = setup();

  const response = await app.submit({
    ...farmer,
    email: 'invalid-email',
  });

  assert.equal(response.statusCode, 400);
  assert.equal(app.calls.length, 0);
});

test('returns email conflict without exposing internals', async () => {
  const app = setup({
    failingService: new RegistrationConflictError('email'),
  });

  const response = await app.submit(farmer);

  assert.equal(response.statusCode, 409);
  assert.ok(response.body.fields.email);
});

test('returns vehicle registration conflict', async () => {
  const app = setup({
    failingService: new RegistrationConflictError(
      'registrationNumber'
    ),
  });

  const response = await app.submit(driver);

  assert.equal(response.statusCode, 409);
  assert.ok(response.body.fields.registrationNumber);
});
