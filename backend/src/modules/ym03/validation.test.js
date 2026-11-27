
import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRegistration } from './validation.js';

const common = {
  fullName: 'Nimal Perera',
  email: 'NIMAL@EXAMPLE.COM ',
  phone: '0771234567',
  district: 'Nuwara Eliya',
  password: 'ValidPassword2026!',
};

test('accepts valid farmer registration', () => {
  const result = validateRegistration({
    ...common,
    role: 'farmer',
    farmName: 'Green Valley Farm',
    pickupAddress: 'Main Road, Nuwara Eliya',
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.email, 'nimal@example.com');
  assert.equal(result.value.phone, '+94771234567');
});

test('accepts valid commercial buyer', () => {
  const result = validateRegistration({
    ...common,
    role: 'buyer',
    buyerType: 'commercial',
    businessName: 'FreshMart',
  });

  assert.equal(result.valid, true);
});

test('accepts individual buyer without business name', () => {
  const result = validateRegistration({
    ...common,
    role: 'buyer',
    buyerType: 'individual',
    businessName: '',
  });

  assert.equal(result.valid, true);
});

test('accepts valid driver registration', () => {
  const result = validateRegistration({
    ...common,
    role: 'driver',
    operatingArea: 'Nuwara Eliya Cold Region',
    vehicleType: 'mini_lorry',
    registrationNumber: 'WP LO-4811',
    licenceNumber: 'B-7821940',
    capacityKg: 1500,
  });

  assert.equal(result.valid, true);
});

test('rejects public admin registration', () => {
  const result = validateRegistration({
    ...common,
    role: 'admin',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.role);
});

test('rejects unsupported approval fields', () => {
  const result = validateRegistration({
    ...common,
    role: 'buyer',
    buyerType: 'individual',
    businessName: '',
    approval_status: 'approved',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.approval_status);
});

test('rejects passwords shorter than 15 characters', () => {
  const result = validateRegistration({
    ...common,
    password: 'Short123',
    role: 'farmer',
    farmName: 'Green Valley',
    pickupAddress: 'Main Road',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.password);
});

test('rejects invalid mobile numbers', () => {
  const result = validateRegistration({
    ...common,
    phone: '12345',
    role: 'buyer',
    buyerType: 'individual',
    businessName: '',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.phone);
});

test('rejects missing farmer pickup address', () => {
  const result = validateRegistration({
    ...common,
    role: 'farmer',
    farmName: 'Green Valley',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.pickupAddress);
});

test('rejects invalid driver capacity', () => {
  const result = validateRegistration({
    ...common,
    role: 'driver',
    operatingArea: 'Nuwara Eliya Cold Region',
    vehicleType: 'mini_lorry',
    registrationNumber: 'WP LO-4811',
    licenceNumber: 'B-7821940',
    capacityKg: -1,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.capacityKg);
});

test('rejects malformed request bodies', () => {
  for (const body of [null, [], 'invalid']) {
    const result = validateRegistration(body);
    assert.equal(result.valid, false);
  }
});
