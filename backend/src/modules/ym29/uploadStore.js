// YM29 · Yasindu Janapriya · Bounded in-memory staging store for two-step CSV upload review.
// Avoids modifying database schema while keeping unapproved rows completely out of PostgreSQL.

import { randomUUID } from 'node:crypto';

const MAX_STAGED_UPLOADS = 25;
const STAGED_TTL_MS = 30 * 60 * 1000; // 30 minutes
const store = new Map();

function pruneExpired() {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(id);
    }
  }
  while (store.size > MAX_STAGED_UPLOADS) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
    else break;
  }
}

export function createStagedUpload({
  uploadedBy,
  uploadedByName,
  fileName,
  fileSizeBytes,
  sampleData,
  validation,
}) {
  pruneExpired();
  const id = randomUUID();
  const now = new Date();
  const entry = {
    id,
    status: 'pending_review',
    uploadedBy,
    uploadedByName,
    uploadedAt: now.toISOString(),
    expiresAt: now.getTime() + STAGED_TTL_MS,
    fileName,
    fileSizeBytes,
    sampleData: Boolean(sampleData),
    checksum: validation.checksum,
    totalRows: validation.totalRows,
    validCount: validation.validCount,
    duplicateCount: validation.duplicateCount,
    errorCount: validation.errorCount,
    canApprove: validation.canApprove,
    dateRange: validation.dateRange,
    sources: validation.sources,
    crops: validation.crops,
    districts: validation.districts,
    issueBreakdown: validation.issueBreakdown,
    rows: validation.rows,
    flaggedRows: validation.flaggedRows,
    validatedRows: validation.validatedRows,
    decisionReason: null,
    decidedAt: null,
    decidedBy: null,
  };
  store.set(id, entry);
  return entry;
}

export function getStagedUpload(id) {
  pruneExpired();
  return store.get(id) || null;
}

export function listPendingUploads() {
  pruneExpired();
  return Array.from(store.values())
    .filter((entry) => entry.status === 'pending_review')
    .map(serializeUploadSummary);
}

export function markUploadCommitted(id, adminId) {
  const entry = store.get(id);
  if (!entry) return null;
  entry.status = 'committed';
  entry.decidedBy = adminId;
  entry.decidedAt = new Date().toISOString();
  entry.canApprove = false;
  // Release heavy payload from memory once persisted in PostgreSQL
  entry.validatedRows = [];
  return entry;
}

export function markUploadRejected(id, adminId, reason) {
  const entry = store.get(id);
  if (!entry) return null;
  entry.status = 'rejected';
  entry.decidedBy = adminId;
  entry.decidedAt = new Date().toISOString();
  entry.decisionReason = reason;
  entry.canApprove = false;
  entry.validatedRows = [];
  return entry;
}

export function serializeUploadSummary(entry) {
  return {
    id: entry.id,
    status: entry.status,
    file_name: entry.fileName,
    file_size_bytes: entry.fileSizeBytes,
    checksum: entry.checksum,
    sample_data: entry.sampleData,
    uploaded_by: entry.uploadedBy,
    uploaded_by_name: entry.uploadedByName,
    uploaded_at: entry.uploadedAt,
    decided_at: entry.decidedAt,
    decision_reason: entry.decisionReason,
    total_rows: entry.totalRows,
    valid_rows: entry.validCount,
    duplicate_rows: entry.duplicateCount,
    error_rows: entry.errorCount,
    can_approve: entry.canApprove && entry.status === 'pending_review',
    date_range: entry.dateRange,
    sources: entry.sources,
    crops: entry.crops,
    districts: entry.districts,
    issue_breakdown: entry.issueBreakdown,
  };
}

export function serializeUploadDetail(entry) {
  return {
    ...serializeUploadSummary(entry),
    rows: entry.rows,
    flagged_rows: entry.flaggedRows,
  };
}
