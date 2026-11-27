/**
 * YM14: Mock Data Fixtures
 * Models the approved Figma UI designs for:
 * 1. YM14_01: Received Offer Details (OFF-2026-0842)
 * 2. YM14_02: Offer Comparison (Demand DM-1042)
 * 3. YM14_03: Produce Commitments List (8 commitments)
 * 4. YM14_04: Commitment Details (COM-1042)
 * 5. YM14_05: Harvest Change Review (COM-1041)
 */

export const mockOffer0842 = {
  id: 'e1111111-1111-1111-1111-111111111111',
  reference: 'OFF-2026-0842',
  status: 'pending',
  offeredKg: 1200.0,
  unitPriceCents: 18000, // LKR 180 / kg
  lineTotalCents: 21600000, // LKR 216,000
  availabilityWindow: '12 Nov 2026',
  expiresAt: new Date(Date.now() + 4 * 3600 * 1000 + 28 * 60 * 1000).toISOString(), // ~4h 28m remaining
  tags: ['Tomato - Grade A', 'Welimada Origin', 'GlobalGAP Certified'],
  notes: 'Crops harvested at peak maturity in terrace fields. All tomatoes pre-sorted, washed, and packed in reusable 20kg food-grade plastic crates. Transported via climate-controlled vehicle to Colombo Central Hub within 6 hours of morning field harvest.',
  qualityChecklist: [
    { label: 'Grade verification', value: '100% inspected against YieldMatrix Grade A produce specs.' },
    { label: 'Color & firmness', value: '85-90% red turn, firm skin suitable for retail shelf life.' },
    { label: 'Uniform sizing', value: 'Diameter 55-65 mm per sample crate verification.' },
  ],
  demand: {
    id: 'd1111111-1111-1111-1111-111111111111',
    reference: 'DM-1042',
    cropName: 'Fresh Salad Tomatoes',
    gradeName: 'Grade A',
    quantityKg: 1500.0,
    destinationHub: 'Colombo Central Hub',
    targetWindow: '12 Nov - 14 Nov 2026',
    budgetPerKgCents: 18500, // LKR 185 / kg
  },
  supplier: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Nimal Perera',
    farmName: 'Green Valley Farm',
    estate: 'Green Valley Estate',
    location: 'Welimada, Badulla',
    rating: 4.9,
    completedTrades: 48,
    isVerified: true,
  },
  batch: {
    id: 'b1111111-1111-1111-1111-111111111111',
    code: 'BT-9024',
  },
};

export const mockOfferComparisonDM1042 = {
  demand: {
    id: 'd1111111-1111-1111-1111-111111111111',
    reference: 'DM-1042',
    cropName: 'Salad Tomatoes',
    quantityKg: 1500.0,
    budgetPerKgCents: 18500,
  },
  metrics: {
    totalOffers: 3,
    pendingOffers: 2,
    expiredOffers: 1,
    lowestPricePerKgCents: 17500,
    lowestPriceSupplier: 'Sunrise Organics',
    demandCoverageText: '1 Full Match (1,500 kg), 2 Partial',
    earliestPickupDate: '08 Nov 2026',
  },
  offers: [
    {
      id: 'o-sunrise-8812',
      badge: 'RECOMMENDED • BEST VALUE',
      supplierName: 'Sunrise Organics',
      district: 'Matale District',
      batchCode: 'BT-8812',
      grade: 'Grade A Produce',
      offeredKg: 1000.0,
      shortageKg: 500.0,
      pricePerKgCents: 17500, // LKR 175
      priceDifferenceCents: -1000, // LKR 10 below budget
      lineTotalCents: 17500000,
      availabilityWindow: '08 Nov - 10 Nov 2026',
      expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      status: 'pending',
      supplierRating: 4.9,
      completedTrades: 42,
      onTimePercentage: 99,
    },
    {
      id: 'o-highland-9104',
      badge: 'FULL DEMAND VOLUME MATCH',
      supplierName: 'Highland Harvest',
      district: 'Kandy District',
      batchCode: 'BT-9104',
      grade: 'Grade A Produce',
      offeredKg: 1500.0,
      shortageKg: 0,
      pricePerKgCents: 18500, // LKR 185
      priceDifferenceCents: 0, // Exactly at budget limit
      lineTotalCents: 27750000,
      availabilityWindow: '10 Nov - 12 Nov 2026',
      expiresAt: new Date(Date.now() + 22 * 3600 * 1000).toISOString(),
      status: 'pending',
      supplierRating: 4.7,
      completedTrades: 28,
      onTimePercentage: 96,
    },
    {
      id: 'o-greenvalley-9024',
      badge: 'EXPIRED • NEW SUPPLIER',
      supplierName: 'Green Valley Farm',
      district: 'Nuwara Eliya',
      batchCode: 'BT-9024',
      grade: 'Grade B+ Produce',
      offeredKg: 800.0,
      shortageKg: 700.0,
      pricePerKgCents: 19000, // LKR 190 (exceeds budget by 5)
      priceDifferenceCents: 500,
      lineTotalCents: 15200000,
      availabilityWindow: '12 Nov - 14 Nov 2026',
      expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(), // Expired
      status: 'expired',
      supplierRating: 0,
      completedTrades: 0,
      hasInsufficientHistory: true,
    },
  ],
};

