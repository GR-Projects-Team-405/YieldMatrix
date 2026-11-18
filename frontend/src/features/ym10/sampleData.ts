import type { BuyerRequest, HarvestBatch, Offer } from './types';

// This sample data will be replaced by the YM10 API later.
export const buyerRequests: BuyerRequest[] = [
  {
    id: 'BR-2048',
    buyerName: 'Green Basket',
    district: 'Colombo',
    produce: 'Tomato',
    grade: 'A',
    quantityKg: 400,
    deliveryDate: '2026-11-06',
    minimumPrice: 160,
    maximumPrice: 190,
    status: 'Closing soon',
    notes: 'Please deliver clean, ripe tomatoes in reusable crates.',
  },
  {
    id: 'BR-2051',
    buyerName: 'Fresh Mart',
    district: 'Gampaha',
    produce: 'Green chili',
    grade: 'A',
    quantityKg: 250,
    deliveryDate: '2026-11-12',
    minimumPrice: 220,
    maximumPrice: 260,
    status: 'Open',
    notes: 'Fresh green chili preferred.',
  },
  {
    id: 'BR-2055',
    buyerName: 'Hill Country Produce',
    district: 'Kandy',
    produce: 'Carrot',
    grade: 'B',
    quantityKg: 600,
    deliveryDate: '2026-11-18',
    minimumPrice: 180,
    maximumPrice: 210,
    status: 'Matching',
    notes: 'Washed carrots, packed in 10 kg bags.',
  },
  {
    id: 'BR-2060',
    buyerName: 'Daily Harvest',
    district: 'Kurunegala',
    produce: 'Potato',
    grade: 'A',
    quantityKg: 1000,
    deliveryDate: '2026-11-20',
    minimumPrice: 130,
    maximumPrice: 155,
    status: 'Open',
    notes: 'Potatoes should be sorted by size.',
  },
  {
    id: 'BR-2063',
    buyerName: 'Green Basket',
    district: 'Colombo',
    produce: 'Tomato',
    grade: 'B',
    quantityKg: 300,
    deliveryDate: '2026-11-24',
    minimumPrice: 125,
    maximumPrice: 150,
    status: 'Offer sent',
    notes: 'Please confirm the expected harvest date.',
  },
  {
    id: 'BR-2068',
    buyerName: 'Coastal Grocers',
    district: 'Galle',
    produce: 'Bell pepper',
    grade: 'A',
    quantityKg: 180,
    deliveryDate: '2026-11-29',
    minimumPrice: 280,
    maximumPrice: 320,
    status: 'Open',
    notes: 'Firm, unblemished bell peppers.',
  },
];

export const harvestBatches: HarvestBatch[] = [
  {
    id: 'HB-4102',
    produce: 'Tomato',
    grade: 'A',
    availableQuantityKg: 250,
    availableDate: '2026-10-28',
  },
  {
    id: 'HB-4108',
    produce: 'Tomato',
    grade: 'A',
    availableQuantityKg: 200,
    availableDate: '2026-10-30',
  },
  {
    id: 'HB-4111',
    produce: 'Tomato',
    grade: 'B',
    availableQuantityKg: 90,
    availableDate: '2026-10-29',
  },
  {
    id: 'HB-4120',
    produce: 'Carrot',
    grade: 'B',
    availableQuantityKg: 350,
    availableDate: '2026-11-02',
  },
  {
    id: 'HB-4133',
    produce: 'Green chili',
    grade: 'A',
    availableQuantityKg: 180,
    availableDate: '2026-11-05',
  },
];

export const sampleOffers: Offer[] = [
  {
    id: 'OF-3011',
    requestId: 'BR-2048',
    buyerName: 'Green Basket',
    produce: 'Tomato',
    grade: 'A',
    quantityKg: 250,
    pricePerKg: 175,
    status: 'Pending',
    submittedDate: '2026-11-05',
  },
  {
    id: 'OF-3010',
    requestId: 'BR-2051',
    buyerName: 'Fresh Mart',
    produce: 'Green chili',
    grade: 'A',
    quantityKg: 200,
    pricePerKg: 170,
    status: 'Accepted',
    submittedDate: '2026-11-04',
  },
  {
    id: 'OF-3008',
    requestId: 'BR-2060',
    buyerName: 'Daily Harvest',
    produce: 'Potato',
    grade: 'A',
    quantityKg: 300,
    pricePerKg: 125,
    status: 'Accepted',
    submittedDate: '2026-11-03',
  },
  {
    id: 'OF-3007',
    requestId: 'BR-2055',
    buyerName: 'Hill Country Produce',
    produce: 'Carrot',
    grade: 'B',
    quantityKg: 150,
    pricePerKg: 280,
    status: 'Accepted',
    submittedDate: '2026-11-02',
  },
  {
    id: 'OF-3006',
    requestId: 'BR-2068',
    buyerName: 'Coastal Grocers',
    produce: 'Bell pepper',
    grade: 'A',
    quantityKg: 180,
    pricePerKg: 150,
    status: 'Pending',
    submittedDate: '2026-11-01',
  },
  {
    id: 'OF-3005',
    requestId: 'BR-2063',
    buyerName: 'Green Basket',
    produce: 'Tomato',
    grade: 'B',
    quantityKg: 150,
    pricePerKg: 205,
    status: 'Declined',
    submittedDate: '2026-10-31',
  },
];

// Temporary local submissions until the YM10 API is connected.
export const submittedOffers: Offer[] = [];

export function addSubmittedOffer(
  offer: Omit<Offer, 'id' | 'status' | 'submittedDate'>,
): Offer {
  const submittedDate = new Date();
  const today = [
    submittedDate.getFullYear(),
    String(submittedDate.getMonth() + 1).padStart(2, '0'),
    String(submittedDate.getDate()).padStart(2, '0'),
  ].join('-');
  const newOffer: Offer = {
    ...offer,
    id: `OF-${String(3012 + submittedOffers.length).padStart(4, '0')}`,
    status: 'Pending',
    submittedDate: today,
  };
  submittedOffers.unshift(newOffer);
  return newOffer;
}
