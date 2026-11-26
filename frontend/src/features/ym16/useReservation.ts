import { useCallback, useEffect, useState } from 'react';
import { apiError, ym16Api } from './api';
import type { ReservationDetail } from './types';

export function useReservation(orderId?: string) {
  const [data, setData] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      setData(await ym16Api.detail(orderId));
    } catch (err) {
      setError(apiError(err, 'Unable to load reservation'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (work: () => Promise<ReservationDetail>, success: string) => {
    setBusy(true);
    setError('');
    try {
      const next = await work();
      setData(next);
      setNotice(success);
      return next;
    } catch (err) {
      setError(apiError(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  return { data, loading, busy, error, notice, setNotice, setError, reload: load, run, setData };
}
