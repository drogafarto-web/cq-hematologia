import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import { useCIQLots } from '../hooks/useCIQLots';
import { useSaveCIQRun } from '../hooks/useSaveCIQRun';
import { subscribeToCIQRuns } from '../services/ciqFirebaseService';
import { CIQImunoForm } from './CIQImunoForm';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 1.5l3 3-1 1 1.5 1.5-1 1L7 6.5l-3 3v-2L6.5 5l-1-1 1-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7v4M8 5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white/85">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
          >
            <XIcon />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Recent runs cross-pinned-lots hook ──────────────────────────────────────

interface EnrichedRun extends CIQImunoRun {
  _lotId: string;
  _testType: string;
  _setupType: 'principal' | 'validacao_paralela';
  _loteControle: string;
}

function useRecentBancadaRuns(pinnedLots: CIQImunoLot[], limit = 20) {
  const [runs, setRuns] = useState<EnrichedRun[]>([]);

  // Stable key triggers re-subscription only when pinned lot identity changes
  const key = pinnedLots.map((l) => l.id).join('|');

  useEffect(() => {
    if (pinnedLots.length === 0) {
      setRuns([]);
      return;
    }

    const perLot = new Map<string, EnrichedRun[]>();

    const unsubs = pinnedLots.map((lot) =>
      subscribeToCIQRuns(lot.labId, lot.id, (incoming) => {
        perLot.set(
          lot.id,
          incoming.map((r) => ({
            ...r,
            _lotId: lot.id,
            _testType: lot.testType,
            _setupType: lot.setupType as 'principal' | 'validacao_paralela',
            _loteControle: lot.loteControle,
          })),
        );
        const merged = Array.from(perLot.values())
          .flat()
          .sort((a, b) => (b.dataRealizacao ?? '').localeCompare(a.dataRealizacao ?? ''))
          .slice(0, limit);
        setRuns(merged);
      }),
    );

    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit]);

  return runs;
}

// ─── Bancada View ─────────────────────────────────────────────────────────────

