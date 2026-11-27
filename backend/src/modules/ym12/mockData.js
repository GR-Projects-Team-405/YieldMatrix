// Development-only public listing fixtures. These values are illustrative, not live offers.
export const DEMO_BUYER_ID = '22222222-2222-2222-2222-222222222222';

function dayOffset(days) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function cropIllustration(primary, secondary, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 640" role="img" aria-label="Illustration of ${label}"><defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="#edf2e9"/><stop offset="1" stop-color="#dce8d8"/></linearGradient><linearGradient id="produce" x2="0" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient></defs><rect width="900" height="640" fill="url(#bg)"/><ellipse cx="450" cy="520" rx="310" ry="48" fill="#315a42" opacity=".12"/><path d="M155 380h590l-54 152H210z" fill="#9a6b44"/><path d="M192 388h515l-38 118H230z" fill="#bc8757"/><path d="M205 405h490" stroke="#e5bd8c" stroke-width="13"/><g fill="url(#produce)" stroke="#a65734" stroke-opacity=".18" stroke-width="4"><circle cx="320" cy="340" r="91"/><circle cx="465" cy="322" r="104"/><circle cx="605" cy="349" r="88"/><circle cx="390" cy="425" r="80"/><circle cx="540" cy="426" r="78"/></g><g fill="#4d8052"><path d="M314 254q-30-45-58-26 25 35 58 34-7-39 27-53 5 33-17 58l-8 42h-9l5-43q-36-3-51-34 30-11 53 22z"/><path d="M458 216q-32-45-62-24 26 35 62 32-8-38 26-55 6 33-16 59l-8 46h-10l6-46q-37-1-54-32 31-13 56 20z"/><path d="M600 261q-27-41-54-22 23 31 55 30-7-35 23-49 6 30-14 53l-8 39h-9l5-39q-33-2-48-30 28-11 50 18z"/></g><text x="450" y="590" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#315a42">YIELDMATRIX · SAMPLE PRODUCE</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const suppliers = [
  { id: 'b1111111-1111-4111-8111-111111111111', name: 'Green Valley Growers', district: 'Matale', verified: true, completedOrders: 126, rating: 4.8, ratingCount: 84 },
  { id: 'b2222222-2222-4222-8222-222222222222', name: 'Dambulla Fresh Collective', district: 'Dambulla', verified: true, completedOrders: 88, rating: 4.6, ratingCount: 52 },
  { id: 'b3333333-3333-4333-8333-333333333333', name: 'Hill Country Harvest', district: 'Kandy', verified: true, completedOrders: null, rating: null, ratingCount: null },
];

const samples = [
  { id: 'a12b0000-0000-4000-8000-000000000248', displayId: 'YM-0248', cropName: 'Fresh tomatoes', pricePerKgCents: '28000', availableKg: '2400.000', grade: 'Grade A', supplier: suppliers[0], imageUrl: cropIllustration('#ef654e', '#b82e26', 'tomatoes'), description: 'Firm, vine-ripened tomatoes · Sorted for bulk supply', harvestStart: '2026-11-08T00:00:00.000Z', harvestEnd: '2026-11-15T00:00:00.000Z' },
  { id: 'a12b0000-0000-4000-8000-000000000249', displayId: 'YM-0249', cropName: 'Fresh tomatoes', pricePerKgCents: '25000', availableKg: '3200.000', grade: 'Grade B', supplier: suppliers[1], imageUrl: cropIllustration('#f07b35', '#c64b27', 'tomatoes'), description: 'Fresh tomatoes · Sorted for bulk supply', harvestStart: '2026-11-08T00:00:00.000Z', harvestEnd: '2026-11-14T00:00:00.000Z' },
  { id: 'a12b0000-0000-4000-8000-000000000250', displayId: 'YM-0250', cropName: 'Fresh tomatoes', pricePerKgCents: '29500', availableKg: '1800.000', grade: 'Grade A', supplier: suppliers[2], imageUrl: null, description: 'Fresh tomatoes · Available for bulk supply', harvestStart: '2026-11-09T00:00:00.000Z', harvestEnd: '2026-11-16T00:00:00.000Z' },
  { id: 'a12b0000-0000-4000-8000-000000000253', displayId: 'YM-0253', cropName: 'Fresh tomatoes', pricePerKgCents: '28000', availableKg: '1600.000', grade: 'Grade A', supplier: suppliers[1], imageUrl: null, description: 'Fresh tomatoes · Available for bulk supply', harvestStart: '2026-11-08T00:00:00.000Z', harvestEnd: '2026-11-15T00:00:00.000Z' },
  { id: 'a12b0000-0000-4000-8000-000000000254', displayId: 'YM-0254', cropName: 'Fresh tomatoes', pricePerKgCents: '28000', availableKg: '900.000', grade: 'Grade A', supplier: suppliers[2], imageUrl: null, description: 'Fresh tomatoes · Available for bulk supply', harvestStart: '2026-11-09T00:00:00.000Z', harvestEnd: '2026-11-16T00:00:00.000Z' },
].map((item, index) => ({
  id: item.id,
  displayId: item.displayId,
  cropName: item.cropName,
  category: 'Vegetables',
  description: item.description,
  grade: item.grade,
  status: 'active',
  pricePerKgCents: item.pricePerKgCents,
  pricePerKgLkr: `${BigInt(item.pricePerKgCents) / 100n}.${String(BigInt(item.pricePerKgCents) % 100n).padStart(2, '0')}`,
  availableKg: item.availableKg,
  harvestStart: item.harvestStart || dayOffset(index + 1),
  harvestEnd: item.harvestEnd || dayOffset(index + 8),
  district: item.supplier.district,
  imageUrl: item.imageUrl,
  updatedAt: new Date().toISOString(),
  supplier: item.supplier,
}));

