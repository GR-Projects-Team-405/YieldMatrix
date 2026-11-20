export type TraceStatus = 'Delivered' | 'In Transit' | 'Verified' | 'Processing';

export interface TraceRecord {
  id: string;
  produce: string;
  farm: string;
  harvestDate: string;
  quantity: string;
  status: TraceStatus;
}

export interface TraceStats {
  totalBatches: number;
  delivered: number;
  verifiedRate: string;
  scanCount: string;
}

export interface BatchSummaryInfo {
  batchId: string;
  cropGrade: string;
  farmOrigin: string;
  harvestDate: string;
  quantityAgreedPrice: string;
  allocationId: string;
  orderId: string;
  tripId: string;
  buyerAcceptance: string;
  status: TraceStatus;
}

export interface BatchTimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  location: string;
  quantity: string;
  outcome: string;
  tone: 'success' | 'info' | 'warning' | 'neutral';
}