/**
 * MP-6 W2 SA-81 — Ranked suggestion list with up/down voting (dark-first).
 * @see .planning/phases/v1.4-final-closure/MP-6/PLAN.md
 */

import * as React from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { functions, httpsCallable } from '../../../shared/services/firebase';
import { useUser } from '../../../store/useAuthStore';
import {
  subscribeSugestoesRanked,
  timestampToMillis,
  type SugestaoWithUserVote,
  type VoteDirection,
} from '../services/votingService';

export interface SugestaoVotingPanelProps {
  labId: string;
  /** Optional filter — matched against `categoria` (produto, processo, …). */
  filterTopic?: string;
}

type PanelState =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: SugestaoWithUserVote[] }
  | { kind: 'error'; message: string };

function formatDatePt(value: unknown): string {
  const ms = timestampToMillis(value);
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function scoreTone(score: number): string {
  if (score > 0) return 'text-emerald-300/80';
  if (score < 0) return 'text-rose-300/80';
  return 'text-white/60';
}

export function SugestaoVotingPanel({
  labId,
  filterTopic,
}: SugestaoVotingPanelProps): React.JSX.Element {
  const user = useUser();
  const uid = user?.uid ?? '';
  const listId = useId();

  const [panel, setPanel] = useState<PanelState>({ kind: 'loading' });
  const [reducedMotion, setReducedMotion] = useState(false);
  /** Local score / vote overrides while callable is in flight or before snapshot catches up */
  const [overrides, setOverrides] = useState<
    Record<string, { votos: number; userVote: VoteDirection }>
  >({});
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!labId || !uid) {
      setPanel({
        kind: 'error',
        message: 'É necessário estar autenticado para ver e votar nas sugestões.',
      });
      return;
    }

    setPanel({ kind: 'loading' });
    setInlineError(null);

    const unsub = subscribeSugestoesRanked(labId, uid, (rows) => {
      setPanel({ kind: 'ready', rows });
    });

    return () => {
      unsub();
    };
  }, [labId, uid]);

  const filteredRows = useMemo(() => {
    if (panel.kind !== 'ready') return [];
    if (!filterTopic?.trim()) return panel.rows;
    const t = filterTopic.trim().toLowerCase();
    return panel.rows.filter((r) => String(r.categoria).toLowerCase() === t);
  }, [panel, filterTopic]);

  const displayRows = useMemo(() => {
    return filteredRows.map((r) => {
      const o = overrides[r.id];
      if (!o) return r;
      return { ...r, votos: o.votos, userVote: o.userVote };
    });
  }, [filteredRows, overrides]);

  const applyVote = useCallback(
    async (sugestaoId: string, direction: VoteDirection) => {
      if (!uid) return;
      const row = displayRows.find((r) => r.id === sugestaoId);
      if (!row) return;

      const prevVote = row.userVote;
      const prevScore = row.votos;
      const value = (d: VoteDirection) => (d === 'up' ? 1 : d === 'down' ? -1 : 0);
      const optimisticScore = prevScore + value(direction) - value(prevVote);

      setOverrides((prev) => ({
        ...prev,
        [sugestaoId]: { votos: optimisticScore, userVote: direction },
      }));
      setPendingId(sugestaoId);
      setInlineError(null);

      try {
        const payload = { labId, sugestaoId, direction };
        const fn = httpsCallable<typeof payload, { newScore: number; userVote: VoteDirection }>(
          functions,
          'voteSugestao',
        );
        const res = await fn(payload);
        const newScore = res.data?.newScore ?? optimisticScore;
        const userVote = res.data?.userVote ?? direction;
        setOverrides((prev) => ({
          ...prev,
          [sugestaoId]: { votos: newScore, userVote },
        }));
      } catch (e) {
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[sugestaoId];
          return next;
        });
        const msg =
          e instanceof Error ? e.message : 'Não foi possível registrar o voto. Tente novamente.';
        setInlineError(msg);
      } finally {
        setPendingId(null);
      }
    },
    [displayRows, labId, uid],
  );

  const onUp = (id: string, current: VoteDirection) => {
    if (current === 'up') void applyVote(id, 'cleared');
    else void applyVote(id, 'up');
  };

  const onDown = (id: string, current: VoteDirection) => {
    if (current === 'down') void applyVote(id, 'cleared');
    else void applyVote(id, 'down');
  };

  if (panel.kind === 'loading') {
    return (
      <div
        className="space-y-3 max-w-3xl mx-auto"
        role="status"
        aria-busy="true"
        aria-label="Carregando sugestões"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-[#141417] border border-white/10 rounded-2xl p-5 h-28 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (panel.kind === 'error') {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center text-rose-100">
        <p className="text-sm">{panel.message}</p>
      </div>
    );
  }

  if (displayRows.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-white/50">
        <p className="text-lg font-medium text-white/70 mb-2">
          Seja o primeiro a sugerir uma melhoria
        </p>
        <p className="text-sm">
          Nenhuma sugestão ativa neste laboratório
          {filterTopic ? ` na categoria “${filterTopic}”.` : '.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {inlineError ? (
        <div
          className="rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-3 text-rose-200 text-sm flex items-center justify-between gap-3"
          role="alert"
        >
          <span>{inlineError}</span>
          <button
            type="button"
            className="shrink-0 text-xs underline text-rose-100 hover:text-white"
            onClick={() => setInlineError(null)}
          >
            Fechar
          </button>
        </div>
      ) : null}

      <ul className="space-y-3" id={listId} aria-label="Sugestões ordenadas por votos">
        {displayRows.map((row, index) => {
          const rank = index + 1;
          const top3 = rank <= 3;
          const score = row.votos;
          const busy = pendingId === row.id;

          return (
            <li
              key={row.id}
              className="bg-[#141417] border border-white/10 rounded-2xl p-5 flex flex-row gap-4"
            >
              <div className="w-12 flex flex-col items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={row.userVote === 'up'}
                  aria-label="Votar positivamente"
                  className={`rounded-lg p-1 transition-colors disabled:opacity-40 ${
                    row.userVote === 'up'
                      ? 'text-emerald-400'
                      : 'text-white/40 hover:text-emerald-400'
                  }`}
                  onClick={() => onUp(row.id, row.userVote)}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    ▲
                  </span>
                </button>
                <span
                  className={`text-lg tabular-nums font-medium ${scoreTone(score)} ${
                    reducedMotion ? '' : 'transition-colors duration-200'
                  }`}
                  aria-live="polite"
                >
                  {score}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={row.userVote === 'down'}
                  aria-label="Votar negativamente"
                  className={`rounded-lg p-1 transition-colors disabled:opacity-40 ${
                    row.userVote === 'down' ? 'text-rose-400' : 'text-white/40 hover:text-rose-400'
                  }`}
                  onClick={() => onDown(row.id, row.userVote)}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    ▼
                  </span>
                </button>
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {top3 ? (
                    <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded-full font-medium">
                      #{rank}
                    </span>
                  ) : null}
                  <span className="bg-violet-500/15 text-violet-300 text-xs px-2 py-1 rounded-full">
                    {row.categoria}
                  </span>
                </div>
                <h3 className="text-base font-medium text-white tracking-tight">{row.titulo}</h3>
                <p className="text-sm text-white/70 leading-relaxed line-clamp-3">
                  {row.descricao}
                </p>
                <div className="text-xs text-white/40 mt-auto pt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    {row.autorTipo === 'paciente' ? 'Paciente' : 'Colaborador'}
                    {row.autorId ? ` · ${row.autorId.slice(0, 8)}…` : ''}
                  </span>
                  <span>{formatDatePt(row.criadoEm)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
