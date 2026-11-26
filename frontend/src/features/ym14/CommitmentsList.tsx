import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Alert } from '../../components/Alert';
import type { CommitmentListItem, CommitmentStats, CommitmentStatus } from './types';

type FilterTab = 'all' | 'accepted' | 'change_pending' | 'ready_to_fulfil' | 'fulfilled' | 'cancelled';

export default function CommitmentsList() {
  const { user } = useAuth();

  const [commitments, setCommitments] = useState<CommitmentListItem[]>([]);
  const [stats, setStats] = useState<CommitmentStats>({
    activeCount: 0,
    committedKg: 0,
    heldInEscrowCents: 0,
    actionRequiredCount: 0,
  });
  const [tabCounts, setTabCounts] = useState({
    all: 0,
    accepted: 0,
    change_pending: 0,
    ready_to_fulfil: 0,
    fulfilled: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const pageSize = 6;

  // Load live commitments from PostgreSQL-backed API
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await api.get('/ym14/commitments', {
          params: {
            status: activeTab,
            search: searchQuery,
            page: currentPage,
            limit: pageSize,
          },
        });
        if (mounted && res.data) {
          setCommitments(Array.isArray(res.data.commitments) ? res.data.commitments : []);
          if (res.data.stats) setStats(res.data.stats);
          if (res.data.tabCounts) setTabCounts(res.data.tabCounts);
          if (res.data.pagination) {
            setPagination({
              total: res.data.pagination.total ?? 0,
              totalPages: res.data.pagination.totalPages || 1,
            });
          }
        }
      } catch (_err) {
        if (mounted) {
          setCommitments([]);
          setPagination({ total: 0, totalPages: 1 });
          setErrorMsg('Unable to load commitments from the database. Please verify the backend API connection.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [activeTab, searchQuery, currentPage]);

  const uniqueCropsCount =
    stats.uniqueCropsCount ?? new Set(commitments.map((c) => c.cropName)).size;

  const totalPages = pagination.totalPages || 1;
  const totalCount = pagination.total;
  const paginatedItems = commitments;

  const getStatusText = (status: CommitmentStatus) => {
    switch (status) {
      case 'ready_to_fulfil':
        return 'Ready to fulfil';
      case 'change_pending':
        return 'Change pending';
      case 'accepted':
        return 'Accepted';
      case 'proposed':
        return 'Proposed';
      case 'fulfilled':
        return 'Fulfilled';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const rolePrefix = user?.role === 'farmer' ? '/farmer' : '/buyer';

  return (
    <div className="ym14-container">
      {/* Top Header */}
      <div className="ym14-top-bar" style={{ marginBottom: '16px' }}>
        <div>
          <div className="ym14-title-row">
            <h1>Produce Commitments</h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '4px' }}>
            Manage forward contracts, harvest timelines, and fulfillment handovers.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div style={{ marginBottom: '16px' }}>
          <Alert type="error">{errorMsg}</Alert>
        </div>
      )}

      {/* 4 StatCards Bar */}
      <div className="ym14-stats-bar">
        <StatCard
          label="Active Commitments"
          value={String(stats.activeCount).padStart(2, '0')}
          subtext={`${tabCounts.accepted + tabCounts.ready_to_fulfil} scheduled for harvest`}
        />
        <StatCard
          label="Committed Volume"
          value={`${stats.committedKg.toLocaleString()} kg`}
          subtext={uniqueCropsCount > 0 ? `Across ${uniqueCropsCount} crop varieties` : 'No active crop volume'}
        />
        <StatCard
          label="Held in Escrow"
          value={`LKR ${(stats.heldInEscrowCents / 100).toLocaleString()}`}
          subtext="Secured via Agri Wallet"
        />
        <StatCard
          label="Action Required"
          value={String(stats.actionRequiredCount).padStart(2, '0')}
          subtext={
            stats.actionRequiredCount > 0
              ? `${stats.actionRequiredCount} harvest modification pending review`
              : 'No pending change requests'
          }
          highlight={stats.actionRequiredCount > 0}
        />
      </div>

      {/* Search and Filter Tabs */}
      <div className="ym14-filters-row">
        {/* Search Input */}
        <div className="ym14-search-box">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Filter by ID, supplier, crop..."
            aria-label="Filter commitments"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Filter Pills */}
        <div className="ym14-filter-tabs" role="tablist" aria-label="Commitment status filters">
          <button
            type="button"
            className={`ym14-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
          >
            All ({String(tabCounts.all).padStart(2, '0')})
          </button>
          <button
            type="button"
            className={`ym14-tab-btn ${activeTab === 'accepted' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('accepted');
              setCurrentPage(1);
            }}
          >
            Accepted ({String(tabCounts.accepted).padStart(2, '0')})
          </button>
          <button
            type="button"
            className={`ym14-tab-btn ${activeTab === 'change_pending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('change_pending');
              setCurrentPage(1);
            }}
          >
            Change Pending ({String(tabCounts.change_pending).padStart(2, '0')})
          </button>
          <button
            type="button"
            className={`ym14-tab-btn ${activeTab === 'ready_to_fulfil' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('ready_to_fulfil');
              setCurrentPage(1);
            }}
          >
            Ready to Fulfil ({String(tabCounts.ready_to_fulfil).padStart(2, '0')})
          </button>
          <button
            type="button"
            className={`ym14-tab-btn ${activeTab === 'fulfilled' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('fulfilled');
              setCurrentPage(1);
            }}
          >
            Fulfilled ({String(tabCounts.fulfilled).padStart(2, '0')})
          </button>
          <button
            type="button"
            className={`ym14-tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('cancelled');
              setCurrentPage(1);
            }}
          >
            Cancelled ({String(tabCounts.cancelled).padStart(2, '0')})
          </button>
        </div>
      </div>

      {/* Commitments Table */}
      <div className="ym-content-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="ym-table-scroll">
          <table className="ym-table" aria-label="Produce Commitments Table">
            <thead>
              <tr>
                <th>Commitment ID</th>
                <th>Supplier</th>
                <th>Crop &amp; Grade</th>
                <th>Expected Kg</th>
                <th>Agreed Price</th>
                <th>Harvest Window</th>
                <th>Status</th>
                <th>Change Pending</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                    Loading produce commitments from database…
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                    No commitments found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((c) => (
                  <tr key={c.id} className="ym-table-row">
                    <td style={{ fontWeight: 600 }}>{c.reference}</td>
                    <td>{c.supplierName}</td>
                    <td>
                      {c.cropName} • {c.grade}
                    </td>
                    <td>{c.expectedKg.toLocaleString()} kg</td>
                    <td>LKR {(c.agreedPricePerKgCents / 100).toFixed(2)} / kg</td>
                    <td>{c.harvestWindow}</td>
                    <td>
                      <StatusBadge status={getStatusText(c.status)} />
                    </td>
                    <td>
                      {c.changePending ? (
                        <span style={{ color: '#b42318', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span aria-hidden="true">⚠️</span> Review Req.
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>— None</span>
                      )}
                    </td>
                    <td>
                      {c.actionType === 'review_change' && user?.role !== 'farmer' ? (
                        <Link
                          to={`${rolePrefix}/commitments/${c.id}/change-review`}
                          style={{ color: '#b56208', fontWeight: 600, textDecoration: 'none' }}
                        >
                          Review Change
                        </Link>
                      ) : c.actionType === 'view_archive' ? (
                        <Link
                          to={`${rolePrefix}/commitments/${c.id}`}
                          style={{ color: 'var(--muted)', fontWeight: 500, textDecoration: 'none' }}
                        >
                          View Archive
                        </Link>
                      ) : (
                        <Link
                          to={`${rolePrefix}/commitments/${c.id}`}
                          style={{ color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}
                        >
                          View Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderTop: '1px solid var(--border)',
            fontSize: '13px',
            color: 'var(--muted)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span>
            Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-
            {Math.min((currentPage - 1) * pageSize + paginatedItems.length, totalCount)} of {totalCount} commitments • Filters preserved across page navigation
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                style={{
                  minWidth: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: currentPage === page ? 'var(--green)' : 'var(--surface)',
                  color: currentPage === page ? '#ffffff' : 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
