/**
 * QualificacaoFormModal - registrar etapa de qualificacao IQ/OQ/PQ.
 */

import React, { useCallback, useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import { criarQualificacao } from '../services/qualificacaoService';
import type { QualificacaoEtapa, QualificacaoResultado } from '../types/Qualificacao';
import { QUALIFICACAO_ETAPA_LABEL, QUALIFICACAO_RESULTADO_LABEL } from '../types/Qualificacao';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

interface QualificacaoFormModalProps {
  labId: string;
  equipamentoId: string;
  defaultEtapa?: QualificacaoEtapa;
  onClose: () => void;
  onSaved?: () => void;
}

const ETAPAS: QualificacaoEtapa[] = ['IQ', 'OQ', 'PQ'];
const RESULTADOS: QualificacaoResultado[] = ['aprovado', 'reprovado'];

export function QualificacaoFormModal({
  labId,
  equipamentoId,
  defaultEtapa,
  onClose,
  onSaved,
}: QualificacaoFormModalProps) {
  const user = useUser();

  const [etapa, setEtapa] = useState<QualificacaoEtapa>(defaultEtapa || 'IQ');
  const [resultado, setResultado] = useState<QualificacaoResultado>('aprovado');
  const [dataRealizacao, setDataRealizacao] = useState(new Date().toISOString().split('T')[0]);
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!user) return;

    if (!dataRealizacao) {
      setError('Data de realizacao e obrigatoria.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await criarQualificacao(labId, equipamentoId, {
        etapa,
        resultado,
        dataRealizacao: new Date(dataRealizacao + 'T12:00:00'),
        responsavelId: user.uid,
        responsavelNome: user.displayName || user.email || 'Operador',
        observacoes: observacoes.trim() || undefined,
        documentoIds: [],
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar qualificacao.');
    } finally {
      setSubmitting(false);
    }
  }, [user, labId, equipamentoId, etapa, resultado, dataRealizacao, observacoes, onClose, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white dark:bg-[#141820] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.06]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white/90">
            Registrar Qualificacao
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
            DICQ 5.3.1.2 - Qualificacao de equipamentos
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Etapa
            </label>
            <select
              value={etapa}
              onChange={(e) => setEtapa(e.target.value as QualificacaoEtapa)}
              className={INPUT_CLS}
              disabled={submitting}
            >
              {ETAPAS.map((e) => (
                <option key={e} value={e}>{QUALIFICACAO_ETAPA_LABEL[e]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Resultado
            </label>
            <div className="flex gap-3">
              {RESULTADOS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resultado"
                    value={r}
                    checked={resultado === r}
                    onChange={() => setResultado(r)}
                    disabled={submitting}
                    className="w-4 h-4 text-violet-600"
                  />
                  <span className={`text-sm ${r === 'aprovado' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {QUALIFICACAO_RESULTADO_LABEL[r]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Data de realizacao
            </label>
            <input
              type="date"
              value={dataRealizacao}
              onChange={(e) => setDataRealizacao(e.target.value)}
              className={INPUT_CLS}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Observacoes (opcional)
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes da qualificacao, desvios encontrados..."
              rows={3}
              className={INPUT_CLS + ' resize-none'}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/[0.06] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
