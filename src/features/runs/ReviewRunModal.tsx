import React, { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../store/useAuthStore';
import { ANALYTE_MAP } from '../../constants';
import { checkWestgardRules, isRejection } from '../chart/utils/westgardRules';
import { InsumoPickerMulti } from '../insumos/components/InsumoPickerMulti';
import { NovoLoteModal } from '../insumos/components/NovoLoteModal';
import { validateReagentesForRun } from '../insumos/utils/insumoValidation';
import { useInsumos } from '../insumos/hooks/useInsumos';
import { useTraceability } from '../traceability/hooks/useTraceability';
import { UNIDADES, DEFAULT_EQUIPMENT_ID } from '../traceability/constants';
import type { Insumo, InsumoModulo } from '../insumos/types/Insumo';
import type { PendingRun, ControlLot, WestgardViolation, AnalyteStats } from '../../types';

export interface ComplianceOverride {
  justificativa: string;
  blockers: ReadonlyArray<{
    kind: string;
    insumoId: string;
    insumoNome: string;
    insumoLote: string;
    message: string;
  }>;
  minimoFaltando?: { expected: number; got: number; modulo: string };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path
        d="M22 12a10 10 0 00-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Confidence indicator ─────────────────────────────────────────────────────

function ConfidenceDot({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? 'bg-emerald-500' : value >= 0.6 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={`Confiança: ${pct}%`} />
  );
}

// ─── Westgard violation descriptions ─────────────────────────────────────────

interface ViolationInfo {
  level: 'warning' | 'rejection';
  text: string;
}

const VIOLATION_INFO: Record<WestgardViolation, ViolationInfo> = {
  '1-2s': { level: 'warning', text: 'Valor além de ±2 DP — monitorar' },
  '1-3s': { level: 'rejection', text: 'Valor além de ±3 DP — possível erro analítico' },
  '2-2s': {
    level: 'rejection',
    text: '2 medições consecutivas além de ±2 DP no mesmo lado — desvio sistemático',
  },
  'R-4s': {
    level: 'rejection',
    text: 'Amplitude > 4 DP entre medições consecutivas — erro aleatório',
  },
  '4-1s': {
    level: 'rejection',
    text: '4 medições consecutivas além de ±1 DP no mesmo lado — tendência',
  },
  '10x': {
    level: 'rejection',
    text: '10 medições consecutivas do mesmo lado da média — erro sistemático',
  },
  '6T': { level: 'rejection', text: '6 medições em deriva monotônica — instabilidade analítica' },
  '6X': { level: 'rejection', text: '6 medições do mesmo lado da média — desvio sistemático' },
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function resolveStats(lot: ControlLot, analyteId: string): AnalyteStats | null {
  // manufacturerStats é null quando o lote ainda aguarda a bula. Nesse
  // estado retornamos null e Westgard fica suspenso até `applyBulaToLots`.
  return lot.statistics?.[analyteId] ?? lot.manufacturerStats?.[analyteId] ?? null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReviewRunModalProps {
  pendingRun: PendingRun;
  activeLot: ControlLot;
  onConfirm: (
    editedValues: Record<string, number>,
    approve: boolean,
    reagentes: Insumo[],
    override?: ComplianceOverride,
  ) => Promise<void>;
  onCancel: () => void;
  isConfirming: boolean;
  modulo?: InsumoModulo;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewRunModal({
  pendingRun,
  activeLot,
  onConfirm,
  onCancel,
  isConfirming,
  modulo = 'hematologia',
}: ReviewRunModalProps) {
  const labId = useActiveLabId();
  const [editedValues, setEditedValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(pendingRun.results).map(([id, r]) => {
        const analyte = ANALYTE_MAP[id];
        return [id, r.value.toFixed(analyte?.decimals ?? 2)];
      }),
    ),
  );

  // Reagentes em uso no equipamento durante esta corrida — rastreabilidade FR-10
  // + bloqueio de compliance (RDC 978/2025 Art.128): a rotina exige declarar
  // insumos usados com lote ativo e dentro da validade.
  const [reagentes, setReagentes] = useState<Insumo[]>([]);
  const [showNovoLote, setShowNovoLote] = useState(false);

  // Pré-popula o picker com os reagentes ativos do equipamento — operador
  // não precisa selecionar manualmente o que já está cadastrado em rotina.
  // Mesmo dataset do PreFlightCheck na tela de Nova Corrida (consistência).
  // O state continua mutável: operador pode remover um item se não foi usado
  // nesta corrida específica (raro, mas possível).
  const { insumos: reagentesAtivosDoLab } = useInsumos({
    tipo: 'reagente',
    status: 'ativo',
    modulo,
  });
  const reagentesAtivosDoEquip = useMemo(() => {
    return reagentesAtivosDoLab.filter((r) => {
      if (r.tipo !== 'reagente') return false;
      // Reagente sem equipamentoId = legado (aceita); com = filtrado.
      return !r.equipamentoId || r.equipamentoId === DEFAULT_EQUIPMENT_ID;
    });
  }, [reagentesAtivosDoLab]);
  const [hasPrefilled, setHasPrefilled] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (hasPrefilled) return;
    if (reagentesAtivosDoEquip.length === 0) return;
    setReagentes(reagentesAtivosDoEquip);
    setHasPrefilled(true);
  }, [reagentesAtivosDoEquip, hasPrefilled]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Override auditado — operador força a corrida mesmo com blockers e fornece
  // justificativa obrigatória. A justificativa vai pro auditLog e a run
  // carrega `complianceOverride: true` na persistência.
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideJustificativa, setOverrideJustificativa] = useState('');

  // Rastreabilidade — código do primeiro atendimento coberto pela aprovação
  // deste controle. Opcional por enquanto; futuro: torná-lo obrigatório quando
  // a feature estabilizar. Pré-preenche com último evento + 1 (sugestão).
  const traceability = useTraceability();
  const [traceUnidade, setTraceUnidade] = useState<string>(UNIDADES[0].code);
  const traceSuggested = traceability.suggestNextExamCode(traceUnidade, DEFAULT_EQUIPMENT_ID);
  const [traceExamCode, setTraceExamCode] = useState<string>('');

  const imageUrl = URL.createObjectURL(pendingRun.file);

  const lowConfidenceCount = Object.values(pendingRun.results).filter(
    (r) => r.confidence < 0.85,
  ).length;

  // Lote aguardando bula Controllab — Westgard suspenso até `applyBulaToLot`
  // recompute. A run será marcada `semBula: true` automaticamente em useRuns.
  // Estado derivado do lote (sem override manual) — semântica fica consistente:
  // a Run fica no lote a que pertence fisicamente. Se o sangue é de outro
  // lote sem bula, operador deve cadastrar via "⏳ Cadastrar sem bula" no
  // LotManager, não marcar checkbox em um lote que já tem bula.
  const isSemBula = activeLot.bulaPendente === true;

  const complianceResult = useMemo(
    () => validateReagentesForRun({ reagentes, modulo }),
    [reagentes, modulo],
  );

  function handleValueChange(analyteId: string, raw: string) {
    setEditedValues((prev) => ({ ...prev, [analyteId]: raw }));
  }

  async function handleSubmit(approve: boolean) {
    const parsed = Object.fromEntries(
      Object.entries(editedValues).map(([id, raw]) => [id, parseFloat(raw)]),
    );

    // Se há blockers de compliance, exige override explícito com justificativa.
    if (!complianceResult.canProceed) {
      if (!overrideMode) {
        setOverrideMode(true);
        return;
      }
      const just = overrideJustificativa.trim();
      if (just.length < 15) {
        return; // botão já está desabilitado; guarda contra race
      }
      const override: ComplianceOverride = {
        justificativa: just,
        blockers: complianceResult.blockers.map((b) => ({
          kind: b.kind,
          insumoId: b.insumo.id,
          insumoNome: b.insumo.nomeComercial,
          insumoLote: b.insumo.lote,
          message: b.message,
        })),
        ...(complianceResult.minimoFaltando && { minimoFaltando: complianceResult.minimoFaltando }),
      };
      await onConfirm(parsed, approve, reagentes, override);
      maybeRegisterTraceabilityEvent(approve);
      return;
    }

    await onConfirm(parsed, approve, reagentes);
    maybeRegisterTraceabilityEvent(approve);
  }

  /**
   * Fire-and-forget — registra evento de `control_run` se o operador preencheu
   * o código de atendimento e a corrida foi aprovada. Falha silencia (com
   * warning no console) — rastreabilidade não bloqueia o fluxo principal de
   * aprovação. Próxima rodada: integrar isto no submit server-side via Cloud
   * Function trigger pra garantir consistência mesmo com cliente offline.
   */
  function maybeRegisterTraceabilityEvent(approve: boolean) {
    if (!approve) return;
    const code = traceExamCode.trim();
    if (!code) return;
    traceability
      .registerEvent({
        unidadeCode: traceUnidade,
        equipmentId: DEFAULT_EQUIPMENT_ID,
        type: 'control_run',
        examCodeAtChange: code,
        timestamp: new Date(),
        payload: {
          controlLotId: activeLot.id,
          // controlRunId não está disponível aqui (run é gravada server-side
          // após este return); ficará null e pode ser linkado depois via
          // Cloud Function trigger se necessário.
        },
      })
      .catch((err) => {
        console.warn(
          `[traceability] falha ao registrar control_run: ${err instanceof Error ? err.message : err}`,
        );
      });
  }

  // Build ordered list of analytes in this lot
  const analyteEntries = activeLot.requiredAnalytes
    .map((id) => {
      const analyte = ANALYTE_MAP[id];
      const result = pendingRun.results[id];
      return analyte && result ? { analyte, result, id } : null;
    })
    .filter(Boolean) as {
    analyte: (typeof ANALYTE_MAP)[string];
    result: PendingRun['results'][string];
    id: string;
  }[];

  // ── Live violation computation ──────────────────────────────────────────────
  // Re-evaluated whenever the operator edits a value.
  // Uses the lot's existing run history for multi-point rules.

  interface ViolationEntry {
    rule: WestgardViolation;
    analyteName: string;
    level: 'warning' | 'rejection';
    text: string;
  }

  const { violationEntries, hasRejectionViolation } = useMemo(() => {
    // Sem bula → Westgard suspenso. Não calcula nem exibe violations.
    if (isSemBula) {
      return { violationEntries: [] as ViolationEntry[], hasRejectionViolation: false };
    }

    const sortedRuns = [...activeLot.runs].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    const entries: ViolationEntry[] = [];
    let hasRejection = false;

    for (const { analyte, id } of analyteEntries) {
      const currentValue = parseFloat(editedValues[id] ?? '');
      if (Number.isNaN(currentValue)) continue;

      const stats = resolveStats(activeLot, id);
      if (!stats) continue;

      const previousValues = sortedRuns
        .map((r) => r.results.find((res) => res.analyteId === id)?.value)
        .filter((v): v is number => v !== undefined);

      const violations = checkWestgardRules(currentValue, previousValues, stats);

      for (const rule of violations) {
        const info = VIOLATION_INFO[rule];
        entries.push({ rule, analyteName: analyte.name, level: info.level, text: info.text });
        if (info.level === 'rejection') hasRejection = true;
      }
    }

    return { violationEntries: entries, hasRejectionViolation: hasRejection };
    // editedValues key is stable; only the values inside change — spread forces re-evaluation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedValues, activeLot, isSemBula]);

  const hasAnyViolation = violationEntries.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-[6px] transition-colors duration-500">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.09] shadow-2xl transition-colors duration-300">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
          <img
            src={imageUrl}
            alt="Foto do equipamento"
            className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-white/[0.1] shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-800 dark:text-white/90">
              Revisar Extração
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
              {activeLot.controlName} — Nível {activeLot.level}
              <span className="font-mono"> · {activeLot.lotNumber}</span>
            </p>
            {pendingRun.sampleId && (
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                ID Amostra: {pendingRun.sampleId}
              </p>
            )}
            {lowConfidenceCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-1">
                ⚠ {lowConfidenceCount} analito{lowConfidenceCount > 1 ? 's' : ''} com baixa
                confiança — revise os valores
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            aria-label="Fechar"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-all shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Analyte table + reagentes */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          {isSemBula && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] px-3.5 py-2.5 flex items-start gap-2.5"
            >
              <span aria-hidden className="text-base leading-none mt-0.5">
                ⏳
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300/95">
                  Corrida sem bula
                </p>
                <p className="text-[11px] leading-snug text-amber-700/85 dark:text-amber-200/70 mt-0.5">
                  Bula Controllab ainda não chegou — Westgard suspenso e Levey-Jennings sem
                  linhas-guia. Quando a bula for importada, esta corrida será recalculada e
                  classificada retroativamente.
                </p>
              </div>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 dark:text-white/30 font-medium">
                <th className="text-left pb-3 font-medium">Analito</th>
                <th className="text-right pb-3 font-medium">Valor</th>
                <th className="text-left pb-3 pl-3 font-medium">Unidade</th>
                <th className="text-right pb-3 font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {analyteEntries.map(({ analyte, result, id }) => (
                <tr key={id} className="group transition-colors">
                  <td className="py-2.5 text-slate-700 dark:text-white/70 font-medium">
                    {analyte.name}
                  </td>
                  <td className="py-2.5 text-right">
                    <input
                      type="number"
                      aria-label={`Valor de ${analyte.name}`}
                      step={Math.pow(10, -analyte.decimals)}
                      value={editedValues[id] ?? ''}
                      onChange={(e) => handleValueChange(id, e.target.value)}
                      className={`
                        w-20 text-right px-2 py-1 rounded-lg text-sm
                        bg-slate-50 dark:bg-white/[0.05] border transition-all
                        focus:outline-none focus:border-violet-500/50 dark:focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
                        ${
                          result.confidence < 0.85
                            ? 'border-amber-400/50 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                            : 'border-slate-100 dark:border-transparent text-slate-800 dark:text-white/85 hover:border-slate-300 dark:hover:border-white/[0.12]'
                        }
                      `}
                    />
                  </td>
                  <td className="py-2.5 pl-3 text-slate-400 dark:text-white/30 text-xs">
                    {analyte.unit}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ConfidenceDot value={result.confidence} />
                      <span
                        className={`text-xs ${
                          result.confidence >= 0.85
                            ? 'text-emerald-600 dark:text-emerald-400/70'
                            : result.confidence >= 0.6
                              ? 'text-amber-600 dark:text-amber-400/70'
                              : 'text-red-600 dark:text-red-400/70'
                        }`}
                      >
                        {Math.round(result.confidence * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Reagentes em uso — obrigatório (bloqueio de compliance + FR-10). */}
          <section aria-labelledby="reagentes-title" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3
                id="reagentes-title"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Reagentes em uso
                <span className="text-red-500 dark:text-red-400/80 ml-1">*</span>
              </h3>
              <span className="text-[10px] text-slate-400 dark:text-white/30">
                obrigatório · RDC 978/2025 · FR-10
              </span>
            </div>
            <InsumoPickerMulti
              tipo="reagente"
              modulo={modulo}
              value={reagentes.map((r) => r.id)}
              onSelect={setReagentes}
              placeholder="Declarar reagentes carregados no equipamento"
              ariaLabel="Selecionar reagentes em uso no equipamento"
              onNovoLote={() => setShowNovoLote(true)}
            />

            {/* Lista de problemas de compliance — blockers + warnings */}
            {(complianceResult.issues.length > 0 || complianceResult.minimoFaltando) && (
              <div
                className={`rounded-xl border p-3 space-y-1.5 transition-colors ${
                  complianceResult.canProceed
                    ? 'border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.04]'
                    : 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/[0.04]'
                }`}
              >
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    complianceResult.canProceed
                      ? 'text-amber-600 dark:text-amber-400/80'
                      : 'text-red-600 dark:text-red-400/80'
                  }`}
                >
                  {complianceResult.canProceed ? 'Atenção — revisar' : 'Bloqueios de compliance'}
                </p>
                {complianceResult.minimoFaltando && (
                  <div className="text-xs text-red-700 dark:text-red-300/90 leading-snug">
                    <strong>{complianceResult.minimoFaltando.modulo}</strong> exige pelo menos{' '}
                    {complianceResult.minimoFaltando.expected} reagente
                    {complianceResult.minimoFaltando.expected > 1 ? 's' : ''} declarado
                    {complianceResult.minimoFaltando.expected > 1 ? 's' : ''} —{' '}
                    {complianceResult.minimoFaltando.got === 0
                      ? 'nenhum foi selecionado.'
                      : `${complianceResult.minimoFaltando.got} selecionado${
                          complianceResult.minimoFaltando.got === 1 ? '' : 's'
                        }.`}
                  </div>
                )}
                {complianceResult.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                        issue.severity === 'block'
                          ? 'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {issue.severity === 'block' ? 'BLOQ' : 'AVISO'}
                    </span>
                    <span className="text-xs text-slate-700 dark:text-white/70 leading-snug">
                      {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Rastreabilidade — opcional. Ancora a aprovação deste controle ao
              primeiro código de atendimento que será coberto. Vive no body
              (não no footer) pra liberar viewport pro scroll em laptops. */}
          <section
            aria-labelledby="trace-title"
            className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02] px-3 py-2.5"
          >
            <div className="flex items-center gap-2 mb-2">
              <h3
                id="trace-title"
                className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400"
              >
                Rastreabilidade
              </h3>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">opcional</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <select
                aria-label="Unidade do atendimento"
                value={traceUnidade}
                onChange={(e) => setTraceUnidade(e.target.value)}
                className="h-9 px-2.5 text-xs bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
              >
                {UNIDADES.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder={
                  traceSuggested
                    ? `Primeiro atendimento (sugerido: ${traceSuggested})`
                    : 'Primeiro atendimento coberto (ex: 0107037)'
                }
                value={traceExamCode}
                onChange={(e) => setTraceExamCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-9 px-3 font-mono text-xs bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
              />
            </div>
            {traceSuggested && !traceExamCode && (
              <button
                type="button"
                onClick={() => setTraceExamCode(traceSuggested)}
                className="mt-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                Usar sugestão {traceSuggested}
              </button>
            )}
          </section>
        </div>

        {/* Footer — sempre visível, fora do scroll. Contém alertas Westgard,
            painel de override (quando ativo) e botões de ação. Rastreabilidade
            ficou no body porque é opcional e estava roubando viewport demais
            do scroll em laptops. */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0 space-y-3">
          {/* Override auditado — fixo no footer pra ficar sempre visível quando
              ativo, sem depender de scroll. Quando TODOS os blockers são
              reclassificáveis (marksRunAsInformational), muda visual para amarelo
              + texto "informativa" — corrida será gravada mas não compõe
              estatísticas do lote. */}
          {overrideMode &&
            !complianceResult.canProceed &&
            (() => {
              const blockersInformational = complianceResult.blockers.filter(
                (b) => b.marksRunAsInformational,
              );
              const isFullyInformational =
                complianceResult.blockers.length > 0 &&
                blockersInformational.length === complianceResult.blockers.length &&
                complianceResult.minimoFaltando === null;

              return (
                <div
                  className={`rounded-xl border-2 p-3 space-y-2 ${
                    isFullyInformational
                      ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/[0.05]'
                      : 'border-red-300 dark:border-red-500/40 bg-red-50/50 dark:bg-red-500/[0.05]'
                  }`}
                >
                  <div>
                    <p
                      className={`text-xs font-semibold ${
                        isFullyInformational
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      {isFullyInformational
                        ? 'Corrida será registrada como INFORMATIVA — justificativa obrigatória'
                        : 'Override auditado — justificativa obrigatória'}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 leading-snug ${
                        isFullyInformational
                          ? 'text-amber-700/80 dark:text-amber-400/70'
                          : 'text-red-600/80 dark:text-red-400/70'
                      }`}
                    >
                      {isFullyInformational ? (
                        <>
                          Esta corrida entra no histórico do lote para julgamento clínico e
                          rastreabilidade (RDC 978/2025), mas <strong>não é usada</strong> para
                          média, DP, Westgard ou decisão de aprovação da bancada. Justificativa
                          registrada permanentemente. Mínimo 15 caracteres.
                        </>
                      ) : (
                        <>
                          Você está prestes a registrar esta corrida apesar dos bloqueios listados
                          acima. A justificativa fica registrada permanentemente no log de auditoria
                          (RDC 978/2025). Mínimo 15 caracteres.
                        </>
                      )}
                    </p>
                  </div>
                  <textarea
                    value={overrideJustificativa}
                    onChange={(e) => setOverrideJustificativa(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="Ex: Lote novo chegou hoje e lote anterior acabou — corrida para qualificar o novo material."
                    aria-label="Justificativa do override"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.08] border border-red-200 dark:border-red-500/30 text-sm text-slate-900 dark:text-white/85 placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-red-500/60 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    {(() => {
                      const len = overrideJustificativa.trim().length;
                      const faltam = Math.max(0, 15 - len);
                      return (
                        <span
                          className={`text-[10px] font-medium ${
                            len < 15
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                          aria-live="polite"
                        >
                          {len < 15
                            ? `${len}/15 — faltam ${faltam} caracter${faltam === 1 ? '' : 'es'}`
                            : `${len} caracteres ✓`}
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideMode(false);
                        setOverrideJustificativa('');
                      }}
                      className="text-[11px] font-medium text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85"
                    >
                      Cancelar override — voltar e corrigir
                    </button>
                  </div>
                </div>
              );
            })()}

          {/* Westgard alerts panel — shown when violations are detected */}
          {hasAnyViolation && (
            <div
              className={`rounded-xl border p-3 space-y-1.5 transition-colors ${
                hasRejectionViolation
                  ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/[0.04]'
                  : 'border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.04]'
              }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                  hasRejectionViolation
                    ? 'text-red-600 dark:text-red-400/70'
                    : 'text-amber-600 dark:text-amber-400/70'
                }`}
              >
                Alertas Westgard
              </p>
              {violationEntries.map((entry, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      entry.level === 'rejection'
                        ? 'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {entry.rule}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-white/50 leading-tight">
                    <span className="font-medium text-slate-700 dark:text-white/70">
                      {entry.analyteName}
                    </span>
                    {' — '}
                    {entry.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons — operator always decides */}
          {(() => {
            const hasBlockers = !complianceResult.canProceed;
            // Com blockers: antes do overrideMode, botão abre o painel de justificativa.
            // Durante overrideMode: botão só libera quando justificativa ≥ 15 chars.
            const overrideReady = overrideMode && overrideJustificativa.trim().length >= 15;
            const approveDisabled = isConfirming || (hasBlockers && overrideMode && !overrideReady);
            const rejectDisabled = isConfirming || (hasBlockers && overrideMode && !overrideReady);

            const approveLabel = isConfirming
              ? null
              : hasBlockers
                ? overrideMode
                  ? '⚠ Confirmar com override'
                  : '⚠ Aprovar com justificativa'
                : hasRejectionViolation
                  ? '⚠ Aprovar mesmo assim'
                  : 'Aprovar Corrida';

            return (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isConfirming}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/[0.1] text-sm text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 hover:border-slate-300 dark:hover:border-white/[0.2] disabled:opacity-50 transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={rejectDisabled}
                  className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-500/20 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.07] hover:border-red-300 dark:hover:border-red-500/30 disabled:opacity-50 transition-all"
                >
                  Rejeitar
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={approveDisabled}
                  title={
                    hasBlockers && overrideMode && !overrideReady
                      ? `Justificativa precisa de ao menos 15 caracteres (faltam ${Math.max(0, 15 - overrideJustificativa.trim().length)})`
                      : undefined
                  }
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-all shadow-lg disabled:cursor-not-allowed disabled:shadow-none disabled:saturate-50 disabled:opacity-40 ${
                    hasBlockers
                      ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                      : hasRejectionViolation
                        ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                        : 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/20'
                  }`}
                >
                  {isConfirming ? (
                    <>
                      <Spinner /> Registrando…
                    </>
                  ) : (
                    approveLabel
                  )}
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {showNovoLote && labId && (
        <NovoLoteModal
          labId={labId}
          initialTipo="reagente"
          onClose={() => setShowNovoLote(false)}
          onCreated={() => {
            // Lote criado — InsumoPickerMulti vai recarregar via snapshot real-time
            // e o operador seleciona manualmente o novo item na lista. Fechamos
            // o overlay; estado da corrida preservado (pendingRun, editedValues,
            // reagentes já marcados permanecem intactos).
            setShowNovoLote(false);
          }}
        />
      )}
    </div>
  );
}
