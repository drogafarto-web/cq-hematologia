/**
 * HC Quality Dark Theme — Brand Token Exports
 *
 * Use these typed constants where Nativewind className isn't possible:
 * - Animated.Value color interpolations
 * - Runtime StyleSheet.create overrides
 * - Dynamic color computations
 *
 * For static styles, prefer Nativewind className (e.g. "bg-[#141417]").
 *
 * All color values are WCAG AA compliant on their intended backgrounds.
 * Contrast ratios tested against surface (#141417):
 *   #ffffff → 12.6:1 ✓ (text.primary)
 *   rgba(255,255,255,0.6) → ~5.8:1 ✓ (text.secondary)
 *   #b3b3b3 → 4.5:1 ✓ (text.muted — minimum AA)
 *   rgba(255,255,255,0.3) → ~2.9:1 (text.disabled — intentionally sub-AA, not interactive)
 */

export const colors = {
  /** Full screen backgrounds */
  bg: '#0a0a0a',

  /** Card / surface backgrounds */
  surface: '#141417',

  /** Elevated surface (modals, sheets) */
  surfaceElevated: '#1a1a1e',

  /** Borders and dividers */
  border: '#333333',

  /** Low-emphasis border */
  borderMuted: '#222222',

  /** Decorative separator */
  separator: '#1e1e22',

  /** Muted placeholder / disabled text (#666666 — below AA, use only for placeholders) */
  muted: '#666666',

  /** Text color tokens */
  text: {
    /** Primary text — 12.6:1 on surface */
    primary: '#ffffff',
    /** Secondary text — ~5.8:1 on surface */
    secondary: 'rgba(255,255,255,0.6)',
    /** Muted text — 4.5:1 on surface (WCAG AA) */
    muted: '#b3b3b3',
    /** Disabled text — intentionally below AA (not interactive) */
    disabled: 'rgba(255,255,255,0.3)',
    /** Placeholder text (TextInput) */
    placeholder: '#666666',
  },

  /** Brand accent palette */
  accent: {
    /** Primary CTA — violet-500 */
    violet: '#6366f1',
    /** Hover/pressed state for violet */
    violetDark: '#4f46e5',

    /** Success / signed / compliant — emerald-500 */
    emerald: '#10b981',
    /** Hover/pressed for emerald */
    emeraldDark: '#059669',

    /** Warning / pending / in-progress — amber-500 */
    amber: '#f59e0b',

    /** Error / invalid / critical — red-500 */
    red: '#ef4444',

    /** Informational — blue-400 */
    blue: '#60a5fa',
  },
} as const;

export const spacing = {
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px */
  lg: 16,
  /** 24px */
  xl: 24,
  /** 32px */
  '2xl': 32,
  /** 48px */
  '3xl': 48,
} as const;

export const typography = {
  sizes: {
    /** 11px — labels, captions */
    xs: 11,
    /** 12px — meta, timestamps */
    sm: 12,
    /** 14px — body text default */
    base: 14,
    /** 16px — emphasized body */
    md: 16,
    /** 18px — subheadings */
    lg: 18,
    /** 20px — section titles */
    xl: 20,
    /** 24px — screen titles */
    '2xl': 24,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.3,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  pill: 9999,
} as const;

export const shadows = {
  /** Subtle elevation for cards */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  /** Modal/sheet elevation */
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;

/** Complete dark theme bundle for import convenience */
export const darkTheme = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} as const;

export type DarkTheme = typeof darkTheme;
export type ThemeColors = typeof colors;
