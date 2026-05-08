import React, { useId } from 'react';
import { UroButtonToggle } from './UroButtonToggle';

type NotivisaTipo = 'queixa_tecnica' | 'evento_adverso';
type NotivisaStatus = 'pendente' | 'notificado' | 'dispensado';

export interface UroFormFooterSectionProps {
  // Conformidade summary
  totalAnalitos: number;
  preenchidos: number;
  conformes: number;
  desvios: number;
  pendentes: number;

  // Conditional fields gate
  hasDesvios: boolean;

  // Form values
  acaoCorretiva: string;
  notivisaTipo?: NotivisaTipo;
  notivisaStatus?: NotivisaStatus;
  notivisaProtocolo?: string;
  notivisaDataEnvio?: string;
  notivisaJustificativa?: string;

  // Errors
  errors: Partial<Record<string, string>>;

  // Handlers
  onChange: <K extends string>(key: K, value: string) => void;
  onBlur?: (key: string) => void;

  // Action button
  onSave: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
}

// ─── Tokens (match UroInputField) ──────────────────────────────────────────────
const TEXTAREA_BASE =
  'w-full rounded-xl border bg-slate-50 dark:bg-white/[0.06] px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-all duration-150 ease-out resize-y text-slate-900 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/20';
const TEXTAREA_BORDER =
  'border-slate-200 dark:border-white/[0.09] hover:border-slate-300 dark:hover:border-white/[0.18] focus:border-amber-500/60 dark:focus:border-amber-500/50 focus:bg-white dark:focus:bg-white/[0.08]';
const TEXTAREA_ERROR = 'border-red-400/60 dark:border-red-400/40';

const TIPO_OPTIONS = [
  { value: 'queixa_tecnica' as const, label: 'Queixa técnica' },
  { value: 'evento_adverso' as const, label: 'Evento adverso' },
];

const STATUS_OPTIONS = [
  { value: 'pendente' as const, label: 'Pendente' },
  { value: 'notificado' as const, label: 'Notificado' },
  { value: 'dispensado' as const, label: 'Dispensado' },
];

// ─── Subcomponents ─────────────────────────────────────────────────────────────

interface MetricProps {
  label: string;
  value: number;
  total?: number;
  tone: 'neutral' | 'emerald' | 'red' | 'amber';
  inactive?: boolean;
}

function Metric({ label, value, total, tone, inactive }: MetricProps) {
  const colorMap: Record<MetricProps['tone'], string> = {
    neutral: 'text-slate-900 dark:text-white/85',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };
  const muted = 'text-slate-500 dark:text-white/35';
  const numberClass = inactive ? muted : colorMap[tone];

  return (
    <div className="flex flex-col items-start">
      <span className={`text-2xl font-semibold tabular-nums leading-none ${numberClass}`}>
        {value}
        {typeof total === 'number' && (
          <span className="text-base font-normal text-slate-400 dark:text-white/30">
            {' '}/ {total}
          </span>
        )}
      </span>
      <span className="mt-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/45">
        {label}
      </span>
    </div>
  );
}

interface SectionTitleProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'critical';
}

