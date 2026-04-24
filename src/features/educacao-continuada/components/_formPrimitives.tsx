/**
 * _formPrimitives.tsx
 *
 * Primitives de formulário compartilhados por todos os forms do módulo.
 * Prefixo `_` sinaliza uso restrito à própria pasta `components/`.
 *
 * Design tokens (dark-first, emerald accent) são literais por intenção —
 * centralizar aqui garante que qualquer mudança de tema atinja todos os
 * forms de Educação Continuada sem caça aos duplicados.
 */

import type { ReactNode } from 'react';

export interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function Field({ id, label, required, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function inputClass(hasError: boolean): string {
  const base =
    'rounded-md border bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 disabled:opacity-60';
  return hasError
    ? `${base} border-red-500/60 focus:ring-red-500/60`
    : `${base} border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/40`;
}

export function selectClass(): string {
  return 'rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60';
}
