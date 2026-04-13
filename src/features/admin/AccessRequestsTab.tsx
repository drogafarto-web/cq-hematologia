import { useState, useEffect, useCallback } from 'react';
import type { AccessRequest, UserRole } from '../../types';
import {
  fetchAllAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  deleteAccessRequest,
} from './services/superAdminService';

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M6 4V2h4v2M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

type FilterStatus = 'pending' | 'all' | 'approved' | 'denied';

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: 'Todas',
  pending: 'Pendentes',
  approved: 'Aprovadas',
  denied: 'Negadas',
};

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  approved: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  denied:   'bg-red-500/15 text-red-400 border border-red-500/25',
};

const STATUS_PT: Record<string, string> = {
  pending:  'Pendente',
  approved: 'Aprovada',
  denied:   'Negada',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AccessRequestsTab() {
  const [requests, setRequests]     = useState<AccessRequest[]>([]);
  const [filter, setFilter]         = useState<FilterStatus>('pending');
  const [loading, setLoading]       = useState(true);
  const [actionId, setActionId]     = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await fetchAllAccessRequests(status);
      setRequests(data);
    } catch (e) {
      setError('Erro ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(req: AccessRequest) {
    setActionId(req.id);
    try {
      await approveAccessRequest(req.id, req.labId, req.uid);
      await load();
    } catch {
      setError('Erro ao aprovar. Tente novamente.');
    } finally {
      setActionId(null);
    }
  }

  async function handleDeny(req: AccessRequest) {
    setActionId(req.id);
    try {
      await denyAccessRequest(req.id, req.uid);
      await load();
    } catch {
      setError('Erro ao negar. Tente novamente.');
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(req: AccessRequest) {
    setActionId(req.id);
    try {
      await deleteAccessRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch {
      setError('Erro ao remover. Tente novamente.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        {(Object.keys(STATUS_LABELS) as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              filter === s
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm py-6">
          <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full inline-block" />
          Carregando...
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-white/30">
          <ClockIcon />
          <p className="text-sm">Nenhuma solicitação {filter !== 'all' && STATUS_PT[filter]?.toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="group flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] transition-colors"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white/60 text-sm font-medium">
                {(req.displayName || req.email)[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{req.displayName || req.email}</p>
                <p className="text-xs text-white/40 truncate">{req.email}</p>
                <p className="text-xs text-white/30 mt-0.5">
                  Lab: <span className="text-white/50">{req.labName || req.labId}</span>
                  &nbsp;·&nbsp;{formatDate(req.createdAt)}
                </p>
              </div>

              {/* Status badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_BADGE[req.status]}`}>
                {STATUS_PT[req.status]}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {req.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={actionId === req.id}
                      title="Aprovar"
                      className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-40 transition-colors"
                    >
                      <CheckIcon />
                    </button>
                    <button
                      onClick={() => handleDeny(req)}
                      disabled={actionId === req.id}
                      title="Negar"
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 disabled:opacity-40 transition-colors"
                    >
                      <XIcon />
                    </button>
                  </>
                )}
                {req.status !== 'pending' && (
                  <button
                    onClick={() => handleDelete(req)}
                    disabled={actionId === req.id}
                    title="Remover registro"
                    className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
