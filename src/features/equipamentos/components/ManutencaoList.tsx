/**
 * ManutencaoList — manutenções do equipamento em tempo real + badge de calibração (equipamento).
 *
 * Dados: `useManutencoes`. Status de calibração: `useCalibracaoStatus` + `CalibracaoBadge` (sem duplicar derivação).
 */

import React, { useCallback, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { doc, getFirestore, updateDoc, Timestamp as FsTimestamp } from 'firebase/firestore';

import { useCalibracaoStatus } from '../hooks/useCalibracaoStatus';
import { useManutencoes } from '../hooks/useManutencoes';
import type { ManutencaoPreventiva, ManutencaoStatus } from '../types/ManutencaoPreventiva';
import { CalibracaoBadge } from './CalibracaoBadge';

const STATUS_ROW: Record<ManutencaoStatus, { label: string; cls: string }> = {
  agendada: {
    label: 'Agendada',
    cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
  },
  realizada: {
    label: 'Realizada',
    cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
  },
  cancelada: {
    label: 'Cancelada',
    cls: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400',
  },
};

const TIPO_LABEL: Record<ManutencaoPreventiva['tipo'], string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
};

const CHIP = `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border`;

function formatData(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('pt-BR');
}

export interface ManutencaoListProps {
  labId: string | null;
  equipamentoId: string | null;
  /** Próxima calibração do equipamento — quando ausente, o badge de calibração não é exibido. */
  proximaCalibracao?: Timestamp;
  /**
   * Quando true, não renderiza o badge no cabeçalho da lista (ex.: `EquipamentoDetail` mostra
   * `CalibracaoBadge` acima com o mesmo `useCalibracaoStatus`).
   */
  omitCalibracaoBadge?: boolean;
}

export function ManutencaoList({
  labId,
  equipamentoId,
  proximaCalibracao,
  omitCalibracaoBadge = false,
}: ManutencaoListProps) {
  const { manutencoes, loading, error } = useManutencoes({ labId, equipamentoId });
  const { calibracaoStatus } = useCalibracaoStatus(proximaCalibracao);
  const showCalibracaoBadge = !omitCalibracaoBadge && proximaCalibracao != null;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editDataPrevista, setEditDataPrevista] = useState('');
  const [editFornecedor, setEditFornecedor] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback((m: ManutencaoPreventiva) => {
    setEditingId(m.id);
    setEditDescricao(m.descricao);
    setEditDataPrevista(m.dataPrevista.toDate().toISOString().split('T')[0]);
    setEditFornecedor(m.fornecedorNome || '');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!labId || !equipamentoId || !editingId) return;
    setSaving(true);
    try {
      const db = getFirestore();
      const ref = doc(db, 'labs', labId, 'equipamentos', equipamentoId, 'manutencoes', editingId);
      await updateDoc(ref, {
        descricao: editDescricao.trim(),
        dataPrevista: FsTimestamp.fromDate(new Date(editDataPrevista + 'T12:00:00')),
        ...(editFornecedor.trim() && { fornecedorNome: editFornecedor.trim() }),
        updatedAt: FsTimestamp.now(),
      });
      setEditingId(null);
    } catch (err) {
      console.error('Erro ao editar manutencao:', err);
    } finally {
      setSaving(false);
    }
  }, [labId, equipamentoId, editingId, editDescricao, editDataPrevista, editFornecedor]);

  const marcarRealizada = useCallback(
    async (m: ManutencaoPreventiva) => {
      if (!labId || !equipamentoId) return;
      try {
        const db = getFirestore();
        const ref = doc(db, 'labs', labId, 'equipamentos', equipamentoId, 'manutencoes', m.id);
        await updateDoc(ref, {
          status: 'realizada',
          dataRealizada: FsTimestamp.now(),
          updatedAt: FsTimestamp.now(),
        });
      } catch (err) {
        console.error('Erro ao marcar realizada:', err);
      }
    },
    [labId, equipamentoId],
  );

  const cancelarManutencao = useCallback(
    async (m: ManutencaoPreventiva) => {
      if (!labId || !equipamentoId) return;
      try {
        const db = getFirestore();
        const ref = doc(db, 'labs', labId, 'equipamentos', equipamentoId, 'manutencoes', m.id);
        await updateDoc(ref, {
          status: 'cancelada',
          updatedAt: FsTimestamp.now(),
        });
      } catch (err) {
        console.error('Erro ao cancelar:', err);
      }
    },
    [labId, equipamentoId],
  );

  return (
    <section
      aria-labelledby="manutencao-list-title"
      className="rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30">
            Equipamento
          </p>
          <h3
            id="manutencao-list-title"
            className="text-sm font-semibold text-slate-900 dark:text-white/90"
          >
            Manutenções
          </h3>
        </div>
        {showCalibracaoBadge ? <CalibracaoBadge calibracaoStatus={calibracaoStatus} /> : null}
      </header>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-white/40">
          Carregando manutenções…
        </p>
      ) : error ? (
        <p className="py-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : manutencoes.length === 0 ? (
        <div className="border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl py-8 px-4 text-center">
          <p className="text-sm text-slate-600 dark:text-white/55">
            Nenhuma manutenção registrada.
          </p>
          <p className="text-xs text-slate-500 dark:text-white/35 mt-1">
            Agendamentos e registros aparecem aqui em tempo real.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {manutencoes.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02] px-3 py-2.5"
            >
              {editingId === m.id ? (
                /* Modo edição inline */
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editDescricao}
                    onChange={(e) => setEditDescricao(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-xs text-slate-900 dark:text-white/90"
                    placeholder="Descricao"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={editDataPrevista}
                      onChange={(e) => setEditDataPrevista(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-xs text-slate-900 dark:text-white/90"
                    />
                    <input
                      type="text"
                      value={editFornecedor}
                      onChange={(e) => setEditFornecedor(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09] text-xs text-slate-900 dark:text-white/90"
                      placeholder="Fornecedor"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2.5 py-1 text-[11px] text-slate-500 hover:text-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={saving || !editDescricao.trim()}
                      className="px-3 py-1 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-40"
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Modo visualização */
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 dark:text-white/85 truncate">
                      {m.descricao}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
                      {TIPO_LABEL[m.tipo]} · prevista {formatData(m.dataPrevista)}
                      {m.dataRealizada ? ` · realizada ${formatData(m.dataRealizada)}` : ''}
                      {m.fornecedorNome ? ` · ${m.fornecedorNome}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-white/35 mt-0.5 truncate">
                      {m.responsavelNome}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`${CHIP} ${STATUS_ROW[m.status].cls}`}>
                      {STATUS_ROW[m.status].label}
                    </span>
                    {m.status === 'agendada' && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          title="Editar"
                          className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => void marcarRealizada(m)}
                          title="Marcar como realizada"
                          className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => void cancelarManutencao(m)}
                          title="Cancelar manutencao"
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
