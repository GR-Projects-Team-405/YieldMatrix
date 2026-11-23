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
  status: 'available' | 'insufficient_data' | 'stale' | 'failed' | 'pending_api';
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
  aiServiceConfigured?: boolean;
  generatedAt: string | null;
  series: ForecastPoint[];
}

export interface MarketPriceInsights {
  available: boolean;
  method: string;
  source?: string | null;
  observationCount: number;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  avgPriceCents: number | null;
  dateFrom: string | null;
  dateUntil: string | null;
  lastUpdated: string | null;
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

export type CropCategoryKey =
  | 'vegetables'
  | 'fruits'
  | 'leafy_greens'
  | 'root_crops'
  | 'grains'
  | 'other';

export interface MarketplaceCategory {
  key: CropCategoryKey;
  label: string;
  count?: number;
}

export interface MarketplaceCropOption extends NamedOption {
  category: CropCategoryKey;
}

export interface MarketplaceFilterOptions {
  crops: MarketplaceCropOption[];
  grades: NamedOption[];
  districts: string[];
  categories?: MarketplaceCategory[];
}

export interface MarketplaceItem {
  id: string;
  listingId: string | null;
  batchId: string;
  farmId: string;
  farmName: string;
  district: string;
  cropId: string;
  cropName: string;
  category: CropCategoryKey;
  gradeId: string;
  gradeName: string;
  availableKg: number;
  unitPriceCents: number | null;
  isListed: boolean;
  batchStatus: string;
  availabilityStatus: 'available_now' | 'planned';
  readyToPurchase: boolean;
  harvestDate: string | null;
  plannedHarvestDate: string | null;
  actualHarvestDate: string | null;
  validUntil: string | null;
  publicTraceToken: string;
  createdAt: string;
}

export interface MarketplaceOverviewResponse {
  summary: {
    availableNowCount: number;
    availableNowTotalKg: number;
    comingSoonCount: number;
    comingSoonTotalKg: number;
    activeSuppliersCount: number;
  };
  categories: MarketplaceCategory[];
  availableNow: MarketplaceItem[];
  comingSoon: MarketplaceItem[];
  filters: MarketplaceFilterOptions;
  requestId: string;
}

export type SearchAvailabilityMode =
  | 'all'
  | 'available_now'
  | 'within_7_days'
  | 'within_30_days'
  | 'planned';

export type SearchSortMode =
  | 'price_asc'
  | 'price_desc'
  | 'quantity_desc'
  | 'harvest_asc'
  | 'newest';

export interface MarketplaceSearchResponse {
  items: MarketplaceItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  appliedFilters: {
    q: string;
    cropId: string | null;
    category: CropCategoryKey | null;
    gradeIds: string[];
    district: string | null;
    minPriceCents: number | null;
    maxPriceCents: number | null;
    minKg: number | null;
    availability: SearchAvailabilityMode;
    sort: SearchSortMode;
  };
  filters: MarketplaceFilterOptions;
  requestId: string;
}

export interface HarvestAvailabilityEntry extends MarketplaceItem {
  quantityKg: number;
  availabilityDate: string | null;
}

export interface HarvestAvailabilityResponse {
  month: string;
  monthStart: string;
  monthEnd: string;
  timezone: string;
  summary: {
    availableNowKg: number;
    upcoming30DaysKg: number;
    activeSuppliersCount: number;
    totalEntries: number;
  };
  entries: HarvestAvailabilityEntry[];
  calendarDays: Record<string, HarvestAvailabilityEntry[]>;
  filters: MarketplaceFilterOptions;
  appliedFilters: {
    month: string;
    cropId: string | null;
    gradeId: string | null;
    district: string | null;
    status: 'all' | 'available_now' | 'planned';
  };
  requestId: string;
}
