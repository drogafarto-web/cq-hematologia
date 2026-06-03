/**
 * src/features/nps/components/NPSSurveyForm.tsx
 *
 * MP-6 (v1.4-final-closure) — Single-question NPS form, dark-first, WCAG AA.
 * Drives `submitNPS` callable. Anonymous-OK by default.
 *
 * Design references: Apple, Linear, Stripe.
 * Compliance: DICQ 4.14.4 + LGPD Art. 7/9/11/13 (consent + transparency).
 */

import * as React from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { functions, httpsCallable } from '../../../shared/services/firebase';
import { classifyNPSScore } from '../types';

export interface NPSSurveyFormProps {
  labId: string;
  cycleId: string;
  patientToken?: string;
  onSubmitted: (npsResponseId: string) => void;
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const MIN_FOLLOW_UP = 10;
const MAX_FOLLOW_UP = 1000;

export function NPSSurveyForm({
  labId,
  cycleId,
  patientToken,
  onSubmitted,
}: NPSSurveyFormProps): React.JSX.Element {
  const [score, setScore] = useState<number | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const [reducedMotion, setReducedMotion] = useState(false);

  const groupId = useId();
  const followUpId = useId();
  const counterId = useId();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  const category = useMemo(() => (score === null ? null : classifyNPSScore(score)), [score]);

  const followUpRequired = score !== null && score <= 6;
  const canSubmit =
    score !== null &&
    submitState.kind === 'idle' &&
    (!followUpRequired ||
      (followUp.trim().length >= MIN_FOLLOW_UP && followUp.length <= MAX_FOLLOW_UP));

  const onSubmit = useCallback(async () => {
    if (score === null) return;
    setSubmitState({ kind: 'submitting' });
    try {
      const payload = {
        labId,
        cycleId,
        score,
        followUp: followUpRequired && followUp.trim().length > 0 ? followUp.trim() : undefined,
        patientToken,
      };
      const fn = httpsCallable<typeof payload, { responseId: string }>(functions, 'submitNPS');
      const res = await fn(payload);
      const id = res.data?.responseId;
      if (!id) throw new Error('Resposta inválida do servidor');
      setSubmitState({ kind: 'success' });
      onSubmitted(id);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar sua resposta. Tente novamente.';
      setSubmitState({ kind: 'error', message });
    }
  }, [score, labId, cycleId, followUp, followUpRequired, patientToken, onSubmitted]);

  if (submitState.kind === 'success') {
    return (
      <div className="bg-[#141417] rounded-2xl p-8 border border-white/10 max-w-xl mx-auto text-center">
        <h2 className="text-xl font-medium tracking-tight text-white">Obrigado pelo feedback</h2>
        <p className="mt-2 text-sm text-white/60 leading-relaxed">
          Sua percepção foi registrada e ajudará a calibrar nossas próximas melhorias.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
      className="bg-[#141417] rounded-2xl p-8 border border-white/10 max-w-xl mx-auto"
    >
      <h2 id={groupId} className="text-xl font-medium tracking-tight text-white text-center mb-2">
        Em uma escala de 0 a 10, qual a probabilidade de você recomendar este laboratório a um amigo
        ou colega?
      </h2>
      <p className="text-sm text-white/60 text-center mb-8">
        Sua resposta é anônima por padrão e ajuda a melhorar a qualidade do atendimento.
      </p>

      <div
        role="radiogroup"
        aria-labelledby={groupId}
        className="flex flex-row gap-2 justify-center flex-wrap"
      >
        {Array.from({ length: 11 }, (_, i) => i).map((v) => {
          const active = score === v;
          const baseClass =
            'w-12 h-12 rounded-xl border text-base tabular-nums flex items-center justify-center';
          const idleClass = 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10';
          const activeBg = !active
            ? ''
            : v <= 6
              ? 'bg-rose-500/30 border-rose-500/60 text-white'
              : v <= 8
                ? 'bg-amber-500/30 border-amber-500/60 text-white'
                : 'bg-emerald-500/30 border-emerald-500/60 text-white';
          return (
            <button
              type="button"
              key={v}
              role="radio"
              aria-checked={active}
              onClick={() => setScore(v)}
              className={[
                baseClass,
                active ? activeBg : idleClass,
                reducedMotion ? '' : 'transition-colors duration-150',
              ].join(' ')}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/40 px-1">
        <span>Pouco provável</span>
        <span>Muito provável</span>
      </div>

      {category && (
        <p aria-live="polite" className="mt-4 text-center text-xs text-white/50">
          Você marcou <span className="text-white tabular-nums font-medium">{score}</span> ·{' '}
          {category === 'detractor' ? 'Detrator' : category === 'passive' ? 'Neutro' : 'Promotor'}
        </p>
      )}

      {followUpRequired && (
        <div className={['mt-6', reducedMotion ? '' : 'transition-all duration-200'].join(' ')}>
          <label htmlFor={followUpId} className="block text-sm text-white/80 mb-2">
            O que poderíamos melhorar?
          </label>
          <textarea
            id={followUpId}
            rows={4}
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            maxLength={MAX_FOLLOW_UP}
            placeholder="O que poderíamos melhorar? (mínimo 10 caracteres)"
            aria-describedby={counterId}
            className="w-full bg-[#0e0e10] border border-white/10 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 leading-relaxed outline-none resize-none transition-colors duration-150"
          />
          <p
            id={counterId}
            className="mt-1.5 text-xs text-white/40 tabular-nums flex justify-between"
          >
            <span>
              {followUp.trim().length < MIN_FOLLOW_UP
                ? `${MIN_FOLLOW_UP - followUp.trim().length} caracteres restantes (mínimo)`
                : 'OK'}
            </span>
            <span>
              {followUp.length} / {MAX_FOLLOW_UP}
            </span>
          </p>
        </div>
      )}

      {submitState.kind === 'error' && (
        <p
          role="alert"
          className="mt-5 text-sm text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-lg px-4 py-3"
        >
          {submitState.message}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 w-full bg-violet-500 hover:bg-violet-600 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl text-sm transition-colors duration-150"
      >
        {submitState.kind === 'submitting' ? 'Enviando…' : 'Enviar resposta'}
      </button>
    </form>
  );
}