function SectionTitle({ children, tone = 'neutral' }: SectionTitleProps) {
  const color =
    tone === 'critical'
      ? 'text-red-600/90 dark:text-red-400/85'
      : 'text-slate-500 dark:text-white/45';
  return (
    <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${color}`}>
      {children}
    </h3>
  );
}

interface FieldLabelProps {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}

function FieldLabel({ htmlFor, required, children }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/45 flex items-baseline gap-1"
    >
      <span>{children}</span>
      {required && (
        <span className="text-red-500 dark:text-red-400" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

interface TextareaProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  rows?: number;
  placeholder?: string;
  error?: string;
  required?: boolean;
  ariaLabel?: string;
}

function Textarea({ id, value, onChange, onBlur, rows = 3, placeholder, error, required, ariaLabel }: TextareaProps) {
  const isError = Boolean(error);
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={isError || undefined}
        aria-describedby={isError ? `${id}-error` : undefined}
        className={`${TEXTAREA_BASE} ${isError ? TEXTAREA_ERROR : TEXTAREA_BORDER}`}
      />
      {error && (
        <p
          id={`${id}-error`}
          className="text-[11px] text-red-600 dark:text-red-400 leading-tight"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface DateFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
}

function DateField({ id, label, value, onChange, onBlur, error, required }: DateFieldProps) {
  const isError = Boolean(error);
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div
        className={[
          'group relative flex items-center gap-2 rounded-xl border transition-all duration-150 ease-out',
          'bg-slate-50 dark:bg-white/[0.06]',
          'focus-within:bg-white dark:focus-within:bg-white/[0.08]',
          isError
            ? TEXTAREA_ERROR
            : 'border-slate-200 dark:border-white/[0.09] hover:border-slate-300 dark:hover:border-white/[0.18] focus-within:border-amber-500/60 dark:focus-within:border-amber-500/50',
        ].join(' ')}
      >
        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          required={required}
          aria-invalid={isError || undefined}
          aria-describedby={isError ? `${id}-error` : undefined}
          className="w-full bg-transparent px-3.5 py-2.5 text-sm leading-none outline-none text-slate-900 dark:text-white/90 tabular-nums [color-scheme:dark]"
        />
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="text-[11px] text-red-600 dark:text-red-400 leading-tight"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}

function TextField({ id, label, value, onChange, onBlur, placeholder, error, required }: TextFieldProps) {
  const isError = Boolean(error);
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div
        className={[
          'group relative flex items-center gap-2 rounded-xl border transition-all duration-150 ease-out',
          'bg-slate-50 dark:bg-white/[0.06]',
          'focus-within:bg-white dark:focus-within:bg-white/[0.08]',
          isError
            ? TEXTAREA_ERROR
            : 'border-slate-200 dark:border-white/[0.09] hover:border-slate-300 dark:hover:border-white/[0.18] focus-within:border-amber-500/60 dark:focus-within:border-amber-500/50',
        ].join(' ')}
      >
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          aria-invalid={isError || undefined}
          aria-describedby={isError ? `${id}-error` : undefined}
          className="w-full bg-transparent px-3.5 py-2.5 text-sm leading-none outline-none text-slate-900 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/20"
        />
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="text-[11px] text-red-600 dark:text-red-400 leading-tight"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UroFormFooterSection({
  totalAnalitos,
  preenchidos,
  conformes,
  desvios,
  pendentes,
  hasDesvios,
  acaoCorretiva,
  notivisaTipo,
  notivisaStatus,
  notivisaProtocolo,
  notivisaDataEnvio,
  notivisaJustificativa,
  errors,
  onChange,
  onBlur,
  onSave,
  saving = false,
  saveDisabled = false,
  saveLabel = 'Salvar e assinar',
}: UroFormFooterSectionProps) {
  const idBase = useId();
  const acaoId = `${idBase}-acao`;
  const protocoloId = `${idBase}-protocolo`;
  const dataEnvioId = `${idBase}-dataenvio`;
  const justificativaId = `${idBase}-justificativa`;

  const blockClass =
    'border-t border-slate-200 dark:border-white/[0.08] mt-8 pt-8 first:mt-0 first:pt-0 first:border-t-0';

  return (
    <section
      aria-label="Rodapé do formulário de uroanálise"
      className="flex flex-col gap-0"
    >
      {/* Block 1 — Resumo de conformidade */}
      <div className={blockClass}>
        <SectionTitle>Resumo de conformidade</SectionTitle>
        <div className="mt-3 flex items-end gap-8 flex-wrap">
          <Metric
            label="Preenchidos"
            value={preenchidos}
            total={totalAnalitos}
            tone="neutral"
          />
          <Metric label="Conformes" value={conformes} tone="emerald" />
          <Metric
            label="Desvios"
            value={desvios}
            tone="red"
            inactive={desvios === 0}
          />
          <Metric
            label="Pendentes"
            value={pendentes}
            tone="amber"
            inactive={pendentes === 0}
          />
        </div>
      </div>

      {/* Block 2 — Ação corretiva */}
      {hasDesvios && (
        <div className={blockClass}>
          <SectionTitle tone="critical">
            Ação corretiva, RDC 978/2025 Art. 128
          </SectionTitle>
          <div className="mt-3 flex flex-col gap-1.5">
            <FieldLabel htmlFor={acaoId} required>
              Descreva a ação tomada
            </FieldLabel>
            <Textarea
              id={acaoId}
              value={acaoCorretiva}
              onChange={(v) => onChange('acaoCorretiva', v)}
              onBlur={onBlur ? () => onBlur('acaoCorretiva') : undefined}
              rows={3}
              required
              placeholder="Causa identificada, ação imediata, responsável, prazo de verificação."
              error={errors.acaoCorretiva}
              ariaLabel="Ação corretiva"
            />
          </div>
        </div>
      )}

      {/* Block 3 — NOTIVISA */}
      {hasDesvios && (
        <div className={blockClass}>
          <SectionTitle>Tecnovigilância, RDC 67/2009 + 551/2021</SectionTitle>
          <div className="mt-3 flex flex-col gap-5">
            <UroButtonToggle
              label="Tipo de ocorrência"
              options={TIPO_OPTIONS}
              value={notivisaTipo ?? null}
              onChange={(v) => onChange('notivisaTipo', v)}
            />

            <UroButtonToggle
              label="Status da notificação"
              options={STATUS_OPTIONS}
              value={notivisaStatus ?? null}
              onChange={(v) => onChange('notivisaStatus', v)}
            />

            {notivisaStatus === 'notificado' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField
                  id={protocoloId}
                  label="Protocolo NOTIVISA"
                  value={notivisaProtocolo ?? ''}
                  onChange={(v) => onChange('notivisaProtocolo', v)}
                  onBlur={onBlur ? () => onBlur('notivisaProtocolo') : undefined}
                  placeholder="Ex.: 2026.0001234"
                  required
                  error={errors.notivisaProtocolo}
                />
                <DateField
                  id={dataEnvioId}
                  label="Data de envio"
                  value={notivisaDataEnvio ?? ''}
                  onChange={(v) => onChange('notivisaDataEnvio', v)}
                  onBlur={onBlur ? () => onBlur('notivisaDataEnvio') : undefined}
                  required
                  error={errors.notivisaDataEnvio}
                />
              </div>
            )}

            {notivisaStatus === 'dispensado' && (
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor={justificativaId} required>
                  Justificativa da dispensa
                </FieldLabel>
                <Textarea
                  id={justificativaId}
                  value={notivisaJustificativa ?? ''}
                  onChange={(v) => onChange('notivisaJustificativa', v)}
                  onBlur={onBlur ? () => onBlur('notivisaJustificativa') : undefined}
                  rows={2}
                  required
                  placeholder="Fundamento técnico para não notificar."
                  error={errors.notivisaJustificativa}
                  ariaLabel="Justificativa da dispensa"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block 4 — Save CTA */}
      <div className={blockClass}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || saveDisabled}
            aria-busy={saving || undefined}
            aria-disabled={saving || saveDisabled || undefined}
            className={[
              'inline-flex items-center justify-center gap-2',
              'rounded-lg px-6 py-3 text-sm font-semibold',
              'bg-amber-500 text-white',
              'shadow-sm shadow-amber-500/20',
              'transition-all duration-150 ease-out',
              'hover:bg-amber-400 active:scale-[0.97] motion-reduce:active:scale-100',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              saving || saveDisabled
                ? 'opacity-40 cursor-not-allowed pointer-events-none'
                : 'cursor-pointer',
            ].join(' ')}
          >
            {saving && (
              <span
                aria-hidden
                className="block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
              />
            )}
            <span>{saving ? 'Salvando…' : saveLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
