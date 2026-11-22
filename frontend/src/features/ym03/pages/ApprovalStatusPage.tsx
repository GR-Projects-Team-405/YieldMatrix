
import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  FileUp,
  HelpCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';

type Role = 'farmer' | 'buyer' | 'driver';
type ApprovalState = 'pending' | 'approved' | 'info' | 'rejected';

const roleData = {
  farmer: {
    name: 'Nimal Perera',
    role: 'Farmer (Nuwara Eliya District)',
    registrationId: 'YM-REG-8492',
    tier: 'Tier 1 Certified Produce Grower',
    dashboardLabel: 'Continue to Farmer Dashboard',
    dashboardPath: '/farmer/overview',
    document: 'Agrarian Services Certification',
    reviewerNote:
      'The submitted Agrarian Services registration deed (Form 4B) was slightly blurred and missing the official certification seal from the Nuwara Eliya Divisional Secretariat.',
    rejection:
      'The agricultural holding registration provided does not match the land cadastre records for Nuwara Eliya district.',
  },
  buyer: {
    name: 'Dilani Samarasinghe',
    role: 'Commercial Buyer (Colombo Central)',
    registrationId: 'YM-REG-3108',
    tier: 'Wholesale Procurement Partner',
    dashboardLabel: 'Continue to Buyer Marketplace',
    dashboardPath: '/buyer/marketplace',
    document: 'Tax / VAT Clearance Certificate',
    reviewerNote:
      'Please provide the latest audited corporate tax clearance or VAT registration certificate from Inland Revenue Department to complete trade credit clearance.',
    rejection:
      'Business registration documentation indicates pending legal dissolution or inactive tax status.',
  },
  driver: {
    name: 'Sunil Wickramasinghe',
    role: 'Logistics Hauler (Western Reefer Fleet)',
    registrationId: 'YM-REG-9941',
    tier: 'Cold-Chain Certified Carrier',
    dashboardLabel: 'Continue to Driver Portal',
    dashboardPath: '/driver/overview',
    document: 'Commercial Driver License & Calibration',
    reviewerNote:
      'Heavy vehicle commercial driving license front and back scan required, alongside updated transit reefer calibration certificate.',
    rejection:
      'Vehicle inspection certificate has expired beyond the allowable grace threshold.',
  },
} as const;

const states: { id: ApprovalState; label: string }[] = [
  { id: 'pending', label: '1. Pending Approval' },
  { id: 'approved', label: '2. Approved' },
  { id: 'info', label: '3. More Info' },
  { id: 'rejected', label: '4. Rejected' },
];

