import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import api from '../../services/api';
import type { ProduceDetailsResponse } from './types';

export type ProduceDetailsState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'success'; data: ProduceDetailsResponse };

export function useProduceDetails(listingId: string) {
  const [state, setState] = useState<ProduceDetailsState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (!listingId.trim()) {
      setState({ status: 'notFound' });
      return () => controller.abort();
    }

    setState({ status: 'loading' });
    api.get<ProduceDetailsResponse>(`/ym12/produce/${encodeURIComponent(listingId)}`, {
      signal: controller.signal,
    }).then(({ data }) => {
      setState({ status: 'success', data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (axios.isAxiosError(error) && (error.response?.status === 400 || error.response?.status === 404)) {
        setState({ status: 'notFound' });
        return;
      }
      setState({ status: 'error' });
    });

    return () => controller.abort();
  }, [listingId, retryCount]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  return { state, retry };
}
