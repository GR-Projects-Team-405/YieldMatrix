import axios from 'axios';
import api from '../../services/api';
import type { TraceStatus } from './types';

export interface TraceRecordDto {
  id: string;
  displayId: string;
  produce: string;
  farm: string;
  harvestDate: string;
  quantityKg: string;
  status: TraceStatus;
}

export interface TraceRecordsResponse {
  records: TraceRecordDto[];
  summary: {
    total: number;
    delivered: number;
    verified: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  requestId: string;
}

export interface TraceBatchDto {
  id: string;
  displayId: string;
  produce: string;
  grade: string;
  farm: string;
  district: string;
  harvestDate: string;
  quantityKg: string;
  status: string;
}

export interface TraceHistoryEventDto {
  id: string;
  eventType: string;
  source: 'trace' | 'custody';
  occurredAt: string;
  recordedAt: string;
  quantityKg?: string;
  publicPayload?: Record<string, unknown>;
  payloadHash?: string;
  anchorStatus?: string;
  localDemo?: boolean;
}

export interface TraceHistoryResponse {
  batch: TraceBatchDto;
  events: TraceHistoryEventDto[];
  requestId: string;
}

export interface VerificationEventDto {
  id: string;
  eventType: string;
  payloadHash: string;
  anchorStatus: 'unanchored' | 'pending' | 'verified' | 'failed';
  localDemo: boolean;
  chainId: string | null;
  contractReference: string | null;
  transactionHash: string | null;
  occurredAt: string;
  recordedAt: string;
}

export interface VerificationResponse {
  batch: TraceBatchDto;
  verification: {
    status: 'unavailable' | 'demo' | 'failed' | 'pending' | 'verified';
    isLiveVerification: boolean;
    eventCount: number;
    lastUpdatedAt: string | null;
  };
  events: VerificationEventDto[];
  requestId: string;
}

export function getTraceRecords(page: number, query: string, signal?: AbortSignal) {
  return api.get<TraceRecordsResponse>('/ym25/records', {
    params: { page, limit: 5, q: query || undefined },
    signal,
  });
}

export function getTraceHistory(batchId: string, signal?: AbortSignal) {
  return api.get<TraceHistoryResponse>(`/ym25/records/${encodeURIComponent(batchId)}/history`, { signal });
}

export function getTraceVerification(batchId: string, signal?: AbortSignal) {
  return api.get<VerificationResponse>(`/ym25/records/${encodeURIComponent(batchId)}/verification`, { signal });
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ error?: unknown }>(error) && typeof error.response?.data?.error === 'string') {
    return error.response.data.error;
  }
  return 'Could not load traceability data. Please try again.';
}

export function formatTraceDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatTraceTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
}

export function formatTraceQuantity(value: string) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(quantity)} kg` : `${value} kg`;
}
