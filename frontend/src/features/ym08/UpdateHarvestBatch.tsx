import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';

type Batch = {
  id: string;
  crop_name: string;
  farm_name: string;
  planned_kg: string;
  actual_kg: string | null;
  planned_harvest_date: string;
  actual_harvest_date: string | null;
  status: string;
  revision: number;
};

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Scheduled' },
  { value: 'ready', label: 'Pending' },
  { value: 'harvested', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const BACK = '/farmer/harvest-calendar/list';

export default function UpdateHarvestBatch() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [plannedKg, setPlannedKg] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [actualKg, setActualKg] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [status, setStatus] = useState('planned');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<{ batch: Batch }>(`/ym08/harvest-batches/${batchId}`)
      .then(({ data }) => {
        if (!active) return;
        const b = data.batch;
        setBatch(b);
        setPlannedKg(b.planned_kg);
        setPlannedDate(b.planned_harvest_date);
        setActualKg(b.actual_kg ?? '');
        setActualDate(b.actual_harvest_date ?? '');
        setStatus(b.status);
      })
      .catch(() => { if (active) setError('Could not load this batch.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [batchId]);

  const validKg = (v: string, allowZero: boolean) => {
    const n = Number(v);
    const decimals = v.split('.')[1]?.length ?? 0;
    return v !== '' && !Number.isNaN(n) && (allowZero ? n >= 0 : n > 0) && decimals <= 3;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;
    setError('');

    if (!validKg(plannedKg, false)) return setError('Planned quantity must be positive with up to 3 decimals.');
    if (!plannedDate) return setError('Planned date is required.');
    if (actualKg !== '' && !validKg(actualKg, true)) return setError('Actual quantity must be a number with up to 3 decimals.');
    if (status === 'harvested' && (actualKg === '' || !actualDate)) {
      return setError('Actual quantity and date are required for a completed harvest.');
    }

    setSaving(true);
    try {
      await api.patch(`/ym08/harvest-batches/${batch.id}`, {
        plannedKg,
        plannedHarvestDate: plannedDate,
        actualKg: actualKg === '' ? null : actualKg,
        actualHarvestDate: actualDate || null,
        status,
        revision: batch.revision
      });
      navigate(BACK);
    } catch {
      setError('Could not save. The batch may have changed or can no longer be edited.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p role="status">Loading batch...</p>;
  if (!batch) return <Alert type="error">{error || 'Batch not found.'}</Alert>;

  const locked = batch.status !== 'planned' && batch.status !== 'ready';

  return (
    <ContentCard title="Update Harvest Batch" subtitle={`${batch.crop_name} · ${batch.farm_name}`}>
      <form onSubmit={handleSubmit} className="ym-harvest-form">
        {error && <Alert type="error">{error}</Alert>}
        {locked && <Alert type="warning">This batch is {batch.status} and can no longer be edited.</Alert>}
        <InputField label="Planned quantity" type="number" unit="kg" min="0" step="0.001"
          value={plannedKg} onChange={(e) => setPlannedKg(e.target.value)} disabled={locked} />
        <InputField label="Planned harvest date" type="date"
          value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} disabled={locked} />
        <SelectField label="Status" value={status}
          onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS} disabled={locked} />
        <InputField label="Actual quantity" type="number" unit="kg" min="0" step="0.001"
          value={actualKg} onChange={(e) => setActualKg(e.target.value)} disabled={locked} />
        <InputField label="Actual harvest date" type="date"
          value={actualDate} onChange={(e) => setActualDate(e.target.value)} disabled={locked} />
        <div className="ym-harvest-form-actions">
          <Button variant="outline" onClick={() => navigate(BACK)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving || locked}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </ContentCard>
  );
}