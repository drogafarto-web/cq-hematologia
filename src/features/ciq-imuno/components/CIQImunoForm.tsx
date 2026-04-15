import React, { useState } from 'react';
import { CIQImunoFormSchema, daysToExpiry } from './CIQImunoForm.schema';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import type { TestType } from '../types/_shared_refs';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_TYPES: TestType[] = [
  'HCG', 'BhCG', 'HIV', 'HBsAg', 'Anti-HCV',
  'Sifilis', 'Dengue', 'COVID', 'PCR', 'Troponina',
];

const CARGO_OPTIONS: { value: CIQImunoFormData['cargo']; label: string }[] = [
  { value: 'biomedico',    label: 'Biomédico(a)' },
  { value: 'tecnico',      label: 'Técnico(a) de Laboratório' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
];

const today = () => {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, '0');
  const d   = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const INPUT = [
  'w-full px-3.5 py-2.5 rounded-xl',
  'bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]',
  'text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm',
  'focus:outline-none focus:border-emerald-500/50 dark:focus:border-emerald-500/50 focus:bg-white dark:focus:bg-white/[0.08]',
  'disabled:opacity-40 transition-all',
].join(' ');

const INPUT_ERR = INPUT.replace(
  'border-slate-200 dark:border-white/[0.09]',
  'border-red-400/60 dark:border-red-400/40'
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ htmlFor, children, required }: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-red-500 dark:text-red-400/80 text-xs mt-1 ml-0.5">{msg}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">
      {children}
    </p>
  );
}

