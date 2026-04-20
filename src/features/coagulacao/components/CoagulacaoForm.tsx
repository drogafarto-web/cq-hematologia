import React, { useState, useMemo } from 'react';
import { CoagulacaoFormSchema, daysToExpiry } from './CoagulacaoForm.schema';
import type { CoagulacaoFormData } from './CoagulacaoForm.schema';
import { useUser } from '../../../store/useAuthStore';
import { COAG_ANALYTES, COAG_ANALYTE_IDS } from '../CoagAnalyteConfig';
import type { CoagAnalyteId, CoagNivel } from '../types/_shared_refs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARGO_OPTIONS: { value: CoagulacaoFormData['cargo']; label: string }[] = [
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
  'focus:outline-none focus:border-rose-500/50 dark:focus:border-rose-500/50 focus:bg-white dark:focus:bg-white/[0.08]',
  'disabled:opacity-40 transition-all',
].join(' ');

const INPUT_ERR = INPUT.replace(
  'border-slate-200 dark:border-white/[0.09]',
  'border-red-400/60 dark:border-red-400/40',
);

const INPUT_OUT_OF_RANGE = INPUT.replace(
  'border-slate-200 dark:border-white/[0.09]',
  'border-amber-400/60 dark:border-amber-400/50',
);

// ─── Primitives ───────────────────────────────────────────────────────────────

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

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
        {children}
      </p>
      {hint && <p className="text-[10px] text-slate-400 dark:text-white/25">{hint}</p>}
    </div>
  );
}

/** Toggle I / II — nivel do controle */
function NivelToggle({ value, onChange, error }: {
  value: CoagNivel | undefined;
  onChange: (v: CoagNivel) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex gap-2">
        {(['I', 'II'] as const).map((opt) => {
          const label = opt === 'I' ? 'I — Normal' : 'II — Patológico';
          const sub   = opt === 'I'
            ? 'valores dentro do intervalo terapêutico'
            : 'anticoagulado / protrombótico';
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={[
                'flex-1 py-3 px-3.5 rounded-xl text-left border transition-all',
                value === opt
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
                  : 'border-slate-200 dark:border-white/[0.09] text-slate-400 dark:text-white/30 hover:border-slate-300 dark:hover:border-white/20',
              ].join(' ')}
            >
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-[10px] mt-0.5 opacity-60">{sub}</p>
            </button>
          );
        })}
      </div>
      <FieldError msg={error} />
    </div>
  );
}

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

