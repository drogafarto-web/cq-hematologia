/**
 * Portal RT — Críticos Section
 *
 * Real-time listener to /criticos/{labId}/alerts
 * Filter by status != 'acknowledged'
 * Sort by severity DESC, criadoEm DESC
 * Cards with action buttons: Acknowledge, Escalate, Comment
 */

import React, { useEffect, useState, useCallback } from 'react';
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

export interface CriticoAlert {
  id: string;
  labId: string;
  pacienteName: string;
  resultado: string;
  valor: number;
  referencia: string;
  severidade: 'crítico' | 'grave' | 'moderado';
  status: 'pending' | 'acknowledged' | 'escalated' | 'resolved';
  criadoEm: number; // timestamp
  reconhecidoEm?: number;
  escaladoPor?: string;
  teste: string;
}

interface CriticosAlertCardProps {
  alert: CriticoAlert;
  onAcknowledge: (alertId: string) => Promise<void>;
  onEscalate: (alertId: string) => Promise<void>;
  onComment: (alertId: string) => void;
  isProcessing?: boolean;
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: CriticoAlert['severidade'] }) {
  const variants: Record<CriticoAlert['severidade'], 'danger' | 'warning' | 'info'> = {
    crítico: 'danger',
    grave: 'warning',
    moderado: 'info',
  };

  const labels: Record<CriticoAlert['severidade'], string> = {
    crítico: 'Crítico',
    grave: 'Grave',
    moderado: 'Moderado',
  };

  return <PortalBadge variant={variants[severity]}>{labels[severity]}</PortalBadge>;
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function CriticosAlertCard({
  alert,
  onAcknowledge,
  onEscalate,
  onComment,
  isProcessing,
}: CriticosAlertCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAckClick = useCallback(async () => {
    setIsLoading(true);
    try {
      await onAcknowledge(alert.id);
    } finally {
      setIsLoading(false);
    }
  }, [alert.id, onAcknowledge]);

  const handleEscalateClick = useCallback(async () => {
    setIsLoading(true);
    try {
      await onEscalate(alert.id);
    } finally {
      setIsLoading(false);
    }
  }, [alert.id, onEscalate]);

  const timeAgoText = (ts: number) => {
    const now = Date.now();
    const diff = Math.floor((now - ts) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  };

  return (
    <PortalCard>
      <div className="space-y-4">
        {/* Header: patient + test */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${PortalRTTokens.text.primary} truncate`}>
              {alert.pacienteName}
            </p>
            <p className={`text-sm ${PortalRTTokens.text.secondary} truncate`}>
              {alert.teste}
            </p>
          </div>
          <SeverityBadge severity={alert.severidade} />
        </div>

        <PortalDivider />

        {/* Result details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
              Resultado
            </p>
            <p className={`font-semibold ${PortalRTTokens.text.primary}`}>
              {alert.valor}
            </p>
          </div>
          <div>
            <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
              Referência
            </p>
            <p className={`text-sm ${PortalRTTokens.text.secondary}`}>
              {alert.referencia}
            </p>
          </div>
        </div>

        <PortalDivider />

        {/* Footer: time + status */}
        <div className="flex items-center justify-between">
          <PortalTextSecondary className="text-xs">
            {timeAgoText(alert.criadoEm)}
          </PortalTextSecondary>
          <PortalBadge
            variant={
              alert.status === 'escalated'
                ? 'danger'
                : alert.status === 'acknowledged'
                  ? 'info'
                  : 'warning'
            }
          >
            {alert.status === 'pending' && 'Pendente'}
            {alert.status === 'acknowledged' && 'Reconhecido'}
            {alert.status === 'escalated' && 'Escalado'}
          </PortalBadge>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {alert.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={handleAckClick}
                disabled={isLoading || isProcessing}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isLoading || isProcessing
                    ? `${PortalRTTokens.bg.interactive} ${PortalRTTokens.text.tertiary} cursor-not-allowed`
                    : `bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30`
                }`}
              >
                {isLoading ? 'Processando...' : 'Reconhecer'}
              </button>

              <button
                type="button"
                onClick={handleEscalateClick}
                disabled={isLoading || isProcessing}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isLoading || isProcessing
                    ? `${PortalRTTokens.bg.interactive} ${PortalRTTokens.text.tertiary} cursor-not-allowed`
                    : `bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30`
                }`}
              >
                {isLoading ? 'Processando...' : 'Escalar'}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onComment(alert.id)}
            disabled={isProcessing}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${isProcessing
                ? `${PortalRTTokens.bg.interactive} ${PortalRTTokens.text.tertiary} cursor-not-allowed`
                : `bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30`
              }`}
          >
            Comentar
          </button>
        </div>
      </div>
    </PortalCard>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function CriticosSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <PortalCard key={i} className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
            </div>
            <div className="h-6 w-16 rounded-full bg-white/8 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-8 w-12 rounded bg-white/8 animate-pulse" />
            <div className="h-8 w-16 rounded bg-white/8 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-8 rounded bg-white/8 animate-pulse" />
            <div className="flex-1 h-8 rounded bg-white/8 animate-pulse" />
          </div>
        </PortalCard>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={`p-12 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} text-center`}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={`mx-auto mb-4 ${PortalRTTokens.text.tertiary}`}
      >
        <path d="M10 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" />
        <polyline points="8 10 9.5 11.5 12 9" />
      </svg>
      <p className={`font-medium ${PortalRTTokens.text.primary} mb-1`}>
        Nenhum valor crítico pendente
      </p>
      <PortalTextSecondary className="text-sm">
        Todos os valores críticos foram reconhecidos ou resolvidos.
      </PortalTextSecondary>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface CriticosSectionProps {
  labId?: string;
  onActionComplete?: () => void;
}

export function CriticosSection({ labId, onActionComplete }: CriticosSectionProps) {
  const activeLabId = useActiveLabId();
  const currentLabId = labId || activeLabId;

  const [alerts, setAlerts] = useState<CriticoAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Mock data initialization
  useEffect(() => {
    // In Phase 4.2+, this will subscribe to Firestore:
    // onSnapshot(
    //   query(
    //     collection(db, `criticos/${currentLabId}/alerts`),
    //     where('status', '!=', 'acknowledged'),
    //     orderBy('severidade'),
    //     orderBy('criadoEm', 'desc')
    //   ),
    //   (snap) => setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    // )
    const timer = setTimeout(() => {
      setAlerts([
        {
          id: 'alert-1',
          labId: currentLabId || '',
          pacienteName: 'João Silva',
          resultado: '450',
          valor: 450,
          referencia: '150–400',
          severidade: 'crítico',
          status: 'pending',
          criadoEm: Date.now() - 5 * 60000,
          teste: 'Glicose',
        },
        {
          id: 'alert-2',
          labId: currentLabId || '',
          pacienteName: 'Maria Santos',
          resultado: '8.2',
          valor: 8.2,
          referencia: '7.0–7.4',
          severidade: 'grave',
          status: 'pending',
          criadoEm: Date.now() - 15 * 60000,
          teste: 'pH Arterial',
        },
        {
          id: 'alert-3',
          labId: currentLabId || '',
          pacienteName: 'Pedro Costa',
          resultado: '2.1',
          valor: 2.1,
          referencia: '0.7–1.5',
          severidade: 'moderado',
          status: 'acknowledged',
          criadoEm: Date.now() - 45 * 60000,
          reconhecidoEm: Date.now() - 30 * 60000,
          teste: 'Bilirrubina Total',
        },
      ]);
      setIsLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [currentLabId]);

  const handleAcknowledge = useCallback(async (alertId: string) => {
    setProcessingId(alertId);
    try {
      // In Phase 4.2+, call Cloud Function to update status
      await new Promise((resolve) => setTimeout(resolve, 600));
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, status: 'acknowledged', reconhecidoEm: Date.now() } : a
        )
      );
      onActionComplete?.();
    } finally {
      setProcessingId(null);
    }
  }, [onActionComplete]);

  const handleEscalate = useCallback(async (alertId: string) => {
    setProcessingId(alertId);
    try {
      // In Phase 4.2+, call Cloud Function to escalate
      await new Promise((resolve) => setTimeout(resolve, 600));
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: 'escalated' } : a))
      );
      onActionComplete?.();
    } finally {
      setProcessingId(null);
    }
  }, [onActionComplete]);

  const handleComment = useCallback((alertId: string) => {
    // In Phase 4.3+, open comment modal
    console.log('[CriticosSection] Comment action for alert:', alertId);
  }, []);

  const pendingAlerts = alerts.filter((a) => a.status === 'pending');

  if (isLoading) {
    return (
      <PortalSection title="Valores Críticos" subtitle="Escalações e revisões pendentes">
        <CriticosSkeleton />
      </PortalSection>
    );
  }

  return (
    <PortalSection
      title="Valores Críticos"
      subtitle={
        pendingAlerts.length > 0
          ? `${pendingAlerts.length} pendente${pendingAlerts.length !== 1 ? 's' : ''}`
          : 'Nenhum pendente'
      }
    >
      {pendingAlerts.length === 0 && alerts.length > 0 ? (
        <EmptyState />
      ) : pendingAlerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {pendingAlerts.map((alert) => (
            <CriticosAlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onEscalate={handleEscalate}
              onComment={handleComment}
              isProcessing={processingId === alert.id}
            />
          ))}
        </div>
      )}

      {/* Acknowledged alerts section */}
      {alerts.some((a) => a.status === 'acknowledged') && (
        <div className="mt-8 space-y-4">
          <div>
            <h3 className={`text-sm font-medium ${PortalRTTokens.text.secondary} mb-3`}>
              Reconhecidos Hoje
            </h3>
            <div className="space-y-2">
              {alerts
                .filter((a) => a.status === 'acknowledged')
                .map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} flex items-center justify-between`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${PortalRTTokens.text.primary} truncate`}>
                        {alert.pacienteName} — {alert.teste}
                      </p>
                      <p className={`text-xs ${PortalRTTokens.text.tertiary}`}>
                        {alert.valor} ({alert.referencia})
                      </p>
                    </div>
                    <PortalBadge variant="success" className="ml-2">
                      ✓ Reconhecido
                    </PortalBadge>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </PortalSection>
  );
}
