/**
 * src/features/reclamacoes/components/RCAFiveWhysWorkflow.tsx
 *
 * MP-6 (v1.4-final-closure) — Admin-facing 5-level "Why?" workflow.
 * Drives `submitRCAAnswer` per-level (auto-save on blur) and
 * `completeRCAFiveWhys` (with LogicalSignature) when all 5 levels are filled.
 *
 * Compliance: RDC 978 Art. 86 + DICQ 4.14.6.
 */

import * as React from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  functions,
  httpsCallable,
} from '../../../shared/services/firebase';
import {
  RCA_QUESTION_TEMPLATES,
  type RCAFiveWhys,
  type RCAFiveWhysAnswer,
  type LogicalSignature,
} from '../types/mp6';

export interface RCAFiveWhysWorkflowProps {
  labId: string;
  reclamacaoId: string;
  initialState?: RCAFiveWhys;
  onCompleted: (rootCause: string) => void;
}

type LevelKey = 1 | 2 | 3 | 4 | 5;

interface LevelLocalState {
  question: string;
  answer: string;
  saving: boolean;
  savedAt?: number;
  error?: string;
}

const MIN_ANSWER = 10;
const MIN_ROOT_CAUSE = 30;

export function RCAFiveWhysWorkflow({
  labId,
  reclamacaoId,
  initialState,
  onCompleted,
}: RCAFiveWhysWorkflowProps): React.JSX.Element {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  // Hydrate from initialState (server-supplied authoritative answers).
  const [levels, setLevels] = useState<Record<LevelKey, LevelLocalState>>(
    () => buildInitial(initialState),
  );
  const [rootCause, setRootCause] = useState<string>(
    initialState?.rootCause ?? '',
  );
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | undefined>();
  const [conflictBanner, setConflictBanner] = useState(false);

  // Re-sync if server pushes new initialState (parent listener).
  useEffect(() => {
    if (!initialState) return;
    setLevels((prev) => {
      const next = { ...prev };
      for (const a of initialState.answers ?? []) {
        const k = a.level as LevelKey;
        if (next[k].answer !== a.answer || next[k].question !== a.question) {
          next[k] = {
            ...next[k],
            answer: a.answer,
            question: a.question,
            savedAt: a.answeredAt,
          };
          setConflictBanner(true);
        }
      }
      return next;
    });
    if (initialState.rootCause && initialState.rootCause !== rootCause) {
      setRootCause(initialState.rootCause);
    }
    // We intentionally skip rootCause from deps to avoid loops; reconcile once
    // per pushed initialState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState]);

  const allLevelsAnswered = useMemo(
    () =>
      ([1, 2, 3, 4, 5] as LevelKey[]).every(
        (l) => levels[l].answer.trim().length >= MIN_ANSWER,
      ),
    [levels],
  );

  const canComplete =
    allLevelsAnswered &&
    rootCause.trim().length >= MIN_ROOT_CAUSE &&
    !completing;

  const setLevelField = useCallback(
    (level: LevelKey, patch: Partial<LevelLocalState>) => {
      setLevels((prev) => ({ ...prev, [level]: { ...prev[level], ...patch } }));
    },
    [],
  );

  const isLevelUnlocked = useCallback(
    (level: LevelKey) => {
      if (level === 1) return true;
      const prev = levels[(level - 1) as LevelKey];
      return prev.answer.trim().length >= MIN_ANSWER;
    },
    [levels],
  );

  const onAnswerBlur = useCallback(
    async (level: LevelKey) => {
      const state = levels[level];
      if (state.answer.trim().length < MIN_ANSWER) return;
      setLevelField(level, { saving: true, error: undefined });
      try {
        const fn = httpsCallable<
          {
            labId: string;
            reclamacaoId: string;
            level: LevelKey;
            question: string;
            answer: string;
          },
          { ok: true }
        >(functions, 'submitRCAAnswer');
        await fn({
          labId,
          reclamacaoId,
          level,
          question: state.question,
          answer: state.answer.trim(),
        });
        setLevelField(level, { saving: false, savedAt: Date.now() });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Falha ao salvar';
        setLevelField(level, { saving: false, error: message });
      }
    },
    [labId, reclamacaoId, levels, setLevelField],
  );

  const onComplete = useCallback(async () => {
    setCompleting(true);
    setCompleteError(undefined);
    try {
      const sig = await buildSignature(rootCause.trim());
      const fn = httpsCallable<
        {
          labId: string;
          reclamacaoId: string;
          rootCause: string;
          signature: LogicalSignature;
        },
        { ok: true }
      >(functions, 'completeRCAFiveWhys');
      await fn({
        labId,
        reclamacaoId,
        rootCause: rootCause.trim(),
        signature: sig,
      });
      onCompleted(rootCause.trim());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível concluir o RCA';
      setCompleteError(message);
    } finally {
      setCompleting(false);
    }
  }, [labId, reclamacaoId, rootCause, onCompleted]);

  return (
    <div className="bg-[#141417] rounded-2xl p-6 border border-white/10 max-w-3xl mx-auto">
      <header className="mb-6">
        <h2 className="text-xl font-medium tracking-tight text-white">
          Análise Cinco Porquês
        </h2>
        <p className="text-sm text-white/60 mt-1 leading-relaxed">
          Cada nível desbloqueia o próximo após uma resposta substancial.
          Salvamos automaticamente ao sair do campo.
        </p>
      </header>

      {conflictBanner && (
        <div
          role="status"
          className="mb-5 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2"
        >
          Outras alterações foram detectadas — recarregamos o formulário.
          Verifique antes de prosseguir.
        </div>
      )}

      <ol
        role="list"
        className="border-l border-white/10 pl-6 space-y-6"
        aria-labelledby="rca-title"
      >
        {([1, 2, 3, 4, 5] as LevelKey[]).map((level) => {
          const state = levels[level];
          const unlocked = isLevelUnlocked(level);
          const answered = state.answer.trim().length >= MIN_ANSWER;
          return (
            <li
              key={level}
              className={[
                'relative',
                reducedMotion ? '' : 'transition-opacity duration-200',
                unlocked ? 'opacity-100' : 'opacity-50',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute -left-[42px] top-0 w-8 h-8 rounded-full flex items-center justify-center tabular-nums text-sm border',
                  answered
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                    : 'bg-violet-500/20 border-violet-500/40 text-violet-300',
                ].join(' ')}
                aria-hidden
              >
                {answered ? '✓' : level}
              </span>

              <QuestionInline
                value={state.question}
                onChange={(q) => setLevelField(level, { question: q })}
                disabled={!unlocked}
              />

              <textarea
                rows={3}
                aria-labelledby={`rca-q-${level}`}
                disabled={!unlocked}
                value={state.answer}
                onChange={(e) =>
                  setLevelField(level, {
                    answer: e.target.value,
                    error: undefined,
                  })
                }
                onBlur={() => onAnswerBlur(level)}
                placeholder="Descreva a causa imediata observada (mínimo 10 caracteres)"
                className="mt-2 w-full bg-[#0e0e10] border border-white/10 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 disabled:bg-white/[0.02] disabled:border-white/5 disabled:cursor-not-allowed rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none resize-none transition-colors duration-150"
              />

              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-white/40 tabular-nums">
                  {state.answer.length} caracteres
                </span>
                {state.saving && (
                  <span className="text-white/50">Salvando…</span>
                )}
                {!state.saving && state.savedAt && !state.error && (
                  <span className="text-emerald-400 tabular-nums">
                    Salvo {formatTime(state.savedAt)}
                  </span>
                )}
                {state.error && (
                  <span role="alert" className="text-rose-300">
                    {state.error}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {allLevelsAnswered && (
        <div
          className={[
            'mt-8 bg-violet-500/[0.06] border border-violet-500/30 rounded-xl p-5',
            reducedMotion ? '' : 'transition-all duration-200',
          ].join(' ')}
        >
          <h3 className="text-base font-medium text-white">
            Causa raiz identificada
          </h3>
          <p className="text-xs text-white/55 mt-1 leading-relaxed">
            Formalize a causa raiz que será encadeada à eventual ação corretiva
            (CAPA). Mínimo {MIN_ROOT_CAUSE} caracteres.
          </p>
          <textarea
            rows={3}
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            placeholder="Resumo da causa raiz (mínimo 30 caracteres)"
            className="mt-3 w-full bg-[#0e0e10] border border-white/10 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none resize-none transition-colors duration-150"
          />

          {completeError && (
            <p
              role="alert"
              className="mt-3 text-xs text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-lg px-3 py-2"
            >
              {completeError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={onComplete}
              disabled={!canComplete}
              className="bg-violet-500 hover:bg-violet-600 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors duration-150"
            >
              {completing ? 'Concluindo…' : 'Concluir RCA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Building blocks ────────────────────────────────────────────────────────

function QuestionInline({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  if (editing && !disabled) {
    return (
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-full bg-[#0e0e10] border border-white/10 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className="text-sm text-white/80 hover:text-white text-left w-full disabled:cursor-not-allowed disabled:hover:text-white/80"
    >
      {value}
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildInitial(
  initial?: RCAFiveWhys,
): Record<LevelKey, LevelLocalState> {
  const byLevel = new Map<LevelKey, RCAFiveWhysAnswer>();
  for (const a of initial?.answers ?? []) {
    byLevel.set(a.level as LevelKey, a);
  }
  const out = {} as Record<LevelKey, LevelLocalState>;
  for (const l of [1, 2, 3, 4, 5] as LevelKey[]) {
    const existing = byLevel.get(l);
    out[l] = {
      question: existing?.question ?? RCA_QUESTION_TEMPLATES[l - 1],
      answer: existing?.answer ?? '',
      saving: false,
      savedAt: existing?.answeredAt,
    };
  }
  return out;
}

async function buildSignature(payload: string): Promise<LogicalSignature> {
  const ts = Date.now();
  const operatorId = 'client'; // server overwrites with auth.uid for verification.
  const buf = new TextEncoder().encode(`${payload}|${ts}|${operatorId}`);
  let hash: string;
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  ) {
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    hash = bufferToHex(hashBuf);
  } else {
    // Fallback: 64-char placeholder. Server validates real hash via Firebase
    // rules + callable; client signature is informational here.
    hash = 'f'.repeat(64);
  }
  return { hash, operatorId, ts };
}

function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}
