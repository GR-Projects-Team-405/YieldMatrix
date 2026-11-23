import axios from 'axios';
import api from '../../services/api';

// Shapes returned by the YM24 backend (backend/src/modules/ym24).
export type DeliveryStatus = 'Completed' | 'Partially accepted' | 'Disputed';
export type IncidentType = 'spoilage' | 'short_quantity' | 'refused_load' | 'delay' | 'packaging' | 'other';
export type IncidentStatus = 'open' | 'under_review' | 'resolved';

export interface DeliveryRow {
  id: string;
  code: string;
  destination: string;
  buyer: string;
  farms: number;
  vehicle: string;
  deliveredAt: string | null; // UTC ISO timestamp
  pickedUpKg: number;
  handedOverKg: number;
  acceptedKg: number;
  status: DeliveryStatus;
}

export interface DeliveryAllocation {
  farm: string;
  sequence: number;
  pickedUpAt: string | null;
  pickedUpKg: number;
  acceptedKg: number;
  priceCentsPerKg: number; // integer LKR cents
}

export interface DeliveryDetail {
  id: string;
  code: string;
  destination: string;
  buyer: string;
  vehicle: string;
  deliveredAt: string | null;
  recipient: string | null;
  handedOverKg: number;
  status: DeliveryStatus;
  allocations: DeliveryAllocation[];
  incident: { id: string; code: string; text: string; status: IncidentStatus } | null;
}

export interface IncidentRow {
  id: string;
  code: string;
  type: IncidentType;
  description: string;
  tripId: string;
  tripCode: string;
  allocationId: string | null;
  farm: string | null;
  shortageKg: number | null;
  evidenceCount: number;
  status: IncidentStatus;
  createdAt: string;
}

export interface NewIncident {
  tripId: string;
  allocationId?: string;
  type: IncidentType;
  quantityKg?: number;
  description: string;
  evidence?: { name: string; type: string; size: number }[];
  operationKey: string; // one per form, so a double click never saves two incidents
}

export async function getDeliveries(): Promise<DeliveryRow[]> {
  const { data } = await api.get<{ trips: DeliveryRow[] }>('/ym24/deliveries');
  return data.trips;
}

export async function getDelivery(tripId: string): Promise<DeliveryDetail> {
  const { data } = await api.get<{ trip: DeliveryDetail }>(`/ym24/deliveries/${tripId}`);
  return data.trip;
}

export async function getIncidents(): Promise<IncidentRow[]> {
  const { data } = await api.get<{ incidents: IncidentRow[] }>('/ym24/incidents');
  return data.incidents;
}

export async function createIncident(body: NewIncident): Promise<{ id: string; code: string }> {
  const { data } = await api.post<{ incident: { id: string; code: string } }>('/ym24/incidents', body);
  return data.incident;
}

// A short, friendly message for the Alert component.
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Cannot reach the server. Check that the backend is running.';
    const details = error.response.data?.details;
    if (Array.isArray(details) && details.length) return details.join('. ');
    if (error.response.status === 404) return 'This item was not found.';
    if (error.response.status === 403) return 'You do not have access to this.';
  }
  return fallback;
}