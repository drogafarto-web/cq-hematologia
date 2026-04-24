import { useMemo, useState, type FormEvent } from 'react';

import { useAvaliacaoCompetencia } from '../hooks/useAvaliacaoCompetencia';
import { useAvaliacaoEficacia } from '../hooks/useAvaliacaoEficacia';
import { useColaboradores } from '../hooks/useColaboradores';
import { useTemplates } from '../hooks/useTemplates';
import { useTreinamentos } from '../hooks/useTreinamentos';
import type {
  Modalidade,
  NcOrigemColecao,
  Periodicidade,
  TemplateTreinamento,
  TipoTreinamento,
  Treinamento,
  TreinamentoInput,
  Unidade,
} from '../types/EducacaoContinuada';

import { Field, inputClass, selectClass } from './_formPrimitives';

export interface TreinamentoFormProps {
  /** Quando presente, o form entra em modo edição. */
  treinamento?: Treinamento;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  titulo: string;
  tema: string;
  cargaHoraria: string;
  modalidade: Modalidade;
  unidade: Unidade;
  responsavel: string;
  /** Obrigatória apenas quando `tipo === 'periodico'`. */
  periodicidade?: Periodicidade;
  ativo: boolean;
  /** Tipo regulatório (Fase 10). Default 'periodico' em novos cadastros. */
  tipo: TipoTreinamento;
  colaboradorAlvoId?: string;
  popVersao?: string;
  equipamentoNome?: string;
  ncOrigemId?: string;
  ncOrigemColecao?: NcOrigemColecao;
  certificadoExternoUrl?: string;
  /** ID do template de origem (Fase 6). Só populado via "Criar a partir de template". */
  templateId?: string;
}

interface FormErrors {
  titulo?: string;
  tema?: string;
  cargaHoraria?: string;
  responsavel?: string;
  tipo?: string;
  periodicidade?: string;
  ncOrigemId?: string;
  certificadoExternoUrl?: string;
  submit?: string;
}

const MODALIDADE_OPTIONS: ReadonlyArray<{ value: Modalidade; label: string }> = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
  { value: 'em_servico', label: 'Em serviço' },
];

const UNIDADE_OPTIONS: ReadonlyArray<{ value: Unidade; label: string }> = [
  { value: 'fixa', label: 'Unidade fixa' },
  { value: 'itinerante', label: 'Unidade itinerante' },
  { value: 'ambas', label: 'Ambas' },
];

const PERIODICIDADE_OPTIONS: ReadonlyArray<{ value: Periodicidade; label: string }> = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

interface TipoOption {
  value: TipoTreinamento;
  label: string;
  descricao: string;
}

const TIPO_OPTIONS: ReadonlyArray<TipoOption> = [
  {
    value: 'periodico',
    label: 'Periódico',
    descricao: 'Recorrente com frequência definida (RDC 978/2025 Art. 126).',
  },
  {
    value: 'integracao',
    label: 'Integração',
    descricao: 'Onboarding de colaborador novo ou transferido (ISO 15189 cl. 6.2.2).',
  },
  {
    value: 'novo_procedimento',
    label: 'Novo procedimento',
    descricao: 'Após criação/revisão de POP/MRT (ISO 15189 cl. 5.5).',
  },
  {
    value: 'equipamento',
    label: 'Equipamento',
    descricao: 'Implantação ou atualização de equipamento (ISO 15189 cl. 5.3.2).',
  },
  {
    value: 'acao_corretiva',
    label: 'Ação corretiva',
    descricao: 'Pós-NC ou reprovação — fecha FR-013 (ISO 15189 cl. 8.7).',
  },
  {
    value: 'pontual',
    label: 'Pontual',
    descricao: 'Esporádico sem gatilho fixo (workshop, auditoria).',
  },
  {
    value: 'capacitacao_externa',
    label: 'Capacitação externa',
    descricao: 'Curso/congresso fora do lab — certificado externo anexado.',
  },
];

const TIPO_DESCRICAO: Record<TipoTreinamento, string> = Object.fromEntries(
  TIPO_OPTIONS.map((opt) => [opt.value, opt.descricao]),
) as Record<TipoTreinamento, string>;