export const mockCommitmentsList = [
  {
    id: 'c1042',
    reference: 'COM-1042',
    supplierName: 'Highland Harvest',
    cropName: 'Tomato',
    grade: 'Grade A',
    expectedKg: 1000.0,
    agreedPricePerKgCents: 18425, // LKR 184.25
    harvestWindow: '12 - 14 Nov 2026',
    status: 'ready_to_fulfil',
    changePending: false,
    actionType: 'view_details',
  },
  {
    id: 'c1041',
    reference: 'COM-1041',
    supplierName: 'Green Valley Farm',
    cropName: 'Carrot',
    grade: 'Grade A',
    expectedKg: 600.0,
    agreedPricePerKgCents: 22000, // LKR 220.00
    harvestWindow: '10 - 11 Nov 2026',
    status: 'change_pending',
    changePending: true,
    actionType: 'review_change',
  },
  {
    id: 'c1039',
    reference: 'COM-1039',
    supplierName: 'Welimada Co-op',
    cropName: 'Cabbage',
    grade: 'Grade B',
    expectedKg: 1200.0,
    agreedPricePerKgCents: 13000, // LKR 130.00
    harvestWindow: '15 - 17 Nov 2026',
    status: 'accepted',
    changePending: false,
    actionType: 'view_details',
  },
  {
    id: 'c1036',
    reference: 'COM-1036',
    supplierName: 'Nuwara Eliya Farms',
    cropName: 'Leeks',
    grade: 'Grade A',
    expectedKg: 850.0,
    agreedPricePerKgCents: 17000, // LKR 170.00
    harvestWindow: '16 - 18 Nov 2026',
    status: 'proposed',
    changePending: false,
    actionType: 'view_details',
  },
  {
    id: 'c1030',
    reference: 'COM-1030',
    supplierName: 'Dambulla Growers',
    cropName: 'Red Onion',
    grade: 'Grade A',
    expectedKg: 2800.0,
    agreedPricePerKgCents: 20000, // LKR 200.00
    harvestWindow: '01 - 03 Nov 2026',
    status: 'fulfilled',
    changePending: false,
    actionType: 'view_archive',
  },
  {
    id: 'c1025',
    reference: 'COM-1025',
    supplierName: 'Kandy Valley Agris',
    cropName: 'Bell Pepper',
    grade: 'Grade A',
    expectedKg: 500.0,
    agreedPricePerKgCents: 31000, // LKR 310.00
    harvestWindow: '25 - 28 Oct 2026',
    status: 'cancelled',
    changePending: false,
    actionType: 'view_archive',
  },
  {
    id: 'c1020',
    reference: 'COM-1020',
    supplierName: 'Badulla Green Agro',
    cropName: 'Potato',
    grade: 'Grade A',
    expectedKg: 1500.0,
    agreedPricePerKgCents: 19500,
    harvestWindow: '20 - 22 Nov 2026',
    status: 'accepted',
    changePending: false,
    actionType: 'view_details',
  },
  {
    id: 'c1018',
    reference: 'COM-1018',
    supplierName: 'Matale Fresh Produce',
    cropName: 'Beans',
    grade: 'Grade A',
    expectedKg: 800.0,
    agreedPricePerKgCents: 24000,
    harvestWindow: '18 - 20 Nov 2026',
    status: 'ready_to_fulfil',
    changePending: false,
    actionType: 'view_details',
  },
];

