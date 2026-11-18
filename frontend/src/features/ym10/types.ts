export type BuyerRequestStatus = 'Open' | 'Closing soon' | 'Offer sent' | 'Matching' | 'Closed';

export interface BuyerRequest {
  id: string;
  buyerName: string;
  district: string;
  produce: string;
  grade: string;
  quantityKg: number;
  deliveryDate: string;
  minimumPrice: number;
  maximumPrice: number;
  status: BuyerRequestStatus;
  notes?: string;
}

export interface HarvestBatch {
  id: string;
  produce: string;
  grade: string;
  availableQuantityKg: number;
  availableDate: string;
}

export type OfferStatus = 'Pending' | 'Accepted' | 'Declined';

export interface Offer {
  id: string;
  requestId: string;
  buyerName: string;
  produce: string;
  grade: string;
  quantityKg: number;
  pricePerKg: number;
  status: OfferStatus;
  submittedDate: string;
  notes?: string;
}
