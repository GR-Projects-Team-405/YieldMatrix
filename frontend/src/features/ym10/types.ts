export type BuyerRequestStatus = 'Open' | 'Closing soon' | 'Offer sent' | 'Matching';

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
}
