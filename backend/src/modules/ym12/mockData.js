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
  { id: 'b2222222-2222-4222-8222-222222222222', name: 'Dambulla Fresh Collective', district: 'Matale', verified: true, completedOrders: 88, rating: 4.6, ratingCount: 52 },
  { id: 'b3333333-3333-4333-8333-333333333333', name: 'Hill Country Harvest', district: 'Kandy', verified: true, completedOrders: null, rating: null, ratingCount: null },
];

const samples = [
  { id: 'a12b0000-0000-4000-8000-000000000248', displayId: 'YM-0248', cropName: 'Fresh tomatoes', pricePerKgCents: '28000', availableKg: '2400.000', grade: 'Grade A', supplier: suppliers[0], imageUrl: cropIllustration('#ef654e', '#b82e26', 'tomatoes'), description: 'Firm, vine-ripened tomatoes · Sorted for bulk supply' },
  { id: 'a12b0000-0000-4000-8000-000000000249', displayId: 'YM-0249', cropName: 'Fresh tomatoes', pricePerKgCents: '25000', availableKg: '3200.000', grade: 'Grade B', supplier: suppliers[1], imageUrl: cropIllustration('#f07b35', '#c64b27', 'tomatoes'), description: 'Fresh tomatoes · Sorted for bulk supply' },
  { id: 'a12b0000-0000-4000-8000-000000000250', displayId: 'YM-0250', cropName: 'Fresh tomatoes', pricePerKgCents: '29500', availableKg: '1800.000', grade: 'Grade A', supplier: suppliers[2], imageUrl: null, description: 'Fresh tomatoes · Available for bulk supply' },
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
  harvestStart: dayOffset(index + 1),
  harvestEnd: dayOffset(index + 8),
  district: item.supplier.district,
  imageUrl: item.imageUrl,
  updatedAt: new Date().toISOString(),
  supplier: item.supplier,
}));

export function getSampleListing(id) {
  return samples.find((item) => item.id.toLowerCase() === id.toLowerCase()) || null;
}
