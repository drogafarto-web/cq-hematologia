/**
 * Form modal — criar/editar metadata de Documento. Versionamento e transição
 * de status ficam em fluxos próprios (não acumular tudo aqui).
 *
 * Quando `documento` é passado, o modal vira modo edição (campos pre-fill,
 * código bloqueado se já vigente). Quando ausente, modo criação.
 *
 * Quando `revisaoDe` é passado, modal vira modo "emitir revisão": código
 * fixo do anterior, versão exibida (somente leitura) como N+1, e ao confirmar
 * chama `emitirRevisao` em vez de `criar`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';

import {
  TIPO_LABEL,
  type Documento,
  type DocumentoInput,
  type TipoDocumento,
} from '../types/Documento';
import { SECOES_POR_TIPO } from '../constants/secoesObrigatorias';

const TIPOS: TipoDocumento[] = ['MQ', 'CDC', 'DC', 'PQ', 'PQ-ANA', 'PQ-EQP', 'IT', 'ITA', 'FR', 'POL', 'LM', 'EXT'];

export interface DocumentoFormModalProps {
  /** Quando presente, modal abre em modo edição. */
  documento?: Documento;
  /** Quando presente, modal abre em modo "emitir revisão" do anterior. */
  revisaoDe?: Documento;
  /** Sugestão de código em modo criação (ex: "IT-013"). */
  codigoSugerido?: string;
  onClose: () => void;
  onSubmit: (input: DocumentoInput, mode: 'criar' | 'editar' | 'revisao') => Promise<void>;
}

