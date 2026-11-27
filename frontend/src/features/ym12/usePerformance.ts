import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import api from '../../services/api';
import type { PerformancePeriodQuery, SupplierPerformanceResponse } from './types';

export type PerformanceState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'success'; data: SupplierPerformanceResponse };

export function usePerformance(supplierId: string, period: PerformancePeriodQuery = {}) {
  const [state, setState] = useState<PerformanceState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const from = period.from;
  const to = period.to;

  useEffect(() => {
    const controller = new AbortController();
    if (!supplierId.trim()) {
      setState({ status: 'notFound' });
      return () => controller.abort();
    }

    setState({ status: 'loading' });
    api.get<SupplierPerformanceResponse>(`/ym12/suppliers/${encodeURIComponent(supplierId)}/performance`, {
      params: { from, to },
      signal: controller.signal,
    }).then(({ data }) => {
      setState({ status: 'success', data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setState({ status: 'notFound' });
      } else {
        setState({ status: 'error' });
      }
    });

    return () => controller.abort();
  }, [supplierId, from, to, retryCount]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  return { state, retry };
}
