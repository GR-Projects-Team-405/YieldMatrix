import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Sprout,
  FileText,
  Calendar,
  CalendarDays,
  RefreshCw,
  ShieldCheck,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  RotateCw,
  Tag,
  BarChart2,
  Zap,
  ArrowRight,
  Info,
  Loader2
} from 'lucide-react';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import { Table, TableRow } from '../../components/Table';
import { Toast } from '../../components/Toast';
import { Alert } from '../../components/Alert';
import api from './services/api';
import { AuditEventItem, Pagination, formatColomboDate, getErrorMessage } from './types';

export type { AuditEventItem };

function getPaginationItems(current: number, total: number): (number | string)[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, '...', total];
  }
  if (current >= total - 2) {
    return [1, '...', total - 2, total - 1, total];
  }
  return [1, '...', current, '...', total];
}

// Compute ISO date range in Colombo local time
function getDateRangeParams(filter: string): { dateFrom?: string; dateTo?: string } {
  if (filter === 'Today') {
    const now = new Date();
    // format as YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    return { dateFrom: todayStr, dateTo: todayStr };
  }
  if (filter === 'Last7Days') {
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pastYear = past.getFullYear();
    const pastMonth = String(past.getMonth() + 1).padStart(2, '0');
    const pastDay = String(past.getDate()).padStart(2, '0');
    const pastStr = `${pastYear}-${pastMonth}-${pastDay}`;
    return { dateFrom: pastStr };
  }
  return {};
}