export function getSampleListing(id) {
  return samples.find((item) => item.id.toLowerCase() === id.toLowerCase()) || null;
}

export function getSampleSupplierProfile(id) {
  if (id.toLowerCase() === 'b1111111-1111-4111-8111-111111111111') {
    const listingTomato = samples[0];
    return {
      supplier: {
        id: suppliers[0].id,
        name: suppliers[0].name,
        businessType: null,
        district: suppliers[0].district,
        country: 'Sri Lanka',
        tagline: null,
        description: null,
        verified: true,
        operatingSinceYear: null,
        memberSince: null,
        rating: 4.8,
        ratingCount: 84,
      },
      performanceSummary: {
        completedOrders: 126,
        fulfilmentRatePercent: 96,
        fulfilmentLabel: '126 / 131 confirmed orders',
        insufficientHistory: false,
      },
      cropsSupplied: ['Fresh tomatoes', 'Fresh carrots', 'Fresh cabbages'],
      activeListings: [
        {
          listingId: listingTomato.id,
          displayId: listingTomato.displayId,
          cropName: listingTomato.cropName,
          grade: 'Grade A',
          availableKg: '2400.000',
          district: 'Matale',
          harvestStart: '2026-11-08T00:00:00.000Z',
          harvestEnd: '2026-11-15T00:00:00.000Z',
          pricePerKgCents: '28000',
          pricePerKgLkr: '280.00',
          imageUrl: listingTomato.imageUrl,
        },
        {
          listingId: 'a12b0000-0000-4000-8000-000000000251',
          displayId: 'YM-0251',
          cropName: 'Fresh carrots',
          grade: 'Grade A',
          availableKg: '1200.000',
          district: 'Matale',
          harvestStart: '2026-11-09T00:00:00.000Z',
          harvestEnd: '2026-11-16T00:00:00.000Z',
          pricePerKgCents: '32000',
          pricePerKgLkr: '320.00',
          imageUrl: null,
        },
        {
          listingId: 'a12b0000-0000-4000-8000-000000000252',
          displayId: 'YM-0252',
          cropName: 'Fresh cabbages',
          grade: 'Grade B',
          availableKg: '1800.000',
          district: 'Matale',
          harvestStart: '2026-11-10T00:00:00.000Z',
          harvestEnd: '2026-11-18T00:00:00.000Z',
          pricePerKgCents: '18000',
          pricePerKgLkr: '180.00',
          imageUrl: null,
        },
      ],
      activeListingCount: 3,
      dataSource: 'sample',
      requestId: '',
    };
  }
  if (id.toLowerCase() === 'b4444444-4444-4444-8444-444444444444') {
    return {
      supplier: {
        id: 'b4444444-4444-4444-8444-444444444444',
        name: 'New Growers Cooperative',
        businessType: null,
        district: 'Anuradhapura',
        country: 'Sri Lanka',
        tagline: null,
        description: null,
        verified: true,
        operatingSinceYear: null,
        memberSince: null,
        rating: null,
        ratingCount: null,
      },
      performanceSummary: {
        completedOrders: null,
        fulfilmentRatePercent: null,
        fulfilmentLabel: null,
        insufficientHistory: true,
      },
      cropsSupplied: [],
      activeListings: [],
      activeListingCount: 0,
      dataSource: 'sample',
      requestId: '',
    };
  }
  const supplier = suppliers.find((item) => item.id === id.toLowerCase());
  const supplierListings = samples.filter((listing) => listing.supplier.id === id.toLowerCase());
  if (supplier && supplierListings.length) {
    const activeListings = supplierListings.map((listing) => ({
      listingId: listing.id,
      displayId: listing.displayId,
      cropName: listing.cropName,
      grade: listing.grade,
      availableKg: listing.availableKg,
      district: listing.district,
      harvestStart: listing.harvestStart,
      harvestEnd: listing.harvestEnd,
      pricePerKgCents: listing.pricePerKgCents,
      pricePerKgLkr: listing.pricePerKgLkr,
      imageUrl: listing.imageUrl,
    }));
    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        businessType: null,
        district: supplier.district,
        country: 'Sri Lanka',
        tagline: null,
        description: null,
        verified: supplier.verified,
        operatingSinceYear: null,
        memberSince: null,
        rating: supplier.rating,
        ratingCount: supplier.ratingCount,
      },
      performanceSummary: {
        completedOrders: null,
        fulfilmentRatePercent: null,
        fulfilmentLabel: null,
        insufficientHistory: true,
      },
      cropsSupplied: [...new Set(activeListings.map((listing) => listing.cropName))],
      activeListings,
      activeListingCount: activeListings.length,
      dataSource: 'sample',
      requestId: '',
    };
  }
  return null;
}

