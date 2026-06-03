/**
 * CriticosFSMPanel.tsx — Phase 10 (MP-4)
 *
 * Operator-facing UI for critical value FSM.
 * Shows 4-state visualization, case metadata, action buttons, and immutable history.
 *
 * Dark-first, WCAG AA, world-class design per HC Quality standards.
 */

import type { JSX } from 'react';
import React, { useEffect, useState } from 'react';
import { subscribeCase, transition } from '../services/criticosFSMService';
import type {
  CriticoCase,
  CriticoFSMState,
  CriticoTransitionEvent,
  FSMTransitionRecord,
} from '../types';

interface CriticosFSMPanelProps {
  labId: string;
  caseId: string;
  onAcknowledged?: () => void;
  onResolved?: () => void;
}

// ─── State pills component ─────────────────────────────────────────────────

function StatePills({ currentState }: { currentState: CriticoFSMState }) {
  const states: CriticoFSMState[] = ['NORMAL', 'CRITICO', 'ALERTADO', 'RESOLVIDO'];
  const stateLabels: Record<CriticoFSMState, string> = {
    NORMAL: 'Normal',
    CRITICO: 'Crítico',
    ALERTADO: 'Alertado',
    RESOLVIDO: 'Resolvido',
  };

  const isReached = (state: CriticoFSMState): boolean => {
    const stateOrder: Record<CriticoFSMState, number> = {
      NORMAL: 0,
      CRITICO: 1,
      ALERTADO: 2,
      RESOLVIDO: 3,
    };
    return stateOrder[state] <= stateOrder[currentState];
  };

  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      {states.map((state, idx) => (
        <React.Fragment key={state}>
          <button
            type="button"
            aria-current={state === currentState ? 'step' : undefined}
            className={`
              px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150
              ${
                state === currentState
                  ? 'bg-violet-500 text-white'
                  : isReached(state)
                    ? 'bg-emerald-500/30 text-emerald-200'
                    : 'bg-white/5 text-white/40'
              }
            `}
          >
            {stateLabels[state]}
          </button>
          {idx < states.length - 1 && (
            <div
              className={`
                w-8 h-1 rounded transition-colors duration-150
                ${isReached(states[idx + 1]) ? 'bg-emerald-500/50' : 'bg-white/10'}
              `}
              aria-hidden="true"
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Metadata table ────────────────────────────────────────────────────────

function MetadataTable({ caseData }: { caseData: CriticoCase }) {
  const detectedAtStr = new Date(caseData.detectedAt).toLocaleString('pt-BR');
  const slaMinutes = Math.floor(caseData.slaTargetMs / 1000 / 60);

  return (
    <div className="bg-white/5 rounded-lg p-4 mb-6 space-y-3">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-white/60">Analito</p>
          <p className="text-white font-mono">{caseData.analitoId}</p>
        </div>
        <div>
          <p className="text-white/60">Resultado ID</p>
          <p className="text-white font-mono text-xs">{caseData.resultId.slice(0, 12)}…</p>
        </div>
        <div>
          <p className="text-white/60">Detectado em</p>
          <p className="text-white text-xs">{detectedAtStr}</p>
        </div>
        <div>
          <p className="text-white/60">SLA Alvo</p>
          <p className="text-white font-tabular-nums">{slaMinutes} min</p>
        </div>
      </div>
      {caseData.slaBreached && (
        <div className="bg-red-500/20 border border-red-500/40 rounded px-3 py-2 text-xs text-red-200">
          ⚠️ SLA breached — escalation took longer than target
        </div>
      )}
    </div>
  );
}

// ─── History timeline ─────────────────────────────────────────────────────

function HistoryTimeline({ history }: { history: FSMTransitionRecord[] }) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {history.length === 0 ? (
        <p className="text-white/40 text-xs">No transitions recorded</p>
      ) : (
        history.map((record, idx) => {
          const timeStr = new Date(record.at).toLocaleTimeString('pt-BR');
          const eventType: Record<string, string> = {
            detect: '🔍 Detectado',
            alert: '🔔 Alerta acionado',
            acknowledge: '✋ Reconhecido',
            resolve: '✅ Resolvido',
          };

          return (
            <div key={idx} className="bg-white/5 rounded px-3 py-2 text-xs">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-mono text-white/60">{timeStr}</span>
                {record.immutable && (
                  <span className="bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded text-xs">
                    Imutável
                  </span>
                )}
              </div>
              <p className="text-white/90">
                {eventType[record.event.type] || record.event.type} ({record.from} → {record.to})
              </p>
              {record.event.type === 'acknowledge' && 'comment' in record.event && (
                <p className="text-white/70 text-xs mt-1 italic">{record.event.comment}</p>
              )}
              {record.event.type === 'resolve' && 'resolution' in record.event && (
                <p className="text-white/70 text-xs mt-1 italic">{record.event.resolution}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────

export default function CriticosFSMPanel({
  labId,
  caseId,
  onAcknowledged,
  onResolved,
}: CriticosFSMPanelProps): JSX.Element {
  const [caseData, setCaseData] = useState<CriticoCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState<'acknowledge' | 'resolve' | null>(null);
  const [comment, setComment] = useState('');

  // Subscribe to case
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeCase(
      labId,
      caseId,
      (c) => {
        setCaseData(c);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId, caseId]);

  // Handle action: escalate (CRITICO → ALERTADO)
  const handleEscalate = async () => {
    if (!caseData) return;
    setTransitioning(true);
    try {
      // In production, call the callable function
      // const response = await fsmEscalacao({ labId, caseId });
      // For now, we transition locally
      await transition(labId, caseId, {
        type: 'alert',
        alertedAt: Date.now(),
        channelsDelivered: ['sms', 'email'],
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTransitioning(false);
    }
  };

  // Handle action: acknowledge (ALERTADO → ALERTADO)
  const handleAcknowledge = async () => {
    if (!caseData || !comment) return;
    setTransitioning(true);
    try {
      await transition(labId, caseId, {
        type: 'acknowledge',
        acknowledgedAt: Date.now(),
        userId: 'current-user', // would come from auth store
        comment,
      });
      setComment('');
      setShowCommentModal(null);
      onAcknowledged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTransitioning(false);
    }
  };

  // Handle action: resolve (ALERTADO → RESOLVIDO)
  const handleResolve = async () => {
    if (!caseData || !comment) return;
    setTransitioning(true);
    try {
      await transition(labId, caseId, {
        type: 'resolve',
        resolvedAt: Date.now(),
        userId: 'current-user',
        resolution: comment,
      });
      setComment('');
      setShowCommentModal(null);
      onResolved?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTransitioning(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-white/10 rounded animate-pulse" />
        <div className="h-32 bg-white/10 rounded animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-4 text-red-200 text-sm">
        Error: {error}
        <button
          onClick={() => window.location.reload()}
          className="block mt-2 text-red-200 underline hover:text-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!caseData) {
    return <div className="text-white/60 text-sm">Case not found</div>;
  }

  const { currentState } = caseData;

  return (
    <div className="bg-gradient-to-br from-white/5 to-white/2.5 rounded-xl p-6 space-y-6">
      {/* State visualization */}
      <StatePills currentState={currentState} />

      {/* Metadata */}
      <MetadataTable caseData={caseData} />

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {currentState === 'CRITICO' && (
          <button
            onClick={handleEscalate}
            disabled={transitioning}
            className={`
              px-4 py-2 rounded font-medium text-sm transition-all duration-150
              ${
                transitioning
                  ? 'bg-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-violet-500 text-white hover:bg-violet-600'
              }
            `}
          >
            {transitioning ? 'Acionando…' : 'Acionar alerta'}
          </button>
        )}

        {currentState === 'ALERTADO' && (
          <>
            <button
              onClick={() => setShowCommentModal('acknowledge')}
              disabled={transitioning}
              className={`
                px-4 py-2 rounded font-medium text-sm transition-all duration-150
                ${
                  transitioning
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }
              `}
            >
              Reconhecer
            </button>
            <button
              onClick={() => setShowCommentModal('resolve')}
              disabled={transitioning}
              className={`
                px-4 py-2 rounded font-medium text-sm transition-all duration-150
                ${
                  transitioning
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }
              `}
            >
              Resolver
            </button>
          </>
        )}

        {currentState === 'RESOLVIDO' && (
          <p className="text-white/60 text-sm">Case closed — no further actions</p>
        )}
      </div>

      {/* History timeline */}
      <div>
        <h3 className="text-sm font-semibold text-white/90 mb-3">Histórico de transições</h3>
        <HistoryTimeline history={caseData.history} />
      </div>

      {/* Comment modal (acknowledge/resolve) */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-white font-semibold text-lg">
              {showCommentModal === 'acknowledge' ? 'Reconhecer' : 'Resolver'}
            </h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                showCommentModal === 'acknowledge'
                  ? 'Comentário (opcional)'
                  : 'Descrição da resolução'
              }
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/40 text-sm focus:outline-none focus:border-violet-500/50"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCommentModal(null);
                  setComment('');
                }}
                className="px-3 py-1.5 rounded text-sm text-white/60 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={showCommentModal === 'acknowledge' ? handleAcknowledge : handleResolve}
                disabled={transitioning}
                className="px-3 py-1.5 rounded text-sm bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50"
              >
                {transitioning ? 'Processando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
