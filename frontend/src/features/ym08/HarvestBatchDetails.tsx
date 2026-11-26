import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';

type Batch = {
  id: string;
  crop_name: string;
  grade_name: string;
  farm_name: string;
  planned_kg: string;
  actual_kg: string | null;
  sellable_kg: string;
  planned_harvest_date: string;
  actual_harvest_date: string | null;
  status: string;
  revision: number;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  planned: 'Scheduled',
  ready: 'Pending',
  harvested: 'Completed',
  depleted: 'Depleted',
  cancelled: 'Cancelled'
};

const STATUS_CLASS: Record<string, string> = {
  planned: 'scheduled',
  ready: 'pending',
  harvested: 'completed',
  depleted: 'completed',
  cancelled: 'pending'
};

const BASE = '/farmer/harvest-calendar';

const fmtDate = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
      })
    : '-';

const fmtKg = (v: string | null) =>
  v === null ? '-' : `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;

export default function HarvestBatchDetails() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.get<{ batch: Batch }>(`/ym08/harvest-batches/${batchId}`, { signal: controller.signal })
      .then(({ data }) => { if (active) setBatch(data.batch); })
      .catch(() => { if (active) setError('Could not load this batch.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [batchId]);

  if (loading) return <p role="status">Loading batch details...</p>;
  if (error || !batch) return <Alert type="error">{error || 'Batch not found.'}</Alert>;

  const editable = batch.status === 'planned' || batch.status === 'ready';
  const createdAt = new Date(batch.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' });

  const rows: [string, string][] = [
    ['Crop', batch.crop_name],
    ['Grade', batch.grade_name],
    ['Farm', batch.farm_name],
    ['Planned quantity', fmtKg(batch.planned_kg)],
    ['Actual quantity', fmtKg(batch.actual_kg)],
    ['Sellable quantity', fmtKg(batch.sellable_kg)],
    ['Planned harvest date', fmtDate(batch.planned_harvest_date)],
    ['Actual harvest date', fmtDate(batch.actual_harvest_date)],
    ['Created', createdAt]
  ];

  return (
    <ContentCard
      title="Harvest Batch Details"
      subtitle={`HB-${batch.id.replace(/-/g, '').slice(-6).toUpperCase()}`}
    >
      <div className="ym-harvest-details">
        <span className={`ym-harvest-status ym-harvest-status--${STATUS_CLASS[batch.status] ?? 'pending'}`}>
          <i className="ym-harvest-status-dot" />
          {STATUS_LABEL[batch.status] ?? batch.status}
        </span>

        <dl className="ym-harvest-details-grid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="ym-harvest-form-actions">
          <Button variant="outline" onClick={() => navigate(`${BASE}/list`)}>Back</Button>
          {editable && (
            <Link to={`${BASE}/${batch.id}/edit`}>
              <Button variant="primary">Edit</Button>
            </Link>
          )}
        </div>
      </div>
    </ContentCard>
  );
}