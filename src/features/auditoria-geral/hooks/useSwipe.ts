import { useEffect, useRef } from 'react';

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Hook to detect horizontal swipe gestures on touch devices.
 * Returns a ref to attach to the swipeable container.
 */
export function useSwipe<T extends HTMLElement = HTMLDivElement>({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true,
}: UseSwipeOptions) {
  const ref = useRef<T>(null);
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX.current;
      const diffY = endY - startY.current;

      // Only trigger if horizontal movement is dominant
      if (Math.abs(diffX) < threshold || Math.abs(diffY) > Math.abs(diffX)) return;

      if (diffX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onSwipeLeft, onSwipeRight, threshold]);

  return ref;
}
