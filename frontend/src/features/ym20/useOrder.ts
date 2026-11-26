import { useEffect, useState } from 'react';
import api from '../../services/api';
import type { ApiOrderDetail } from './txApi';

/** Loads one order (with its allocations) from the YM20 API. */
export function useOrder(orderId: string | undefined) {
  const [data, setData] = useState<ApiOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .get<ApiOrderDetail>(`/ym20/orders/${orderId}`, { signal: controller.signal })
      .then(({ data: d }) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e?.response?.status === 404 ? 'Order not found.' : 'Could not load this order.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [orderId]);

  return { data, loading, error };
}