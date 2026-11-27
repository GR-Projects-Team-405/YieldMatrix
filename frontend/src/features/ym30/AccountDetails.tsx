import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { PeopleSubNav } from './PeopleSubNav';

// YM30 · Yugen Suresh · Page 01 - Account Details
// Dedicated separate page for member account details, profile, role access, and activity.
// WorkspaceLayout provides the sidebar and topbar.

interface AccountInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  district: string | null;
  approvalStatus: string;
  createdAt: string;
}

interface ActivityEvent {
  id: string;
  action: string;
  description: string;
  occurredAt: string;
}

interface MemberOption {
  id: string;
  name: string;
  role: string;
  approvalStatus: string;
}

const DEFAULT_ACCOUNT_ID = '10480000-0000-0000-0000-000000001048'; // Kasuni Silva (YM-1048)

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' })
    + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Colombo' });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAccountIdShort(id: string): string {
  const segment = id.split('-')[0] ?? id.slice(0, 8);
  return `YM-${parseInt(segment.slice(0, 4), 16) % 10000}`;
}

function getAccessLabel(status: string): string {
  if (status === 'approved') return 'Active';
  if (status === 'pending') return 'Restricted until approval';
  if (status === 'suspended') return 'Suspended';
  if (status === 'rejected') return 'Rejected';
  return status;
}

function getAccessTone(status: string): string {
  if (status === 'approved') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'suspended' || status === 'rejected') return 'error';
  return 'neutral';
}

function isAccessEnabled(status: string): boolean {
  return status === 'approved';
}

