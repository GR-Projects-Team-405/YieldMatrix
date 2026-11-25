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

export type TimelineStageKey = 'order_placed' | 'farmer_confirmation' | 'stock_reservation' | 'dispatch' | 'out_for_delivery' | 'delivered';
export type TimelineStageStatus = 'completed' | 'current' | 'pending' | 'cancelled';

export interface TimelineStage {
  id: string;
  stageName: string;
  stageKey: TimelineStageKey;
  status: TimelineStageStatus;
  timestamp: string | null;
  formattedTimestamp: string | null;
  description: string;
  actor?: string | null;
  location?: string | null;
  isSampleData?: boolean;
}

export interface OrderTimelineResponse {
  order: {
    id: string;
    orderCode: string;
    operationKey: string;
    productName: string;
    quantityKg: number;
    totalPriceLkr: number;
    formattedTotalPrice: string;
    displayStatus: OrderDisplayStatus;
    rawStatus: string;
    orderDate: string;
    createdAt: string;
    deliveryDate: string;
    destination: string;
    destinationDistrict: string;
    cancellationReason?: string | null;
  };
  stages: TimelineStage[];
  currentStageIndex: number;
  progressPercentage: number;
  deliveryInfo: DeliveryInfo;
  requestId: string;
}

export interface DeliveryCheckpoint {
  id: string;
  step: number;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  status: 'completed' | 'current' | 'pending';
  timestamp: string | null;
  date: string | null;
  description: string;
}

export interface DeliveryCarrier {
  driverName: string;
  driverPhone: string;
  company: string;
  vehicleNumber: string;
  vehicleType: string;
  cargoCondition?: string;
  isSimulated: boolean;
}

export interface DeliveryLocation {
  farmName?: string;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  farmerName?: string;
  recipientName?: string;
  specialInstructions?: string;
}

export interface DeliveryTrackingInfo {
  deliveryStatus: 'in_transit' | 'delivered' | 'processing' | 'pending' | 'cancelled';
  statusLabel: string;
  estimatedArrival: string | null;
  progressPercentage: number;
  distanceRemainingKm: number | null;
  totalDistanceKm: number;
  currentPosition: {
    latitude: number;
    longitude: number;
    locationName: string;
  } | null;
  isSimulatedGPS: boolean;
  simulationNotice: string;
}

export interface DeliveryTrackingApiResponse {
  order: {
    id: string;
    orderCode: string;
    operationKey: string;
    productName: string;
    quantityKg: number;
    totalPriceLkr: number;
    formattedTotalPrice: string;
    displayStatus: OrderDisplayStatus;
    rawStatus: string;
    orderDate: string;
    createdAt: string;
    deliveryDate: string;
    destination: string;
    destinationDistrict: string;
    cancellationReason?: string | null;
  };
  tracking: DeliveryTrackingInfo;
  pickup: DeliveryLocation;
  destination: DeliveryLocation;
  carrier: DeliveryCarrier | null;
  routeCheckpoints: DeliveryCheckpoint[];
  hasLocationData: boolean;
  supportContact: {
    phone: string;
    email: string;
    operatingHours: string;
  };
  requestId: string;
}

export type CancellationReason =
  | 'Ordered by mistake'
  | 'No longer required'
  | 'Delivery delay'
  | 'Incorrect order details'
  | 'Other';

export interface CancelOrderPayload {
  reason: CancellationReason | string;
  additionalDetails?: string;
}

export interface CancelOrderApiResponse {
  success: boolean;
  cancellationStatus: 'cancelled' | 'pending_approval' | 'already_cancelled' | 'not_allowed' | 'duplicate_pending';
  requiresApproval: boolean;
  message: string;
  order: {
    id: string;
    orderCode: string;
    operationKey: string;
    status: string;
    displayStatus: OrderDisplayStatus;
    cancellationReason?: string;
  };
  refundNotice: string;
  existingReason?: string;
  submittedAt?: string;
  requestId: string;
}
