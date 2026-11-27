import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, CheckCircle2, Clock, ShieldCheck, Ban, MoreHorizontal } from 'lucide-react';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Toast } from '../../components/Toast';
import { EmptyState } from '../../components/EmptyState';
import { Table, TableRow } from '../../components/Table';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PeopleSubNav } from './PeopleSubNav';

// YM30 · Yugen Suresh · People & Access Member Directory (Image 1)
// Route: /admin/people
// Manage registered members, account status and platform access.

interface MemberRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  district: string | null;
  approvalStatus: 'approved' | 'pending' | 'suspended' | 'rejected';
  approvalReason?: string | null;
  createdAt: string;
}

interface MemberStats {
  totalMembers: number;
  pendingApproval: number;
  activeAccounts: number;
  suspendedAccounts: number;
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

export default function PeopleAndAccess() {
  const navigate = useNavigate();

  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [stats, setStats] = useState<MemberStats>({
    totalMembers: 128,
    pendingApproval: 12,
    activeAccounts: 114,
    suspendedAccounts: 2,
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 128,
    page: 1,
    limit: 5,
    totalPages: 26,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Action Menu Dropdown state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<MemberRecord | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'restore' | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchMembers = (page = currentPage) => {
    setLoading(true);
    const controller = new AbortController();

    api.get<{
      members: MemberRecord[];
      stats: MemberStats;
      pagination: PaginationMeta;
    }>('/ym30/members', {
      params: {
        search: searchQuery,
        role: roleFilter,
        status: statusFilter,
        sort: sortBy,
        page,
        limit: 5,
      },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setMembers(data.members);
        setStats(data.stats);
        setPagination(data.pagination);
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'CanceledError') {
          setError('Could not load member directory.');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  };

  useEffect(() => {
    fetchMembers(currentPage);
  }, [roleFilter, statusFilter, sortBy, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchMembers(1);
  };

  const handleClear = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const handleStatCardClick = (filter: string, redirectPath?: string) => {
    if (redirectPath) {
      navigate(redirectPath);
      return;
    }
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const handleConfirmAction = async () => {
    if (!actionTarget || !actionType) return;
    setActionBusy(true);

    try {
      if (actionType === 'restore') {
        await api.patch(`/ym30/members/${actionTarget.id}/restore`);
        setToastMessage(`${actionTarget.name}'s access has been restored.`);
      } else {
        await api.patch(`/ym30/members/${actionTarget.id}/suspend`, { reason: 'Policy violation' });
        setToastMessage(`${actionTarget.name} has been suspended.`);
      }
      setActionTarget(null);
      setActionType(null);
      fetchMembers(currentPage);
    } catch {
      setError(`Failed to ${actionType} account. Please try again.`);
    } finally {
      setActionBusy(false);
    }
  };

  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="ym30-directory-page">
      {/* 04 Pages Sub-navigation Bar */}
      <PeopleSubNav pendingCount={stats.pendingApproval} suspendedCount={stats.suspendedAccounts} />

      {/* Header section matching Image 1 */}
      <div className="ym30-directory-header">
        <h2 className="ym30-directory-title">People &amp; access</h2>
        <p className="ym30-directory-subtitle">Manage registered members, account status and platform access.</p>
      </div>

      {/* 4 Stat Cards */}
      <div className="ym30-dir-stats-grid">
        {/* Card 1: Total members */}
        <button
          type="button"
          onClick={() => handleStatCardClick('all')}
          className={`ym30-dir-stat-card ${statusFilter === 'all' ? 'active' : ''}`}
        >
          <div className="ym30-dir-stat-text">
            <span className="ym30-dir-stat-label">Total members</span>
            <strong className="ym30-dir-stat-value">{stats.totalMembers}</strong>
          </div>
          <div className="ym30-dir-stat-icon ym30-dir-stat-icon--green">
            <ShieldCheck size={20} />
          </div>
        </button>

        {/* Card 2: Pending approval */}
        <button
          type="button"
          onClick={() => handleStatCardClick('pending', '/admin/people/approvals')}
          className={`ym30-dir-stat-card ${statusFilter === 'pending' ? 'active' : ''}`}
          title="Click to view Approval Requests"
        >
          <div className="ym30-dir-stat-text">
            <span className="ym30-dir-stat-label">Pending approval</span>
            <strong className="ym30-dir-stat-value">{stats.pendingApproval}</strong>
          </div>
          <div className="ym30-dir-stat-icon ym30-dir-stat-icon--peach">
            <Clock size={20} />
          </div>
        </button>

        {/* Card 3: Active accounts */}
        <button
          type="button"
          onClick={() => handleStatCardClick('active')}
          className={`ym30-dir-stat-card ${statusFilter === 'active' ? 'active' : ''}`}
        >
          <div className="ym30-dir-stat-text">
            <span className="ym30-dir-stat-label">Active accounts</span>
            <strong className="ym30-dir-stat-value">{stats.activeAccounts}</strong>
          </div>
          <div className="ym30-dir-stat-icon ym30-dir-stat-icon--softgreen">
            <CheckCircle2 size={20} />
          </div>
        </button>

        {/* Card 4: Suspended accounts */}
        <button
          type="button"
          onClick={() => handleStatCardClick('suspended', '/admin/people/suspended')}
          className={`ym30-dir-stat-card ${statusFilter === 'suspended' ? 'active' : ''}`}
          title="Click to view Suspended Accounts page"
        >
          <div className="ym30-dir-stat-text">
            <span className="ym30-dir-stat-label">Suspended accounts</span>
            <strong className="ym30-dir-stat-value">{stats.suspendedAccounts}</strong>
          </div>
          <div className="ym30-dir-stat-icon ym30-dir-stat-icon--red">
            <Ban size={20} />
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="ym30-dir-filter-bar">
        <form onSubmit={handleSearchSubmit} className="ym30-dir-search-form">
          <Search size={18} className="ym30-dir-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name, email or account ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ym30-dir-search-input"
            aria-label="Search name, email or account ID"
          />
        </form>

        <div className="ym30-dir-filters-group">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="ym30-dir-select"
            aria-label="Filter by role"
          >
            <option value="all">All types</option>
            <option value="farmer">Farmer</option>
            <option value="buyer">Buyer</option>
            <option value="driver">Driver</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="ym30-dir-select"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending approval</option>
            <option value="suspended">Suspended</option>
          </select>

          <Button
            variant="outline"
            onClick={handleClear}
            className="ym30-dir-clear-btn"
          >
            Clear
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Main Members Table Card */}
      <ContentCard className="ym30-dir-table-card">
        <div className="ym30-dir-table-header">
          <div className="ym30-dir-table-title-wrap">
            <h3 className="ym30-dir-table-title">All members</h3>
            <span className="ym30-dir-count-pill">{pagination.total} members</span>
          </div>

          <div className="ym30-dir-sort-wrap">
            <label htmlFor="ym30-dir-sort" className="ym30-dir-sort-label">Sort by:</label>
            <select
              id="ym30-dir-sort"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="ym30-dir-sort-select"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p role="status" className="loading-state">Loading members…</p>
        ) : members.length === 0 ? (
          <EmptyState
            title="No members found"
            description="No member accounts matched your search or filter criteria."
            action={
              <Button variant="outline" onClick={handleClear}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <Table headers={['MEMBER', 'ACCOUNT TYPE', 'DISTRICT', 'REGISTERED', 'STATUS', 'ACTIONS']}>
            {members.map((member) => {
              const isActive = member.approvalStatus === 'approved';
              const isPending = member.approvalStatus === 'pending';
              const isSuspended = member.approvalStatus === 'suspended';

              return (
                <TableRow key={member.id}>
                  {/* MEMBER */}
                  <td>
                    <div className="ym30-member-cell">
                      <div className="ym30-avatar-sm">{getInitials(member.name)}</div>
                      <div className="ym30-member-info">
                        <Link to={`/admin/people/${member.id}`} className="ym30-member-link">
                          <strong>{member.name}</strong>
                        </Link>
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

                  {/* REGISTERED */}
                  <td>
                    <span className="ym30-date-text">{formatDate(member.createdAt)}</span>
                  </td>

                  {/* STATUS */}
                  <td>
                    <span className={`ym30-dir-status ym30-dir-status--${member.approvalStatus}`}>
                      <span className="ym30-status-dot" />
                      {isActive ? 'Active' : isPending ? 'Pending approval' : isSuspended ? 'Suspended' : member.approvalStatus}
                    </span>
                  </td>

                  {/* ACTIONS */}
                  <td>
                    <div className="ym30-dir-actions-cell">
                      <Link to={`/admin/people/${member.id}`}>
                        <Button variant="outline" className="ym30-dir-view-btn">
                          View details
                        </Button>
                      </Link>

                      <div className="ym30-menu-wrap">
                        <button
                          type="button"
                          className="ym30-dir-more-btn"
                          aria-label="More actions"
                          onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {activeMenuId === member.id && (
                          <div className="ym30-dir-dropdown-menu">
                            <Link to={`/admin/people/${member.id}`} className="ym30-menu-item">
                              Inspect profile
                            </Link>

                            {isSuspended ? (
                              <button
                                type="button"
                                className="ym30-menu-item ym30-menu-item--success"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setActionTarget(member);
                                  setActionType('restore');
                                }}
                              >
                                Restore access
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ym30-menu-item ym30-menu-item--danger"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setActionTarget(member);
                                  setActionType('suspend');
                                }}
                              >
                                Suspend account
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </TableRow>
              );
            })}
          </Table>
        )}

        {/* Pagination Footer */}
        {pagination.total > 0 && (
          <div className="ym30-table-footer-row">
            <p className="ym30-page-count-text">
              Showing {startIndex}-{endIndex} of {pagination.total} members
            </p>

            <div className="ym30-pagination-controls">
              <button
                type="button"
                className="ym30-page-nav-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>

              {Array.from({ length: Math.min(3, pagination.totalPages) }, (_, i) => i + 1).map((p) => (
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
                Next
              </button>
            </div>
          </div>
        )}
      </ContentCard>

      {/* Confirmation Dialog */}
      {actionTarget && actionType && (
        <ConfirmDialog
          open={Boolean(actionTarget)}
          title={actionType === 'restore' ? 'Restore member access' : 'Suspend member account'}
          description={
            actionType === 'restore'
              ? `Are you sure you want to restore access for ${actionTarget.name}? Their login and workspace operations will be re-enabled.`
              : `Are you sure you want to suspend ${actionTarget.name}'s account? They will lose access to trading and wallet operations.`
          }
          confirmLabel={actionType === 'restore' ? 'Restore access' : 'Suspend account'}
          busy={actionBusy}
          onCancel={() => {
            setActionTarget(null);
            setActionType(null);
          }}
          onConfirm={handleConfirmAction}
        />
      )}

      {/* Toast */}
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
