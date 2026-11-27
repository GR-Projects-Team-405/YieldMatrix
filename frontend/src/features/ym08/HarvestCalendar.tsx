import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import HarvestCalendarView, { type CalendarBatch } from './HarvestCalendarView';

type ApiBatch = {
  id: string;
  crop_name: string;
  quantity_kg: string | number;
  harvest_date: string;
  status: string;
};

export default function HarvestCalendar() {
  const [batches, setBatches] = useState<CalendarBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    api.get<{ batches: ApiBatch[] }>('/ym08/harvest-batches', {
      signal: controller.signal
    }).then(({ data }) => {
      if (!active) return;
      setBatches(data.batches.map((b) => ({
        id: b.id,
        cropName: b.crop_name,
        quantityKg: Number(b.quantity_kg),
        harvestDate: b.harvest_date,
        status: b.status
      })));
    }).catch(() => {
      if (active) setError('Could not load harvest batches.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; controller.abort(); };
  }, []);

  if (loading) return <p role="status">Loading harvest calendar...</p>;
  if (error) return <Alert type="error">{error}</Alert>;
  return <HarvestCalendarView batches={batches} />;
}