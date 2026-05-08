/**
 * Portal RT — Compliance Section
 *
 * DICQ checklist (78.5% → 82%), risk register summary, training expiry alerts
 */

import React, { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  PortalSection,
  PortalCard,
  PortalBadge,
  PortalTextSecondary,
  PortalRTTokens,
  PortalDivider,
} from '../components/_ui';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DICQItem {
  id: string;
  seção: string;
  requisito: string;
  status: 'compliant' | 'partial' | 'non-compliant';
  provedoEm?: number;
  responsavel?: string;
}

export interface RiskItem {
  id: string;
  titulo: string;
  severidade: 'crítico' | 'alto' | 'médio';
  npr: number;
  dataRevisão: number;
}

export interface TrainingAlert {
  id: string;
  nome: string;
  curso: string;
  vencimentoEm: number;
  diasRestantes: number;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ percentage, size = 'md' }: { percentage: number; size?: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };
  const statusColor =
    percentage >= 90
      ? 'bg-emerald-500'
      : percentage >= 70
        ? 'bg-amber-500'
        : 'bg-rose-500';

  return (
    <div className={`w-full ${heights[size]} rounded-full ${PortalRTTokens.bg.interactive} overflow-hidden`}>
      <div
        className={`h-full ${statusColor} transition-all duration-300`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

// ─── DICQ card ────────────────────────────────────────────────────────────────

function DICQItemCard({ item }: { item: DICQItem }) {
  const variants: Record<DICQItem['status'], 'success' | 'warning' | 'danger'> = {
    compliant: 'success',
    partial: 'warning',
    'non-compliant': 'danger',
  };

  const labels: Record<DICQItem['status'], string> = {
    compliant: 'Conforme',
    partial: 'Parcial',
    'non-compliant': 'Não Conforme',
  };

  return (
    <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} flex items-start justify-between gap-4`}>
      <div className="flex-1">
        <div className="flex items-start gap-2 mb-1">
          <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide`}>
            {item.seção}
          </p>
        </div>
        <p className={`text-sm ${PortalRTTokens.text.primary}`}>{item.requisito}</p>
        {item.responsavel && (
          <PortalTextSecondary className="text-xs mt-2">
            Responsável: {item.responsavel}
          </PortalTextSecondary>
        )}
      </div>
      <PortalBadge variant={variants[item.status]}>{labels[item.status]}</PortalBadge>
    </div>
  );
}

// ─── Risk item ────────────────────────────────────────────────────────────────

function RiskItemCard({ item }: { item: RiskItem }) {
  const severityColor = {
    crítico: 'text-rose-400',
    alto: 'text-amber-400',
    médio: 'text-blue-400',
  };

  const severityBg = {
    crítico: 'bg-rose-500/10 border-rose-500/20',
    alto: 'bg-amber-500/10 border-amber-500/20',
    médio: 'bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className={`p-4 rounded-lg border ${PortalRTTokens.border.default} ${severityBg[item.severidade]}`}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <p className={`font-medium ${PortalRTTokens.text.primary}`}>{item.titulo}</p>
        <span className={`text-sm font-semibold ${severityColor[item.severidade]}`}>
          NPR: {item.npr}
        </span>
      </div>
      <p className={`text-xs ${PortalRTTokens.text.tertiary}`}>
        Revisado há {Math.floor((Date.now() - item.dataRevisão) / 86400000)} dias
      </p>
    </div>
  );
}

// ─── Training alert ───────────────────────────────────────────────────────────

