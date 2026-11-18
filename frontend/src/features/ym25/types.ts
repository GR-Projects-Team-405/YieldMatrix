export type TraceStatus = 'Delivered' | 'In Transit' | 'Verified' | 'Processing';

export interface TraceRecord {
  id: string;
  produce: string;
  farm: string;
  harvestDate: string;
  status: TraceStatus;
}

export interface TraceStats {
  totalBatches: number;
  delivered: number;
  verifiedRate: string;
  scanCount: string;
}