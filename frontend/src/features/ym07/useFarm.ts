import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import api from '../../services/api';
import type { FarmRecord } from './farmProfile';

type FarmLoad = { status: 'loading' | 'missing' | 'forbidden' | 'error' }
  | { status: 'ready'; farm: FarmRecord };

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function useFarm(farmId: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ id: string; attempt: number; state: FarmLoad }>();
  const valid = uuid.test(farmId);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    let active = true;
    function publish(state: FarmLoad) {
      if (active) setResult({ id: farmId, attempt, state });
    }

    api.get<{ farm: FarmRecord }>(`/ym07/farms/${farmId}`, { signal: controller.signal })
      .then(({ data }) => publish({ status: 'ready', farm: data.farm }))
      .catch((error: unknown) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        publish({ status: status === 404 ? 'missing' : status === 403 ? 'forbidden' : 'error' });
      });

    return () => { active = false; controller.abort(); };
  }, [farmId, valid, attempt]);

  const state: FarmLoad = !valid ? { status: 'missing' }
    : result?.id === farmId && result.attempt === attempt ? result.state : { status: 'loading' };
  return { state, retry: () => setAttempt((value) => value + 1) };
}
