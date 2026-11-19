export interface BuyerProfile {
  id: string;
  name: string;
  role: 'buyer';
  district: string | null;
}

export interface DashboardStats {
  activeOrdersCount: number;
  awaitingSupplierCount: number;
  availableSupplyKg: number;
  listedSupplyKg: number;
  batchSupplyKg: number;
  supplySource: 'active_listings' | 'harvest_batches' | 'none';
  activeGrowersCount: number;
  completedOrdersCount: number;
  completedLast30DaysCount: number;
  heldFundsCents: number;
  availableFundsCents: number;
  currency: string;
  simulatedWallet: boolean;
}

export interface HarvestMatchItem {
  listingId: string | null;
  batchId: string;
  farmId: string;
  farmName: string;
  district: string;
  cropId: string;
  cropName: string;
  gradeId: string;
  gradeName: string;
  availableKg: number;
  unitPriceCents: number | null;
  batchStatus: string;
  plannedHarvestDate: string;
}

export interface SuggestedHarvestMatches {
  source: 'active_listings' | 'harvest_batches' | 'none';
  totalAvailableKg: number;
  estimatedTotalCents: number | null;
  growerCount: number;
  matches: HarvestMatchItem[];
}

export interface BulkMatchGrower {
  allocationId: string;
  batchId: string;
  farmId: string;
  farmName: string;
  district: string;
  cropId: string;
  cropName: string;
  gradeId: string;
  gradeName: string;
  agreedKg: number;
  agreedUnitPriceCents: number;
  agreedValueCents: number;
  status: string;
}

export interface LatestBulkMatch {
  orderId: string;
  orderCode: string;
  status: string;
  growerCount: number;
  totalKg: number;
  goodsTotalCents: number;
  primaryCrop: string | null;
  primaryGrade: string | null;
  deliveryDate: string;
  createdAt: string;
  growers: BulkMatchGrower[];
}

export interface ProcurementActivityPoint {
  date: string;
  dayLabel: string;
  orderCount: number;
  totalKg: number;
  totalCents: number;
}

export interface ProcurementActivity {
  range: '7d' | '30d';
  days: number;
  timezone: string;
  totalKg: number;
  totalCents: number;
  peakKg: number;
  series: ProcurementActivityPoint[];
}

export interface NamedOption {
  id: string;
  name: string;
}

export interface ForecastPoint {
  date?: string;
  day?: string;
  demand_kg?: number;
  demandKg?: number;
}

export interface DemandForecast {
  available: boolean;
  status: 'available' | 'insufficient_data' | 'stale' | 'failed';
  cropId: string | null;
  cropName: string | null;
  district: string | null;
  method: string | null;
  modelVersion: string | null;
  horizonDays: number;
  inputFrom: string | null;
  inputUntil: string | null;
  modelMaeKg: number | null;
  baselineMaeKg: number | null;
  trend: 'upward' | 'downward' | 'flat';
  explanation: string;
  sampleData: boolean;
  generatedAt: string | null;
  series: ForecastPoint[];
}

export interface MarketPriceInsights {
  available: boolean;
  method: string;
  observationCount: number;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  avgPriceCents: number | null;
  dateFrom: string | null;
  dateUntil: string | null;
  lastUpdated: string | null;
  sampleData: boolean;
  advisoryNote: string;
}

export interface BuyingInsights {
  advisoryNotice: string;
  filters: {
    selected: {
      cropId: string | null;
      gradeId: string | null;
      district: string | null;
    };
    crops: NamedOption[];
    grades: NamedOption[];
    districts: string[];
  };
  demandForecast: DemandForecast;
  marketPriceInsights: MarketPriceInsights;
  suggestedHarvestMatches: SuggestedHarvestMatches;
}

export interface RecentOrder {
  id: string;
  orderCode: string;
  sourceLabel: string;
  growerCount: number;
  allocationCount: number;
  cropName: string;
  gradeName: string | null;
  totalKg: number;
  agreedTotalCents: number;
  status: string;
  destination: string;
  destinationDistrict: string;
  deliveryDate: string;
  createdAt: string;
}

export interface BuyerDashboardResponse {
  buyer: BuyerProfile;
  generatedAt: string;
  timezone: string;
  stats: DashboardStats;
  matchingNow: SuggestedHarvestMatches;
  latestBulkMatch: LatestBulkMatch | null;
  procurementActivity: ProcurementActivity;
  insights: BuyingInsights;
  recentOrders: RecentOrder[];
  requestId: string;
}
