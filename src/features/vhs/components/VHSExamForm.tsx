import { useState } from 'react';
import { useVHSSave } from '../hooks/useVHSSave';
import { toast } from '../../../shared/store/useToastStore';
import { VHS_METODOS, VHS_TOLERANCIA_MM_H } from '../constants/vhsConstants';
import type { VHSMetodo, VHSExamInput, VHSLeituraInput } from '../types/VHSExam';

interface VHSExamFormProps {
  labId: string;
  onSuccess?: () => void;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Delta preview ──────────────────────────────────────────────────────────

function buildDeltaPreview(v1: number, v2: number): { delta: number; withinTolerance: boolean } {
  const delta = Math.abs(v1 - v2);
  return { delta, withinTolerance: delta <= VHS_TOLERANCIA_MM_H };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function VHSExamForm({ labId, onSuccess }: VHSExamFormProps) {
  const { saveExam, saveLoading, saveError } = useVHSSave(labId);

  // ── Amostra ──────────────────────────────────────────────────────────────
  const [amostraId, setAmostraId] = useState('');
  const [pacienteId, setPacienteId] = useState('');
  const [pacienteNome, setPacienteNome] = useState('');
  const [metodo, setMetodo] = useState<VHSMetodo>('westergren');
  const [equipamentoId, setEquipamentoId] = useState('');

  // ── Leitura 1 ────────────────────────────────────────────────────────────
  const [l1Responsavel, setL1Responsavel] = useState('');
  const [l1LeituraEm, setL1LeituraEm] = useState(toDateTimeLocal(new Date()));
  const [l1Valor, setL1Valor] = useState('');

  // ── Leitura 2 (toggle) ───────────────────────────────────────────────────
  const [showL2, setShowL2] = useState(false);
  const [l2Responsavel, setL2Responsavel] = useState('');
  const [l2LeituraEm, setL2LeituraEm] = useState(toDateTimeLocal(new Date()));
  const [l2Valor, setL2Valor] = useState('');

  // ── Dupla Checagem (Opcional) ────────────────────────────────────────────
  const [isValidationActive, setIsValidationActive] = useState(false);
  const [val1Responsavel, setVal1Responsavel] = useState('');
  const [val1LeituraEm, setVal1LeituraEm] = useState(toDateTimeLocal(new Date()));
  const [val1Valor, setVal1Valor] = useState('');
  const [val2Responsavel, setVal2Responsavel] = useState('');
  const [val2LeituraEm, setVal2LeituraEm] = useState(toDateTimeLocal(new Date()));
  const [val2Valor, setVal2Valor] = useState('');

  // ── Observações ──────────────────────────────────────────────────────────
  const [observacoes, setObservacoes] = useState('');

  // ── Delta preview ────────────────────────────────────────────────────────
  const parsedL1 = parseFloat(l1Valor);
  const parsedL2 = parseFloat(l2Valor);
  const hasBothValues = (showL2 || isValidationActive) && !Number.isNaN(parsedL1) && !Number.isNaN(parsedL2);
  const deltaPreview = hasBothValues ? buildDeltaPreview(parsedL1, parsedL2) : null;

  // ── canSubmit ────────────────────────────────────────────────────────────
  const canSubmit =
    amostraId.trim().length > 0 &&
    l1Valor !== '' &&
    (!isValidationActive && !showL2 ? true : l2Valor !== '') &&
    (!isValidationActive ? true : val1Valor !== '' && val2Valor !== '') &&
    !saveLoading;

  // ── Reset ────────────────────────────────────────────────────────────────
  function resetForm() {
    setAmostraId('');
    setPacienteId('');
    setPacienteNome('');
    setMetodo('westergren');
    setEquipamentoId('');
    setL1Responsavel('');
    setL1LeituraEm(toDateTimeLocal(new Date()));
    setL1Valor('');
    setShowL2(false);
    setL2Responsavel('');
    setL2LeituraEm(toDateTimeLocal(new Date()));
    setL2Valor('');
    setObservacoes('');

    // Reset validation state
    setIsValidationActive(false);
    setVal1Responsavel('');
    setVal1LeituraEm(toDateTimeLocal(new Date()));
    setVal1Valor('');
    setVal2Responsavel('');
    setVal2LeituraEm(toDateTimeLocal(new Date()));
    setVal2Valor('');
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const v1 = parseFloat(l1Valor);
    if (Number.isNaN(v1) || v1 < 0 || v1 > 200) return;

    const leitura1: VHSLeituraInput = {
      valor: v1,
      responsavelNome: l1Responsavel.trim(),
      leituraEm: fromDateTimeLocal(l1LeituraEm),
    };

    let leitura2: VHSLeituraInput | undefined;
    if (isValidationActive || (showL2 && l2Valor !== '')) {
      const v2 = parseFloat(l2Valor);
      if (Number.isNaN(v2) || v2 < 0 || v2 > 200) return;
      leitura2 = {
        valor: v2,
        responsavelNome: l2Responsavel.trim(),
        leituraEm: fromDateTimeLocal(l2LeituraEm),
      };
    }

    let validacaoLeitura1: VHSLeituraInput | undefined;
    let validacaoLeitura2: VHSLeituraInput | undefined;

    if (isValidationActive) {
      const val1 = parseFloat(val1Valor);
      const val2 = parseFloat(val2Valor);
      if (Number.isNaN(val1) || val1 < 0 || val1 > 200) return;
      if (Number.isNaN(val2) || val2 < 0 || val2 > 200) return;

      validacaoLeitura1 = {
        valor: val1,
        responsavelNome: val1Responsavel.trim(),
        leituraEm: fromDateTimeLocal(val1LeituraEm),
      };

      validacaoLeitura2 = {
        valor: val2,
        responsavelNome: val2Responsavel.trim(),
        leituraEm: fromDateTimeLocal(val2LeituraEm),
      };
    }

    const input: VHSExamInput = {
      amostraId: amostraId.trim(),
      pacienteId: pacienteId.trim() || undefined,
      pacienteNome: pacienteNome.trim() || undefined,
      metodo,
      equipamentoId: equipamentoId.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      leitura1,
      leitura2,
      isValidationActive,
      validacaoLeitura1,
      validacaoLeitura2,
    };

    const examId = await saveExam(input);
    if (!examId) return; // saveError already set by hook

    toast.success('Exame registrado');
    resetForm();
    onSuccess?.();
  }

  // ── L2 toggle handler ────────────────────────────────────────────────────
  function toggleL2() {
    if (showL2) {
      // Reset L2 fields when hiding
      setL2Responsavel('');
      setL2LeituraEm(toDateTimeLocal(new Date()));
      setL2Valor('');
    }
    setShowL2((prev) => !prev);
  }

  // ── Renders ──────────────────────────────────────────────────────────────

  function renderField({
    label,
    id,
    required,
    children,
  }: {
    label: string;
    id: string;
    required?: boolean;
    children: React.ReactNode;
  }) {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-300">
          {label}
          {required && <span className="text-rose-400"> *</span>}
        </label>
        {children}
      </div>
    );
  }

  function renderInput({
    id,
    type,
    required,
    value,
    onChange,
    placeholder,
    min,
    max,
    step,
  }: {
    id: string;
    type: string;
    required?: boolean;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: string;
  }) {
    return (
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
        placeholder={placeholder}
      />
    );
  }

  function renderLeituraSection({
    title,
    prefix,
    responsavel,
    onChangeResponsavel,
    leituraEm,
    onChangeLeituraEm,
    valor,
    onChangeValor,
    required,
  }: {
    title: string;
    prefix: string;
    responsavel: string;
    onChangeResponsavel: (v: string) => void;
    leituraEm: string;
    onChangeLeituraEm: (v: string) => void;
    valor: string;
    onChangeValor: (v: string) => void;
    required?: boolean;
  }) {
    return (
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        <div className="space-y-4">
          {renderField({
            label: 'Responsável pela leitura',
            id: `vhs-${prefix}-responsavel`,
            required,
            children: renderInput({
              id: `vhs-${prefix}-responsavel`,
              type: 'text',
              required,
              value: responsavel,
              onChange: onChangeResponsavel,
              placeholder: 'Nome do responsável',
            }),
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            {renderField({
              label: 'Data/hora da leitura',
              id: `vhs-${prefix}-leituraEm`,
              required,
              children: renderInput({
                id: `vhs-${prefix}-leituraEm`,
                type: 'datetime-local',
                required,
                value: leituraEm,
                onChange: onChangeLeituraEm,
              }),
            })}
            {renderField({
              label: 'Valor (mm/h)',
              id: `vhs-${prefix}-valor`,
              required,
              children: renderInput({
                id: `vhs-${prefix}-valor`,
                type: 'number',
                required,
                value: valor,
                onChange: onChangeValor,
                placeholder: '0.0',
                min: 0,
                max: 200,
                step: '0.1',
              }),
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-zinc-800 bg-[#141417] p-6">
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">Novo exame VHS</h2>
        <p className="mb-6 text-sm text-zinc-400">
          Preencha os dados da amostra e as leituras realizadas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Amostra section ──────────────────────────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-zinc-200">Amostra</h3>

            {renderField({
              label: 'Identificador da amostra',
              id: 'vhs-amostraId',
              required: true,
              children: renderInput({
                id: 'vhs-amostraId',
                type: 'text',
                required: true,
                value: amostraId,
                onChange: setAmostraId,
                placeholder: 'Ex: AM-2026-001',
              }),
            })}

            <div className="grid gap-4 sm:grid-cols-2">
              {renderField({
                label: 'ID do paciente',
                id: 'vhs-pacienteId',
                children: renderInput({
                  id: 'vhs-pacienteId',
                  type: 'text',
                  value: pacienteId,
                  onChange: setPacienteId,
                }),
              })}
              {renderField({
                label: 'Nome do paciente',
                id: 'vhs-pacienteNome',
                children: renderInput({
                  id: 'vhs-pacienteNome',
                  type: 'text',
                  value: pacienteNome,
                  onChange: setPacienteNome,
                }),
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {renderField({
                label: 'Método',
                id: 'vhs-metodo',
                required: true,
                children: (
                  <div>
                    <select
                      id="vhs-metodo"
                      value={metodo}
                      onChange={(e) => setMetodo(e.target.value as VHSMetodo)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
                    >
                      {VHS_METODOS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-zinc-500">
                      {VHS_METODOS.find((m) => m.value === metodo)?.description}
                    </p>
                  </div>
                ),
              })}
              {renderField({
                label: 'Equipamento',
                id: 'vhs-equipamentoId',
                children: renderInput({
                  id: 'vhs-equipamentoId',
                  type: 'text',
                  value: equipamentoId,
                  onChange: setEquipamentoId,
                  placeholder: 'ID do equipamento (opcional)',
                }),
              })}
            </div>
          </div>

          {/* ── Header Leituras com Gatilho de Dupla Checagem ───────────────── */}
          <div className="flex items-center justify-between pt-2">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
              Dados das Leituras
            </h3>
            <button
              type="button"
              onClick={() => setIsValidationActive(!isValidationActive)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                isValidationActive
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
              }`}
              title="Ativar dupla checagem opcional (validação de 1ª e 2ª hora para amostra marcadora)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                {isValidationActive && <path d="m9 11 2 2 4-4" />}
              </svg>
              {isValidationActive ? 'Dupla Checagem Ativa' : 'Dupla Checagem'}
            </button>
          </div>

          {/* ── Leitura 1 section ─────────────────────────────────────────── */}
          {renderLeituraSection({
            title: isValidationActive ? 'Leitura Inicial 1ª Hora' : 'Leitura 1',
            prefix: 'l1',
            responsavel: l1Responsavel,
            onChangeResponsavel: setL1Responsavel,
            leituraEm: l1LeituraEm,
            onChangeLeituraEm: setL1LeituraEm,
            valor: l1Valor,
            onChangeValor: setL1Valor,
            required: true,
          })}

          {/* ── Toggle Leitura 2 ─────────────────────────────────────────── */}
          {!isValidationActive && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleL2}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
              >
                {showL2 ? '− Remover Leitura 2' : '+ Adicionar Leitura 2'}
              </button>
            </div>
          )}

          {/* ── Leitura 2 section ─────────────────────────────────────────── */}
          {(showL2 || isValidationActive) && (
            <>
              {renderLeituraSection({
                title: isValidationActive ? 'Leitura Inicial 2ª Hora' : 'Leitura 2',
                prefix: 'l2',
                responsavel: l2Responsavel,
                onChangeResponsavel: setL2Responsavel,
                leituraEm: l2LeituraEm,
                onChangeLeituraEm: setL2LeituraEm,
                valor: l2Valor,
                onChangeValor: setL2Valor,
                required: isValidationActive,
              })}

              {/* ── Delta preview ────────────────────────────────────────── */}
              {deltaPreview && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    deltaPreview.withinTolerance
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                  }`}
                >
                  Diferença entre leituras:{' '}
                  <span className="font-medium tabular-nums">
                    |{parsedL1.toFixed(1)} − {parsedL2.toFixed(1)}| ={' '}
                    {deltaPreview.delta.toFixed(1)} mm/h
                  </span>
                  {deltaPreview.withinTolerance ? (
                    <span className="ml-2 text-emerald-400">
                      ✓ Dentro da tolerância (±{VHS_TOLERANCIA_MM_H} mm/h)
                    </span>
                  ) : (
                    <span className="ml-2 text-amber-400">
                      ⚠ Excede a tolerância de ±{VHS_TOLERANCIA_MM_H} mm/h
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Seção de Validação (Dupla Checagem) ───────────────────────── */}
          {isValidationActive && (
            <div className="space-y-4 pt-2 border-t border-zinc-800/80">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-rose-400">Validação (Dupla Checagem)</h3>

                {renderLeituraSection({
                  title: 'Validação 1ª Hora',
                  prefix: 'val1',
                  responsavel: val1Responsavel,
                  onChangeResponsavel: setVal1Responsavel,
                  leituraEm: val1LeituraEm,
                  onChangeLeituraEm: setVal1LeituraEm,
                  valor: val1Valor,
                  onChangeValor: setVal1Valor,
                  required: true,
                })}

                {renderLeituraSection({
                  title: 'Validação 2ª Hora',
                  prefix: 'val2',
                  responsavel: val2Responsavel,
                  onChangeResponsavel: setVal2Responsavel,
                  leituraEm: val2LeituraEm,
                  onChangeLeituraEm: setVal2LeituraEm,
                  valor: val2Valor,
                  onChangeValor: setVal2Valor,
                  required: true,
                })}
              </div>
            </div>
          )}

          {/* ── Observações ──────────────────────────────────────────────── */}
          {renderField({
            label: 'Observações',
            id: 'vhs-observacoes',
            children: (
              <textarea
                id="vhs-observacoes"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
                placeholder="Observações adicionais..."
              />
            ),
          })}

          {/* ── Save error ───────────────────────────────────────────────── */}
          {saveError && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {saveError}
            </div>
          )}

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveLoading ? 'Salvando...' : 'Salvar exame'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Exported helper for datetime-local parsing ─────────────────────────────

function fromDateTimeLocal(s: string): Date {
  return new Date(s);
}
