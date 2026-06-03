import React, { useState, useCallback } from 'react';
import { UroInputField } from './UroInputField';
import { UroButtonToggle } from './UroButtonToggle';
import { UroInsumoPicker, type UroInsumoSelection } from './UroInsumoPicker';
import { UroAberturaSelector } from './UroAberturaSelector';
import { type UroanaliseFormData, daysToExpiry } from './UroanaliseForm.schema';
import type { UroAberturaLote } from '../types/Uroanalise';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UroFormIdentificationSectionV2Props {
  values: Partial<UroanaliseFormData>;
  errors: Partial<Record<keyof UroanaliseFormData, string>>;
  onChange: <K extends keyof UroanaliseFormData>(key: K, value: UroanaliseFormData[K]) => void;
  onBlur?: (key: keyof UroanaliseFormData) => void;
  disabled?: boolean;
  onAddTiraLot?: () => void;
}

// ─── Toggle option lists ─────────────────────────────────────────────────────

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

function expiryHint(dateStr: string | undefined): string | undefined {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return undefined;
  const days = daysToExpiry(dateStr);
  if (days < 0) return `expirado há ${Math.abs(days)}d`;
  if (days === 0) return 'expira hoje';
  if (days < 30) return `expira em ${days}d`;
  return undefined;
}

