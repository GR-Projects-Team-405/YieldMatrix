import { Link } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { farmsPath } from './farmProfile';
import styles from './farms.module.css';

export function FarmLoadFeedback({ status, retry }: {
  status: 'loading' | 'missing' | 'forbidden' | 'error';
  retry: () => void;
}) {
  const back = <Link className="ym-button ym-button--outline" to={farmsPath}>Back to My farms</Link>;
  if (status === 'loading') return <p role="status">Loading farm…</p>;
  if (status === 'missing') return <EmptyState title="Farm not found" description="This farm is unavailable. Choose a farm from your list." action={back} />;
  if (status === 'forbidden') return <EmptyState title="Access denied" description="Your account does not have permission to view this farm." action={back} />;
  return (
    <div className={styles.results}>
      <Alert type="error">Unable to load this farm. Please try again.</Alert>
      <div className={styles.formActions}><Button variant="outline" onClick={retry}>Retry</Button>{back}</div>
    </div>
  );
}