/** Aprovação derivada em tempo real — baseada em intervalo low/high do fabricante. */
function RangeBadge({ outOfRange }: { outOfRange: CoagAnalyteId[] }) {
  const conforme = outOfRange.length === 0;
  return (
    <div className={[
      'flex items-center gap-3 px-3.5 py-3 rounded-xl border',
      conforme
        ? 'bg-emerald-500/[0.07] border-emerald-500/25'
        : 'bg-amber-500/[0.07] border-amber-500/25',
    ].join(' ')}>
      <div className={[
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
        conforme
          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
      ].join(' ')}>
        {conforme ? '✓' : '!'}
      </div>
      <div>
        <p className={`text-sm font-semibold ${
          conforme ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
        }`}>
          {conforme ? 'Resultados dentro do intervalo' : 'Valores fora do intervalo do fabricante'}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
          {conforme
            ? 'Westgard será avaliado no momento do registro com o histórico do lote.'
            : `${outOfRange.length} analito${outOfRange.length !== 1 ? 's' : ''} fora do low/high — ação corretiva obrigatória.`}
        </p>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CoagulacaoFormProps {
  onSave:    (data: CoagulacaoFormData) => Promise<void>;
  isSaving?: boolean;
  onCancel?: () => void;
  /** Pré-seleciona nível ao abrir (útil quando se clica "Novo run Nível I"). */
  initialNivel?: CoagNivel;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CoagulacaoForm({ onSave, isSaving = false, onCancel, initialNivel }: CoagulacaoFormProps) {
  const user = useUser();

  const [form, setForm] = useState<Partial<CoagulacaoFormData>>({
    equipamento:    'Clotimer Duo',
    frequencia:     'DIARIA',
    dataRealizacao: today(),
    nivel:          initialNivel,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof CoagulacaoFormData>(key: K, value: CoagulacaoFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function setResultado(analyte: CoagAnalyteId, raw: string) {
    const num = raw === '' ? undefined : Number(raw);
    setForm((prev) => ({
      ...prev,
      resultados: {
        ...(prev.resultados ?? { atividadeProtrombinica: 0, rni: 0, ttpa: 0 }),
        [analyte]: num ?? 0,
      },
    }));
    const key = `resultados.${analyte}`;
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  // ── Valores derivados ──────────────────────────────────────────────────────
  const ctrlDays = form.validadeControle ? daysToExpiry(form.validadeControle) : null;
  const reagDays = form.validadeReagente ? daysToExpiry(form.validadeReagente) : null;

  /** Lista de analitos fora do intervalo [low, high] do fabricante. Soft-gate. */
  const outOfRange = useMemo<CoagAnalyteId[]>(() => {
    if (!form.nivel || !form.resultados) return [];
    return COAG_ANALYTE_IDS.filter((id) => {
      const v = form.resultados?.[id];
      if (typeof v !== 'number' || Number.isNaN(v)) return false;
      const baseline = COAG_ANALYTES[id].levels[form.nivel!];
      return v < baseline.low || v > baseline.high;
    });
  }, [form.nivel, form.resultados]);

  const naoConforme    = outOfRange.length > 0;
  const requireCorrect = naoConforme && !form.acaoCorretiva?.trim();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const submitForm = { ...form, dataRealizacao: today() };
    const result = CoagulacaoFormSchema.safeParse(submitForm);

    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(
          Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? '']),
        ),
      );
      document.querySelector('[data-field-error]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Soft-gate runtime: se algum resultado está fora do intervalo e não há ação corretiva, bloquear.
    if (naoConforme && !result.data.acaoCorretiva?.trim()) {
      setErrors({ acaoCorretiva: 'Ação corretiva é obrigatória quando há valores fora do intervalo (RDC 978/2025 Art. 128).' });
      document.querySelector('#acaoCorretiva')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    await onSave(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>

      {/* ── Operador ───────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Operador</SectionTitle>
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl
                          bg-slate-50 dark:bg-white/[0.04]
                          border border-slate-200 dark:border-white/[0.07]">
            <div className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/25
                            flex items-center justify-center shrink-0
                            text-rose-600 dark:text-rose-400 text-xs font-bold select-none">
              {(user?.displayName ?? user?.email ?? 'O').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-white/80 truncate">
                {user?.displayName ?? user?.email ?? 'Operador'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
                Data e hora registradas automaticamente ao salvar
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cargo" required>Cargo profissional</Label>
              <select
                id="cargo"
                title="Cargo profissional do operador"
                value={form.cargo ?? ''}
                onChange={(e) => set('cargo', e.target.value as CoagulacaoFormData['cargo'])}
                className={errors.cargo ? INPUT_ERR : INPUT}
              >
                <option value="" disabled>Selecione o cargo…</option>
                {CARGO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <FieldError msg={errors.cargo} />
            </div>

            <div>
              <Label htmlFor="operatorDocument" required>Documento profissional</Label>
              <input
                id="operatorDocument"
                type="text"
                placeholder="ex: CRBM-MG 12345"
                value={form.operatorDocument ?? ''}
                onChange={(e) => set('operatorDocument', e.target.value)}
                className={errors.operatorDocument ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.operatorDocument} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Nível + Frequência + Equipamento ───────────────────────────────── */}
      <section>
        <SectionTitle hint="Clotimer Duo · CLSI H47-A2">Corrida</SectionTitle>
        <div className="space-y-3">
          <NivelToggle
            value={form.nivel}
            onChange={(v) => set('nivel', v)}
            error={errors.nivel}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="frequencia" required>Frequência</Label>
              <select
                id="frequencia"
                title="Frequência do controle"
                value={form.frequencia ?? ''}
                onChange={(e) => set('frequencia', e.target.value as CoagulacaoFormData['frequencia'])}
                className={errors.frequencia ? INPUT_ERR : INPUT}
              >
                <option value="DIARIA">Diária — RDC 302/2005</option>
                <option value="LOTE">Por troca de lote</option>
              </select>
              <FieldError msg={errors.frequencia} />
            </div>

            <div>
              <Label htmlFor="equipamento">Coagulômetro</Label>
              <input
                id="equipamento"
                type="text"
                disabled
                value="Clotimer Duo"
                className={`${INPUT} cursor-not-allowed`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Controle ───────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Material de Controle</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteControle" required>Lote do controle</Label>
              <input
                id="loteControle"
                type="text"
                placeholder="ex: L2024-038"
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
                placeholder="ex: Bio-Rad"
                value={form.fabricanteControle ?? ''}
                onChange={(e) => set('fabricanteControle', e.target.value)}
                className={errors.fabricanteControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.fabricanteControle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aberturaControle" required>Abertura</Label>
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
              <Label htmlFor="validadeControle" required>Validade</Label>
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
      </section>

      {/* ── Reagente ───────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Reagente (Tromboplastina / Ativador)</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteReagente" required>Lote do reagente</Label>
              <input
                id="loteReagente"
                type="text"
                placeholder="ex: R2024-112"
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
                placeholder="ex: Stago, Instrumentation Laboratory"
                value={form.fabricanteReagente ?? ''}
                onChange={(e) => set('fabricanteReagente', e.target.value)}
                className={errors.fabricanteReagente ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.fabricanteReagente} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aberturaReagente" required>Abertura</Label>
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
              <Label htmlFor="validadeReagente" required>Validade</Label>
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
      </section>

      {/* ── Calibração INR (opcional) ─────────────────────────────────────── */}
      <section>
        <SectionTitle hint="obrigatório apenas se o RNI for derivado de TP">
          Calibração RNI — opcional
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="isi">ISI do lote de tromboplastina</Label>
            <input
              id="isi"
              type="number"
              step="0.01"
              min="0"
              placeholder="ex: 1.02"
              value={form.isi ?? ''}
              onChange={(e) => set('isi', e.target.value === '' ? undefined : Number(e.target.value))}
              className={errors.isi ? INPUT_ERR : INPUT}
            />
            <FieldError msg={errors.isi} />
          </div>
          <div>
            <Label htmlFor="mnpt">MNPT do laboratório (s)</Label>
            <input
              id="mnpt"
              type="number"
              step="0.1"
              min="0"
              placeholder="ex: 11.8"
              value={form.mnpt ?? ''}
              onChange={(e) => set('mnpt', e.target.value === '' ? undefined : Number(e.target.value))}
              className={errors.mnpt ? INPUT_ERR : INPUT}
            />
            <FieldError msg={errors.mnpt} />
            <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1 ml-0.5">
              Mínimo 20 doadores saudáveis — ISTH guidelines.
            </p>
          </div>
        </div>
      </section>

      {/* ── Ambiente (opcional) ───────────────────────────────────────────── */}
      <section>
        <SectionTitle hint="opcional — registrar quando exigido pela RT">
          Ambiente
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="temperaturaAmbiente">Temperatura (°C)</Label>
            <input
              id="temperaturaAmbiente"
              type="number"
              step="0.1"
              placeholder="ex: 22.5"
              value={form.temperaturaAmbiente ?? ''}
              onChange={(e) => set('temperaturaAmbiente', e.target.value === '' ? undefined : Number(e.target.value))}
              className={errors.temperaturaAmbiente ? INPUT_ERR : INPUT}
            />
            <FieldError msg={errors.temperaturaAmbiente} />
          </div>
          <div>
            <Label htmlFor="umidadeAmbiente">Umidade relativa (%)</Label>
            <input
              id="umidadeAmbiente"
              type="number"
              step="1"
              min="0"
              max="100"
              placeholder="ex: 55"
              value={form.umidadeAmbiente ?? ''}
              onChange={(e) => set('umidadeAmbiente', e.target.value === '' ? undefined : Number(e.target.value))}
              className={errors.umidadeAmbiente ? INPUT_ERR : INPUT}
            />
            <FieldError msg={errors.umidadeAmbiente} />
          </div>
        </div>
      </section>

      {/* ── Resultados ────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle hint={form.nivel ? `baseline Nível ${form.nivel}` : 'selecione o nível primeiro'}>
          Resultados da Corrida
        </SectionTitle>

        <div className="space-y-3">
          {COAG_ANALYTE_IDS.map((id) => {
            const cfg      = COAG_ANALYTES[id];
            const baseline = form.nivel ? cfg.levels[form.nivel] : null;
            const value    = form.resultados?.[id];
            const valueStr = value !== undefined && !Number.isNaN(value) ? String(value) : '';
            const isOut    = outOfRange.includes(id);
            const hint     = baseline
              ? `esperado: ${baseline.low}–${baseline.high}${baseline.unit ? ` ${baseline.unit}` : ''}`
              : '—';
            const errMsg   = errors[`resultados.${id}`] ?? errors[id];

            return (
              <div key={id} className="grid grid-cols-[1fr_120px_90px] gap-3 items-start">
                <div className="pt-2.5">
                  <p className="text-sm font-medium text-slate-700 dark:text-white/75">{cfg.label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5">{hint}</p>
                </div>
                <div>
                  <input
                    id={`resultado-${id}`}
                    type="number"
                    step={cfg.decimals === 0 ? '1' : (1 / Math.pow(10, cfg.decimals)).toString()}
                    inputMode="decimal"
                    placeholder={baseline ? String(baseline.mean) : ''}
                    value={valueStr}
                    onChange={(e) => setResultado(id, e.target.value)}
                    className={errMsg ? INPUT_ERR : (isOut ? INPUT_OUT_OF_RANGE : INPUT)}
                  />
                  <FieldError msg={errMsg} />
                </div>
                <div className="pt-2.5 text-xs text-slate-400 dark:text-white/30 truncate">
                  {baseline?.unit ?? '—'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Derived conformidade badge */}
        {form.nivel && form.resultados && Object.keys(form.resultados).length >= 3 && (
          <div className="mt-4">
            <RangeBadge outOfRange={outOfRange} />
          </div>
        )}
      </section>

      {/* ── Ação corretiva — condicional soft ─────────────────────────────── */}
      {(naoConforme || form.acaoCorretiva) && (
        <section>
          <SectionTitle>Ação corretiva</SectionTitle>
          <div>
            <Label htmlFor="acaoCorretiva" required={naoConforme}>
              Descreva a ação corretiva tomada — RDC 978/2025 Art. 128
            </Label>
            <textarea
              id="acaoCorretiva"
              rows={3}
              placeholder="Ex: Repetida a dosagem com nova amostra de controle; valor dentro do intervalo na segunda corrida…"
              value={form.acaoCorretiva ?? ''}
              onChange={(e) => set('acaoCorretiva', e.target.value)}
              className={[
                errors.acaoCorretiva ? INPUT_ERR : INPUT,
                'resize-y min-h-[72px]',
                requireCorrect ? 'border-amber-400/60' : '',
              ].join(' ')}
            />
            <FieldError msg={errors.acaoCorretiva} />
          </div>
        </section>
      )}

      {/* ── NOTIVISA — aparece quando há não conformidade ─────────────────── */}
      {naoConforme && (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.04] p-5">
          <SectionTitle hint="RDC 67/2009 · RDC 551/2021">
            Notificação sanitária — NOTIVISA
          </SectionTitle>
          <p className="text-xs text-slate-600 dark:text-white/50 mb-4">
            Classifique a ocorrência. Queixa técnica para desvio de produto sem dano;
            evento adverso quando houve impacto em conduta clínica. Pode ser dispensada
            se a causa for operacional — justifique para auditoria.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="notivisaTipo">Tipo</Label>
                <select
                  id="notivisaTipo"
                  value={form.notivisaTipo ?? ''}
                  onChange={(e) => set(
                    'notivisaTipo',
                    e.target.value === ''
                      ? undefined
                      : (e.target.value as CoagulacaoFormData['notivisaTipo']),
                  )}
                  className={errors.notivisaTipo ? INPUT_ERR : INPUT}
                >
                  <option value="">— selecione —</option>
                  <option value="queixa_tecnica">Queixa técnica</option>
                  <option value="evento_adverso">Evento adverso</option>
                </select>
                <FieldError msg={errors.notivisaTipo} />
              </div>

              <div>
                <Label htmlFor="notivisaStatus">Status</Label>
                <select
                  id="notivisaStatus"
                  value={form.notivisaStatus ?? ''}
                  onChange={(e) => set(
                    'notivisaStatus',
                    e.target.value === ''
                      ? undefined
                      : (e.target.value as CoagulacaoFormData['notivisaStatus']),
                  )}
                  className={errors.notivisaStatus ? INPUT_ERR : INPUT}
                >
                  <option value="">— selecione —</option>
                  <option value="pendente">Pendente</option>
                  <option value="notificado">Notificado</option>
                  <option value="dispensado">Dispensado</option>
                </select>
                <FieldError msg={errors.notivisaStatus} />
              </div>
            </div>

            {form.notivisaStatus === 'notificado' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="notivisaProtocolo" required>Protocolo NOTIVISA</Label>
                  <input
                    id="notivisaProtocolo"
                    type="text"
                    placeholder="ex: 2026.123456"
                    value={form.notivisaProtocolo ?? ''}
                    onChange={(e) => set('notivisaProtocolo', e.target.value)}
                    className={errors.notivisaProtocolo ? INPUT_ERR : INPUT}
                  />
                  <FieldError msg={errors.notivisaProtocolo} />
                </div>
                <div>
                  <Label htmlFor="notivisaDataEnvio" required>Data de envio</Label>
                  <input
                    id="notivisaDataEnvio"
                    type="date"
                    title="Data de envio ao NOTIVISA"
                    value={form.notivisaDataEnvio ?? ''}
                    onChange={(e) => set('notivisaDataEnvio', e.target.value)}
                    className={errors.notivisaDataEnvio ? INPUT_ERR : INPUT}
                  />
                  <FieldError msg={errors.notivisaDataEnvio} />
                </div>
              </div>
            )}

            {form.notivisaStatus === 'dispensado' && (
              <div>
                <Label htmlFor="notivisaJustificativa" required>Justificativa</Label>
                <textarea
                  id="notivisaJustificativa"
                  rows={3}
                  placeholder="Causa raiz operacional — ex: erro de calibração do pipetador, corrigido e controle repetido conforme…"
                  value={form.notivisaJustificativa ?? ''}
                  onChange={(e) => set('notivisaJustificativa', e.target.value)}
                  className={[
                    errors.notivisaJustificativa ? INPUT_ERR : INPUT,
                    'resize-y min-h-[72px]',
                  ].join(' ')}
                />
                <FieldError msg={errors.notivisaJustificativa} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Submit bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 h-10 rounded-xl text-sm font-medium text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className={[
            'ml-auto flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold text-white transition-all shadow-lg',
            requireCorrect
              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
              : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20',
            'disabled:opacity-50 disabled:cursor-wait',
          ].join(' ')}
        >
          {isSaving ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Salvando…
            </>
          ) : (
            <>Registrar corrida</>
          )}
        </button>
      </div>
    </form>
  );
}
