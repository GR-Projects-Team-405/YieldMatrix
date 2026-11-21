import type { AllocationItem, AllocationSummary } from './types';

/**
 * Temporary isolated demo data for the YM17 Task 01B-1 UI layout check.
 * Matches the approved Figma Allocation Inbox mockup.
 * NOT imported by the live inbox: index.tsx reads PostgreSQL through api.ts.
 * Kept only so the layout can be reviewed without a running backend.
 */

export const DEMO_SUMMARY: AllocationSummary = {
  pendingResponses: 3,
  acceptedAllocations: 8,
  declinedAllocations: 2,
  expiringSoon: 1,
};

export const DEMO_ALLOCATIONS: AllocationItem[] = [
  {
    allocationId: 'a1111111-1111-1111-1111-111111111101',
    allocationReference: 'AL-2026-001',
    orderId: 'o1111111-1111-1111-1111-111111111101',
    buyerName: 'Green Basket',
    batchId: 'hb-001-sample',
    batchReference: 'HB-001',
    cropName: 'Tomato',
    gradeName: 'Grade A',
    agreedKg: '400 kg',
    agreedValueFormatted: 'LKR 72,000',
    reservationExpiryFormatted: '02 Nov, 11:30 AM',
    expirySubtext: 'Demo: expires soon',
    isExpiringSoon: true,
    holdState: 'active',
    status: 'held',
    statusDisplay: 'Awaiting',
  },
  {
    allocationId: 'a1111111-1111-1111-1111-111111111102',
    allocationReference: 'AL-2026-002',
    orderId: 'o1111111-1111-1111-1111-111111111102',
    buyerName: 'FreshMart',
    batchId: 'hb-002-sample',
    batchReference: 'HB-002',
    cropName: 'Carrot',
    gradeName: 'Grade A',
    agreedKg: '350 kg',
    agreedValueFormatted: 'LKR 70,000',
    reservationExpiryFormatted: '02 Nov, 12:15 PM',
    expirySubtext: 'Asia/Colombo',
    isExpiringSoon: false,
    holdState: 'active',
    status: 'held',
    statusDisplay: 'Awaiting',
  },
  {
    allocationId: 'a1111111-1111-1111-1111-111111111103',
    allocationReference: 'AL-2026-003',
    orderId: 'o1111111-1111-1111-1111-111111111103',
    buyerName: 'City Grocers',
    batchId: 'hb-003-sample',
    batchReference: 'HB-003',
    cropName: 'Cabbage',
    gradeName: 'Grade A',
    agreedKg: '250 kg',
    agreedValueFormatted: 'LKR 40,000',
    reservationExpiryFormatted: '02 Nov, 01:00 PM',
    expirySubtext: 'Asia/Colombo',
    isExpiringSoon: false,
    holdState: 'active',
    status: 'held',
    statusDisplay: 'Awaiting',
  },
];

