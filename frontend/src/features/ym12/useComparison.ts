import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import type { ComparisonResponse } from './types';

export type ComparisonFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; data: ComparisonResponse };

export function useComparison(ids: string[]) {
  const [state, setState] = useState<ComparisonFetchState>({ status: 'idle' });
  const [retryCount, setRetryCount] = useState(0);
  const idsKey = ids.join(',');

  useEffect(() => {
    const controller = new AbortController();
    if (!idsKey) {
      setState({ status: 'idle' });
      return () => controller.abort();
    }

    setState({ status: 'loading' });
    api.get<ComparisonResponse>('/ym12/comparison', {
      params: { ids: idsKey },
      signal: controller.signal,
    }).then(({ data }) => {
      setState({ status: 'success', data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState({ status: 'error' });
    });

    return () => controller.abort();
  }, [idsKey, retryCount]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  return { state, retry };
}
