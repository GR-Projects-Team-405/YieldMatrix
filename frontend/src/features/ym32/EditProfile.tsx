import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api';
import { useAuth, type Role } from '../../context/AuthContext';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge } from '../../components/StatusBadge';
import type {
  UserProfile,
  GetProfileResponse,
  UpdateProfilePayload,
  UpdateProfileResponse,
} from './types';
import {
  ArrowLeft,
  Save,
  Lock,
  ShieldCheck,
  Fingerprint,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import './profile.css';

/** 25 Administrative Districts of Sri Lanka */
const SRI_LANKA_DISTRICTS: string[] = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
];

const DISTRICT_OPTIONS = [
  { value: '', label: 'Select your district' },
  ...SRI_LANKA_DISTRICTS.map((district) => ({
    value: district,
    label: district,
  })),
];

const ROLE_LABELS: Record<Role, string> = {
  farmer: 'Farmer',
  buyer: 'Buyer / Shop',
  driver: 'Driver',
  admin: 'Administrator',
};

/**
 * Validates Sri Lankan telephone numbers:
 * Local format: 10 digits starting with 0 (e.g., 0712345678, 0112345678)
 * International format: +94 followed by 9 digits (e.g., +94712345678)
 */
function isValidSriLankanPhone(phone: string): boolean {
  const sanitized = phone.replace(/[\s\-()]/g, '');
  return /^(?:0[1-9]\d{8}|\+94[1-9]\d{8})$/.test(sanitized);
}

interface FormFieldErrors {
  name?: string;
  phone?: string;
  district?: string;
}

interface FetchError {
  status?: number;
  message: string;
}