export const mockCommitmentDetails1042 = {
  id: 'c1042',
  reference: 'COM-1042',
  contractHash: '#YM-8820-CC',
  status: 'ready_to_fulfil',
  hasChangePending: false,
  linkedDemand: {
    id: 'd1111111-1111-1111-1111-111111111111',
    reference: 'DM-1042',
    title: 'Salad Tomatoes 1,500 kg',
  },
  originatingOffer: {
    id: 'o-highland-9104',
    reference: 'OFF-2026-0842',
    supplierName: 'Highland Harvest',
  },
  orderAllocationStatus: 'Pending Harvest Intake Scan',
  stepper: [
    { step: 1, title: '1. Proposed', subtitle: '28 Oct • Offer Received', status: 'completed' },
    { step: 2, title: '2. Accepted', subtitle: '02 Nov • Escrow Locked', status: 'completed' },
    { step: 3, title: '3. Ready to fulfil', subtitle: 'Active • Harvesting Batch', status: 'active' },
    { step: 4, title: '4. Fulfilled', subtitle: 'Upcoming • Hub Scan & Payout', status: 'upcoming' },
  ],
  specs: {
    buyerName: 'Mohomad Mushrif',
    buyerWorkspace: 'YM14 • Mohomad Mushrif (Colombo Hub)',
    supplierName: 'Highland Harvest (Kandy District)',
    plannedFieldBatch: 'Batch #BT-9104 (Salad Tomatoes, Grade A)',
    expectedKg: 1000.0,
    agreedPricePerKgCents: 18425,
    expectedTotalCents: 18425000, // LKR 184,250
    targetHarvestWindow: '12 Nov - 14 Nov 2026 (08:00 AM Intake)',
    cancellationTerms: 'Free cancellation prior to harvest dispatch; reason required',
  },
  originalTermsAnchor: {
    summaryText: '1,000 kg Fresh Salad Tomatoes (Grade A) @ LKR 184.25/kg = LKR 184,250 • Delivery 12-14 Nov 2026',
  },
  escrowStatus: {
    balanceHeldCents: 18425000,
    releaseTrigger: 'Auto-settles and transfers to farmer wallet upon digital warehouse acceptance scan at Colombo intake bay.',
  },
  logistics: {
    receivingHub: 'Colombo Central Hub - Intake Dock 04',
    gatePass: '#GP-8832 issued to driver',
  },
};

export const mockHarvestChangeProposal1041 = {
  commitmentId: 'c1041',
  reference: 'COM-1041',
  cropBatch: 'Batch #BT-9024 • Welimada Carrot Grade A',
  proposalExpiresAt: new Date(Date.now() + 18 * 3600 * 1000 + 42 * 60 * 1000).toISOString(),
  diff: [
    {
      parameter: 'Harvest Quantity',
      originalAgreed: '600 kg net',
      proposedChange: '480 kg net',
      netVariance: '-120 kg (-20% Yield Shortage)',
      isNegative: true,
    },
    {
      parameter: 'Delivery Window',
      originalAgreed: '10 - 11 Nov 2026',
      proposedChange: '14 - 15 Nov 2026',
      netVariance: '+4 Days Shift (Weather Hold)',
      isShift: true,
    },
    {
      parameter: 'Agreed Unit Price',
      originalAgreed: 'LKR 220.00 / kg',
      proposedChange: 'LKR 220.00 / kg',
      netVariance: 'Unchanged (Agreed Cap Maintained)',
    },
    {
      parameter: 'Total Escrow Value',
      originalAgreed: 'LKR 132,000',
      proposedChange: 'LKR 105,600',
      netVariance: '-LKR 26,400 (Escrow Refund to Wallet)',
      isNegative: true,
    },
  ],
  growerStatement: 'Due to unseasonal heavy rainfall in Welimada over the past 48 hours, 20% of the carrot field experienced waterlogging. To preserve Grade-A quality standards, we are harvesting only unaffected heads from upper drainage terraces, resulting in 480 kg net volume ready on 14 Nov.',
  agronomyVerified: true,
  verificationNotes: '3 field photos and rainfall gauge log verified by Badulla Regional Agricultural Extension Officer.',
  financialImpact: {
    escrowAutoRefundCents: 2640000, // LKR 26,400
    revisedEscrowHoldCents: 10560000, // LKR 105,600
    timelineShift: '+4 Days Delay',
    newIntakeDate: '14 Nov 2026 (08:00 AM)',
  },
};
