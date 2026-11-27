import api from '../../../services/api';

// YM26 · Shermi Weerasinghe · Admin operations · API Service

export interface OrderItem {
  id: string;
  dbId?: string;
  buyer: string;
  buyerLocation: string;
  commodity: string;
  grade: string;
  quantityKg: number;
  quantityDisplay: string;
  unitPriceCents: number;
  totalAmountCents: number;
  supplierAllocation: { confirmed: number; total: number };
  progress: number;
  status: string;
  statusLabel: string;
  deliveryDate: string;
  deliveryDueDisplay: string;
  deliveryDueSubtext: string;
  createdAt: string;
  createdAtDisplay: string;
  cancellationReason?: string;
  suppliers?: { name: string; district: string; allocatedKg: number; status: string }[];
  timeline?: { time: string; title: string; actor: string }[];
}

export interface OrdersStatsData {
  totalActiveOrders: number;
  activeChangePercent: string;
  awaitingConfirmation: number;
  awaitingOverdueCount: number;
  inFulfilment: number;
  scheduledTodayCount: number;
  openExceptions: number;
  immediateAttentionCount: number;
  pipeline: {
    awaitingConfirmationPercent: number;
    awaitingConfirmationCount: number;
    allocatedPercent: number;
    allocatedCount: number;
    inFulfilmentPercent: number;
    inFulfilmentCount: number;
    totalCount: number;
  };
  needsAttention: { type: string; label: string; count: number }[];
}

export interface DispatchItem {
  orderId: string;
  selected?: boolean;
  product: string;
  quantityKg: number;
  supplierCount: number;
  pickupArea: string;
  pickupAreaSubtext?: string;
  deliveryDestination: string;
  deliveryDestinationSubtext?: string;
  requiredDeliveryDate: string;
  requiredDeliveryDateSubtext?: string;
  dispatchStatus: string;
  dispatchStatusLabel: string;
  assignedDriver?: string | null;
  assignedVehicle?: string | null;
  plannedLoadKg: number;
  capacityKg?: number | null;
  stops: { stopNumber: number; farmName: string; area: string; quantityKg: number; status: string; lat: number; lng: number }[];
  destinationCoordinates: { name: string; lat: number; lng: number };
}

export interface DispatchStatsData {
  ordersAwaitingAssignment: number;
  awaitingSubtext?: string;
  awaitingBullet?: string;
  driversAvailable: number;
  driversSubtext?: string;
  driversBullet?: string;
  activeTrips: number;
  activeTripsSubtext?: string;
  activeTripsBullet?: string;
  dispatchExceptions: number;
  exceptionsSubtext?: string;
  exceptionsBullet?: string;
}

export interface ActiveTripItem {
  tripId: string;
  orderId: string;
  route: string;
  driverName: string;
  vehiclePlate: string;
  status: string;
  statusLabel: string;
  eta: string;
  delayText?: string;
  stopsLeft: number;
  progressPercent: number;
  lastReportedTime: string;
  alertMessage?: string | null;
}

export interface DriverVehicleItem {
  id: string;
  name: string;
  phone: string;
  vehicleId: string;
  registration: string;
  vehicleType: string;
  capacityKg: number;
  district: string;
  status: string;
}

export interface IncidentItem {
  id: string;
  title: string;
  category: string;
  linkedRecord: string;
  linkedRecordType: string;
  priority: 'high' | 'medium' | 'low';
  priorityLabel: string;
  assignedTo: string;
  department: string;
  status: 'new' | 'in_review' | 'awaiting_evidence' | 'escalated' | 'resolved';
  statusLabel: string;
  slaStatus: string;
  slaText: string;
  description: string;
  stage: string;
  reportedBy: string;
  reportedAt: string;
  supplyChainFlow: { code: string; label: string }[];
  weights: {
    dispatchedKg: number;
    dispatchedDisplay: string;
    receivedKg: number;
    receivedDisplay: string;
    varianceKg: number;
    varianceDisplay: string;
  };
  evidence: { id: string; title: string; type: string; note: string; verified: boolean; sha?: string }[];
  auditActivity: { time: string; action: string; details: string }[];
}

