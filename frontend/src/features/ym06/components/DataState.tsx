import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';

export function LoadingState({ label = 'Loading your workspace data…' }: { label?: string }) {
  return <div className="ym06-loading" role="status"><span className="ym06-spinner"/>{label}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="ym06-error-state"><Alert type="error">{message}</Alert><Button variant="outline" onClick={onRetry}>Try again</Button></div>;
}

export function NoRecords({ title, description }: { title: string; description: string }) {
  return <EmptyState title={title} description={description}/>;
}
