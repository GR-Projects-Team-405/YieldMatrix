export type PickupHistoryResult = 'completed' | 'partially-collected' | 'unable-to-collect';

export interface PickupHistoryRecord {
  id: string;
  farmName: string;
  farmerName: string;
  cropType: string;
  expectedKg: number;
  actualKg: number;
  pickupDate: string;
  pickupTime: string;
  result: PickupHistoryResult;
  driverNotes?: string;
}

// Independent sample-only data for the Pickup History demo page.
export const mockPickupHistory: PickupHistoryRecord[] = [
  {
    id: 'TRP-001',
    farmName: 'Green Valley Farm',
    farmerName: 'Nadeesha Jayasinghe',
    cropType: 'Spinach',
    expectedKg: 100,
    actualKg: 100,
    pickupDate: '2026-11-03',
    pickupTime: '08:15 AM',
    result: 'completed',
    driverNotes: 'Produce packed in good condition and loaded without delay.',
  },
  {
    id: 'TRP-002',
    farmName: 'Suwan Farm',
    farmerName: 'Sameera Silva',
    cropType: 'Tomato',
    expectedKg: 200,
    actualKg: 180,
    pickupDate: '2026-11-02',
    pickupTime: '04:20 PM',
    result: 'partially-collected',
    driverNotes: 'The remaining tomatoes were too soft for transport.',
  },
  {
    id: 'TRP-003',
    farmName: 'Kamal Farming',
    farmerName: 'Kamal Fernando',
    cropType: 'Green chilies',
    expectedKg: 150,
    actualKg: 150,
    pickupDate: '2026-11-01',
    pickupTime: '11:10 AM',
    result: 'completed',
  },
  {
    id: 'TRP-004',
    farmName: 'Ruwan Farm',
    farmerName: 'Ruwan Perera',
    cropType: 'Cabbage',
    expectedKg: 120,
    actualKg: 120,
    pickupDate: '2026-10-28',
    pickupTime: '02:45 PM',
    result: 'completed',
  },
  {
    id: 'TRP-005',
    farmName: 'Green Valley Farm',
    farmerName: 'Nadeesha Jayasinghe',
    cropType: 'Carrot',
    expectedKg: 180,
    actualKg: 150,
    pickupDate: '2026-10-26',
    pickupTime: '10:30 AM',
    result: 'partially-collected',
    driverNotes: 'Short collection due to produce shortage at the farm.',
  },
  {
    id: 'TRP-006',
    farmName: 'Lanka Harvest',
    farmerName: 'Dilani Madushani',
    cropType: 'Eggplant',
    expectedKg: 150,
    actualKg: 150,
    pickupDate: '2026-10-24',
    pickupTime: '09:05 AM',
    result: 'completed',
  },
  {
    id: 'TRP-007',
    farmName: 'Nuwara Hills Farm',
    farmerName: 'Chathura Bandara',
    cropType: 'Leeks',
    expectedKg: 200,
    actualKg: 200,
    pickupDate: '2026-10-22',
    pickupTime: '01:35 PM',
    result: 'completed',
  },
  {
    id: 'TRP-008',
    farmName: 'Sampath Agro',
    farmerName: 'Sampath Weerasinghe',
    cropType: 'Pumpkin',
    expectedKg: 200,
    actualKg: 0,
    pickupDate: '2026-10-20',
    pickupTime: '03:15 PM',
    result: 'unable-to-collect',
    driverNotes: 'Pickup could not proceed because the produce was not ready.',
  },
];
