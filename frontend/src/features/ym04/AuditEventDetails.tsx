import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  CheckCircle2
} from 'lucide-react';
import { getAuditEventById, AuditEventItem } from './auditMockData';
import { Toast } from '../../components/Toast';

export default function AuditEventDetails() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lookup the event from shared mock data
  const event: AuditEventItem | undefined = useMemo(() => {
    return getAuditEventById(eventId);
  }, [eventId]);

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

  // Fallback: Event Not Found
  if (!event) {
    return (
      <div className="ym04-container" role="region" aria-label="Audit Event Details">
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
          <button
            type="button"
            className="ym04-btn-back"
            onClick={handleBack}
            aria-label="Back to Audit Trail"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to Audit Trail</span>
          </button>
        </div>

        <div className="ym04-not-found-card">
          <div className="ym04-not-found-icon" aria-hidden="true">
            <AlertTriangle size={36} />
          </div>
          <h2 className="ym04-not-found-title">Audit Event Not Found</h2>
          <p className="ym04-not-found-desc">
            No audit event could be found matching ID <strong>{eventId || 'unknown'}</strong>.
            The event might have been archived or the ID is incorrect.
          </p>
          <button
            type="button"
            className="ym04-btn-back-primary"
            onClick={handleBack}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to Audit Trail</span>
          </button>
        </div>
      </div>
    );
  }

  // Derive target label and record id
  const targetLabel = event.targetType === 'Crop' ? 'Crop Name' : event.targetType === 'Grade' ? 'Grade Name' : 'Record Name';
  const targetCategory = event.category || (event.targetType === 'Crop' ? 'Vegetable' : 'Quality Grade');
  const recordId = event.targetRecordId || (event.targetType === 'Crop' ? 'CR001' : 'GR001');
  const actionSummaryText = event.actionSummary || `Action: ${event.action} a ${event.targetType.toLowerCase()} in the system.`;
  const changeDescText = event.changeDescription || `A new ${event.targetType.toLowerCase()} '${event.target}' was registered in the system.`;
  const exactTimeText = event.exactTimestamp || `${event.dateTime}:15`;
  const actorInfoText = `${event.actor} (${event.actorEmail || 'admin@yieldmatrix.lk'})`;

  return (
    <div className="ym04-container ym04-event-details-view" role="region" aria-label={`Audit Event ${event.id} Details`}>
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

        <button
          type="button"
          className="ym04-btn-back"
          onClick={handleBack}
          aria-label="Back to Audit Trail"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Audit Trail</span>
        </button>
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
                <strong className="ym04-info-value ym04-info-value--bold">{event.id}</strong>
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
                <strong className="ym04-info-value ym04-info-value--bold">{event.target}</strong>
              </div>
            </div>

            {/* Row 2, Col 1: Actor */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Actor</span>
              <div className="ym04-info-value-wrap ym04-info-with-icon">
                <User size={15} className="ym04-muted-icon" aria-hidden="true" />
                <span className="ym04-info-value">{event.actor}</span>
              </div>
            </div>

            {/* Row 2, Col 2: Date & Time */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Date &amp; Time</span>
              <div className="ym04-info-value-wrap ym04-info-with-icon">
                <Calendar size={15} className="ym04-muted-icon" aria-hidden="true" />
                <span className="ym04-info-value">{event.dateTime}</span>
              </div>
            </div>

            {/* Row 3, Col 1: Action */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Action</span>
              <div className="ym04-info-value-wrap">
                <span className={`ym04-badge-action ym04-badge-action--${event.action.toLowerCase()}`}>
                  {event.action}
                </span>
              </div>
            </div>

            {/* Row 3, Col 2: Reason */}
            <div className="ym04-info-field">
              <span className="ym04-info-label">Reason</span>
              <div className="ym04-info-value-wrap ym04-info-with-icon">
                <Tag size={14} className="ym04-muted-icon" aria-hidden="true" />
                <span className="ym04-info-value">{event.reason || 'New crop added to system'}</span>
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

          {/* Leaf watermark matching Figma design */}
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
          <table className="ym04-summary-table">
            <thead>
              <tr>
                <th scope="col">Target Record ID</th>
                <th scope="col">{targetLabel}</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="ym04-cell-record-id">{recordId}</td>
                <td>{event.target}</td>
                <td>{targetCategory}</td>
                <td>
                  <div className="ym04-cell-status ym04-cell-status--success">
                    <span className="ym04-status-circle" aria-hidden="true" />
                    <span>{event.recordStatus || 'Active'}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
                {event.previousValues ? (
                  <div className="ym04-kv-list">
                    {Object.entries(event.previousValues).map(([key, val]) => (
                      <div key={key} className="ym04-kv-row">
                        <span className="ym04-kv-key">{key}</span>
                        <span className="ym04-kv-colon">:</span>
                        <span className="ym04-kv-val">
                          {key === 'Status' ? (
                            <span className="ym04-status-inline">
                              <span
                                className={`ym04-status-circle ${val === 'Active' ? 'ym04-status-circle--active' : 'ym04-status-circle--inactive'}`}
                                aria-hidden="true"
                              />
                              {val}
                            </span>
                          ) : (
                            val
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ym04-comparison-empty">
                    (No previous record)
                  </div>
                )}
              </div>
            </div>

            {/* Middle Transition Arrow */}
            <div className="ym04-comparison-arrow-badge" aria-hidden="true">
              <ArrowRight size={16} strokeWidth={2.5} />
            </div>

            {/* New Value Box */}
            <div className="ym04-comparison-box ym04-comparison-box--new">
              <div className="ym04-comparison-box-header ym04-comparison-box-header--new">
                New Value
              </div>
              <div className="ym04-comparison-box-body">
                {event.newValues ? (
                  <div className="ym04-kv-list">
                    {Object.entries(event.newValues).map(([key, val]) => (
                      <div key={key} className="ym04-kv-row">
                        <span className="ym04-kv-key">{key}</span>
                        <span className="ym04-kv-colon">:</span>
                        <span className="ym04-kv-val">
                          {key === 'Status' ? (
                            <span className="ym04-status-inline">
                              <span
                                className={`ym04-status-circle ${val === 'Active' ? 'ym04-status-circle--active' : 'ym04-status-circle--inactive'}`}
                                aria-hidden="true"
                              />
                              {val}
                            </span>
                          ) : (
                            val
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
                      <span className="ym04-kv-val">{event.target}</span>
                    </div>
                    <div className="ym04-kv-row">
                      <span className="ym04-kv-key">Category</span>
                      <span className="ym04-kv-colon">:</span>
                      <span className="ym04-kv-val">{targetCategory}</span>
                    </div>
                    <div className="ym04-kv-row">
                      <span className="ym04-kv-key">Status</span>
                      <span className="ym04-kv-colon">:</span>
                      <span className="ym04-kv-val">
                        <span className="ym04-status-inline">
                          <span className="ym04-status-circle ym04-status-circle--active" aria-hidden="true" />
                          {event.recordStatus || 'Active'}
                        </span>
                      </span>
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
              <span className="ym04-add-label">Event Timestamp</span>
              <span className="ym04-add-colon">:</span>
              <span className="ym04-add-val">{exactTimeText}</span>
            </div>

            <div className="ym04-additional-row">
              <span className="ym04-add-label">Actor Information</span>
              <span className="ym04-add-colon">:</span>
              <span className="ym04-add-val">{actorInfoText}</span>
            </div>

            <div className="ym04-additional-row">
              <span className="ym04-add-label">Target Record ID</span>
              <span className="ym04-add-colon">:</span>
              <span className="ym04-add-val">{recordId}</span>
            </div>

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
