import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type Role } from '../../context/AuthContext';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge } from '../../components/StatusBadge';
import {
  ArrowLeft,
  Save,
  Lock,
  ShieldCheck,
  Fingerprint,
  Sparkles,
  Clock,
  Info,
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
 * Validates Sri Lankan phone numbers:
 * Standard local format: 10 digits starting with 0 (e.g., 0712345678, 0112345678)
 * International format: +94 followed by 9 digits (e.g., +94712345678)
 */
function isValidSriLankanPhone(phone: string): boolean {
  const sanitized = phone.replace(/[\s\-()]/g, '');
  return /^(?:0[1-9]\d{8}|\+94[1-9]\d{8})$/.test(sanitized);
}

interface ExtendedUserFields {
  email?: string | null;
  phone?: string | null;
  district?: string | null;
  approval_status?: string | null;
}

export default function EditProfile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Safely extract potential profile fields from user object
  const profile = (user as unknown as ExtendedUserFields) || {};

  // Form field states prepopulated strictly with available information
  const [name, setName] = useState<string>(user?.name || '');
  const [phone, setPhone] = useState<string>(profile.phone || '');
  const [district, setDistrict] = useState<string>(profile.district || '');

  // Form validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});

  // Feedback banner state
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Unsaved changes confirmation dialog state
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false);

  // Authentication loading state
  if (loading) {
    return (
      <div className="ym32-profile" role="status" aria-busy="true">
        <ContentCard title="Loading Profile" subtitle="Verifying your YieldMatrix session…">
          <p className="loading-state">Checking profile records, please wait…</p>
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
          <div style={{ marginTop: '16px' }}>
            <Button variant="primary" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </div>
        </ContentCard>
      </div>
    );
  }

  const roleName = ROLE_LABELS[user.role] || user.role;

  // Track whether the user has modified any field from initial state
  const isDirty =
    name.trim() !== (user.name || '').trim() ||
    phone.trim() !== (profile.phone || '').trim() ||
    district !== (profile.district || '');

  // Handle Cancel action with unsaved changes check
  const handleCancel = () => {
    if (isDirty) {
      setShowCancelDialog(true);
    } else {
      navigate(`/${user.role}/profile`);
    }
  };

  const handleConfirmDiscard = () => {
    setShowCancelDialog(false);
    navigate(`/${user.role}/profile`);
  };

  // Handle Form Submission and Validation
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    const newErrors: { name?: string; phone?: string } = {};

    // Validate Name: Required and non-empty
    if (!trimmedName) {
      newErrors.name = 'Full name cannot be empty.';
    }

    // Validate Phone: Optional, but if provided must follow Sri Lankan format
    if (trimmedPhone && !isValidSriLankanPhone(trimmedPhone)) {
      newErrors.phone =
        'Please enter a valid Sri Lankan phone number (e.g. 07XXXXXXXX or +947XXXXXXXX).';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setFeedbackNotice(null);
      return;
    }

    // Clear validation errors and preserve entered form data
    setErrors({});
    setName(trimmedName);
    setPhone(trimmedPhone);

    // Transparent status message indicating backend persistence is pending
    setFeedbackNotice(
      'Profile information validated successfully. Backend persistence API is not yet connected; entered values remain in the form but cannot be saved to the database at this time.'
    );
  };

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

        <StatusBadge status={user.role} />
      </ContentCard>

      {/* Profile Edit Form */}
      <form onSubmit={handleSubmit} className="ym32-form" noValidate>
        {/* Feedback Alert */}
        {feedbackNotice && (
          <Alert type="info">
            {feedbackNotice}
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
                placeholder={profile.email ? undefined : 'Unavailable (Pending backend sync)'}
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
                onChange={(e) => setDistrict(e.target.value)}
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
                <Fingerprint size={14} aria-hidden="true" />
                System User ID
              </span>
              <span className="ym32-field-value ym32-mono">{user.id}</span>
            </div>
          </div>
        </ContentCard>

        {/* Form Action Buttons */}
        <div className="ym32-form-actions">
          <Button
            variant="outline"
            type="button"
            onClick={handleCancel}
            aria-label="Cancel editing"
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            type="submit"
            aria-label="Save profile changes"
          >
            <Save size={16} aria-hidden="true" />
            Save Changes
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
