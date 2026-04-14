import { forwardRef } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
}

export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className = '', size = 'md', ...props }, ref) => {
    const { isDark, toggleTheme } = useTheme();
    const sizeStyles = size === 'sm' ? 'w-10 h-10 p-2' : 'w-11 h-11 p-2.5';

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
        className={`
          ${sizeStyles} ${className}
          inline-flex items-center justify-center
          rounded-full
          bg-white/10 hover:bg-white/20
          dark:bg-white/5 dark:hover:bg-white/10
          border border-white/20 dark:border-white/20
          transition-[background-color,border-color,box-shadow] duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ring-offset-2
          ring-offset-transparent dark:ring-offset-[#0c0c0c]
          group
        `}
        onClick={toggleTheme}
        {...props}
      >
        <svg
          className="h-5 w-5 text-white/80 transition-transform duration-300"
          style={{ transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)' }}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          {isDark ? (
            // Sun — ativar modo claro
            <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
          ) : (
            // Moon — ativar modo escuro
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          )}
        </svg>
      </button>
    );
  }
);

ThemeToggle.displayName = 'ThemeToggle';
