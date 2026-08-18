import { useState, useEffect } from 'react';
import { firestoreServiceV2 as firestoreService } from '../services/domain/firestoreServiceV2';
import type { SystemConfig } from '../types';

export const useSystemConfig = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);

  useEffect(() => {
    const unsub = firestoreService.subscribeToSystemConfig((c) => {
      if (c) setConfig(c);
    });
    return () => unsub();
  }, []);

  return config;
};