const samplePerformanceMonths = [
  { month: '2026-06', completed: '14', confirmed: '15', through: null },
  { month: '2026-07', completed: '19', confirmed: '20', through: null },
  { month: '2026-08', completed: '22', confirmed: '23', through: null },
  { month: '2026-09', completed: '24', confirmed: '25', through: null },
  { month: '2026-10', completed: '26', confirmed: '27', through: null },
  { month: '2026-11', completed: '21', confirmed: '21', through: '2026-11-11' },
];

export function getSampleSupplierPerformance(id, from, to) {
  const normalizedId = id.toLowerCase();
  if (normalizedId === 'b1111111-1111-4111-8111-111111111111') {
    const trend = samplePerformanceMonths.filter(({ month, through }) => {
      const [year, monthNumber] = month.split('-').map(Number);
      const monthStart = `${month}-01`;
      const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
      return from <= monthStart && to >= (through || monthEnd);
    });
    const completed = trend.reduce((total, item) => total + BigInt(item.completed), 0n).toString();
    const confirmed = trend.reduce((total, item) => total + BigInt(item.confirmed), 0n).toString();
    const hasFullSamplePeriod = from === '2026-06-01' && to >= '2026-11-11';
    return {
      supplier: {
        id: suppliers[0].id,
        name: suppliers[0].name,
        district: suppliers[0].district,
        verified: true,
      },
      counts: {
        buyer_requests: hasFullSamplePeriod ? '150' : null,
        accepted_requests: hasFullSamplePeriod ? '144' : null,
        completed_orders: completed,
        confirmed_orders: confirmed,
        on_time_pickups: hasFullSamplePeriod ? '118' : null,
        pickup_denominator: hasFullSamplePeriod ? '126' : null,
        disputed_completed_orders: hasFullSamplePeriod ? '2' : null,
      },
      trend,
      dataSource: 'sample',
    };
  }
  if (normalizedId === 'b4444444-4444-4444-8444-444444444444') {
    return {
      supplier: {
        id: normalizedId,
        name: 'New Growers Cooperative',
        district: 'Anuradhapura',
        verified: true,
      },
      counts: {
        buyer_requests: null,
        accepted_requests: null,
        completed_orders: '0',
        confirmed_orders: '0',
        on_time_pickups: null,
        pickup_denominator: '0',
        disputed_completed_orders: '0',
      },
      trend: [],
      dataSource: 'sample',
    };
  }
  const sampleSupplier = suppliers.find((supplier) => supplier.id === normalizedId);
  if (sampleSupplier && sampleSupplier.id !== 'b1111111-1111-4111-8111-111111111111') {
    return {
      supplier: {
        id: sampleSupplier.id,
        name: sampleSupplier.name,
        district: sampleSupplier.district,
        verified: sampleSupplier.verified,
      },
      counts: {
        buyer_requests: null,
        accepted_requests: null,
        completed_orders: '0',
        confirmed_orders: '0',
        on_time_pickups: null,
        pickup_denominator: '0',
        disputed_completed_orders: '0',
      },
      trend: [],
      dataSource: 'sample',
    };
  }
  return null;
}

const sampleComparisonFixtures = [
  { ...samples[1], distanceKm: 88 },
  { ...samples[0], distanceKm: 110 },
  { ...samples[2], distanceKm: null },
  {
    ...samples[0],
    id: 'a12b0000-0000-4000-8000-000000000253',
    displayId: 'YM-0253',
    pricePerKgCents: '28000',
    availableKg: '1600.000',
    supplier: suppliers[1],
    distanceKm: 88,
  },
  {
    ...samples[2],
    id: 'a12b0000-0000-4000-8000-000000000254',
    displayId: 'YM-0254',
    pricePerKgCents: '28000',
    availableKg: '900.000',
    distanceKm: null,
  },
];

export function getSampleComparisonListings(ids) {
  const byId = new Map(sampleComparisonFixtures.map((item) => [item.id.toLowerCase(), item]));
  const available = [];
  const unavailable = [];
  for (const id of ids) {
    const listing = byId.get(id.toLowerCase());
    if (listing) available.push(listing);
    else unavailable.push({ id, reason: 'Listing not found or no longer eligible.' });
  }
  return { available, unavailable };
}
