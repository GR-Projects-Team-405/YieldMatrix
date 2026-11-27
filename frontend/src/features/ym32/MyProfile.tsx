import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api';
import { useAuth, type Role } from '../../context/AuthContext';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { Alert } from '../../components/Alert';
import type { UserProfile, GetProfileResponse } from './types';
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
  RotateCcw,
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

interface FetchError {
  status?: number;
  message: string;
}

export default function MyProfile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [error, setError] = useState<FetchError | null>(null);

  // Fetch authenticated user profile from GET /api/ym32/profile
  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    setError(null);
    try {
      const { data } = await api.get<GetProfileResponse>('/ym32/profile');
      setProfile(data.profile);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setError({
            status,
            message: 'Your authentication session has expired or is invalid. Please sign in again.',
          });
        } else if (status === 403) {
          setError({
            status,
            message: 'Access forbidden. You do not have permission to access this profile.',
          });
        } else if (status === 404) {
          setError({
            status,
            message: 'User profile record was not found in the database.',
          });
        } else {
          const serverError = err.response?.data?.error;
          setError({
            status,
            message:
              serverError ||
              'Unable to load profile from the server. Check that the backend is running, then try again.',
          });
        }
      } else {
        setError({
          message: 'An unexpected error occurred while loading your profile.',
        });
      }
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  // Loading state when checking authentication session
  if (authLoading) {
    return (
      <div className="ym32-profile" role="status" aria-busy="true">
        <ContentCard title="Loading Profile" subtitle="Verifying your YieldMatrix session…">
          <p className="loading-state">Checking session authentication, please wait…</p>
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
          <div className="ym32-error-actions">
            <Button variant="primary" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </div>
        </ContentCard>
      </div>
    );
  }

  // Loading state while fetching profile from API
  if (loadingProfile) {
    return (
      <div className="ym32-profile" role="status" aria-busy="true">
        <ContentCard title="Loading Profile" subtitle="Retrieving profile details from the database…">
          <p className="loading-state">Loading profile information, please wait…</p>
        </ContentCard>
      </div>
    );
  }

  // Error state when API call fails (no misleading fallback to fake data)
  if (error || !profile) {
    return (
      <div className="ym32-profile">
        <ContentCard
          title="Unable to Load Profile"
          subtitle="There was an issue fetching your profile from the database"
        >
          <Alert type="error">{error?.message || 'Failed to retrieve profile record.'}</Alert>
          <div className="ym32-error-actions">
            <Button variant="primary" onClick={fetchProfile} aria-label="Retry loading profile">
              <RotateCcw size={16} aria-hidden="true" />
              Retry
            </Button>
            {error?.status === 401 && (
              <Button variant="outline" onClick={() => navigate('/login')} aria-label="Go to login">
                Go to Login
              </Button>
            )}
          </div>
        </ContentCard>
      </div>
    );
  }

  const initials = getInitials(profile.name);
  const roleName = ROLE_LABELS[profile.role] || profile.role;

  // Navigate to role-specific edit page (e.g. /farmer/profile/edit)
  const handleEditProfile = () => {
    navigate(`/${profile.role}/profile/edit`);
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
              <h2 className="ym32-name">{profile.name}</h2>
              <StatusBadge status={profile.role} />
            </div>
            <div className="ym32-user-meta">
              <span>
                <ShieldCheck size={14} aria-hidden="true" />
                {roleName} Workspace
              </span>
              <span>•</span>
              <span className="ym32-id-badge" title={`User ID: ${profile.id}`}>
                <Fingerprint size={12} aria-hidden="true" />
                ID: {profile.id.slice(0, 8)}…
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
              <span className="ym32-field-value">{profile.name}</span>
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
                  Not provided
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
                    Unavailable
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
                  Unavailable
                </span>
              )}
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <Fingerprint size={14} aria-hidden="true" />
                System User ID
              </span>
              <span className="ym32-field-value ym32-mono" title={profile.id}>
                {profile.id}
              </span>
            </div>
          </div>

          <div className="ym32-sync-hint">
            <Alert type="info">
              Account status and role privileges are verified directly from backend database records.
            </Alert>
          </div>
        </ContentCard>
      </div>
    </div>
  );
}
