/**
 * RisksView.tsx — Risks module entry point
 *
 * Layout:
 *   - Sticky topbar (← Hub, title, lab badge)
 *   - KPI strip (total ativos, criticos, alto, em tratamento, vencendo revisão)
 *   - Tabs: [Registro | Matriz | Top 5 | Revisões]
 *   - Tab content (components TBD in T7)
 *
 * T9 shell integration: registers lazy route + tile in Hub.
 */

import React, { useState } from 'react';

export const RisksView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'registro' | 'matriz' | 'top5' | 'revisoes'>('registro');

  return (
    <div className="min-h-screen bg-[#141417]">
      {/* ─── Sticky topbar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#141417]/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <a href="/hub" className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">Gestão de Riscos</h1>
            <p className="text-xs text-white/50">FMEA-Lite • RDC 978 Art. 86</p>
          </div>
        </div>
      </div>

      {/* ─── KPI strip (stub) ─────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          <div>
            <div className="text-lg font-semibold text-white">—</div>
            <div className="text-xs text-white/50">Ativos</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-red-500">—</div>
            <div className="text-xs text-white/50">Críticos</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-orange-500">—</div>
            <div className="text-xs text-white/50">Alto</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-amber-500">—</div>
            <div className="text-xs text-white/50">Mitigando</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-yellow-600">—</div>
            <div className="text-xs text-white/50">Vencendo</div>
          </div>
        </div>
      </div>

      {/* ─── Tab navigation ───────────────────────────────────────────────── */}
      <div className="border-b border-white/10">
        <div className="flex gap-1 px-4">
          {(['registro', 'matriz', 'top5', 'revisoes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-emerald-500 text-emerald-500'
                  : 'border-transparent text-white/60 hover:text-white/80'
              }`}
            >
              {{
                registro: 'Registro',
                matriz: 'Matriz',
                top5: 'Top 5',
                revisoes: 'Revisões',
              }[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab content (stub) ──────────────────────────────────────────── */}
      <div className="p-4">
        {activeTab === 'registro' && (
          <div className="text-white/60 text-sm">
            Registro de riscos (RiskRegister component — T7)
          </div>
        )}
        {activeTab === 'matriz' && (
          <div className="text-white/60 text-sm">
            Matriz 5×5 de probabilidade × severidade (RiskMatrix component — T7)
          </div>
        )}
        {activeTab === 'top5' && (
          <div className="text-white/60 text-sm">
            Top 5 riscos críticos por NPR (Top5RisksWidget component — T7)
          </div>
        )}
        {activeTab === 'revisoes' && (
          <div className="text-white/60 text-sm">
            Histórico de revisões periódicas (ReviewHistory component — T7)
          </div>
        )}
      </div>
    </div>
  );
};
