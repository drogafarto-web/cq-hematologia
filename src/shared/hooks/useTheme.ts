/**
 * useTheme — singleton pattern.
 *
 * Estado vive no módulo (fora do React), não por instância de hook.
 * Múltiplos componentes chamando useTheme() enxergam e sincronizam
 * o mesmo tema sem Context Provider nem Zustand extra.
 *
 * Fluxo de prioridade:
 *   1. localStorage 'cq-theme'          (usuário já escolheu)
 *   2. prefers-color-scheme do SO       (primeira visita)
 *   3. 'dark'                           (fallback seguro)
 */

import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';

// ─── Singleton state ────────────────────────────────────────────────────────

const STORAGE_KEY = 'cq-theme';

function readStorage(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

function resolveInitial(): Theme {
  return readStorage() ?? (prefersDark() ? 'dark' : 'light');
}

// Inicializa UMA vez quando o módulo é importado
let _theme: Theme = resolveInitial();
const _listeners = new Set<(t: Theme) => void>();

/** Aplica tema no DOM + persiste + notifica todos os hooks ativos */
function applyTheme(next: Theme): void {
  _theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage bloqueado — ignora */
  }

  const html = document.documentElement;
  if (next === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  _listeners.forEach((fn) => fn(next));
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTheme(): {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
} {
  const [theme, setTheme] = useState<Theme>(_theme);

  useEffect(() => {
    // Sincroniza se outro componente já alterou antes deste montar
    if (theme !== _theme) setTheme(_theme);

    _listeners.add(setTheme);
    return () => {
      _listeners.delete(setTheme);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Observa mudanças de SO em runtime — só aplica sem preferência salva
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!readStorage()) applyTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = () => applyTheme(_theme === 'dark' ? 'light' : 'dark');

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
