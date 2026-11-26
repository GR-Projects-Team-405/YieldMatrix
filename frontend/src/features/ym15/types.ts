export type PartialFulfilmentOption = 'yes' | 'no';

export interface BulkMatchRequestInput {
  crop: string;
  grade: string;
  requiredKg: string;
  destination: string;
  deliveryWindow: string;
  maxBudgetLkr: string;
  allowPartial: PartialFulfilmentOption;
}

export interface ValidatedBulkMatchRequest {
  crop: string;
  grade: string;
  requiredKg: number;
  destination: string;
  deliveryWindow: string;
  maxBudgetLkr: number | null;
  allowPartial: boolean;
}

export interface SelectedGrowerAllocation {
  id: string;
  rank: number;
  growerName: string;
  farmName?: string;
  batchCode: string;
  distanceKm: number | null;
  allocatedKg: number;
  unitPriceLkr: number;
  allocationTotalLkr: number;
  crop: string;
  grade: string;
  availableKg: number;
  ruleTag: string;
}

export interface AlternativeGrowerCandidate {
  id: string;
  growerName: string;
  farmName?: string;
  batchCode: string;
  crop?: string;
  grade?: string;
  availableKg: number;
  unitPriceLkr: number;
  distanceKm?: number | null;
  statusLabel: string;
  reasonText: string;
}

export interface BulkMatchResponseData {
  status: 'complete' | 'partial';
  partialBlocked?: boolean;
  methodLabel: 'Rule-based method';
  crop?: string;
  grade?: string;
  destination: string;
  deliveryWindow: string;
  allowPartial: boolean;
  requestedKg: number;
  matchedKg: number;
  shortageKg: number;
  matchedPercent?: number;
  shortagePercent?: number;
  goodsTotalLkr: number;
  maxBudgetLkr: number | null;
  withinBudget: boolean;
  growerCount: number;
  allocations: SelectedGrowerAllocation[];
  alternatives: AlternativeGrowerCandidate[];
  requestId?: string;
}