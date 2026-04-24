import { useMemo, useState, type FormEvent } from 'react';

import { useQuestoes } from '../hooks/useQuestoes';
import { useTemplates } from '../hooks/useTemplates';
import type {
  OpcaoQuestaoInput,
  QuestaoInput,
  TemplateTreinamento,
  TipoQuestao,
} from '../types/EducacaoContinuada';

import { Field, inputClass, selectClass } from './_formPrimitives';

export interface BancoQuestoesProps {
  onClose: () => void;
}

type Panel =
  | { mode: 'list' }
  | { mode: 'create'; templateId: string };

const TIPO_OPTIONS: Array<{ value: TipoQuestao; label: string }> = [
  { value: 'multipla_escolha', label: 'Múltipla escolha' },
  { value: 'verdadeiro_falso', label: 'Verdadeiro / Falso' },
  { value: 'dissertativa', label: 'Dissertativa' },
];

/**
 * Banco de questões por template (Fase 8). Gabarito é SEMPRE transmitido
 * pra callable `ec_criarQuestao` — cliente nunca grava direto em Firestore.
 */
export function BancoQuestoes({ onClose }: BancoQuestoesProps) {
  const { templates } = useTemplates({ somenteAtivos: true });
  const [panel, setPanel] = useState<Panel>({ mode: 'list' });
  const [templateSelecionado, setTemplateSelecionado] = useState<string | null>(null);

  const templateAtual = useMemo(
    () => templates.find((t) => t.id === (templateSelecionado ?? '')) ?? null,
    [templates, templateSelecionado],
  );

  if (panel.mode === 'create') {
    return (
      <Header titulo="Nova questão" onClose={onClose}>
        <NovaQuestaoForm
          templateId={panel.templateId}
          onSaved={() => setPanel({ mode: 'list' })}
          onCancel={() => setPanel({ mode: 'list' })}
        />
      </Header>
    );
  }

  return (
    <Header titulo="Banco de questões" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field id="banco-template" label="Template">
          <select
            id="banco-template"
            value={templateSelecionado ?? ''}
            onChange={(e) => setTemplateSelecionado(e.target.value || null)}
            aria-label="Escolher template"
            className={selectClass()}
          >
            <option value="">Selecione um template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo}
              </option>
            ))}
          </select>
        </Field>

        {templateAtual && (
          <QuestoesDoTemplate
            template={templateAtual}
            onNova={() => setPanel({ mode: 'create', templateId: templateAtual.id })}
          />
        )}

        {!templateAtual && (
          <div className="rounded-lg border border-dashed border-slate-800 py-12 text-center text-xs text-slate-500">
            Escolha um template para ver suas questões.
          </div>
        )}
      </div>
    </Header>
  );
}

