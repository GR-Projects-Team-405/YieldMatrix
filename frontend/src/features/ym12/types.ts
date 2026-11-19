export type ProduceDataSource = 'database' | 'sample';

export interface ProduceListing {
  id: string;
  displayId: string;
  cropName: string;
  category: string;
  description: string;
  grade: string;
  status: string;
  pricePerKgCents: string;
  pricePerKgLkr: string;
  availableKg: string;
  harvestStart: string;
  harvestEnd: string;
  district: string;
  imageUrl: string | null;
  updatedAt: string;
}

export interface ProduceSupplier {
  id: string;
  name: string;
  district: string;
  verified: boolean;
  completedOrders: number | null;
  rating: number | null;
  ratingCount: number | null;
}

export interface ProduceDetailsResponse {
  listing: ProduceListing;
  supplier: ProduceSupplier;
  dataSource: ProduceDataSource;
  requestId: string;
}