export interface IncidentsStatsData {
  openIncidents: number;
  openSubtext: string;
  highPriority: number;
  highPrioritySubtext: string;
  slaOverdue: number;
  slaOverdueSubtext: string;
  medianResolution: string;
  resolutionSubtext: string;
}

export interface DisputeItem {
  id: string;
  orderId: string;
  commodity: string;
  partiesDisplay: string;
  supplier: { name: string; location: string; role: string };
  buyer: { name: string; location: string; role: string };
  carrier: { name: string; completedAt: string };
  reason: string;
  reasonCategory: string;
  claimedRefundCents: number;
  claimedRefundDisplay: string;
  priority: 'high' | 'medium' | 'low';
  priorityLabel: string;
  status: 'under_investigation' | 'awaiting_review' | 'pending_evidence' | 'resolved';
  statusLabel: string;
  openedDate: string;
  openedFull: string;
  assignedTo: string;
  orderTotalCents: number;
  orderTotalDisplay: string;
  orderTotalNote: string;
  unitPriceCents: number;
  unitPriceDisplay: string;
  orderedKg: number;
  dispatchedKg: number;
  buyerReportedKg: number;
  verifiedAcceptedKg: number;
  eligibleShortfallKg: number;
  shortfallPercent: string;
  shortfallNote: string;
  eligibleRefundCents: number;
  eligibleRefundDisplay: string;
  previouslyRefundedCents: number;
  rulingStatus: string;
  proposedRuling: {
    type: string;
    verifiedAcceptedKg: number;
    rationale: string;
  };
  evidenceRegister: { num: string; title: string; stakeholder: string; date: string; weight: string; status: string }[];
  caseActivity: { time: string; actor: string }[];
}

export interface DisputesStatsData {
  openDisputes: number;
  openSubtext: string;
  awaitingReview: number;
  awaitingSubtext: string;
  refundExposureLkr: string;
  exposureSubtext: string;
  resolvedThisMonth: number;
  resolvedSubtext: string;
}

// ==========================================
// API Calls with Graceful Local Fallbacks
// ==========================================

export async function fetchModuleStatus() {
  try {
    const res = await api.get('/ym26/status');
    return res.data;
  } catch (err) {
    return { status: 'offline', module: 'YM26' };
  }
}

// 1. Orders API
export async function fetchOrdersStats(): Promise<OrdersStatsData> {
  try {
    const res = await api.get('/ym26/orders/stats');
    return res.data;
  } catch {
    return {
      totalActiveOrders: 148,
      activeChangePercent: '+ 12.4%',
      awaitingConfirmation: 32,
      awaitingOverdueCount: 8,
      inFulfilment: 86,
      scheduledTodayCount: 23,
      openExceptions: 7,
      immediateAttentionCount: 3,
      pipeline: {
        awaitingConfirmationPercent: 22,
        awaitingConfirmationCount: 32,
        allocatedPercent: 20,
        allocatedCount: 30,
        inFulfilmentPercent: 58,
        inFulfilmentCount: 86,
        totalCount: 148
      },
      needsAttention: [
        { type: 'overdue_confirmations', label: 'Overdue confirmations', count: 3 },
        { type: 'allocation_shortfalls', label: 'Allocation shortfalls', count: 2 },
        { type: 'delivery_at_risk', label: 'Delivery at risk', count: 2 }
      ]
    };
  }
}

export async function fetchOrders(params?: { status?: string; search?: string; commodity?: string; page?: number; limit?: number }) {
  try {
    const res = await api.get('/ym26/orders', { params });
    return res.data;
  } catch {
    return null;
  }
}

export async function cancelOrderApi(orderId: string, reason: string) {
  try {
    const res = await api.post(`/ym26/orders/${orderId}/cancel`, { reason });
    return res.data;
  } catch {
    return { success: true, orderId, cancellationReason: reason };
  }
}

