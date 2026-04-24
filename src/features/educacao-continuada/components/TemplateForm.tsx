import { useState, type FormEvent } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useTemplates } from '../hooks/useTemplates';
import { useUploadMaterial } from '../hooks/useUploadMaterial';
import type {
  MaterialDidatico,
  Modalidade,
  Periodicidade,
  TemplateTreinamento,
  TemplateTreinamentoInput,
  TipoMaterial,
} from '../types/EducacaoContinuada';

import { Field, inputClass, selectClass } from './_formPrimitives';

export interface TemplateFormProps {
  template?: TemplateTreinamento;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  titulo: string;
  tema: string;
  objetivo: string;
  cargaHoraria: string;
  modalidade: Modalidade;
  periodicidade: Periodicidade;
  pauta: string;
  tagsRaw: string;
  ativo: boolean;
  materiais: MaterialDidatico[];
}

interface FormErrors {
  titulo?: string;
  tema?: string;
  objetivo?: string;
  cargaHoraria?: string;
  pauta?: string;
  submit?: string;
}

const MODALIDADE_OPTIONS: ReadonlyArray<{ value: Modalidade; label: string }> = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
  { value: 'em_servico', label: 'Em serviço' },
];

const PERIODICIDADE_OPTIONS: ReadonlyArray<{ value: Periodicidade; label: string }> = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

function buildInitial(template?: TemplateTreinamento): FormState {
  if (!template) {
    return {
      titulo: '',
      tema: '',
      objetivo: '',
      cargaHoraria: '',
      modalidade: 'presencial',
      periodicidade: 'anual',
      pauta: '',
      tagsRaw: '',
      ativo: true,
      materiais: [],
    };
  }
  return {
    titulo: template.titulo,
    tema: template.tema,
    objetivo: template.objetivo,
    cargaHoraria: String(template.cargaHoraria),
    modalidade: template.modalidade,
    periodicidade: template.periodicidade,
    pauta: template.pauta,
    tagsRaw: template.tags.join(', '),
    ativo: template.ativo,
    materiais: template.materialDidatico,
  };
}