function buildInitialState(treinamento?: Treinamento): FormState {
  if (!treinamento) {
    return {
      titulo: '',
      tema: '',
      cargaHoraria: '',
      modalidade: 'presencial',
      unidade: 'fixa',
      responsavel: '',
      periodicidade: 'anual',
      ativo: true,
      tipo: 'periodico',
    };
  }
  return {
    titulo: treinamento.titulo,
    tema: treinamento.tema,
    cargaHoraria: String(treinamento.cargaHoraria),
    modalidade: treinamento.modalidade,
    unidade: treinamento.unidade,
    responsavel: treinamento.responsavel,
    periodicidade: treinamento.periodicidade,
    ativo: treinamento.ativo,
    tipo: treinamento.tipo,
    colaboradorAlvoId: treinamento.colaboradorAlvoId,
    popVersao: treinamento.popVersao,
    equipamentoNome: treinamento.equipamentoNome,
    ncOrigemId: treinamento.ncOrigemId,
    ncOrigemColecao: treinamento.ncOrigemColecao,
    certificadoExternoUrl: treinamento.certificadoExternoUrl,
    templateId: treinamento.templateId,
  };
}

/**
 * Aplica um template ao state do form. Herança **não lock** — todos os campos
 * copiados ficam editáveis. Mantém `ativo`, `unidade` e `tipo` do state atual
 * (template não tem esses campos).
 */
function applyTemplate(template: TemplateTreinamento, current: FormState): FormState {
  return {
    ...current,
    titulo: template.titulo,
    tema: template.tema,
    cargaHoraria: String(template.cargaHoraria),
    modalidade: template.modalidade,
    periodicidade: template.periodicidade,
    responsavel: current.responsavel,
    templateId: template.id,
  };
}

function parseCargaHoraria(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim();
  if (normalized.length === 0) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0 || n > 999) return null;
  return n;
}

function validate(state: FormState): FormErrors {
  const errors: FormErrors = {};
  if (state.titulo.trim().length < 3) errors.titulo = 'Mínimo de 3 caracteres.';
  if (state.tema.trim().length < 3) errors.tema = 'Mínimo de 3 caracteres.';
  if (state.responsavel.trim().length < 2) errors.responsavel = 'Mínimo de 2 caracteres.';
  if (parseCargaHoraria(state.cargaHoraria) === null) {
    errors.cargaHoraria = 'Informe um número entre 0,1 e 999 horas.';
  }
  // Validações condicionais por tipo regulatório (Fase 10)
  if (state.tipo === 'periodico' && !state.periodicidade) {
    errors.periodicidade = 'Treinamentos periódicos exigem periodicidade.';
  }
  if (state.tipo === 'acao_corretiva') {
    if (!state.ncOrigemId || state.ncOrigemId.trim().length === 0) {
      errors.ncOrigemId = 'Selecione a avaliação de origem da NC (FR-013).';
    }
  }
  if (state.tipo === 'capacitacao_externa') {
    const url = state.certificadoExternoUrl?.trim() ?? '';
    if (url.length === 0) {
      errors.certificadoExternoUrl = 'URL do certificado externo é obrigatória.';
    }
  }
  return errors;
}

