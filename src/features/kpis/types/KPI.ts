/**
 * Módulo: KPIs (Indicadores de Qualidade)
 *
 * Dashboard de métricas em tempo real:
 * - Turnaround (criação → liberação)
 * - Retrabalho (repeat runs)
 * - Origens de NC
 * - Conformidade (runs com popId + equipId + operadorId)
 *
 * Firestore path: /labs/{labId}/kpi-metrics/{date}
 */

import type { Timestamp } from 'firebase/firestore';

export interface KPIDaily {
  readonly id: string;
  readonly labId: string;

  data: Timestamp;

  // Turnaround
  turnaround_media_horas: number;
  turnaround_percentil_95: number;

  // Retrabalho
  retrabalho_percentual: number;
  retrabalho_total: number;

  // Conformidade
  conformidade_percentual: number;
  runs_total: number;
  runs_conformes: number;

  // NC Origins
  nc_total_abertas: number;
  nc_por_origem: Record<string, number>;

  // SLA Compliance
  sla_atendido: boolean;
  sla_limite_horas: number;

  readonly criadoEm: Timestamp;
}

export interface KPIAlert {
  readonly id: string;
  readonly labId: string;

  tipo: 'sla_breach' | 'high_rework' | 'low_conformance';
  severidade: 'info' | 'warning' | 'critical';
  mensagem: string;
  acionada_em: Timestamp;
  lida: boolean;

  readonly criadoEm: Timestamp;
}

export interface KPIDashboardData {
  dataAtual: KPIDaily;
  dataAnterior?: KPIDaily;
  tendencia: 'mejora' | 'deterioro' | 'estavel';
  alertas: KPIAlert[];
}
