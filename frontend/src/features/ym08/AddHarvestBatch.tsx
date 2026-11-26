import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';

type Option = { id: string; name: string };
type Options = { farms: Option[]; crops: Option[]; grades: Option[] };

export default function AddHarvestBatch() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<Options>({ farms: [], crops: [], grades: [] });
  const [farmId, setFarmId] = useState('');
  const [cropId, setCropId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [plannedKg, setPlannedKg] = useState('');
  const [plannedHarvestDate, setPlannedHarvestDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<Options>('/ym08/form-options')
      .then(({ data }) => { if (active) setOptions(data); })
      .catch(() => { if (active) setError('Could not load farms, crops and grades.'); });
    return () => { active = false; };
  }, []);

  const toChoices = (items: Option[]) => [
    { value: '', label: 'Select...' },
    ...items.map((o) => ({ value: o.id, label: o.name }))
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!farmId || !cropId || !gradeId) return setError('Select farm, crop and grade.');
    const qty = Number(plannedKg);
    const decimals = plannedKg.split('.')[1]?.length ?? 0;
    if (!plannedKg || Number.isNaN(qty) || qty <= 0 || decimals > 3) {
      return setError('Quantity must be a positive number with up to 3 decimals.');
    }
    if (!plannedHarvestDate) return setError('Harvest date is required.');

    setSaving(true);
    try {
      await api.post('/ym08/harvest-batches', {
        farmId, cropId, gradeId, plannedKg, plannedHarvestDate
      });
      navigate('..'); // success only after a successful response
    } catch {
      setError('Could not save the harvest batch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ContentCard title="Add Harvest Batch" subtitle="Enter the harvest details">
      <form onSubmit={handleSubmit} className="ym-harvest-form">
        {error && <Alert type="error">{error}</Alert>}
        <SelectField label="Farm" value={farmId}
          onChange={(e) => setFarmId(e.target.value)} options={toChoices(options.farms)} />
        <SelectField label="Crop" value={cropId}
          onChange={(e) => setCropId(e.target.value)} options={toChoices(options.crops)} />
        <SelectField label="Grade" value={gradeId}
          onChange={(e) => setGradeId(e.target.value)} options={toChoices(options.grades)} />
        <InputField label="Planned quantity" type="number" unit="kg" min="0" step="0.001"
          value={plannedKg} onChange={(e) => setPlannedKg(e.target.value)} />
        <InputField label="Planned harvest date" type="date"
          value={plannedHarvestDate} onChange={(e) => setPlannedHarvestDate(e.target.value)} />
        <div className="ym-harvest-form-actions">
          <Button variant="outline" onClick={() => navigate('..')}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </ContentCard>
  );
}