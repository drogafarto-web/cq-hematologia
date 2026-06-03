/**
 * Portal RT — Resultados Section
 *
 * Laudo status dashboard:
 * - pending OCR
 * - waiting RT sign
 * - submitted to NOTIVISA
 * - failed NOTIVISA
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

export type ResultadoStatus = 'pending-ocr' | 'waiting-rt' | 'submitted' | 'failed';

export interface Resultado {
  id: string;
  labId: string;
  pacienteName: string;
  teste: string;
  status: ResultadoStatus;
  criadoEm: number;
  ocrCompletedAt?: number;
  signedAt?: number;
  notivisaSubmittedAt?: number;
  errorMessage?: string;
}

interface ResultadoCardProps {
  resultado: Resultado;
  onSign?: (id: string) => Promise<void>;
  onRetry?: (id: string) => Promise<void>;
  isProcessing?: boolean;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ResultadoStatus }) {
  const variants: Record<ResultadoStatus, 'info' | 'warning' | 'success' | 'danger'> = {
    'pending-ocr': 'info',
    'waiting-rt': 'warning',
    submitted: 'success',
    failed: 'danger',
  };

  const labels: Record<ResultadoStatus, string> = {
    'pending-ocr': 'Aguardando OCR',
    'waiting-rt': 'Aguardando Assinatura',
    submitted: 'Enviado',
    failed: 'Falha na Submissão',
  };

  return <PortalBadge variant={variants[status]}>{labels[status]}</PortalBadge>;
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function ProgressSteps({ status }: { status: ResultadoStatus }) {
  const steps = [
    { id: 'ocr', label: 'OCR' },
    { id: 'rt', label: 'Assinatura' },
    { id: 'notivisa', label: 'NOTIVISA' },
  ];

  const completedSteps = {
    'pending-ocr': 0,
    'waiting-rt': 1,
    submitted: 3,
    failed: 2,
  };

  const current = completedSteps[status];

  return (
    <div className="flex items-center gap-3">
      {steps.map((step, idx) => {
        const isCompleted = idx < current;
        const isCurrent = idx === current - 1 && status !== 'submitted' && status !== 'failed';

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                  ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                        ? `${PortalRTTokens.bg.interactive} ${PortalRTTokens.text.primary}`
                        : `${PortalRTTokens.bg.card} ${PortalRTTokens.text.tertiary}`
                  }`}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <p
                className={`text-xs ${isCompleted ? PortalRTTokens.text.secondary : PortalRTTokens.text.tertiary}`}
              >
                {step.label}
              </p>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mb-5
                  ${isCompleted ? 'bg-emerald-500' : `${PortalRTTokens.border.default} bg-white/8`}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Resultado card ───────────────────────────────────────────────────────────

function ResultadoCard({ resultado, onSign, onRetry, isProcessing }: ResultadoCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSign = async () => {
    if (!onSign) return;
    setIsLoading(true);
    try {
      await onSign(resultado.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsLoading(true);
    try {
      await onRetry(resultado.id);
    } finally {
      setIsLoading(false);
    }
  };

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
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${PortalRTTokens.text.primary} truncate`}>
              {resultado.pacienteName}
            </p>
            <p className={`text-sm ${PortalRTTokens.text.secondary} truncate`}>{resultado.teste}</p>
          </div>
          <StatusBadge status={resultado.status} />
        </div>

        <PortalDivider />

        {/* Progress */}
        <div className="py-2">
          <ProgressSteps status={resultado.status} />
        </div>

        <PortalDivider />

        {/* Time info */}
        <div className="flex items-center justify-between text-xs">
          <PortalTextSecondary>
            {resultado.status === 'submitted'
              ? `Enviado em ${timeAgoText(resultado.notivisaSubmittedAt || Date.now())}`
              : `Recebido ${timeAgoText(resultado.criadoEm)}`}
          </PortalTextSecondary>
        </div>

        {/* Error message if failed */}
        {resultado.status === 'failed' && resultado.errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <p className="text-xs text-rose-300">{resultado.errorMessage}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {resultado.status === 'waiting-rt' && onSign && (
            <button
              type="button"
              onClick={handleSign}
              disabled={isLoading || isProcessing}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  isLoading || isProcessing
                    ? `${PortalRTTokens.bg.interactive} ${PortalRTTokens.text.tertiary} cursor-not-allowed`
                    : `bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30`
                }`}
            >
              {isLoading ? 'Assinando...' : 'Assinar'}
            </button>
          )}

          {resultado.status === 'failed' && onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isLoading || isProcessing}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  isLoading || isProcessing
                    ? `${PortalRTTokens.bg.interactive} ${PortalRTTokens.text.tertiary} cursor-not-allowed`
                    : `bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30`
                }`}
            >
              {isLoading ? 'Reenviando...' : 'Reenviar'}
            </button>
          )}

          <button
            type="button"
            disabled={isProcessing}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                isProcessing
                  ? `${PortalRTTokens.bg.interactive} ${PortalRTTokens.text.tertiary} cursor-not-allowed`
                  : `bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30`
              }`}
          >
            Visualizar
          </button>
        </div>
      </div>
    </PortalCard>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ResultadosSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <PortalCard key={i} className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
            </div>
            <div className="h-6 w-24 rounded-full bg-white/8 animate-pulse" />
          </div>
          <div className="h-12 w-full rounded bg-white/8 animate-pulse" />
          <div className="flex gap-2">
            <div className="flex-1 h-8 rounded bg-white/8 animate-pulse" />
            <div className="flex-1 h-8 rounded bg-white/8 animate-pulse" />
          </div>
        </PortalCard>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ResultadosSectionProps {
  labId?: string;
  onActionComplete?: () => void;
}

export function ResultadosSection({ labId, onActionComplete }: ResultadosSectionProps) {
  const activeLabId = useActiveLabId();
  const currentLabId = labId || activeLabId;

  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Mock data initialization
  useEffect(() => {
    // In Phase 4.2+, this will subscribe to Firestore laudo collection
    const timer = setTimeout(() => {
      setResultados([
        {
          id: 'laudo-1',
          labId: currentLabId || '',
          pacienteName: 'João Silva',
          teste: 'Hemograma Completo',
          status: 'pending-ocr',
          criadoEm: Date.now() - 5 * 60000,
        },
        {
          id: 'laudo-2',
          labId: currentLabId || '',
          pacienteName: 'Maria Santos',
          teste: 'Perfil Lipídico',
          status: 'waiting-rt',
          criadoEm: Date.now() - 15 * 60000,
          ocrCompletedAt: Date.now() - 10 * 60000,
        },
        {
          id: 'laudo-3',
          labId: currentLabId || '',
          pacienteName: 'Pedro Costa',
          teste: 'Eletrólitos',
          status: 'submitted',
          criadoEm: Date.now() - 45 * 60000,
          ocrCompletedAt: Date.now() - 40 * 60000,
          signedAt: Date.now() - 35 * 60000,
          notivisaSubmittedAt: Date.now() - 30 * 60000,
        },
        {
          id: 'laudo-4',
          labId: currentLabId || '',
          pacienteName: 'Ana Lima',
          teste: 'Função Renal',
          status: 'failed',
          criadoEm: Date.now() - 2 * 3600000,
          ocrCompletedAt: Date.now() - 1.5 * 3600000,
          signedAt: Date.now() - 1.5 * 3600000,
          errorMessage: 'Validação NOTIVISA falhou: campo obrigatório ausente',
        },
      ]);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentLabId]);

  const handleSign = async (id: string) => {
    setProcessingId(id);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setResultados((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'submitted',
                signedAt: Date.now(),
                notivisaSubmittedAt: Date.now(),
              }
            : r,
        ),
      );
      onActionComplete?.();
    } finally {
      setProcessingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setProcessingId(id);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setResultados((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'submitted',
                notivisaSubmittedAt: Date.now(),
                errorMessage: undefined,
              }
            : r,
        ),
      );
      onActionComplete?.();
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <PortalSection title="Resultados" subtitle="Testes processados e laudos">
        <ResultadosSkeleton />
      </PortalSection>
    );
  }

  const stats = {
    pendingOcr: resultados.filter((r) => r.status === 'pending-ocr').length,
    waitingRt: resultados.filter((r) => r.status === 'waiting-rt').length,
    submitted: resultados.filter((r) => r.status === 'submitted').length,
    failed: resultados.filter((r) => r.status === 'failed').length,
  };

  return (
    <PortalSection title="Resultados" subtitle="Testes processados e laudos">
      {/* Stats header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div
          className={`p-3 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}
        >
          <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
            Aguardando OCR
          </p>
          <p
            className={`text-xl font-semibold ${stats.pendingOcr > 0 ? 'text-blue-400' : PortalRTTokens.text.primary}`}
          >
            {stats.pendingOcr}
          </p>
        </div>

        <div
          className={`p-3 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}
        >
          <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
            Assinatura RT
          </p>
          <p
            className={`text-xl font-semibold ${stats.waitingRt > 0 ? 'text-amber-400' : PortalRTTokens.text.primary}`}
          >
            {stats.waitingRt}
          </p>
        </div>

        <div
          className={`p-3 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}
        >
          <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
            Enviados
          </p>
          <p
            className={`text-xl font-semibold ${stats.submitted > 0 ? 'text-emerald-400' : PortalRTTokens.text.primary}`}
          >
            {stats.submitted}
          </p>
        </div>

        <div
          className={`p-3 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}
        >
          <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
            Falhas
          </p>
          <p
            className={`text-xl font-semibold ${stats.failed > 0 ? 'text-rose-400' : PortalRTTokens.text.primary}`}
          >
            {stats.failed}
          </p>
        </div>
      </div>

      {/* Resultados list */}
      {resultados.length === 0 ? (
        <div
          className={`p-12 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} text-center`}
        >
          <p className={`font-medium ${PortalRTTokens.text.primary} mb-1`}>
            Nenhum resultado para exibir
          </p>
          <PortalTextSecondary className="text-sm">
            Testes processados aparecerão aqui.
          </PortalTextSecondary>
        </div>
      ) : (
        <div className="space-y-4">
          {resultados.map((resultado) => (
            <ResultadoCard
              key={resultado.id}
              resultado={resultado}
              onSign={resultado.status === 'waiting-rt' ? handleSign : undefined}
              onRetry={resultado.status === 'failed' ? handleRetry : undefined}
              isProcessing={processingId === resultado.id}
            />
          ))}
        </div>
      )}
    </PortalSection>
  );
}
