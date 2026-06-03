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

  // ── Observações ──────────────────────────────────────────────────────────
  const [observacoes, setObservacoes] = useState('');

  // ── Delta preview ────────────────────────────────────────────────────────
  const parsedL1 = parseFloat(l1Valor);
  const parsedL2 = parseFloat(l2Valor);
  const hasBothValues = showL2 && !Number.isNaN(parsedL1) && !Number.isNaN(parsedL2);
  const deltaPreview = hasBothValues ? buildDeltaPreview(parsedL1, parsedL2) : null;

  // ── canSubmit ────────────────────────────────────────────────────────────
  const canSubmit = amostraId.trim().length > 0 && l1Valor !== '' && !saveLoading;

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
    if (showL2 && l2Valor !== '') {
      const v2 = parseFloat(l2Valor);
      if (Number.isNaN(v2) || v2 < 0 || v2 > 200) return;
      leitura2 = {
        valor: v2,
        responsavelNome: l2Responsavel.trim(),
        leituraEm: fromDateTimeLocal(l2LeituraEm),
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

          {/* ── Leitura 1 section ─────────────────────────────────────────── */}
          {renderLeituraSection({
            title: 'Leitura 1',
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
          <div className="flex justify-center">
            <button
              type="button"
              onClick={toggleL2}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              {showL2 ? '− Remover Leitura 2' : '+ Adicionar Leitura 2'}
            </button>
          </div>

          {/* ── Leitura 2 section ─────────────────────────────────────────── */}
          {showL2 && (
            <>
              {renderLeituraSection({
                title: 'Leitura 2',
                prefix: 'l2',
                responsavel: l2Responsavel,
                onChangeResponsavel: setL2Responsavel,
                leituraEm: l2LeituraEm,
                onChangeLeituraEm: setL2LeituraEm,
                valor: l2Valor,
                onChangeValor: setL2Valor,
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