function toDateInput(ts: Timestamp | string | Date | any): string {
  let d: Date;
  if (ts instanceof Timestamp) {
    d = ts.toDate();
  } else if (ts instanceof Date) {
    d = ts;
  } else if (typeof ts === 'string') {
    d = new Date(ts);
  } else {
    d = new Date();
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateInput(value: string): Timestamp {
  // Constrói meia-noite local para evitar drift de TZ.
  const [y, m, d] = value.split('-').map((s) => Number.parseInt(s, 10));
  return Timestamp.fromDate(new Date(y, m - 1, d, 0, 0, 0, 0));
}

function defaultProximaRevisao(emissao: Date): Date {
  // DICQ não fixa periodicidade — convenção comum é 2 anos para POPs.
  const next = new Date(emissao);
  next.setFullYear(next.getFullYear() + 2);
  return next;
}

export function DocumentoFormModal({
  documento,
  revisaoDe,
  codigoSugerido,
  onClose,
  onSubmit,
}: DocumentoFormModalProps) {
  const mode: 'criar' | 'editar' | 'revisao' =
    revisaoDe ? 'revisao' : documento ? 'editar' : 'criar';

  const initialDoc = revisaoDe ?? documento;
  const today = useMemo(() => new Date(), []);

  const [tipo, setTipo] = useState<TipoDocumento>(initialDoc?.tipo ?? 'IT');
  const [codigo, setCodigo] = useState<string>(
    initialDoc?.codigo ?? codigoSugerido ?? '',
  );
  const [titulo, setTitulo] = useState<string>(initialDoc?.titulo ?? '');
  const [url, setUrl] = useState<string>(
    initialDoc?.url && !initialDoc.url.startsWith('gs://') ? initialDoc.url : '',
  );
  const [autoridadeEmitente, setAutoridadeEmitente] = useState<string>(
    initialDoc?.autoridadeEmitente ?? '',
  );
  const [dataEmissao, setDataEmissao] = useState<string>(
    initialDoc ? toDateInput(initialDoc.dataEmissao) : toDateInput(Timestamp.fromDate(today)),
  );
  const [dataRevisao, setDataRevisao] = useState<string>(
    initialDoc ? toDateInput(initialDoc.dataRevisao) : toDateInput(Timestamp.fromDate(today)),
  );
  const [proximaRevisao, setProximaRevisao] = useState<string>(
    initialDoc
      ? toDateInput(initialDoc.proximaRevisao)
      : toDateInput(Timestamp.fromDate(defaultProximaRevisao(today))),
  );
  const [observacoes, setObservacoes] = useState<string>(initialDoc?.observacoes ?? '');

  const [elaboradoPor, setElaboradoPor] = useState<string>(initialDoc?.elaboradoPor ?? '');
  const [revisadoPor, setRevisadoPor] = useState<string>(initialDoc?.revisadoPor ?? '');
  const [dataElaboracao, setDataElaboracao] = useState<string>(
    initialDoc?.dataElaboracao ? toDateInput(initialDoc.dataElaboracao) : '',
  );
  const [referencias, setReferencias] = useState<string>(
    initialDoc?.referencias?.join(', ') ?? '',
  );
  const [prazoGuarda, setPrazoGuarda] = useState<string>(
    initialDoc?.prazoGuarda?.toString() ?? '5',
  );
  const [formaArmazenamento, setFormaArmazenamento] = useState<string>(
    initialDoc?.formaArmazenamento ?? '',
  );
  const [localArmazenamento, setLocalArmazenamento] = useState<string>(
    initialDoc?.localArmazenamento ?? '',
  );
  const [numeroPaginas, setNumeroPaginas] = useState<string>(
    initialDoc?.numeroPaginas?.toString() ?? '',
  );
  const [setorResponsavel, setSetorResponsavel] = useState<string>(
    initialDoc?.setorResponsavel ?? '',
  );
  const [metadataOpen, setMetadataOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Em modo revisão, código é congelado (deve ser igual ao anterior).
  const codigoBloqueado = mode === 'revisao';

  // Em modo edição de doc vigente, mudança de código levanta alerta na UI.
  const podeEditarCodigo = mode === 'criar' ||
    (mode === 'editar' && documento?.status === 'em_revisao');

  useEffect(() => {
    if (mode === 'criar' && codigoSugerido && !codigo) {
      setCodigo(codigoSugerido);
    }
  }, [codigoSugerido, codigo, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!codigo.trim() || !titulo.trim() || !autoridadeEmitente.trim()) {
      setErr('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!/^.+-\d+$/.test(codigo.trim())) {
      setErr('Código deve seguir o padrão TIPO-NNN (ex: IT-013, PQ-ANA-001).');
      return;
    }

    const dataEmissaoTs = fromDateInput(dataEmissao);
    const dataRevisaoTs = fromDateInput(dataRevisao);
    const proximaRevisaoTs = fromDateInput(proximaRevisao);

    if (proximaRevisaoTs.toMillis() <= dataRevisaoTs.toMillis()) {
      setErr('Próxima revisão deve ser posterior à data de revisão.');
      return;
    }

    const input: DocumentoInput = {
      codigo: codigo.trim(),
      tipo,
      titulo: titulo.trim(),
      url: url.trim() || undefined,
      autoridadeEmitente: autoridadeEmitente.trim(),
      dataEmissao: dataEmissaoTs,
      dataRevisao: dataRevisaoTs,
      proximaRevisao: proximaRevisaoTs,
      status: documento?.status ?? 'em_revisao',
      observacoes: observacoes.trim() || undefined,
      elaboradoPor: elaboradoPor.trim() || undefined,
      revisadoPor: revisadoPor.trim() || undefined,
      dataElaboracao: dataElaboracao ? fromDateInput(dataElaboracao) : undefined,
      referencias: referencias.trim()
        ? referencias.split(',').map((r) => r.trim()).filter(Boolean)
        : undefined,
      prazoGuarda: prazoGuarda ? Number(prazoGuarda) || undefined : undefined,
      formaArmazenamento: (formaArmazenamento as 'fisico' | 'digital' | 'ambos') || undefined,
      localArmazenamento: localArmazenamento.trim() || undefined,
      numeroPaginas: numeroPaginas ? Number(numeroPaginas) || undefined : undefined,
      setorResponsavel: setorResponsavel.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await onSubmit(input, mode);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar documento.');
      setSubmitting(false);
    }
  };

  const titleByMode: Record<typeof mode, string> = {
    criar: 'Novo documento',
    editar: 'Editar documento',
    revisao: `Emitir revisão · ${revisaoDe?.codigo ?? ''} (próxima versão)`,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#141417] border border-white/[0.08] shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-base font-semibold text-white">{titleByMode[mode]}</h2>
            {mode === 'revisao' && revisaoDe && (
              <p className="text-xs text-white/40 mt-0.5">
                Substitui v{revisaoDe.versao} (vai a obsoleto)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-sm"
          >
            Fechar
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tipo" required>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoDocumento)}
                disabled={!podeEditarCodigo}
                className="input"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t} — {TIPO_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Código" required>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                disabled={codigoBloqueado || !podeEditarCodigo}
                placeholder="IT-013"
                className="input font-mono"
              />
            </Field>

            <Field label="Versão">
              <input
                type="text"
                disabled
                value={
                  mode === 'revisao'
                    ? `${revisaoDe?.versao ?? '1.0'} → próxima`
                    : documento
                      ? `${documento.versao}`
                      : '1.0 (inicial)'
                }
                className="input opacity-60"
              />
            </Field>
          </div>

          {SECOES_POR_TIPO[tipo].length > 0 && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <svg
                  className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1">
                    Seções obrigatórias (PQ-014)
                  </p>
                  <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {SECOES_POR_TIPO[tipo].map((secao) => (
                      <li key={secao} className="text-xs text-white/40 before:content-['•'] before:mr-1 before:text-white/20">
                        {secao}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <Field label="Título" required>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Coleta de sangue venoso"
              className="input"
              required
            />
          </Field>

          {!initialDoc?.googleDocUrl && (
            <Field
              label="URL do documento"
              hint="Opcional — deixe vazio para criar via Google Docs após salvar."
            >
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/… (opcional)"
                className="input"
              />
            </Field>
          )}

          <Field
            label="Autoridade emitente"
            required
            hint="Quem aprovou (ex: Diretor Técnico — João Silva, CRBM-12345)"
          >
            <input
              type="text"
              value={autoridadeEmitente}
              onChange={(e) => setAutoridadeEmitente(e.target.value)}
              className="input"
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Data de emissão" required>
              <input
                type="date"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
                className="input"
                required
              />
            </Field>
            <Field label="Última revisão" required>
              <input
                type="date"
                value={dataRevisao}
                onChange={(e) => setDataRevisao(e.target.value)}
                className="input"
                required
              />
            </Field>
            <Field label="Próxima revisão" required hint="DICQ 4.3 — frequência pré-definida">
              <input
                type="date"
                value={proximaRevisao}
                onChange={(e) => setProximaRevisao(e.target.value)}
                className="input"
                required
              />
            </Field>
          </div>

          <Field label="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="input"
              placeholder="Contexto adicional, vinculações com outros docs, etc."
            />
          </Field>

          <div className="border border-white/[0.08] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setMetadataOpen(!metadataOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/50 hover:bg-white/[0.03] transition-colors duration-150"
            >
              <span>Metadados Adicionais</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-150 ${metadataOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {metadataOpen && (
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-white/[0.06]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Elaborado por">
                    <input
                      type="text"
                      value={elaboradoPor}
                      onChange={(e) => setElaboradoPor(e.target.value)}
                      className="input"
                      placeholder="Nome do elaborador"
                    />
                  </Field>
                  <Field label="Revisado por">
                    <input
                      type="text"
                      value={revisadoPor}
                      onChange={(e) => setRevisadoPor(e.target.value)}
                      className="input"
                      placeholder="Nome do revisor"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Data de Elaboração">
                    <input
                      type="date"
                      value={dataElaboracao}
                      onChange={(e) => setDataElaboracao(e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Prazo de Guarda (anos)">
                    <input
                      type="number"
                      min={1}
                      value={prazoGuarda}
                      onChange={(e) => setPrazoGuarda(e.target.value)}
                      className="input"
                      placeholder="5"
                    />
                  </Field>
                  <Field label="Nº Páginas">
                    <input
                      type="number"
                      min={1}
                      value={numeroPaginas}
                      onChange={(e) => setNumeroPaginas(e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Forma de Armazenamento">
                    <select
                      value={formaArmazenamento}
                      onChange={(e) => setFormaArmazenamento(e.target.value)}
                      className="input"
                    >
                      <option value="">— Selecionar —</option>
                      <option value="fisico">Físico</option>
                      <option value="digital">Digital</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </Field>
                  <Field label="Local de Armazenamento">
                    <input
                      type="text"
                      value={localArmazenamento}
                      onChange={(e) => setLocalArmazenamento(e.target.value)}
                      className="input"
                      placeholder="Ex: Arquivo central, Drive"
                    />
                  </Field>
                </div>

                <Field label="Setor Responsável">
                  <input
                    type="text"
                    value={setorResponsavel}
                    onChange={(e) => setSetorResponsavel(e.target.value)}
                    className="input"
                    placeholder="Ex: Qualidade, Hematologia"
                  />
                </Field>

                <Field label="Referências (Vide)" hint="Códigos separados por vírgula (ex: PQ-014, IT-003)">
                  <input
                    type="text"
                    value={referencias}
                    onChange={(e) => setReferencias(e.target.value)}
                    className="input"
                    placeholder="PQ-014, IT-003"
                  />
                </Field>
              </div>
            )}
          </div>

          {err && (
            <p role="alert" className="text-xs text-red-400">
              {err}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm text-white/60 hover:bg-white/[0.05]"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
            >
              {submitting
                ? 'Salvando…'
                : mode === 'revisao'
                  ? 'Emitir revisão'
                  : mode === 'editar'
                    ? 'Salvar alterações'
                    : 'Criar documento'}
            </button>
          </div>
        </form>
      </div>

      {/* Estilos compartilhados de input (escopo local sem CSS module) */}
      <style>{`
        .input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.9);
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
          outline: none;
        }
        .input:focus {
          border-color: rgba(16,185,129,0.5);
          background: rgba(255,255,255,0.06);
        }
        .input:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
        {label}
        {required && <span className="text-emerald-400 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] text-white/30">{hint}</span>}
    </label>
  );
}
