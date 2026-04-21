import React, { useState, useMemo, useRef } from 'react';
import { UroanaliseFormSchema, daysToExpiry } from './UroanaliseForm.schema';
import type { UroanaliseFormData } from './UroanaliseForm.schema';
import { useUser } from '../../../store/useAuthStore';
import { InsumoPicker } from '../../insumos/components/InsumoPicker';
import { clearInsumoQCValidation } from '../../insumos/services/insumosFirebaseService';
import type { Insumo } from '../../insumos/types/Insumo';
import {
  URO_ANALITOS,
  URO_ANALITO_LABELS,
  URO_CRITERIOS,
  OPCOES_POR_ANALITO,
  URO_ANALITOS_SEM_OCR,
} from '../UroAnalyteConfig';
import { getResultadosEsperadosDefault } from '../hooks/useUroExpected';
import { validateUroResultado } from '../hooks/useUroValidator';
import { parseTiraReagente, analytesSugeriveis } from '../services/ocrTiraService';
import type { OcrResult } from '../services/ocrTiraService';
import type {
  UroAnalitoId,
  UroNivel,
  UroValorCategorico,
  UroFieldOrigem,
} from '../types/_shared_refs';
import type { UroFieldAuditado } from '../types/Uroanalise';

// ─── Styles ───────────────────────────────────────────────────────────────────

const INPUT = [
  'w-full px-3.5 py-2.5 rounded-xl',
  'bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]',
  'text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm',
  'focus:outline-none focus:border-amber-500/50 dark:focus:border-amber-500/50 focus:bg-white dark:focus:bg-white/[0.08]',
  'disabled:opacity-40 transition-all',
].join(' ');

const INPUT_ERR = INPUT.replace(
  'border-slate-200 dark:border-white/[0.09]',
  'border-red-400/60 dark:border-red-400/40',
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARGO_OPTIONS: { value: UroanaliseFormData['cargo']; label: string }[] = [
  { value: 'biomedico', label: 'Biomédico(a)' },
  { value: 'tecnico', label: 'Técnico(a) de Laboratório' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
];

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

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

function NivelToggle({
  value,
  onChange,
  error,
}: {
  value: UroNivel | undefined;
  onChange: (v: UroNivel) => void;
  error?: string;
}) {
  const opts: { key: UroNivel; label: string; sub: string }[] = [
    { key: 'N', label: 'N — Normal', sub: 'valores negativos típicos de indivíduo saudável' },
    { key: 'P', label: 'P — Patológico', sub: 'valores positivos do material de controle elevado' },
  ];
  return (
    <div>
      <div className="flex gap-2">
        {opts.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={[
              'flex-1 py-3 px-3.5 rounded-xl text-left border transition-all',
              value === o.key
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-white/[0.09] text-slate-400 dark:text-white/30 hover:border-slate-300 dark:hover:border-white/20',
            ].join(' ')}
          >
            <p className="text-sm font-semibold">{o.label}</p>
            <p className="text-[10px] mt-0.5 opacity-60">{o.sub}</p>
          </button>
        ))}
      </div>
      <FieldError msg={error} />
    </div>
  );
}

