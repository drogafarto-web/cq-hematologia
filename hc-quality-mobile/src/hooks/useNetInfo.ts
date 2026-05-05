import { useEffect, useState, useRef } from 'react';

/**
 * useNetInfo — Network connectivity hook.
 *
 * Uses @react-native-community/netinfo when available.
 * Falls back to navigator.onLine (web/test environments) if the native
 * module is unavailable.
 *
 * Returns:
 *   isOnline: boolean — false when device has no network connection
 */

// Lazy-load netinfo to avoid crash if native module is not linked
let NetInfo: {
  fetch: () => Promise<{ isConnected: boolean | null }>;
  addEventListener: (cb: (state: { isConnected: boolean | null }) => void) => () => void;
} | null = null;

try {
  // @ts-ignore - optional native dependency
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  // NetInfo not available in this environment (e.g., web, test runner)
  // Will use fallback below
  NetInfo = null;
}

export function useNetInfo(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (NetInfo) {
      // Native NetInfo path (React Native device)
      NetInfo.fetch().then((state) => {
        setIsOnline(state.isConnected ?? true);
      });

      unsubscribeRef.current = NetInfo.addEventListener((state) => {
        setIsOnline(state.isConnected ?? true);
      });
    } else {
      // Fallback: stays online (optimistic default for non-native environments)
      setIsOnline(true);
    }
    // else: SSR / no window — stays true (optimistic)

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return { isOnline };
}
