import { useEffect, useState, useId } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, Search, X, Check } from 'lucide-react';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Toast } from '../../components/Toast';
import { EmptyState } from '../../components/EmptyState';
import { Table, TableRow } from '../../components/Table';
import { PeopleSubNav } from './PeopleSubNav';

// YM30 · Yugen Suresh · Page 02 - Approval Requests
// Dedicated separate page to review and manage pending member registrations.
// WorkspaceLayout owns the sidebar and topbar.

interface ApprovalRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  district: string | null;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalReason?: string | null;
  createdAt: string;
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAccountIdShort(id: string): string {
  const segment = id.replace(/-/g, '').slice(0, 4);
  return `YM-${parseInt(segment, 16) % 10000}`;
}

export default function ApprovalRequests() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [stats, setStats] = useState<ApprovalStats>({ pending: 12, approved: 8, rejected: 2 });
  const [pagination, setPagination] = useState<PaginationMeta>({ total: 12, page: 1, limit: 5, totalPages: 3 });

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dialog states for Approve/Reject
  const [selectedUser, setSelectedUser] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState<string>('');
  const [actionBusy, setActionBusy] = useState(false);

  const rejectReasonId = useId();

  const fetchRequests = (page = currentPage) => {
    setLoading(true);
    const controller = new AbortController();

    api.get<{
      requests: ApprovalRequest[];
      stats: ApprovalStats;
      pagination: PaginationMeta;
    }>('/ym30/approvals', {
      params: {
        status: statusFilter,
        role: roleFilter,
        search: searchQuery,
        sort: sortBy,
        page,
        limit: 5,
      },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setRequests(data.requests);
        setStats(data.stats);
        setPagination(data.pagination);
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'CanceledError') {
          setError('Could not load approval requests.');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  };

  useEffect(() => {
    fetchRequests(currentPage);
  }, [statusFilter, roleFilter, sortBy, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchRequests(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('pending');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const handleCardClick = (targetStatus: 'pending' | 'approved' | 'rejected') => {
    setStatusFilter(targetStatus);
    setCurrentPage(1);
  };

  const openActionModal = (user: ApprovalRequest, type: 'approve' | 'reject') => {
    setSelectedUser(user);
    setActionType(type);
    setActionReason('');
  };

  const closeActionModal = () => {
    if (actionBusy) return;
    setSelectedUser(null);
    setActionType(null);
    setActionReason('');
  };

  const handleConfirmAction = async () => {
    if (!selectedUser || !actionType) return;
    setActionBusy(true);

    try {
      await api.patch(`/ym30/approvals/${selectedUser.id}`, {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        reason: actionReason.trim() || undefined,
      });

      setToastMessage(
        actionType === 'approve'
          ? `${selectedUser.name} has been approved successfully.`
          : `${selectedUser.name}'s registration has been rejected.`
      );

      closeActionModal();
      fetchRequests(currentPage);
    } catch {
      setError(`Failed to ${actionType} registration. Please try again.`);
    } finally {
      setActionBusy(false);
    }
  };

  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="ym30-approvals-page">
      {/* 04 Pages Sub-navigation Bar */}
      <PeopleSubNav pendingCount={stats.pending} />

      {/* Header section */}
      <div className="ym30-approvals-header">
        <div className="ym30-approvals-title-row">
          <h2 className="ym30-approvals-title">Approval requests</h2>
          <span className="ym30-pill-pending">
            <span className="ym30-pill-dot" /> Pending review
          </span>
        </div>
        <p className="ym30-approvals-subtitle">Review and manage pending member registrations.</p>
      </div>

      {/* Metric summary cards */}
      <div className="ym30-summary-cards">
        {/* Pending Card */}
        <button
          type="button"
          onClick={() => handleCardClick('pending')}
          className={`ym30-summary-card ${statusFilter === 'pending' ? 'ym30-summary-card--active' : ''}`}
        >
          <div className="ym30-summary-icon-wrap ym30-summary-icon--pending">
            <Clock size={20} />
          </div>
          <div className="ym30-summary-text">
            <span className="ym30-summary-label">Pending requests</span>
            <strong className="ym30-summary-value">{stats.pending}</strong>
          </div>
          <span className="ym30-summary-dot-indicator" />
        </button>

        {/* Approved Card */}
        <button
          type="button"
          onClick={() => handleCardClick('approved')}
          className={`ym30-summary-card ${statusFilter === 'approved' ? 'ym30-summary-card--active' : ''}`}
        >
          <div className="ym30-summary-icon-wrap ym30-summary-icon--approved">
            <CheckCircle2 size={20} />
          </div>
          <div className="ym30-summary-text">
            <span className="ym30-summary-label">Approved requests</span>
            <strong className="ym30-summary-value">{stats.approved}</strong>
          </div>
        </button>

        {/* Rejected Card */}
        <button
          type="button"
          onClick={() => handleCardClick('rejected')}
          className={`ym30-summary-card ${statusFilter === 'rejected' ? 'ym30-summary-card--active' : ''}`}
        >
          <div className="ym30-summary-icon-wrap ym30-summary-icon--rejected">
            <XCircle size={20} />
          </div>
          <div className="ym30-summary-text">
            <span className="ym30-summary-label">Rejected requests</span>
            <strong className="ym30-summary-value">{stats.rejected}</strong>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="ym30-filter-bar">
        <form onSubmit={handleSearchSubmit} className="ym30-search-form">
          <Search size={18} className="ym30-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search members or account ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ym30-search-input"
            aria-label="Search members or account ID"
          />
        </form>

        <div className="ym30-filter-actions">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="ym30-filter-select"
            aria-label="Filter by role type"
          >
            <option value="all">All types</option>
            <option value="farmer">Farmer</option>
            <option value="buyer">Buyer</option>
            <option value="driver">Driver</option>
            <option value="admin">Admin</option>
          </select>

          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="ym30-clear-btn"
          >
            ✕ Clear
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Table section */}
      <ContentCard className="ym30-table-card">
        <div className="ym30-table-top">
          <div className="ym30-table-title-wrap">
            <h3 className="ym30-table-heading">
              {statusFilter === 'pending'
                ? 'Pending registrations'
                : statusFilter === 'approved'
                ? 'Approved registrations'
                : statusFilter === 'rejected'
                ? 'Rejected registrations'
                : 'All registrations'}
            </h3>
            <span className="ym30-total-pill">{pagination.total} total</span>
          </div>

          <div className="ym30-sort-wrap">
            <label htmlFor="ym30-sort-select" className="ym30-sort-label">Sort by:</label>
            <select
              id="ym30-sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="ym30-sort-select"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p role="status" className="loading-state">Loading approval requests…</p>
        ) : requests.length === 0 ? (
          <EmptyState
            title="No registration requests found"
            description="There are no registration requests matching your current filter criteria."
            action={
              <Button variant="outline" onClick={handleClearFilters}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <Table headers={['MEMBER', 'ACCOUNT TYPE', 'DISTRICT', 'SUBMITTED', 'ACTIONS']}>
            {requests.map((member) => {
              const shortId = getAccountIdShort(member.id);
              const isPending = member.approvalStatus === 'pending';

              return (
                <TableRow key={member.id}>
                  {/* MEMBER */}
                  <td>
                    <div className="ym30-member-cell">
                      <div className="ym30-avatar-sm">{getInitials(member.name)}</div>
                      <div className="ym30-member-info">
                        <div className="ym30-member-name-row">
                          <Link to={`/admin/people/${member.id}`} className="ym30-member-link">
                            <strong>{member.name}</strong>
                          </Link>
                          <span className="ym30-member-id">{shortId}</span>
                        </div>
                        <p className="ym30-member-email">{member.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* ACCOUNT TYPE */}
                  <td>
                    <span className={`ym30-role-pill ym30-role-pill--${member.role.toLowerCase()}`}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                  </td>

                  {/* DISTRICT */}
                  <td>
                    <span className="ym30-district-text">{member.district || '—'}</span>
                  </td>

                  {/* SUBMITTED */}
                  <td>
                    <span className="ym30-date-text">{formatDate(member.createdAt)}</span>
                  </td>

                  {/* ACTIONS */}
                  <td>
                    <div className="ym30-actions-cell">
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            className="ym30-btn-approve"
                            onClick={() => openActionModal(member, 'approve')}
                            title="Approve this member"
                          >
                            <Check size={16} /> Approve
                          </button>
                          <button
                            type="button"
                            className="ym30-btn-reject"
                            onClick={() => openActionModal(member, 'reject')}
                            title="Reject this member"
                          >
                            <X size={16} /> Reject
                          </button>
                        </>
                      ) : (
                        <div className="ym30-resolved-actions">
                          <StatusBadge status={member.approvalStatus} />
                          <Link to={`/admin/people/${member.id}`}>
                            <Button variant="outline" className="ym30-view-btn">View</Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </td>
                </TableRow>
              );
            })}
          </Table>
        )}

        {/* Pagination footer */}
        {pagination.total > 0 && (
          <div className="ym30-table-footer-row">
            <p className="ym30-page-count-text">
              Showing {startIndex}-{endIndex} of {pagination.total} requests
            </p>

            <div className="ym30-pagination-controls">
              <button
                type="button"
                className="ym30-page-nav-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ‹ Previous
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`ym30-page-num-btn ${currentPage === p ? 'ym30-page-num-btn--active' : ''}`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="ym30-page-nav-btn"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </ContentCard>

      {/* Confirmation Modal for Approve / Reject */}
      {selectedUser && (
        <div className="ym30-modal-overlay" role="presentation">
          <div className="ym30-modal-dialog" role="dialog" aria-labelledby="ym30-modal-title">
            <h3 id="ym30-modal-title" className="ym30-modal-heading">
              {actionType === 'approve' ? 'Approve member registration' : 'Reject member registration'}
            </h3>

            <p className="ym30-modal-desc">
              {actionType === 'approve'
                ? `Are you sure you want to approve ${selectedUser.name} as a ${selectedUser.role}? They will receive workspace and operational access.`
                : `Are you sure you want to reject ${selectedUser.name}'s registration?`}
            </p>

            {actionType === 'reject' && (
              <div className="ym30-field-group">
                <label htmlFor={rejectReasonId} className="ym30-modal-label">
                  Rejection reason (optional):
                </label>
                <textarea
                  id={rejectReasonId}
                  className="ym30-modal-textarea"
                  rows={3}
                  placeholder="e.g. Incomplete documentation, invalid address..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>
            )}

            <div className="ym30-modal-actions">
              <Button
                variant="outline"
                disabled={actionBusy}
                onClick={closeActionModal}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === 'approve' ? 'primary' : 'danger'}
                disabled={actionBusy}
                onClick={handleConfirmAction}
              >
                {actionBusy
                  ? 'Processing…'
                  : actionType === 'approve'
                  ? 'Confirm approval'
                  : 'Confirm rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          open={Boolean(toastMessage)}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
