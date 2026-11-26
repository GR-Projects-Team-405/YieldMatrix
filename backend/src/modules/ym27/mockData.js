export const walletSummary = {
  availableBalance: 12_500_000,
  pendingSettlements: 1_850_000,
  totalEarned: 45_000_000,
};

export const transactions = [
  { id: 'txn-001', date: '2026-11-15', description: 'Settlement – Order #ORD-4821', type: 'credit', amount: 3_250_000, status: 'confirmed', settlementId: 'stl-001' },
  { id: 'txn-002', date: '2026-11-14', description: 'Settlement – Order #ORD-4790', type: 'credit', amount: 1_800_000, status: 'confirmed', settlementId: 'stl-002' },
  { id: 'txn-003', date: '2026-11-13', description: 'Simulated payout to Bank ****4521', type: 'debit', amount: 5_000_000, status: 'confirmed' },
  { id: 'txn-004', date: '2026-11-12', description: 'Settlement – Order #ORD-4765', type: 'credit', amount: 2_100_000, status: 'confirmed', settlementId: 'stl-003' },
  { id: 'txn-005', date: '2026-11-11', description: 'Settlement – Order #ORD-4744', type: 'credit', amount: 980_000, status: 'pending', settlementId: 'stl-004' },
  { id: 'txn-006', date: '2026-11-10', description: 'Simulated payout to Bank ****4521', type: 'debit', amount: 2_000_000, status: 'confirmed' },
  { id: 'txn-007', date: '2026-11-09', description: 'Settlement – Order #ORD-4701', type: 'credit', amount: 4_200_000, status: 'confirmed', settlementId: 'stl-005' },
  { id: 'txn-008', date: '2026-11-08', description: 'Settlement – Order #ORD-4688', type: 'credit', amount: 1_570_000, status: 'failed', settlementId: 'stl-006' },
  { id: 'txn-009', date: '2026-11-07', description: 'Simulated payout to Bank ****4521', type: 'debit', amount: 3_500_000, status: 'confirmed' },
  { id: 'txn-010', date: '2026-11-06', description: 'Settlement – Order #ORD-4650', type: 'credit', amount: 2_800_000, status: 'confirmed', settlementId: 'stl-007' },
];

export const settlements = [
  { id: 'stl-001', orderId: 'ORD-4821', date: '2026-11-15', grossAmount: 3_412_500, platformFee: 162_500, netPaid: 3_250_000, status: 'confirmed', produce: 'Tomato', quantityKg: 455 },
  { id: 'stl-002', orderId: 'ORD-4790', date: '2026-11-14', grossAmount: 1_890_000, platformFee: 90_000, netPaid: 1_800_000, status: 'confirmed', produce: 'Carrot', quantityKg: 300 },
  { id: 'stl-003', orderId: 'ORD-4765', date: '2026-11-12', grossAmount: 2_205_000, platformFee: 105_000, netPaid: 2_100_000, status: 'confirmed', produce: 'Cabbage', quantityKg: 420 },
  { id: 'stl-004', orderId: 'ORD-4744', date: '2026-11-11', grossAmount: 1_029_000, platformFee: 49_000, netPaid: 980_000, status: 'pending', produce: 'Leek', quantityKg: 196 },
  { id: 'stl-005', orderId: 'ORD-4701', date: '2026-11-09', grossAmount: 4_410_000, platformFee: 210_000, netPaid: 4_200_000, status: 'confirmed', produce: 'Tomato', quantityKg: 882 },
  { id: 'stl-006', orderId: 'ORD-4688', date: '2026-11-08', grossAmount: 1_648_500, platformFee: 78_500, netPaid: 1_570_000, status: 'failed', produce: 'Pepper', quantityKg: 157 },
  { id: 'stl-007', orderId: 'ORD-4650', date: '2026-11-06', grossAmount: 2_940_000, platformFee: 140_000, netPaid: 2_800_000, status: 'confirmed', produce: 'Onion', quantityKg: 490 },
];

export const payoutOptions = [
  { value: 'bank-001', label: 'Commercial Bank ****4521' },
  { value: 'bank-002', label: 'BOC ****8834' },
  { value: 'bank-003', label: 'Sampath Bank ****2210' },
];

export const payouts = [
  { id: 'pay-001', date: '2026-11-13', amount: 5_000_000, bankLabel: 'Commercial Bank ****4521', status: 'confirmed', reference: 'SIM-PAY-20261113-001' },
  { id: 'pay-002', date: '2026-11-10', amount: 2_000_000, bankLabel: 'Commercial Bank ****4521', status: 'confirmed', reference: 'SIM-PAY-20261110-001' },
  { id: 'pay-003', date: '2026-11-07', amount: 3_500_000, bankLabel: 'Commercial Bank ****4521', status: 'confirmed', reference: 'SIM-PAY-20261107-001' },
];
