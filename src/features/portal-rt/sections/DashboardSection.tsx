/**
 * Portal RT — Dashboard Section
 *
 * Main operator view with 4-card grid:
 * - Críticos pending
 * - Acknowledged last 24h
 * - Escalations this week
 * - System health
 */

import React, { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  PortalSection,
  PortalCard,
  PortalHeading,
  PortalTextSecondary,
  PortalBadge,
  PortalRTTokens,
} from '../components/_ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardMetric {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'success' | 'warning' | 'danger';
}

interface DashboardCardProps {
  title: string;
  metric: DashboardMetric;
  icon?: React.ReactNode;
}

// ─── Card component ────────────────────────────────────────────────────────────

function DashboardCard({ title, metric, icon }: DashboardCardProps) {
  const statusColor = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
  };

  return (
    <PortalCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-xs font-medium ${PortalRTTokens.text.tertiary} uppercase tracking-wide`}>
            {title}
          </p>
        </div>
        {icon && <div className={`${statusColor[metric.status || 'success']} flex-shrink-0`}>{icon}</div>}
      </div>

      <div className="space-y-2">
        <p className={`text-3xl font-semibold ${PortalRTTokens.text.primary}`}>
          {metric.value}
        </p>
        {metric.trendValue && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${statusColor[metric.status || 'success']}`}>
              {metric.trend === 'up' && '↑'}
              {metric.trend === 'down' && '↓'}
              {metric.trend === 'stable' && '→'}
              {' '}
              {metric.trendValue}
            </span>
            <PortalTextSecondary className="text-xs">últimas 24h</PortalTextSecondary>
          </div>
        )}
      </div>
    </PortalCard>
  );
}

// ─── Skeleton for loading state ────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <PortalCard key={i} className="gap-4">
          <div className="h-4 w-20 rounded bg-white/8 animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-12 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
          </div>
        </PortalCard>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface DashboardSectionProps {
  labId?: string;
}

export function DashboardSection({ labId }: DashboardSectionProps) {
  const activeLabId = useActiveLabId();
  const currentLabId = labId || activeLabId;

  const [metrics, setMetrics] = useState<{
    pending: DashboardMetric;
    acknowledged: DashboardMetric;
    escalations: DashboardMetric;
    health: DashboardMetric;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Mock data initialization
  useEffect(() => {
    // In Phase 4.2+, this will subscribe to Firestore collections:
    // - /criticos/{labId}/alerts
    // - /criticos/{labId}/acknowledgments
    // - /escalations/{labId}/events
    // For now, simulate with mock data
    const timer = setTimeout(() => {
      setMetrics({
        pending: {
          label: 'Críticos Pendentes',
          value: 3,
          trend: 'down',
          trendValue: '−2',
          status: 'warning',
        },
        acknowledged: {
          label: 'Reconhecidos 24h',
          value: 12,
          trend: 'up',
          trendValue: '+4',
          status: 'success',
        },
        escalations: {
          label: 'Escalações Semana',
          value: 5,
          trend: 'stable',
          trendValue: 'vs 5',
          status: 'warning',
        },
        health: {
          label: 'Saúde do Sistema',
          value: '99.8%',
          trend: 'stable',
          trendValue: 'nominal',
          status: 'success',
        },
      });
      setIsLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [currentLabId]);

  if (isLoading || !metrics) {
    return (
      <PortalSection title="Dashboard" subtitle="Visão geral operacional">
        <DashboardSkeleton />
      </PortalSection>
    );
  }

  return (
    <PortalSection title="Dashboard" subtitle="Visão geral operacional">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Críticos Pendentes"
          metric={metrics.pending}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="9" />
              <line x1="10" y1="6" x2="10" y2="10" />
              <line x1="10" y1="14" x2="10.01" y2="14" />
            </svg>
          }
        />

        <DashboardCard
          title="Reconhecidos 24h"
          metric={metrics.acknowledged}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 2c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" />
              <polyline points="7 10 9 12 13 8" />
            </svg>
          }
        />

        <DashboardCard
          title="Escalações Semana"
          metric={metrics.escalations}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 17l2-6h2l-2 6M15 17l2-6h-2l-2-6" />
              <polyline points="10 2 15 6 10 10 5 6 10 2" />
            </svg>
          }
        />

        <DashboardCard
          title="Saúde do Sistema"
          metric={metrics.health}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" />
              <polyline points="8 10 9.5 11.5 12 9" />
            </svg>
          }
        />
      </div>

      {/* Quick stats row */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
          <p className={`text-xs font-medium ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-2`}>
            Taxa Conformidade
          </p>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-semibold ${PortalRTTokens.text.primary}`}>98.2%</span>
            <PortalBadge variant="success" className="mb-0.5">+1.2%</PortalBadge>
          </div>
        </div>

        <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
          <p className={`text-xs font-medium ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-2`}>
            Testes em Fila
          </p>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-semibold ${PortalRTTokens.text.primary}`}>24</span>
            <PortalBadge variant="info" className="mb-0.5">processando</PortalBadge>
          </div>
        </div>

        <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
          <p className={`text-xs font-medium ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-2`}>
            Tempo Médio RT
          </p>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-semibold ${PortalRTTokens.text.primary}`}>2.4m</span>
            <PortalBadge variant="success" className="mb-0.5">−0.6m</PortalBadge>
          </div>
        </div>
      </div>
    </PortalSection>
  );
}
