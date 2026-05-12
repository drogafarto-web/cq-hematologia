import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Timestamp } from 'firebase/firestore';

import { subscribeActiveAlerts, subscribeLatestKPI } from '../kpisService';
import { useKpiMetas } from '../hooks/useKpiMetas';
import type { KPIAlert, KPIDaily } from '../types/KPI';
import {
  KPI_META_TIPO_DOCUMENTACAO,
  KPI_META_TIPO_RETRABALHO,
  KPI_META_TIPO_TURNAROUND,
} from '../constants/kpiMetaTipos';
import { KpiValueMetaBar } from './KpiValueMetaBar';

interface KPIDashboardProps {
  readonly labId: string;
}

const ALERT_TIPO_LABEL: Record<KPIAlert['tipo'], string> = {
  sla_breach: 'SLA',
  high_rework: 'Retrabalho',
  low_conformance: 'Documentação',
};

function formatKpiDate(data: KPIDaily['data'] | undefined): string {
  if (!data) return '—';
  if (data instanceof Timestamp) {
    return data.toDate().toLocaleDateString('pt-BR');
  }
  if (typeof data === 'object' && data !== null && 'toDate' in data && typeof (data as Timestamp).toDate === 'function') {
    return (data as Timestamp).toDate().toLocaleDateString('pt-BR');
  }
  return '—';
}

function formatAlertTime(ts: KPIAlert['acionada_em']): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleString('pt-BR');
  }
  return '—';
}

export function KPIDashboard({ labId }: KPIDashboardProps): ReactElement {
  const [kpi, setKpi] = useState<KPIDaily | null>(null);
  const [alerts, setAlerts] = useState<KPIAlert[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [kpiError, setKpiError] = useState<Error | null>(null);
  const [alertsError, setAlertsError] = useState<Error | null>(null);

  const { getMetaByTipo, loading: metasLoading, error: metasError } = useKpiMetas(labId);

  useEffect(() => {
    let cancelled = false;
    setKpi(null);
    setAlerts([]);
    setKpiLoading(true);
    setAlertsLoading(true);
    setKpiError(null);
    setAlertsError(null);

    const unsubKpi = subscribeLatestKPI(
      labId,
      (next) => {
        if (!cancelled) {
          setKpi(next);
          setKpiLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setKpiError(err);
          setKpiLoading(false);
        }
      },
    );

    const unsubAlerts = subscribeActiveAlerts(
      labId,
      (list) => {
        if (!cancelled) {
          setAlerts(list);
          setAlertsLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setAlertsError(err);
          setAlertsLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubKpi();
      unsubAlerts();
    };
  }, [labId]);

  const metaTurnaround = getMetaByTipo(KPI_META_TIPO_TURNAROUND);
  const metaRetrabalho = getMetaByTipo(KPI_META_TIPO_RETRABALHO);
  const metaDocumentacao = getMetaByTipo(KPI_META_TIPO_DOCUMENTACAO);

  const kpiErr = kpiError?.message ?? null;
  const alertsErr = alertsError?.message ?? null;
  const metasErr = metasError instanceof Error ? metasError.message : metasError ? String(metasError) : null;

  const dataLabel = useMemo(() => formatKpiDate(kpi?.data), [kpi?.data]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#141417] p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Indicadores de Performance</h2>
        <div className="text-xs text-white/45">{dataLabel}</div>
      </div>

      {kpiErr ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          Não foi possível carregar os KPIs. {kpiErr}
        </div>
      ) : null}
      {alertsErr ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          Alertas indisponíveis. {alertsErr}
        </div>
      ) : null}
      {metasErr ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          Metas indisponíveis. {metasErr}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-white/45">Turnaround</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white">
            {kpiLoading ? (
              <span className="inline-block h-9 w-20 animate-pulse rounded bg-white/10" aria-hidden />
            ) : (
              `${kpi?.turnaround_media_horas?.toFixed(1) ?? '—'}h`
            )}
          </div>
          {kpi && !kpiLoading ? (
            <KpiValueMetaBar
              label="Posição vs meta"
              value={kpi.turnaround_media_horas}
              valueSuffix="h"
              mode="lower-is-better"
              metaValor={metaTurnaround?.valor}
              metaUnidade={metaTurnaround?.unidade}
              expectedUnidade="hours"
              metaLabel={`Meta turnaround: ${metaTurnaround?.valor?.toFixed(1) ?? ''}h`}
              fallbackReference={kpi.sla_limite_horas}
              fallbackLabel="SLA do dia"
            />
          ) : null}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-white/45">Retrabalho</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white">
            {kpiLoading ? (
              <span className="inline-block h-9 w-20 animate-pulse rounded bg-white/10" aria-hidden />
            ) : (
              `${kpi?.retrabalho_percentual?.toFixed(1) ?? '—'}%`
            )}
          </div>
          {kpi && !kpiLoading ? (
            <KpiValueMetaBar
              label="Posição vs meta"
              value={kpi.retrabalho_percentual}
              valueSuffix="%"
              mode="lower-is-better"
              metaValor={metaRetrabalho?.valor}
              metaUnidade={metaRetrabalho?.unidade}
              expectedUnidade="percent"
              metaLabel={`Meta retrabalho: ${metaRetrabalho?.valor?.toFixed(1) ?? ''}%`}
            />
          ) : null}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-white/45">Documentação</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white">
            {kpiLoading ? (
              <span className="inline-block h-9 w-20 animate-pulse rounded bg-white/10" aria-hidden />
            ) : (
              `${kpi?.documentacao_percentual?.toFixed(1) ?? '—'}%`
            )}
          </div>
          {kpi && !kpiLoading ? (
            <KpiValueMetaBar
              label="Posição vs meta"
              value={kpi.documentacao_percentual}
              valueSuffix="%"
              mode="higher-is-better"
              metaValor={metaDocumentacao?.valor}
              metaUnidade={metaDocumentacao?.unidade}
              expectedUnidade="percent"
              metaLabel={`Meta documentação: ${metaDocumentacao?.valor?.toFixed(1) ?? ''}%`}
            />
          ) : null}
        </div>
      </div>

      {metasLoading ? (
        <p className="mt-4 text-xs text-white/40">Carregando metas…</p>
      ) : null}

      {!alertsLoading && alerts.length > 0 ? (
        <div className="mt-6 border-t border-white/10 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Alertas recentes</h3>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    alert.severidade === 'critical'
                      ? 'bg-red-500'
                      : alert.severidade === 'warning'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">{ALERT_TIPO_LABEL[alert.tipo]}</div>
                  <div className="mt-0.5 text-xs text-white/55">{alert.mensagem}</div>
                  <div className="mt-1 text-[11px] tabular-nums text-white/35">{formatAlertTime(alert.acionada_em)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
