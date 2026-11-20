import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import api from '../../services/api';
import type { SupplierProfileResponse } from './types';

export type SupplierProfileState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'success'; data: SupplierProfileResponse };

export function useSupplierProfile(supplierId: string) {
  const [state, setState] = useState<SupplierProfileState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (!supplierId.trim()) {
      setState({ status: 'notFound' });
      return () => controller.abort();
    }

    setState({ status: 'loading' });
    api.get<SupplierProfileResponse>(`/ym12/suppliers/${encodeURIComponent(supplierId)}`, {
      signal: controller.signal,
    }).then(({ data }) => {
      setState({ status: 'success', data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setState({ status: 'notFound' });
      } else if (axios.isAxiosError(error) && error.response?.status === 400) {
        setState({ status: 'notFound' });
      } else {
        setState({ status: 'error' });
      }
    });

    return () => controller.abort();
  }, [supplierId, retryCount]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  return { state, retry };
}
