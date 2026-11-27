import api from '../../services/api';
import type { ReservationDetail, ReservationSummary } from './types';

export function apiError(error: unknown, fallback = 'Request could not be completed') {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return fallback;
}

export const ym16Api = {
  list: () => api.get<{ reservations: ReservationSummary[] }>('/ym16/reservations').then((res) => res.data.reservations),
  detail: (id: string) => api.get<ReservationDetail>(`/ym16/reservations/${id}`).then((res) => res.data),
  create: (body: { commitmentIds: string[]; destination: string; destinationDistrict: string; deliveryDate: string }) => api.post<ReservationDetail>('/ym16/reservations', body).then((res) => res.data),
  submit: (id: string) => api.post<ReservationDetail>(`/ym16/reservations/${id}/submit`).then((res) => res.data),
  status: (id: string) => api.get<ReservationDetail>(`/ym16/reservations/${id}/status`).then((res) => res.data),
  escrow: (id: string) => api.get<{ escrow: ReservationDetail['escrow']; summary: ReservationDetail['summary'] }>(`/ym16/reservations/${id}/escrow`).then((res) => res.data),
  ledger: (id: string) => api.get<{ ledger: ReservationDetail['escrow']['ledger'] }>(`/ym16/reservations/${id}/ledger`).then((res) => res.data),
  audit: (id: string) => api.get<{ audit: ReservationDetail['audit'] }>(`/ym16/reservations/${id}/audit`).then((res) => res.data),
  farmerReservations: () => api.get<{ reservations: ReservationDetail[] }>('/ym16/farmer/reservations').then((res) => res.data.reservations),
  farmerResponse: (id: string, body: { allocationId: string; response: 'accept' | 'reject' | 'counter'; offeredKg?: number; offeredUnitPriceCents?: number; notes?: string }) => api.post<ReservationDetail>(`/ym16/reservations/${id}/farmer-response`, body).then((res) => res.data),
  decide: (id: string, allocationId: string, decision: 'accept' | 'decline' | 'accept-counter', reason?: string) =>
    api.post<ReservationDetail>(`/ym16/reservations/${id}/allocations/${allocationId}/decision`, { decision, reason }).then((res) => res.data),
  confirm: (id: string) => api.post<ReservationDetail>(`/ym16/reservations/${id}/confirm`).then((res) => res.data),
  message: (id: string, allocationId: string, message: string) =>
    api.post<ReservationDetail>(`/ym16/reservations/${id}/allocations/${allocationId}/message`, { message }).then((res) => res.data),
};
