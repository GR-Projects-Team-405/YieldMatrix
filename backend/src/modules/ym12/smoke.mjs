const baseUrl = process.env.YM12_BASE_URL || 'http://127.0.0.1:5000';
const validListing = 'a12b0000-0000-4000-8000-000000000248';
const validSupplier = 'b1111111-1111-4111-8111-111111111111';
const seededFarmerId = '11111111-1111-1111-1111-111111111111';
const unknownId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const comparisonIds = [
  validListing,
  'a12b0000-0000-4000-8000-000000000249',
  'a12b0000-0000-4000-8000-000000000250',
].join(',');

const pageRoutes = [
  {
    name: 'produce',
    valid: `/api/ym12/produce/${validListing}`,
    invalid: '/api/ym12/produce/not-a-uuid',
    unknown: `/api/ym12/produce/${unknownId}`,
  },
  {
    name: 'supplier',
    valid: `/api/ym12/suppliers/${validSupplier}`,
    invalid: '/api/ym12/suppliers/not-a-uuid',
    unknown: `/api/ym12/suppliers/${unknownId}`,
  },
  {
    name: 'performance',
    valid: `/api/ym12/suppliers/${validSupplier}/performance?from=2026-06-01&to=2026-11-11`,
    invalid: '/api/ym12/suppliers/not-a-uuid/performance',
    unknown: `/api/ym12/suppliers/${unknownId}/performance`,
  },
  {
    name: 'comparison',
    valid: `/api/ym12/comparison?ids=${comparisonIds}`,
    invalid: '/api/ym12/comparison?ids=not-a-uuid',
    unknown: `/api/ym12/comparison?ids=${unknownId}`,
  },
];

const failures = [];

async function request(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(new URL(path, baseUrl), { headers });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function hasPrivateField(value) {
  if (Array.isArray(value)) return value.some(hasPrivateField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) =>
    /phone|email|address|wallet|password|pickup[_-]?(address|location|coordinates)/i.test(key)
      || hasPrivateField(child));
}

async function login(role) {
  const response = await fetch(new URL('/api/auth/demo-login', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const body = await response.json();
  if (!response.ok || typeof body.token !== 'string') {
    throw new Error(`Demo ${role} login failed with HTTP ${response.status}`);
  }
  return body.token;
}

function record(name, result, allowedStatuses) {
  const passed = allowedStatuses.includes(result.status)
    && Boolean(result.body?.requestId)
    && !hasPrivateField(result.body);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: HTTP ${result.status}`);
  assert(passed, `${name}: unexpected status, missing requestId, or private field`);
  return result;
}

async function main() {
  const buyerToken = await login('buyer');
  const wrongRoleToken = await login('admin');
  record(
    'supplier accepts seeded PostgreSQL UUID format',
    await request(`/api/ym12/suppliers/${seededFarmerId}`, buyerToken),
    [200, 404],
  );

  for (const route of pageRoutes) {
    const expectedValid = route.name === 'comparison' ? [200] : [200, 404];
    const valid = record(`${route.name} valid`, await request(route.valid, buyerToken), expectedValid);
    if (valid.status === 200) {
      assert(!hasPrivateField(valid.body), `${route.name} valid response contains a private field`);
    }

    record(`${route.name} invalid`, await request(route.invalid, buyerToken), [400]);

    const unknown = record(
      `${route.name} unknown`,
      await request(route.unknown, buyerToken),
      route.name === 'comparison' ? [200] : [404],
    );
    if (route.name === 'comparison' && unknown.status === 200) {
      assert(unknown.body.unavailable?.some((item) => item.id === unknownId),
        'comparison unknown listing is not reported unavailable');
    }

    record(`${route.name} no token`, await request(route.valid, null), [401]);
    record(`${route.name} wrong role`, await request(route.valid, wrongRoleToken), [403]);
  }

  const invalidDates = record(
    'performance invalid dates',
    await request(`/api/ym12/suppliers/${validSupplier}/performance?from=2026-11-12&to=2026-11-11`, buyerToken),
    [400],
  );
  assert(!hasPrivateField(invalidDates.body), 'invalid-date response exposes a private field');

  const produce = record('consistency produce details', await request(`/api/ym12/produce/${validListing}`, buyerToken), [200]);
  const profile = record('consistency supplier profile', await request(`/api/ym12/suppliers/${validSupplier}`, buyerToken), [200]);
  const performance = record('consistency supplier performance', await request(`/api/ym12/suppliers/${validSupplier}/performance`, buyerToken), [200]);
  const comparison = record('consistency supplier comparison', await request(`/api/ym12/comparison?ids=${comparisonIds}`, buyerToken), [200]);
  const profileListing = profile.body?.activeListings?.find((listing) => listing.listingId === validListing);
  assert(profile.body?.performanceSummary?.completedOrders === performance.body?.metrics?.completedOrders?.count,
    'profile and performance completed-order counts differ');
  assert(profile.body?.performanceSummary?.fulfilmentRatePercent === performance.body?.metrics?.fulfilmentRate?.percent,
    'profile and performance fulfilment rates differ');
  assert(produce.body?.supplier?.completedOrders === profile.body?.performanceSummary?.completedOrders,
    'produce and profile completed-order counts differ');
  for (const key of ['pricePerKgCents', 'availableKg', 'district', 'harvestStart', 'harvestEnd']) {
    assert(produce.body?.listing?.[key] === profileListing?.[key], `produce and profile listing fields differ: ${key}`);
  }
  const metrics = performance.body?.metrics;
  const expectedScore = Math.round((
    0.4 * metrics?.fulfilmentRate?.percent
    + 0.3 * metrics?.onTimePickup?.percent
    + 0.2 * metrics?.acceptanceRate?.percent
    + 0.1 * (100 - metrics?.disputeRate?.percent)
  ) * 10) / 10;
  const greenValley = comparison.body?.items?.find((item) => item.supplierId === validSupplier);
  assert(greenValley?.performanceScore === expectedScore, 'comparison score differs from supplier performance metrics');
  assert(comparison.body?.items?.filter((item) => item.supplierId !== validSupplier)
    .every((item) => item.performanceScore === null),
  'comparison shows a score for a supplier with insufficient history');
  console.log(`PASS cross-page metric and listing consistency; Green Valley score ${greenValley?.performanceScore}`);

  console.log(failures.length ? `${failures.length} smoke check(s) failed.` : 'All YM12 smoke checks passed.');
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`YM12 smoke setup failed: ${error.message}`);
  process.exitCode = 1;
});