export default function AuditTrail() {
  const navigate = useNavigate();
  const location = useLocation();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [actorFilter, setActorFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const defaultAuditParams = { page: 1, limit: 5 };
  const cachedAudit = api.getCached<{ events: AuditEventItem[]; pagination: Pagination; summary: any }>('/ym04/audit-logs', defaultAuditParams);

  // Interactive UI & Data State
  const [events, setEvents] = useState<AuditEventItem[]>(() => cachedAudit?.events || (Array.isArray(cachedAudit) ? cachedAudit : []));
  const [loading, setLoading] = useState<boolean>(() => !cachedAudit);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [pagination, setPagination] = useState<Pagination>(() => cachedAudit?.pagination || {
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1
  });
  const [summary, setSummary] = useState<{
    totalEvents: number;
    todayEvents: number;
    referenceChanges: number;
    adminActions: number;
  }>(() => cachedAudit?.summary || {
    totalEvents: 0,
    todayEvents: 0,
    referenceChanges: 0,
    adminActions: 0
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch live audit logs (with cache & stale-while-revalidate)
  const fetchAuditLogs = useCallback(
    async (signal?: AbortSignal, isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const params: Record<string, any> = {
          page: currentPage,
          limit: pageSize
        };

        if (searchTerm.trim()) {
          params.search = searchTerm.trim();
        }
        if (actionFilter !== 'All') {
          params.action = actionFilter;
        }
        if (actorFilter !== 'All') {
          params.actor = actorFilter;
        }
        if (targetFilter !== 'All') {
          params.targetType = targetFilter;
        }

        const dateParams = getDateRangeParams(dateFilter);
        if (dateParams.dateFrom) params.dateFrom = dateParams.dateFrom;
        if (dateParams.dateTo) params.dateTo = dateParams.dateTo;

        if (!api.getCached('/ym04/audit-logs', params) && !isManualRefresh) {
          setLoading(true);
        }

        const response = await api.get('/ym04/audit-logs', { params, signal, skipCache: isManualRefresh });

        if (!isMountedRef.current || signal?.aborted) return;

        const data = response?.data || {};
        const list: AuditEventItem[] = Array.isArray(data)
          ? data
          : Array.isArray(data.events)
          ? data.events
          : [];
        setEvents(list);
        if (data.pagination) setPagination(data.pagination);
        if (data.summary) setSummary(data.summary);
        setError(null);

        if (isManualRefresh) {
          setToastMessage('Audit log data refreshed successfully.');
        }
      } catch (err) {
        const isCanceled =
          axios.isCancel(err) ||
          (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) ||
          (axios.isAxiosError(err) && (err.code === 'ERR_CANCELED' || err.name === 'CanceledError')) ||
          Boolean(signal?.aborted);

        if (isCanceled || !isMountedRef.current) {
          return;
        }
        setError(getErrorMessage(err, 'Failed to load audit logs.'));
      } finally {
        if (isMountedRef.current && !signal?.aborted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [currentPage, pageSize, searchTerm, actionFilter, actorFilter, targetFilter, dateFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchAuditLogs(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchAuditLogs]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setActionFilter('All');
    setActorFilter('All');
    setTargetFilter('All');
    setDateFilter('All');
    setCurrentPage(1);
    setToastMessage('Filters have been reset.');
  };

  // Handle Refresh
  const handleRefresh = () => {
    fetchAuditLogs(undefined, true);
  };

  // Handle View Details
  const handleViewDetails = (item: AuditEventItem) => {
    if (!item?.id) return;
    if (location.pathname.startsWith('/admin/audit-trail')) {
      navigate(`/admin/audit-trail/${item.id}`);
    } else {
      navigate(`/admin/reference-data/audit-trail/${item.id}`);
    }
  };

  const totalItems = pagination.total || 0;
  const totalPages = pagination.totalPages || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startRecordNumber = totalItems === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endRecordNumber = Math.min(validCurrentPage * pageSize, totalItems);

  return (
    <div className="ym04-container" role="region" aria-label="Audit Trail">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Page Header                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="ym04-audit-header">
        <div className="ym04-audit-header-title-wrap">
          <div className="ym04-audit-header-icon" aria-hidden="true">
            <Sprout size={22} strokeWidth={2} />
          </div>
          <div className="ym04-header">
            <h1 className="ym04-title">Audit Trail</h1>
            <p className="ym04-subtitle">Track and review system activities and changes.</p>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {!loading && error && (
        <div className="ym04-alert-wrap" role="alert">
          <Alert type="error">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', width: '100%' }}>
              <span>{error}</span>
              <Button variant="outline" onClick={() => fetchAuditLogs()}>
                <RefreshCw size={14} className={loading ? 'ym04-spin' : ''} style={{ marginRight: '6px' }} />
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Top Metric / Stat Cards (4 Cards)                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-stats-grid" aria-label="Audit Trail Metrics">
        {/* Card 1: Total Events */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          title="Click to view all events"
          onClick={handleResetFilters}
          onKeyDown={(e) => e.key === 'Enter' && handleResetFilters()}
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--events" aria-hidden="true">
              <FileText size={20} strokeWidth={2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Total Events</span>
              <strong className="ym04-stat-value">{summary?.totalEvents ?? 0}</strong>
              <span className="ym04-stat-subtext">All audit events</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 2: Today Events */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          title="Click to filter events today"
          onClick={() => {
            setDateFilter('Today');
            setCurrentPage(1);
            setToastMessage("Filtered by today's events.");
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setDateFilter('Today');
              setCurrentPage(1);
            }
          }}
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--today" aria-hidden="true">
              <Calendar size={20} strokeWidth={2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Today Events</span>
              <strong className="ym04-stat-value">{summary?.todayEvents ?? 0}</strong>
              <span className="ym04-stat-subtext">Events today</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 3: Reference Changes */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          title="Click to filter Crop & Grade reference changes"
          onClick={() => {
            setTargetFilter('Crops');
            setCurrentPage(1);
            setToastMessage('Filtered by Reference Changes (Crops).');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setTargetFilter('Crops');
              setCurrentPage(1);
            }
          }}
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--ref-changes" aria-hidden="true">
              <RefreshCw size={20} strokeWidth={2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Reference Changes</span>
              <strong className="ym04-stat-value">{summary?.referenceChanges ?? 0}</strong>
              <span className="ym04-stat-subtext">Crop &amp; Grade changes</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 4: Admin Actions */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          title="Click to filter Admin activities"
          onClick={() => {
            setActorFilter('Admin');
            setCurrentPage(1);
            setToastMessage('Filtered by Admin activities.');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setActorFilter('Admin');
              setCurrentPage(1);
            }
          }}
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--admin-actions" aria-hidden="true">
              <ShieldCheck size={20} strokeWidth={2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Admin Actions</span>
              <strong className="ym04-stat-value">{summary?.adminActions ?? 0}</strong>
              <span className="ym04-stat-subtext">Admin activities</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Filter & Search Controls                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-audit-filter-row" aria-label="Audit Trail Filters">
        {/* Search Bar */}
        <div className="ym04-audit-search-box">
          <Search size={16} className="ym04-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="ym04-audit-search-input"
            placeholder="Search by Event ID or Target..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Search audit events by ID, target, actor or action"
          />
          {searchTerm && (
            <button
              type="button"
              className="ym04-search-clear"
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              aria-label="Clear search input"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter 1: Action Dropdown */}
        <div className="ym04-audit-select-wrap">
          <select
            className="ym04-audit-select"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by Action"
          >
            <option value="All">All Actions</option>
            <option value="Created">Created</option>
            <option value="Updated">Updated</option>
            <option value="Deactivated">Deactivated</option>
          </select>
        </div>

        {/* Filter 2: Actor Dropdown (Strictly Admin & System only) */}
        <div className="ym04-audit-select-wrap">
          <select
            className="ym04-audit-select"
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by Actor"
          >
            <option value="All">All Actors</option>
            <option value="Admin">Admin</option>
            <option value="System">System</option>
          </select>
        </div>

        {/* Filter 3: Target Dropdown */}
        <div className="ym04-audit-select-wrap">
          <select
            className="ym04-audit-select"
            value={targetFilter}
            onChange={(e) => {
              setTargetFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by Target"
          >
            <option value="All">All Targets</option>
            <option value="Crops">Crops</option>
            <option value="Grades">Grades</option>
            <option value="System">System</option>
          </select>
        </div>

        {/* Filter 4: Date Range Dropdown */}
        <div className="ym04-audit-date-wrap">
          <CalendarDays size={16} className="ym04-audit-date-icon" aria-hidden="true" />
          <select
            className="ym04-audit-date-select"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by Date Range"
          >
            <option value="All">All Time</option>
            <option value="Today">Today</option>
            <option value="Last7Days">Last 7 Days</option>
          </select>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Action Bar / Refresh Button                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="ym04-audit-action-bar">
        <Button
          type="button"
          variant="outline"
          className="ym04-btn-refresh"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          aria-label="Refresh audit events list"
        >
          <RotateCw size={15} className={isRefreshing ? 'ym04-spin' : ''} aria-hidden="true" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Audit Log Table                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-audit-card" aria-label="Audit Events List">
        <div className="ym04-table-wrap">
          {loading && events.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <Loader2 size={32} className="ym04-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
              <p style={{ color: 'var(--muted)' }}>Loading audit events...</p>
            </div>
          ) : (
            <Table
              headers={['Event ID', 'Actor', 'Action', 'Target', 'Date & Time (Colombo)', 'Status', 'Actions']}
              className="ym04-audit-table"
              aria-label="Audit Events List"
            >
              {events.length > 0 ? (
                events.map((item, index) => {
                  const displayTime =
                    item.dateTime || (item.occurredAt ? formatColomboDate(item.occurredAt) : '—');
                  const displayActor =
                    typeof item.actor === 'string' && item.actor.trim() ? item.actor : 'System';
                  const avatarLetter =
                    typeof item.actorAvatar === 'string' && item.actorAvatar.trim()
                      ? item.actorAvatar.trim().charAt(0).toUpperCase()
                      : displayActor.charAt(0).toUpperCase() || 'S';
                  const actionText =
                    typeof item.action === 'string' && item.action.trim() ? item.action : 'Updated';
                  const actionClass = actionText.toLowerCase();
                  const eventIdStr = String(item.id ?? '');
                  const displayEventId =
                    eventIdStr.length > 8 ? `${eventIdStr.slice(0, 8)}...` : eventIdStr || '—';
                  const targetNameStr = String(item.targetName || item.target || 'System');

                  return (
                    <TableRow key={eventIdStr || `audit-event-${index}`}>
                      {/* Event ID */}
                      <td
                        className="ym04-cell-event-id"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleViewDetails(item)}
                        title={`View event ${eventIdStr} details`}
                      >
                        <span style={{ fontFamily: 'monospace' }}>
                          {displayEventId}
                        </span>
                      </td>

                      {/* Actor */}
                      <td>
                        <div className="ym04-cell-actor">
                          <span className="ym04-actor-avatar" aria-hidden="true">
                            {avatarLetter}
                          </span>
                          <span>{displayActor}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td>
                        <span
                          className={`ym04-badge-action ym04-badge-action--${actionClass}`}
                        >
                          {actionText}
                        </span>
                      </td>

                      {/* Target */}
                      <td>
                        <div className="ym04-cell-target">
                          {item.targetType === 'Crop' ? (
                            <Sprout
                              size={16}
                              className="ym04-target-icon ym04-target-icon--crop"
                              aria-hidden="true"
                            />
                          ) : item.targetType === 'Grade' ? (
                            <Tag
                              size={15}
                              className="ym04-target-icon ym04-target-icon--grade"
                              aria-hidden="true"
                            />
                          ) : (
                            <Info
                              size={15}
                              className="ym04-target-icon ym04-target-icon--system"
                              aria-hidden="true"
                            />
                          )}
                          <span>{targetNameStr}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="ym04-cell-date">{displayTime}</td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={item.status ?? 'Success'} />
                      </td>

                      {/* Actions */}
                      <td>
                        <Button
                          type="button"
                          variant="outline"
                          className="ym04-btn-view-details"
                          onClick={() => handleViewDetails(item)}
                          aria-label={`View audit details for event ${eventIdStr}`}
                        >
                          View Details
                        </Button>
                      </td>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <td colSpan={7}>
                    <EmptyState
                      title="No audit events match your filters"
                      description="Try clearing your search terms or resetting the action, actor, or date filters to view all audit records."
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          className="ym04-reset-filter-btn"
                          onClick={handleResetFilters}
                        >
                          <RefreshCw size={14} aria-hidden="true" />
                          <span>Reset Filters</span>
                        </Button>
                      }
                    />
                  </td>
                </TableRow>
              )}
            </Table>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 6. Pagination Bar                                                  */}
        {/* ------------------------------------------------------------------ */}
        {totalItems > 0 && (
          <div className="ym04-audit-pagination-bar" aria-label="Audit Events Pagination">
            <span className="ym04-pagination-info">
              Showing {startRecordNumber}–{endRecordNumber} of {totalItems} events
            </span>

            <div className="ym04-pagination-controls" role="navigation" aria-label="Pagination">
              {/* Previous Page */}
              <button
                type="button"
                className="ym04-page-arrow"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={validCurrentPage === 1}
                aria-label="Go to previous page"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page Number Buttons */}
              {getPaginationItems(validCurrentPage, totalPages).map((item, idx) => {
                if (typeof item === 'string') {
                  return (
                    <span key={`ellipsis-${idx}`} className="ym04-page-ellipsis" aria-hidden="true">
                      ...
                    </span>
                  );
                }
                const isSelected = item === validCurrentPage;
                return (
                  <button
                    key={`page-${item}`}
                    type="button"
                    className={`ym04-page-num ${isSelected ? 'ym04-page-num--active' : ''}`}
                    onClick={() => setCurrentPage(item)}
                    aria-current={isSelected ? 'page' : undefined}
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </button>
                );
              })}

              {/* Next Page */}
              <button
                type="button"
                className="ym04-page-arrow"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={validCurrentPage === totalPages}
                aria-label="Go to next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. Quick Actions Banner                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-quick-actions-bar" aria-label="Quick Actions">
        <div className="ym04-quick-actions-left">
          <Zap size={22} className="ym04-quick-actions-icon" aria-hidden="true" />
          <div>
            <h2 className="ym04-quick-actions-title">Quick Actions</h2>
            <p className="ym04-quick-actions-subtitle">Access important audit information quickly.</p>
          </div>
        </div>

        <div className="ym04-quick-actions-btns">
          {/* Quick Action 1: View Reference Changes */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--white"
            onClick={() => {
              setTargetFilter('Crops');
              setCurrentPage(1);
              setToastMessage('Filtered table to Crop changes.');
            }}
          >
            <BarChart2 size={16} aria-hidden="true" />
            <span>View Reference Changes</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          {/* Quick Action 2: View Admin Activities */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--white"
            onClick={() => {
              setActorFilter('Admin');
              setCurrentPage(1);
              setToastMessage('Filtered table to Admin activities.');
            }}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            <span>View Admin Activities</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

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
