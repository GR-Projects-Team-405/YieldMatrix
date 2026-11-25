import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import type { CommitmentListItem, CommitmentStats, CommitmentStatus } from './types';

// Fallback mock commitments list matching Figma YM14_03
const defaultMockCommitments: CommitmentListItem[] = [
  {
    id: 'c1042',
    reference: 'COM-1042',
    supplierName: 'Highland Harvest',
    cropName: 'Tomato',
    grade: 'Grade A',
    expectedKg: 1000.0,
    agreedPricePerKgCents: 18425, // LKR 184.25
    harvestWindow: '12 - 14 Nov 2026',
    status: 'ready_to_fulfil',
    changePending: false,
    actionType: 'view_details',
  },
  {
    id: 'c1041',
    reference: 'COM-1041',
    supplierName: 'Green Valley Farm',
    cropName: 'Carrot',
    grade: 'Grade A',
    expectedKg: 600.0,
    agreedPricePerKgCents: 22000, // LKR 220.00
    harvestWindow: '10 - 11 Nov 2026',
    status: 'change_pending',
    changePending: true,
    actionType: 'review_change',
  },
  {
    id: 'c1039',
    reference: 'COM-1039',
    supplierName: 'Welimada Co-op',
    cropName: 'Cabbage',
    grade: 'Grade B',
    expectedKg: 1200.0,
    agreedPricePerKgCents: 13000, // LKR 130.00
    harvestWindow: '15 - 17 Nov 2026',
    status: 'accepted',
    changePending: false,
    actionType: 'view_details',
  },
  {
    id: 'c1036',
    reference: 'COM-1036',
    supplierName: 'Nuwara Eliya Farms',
    cropName: 'Leeks',
    grade: 'Grade A',
    expectedKg: 850.0,
    agreedPricePerKgCents: 17000, // LKR 170.00
    harvestWindow: '16 - 18 Nov 2026',
    status: 'proposed',
    changePending: false,
    actionType: 'view_details',
  },
  {
    id: 'c1030',
    reference: 'COM-1030',
    supplierName: 'Dambulla Growers',
    cropName: 'Red Onion',
    grade: 'Grade A',
    expectedKg: 2800.0,
    agreedPricePerKgCents: 20000, // LKR 200.00
    harvestWindow: '01 - 03 Nov 2026',
    status: 'fulfilled',
    changePending: false,
    actionType: 'view_archive',
  },
  {
    id: 'c1025',
    reference: 'COM-1025',
    supplierName: 'Kandy Valley Agris',
    cropName: 'Bell Pepper',
    grade: 'Grade A',
    expectedKg: 500.0,
    agreedPricePerKgCents: 31000, // LKR 310.00
    harvestWindow: '25 - 28 Oct 2026',
    status: 'cancelled',
    changePending: false,
    actionType: 'view_archive',
  },
  {
    id: 'c1020',
    reference: 'COM-1020',
    supplierName: 'Ella Organic Fields',
    cropName: 'Potatoes',
    grade: 'Grade A',
    expectedKg: 1500.0,
    agreedPricePerKgCents: 24000,
    harvestWindow: '20 - 22 Nov 2026',
    status: 'accepted',
    changePending: false,
    actionType: 'view_details',
  },
  {
    id: 'c1018',
    reference: 'COM-1018',
    supplierName: 'Matale Spice & Veg',
    cropName: 'Green Chilli',
    grade: 'Grade B',
    expectedKg: 400.0,
    agreedPricePerKgCents: 45000,
    harvestWindow: '18 - 20 Nov 2026',
    status: 'ready_to_fulfil',
    changePending: false,
    actionType: 'view_details',
  },
];

const defaultStats: CommitmentStats = {
  activeCount: 8,
  committedKg: 6450,
  heldInEscrowCents: 118025000, // LKR 1,180,250
  actionRequiredCount: 1,
};

type FilterTab = 'all' | 'accepted' | 'change_pending' | 'ready_to_fulfil' | 'fulfilled' | 'cancelled';

export default function CommitmentsList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [commitments, setCommitments] = useState<CommitmentListItem[]>([]);
  const [stats, setStats] = useState<CommitmentStats>({
    activeCount: 0,
    committedKg: 0,
    heldInEscrowCents: 0,
    actionRequiredCount: 0,
  });
  const [tabCounts, setTabCounts] = useState({
    all: 8,
    accepted: 2,
    change_pending: 1,
    ready_to_fulfil: 2,
    fulfilled: 1,
    cancelled: 1,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Load from backend API with fallback
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const res = await api.get('/ym14/commitments', {
          params: {
            status: activeTab,
            search: searchQuery,
            page: currentPage,
            limit: pageSize,
          },
        });
        if (mounted && res.data?.commitments) {
          setCommitments(res.data.commitments);
          if (res.data.stats) setStats(res.data.stats);
          if (res.data.tabCounts) setTabCounts(res.data.tabCounts);
        }
      } catch (_err) {
        // Fallback to local fixtures if backend is unreachable
        if (mounted) {
          setCommitments(defaultMockCommitments);
          setStats(defaultStats);
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

  // Client-side filtering when working with mock fallback
  const filteredItems = useMemo(() => {
    let list = [...commitments];
    if (activeTab !== 'all') {
      list = list.filter((c) => c.status === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.reference.toLowerCase().includes(q) ||
          c.supplierName.toLowerCase().includes(q) ||
          c.cropName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [commitments, activeTab, searchQuery]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

      {/* 4 StatCards Bar */}
      <div className="ym14-stats-bar">
        <StatCard
          label="Active Commitments"
          value={String(stats.activeCount).padStart(2, '0')}
          subtext="3 awaiting harvest schedule"
        />
        <StatCard
          label="Committed Volume"
          value={`${stats.committedKg.toLocaleString()} kg`}
          subtext="Across 4 crop varieties"
        />
        <StatCard
          label="Held in Escrow"
          value={`LKR ${(stats.heldInEscrowCents / 100).toLocaleString()}`}
          subtext="Secured via Agri Wallet"
        />
        <StatCard
          label="Action Required"
          value={String(stats.actionRequiredCount).padStart(2, '0')}
          subtext="1 harvest modification pending review"
          highlight
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
                      {c.actionType === 'review_change' ? (
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
            {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} commitments • Filters preserved across page navigation
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
