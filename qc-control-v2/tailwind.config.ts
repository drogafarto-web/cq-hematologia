import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#004787', hover: '#003160' },
        surface: { DEFAULT: '#F9F9FF', variant: '#F3F3F9' },
        border: { DEFAULT: '#E5E7EB', variant: '#C2C6D2' },
        'on-surface': { DEFAULT: '#191C20', variant: '#424750' },
        outline: '#727781',
        error: { DEFAULT: '#BA1A1A', container: '#FFDAD6' },
        warning: { DEFAULT: '#D97706', container: '#FEF3C7' },
        success: { DEFAULT: '#059669', container: '#D1FAE5' },
      },
      borderRadius: { DEFAULT: '4px' },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
