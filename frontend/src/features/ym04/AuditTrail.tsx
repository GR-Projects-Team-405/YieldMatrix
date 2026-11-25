import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import { Table, TableRow } from '../../components/Table';
import { Toast } from '../../components/Toast';
import { AuditEventItem, GENERATED_AUDIT_EVENTS } from './auditMockData';

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

export default function AuditTrail() {
  const navigate = useNavigate();
  const location = useLocation();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [actorFilter, setActorFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');

  // Interactive UI State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5; // 5 items per page to match the exact 1-5 of 245 in the Figma screenshot
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filtered dataset
  const filteredEvents = useMemo(() => {
    return GENERATED_AUDIT_EVENTS.filter((item) => {
      // 1. Search term (Event ID, Target, Actor, Action, Date)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = item.id.toLowerCase().includes(query);
        const matchesTarget = item.target.toLowerCase().includes(query);
        const matchesActor = item.actor.toLowerCase().includes(query);
        const matchesAction = item.action.toLowerCase().includes(query);
        const matchesDate = item.dateTime.toLowerCase().includes(query);
        if (!matchesId && !matchesTarget && !matchesActor && !matchesAction && !matchesDate) {
          return false;
        }
      }

      // 2. Action Filter
      if (actionFilter !== 'All' && item.action !== actionFilter) {
        return false;
      }

      // 3. Actor Filter
      if (actorFilter !== 'All' && item.actor !== actorFilter) {
        return false;
      }

      // 4. Target Filter
      if (targetFilter !== 'All') {
        if (targetFilter === 'Crops' && item.targetType !== 'Crop') return false;
        if (targetFilter === 'Grades' && item.targetType !== 'Grade') return false;
        if (targetFilter === 'System' && item.targetType !== 'System') return false;
      }

      // 5. Date Filter
      if (dateFilter !== 'All') {
        if (dateFilter === 'Today') {
          // In the mock context, Today is 05 Nov 2026
          return item.dateTime.includes('05 Nov 2026');
        }
        if (dateFilter === 'Last7Days') {
          // Within Nov 2026
          return item.dateTime.includes('Nov 2026');
        }
      }

      return true;
    });
  }, [searchTerm, actionFilter, actorFilter, targetFilter, dateFilter]);

  // Pagination calculation
  const totalItems = filteredEvents.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // Ensure current page is valid when filters change
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedEvents = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filteredEvents.slice(startIndex, startIndex + pageSize);
  }, [filteredEvents, validCurrentPage, pageSize]);

  const startRecordNumber = totalItems === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endRecordNumber = Math.min(validCurrentPage * pageSize, totalItems);

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
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setToastMessage('Audit log data refreshed successfully.');
    }, 600);
  };

  // Handle View Details - navigates cleanly to Page 5: Audit Event Details
  const handleViewDetails = (item: AuditEventItem) => {
    if (location.pathname.startsWith('/admin/audit-trail')) {
      navigate(`/admin/audit-trail/${item.id}`);
    } else {
      navigate(`/admin/reference-data/audit-trail/${item.id}`);
    }
  };

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

      {/* ------------------------------------------------------------------ */}
      {/* 2. Top Metric / Stat Cards (4 Cards)                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-stats-grid" aria-label="Audit Trail Metrics">
        {/* Card 1: Total Events */}
        <div
          className="ym04-stat-card"
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
              <strong className="ym04-stat-value">245</strong>
              <span className="ym04-stat-subtext">All audit events</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 2: Today Events */}
        <div
          className="ym04-stat-card"
          role="button"
          tabIndex={0}
          title="Click to filter events today"
          onClick={() => {
            setDateFilter('Today');
            setCurrentPage(1);
            setToastMessage('Filtered by today\'s events.');
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
              <strong className="ym04-stat-value">12</strong>
              <span className="ym04-stat-subtext">Events today</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 3: Reference Changes */}
        <div
          className="ym04-stat-card"
          role="button"
          tabIndex={0}
          title="Click to filter Crop & Grade reference changes"
          onClick={() => {
            setTargetFilter('Crops');
            setCurrentPage(1);
            setToastMessage('Filtered by Reference Changes (Crops & Grades).');
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
              <strong className="ym04-stat-value">68</strong>
              <span className="ym04-stat-subtext">Crop &amp; Grade changes</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 4: Admin Actions */}
        <div
          className="ym04-stat-card"
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
              <strong className="ym04-stat-value">74</strong>
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
              onClick={() => setSearchTerm('')}
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

        {/* Filter 2: Actor Dropdown */}
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
            <option value="Agri Officer">Agri Officer</option>
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
            <option value="All">Select Date Range</option>
            <option value="Today">Today (05 Nov)</option>
            <option value="Last7Days">Last 7 Days</option>
            <option value="All">All Time</option>
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
          disabled={isRefreshing}
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
          <Table
            headers={['Event ID', 'Actor', 'Action', 'Target', 'Date & Time', 'Status', 'Actions']}
            className="ym04-audit-table"
            aria-label="Audit Events List"
          >
            {paginatedEvents.length > 0 ? (
              paginatedEvents.map((item) => (
                <TableRow key={item.id}>
                  {/* Event ID */}
                  <td
                    className="ym04-cell-event-id"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleViewDetails(item)}
                    title={`View event ${item.id} details`}
                  >
                    {item.id}
                  </td>

                  {/* Actor */}
                  <td>
                    <div className="ym04-cell-actor">
                      <span className="ym04-actor-avatar" aria-hidden="true">
                        {item.actorAvatar}
                      </span>
                      <span>{item.actor}</span>
                    </div>
                  </td>

                  {/* Action */}
                  <td>
                    <span
                      className={`ym04-badge-action ym04-badge-action--${item.action.toLowerCase()}`}
                    >
                      {item.action}
                    </span>
                  </td>

                  {/* Target */}
                  <td>
                    <div className="ym04-cell-target">
                      {item.targetType === 'Crop' ? (
                        <Sprout size={16} className="ym04-target-icon ym04-target-icon--crop" aria-hidden="true" />
                      ) : item.targetType === 'Grade' ? (
                        <Tag size={15} className="ym04-target-icon ym04-target-icon--grade" aria-hidden="true" />
                      ) : (
                        <Info size={15} className="ym04-target-icon ym04-target-icon--system" aria-hidden="true" />
                      )}
                      <span>{item.target}</span>
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="ym04-cell-date">{item.dateTime}</td>

                  {/* Status */}
                  <td>
                    <StatusBadge status={item.status} />
                  </td>

                  {/* Actions */}
                  <td>
                    <Button
                      type="button"
                      variant="outline"
                      className="ym04-btn-view-details"
                      onClick={() => handleViewDetails(item)}
                      aria-label={`View audit details for event ${item.id}`}
                    >
                      View Details
                    </Button>
                  </td>
                </TableRow>
              ))
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
              setToastMessage('Filtered table to reference changes.');
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
