export interface Crop {
  id: string;
  name: string;
  active: boolean;
}

export interface Grade {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface SafeChanges {
  targetName?: string;
  status?: string;
  previousValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  changeDescription?: string | null;
}

export interface AuditEventItem {
  id: string;
  actor: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  actorId?: string | null;
  actorAvatar: string;
  action: 'Created' | 'Updated' | 'Deactivated' | string;
  target: string;
  targetName: string;
  targetType: 'Crop' | 'Grade' | 'System' | string;
  targetId?: string;
  targetRecordId?: string;
  requestId?: string;
  reason?: string;
  status: 'Success' | 'Failed' | string;
  safeChanges: SafeChanges;
  previousValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  changeDescription?: string | null;
  occurredAt: string;
  recordedAt: string;
  dateTime: string;
  exactTimestamp?: string;
  timestamp?: number;
}

export interface OverviewData {
  totalCrops: number;
  activeCrops: number;
  inactiveCrops: number;
  totalGrades: number;
  activeGrades: number;
  inactiveGrades: number;
  summary?: {
    totalCrops: number;
    activeCrops: number;
    inactiveCrops: number;
    totalGrades: number;
    activeGrades: number;
    inactiveGrades: number;
  };
  crops: Crop[];
  grades: Grade[];
  requestId?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function formatColomboDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Colombo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return dateStr;
  }
}

export function formatColomboExactDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Colombo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return dateStr;
  }
}

export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const resp = (err as { response?: { data?: { error?: string } } }).response;
    if (resp?.data?.error) return resp.data.error;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
