import React, { useState } from 'react';
import { CIQImunoFormSchema, daysToExpiry } from './CIQImunoForm.schema';
import type { CIQImunoFormData } from './CIQImunoForm.schema';
import { useUser } from '../../../store/useAuthStore';
import { useCIQTestTypes } from '../hooks/useCIQTestTypes';
import { CIQTestTypeManager } from './CIQTestTypeManager';
import { InsumoPicker } from '../../insumos/components/InsumoPicker';
import type { Insumo } from '../../insumos/types/Insumo';

// ─── Icon ─────────────────────────────────────────────────────────────────────

function SettingsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6.5 1v1.2M6.5 10.8V12M1 6.5h1.2M10.8 6.5H12M2.4 2.4l.85.85M9.75 9.75l.85.85M2.4 10.6l.85-.85M9.75 3.25l.85-.85"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const CARGO_OPTIONS: { value: CIQImunoFormData['cargo']; label: string }[] = [
  { value: 'biomedico', label: 'Biomédico(a)' },
  { value: 'tecnico', label: 'Técnico(a) de Laboratório' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
];

const today = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
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
  'border-red-400/60 dark:border-red-400/40',
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
    >
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
function RNRToggle({
  id,
  value,
  onChange,
  error,
}: {
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
    <div
      className={[
        'flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mt-1.5',
        expired
          ? 'bg-red-500/[0.07] border-red-400/20 text-red-500 dark:text-red-400'
          : 'bg-amber-500/[0.07] border-amber-500/20 text-amber-600 dark:text-amber-400',
      ].join(' ')}
    >
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

// ─── Approval Badge ───────────────────────────────────────────────────────────

/** Aprovação derivada automaticamente — resultadoObtido === resultadoEsperado */
function ApprovalBadge({ conforme }: { conforme: boolean }) {
  return (
    <div
      className={[
        'flex items-center gap-3 px-3.5 py-3 rounded-xl border',
        conforme
          ? 'bg-emerald-500/[0.07] border-emerald-500/25'
          : 'bg-red-500/[0.07] border-red-400/20',
      ].join(' ')}
    >
      <div
        className={[
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
          conforme
            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-500/15 text-red-600 dark:text-red-400',
        ].join(' ')}
      >
        {conforme ? '✓' : '✕'}
      </div>
      <div>
        <p
          className={`text-sm font-semibold ${conforme ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {conforme ? 'Aprovado' : 'Não aprovado'}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
          {conforme
            ? 'Resultado conforme o esperado pelo fabricante.'
            : 'Resultado divergente — ação corretiva obrigatória (RDC 978/2025 Art.128).'}
        </p>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CIQImunoFormProps {
  onSave: (data: CIQImunoFormData) => Promise<void>;
  isSaving?: boolean;
  onCancel?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQImunoForm({ onSave, isSaving = false, onCancel }: CIQImunoFormProps) {
  const user = useUser();
  const {
    types: testTypes,
    loading: typesLoading,
    error: typesError,
    addType,
    renameType,
    removeType,
  } = useCIQTestTypes();
  const [showManager, setShowManager] = useState(false);

  const [form, setForm] = useState<Partial<CIQImunoFormData>>({
    resultadoEsperado: 'R',
    dataRealizacao: today(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Seleção opcional de controle cadastrado.
  const [controleInsumoId, setControleInsumoId] = useState<string | null>(null);

  function toIsoDate(ts: { toDate: () => Date } | null): string {
    if (!ts) return '';
    const d = ts.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function applyControleInsumo(i: Insumo | null) {
    setControleInsumoId(i?.id ?? null);
    if (!i) return;
    setForm((prev) => ({
      ...prev,
      loteControle: i.lote,
      fabricanteControle: i.fabricante,
      aberturaControle: toIsoDate(i.dataAbertura),
      validadeControle: toIsoDate(i.validade),
    }));
  }

  function set<K extends keyof CIQImunoFormData>(key: K, value: CIQImunoFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Atualiza dataRealizacao para a data atual no momento do submit
    const submitForm = { ...form, dataRealizacao: today() };
    const result = CIQImunoFormSchema.safeParse(submitForm);

    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ''])));
      const firstErrEl = document.querySelector('[data-field-error]');
      firstErrEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    await onSave(result.data);
  }

  const ctrlDays = form.validadeControle ? daysToExpiry(form.validadeControle) : null;
  const reagDays = form.validadeReagente ? daysToExpiry(form.validadeReagente) : null;
  const naoConforme =
    form.resultadoObtido !== undefined &&
    form.resultadoEsperado !== undefined &&
    form.resultadoObtido !== form.resultadoEsperado;
  const aprovacaoDerived =
    form.resultadoObtido !== undefined && form.resultadoEsperado !== undefined;

  // Data de hoje formatada para exibição
  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {/* ── Operador ───────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Operador</SectionTitle>
        <div className="space-y-3">
          {/* Responsável — read-only, vem do usuário logado */}
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl
                          bg-slate-50 dark:bg-white/[0.04]
                          border border-slate-200 dark:border-white/[0.07]"
          >
            <div
              className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25
                            flex items-center justify-center shrink-0
                            text-emerald-600 dark:text-emerald-400 text-xs font-bold select-none"
            >
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

          <div>
            <Label htmlFor="cargo" required>
              Cargo profissional
            </Label>
            <select
              id="cargo"
              title="Cargo profissional do operador"
              value={form.cargo ?? ''}
              onChange={(e) => set('cargo', e.target.value as CIQImunoFormData['cargo'])}
              className={errors.cargo ? INPUT_ERR : INPUT}
            >
              <option value="" disabled>
                Selecione o cargo…
              </option>
              {CARGO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldError msg={errors.cargo} />
          </div>
        </div>
      </div>

      {/* ── Tipo de Teste ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
            Tipo de Teste
          </p>
          <button
            type="button"
            onClick={() => setShowManager(true)}
            disabled={typesLoading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]
                       text-slate-400 dark:text-white/30
                       hover:text-slate-700 dark:hover:text-white/60
                       hover:bg-slate-100 dark:hover:bg-white/[0.06]
                       border border-transparent hover:border-slate-200 dark:hover:border-white/[0.08]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all -mt-1"
            title={typesLoading ? 'Aguarde o carregamento…' : 'Gerenciar tipos de teste'}
          >
            <SettingsIcon />
            Gerenciar
          </button>
        </div>
        <div>
          <Label htmlFor="testType" required>
            Imunoensaio
          </Label>
          {typesError && !typesLoading && (
            <div
              className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mb-2
                            bg-red-500/[0.07] border-red-500/20 text-red-600 dark:text-red-400"
            >
              <span className="mt-px shrink-0">⚠</span>
              <span>Não foi possível carregar os tipos de teste: {typesError}</span>
            </div>
          )}
          {typesLoading ? (
            <div
              className={`${INPUT} flex items-center gap-2 text-slate-400 dark:text-white/25 cursor-default`}
            >
              <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.25"
                />
                <path
                  d="M22 12a10 10 0 00-10-10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Carregando tipos de teste…
            </div>
          ) : testTypes.length === 0 ? (
            <div
              className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl border text-xs mt-0.5
                            bg-amber-500/[0.07] border-amber-500/20 text-amber-600 dark:text-amber-400"
            >
              <span className="mt-px shrink-0">⚠</span>
              <span>
                Nenhum tipo de teste cadastrado.{' '}
                <button
                  type="button"
                  onClick={() => setShowManager(true)}
                  className="underline font-medium"
                >
                  Cadastre um aqui
                </button>{' '}
                para continuar.
              </span>
            </div>
          ) : (
            <select
              id="testType"
              title="Tipo de imunoensaio"
              value={form.testType ?? ''}
              onChange={(e) => set('testType', e.target.value)}
              className={errors.testType ? INPUT_ERR : INPUT}
            >
              <option value="" disabled>
                Selecione o tipo de teste…
              </option>
              {testTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          <FieldError msg={errors.testType} />
        </div>
      </div>

      {/* ── Manager Modal ──────────────────────────────────────────────────── */}
      {showManager && (
        <CIQTestTypeManager
          types={testTypes}
          addType={addType}
          renameType={renameType}
          removeType={removeType}
          onClose={() => setShowManager(false)}
        />
      )}

      {/* ── Controle ───────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Controle Interno</SectionTitle>
        <div className="mb-3">
          <InsumoPicker
            tipo="controle"
            modulo="imunologia"
            value={controleInsumoId}
            onSelect={applyControleInsumo}
            placeholder="Selecionar controle cadastrado (opcional — auto-preenche abaixo)"
            ariaLabel="Selecionar controle cadastrado"
          />
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteControle" required>
                Lote do controle
              </Label>
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
              <Label htmlFor="fabricanteControle" required>
                Fabricante
              </Label>
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
              <Label htmlFor="aberturaControle" required>
                Abertura do controle
              </Label>
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
              <Label htmlFor="validadeControle" required>
                Validade do controle
              </Label>
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
              <Label htmlFor="loteReagente" required>
                Lote do reagente
              </Label>
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
              <Label htmlFor="fabricanteReagente" required>
                Fabricante
              </Label>
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
            <Label htmlFor="reagenteStatus" required>
              Status na abertura do kit
            </Label>
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
              <Label htmlFor="aberturaReagente" required>
                Abertura do reagente
              </Label>
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
              <Label htmlFor="validadeReagente" required>
                Validade do reagente
              </Label>
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
            <Label htmlFor="resultadoEsperado" required>
              Resultado esperado (fabricante)
            </Label>
            <RNRToggle
              id="resultadoEsperado"
              value={form.resultadoEsperado}
              onChange={(v) => set('resultadoEsperado', v)}
              error={errors.resultadoEsperado}
            />
          </div>

          <div>
            <Label htmlFor="resultadoObtido" required>
              Resultado obtido
            </Label>
            <RNRToggle
              id="resultadoObtido"
              value={form.resultadoObtido}
              onChange={(v) => set('resultadoObtido', v)}
              error={errors.resultadoObtido}
            />
          </div>

          {/* Aprovação — derivada automaticamente, separada do resultado */}
          {aprovacaoDerived && (
            <div>
              <Label htmlFor="aprovacao">Aprovação</Label>
              <ApprovalBadge conforme={!naoConforme} />
            </div>
          )}

          {/* Data de realização — automática, não editável */}
          <div>
            <Label htmlFor="dataRealizacao">Data de realização</Label>
            <div
              id="dataRealizacao"
              className="w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2
                         bg-slate-50 dark:bg-white/[0.04]
                         border border-slate-200 dark:border-white/[0.07]
                         cursor-default select-none"
            >
              <span className="text-sm text-slate-700 dark:text-white/65">{todayFormatted}</span>
              <span className="text-xs text-slate-400 dark:text-white/25">
                · hora exata capturada ao registrar
              </span>
            </div>
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

      {/* ── Notificação sanitária — só aparece em não conformidade ─────────── */}
      {naoConforme && (
        <div>
          <SectionTitle>Notificação Sanitária</SectionTitle>
          <p className="text-[11px] text-slate-500 dark:text-white/40 -mt-2 mb-4 leading-relaxed">
            Queixas técnicas e eventos adversos de produtos para saúde devem ser notificados ao
            NOTIVISA (RDC 67/2009 + RDC 551/2021). Prazo: até 72h para eventos graves.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notivisaTipo">Tipo de notificação</Label>
              <select
                id="notivisaTipo"
                value={form.notivisaTipo ?? ''}
                onChange={(e) =>
                  set(
                    'notivisaTipo',
                    (e.target.value || undefined) as
                      | 'queixa_tecnica'
                      | 'evento_adverso'
                      | undefined,
                  )
                }
                className={INPUT}
              >
                <option value="">— selecione —</option>
                <option value="queixa_tecnica">
                  Queixa Técnica (desvio de qualidade do produto)
                </option>
                <option value="evento_adverso">Evento Adverso (impacto clínico)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="notivisaStatus">Status da notificação</Label>
              <select
                id="notivisaStatus"
                value={form.notivisaStatus ?? ''}
                onChange={(e) =>
                  set(
                    'notivisaStatus',
                    (e.target.value || undefined) as
                      | 'pendente'
                      | 'notificado'
                      | 'dispensado'
                      | undefined,
                  )
                }
                className={INPUT}
              >
                <option value="">— selecione —</option>
                <option value="pendente">Pendente — investigação em andamento</option>
                <option value="notificado">Notificado — protocolo emitido</option>
                <option value="dispensado">
                  Dispensado — causa operacional, não defeito de produto
                </option>
              </select>
            </div>

            {form.notivisaStatus === 'notificado' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="notivisaProtocolo" required>
                    Protocolo NOTIVISA
                  </Label>
                  <input
                    id="notivisaProtocolo"
                    type="text"
                    placeholder="ex: 2026.01.0001234"
                    value={form.notivisaProtocolo ?? ''}
                    onChange={(e) => set('notivisaProtocolo', e.target.value || undefined)}
                    className={errors.notivisaProtocolo ? INPUT_ERR : INPUT}
                  />
                  <FieldError msg={errors.notivisaProtocolo} />
                </div>
                <div>
                  <Label htmlFor="notivisaDataEnvio" required>
                    Data de envio
                  </Label>
                  <input
                    id="notivisaDataEnvio"
                    type="date"
                    value={form.notivisaDataEnvio ?? ''}
                    onChange={(e) => set('notivisaDataEnvio', e.target.value || undefined)}
                    className={errors.notivisaDataEnvio ? INPUT_ERR : INPUT}
                  />
                  <FieldError msg={errors.notivisaDataEnvio} />
                </div>
              </div>
            )}

            {form.notivisaStatus === 'dispensado' && (
              <div>
                <Label htmlFor="notivisaJustificativa" required>
                  Justificativa da dispensa
                </Label>
                <textarea
                  id="notivisaJustificativa"
                  rows={3}
                  placeholder="ex: Causa raiz identificada como erro de armazenamento (quebra de cadeia fria local); lote do kit reprocessado sem falhas."
                  value={form.notivisaJustificativa ?? ''}
                  onChange={(e) => set('notivisaJustificativa', e.target.value || undefined)}
                  className={[
                    errors.notivisaJustificativa ? INPUT_ERR : INPUT,
                    'resize-none leading-relaxed',
                  ].join(' ')}
                />
                <FieldError msg={errors.notivisaJustificativa} />
              </div>
            )}
          </div>
        </div>
      )}

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
              onChange={(e) =>
                set('temperaturaAmbiente', e.target.value ? Number(e.target.value) : undefined)
              }
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
