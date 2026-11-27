import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api, { TOKEN_KEY } from '../../services/api';
import AuthSplitLayout from './AuthSplitLayout';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

type AccessStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
type View = AccessStatus | 'loading' | 'signed-out' | 'error';

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

const NEUTRAL_SUBTITLE = {
  loading: 'Checking your account status…',
  'signed-out': 'Log in to see your account status.',
  error: 'We could not load your account status.',
} as const;

function parseStatus(raw: string | null): AccessStatus {
  return raw === 'approved' || raw === 'rejected' || raw === 'suspended' ? raw : 'pending';
}

export default function AccessStatusPage() {
  const [params] = useSearchParams();
  const [showHelp, setShowHelp] = useState(false);
  const [view, setView] = useState<View>('loading');

  // In development only, ?status=rejected etc. previews each state without signing in.
  const preview = import.meta.env.DEV ? params.get('status') : null;

  useEffect(() => {
    if (preview) {
      setView(parseStatus(preview));
      return;
    }
    if (!localStorage.getItem(TOKEN_KEY)) {
      setView('signed-out');
      return;
    }
    let cancelled = false;
    api
      .get<{ status: string }>('/ym02/account-status')
      .then(({ data }) => {
        if (!cancelled) setView(parseStatus(data.status));
      })
      .catch((error) => {
        if (cancelled) return;
        setView(isAxiosError(error) && error.response?.status === 401 ? 'signed-out' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);

  if (view === 'loading' || view === 'signed-out' || view === 'error') {
    return (
      <AuthSplitLayout
        label="Account status"
        headline="Check your account access."
        body="Log in to see where your account stands."
      >
        <ContentCard title="Account access status" subtitle={NEUTRAL_SUBTITLE[view]}>
          <div className="ym02-form">
            {view === 'error' && <Alert type="error">Something went wrong. Please try again later.</Alert>}
            {view !== 'loading' && <Link className="ym-button ym-button--primary" to="/account/login">Log in</Link>}
          </div>
        </ContentCard>
      </AuthSplitLayout>
    );
  }

  const content = CONTENT[view];

  return (
    <AuthSplitLayout label={content.label} headline={content.headline} body={content.body}>
      <ContentCard title="Account access status" subtitle={content.summary}>
        <div className="ym02-form">
          <StatusBadge status={content.badge} />
          <p className="module-note">{content.detail}</p>

          {view === 'approved' ? (
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