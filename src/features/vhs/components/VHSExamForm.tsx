import { useState } from 'react';
import { useUser, useActiveLab } from '../../../store/useAuthStore';
import { useVHSSave } from '../hooks/useVHSSave';
import { toast } from '../../../shared/store/useToastStore';
import { VHS_METODOS } from '../constants/vhsConstants';
import type { VHSExam, VHSMetodo } from '../types/VHSExam';

interface VHSExamFormProps {
  onSuccess?: (exam: VHSExam) => void;
}

export function VHSExamForm({ onSuccess }: VHSExamFormProps) {
  const user = useUser();
  const activeLab = useActiveLab();
  const { saveFirstReading, oneLoading, errors } = useVHSSave();

  const [amostraId, setAmostraId] = useState('');
  const [pacienteId, setPacienteId] = useState('');
  const [pacienteNome, setPacienteNome] = useState('');
  const [metodo, setMetodo] = useState<VHSMetodo>('westergren');
  const [valor, setValor] = useState('');
  const [equipamentoId, setEquipamentoId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const canSubmit = amostraId.trim().length > 0 && valor !== '' && !oneLoading && !!activeLab;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeLab) return;

    const val = parseFloat(valor);
    if (Number.isNaN(val) || val < 0 || val > 200) return;

    try {
      const exam = await saveFirstReading({
        amostraId: amostraId.trim(),
        pacienteId: pacienteId.trim() || undefined,
        pacienteNome: pacienteNome.trim() || undefined,
        metodo,
        leitura1: {
          valor: val,
          operadorId: user.uid,
          operadorNome: user.displayName || user.email || 'Operador',
        },
        equipamentoId: equipamentoId.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      });
      toast.success('Leitura 1 registrada — aguardando leitura 2');
      setAmostraId('');
      setPacienteId('');
      setPacienteNome('');
      setMetodo('westergren');
      setValor('');
      setEquipamentoId('');
      setObservacoes('');
      onSuccess?.(exam);
    } catch {
      // erro ja esta em errors.one
    }
  }

  if (!activeLab) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#141417] p-6 text-center text-zinc-400">
        Selecione um laboratorio para registrar exames VHS.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-zinc-800 bg-[#141417] p-6">
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">
          Novo exame · Leitura 1 (operador 1)
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          Preencha os dados da amostra e o valor da primeira leitura.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vhs-amostraId" className="mb-1 block text-sm font-medium text-zinc-300">
              Identificador da amostra <span className="text-rose-400">*</span>
            </label>
            <input
              id="vhs-amostraId"
              type="text"
              required
              value={amostraId}
              onChange={(e) => setAmostraId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
              placeholder="Ex: AM-2026-001"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="vhs-pacienteId"
                className="mb-1 block text-sm font-medium text-zinc-300"
              >
                ID do paciente
              </label>
              <input
                id="vhs-pacienteId"
                type="text"
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label
                htmlFor="vhs-pacienteNome"
                className="mb-1 block text-sm font-medium text-zinc-300"
              >
                Nome do paciente
              </label>
              <input
                id="vhs-pacienteNome"
                type="text"
                value={pacienteNome}
                onChange={(e) => setPacienteNome(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vhs-metodo" className="mb-1 block text-sm font-medium text-zinc-300">
                Metodo <span className="text-rose-400">*</span>
              </label>
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
            <div>
              <label htmlFor="vhs-valor" className="mb-1 block text-sm font-medium text-zinc-300">
                Valor Leitura 1 (mm/h) <span className="text-rose-400">*</span>
              </label>
              <input
                id="vhs-valor"
                type="number"
                step="0.1"
                min={0}
                max={200}
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
                placeholder="0.0"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="vhs-equipamentoId"
              className="mb-1 block text-sm font-medium text-zinc-300"
            >
              Equipamento
            </label>
            <input
              id="vhs-equipamentoId"
              type="text"
              value={equipamentoId}
              onChange={(e) => setEquipamentoId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
              placeholder="ID do equipamento (opcional)"
            />
          </div>

          <div>
            <label
              htmlFor="vhs-observacoes"
              className="mb-1 block text-sm font-medium text-zinc-300"
            >
              Observacoes
            </label>
            <textarea
              id="vhs-observacoes"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
              placeholder="Observacoes adicionais..."
            />
          </div>

          {errors.one && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {errors.one}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {oneLoading ? 'Registrando...' : 'Registrar leitura 1'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