function ExpiryWarning({ label, days }: { label: string; days: number }) {
  if (days >= 30) return null;
  const expired = days < 0;
  return (
    <div
      className={[
        'flex items-start gap-2 px-3.5 py-2 rounded-xl border text-xs mt-1.5',
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

// ─── Button-grid (categorical) ────────────────────────────────────────────────

interface ButtonGridProps {
  analyte: UroAnalitoId;
  value: UroValorCategorico | null | undefined;
  origem: UroFieldOrigem | undefined;
  ocrConf?: number;
  options: readonly UroValorCategorico[];
  isConforme: boolean | null;
  onPick: (v: UroValorCategorico) => void;
}

function ButtonGrid({
  analyte,
  value,
  origem,
  ocrConf,
  options,
  isConforme,
  onPick,
}: ButtonGridProps) {
  const isOcrSuggested = origem === 'OCR_ACEITO';
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5" id={`grid-${analyte}`}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(opt)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-w-[52px]',
                selected
                  ? isConforme === false
                    ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20'
                    : 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-white dark:bg-white/[0.04] text-slate-500 dark:text-white/50 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-800 dark:hover:text-white/80',
              ].join(' ')}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {isOcrSuggested && ocrConf !== undefined && (
        <p
          className={`text-[10px] font-mono ${
            ocrConf >= 0.85
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {ocrConf >= 0.85 ? '🤖 IA' : '🤖 IA?'} {Math.round(ocrConf * 100)}% — revise
        </p>
      )}
    </div>
  );
}

// ─── OcrCameraButton ──────────────────────────────────────────────────────────

interface OcrButtonProps {
  labId: string | null;
  onDone: (result: OcrResult) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}

function OcrCameraButton({ labId, onDone, loading, setLoading }: OcrButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !labId) return;
    setLoading(true);
    try {
      const result = await parseTiraReagente(file, labId);
      onDone(result);
    } catch (err) {
      console.error('[OCR] Falha ao processar tira:', err);
      alert('Não foi possível processar a foto. Preencha manualmente.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            Leitura assistida por IA — experimental
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">
            Fotografe a tira contra o padrão de cores. A IA preenche campos com alta confiança;
            revise TODOS os valores antes de confirmar. Bilirrubina, Urobilinogênio e Densidade são
            sempre manuais (contraste ótico insuficiente).
          </p>
          <div className="mt-3">
            <label
              htmlFor="ocr-input"
              className={[
                'inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                loading
                  ? 'bg-amber-200 text-amber-900 cursor-wait'
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20',
              ].join(' ')}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
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
                  Processando…
                </>
              ) : (
                <>📷 Tirar foto da tira</>
              )}
              <input
                ref={fileInputRef}
                id="ocr-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handleFile}
                disabled={loading}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UroanaliseFormProps {
  onSave: (data: UroanaliseFormData) => Promise<void>;
  isSaving?: boolean;
  onCancel?: () => void;
  initialNivel?: UroNivel;
  /** Label OCR habilitado (vem de labSettings.ocrUrinaEnabled). */
  ocrEnabled?: boolean;
  /** labId ativo — passado ao OCR. */
  labId?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UroanaliseForm({
  onSave,
  isSaving = false,
  onCancel,
  initialNivel,
  ocrEnabled = false,
  labId = null,
}: UroanaliseFormProps) {
  const user = useUser();

  const initialNivelSafe: UroNivel = initialNivel ?? 'N';

  const [form, setForm] = useState<Partial<UroanaliseFormData>>({
    frequencia: 'DIARIA',
    dataRealizacao: today(),
    nivel: initialNivelSafe,
    resultados: {},
    resultadosEsperadosRun: getResultadosEsperadosDefault(initialNivelSafe),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ocrLoading, setOcrLoading] = useState(false);

  // Seleção opcional de insumos cadastrados (tira + controle).
  const [tiraInsumoId, setTiraInsumoId] = useState<string | null>(null);
  const [controleInsumoId, setControleInsumoId] = useState<string | null>(null);

  // labId vem como prop; usado tanto pro OCR quanto para clear do CQ flag.

  function toIsoDate(ts: { toDate: () => Date } | null): string {
    if (!ts) return '';
    const d = ts.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function applyTiraInsumo(i: Insumo | null) {
    setTiraInsumoId(i?.id ?? null);
    if (!i) return;
    setForm((prev) => ({
      ...prev,
      loteTira: i.lote,
      fabricanteTira: i.fabricante,
      validadeTira: toIsoDate(i.validade),
    }));
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

  function setField<K extends keyof UroanaliseFormData>(key: K, value: UroanaliseFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
  }

  // Atualiza resultadosEsperadosRun quando o nível muda
  function handleNivelChange(nivel: UroNivel) {
    setForm((prev) => ({
      ...prev,
      nivel,
      resultadosEsperadosRun: getResultadosEsperadosDefault(nivel),
    }));
  }

  function setCategorico(id: UroAnalitoId, valor: UroValorCategorico) {
    setForm((prev) => {
      const prevField = prev.resultados?.[id] as UroFieldAuditado<UroValorCategorico> | undefined;
      const origem: UroFieldOrigem =
        prevField?.origem === 'OCR_ACEITO' && prevField.valor !== valor
          ? 'OCR_EDITADO'
          : (prevField?.origem ?? 'MANUAL');
      return {
        ...prev,
        resultados: {
          ...prev.resultados,
          [id]: {
            valor,
            origem,
            ...(prevField?.ocrConfianca !== undefined &&
              origem !== 'MANUAL' && { ocrConfianca: prevField.ocrConfianca }),
          },
        },
      };
    });
  }

  function setNumerico(id: 'ph' | 'densidade', raw: string) {
    const num = raw === '' ? null : Number(raw);
    setForm((prev) => {
      const prevField = prev.resultados?.[id] as UroFieldAuditado<number> | undefined;
      const origem: UroFieldOrigem =
        prevField?.origem === 'OCR_ACEITO' && prevField.valor !== num
          ? 'OCR_EDITADO'
          : (prevField?.origem ?? 'MANUAL');
      return {
        ...prev,
        resultados: {
          ...prev.resultados,
          [id]: {
            valor: num,
            origem,
            ...(prevField?.ocrConfianca !== undefined &&
              origem !== 'MANUAL' && { ocrConfianca: prevField.ocrConfianca }),
          },
        },
      };
    });
  }

  function applyOcr(result: OcrResult) {
    setForm((prev) => {
      const updatedResultados = { ...(prev.resultados ?? {}) };
      for (const id of analytesSugeriveis()) {
        const sug = result[id];
        if (!sug || sug.valor === null || sug.confidence < 0.6) {
          // não preenche — deixa o operador digitar manualmente
          continue;
        }
        if (id === 'ph' || id === 'densidade') {
          if (typeof sug.valor === 'number') {
            updatedResultados[id] = {
              valor: sug.valor,
              origem: 'OCR_ACEITO',
              ocrConfianca: sug.confidence,
            };
          }
        } else {
          if (typeof sug.valor === 'string') {
            updatedResultados[id] = {
              valor: sug.valor as UroValorCategorico,
              origem: 'OCR_ACEITO',
              ocrConfianca: sug.confidence,
            };
          }
        }
      }
      return { ...prev, resultados: updatedResultados };
    });
  }

  // ── Derived: conformidade preliminar ─────────────────────────────────────
  const ncAnalitos = useMemo<UroAnalitoId[]>(() => {
    if (!form.nivel || !form.resultados) return [];
    const out: UroAnalitoId[] = [];
    for (const id of URO_ANALITOS) {
      const field = form.resultados[id];
      if (!field || field.valor === null || field.valor === undefined) continue;
      const ok = validateUroResultado(id, field.valor, form.nivel);
      if (ok === false) out.push(id);
    }
    return out;
  }, [form.nivel, form.resultados]);

  const naoConforme = ncAnalitos.length > 0;
  const ctrlDays = form.validadeControle ? daysToExpiry(form.validadeControle) : null;
  const tiraDays = form.validadeTira ? daysToExpiry(form.validadeTira) : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitForm = { ...form, dataRealizacao: today() };
    const result = UroanaliseFormSchema.safeParse(submitForm);

    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ''])));
      return;
    }

    if (naoConforme && !result.data.acaoCorretiva?.trim()) {
      setErrors({
        acaoCorretiva:
          'Ação corretiva é obrigatória em caso de não conformidade (RDC 978/2025 Art. 128).',
      });
      document
        .querySelector('#acaoCorretiva')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    await onSave(result.data);

    // F3: limpar qcValidationRequired da tira declarada quando a corrida
    // é conforme. Controle (tipo=controle) não carrega o flag; só tira-uro.
    if (!naoConforme && tiraInsumoId && labId) {
      void clearInsumoQCValidation(labId, [tiraInsumoId]);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const nivelSafe = form.nivel ?? 'N';

  function renderAnalyte(id: UroAnalitoId) {
    const label = URO_ANALITO_LABELS[id];
    const criterio = URO_CRITERIOS[nivelSafe][id];
    const field = form.resultados?.[id];
    const valor = field?.valor ?? null;
    const origem = field?.origem;
    const conf = field?.ocrConfianca;
    const neverOcr = URO_ANALITOS_SEM_OCR.includes(id);

    if (id === 'ph' || id === 'densidade') {
      const range = criterio as { min: number; max: number };
      const isOk =
        valor === null ? null : (valor as number) >= range.min && (valor as number) <= range.max;
      const step = id === 'ph' ? '0.5' : '0.005';
      const hint = `esperado: ${range.min} – ${range.max}`;
      return (
        <div className="grid grid-cols-[1fr_120px_90px] gap-3 items-start">
          <div className="pt-2.5">
            <p className="text-sm font-medium text-slate-700 dark:text-white/75">
              {label}{' '}
              {neverOcr && (
                <span className="ml-1 text-[9px] font-normal text-slate-400 dark:text-white/25">
                  (sempre manual)
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5">{hint}</p>
          </div>
          <div>
            <input
              id={`resultado-${id}`}
              type="number"
              step={step}
              inputMode="decimal"
              value={valor !== null && typeof valor === 'number' ? String(valor) : ''}
              onChange={(e) => setNumerico(id, e.target.value)}
              className={[
                isOk === null
                  ? INPUT
                  : isOk
                    ? INPUT.replace(
                        'border-slate-200 dark:border-white/[0.09]',
                        'border-emerald-400/50',
                      )
                    : INPUT.replace(
                        'border-slate-200 dark:border-white/[0.09]',
                        'border-red-400/60',
                      ),
              ].join(' ')}
            />
          </div>
          <div className="pt-2.5 text-xs text-slate-400 dark:text-white/30 truncate">
            {valor !== null && isOk !== null && (isOk ? '✓ OK' : '✕ fora')}
          </div>
        </div>
      );
    }

    // Categórico
    const options = OPCOES_POR_ANALITO[id] ?? [];
    const isOk = valor === null ? null : validateUroResultado(id, valor, nivelSafe);
    const esperado = criterio as readonly UroValorCategorico[];
    const hint = `esperado: ${esperado.join(' | ')}`;

    return (
      <div className="grid grid-cols-[1fr_auto_90px] gap-3 items-start">
        <div className="pt-2.5">
          <p className="text-sm font-medium text-slate-700 dark:text-white/75">
            {label}{' '}
            {neverOcr && (
              <span className="ml-1 text-[9px] font-normal text-slate-400 dark:text-white/25">
                (sempre manual)
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5">{hint}</p>
        </div>
        <ButtonGrid
          analyte={id}
          value={valor as UroValorCategorico | null}
          origem={origem}
          ocrConf={conf}
          options={options}
          isConforme={isOk}
          onPick={(v) => setCategorico(id, v)}
        />
        <div className="pt-2.5 text-xs text-slate-400 dark:text-white/30 truncate">
          {valor !== null && isOk !== null && (isOk ? '✓ OK' : '✕ NC')}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {/* Operador */}
      <section>
        <SectionTitle>Operador</SectionTitle>
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07]">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 text-xs font-bold select-none">
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
                value={form.cargo ?? ''}
                onChange={(e) => setField('cargo', e.target.value as UroanaliseFormData['cargo'])}
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
                onChange={(e) => setField('operatorDocument', e.target.value)}
                className={errors.operatorDocument ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.operatorDocument} />
            </div>
          </div>
        </div>
      </section>

      {/* Nível + Frequência */}
      <section>
        <SectionTitle hint="CLSI GP16-A3 · EUG">Corrida</SectionTitle>
        <div className="space-y-3">
          <NivelToggle value={form.nivel} onChange={handleNivelChange} error={errors.nivel} />
          <div>
            <Label htmlFor="frequencia" required>
              Frequência
            </Label>
            <select
              id="frequencia"
              value={form.frequencia ?? ''}
              onChange={(e) =>
                setField('frequencia', e.target.value as UroanaliseFormData['frequencia'])
              }
              className={errors.frequencia ? INPUT_ERR : INPUT}
            >
              <option value="DIARIA">Diária — RDC 302/2005</option>
              <option value="LOTE">Por troca de lote de tiras</option>
            </select>
            <FieldError msg={errors.frequencia} />
          </div>
        </div>
      </section>

      {/* Tiras */}
      <section>
        <SectionTitle>Tiras Reagentes</SectionTitle>
        <div className="mb-3">
          <InsumoPicker
            tipo="tira-uro"
            modulo="uroanalise"
            value={tiraInsumoId}
            onSelect={applyTiraInsumo}
            placeholder="Selecionar tira cadastrada (opcional — auto-preenche abaixo)"
            ariaLabel="Selecionar tira cadastrada"
          />
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loteTira" required>
                Lote das tiras
              </Label>
              <input
                id="loteTira"
                type="text"
                placeholder="ex: 0034-24"
                value={form.loteTira ?? ''}
                onChange={(e) => setField('loteTira', e.target.value)}
                className={errors.loteTira ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.loteTira} />
            </div>
            <div>
              <Label htmlFor="tiraMarca">Marca</Label>
              <input
                id="tiraMarca"
                type="text"
                placeholder="ex: Combur-10, Multistix-10SG"
                value={form.tiraMarca ?? ''}
                onChange={(e) => setField('tiraMarca', e.target.value)}
                className={INPUT}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fabricanteTira">Fabricante</Label>
              <input
                id="fabricanteTira"
                type="text"
                placeholder="ex: Roche, Siemens, Bioeasy"
                value={form.fabricanteTira ?? ''}
                onChange={(e) => setField('fabricanteTira', e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <Label htmlFor="validadeTira">Validade da tira</Label>
              <input
                id="validadeTira"
                type="date"
                value={form.validadeTira ?? ''}
                onChange={(e) => setField('validadeTira', e.target.value)}
                className={errors.validadeTira ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.validadeTira} />
              {tiraDays !== null && <ExpiryWarning label="Tira" days={tiraDays} />}
            </div>
          </div>
        </div>
      </section>

      {/* Controle */}
      <section>
        <SectionTitle>Material de Controle</SectionTitle>
        <div className="mb-3">
          <InsumoPicker
            tipo="controle"
            modulo="uroanalise"
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
                placeholder="ex: L2024-021"
                value={form.loteControle ?? ''}
                onChange={(e) => setField('loteControle', e.target.value)}
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
                placeholder="ex: Bio-Rad Liquichek"
                value={form.fabricanteControle ?? ''}
                onChange={(e) => setField('fabricanteControle', e.target.value)}
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
                value={form.aberturaControle ?? ''}
                onChange={(e) => setField('aberturaControle', e.target.value)}
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
                value={form.validadeControle ?? ''}
                onChange={(e) => setField('validadeControle', e.target.value)}
                className={errors.validadeControle ? INPUT_ERR : INPUT}
              />
              <FieldError msg={errors.validadeControle} />
              {ctrlDays !== null && <ExpiryWarning label="Controle" days={ctrlDays} />}
            </div>
          </div>
        </div>
      </section>

      {/* Ambiente */}
      <section>
        <SectionTitle hint="opcional">Ambiente</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="temperaturaAmbiente">Temperatura (°C)</Label>
            <input
              id="temperaturaAmbiente"
              type="number"
              step="0.1"
              value={form.temperaturaAmbiente ?? ''}
              onChange={(e) =>
                setField(
                  'temperaturaAmbiente',
                  e.target.value === '' ? undefined : Number(e.target.value),
                )
              }
              className={INPUT}
            />
          </div>
          <div>
            <Label htmlFor="umidadeAmbiente">Umidade (%)</Label>
            <input
              id="umidadeAmbiente"
              type="number"
              step="1"
              min="0"
              max="100"
              value={form.umidadeAmbiente ?? ''}
              onChange={(e) =>
                setField(
                  'umidadeAmbiente',
                  e.target.value === '' ? undefined : Number(e.target.value),
                )
              }
              className={INPUT}
            />
          </div>
        </div>
      </section>

      {/* OCR */}
      {ocrEnabled && (
        <section>
          <SectionTitle hint="Claude Opus 4.7 — experimental">Leitura assistida</SectionTitle>
          <OcrCameraButton
            labId={labId}
            onDone={applyOcr}
            loading={ocrLoading}
            setLoading={setOcrLoading}
          />
        </section>
      )}

      {/* Resultados */}
      <section>
        <SectionTitle hint={`Nível ${nivelSafe} — tolerância ordinal embutida nos critérios`}>
          Resultados da Corrida
        </SectionTitle>
        <div className="space-y-3">
          {URO_ANALITOS.map((id) => (
            <div key={id}>{renderAnalyte(id)}</div>
          ))}
        </div>
      </section>

      {/* Ação corretiva */}
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
              value={form.acaoCorretiva ?? ''}
              onChange={(e) => setField('acaoCorretiva', e.target.value)}
              placeholder="Ex: Repetida a corrida com tira nova do mesmo lote; resultado dentro do critério na segunda leitura…"
              className={[errors.acaoCorretiva ? INPUT_ERR : INPUT, 'resize-y min-h-[72px]'].join(
                ' ',
              )}
            />
            <FieldError msg={errors.acaoCorretiva} />
          </div>
        </section>
      )}

      {/* NOTIVISA */}
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
                    setField(
                      'notivisaTipo',
                      e.target.value === ''
                        ? undefined
                        : (e.target.value as UroanaliseFormData['notivisaTipo']),
                    )
                  }
                  className={errors.notivisaTipo ? INPUT_ERR : INPUT}
                >
                  <option value="">— selecione —</option>
                  <option value="queixa_tecnica">Queixa técnica</option>
                  <option value="evento_adverso">Evento adverso</option>
                </select>
              </div>
              <div>
                <Label htmlFor="notivisaStatus">Status</Label>
                <select
                  id="notivisaStatus"
                  value={form.notivisaStatus ?? ''}
                  onChange={(e) =>
                    setField(
                      'notivisaStatus',
                      e.target.value === ''
                        ? undefined
                        : (e.target.value as UroanaliseFormData['notivisaStatus']),
                    )
                  }
                  className={errors.notivisaStatus ? INPUT_ERR : INPUT}
                >
                  <option value="">— selecione —</option>
                  <option value="pendente">Pendente</option>
                  <option value="notificado">Notificado</option>
                  <option value="dispensado">Dispensado</option>
                </select>
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
                    onChange={(e) => setField('notivisaProtocolo', e.target.value)}
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
                    onChange={(e) => setField('notivisaDataEnvio', e.target.value)}
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
                  placeholder="Causa raiz operacional…"
                  value={form.notivisaJustificativa ?? ''}
                  onChange={(e) => setField('notivisaJustificativa', e.target.value)}
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

      {/* Submit bar */}
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
            naoConforme
              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
              : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20',
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
    </form>
  );
}
