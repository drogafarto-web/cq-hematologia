import React, { useState, useMemo } from 'react';
import { CoagulacaoFormSchema, daysToExpiry } from './CoagulacaoForm.schema';
import type { CoagulacaoFormData } from './CoagulacaoForm.schema';
import { useUser } from '../../../store/useAuthStore';
import { COAG_ANALYTES, EQUIP_ANALYTES } from '../CoagAnalyteConfig';
import { COAG_NIVEIS, type CoagAnalyteId, type CoagNivel } from '../types/_shared_refs';
import { RegulatoryReferencesBar } from '../../insumos/components/RegulatoryReferencesBar';
import { ConferenciaInsumoAtivo } from '../../insumos/components/ConferenciaInsumoAtivo';
import { OverrideModal } from '../../insumos/components/OverrideModal';
import { useInsumoFlowGuard } from '../../insumos/hooks/useInsumoFlowGuard';
import { EquipamentoSelector } from '../../equipamentos/components/EquipamentoSelector';
import { buildEquipamentoSnapshot } from '../../equipamentos/types/Equipamento';
import type { Equipamento } from '../../equipamentos/types/Equipamento';
import { useAppStore } from '../../../store/useAppStore';
import type { SaveCoagRunOptions } from '../hooks/useSaveCoagRun';
import type { CoagulacaoLot } from '../types/Coagulacao';
import { useCoagLots } from '../hooks/useCoagLots';
import { formatCoagNivelDetail, formatCoagNivelLabel } from '../utils/coagNivelLabels';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARGO_OPTIONS: { value: CoagulacaoFormData['cargo']; label: string }[] = [
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

/** Badge de nível — apenas informativo, herdado do lote */
function NivelBadge({ value }: { value: CoagNivel }) {
  const label = value === 'I' ? 'I — Normal' : 'II — Patológico';
  const sub =
    value === 'I'
      ? 'valores dentro do intervalo terapêutico'
      : 'anticoagulado / protrombótico';
  return (
    <div
      className={[
        'py-3 px-3.5 rounded-xl border text-left',
        value === 'I'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
          : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
      ].join(' ')}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-[10px] mt-0.5 opacity-60">{sub}</p>
    </div>
  );
}

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

/** Aprovação derivada em tempo real — baseada em intervalo low/high do fabricante. */
function RangeBadge({ outOfRange }: { outOfRange: CoagAnalyteId[] }) {
  const conforme = outOfRange.length === 0;
  return (
    <div
      className={[
        'flex items-center gap-3 px-3.5 py-3 rounded-xl border',
        conforme
          ? 'bg-emerald-500/[0.07] border-emerald-500/25'
          : 'bg-amber-500/[0.07] border-amber-500/25',
      ].join(' ')}
    >
      <div
        className={[
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
          conforme
            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
        ].join(' ')}
      >
        {conforme ? '✓' : '!'}
      </div>
      <div>
        <p
          className={`text-sm font-semibold ${
            conforme
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-700 dark:text-amber-400'
          }`}
        >
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
  /**
   * Callback de save. Recebe `data` validado + `options` com `insumosSnapshot`
   * e flags de override (Fase B1-etapa2) derivados pelo `useInsumoFlowGuard`.
   * Parent pode ignorar `options` se ainda não consome (backward-compat).
   */
  onSave: (data: CoagulacaoFormData, options?: SaveCoagRunOptions) => Promise<void>;
  isSaving?: boolean;
  onCancel?: () => void;
  /** Pré-seleciona nível ao abrir (útil quando se clica "Novo run Nível I"). */
  initialNivel?: CoagNivel;
  /**
   * Fase 6 (2026-04-25) — Pré-fill do form a partir de um lote vinculado à
   * bancada. Quando passado, os campos identificadores (nível, lote, datas)
   * são pré-preenchidos e bloqueados.
   */
  prefillFromLot?: CoagulacaoLot;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CoagulacaoForm({
  onSave,
  isSaving = false,
  onCancel,
  initialNivel,
  prefillFromLot,
}: CoagulacaoFormProps) {
  const user = useUser();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  // ── Fase D (2026-04-21 — 2º turno) — Equipamento da corrida ────────────
  const [equipamentoId, setEquipamentoId] = useState<string | null>(null);
  const [equipamentoSel, setEquipamentoSel] = useState<Equipamento | null>(null);

  // ── Fase B1-etapa2 — Conferência obrigatória do setup ────────────────────
  // Coagulação: reagente TP + reagente TTPA + controle obrigatórios por corrida.
  const insumoGuard = useInsumoFlowGuard({
    module: 'coagulacao',
    requiredSlots: { reagente: true, reagenteTtpa: true, controle: true },
    equipamentoId,
  });

  const [form, setForm] = useState<Partial<CoagulacaoFormData>>(() => ({
    equipamento: 'Clotimer Duo',
    frequencia: 'DIARIA',
    dataRealizacao: today(),
    nivel: initialNivel,
    ...(prefillFromLot && {
      nivel: prefillFromLot.nivel,
      loteControle: prefillFromLot.loteControle,
      fabricanteControle: prefillFromLot.fabricanteControle,
      aberturaControle: prefillFromLot.aberturaControle,
      validadeControle: prefillFromLot.validadeControle,
    }),
  }));

  // Fase 6 — quando o form é aberto a partir de um lote vinculado, identificadores ficam bloqueados.
  const lockedFromLot = !!prefillFromLot;

  // ── Determinação se o lote é novo para exibir campos de Média/DP customizados
  const { lots: existingLots } = useCoagLots(form.nivel);
  const isNewLot = useMemo(() => {
    if (lockedFromLot) return false;
    const currentLote = form.loteControle?.trim().toLowerCase();
    if (!form.nivel || !currentLote) return false;
    const exists = existingLots.some(
      (l) => l.nivel === form.nivel && l.loteControle.trim().toLowerCase() === currentLote
    );
    return !exists;
  }, [form.nivel, form.loteControle, existingLots, lockedFromLot]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toIsoDate(ts: { toDate: () => Date } | null): string {
    if (!ts) return '';
    const d = ts.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Sincroniza os campos do form com os insumos ativos do EquipmentSetup
  // sempre que mudarem — operador não digita mais manualmente. Campos ficam
  // readonly na UI.
  // setState-in-effect justificado: espelhar mudança de EquipmentSetup vindo
  // de subscription externa (Firestore). Mesmo pattern usado por `useInsumos`
  // pra snapshots em tempo real.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    const reagente = insumoGuard.reagente;
    if (!reagente) return;
    setForm((prev) => ({
      ...prev,
      loteReagente: reagente.lote,
      fabricanteReagente: reagente.fabricante,
      aberturaReagente: toIsoDate(reagente.dataAbertura),
      validadeReagente: toIsoDate(reagente.validade),
    }));
  }, [insumoGuard.reagente]);

  React.useEffect(() => {
    const controle = insumoGuard.controle;
    if (!controle) return;
    setForm((prev) => ({
      ...prev,
      loteControle: controle.lote,
      fabricanteControle: controle.fabricante,
      aberturaControle: toIsoDate(controle.dataAbertura),
      validadeControle: toIsoDate(controle.validade),
    }));
  }, [insumoGuard.controle]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function set<K extends keyof CoagulacaoFormData>(key: K, value: CoagulacaoFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
  }

  function setResultado(analyte: CoagAnalyteId, raw: string) {
    const num = raw === '' ? undefined : Number(raw);
    setForm((prev) => ({
      ...prev,
      resultados: {
        ...(prev.resultados ?? {}),
        [analyte]: num ?? 0,
      },
    }));
    const key = `resultados.${analyte}`;
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
  }

  // ── Valores derivados ──────────────────────────────────────────────────────
  const ctrlDays = form.validadeControle ? daysToExpiry(form.validadeControle) : null;
  const reagDays = form.validadeReagente ? daysToExpiry(form.validadeReagente) : null;

  /** Analitos suportados pelo equipamento selecionado. */
  const activeAnalytes = useMemo<CoagAnalyteId[]>(() => {
    return [...(EQUIP_ANALYTES[form.equipamento ?? 'Clotimer Duo'] ?? [])];
  }, [form.equipamento]);

  /** Lista de analitos fora do intervalo [low, high] do fabricante. Soft-gate. */
  const outOfRange = useMemo<CoagAnalyteId[]>(() => {
    if (!form.nivel || !form.resultados) return [];
    return activeAnalytes.filter((id) => {
      const v = form.resultados?.[id];
      if (typeof v !== 'number' || Number.isNaN(v)) return false;
      const baseline = COAG_ANALYTES[id]?.levels[form.nivel!];
      if (!baseline) return false;
      return v < baseline.low || v > baseline.high;
    });
  }, [form.nivel, form.resultados, activeAnalytes]);

  const naoConforme = outOfRange.length > 0;
  const requireCorrect = naoConforme && !form.acaoCorretiva?.trim();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanMean: Record<string, number> = {};
    const cleanSd: Record<string, number> = {};
    if (form.mean) {
      for (const [k, v] of Object.entries(form.mean)) {
        if (typeof v === 'number' && !Number.isNaN(v)) {
          cleanMean[k] = v;
        }
      }
    }
    if (form.sd) {
      for (const [k, v] of Object.entries(form.sd)) {
        if (typeof v === 'number' && !Number.isNaN(v)) {
          cleanSd[k] = v;
        }
      }
    }

    const submitForm = {
      ...form,
      dataRealizacao: today(),
      mean: Object.keys(cleanMean).length > 0 ? cleanMean : undefined,
      sd: Object.keys(cleanSd).length > 0 ? cleanSd : undefined,
    };
    const result = CoagulacaoFormSchema.safeParse(submitForm);

    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ''])));
      document
        .querySelector('[data-field-error]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Soft-gate runtime: se algum resultado está fora do intervalo e não há ação corretiva, bloquear.
    if (naoConforme && !result.data.acaoCorretiva?.trim()) {
      setErrors({
        acaoCorretiva:
          'Ação corretiva é obrigatória quando há valores fora do intervalo (RDC 978/2025 Art. 128).',
      });
      document
        .querySelector('#acaoCorretiva')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Fase D: exige equipamento selecionado antes da conferência.
    if (!equipamentoId || !equipamentoSel) {
      setErrors({
        equipamento:
          'Selecione o equipamento em que a corrida está sendo feita.',
      });
      return;
    }

    // Fase B1-etapa2 — conferência + override auditado.
    // prepareForSave bloqueia se: setup incompleto, conferência não feita,
    // ou se override modal é cancelado pelo usuário. Retorna flags para grafar
    // no doc do run.
    const guardFlags = await insumoGuard.prepareForSave();
    if (!guardFlags) {
      setErrors({
        insumos:
          'Conferência obrigatória do setup. Configure os insumos e confirme antes de salvar.',
      });
      return;
    }

    setErrors({});
    const snapshot = insumoGuard.getSnapshots();
    const saveOptions: SaveCoagRunOptions = {
      insumosSnapshot: snapshot,
      equipamentoId,
      equipamentoSnapshot: buildEquipamentoSnapshot(equipamentoSel),
      ...(guardFlags.insumoVencidoOverride && { insumoVencidoOverride: true }),
      ...(guardFlags.qcNaoValidado && { qcNaoValidado: true }),
      ...(guardFlags.overrideMotivo && { overrideMotivo: guardFlags.overrideMotivo }),
    };
    await onSave(result.data, saveOptions);

    // afterSave: incrementa runCount dos insumos + limpa qcValidationRequired
    // se a corrida foi conforme. Fire-and-forget — falha não reverte save.
    void insumoGuard.afterSave({ runId: '', wasConforme: !naoConforme });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {/* ── Banner: corrida iniciada de lote vinculado (Fase 6) ────────────── */}
      {prefillFromLot && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
            prefillFromLot.setupType === 'principal'
              ? 'bg-emerald-50 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-blue-50 dark:bg-blue-500/[0.06] border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400'
          }`}
        >
          <span className="mt-0.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path
                d="M6.5 1.5l3 3-1 1 1.5 1.5-1 1L7 6.5l-3 3v-2L6.5 5l-1-1 1-1z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="text-xs leading-relaxed">
            <p className="font-semibold">
              Corrida vinculada · {formatCoagNivelLabel(prefillFromLot.nivel)} · Lote{' '}
              {prefillFromLot.loteControle}
            </p>
            <p className="opacity-80 mt-0.5">
              {prefillFromLot.setupType === 'principal'
                ? 'Setup oficial em rotina. Nível, lote e datas estão bloqueados.'
                : 'Lote em validação paralela.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Operador ───────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Operador</SectionTitle>
        <div className="space-y-3">
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl
                          bg-slate-50 dark:bg-white/[0.04]
                          border border-slate-200 dark:border-white/[0.07]"
          >
            <div
              className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/25
                            flex items-center justify-center shrink-0
                            text-rose-600 dark:text-rose-400 text-xs font-bold select-none"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cargo" required>
                Cargo profissional
              </Label>
              <select
                id="cargo"
                title="Cargo profissional do operador"
                value={form.cargo ?? ''}
                onChange={(e) => set('cargo', e.target.value as CoagulacaoFormData['cargo'])}
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

            <div>
              <Label htmlFor="operatorDocument" required>
                Documento profissional
              </Label>
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

      {/* ─ Nível (selecionável quando não vinculado) + Frequência + Equipamento ── */}
      <section>
        <SectionTitle hint="Clotimer Duo · CLSI H47-A2">Corrida</SectionTitle>
        <div className="space-y-3">
          {/* Seletor de nível — obrigatório */}
          {!lockedFromLot ? (
            <div className="grid grid-cols-2 gap-3">
              {COAG_NIVEIS.map((n) => {
                const active = form.nivel === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set('nivel', n)}
                    className={[
                      'py-3 px-3.5 rounded-xl border text-left transition-all',
                      active
                        ? n === 'I'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                          : 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.09] text-slate-500 dark:text-white/40 hover:border-slate-300 dark:hover:border-white/[0.15]',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold">
                      {formatCoagNivelDetail(n)}
                    </p>
                    <p className="text-[10px] mt-0.5 opacity-60">
                      {n === 'I'
                        ? 'valores dentro do intervalo terapêutico'
                        : 'anticoagulado / protrombótico'}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <NivelBadge value={form.nivel!} />
          )}
          {errors.nivel && <FieldError msg={errors.nivel} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="frequencia" required>
                Frequência
              </Label>
              <select
                id="frequencia"
                title="Frequência do controle"
                value={form.frequencia ?? ''}
                onChange={(e) =>
                  set('frequencia', e.target.value as CoagulacaoFormData['frequencia'])
                }
                className={errors.frequencia ? INPUT_ERR : INPUT}
              >
                <option value="DIARIA">Diária</option>
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

          <RegulatoryReferencesBar module="coagulacao" />
        </div>
      </section>

      {/* ── Equipamento da corrida (Fase D) ───────────────────────────────── */}
      <section>
        <SectionTitle>Equipamento</SectionTitle>
        <EquipamentoSelector
          module="coagulacao"
          value={equipamentoId}
          onChange={(id, eq) => {
            setEquipamentoId(id);
            setEquipamentoSel(eq);
            if (errors.equipamento) {
              setErrors((prev) => {
                const n = { ...prev };
                delete n.equipamento;
                return n;
              });
            }
          }}
          required
        />
        {errors.equipamento && <FieldError msg={errors.equipamento} />}
      </section>

      {/* ── Conferência de insumos (Fase B1-etapa2) ───────────────────────── */}
      <section>
        <SectionTitle>Insumos em uso</SectionTitle>
        <ConferenciaInsumoAtivo
          module="coagulacao"
          requiredSlots={{ reagente: true, reagenteTtpa: true, controle: true }}
          equipamentoId={equipamentoId}
          confirmed={insumoGuard.confirmed}
          onConfirmedChange={insumoGuard.setConfirmed}
          onConfigurarSetup={() => setCurrentView('insumos')}
        />
        {errors.insumos && <FieldError msg={errors.insumos} />}
      </section>

      {/* ── Controle ───────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle hint="preenchido pelo setup">Material de Controle</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteControle" required>
                Lote do controle
              </Label>
              <input
                id="loteControle"
                type="text"
                placeholder="ex: L2024-038"
                value={form.loteControle ?? ''}
                onChange={(e) => set('loteControle', e.target.value)}
                disabled={lockedFromLot}
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
                placeholder="ex: Bio-Rad"
                value={form.fabricanteControle ?? ''}
                onChange={(e) => set('fabricanteControle', e.target.value)}
                disabled={lockedFromLot}
                className={errors.fabricanteControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.fabricanteControle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="aberturaControle" required>
                Abertura
              </Label>
              <input
                id="aberturaControle"
                type="date"
                title="Data de abertura do controle"
                value={form.aberturaControle ?? ''}
                onChange={(e) => set('aberturaControle', e.target.value)}
                disabled={lockedFromLot}
                className={errors.aberturaControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.aberturaControle} />
            </div>
            <div>
              <Label htmlFor="validadeControle" required>
                Validade
              </Label>
              <input
                id="validadeControle"
                type="date"
                title="Data de validade do controle"
                value={form.validadeControle ?? ''}
                onChange={(e) => set('validadeControle', e.target.value)}
                disabled={lockedFromLot}
                className={errors.validadeControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.validadeControle} />
              {ctrlDays !== null && <ExpiryWarning label="Controle" days={ctrlDays} />}
            </div>
          </div>
        </div>
      </section>

      {/* ── Calibração da Bula do Novo Lote (Variação Mensal PNCQ / RDC 978 Art. 128) ── */}
      {isNewLot && (
        <section className="rounded-xl border border-violet-500/25 bg-violet-500/[0.02] p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0 text-violet-600 dark:text-violet-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white/90">
                Lote novo detectado: Calibração de Bula (Opcional)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
                Altere os valores de Média e Desvio Padrão para corresponder à bula do seu lote mensal PNCQ/fabricante. Deixe em branco para usar os padrões estáticos da plataforma.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {activeAnalytes.map((analyteId) => {
              const cfg = COAG_ANALYTES[analyteId];
              if (!cfg) return null;
              const baseline = cfg.levels[form.nivel ?? 'I'];
              return (
                <div key={analyteId} className="rounded-lg border border-slate-100 dark:border-white/[0.04] bg-white dark:bg-[#080B10] p-3 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
                    {cfg.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-white/45 mb-1">Média (x̄)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={`Padrão: ${baseline?.mean}`}
                        value={form.mean?.[analyteId] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Number(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            mean: {
                              ...(prev.mean ?? {}),
                              [analyteId]: val as any,
                            },
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white/90"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-white/45 mb-1">DP (SD)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={`Padrão: ${baseline?.sd}`}
                        value={form.sd?.[analyteId] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Number(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            sd: {
                              ...(prev.sd ?? {}),
                              [analyteId]: val as any,
                            },
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-md text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white/90"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Reagente ───────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle hint="preenchido pelo setup">Reagente (Tromboplastina / Ativador)</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteReagente" required>
                Lote do reagente
              </Label>
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
              <Label htmlFor="fabricanteReagente" required>
                Fabricante
              </Label>
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
              <Label htmlFor="aberturaReagente" required>
                Abertura
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
                Validade
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
              onChange={(e) =>
                set('isi', e.target.value === '' ? undefined : Number(e.target.value))
              }
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
              onChange={(e) =>
                set('mnpt', e.target.value === '' ? undefined : Number(e.target.value))
              }
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
        <SectionTitle hint="opcional — registrar quando exigido pela RT">Ambiente</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="temperaturaAmbiente">Temperatura (°C)</Label>
            <input
              id="temperaturaAmbiente"
              type="number"
              step="0.1"
              placeholder="ex: 22.5"
              value={form.temperaturaAmbiente ?? ''}
              onChange={(e) =>
                set(
                  'temperaturaAmbiente',
                  e.target.value === '' ? undefined : Number(e.target.value),
                )
              }
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
              onChange={(e) =>
                set('umidadeAmbiente', e.target.value === '' ? undefined : Number(e.target.value))
              }
              className={errors.umidadeAmbiente ? INPUT_ERR : INPUT}
            />
            <FieldError msg={errors.umidadeAmbiente} />
          </div>
        </div>
      </section>

      {/* ── Resultados ────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle
          hint={form.nivel ? `baseline ${formatCoagNivelLabel(form.nivel)}` : 'selecione o nível primeiro'}
        >
          Resultados da Corrida
        </SectionTitle>

        <div className="space-y-3">
          {activeAnalytes.map((id) => {
            const cfg = COAG_ANALYTES[id];
            const baseline = form.nivel ? cfg.levels[form.nivel] : null;
            const value = form.resultados?.[id];
            const valueStr = value !== undefined && !Number.isNaN(value) ? String(value) : '';
            const isOut = outOfRange.includes(id);
            const hint = baseline
              ? `esperado: ${baseline.low}–${baseline.high}${baseline.unit ? ` ${baseline.unit}` : ''}`
              : '—';
            const errMsg = errors[`resultados.${id}`] ?? errors[id];

            return (
              <div key={id} className="grid grid-cols-[1fr_120px_90px] gap-3 items-start">
                <div className="pt-2.5">
                  <p className="text-sm font-medium text-slate-700 dark:text-white/75">
                    {cfg.label}
                  </p>
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
                    className={errMsg ? INPUT_ERR : isOut ? INPUT_OUT_OF_RANGE : INPUT}
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
        {form.nivel && form.resultados && Object.keys(form.resultados).length > 0 && (
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
            Classifique a ocorrência. Queixa técnica para desvio de produto sem dano; evento adverso
            quando houve impacto em conduta clínica. Pode ser dispensada se a causa for operacional
            — justifique para auditoria.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="notivisaTipo">Tipo</Label>
                <select
                  id="notivisaTipo"
                  value={form.notivisaTipo ?? ''}
                  onChange={(e) =>
                    set(
                      'notivisaTipo',
                      e.target.value === ''
                        ? undefined
                        : (e.target.value as CoagulacaoFormData['notivisaTipo']),
                    )
                  }
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
                  onChange={(e) =>
                    set(
                      'notivisaStatus',
                      e.target.value === ''
                        ? undefined
                        : (e.target.value as CoagulacaoFormData['notivisaStatus']),
                    )
                  }
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
                  <Label htmlFor="notivisaProtocolo" required>
                    Protocolo NOTIVISA
                  </Label>
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
                  <Label htmlFor="notivisaDataEnvio" required>
                    Data de envio
                  </Label>
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
                <Label htmlFor="notivisaJustificativa" required>
                  Justificativa
                </Label>
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
              Salvando…
            </>
          ) : (
            <>Registrar corrida</>
          )}
        </button>
      </div>

      {/* Override modal — abre quando há vencido / qc-pendente e operador
          escolhe prosseguir. Fecha sem alterar se cancelar. */}
      {insumoGuard.overrideContext && (
        <OverrideModal
          open={insumoGuard.isOverrideOpen}
          context={insumoGuard.overrideContext}
          onCancel={insumoGuard.closeOverride}
          onConfirm={({ justificativa }) => {
            insumoGuard.confirmOverride(justificativa);
          }}
        />
      )}
    </form>
  );
}
