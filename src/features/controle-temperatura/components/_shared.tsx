/**
 * Primitivos visuais compartilhados pelo módulo CT.
 *
 * Estilo calibrado contra o mock aprovado: content area light
 * (bg-slate-50 / cards bg-white), sidebar/chrome dark (bg-slate-900),
 * cores semânticas emerald/amber/rose/indigo. Preserva a linha editorial
 * do app e mantém FR-11 printável idêntico ao papel.
 */

import type { PropsWithChildren } from 'react';
import type { StatusCardEquipamento as _CardStatus, StatusNC } from '../types/ControlTemperatura';

// Alias pro nome do union importado (o tipo `StatusCardEquipamento` de
// types/ControlTemperatura já é o union `verde | amarelo | vermelho | cinza`).
type StatusCard = _CardStatus;

// ─── StatusBadge ──────────────────────────────────────────────────────────────

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function StatusBadge({ tone, children }: PropsWithChildren<{ tone: BadgeTone }>) {
  const styles: Record<BadgeTone, string> = {
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-rose-100 text-rose-800 border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function toneForStatusCard(s: StatusCard): BadgeTone {
  if (s === 'verde') return 'success';
  if (s === 'amarelo') return 'warning';
  if (s === 'vermelho') return 'danger';
  return 'neutral';
}

export function toneForNC(s: StatusNC): BadgeTone {
  if (s === 'resolvida') return 'success';
  if (s === 'em_andamento') return 'info';
  return 'danger';
}

export function borderForStatusCard(s: StatusCard): string {
  if (s === 'verde') return 'border-t-emerald-500';
  if (s === 'amarelo') return 'border-t-amber-400';
  if (s === 'vermelho') return 'border-t-rose-500';
  return 'border-t-slate-300';
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-md',
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ct-modal-title"
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[95vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <h3 id="ct-modal-title" className="text-lg font-bold text-slate-800">
              {title}
            </h3>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Form primitives ──────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: PropsWithChildren<{ label: string; hint?: string; htmlFor?: string }>) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={htmlFor}>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[80px] ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  tone = 'primary',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  const styles: Record<ButtonTone, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button
      {...rest}
      className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${styles[tone]} ${rest.className ?? ''}`}
    >
      {children}
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
