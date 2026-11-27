export type PickupStopStatus = 'upcoming' | 'pending' | 'completed';

export interface PickupStop {
  id: string;
  sequence: number;
  farmName: string;
  farmerName: string;
  district: string;
  crop: string;
  committedKg: number;
  pickupTime: string;
  status: PickupStopStatus;
}

// Sample-only schedule; YM23 does not yet have a pickup-list API.
export const mockPickupStops: PickupStop[] = [
  {
    id: 'stop-01',
    sequence: 1,
    farmName: 'Green Valley Farm',
    farmerName: 'Nadeesha Jayasinghe',
    district: 'Minuwangoda, Gampaha',
    crop: 'Spinach',
    committedKg: 100,
    pickupTime: 'Today, 08:00 AM',
    status: 'upcoming',
  },
  {
    id: 'stop-02',
    sequence: 2,
    farmName: 'Suwan Farm',
    farmerName: 'Sameera Silva',
    district: 'Gampaha',
    crop: 'Tomato',
    committedKg: 200,
    pickupTime: 'Today, 10:30 AM',
    status: 'pending',
  },
  {
    id: 'stop-03',
    sequence: 3,
    farmName: 'Kamal Farming',
    farmerName: 'Kamal Fernando',
    district: 'Gampaha',
    crop: 'Green chilies',
    committedKg: 150,
    pickupTime: 'Today, 01:00 PM',
    status: 'completed',
  },
];
