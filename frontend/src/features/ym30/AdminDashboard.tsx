import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Table, TableRow } from '../../components/Table';

// YM30 · Yugen Suresh · Admin Dashboard

interface DashboardStats {
  approvedMembers: number;
  activeOrders: number;
  openIncidents: number;
  acceptedTradeCents: number;
}

interface AttentionItem {
  label: string;
  sublabel: string;
  count: number;
}

interface ParticipationItem {
  role: string;
  count: number;
}

interface ReviewItem {
  id: string;
  reference: string;
  category: string;
  priority: string;
  assignedTo: string;
  status: string;
}

interface RecentMember {
  id: string;
  name: string;
  email: string;
  role: string;
  district: string;
  approvalStatus: string;
  createdAt: string;
}

function formatLKR(cents: number): string {
  if (cents >= 100_000_000) return `LKR ${(cents / 100_000_000).toFixed(2)}M`;
  if (cents >= 100_000) return `LKR ${(cents / 100_000).toFixed(0)}K`;
  return `LKR ${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [participation, setParticipation] = useState<ParticipationItem[]>([]);
  const [pendingReview, setPendingReview] = useState<ReviewItem[]>([]);
  const [recentMembers, setRecentMembers] = useState<RecentMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    api.get<{
      stats: DashboardStats;
      attention: AttentionItem[];
      participation: { totalApproved: number; roles: ParticipationItem[]; awaitingReview: number };
      recentMembers: RecentMember[];
      pendingReview: ReviewItem[];
    }>('/ym30/dashboard', { signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        setStats(data.stats);
        setAttention(data.attention);
        setParticipation(data.participation.roles);
        setRecentMembers(data.recentMembers);
        setPendingReview(data.pendingReview);
      })
      .catch(() => {
        if (active) setError('Could not load dashboard data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; controller.abort(); };
  }, []);

  if (loading) return <p role="status" className="loading-state">Loading dashboard…</p>;
  if (error) return <Alert type="error">{error}</Alert>;

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });

  return (
    <div className="ym30-dashboard">
      {/* Hero heading */}
      <div className="ym30-hero">
        <div>
          <h2 className="ym30-hero-title">Your network, at a glance.</h2>
          <p className="ym30-hero-subtitle">Keep growers, buyers and deliveries moving with confidence.</p>
        </div>
        <div className="ym30-hero-actions">
          <Link to="/admin/people/approvals">
            <Button variant="secondary">Review approvals ↗</Button>
          </Link>
          <Link to="/admin/orders">
            <Button variant="primary">Open operations ↗</Button>
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="ym30-section-label">
        <span className="ym30-badge-label">ADMIN DASHBOARD</span>
        <span className="ym30-date-label">{today}</span>
      </div>
      <div className="ym30-stats-grid">
        <StatCard label="APPROVED MEMBERS" value={stats?.approvedMembers ?? 0} subtext="Farmers and trading roles" />
        <StatCard label="ACTIVE ORDERS" value={stats?.activeOrders ?? 0} subtext="In fulfilment pipeline" />
        <StatCard label="OPEN INCIDENTS" value={stats?.openIncidents ?? 0} subtext="Needs reviewing today" />
        <StatCard label="ACCEPTED TRADE" value={formatLKR(stats?.acceptedTradeCents ?? 0)} subtext="Last 30 days · simulated" />
      </div>

      {/* Middle row: banner + attention */}
      <div className="ym30-middle-row">
        <div className="ym30-banner-card">
          <p className="ym30-banner-label">CONNECTED HARVESTS</p>
          <h3 className="ym30-banner-title">A stronger harvest network.</h3>
          <p className="ym30-banner-desc">Focus on the decisions that keep the entire network healthy.</p>
          <Link to="/admin/incidents">
            <Button variant="secondary">Review exceptions ↗</Button>
          </Link>
        </div>
        <ContentCard title="Needs your attention" className="ym30-attention-card">
          <div className="ym30-attention-list">
            {attention.map((item) => {
              const isApprovals = item.label.toLowerCase().includes('approval');
              const content = (
                <div className="ym30-attention-item">
                  <div>
                    <p className="ym30-attention-label">{item.label}</p>
                    <p className="ym30-attention-sublabel">{item.sublabel}</p>
                  </div>
                  <span className="ym30-attention-count">{String(item.count).padStart(2, '0')}</span>
                </div>
              );

              if (isApprovals) {
                return (
                  <Link key={item.label} to="/admin/people/approvals" className="ym30-attention-link">
                    {content}
                  </Link>
                );
              }
              return <div key={item.label}>{content}</div>;
            })}
          </div>
        </ContentCard>
      </div>

      {/* Participation overview */}
      <ContentCard title="Participation overview" subtitle={`${stats?.approvedMembers ?? 0} approved members · all regions`} className="ym30-participation-card">
        <div className="ym30-participation-list">
          {participation.map((p) => (
            <div key={p.role} className="ym30-participation-row">
              <span className="ym30-participation-role">{p.role === 'farmer' ? 'Farmers' : p.role === 'buyer' ? 'Buyers / shops' : p.role === 'driver' ? 'Drivers' : 'Admins'}</span>
              <span className="ym30-participation-count">{p.count}</span>
            </div>
          ))}
        </div>
        <Link to="/admin/people/approvals" className="ym30-link-inline">
          <Alert type="warning">
            {attention.find((a) => a.label.toLowerCase().includes('approval'))?.count ?? 12} accounts awaiting review
          </Alert>
        </Link>
      </ContentCard>

      {/* Recent members */}
      <ContentCard title="Recent registrations" className="ym30-recent-card">
        {recentMembers.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No recent registrations.</p>
        ) : (
          <Table headers={['Name', 'Role', 'District', 'Status', 'Registered', '']}>
            {recentMembers.map((member) => (
              <TableRow key={member.id}>
                <td>
                  <div>
                    <strong>{member.name}</strong>
                    <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{member.email}</p>
                  </div>
                </td>
                <td><StatusBadge status={member.role} /></td>
                <td>{member.district || '—'}</td>
                <td><StatusBadge status={member.approvalStatus} /></td>
                <td>{formatDate(member.createdAt)}</td>
                <td>
                  <Link to={`/admin/people/${member.id}`}>
                    <Button variant="outline" className="ym30-view-btn">View</Button>
                  </Link>
                </td>
              </TableRow>
            ))}
          </Table>
        )}
        <div className="ym30-table-footer">
          <Link to="/admin/people/approvals">
            <Button variant="outline">View approval requests →</Button>
          </Link>
        </div>
      </ContentCard>

      {/* Operations review queue */}
      <ContentCard title="Operations review queue">
        {pendingReview.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No items pending review.</p>
        ) : (
          <Table headers={['Order / Issue', 'Category', 'Priority', 'Assigned to', 'Status']}>
            {pendingReview.map((item) => (
              <TableRow key={item.id}>
                <td>{item.reference}</td>
                <td>{item.category}</td>
                <td>{item.priority}</td>
                <td>{item.assignedTo}</td>
                <td><StatusBadge status={item.status} /></td>
              </TableRow>
            ))}
          </Table>
        )}
      </ContentCard>
    </div>
  );
}
