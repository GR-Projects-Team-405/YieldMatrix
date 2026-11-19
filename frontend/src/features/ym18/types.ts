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

export interface FarmerAllocation {
  id: string;
  farmerId: string;
  farmerName: string;
  farmName: string;
  location: string;
  pickupAddress: string;
  cropName: string;
  gradeName: string;
  allocatedKg: number;
  unitPriceLkr: number;
  agreedValueLkr: number;
  formattedUnitPrice: string;
  formattedAgreedValue: string;
  status: string;
  fundedLkr?: number;
  heldLkr?: number;
  settledLkr?: number;
  refundedLkr?: number;
}

export interface PaymentSummary {
  currency: string;
  totalAmountLkr: number;
  formattedTotalAmount: string;
  fundedLkr: number;
  heldLkr: number;
  settledLkr: number;
  refundedLkr: number;
  escrowStatus: string;
}

export interface DeliveryInfo {
  destination: string;
  district: string;
  scheduledDeliveryDate: string;
  trip?: {
    driverName?: string;
    vehicleNumber?: string;
    vehicleType?: string;
    status?: string;
  } | null;
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
  allocations?: FarmerAllocation[];
  paymentSummary?: PaymentSummary;
  deliveryInfo?: DeliveryInfo;
  formattedDeliveryDate?: string;
  destinationCoordinates?: {
    latitude: number | null;
    longitude: number | null;
  };
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

export interface OrderDetailsApiResponse {
  order: BuyerOrder;
  requestId: string;
}