/** Toggle R / NR */
function RNRToggle({ id, value, onChange, error }: {
  id: string;
  value: 'R' | 'NR' | undefined;
  onChange: (v: 'R' | 'NR') => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex gap-2" id={id}>
        {(['R', 'NR'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={[
              'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
              value === opt
                ? opt === 'R'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/10 border-red-400/40 text-red-600 dark:text-red-400'
                : 'border-slate-200 dark:border-white/[0.09] text-slate-400 dark:text-white/30 hover:border-slate-300 dark:hover:border-white/20',
            ].join(' ')}
          >
            {opt === 'R' ? 'R — Reagente' : 'NR — Não Reagente'}
          </button>
        ))}
      </div>
      <FieldError msg={error} />
    </div>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

function ExpiryWarning({ label, days }: { label: string; days: number }) {
  if (days >= 30) return null;
  const expired = days < 0;
  return (
    <div className={[
      'flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mt-1.5',
      expired
        ? 'bg-red-500/[0.07] border-red-400/20 text-red-500 dark:text-red-400'
        : 'bg-amber-500/[0.07] border-amber-500/20 text-amber-600 dark:text-amber-400',
    ].join(' ')}>
      <span className="mt-px shrink-0">{expired ? '✕' : '⚠'}</span>
      <span>
        {expired
          ? `${label} vencido há ${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''}.`
          : `${label} vence em ${days} dia${days !== 1 ? 's' : ''}.`}
      </span>
    </div>
  );
}

function ReagentOpenAlert() {
  return (
    <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mt-1.5 bg-amber-500/[0.07] border-amber-500/20 text-amber-600 dark:text-amber-400">
      <span className="mt-px shrink-0">⚠</span>
      <span>Reagente não reagente na abertura — inviabiliza uso para CIQ de testes Reagentes.</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CIQImunoFormProps {
  onSave:    (data: CIQImunoFormData) => Promise<void>;
  isSaving?: boolean;
  onCancel?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQImunoForm({ onSave, isSaving = false, onCancel }: CIQImunoFormProps) {
  const [form, setForm] = useState<Partial<CIQImunoFormData>>({
    resultadoEsperado: 'R',
    dataRealizacao:    today(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof CIQImunoFormData>(key: K, value: CIQImunoFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = CIQImunoFormSchema.safeParse(form);

    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(
          Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ''])
        )
      );
      const firstErrEl = document.querySelector('[data-field-error]');
      firstErrEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    await onSave(result.data);
  }

  const ctrlDays = form.validadeControle ? daysToExpiry(form.validadeControle) : null;
  const reagDays = form.validadeReagente ? daysToExpiry(form.validadeReagente) : null;
  const naoConforme = form.resultadoObtido !== undefined &&
                      form.resultadoEsperado !== undefined &&
                      form.resultadoObtido !== form.resultadoEsperado;

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>

      {/* ── Tipo de Teste ──────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Tipo de Teste</SectionTitle>
        <div>
          <Label htmlFor="testType" required>Imunoensaio</Label>
          <select
            id="testType"
            title="Tipo de imunoensaio"
            value={form.testType ?? ''}
            onChange={(e) => set('testType', e.target.value as TestType)}
            className={errors.testType ? INPUT_ERR : INPUT}
          >
            <option value="" disabled>Selecione o tipo de teste…</option>
            {TEST_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <FieldError msg={errors.testType} />
        </div>
      </div>

      {/* ── Operador ───────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Operador</SectionTitle>
        <div>
          <Label htmlFor="cargo" required>Cargo profissional</Label>
          <select
            id="cargo"
            title="Cargo profissional do operador"
            value={form.cargo ?? ''}
            onChange={(e) => set('cargo', e.target.value as CIQImunoFormData['cargo'])}
            className={errors.cargo ? INPUT_ERR : INPUT}
          >
            <option value="" disabled>Selecione o cargo…</option>
            {CARGO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <FieldError msg={errors.cargo} />
        </div>
      </div>

      {/* ── Controle ───────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Controle Interno</SectionTitle>
        <div className="space-y-3">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteControle" required>Lote do controle</Label>
              <input
                id="loteControle"
                type="text"
                placeholder="ex: L2024-001"
                value={form.loteControle ?? ''}
                onChange={(e) => set('loteControle', e.target.value)}
                className={errors.loteControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.loteControle} />
            </div>

            <div>
              <Label htmlFor="fabricanteControle" required>Fabricante</Label>
              <input
                id="fabricanteControle"
                type="text"
                placeholder="ex: BioSystems"
                value={form.fabricanteControle ?? ''}
                onChange={(e) => set('fabricanteControle', e.target.value)}
                className={errors.fabricanteControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.fabricanteControle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aberturaControle" required>Abertura do controle</Label>
              <input
                id="aberturaControle"
                type="date"
                title="Data de abertura do controle"
                value={form.aberturaControle ?? ''}
                onChange={(e) => set('aberturaControle', e.target.value)}
                className={errors.aberturaControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.aberturaControle} />
            </div>

            <div>
              <Label htmlFor="validadeControle" required>Validade do controle</Label>
              <input
                id="validadeControle"
                type="date"
                title="Data de validade do controle"
                value={form.validadeControle ?? ''}
                onChange={(e) => set('validadeControle', e.target.value)}
                className={errors.validadeControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.validadeControle} />
              {ctrlDays !== null && <ExpiryWarning label="Controle" days={ctrlDays} />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Reagente ───────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Reagente</SectionTitle>
        <div className="space-y-3">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteReagente" required>Lote do reagente</Label>
              <input
                id="loteReagente"
                type="text"
                placeholder="ex: R2024-042"
                value={form.loteReagente ?? ''}
                onChange={(e) => set('loteReagente', e.target.value)}
                className={errors.loteReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.loteReagente} />
            </div>

            <div>
              <Label htmlFor="fabricanteReagente" required>Fabricante</Label>
              <input
                id="fabricanteReagente"
                type="text"
                placeholder="ex: Abbott, Roche"
                value={form.fabricanteReagente ?? ''}
                onChange={(e) => set('fabricanteReagente', e.target.value)}
                className={errors.fabricanteReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.fabricanteReagente} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="codigoKit">Código do kit</Label>
              <input
                id="codigoKit"
                type="text"
                placeholder="ex: 04L59-20"
                value={form.codigoKit ?? ''}
                onChange={(e) => set('codigoKit', e.target.value || undefined)}
                className={INPUT}
              />
            </div>

            <div>
              <Label htmlFor="registroANVISA">Registro ANVISA</Label>
              <input
                id="registroANVISA"
                type="text"
                placeholder="ex: 10269230117"
                value={form.registroANVISA ?? ''}
                onChange={(e) => set('registroANVISA', e.target.value || undefined)}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reagenteStatus" required>Status na abertura do kit</Label>
            <RNRToggle
              id="reagenteStatus"
              value={form.reagenteStatus}
              onChange={(v) => set('reagenteStatus', v)}
              error={errors.reagenteStatus}
            />
            {form.reagenteStatus === 'NR' && <ReagentOpenAlert />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aberturaReagente" required>Abertura do reagente</Label>
              <input
                id="aberturaReagente"
                type="date"
                title="Data de abertura do reagente"
                value={form.aberturaReagente ?? ''}
                onChange={(e) => set('aberturaReagente', e.target.value)}
                className={errors.aberturaReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.aberturaReagente} />
            </div>

            <div>
              <Label htmlFor="validadeReagente" required>Validade do reagente</Label>
              <input
                id="validadeReagente"
                type="date"
                title="Data de validade do reagente"
                value={form.validadeReagente ?? ''}
                onChange={(e) => set('validadeReagente', e.target.value)}
                className={errors.validadeReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.validadeReagente} />
              {reagDays !== null && <ExpiryWarning label="Reagente" days={reagDays} />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Resultado ──────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Resultado</SectionTitle>
        <div className="space-y-4">

          <div>
            <Label htmlFor="resultadoEsperado" required>Resultado esperado (fabricante)</Label>
            <RNRToggle
              id="resultadoEsperado"
              value={form.resultadoEsperado}
              onChange={(v) => set('resultadoEsperado', v)}
              error={errors.resultadoEsperado}
            />
          </div>

          <div>
            <Label htmlFor="resultadoObtido" required>Resultado obtido</Label>
            <RNRToggle
              id="resultadoObtido"
              value={form.resultadoObtido}
              onChange={(v) => set('resultadoObtido', v)}
              error={errors.resultadoObtido}
            />
          </div>

          <div>
            <Label htmlFor="dataRealizacao" required>Data de realização</Label>
            <input
              id="dataRealizacao"
              type="date"
              value={form.dataRealizacao ?? ''}
              onChange={(e) => set('dataRealizacao', e.target.value)}
              className={errors.dataRealizacao ? INPUT_ERR : INPUT}
            />
            <FieldError msg={errors.dataRealizacao} />
          </div>

          {/* Ação corretiva — visível sempre que há não conformidade */}
          {naoConforme && (
            <div>
              <Label htmlFor="acaoCorretiva" required>
                Ação corretiva (RDC 978/2025 Art.128)
              </Label>
              <textarea
                id="acaoCorretiva"
                rows={3}
                placeholder="Descreva a ação corretiva tomada…"
                value={form.acaoCorretiva ?? ''}
                onChange={(e) => set('acaoCorretiva', e.target.value || undefined)}
                className={[
                  errors.acaoCorretiva ? INPUT_ERR : INPUT,
                  'resize-none leading-relaxed',
                ].join(' ')}
              />
              <FieldError msg={errors.acaoCorretiva} />
            </div>
          )}
        </div>
      </div>

      {/* ── Equipamento (opcional) ─────────────────────────────────────────── */}
      <div>
        <SectionTitle>Equipamento</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <div>
            <Label htmlFor="equipamento">Equipamento / analisador</Label>
            <input
              id="equipamento"
              type="text"
              placeholder="ex: Mini VIDAS, Architect i1000"
              value={form.equipamento ?? ''}
              onChange={(e) => set('equipamento', e.target.value || undefined)}
              className={INPUT}
            />
          </div>

          <div>
            <Label htmlFor="temperaturaAmbiente">Temperatura ambiente (°C)</Label>
            <input
              id="temperaturaAmbiente"
              type="number"
              step="0.1"
              min="-10"
              max="50"
              placeholder="ex: 22.5"
              title="Temperatura ambiente em graus Celsius"
              value={form.temperaturaAmbiente ?? ''}
              onChange={(e) => set(
                'temperaturaAmbiente',
                e.target.value ? Number(e.target.value) : undefined,
              )}
              className={INPUT}
            />
          </div>
        </div>
      </div>

      {/* ── Ações ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1]
                       text-sm text-slate-500 dark:text-white/50
                       hover:text-slate-800 dark:hover:text-white/80
                       hover:border-slate-300 dark:hover:border-white/[0.2]
                       disabled:opacity-40 transition-all"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                     bg-emerald-500 hover:bg-emerald-400 text-white
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Salvando…' : 'Registrar corrida'}
        </button>
      </div>
    </form>
  );
}
