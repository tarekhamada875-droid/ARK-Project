import { useState, useEffect } from 'react';
import { getStorage } from '../utils';

export function useLocalStorageState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => getStorage(key, defaultValue));

  useEffect(() => {
    try {
      if (state === null || state === undefined) {
        localStorage.removeItem(key);
      } else if (typeof state === 'string') {
        localStorage.setItem(key, state);
      } else {
        localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (e) {
      console.error('Error writing localStorage key', key, e);
    }
  }, [key, state]);

  return [state, setState];
}
