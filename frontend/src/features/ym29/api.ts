// YM29 · Yasindu Janapriya · Typed API client targeting /api/ym29/* via shared services/api.ts.

import api from '../../services/api';
import type {
  ReferenceDataResponse,
  MarketInsightsResponse,
  DemandForecastResponse,
  PriceWeatherAdviceResponse,
  AdminDatasetsResponse,
  AdminEvaluationResponse,
  UploadDetail,
  UploadSummary,
} from './types';

export async function fetchReferenceData(): Promise<ReferenceDataResponse> {
  const { data } = await api.get<ReferenceDataResponse>('/ym29/reference');
  return data;
}

export async function fetchMarketInsights(params: {
  cropId?: string;
  crop?: string;
  gradeId?: string;
  grade?: string;
  district?: string;
  demo?: boolean;
}): Promise<MarketInsightsResponse> {
  const { data } = await api.get<MarketInsightsResponse>('/ym29/insights', {
    params: { ...params, demo: params.demo ? 'true' : 'false' },
  });
  return data;
}

export async function fetchDemandForecast(params: {
  cropId?: string;
  crop?: string;
  district?: string;
  demo?: boolean;
}): Promise<DemandForecastResponse> {
  const { data } = await api.get<DemandForecastResponse>('/ym29/forecast', {
    params: { ...params, demo: params.demo ? 'true' : 'false' },
  });
  return data;
}

export async function fetchPriceWeatherAdvice(params: {
  cropId?: string;
  crop?: string;
  gradeId?: string;
  grade?: string;
  district?: string;
  demo?: boolean;
}): Promise<PriceWeatherAdviceResponse> {
  const { data } = await api.get<PriceWeatherAdviceResponse>('/ym29/price-advice', {
    params: { ...params, demo: params.demo ? 'true' : 'false' },
  });
  return data;
}

export async function fetchAdminDatasets(demo = false): Promise<AdminDatasetsResponse> {
  const { data } = await api.get<AdminDatasetsResponse>('/ym29/admin/datasets', {
    params: { demo: demo ? 'true' : 'false' },
  });
  return data;
}

export async function fetchAdminEvaluation(demo = false): Promise<AdminEvaluationResponse> {
  const { data } = await api.get<AdminEvaluationResponse>('/ym29/admin/evaluation', {
    params: { demo: demo ? 'true' : 'false' },
  });
  return data;
}

export async function uploadMarketCsvFile(params: {
  csvText: string;
  fileName: string;
  sampleData: boolean;
}): Promise<{ upload: UploadDetail }> {
  const { data } = await api.post<{ upload: UploadDetail }>('/ym29/admin/uploads', params.csvText, {
    headers: {
      'Content-Type': 'text/csv',
      'X-File-Name': params.fileName,
      'X-Sample-Data': params.sampleData ? 'true' : 'false',
    },
    timeout: 30000,
  });
  return data;
}

export async function fetchUploadReview(uploadId: string): Promise<{ upload: UploadDetail }> {
  const { data } = await api.get<{ upload: UploadDetail }>(`/ym29/admin/uploads/${encodeURIComponent(uploadId)}`);
  return data;
}

export async function commitUploadReview(uploadId: string): Promise<{
  message: string;
  inserted_count: number;
  upload: UploadSummary;
}> {
  const { data } = await api.post<{ message: string; inserted_count: number; upload: UploadSummary }>(
    `/ym29/admin/uploads/${encodeURIComponent(uploadId)}/commit`,
  );
  return data;
}

export async function rejectUploadReview(
  uploadId: string,
  reason: string,
): Promise<{ message: string; upload: UploadSummary }> {
  const { data } = await api.post<{ message: string; upload: UploadSummary }>(
    `/ym29/admin/uploads/${encodeURIComponent(uploadId)}/reject`,
    { reason },
  );
  return data;
}
