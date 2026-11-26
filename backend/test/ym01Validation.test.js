import test from 'node:test';
import assert from 'node:assert/strict';
import { InputError, validateCatalogueQuery, validateUuid } from '../src/modules/ym01/validation.js';

test('YM01 validates batch UUIDs and public trace tokens', () => {
  const value = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(validateUuid(value), value);
  assert.throws(() => validateUuid('not-a-uuid'), InputError);
});

test('YM01 applies bounded defaults and validates pagination and sorting', () => {
  const filters = validateCatalogueQuery({});
  assert.equal(filters.page, 1);
  assert.equal(filters.limit, 12);
  assert.equal(filters.sort, 'newest');
  assert.equal(validateCatalogueQuery({ page: '2', limit: '50' }).limit, 50);
  assert.throws(() => validateCatalogueQuery({ page: '0' }), InputError);
  assert.throws(() => validateCatalogueQuery({ limit: '51' }), InputError);
  assert.equal(validateCatalogueQuery({ sort: 'harvest_date_asc' }).sort, 'harvest_date_asc');
  assert.equal(validateCatalogueQuery({ sort: 'harvest_date_desc' }).sort, 'harvest_date_desc');
  assert.throws(() => validateCatalogueQuery({ sort: 'unit_price_cents DESC; DROP TABLE users' }), InputError);
});

test('YM01 validates filters and decimal price bounds', () => {
  const filters = validateCatalogueQuery({
    search: '  tomato ', crop: 'Tomato', district: 'Badulla', grade: 'Grade A',
    minPrice: '1.25', maxPrice: '100', sort: 'price_asc', availability: 'available',
  });
  assert.equal(filters.search, 'tomato');
  assert.equal(filters.minPriceCents, 125);
  assert.equal(filters.maxPriceCents, 10000);
  assert.equal(filters.crop, 'Tomato');
  assert.throws(() => validateCatalogueQuery({ search: 'x'.repeat(101) }), InputError);
  assert.throws(() => validateCatalogueQuery({ minPrice: '20', maxPrice: '10' }), InputError);
  assert.throws(() => validateCatalogueQuery({ minPrice: '10.999' }), InputError);
  assert.throws(() => validateCatalogueQuery({ district: ['Badulla', 'Kandy'] }), InputError);
  assert.throws(() => validateCatalogueQuery({ unexpected: 'value' }), InputError);
});
