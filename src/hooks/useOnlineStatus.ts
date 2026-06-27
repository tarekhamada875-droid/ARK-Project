import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineScreen, setShowOfflineScreen] = useState(!navigator.onLine);

  useEffect(() => {
    let timeoutId: any;
    const handleOnline = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setIsOnline(true);
      setShowOfflineScreen(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      // Wait 3.5 seconds to absorb transient events (like locking screen or screenshot editing)
      timeoutId = setTimeout(() => {
        setShowOfflineScreen(true);
      }, 3500);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Handle app visibility to prevent stale state crashes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Verify online status on visibility check
        if (navigator.onLine) {
          if (timeoutId) clearTimeout(timeoutId);
          setIsOnline(true);
          setShowOfflineScreen(false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { isOnline, showOfflineScreen };
}
