/**
 * RisksView.tsx — Risks module entry point
 *
 * Layout:
 *   - Sticky topbar (← Hub, title, lab badge)
 *   - KPI strip (ativos, críticos, alto, mitigando, vencendo revisão)
 *   - Tabs: [Registro | Matriz | Top 5 | Revisões]
 *   - Tab content: RiskRegister, RiskMatrix, Top5RisksWidget, ReviewHistory
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeRisks } from '../services/risksService';
import type { Risk } from '../types/Risk';
import { RiskRegister } from './RiskRegister';
import { RiskMatrix } from './RiskMatrix';
import { Top5RisksWidget } from './Top5RisksWidget';
import { ReviewHistory } from './ReviewHistory';

export const RisksView: React.FC = () => {
  const labId = useActiveLabId();
  const [activeTab, setActiveTab] = useState<'registro' | 'matriz' | 'top5' | 'revisoes'>('registro');
  const [risks, setRisks] = useState<Risk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  // Firestore subscription
  useEffect(() => {
    if (!labId) return;

    setIsLoading(true);
    setError(null);
    let firstSnapshot = true;

    const unsub = subscribeRisks(
      labId,
      {},
      (incoming) => {
        setRisks(incoming);
        if (firstSnapshot) {
          setIsLoading(false);
          firstSnapshot = false;
        }
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      }
    );

    return unsub;
  }, [labId]);

  // KPI calculations
  const kpis = useMemo(() => {
    const active = risks.filter(r => !r.deletadoEm && r.status !== 'fechado');
    const criticos = active.filter(r => r.nivel === 'critico');
    const altos = active.filter(r => r.nivel === 'alto');
    const mitigando = active.filter(r => r.status === 'mitigando');
    const now = new Date();
    const vencendo = active.filter(r => r.reviewDate && new Date(r.reviewDate) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

    return {
      total: active.length,
      criticos: criticos.length,
      altos: altos.length,
      mitigando: mitigando.length,
      vencendo: vencendo.length,
    };
  }, [risks]);

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

      {/* ─── KPI strip ────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          <div>
            <div className="text-lg font-semibold text-white">{isLoading ? '—' : kpis.total}</div>
            <div className="text-xs text-white/50">Ativos</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-red-500">{isLoading ? '—' : kpis.criticos}</div>
            <div className="text-xs text-white/50">Críticos</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-orange-500">{isLoading ? '—' : kpis.altos}</div>
            <div className="text-xs text-white/50">Alto</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-amber-500">{isLoading ? '—' : kpis.mitigando}</div>
            <div className="text-xs text-white/50">Mitigando</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-yellow-600">{isLoading ? '—' : kpis.vencendo}</div>
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

      {/* ─── Tab content ──────────────────────────────────────────────────── */}
      <div>
        {activeTab === 'registro' && (
          <RiskRegister
            risks={risks}
            isLoading={isLoading}
            error={error}
            onRefresh={() => labId && subscribeRisks(labId, {}, setRisks)}
          />
        )}
        {activeTab === 'matriz' && (
          <RiskMatrix risks={risks} />
        )}
        {activeTab === 'top5' && (
          <Top5RisksWidget risks={risks} onRiskClick={setSelectedRisk} />
        )}
        {activeTab === 'revisoes' && selectedRisk ? (
          <div className="p-4">
            <div className="mb-4">
              <button
                onClick={() => setSelectedRisk(null)}
                className="text-sm text-white/60 hover:text-white/80"
              >
                ← Voltar para Top 5
              </button>
            </div>
            <ReviewHistory risk={selectedRisk} />
          </div>
        ) : activeTab === 'revisoes' ? (
          <div className="p-4 text-center text-white/50">
            Selecione um risco em "Top 5" para ver histórico de revisões
          </div>
        ) : null}
      </div>
    </div>
  );
};
