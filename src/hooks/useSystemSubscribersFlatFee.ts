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

/** Subscribes to system_config/global.referralFeePerRenewal (default 30). */
export function useSystemReferralFee(): number {
  const [fee, setFee] = useState<number>(30);

  useEffect(() => {
    const unsub = firestoreService.subscribeToSystemConfig((config) => {
      if (config?.referralFeePerRenewal !== undefined) {
        const val = Number(config.referralFeePerRenewal);
        setFee(isNaN(val) || val < 0 ? 30 : Math.floor(val));
      }
    });
    return () => unsub();
  }, []);

  return fee;
}