export default function AccountDetails() {
  const { accountId: paramAccountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const isSpecial = !paramAccountId || paramAccountId === 'account' || paramAccountId === 'account-details';
  const activeAccountId = isSpecial ? DEFAULT_ACCOUNT_ID : paramAccountId;

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch available members for switcher dropdown
  useEffect(() => {
    let active = true;
    api.get<{ requests: AccountInfo[] }>('/ym30/approvals', { params: { limit: 20, status: 'all' } })
      .then(({ data }) => {
        if (!active) return;
        setMemberOptions(
          data.requests.map((r) => ({
            id: r.id,
            name: r.name,
            role: r.role,
            approvalStatus: r.approvalStatus,
          }))
        );
      })
      .catch(() => {});

    return () => { active = false; };
  }, []);

  // Fetch account details for activeAccountId
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);

    api.get<{ account: AccountInfo; activity: ActivityEvent[] }>(`/ym30/accounts/${activeAccountId}`, { signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        setAccount(data.account);
        setActivity(data.activity);
        setError('');
      })
      .catch((err) => {
        if (active) {
          if (err.response?.status === 404) setError('Account not found.');
          else setError('Could not load account details.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; controller.abort(); };
  }, [activeAccountId]);

  if (loading) return <p role="status" className="loading-state">Loading account details…</p>;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!account) return <Alert type="error">No account data available.</Alert>;

  const roleName = account.role.charAt(0).toUpperCase() + account.role.slice(1);
  const shortId = getAccountIdShort(account.id);
  const accessLabel = getAccessLabel(account.approvalStatus);
  const accessTone = getAccessTone(account.approvalStatus);
  const enabled = isAccessEnabled(account.approvalStatus);

  return (
    <div className="ym30-account-details">
      {/* 02 Sub sections navigation bar */}
      <PeopleSubNav />

      {/* Top action row: member switcher and approvals shortcut */}
      <div className="ym30-member-switcher-row">
        <div className="ym30-switcher-wrap">
          <label htmlFor="ym30-member-select" className="ym30-switcher-label">
            Switch member:
          </label>
          <select
            id="ym30-member-select"
            value={account.id}
            onChange={(e) => {
              navigate(`/admin/people/${e.target.value}`);
            }}
            className="ym30-switcher-select"
          >
            {memberOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} ({getAccountIdShort(opt.id)} · {opt.role} · {opt.approvalStatus})
              </option>
            ))}
          </select>
        </div>

        <Link to="/admin/people/approvals">
          <Button variant="outline" className="ym30-approvals-shortcut-btn">
            View Approval Requests →
          </Button>
        </Link>
      </div>

      {/* Page header with status badge */}
      <div className="ym30-detail-header">
        <div className="ym30-detail-header-left">
          <h2 className="ym30-detail-title">Account details</h2>
          <StatusBadge status={account.approvalStatus === 'pending' ? 'Pending approval' : account.approvalStatus} />
        </div>
        <p className="ym30-detail-subtitle">View this member's information and account access.</p>
        <div className="ym30-detail-id-badge">
          <span>Illustrative demo account</span>
          <span> · ID {shortId}</span>
        </div>
      </div>

      {/* Profile card */}
      <div className="ym30-profile-banner">
        <div className="ym30-avatar">{getInitials(account.name)}</div>
        <div className="ym30-profile-info">
          <div className="ym30-profile-name-row">
            <h3 className="ym30-profile-name">{account.name}</h3>
            <StatusBadge status={roleName} />
            <StatusBadge status={account.approvalStatus === 'pending' ? 'Pending approval' : account.approvalStatus} />
          </div>
          <p className="ym30-profile-meta">
            ✉ {account.email} · {shortId}
          </p>
        </div>
        <div className="ym30-profile-right">
          <div className="ym30-profile-field">
            <span className="ym30-profile-field-label">Registration date</span>
            <strong>{formatDate(account.createdAt)}</strong>
          </div>
          <div className="ym30-profile-field">
            <span className="ym30-profile-field-label">District</span>
            <strong>{account.district || '—'}</strong>
          </div>
        </div>
      </div>

      {/* Two column info */}
      <div className="ym30-info-grid">
        {/* Personal information */}
        <ContentCard className="ym30-info-card">
          <div className="ym30-info-card-header">
            <h3>👤 Personal information</h3>
            <Button variant="outline" className="ym30-edit-btn">✎ Edit details</Button>
          </div>
          <div className="ym30-info-rows">
            <div className="ym30-info-row">
              <span className="ym30-info-label">Full name</span>
              <span className="ym30-info-value">{account.name}</span>
            </div>
            <div className="ym30-info-row">
              <span className="ym30-info-label">Email address</span>
              <span className="ym30-info-value">{account.email}</span>
            </div>
            <div className="ym30-info-row">
              <span className="ym30-info-label">Phone number</span>
              <span className="ym30-info-value">{account.phone || '—'}</span>
            </div>
            <div className="ym30-info-row">
              <span className="ym30-info-label">District</span>
              <span className="ym30-info-value">{account.district || '—'}</span>
            </div>
            <div className="ym30-info-row">
              <span className="ym30-info-label">Registration date</span>
              <span className="ym30-info-value">{formatDate(account.createdAt)}</span>
            </div>
            <div className="ym30-info-row">
              <span className="ym30-info-label">Account ID</span>
              <span className="ym30-info-value">{shortId}</span>
            </div>
          </div>
          <p className="ym30-info-note">Illustrative demo profile data for administrative review.</p>
        </ContentCard>

        {/* Role and access */}
        <ContentCard className="ym30-info-card">
          <div className="ym30-info-card-header">
            <h3>✓ Role and access</h3>
            <span className={`ym30-access-badge ym30-access-badge--${accessTone}`}>{enabled ? 'Active' : 'Restricted'}</span>
          </div>
          <div className="ym30-access-fields">
            <div className="ym30-access-pill-row">
              <div className="ym30-access-pill">
                <span className="ym30-access-pill-label">Assigned role</span>
                <strong>{roleName}</strong>
              </div>
              <div className="ym30-access-pill">
                <span className="ym30-access-pill-label">Access status</span>
                <strong className={`ym30-text-${accessTone}`}>{accessLabel}</strong>
              </div>
            </div>
            <div className="ym30-access-items">
              <div className="ym30-access-item">
                <span>{roleName} workspace</span>
                <span className="ym30-access-status">{enabled ? '✓ Enabled' : '🔒 Not yet enabled'}</span>
              </div>
              <div className="ym30-access-item">
                <span>Marketplace participation</span>
                <span className="ym30-access-status">{enabled ? '✓ Enabled' : '🔒 Not yet enabled'}</span>
              </div>
              <div className="ym30-access-item">
                <span>Wallet access</span>
                <span className="ym30-access-status">{enabled ? '✓ Enabled' : '🔒 Not yet enabled'}</span>
              </div>
            </div>
          </div>
          <Alert type={account.approvalStatus === 'approved' ? 'success' : 'warning'}>
            Account access is determined by approval status and assigned role.
          </Alert>
        </ContentCard>
      </div>

      {/* Recent account activity */}
      <ContentCard className="ym30-activity-card">
        <div className="ym30-activity-header">
          <h3>⚙ Recent account activity</h3>
          <span className="ym30-activity-count">Timeline · {activity.length} events recorded</span>
        </div>
        {activity.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14, padding: '16px 0' }}>No activity recorded yet.</p>
        ) : (
          <div className="ym30-timeline">
            {activity.map((event, idx) => (
              <div key={event.id} className="ym30-timeline-item">
                <div className="ym30-timeline-dot-col">
                  <span className={`ym30-timeline-dot ${idx === 0 ? 'ym30-timeline-dot--latest' : ''}`} />
                  {idx < activity.length - 1 && <span className="ym30-timeline-line" />}
                </div>
                <div className="ym30-timeline-content">
                  <strong>{event.action}</strong>
                  <p>{event.description}</p>
                </div>
                <span className="ym30-timeline-date">{formatDateTime(event.occurredAt)}</span>
              </div>
            ))}
          </div>
        )}
      </ContentCard>
    </div>
  );
}
