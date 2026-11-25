import { isAxiosError } from 'axios';
import { MapPin, Sprout } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Toast } from '../../components/Toast';
import api from '../../services/api';
import { FarmLoadFeedback } from './FarmLoadFeedback';
import { farmPath, farmsPath, type FarmRecord } from './farmProfile';
import { useFarm } from './useFarm';
import styles from './farms.module.css';

const date = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });
const kg = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 3 });

function FarmProfileDetails({ farm }: { farm: FarmRecord }) {
  const [confirm, setConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof location.state?.farmNotice === 'string') {
      setNotice(location.state.farmNotice);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  async function archive() {
    if (pending.current) return;
    pending.current = true;
    setArchiving(true);
    setError('');
    try {
      await api.patch(`/ym07/farms/${farm.id}/archive`);
      navigate(farmsPath, { replace: true, state: { farmNotice: 'Farm archived.' } });
    } catch (error) {
      const response = isAxiosError<{ error?: string }>(error) ? error.response : undefined;
      setError(response?.data?.error || 'Unable to archive the farm. Please try again.');
      setConfirm(false);
    } finally {
      pending.current = false;
      setArchiving(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="ym07-details-heading">
      <div className={styles.detailHeader}>
        <h1 id="ym07-details-heading" className={styles.heading}>Farm details</h1>
        <Link className="ym-button ym-button--outline" to={farmsPath}>Back to My farms</Link>
      </div>
      <ContentCard className={styles.detailCard}>
        <div className={styles.detailHeader}>
          <h3><Sprout size={21} aria-hidden="true" /> {farm.name}</h3>
          <StatusBadge status={farm.status === 'inactive' ? 'Archived' : 'Active'} />
        </div>
        <dl className={styles.facts}>
          <div><dt>District</dt><dd>{farm.district}</dd></div>
          <div><dt>Created</dt><dd>{date.format(new Date(farm.created_at))} (Asia/Colombo)</dd></div>
        </dl>
        <section className={styles.detailPanel} aria-labelledby="ym07-pickup-heading">
          <h4 id="ym07-pickup-heading"><MapPin size={16} aria-hidden="true" /> Private pickup location</h4>
          <p>{farm.pickup_address}</p>
          {farm.latitude !== null && farm.longitude !== null && <p>Latitude {farm.latitude}°, longitude {farm.longitude}°</p>}
          <p className={styles.hint}>Visible only to you, admins and your assigned driver.</p>
        </section>
        <section className={styles.detailPanel} aria-labelledby="ym07-batches-heading">
          <h4 id="ym07-batches-heading">Linked harvest batches</h4>
          {farm.harvest_batches.length === 0 ? <p>No harvest batches linked yet.</p> : (
            <ul className={styles.batches}>
              {farm.harvest_batches.map((batch) => (
                <li key={batch.id}>
                  <strong>{batch.crop_name}</strong> <span>{batch.id}</span>
                  <p>{kg.format(Number(batch.reserved_kg))} kg reserved · {kg.format(Number(batch.uncollected_kg))} kg committed and awaiting pickup</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        {error && <Alert type="error">{error}</Alert>}
        <div className={styles.formActions}>
          <Link className="ym-button ym-button--primary" to={`${farmPath(farm.id)}/edit`}>Edit farm</Link>
          {farm.status === 'active' && <Button variant="outline" onClick={() => { setError(''); setConfirm(true); }}>Archive</Button>}
        </div>
      </ContentCard>
      <ConfirmDialog open={confirm} title="Archive farm?" description="The farm will stay in your list as Archived. Farms with linked harvest batches cannot be archived yet."
        confirmLabel="Archive farm" busy={archiving} onCancel={() => setConfirm(false)} onConfirm={() => void archive()} />
      {notice && <Toast message={notice} onClose={() => setNotice('')} />}
    </section>
  );
}

export default function FarmDetails() {
  const { farmId = '' } = useParams();
  const { state, retry } = useFarm(farmId);
  if (state.status !== 'ready') return <FarmLoadFeedback status={state.status} retry={retry} />;
  return <FarmProfileDetails key={state.farm.id} farm={state.farm} />;
}
