/**
 * RisksView.tsx — Risks module entry point
 *
 * Layout:
 *   - Sticky topbar (← Hub, title, lab badge)
 *   - KPI strip (ativos, críticos, alto, mitigando, vencendo revisão)
 *   - Tabs: [Registro | Matriz | Top 5 | Revisões]
 *   - Tab content: RiskRegister, RiskMatrix, Top5RisksWidget, ReviewHistory
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FirebaseError } from 'firebase/app';
import { useActiveLabId } from '../../../store/useAuthStore';
import { functions, httpsCallable } from '../../../shared/services/firebase';
import { toast } from '../../../shared/store/useToastStore';
import { subscribeRisks } from '../services/risksService';
import type { Risk } from '../types/Risk';
import { RiskRegister } from './RiskRegister';
import { RiskHeatmap } from './RiskHeatmap';
import { RiskDashboard } from './RiskDashboard';
import { Top5RisksWidget } from './Top5RisksWidget';
import { ReviewHistory } from './ReviewHistory';

const callGenerateRiskMatrixPDF = httpsCallable<{ labId: string }, { url: string }>(
  functions,
  'generateRiskMatrixPDF',
);

export const RisksView: React.FC = () => {
  const labId = useActiveLabId();
  const [activeTab, setActiveTab] = useState<'registro' | 'matriz' | 'top5' | 'revisoes'>(
    'registro',
  );
  const [risks, setRisks] = useState<Risk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

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
      },
    );

    return unsub;
  }, [labId]);

  // KPI calculations
  const kpis = useMemo(() => {
    const active = risks.filter((r) => !r.deletadoEm && r.status !== 'fechado');
    const criticos = active.filter((r) => r.nivel === 'critico');
    const altos = active.filter((r) => r.nivel === 'alto');
    const mitigando = active.filter((r) => r.status === 'mitigando');
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const vencendo = active.filter((r) => {
      if (!r.reviewDate) return false;
      const reviewDateObj =
        r.reviewDate instanceof Date
          ? r.reviewDate
          : typeof r.reviewDate === 'object' && 'toDate' in r.reviewDate
            ? (r.reviewDate as any).toDate()
            : new Date(r.reviewDate);
      return reviewDateObj < thirtyDaysFromNow;
    });

    return {
      total: active.length,
      criticos: criticos.length,
      altos: altos.length,
      mitigando: mitigando.length,
      vencendo: vencendo.length,
    };
  }, [risks]);

  const handleExportRiskMatrixPdf = useCallback(async () => {
    if (!labId) return;
    setPdfExporting(true);
    try {
      const result = await callGenerateRiskMatrixPDF({ labId });
      const url = result.data?.url;
      if (!url) {
        toast.error('Resposta sem URL do PDF.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('PDF gerado. Abrindo em nova aba.');
    } catch (e) {
      const msg =
        e instanceof FirebaseError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Falha ao gerar PDF.';
      toast.error(msg);
    } finally {
      setPdfExporting(false);
    }
  }, [labId]);

  return (
    <div className="min-h-screen bg-[#141417]">
      {/* ─── Sticky topbar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#141417]/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <a href="/hub" className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <svg
              className="w-5 h-5 text-white/70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </a>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white">Gestão de Riscos</h1>
            <p className="text-xs text-white/50">FMEA-Lite • RDC 978 Art. 86</p>
          </div>
          <button
            type="button"
            onClick={() => void handleExportRiskMatrixPdf()}
            disabled={!labId || pdfExporting}
            aria-label="Exportar mapa de riscos em PDF"
            className="shrink-0 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/90 transition-colors hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:pointer-events-none disabled:opacity-40"
          >
            {pdfExporting ? 'Gerando…' : 'Exportar Mapa de Riscos (PDF)'}
          </button>
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
            <div className="text-lg font-semibold text-red-500">
              {isLoading ? '—' : kpis.criticos}
            </div>
            <div className="text-xs text-white/50">Críticos</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-orange-500">
              {isLoading ? '—' : kpis.altos}
            </div>
            <div className="text-xs text-white/50">Alto</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-amber-500">
              {isLoading ? '—' : kpis.mitigando}
            </div>
            <div className="text-xs text-white/50">Mitigando</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-yellow-600">
              {isLoading ? '—' : kpis.vencendo}
            </div>
            <div className="text-xs text-white/50">Vencendo</div>
          </div>
        </div>
      </div>

      <RiskDashboard risks={risks} labId={labId} isLoadingRisks={isLoading} />

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
              {
                {
                  registro: 'Registro',
                  matriz: 'Matriz',
                  top5: 'Top 5',
                  revisoes: 'Revisões',
                }[tab]
              }
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
          <div className="p-4">
            <RiskHeatmap risks={risks} />
          </div>
        )}
        {activeTab === 'top5' && <Top5RisksWidget risks={risks} onRiskClick={setSelectedRisk} />}
        {activeTab === 'revisoes' && selectedRisk ? (
          <div className="p-4">
            <div className="mb-4">
              <button
                onClick={() => setSelectedRisk(null)}
                className="text-sm text-white/60 hover:text-white/80"
              >
                ← Voltar
              </button>
            </div>
            <ReviewHistory risk={selectedRisk} />
          </div>
        ) : activeTab === 'revisoes' ? (
          <div className="p-4 space-y-3">
            <p className="text-xs text-white/50 mb-3">
              Riscos com revisão periódica próxima ou vencida. Clique para ver histórico.
            </p>
            {risks
              .filter((r) => !r.deletadoEm && r.status !== 'fechado')
              .sort((a, b) => {
                const aDate =
                  a.reviewDate instanceof Date
                    ? a.reviewDate
                    : (a.reviewDate as any)?.toDate?.() || new Date('2099-01-01');
                const bDate =
                  b.reviewDate instanceof Date
                    ? b.reviewDate
                    : (b.reviewDate as any)?.toDate?.() || new Date('2099-01-01');
                return aDate.getTime() - bDate.getTime();
              })
              .slice(0, 10)
              .map((risk) => {
                const reviewDateObj =
                  risk.reviewDate instanceof Date
                    ? risk.reviewDate
                    : (risk.reviewDate as any)?.toDate?.() || null;
                const isOverdue = reviewDateObj && reviewDateObj < new Date();
                return (
                  <div
                    key={risk.id}
                    onClick={() => setSelectedRisk(risk)}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors hover:bg-white/[0.03] ${
                      isOverdue
                        ? 'border-red-500/30 bg-red-500/[0.04]'
                        : 'border-white/10 bg-white/[0.01]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-white/50">{risk.codigo}</span>
                        <span className="text-sm text-white/80 truncate max-w-xs">
                          {risk.descricao}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        {reviewDateObj && (
                          <span
                            className={`text-xs ${isOverdue ? 'text-red-400 font-medium' : 'text-white/50'}`}
                          >
                            {isOverdue ? 'Vencida: ' : 'Próxima: '}
                            {reviewDateObj.toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : null}
      </div>
    </div>
  );
};