export function BancadaImunoView({ onGoToLotes }: { onGoToLotes: () => void }) {
  const { lots, isLoading } = useCIQLots();
  const user = useUser();
  const { save, isSaving } = useSaveCIQRun();

  const pinnedLots = useMemo(
    () =>
      lots.filter(
        (l) => l.setupType === 'principal' || l.setupType === 'validacao_paralela',
      ),
    [lots],
  );

  const recentRuns = useRecentBancadaRuns(pinnedLots, 20);

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formPrefill, setFormPrefill] = useState<CIQImunoLot | null>(null);

  const validacaoLots = pinnedLots.filter((l) => l.setupType === 'validacao_paralela');
  const oficialCount = pinnedLots.filter((l) => l.setupType === 'principal').length;

  async function handleSave(
    data: CIQImunoFormData,
    options?: import('../hooks/useSaveCIQRun').SaveCIQRunOptions,
  ) {
    setFormError(null);
    try {
      await save(data, options);
      setShowForm(false);
      setFormPrefill(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar corrida.');
    }
  }

  function openFormForLot(lot: CIQImunoLot) {
    setFormError(null);
    setFormPrefill(lot);
    setShowForm(true);
  }

  function openFormBlank() {
    setFormError(null);
    // Se há exatamente 1 setup vinculado, pré-preencher; senão, abrir em branco
    setFormPrefill(pinnedLots.length === 1 ? pinnedLots[0] : null);
    setShowForm(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <svg className="animate-spin w-5 h-5 text-slate-300 dark:text-white/20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
          <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Bancada de Imunoensaios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            {pinnedLots.length === 0
              ? 'Nenhum setup vinculado — vincule um lote em Gestão de Lotes.'
              : `${pinnedLots.length} setup${pinnedLots.length !== 1 ? 's' : ''} vinculado${pinnedLots.length !== 1 ? 's' : ''}${oficialCount > 0 ? ` · ${oficialCount} oficial${oficialCount !== 1 ? 'is' : ''}` : ''}${validacaoLots.length > 0 ? ` · ${validacaoLots.length} em validação` : ''}`}
          </p>
        </div>
        <div className="ml-auto">
          {pinnedLots.length > 0 ? (
            <button
              type="button"
              onClick={openFormBlank}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
            >
              <PlusIcon /> Registrar Corrida
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoToLotes}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              <PinIcon /> Vincular um lote
            </button>
          )}
        </div>
      </div>

      {/* Banner — lotes em validação */}
      {validacaoLots.length > 0 && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-500/25 bg-blue-50/80 dark:bg-blue-500/[0.06] px-5 py-4 flex items-start gap-3">
          <span className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0">
            <InfoIcon />
          </span>
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Lote{validacaoLots.length !== 1 ? 's' : ''} em validação na bancada
            </p>
            <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-1 leading-relaxed">
              {validacaoLots.length === 1
                ? `${validacaoLots[0].testType} · ${validacaoLots[0].loteControle}`
                : `${validacaoLots.map((l) => l.testType).join(', ')}`}{' '}
              — corridas registradas hoje contarão para a aprovação formal{' '}
              {validacaoLots.length !== 1 ? 'destes lotes' : 'deste lote'} (RDC 786).
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {pinnedLots.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] px-8 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400 mx-auto">
            <PinIcon />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-white/75 mt-4">
            Bancada vazia
          </p>
          <p className="text-xs text-slate-500 dark:text-white/40 mt-1.5 max-w-md mx-auto leading-relaxed">
            A bancada mostra os lotes vinculados como Setup Oficial ou Em Validação. Vá em
            Gestão de Lotes, escolha um lote e clique em <span className="font-medium">Vincular</span>.
          </p>
          <button
            type="button"
            onClick={onGoToLotes}
            className="mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
          >
            Ir para Gestão de Lotes
          </button>
        </div>
      )}

      {/* 2-column layout: Setups + Corridas Recentes */}
      {pinnedLots.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Setups vinculados */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-emerald-500 dark:text-emerald-400">
                <PinIcon />
              </span>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-white/45">
                Setups Vinculados
              </h2>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-white/40">
                {pinnedLots.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {pinnedLots.map((lot) => {
                const isPrincipal = lot.setupType === 'principal';
                return (
                  <div
                    key={lot.id}
                    className={`relative rounded-xl border p-4 transition-all ${
                      isPrincipal
                        ? 'border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-500/[0.05]'
                        : 'border-blue-200 dark:border-blue-500/25 bg-blue-50/40 dark:bg-blue-500/[0.05]'
                    }`}
                  >
                    <span
                      className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${isPrincipal ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[10px] font-bold uppercase tracking-wider ${isPrincipal ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}`}
                        >
                          {isPrincipal ? 'Setup Oficial' : 'Em Validação'}
                        </p>
                        <p className="text-base font-semibold text-slate-800 dark:text-white/90 truncate mt-0.5">
                          {lot.testType}
                        </p>
                        <p className="text-[12px] text-slate-500 dark:text-white/45 font-mono truncate">
                          Lote: {lot.loteControle}
                        </p>
                        {lot.pinnedBy && (
                          <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1.5">
                            Vinculado por {lot.pinnedBy.slice(0, 16)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openFormForLot(lot)}
                        className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold transition-all ${
                          isPrincipal
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      >
                        <PlusIcon /> Corrida
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Corridas recentes */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-white/45 mb-3">
              Corridas Recentes
            </h2>
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
              {recentRuns.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-white/30 px-5 py-10 text-center">
                  Nenhuma corrida registrada nos lotes vinculados.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {recentRuns.map((run) => {
                    const conforme = run.resultadoObtido === run.resultadoEsperado;
                    return (
                      <div
                        key={`${run._lotId}-${run.id}`}
                        className="px-4 py-3 flex items-center gap-3"
                      >
                        <div className="text-[11px] font-mono text-slate-500 dark:text-white/45 tabular-nums w-14 shrink-0">
                          {run.dataRealizacao?.slice(5) ?? ''}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-medium text-slate-800 dark:text-white/85 truncate">
                              {run._testType}
                            </span>
                            {run._setupType === 'validacao_paralela' && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                Validação
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-white/35 truncate mt-0.5">
                            {run.operatorName ?? '—'} · Lote {run._loteControle}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${
                            conforme
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25'
                              : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25'
                          }`}
                        >
                          {conforme ? <CheckIcon /> : <XIcon />}
                          {conforme ? 'Conforme' : 'Rejeitada'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Modal: Registrar corrida */}
      {showForm && (
        <Modal
          title={formPrefill ? 'Registrar corrida (lote vinculado)' : 'Registrar corrida'}
          onClose={() => {
            setShowForm(false);
            setFormPrefill(null);
          }}
        >
          {formError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/[0.07] border border-red-200 dark:border-red-400/20 text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}
          <CIQImunoForm
            onSave={handleSave}
            isSaving={isSaving}
            onCancel={() => {
              setShowForm(false);
              setFormPrefill(null);
            }}
            {...(formPrefill && { prefillFromLot: formPrefill })}
          />
        </Modal>
      )}
    </div>
  );
}
