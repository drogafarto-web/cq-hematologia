/**
 * bioquimica/components/AnalitoForm.tsx
 *
 * Modal de criação/edição de analito. Validação Zod client-side antes de
 * submit, errors inline (não toast), preview do range em chip visual.
 *
 * Dark-first design tokens: bg #141417, accent violet-500, focus ring
 * emerald-500. Transições 150-200ms; respeita prefers-reduced-motion.
 *
 * A11y AA: contraste 4.5:1, foco visível, aria-label em ações sem texto,
 * navegação por teclado funcional, Escape fecha modal.
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import type { Analito, AnalitoInput } from '../types';

// ─── Schema Zod ───────────────────────────────────────────────────────────

const analitoSchema = z
  .object({
    nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(80),
    sigla: z.string().max(8).optional().or(z.literal('')),
    unidade: z.string().min(1, 'Unidade obrigatória').max(16),
    unidadeSI: z.string().max(16).optional().or(z.literal('')),
    rangeMin: z.number().finite('Valor mínimo inválido'),
    rangeMax: z.number().finite('Valor máximo inválido'),
    metodo: z.string().max(80).optional().or(z.literal('')),
    cvAlvo: z
      .number()
      .min(0, 'CV não pode ser negativo')
      .max(100, 'CV em % máximo 100')
      .optional()
      .or(z.nan()),
    ativo: z.boolean(),
  })
  .refine((d) => d.rangeMax >= d.rangeMin, {
    message: 'Máximo deve ser ≥ mínimo',
    path: ['rangeMax'],
  });

type FormValues = z.infer<typeof analitoSchema>;

// ─── Props ────────────────────────────────────────────────────────────────

export interface AnalitoFormProps {
  /** `null` = criação; analito existente = edição. */
  analito: Analito | null;
  onSubmit: (input: AnalitoInput) => Promise<void> | void;
  onCancel: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fromAnalito(a: Analito | null): FormValues {
  if (!a) {
    return {
      nome: '',
      sigla: '',
      unidade: 'mg/dL',
      unidadeSI: '',
      rangeMin: 0,
      rangeMax: 0,
      metodo: '',
      cvAlvo: NaN,
      ativo: true,
    };
  }
  return {
    nome: a.nome,
    sigla: a.sigla ?? '',
    unidade: a.unidade,
    unidadeSI: a.unidadeSI ?? '',
    rangeMin: a.rangeBiologico.min,
    rangeMax: a.rangeBiologico.max,
    metodo: a.metodo ?? '',
    cvAlvo: a.cvAlvo ?? NaN,
    ativo: a.ativo,
  };
}

function toInput(values: FormValues, seedDefault: boolean): AnalitoInput {
  return {
    nome: values.nome.trim(),
    sigla: values.sigla?.trim() || undefined,
    unidade: values.unidade.trim(),
    unidadeSI: values.unidadeSI?.trim() || undefined,
    rangeBiologico: { min: values.rangeMin, max: values.rangeMax },
    metodo: values.metodo?.trim() || undefined,
    cvAlvo: Number.isFinite(values.cvAlvo) ? (values.cvAlvo as number) : undefined,
    ativo: values.ativo,
    seedDefault,
  };
}

// ─── Component ────────────────────────────────────────────────────────────

