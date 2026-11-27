import api from '../../services/api';

export type Summary = {
  accepted_sales_cents: string;
  available_kg: string;
  pending_allocations: number;
  completed_orders: number;
  active_listings?: number;
  accepted_kg?: string;
  sales_cents?: string;
  settled_cents?: string;
  active_crops?: number;
};

export type Harvest = {
  id: string;
  planned_harvest_date: string;
  planned_kg: string;
  status: 'planned' | 'ready';
  farm: string;
  district: string;
  crop: string;
  grade: string;
};

export type Allocation = {
  id: string;
  status: string;
  agreed_kg: string;
  agreed_value_cents: string;
  order_id: string;
  order_status: string;
  buyer: string;
  crop: string;
  grade: string;
  created_at: string;
};

export type BuyerDemand = {
  id: string;
  destination_district: string;
  quantity_kg: string;
  budget_cents: string | null;
  delivery_from: string;
  delivery_until: string;
  allow_partial: boolean;
  expires_at: string;
  buyer: string;
  crop: string;
  grade: string;
};

export type MarketInsight = {
  cropId: string;
  gradeId: string;
  crop: string;
  grade: string;
  district: string;
  recentDemandKg: string | null;
  priorDemandKg: string | null;
  averagePriceCents: string | null;
  demandTrend: 'rising' | 'falling' | 'steady' | 'insufficient_data';
  changePercent: number | null;
  suggestedPriceLowCents: string | null;
  suggestedPriceHighCents: string | null;
  observationCount: number;
  includesSampleData: boolean;
  observedThrough: string;
  reason: string;
};

export type FarmerPriceAlert = {
  id: string;
  crop_id: string;
  grade_id: string;
  crop: string;
  grade: string;
  district: string;
  lower_price_cents: string;
  upper_price_cents: string;
  current_price_cents: string | null;
  status: 'active' | 'replaced' | 'paused';
  price_state: 'below' | 'above' | 'within' | 'unknown';
  created_at: string;
  updated_at: string;
};

export type Overview = {
  summary: Summary;
  upcomingHarvests: Harvest[];
  recentAllocations: Allocation[];
  activeDemands: BuyerDemand[];
  marketInsights: MarketInsight[];
};

export type SalesTrend = { period_start: string; accepted_kg: string; sales_cents: string };
export type SalesCrop = { crop_id: string; crop: string; grade: string; accepted_kg: string; sales_cents: string };
export type SalesTransaction = {
  order_id: string; destination_district: string; order_status: string; updated_at: string;
  buyer: string; crop: string; grade: string; accepted_kg: string;
  price_cents_per_kg: string; sales_cents: string; settled_cents: string;
};
export type SalesPerformanceData = { summary: Summary; trend: SalesTrend[]; crops: SalesCrop[]; transactions: SalesTransaction[]; days: number };

export type CompletedOrder = {
  order_id: string; order_status: string; destination_district: string; completed_at: string; batch_id: string;
  buyer: string; crop: string; grade: string; ordered_kg: string; accepted_kg: string;
  price_cents_per_kg: string; sales_cents: string; settled_cents: string; allocation_status: string;
};
export type CompletedOrdersData = { summary: Summary & { ordered_kg: string; fully_accepted_lines: number; partially_accepted_lines: number }; trend: Array<{ week_start: string; accepted_kg: string; completed_orders: number }>; orders: CompletedOrder[]; crops?: Array<{ crop_id: string; crop: string }>; days: number };

export async function getOverview() {
  const { data } = await api.get<Overview>('/ym06/overview');
  return data;
}

export async function getSales(days: number, cropId = '') {
  const { data } = await api.get<SalesPerformanceData>('/ym06/sales', { params: { days, ...(cropId ? { cropId } : {}) } });
  return data;
}

export async function getHarvests() {
  const { data } = await api.get<{ harvests: Harvest[] }>('/ym06/harvests');
  return data.harvests;
}

export async function getCompletedOrders(days: number, cropId = '') {
  const { data } = await api.get<CompletedOrdersData>('/ym06/completed-orders', { params: { days, ...(cropId ? { cropId } : {}) } });
  return data;
}

export async function getFarmerPriceAlerts(filters: { cropId: string; gradeId: string; district: string }) {
  const { data } = await api.get<{ active: FarmerPriceAlert | null; history: FarmerPriceAlert[] }>('/ym06/price-alerts', { params: filters });
  return data;
}

export async function saveFarmerPriceAlert(input: { cropId: string; gradeId: string; district: string; lowerPriceCents: number; upperPriceCents: number }) {
  const { data } = await api.post<{ alert: FarmerPriceAlert }>('/ym06/price-alerts', input);
  return data.alert;
}

export const formatLkr = (cents: string | number | null | undefined) => new Intl.NumberFormat('en-LK', {
  style: 'currency', currency: 'LKR', maximumFractionDigits: 0,
}).format(Number(cents || 0) / 100);

export const formatKg = (kg: string | number | null | undefined) => `${Number(kg || 0).toLocaleString('en-LK', { maximumFractionDigits: 1 })} kg`;

export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat('en-LK', options || { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};
