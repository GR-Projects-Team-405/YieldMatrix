import assert from 'node:assert/strict';
import { rankListings } from './rankListings.js';

const item = (listingId, pricePerKgCents, distanceKm) => ({ listingId, pricePerKgCents, distanceKm });

assert.deepEqual(
  rankListings([
    item('d', '29500', null),
    item('c', '28000', 110),
    item('b', '28000', 88),
    item('a', '25000', null),
  ]).map(({ listingId }) => listingId),
  ['a', 'b', 'c', 'd'],
  'price ranks first, then known distance, with unknown distance last',
);

assert.deepEqual(
  rankListings([
    item('z', '28000', 88),
    item('a', '28000', 88),
    item('m', '28000', null),
  ]).map(({ listingId }) => listingId),
  ['a', 'z', 'm'],
  'equal price and distance use stable listing ID ordering',
);

const original = [item('b', '10', 2), item('a', '10', 2)];
rankListings(original);
assert.deepEqual(original.map(({ listingId }) => listingId), ['b', 'a'], 'ranking does not mutate its input');

console.log('rankListings tests passed');
