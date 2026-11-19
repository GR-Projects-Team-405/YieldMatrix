export type OrderDisplayStatus = 'Pending' | 'Processing' | 'In Transit' | 'Delivered' | 'Canceled';

export interface OrderItem {
  crop_name: string;
  grade_name?: string;
  farm_name?: string;
  farm_district?: string;
  agreed_kg: number;
  agreed_unit_price_cents: number;
  agreed_value_cents?: number;
  allocation_status?: string;
}

export interface BuyerOrder {
  id: string;
  orderCode: string;
  operationKey: string;
  productName: string;
  products: OrderItem[];
  quantityKg: number;
  totalPriceLkr: number;
  formattedTotalPrice: string;
  rawStatus: string;
  displayStatus: OrderDisplayStatus;
  orderDate: string;
  createdAt: string;
  deliveryDate: string;
  destination: string;
  destinationDistrict: string;
  cancellationReason?: string | null;
}

export interface OrdersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
}

export interface OrderStatusCounts {
  all: number;
  pending: number;
  processing: number;
  in_transit: number;
  delivered: number;
  canceled: number;
}

export interface OrdersApiResponse {
  orders: BuyerOrder[];
  pagination: OrdersPagination;
  counts: OrderStatusCounts;
  requestId: string;
}

