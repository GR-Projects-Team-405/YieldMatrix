import React from 'react';

export interface StatusBadgeProps {
  /** Status text or value. Known statuses receive semantic colors; unknown values remain neutral. */
  status?: string | number | boolean | Record<string, any> | null;
  className?: string;
}

/**
 * Safely extracts a clean string representation of a status value
 * regardless of whether it is null, undefined, string, number, boolean, or object.
 */
function extractStatusString(status: unknown): string {
  if (status === null || status === undefined) {
    return '';
  }
  if (typeof status === 'string') {
    return status.trim();
  }
  if (typeof status === 'number') {
    return Number.isFinite(status) ? String(status).trim() : '';
  }
  if (typeof status === 'boolean') {
    return status ? 'Active' : 'Inactive';
  }
  if (typeof status === 'object') {
    const obj = status as Record<string, any>;
    if (typeof obj.label === 'string' && obj.label.trim()) return obj.label.trim();
    if (typeof obj.name === 'string' && obj.name.trim()) return obj.name.trim();
    if (typeof obj.status === 'string' && obj.status.trim()) return obj.status.trim();
    if (typeof obj.value === 'string' && obj.value.trim()) return obj.value.trim();
    if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
    if (typeof obj.status === 'boolean') return obj.status ? 'Active' : 'Inactive';
    if (typeof obj.value === 'boolean') return obj.value ? 'Active' : 'Inactive';
    if (typeof obj.status === 'number' && Number.isFinite(obj.status)) return String(obj.status);
    if (typeof obj.value === 'number' && Number.isFinite(obj.value)) return String(obj.value);

    // If it has a custom toString method (not Object.prototype.toString)
    if (typeof obj.toString === 'function' && obj.toString !== Object.prototype.toString) {
      try {
        const str = obj.toString();
        if (typeof str === 'string' && str !== '[object Object]') return str.trim();
      } catch {
        // ignore toString errors
      }
    }
    return '';
  }
  try {
    return String(status ?? '').trim();
  } catch {
    return '';
  }
}

/**
 * Determines the semantic tone ('success' | 'warning' | 'info' | 'error' | 'neutral')
 * based on the normalized status text.
 */
function getStatusTone(raw: string): 'success' | 'warning' | 'info' | 'error' | 'neutral' {
  const value = raw.toLowerCase().replace(/[_-]+/g, ' ').trim();
  if (!value) return 'neutral';

  const successValues = [
    'confirmed',
    'active',
    'approved',
    'verified',
    'success',
    'successful',
    'completed',
    'passed',
    'ok',
    'resolved',
    'enabled'
  ];
  if (successValues.includes(value)) return 'success';

  const warningValues = [
    'pending',
    'awaiting response',
    'draft',
    'warning',
    'in progress',
    'processing',
    'review',
    'under review',
    'action required'
  ];
  if (warningValues.includes(value)) return 'warning';

  const infoValues = [
    'in transit',
    'scheduled',
    'info',
    'system',
    'created',
    'updated',
    'initiated',
    'queued'
  ];
  if (infoValues.includes(value)) return 'info';

  const errorValues = [
    'failed',
    'rejected',
    'disputed',
    'expired',
    'error',
    'inactive',
    'disabled',
    'deactivated',
    'deleted',
    'cancelled',
    'canceled'
  ];
  if (errorValues.includes(value)) return 'error';

  return 'neutral';
}

/** Displays status text inside a semantic colored pill. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const raw = extractStatusString(status);
  const tone = getStatusTone(raw);
  const displayText = raw || 'Unknown';
  const combinedClass = ['ym-status', `ym-tone--${tone}`, className].filter(Boolean).join(' ');

  return <span className={combinedClass}>{displayText}</span>;
}
