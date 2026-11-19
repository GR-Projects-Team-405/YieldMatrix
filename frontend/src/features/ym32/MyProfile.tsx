import { useNavigate } from 'react-router-dom';
import { useAuth, type Role } from '../../context/AuthContext';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { Alert } from '../../components/Alert';
import {
  UserRound,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Calendar,
  Pencil,
  Fingerprint,
  Clock,
  Sparkles,
} from 'lucide-react';
import './profile.css';

/** Human-readable labels for workspace roles */
const ROLE_LABELS: Record<Role, string> = {
  farmer: 'Farmer',
  buyer: 'Buyer / Shop',
  driver: 'Driver',
  admin: 'Administrator',
};

/** Generates up to two initials from the user's display name */
function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'YM';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Interface for optional profile fields not yet bundled in demo AuthContext */
export interface ExtendedProfileFields {
  email?: string | null;
  phone?: string | null;
  district?: string | null;
  approval_status?: string | null;
  created_at?: string | null;
}

export default function MyProfile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Loading state when checking authentication session
  if (loading) {
    return (
      <div className="ym32-profile" role="status" aria-busy="true">
        <ContentCard title="Loading Profile" subtitle="Verifying your YieldMatrix session…">
          <p className="loading-state">Checking profile records, please wait…</p>
        </ContentCard>
      </div>
    );
  }

  // Unavailable authentication state
  if (!user) {
    return (
      <div className="ym32-profile">
        <ContentCard title="Profile Unavailable" subtitle="Authentication required">
          <Alert type="error">You are not currently signed in. Please sign in to access your profile.</Alert>
          <div style={{ marginTop: '16px' }}>
            <Button variant="primary" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </div>
        </ContentCard>
      </div>
    );
  }

  // Safe cast for potential future extensions to the user object
  const profile = (user as unknown as ExtendedProfileFields) || {};

  const initials = getInitials(user.name);
  const roleName = ROLE_LABELS[user.role] || user.role;

  // Navigate to role-specific edit page (e.g. /farmer/profile/edit)
  const handleEditProfile = () => {
    navigate(`/${user.role}/profile/edit`);
  };

  return (
    <div className="ym32-profile">
      {/* 1. Profile Header Card */}
      <ContentCard className="ym32-header-card">
        <div className="ym32-header-left">
          <div className="ym32-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="ym32-header-info">
            <div className="ym32-header-title-row">
              <h2 className="ym32-name">{user.name}</h2>
              <StatusBadge status={user.role} />
            </div>
            <div className="ym32-user-meta">
              <span>
                <ShieldCheck size={14} aria-hidden="true" />
                {roleName} Workspace
              </span>
              <span>•</span>
              <span className="ym32-id-badge" title={`User ID: ${user.id}`}>
                <Fingerprint size={12} aria-hidden="true" />
                ID: {user.id.slice(0, 8)}…
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleEditProfile}
          aria-label="Edit Profile"
        >
          <Pencil size={16} aria-hidden="true" />
          Edit Profile
        </Button>
      </ContentCard>

      {/* 2 & 3. Information Grid */}
      <div className="ym32-sections-grid">
        {/* Personal Information Section */}
        <ContentCard
          title="Personal Information"
          subtitle="Your primary contact details and identity information"
        >
          <div className="ym32-fields-list">
            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <UserRound size={14} aria-hidden="true" />
                Full Name
              </span>
              <span className="ym32-field-value">{user.name}</span>
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <Mail size={14} aria-hidden="true" />
                Email Address
              </span>
              {profile.email ? (
                <span className="ym32-field-value">{profile.email}</span>
              ) : (
                <span className="ym32-unavailable">
                  <Clock size={13} aria-hidden="true" />
                  Unavailable (Not synced)
                </span>
              )}
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <Phone size={14} aria-hidden="true" />
                Phone Number
              </span>
              {profile.phone ? (
                <span className="ym32-field-value">{profile.phone}</span>
              ) : (
                <span className="ym32-unavailable">
                  <Clock size={13} aria-hidden="true" />
                  Not provided
                </span>
              )}
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <MapPin size={14} aria-hidden="true" />
                Assigned District
              </span>
              {profile.district ? (
                <span className="ym32-field-value">{profile.district}</span>
              ) : (
                <span className="ym32-unavailable">
                  <Clock size={13} aria-hidden="true" />
                  Not provided
                </span>
              )}
            </div>
          </div>

          <div className="ym32-sync-hint">
            <Alert type="info">
              Personal contact details reflect your registered identity across the YieldMatrix network.
            </Alert>
          </div>
        </ContentCard>

        {/* Account Information Section */}
        <ContentCard
          title="Account Information"
          subtitle="Platform credentials, authorization level, and verification status"
        >
          <div className="ym32-fields-list">
            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <ShieldCheck size={14} aria-hidden="true" />
                Assigned Role
              </span>
              <span className="ym32-field-value">{roleName}</span>
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <Sparkles size={14} aria-hidden="true" />
                Account Status
              </span>
              <div>
                {profile.approval_status ? (
                  <StatusBadge status={profile.approval_status} />
                ) : (
                  <span className="ym32-unavailable">
                    <Clock size={13} aria-hidden="true" />
                    Unavailable (Pending verification)
                  </span>
                )}
              </div>
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <Calendar size={14} aria-hidden="true" />
                Member Since
              </span>
              {profile.created_at ? (
                <span className="ym32-field-value">
                  {new Date(profile.created_at).toLocaleDateString()}
                </span>
              ) : (
                <span className="ym32-unavailable">
                  <Clock size={13} aria-hidden="true" />
                  Unavailable (Session auth)
                </span>
              )}
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <Fingerprint size={14} aria-hidden="true" />
                System User ID
              </span>
              <span className="ym32-field-value ym32-mono" title={user.id}>
                {user.id}
              </span>
            </div>
          </div>

          <div className="ym32-sync-hint">
            <Alert type="info">
              Account verification status and system privileges will reflect verified database records upon backend synchronization.
            </Alert>
          </div>
        </ContentCard>
      </div>
    </div>
  );
}
