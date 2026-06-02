import { useEffect, useState } from 'react';

/**
 * Debounce a value by `delay` ms. Returns the debounced value.
 * Uses latest value without stale closure.
 */
export function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
