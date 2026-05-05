/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],

  // Nativewind v4 uses 'class' strategy: darkMode is toggled via 'dark' className
  // on the root view or via system color scheme (useColorScheme)
  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        // HC Quality brand palette — dark-first design system
        brand: {
          // Screen and layout backgrounds
          bg: '#0a0a0a',
          surface: '#141417',
          border: '#333333',
          muted: '#666666',
          // Muted text meeting WCAG AA 4.5:1 on #141417
          mutedAA: '#b3b3b3',
          // Accent palette
          accent: {
            violet: '#6366f1',  // primary CTA, violet-500
            emerald: '#10b981', // success / sign, emerald-500
            amber: '#f59e0b',   // pending / warning, amber-500
            red: '#ef4444',     // error / invalid / urgent, red-500
          },
        },
        // Re-export core semantic aliases for ergonomic Nativewind usage
        // e.g. className="bg-surface text-primary"
        surface: '#141417',
        'surface-elevated': '#1a1a1e',
      },

      // Typography scale aligned with HC Quality design tokens
      fontSize: {
        'hc-xs': ['11px', { lineHeight: '16px' }],
        'hc-sm': ['12px', { lineHeight: '16px' }],
        'hc-base': ['14px', { lineHeight: '20px' }],
        'hc-md': ['16px', { lineHeight: '24px' }],
        'hc-lg': ['18px', { lineHeight: '26px' }],
        'hc-xl': ['20px', { lineHeight: '28px' }],
        'hc-2xl': ['24px', { lineHeight: '32px' }],
      },

      // Spacing scale — 4px grid
      spacing: {
        'hc-xs': '4px',
        'hc-sm': '8px',
        'hc-md': '12px',
        'hc-lg': '16px',
        'hc-xl': '24px',
        'hc-2xl': '32px',
      },

      // Border radius tokens
      borderRadius: {
        'hc-sm': '6px',
        'hc-md': '8px',
        'hc-lg': '10px',
        'hc-xl': '12px',
        'hc-pill': '9999px',
      },

      // Platform fonts map to React Native system defaults
      // Nativewind resolves fontFamily correctly on iOS/Android
      fontFamily: {
        sans: [
          'System',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'Menlo',
          'Monaco',
          'Courier New',
          'monospace',
        ],
      },
    },
  },

  plugins: [],
};