export function AnalitoForm({ analito, onSubmit, onCancel }: AnalitoFormProps) {
  const isEdit = analito !== null;
  const [values, setValues] = useState<FormValues>(() => fromAnalito(analito));
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues | 'rangeMax', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // ── Foca primeiro input ao abrir + Escape fecha ─────────────────────────
  useEffect(() => {
    const firstInput = dialogRef.current?.querySelector<HTMLInputElement>('input[name="nome"]');
    firstInput?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, submitting]);

  const update = <K extends keyof FormValues>(key: K, val: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const rangeChip = useMemo(() => {
    if (!Number.isFinite(values.rangeMin) || !Number.isFinite(values.rangeMax)) return null;
    if (values.rangeMax < values.rangeMin) return null;
    return `${values.rangeMin} – ${values.rangeMax} ${values.unidade}`;
  }, [values.rangeMin, values.rangeMax, values.unidade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = analitoSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormValues | 'rangeMax', string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormValues | 'rangeMax';
        if (!next[k]) next[k] = issue.message;
      }
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      const input = toInput(parsed.data, analito?.seedDefault ?? false);
      await onSubmit(input);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 motion-reduce:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={dialogRef}
        className="bg-[#141417] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-violet-400 mb-1">
                Bioquímica · Analito
              </p>
              <h2 id={titleId} className="text-lg font-semibold text-white tracking-tight">
                {isEdit ? 'Editar analito' : 'Novo analito'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              aria-label="Cancelar"
              className="p-1 -mt-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Nome + Sigla */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="nome" required>Nome</Label>
              <input
                id="nome"
                name="nome"
                type="text"
                value={values.nome}
                onChange={(e) => update('nome', e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.nome)}
                aria-describedby={errors.nome ? 'err-nome' : undefined}
                className={inputCls(Boolean(errors.nome))}
              />
              {errors.nome && <FieldError id="err-nome" message={errors.nome} />}
            </div>
            <div>
              <Label htmlFor="sigla">Sigla</Label>
              <input
                id="sigla"
                name="sigla"
                type="text"
                value={values.sigla ?? ''}
                onChange={(e) => update('sigla', e.target.value)}
                disabled={submitting}
                maxLength={8}
                className={inputCls(false)}
              />
            </div>
          </div>

          {/* Unidade + SI */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="unidade" required>Unidade</Label>
              <input
                id="unidade"
                name="unidade"
                type="text"
                value={values.unidade}
                onChange={(e) => update('unidade', e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.unidade)}
                aria-describedby={errors.unidade ? 'err-unidade' : undefined}
                className={inputCls(Boolean(errors.unidade))}
              />
              {errors.unidade && <FieldError id="err-unidade" message={errors.unidade} />}
            </div>
            <div>
              <Label htmlFor="unidadeSI">Unidade SI</Label>
              <input
                id="unidadeSI"
                name="unidadeSI"
                type="text"
                value={values.unidadeSI ?? ''}
                onChange={(e) => update('unidadeSI', e.target.value)}
                disabled={submitting}
                placeholder="opcional"
                className={inputCls(false)}
              />
            </div>
          </div>

          {/* Range */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-white/70 mb-2">
              Range biológico <span className="text-rose-400">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rangeMin" srOnly>Mínimo</Label>
                <input
                  id="rangeMin"
                  name="rangeMin"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={Number.isFinite(values.rangeMin) ? values.rangeMin : ''}
                  onChange={(e) => update('rangeMin', e.target.value === '' ? NaN : Number(e.target.value))}
                  disabled={submitting}
                  placeholder="mínimo"
                  aria-label="Valor mínimo"
                  className={`${inputCls(Boolean(errors.rangeMin))} tabular-nums`}
                />
              </div>
              <div>
                <Label htmlFor="rangeMax" srOnly>Máximo</Label>
                <input
                  id="rangeMax"
                  name="rangeMax"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={Number.isFinite(values.rangeMax) ? values.rangeMax : ''}
                  onChange={(e) => update('rangeMax', e.target.value === '' ? NaN : Number(e.target.value))}
                  disabled={submitting}
                  placeholder="máximo"
                  aria-label="Valor máximo"
                  aria-invalid={Boolean(errors.rangeMax)}
                  aria-describedby={errors.rangeMax ? 'err-rangeMax' : undefined}
                  className={`${inputCls(Boolean(errors.rangeMax))} tabular-nums`}
                />
              </div>
            </div>
            {errors.rangeMax && <FieldError id="err-rangeMax" message={errors.rangeMax} />}
            {rangeChip && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                {rangeChip}
              </span>
            )}
          </fieldset>

          {/* Método + CV */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="metodo">Método</Label>
              <input
                id="metodo"
                name="metodo"
                type="text"
                value={values.metodo ?? ''}
                onChange={(e) => update('metodo', e.target.value)}
                disabled={submitting}
                placeholder="ex: Hexoquinase, ISE..."
                className={inputCls(false)}
              />
            </div>
            <div>
              <Label htmlFor="cvAlvo">CV alvo (%)</Label>
              <input
                id="cvAlvo"
                name="cvAlvo"
                type="number"
                inputMode="decimal"
                step="any"
                value={Number.isFinite(values.cvAlvo) ? (values.cvAlvo as number) : ''}
                onChange={(e) => update('cvAlvo', e.target.value === '' ? NaN : Number(e.target.value))}
                disabled={submitting}
                aria-invalid={Boolean(errors.cvAlvo)}
                className={`${inputCls(Boolean(errors.cvAlvo))} tabular-nums`}
              />
              {errors.cvAlvo && <FieldError id="err-cvAlvo" message={errors.cvAlvo} />}
            </div>
          </div>

          {/* Ativo */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={values.ativo}
              onChange={(e) => update('ativo', e.target.checked)}
              disabled={submitting}
              className="w-4 h-4 rounded border-white/20 bg-white/[0.04] text-violet-500 focus:ring-violet-500/50 focus:ring-offset-0"
            />
            <span className="text-sm text-white/80">
              Analito ativo
              <span className="block text-[11px] text-white/40 mt-0.5">
                Inativos não aparecem em runs novas. Histórico permanece.
              </span>
            </span>
          </label>

          {submitError && (
            <div
              role="alert"
              className="px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
            >
              {submitError}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm text-white/70 hover:text-white/90 rounded-md transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/40 text-white rounded-md transition-colors duration-150"
            >
              {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar analito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function Label({
  htmlFor,
  children,
  required,
  srOnly,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
  srOnly?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={
        srOnly
          ? 'sr-only'
          : 'block text-xs font-medium text-white/70 mb-1.5'
      }
    >
      {children}
      {required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-rose-400">
      {message}
    </p>
  );
}

function inputCls(hasError: boolean) {
  const base =
    'w-full px-3 py-2 rounded-md bg-white/[0.04] border text-sm text-white/90 placeholder:text-white/30 transition-colors duration-150 focus:outline-none disabled:opacity-50';
  return hasError
    ? `${base} border-rose-500/50 focus:border-rose-400 focus:ring-1 focus:ring-rose-500/40`
    : `${base} border-white/[0.08] focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/40`;
}
