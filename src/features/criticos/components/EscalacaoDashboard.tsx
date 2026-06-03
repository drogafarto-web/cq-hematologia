/**
 * EscalacaoDashboard
 *
 * Real-time escalation tracking dashboard for RT operators.
 * Displays critical value escalations in a table (desktop) or card-based list (mobile).
 * Features:
 * - Live SLA countdown with colored indicators (green/amber/red)
 * - Filter by status (pending/acknowledged/failed)
 * - Sort by SLA deadline (overdue first) and severity
 * - Acknowledge button with success/error handling
 * - RDC 978 Art. 128 compliance: escalation rastreability
 *
 * Task: W4-A2 (Wave 4, Agent 2) — Phase 5 implementation
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, IconAlert, IconCheck, IconClock, Skeleton } from './_ui';
import { useCriticosEscalacoes } from '../hooks/useCriticosEscalacoes';
import { computeSlaState, formatSlaCountdown } from '../utils/slaFormat';
import { useUserRole, useIsSuperAdmin, useAvailableLabs } from '../../../store/useAuthStore';
import type { CriticosEscalacao } from '../types';

type FilterStatus = 'todos' | 'pendentes' | 'reconhecidas' | 'canceladas';

/**
 * Toast state for temporary feedback (not a full toast library — inline alertdialog)
 */
interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export function EscalacaoDashboard() {
  const userRole = useUserRole();
  const isSuperAdmin = useIsSuperAdmin();
  const availableLabs = useAvailableLabs();

  const { escalacoes, isLoading, error, acknowledge } = useCriticosEscalacoes();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pendentes');
  const [filterLab, setFilterLab] = useState<string>('');
  const [sortBy, setSortBy] = useState<'sla_deadline' | 'severity'>('sla_deadline');
  const [acknowledgeLoading, setAcknowledgeLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Live tick for SLA countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Dismiss toast after 3s
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Filter escalations by status
  const filtered = useMemo(() => {
    let result = escalacoes;

    // Status filter
    if (filterStatus === 'pendentes') {
      result = result.filter((e) => e.status === 'enviado');
    } else if (filterStatus === 'reconhecidas') {
      result = result.filter((e) => e.status === 'reconhecido');
    } else if (filterStatus === 'canceladas') {
      result = result.filter((e) => e.status === 'cancelado');
    }

    // Lab filter (only for superadmin)
    if (isSuperAdmin && filterLab) {
      result = result.filter((e) => e.labId === filterLab);
    }

    return result;
  }, [escalacoes, filterStatus, filterLab, isSuperAdmin]);

  // Sort by SLA deadline or severity
  const sorted = useMemo(() => {
    const copy = [...filtered];

    if (sortBy === 'sla_deadline') {
      copy.sort((a, b) => {
        const stateA = computeSlaState(a, now);
        const stateB = computeSlaState(b, now);

        // Expired first, then warning, then in_window
        const kindOrder: Record<string, number> = {
          expired: 0,
          warning: 1,
          in_window: 2,
        };
        if (kindOrder[stateA.kind] !== kindOrder[stateB.kind]) {
          return kindOrder[stateA.kind] - kindOrder[stateB.kind];
        }

        // Within same kind, sort by elapsed time (descending)
        return stateB.elapsedMs - stateA.elapsedMs;
      });
    } else if (sortBy === 'severity') {
      copy.sort((a, b) => {
        // Alta severity first
        if (a.severidade !== b.severidade) {
          return a.severidade === 'alta' ? -1 : 1;
        }
        // Then by SLA deadline
        const stateA = computeSlaState(a, now);
        const stateB = computeSlaState(b, now);
        return stateB.elapsedMs - stateA.elapsedMs;
      });
    }

    return copy;
  }, [filtered, sortBy, now]);

  // Handle acknowledge
  const handleAcknowledge = async (escalacao: CriticosEscalacao) => {
    if (acknowledgeLoading === escalacao.id) return; // Already in progress

    setAcknowledgeLoading(escalacao.id);
    try {
      await acknowledge({ escalacaoId: escalacao.id });
      setToast({
        type: 'success',
        message: `Escalação de ${escalacao.pacienteNome} reconhecida.`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao reconhecer escalação.',
      });
    } finally {
      setAcknowledgeLoading(null);
    }
  };

  // Guard: RT/admin only
  if (!userRole || !['RT', 'ADMIN', 'MEDICO'].includes(userRole)) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-red-200">Acesso restrito a RT, médicos ou administradores.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Escalações Críticas</h1>
        <p className="mt-1 text-sm text-white/60">
          Rastreamento de valores críticos com SLA RDC 978 Art. 5.7.1
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Status Filter */}
          <div>
            <label
              htmlFor="filter-status"
              className="block text-xs font-medium uppercase tracking-wide text-white/50 mb-1.5"
            >
              Status
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-violet-400/20 transition-colors duration-150"
            >
              <option value="todos">Todas</option>
              <option value="pendentes">Pendentes</option>
              <option value="reconhecidas">Reconhecidas</option>
              <option value="canceladas">Canceladas</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="sort-by"
              className="block text-xs font-medium uppercase tracking-wide text-white/50 mb-1.5"
            >
              Ordenar por
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'sla_deadline' | 'severity')}
              className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-violet-400/20 transition-colors duration-150"
            >
              <option value="sla_deadline">SLA (vencidas primeiro)</option>
              <option value="severity">Severidade</option>
            </select>
          </div>

          {/* Lab Filter (superadmin only) */}
          {isSuperAdmin && (
            <div>
              <label
                htmlFor="filter-lab"
                className="block text-xs font-medium uppercase tracking-wide text-white/50 mb-1.5"
              >
                Laboratório
              </label>
              <select
                id="filter-lab"
                value={filterLab}
                onChange={(e) => setFilterLab(e.target.value)}
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-violet-400/20 transition-colors duration-150"
              >
                <option value="">Todos</option>
                {availableLabs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Count badge */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/50">
            {sorted.length} escalação{sorted.length !== 1 ? 'ões' : ''}{' '}
            {filterStatus !== 'todos' ? `(${filterStatus})` : ''}
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-red-200">
          <div className="flex items-start gap-3">
            <IconAlert className="h-4 w-4 shrink-0 mt-0.5 flex-none" />
            <div>
              <p className="font-medium">Falha ao carregar escalações</p>
              <p className="mt-1 text-xs text-red-300/80">{error.message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading state */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : sorted.length === 0 ? (
        <EmptyState filterStatus={filterStatus} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Card className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-white/50">
                      Paciente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-white/50">
                      Analito
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-white/50">
                      Resultado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-white/50">
                      Severidade
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-white/50">
                      SLA
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-white/50">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-white/50">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((escalacao, idx) => (
                    <TableRow
                      key={escalacao.id}
                      escalacao={escalacao}
                      now={now}
                      isLoading={acknowledgeLoading === escalacao.id}
                      onAcknowledge={() => handleAcknowledge(escalacao)}
                      isLast={idx === sorted.length - 1}
                    />
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {sorted.map((escalacao) => (
              <MobileCard
                key={escalacao.id}
                escalacao={escalacao}
                now={now}
                isLoading={acknowledgeLoading === escalacao.id}
                onAcknowledge={() => handleAcknowledge(escalacao)}
              />
            ))}
          </div>
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96"
        >
          <Card
            className={`p-4 flex items-start gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-500/[0.15] border-emerald-500/30'
                : 'bg-red-500/[0.15] border-red-500/30'
            }`}
          >
            <div
              className={`h-5 w-5 shrink-0 flex items-center justify-center rounded-full ${
                toast.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              {toast.type === 'success' ? (
                <IconCheck className="h-3 w-3" />
              ) : (
                <IconAlert className="h-3 w-3" />
              )}
            </div>
            <p
              className={`text-sm ${
                toast.type === 'success' ? 'text-emerald-200' : 'text-red-200'
              }`}
            >
              {toast.message}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Table Row ───────────────────────────────────────────────────────────────

interface TableRowProps {
  escalacao: CriticosEscalacao;
  now: number;
  isLoading: boolean;
  onAcknowledge: () => void;
  isLast: boolean;
}

function TableRow({ escalacao, now, isLoading, onAcknowledge, isLast }: TableRowProps) {
  const slaState = computeSlaState(escalacao, now);
  const isPending = escalacao.status === 'enviado';

  const slaColor =
    escalacao.status === 'reconhecido'
      ? 'emerald'
      : escalacao.status === 'cancelado'
        ? 'slate'
        : slaState.kind === 'expired'
          ? 'red'
          : slaState.kind === 'warning'
            ? 'amber'
            : 'violet';

  const colorClasses: Record<string, { text: string; bg: string; badge: string }> = {
    emerald: {
      text: 'text-emerald-300',
      bg: 'bg-emerald-500/[0.08]',
      badge: 'bg-emerald-500/20 text-emerald-200',
    },
    slate: {
      text: 'text-white/50',
      bg: 'bg-white/[0.02]',
      badge: 'bg-white/10 text-white/60',
    },
    red: {
      text: 'text-red-300',
      bg: 'bg-red-500/[0.08]',
      badge: 'bg-red-500/20 text-red-200',
    },
    amber: {
      text: 'text-amber-300',
      bg: 'bg-amber-500/[0.08]',
      badge: 'bg-amber-500/20 text-amber-200',
    },
    violet: {
      text: 'text-violet-300',
      bg: 'bg-violet-500/[0.08]',
      badge: 'bg-violet-500/20 text-violet-200',
    },
  };

  const c = colorClasses[slaColor];

  return (
    <tr
      className={`hover:${c.bg} transition-colors duration-150 ${
        !isLast ? 'border-b border-white/[0.06]' : ''
      }`}
    >
      {/* Paciente */}
      <td className="px-4 py-3 text-sm">
        <div className="font-medium text-white">{escalacao.pacienteNome}</div>
        <div className="text-xs text-white/40 mt-0.5">
          {escalacao.pacienteIdade} a · {escalacao.pacienteSexo}
        </div>
      </td>

      {/* Analito */}
      <td className="px-4 py-3 text-sm font-mono text-white/70">{escalacao.analitoId}</td>

      {/* Resultado */}
      <td className="px-4 py-3 text-sm text-right">
        <span className="font-semibold text-white tabular-nums">{escalacao.valorObtido}</span>
      </td>

      {/* Severidade */}
      <td className="px-4 py-3 text-center">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            escalacao.severidade === 'alta'
              ? 'bg-red-500/15 text-red-200'
              : 'bg-blue-500/15 text-blue-200'
          }`}
        >
          {escalacao.severidade}
        </span>
      </td>

      {/* SLA */}
      <td className={`px-4 py-3 text-center text-xs font-mono ${c.text}`}>
        <div className="flex items-center justify-center gap-1.5">
          {escalacao.status === 'reconhecido' ? (
            <IconCheck className="h-3.5 w-3.5" />
          ) : escalacao.status === 'cancelado' ? null : slaState.kind === 'expired' ? (
            <IconAlert className="h-3.5 w-3.5" />
          ) : (
            <IconClock className="h-3.5 w-3.5" />
          )}
          <span className="tabular-nums">
            {formatSlaCountdown(slaState.elapsedMs, escalacao.sla_minutos_target)}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-center">
        <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${c.badge}`}>
          {escalacao.status === 'reconhecido'
            ? 'Reconhecida'
            : escalacao.status === 'cancelado'
              ? 'Cancelada'
              : 'Pendente'}
        </span>
      </td>

      {/* Ação */}
      <td className="px-4 py-3 text-center">
        {isPending ? (
          <Button
            variant="primary"
            size="sm"
            onClick={onAcknowledge}
            disabled={isLoading}
            className="text-xs py-1.5 px-3"
          >
            {isLoading ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <IconCheck className="h-3.5 w-3.5" />
                Reconhecer
              </>
            )}
          </Button>
        ) : (
          <span className="text-xs text-white/40">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Mobile Card ─────────────────────────────────────────────────────────────

interface MobileCardProps {
  escalacao: CriticosEscalacao;
  now: number;
  isLoading: boolean;
  onAcknowledge: () => void;
}

function MobileCard({ escalacao, now, isLoading, onAcknowledge }: MobileCardProps) {
  const slaState = computeSlaState(escalacao, now);
  const isPending = escalacao.status === 'enviado';

  const slaColor =
    escalacao.status === 'reconhecido'
      ? 'emerald'
      : escalacao.status === 'cancelado'
        ? 'slate'
        : slaState.kind === 'expired'
          ? 'red'
          : slaState.kind === 'warning'
            ? 'amber'
            : 'violet';

  const colorClasses: Record<string, { ring: string; text: string; bg: string; dot: string }> = {
    emerald: {
      ring: 'border-emerald-500/25',
      text: 'text-emerald-300',
      bg: 'bg-emerald-500/[0.04]',
      dot: 'bg-emerald-400',
    },
    slate: {
      ring: 'border-white/[0.08]',
      text: 'text-white/50',
      bg: 'bg-white/[0.02]',
      dot: 'bg-white/40',
    },
    red: {
      ring: 'border-red-500/30',
      text: 'text-red-300',
      bg: 'bg-red-500/[0.05]',
      dot: 'bg-red-400 motion-safe:animate-pulse',
    },
    amber: {
      ring: 'border-amber-500/25',
      text: 'text-amber-300',
      bg: 'bg-amber-500/[0.04]',
      dot: 'bg-amber-400',
    },
    violet: {
      ring: 'border-violet-500/25',
      text: 'text-violet-300',
      bg: 'bg-violet-500/[0.03]',
      dot: 'bg-violet-400',
    },
  };

  const c = colorClasses[slaColor];

  return (
    <Card className={`${c.ring} ${c.bg} border p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{escalacao.pacienteNome}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {escalacao.pacienteIdade} a · {escalacao.pacienteSexo} · {escalacao.analitoId}
          </p>
        </div>
        <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} aria-hidden="true" />
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-white/60">Resultado:</span>
          <span className="font-semibold text-white tabular-nums">{escalacao.valorObtido}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/60">Severidade:</span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              escalacao.severidade === 'alta'
                ? 'bg-red-500/15 text-red-200'
                : 'bg-blue-500/15 text-blue-200'
            }`}
          >
            {escalacao.severidade}
          </span>
        </div>
        <div className={`flex items-center justify-between ${c.text}`}>
          <span className="text-white/60">SLA:</span>
          <div className="flex items-center gap-1">
            {escalacao.status === 'reconhecido' ? (
              <IconCheck className="h-3.5 w-3.5" />
            ) : slaState.kind === 'expired' ? (
              <IconAlert className="h-3.5 w-3.5" />
            ) : (
              <IconClock className="h-3.5 w-3.5" />
            )}
            <span className="font-mono">
              {formatSlaCountdown(slaState.elapsedMs, escalacao.sla_minutos_target)}
            </span>
          </div>
        </div>
      </div>

      {/* Action */}
      {isPending && (
        <Button
          variant="primary"
          onClick={onAcknowledge}
          disabled={isLoading}
          className="w-full text-xs py-2"
        >
          {isLoading ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <IconCheck className="h-3.5 w-3.5" />
              Reconhecer Escalação
            </>
          )}
        </Button>
      )}
    </Card>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  filterStatus: FilterStatus;
}

function EmptyState({ filterStatus }: EmptyStateProps) {
  const messages: Record<FilterStatus, string> = {
    todos: 'Nenhuma escalação no momento.',
    pendentes: 'Nenhuma escalação pendente. Parabéns!',
    reconhecidas: 'Nenhuma escalação reconhecida.',
    canceladas: 'Nenhuma escalação cancelada.',
  };

  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
        <IconCheck />
      </div>
      <p className="mt-4 text-sm font-medium text-white">{messages[filterStatus]}</p>
      <p className="mt-1 text-xs text-white/50">
        Valores críticos aparecerão aqui quando detectados pelo sistema.
      </p>
    </Card>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