export default function EditProfile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Loaded database profile
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<FetchError | null>(null);

  // Baseline database values used for unsaved changes comparison
  const [initialData, setInitialData] = useState<{
    name: string;
    phone: string;
    district: string;
  } | null>(null);

  // Form field states
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [district, setDistrict] = useState<string>('');

  // Submission & validation state
  const [saving, setSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Unsaved changes modal state
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false);

  // Fetch live profile details on mount
  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    setLoadError(null);
    try {
      const { data } = await api.get<GetProfileResponse>('/ym32/profile');
      const p = data.profile;
      setProfile(p);
      const loadedName = p.name || '';
      const loadedPhone = p.phone || '';
      const loadedDistrict = p.district || '';

      setName(loadedName);
      setPhone(loadedPhone);
      setDistrict(loadedDistrict);

      setInitialData({
        name: loadedName,
        phone: loadedPhone,
        district: loadedDistrict,
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setLoadError({
            status,
            message: 'Your authentication session has expired. Please sign in again.',
          });
        } else if (status === 403) {
          setLoadError({
            status,
            message: 'Access forbidden. You do not have permission to edit this profile.',
          });
        } else if (status === 404) {
          setLoadError({
            status,
            message: 'User profile record was not found in the database.',
          });
        } else {
          const serverError = err.response?.data?.error;
          setLoadError({
            status,
            message:
              serverError ||
              'Unable to load profile from the server. Check that the backend is running, then try again.',
          });
        }
      } else {
        setLoadError({
          message: 'An unexpected error occurred while loading profile data.',
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

  // Determine whether any field has been modified compared to loaded database values
  const isDirty = initialData
    ? name.trim() !== initialData.name.trim() ||
      phone.trim() !== initialData.phone.trim() ||
      district !== initialData.district
    : false;

  // Handle Cancel action with unsaved changes confirmation
  const handleCancel = () => {
    const targetRole = profile?.role || user?.role;
    if (isDirty) {
      setShowCancelDialog(true);
    } else {
      navigate(`/${targetRole}/profile`);
    }
  };

  const handleConfirmDiscard = () => {
    setShowCancelDialog(false);
    const targetRole = profile?.role || user?.role;
    navigate(`/${targetRole}/profile`);
  };

  // Form submission: Validate and save via PUT /api/ym32/profile
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return; // Prevent duplicate submissions

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const newErrors: FormFieldErrors = {};

    // 1. Client-side Name validation
    if (!trimmedName) {
      newErrors.name = 'Full name is required and cannot be empty.';
    }

    // 2. Client-side Phone validation
    if (trimmedPhone && !isValidSriLankanPhone(trimmedPhone)) {
      newErrors.phone =
        'Please enter a valid Sri Lankan phone number (e.g. 07XXXXXXXX or +947XXXXXXXX).';
    }

    // 3. Client-side District validation
    if (district && !SRI_LANKA_DISTRICTS.includes(district)) {
      newErrors.district = 'Please select a valid Sri Lankan district.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError(null);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSaving(true);

    const payload: UpdateProfilePayload = {
      name: trimmedName,
      phone: trimmedPhone ? trimmedPhone : null,
      district: district ? district : null,
    };

    try {
      const { data } = await api.put<UpdateProfileResponse>('/ym32/profile', payload);
      if (data?.profile) {
        // Clear dirty state so confirmation modal will not trigger upon navigation
        setInitialData({
          name: data.profile.name,
          phone: data.profile.phone || '',
          district: data.profile.district || '',
        });
        // Navigate back to My Profile page which re-fetches and displays updated DB records
        navigate(`/${data.profile.role}/profile`, { replace: true });
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 422 && err.response?.data?.fields) {
          setErrors(err.response.data.fields);
          setSubmitError(err.response.data.error || 'Please correct the validation errors below.');
        } else if (status === 401) {
          setSubmitError('Authentication session expired. Please sign in again.');
        } else if (status === 403) {
          setSubmitError('Access forbidden. You do not have permission to update this profile.');
        } else if (status === 404) {
          setSubmitError('User record not found in the database.');
        } else {
          setSubmitError(
            err.response?.data?.error || 'Failed to save profile changes. Please try again.'
          );
        }
      } else {
        setSubmitError('An unexpected error occurred while saving profile changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Auth Loading state
  if (authLoading) {
    return (
      <div className="ym32-profile" role="status" aria-busy="true">
        <ContentCard title="Loading Profile" subtitle="Verifying your YieldMatrix session…">
          <p className="loading-state">Checking session authentication, please wait…</p>
        </ContentCard>
      </div>
    );
  }

  // Fallback for unauthenticated access
  if (!user) {
    return (
      <div className="ym32-profile">
        <ContentCard title="Profile Unavailable" subtitle="Authentication required">
          <Alert type="error">You are not currently signed in. Please sign in to edit your profile.</Alert>
          <div className="ym32-error-actions">
            <Button variant="primary" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </div>
        </ContentCard>
      </div>
    );
  }

  // Profile data fetch loading state
  if (loadingProfile) {
    return (
      <div className="ym32-profile" role="status" aria-busy="true">
        <ContentCard title="Loading Profile" subtitle="Retrieving current profile details…">
          <p className="loading-state">Loading profile information, please wait…</p>
        </ContentCard>
      </div>
    );
  }

  // Load error state with retry (no hardcoded fallback)
  if (loadError || !profile) {
    return (
      <div className="ym32-profile">
        <ContentCard
          title="Unable to Load Profile"
          subtitle="There was an issue fetching your profile from the database"
        >
          <Alert type="error">{loadError?.message || 'Failed to retrieve profile record.'}</Alert>
          <div className="ym32-error-actions">
            <Button variant="primary" onClick={fetchProfile} aria-label="Retry loading profile">
              <RotateCcw size={16} aria-hidden="true" />
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/${user.role}/profile`)}
              aria-label="Back to My Profile"
            >
              Back to Profile
            </Button>
          </div>
        </ContentCard>
      </div>
    );
  }

  const roleName = ROLE_LABELS[profile.role] || profile.role;

  return (
    <div className="ym32-profile">
      {/* Edit Profile Header */}
      <ContentCard className="ym32-edit-header-card">
        <div className="ym32-edit-title-group">
          <button
            type="button"
            className="ym32-back-button"
            onClick={handleCancel}
            aria-label="Back to My Profile"
            title="Return to My Profile"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div className="ym32-edit-headings">
            <h2>Edit Profile</h2>
            <p>Update your personal contact details and regional preferences.</p>
          </div>
        </div>

        <StatusBadge status={profile.role} />
      </ContentCard>

      {/* Profile Edit Form */}
      <form onSubmit={handleSubmit} className="ym32-form" noValidate>
        {/* Error Alert */}
        {submitError && (
          <Alert type="error">
            {submitError}
          </Alert>
        )}

        {/* Section 1: Personal Information */}
        <ContentCard
          title="Personal Information"
          subtitle="Update your full name, contact number, and registered district"
        >
          <div className="ym32-form-fields">
            {/* Full Name */}
            <div className="ym32-field-wrapper">
              <InputField
                label="Full Name *"
                id="profile-name"
                value={name}
                disabled={saving}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                error={errors.name}
                placeholder="Enter your full name"
                required
              />
              <span className="ym32-input-hint">Your legal or business display name.</span>
            </div>

            {/* Email Address (Read-only) */}
            <div className="ym32-field-wrapper">
              <InputField
                label="Email Address (Read-only)"
                id="profile-email"
                value={profile.email || ''}
                readOnly
                disabled
                placeholder={profile.email ? undefined : 'Not provided'}
              />
              <span className="ym32-input-hint">
                <Lock size={12} aria-hidden="true" />
                Email address editing is locked until backend verification is supported.
              </span>
            </div>

            {/* Phone Number */}
            <div className="ym32-field-wrapper">
              <InputField
                label="Phone Number"
                id="profile-phone"
                type="tel"
                value={phone}
                disabled={saving}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                error={errors.phone}
                placeholder="e.g. 0771234567 or +94771234567"
              />
              <span className="ym32-input-hint">Sri Lankan mobile or landline number.</span>
            </div>

            {/* District */}
            <div className="ym32-field-wrapper">
              <SelectField
                label="Assigned District"
                id="profile-district"
                options={DISTRICT_OPTIONS}
                value={district}
                disabled={saving}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  if (errors.district) setErrors((prev) => ({ ...prev, district: undefined }));
                }}
                error={errors.district}
              />
              <span className="ym32-input-hint">Your primary regional agricultural district.</span>
            </div>
          </div>
        </ContentCard>

        {/* Section 2: Account Information (Protected & Read-only) */}
        <ContentCard
          title="Account Security & Privileges"
          subtitle="System authorization credentials managed by YieldMatrix administrators"
        >
          <div className="ym32-readonly-banner">
            <Alert type="info">
              Account roles, system identifiers, and verification statuses are protected and cannot be modified.
            </Alert>
          </div>

          <div className="ym32-fields-list">
            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <ShieldCheck size={14} aria-hidden="true" />
                Workspace Role (Read-only)
              </span>
              <span className="ym32-field-value">{roleName}</span>
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <Sparkles size={14} aria-hidden="true" />
                Account Status
              </span>
              <div>
                <StatusBadge status={profile.approval_status} />
              </div>
            </div>

            <div className="ym32-field-item">
              <span className="ym32-field-label">
                <Fingerprint size={14} aria-hidden="true" />
                System User ID
              </span>
              <span className="ym32-field-value ym32-mono">{profile.id}</span>
            </div>
          </div>
        </ContentCard>

        {/* Form Action Buttons */}
        <div className="ym32-form-actions">
          <Button
            variant="outline"
            type="button"
            disabled={saving}
            onClick={handleCancel}
            aria-label="Cancel editing"
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            type="submit"
            disabled={saving}
            aria-label="Save profile changes"
          >
            <Save size={16} aria-hidden="true" />
            {saving ? 'Saving changes…' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmDialog
        open={showCancelDialog}
        title="Discard unsaved changes?"
        description="You have made changes to your profile details. If you leave now, these changes will not be preserved."
        confirmLabel="Discard & Leave"
        onCancel={() => setShowCancelDialog(false)}
        onConfirm={handleConfirmDiscard}
      />
    </div>
  );
}
