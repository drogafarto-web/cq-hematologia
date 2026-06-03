import React, { useCallback, useMemo, useState } from 'react';
import { UroFormIdentificationSectionV2 } from './UroFormIdentificationSectionV2';
import { UroAnalyteRow } from './UroAnalyteRow';
import { UroQuantitativoRow } from './UroQuantitativoRow';
import { UroFormFooterSection } from './UroFormFooterSection';
import { UroStatusBar } from './UroStatusBar';
import { UroanaliseFormSchema, type UroanaliseFormData } from './UroanaliseForm.schema';
import {
  URO_ANALITOS,
  URO_ANALITO_LABELS,
  URO_CRITERIOS,
  OPCOES_POR_ANALITO,
} from '../UroAnalyteConfig';
import type {
  UroAnalitoId,
  UroAnalitoCategoricoId,
  UroValorCategorico,
  UroLotStatus,
  UroNivel,
} from '../types/_shared_refs';
import type { UroFieldAuditado } from '../types/Uroanalise';
import { validateUroResultado } from '../hooks/useUroValidator';
import { toast } from '../../../shared/store/useToastStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UroanaliseFormRedesignedProps {
  /** Initial values for the form (from lot defaults or draft). */
  initialValues: Partial<UroanaliseFormData>;

  /** Persists the validated run. Should resolve when save+sign complete. */
  onSubmit: (data: UroanaliseFormData) => Promise<void>;

  /** Bubbling cancel for the parent (close drawer, navigate, etc). Optional. */
  onCancel?: () => void;

  /** Force-disable all inputs (e.g., RT review mode). */
  disabled?: boolean;

  /** Override for the bottom status bar; defaults to derived from results. */
  lotStatus?: UroLotStatus;

  /** Operator handle shown in the status bar timestamp area. */
  operadorDisplay?: string;

  /** Callback to trigger registration of a new tira lot. */
  onAddTiraLot?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUANT_ANALITOS = ['ph', 'densidade'] as const;
const CAT_ANALITOS = URO_ANALITOS.filter(
  (a): a is UroAnalitoCategoricoId => a !== 'ph' && a !== 'densidade',
);

type FieldOrigem = 'MANUAL' | 'OCR_ACEITO' | 'OCR_EDITADO' | 'OCR_REJEITADO';

function makeAuditado<T>(valor: T | null, origem: FieldOrigem = 'MANUAL'): UroFieldAuditado<T> {
  return { valor, origem };
}

function readAuditado<T>(field: UroFieldAuditado<T> | undefined): T | null {
  return field?.valor ?? null;
}

function getExpectedDisplay(
  analito: UroAnalitoId,
  nivel: UroNivel | undefined,
  configuredExpected: any
): string {
  if (!nivel) return '';
  if (nivel === 'N') {
    if (analito === 'ph') return '5,0 - 6,0';
    if (analito === 'densidade') return '1,005 - 1,025';
    if (analito === 'urobilinogenio') return 'NORM';
    return 'NEG';
  }
  // Level P (Patológico)
  if (analito === 'ph') return '6,0 - 8,0';
  if (analito === 'densidade') return '1,015 - 1,030';
  if (analito === 'glicose') return '1+ a 4+';
  if (analito === 'nitrito') return 'POS';
  if (
    analito === 'cetonas' ||
    analito === 'bilirrubina' ||
    analito === 'sangue' ||
    analito === 'leucocitos' ||
    analito === 'urobilinogenio'
  ) {
    return '1+ a 4+ / AUM / POS';
  }
  return configuredExpected ? String(configuredExpected) : '';
}

function evalCategoricalConformidade(
  value: UroValorCategorico | null,
  analito: UroAnalitoId,
  nivel: UroNivel | undefined,
): 'conforme' | 'desvio' | 'sem_avaliar' {
  if (!value) return 'sem_avaliar';
  if (!nivel) return 'sem_avaliar';
  const ok = validateUroResultado(analito, value, nivel);
  if (ok === null) return 'sem_avaliar';
  return ok ? 'conforme' : 'desvio';
}

