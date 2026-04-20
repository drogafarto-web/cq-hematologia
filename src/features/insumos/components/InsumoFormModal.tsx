/**
 * InsumoFormModal — modal de criação de insumo (controle/reagente/tira-uro).
 *
 * Campos mudam por tipo via discriminated union no Zod schema. Edição
 * limitada pós-criação (lote/fabricante/validade são imutáveis) — para
 * correção de erro de cadastro, a UX pede descarte + novo cadastro.
 *
 * Acessibilidade: focus trap básico via tabIndex, Escape fecha,
 * aria-labelledby no dialog.
 */

import React, { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useUser } from '../../../store/useAuthStore';
import { createInsumo } from '../services/insumosFirebaseService';
import type { InsumoModulo, InsumoTipo } from '../types/Insumo';
import { InsumoFormSchema } from './InsumoForm.schema';

// ─── Props ────────────────────────────────────────────────────────────────────

interface InsumoFormModalProps {
  labId: string;
  /** Pré-seleciona o tipo no abrir do modal. */
  initialTipo?: InsumoTipo;
  onClose: () => void;
  onCreated?: (insumoId: string) => void;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
      >
        {label}
        {required && <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-400 dark:text-white/25 mt-1 ml-0.5">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400/80 mt-1 ml-0.5">{error}</p>
      )}
    </div>
  );
}

