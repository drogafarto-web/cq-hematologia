import React, { useEffect, useState } from 'react';
import { useKPIs } from '../useKPIs';
import type { KPIDaily, KPIAlert } from '../types/KPI';

/**
 * KPIDashboard — Real-time metrics display with trend indicators.
 * Turnaround, rework%, conformance%, NC origins, SLA tracking.
 */
export function KPIDashboard() {
  const { subscribeToLatestKPI, subscribeToAlerts } = useKPIs();
  const [kpi, setKpi] = useState<KPIDaily | null>(null);
  const [alerts, setAlerts] = useState<KPIAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeKPI = subscribeToLatestKPI(
      (data) => {
        setKpi(data);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar KPI:', err);
        setLoading(false);
      }
    );

    return unsubscribeKPI;
  }, [subscribeToLatestKPI]);

  useEffect(() => {
    const unsubscribeAlerts = subscribeToAlerts(
      (data) => setAlerts(data),
      (err) => console.error('Erro ao carregar alertas:', err)
    );

    return unsubscribeAlerts;
  }, [subscribeToAlerts]);

  if (loading || !kpi) {
    return <div className="p-6 text-center text-gray-500">Carregando métricas...</div>;
  }

  const getMetricColor = (value: number, threshold: number, isPercentage: boolean = true) => {
    if (isPercentage) {
      return value >= threshold ? 'text-green-600' : 'text-red-600';
    }
    return value <= threshold ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Turnaround */}
        <div className="rounded-lg border p-6">
          <div className="text-sm font-medium text-gray-600">Turnaround Médio</div>
          <div className={`mt-2 text-3xl font-bold ${getMetricColor(kpi.sla_limite_horas - kpi.turnaround_media_horas, 0)}`}>
            {kpi.turnaround_media_horas.toFixed(1)}h
          </div>
          <div className="mt-1 text-xs text-gray-500">
            SLA: {kpi.sla_limite_horas}h {kpi.sla_atendido ? '✓' : '✗'}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            P95: {kpi.turnaround_percentil_95.toFixed(1)}h
          </div>
        </div>

        {/* Retrabalho */}
        <div className="rounded-lg border p-6">
          <div className="text-sm font-medium text-gray-600">Taxa de Retrabalho</div>
          <div className={`mt-2 text-3xl font-bold ${getMetricColor(kpi.retrabalho_percentual, 10)}`}>
            {kpi.retrabalho_percentual.toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {kpi.retrabalho_total} de {kpi.runs_total} corridas
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Meta: &lt;10%
          </div>
        </div>

        {/* Documentação de Corridas (KPI-FIX-4: era "Conformidade", renomeado para evitar erro auditorial) */}
        <div className="rounded-lg border p-6">
          <div className="text-sm font-medium text-gray-600">Documentação de Corridas</div>
          <div className={`mt-2 text-3xl font-bold ${getMetricColor(kpi.documentacao_percentual, 95)}`}>
            {kpi.documentacao_percentual.toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {kpi.runs_documentados} de {kpi.runs_total} com POP+Equip+Op
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Meta: 95%+
          </div>
        </div>
      </div>

      {/* NC Origins */}
      <div className="rounded-lg border p-6">
        <h3 className="text-sm font-medium text-gray-600">Origens de NC</h3>
        <div className="mt-4 space-y-2">
          {Object.entries(kpi.nc_por_origem).length > 0 ? (
            Object.entries(kpi.nc_por_origem)
              .sort(([, a], [, b]) => b - a)
              .map(([modulo, count]) => (
                <div key={modulo} className="flex items-center justify-between">
                  <div className="text-sm">{modulo}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{
                          width: `${(count / kpi.nc_total_abertas) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-sm font-medium">{count}</div>
                  </div>
                </div>
              ))
          ) : (
            <div className="text-sm text-gray-500">Nenhuma NC aberta</div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-600">Alertas Ativos</h3>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg p-4 ${
                alert.severidade === 'critical'
                  ? 'border border-red-200 bg-red-50'
                  : alert.severidade === 'warning'
                  ? 'border border-yellow-200 bg-yellow-50'
                  : 'border border-blue-200 bg-blue-50'
              }`}
            >
              <div className={`text-sm font-medium ${
                alert.severidade === 'critical'
                  ? 'text-red-900'
                  : alert.severidade === 'warning'
                  ? 'text-yellow-900'
                  : 'text-blue-900'
              }`}>
                {alert.tipo.toUpperCase().replace(/_/g, ' ')}
              </div>
              <div className="mt-1 text-sm text-gray-700">{alert.mensagem}</div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="text-sm text-green-900">
          <strong>Resumo do Período:</strong>
          <div className="mt-2 ml-4 space-y-1">
            <div>Total de corridas: {kpi.runs_total}</div>
            <div>NCs abertas: {kpi.nc_total_abertas}</div>
            <div>SLA: {kpi.sla_atendido ? 'ATENDIDO ✓' : 'NÃO ATENDIDO ✗'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