function TrainingAlertCard({ alert }: { alert: TrainingAlert }) {
  const isUrgent = alert.diasRestantes <= 7;

  return (
    <div
      className={`p-4 rounded-lg border flex items-start justify-between gap-4
        ${isUrgent ? 'bg-rose-500/10 border-rose-500/20' : `${PortalRTTokens.bg.card} ${PortalRTTokens.border.default}`}`}
    >
      <div className="flex-1">
        <p className={`font-medium ${PortalRTTokens.text.primary}`}>{alert.nome}</p>
        <p className={`text-sm ${PortalRTTokens.text.secondary}`}>{alert.curso}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${isUrgent ? 'text-rose-300' : 'text-white/70'}`}>
          {alert.diasRestantes}d
        </p>
        <p className={`text-xs ${PortalRTTokens.text.tertiary}`}>para vencer</p>
      </div>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ComplianceSkeleton() {
  return (
    <div className="space-y-6">
      {/* Progress section */}
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-white/8 animate-pulse" />
        <div className="h-4 w-full rounded bg-white/8 animate-pulse" />
      </div>

      {/* Items */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 rounded bg-white/8 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ComplianceSectionProps {
  labId?: string;
}

export function ComplianceSection({ labId }: ComplianceSectionProps) {
  const activeLabId = useActiveLabId();
  const currentLabId = labId || activeLabId;

  const [dicqItems, setDicqItems] = useState<DICQItem[]>([]);
  const [riskItems, setRiskItems] = useState<RiskItem[]>([]);
  const [trainingAlerts, setTrainingAlerts] = useState<TrainingAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data initialization
  useEffect(() => {
    // In Phase 4.2+, this will subscribe to Firestore:
    // - /sgq/{labId}/dicq-items
    // - /risks/{labId}/risk-register
    // - /treinamentos/{labId}/expiry-alerts
    const timer = setTimeout(() => {
      setDicqItems([
        {
          id: 'dicq-1',
          seção: '4.1',
          requisito: 'Organização e Responsabilidades',
          status: 'compliant',
          provedoEm: Date.now() - 10 * 86400000,
          responsavel: 'Diretoria',
        },
        {
          id: 'dicq-2',
          seção: '4.2',
          requisito: 'Manual da Qualidade',
          status: 'compliant',
          provedoEm: Date.now() - 5 * 86400000,
          responsavel: 'Coord. Qualidade',
        },
        {
          id: 'dicq-3',
          seção: '4.3',
          requisito: 'Documentos e Registros',
          status: 'partial',
          provedoEm: Date.now() - 2 * 86400000,
          responsavel: 'SGD',
        },
        {
          id: 'dicq-4',
          seção: '4.14',
          requisito: 'Terceirização de Exames',
          status: 'compliant',
          provedoEm: Date.now() - 7 * 86400000,
          responsavel: 'Lab Apoio',
        },
        {
          id: 'dicq-5',
          seção: '5.3',
          requisito: 'Trilha de Auditoria',
          status: 'partial',
          provedoEm: Date.now() - 3 * 86400000,
          responsavel: 'TI',
        },
      ]);

      setRiskItems([
        {
          id: 'risk-1',
          titulo: 'Falha de Calibração de Equipamento',
          severidade: 'crítico',
          npr: 112,
          dataRevisão: Date.now() - 5 * 86400000,
        },
        {
          id: 'risk-2',
          titulo: 'Perda de Dados de Paciente',
          severidade: 'crítico',
          npr: 98,
          dataRevisão: Date.now() - 12 * 86400000,
        },
        {
          id: 'risk-3',
          titulo: 'Contaminação Cruzada em Área de CQ',
          severidade: 'alto',
          npr: 72,
          dataRevisão: Date.now() - 8 * 86400000,
        },
      ]);

      setTrainingAlerts([
        {
          id: 'train-1',
          nome: 'Maria Silva',
          curso: 'ISO 15189:2022',
          vencimentoEm: Date.now() + 5 * 86400000,
          diasRestantes: 5,
        },
        {
          id: 'train-2',
          nome: 'João Santos',
          curso: 'Biossegurança NB2',
          vencimentoEm: Date.now() + 15 * 86400000,
          diasRestantes: 15,
        },
        {
          id: 'train-3',
          nome: 'Ana Costa',
          curso: 'LGPD e Privacidade',
          vencimentoEm: Date.now() + 30 * 86400000,
          diasRestantes: 30,
        },
      ]);

      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentLabId]);

  if (isLoading) {
    return (
      <PortalSection title="Compliance" subtitle="Conformidade regulatória e auditoria">
        <ComplianceSkeleton />
      </PortalSection>
    );
  }

  const compliantCount = dicqItems.filter((i) => i.status === 'compliant').length;
  const dicqPercentage = Math.round((compliantCount / dicqItems.length) * 100);
  const criticalRisks = riskItems.filter((r) => r.severidade === 'crítico');
  const urgentTrainings = trainingAlerts.filter((t) => t.diasRestantes <= 7);

  return (
    <PortalSection title="Compliance" subtitle="Conformidade regulatória e auditoria">
      {/* DICQ Compliance */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>
                Conformidade DICQ
              </h3>
              <p className={`text-xs ${PortalRTTokens.text.tertiary} mt-1`}>
                Requisitos de qualidade normalizados
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-semibold ${dicqPercentage >= 90 ? 'text-emerald-400' : dicqPercentage >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                {dicqPercentage}%
              </p>
            </div>
          </div>
          <ProgressBar percentage={dicqPercentage} />
        </div>

        <div className="mt-4 space-y-2">
          {dicqItems.map((item) => (
            <DICQItemCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      <PortalDivider className="my-6" />

      {/* Risk Register */}
      <div className="space-y-4">
        <div>
          <h3 className={`text-sm font-medium ${PortalRTTokens.text.primary} mb-1`}>
            Registro de Riscos
          </h3>
          <p className={`text-xs ${PortalRTTokens.text.tertiary} mb-4`}>
            {criticalRisks.length} crítico(s) — revisão periódica requerida
          </p>
        </div>

        <div className="space-y-2">
          {riskItems.map((item) => (
            <RiskItemCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      <PortalDivider className="my-6" />

      {/* Training Alerts */}
      <div className="space-y-4">
        <div>
          <h3 className={`text-sm font-medium ${PortalRTTokens.text.primary} mb-1`}>
            Vencimentos de Treinamento
          </h3>
          <p className={`text-xs ${PortalRTTokens.text.tertiary} mb-4`}>
            {urgentTrainings.length} vencimento(s) nos próximos 7 dias
          </p>
        </div>

        {trainingAlerts.length === 0 ? (
          <div className={`p-6 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} text-center`}>
            <p className={`text-sm ${PortalRTTokens.text.secondary}`}>
              Nenhum treinamento vencendo
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {trainingAlerts.map((alert) => (
              <TrainingAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
          <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-2`}>
            Auditorias
          </p>
          <p className={`text-xl font-semibold ${PortalRTTokens.text.primary}`}>3</p>
          <p className={`text-xs ${PortalRTTokens.text.tertiary} mt-1`}>neste período</p>
        </div>

        <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
          <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-2`}>
            Não Conformidades
          </p>
          <p className={`text-xl font-semibold text-amber-400`}>2</p>
          <p className={`text-xs ${PortalRTTokens.text.tertiary} mt-1`}>aguardando ação</p>
        </div>

        <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
          <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-2`}>
            Próxima Auditoria
          </p>
          <p className={`text-xl font-semibold ${PortalRTTokens.text.primary}`}>12d</p>
          <p className={`text-xs ${PortalRTTokens.text.tertiary} mt-1`}>programada</p>
        </div>
      </div>
    </PortalSection>
  );
}