export default function ApprovalStatusPage() {
  const [role, setRole] = useState<Role>('farmer');
  const [state, setState] = useState<ApprovalState>('pending');
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState('');

  const account = roleData[role];

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    setFile(null);
    setFeedback('');
  }

  function changeState(nextState: ApprovalState) {
    setState(nextState);
    setFile(null);
    setFeedback('');
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    setFile(null);

    if (!selected) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (!allowedTypes.includes(selected.type)) {
      setFeedback('Choose a PDF, JPG or PNG file.');
      event.target.value = '';
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setFeedback('The file must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setFile(selected);
    setFeedback(
      'File selected. Upload will be enabled after backend integration.'
    );
  }

  return (
    <div className="ym03-approval-page">
      <div className="ym03-approval-container">
        <section
          className="ym03-approval-simulator"
          aria-label="Approval status UI preview controls"
        >
          <div className="ym03-approval-simulator-header">
            <strong>Role & Workflow Simulator</strong>
            <span>Ref: YM-03-05 · DEMO ONLY</span>
          </div>

          <div className="ym03-approval-personas">
            <span>Persona:</span>
            {(['farmer', 'buyer', 'driver'] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className={role === item ? 'active' : ''}
                  aria-pressed={role === item}
                  onClick={() => changeRole(item)}
                >
                  {item === 'farmer'
                    ? 'Farmer: Nimal'
                    : item === 'buyer'
                      ? 'Buyer: Dilani'
                      : 'Driver: Sunil'}
                </button>
              )
            )}
          </div>

          <div className="ym03-approval-state-tabs">
            {states.map((item) => (
              <button
                key={item.id}
                type="button"
                className={state === item.id ? 'active' : ''}
                aria-pressed={state === item.id}
                onClick={() => changeState(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section
          className="ym03-approval-card"
          aria-label="Account approval status preview"
        >
          {state === 'pending' && (
            <div className="ym03-approval-panel">
              <div className="ym03-approval-icon pending">
                <Clock3 size={34} />
              </div>

              <h1>Your account is under review</h1>
              <p className="ym03-approval-description">
                Thank you for joining YieldMatrix. Your
                registration has been submitted and is currently
                being verified by district dispatch officers.
              </p>

              <div className="ym03-approval-timeline">
                <div className="ym03-approval-step complete">
                  <span><Check size={18} /></span>
                  <strong>Submitted</strong>
                  <small>Step 1</small>
                </div>

                <div className="ym03-approval-step reviewing">
                  <span><RefreshCw size={17} /></span>
                  <strong>Under Review</strong>
                  <small>Step 2 (Active)</small>
                </div>

                <div className="ym03-approval-step upcoming">
                  <span><ShieldCheck size={18} /></span>
                  <strong>Account Active</strong>
                  <small>Step 3</small>
                </div>
              </div>

              <div className="ym03-approval-summary">
                <div className="ym03-approval-summary-heading">
                  <strong>REGISTRATION SUMMARY</strong>
                  <span className="ym03-approval-badge warning">
                    Pending Review
                  </span>
                </div>

                <div className="ym03-approval-details">
                  <div>
                    <small>Account Holder</small>
                    <strong>{account.name}</strong>
                  </div>
                  <div>
                    <small>Registration Role</small>
                    <strong>{account.role}</strong>
                  </div>
                  <div>
                    <small>Submission ID</small>
                    <strong>{account.registrationId}</strong>
                  </div>
                  <div>
                    <small>Submitted Date</small>
                    <strong>02 Nov 2026, 09:30 AM</strong>
                  </div>
                </div>
              </div>

              <div className="ym03-approval-actions">
                <button
                  className="ym03-approval-primary"
                  type="button"
                  disabled
                  title="Available after API integration"
                >
                  <RefreshCw size={18} />
                  Refresh Status
                </button>

                <button
                  className="ym03-approval-secondary"
                  type="button"
                  disabled
                  title="Support integration pending"
                >
                  <HelpCircle size={18} />
                  Verification Support
                </button>
              </div>

              <p className="ym03-approval-notice">
                Design reference: estimated clearance time
                2 to 4 business hours. This is illustrative;
                no live verification timing is available.
              </p>
            </div>
          )}

          {state === 'approved' && (
            <div className="ym03-approval-panel">
              <div className="ym03-approval-icon approved">
                <CheckCircle2 size={38} />
              </div>

              <h1>Account Approved!</h1>

              <p className="ym03-approval-description">
                Welcome to the YieldMatrix network.
                Your credentials have been authenticated and
                your trading clearance is now fully active.
              </p>

              <div className="ym03-approval-summary">
                <div className="ym03-approval-summary-heading">
                  <strong>ACCESS CLEARANCE</strong>
                  <span className="ym03-approval-badge success">
                    Verified & Active
                  </span>
                </div>

                <div className="ym03-approval-details">
                  <div>
                    <small>Verified Member</small>
                    <strong>{account.name}</strong>
                  </div>
                  <div>
                    <small>Operating Tier</small>
                    <strong>{account.tier}</strong>
                  </div>
                  <div>
                    <small>Account ID</small>
                    <strong>{account.registrationId}</strong>
                  </div>
                  <div>
                    <small>Approval Timestamp</small>
                    <strong>Demo: Today, Just now</strong>
                  </div>
                </div>
              </div>

              <div className="ym03-approval-actions stacked">
                <button
                  type="button"
                  disabled
                  title="Available after real authentication"
                  className="ym03-approval-primary"
                >
                  {account.dashboardLabel}
                  <ArrowRight size={18} />
                </button>

                <button
                  type="button"
                  disabled
                  className="ym03-approval-secondary"
                >
                  <BadgeCheck size={18} />
                  Download Digital Member Pass
                </button>
              </div>
            </div>
          )}

          {state === 'info' && (
            <div className="ym03-approval-panel">
              <div className="ym03-approval-icon info">
                <AlertTriangle size={36} />
              </div>

              <h1>Action Required: Additional Info</h1>

              <p className="ym03-approval-description">
                Our verification team reviewed your submission
                and requires clarification on documentation
                before activation can proceed.
              </p>

              <div className="ym03-approval-summary info">
                <div className="ym03-approval-feedback-title">
                  <AlertTriangle size={19} />
                  Reviewer Feedback Note
                </div>

                <p className="ym03-approval-reviewer-note">
                  "{account.reviewerNote}"
                </p>

                <div className="ym03-approval-upload">
                  <div>
                    <FileUp size={22} />
                    <div>
                      <strong>{account.document}</strong>
                      <small>PDF or clear photo, max 5 MB</small>
                    </div>
                  </div>

                  <label className="ym03-approval-choose-file">
                    Choose File
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>

                {file && (
                  <p className="ym03-approval-file-name">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              <div className="ym03-approval-actions">
                <button
                  type="button"
                  disabled
                  className="ym03-approval-primary orange"
                >
                  <Upload size={18} />
                  Update Information
                </button>

                <button
                  type="button"
                  disabled
                  className="ym03-approval-secondary"
                >
                  Message Reviewer
                </button>
              </div>
            </div>
          )}

          {state === 'rejected' && (
            <div className="ym03-approval-panel">
              <div className="ym03-approval-icon rejected">
                <XCircle size={36} />
              </div>

              <h1>Application Not Approved</h1>

              <p className="ym03-approval-description">
                We regret to inform you that your application
                does not currently meet YieldMatrix regulatory
                or compliance guidelines.
              </p>

              <div className="ym03-approval-summary">
                <strong className="ym03-approval-rejection-label">
                  REJECTION REASON
                </strong>

                <p className="ym03-approval-reviewer-note">
                  {account.rejection}
                </p>

                <p className="ym03-approval-rejection-help">
                  If you believe this decision is in error,
                  you may file an appeal through our compliance
                  desk or submit a new application with
                  corrected credentials.
                </p>
              </div>

              <div className="ym03-approval-actions">
                <button
                  type="button"
                  disabled
                  className="ym03-approval-primary"
                >
                  Contact Support Desk
                </button>

                <Link
                  to="/signup"
                  className="ym03-approval-secondary"
                >
                  <RotateCcw size={18} />
                  Start New Application
                </Link>
              </div>
            </div>
          )}

          {feedback && (
            <p className="ym03-approval-form-feedback" role="status">
              {feedback}
            </p>
          )}

          <p className="ym03-approval-demo-label">
            UI demonstration only — account details and status
            are sample data, not live verification results.
          </p>
        </section>
      </div>
    </div>
  );
}
