import React from 'react';
import { UroInputField } from './UroInputField';
import { UroButtonToggle } from './UroButtonToggle';
import { type UroanaliseFormData, daysToExpiry } from './UroanaliseForm.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UroFormIdentificationSectionProps {
  values: Partial<UroanaliseFormData>;
  errors: Partial<Record<keyof UroanaliseFormData, string>>;
  onChange: <K extends keyof UroanaliseFormData>(key: K, value: UroanaliseFormData[K]) => void;
  onBlur?: (key: keyof UroanaliseFormData) => void;
  disabled?: boolean;
}

// ─── Toggle option lists (typed as readonly so UroButtonToggle infers T) ─────

const NIVEL_OPTIONS = [
  { value: 'N', label: 'Normal' },
  { value: 'P', label: 'Patológico' },
] as const satisfies ReadonlyArray<{ value: 'N' | 'P'; label: string }>;

const FREQUENCIA_OPTIONS = [
  { value: 'DIARIA', label: 'Diária' },
  { value: 'LOTE', label: 'Por lote' },
] as const satisfies ReadonlyArray<{ value: 'DIARIA' | 'LOTE'; label: string }>;

const CARGO_OPTIONS = [
  { value: 'biomedico', label: 'Biomédico(a)' },
  { value: 'tecnico', label: 'Técnico(a)' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
] as const satisfies ReadonlyArray<{
  value: 'biomedico' | 'tecnico' | 'farmaceutico';
  label: string;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute an expiry hint string for a YYYY-MM-DD date.
 * Returns a hint only when expiry is within 30 days (including past).
 */
function expiryHint(dateStr: string | undefined): string | undefined {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return undefined;
  const days = daysToExpiry(dateStr);
  if (days < 0) return `expirado há ${Math.abs(days)}d`;
  if (days === 0) return 'expira hoje';
  if (days < 30) return `expira em ${days}d`;
  return undefined;
}

// ─── Section title ────────────────────────────────────────────────────────────

interface BlockHeadingProps {
  title: string;
  first?: boolean;
}

function BlockHeading({ title, first }: BlockHeadingProps) {
  return (
    <div className={first ? '' : 'mt-6 pt-6 border-t border-slate-200 dark:border-white/[0.06]'}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">
        {title}
      </h3>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UroFormIdentificationSection({
  values,
  errors,
  onChange,
  onBlur,
  disabled,
}: UroFormIdentificationSectionProps) {
  const validadeControleHint = expiryHint(values.validadeControle);
  const validadeTiraHint = expiryHint(values.validadeTira);

  // Numeric fields: store as number on schema, render via string in input.
  const tempStr =
    values.temperaturaAmbiente === undefined || values.temperaturaAmbiente === null
      ? ''
      : String(values.temperaturaAmbiente);
  const umidStr =
    values.umidadeAmbiente === undefined || values.umidadeAmbiente === null
      ? ''
      : String(values.umidadeAmbiente);

  const handleNumberChange = (key: 'temperaturaAmbiente' | 'umidadeAmbiente', raw: string) => {
    if (raw === '') {
      onChange(key, undefined as unknown as UroanaliseFormData[typeof key]);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange(key, parsed as UroanaliseFormData[typeof key]);
  };

  return (
    <div className="flex flex-col">
      {/* ── Block 1: Controle de Qualidade ─────────────────────────────── */}
      <BlockHeading title="Controle de Qualidade" first />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UroButtonToggle
          label="Nível"
          options={NIVEL_OPTIONS}
          value={values.nivel}
          onChange={(v) => onChange('nivel', v)}
          disabled={disabled}
        />
        <UroButtonToggle
          label="Frequência"
          options={FREQUENCIA_OPTIONS}
          value={values.frequencia}
          onChange={(v) => onChange('frequencia', v)}
          disabled={disabled}
        />
        <div className="sm:col-span-2 sm:max-w-xs">
          <UroInputField
            label="Data de realização"
            type="date"
            required
            value={values.dataRealizacao ?? ''}
            onChange={(v) => onChange('dataRealizacao', v)}
            onBlur={() => onBlur?.('dataRealizacao')}
            error={errors.dataRealizacao}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── Block 2: Material de controle ──────────────────────────────── */}
      <BlockHeading title="Material de controle" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <UroInputField
            label="Lote do controle"
            required
            value={values.loteControle ?? ''}
            onChange={(v) => onChange('loteControle', v)}
            onBlur={() => onBlur?.('loteControle')}
            error={errors.loteControle}
            disabled={disabled}
          />
        </div>
        <div className="sm:col-span-2">
          <UroInputField
            label="Fabricante"
            required
            value={values.fabricanteControle ?? ''}
            onChange={(v) => onChange('fabricanteControle', v)}
            onBlur={() => onBlur?.('fabricanteControle')}
            error={errors.fabricanteControle}
            disabled={disabled}
          />
        </div>
        <UroInputField
          label="Abertura"
          type="date"
          required
          value={values.aberturaControle ?? ''}
          onChange={(v) => onChange('aberturaControle', v)}
          onBlur={() => onBlur?.('aberturaControle')}
          error={errors.aberturaControle}
          disabled={disabled}
        />
        <UroInputField
          label="Validade"
          type="date"
          required
          value={values.validadeControle ?? ''}
          onChange={(v) => onChange('validadeControle', v)}
          onBlur={() => onBlur?.('validadeControle')}
          hint={validadeControleHint}
          error={errors.validadeControle}
          disabled={disabled}
        />
      </div>

      {/* ── Block 3: Tira reagente ─────────────────────────────────────── */}
      <BlockHeading title="Tira reagente" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <UroInputField
            label="Lote da tira"
            required
            value={values.loteTira ?? ''}
            onChange={(v) => onChange('loteTira', v)}
            onBlur={() => onBlur?.('loteTira')}
            error={errors.loteTira}
            disabled={disabled}
          />
        </div>
        <UroInputField
          label="Marca"
          hint="ex: Combur-10, Multistix"
          value={values.tiraMarca ?? ''}
          onChange={(v) => onChange('tiraMarca', v)}
          onBlur={() => onBlur?.('tiraMarca')}
          error={errors.tiraMarca}
          disabled={disabled}
        />
        <UroInputField
          label="Fabricante"
          value={values.fabricanteTira ?? ''}
          onChange={(v) => onChange('fabricanteTira', v)}
          onBlur={() => onBlur?.('fabricanteTira')}
          error={errors.fabricanteTira}
          disabled={disabled}
        />
        <div className="sm:col-span-2 sm:max-w-xs">
          <UroInputField
            label="Validade"
            type="date"
            value={values.validadeTira ?? ''}
            onChange={(v) => onChange('validadeTira', v)}
            onBlur={() => onBlur?.('validadeTira')}
            hint={validadeTiraHint}
            error={errors.validadeTira}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── Block 4: Condições ─────────────────────────────────────────── */}
      <BlockHeading title="Condições" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UroInputField
          label="Temperatura ambiente"
          type="number"
          step="0.1"
          suffix="°C"
          align="right"
          value={tempStr}
          onChange={(v) => handleNumberChange('temperaturaAmbiente', v)}
          onBlur={() => onBlur?.('temperaturaAmbiente')}
          error={errors.temperaturaAmbiente}
          disabled={disabled}
        />
        <UroInputField
          label="Umidade relativa"
          type="number"
          step="1"
          min={0}
          max={100}
          suffix="%"
          align="right"
          value={umidStr}
          onChange={(v) => handleNumberChange('umidadeAmbiente', v)}
          onBlur={() => onBlur?.('umidadeAmbiente')}
          error={errors.umidadeAmbiente}
          disabled={disabled}
        />
      </div>

      {/* ── Block 5: Operador ──────────────────────────────────────────── */}
      <BlockHeading title="Operador" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UroInputField
          label="Documento profissional"
          required
          hint="CRBM, CRF ou registro técnico"
          value={values.operatorDocument ?? ''}
          onChange={(v) => onChange('operatorDocument', v)}
          onBlur={() => onBlur?.('operatorDocument')}
          error={errors.operatorDocument}
          disabled={disabled}
        />
        <UroInputField
          label="Nome"
          value={values.operatorName ?? ''}
          onChange={(v) => onChange('operatorName', v)}
          onBlur={() => onBlur?.('operatorName')}
          error={errors.operatorName}
          disabled={disabled}
        />
        <div className="sm:col-span-2">
          <UroButtonToggle
            label="Cargo"
            options={CARGO_OPTIONS}
            value={values.cargo}
            onChange={(v) => onChange('cargo', v)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
