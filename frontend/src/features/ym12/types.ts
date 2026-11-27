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

export interface PerformanceMetric {
  percent: number | null;
  numerator: number | null;
  denominator: number | null;
}

export interface CompletedOrdersMetric {
  count: number | null;
}

export interface SupplierPerformanceTrendMonth {
  month: string;
  label: string;
  completed: number;
  confirmed: number;
  percent: number | null;
  isPartial: boolean;
  through: string | null;
}

export interface SupplierPerformanceResponse {
  supplier: {
    id: string;
    name: string;
    district: string;
    verified: boolean;
  };
  period: {
    from: string;
    to: string;
    timezone: 'Asia/Colombo (UTC+05:30)';
  };
  insufficientHistory: boolean;
  metrics: {
    acceptanceRate: PerformanceMetric;
    fulfilmentRate: PerformanceMetric;
    onTimePickup: PerformanceMetric;
    disputeRate: PerformanceMetric;
    completedOrders: CompletedOrdersMetric;
  };
  trend: SupplierPerformanceTrendMonth[];
  basis: {
    buyerRequests: number | null;
    confirmedOrders: number | null;
    completedOrders: number | null;
  };
  dataSource: ProduceDataSource;
  requestId: string;
}

export interface PerformancePeriodQuery {
  from?: string;
  to?: string;
}

export interface ComparisonItem {
  rank: number;
  listingId: string;
  supplierId: string;
  supplierName: string;
  district: string;
  pricePerKgCents: string;
  pricePerKgLkr: string;
  availableKg: string;
  distanceKm: number | null;
  grade: string;
  harvestStart: string;
  harvestEnd: string;
  performanceScore: number | null;
  isBestPrice: boolean;
}

export interface UnavailableComparisonListing {
  id: string;
  reason: string;
}

export interface ComparisonResponse {
  crop: string | null;
  sameCrop: boolean;
  rankingMethod: 'price, then distance; unknown distances last';
  items: ComparisonItem[];
  unavailable: UnavailableComparisonListing[];
  buyerDistrict: string;
  maxCompare: number;
  dataSource: ProduceDataSource;
  requestId: string;
}
