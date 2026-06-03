import { useMemo } from 'react';
import { useAttempts } from '../hooks/useAttempts';
import { LeveyJenningsChart } from '../../chart/LeveyJenningsChart';
import { COAG_ANALYTES, COAG_ANALYTE_IDS } from '../../coagulacao/CoagAnalyteConfig';
import type { ControlOperacional } from '../types/ControlOperacional';
import type { Attempt } from '../types/Attempt';
import type { CoagAnalyteId, CoagNivel } from '../../coagulacao/types/_shared_refs';
import type { Analyte, WestgardViolation, RunStatus } from '../../../types';
import type { UseChartDataReturn, ChartPoint, ChartStats, WestgardAlert } from '../../chart/hooks/useChartData';

interface CoagLeveyJenningsPanelProps {
  labId: string;
  controls: ControlOperacional[];
}

function toChartStats(mean: number, sd: number): ChartStats {
  return {
    mean,
    sd,
    plus1sd: mean + sd,
    minus1sd: mean - sd,
    plus2sd: mean + 2 * sd,
    minus2sd: mean - 2 * sd,
    plus3sd: mean + 3 * sd,
    minus3sd: mean - 3 * sd,
  };
}

function attemptToStatus(att: Attempt): RunStatus {
  if (att.conformidade === 'R') return 'Rejeitada';
  if (att.conformidade === 'A') return 'Aprovada';
  return 'Pendente';
}

function isRejectionV(v: WestgardViolation): boolean {
  return v !== '1-2s';
}

function buildChartData(
  attempts: Attempt[],
  analyteId: CoagAnalyteId,
  control: ControlOperacional,
): UseChartDataReturn {
  const cfg = COAG_ANALYTES[analyteId];
  const defaultBaseline = cfg.levels[control.nivel];

  const customMean = control.mean?.[analyteId];
  const customSd = control.sd?.[analyteId];
  const mean = customMean !== undefined ? customMean : defaultBaseline.mean;
  const sd = customSd !== undefined ? customSd : defaultBaseline.sd;

  const stats = toChartStats(mean, sd);
  const relevant = attempts
    .filter((a) => a.controlOperacionalId === control.id)
    .filter((a) => a.resultados[analyteId] !== undefined && a.resultados[analyteId] !== null)
    .slice()
    .reverse();

  const chartData: ChartPoint[] = relevant.map((a, idx) => {
    const value = a.resultados[analyteId];
    const status = attemptToStatus(a);
    const zScore = value === null || value === undefined ? null : (value - mean) / sd;
    const violations = a.violacoes ?? [];
    const isRej = violations.some(isRejectionV);
    const isWarn = !isRej && violations.length > 0;
    return {
      index: idx + 1,
      runId: a.id,
      sampleId: undefined,
      timestamp: a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(),
      value: value ?? null,
      status,
      violations,
      isRejection: isRej,
      isWarningOnly: isWarn,
      zScore,
    };
  });

  const westgardAlerts: WestgardAlert[] = chartData.flatMap((p) =>
    p.violations.map((v) => ({
      runId: p.runId,
      runIndex: p.index,
      violation: v,
      isRejection: isRejectionV(v),
      value: p.value ?? 0,
      timestamp: p.timestamp,
    })),
  );

  return {
    chartData,
    currentStats: stats,
    manufacturerStats: stats,
    hasEnoughData: chartData.length >= 2,
    isUsingInternalStats: false,
    isBaselineEstablished: true,
    westgardAlerts,
    totalRuns: chartData.length,
    approvedRuns: chartData.filter((p) => p.status === 'Aprovada').length,
    runsUntilBaseline: Math.max(0, 2 - chartData.filter((p) => p.status === 'Aprovada').length),
  };
}

function analyteToAnalyte(id: CoagAnalyteId, nivel: CoagNivel): Analyte {
  const cfg = COAG_ANALYTES[id];
  return {
    id,
    name: cfg.label,
    unit: cfg.levels[nivel].unit,
    decimals: cfg.decimals,
  };
}

export function CoagLeveyJenningsPanel({ labId, controls }: CoagLeveyJenningsPanelProps) {
  const { attempts, isLoading } = useAttempts(labId);

  const byNivel = useMemo(() => {
    const map = new Map<CoagNivel, { controls: ControlOperacional[]; attempts: Attempt[] }>();
    for (const n of ['I', 'II'] as CoagNivel[]) {
      map.set(n, { controls: [], attempts: [] });
    }
    for (const c of controls) {
      if (c.status === 'ativo' || c.status === 'pausado') {
        map.get(c.nivel)!.controls.push(c);
      }
    }
    for (const a of attempts) {
      const ctrl = controls.find((c) => c.id === a.controlOperacionalId);
      if (ctrl) map.get(ctrl.nivel)!.attempts.push(a);
    }
    return map;
  }, [controls, attempts]);

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-[var(--cl-text-muted)]">
        Carregando histórico...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(['I', 'II'] as CoagNivel[]).map((nivel) => {
        const bucket = byNivel.get(nivel)!;
        if (bucket.attempts.length === 0) return null;
        return (
          <div key={nivel} className="space-y-3">
            <div className="flex items-baseline gap-3 px-1">
              <h2 className="text-sm font-semibold text-[var(--cl-text-strong)]">
                Nível {nivel}
              </h2>
              <span className="text-xs text-[var(--cl-text-muted)]">
                {bucket.attempts.length} tentativa{bucket.attempts.length === 1 ? '' : 's'}
                {bucket.controls.length > 0 && ` · ${bucket.controls.length} controle${bucket.controls.length === 1 ? '' : 's'}`}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {COAG_ANALYTE_IDS.map((analyteId) => {
                const analyte = analyteToAnalyte(analyteId, nivel);
                const chartsByControl = bucket.controls.map((c) => ({
                  control: c,
                  data: buildChartData(bucket.attempts, analyteId, c),
                }));

                return (
                  <div
                    key={analyteId}
                    className="rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-3"
                  >
                    <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-[var(--cl-text-muted)]">
                      {analyte.name}
                    </div>
                    {chartsByControl.map(({ control, data }) => (
                      <div key={control.id} className="mt-1">
                        {chartsByControl.length > 1 && (
                          <div className="mb-1 px-1 text-[10px] text-[var(--cl-text-faint)]">
                            {control.nome}
                          </div>
                        )}
                        <LeveyJenningsChart chartData={data} analyte={analyte} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