function aberturaDisplay(abertura: UroAberturaLote | null): string {
  if (!abertura) return '—';
  const date = abertura.abertoEm?.toDate?.();
  const dateStr = date ? date.toLocaleDateString('pt-BR') : '—';
  return `Worklab #${abertura.worklabId} · ab. ${dateStr}`;
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

// ─── Accordion ────────────────────────────────────────────────────────────────

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionSection({ title, children, defaultOpen = false }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/[0.06] transition-all duration-150">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="group flex items-center gap-2 w-full text-left cursor-pointer transition-colors"
        aria-expanded={open}
      >
        <svg
          className={[
            'w-3.5 h-3.5 text-slate-400 dark:text-white/35 transition-transform duration-150',
            open ? 'rotate-90' : '',
          ].join(' ')}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 3l5 5-5 5" />
        </svg>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 group-hover:text-slate-600 dark:group-hover:text-white/50 transition-colors">
          {title}
        </h3>
        {!open && <span className="text-[10px] text-slate-400 dark:text-white/25">expandir</span>}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UroFormIdentificationSectionV2({
  values,
  errors,
  onChange,
  onBlur,
  disabled,
  onAddTiraLot,
}: UroFormIdentificationSectionV2Props) {
  const validadeControleHint = expiryHint(values.validadeControle);
  const validadeTiraHint = expiryHint(values.validadeTira);

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

  // ── Picker selection state ──────────────────────────────────────────────

  const [controleSel, setControleSel] = useState<UroInsumoSelection | null>(null);
  const [tiraSel, setTiraSel] = useState<UroInsumoSelection | null>(null);

  // Toggle abertura selector visibility
  const [showControleAbertura, setShowControleAbertura] = useState(false);
  const [showTiraAbertura, setShowTiraAbertura] = useState(false);

  // ── Picker callbacks ─────────────────────────────────────────────────────

  const handleControleSelect = useCallback(
    (sel: UroInsumoSelection | null) => {
      setControleSel(sel);
      setShowControleAbertura(false);
      if (!sel) {
        onChange('loteControle', '' as unknown as UroanaliseFormData['loteControle']);
        onChange('fabricanteControle', '' as unknown as UroanaliseFormData['fabricanteControle']);
        onChange('aberturaControle', '' as unknown as UroanaliseFormData['aberturaControle']);
        onChange('validadeControle', '' as unknown as UroanaliseFormData['validadeControle']);
        onChange('aberturaControleId', '' as unknown as UroanaliseFormData['aberturaControleId']);
        return;
      }
      const { lot, abertura } = sel;
      onChange('loteControle', lot.loteControle);
      onChange('fabricanteControle', lot.fabricanteControle);
      onChange('aberturaControle', lot.aberturaControle);
      onChange('validadeControle', lot.validadeControle);
      if (abertura) {
        onChange('aberturaControleId', abertura.id);
      }
    },
    [onChange],
  );

  const handleTiraSelect = useCallback(
    (sel: UroInsumoSelection | null) => {
      setTiraSel(sel);
      setShowTiraAbertura(false);
      if (!sel) {
        onChange('loteTira', '' as unknown as UroanaliseFormData['loteTira']);
        onChange('tiraMarca', '' as unknown as UroanaliseFormData['tiraMarca']);
        onChange('fabricanteTira', '' as unknown as UroanaliseFormData['fabricanteTira']);
        onChange('validadeTira', '' as unknown as UroanaliseFormData['validadeTira']);
        onChange('aberturaTiraId', '' as unknown as UroanaliseFormData['aberturaTiraId']);
        return;
      }
      const { lot, abertura } = sel;
      onChange('loteTira', abertura ? abertura.snapshotLote.lote : (lot.tiraReferencia ?? lot.id));
      onChange('tiraMarca', lot.tiraNome);
      onChange('fabricanteTira', lot.tiraFabricante);
      onChange(
        'validadeTira',
        (abertura
          ? abertura.snapshotLote.validade
          : '') as unknown as UroanaliseFormData['validadeTira'],
      );
      if (abertura) {
        onChange('aberturaTiraId', abertura.id);
      } else {
        onChange('aberturaTiraId', '');
      }
    },
    [onChange],
  );

  // ── Abertura change callbacks ────────────────────────────────────────────

  const handleControleAberturaChange = useCallback(
    (novaAbertura: UroAberturaLote | null) => {
      setControleSel((prev) => (prev ? { ...prev, abertura: novaAbertura } : prev));
      onChange(
        'aberturaControleId',
        (novaAbertura?.id ?? '') as UroanaliseFormData['aberturaControleId'],
      );
    },
    [onChange],
  );

  const handleTiraAberturaChange = useCallback(
    (novaAbertura: UroAberturaLote | null) => {
      setTiraSel((prev) => (prev ? { ...prev, abertura: novaAbertura } : prev));
      onChange('aberturaTiraId', (novaAbertura?.id ?? '') as UroanaliseFormData['aberturaTiraId']);
      if (novaAbertura) {
        onChange('loteTira', novaAbertura.snapshotLote.lote);
        onChange(
          'validadeTira',
          novaAbertura.snapshotLote.validade as unknown as UroanaliseFormData['validadeTira'],
        );
      } else {
        onChange('loteTira', '');
        onChange('validadeTira', '' as unknown as UroanaliseFormData['validadeTira']);
      }
    },
    [onChange],
  );

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

      {/* ── Block 2: Material de controle (picker) ─────────────────────── */}
      <BlockHeading title="Material de controle" />
      <div className="flex flex-col gap-3">
        <UroInsumoPicker
          tipo="controle"
          label="Selecione o lote de controle"
          value={controleSel?.lot.id}
          onChange={handleControleSelect}
          disabled={disabled}
          emptyPlaceholder="Nenhum lote de controle cadastrado."
        />
        {controleSel && (
          <div className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] px-3 py-2 text-xs">
            <div className="text-slate-700 dark:text-white/80 font-medium">
              {controleSel.lot.loteControle} · {controleSel.lot.fabricanteControle}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-slate-400 dark:text-white/35">
                {aberturaDisplay(controleSel.abertura)}
              </span>
              <button
                type="button"
                onClick={() => setShowControleAbertura((prev) => !prev)}
                className="text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                {showControleAbertura ? 'Fechar' : 'Trocar'}
              </button>
            </div>
            {showControleAbertura && (
              <div className="mt-2">
                <UroAberturaSelector
                  lotId={controleSel.lot.id}
                  lot={controleSel.lot}
                  abertura={controleSel.abertura}
                  tipo="controle"
                  onAberturaChange={handleControleAberturaChange}
                />
              </div>
            )}
          </div>
        )}
        <input type="hidden" value={values.loteControle ?? ''} />
        <input type="hidden" value={values.fabricanteControle ?? ''} />
        <input type="hidden" value={values.aberturaControle ?? ''} />
        <input type="hidden" value={values.validadeControle ?? ''} />
        {(errors.loteControle || errors.fabricanteControle) && (
          <p className="text-xs text-red-500 dark:text-red-400">
            {errors.loteControle || errors.fabricanteControle}
          </p>
        )}
      </div>

      {/* ── Block 3: Tira reagente (picker) ────────────────────────────── */}
      <BlockHeading title="Tira reagente" />
      <div className="flex flex-col gap-3">
        <UroInsumoPicker
          tipo="tira"
          label="Selecione a tira reagente"
          value={tiraSel?.lot.id}
          onChange={handleTiraSelect}
          disabled={disabled}
          emptyPlaceholder="Nenhum lote de tira cadastrado."
          onAddTiraLot={onAddTiraLot}
        />
        {tiraSel && (
          <div className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] px-3 py-2 text-xs">
            <div className="text-slate-700 dark:text-white/80 font-medium">
              {tiraSel.lot.tiraNome ?? '—'} · {tiraSel.lot.tiraFabricante ?? '—'}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-slate-400 dark:text-white/35">
                {aberturaDisplay(tiraSel.abertura)}
              </span>
              <button
                type="button"
                onClick={() => setShowTiraAbertura((prev) => !prev)}
                className="text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                {showTiraAbertura ? 'Fechar' : 'Trocar'}
              </button>
            </div>
            {showTiraAbertura && (
              <div className="mt-2">
                <UroAberturaSelector
                  lotId={tiraSel.lot.id}
                  lot={tiraSel.lot}
                  abertura={tiraSel.abertura}
                  tipo="tira"
                  onAberturaChange={handleTiraAberturaChange}
                />
              </div>
            )}
          </div>
        )}
        <input type="hidden" value={values.loteTira ?? ''} />
        <input type="hidden" value={values.tiraMarca ?? ''} />
        <input type="hidden" value={values.fabricanteTira ?? ''} />
        <input type="hidden" value={values.validadeTira ?? ''} />
        {(errors.loteTira || errors.aberturaTiraId) && (
          <p className="text-xs text-red-500 dark:text-red-400">
            {errors.loteTira || errors.aberturaTiraId}
          </p>
        )}
      </div>

      {/* ── Block 4: Detalhes do operador e ambiente (colapsado) ─────── */}
      <AccordionSection title="Detalhes do operador e ambiente">
        <BlockHeading title="Condições" first />
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
            hint="Pré-preenchido do seu perfil — edite se necessário"
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
      </AccordionSection>
    </div>
  );
}
