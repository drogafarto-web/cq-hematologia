/**
 * useHaptic — thin wrapper over the Vibration API.
 *
 * Silently no-ops on browsers/devices that don't support it
 * (desktop, iOS Safari) so no error handling needed at the call site.
 *
 * Usage:
 *   const haptic = useHaptic();
 *   haptic.confirm();   // light pulse — after saves, confirmations
 *   haptic.error();     // double pulse — validation errors
 *   haptic.heavy();     // long pulse — destructive actions
 */

type HapticFn = () => void;

interface HapticAPI {
  /** Short single pulse — tap confirmation, save success */
  confirm: HapticFn;
  /** Double short pulse — form error, rejection */
  error: HapticFn;
  /** Single long pulse — destructive action (delete) */
  heavy: HapticFn;
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* unsupported — noop */
    }
  }
}

export function useHaptic(): HapticAPI {
  return {
    confirm: () => vibrate(40),
    error: () => vibrate([60, 40, 60]),
    heavy: () => vibrate(120),
  };
}

/** Imperative version — usable outside React components */
export const haptic: HapticAPI = {
  confirm: () => vibrate(40),
  error: () => vibrate([60, 40, 60]),
  heavy: () => vibrate(120),
};
