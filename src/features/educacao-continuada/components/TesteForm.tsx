import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useAvaliacaoTeste, type RespostaSubmissao } from '../hooks/useAvaliacaoTeste';
import { useQuestoes } from '../hooks/useQuestoes';
import type { Questao, Execucao } from '../types/EducacaoContinuada';

import { inputClass } from './_formPrimitives';

export interface TesteFormProps {
  execucao: Execucao;
  colaboradorId: string;
  colaboradorNome: string;
  /**
   * Se fornecido, inicia countdown em minutos. Ao chegar a zero, submete
   * automaticamente o que foi respondido (se houver ao menos 1 resposta).
   */
  tempoMinutos?: number;
  onSubmitted: (result: {
    pontuacaoTotal: number;
    percentualAcerto: number;
    aprovado: boolean;
    temDissertativasPendentes: boolean;
  }) => void;
  onCancel: () => void;
}

interface FormState {
  respostas: Record<string, Partial<RespostaSubmissao>>;
  /** Timestamp de início do teste — usado pra derivar tempo restante. */
  startedAt: number;
}

function storageKey(execucaoId: string, colaboradorId: string): string {
  return `ec-teste-${execucaoId}-${colaboradorId}`;
}

function loadDraft(execucaoId: string, colaboradorId: string): FormState | null {
  try {
    const raw = localStorage.getItem(storageKey(execucaoId, colaboradorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormState;
    if (!parsed.respostas || typeof parsed.startedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(execucaoId: string, colaboradorId: string, state: FormState): void {
  try {
    localStorage.setItem(storageKey(execucaoId, colaboradorId), JSON.stringify(state));
  } catch {
    // quota cheia ou Safari private mode — segue sem persistir
  }
}

function clearDraft(execucaoId: string, colaboradorId: string): void {
  try {
    localStorage.removeItem(storageKey(execucaoId, colaboradorId));
  } catch {
    // nop
  }
}

/**
 * Form de resposta do colaborador (Fase 8). Lista questões ativas do template
 * da execução; submete via callable `ec_submeterTeste` que corrige server-side
 * (RN-10).
 *
 * Features (2026-04-24):
 *   - Save parcial em `localStorage` — restaura respostas após refresh/browser crash
 *   - Timer countdown opcional — submete automaticamente ao zerar
 *   - Barra de progresso de respostas preenchidas
 *   - Confirmação antes de submeter definitivamente
 */
export function TesteForm({
  execucao,
  colaboradorId,
  colaboradorNome,
  tempoMinutos,
  onSubmitted,
  onCancel,
}: TesteFormProps) {
  const templateId = execucao['templateId' as keyof Execucao] as string | undefined;
  const { questoes, isLoading } = useQuestoes({
    templateId,
    somenteAtivas: true,
  });
  const { submeter } = useAvaliacaoTeste();

  // Draft loader — tenta recuperar estado anterior uma única vez
  const [state, setState] = useState<FormState>(() => {
    const draft = loadDraft(execucao.id, colaboradorId);
    if (draft) return draft;
    return { respostas: {}, startedAt: Date.now() };
  });
  const [isSaving, setIsSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const submitRef = useRef<() => Promise<void>>(async () => {});

  // Persistência automática em localStorage a cada mudança
  useEffect(() => {
    saveDraft(execucao.id, colaboradorId, state);
  }, [state, execucao.id, colaboradorId]);

  // Tick do timer (1s) — só ativo se tempoMinutos fornecido
  useEffect(() => {
    if (!tempoMinutos) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [tempoMinutos]);

  // Auto-submit ao zerar timer
  const tempoRestanteMs = useMemo<number | null>(() => {
    if (!tempoMinutos) return null;
    const deadline = state.startedAt + tempoMinutos * 60 * 1000;
    return Math.max(0, deadline - now);
  }, [tempoMinutos, state.startedAt, now]);

  useEffect(() => {
    if (tempoRestanteMs === 0 && !isSaving) {
      void submitRef.current();
    }
  }, [tempoRestanteMs, isSaving]);

  if (!templateId) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        Esta execução não tem template associado — banco de questões não aplicável.
      </div>
    );
  }

  const setResposta = (qid: string, patch: Partial<RespostaSubmissao>): void => {
    setState((prev) => ({
      ...prev,
      respostas: {
        ...prev.respostas,
        [qid]: { ...prev.respostas[qid], questaoId: qid, ...patch },
      },
    }));
  };

  // Contagem de respostas efetivamente preenchidas (não só iniciadas)
  const respondidasCount = useMemo(() => {
    return questoes.reduce((acc, q) => {
      const r = state.respostas[q.id];
      if (!r) return acc;
      if (q.tipo === 'dissertativa') {
        return acc + (r.respostaTexto && r.respostaTexto.trim().length > 0 ? 1 : 0);
      }
      return acc + (r.opcaoId ? 1 : 0);
    }, 0);
  }, [questoes, state.respostas]);

  const doSubmit = async (): Promise<void> => {
    setErr(null);
    const lista: RespostaSubmissao[] = [];
    for (const q of questoes) {
      const r = state.respostas[q.id];
      if (!r) continue;
      if (q.tipo === 'dissertativa') {
        if (r.respostaTexto && r.respostaTexto.trim().length > 0) {
          lista.push({ questaoId: q.id, respostaTexto: r.respostaTexto.trim() });
        }
      } else if (r.opcaoId) {
        lista.push({ questaoId: q.id, opcaoId: r.opcaoId });
      }
    }
    if (lista.length === 0) {
      setErr('Responda ao menos 1 questão antes de submeter.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await submeter({
        execucaoId: execucao.id,
        colaboradorId,
        respostas: lista,
      });
      clearDraft(execucao.id, colaboradorId);
      onSubmitted(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao submeter teste.');
      setIsSaving(false);
    }
  };

  // Keep stable ref para o auto-submit do timer
  submitRef.current = doSubmit;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const total = questoes.length;
    const incompleto = respondidasCount < total;
    if (incompleto) {
      const ok = window.confirm(
        `Você respondeu ${respondidasCount} de ${total} questões. Submeter assim mesmo? Questões não respondidas pontuam zero.`,
      );
      if (!ok) return;
    }
    await doSubmit();
  };

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded border border-slate-800 bg-slate-900/40" />;
  }
  if (questoes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 py-12 text-center text-sm text-slate-400">
        Nenhuma questão cadastrada para o template desta execução.
      </div>
    );
  }

  const progressoPct =
    questoes.length > 0 ? Math.round((respondidasCount / questoes.length) * 100) : 0;
  const temDraft = Object.keys(state.respostas).length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-100">Teste de avaliação</h2>
            <p className="text-sm text-slate-400">Colaborador: {colaboradorNome}</p>
          </div>
          {tempoRestanteMs !== null && <TimerBadge msRestantes={tempoRestanteMs} />}
        </div>

        {temDraft && !isSaving && (
          <p className="text-[11px] text-slate-500">
            Respostas salvas localmente — se você fechar e voltar, ficam preservadas.
          </p>
        )}

        {/* Barra de progresso */}
        <div className="flex items-center gap-3">
          <progress
            value={respondidasCount}
            max={questoes.length}
            aria-label="Progresso de respostas"
            className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-emerald-500 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:bg-emerald-500 [&::-webkit-progress-value]:transition-all"
          />
          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
            {respondidasCount}/{questoes.length} · {progressoPct}%
          </span>
        </div>
      </header>

      <ol className="flex flex-col gap-4">
        {questoes.map((q, idx) => (
          <QuestaoItem
            key={q.id}
            questao={q}
            ordem={idx + 1}
            resposta={state.respostas[q.id]}
            onChange={(patch) => setResposta(q.id, patch)}
            disabled={isSaving}
          />
        ))}
      </ol>

      {err && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {err}
        </p>
      )}

      <footer className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            if (temDraft) {
              const ok = window.confirm(
                'Cancelar o teste? Suas respostas ficam salvas localmente — você pode voltar depois.',
              );
              if (!ok) return;
            }
            onCancel();
          }}
          disabled={isSaving}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {isSaving ? 'Corrigindo…' : 'Submeter teste'}
        </button>
      </footer>
    </form>
  );
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function TimerBadge({ msRestantes }: { msRestantes: number }) {
  const minutos = Math.floor(msRestantes / 60000);
  const segundos = Math.floor((msRestantes % 60000) / 1000);
  const mm = String(minutos).padStart(2, '0');
  const ss = String(segundos).padStart(2, '0');
  const critico = msRestantes < 60000; // < 1 min
  const atencao = msRestantes < 5 * 60000; // < 5 min
  const cls = critico
    ? 'border-red-500/40 bg-red-500/10 text-red-300 animate-pulse'
    : atencao
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
      : 'border-slate-700 bg-slate-900 text-slate-300';
  return (
    <span
      role="timer"
      aria-live={critico ? 'assertive' : 'polite'}
      className={`rounded-md border px-2.5 py-1 text-sm font-semibold tabular-nums ${cls}`}
    >
      {mm}:{ss}
    </span>
  );
}

function QuestaoItem({
  questao,
  ordem,
  resposta,
  onChange,
  disabled,
}: {
  questao: Questao;
  ordem: number;
  resposta: Partial<RespostaSubmissao> | undefined;
  onChange: (patch: Partial<RespostaSubmissao>) => void;
  disabled: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-sm text-slate-100">
        <span className="font-semibold">{ordem}.</span> {questao.enunciado}
        <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">
          {questao.pontuacao} pt
        </span>
      </p>

      {questao.tipo === 'dissertativa' ? (
        <textarea
          value={resposta?.respostaTexto ?? ''}
          onChange={(e) => onChange({ respostaTexto: e.target.value })}
          disabled={disabled}
          rows={3}
          aria-label={`Resposta questão ${ordem}`}
          className={inputClass(false)}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {(questao.opcoes ?? []).map((opt) => (
            <li key={opt.id}>
              <label className="flex items-start gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name={`q-${questao.id}`}
                  value={opt.id}
                  checked={resposta?.opcaoId === opt.id}
                  onChange={() => onChange({ opcaoId: opt.id })}
                  disabled={disabled}
                  className="mt-0.5 shrink-0"
                />
                {opt.texto}
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
