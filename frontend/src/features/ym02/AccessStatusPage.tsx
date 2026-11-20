import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthSplitLayout from './AuthSplitLayout';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

type AccessStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

interface StatusContent {
  label: string;
  headline: string;
  body: string;
  badge: string;
  summary: string;
  detail: string;
}

const CONTENT: Record<AccessStatus, StatusContent> = {
  pending: {
    label: 'Account status',
    headline: 'Your account is almost ready.',
    body: "We'll let you know once your account is approved.",
    badge: 'Pending',
    summary: 'Your account is waiting for approval.',
    detail: "You can view your status and get help, but you can't trade until your account is approved.",
  },
  approved: {
    label: 'Account status',
    headline: 'Your account is approved.',
    body: 'You can now log in and start using YieldMatrix.',
    badge: 'Approved',
    summary: 'Your account is approved.',
    detail: 'You can now log in and use all features available for your role.',
  },
  rejected: {
    label: 'Account status',
    headline: "We couldn't approve your account.",
    body: 'If you think this is a mistake, get help from the YieldMatrix team.',
    badge: 'Rejected',
    summary: 'Your account request was not approved.',
    detail: "You can view your status and get help, but you can't trade with this account.",
  },
  suspended: {
    label: 'Account status',
    headline: 'Your account is on hold.',
    body: 'Get help from the YieldMatrix team to find out what to do next.',
    badge: 'Suspended',
    summary: 'Your account is currently suspended.',
    detail: "You can view your status and get help, but you can't trade while your account is suspended.",
  },
};

function parseStatus(raw: string | null): AccessStatus {
  return raw === 'approved' || raw === 'rejected' || raw === 'suspended' ? raw : 'pending';
}

export default function AccessStatusPage() {
  const [params] = useSearchParams();
  const [showHelp, setShowHelp] = useState(false);

  // TODO (Tue 24 Nov): load the real status from GET /api/ym02/status.
  // Until then the status is 'pending'. In development only, ?status=rejected etc. lets us preview each state.
  const status: AccessStatus = import.meta.env.DEV ? parseStatus(params.get('status')) : 'pending';
  const content = CONTENT[status];

  return (
    <AuthSplitLayout label={content.label} headline={content.headline} body={content.body}>
      <ContentCard title="Account access status" subtitle={content.summary}>
        <div className="ym02-form">
          <StatusBadge status={content.badge} />
          <p className="module-note">{content.detail}</p>

          {status === 'approved' ? (
            <Link className="ym-button ym-button--primary" to="/account/login">Log in</Link>
          ) : (
            <>
              <Button type="button" variant="primary" onClick={() => setShowHelp((value) => !value)} aria-expanded={showHelp}>
                Get help
              </Button>
              {showHelp && (
                <Alert type="info">
                  Contact the YieldMatrix team and mention the email address you registered with.
                </Alert>
              )}
              <Link className="ym02-link ym02-link--center" to="/account/login">Back to login</Link>
            </>
          )}
        </div>
      </ContentCard>
    </AuthSplitLayout>
  );
}