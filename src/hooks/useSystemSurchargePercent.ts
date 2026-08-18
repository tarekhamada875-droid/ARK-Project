import { useState, useEffect } from 'react';
import { firestoreServiceV2 as firestoreService } from '../services/domain/firestoreServiceV2';

/** Subscribes to system_config/global.monthlySubscribersSurchargePercent (default 25). */
export function useSystemSurchargePercent(): number {
  const [percent, setPercent] = useState<number>(25);

  useEffect(() => {
    const unsub = firestoreService.subscribeToSystemConfig((config) => {
      if (config?.monthlySubscribersSurchargePercent !== undefined) {
        setPercent(Number(config.monthlySubscribersSurchargePercent) || 25);
      }
    });
    return () => unsub();
  }, []);

  return percent;
}
