import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import { useCIQLots } from '../hooks/useCIQLots';
import { useCIQRuns } from '../hooks/useCIQRuns';
import { useSaveCIQRun } from '../hooks/useSaveCIQRun';
import { subscribeToCIQRuns } from '../services/ciqFirebaseService';
import { CIQAuditor } from './CIQAuditor';
import { CIQImunoForm } from './CIQImunoForm';
import { CIQRelatorioPrint } from './CIQRelatorioPrint';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import type { CIQImunoLot, CIQImunoRun } from '../types/CIQImuno';

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M6.5 1.5l3 3-1 1 1.5 1.5-1 1L7 6.5l-3 3v-2L6.5 5l-1-1 1-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
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
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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

// ─── Recent runs cross-lot hook ──────────────────────────────────────────────
// Assina todos os lots do laboratório (pinned ou não) — operador precisa ver
// a corrida que acabou de gravar mesmo se o lote ainda não foi vinculado à
// bancada (ex: validação inicial de novo lote).

interface EnrichedRun extends CIQImunoRun {
  _lotId: string;
  _testType: string;
  _setupType?: 'principal' | 'validacao_paralela';
  _loteControle: string;
}

function useRecentBancadaRuns(lots: CIQImunoLot[], limit = 20) {
  const [runs, setRuns] = useState<EnrichedRun[]>([]);

  const key = lots.map((l) => l.id).join('|');

  useEffect(() => {
    if (lots.length === 0) {
      setRuns([]);
      return;
    }

    const perLot = new Map<string, EnrichedRun[]>();

    const unsubs = lots.map((lot) =>
      subscribeToCIQRuns(lot.labId, lot.id, (incoming) => {
        perLot.set(
          lot.id,
          incoming.map((r) => ({
            ...r,
            _lotId: lot.id,
            _testType: lot.testType,
            ...(lot.setupType && { _setupType: lot.setupType }),
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
    () => lots.filter((l) => l.setupType === 'principal' || l.setupType === 'validacao_paralela'),
    [lots],
  );

  const recentRuns = useRecentBancadaRuns(lots, 20);

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formPrefill, setFormPrefill] = useState<CIQImunoLot | null>(null);
  const [selectedRun, setSelectedRun] = useState<EnrichedRun | null>(null);
  const [printLot, setPrintLot] = useState<CIQImunoLot | null>(null);

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
    // Sempre abre em branco — auto-prefill com o único lote pinned bloqueia
    // o operador quando ele quer registrar corrida em um lote ainda NÃO
    // vinculado (ex: validação inicial de novo lote). O botão "+ Corrida" no
    // row continua prefillando explicitamente via openFormForLot.
    setFormPrefill(null);
    setShowForm(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <svg
          className="animate-spin w-5 h-5 text-slate-300 dark:text-white/20"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeOpacity="0.25"
          />
          <path
            d="M22 12a10 10 0 00-10-10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
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
            A bancada mostra os lotes vinculados como Setup Oficial ou Em Validação. Vá em Gestão de
            Lotes, escolha um lote e clique em <span className="font-medium">Vincular</span>.
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
                  Nenhuma corrida registrada.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {recentRuns.map((run) => {
                    const conforme = run.resultadoObtido === run.resultadoEsperado;
                    return (
                      <button
                        key={`${run._lotId}-${run.id}`}
                        type="button"
                        onClick={() => setSelectedRun(run)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] focus:outline-none focus:bg-slate-50 dark:focus:bg-white/[0.04] transition-colors"
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
                            {!run._setupType && (
                              <span
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-white/45"
                                title="Lote não vinculado à bancada"
                              >
                                Não vinculado
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
                      </button>
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
            setFormError(null);
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
              setFormError(null);
            }}
            {...(formPrefill && { prefillFromLot: formPrefill })}
          />
        </Modal>
      )}

      {/* Modal: Detalhes da corrida — rastreabilidade + ação de impressão */}
      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          lot={lots.find((l) => l.id === selectedRun._lotId) ?? null}
          onClose={() => setSelectedRun(null)}
          onPrintLot={(lot) => {
            setSelectedRun(null);
            setPrintLot(lot);
          }}
        />
      )}

      {/* Modal: Impressão FR036 do lote */}
      {printLot && <LotReportPrinter lot={printLot} onClose={() => setPrintLot(null)} />}
    </div>
  );
}

// ─── Run Detail Modal ────────────────────────────────────────────────────────

function RowDetail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-400 dark:text-white/35 shrink-0">{label}</span>
      <span
        className={`text-slate-700 dark:text-white/75 text-right break-all ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function fmtDateBR(d?: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
}

const ALERT_LABELS: Record<string, string> = {
  taxa_falha_10pct: '>10% NR no lote',
  consecutivos_3nr: '3+ NR consecutivos',
  consecutivos_4nr: '4+ NR nos últimos 10',
  lote_expirado: 'Lote expirado',
  validade_30d: 'Validade <30 dias',
};

function RunDetailModal({
  run,
  lot,
  onClose,
  onPrintLot,
}: {
  run: EnrichedRun;
  lot: CIQImunoLot | null;
  onClose: () => void;
  onPrintLot: (lot: CIQImunoLot) => void;
}) {
  const conforme = run.resultadoObtido === run.resultadoEsperado;
  const alerts = run.westgardCategorico ?? [];

  return (
    <Modal title={`Corrida ${run.runCode ?? ''}`.trim()} onClose={onClose}>
      <div className="space-y-5">
        {/* Status */}
        <div
          className={`rounded-xl px-4 py-3 border ${
            conforme
              ? 'bg-emerald-50 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-500/[0.06] border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-300'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider">
            {conforme ? 'Conforme' : 'Rejeitada'}
          </p>
          <p className="text-[13px] font-semibold mt-0.5">
            {run._testType} · Lote {run._loteControle}
          </p>
        </div>

        {/* Identificação */}
        <section className="rounded-xl border border-slate-100 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02] p-4 space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/45 mb-2">
            Identificação
          </h3>
          <RowDetail label="Código" value={run.runCode ?? '—'} mono />
          <RowDetail label="Data" value={fmtDateBR(run.dataRealizacao)} />
          <RowDetail label="Operador" value={run.operatorName ?? '—'} />
          {run.operatorRole && <RowDetail label="Cargo" value={run.operatorRole} />}
          {run.equipamentoSnapshot?.name && (
            <RowDetail label="Equipamento" value={run.equipamentoSnapshot.name} />
          )}
          {run.manual && <RowDetail label="Modo" value="Kit manual (sem equipamento)" />}
        </section>

        {/* Controle */}
        <section className="rounded-xl border border-slate-100 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02] p-4 space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/45 mb-2">
            Controle
          </h3>
          <RowDetail label="Lote" value={run.loteControle} mono />
          <RowDetail label="Fabricante" value={run.fabricanteControle} />
          <RowDetail label="Abertura" value={fmtDateBR(run.aberturaControle)} />
          <RowDetail label="Validade" value={fmtDateBR(run.validadeControle)} />
        </section>

        {/* Reagente */}
        <section className="rounded-xl border border-slate-100 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02] p-4 space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/45 mb-2">
            Reagente
          </h3>
          <RowDetail label="Lote" value={run.loteReagente} mono />
          <RowDetail label="Fabricante" value={run.fabricanteReagente} />
          <RowDetail label="Abertura" value={fmtDateBR(run.aberturaReagente)} />
          <RowDetail label="Validade" value={fmtDateBR(run.validadeReagente)} />
          {run.codigoKit && <RowDetail label="Código kit" value={run.codigoKit} mono />}
          {run.registroANVISA && (
            <RowDetail label="Registro ANVISA" value={run.registroANVISA} mono />
          )}
        </section>

        {/* Resultado */}
        <section className="rounded-xl border border-slate-100 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02] p-4 space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/45 mb-2">
            Resultado
          </h3>
          {run.resultadoEsperadoNegativo !== undefined ? (
            <>
              <RowDetail
                label="Controle positivo"
                value={`Esperado ${run.resultadoEsperado} · Obtido ${run.resultadoObtido}`}
              />
              <RowDetail
                label="Controle negativo"
                value={`Esperado ${run.resultadoEsperadoNegativo} · Obtido ${run.resultadoObtidoNegativo ?? '—'}`}
              />
            </>
          ) : (
            <>
              <RowDetail label="Esperado" value={run.resultadoEsperado} />
              <RowDetail label="Obtido" value={run.resultadoObtido} />
            </>
          )}
          {run.acaoCorretiva && <RowDetail label="Ação corretiva" value={run.acaoCorretiva} />}
        </section>

        {/* Westgard */}
        {alerts.length > 0 && (
          <section className="rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/[0.06] p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-2">
              Alertas Westgard
            </h3>
            <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
              {alerts.map((a) => (
                <li key={a}>• {ALERT_LABELS[a] ?? a}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Assinatura + QR */}
        <section className="rounded-xl border border-slate-100 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02] p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/45 mb-3">
            Assinatura & Auditoria
          </h3>
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2 min-w-0">
              <RowDetail
                label="SHA-256"
                value={run.logicalSignature ? `${run.logicalSignature.slice(0, 24)}…` : '—'}
                mono
              />
              <RowDetail label="ID" value={run.id} mono />
            </div>
            <div className="shrink-0">
              <CIQAuditor run={run} lotId={run._lotId} size={104} />
            </div>
          </div>
        </section>

        {/* Ações */}
        <div className="flex justify-between items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.10] hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => lot && onPrintLot(lot)}
            disabled={!lot}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            <PrinterIcon /> Imprimir relatório do lote
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Lot report printer wrapper ──────────────────────────────────────────────
// Carrega as corridas do lote (sem cap) antes de renderizar o relatório FR036.

function LotReportPrinter({ lot, onClose }: { lot: CIQImunoLot; onClose: () => void }) {
  const { runs, isLoading } = useCIQRuns(lot.id);

  if (isLoading) {
    return (
      <Modal title="Carregando relatório…" onClose={onClose}>
        <div className="flex items-center justify-center py-10">
          <svg
            className="animate-spin w-5 h-5 text-slate-400 dark:text-white/30"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.25"
            />
            <path
              d="M22 12a10 10 0 00-10-10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </Modal>
    );
  }

  return <CIQRelatorioPrint lot={lot} runs={runs} onClose={onClose} />;
}

function PrinterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}