function evalNumericConformidade(
  value: number | null,
  analito: UroAnalitoId,
  nivel: UroNivel | undefined,
): 'conforme' | 'desvio' | 'sem_avaliar' {
  if (value === null || value === undefined || Number.isNaN(value)) return 'sem_avaliar';
  if (!nivel) return 'sem_avaliar';
  const ok = validateUroResultado(analito, value, nivel);
  if (ok === null) return 'sem_avaliar';
  return ok ? 'conforme' : 'desvio';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UroanaliseFormRedesigned({
  initialValues,
  onSubmit,
  onCancel,
  disabled,
  lotStatus,
  operadorDisplay,
  onAddTiraLot,
}: UroanaliseFormRedesignedProps) {
  const [values, setValues] = useState<Partial<UroanaliseFormData>>(() => ({
    ...initialValues,
    resultados: initialValues.resultados ?? {},
    resultadosEsperadosRun: initialValues.resultadosEsperadosRun ?? {},
  }));

  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialValues.loteTira) {
      setValues((v) => ({ ...v, loteTira: initialValues.loteTira }));
    }
  }, [initialValues.loteTira]);

  // Per-field setter used by all child sections
  const setField = useCallback(
    <K extends keyof UroanaliseFormData>(key: K, value: UroanaliseFormData[K]) => {
      setValues((v) => ({ ...v, [key]: value }));
      setTouched((t) => new Set(t).add(String(key)));
    },
    [],
  );

  const markBlurred = useCallback((key: string) => {
    setTouched((t) => new Set(t).add(key));
  }, []);

  // ── Validation: run full schema, expose errors for touched fields only ────
  const errors = useMemo<Partial<Record<string, string>>>(() => {
    const result = UroanaliseFormSchema.safeParse(values);
    if (result.success) return {};
    const map: Record<string, string> = {};
    for (const issue of result.error.errors) {
      const path = issue.path.join('.');
      if (submitAttempted || touched.has(path)) {
        map[path] = issue.message;
      }
    }
    return map;
  }, [values, touched, submitAttempted]);

  // ── Result handlers (categorical + numeric) ─────────────────────────────
  const setCatResultado = useCallback(
    (analito: UroAnalitoCategoricoId, valor: UroValorCategorico) => {
      setValues((v) => ({
        ...v,
        resultados: {
          ...v.resultados,
          [analito]: makeAuditado<UroValorCategorico>(valor, 'MANUAL'),
        },
      }));
      setTouched((t) => new Set(t).add(`resultados.${analito}`));
    },
    [],
  );

  const setQuantResultado = useCallback((analito: 'ph' | 'densidade', valor: number | null) => {
    setValues((v) => ({
      ...v,
      resultados: {
        ...v.resultados,
        [analito]: makeAuditado<number>(valor, 'MANUAL'),
      },
    }));
    setTouched((t) => new Set(t).add(`resultados.${analito}`));
  }, []);

  // ── Per-row conformidade map ────────────────────────────────────────────
  const nivel = values.nivel;
  const expectedSnapshot = values.resultadosEsperadosRun ?? {};

  const rowConformidade = useMemo(() => {
    const out: Record<string, 'conforme' | 'desvio' | 'sem_avaliar'> = {};
    if (!nivel) return out;
    for (const cat of CAT_ANALITOS) {
      const valor = readAuditado(values.resultados?.[cat]);
      out[cat] = evalCategoricalConformidade(valor, cat, nivel);
    }
    for (const q of QUANT_ANALITOS) {
      const valor = readAuditado(values.resultados?.[q]);
      out[q] = evalNumericConformidade(valor as number | null, q, nivel);
    }
    return out;
  }, [values.resultados, nivel]);

  // ── Summary metrics for footer ──────────────────────────────────────────
  const summary = useMemo(() => {
    const total = URO_ANALITOS.length;
    let preenchidos = 0;
    let conformes = 0;
    let desvios = 0;
    for (const a of URO_ANALITOS) {
      const c = rowConformidade[a];
      if (c === 'conforme') {
        preenchidos++;
        conformes++;
      } else if (c === 'desvio') {
        preenchidos++;
        desvios++;
      }
    }
    return {
      total,
      preenchidos,
      conformes,
      desvios,
      pendentes: total - preenchidos,
    };
  }, [rowConformidade]);

  const hasDesvios = summary.desvios > 0;

  // ── Status bar derivation ───────────────────────────────────────────────
  const derivedLotStatus: UroLotStatus = useMemo(() => {
    if (lotStatus) return lotStatus;
    if (summary.preenchidos === 0) return 'sem_dados';
    if (summary.desvios > 0) return 'reprovado';
    if (summary.pendentes > 0) return 'atencao';
    return 'valido';
  }, [lotStatus, summary]);

  const statusMessage = useMemo(() => {
    if (derivedLotStatus === 'sem_dados') return 'Aguardando preenchimento';
    if (derivedLotStatus === 'reprovado')
      return `${summary.desvios} desvio${summary.desvios > 1 ? 's' : ''} detectado${summary.desvios > 1 ? 's' : ''}`;
    if (derivedLotStatus === 'atencao')
      return `${summary.pendentes} analito${summary.pendentes > 1 ? 's' : ''} pendente${summary.pendentes > 1 ? 's' : ''}`;
    return 'Todos os analitos conformes';
  }, [derivedLotStatus, summary]);

  // Recompute the displayed timestamp once per minute so it doesn't re-render on every keystroke
  const [now, setNow] = useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const timestamp = useMemo(
    () => new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    [now],
  );

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSubmitAttempted(true);
    setSubmitError(null);
    const parsed = UroanaliseFormSchema.safeParse(values);
    if (!parsed.success) {
      console.error('Uroanalise validation failed:', parsed.error.format());
      const firstError = parsed.error.errors[0];
      const fieldPath = firstError.path.join('.');
      const errorMsg = `${firstError.message} (${fieldPath})`;
      toast.error(`Erro de validação: ${errorMsg}`);
      setSubmitError('Corrija os campos destacados antes de salvar.');
      return;
    }
    try {
      setSaving(true);
      await onSubmit(parsed.data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao salvar a corrida.');
    } finally {
      setSaving(false);
    }
  }, [values, onSubmit]);

  // ── Generic onChange forwarder for footer (string-keyed payload) ────────
  const handleFooterChange = useCallback((key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setTouched((t) => new Set(t).add(key));
  }, []);

  return (
    <div className="flex flex-col bg-white dark:bg-[#0f1318] min-h-full">
      {/* Form body */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-10">
          {/* ── Identification ─────────────────────────────────────────────── */}
          <section aria-labelledby="ident-heading">
            <h2 id="ident-heading" className="sr-only">
              Identificação da corrida
            </h2>
            <UroFormIdentificationSectionV2
              values={values}
              errors={errors as Partial<Record<keyof UroanaliseFormData, string>>}
              onChange={setField}
              onBlur={(k) => markBlurred(String(k))}
              disabled={disabled}
              onAddTiraLot={onAddTiraLot}
            />
          </section>

          {/* ── Resultados ─────────────────────────────────────────────────── */}
          <section aria-labelledby="resultados-heading" className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between border-b border-slate-200 dark:border-white/[0.08] pb-3">
              <h2
                id="resultados-heading"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30"
              >
                Resultados obtidos
              </h2>
              <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-white/30">
                {summary.preenchidos}/{summary.total}
              </span>
            </header>

            <div className="rounded-xl border border-slate-100 dark:border-white/[0.05] bg-slate-50/30 dark:bg-white/[0.015]">
              {/* Categorical analytes */}
              {CAT_ANALITOS.map((analito) => {
                const opcoes = OPCOES_POR_ANALITO[analito] ?? [];
                const field = values.resultados?.[analito];
                const valor = readAuditado(field);
                const expected = expectedSnapshot[analito];
                return (
                  <UroAnalyteRow
                    key={analito}
                    analitoId={analito}
                    label={URO_ANALITO_LABELS[analito]}
                    scale={opcoes}
                    value={valor}
                    expected={getExpectedDisplay(analito, nivel, expected)}
                    onChange={(v) => setCatResultado(analito, v)}
                    conformidade={rowConformidade[analito] ?? 'sem_avaliar'}
                    disabled={disabled}
                    origem={field?.origem}
                    ocrConfianca={field?.ocrConfianca}
                  />
                );
              })}

              {/* Quantitative analytes */}
              {QUANT_ANALITOS.map((analito) => {
                const field = values.resultados?.[analito];
                const valor = readAuditado(field) as number | null;
                const range = expectedSnapshot[analito];
                const fallbackRange = nivel
                  ? (URO_CRITERIOS[nivel][analito] as { min: number; max: number })
                  : undefined;
                return (
                  <UroQuantitativoRow
                    key={analito}
                    analitoId={analito}
                    label={URO_ANALITO_LABELS[analito]}
                    value={valor}
                    expectedRange={range ?? fallbackRange}
                    onChange={(v) => setQuantResultado(analito, v)}
                    conformidade={rowConformidade[analito]}
                    disabled={disabled}
                    origem={field?.origem}
                    ocrConfianca={field?.ocrConfianca}
                  />
                );
              })}
            </div>
          </section>

          {/* ── Footer (resumo + ação corretiva + notivisa + save) ────────── */}
          <UroFormFooterSection
            totalAnalitos={summary.total}
            preenchidos={summary.preenchidos}
            conformes={summary.conformes}
            desvios={summary.desvios}
            pendentes={summary.pendentes}
            hasDesvios={hasDesvios}
            acaoCorretiva={values.acaoCorretiva ?? ''}
            notivisaTipo={values.notivisaTipo}
            notivisaStatus={values.notivisaStatus}
            notivisaProtocolo={values.notivisaProtocolo}
            notivisaDataEnvio={values.notivisaDataEnvio}
            notivisaJustificativa={values.notivisaJustificativa}
            errors={errors}
            onChange={handleFooterChange}
            onBlur={markBlurred}
            onSave={handleSave}
            saving={saving}
            saveDisabled={disabled || saving}
            saveLabel="Salvar e assinar"
          />

          {submitError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-right">
              {submitError}
            </p>
          )}

          {onCancel && (
            <div className="flex justify-end -mt-6">
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/70 transition-colors px-3 py-2"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sticky status bar at bottom */}
      <div className="sticky bottom-0 z-10 bg-white/90 dark:bg-[#0f1318]/90 backdrop-blur-sm">
        <UroStatusBar
          status={derivedLotStatus}
          message={statusMessage}
          timestamp={timestamp}
          operador={operadorDisplay}
        />
      </div>
    </div>
  );
}
