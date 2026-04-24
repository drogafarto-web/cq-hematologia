import { useState, type FormEvent } from 'react';

import { useAvaliacaoTeste, type RespostaSubmissao } from '../hooks/useAvaliacaoTeste';
import { useQuestoes } from '../hooks/useQuestoes';
import type { Questao, Execucao } from '../types/EducacaoContinuada';

import { inputClass } from './_formPrimitives';

export interface TesteFormProps {
  execucao: Execucao;
  colaboradorId: string;
  colaboradorNome: string;
  onSubmitted: (result: {
    pontuacaoTotal: number;
    percentualAcerto: number;
    aprovado: boolean;
    temDissertativasPendentes: boolean;
  }) => void;
  onCancel: () => void;
}

/**
 * Form de resposta do colaborador (Fase 8). Lista questões ativas do template
 * da execução; submete via callable `ec_submeterTeste` que corrige server-side
 * (RN-10). Sem timer, sem save parcial — MVP.
 */
export function TesteForm({
  execucao,
  colaboradorId,
  colaboradorNome,
  onSubmitted,
  onCancel,
}: TesteFormProps) {
  const templateId = execucao['templateId' as keyof Execucao] as string | undefined;
  const { questoes, isLoading } = useQuestoes({
    templateId,
    somenteAtivas: true,
  });
  const { submeter } = useAvaliacaoTeste();

  const [respostas, setRespostas] = useState<Record<string, Partial<RespostaSubmissao>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!templateId) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        Esta execução não tem template associado — banco de questões não aplicável.
      </div>
    );
  }

  const setResposta = (qid: string, patch: Partial<RespostaSubmissao>) => {
    setRespostas((prev) => ({ ...prev, [qid]: { ...prev[qid], questaoId: qid, ...patch } }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErr(null);
    const lista: RespostaSubmissao[] = [];
    for (const q of questoes) {
      const r = respostas[q.id];
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
      onSubmitted(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao submeter teste.');
      setIsSaving(false);
    }
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">Teste de avaliação</h2>
        <p className="text-sm text-slate-400">Colaborador: {colaboradorNome}</p>
      </header>

      <ol className="flex flex-col gap-4">
        {questoes.map((q, idx) => (
          <QuestaoItem
            key={q.id}
            questao={q}
            ordem={idx + 1}
            resposta={respostas[q.id]}
            onChange={(patch) => setResposta(q.id, patch)}
            disabled={isSaving}
          />
        ))}
      </ol>

      {err && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err}
        </p>
      )}

      <footer className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
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
