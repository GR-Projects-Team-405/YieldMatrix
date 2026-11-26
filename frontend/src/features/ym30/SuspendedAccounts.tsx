import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Ban, CheckCircle2, AlertCircle, X } from 'lucide-react';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Toast } from '../../components/Toast';
import { EmptyState } from '../../components/EmptyState';
import { Table, TableRow } from '../../components/Table';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PeopleSubNav } from './PeopleSubNav';

// YM30 · Yugen Suresh · Suspended Accounts Directory (Image 2)
// Route: /admin/people/suspended
// Review suspended member accounts, understand suspension reasons and manage access restoration.

interface SuspendedAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  district: string | null;
  suspensionReason: string;
  suspendedOn: string;
  approvalStatus: string;
}

interface SuspendedStats {
  currentlySuspended: number;
  restoredToday: number;
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

export default function SuspendedAccounts() {
  const [accounts, setAccounts] = useState<SuspendedAccount[]>([]);
  const [stats, setStats] = useState<SuspendedStats>({ currentlySuspended: 12, restoredToday: 2 });
  const [pagination, setPagination] = useState<PaginationMeta>({ total: 12, page: 1, limit: 5, totalPages: 3 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Restore Action Dialog
  const [selectedAccount, setSelectedAccount] = useState<SuspendedAccount | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const fetchSuspended = (page = currentPage) => {
    setLoading(true);
    const controller = new AbortController();

    api.get<{
      accounts: SuspendedAccount[];
      stats: SuspendedStats;
      pagination: PaginationMeta;
    }>('/ym30/suspended', {
      params: {
        search: searchQuery,
        role: roleFilter,
        reason: reasonFilter,
        sort: sortBy,
        page,
        limit: 5,
      },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setAccounts(data.accounts);
        setStats(data.stats);
        setPagination(data.pagination);
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'CanceledError') {
          setError('Could not load suspended accounts.');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  };

  useEffect(() => {
    fetchSuspended(currentPage);
  }, [roleFilter, reasonFilter, sortBy, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSuspended(1);
  };

  const handleClear = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setReasonFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const handleConfirmRestore = async () => {
    if (!selectedAccount) return;
    setRestoreBusy(true);

    try {
      await api.patch(`/ym30/members/${selectedAccount.id}/restore`);
      setToastMessage(`${selectedAccount.name}'s access has been restored.`);
      setSelectedAccount(null);
      fetchSuspended(currentPage);
    } catch {
      setError('Failed to restore member access. Please try again.');
    } finally {
      setRestoreBusy(false);
    }
  };

  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="ym30-suspended-page">
      {/* 04 Pages Sub-navigation Bar */}
      <PeopleSubNav suspendedCount={stats.currentlySuspended} />

      {/* Header section matching Image 2 */}
      <div className="ym30-suspended-header">
        <div className="ym30-suspended-title-row">
          <h2 className="ym30-suspended-title">Suspended accounts</h2>
          <span className="ym30-badge-suspended">
            {stats.currentlySuspended} suspended
          </span>
        </div>
        <p className="ym30-suspended-subtitle">
          Review suspended member accounts, understand suspension reasons and manage access restoration.
        </p>
      </div>

      {/* 2 Stat Cards */}
      <div className="ym30-susp-stats-grid">
        <div className="ym30-susp-stat-card">
          <div className="ym30-susp-stat-text">
            <span className="ym30-susp-stat-label">Currently suspended</span>
            <strong className="ym30-susp-stat-value">{stats.currentlySuspended}</strong>
          </div>
          <div className="ym30-susp-icon ym30-susp-icon--red">
            <Ban size={20} />
          </div>
        </div>

        <div className="ym30-susp-stat-card">
          <div className="ym30-susp-stat-text">
            <span className="ym30-susp-stat-label">Restored today</span>
            <strong className="ym30-susp-stat-value">{stats.restoredToday}</strong>
          </div>
          <div className="ym30-susp-icon ym30-susp-icon--green">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="ym30-susp-filter-bar">
        <form onSubmit={handleSearchSubmit} className="ym30-susp-search-form">
          <Search size={18} className="ym30-susp-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name, email or account ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ym30-susp-search-input"
            aria-label="Search name, email or account ID"
          />
        </form>

        <div className="ym30-susp-filters-group">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="ym30-susp-select"
            aria-label="Filter by role"
          >
            <option value="all">All types</option>
            <option value="farmer">Farmer</option>
            <option value="buyer">Buyer</option>
            <option value="driver">Driver</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="ym30-susp-select"
            aria-label="Filter by reason"
          >
            <option value="all">All reasons</option>
            <option value="verification">Verification issue</option>
            <option value="policy">Policy violation</option>
            <option value="admin">Admin review</option>
          </select>

          <Button
            variant="outline"
            onClick={handleClear}
            className="ym30-susp-clear-btn"
          >
            <X size={14} /> Clear
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Main Suspended Accounts Table Card */}
      <ContentCard className="ym30-susp-table-card">
        <div className="ym30-susp-table-header">
          <div className="ym30-susp-table-title-wrap">
            <h3 className="ym30-susp-table-title">Suspended accounts</h3>
            <span className="ym30-susp-count-pill">{pagination.total} records shown</span>
          </div>

          <div className="ym30-susp-sort-wrap">
            <label htmlFor="ym30-susp-sort" className="ym30-susp-sort-label">Sort by:</label>
            <select
              id="ym30-susp-sort"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="ym30-susp-sort-select"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p role="status" className="loading-state">Loading suspended accounts…</p>
        ) : accounts.length === 0 ? (
          <EmptyState
            title="No suspended accounts found"
            description="There are currently no accounts matching your filter criteria."
            action={
              <Button variant="outline" onClick={handleClear}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <Table headers={['MEMBER', 'ACCOUNT TYPE', 'DISTRICT', 'SUSPENSION REASON', 'SUSPENDED ON', 'ACTIONS']}>
            {accounts.map((member) => (
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

                {/* SUSPENSION REASON */}
                <td>
                  <span className="ym30-suspension-reason-pill">
                    <AlertCircle size={14} className="ym30-reason-icon" aria-hidden="true" />
                    {member.suspensionReason}
                  </span>
                </td>

                {/* SUSPENDED ON */}
                <td>
                  <span className="ym30-date-text">{formatDate(member.suspendedOn)}</span>
                </td>

                {/* ACTIONS */}
                <td>
                  <div className="ym30-susp-actions-cell">
                    <Link to={`/admin/people/${member.id}`}>
                      <Button variant="outline" className="ym30-susp-view-btn">
                        View details
                      </Button>
                    </Link>

                    <button
                      type="button"
                      className="ym30-btn-restore"
                      onClick={() => setSelectedAccount(member)}
                    >
                      Restore access
                    </button>
                  </div>
                </td>
              </TableRow>
            ))}
          </Table>
        )}

        {/* Pagination Footer */}
        {pagination.total > 0 && (
          <div className="ym30-table-footer-row">
            <p className="ym30-page-count-text">
              Showing {startIndex}-{endIndex} of {pagination.total} accounts
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
                Next ›
              </button>
            </div>
          </div>
        )}
      </ContentCard>

      {/* Confirmation Dialog */}
      {selectedAccount && (
        <ConfirmDialog
          open={Boolean(selectedAccount)}
          title="Restore member access"
          description={`Are you sure you want to restore access for ${selectedAccount.name}? Their login, workspace, and platform operations will be reactivated.`}
          confirmLabel="Restore access"
          busy={restoreBusy}
          onCancel={() => setSelectedAccount(null)}
          onConfirm={handleConfirmRestore}
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