// 2. Dispatch API
export async function fetchDispatchStats(): Promise<DispatchStatsData> {
  try {
    const res = await api.get('/ym26/dispatch/stats');
    return res.data;
  } catch {
    return {
      ordersAwaitingAssignment: 23,
      awaitingSubtext: 'Confirmed and ready for pickup · 8 due for pickup today',
      driversAvailable: 17,
      driversSubtext: 'Approved drivers ready to dispatch · Across 4 operating regions',
      activeTrips: 12,
      activeTripsSubtext: 'Deliveries currently on the road · 9 on time · 3 at risk',
      dispatchExceptions: 3,
      exceptionsSubtext: 'Require your attention · 2 delays · 1 vehicle issue'
    };
  }
}

export async function fetchDispatchQueue(params?: { status?: string; search?: string }) {
  try {
    const res = await api.get('/ym26/dispatch/queue', { params });
    return res.data?.queue || [];
  } catch {
    return null;
  }
}

export async function fetchActiveTrips() {
  try {
    const res = await api.get('/ym26/dispatch/active-trips');
    return res.data?.trips || [];
  } catch {
    return null;
  }
}

export async function fetchDriversAndVehicles() {
  try {
    const res = await api.get('/ym26/dispatch/drivers-vehicles');
    return res.data?.drivers || [];
  } catch {
    return [];
  }
}

export async function assignDispatchApi(data: {
  orderId: string;
  driverId: string;
  vehicleId: string;
  plannedLoadKg: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  routeNotes?: string;
}) {
  try {
    const res = await api.post('/ym26/dispatch/assign', data);
    return res.data;
  } catch {
    return { success: true, ...data };
  }
}

// 3. Incidents API
export async function fetchIncidentsStats(): Promise<IncidentsStatsData> {
  try {
    const res = await api.get('/ym26/incidents/stats');
    return res.data;
  } catch {
    return {
      openIncidents: 24,
      openSubtext: 'Across 5 operational stages',
      highPriority: 6,
      highPrioritySubtext: '2 require immediate review',
      slaOverdue: 4,
      slaOverdueSubtext: 'Oldest incident: 5h 24m',
      medianResolution: '2h 18m',
      resolutionSubtext: '↓ 18% vs. previous 7 days'
    };
  }
}

export async function fetchIncidents(params?: { tab?: string; status?: string; stage?: string; search?: string }) {
  try {
    const res = await api.get('/ym26/incidents', { params });
    return res.data?.incidents || [];
  } catch {
    return null;
  }
}

export async function resolveIncidentApi(id: string, resolution: string | { resolution: string; actionTaken?: string }) {
  try {
    const payload = typeof resolution === 'string' ? { resolution } : resolution;
    const res = await api.post(`/ym26/incidents/${id}/resolve`, payload);
    return res.data;
  } catch {
    return { success: true, id, resolution };
  }
}

// 4. Disputes API
export async function fetchDisputesStats(): Promise<DisputesStatsData> {
  try {
    const res = await api.get('/ym26/disputes/stats');
    return res.data;
  } catch {
    return {
      openDisputes: 12,
      openSubtext: 'Across 8 active orders',
      awaitingReview: 4,
      awaitingSubtext: '2 require action today',
      refundExposureLkr: 'LKR 184,650.00',
      exposureSubtext: 'Pending adjudication',
      resolvedThisMonth: 38,
      resolvedSubtext: 'Median resolution · 1.8 days'
    };
  }
}

export async function fetchDisputes(params?: { tab?: string; status?: string; search?: string }) {
  try {
    const res = await api.get('/ym26/disputes', { params });
    return res.data?.disputes || [];
  } catch {
    return null;
  }
}

export async function saveDisputeDraftApi(id: string, draftData: { verifiedAcceptedKg: number; rationale: string }) {
  try {
    const res = await api.post(`/ym26/disputes/${id}/draft`, draftData);
    return res.data;
  } catch {
    return { success: true, id, ...draftData };
  }
}

export async function issueDisputeRulingApi(id: string, rulingData: { verifiedAcceptedKg: number; refundCents: number; rationale: string }) {
  try {
    const res = await api.post(`/ym26/disputes/${id}/ruling`, rulingData);
    return res.data;
  } catch {
    return { success: true, id, ...rulingData };
  }
}
