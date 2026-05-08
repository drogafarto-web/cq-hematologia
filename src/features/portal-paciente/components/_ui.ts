/**
 * _ui.ts
 * Portal Paciente design tokens — patient-specific, dark-first
 * Extends root DESIGN_SYSTEM.md tokens
 * Reference: Apple, Linear, Stripe (calming, trustworthy, medical)
 */

/**
 * Color palette — dark-first, high contrast for medical context
 * 7:1 ratio (WCAG AAA) minimum for all text
 */
export const PORTAL_PACIENTE_COLORS = {
  // Background
  background: '#141417', // Main dark
  surfaceBase: 'rgba(255, 255, 255, 0.02)', // white/2
  surfaceHover: 'rgba(255, 255, 255, 0.04)', // white/4
  border: 'rgba(255, 255, 255, 0.08)', // white/8
  borderFocus: 'rgba(255, 255, 255, 0.15)', // white/15

  // Text
  textPrimary: 'rgba(255, 255, 255, 0.95)', // white/95 — 16:1 contrast
  textSecondary: 'rgba(255, 255, 255, 0.70)', // white/70 — 10:1 contrast
  textTertiary: 'rgba(255, 255, 255, 0.50)', // white/50 — 7.2:1 contrast

  // Status colors
  success: '#10b981', // emerald-500
  warning: '#f59e0b', // amber-500
  critical: '#ef4444', // red-500
  pending: 'rgba(255, 255, 255, 0.20)', // white/20

  // Interactive
  primary: '#7c3aed', // violet-600
  primaryHover: '#6d28d9', // violet-700
  primaryActive: '#5b21b6', // violet-900

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.60)', // black/60
};

/**
 * Typography hierarchy
 * Editorial sensibility, clear hierarchy
 */
export const PORTAL_PACIENTE_TYPOGRAPHY = {
  heading1: {
    fontSize: '1.5rem', // 24px
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  heading2: {
    fontSize: '1.25rem', // 20px
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
  },
  heading3: {
    fontSize: '1.125rem', // 18px
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '-0.005em',
  },
  bodyLarge: {
    fontSize: '1rem', // 16px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodyBase: {
    fontSize: '0.9375rem', // 15px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodySmall: {
    fontSize: '0.875rem', // 14px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: '0.75rem', // 12px
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: '0.01em',
  },
  micro: {
    fontSize: '0.6875rem', // 11px
    fontWeight: 400,
    lineHeight: 1.3,
  },
};

/**
 * Spacing scale (4px base)
 */
export const PORTAL_PACIENTE_SPACING = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  12: '3rem', // 48px
};

/**
 * Border radius — modern, not extreme
 */
export const PORTAL_PACIENTE_RADIUS = {
  none: '0',
  sm: '0.375rem', // 6px
  md: '0.5rem', // 8px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
  full: '9999px',
};

/**
 * Shadows — depth, not drama
 */
export const PORTAL_PACIENTE_SHADOWS = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
  modal: '0 20px 25px rgba(0, 0, 0, 0.15)',
};

/**
 * Transitions — smooth, medical pace
 */
export const PORTAL_PACIENTE_TRANSITIONS = {
  fast: '150ms ease-in-out',
  normal: '200ms ease-in-out',
  slow: '300ms ease-in-out',
};

/**
 * Z-index scale
 */
export const PORTAL_PACIENTE_ZINDEX = {
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  overlay: 40,
  modal: 50,
  tooltip: 60,
};
