/**
 * ManutencaoFormModal - agendar manutencao preventiva ou registrar corretiva.
 */

import React, { useCallback, useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { ManutencaoPreventiva } from '../types/ManutencaoPreventiva';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

interface ManutencaoFormModalProps {
  labId: string;
  equipamentoId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function ManutencaoFormModal({
  labId,
  equipamentoId,
  onClose,
  onSaved,
}: ManutencaoFormModalProps) {
  const user = useUser();

  const [tipo, setTipo] = useState<'preventiva' | 'corretiva'>('preventiva');
  const [descricao, setDescricao] = useState('');
  const [dataPrevista, setDataPrevista] = useState(new Date().toISOString().split('T')[0]);
  const [dataRealizada, setDataRealizada] = useState('');
  const [status, setStatus] = useState<'agendada' | 'realizada'>('agendada');
  const [observacoes, setObservacoes] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [custo, setCusto] = useState<number | ''>('');
  const [pecasSubstituidas, setPecasSubstituidas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!user) return;

    if (!descricao.trim()) {
      setError('Descricao e obrigatoria.');
      return;
    }
    if (!dataPrevista) {
      setError('Data prevista e obrigatoria.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const db = getFirestore();
      const col = collection(db, 'labs', labId, 'equipamentos', equipamentoId, 'manutencoes');

      const data: Omit<ManutencaoPreventiva, 'id'> = {
        labId,
        equipamentoId,
        tipo,
        descricao: descricao.trim(),
        responsavelId: user.uid,
        responsavelNome: user.displayName || user.email || 'Operador',
        dataPrevista: Timestamp.fromDate(new Date(dataPrevista + 'T12:00:00')),
        ...(dataRealizada && { dataRealizada: Timestamp.fromDate(new Date(dataRealizada + 'T12:00:00')) }),
        status,
        ...(observacoes.trim() && { observacoes: observacoes.trim() }),
        ...(fornecedorNome.trim() && { fornecedorNome: fornecedorNome.trim() }),
        ...(typeof custo === 'number' && { custo }),
        ...(pecasSubstituidas.trim() && { pecasSubstituidas: pecasSubstituidas.trim() }),
        criadoEm: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(col, data);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar manutencao.');
    } finally {
      setSubmitting(false);
    }
  }, [user, labId, equipamentoId, tipo, descricao, dataPrevista, dataRealizada, status, observacoes, onClose, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white dark:bg-[#141820] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.06]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white/90">
            Registrar Manutencao
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
            Agende preventiva ou registre corretiva realizada
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-2">
              Tipo
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="preventiva"
                  checked={tipo === 'preventiva'}
                  onChange={() => setTipo('preventiva')}
                  disabled={submitting}
                  className="w-4 h-4 text-violet-600"
                />
                <span className="text-sm text-slate-700 dark:text-white/70">Preventiva</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="corretiva"
                  checked={tipo === 'corretiva'}
                  onChange={() => setTipo('corretiva')}
                  disabled={submitting}
                  className="w-4 h-4 text-violet-600"
                />
                <span className="text-sm text-slate-700 dark:text-white/70">Corretiva</span>
              </label>
            </div>
          </div>

          {/* Descricao */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Descricao *
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={tipo === 'preventiva'
                ? 'Ex: Limpeza de agulha, troca de tubulacao, verificacao de pressoes...'
                : 'Ex: Substituicao da valvula de aspiracao por defeito...'
              }
              rows={3}
              className={INPUT_CLS + ' resize-none'}
              disabled={submitting}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-2">
              Status
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="agendada"
                  checked={status === 'agendada'}
                  onChange={() => setStatus('agendada')}
                  disabled={submitting}
                  className="w-4 h-4 text-violet-600"
                />
                <span className="text-sm text-amber-600 dark:text-amber-400">Agendada</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="realizada"
                  checked={status === 'realizada'}
                  onChange={() => setStatus('realizada')}
                  disabled={submitting}
                  className="w-4 h-4 text-violet-600"
                />
                <span className="text-sm text-emerald-600 dark:text-emerald-400">Realizada</span>
              </label>
            </div>
          </div>

          {/* Data prevista */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Data prevista *
            </label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className={INPUT_CLS}
              disabled={submitting}
            />
          </div>

          {/* Data realizada (se status = realizada) */}
          {status === 'realizada' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
                Data realizada
              </label>
              <input
                type="date"
                value={dataRealizada}
                onChange={(e) => setDataRealizada(e.target.value)}
                className={INPUT_CLS}
                disabled={submitting}
              />
            </div>
          )}

          {/* Observacoes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Observacoes (opcional)
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={2}
              className={INPUT_CLS + ' resize-none'}
              disabled={submitting}
            />
          </div>

          {/* Fornecedor */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Empresa / Fornecedor (DICQ 4.6)
            </label>
            <input
              type="text"
              value={fornecedorNome}
              onChange={(e) => setFornecedorNome(e.target.value)}
              placeholder="Nome da empresa que executou/executara a manutencao"
              className={INPUT_CLS}
              disabled={submitting}
            />
            <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5">
              Deve estar qualificada no cadastro de Fornecedores.
            </p>
          </div>

          {/* Custo + Pecas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
                Custo (R$)
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={custo === '' ? '' : custo}
                onChange={(e) => setCusto(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0,00"
                className={INPUT_CLS}
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
                Pecas substituidas
              </label>
              <input
                type="text"
                value={pecasSubstituidas}
                onChange={(e) => setPecasSubstituidas(e.target.value)}
                placeholder="Ex: valvula aspiracao, tubo peristaltico"
                className={INPUT_CLS}
                disabled={submitting}
              />
            </div>
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
            disabled={!descricao.trim() || submitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
