import { useState, useEffect } from 'react';
import { firestoreServiceV2 as firestoreService } from '../services/domain/firestoreServiceV2';

/** Subscribes to system_config/global.monthlySubscribersFlatFee (default 500). */
export function useSystemSubscribersFlatFee(): number {
  const [fee, setFee] = useState<number>(500);

  useEffect(() => {
    const unsub = firestoreService.subscribeToSystemConfig((config) => {
      if (config?.monthlySubscribersFlatFee !== undefined) {
        setFee(Number(config.monthlySubscribersFlatFee) || 500);
      }
    });
    return () => unsub();
  }, []);

  return fee;
}
