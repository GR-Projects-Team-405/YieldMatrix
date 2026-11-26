import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  Sprout,
  FileText,
  Calendar,
  Tag,
  User,
  Check,
  Scale,
  Clock,
  Info,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Copy,
  CheckCircle2,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { Alert } from '../../components/Alert';
import { Table, TableRow } from '../../components/Table';
import { Toast } from '../../components/Toast';
import api from './services/api';
import {
  AuditEventItem,
  formatColomboDate,
  formatColomboExactDate,
  getErrorMessage
} from './types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditEventDetails() {
  const params = useParams<{ eventId?: string; id?: string }>();
  const rawId = (params.eventId || params.id || '').trim();
  const navigate = useNavigate();
  const location = useLocation();

  const cachedEvent = rawId ? api.getCached<AuditEventItem>(`/ym04/audit-logs/${rawId}`) : null;
  const [event, setEvent] = useState<AuditEventItem | null>(() => cachedEvent);
  const [loading, setLoading] = useState<boolean>(() => !cachedEvent);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch event details directly from live backend
  const fetchEventDetails = useCallback(
    async (signal?: AbortSignal) => {
      if (!rawId || rawId === 'undefined' || rawId === 'null') {
        setError('No audit event ID provided in URL.');
        setLoading(false);
        return;
      }

      if (!UUID_REGEX.test(rawId)) {
        setError(`Invalid audit event ID format: "${rawId}". Expected a valid UUID.`);
        setLoading(false);
        return;
      }

      if (!api.getCached(`/ym04/audit-logs/${rawId}`)) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await api.get(`/ym04/audit-logs/${rawId}`, { signal });
        if (!isMountedRef.current || signal?.aborted) return;

        const data = response.data;
        const item: AuditEventItem = data.event || data;
        setEvent(item);
        setError(null);
      } catch (err) {
        const isCanceled =
          axios.isCancel(err) ||
          (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) ||
          (axios.isAxiosError(err) && (err.code === 'ERR_CANCELED' || err.name === 'CanceledError')) ||
          Boolean(signal?.aborted);

        if (isCanceled || !isMountedRef.current) {
          return;
        }
        setError(getErrorMessage(err, 'Failed to load audit event details.'));
        setEvent(null);
      } finally {
        if (isMountedRef.current && !signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [rawId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchEventDetails(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchEventDetails]);

  // Navigate back to the respective audit trail page
  const handleBack = () => {
    if (location.pathname.includes('/reference-data/')) {
      navigate('/admin/reference-data/audit-trail');
    } else {
      navigate('/admin/audit-trail');
    }
  };

  // Copy Event ID
  const handleCopyId = () => {
    if (event?.id) {
      navigator.clipboard.writeText(event.id);
      setCopied(true);
      setToastMessage(`Event ID ${event.id} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="ym04-container" role="region" aria-label="Loading Audit Event">
        <header className="ym04-event-header">
          <div className="ym04-event-header-left">
            <div className="ym04-event-header-icon" aria-hidden="true">
              <Sprout size={22} strokeWidth={2} />
            </div>
            <div className="ym04-header">
              <h1 className="ym04-title">Audit Event Details</h1>
              <p className="ym04-subtitle">Loading audit event record...</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="ym04-btn-back"
            onClick={handleBack}
            aria-label="Back to Audit Trail"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to Audit Trail</span>
          </Button>
        </header>

        <div className="ym04-card" style={{ padding: '64px', textAlign: 'center' }}>
          <Loader2 size={36} className="ym04-spin" style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
          <p style={{ color: 'var(--muted)' }}>Fetching event record from YieldMatrix audit log...</p>
        </div>
      </div>
    );
  }

  // Fallback: Event Not Found or Error
  if (error || !event) {
    return (
      <div className="ym04-container" role="region" aria-label="Audit Event Not Found">
        <div className="ym04-event-header">
          <div className="ym04-event-header-left">
            <div className="ym04-event-header-icon" aria-hidden="true">
              <Sprout size={22} strokeWidth={2} />
            </div>
            <div className="ym04-header">
              <h1 className="ym04-title">Audit Event Details</h1>
              <p className="ym04-subtitle">View detailed information about this audit event.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="ym04-btn-back"
            onClick={handleBack}
            aria-label="Back to Audit Trail"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to Audit Trail</span>
          </Button>
        </div>

        <div className="ym04-not-found-card">
          <div className="ym04-not-found-icon" aria-hidden="true">
            <AlertTriangle size={36} />
          </div>
          <h2 className="ym04-not-found-title">Audit Event Not Found</h2>
          <Alert type="error">
            {error || `No audit event could be found matching ID "${rawId || 'unknown'}".`}
          </Alert>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'center' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => fetchEventDetails()}
            >
              <RefreshCw size={14} style={{ marginRight: '6px' }} />
              Retry
            </Button>
            <Button
              type="button"
              variant="primary"
              className="ym04-btn-back-primary"
              onClick={handleBack}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back to Audit Trail</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Derive target label and values
  const targetLabel =
    event.targetType === 'Crop' ? 'Crop Name' : event.targetType === 'Grade' ? 'Grade Name' : 'Target Name';
  const targetDisplayName = event.targetName || event.target || 'Unknown';
  const recordId = event.targetRecordId || event.targetId || '—';
  const changeDescText =
    event.safeChanges?.changeDescription ||
    event.changeDescription ||
    `${event.action} operation recorded on ${targetDisplayName}.`;
  const actionSummaryText = `Action: ${event.action} a ${event.targetType.toLowerCase()} in the system.`;
  const colomboOccurredTime =
    event.dateTime || formatColomboDate(event.occurredAt);
  const exactOccurredTime =
    event.exactTimestamp || formatColomboExactDate(event.occurredAt);
  const recordedTime = formatColomboExactDate(event.recordedAt);
  const actorName = event.actor || 'System';
  const actorInfoText = `${actorName} (${event.actorEmail || (actorName === 'System' ? 'system-daemon' : 'admin@yieldmatrix.lk')})`;

  // Extract previous and new values from safeChanges or top-level properties
  const prevVals = event.safeChanges?.previousValues ?? event.previousValues;
  const newVals = event.safeChanges?.newValues ?? event.newValues;

  return (
    <div
      className="ym04-container ym04-event-details-view"
      role="region"
      aria-label={`Audit Event ${event.id} Details`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header with Breadcrumb / Back Action                            */}
      {/* ------------------------------------------------------------------ */}
      <header className="ym04-event-header">
        <div className="ym04-event-header-left">
          <div className="ym04-event-header-icon" aria-hidden="true">
            <Sprout size={22} strokeWidth={2} />
          </div>
          <div className="ym04-header">
            <h1 className="ym04-title">Audit Event Details</h1>
            <p className="ym04-subtitle">View detailed information about this audit event.</p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="ym04-btn-back"
          onClick={handleBack}
          aria-label="Back to Audit Trail"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Audit Trail</span>
        </Button>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Top Grid: Event Information & Event Successfully Recorded       */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-event-top-grid" aria-label="Event Overview">
        {/* Left: Event Information Card */}
        <div className="ym04-card ym04-event-info-card">
          <div className="ym04-card-title-row">
            <FileText size={18} className="ym04-card-icon-green" aria-hidden="true" />
            <h2 className="ym04-card-title">Event Information</h2>
          </div>

          <div className="ym04-info-grid">
            {/* Row 1, Col 1: Event ID */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Event ID</span>
              <div className="ym04-info-value-wrap">
                <strong
                  className="ym04-info-value ym04-info-value--bold"
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                >
                  {event.id}
                </strong>
                <button
                  type="button"
                  className="ym04-copy-btn"
                  onClick={handleCopyId}
                  title="Copy Event ID"
                  aria-label="Copy Event ID"
                >
                  {copied ? <CheckCircle2 size={13} color="#1b8754" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Row 1, Col 2: Target Record */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Target Record</span>
              <div className="ym04-info-value-wrap ym04-info-target">
                <Sprout size={16} className="ym04-target-green-icon" aria-hidden="true" />
                <strong className="ym04-info-value ym04-info-value--bold">{targetDisplayName}</strong>
              </div>
            </div>

            {/* Row 2, Col 1: Actor */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Actor</span>
              <div className="ym04-info-value-wrap ym04-info-with-icon">
                <User size={15} className="ym04-muted-icon" aria-hidden="true" />
                <span className="ym04-info-value">{actorName}</span>
              </div>
            </div>

            {/* Row 2, Col 2: Date & Time */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Date &amp; Time (Colombo)</span>
              <div className="ym04-info-value-wrap ym04-info-with-icon">
                <Calendar size={15} className="ym04-muted-icon" aria-hidden="true" />
                <span className="ym04-info-value">{colomboOccurredTime}</span>
              </div>
            </div>

            {/* Row 3, Col 1: Action */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Action</span>
              <div className="ym04-info-value-wrap">
                <span className={`ym04-badge-action ym04-badge-action--${(event.action || '').toLowerCase()}`}>
                  {event.action}
                </span>
              </div>
            </div>

            {/* Row 3, Col 2: Reason */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Reason</span>
              <div className="ym04-info-value-wrap ym04-info-with-icon">
                <Tag size={14} className="ym04-muted-icon" aria-hidden="true" />
                <span className="ym04-info-value">{event.reason || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Event Successfully Recorded Card */}
        <div className="ym04-card ym04-recorded-card" aria-label="Audit Status">
          <div className="ym04-recorded-content">
            <div className="ym04-recorded-check" aria-hidden="true">
              <Check size={20} strokeWidth={3} />
            </div>
            <h2 className="ym04-recorded-title">Event Successfully Recorded</h2>
            <p className="ym04-recorded-desc">
              This event is part of the system audit trail and cannot be modified.
            </p>
          </div>

          <div className="ym04-recorded-watermark" aria-hidden="true">
            <svg
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="ym04-watermark-svg"
            >
              <path
                d="M20 80C20 80 25 35 75 25C75 25 80 65 35 85C30 87 25 85 20 80Z"
                fill="currentColor"
              />
              <path
                d="M20 80C35 65 55 50 75 25"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Middle Section: Change Summary                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-card ym04-summary-card" aria-label="Change Summary">
        <div className="ym04-card-title-row">
          <Scale size={18} className="ym04-card-icon-green" aria-hidden="true" />
          <h2 className="ym04-card-title">Change Summary</h2>
        </div>
        <p className="ym04-summary-action-text">{actionSummaryText}</p>

        <div className="ym04-table-wrap">
          <Table
            headers={['Target Record ID', targetLabel, 'Target Type', 'Audit Status']}
            className="ym04-summary-table"
          >
            <TableRow>
              <td className="ym04-cell-record-id" style={{ fontFamily: 'monospace' }}>
                {recordId}
              </td>
              <td>{targetDisplayName}</td>
              <td>{event.targetType}</td>
              <td>
                <StatusBadge status={event.status ?? 'Success'} />
              </td>
            </TableRow>
          </Table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Bottom Grid: Record Comparison & Additional Information         */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-event-bottom-grid" aria-label="Record Comparison and Details">
        {/* Left: Record Comparison Card */}
        <div className="ym04-card ym04-comparison-card">
          <div className="ym04-card-title-row">
            <Clock size={18} className="ym04-card-icon-green" aria-hidden="true" />
            <h2 className="ym04-card-title">Record Comparison</h2>
          </div>

          <div className="ym04-comparison-container">
            {/* Previous Value Box */}
            <div className="ym04-comparison-box ym04-comparison-box--previous">
              <div className="ym04-comparison-box-header">Previous Value</div>
              <div className="ym04-comparison-box-body">
                {prevVals && typeof prevVals === 'object' && Object.keys(prevVals).length > 0 ? (
                  <div className="ym04-kv-list">
                    {Object.entries(prevVals).map(([key, val]) => (
                      <div key={key} className="ym04-kv-row">
                        <span className="ym04-kv-key">{key}</span>
                        <span className="ym04-kv-colon">:</span>
                        <span className="ym04-kv-val">
                          {typeof val === 'boolean' ? (
                            <StatusBadge status={val ? 'Active' : 'Inactive'} />
                          ) : key.toLowerCase().includes('status') || key.toLowerCase().includes('active') ? (
                            <StatusBadge status={String(val)} />
                          ) : (
                            String(val ?? '—')
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ym04-comparison-empty">(No previous record)</div>
                )}
              </div>
            </div>

            {/* Middle Transition Arrow */}
            <div className="ym04-comparison-arrow-badge" aria-hidden="true">
              <ArrowRight size={16} strokeWidth={2.5} />
            </div>

            {/* New Value Box */}
            <div className="ym04-comparison-box ym04-comparison-box--new">
              <div className="ym04-comparison-box-header ym04-comparison-box-header--new">New Value</div>
              <div className="ym04-comparison-box-body">
                {newVals && typeof newVals === 'object' && Object.keys(newVals).length > 0 ? (
                  <div className="ym04-kv-list">
                    {Object.entries(newVals).map(([key, val]) => (
                      <div key={key} className="ym04-kv-row">
                        <span className="ym04-kv-key">{key}</span>
                        <span className="ym04-kv-colon">:</span>
                        <span className="ym04-kv-val">
                          {typeof val === 'boolean' ? (
                            <StatusBadge status={val ? 'Active' : 'Inactive'} />
                          ) : key.toLowerCase().includes('status') || key.toLowerCase().includes('active') ? (
                            <StatusBadge status={String(val)} />
                          ) : (
                            String(val ?? '—')
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ym04-kv-list">
                    <div className="ym04-kv-row">
                      <span className="ym04-kv-key">{targetLabel}</span>
                      <span className="ym04-kv-colon">:</span>
                      <span className="ym04-kv-val">{targetDisplayName}</span>
                    </div>
                    <div className="ym04-kv-row">
                      <span className="ym04-kv-key">Target Type</span>
                      <span className="ym04-kv-colon">:</span>
                      <span className="ym04-kv-val">{event.targetType}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Additional Information Card */}
        <div className="ym04-card ym04-additional-card">
          <div className="ym04-card-title-row">
            <div className="ym04-additional-info-icon" aria-hidden="true">
              <Info size={14} />
            </div>
            <h2 className="ym04-card-title">Additional Information</h2>
          </div>

          <div className="ym04-additional-list">
            <div className="ym04-additional-row">
              <span className="ym04-add-label">Occurred Time (Colombo)</span>
              <span className="ym04-add-colon">:</span>
              <span className="ym04-add-val">{exactOccurredTime}</span>
            </div>

            <div className="ym04-additional-row">
              <span className="ym04-add-label">Recorded Time (Colombo)</span>
              <span className="ym04-add-colon">:</span>
              <span className="ym04-add-val">{recordedTime}</span>
            </div>

            <div className="ym04-additional-row">
              <span className="ym04-add-label">Actor Information</span>
              <span className="ym04-add-colon">:</span>
              <span className="ym04-add-val">{actorInfoText}</span>
            </div>

            <div className="ym04-additional-row">
              <span className="ym04-add-label">Target Record ID</span>
              <span className="ym04-add-colon">:</span>
              <span className="ym04-add-val" style={{ fontFamily: 'monospace' }}>
                {recordId}
              </span>
            </div>

            {event.requestId && (
              <div className="ym04-additional-row">
                <span className="ym04-add-label">Request ID</span>
                <span className="ym04-add-colon">:</span>
                <span className="ym04-add-val" style={{ fontFamily: 'monospace' }}>
                  {event.requestId}
                </span>
              </div>
            )}

            <div className="ym04-additional-row">
              <span className="ym04-add-label">Change Description</span>
              <span className="ym04-add-colon">:</span>
              <span className="ym04-add-val">{changeDescText}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Bottom Read-Only Integrity Banner                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="ym04-readonly-banner" role="status">
        <ShieldCheck size={22} className="ym04-readonly-icon" aria-hidden="true" />
        <div className="ym04-readonly-text">
          <strong className="ym04-readonly-title">Audit Trail is read-only</strong>
          <span className="ym04-readonly-subtitle">This record cannot be edited or deleted for data integrity.</span>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
