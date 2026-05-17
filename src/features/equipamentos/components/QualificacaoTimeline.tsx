/**
 * QualificacaoTimeline - timeline visual IQ -> OQ -> PQ.
 * Mostra status de cada etapa com badge e data.
 */

import React, { useState } from 'react';
import { useQualificacoes } from '../hooks/useQualificacoes';
import type { Qualificacao, QualificacaoEtapa, QualificacaoResultado } from '../types/Qualificacao';
import { QUALIFICACAO_ETAPA_LABEL, QUALIFICACAO_ETAPA_DESC, QUALIFICACAO_RESULTADO_LABEL } from '../types/Qualificacao';
import { QualificacaoFormModal } from './QualificacaoFormModal';

const ETAPAS: QualificacaoEtapa[] = ['IQ', 'OQ', 'PQ'];

const RESULTADO_STYLE: Record<QualificacaoResultado, { bg: string; text: string; border: string }> = {
  aprovado: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  reprovado: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
  pendente: { bg: 'bg-slate-500/10', text: 'text-slate-500 dark:text-white/40', border: 'border-slate-300 dark:border-white/[0.12]' },
};

interface QualificacaoTimelineProps {
  labId: string | null;
  equipamentoId: string | null;
  canMutate?: boolean;
}

export function QualificacaoTimeline({ labId, equipamentoId, canMutate = true }: QualificacaoTimelineProps) {
  const { qualificacoes, isLoading } = useQualificacoes(labId, equipamentoId);
  const [showForm, setShowForm] = useState(false);
  const [selectedEtapa, setSelectedEtapa] = useState<QualificacaoEtapa | null>(null);

  if (!labId || !equipamentoId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Agrupar por etapa (pegar a mais recente de cada)
  const etapaMap = new Map<QualificacaoEtapa, Qualificacao>();
  for (const q of qualificacoes) {
    const existing = etapaMap.get(q.etapa);
    if (!existing || q.dataRealizacao.toMillis() > existing.dataRealizacao.toMillis()) {
      etapaMap.set(q.etapa, q);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-white/30">
          Qualificacao (IQ/OQ/PQ)
        </h3>
        {canMutate && (
          <button
            type="button"
            onClick={() => { setSelectedEtapa(null); setShowForm(true); }}
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
          >
            + Registrar etapa
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="flex items-start gap-0">
        {ETAPAS.map((etapa, idx) => {
          const qual = etapaMap.get(etapa);
          const resultado: QualificacaoResultado = qual?.resultado || 'pendente';
          const style = RESULTADO_STYLE[resultado];

          return (
            <div key={etapa} className="flex-1 relative">
              {/* Connector line */}
              {idx < ETAPAS.length - 1 && (
                <div className={`absolute top-5 left-1/2 w-full h-0.5 ${qual?.resultado === 'aprovado' ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/[0.08]'}`} />
              )}

              <div className="relative flex flex-col items-center text-center px-2">
                {/* Circle */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${style.border} ${style.bg} z-10`}>
                  {resultado === 'aprovado' && (
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {resultado === 'reprovado' && (
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {resultado === 'pendente' && (
                    <span className="text-xs font-bold text-slate-400 dark:text-white/30">{etapa}</span>
                  )}
                </div>

                {/* Label */}
                <p className={`mt-2 text-xs font-semibold ${style.text}`}>
                  {etapa}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-white/35 mt-0.5 max-w-[100px]">
                  {QUALIFICACAO_RESULTADO_LABEL[resultado]}
                </p>
                {qual && (
                  <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5">
                    {qual.dataRealizacao.toDate().toLocaleDateString('pt-BR')}
                  </p>
                )}

                {/* Click to register */}
                {canMutate && resultado === 'pendente' && (
                  <button
                    type="button"
                    onClick={() => { setSelectedEtapa(etapa); setShowForm(true); }}
                    className="mt-1 text-[10px] text-violet-500 hover:text-violet-600"
                  >
                    Registrar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Descricao da etapa */}
      <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3 border border-slate-200 dark:border-white/[0.06]">
        <p className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">
          <strong>IQ:</strong> {QUALIFICACAO_ETAPA_DESC.IQ}<br />
          <strong>OQ:</strong> {QUALIFICACAO_ETAPA_DESC.OQ}<br />
          <strong>PQ:</strong> {QUALIFICACAO_ETAPA_DESC.PQ}
        </p>
      </div>

      {/* Historico completo */}
      {qualificacoes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500 dark:text-white/35 uppercase tracking-wider">
            Historico
          </p>
          {qualificacoes.map((q) => {
            const s = RESULTADO_STYLE[q.resultado];
            return (
              <div key={q.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${s.border} ${s.bg}`}>
                <span className={`text-xs font-bold ${s.text}`}>{q.etapa}</span>
                <span className={`text-xs ${s.text}`}>{QUALIFICACAO_RESULTADO_LABEL[q.resultado]}</span>
                <span className="text-[10px] text-slate-400 dark:text-white/25 ml-auto">
                  {q.responsavelNome} - {q.dataRealizacao.toDate().toLocaleDateString('pt-BR')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showForm && labId && equipamentoId && (
        <QualificacaoFormModal
          labId={labId}
          equipamentoId={equipamentoId}
          defaultEtapa={selectedEtapa || undefined}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
