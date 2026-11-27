export type WorkflowStage = 'review' | 'countdown' | 'evaluation' | 'confirmed' | 'expired' | 'cancelled';

export interface ReservationItem {
  allocationId: string;
  reservationId: string | null;
  commitmentId: string | null;
  farmerId: string;
  farmerName: string;
  farmName: string;
  farmDistrict: string;
  pickupAddress: string;
  latitude: number | null;
  longitude: number | null;
  batchId: string;
  crop: string;
  grade: string;
  requestedKg: number;
  requestedUnitPriceCents: number;
  requestedValueCents: number;
  offeredKg: number;
  offeredUnitPriceCents: number;
  offeredValueCents: number;
  allocationStatus: string;
  reservationStatus: string | null;
  commitmentStatus: string | null;
  responseKind: 'pending' | 'accepted' | 'counter' | string;
  notes: string;
  quality: { moisture: string | null; sizeClass: string | null; label: string };
  imageTone: string;
  expiresAt: string | null;
  decisionReason: string | null;
}

export interface ReservationDetail {
  module: string;
  requestId: string;
  order: {
    id: string;
    status: string;
    destination: string;
    destinationDistrict: string;
    deliveryDate: string;
    createdAt: string;
    contractReference: string;
    cancellationReason: string | null;
  };
  workflow: { stage: WorkflowStage; steps: { id: string; label: string; complete: boolean }[] };
  countdown: { expiresAt: string | null; remainingSeconds: number; expired: boolean };
  summary: {
    requestedKg: number;
    committedKg: number;
    requestedCents: number;
    committedCents: number;
    priceVariancePct: number;
    acceptedCount: number;
    pendingCount: number;
    supplierCount: number;
    escrowState: string;
  };
  produce: { title: string; harvestWindow: string; quality: string; deliveryHub: string };
  items: ReservationItem[];
  logistics: { inspectionWindow: string; disputeProtection: string; coldChain: string; geofence: string; geofenceRadiusKm?: number };
  escrow: {
    simulated: boolean;
    requestedCents: number;
    lockedCents: number;
    walletAvailableCents: number;
    walletHeldCents: number;
    ledger: { id: string; eventType: string; reference: string; amountCents: number; occurredAt: string; simulated: boolean }[];
  };
  maps: {
    harvest: { name: string; district: string; latitude: number; longitude: number }[];
    depot: { name: string; district: string; latitude: number | null; longitude: number | null };
  };
  audit: { id: string; actorId: string | null; action: string; reason: string | null; changes: unknown; occurredAt: string }[];
  confirmation: {
    contractReference: string;
    confirmedAt: string;
    reservedKg: number;
    lockedCents: number;
    execution: { title: string; detail: string }[];
  } | null;
}

export interface ReservationSummary {
  id: string;
  status: string;
  createdAt: string;
  destination: string;
  deliveryDate: string;
  requestedKg: number;
  agreedTotalCents: number;
  contractReference: string;
}
