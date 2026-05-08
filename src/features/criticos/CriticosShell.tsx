/**
 * CriticosShell — Phase 10-03 production shell for Valores Críticos.
 *
 * Replaces the legacy placeholder. Two tabs:
 *   - Escalações: real-time list of pending + recent escalations
 *   - Limites:    threshold CRUD (RT/admin/owner only on the server side)
 *
 * Routes deeper navigation through hash-style state to keep the shell self-
 * contained — the parent module hub doesn't need to know about subviews.
 */

import { useState } from 'react';
import { CriticosEscalacaoList } from './components/CriticosEscalacaoList';
import { CriticosThresholdsAdmin } from './components/CriticosThresholdsAdmin';

type Tab = 'escalacoes' | 'limites';

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: 'escalacoes',
    label: 'Escalações',
    description: 'Pendentes e histórico recente',
  },
  {
    id: 'limites',
    label: 'Limites críticos',
    description: 'Configuração por analito',
  },
];

export default function CriticosShell() {
  const [tab, setTab] = useState<Tab>('escalacoes');

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0c0c0c]/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] px-8 py-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                Phase 10 · Valores críticos
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                Comunicação de resultados críticos
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-white/50">
                Detecção, escalação e reconhecimento de valores que exigem
                comunicação imediata ao médico solicitante. Conformidade RDC
                978/2025 Art. 5.7.1 e DICQ 4.3.
              </p>
            </div>
          </div>

          <nav
            role="tablist"
            aria-label="Seções do módulo Críticos"
            className="mt-6 flex gap-1"
          >
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`tab-${t.id}`}
                  id={`tab-trigger-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={
                    'group relative rounded-md px-4 py-2 text-sm font-medium ' +
                    'transition-colors duration-150 ' +
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 ' +
                    'motion-reduce:transition-none ' +
                    (active
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]')
                  }
                >
                  {t.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-[7px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-8 py-8">
        <div
          key={tab}
          role="tabpanel"
          id={`tab-${tab}`}
          aria-labelledby={`tab-trigger-${tab}`}
          className="motion-safe:animate-[fadeIn_180ms_ease-out]"
        >
          {tab === 'escalacoes' ? (
            <CriticosEscalacaoList />
          ) : (
            <CriticosThresholdsAdmin />
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
