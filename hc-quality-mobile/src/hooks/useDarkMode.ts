import { useColorScheme } from 'react-native';
import { darkTheme } from '../theme/darkTheme';

/**
 * useDarkMode — System color scheme listener
 *
 * HC Quality is dark-first: the app renders dark styles regardless of system
 * preference. This hook exposes the system scheme for:
 * 1. Nativewind dark variant toggling (Nativewind v4 reads useColorScheme internally)
 * 2. Manual StyleSheet overrides where className isn't applicable
 * 3. Analytics / telemetry (did user's device request light mode?)
 *
 * Nativewind v4 behavior:
 * - When colorScheme === 'dark', Nativewind activates `dark:` variants automatically
 * - No manual class toggling needed; hook is passive
 *
 * Usage:
 *   const { isDark, colorScheme, theme } = useDarkMode();
 *   const bgColor = isDark ? theme.colors.bg : '#ffffff';
 */
export function useDarkMode() {
  const colorScheme = useColorScheme();

  /**
   * True when system is in dark mode (or when colorScheme is null — default to dark
   * for HC Quality since the app is dark-first).
   */
  const isDark = colorScheme !== 'light';

  /**
   * Nativewind className prefix.
   * In v4, this value mirrors what Nativewind checks internally.
   * Exposed for components that need to build dynamic classNames.
   *
   * Example: `${darkPrefix}:text-white` → 'dark:text-white'
   */
  const darkPrefix = 'dark';

  return {
    /** True when system color scheme is dark (or unknown — app defaults dark) */
    isDark,
    /** Raw system value: 'light' | 'dark' | null */
    colorScheme,
    /** Nativewind dark class prefix ('dark') */
    darkPrefix,
    /** Full dark theme tokens for runtime style access */
    theme: darkTheme,
  };
}
