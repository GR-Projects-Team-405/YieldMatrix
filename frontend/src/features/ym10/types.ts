export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

export interface BuyerRequest {
  id: string;
  requestCode: string;
  buyerName: string;
  cropName: string;
  gradeName: string;
  district: string;
  quantityKg: number;
  deliveryFrom: string;
  deliveryUntil: string;
  budgetCents: number | null;
  maxPricePerKgCents: number | null;
  expiresAt: string;
  closingSoon: boolean;
  hasMatchingStock: boolean;
  myOfferStatus: OfferStatus | null;
}

export interface BuyerRequestDetails extends BuyerRequest {
  destination: string | null;
  allowPartial: boolean;
}

export interface HarvestBatch {
  id: string;
  batchCode: string;
  availableKg: number;
  harvestDate: string;
}

export interface BuyerRequestsResponse {
  summary: {
    openRequests: number;
    matchingRequests: number;
    offersSubmitted: number;
    awaitingReply: number;
    closingSoon: number;
  };
  requests: BuyerRequest[];
}

export interface BuyerRequestDetailsResponse {
  request: BuyerRequestDetails;
  matchingBatches: HarvestBatch[];
  myOffer: { status: OfferStatus } | null;
}

export interface Offer {
  id: string;
  offerCode: string;
  requestId: string;
  requestCode: string;
  buyerName: string;
  cropName: string;
  gradeName: string;
  quantityKg: number;
  pricePerKgCents: number;
  totalCents: number;
  status: OfferStatus;
  createdAt: string;
  availableFrom?: string;
  notes?: string;
}

export interface OffersResponse {
  summary: {
    pending: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
    expired: number;
    totalOfferedCents: number;
    offerCount: number;
  };
  offers: Offer[];
}

export interface SubmitOfferResponse {
  offer: Offer;
}
