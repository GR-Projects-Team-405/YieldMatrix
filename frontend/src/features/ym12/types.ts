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

export interface SupplierProfile {
  id: string;
  name: string;
  businessType: string | null;
  district: string;
  country: 'Sri Lanka';
  tagline: string | null;
  description: string | null;
  verified: boolean;
  operatingSinceYear: number | null;
  memberSince: string | null;
  rating: number | null;
  ratingCount: number | null;
}

export interface SupplierPerformanceSummary {
  completedOrders: number | null;
  fulfilmentRatePercent: number | null;
  fulfilmentLabel: string | null;
  insufficientHistory: boolean;
}

export interface SupplierActiveListing {
  listingId: string;
  displayId: string;
  cropName: string;
  grade: string;
  availableKg: string;
  district: string;
  harvestStart: string;
  harvestEnd: string;
  pricePerKgCents: string;
  pricePerKgLkr: string;
  imageUrl: string | null;
}

export interface SupplierProfileResponse {
  supplier: SupplierProfile;
  performanceSummary: SupplierPerformanceSummary;
  cropsSupplied: string[];
  activeListings: SupplierActiveListing[];
  activeListingCount: number;
  dataSource: ProduceDataSource;
  requestId: string;
}