function parseCarga(raw: string): number | null {
  const n = Number(raw.replace(',', '.').trim());
  if (!Number.isFinite(n) || n <= 0 || n > 999) return null;
  return n;
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function validate(state: FormState): FormErrors {
  const errs: FormErrors = {};
  if (state.titulo.trim().length < 3) errs.titulo = 'Mínimo de 3 caracteres.';
  if (state.tema.trim().length < 3) errs.tema = 'Mínimo de 3 caracteres.';
  if (state.objetivo.trim().length < 10) errs.objetivo = 'Mínimo de 10 caracteres.';
  if (state.pauta.trim().length < 10) errs.pauta = 'Mínimo de 10 caracteres.';
  if (parseCarga(state.cargaHoraria) === null) {
    errs.cargaHoraria = 'Informe um número entre 0,1 e 999 horas.';
  }
  return errs;
}

/**
 * Form de criação/edição de TemplateTreinamento (Fase 6). Inclui gestão inline
 * de materiais didáticos: upload de arquivo (PDF, imagem de apresentação),
 * adição de link externo ou vídeo (YouTube/Vimeo).
 *
 * Versão: contador incremental persistido no service a cada update — não
 * precisa do UI tocar nisso.
 */
export function TemplateForm({ template, onSaved, onCancel }: TemplateFormProps) {
  const { create, update } = useTemplates();
  const isEditing = Boolean(template);
  const [state, setState] = useState<FormState>(() => buildInitial(template));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errs = validate(state);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const carga = parseCarga(state.cargaHoraria);
    if (carga === null) return;

    const input: TemplateTreinamentoInput = {
      titulo: state.titulo.trim(),
      tema: state.tema.trim(),
      objetivo: state.objetivo.trim(),
      cargaHoraria: carga,
      modalidade: state.modalidade,
      periodicidade: state.periodicidade,
      pauta: state.pauta.trim(),
      tags: parseTags(state.tagsRaw),
      ativo: state.ativo,
      materialDidatico: state.materiais,
    };

    setIsSaving(true);
    setErrors({});
    try {
      if (template) {
        await update(template.id, input, template.versao);
      } else {
        await create(input);
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar template.';
      setErrors({ submit: msg });
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">
          {isEditing ? `Editar template (v${template?.versao ?? 1})` : 'Novo template'}
        </h2>
        <p className="text-sm text-slate-400">
          Reutilizável em múltiplos treinamentos. Campos herdados são editáveis no uso.
        </p>
      </header>

      <Field id="template-titulo" label="Título" required error={errors.titulo}>
        <input
          id="template-titulo"
          type="text"
          value={state.titulo}
          onChange={(e) => handleChange('titulo', e.target.value)}
          disabled={isSaving}
          aria-label="Título do template"
          className={inputClass(Boolean(errors.titulo))}
        />
      </Field>

      <Field id="template-tema" label="Tema" required error={errors.tema}>
        <input
          id="template-tema"
          type="text"
          value={state.tema}
          onChange={(e) => handleChange('tema', e.target.value)}
          disabled={isSaving}
          aria-label="Tema do template"
          className={inputClass(Boolean(errors.tema))}
        />
      </Field>

      <Field
        id="template-objetivo"
        label="Objetivo de aprendizagem"
        required
        error={errors.objetivo}
      >
        <textarea
          id="template-objetivo"
          value={state.objetivo}
          onChange={(e) => handleChange('objetivo', e.target.value)}
          disabled={isSaving}
          placeholder="Ao final do treinamento, o colaborador será capaz de…"
          aria-label="Objetivo de aprendizagem"
          rows={3}
          className={inputClass(Boolean(errors.objetivo))}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field id="template-carga" label="Carga horária (h)" required error={errors.cargaHoraria}>
          <input
            id="template-carga"
            type="number"
            step="0.1"
            min="0.1"
            max="999"
            value={state.cargaHoraria}
            onChange={(e) => handleChange('cargaHoraria', e.target.value)}
            disabled={isSaving}
            aria-label="Carga horária"
            className={inputClass(Boolean(errors.cargaHoraria))}
          />
        </Field>
        <Field id="template-modalidade" label="Modalidade">
          <select
            id="template-modalidade"
            value={state.modalidade}
            onChange={(e) => handleChange('modalidade', e.target.value as Modalidade)}
            disabled={isSaving}
            aria-label="Modalidade"
            className={selectClass()}
          >
            {MODALIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="template-periodicidade" label="Periodicidade">
          <select
            id="template-periodicidade"
            value={state.periodicidade}
            onChange={(e) => handleChange('periodicidade', e.target.value as Periodicidade)}
            disabled={isSaving}
            aria-label="Periodicidade"
            className={selectClass()}
          >
            {PERIODICIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="template-pauta" label="Pauta padrão" required error={errors.pauta}>
        <textarea
          id="template-pauta"
          value={state.pauta}
          onChange={(e) => handleChange('pauta', e.target.value)}
          disabled={isSaving}
          rows={4}
          aria-label="Pauta padrão"
          className={inputClass(Boolean(errors.pauta))}
        />
      </Field>

      <Field id="template-tags" label="Tags (separadas por vírgula)">
        <input
          id="template-tags"
          type="text"
          value={state.tagsRaw}
          onChange={(e) => handleChange('tagsRaw', e.target.value)}
          disabled={isSaving}
          placeholder="biossegurança, coleta, rdc978"
          aria-label="Tags"
          className={inputClass(false)}
        />
      </Field>

      <MaterialsEditor
        templateId={template?.id}
        materiais={state.materiais}
        onChange={(list) => handleChange('materiais', list)}
        disabled={isSaving}
      />

      <label className="flex items-center gap-3 text-sm text-slate-200 select-none">
        <input
          type="checkbox"
          checked={state.ativo}
          onChange={(e) => handleChange('ativo', e.target.checked)}
          disabled={isSaving}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
        />
        Template ativo
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
          {isSaving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar template'}
        </button>
      </footer>
    </form>
  );
}

// ─── MaterialsEditor — sub-componente ─────────────────────────────────────────

interface MaterialsEditorProps {
  templateId?: string;
  materiais: MaterialDidatico[];
  onChange: (next: MaterialDidatico[]) => void;
  disabled: boolean;
}

function MaterialsEditor({ templateId, materiais, onChange, disabled }: MaterialsEditorProps) {
  const { status, upload, remove, reset } = useUploadMaterial();
  const [adicionando, setAdicionando] = useState<TipoMaterial | null>(null);
  const [linkTitulo, setLinkTitulo] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const addMaterial = (m: MaterialDidatico) => onChange([...materiais, m]);

  const handleFile = async (tipo: 'pdf' | 'apresentacao', file: File): Promise<void> => {
    if (!templateId) {
      // Novo template: ainda não tem ID. Gera placeholder via timestamp.
      // O path no Storage carrega esse placeholder e fica órfão se o form for
      // cancelado. Aceitável pro MVP (cleanup por CF scheduled é futuro).
      const placeholder = `novo-${Date.now()}`;
      const result = await upload(placeholder, file);
      addMaterial({
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipo,
        titulo: file.name,
        url: result.downloadUrl,
        storagePath: result.storagePath,
        tamanhoBytes: result.tamanhoBytes,
        uploadEm: Timestamp.now(),
      });
      reset();
      return;
    }
    const result = await upload(templateId, file);
    addMaterial({
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo,
      titulo: file.name,
      url: result.downloadUrl,
      storagePath: result.storagePath,
      tamanhoBytes: result.tamanhoBytes,
      uploadEm: Timestamp.now(),
    });
    reset();
  };

  const handleLink = (tipo: 'link' | 'video') => {
    if (!linkTitulo.trim() || !linkUrl.trim()) return;
    addMaterial({
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo,
      titulo: linkTitulo.trim(),
      url: linkUrl.trim(),
      uploadEm: Timestamp.now(),
    });
    setLinkTitulo('');
    setLinkUrl('');
    setAdicionando(null);
  };

  const handleRemove = async (m: MaterialDidatico): Promise<void> => {
    if (m.storagePath) {
      try {
        await remove(m.storagePath);
      } catch {
        // ignora — ao salvar, o doc fica sem referência; Storage pode limpar depois
      }
    }
    onChange(materiais.filter((x) => x.id !== m.id));
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Materiais didáticos ({materiais.length})
        </h3>
        <div className="flex gap-1.5">
          <AddButton onClick={() => setAdicionando('pdf')} disabled={disabled}>
            + PDF
          </AddButton>
          <AddButton onClick={() => setAdicionando('apresentacao')} disabled={disabled}>
            + Apresentação
          </AddButton>
          <AddButton onClick={() => setAdicionando('video')} disabled={disabled}>
            + Vídeo
          </AddButton>
          <AddButton onClick={() => setAdicionando('link')} disabled={disabled}>
            + Link
          </AddButton>
        </div>
      </header>

      {status.kind === 'uploading' && (
        <div className="flex flex-col gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <div className="flex justify-between">
            <span className="truncate">{status.filename}</span>
            <span>{status.pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-emerald-400 transition-[width]"
              style={{ width: `${status.pct}%` }}
            />
          </div>
        </div>
      )}

      {status.kind === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {status.message}
        </p>
      )}

      {(adicionando === 'pdf' || adicionando === 'apresentacao') && (
        <FileInputRow
          label={adicionando === 'pdf' ? 'Selecionar PDF' : 'Selecionar apresentação'}
          accept={adicionando === 'pdf' ? 'application/pdf' : 'application/pdf,image/jpeg,image/png'}
          onFile={async (file) => {
            try {
              await handleFile(adicionando, file);
              setAdicionando(null);
            } catch {
              // erro já ficou em status.kind === 'error'
            }
          }}
          onCancel={() => setAdicionando(null)}
        />
      )}

      {(adicionando === 'link' || adicionando === 'video') && (
        <div className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-900 p-3">
          <input
            type="text"
            value={linkTitulo}
            onChange={(e) => setLinkTitulo(e.target.value)}
            placeholder="Título"
            aria-label="Título do material"
            className={inputClass(false)}
          />
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder={adicionando === 'video' ? 'URL YouTube ou Vimeo' : 'https://…'}
            aria-label="URL"
            className={inputClass(false)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdicionando(null)}
              className="rounded px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleLink(adicionando)}
              disabled={!linkTitulo.trim() || !linkUrl.trim()}
              className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {materiais.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum material ainda.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {materiais.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm text-slate-200">{m.titulo}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {m.tipo}
                  {m.tamanhoBytes
                    ? ` · ${(m.tamanhoBytes / 1024 / 1024).toFixed(2)}MB`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleRemove(m)}
                disabled={disabled}
                className="shrink-0 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function FileInputRow({
  label,
  accept,
  onFile,
  onCancel,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 p-3">
      <label className="flex-1 cursor-pointer rounded border border-dashed border-slate-700 bg-slate-900/40 px-3 py-2 text-center text-xs text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300">
        {label}
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </label>
      <button
        type="button"
        onClick={onCancel}
        className="rounded px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
      >
        Cancelar
      </button>
    </div>
  );
}