function QuestoesDoTemplate({
  template,
  onNova,
}: {
  template: TemplateTreinamento;
  onNova: () => void;
}) {
  const { questoes, isLoading, arquivar } = useQuestoes({ templateId: template.id });

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Questões de "{template.titulo}" ({questoes.length})
        </h3>
        <button
          type="button"
          onClick={onNova}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Nova questão
        </button>
      </header>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded border border-slate-800 bg-slate-900/40" />
      ) : questoes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 py-8 text-center text-xs text-slate-500">
          Nenhuma questão cadastrada para este template.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {questoes.map((q) => (
            <li
              key={q.id}
              className={`flex items-start justify-between gap-3 rounded border bg-slate-900/60 p-3 ${
                q.ativo ? 'border-slate-800' : 'border-slate-800 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-200">{q.enunciado}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                  {q.tipo} · {q.pontuacao} pt{q.pontuacao === 1 ? '' : 's'} · #{q.ordem}
                  {!q.ativo && ' · arquivada'}
                </p>
                {q.opcoes && q.opcoes.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-400">
                    {q.opcoes.map((o) => (
                      <li key={o.id}>• {o.texto}</li>
                    ))}
                  </ul>
                )}
              </div>
              {q.ativo && (
                <button
                  type="button"
                  onClick={() => void arquivar(q.id)}
                  className="shrink-0 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                >
                  Arquivar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NovaQuestaoForm({
  templateId,
  onSaved,
  onCancel,
}: {
  templateId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { criar, questoes } = useQuestoes({ templateId });
  const [enunciado, setEnunciado] = useState('');
  const [tipo, setTipo] = useState<TipoQuestao>('multipla_escolha');
  const [pontuacao, setPontuacao] = useState('1');
  const [opcoes, setOpcoes] = useState<OpcaoQuestaoInput[]>([
    { texto: '', correta: true },
    { texto: '', correta: false },
  ]);
  const [gabaritoTexto, setGabaritoTexto] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const proximaOrdem = (questoes[questoes.length - 1]?.ordem ?? 0) + 1;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitErr(null);

    if (enunciado.trim().length < 3) {
      setSubmitErr('Enunciado precisa de ao menos 3 caracteres.');
      return;
    }
    const pt = Number(pontuacao);
    if (!Number.isFinite(pt) || pt <= 0) {
      setSubmitErr('Pontuação inválida.');
      return;
    }

    const input: QuestaoInput = {
      templateId,
      enunciado: enunciado.trim(),
      tipo,
      pontuacao: pt,
      ordem: proximaOrdem,
      ativo: true,
    };
    if (tipo === 'dissertativa') {
      if (gabaritoTexto.trim().length > 0) input.gabaritoTexto = gabaritoTexto.trim();
    } else {
      const opcoesValidas = opcoes.filter((o) => o.texto.trim().length > 0);
      if (opcoesValidas.length < 2) {
        setSubmitErr('Questões objetivas precisam de ao menos 2 opções preenchidas.');
        return;
      }
      if (!opcoesValidas.some((o) => o.correta)) {
        setSubmitErr('Marque ao menos uma opção correta.');
        return;
      }
      input.opcoes = opcoesValidas.map((o) => ({ texto: o.texto.trim(), correta: o.correta }));
    }

    setIsSaving(true);
    try {
      await criar(input);
      onSaved();
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : 'Erro ao salvar.');
      setIsSaving(false);
    }
  };

  const addOpcao = () => setOpcoes((prev) => [...prev, { texto: '', correta: false }]);
  const removeOpcao = (idx: number) =>
    setOpcoes((prev) => prev.filter((_, i) => i !== idx));
  const updateOpcao = (idx: number, patch: Partial<OpcaoQuestaoInput>) =>
    setOpcoes((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field id="q-enunciado" label="Enunciado" required>
        <textarea
          id="q-enunciado"
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          rows={3}
          disabled={isSaving}
          aria-label="Enunciado"
          className={inputClass(false)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="q-tipo" label="Tipo">
          <select
            id="q-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoQuestao)}
            disabled={isSaving}
            aria-label="Tipo"
            className={selectClass()}
          >
            {TIPO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="q-pontuacao" label="Pontuação">
          <input
            id="q-pontuacao"
            type="number"
            step="0.5"
            min="0.5"
            value={pontuacao}
            onChange={(e) => setPontuacao(e.target.value)}
            disabled={isSaving}
            aria-label="Pontuação"
            className={inputClass(false)}
          />
        </Field>
      </div>

      {tipo === 'dissertativa' ? (
        <Field id="q-gabarito" label="Gabarito/referência (opcional — não é visível ao colaborador)">
          <textarea
            id="q-gabarito"
            value={gabaritoTexto}
            onChange={(e) => setGabaritoTexto(e.target.value)}
            rows={2}
            disabled={isSaving}
            aria-label="Gabarito de referência"
            className={inputClass(false)}
          />
        </Field>
      ) : (
        <section className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <header className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Opções (marque as corretas)
            </h4>
            <button
              type="button"
              onClick={addOpcao}
              disabled={isSaving}
              className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
            >
              + opção
            </button>
          </header>
          <ul className="flex flex-col gap-1.5">
            {opcoes.map((o, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={o.correta}
                  onChange={(e) => updateOpcao(idx, { correta: e.target.checked })}
                  disabled={isSaving}
                  aria-label={`Opção ${idx + 1} correta`}
                  className="h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-emerald-500"
                />
                <input
                  type="text"
                  value={o.texto}
                  onChange={(e) => updateOpcao(idx, { texto: e.target.value })}
                  disabled={isSaving}
                  placeholder={`Opção ${idx + 1}`}
                  aria-label={`Texto opção ${idx + 1}`}
                  className={`flex-1 ${inputClass(false)}`}
                />
                {opcoes.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOpcao(idx)}
                    disabled={isSaving}
                    aria-label="Remover opção"
                    className="shrink-0 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {submitErr && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {submitErr}
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
          {isSaving ? 'Salvando…' : 'Criar questão'}
        </button>
      </footer>
    </form>
  );
}

function Header({
  titulo,
  onClose,
  children,
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-lg font-semibold text-slate-100">{titulo}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>
      </header>
      {children}
    </div>
  );
}
