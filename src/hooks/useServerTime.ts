import { useState, useEffect, useCallback, useRef } from 'react';

export function useServerTime() {
  const [serverTimeOffset, setServerTimeOffset] = useState(0); // ms difference (server - local)
  const [now, setNow] = useState(new Date());
  const offsetRef = useRef(0);

  // Keep ref in sync with state in order to use inside stable callbacks
  useEffect(() => {
    offsetRef.current = serverTimeOffset;
  }, [serverTimeOffset]);

  const fetchServerTimeOffset = useCallback(async () => {
    try {
      const start = Date.now();
      const res = await fetch('/', { method: 'GET', cache: 'no-store' });
      const dateHeader = res.headers.get('date');
      if (dateHeader) {
        const serverTime = new Date(dateHeader).getTime();
        const rtt = Date.now() - start;
        const correctedServerTime = serverTime + (rtt / 2);
        const offset = correctedServerTime - Date.now();
        setServerTimeOffset(offset);
        return offset;
      }
    } catch (err) {
      console.log('Could not fetch server time offset, using local lock instead:', err);
    }
    return offsetRef.current;
  }, []); // Stable callback, empty dependencies!

  useEffect(() => {
    fetchServerTimeOffset();
    const interval = setInterval(fetchServerTimeOffset, 300000); // sync every 5 mins
    return () => clearInterval(interval);
  }, [fetchServerTimeOffset]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date(Date.now() + serverTimeOffset));
    }, 60000); // Throttled to 60s to minimize re-renders and CPU usage
    return () => clearInterval(timer);
  }, [serverTimeOffset]);

  return { now, serverTimeOffset, setServerTimeOffset, fetchServerTimeOffset };
}