function TipoCard({
  value,
  current,
  onClick,
  label,
  caption,
}: {
  value: InsumoTipo;
  current: InsumoTipo;
  onClick: (v: InsumoTipo) => void;
  label: string;
  caption: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      aria-pressed={active ? 'true' : 'false'}
      className={`
        flex-1 text-left p-3.5 rounded-xl border transition-all
        ${
          active
            ? 'bg-violet-500/10 border-violet-500/50 dark:bg-violet-500/15 dark:border-violet-400/40'
            : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]'
        }
      `}
    >
      <div
        className={`text-sm font-medium ${
          active ? 'text-violet-700 dark:text-violet-300' : 'text-slate-900 dark:text-white/85'
        }`}
      >
        {label}
      </div>
      <div className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{caption}</div>
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Estado do form: flat e permissivo para evitar fricção com discriminated
 * union quando nenhum campo ainda foi preenchido. Zod narrow ao submit.
 */
interface FormState {
  tipo: InsumoTipo;
  modulo?: InsumoModulo;
  nivel?: 'normal' | 'patologico' | 'baixo' | 'alto';
  fabricante?: string;
  nomeComercial?: string;
  lote?: string;
  validade?: string;
  dataAbertura?: string;
  diasEstabilidadeAbertura?: number;
  registroAnvisa?: string;
  notaFiscal?: string;
  fornecedor?: string;
  analitosIncluidos?: string[];
}

export function InsumoFormModal({
  labId,
  initialTipo = 'controle',
  onClose,
  onCreated,
}: InsumoFormModalProps) {
  const user = useUser();
  const [tipo, setTipo] = useState<InsumoTipo>(initialTipo);
  const [form, setForm] = useState<FormState>(() => ({
    tipo: initialTipo,
    modulo: initialTipo === 'tira-uro' ? 'uroanalise' : undefined,
    diasEstabilidadeAbertura: 0,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const changeTipo = (t: InsumoTipo) => {
    setTipo(t);
    setErrors({});
    setForm((prev) => ({
      ...prev,
      tipo: t,
      modulo: t === 'tira-uro' ? 'uroanalise' : prev.modulo,
      // reset campos específicos ao trocar
      ...(t === 'controle' ? {} : { nivel: undefined }),
      ...(t === 'tira-uro'
        ? { analitosIncluidos: [] }
        : { notaFiscal: undefined, fornecedor: undefined, analitosIncluidos: undefined }),
    }));
  };

  const analitoOptions = useMemo(
    () => [
      { id: 'glicose', label: 'Glicose' },
      { id: 'cetonas', label: 'Cetonas' },
      { id: 'proteina', label: 'Proteína' },
      { id: 'nitrito', label: 'Nitrito' },
      { id: 'sangue', label: 'Sangue' },
      { id: 'leucocitos', label: 'Leucócitos' },
      { id: 'ph', label: 'pH' },
      { id: 'densidade', label: 'Densidade' },
      { id: 'bilirrubina', label: 'Bilirrubina' },
      { id: 'urobilinogenio', label: 'Urobilinogênio' },
    ],
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const toValidate = { ...form, tipo };
    const parsed = InsumoFormSchema.safeParse(toValidate);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const path = iss.path.join('.');
        if (!errs[path]) errs[path] = iss.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});

    if (!user) {
      setSubmitError('Usuário não autenticado.');
      return;
    }

    setSubmitting(true);
    try {
      const data = parsed.data;
      const abertura = data.dataAbertura ? new Date(`${data.dataAbertura}T00:00:00`) : null;
      const validade = new Date(`${data.validade}T00:00:00`);
      const validadeTs = Timestamp.fromDate(validade);
      const aberturaTs = abertura ? Timestamp.fromDate(abertura) : null;

      let id: string;
      if (data.tipo === 'controle') {
        id = await createInsumo(labId, {
          tipo: 'controle',
          nivel: data.nivel,
          modulo: data.modulo as InsumoModulo,
          fabricante: data.fabricante,
          nomeComercial: data.nomeComercial,
          lote: data.lote,
          validade: validadeTs,
          dataAbertura: aberturaTs,
          diasEstabilidadeAbertura: data.diasEstabilidadeAbertura,
          registroAnvisa: data.registroAnvisa || undefined,
          createdBy: user.uid,
        });
      } else if (data.tipo === 'tira-uro') {
        id = await createInsumo(labId, {
          tipo: 'tira-uro',
          modulo: 'uroanalise',
          fabricante: data.fabricante,
          nomeComercial: data.nomeComercial,
          lote: data.lote,
          validade: validadeTs,
          dataAbertura: aberturaTs,
          diasEstabilidadeAbertura: data.diasEstabilidadeAbertura,
          registroAnvisa: data.registroAnvisa || undefined,
          notaFiscal: data.notaFiscal || undefined,
          fornecedor: data.fornecedor || undefined,
          analitosIncluidos: data.analitosIncluidos,
          createdBy: user.uid,
        });
      } else {
        id = await createInsumo(labId, {
          tipo: 'reagente',
          modulo: data.modulo as InsumoModulo,
          fabricante: data.fabricante,
          nomeComercial: data.nomeComercial,
          lote: data.lote,
          validade: validadeTs,
          dataAbertura: aberturaTs,
          diasEstabilidadeAbertura: data.diasEstabilidadeAbertura,
          registroAnvisa: data.registroAnvisa || undefined,
          createdBy: user.uid,
        });
      }

      onCreated?.(id);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar insumo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="insumo-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between sticky top-0 bg-white dark:bg-[#0F1318] z-10">
          <div>
            <h2
              id="insumo-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-white/90"
            >
              Novo insumo
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              Cadastro mestre de consumíveis rastreáveis (RDC 786/2023).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* ── Tipo selector ───────────────────────────────────────────────── */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-white/45 mb-2 ml-0.5">
              Tipo de insumo *
            </div>
            <div className="flex gap-2">
              <TipoCard
                value="controle"
                current={tipo}
                onClick={changeTipo}
                label="Controle"
                caption="Material de CQ com valores-alvo"
              />
              <TipoCard
                value="reagente"
                current={tipo}
                onClick={changeTipo}
                label="Reagente"
                caption="Consumível usado na corrida"
              />
              <TipoCard
                value="tira-uro"
                current={tipo}
                onClick={changeTipo}
                label="Tira (uroanálise)"
                caption="Dipstick multiparâmetro"
              />
            </div>
          </div>

          {/* ── Módulo (ocultado para tira-uro — fixo em uroanalise) ──────── */}
          {tipo !== 'tira-uro' && (
            <Field id="modulo" label="Módulo" required error={errors.modulo}>
              <select
                id="modulo"
                aria-label="Módulo"
                className={INPUT_CLS}
                value={form.modulo ?? ''}
                onChange={(e) => set('modulo', e.target.value as InsumoModulo)}
              >
                <option value="">Selecione…</option>
                <option value="hematologia">Hematologia</option>
                <option value="coagulacao">Coagulação</option>
                <option value="uroanalise">Uroanálise</option>
                <option value="imunologia">Imunologia</option>
              </select>
            </Field>
          )}

          {/* ── Nível (só para controle) ────────────────────────────────────── */}
          {tipo === 'controle' && (
            <Field id="nivel" label="Nível do controle" required error={errors.nivel}>
              <select
                id="nivel"
                aria-label="Nível do controle"
                className={INPUT_CLS}
                value={form.nivel ?? ''}
                onChange={(e) =>
                  set(
                    'nivel',
                    e.target.value as 'normal' | 'patologico' | 'baixo' | 'alto',
                  )
                }
              >
                <option value="">Selecione…</option>
                <option value="normal">Normal (I)</option>
                <option value="patologico">Patológico (II)</option>
                <option value="baixo">Baixo</option>
                <option value="alto">Alto</option>
              </select>
            </Field>
          )}

          {/* ── Identificação do insumo ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <Field id="fabricante" label="Fabricante" required error={errors.fabricante}>
              <input
                id="fabricante"
                className={INPUT_CLS}
                value={form.fabricante ?? ''}
                onChange={(e) => set('fabricante', e.target.value)}
                placeholder="Bio-Rad, Wama…"
                autoComplete="off"
              />
            </Field>
            <Field
              id="nomeComercial"
              label="Nome comercial"
              required
              error={errors.nomeComercial}
            >
              <input
                id="nomeComercial"
                className={INPUT_CLS}
                value={form.nomeComercial ?? ''}
                onChange={(e) => set('nomeComercial', e.target.value)}
                placeholder="Multiqual, Uri Color…"
                autoComplete="off"
              />
            </Field>
            <Field id="lote" label="Lote" required error={errors.lote}>
              <input
                id="lote"
                className={INPUT_CLS}
                value={form.lote ?? ''}
                onChange={(e) => set('lote', e.target.value)}
                placeholder="ex: 2841A24"
                autoComplete="off"
              />
            </Field>
            <Field
              id="registroAnvisa"
              label="Registro ANVISA"
              error={errors.registroAnvisa}
              hint="Opcional"
            >
              <input
                id="registroAnvisa"
                className={INPUT_CLS}
                value={form.registroAnvisa ?? ''}
                onChange={(e) => set('registroAnvisa', e.target.value)}
                placeholder="ex: 10009010123"
                autoComplete="off"
              />
            </Field>
          </div>

          {/* ── Validade + abertura ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <Field id="validade" label="Validade (fabricante)" required error={errors.validade}>
              <input
                id="validade"
                aria-label="Validade do fabricante"
                type="date"
                className={INPUT_CLS}
                value={form.validade ?? ''}
                onChange={(e) => set('validade', e.target.value)}
              />
            </Field>
            <Field
              id="dataAbertura"
              label="Data de abertura"
              error={errors.dataAbertura}
              hint="Vazio = ainda fechado"
            >
              <input
                id="dataAbertura"
                aria-label="Data de abertura"
                type="date"
                className={INPUT_CLS}
                value={form.dataAbertura ?? ''}
                onChange={(e) => set('dataAbertura', e.target.value)}
              />
            </Field>
            <Field
              id="diasEstabilidadeAbertura"
              label="Estabilidade pós-abertura"
              required
              error={errors.diasEstabilidadeAbertura}
              hint="Em dias (0 = N/A)"
            >
              <input
                id="diasEstabilidadeAbertura"
                aria-label="Dias de estabilidade pós-abertura"
                type="number"
                min={0}
                className={INPUT_CLS}
                value={form.diasEstabilidadeAbertura ?? 0}
                onChange={(e) =>
                  set('diasEstabilidadeAbertura', Number(e.target.value) || 0)
                }
              />
            </Field>
          </div>

          {/* ── Campos específicos para tira-uro ────────────────────────────── */}
          {tipo === 'tira-uro' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field id="notaFiscal" label="Nota fiscal" error={errors.notaFiscal} hint="Recomendado">
                  <input
                    id="notaFiscal"
                    className={INPUT_CLS}
                    value={form.notaFiscal ?? ''}
                    onChange={(e) =>
                      set('notaFiscal', e.target.value)
                    }
                    placeholder="ex: 000.123.456"
                    autoComplete="off"
                  />
                </Field>
                <Field id="fornecedor" label="Fornecedor" error={errors.fornecedor}>
                  <input
                    id="fornecedor"
                    className={INPUT_CLS}
                    value={form.fornecedor ?? ''}
                    onChange={(e) =>
                      set('fornecedor', e.target.value)
                    }
                    placeholder="Distribuidor / revenda"
                    autoComplete="off"
                  />
                </Field>
              </div>
              <Field
                label="Analitos incluídos"
                required
                error={errors.analitosIncluidos}
              >
                <div className="flex flex-wrap gap-2">
                  {analitoOptions.map((a) => {
                    const selected = (form.analitosIncluidos ?? []).includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          const cur = form.analitosIncluidos ?? [];
                          const next = selected
                            ? cur.filter((x) => x !== a.id)
                            : [...cur, a.id];
                          set('analitosIncluidos', next);
                        }}
                        className={`
                          px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                          ${
                            selected
                              ? 'bg-violet-500/10 border-violet-500/50 text-violet-700 dark:text-violet-300'
                              : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-white/55 hover:border-slate-300 dark:hover:border-white/[0.15]'
                          }
                        `}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </>
          )}

          {/* ── Submit error ──────────────────────────────────────────────── */}
          {submitError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 h-10 rounded-xl text-sm font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white text-sm font-medium transition-all"
            >
              {submitting ? 'Salvando…' : 'Cadastrar insumo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
