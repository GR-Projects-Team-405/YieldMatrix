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