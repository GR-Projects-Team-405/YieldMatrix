// YM29 · Yasindu Janapriya · Shared TypeScript interfaces for Market Information (Screens 1-5).

export type InsightStatus = 'available' | 'insufficient_data' | 'stale' | 'service_unavailable' | 'empty';

export interface CropOption {
  id: string;
  name: string;
}

export interface GradeOption {
  id: string;
  name: string;
  description?: string | null;
}

export interface DistrictOption {
  name: string;
  hub_label: string;
}

export interface ReferenceDataResponse {
  crops: CropOption[];
  grades: GradeOption[];
  districts: DistrictOption[];
  db_connected: boolean;
  requestId?: string;
}

export interface ForecastSeriesPoint {
  date: string;
  predicted_kg: number | null;
  baseline_kg: number | null;
  variance_pct: number | null;
  note: string;
}

export interface ForecastPayload {
  status: InsightStatus;
  method: string;
  model_version: string | null;
  data_date: string | null;
  input_from: string | null;
  input_until: string | null;
  training_from: string | null;
  training_until: string | null;
  evaluation_from: string | null;
  evaluation_until: string | null;
  observed_days?: number;
  required_days?: number;
  horizon_days: number;
  series: ForecastSeriesPoint[];
  total_projected_kg: number | null;
  peak_day: ForecastSeriesPoint | null;
  model_mae_kg: number | null;
  baseline_mae_kg: number | null;
  published_method_label: string;
  explanation: string;
  limitations: string;
  is_demo: boolean;
  generated_at: string;
}

export interface PriceStatsPayload {
  status: InsightStatus;
  crop: string;
  grade: string;
  district: string;
  p25_cents: number | null;
  median_cents: number | null;
  p75_cents: number | null;
  observation_count: number;
  minimum_required: number;
  window_from: string;
  window_until: string;
  data_date: string | null;
  source: string;
  is_demo: boolean;
  note: string;
}

export interface WeatherDay {
  date: string;
  temp_max: number;
  temp_min: number;
  rain_mm: number;
  condition: string;
  status: 'observed' | 'forecast';
}

export interface WeatherPayload {
  district: string;
  hub_label: string;
  source: string;
  label: string;
  is_sample: boolean;
  context_only: boolean;
  observed_at: string;
  data_date: string;
  days: WeatherDay[];
  risk_level: 'low' | 'moderate' | 'high';
  summary: string;
  transit_note: string;
}

export interface AdvisoryReason {
  category: 'demand' | 'price' | 'weather';
  title: string;
  evidence_type: string;
  date: string;
  text: string;
  scope: string;
}

export interface EvidenceMatrixRow {
  element: string;
  evidence_type: string;
  supporting_source: string;
  data_date: string;
  method_scope: string;
  updated_at: string;
}

export interface MarketMatrixRow {
  crop_id: string;
  crop: string;
  grade_id: string;
  grade: string;
  district: string;
  status: InsightStatus;
  demand_trend_pct: number | null;
  demand_trend_label: string;
  p25_cents: number | null;
  median_cents: number | null;
  p75_cents: number | null;
  method: string;
  evidence_source: string;
  data_date: string | null;
  is_demo: boolean;
}

export interface MarketInsightsResponse {
  mode: 'live' | 'demo';
  status: InsightStatus;
  data_date: string | null;
  method: string;
  generated_at: string;
  is_demo: boolean;
  selection: {
    crop: CropOption;
    grade: GradeOption;
    district: string;
  };
  kpis: {
    top_demand_crop: string | null;
    top_demand_subtext: string;
    suggested_price_cents: number | null;
    forecast_mae_kg: number | null;
    baseline_mae_kg: number | null;
    last_updated_at: string | null;
  };
  forecast: ForecastPayload;
  price_stats: PriceStatsPayload;
  weather: WeatherPayload;
  reasons: AdvisoryReason[];
  market_matrix: MarketMatrixRow[];
  requestId?: string;
}

export interface DemandForecastResponse extends ForecastPayload {
  mode: 'live' | 'demo';
  selection: {
    crop: CropOption;
    district: string;
  };
  requestId?: string;
}

export interface PriceWeatherAdviceResponse {
  mode: 'live' | 'demo';
  status: InsightStatus;
  data_date: string | null;
  method: string;
  generated_at: string;
  is_demo: boolean;
  advisory_disclaimer: string;
  selection: {
    crop: CropOption;
    grade: GradeOption;
    district: string;
  };
  forecast_summary: ForecastPayload;
  selected_price: PriceStatsPayload;
  grade_prices: PriceStatsPayload[];
  weather: WeatherPayload;
  corridor_weather: WeatherPayload[];
  reasons: AdvisoryReason[];
  evidence_matrix: EvidenceMatrixRow[];
  requestId?: string;
}

export interface UploadDisplayRow {
  row_number: number;
  date: string;
  crop: string;
  district: string;
  grade: string;
  demand_kg: string;
  price_per_kg: string;
  source: string;
  status: 'valid' | 'duplicate' | 'error';
  issues: string[];
}

export interface UploadSummary {
  id: string;
  status: 'pending_review' | 'committed' | 'rejected';
  file_name: string;
  file_size_bytes: number;
  checksum: string;
  sample_data: boolean;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  decided_at: string | null;
  decision_reason: string | null;
  total_rows: number;
  valid_rows: number;
  duplicate_rows: number;
  error_rows: number;
  can_approve: boolean;
  date_range: { from: string | null; until: string | null };
  sources: string[];
  crops: string[];
  districts: string[];
  issue_breakdown: Record<string, number>;
}

export interface UploadDetail extends UploadSummary {
  rows: UploadDisplayRow[];
  flagged_rows: UploadDisplayRow[];
}

export interface AdminDatasetHistoryItem {
  id: string;
  upload_id: string | null;
  file_name: string;
  sources: string[];
  date_from: string | null;
  date_until: string | null;
  row_count: number;
  error_rows?: number;
  status: string;
  sample_data: boolean;
  actor_name: string;
  occurred_at: string | null;
  reason: string;
}

export interface AdminDatasetsResponse {
  mode: 'live' | 'demo';
  is_demo: boolean;
  status: InsightStatus;
  data_date: string | null;
  generated_at: string;
  summary: {
    approved_imports: number;
    rejected_imports: number;
    total_observations: number;
    active_series_count: number;
    stale_series_count: number;
    insufficient_series_count: number;
    earliest_date: string | null;
    latest_date: string | null;
    is_stale: boolean;
    has_sample_data: boolean;
  };
  pending_uploads: UploadSummary[];
  datasets: AdminDatasetHistoryItem[];
  requestId?: string;
}

export interface AdminEvaluationResponse {
  mode: 'live' | 'demo';
  status: InsightStatus;
  is_demo: boolean;
  published_method: string;
  published_method_label: string;
  model_version: string | null;
  overall_model_mae_kg: number | null;
  overall_baseline_mae_kg: number | null;
  improvement_kg: number | null;
  evaluation_window: string | null;
  data_date: string | null;
  generated_at: string;
  by_crop: {
    crop: string;
    model_mae_kg: number | null;
    baseline_mae_kg: number | null;
    published_method: string;
  }[];
  coverage: {
    total_pairs: number;
    available_pairs: number;
    insufficient_pairs: number;
    stale_pairs: number;
  };
  requestId?: string;
}
