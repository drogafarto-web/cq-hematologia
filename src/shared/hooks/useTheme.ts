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

import { useEffect, useSyncExternalStore } from 'react';

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
const _listeners = new Set<() => void>();

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

  _listeners.forEach((fn) => fn());
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Subscribe function for useSyncExternalStore — shared across all hook instances. */
function subscribe(onChange: () => void): () => void {
  _listeners.add(onChange);
  return () => {
    _listeners.delete(onChange);
  };
}

function getSnapshot(): Theme {
  return _theme;
}

export function useTheme(): {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
} {
  // Canonical React 18+ pattern for external store subscription — elimina
  // o setState-in-effect do padrão antigo (useState + useEffect sync).
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

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
