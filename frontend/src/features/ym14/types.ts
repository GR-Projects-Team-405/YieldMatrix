/**
 * YM14: Offers & Commitments TypeScript Type Definitions
 * Matches YieldMatrix SRS v1.0 and approved Figma designs.
 */

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

export type CommitmentStatus = 
  | 'proposed' 
  | 'accepted' 
  | 'change_pending' 
  | 'ready_to_fulfil' 
  | 'fulfilled' 
  | 'rejected' 
  | 'cancelled';

export interface QualityChecklistItem {
  label: string;
  value: string;
}

export interface SupplierProfile {
  id: string;
  name: string;
  farmName: string;
  estate?: string;
  location: string;
  rating: number;
  completedTrades: number;
  onTimePercentage?: number;
  isVerified: boolean;
}

export interface DemandSummary {
  id: string;
  reference: string;
  cropName: string;
  gradeName: string;
  quantityKg: number;
  destinationHub: string;
  targetWindow: string;
  budgetPerKgCents: number;
}

export interface ReceivedOffer {
  id: string;
  reference: string;
  status: OfferStatus;
  offeredKg: number;
  unitPriceCents: number;
  lineTotalCents: number;
  availabilityWindow: string;
  expiresAt: string;
  tags: string[];
  notes: string;
  qualityChecklist: QualityChecklistItem[];
  batch: {
    id: string;
    code: string;
    farmId?: string;
  };
  demand: DemandSummary;
  supplier: SupplierProfile;
}

export interface OfferComparisonItem {
  id: string;
  badge?: string;
  supplierName: string;
  district: string;
  batchCode: string;
  grade: string;
  offeredKg: number;
  shortageKg?: number;
  pricePerKgCents: number;
  priceDifferenceCents: number;
  lineTotalCents: number;
  availabilityWindow: string;
  expiresAt: string;
  status: OfferStatus;
  supplierRating: number;
  completedTrades: number;
  onTimePercentage?: number;
  hasInsufficientHistory?: boolean;
}

export interface OfferComparisonSummary {
  demand: {
    id: string;
    reference: string;
    cropName: string;
    quantityKg: number;
    budgetPerKgCents: number;
  };
  metrics: {
    totalOffers: number;
    pendingOffers: number;
    expiredOffers: number;
    lowestPricePerKgCents: number;
    lowestPriceSupplier: string;
    demandCoverageText: string;
    earliestPickupDate: string;
  };
  offers: OfferComparisonItem[];
}

export interface CommitmentListItem {
  id: string;
  reference: string;
  supplierName: string;
  cropName: string;
  grade: string;
  expectedKg: number;
  agreedPricePerKgCents: number;
  harvestWindow: string;
  status: CommitmentStatus;
  changePending: boolean;
  actionType: 'view_details' | 'review_change' | 'view_archive';
}

export interface CommitmentStats {
  activeCount: number;
  committedKg: number;
  heldInEscrowCents: number;
  actionRequiredCount: number;
  uniqueCropsCount?: number;
}

export interface StepperStage {
  step: number;
  title: string;
  subtitle: string;
  status: 'completed' | 'active' | 'upcoming';
}

export interface ParameterDiff {
  parameter: string;
  originalAgreed: string;
  proposedChange: string;
  netVariance: string;
  isNegative?: boolean;
  isShift?: boolean;
}

export interface FinancialImpactSummary {
  escrowAutoRefundCents: number;
  revisedEscrowHoldCents: number;
  timelineShift: string;
  newIntakeDate: string;
}

export interface HarvestChangeProposal {
  commitmentId: string;
  reference: string;
  cropBatch: string;
  supplierName?: string;
  proposedQuantityKg?: number;
  proposalExpiresAt: string;
  diff: ParameterDiff[];
  growerStatement: string;
  agronomyVerified: boolean;
  verificationNotes: string;
  financialImpact: FinancialImpactSummary;
}

export interface CommitmentDetail {
  id: string;
  reference: string;
  contractHash: string;
  status: CommitmentStatus;
  hasChangePending: boolean;
  linkedDemand: {
    id: string;
    reference: string;
    title: string;
  };
  originatingOffer: {
    id: string;
    reference: string;
    supplierName: string;
  };
  orderAllocationStatus: string;
  stepper: StepperStage[];
  specs: {
    buyerName: string;
    buyerWorkspace: string;
    supplierName: string;
    plannedFieldBatch: string;
    expectedKg: number;
    agreedPricePerKgCents: number;
    expectedTotalCents: number;
    targetHarvestWindow: string;
    cancellationTerms: string;
  };
  originalTermsAnchor: {
    summaryText: string;
  };
  escrowStatus: {
    balanceHeldCents: number;
    releaseTrigger: string;
  };
  logistics: {
    receivingHub: string;
    gatePass: string;
  };
}
