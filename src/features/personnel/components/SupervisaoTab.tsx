/**
 * personnel/components/SupervisaoTab.tsx
 *
 * Lista de colaboradores em período de supervisão com progresso de checklist.
 * RDC 978/2025 Art. 122 + DICQ 4.1.2.7
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useSupervisao } from '../hooks/useSupervisao';
import { useColaboradores } from '../../educacao-continuada/hooks/useColaboradores';
import { useUser } from '../../../store/useAuthStore';
import { Timestamp } from '../../../shared/services/firebase';
import type { SupervisaoInput } from '../types/Supervisao';

const DEFAULT_CHECKLIST = [
  'Orientação sobre POPs do setor',
  'Treinamento em equipamentos críticos',
  'Avaliação de competência técnica',
  'Revisão de procedimentos de segurança',
  'Validação de resultados supervisionados',
];

export function SupervisaoTab(): React.ReactElement {
  const { supervisoes, loading, error, create, update, remove } = useSupervisao();
  const { colaboradores } = useColaboradores({ somenteAtivos: true });
  const user = useUser();
  const [showForm, setShowForm] = useState(false);
  const [formColabId, setFormColabId] = useState('');
  const [formObs, setFormObs] = useState('');
  const [saving, setSaving] = useState(false);

  const sortedColabs = useMemo(
    () => [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [colaboradores],
  );

  const handleCreate = useCallback(async () => {
    if (!formColabId || !user) return;
    setSaving(true);
    try {
      const colab = colaboradores.find((c) => c.id === formColabId);
      const input: SupervisaoInput = {
        colaboradorId: formColabId,
        colaboradorNome: colab?.nome ?? '',
        supervisorId: user.uid,
        supervisorNome: user.displayName ?? user.email ?? '',
        status: 'em_supervisao',
        dataInicioSupervisao: Timestamp.now(),
        checklistConcluido: [],
        checklistTotal: DEFAULT_CHECKLIST,
        observacoes: formObs || undefined,
      };
      await create(input);
      setShowForm(false);
      setFormColabId('');
      setFormObs('');
    } finally {
      setSaving(false);
    }
  }, [formColabId, formObs, user, colaboradores, create]);

  const handleToggleItem = useCallback(
    async (id: string, currentConcluido: string[], item: string) => {
      const updated = currentConcluido.includes(item)
        ? currentConcluido.filter((i) => i !== item)
        : [...currentConcluido, item];
      await update(id, { checklistConcluido: updated });
    },
    [update],
  );

  const handleLiberar = useCallback(
    async (id: string) => {
      await update(id, { status: 'liberado', dataLiberacao: Timestamp.now() });
    },
    [update],
  );

  const emSupervisao = useMemo(
    () => supervisoes.filter((s) => s.status === 'em_supervisao'),
    [supervisoes],
  );

  const liberados = useMemo(
    () => supervisoes.filter((s) => s.status === 'liberado'),
    [supervisoes],
  );

  const getDaysInSupervision = (dataInicio: Timestamp): number => {
    const diff = Date.now() - dataInicio.toDate().getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-200">
        Erro ao carregar supervisões: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white/90">Período de Supervisão</h3>
          <p className="mt-0.5 text-xs text-white/40">
            RDC 978 Art. 122 — Acompanhamento de novos colaboradores
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova Supervisão
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <h4 className="text-sm font-medium text-white/80">Iniciar supervisão</h4>
          <div>
            <label htmlFor="sup-colab" className="mb-1 block text-xs text-white/50">
              Colaborador
            </label>
            <select
              id="sup-colab"
              value={formColabId}
              onChange={(e) => setFormColabId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1a1a1f] px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            >
              <option value="">Selecionar...</option>
              {sortedColabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sup-obs" className="mb-1 block text-xs text-white/50">
              Observações (opcional)
            </label>
            <textarea
              id="sup-obs"
              value={formObs}
              onChange={(e) => setFormObs(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-[#1a1a1f] px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!formColabId || saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Iniciar'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-white/60 transition-colors hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Em supervisão */}
      {emSupervisao.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center">
          <p className="text-sm text-white/40">Nenhum colaborador em supervisão.</p>
        </div>
      )}

      {emSupervisao.map((sup) => {
        const progress =
          sup.checklistTotal.length > 0
            ? (sup.checklistConcluido.length / sup.checklistTotal.length) * 100
            : 0;
        const days = getDaysInSupervision(sup.dataInicioSupervisao);
        const allDone = sup.checklistConcluido.length === sup.checklistTotal.length;

        return (
          <div
            key={sup.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{sup.colaboradorNome}</p>
                <p className="text-xs text-white/50">
                  Supervisor: {sup.supervisorNome} — {days} dia{days !== 1 ? 's' : ''} em supervisão
                </p>
              </div>
              <div className="flex gap-2">
                {allDone && (
                  <button
                    type="button"
                    onClick={() => void handleLiberar(sup.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
                  >
                    Liberar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(sup.id)}
                  className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
                  aria-label={`Remover supervisão de ${sup.colaboradorNome}`}
                >
                  Remover
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Progresso</span>
                <span>
                  {sup.checklistConcluido.length}/{sup.checklistTotal.length}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-1.5">
              {sup.checklistTotal.map((item) => {
                const done = sup.checklistConcluido.includes(item);
                return (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => void handleToggleItem(sup.id, sup.checklistConcluido, item)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500"
                    />
                    <span className={done ? 'text-white/60 line-through' : 'text-white/80'}>
                      {item}
                    </span>
                  </label>
                );
              })}
            </div>

            {sup.observacoes && <p className="text-xs text-white/40 italic">{sup.observacoes}</p>}
          </div>
        );
      })}

      {/* Liberados */}
      {liberados.length > 0 && (
        <div className="space-y-3 border-t border-white/10 pt-6">
          <h4 className="text-xs font-medium uppercase tracking-wider text-white/40">
            Liberados ({liberados.length})
          </h4>
          {liberados.map((sup) => (
            <div
              key={sup.id}
              className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white/80">{sup.colaboradorNome}</p>
                <p className="text-xs text-white/40">
                  Liberado em {sup.dataLiberacao?.toDate().toLocaleDateString('pt-BR') ?? '—'}
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                Liberado
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