export function TreinamentoForm({
  treinamento,
  onSaved,
  onCancel,
}: TreinamentoFormProps) {
  const { create, update } = useTreinamentos();
  const { templates } = useTemplates({ somenteAtivos: true });
  const { colaboradores } = useColaboradores({ somenteAtivos: true });
  const { avaliacoes: eficacias } = useAvaliacaoEficacia();
  const { avaliacoes: competencias } = useAvaliacaoCompetencia();
  const isEditing = Boolean(treinamento);

  const [state, setState] = useState<FormState>(() => buildInitialState(treinamento));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  /** Quando tipo muda, limpa campos condicionais incompatíveis do state. */
  const handleTipoChange = (novoTipo: TipoTreinamento): void => {
    setState((prev) => ({
      ...prev,
      tipo: novoTipo,
      // Periodicidade só é relevante para 'periodico'. Preserva para 'integracao'
      // (onboarding pode ter revalidação periódica) — caller decide.
      periodicidade:
        novoTipo === 'periodico' || novoTipo === 'integracao' ? prev.periodicidade : undefined,
      colaboradorAlvoId: novoTipo === 'integracao' ? prev.colaboradorAlvoId : undefined,
      popVersao: novoTipo === 'novo_procedimento' ? prev.popVersao : undefined,
      equipamentoNome: novoTipo === 'equipamento' ? prev.equipamentoNome : undefined,
      ncOrigemId: novoTipo === 'acao_corretiva' ? prev.ncOrigemId : undefined,
      ncOrigemColecao: novoTipo === 'acao_corretiva' ? prev.ncOrigemColecao : undefined,
      certificadoExternoUrl:
        novoTipo === 'capacitacao_externa' ? prev.certificadoExternoUrl : undefined,
    }));
    setErrors({});
  };

  // Opções para select de NC (apenas avaliações "negativas" que geram ação corretiva)
  const ncEficaciasOptions = useMemo(
    () => eficacias.filter((a) => a.resultado === 'ineficaz'),
    [eficacias],
  );
  const ncCompetenciasOptions = useMemo(
    () =>
      competencias.filter(
        (a) => a.resultado === 'reprovado' || a.resultado === 'requer_retreinamento',
      ),
    [competencias],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const validationErrors = validate(state);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const cargaHoraria = parseCargaHoraria(state.cargaHoraria);
    if (cargaHoraria === null) return;

    const input: TreinamentoInput = {
      titulo: state.titulo.trim(),
      tema: state.tema.trim(),
      cargaHoraria,
      modalidade: state.modalidade,
      unidade: state.unidade,
      responsavel: state.responsavel.trim(),
      periodicidade: state.periodicidade,
      ativo: state.ativo,
      tipo: state.tipo,
      colaboradorAlvoId: state.colaboradorAlvoId,
      popVersao: state.popVersao?.trim() || undefined,
      equipamentoNome: state.equipamentoNome?.trim() || undefined,
      ncOrigemId: state.ncOrigemId,
      ncOrigemColecao: state.ncOrigemColecao,
      certificadoExternoUrl: state.certificadoExternoUrl?.trim() || undefined,
      templateId: state.templateId,
    };

    setIsSaving(true);
    setErrors({});

    try {
      if (treinamento) {
        await update(treinamento.id, input);
      } else {
        await create(input);
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar.';
      setErrors({ submit: message });
      setIsSaving(false);
    }
  };

  const mostraPeriodicidade = state.tipo === 'periodico' || state.tipo === 'integracao';
  const mostraColaboradorAlvo = state.tipo === 'integracao';
  const mostraPopVersao = state.tipo === 'novo_procedimento';
  const mostraEquipamento = state.tipo === 'equipamento';
  const mostraAcaoCorretiva = state.tipo === 'acao_corretiva';
  const mostraCertificadoExterno = state.tipo === 'capacitacao_externa';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">
          {isEditing ? 'Editar treinamento' : 'Novo treinamento'}
        </h2>
        <p className="text-sm text-slate-400">
          Planejamento conforme FR-027 / RDC 978/2025. A execução real é registrada em FR-001.
        </p>
      </header>

      {!isEditing && templates.length > 0 && (
        <Field id="treinamento-template" label="Criar a partir de template (opcional)">
          <select
            id="treinamento-template"
            value={state.templateId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                setState((prev) => ({ ...prev, templateId: undefined }));
                return;
              }
              const tpl = templates.find((t) => t.id === id);
              if (tpl) setState((prev) => applyTemplate(tpl, prev));
            }}
            disabled={isSaving}
            aria-label="Criar a partir de template"
            className={selectClass()}
          >
            <option value="">— Sem template (criar do zero) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo} (v{t.versao})
              </option>
            ))}
          </select>
          {state.templateId && (
            <p className="mt-1 text-xs text-emerald-300">
              Campos preenchidos a partir do template. Todos editáveis — herança, não lock.
            </p>
          )}
        </Field>
      )}

      <Field id="treinamento-titulo" label="Título" required error={errors.titulo}>
        <input
          id="treinamento-titulo"
          type="text"
          value={state.titulo}
          onChange={(e) => handleChange('titulo', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Título do treinamento"
          className={inputClass(Boolean(errors.titulo))}
        />
      </Field>

      <Field id="treinamento-tema" label="Tema" required error={errors.tema}>
        <input
          id="treinamento-tema"
          type="text"
          value={state.tema}
          onChange={(e) => handleChange('tema', e.target.value)}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Tema do treinamento"
          className={inputClass(Boolean(errors.tema))}
        />
      </Field>

      <Field id="treinamento-tipo" label="Tipo regulatório" required error={errors.tipo}>
        <select
          id="treinamento-tipo"
          value={state.tipo}
          onChange={(e) => handleTipoChange(e.target.value as TipoTreinamento)}
          disabled={isSaving}
          aria-label="Tipo regulatório do treinamento"
          className={selectClass()}
        >
          {TIPO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{TIPO_DESCRICAO[state.tipo]}</p>
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="treinamento-carga"
          label="Carga horária (h)"
          required
          error={errors.cargaHoraria}
        >
          <input
            id="treinamento-carga"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            max="999"
            value={state.cargaHoraria}
            onChange={(e) => handleChange('cargaHoraria', e.target.value)}
            disabled={isSaving}
            aria-label="Carga horária em horas"
            className={inputClass(Boolean(errors.cargaHoraria))}
          />
        </Field>

        <Field id="treinamento-responsavel" label="Responsável" required error={errors.responsavel}>
          <input
            id="treinamento-responsavel"
            type="text"
            value={state.responsavel}
            onChange={(e) => handleChange('responsavel', e.target.value)}
            disabled={isSaving}
            autoComplete="off"
            aria-label="Responsável pelo treinamento"
            className={inputClass(Boolean(errors.responsavel))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="treinamento-modalidade" label="Modalidade">
          <select
            id="treinamento-modalidade"
            value={state.modalidade}
            onChange={(e) => handleChange('modalidade', e.target.value as Modalidade)}
            disabled={isSaving}
            aria-label="Modalidade do treinamento"
            className={selectClass()}
          >
            {MODALIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="treinamento-unidade" label="Unidade">
          <select
            id="treinamento-unidade"
            value={state.unidade}
            onChange={(e) => handleChange('unidade', e.target.value as Unidade)}
            disabled={isSaving}
            aria-label="Unidade de aplicação"
            className={selectClass()}
          >
            {UNIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {mostraPeriodicidade && (
        <Field
          id="treinamento-periodicidade"
          label={state.tipo === 'periodico' ? 'Periodicidade' : 'Periodicidade (revalidação)'}
          required={state.tipo === 'periodico'}
          error={errors.periodicidade}
        >
          <select
            id="treinamento-periodicidade"
            value={state.periodicidade ?? ''}
            onChange={(e) =>
              handleChange(
                'periodicidade',
                (e.target.value || undefined) as Periodicidade | undefined,
              )
            }
            disabled={isSaving}
            aria-label="Periodicidade do treinamento"
            className={selectClass()}
          >
            {state.tipo !== 'periodico' && <option value="">— Sem periodicidade —</option>}
            {PERIODICIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {mostraColaboradorAlvo && (
        <Field
          id="treinamento-colab-alvo"
          label="Colaborador alvo (opcional)"
        >
          <select
            id="treinamento-colab-alvo"
            value={state.colaboradorAlvoId ?? ''}
            onChange={(e) => handleChange('colaboradorAlvoId', e.target.value || undefined)}
            disabled={isSaving}
            aria-label="Colaborador alvo da integração"
            className={selectClass()}
          >
            <option value="">— Genérico (por cargo) —</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {c.cargo}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Se deixar em branco, trilha de integração por cargo (Fase 7) pega automaticamente.
          </p>
        </Field>
      )}

      {mostraPopVersao && (
        <Field
          id="treinamento-pop"
          label="POP / MRT (versão)"
        >
          <input
            id="treinamento-pop"
            type="text"
            value={state.popVersao ?? ''}
            onChange={(e) => handleChange('popVersao', e.target.value || undefined)}
            disabled={isSaving}
            placeholder="Ex: POP-012 Rev.03"
            aria-label="Referência do POP ou MRT"
            className={inputClass(false)}
          />
        </Field>
      )}

      {mostraEquipamento && (
        <Field
          id="treinamento-equip"
          label="Equipamento (nome/identificação)"
        >
          <input
            id="treinamento-equip"
            type="text"
            value={state.equipamentoNome ?? ''}
            onChange={(e) => handleChange('equipamentoNome', e.target.value || undefined)}
            disabled={isSaving}
            placeholder="Ex: Sysmex XN-550 #SN12345"
            aria-label="Nome do equipamento"
            className={inputClass(false)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Texto livre — sem acoplamento ao módulo de equipamentos.
          </p>
        </Field>
      )}

      {mostraAcaoCorretiva && (
        <div className="flex flex-col gap-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-xs uppercase tracking-wider text-red-300">
            Origem da NC (obrigatório — FR-013)
          </p>
          <Field id="treinamento-nc-col" label="Coleção de origem" required>
            <select
              id="treinamento-nc-col"
              value={state.ncOrigemColecao ?? ''}
              onChange={(e) => {
                const col = (e.target.value || undefined) as NcOrigemColecao | undefined;
                setState((prev) => ({
                  ...prev,
                  ncOrigemColecao: col,
                  ncOrigemId: undefined,
                }));
              }}
              disabled={isSaving}
              aria-label="Tipo de avaliação que gerou a NC"
              className={selectClass()}
            >
              <option value="">— Selecione —</option>
              <option value="avaliacoesEficacia">Avaliação de eficácia (ineficaz)</option>
              <option value="avaliacoesCompetencia">
                Avaliação de competência (reprovado/requer retreinamento)
              </option>
            </select>
          </Field>
          {state.ncOrigemColecao && (
            <Field
              id="treinamento-nc-id"
              label="Avaliação específica"
              required
              error={errors.ncOrigemId}
            >
              <select
                id="treinamento-nc-id"
                value={state.ncOrigemId ?? ''}
                onChange={(e) => handleChange('ncOrigemId', e.target.value || undefined)}
                disabled={isSaving}
                aria-label="Avaliação específica da NC"
                className={selectClass()}
              >
                <option value="">— Selecione a avaliação —</option>
                {state.ncOrigemColecao === 'avaliacoesEficacia'
                  ? ncEficaciasOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.dataAvaliacao.toDate().toLocaleDateString('pt-BR')} ·{' '}
                        {a.evidencia.slice(0, 60)}
                        {a.evidencia.length > 60 ? '…' : ''}
                      </option>
                    ))
                  : ncCompetenciasOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.dataAvaliacao.toDate().toLocaleDateString('pt-BR')} · {a.resultado}
                      </option>
                    ))}
              </select>
              {(state.ncOrigemColecao === 'avaliacoesEficacia'
                ? ncEficaciasOptions
                : ncCompetenciasOptions
              ).length === 0 && (
                <p className="mt-1 text-xs text-amber-300">
                  Nenhuma avaliação negativa encontrada nesta coleção.
                </p>
              )}
            </Field>
          )}
        </div>
      )}

      {mostraCertificadoExterno && (
        <Field
          id="treinamento-cert-ext"
          label="URL do certificado externo"
          required
          error={errors.certificadoExternoUrl}
        >
          <input
            id="treinamento-cert-ext"
            type="url"
            value={state.certificadoExternoUrl ?? ''}
            onChange={(e) => handleChange('certificadoExternoUrl', e.target.value || undefined)}
            disabled={isSaving}
            placeholder="https://..."
            aria-label="URL do certificado externo"
            className={inputClass(Boolean(errors.certificadoExternoUrl))}
          />
          <p className="mt-1 text-xs text-slate-500">
            Upload para Firebase Storage é suportado pela infraestrutura (Fase 6) — por ora,
            informe URL pública. Upload inline fica como melhoria futura.
          </p>
        </Field>
      )}

      <label className="flex items-center gap-3 text-sm text-slate-200 select-none">
        <input
          type="checkbox"
          checked={state.ativo}
          onChange={(e) => handleChange('ativo', e.target.checked)}
          disabled={isSaving}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
        />
        Treinamento ativo
      </label>

      {errors.submit && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {errors.submit}
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
          {isSaving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar treinamento'}
        </button>
      </footer>
    </form>
  );
}
