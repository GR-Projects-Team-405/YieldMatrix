
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  fetchApprovalStatus,
  getApprovalStatusError,
  type ApprovalStatusResponse,
} from '../services/approvalStatusApi';

const roleLabels = {
  farmer: 'Farmer',
  buyer: 'Buyer / Shop',
  driver: 'Driver',
} as const;

export default function ApprovalStatusPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] =
    useState<ApprovalStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function handleCheckStatus(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isLoading) return;

    setFeedback('');
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetchApprovalStatus({
        email,
        password,
      });

      setResult(response);
      setPassword('');
    } catch (error) {
      setFeedback(getApprovalStatusError(error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function resetLookup() {
    setResult(null);
    setEmail('');
    setPassword('');
    setFeedback('');
  }

  return (
    <div className="ym03-approval-page">
      <div className="ym03-approval-container">
        <section
          className="ym03-approval-card"
          aria-label="Registration approval status"
        >
          <div className="ym03-approval-panel">
            <div className="ym03-approval-icon pending">
              <ShieldCheck size={34} />
            </div>

            <h1>Registration Approval Status</h1>

            <p className="ym03-approval-description">
              Check the current status of your YieldMatrix
              registration using your registered email
              address and password.
            </p>

            {!result && (
              <form onSubmit={handleCheckStatus}>
                <div className="ym03-approval-summary">
                  <div className="ym03-approval-details">
                    <div>
                      <label htmlFor="ym03-status-email">
                        <strong>Email Address</strong>
                      </label>

                      <input
                        id="ym03-status-email"
                        type="email"
                        name="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        placeholder="Enter your registered email"
                        autoComplete="username"
                        maxLength={254}
                        required
                        disabled={isLoading}
                        style={{
                          width: '100%',
                          marginTop: 8,
                          padding: 12,
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#111827',
                        }}
                      />
                    </div>

                    <div>
                      <label htmlFor="ym03-status-password">
                        <strong>Password</strong>
                      </label>

                      <input
                        id="ym03-status-password"
                        type="password"
                        name="password"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        maxLength={128}
                        required
                        disabled={isLoading}
                        style={{
                          width: '100%',
                          marginTop: 8,
                          padding: 12,
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#111827',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="ym03-approval-actions">
                  <button
                    type="submit"
                    className="ym03-approval-primary"
                    disabled={isLoading}
                  >
                    <RefreshCw size={18} />
                    {isLoading
                      ? 'Checking Status...'
                      : 'Check My Status'}
                  </button>
                </div>
              </form>
            )}

            {result?.approvalStatus === 'pending' && (
              <>
                <div className="ym03-approval-icon pending">
                  <Clock3 size={34} />
                </div>

                <h2>Your account is under review</h2>

                <p className="ym03-approval-description">
                  Your registration has been received and
                  is awaiting approval.
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
                    <small>Step 2</small>
                  </div>

                  <div className="ym03-approval-step upcoming">
                    <span><ShieldCheck size={18} /></span>
                    <strong>Account Approved</strong>
                    <small>Step 3</small>
                  </div>
                </div>
              </>
            )}

            {result?.approvalStatus === 'approved' && (
              <>
                <div className="ym03-approval-icon approved">
                  <CheckCircle2 size={38} />
                </div>

                <h2>Account Approved!</h2>

                <p className="ym03-approval-description">
                  Your registration has been approved.
                  You can now sign in using your account
                  credentials.
                </p>
              </>
            )}

            {result?.approvalStatus === 'rejected' && (
              <>
                <div className="ym03-approval-icon rejected">
                  <XCircle size={36} />
                </div>

                <h2>Application Not Approved</h2>

                <p className="ym03-approval-description">
                  Your registration has not been approved.
                </p>

                {result.reason && (
                  <div className="ym03-approval-summary">
                    <strong className="ym03-approval-rejection-label">
                      REJECTION REASON
                    </strong>

                    <p className="ym03-approval-reviewer-note">
                      {result.reason}
                    </p>
                  </div>
                )}
              </>
            )}

            {result?.approvalStatus === 'suspended' && (
              <>
                <div className="ym03-approval-icon rejected">
                  <AlertTriangle size={36} />
                </div>

                <h2>Account Suspended</h2>

                <p className="ym03-approval-description">
                  Your account is currently suspended
                  and cannot be used to sign in.
                </p>

                {result.reason && (
                  <div className="ym03-approval-summary">
                    <strong className="ym03-approval-rejection-label">
                      ACCOUNT NOTICE
                    </strong>

                    <p className="ym03-approval-reviewer-note">
                      {result.reason}
                    </p>
                  </div>
                )}
              </>
            )}

            {result && (
              <>
                <div className="ym03-approval-summary">
                  <div className="ym03-approval-summary-heading">
                    <strong>REGISTRATION SUMMARY</strong>

                    <span className="ym03-approval-badge">
                      {result.approvalStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="ym03-approval-details">
                    <div>
                      <small>Registration Role</small>
                      <strong>
                        {roleLabels[result.role]}
                      </strong>
                    </div>

                    <div>
                      <small>Registration ID</small>
                      <strong>
                        {result.registrationId}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="ym03-approval-actions">
                  <button
                    type="button"
                    className="ym03-approval-primary"
                    onClick={resetLookup}
                  >
                    <RefreshCw size={18} />
                    Check Status Again
                  </button>
                </div>

                {result.approvalStatus === 'approved' && (
                  <p className="ym03-approval-notice">
                    Your account is approved. Return to
                    your Farmer, Buyer or Driver login
                    page to access your dashboard.
                  </p>
                )}
              </>
            )}

            {feedback && (
              <p
                className="ym03-approval-form-feedback"
                role="alert"
              >
                {feedback}
              </p>
            )}

            <p className="ym03-approval-notice">
              Status information is retrieved from your
              registered YieldMatrix account.
              Checking your status does not sign you in.
            </p>

            <div className="ym03-approval-actions">
              <Link
                to="/signup"
                className="ym03-approval-secondary"
              >
                Back to Registration
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
