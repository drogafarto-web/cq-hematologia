import { useState, useCallback } from 'react';
import { useColaboradores } from '../../educacao-continuada/hooks/useColaboradores';
import { useTurnos } from '../hooks/useTurnos';
import type { TurnoInput, Periodo } from '../types/Turno';

interface TurnoFormProps {
  turnoId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const PERIODOS: Array<{ value: Periodo; label: string }> = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'plantao', label: 'Plantão' },
];

export function TurnoForm({ turnoId, onClose, onSuccess }: TurnoFormProps) {
  const { turnos, create, update, isLoading: isTurnosLoading, error: turnosError } = useTurnos();
  const { colaboradores, isLoading: isColaboradoresLoading } = useColaboradores({
    somenteAtivos: true,
  });

  const turno = turnoId ? turnos.find((t) => t.id === turnoId) : undefined;

  const [data, setData] = useState(turno?.data || '');
  const [periodo, setPeriodo] = useState<Periodo>(turno?.periodo || 'manha');
  const [supervisorId, setSupervisorId] = useState(turno?.supervisorId || '');
  const [observacoes, setObservacoes] = useState(turno?.observacoes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const supervisor = supervisorId ? colaboradores.find((c) => c.id === supervisorId) : null;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!data || !periodo || !supervisorId) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      setIsSubmitting(true);
      try {
        const input: TurnoInput = {
          data,
          periodo: periodo as 'manha' | 'tarde' | 'noite' | 'plantao',
          supervisorId,
          observacoes: observacoes.slice(0, 500),
        };

        if (turnoId) {
          await update(turnoId, { observacoes: input.observacoes });
        } else {
          await create(input);
        }

        onSuccess?.();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar turno');
      } finally {
        setIsSubmitting(false);
      }
    },
    [data, periodo, supervisorId, observacoes, turnoId, create, update, onClose, onSuccess],
  );

  const isLoading = isTurnosLoading || isColaboradoresLoading || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-800 p-6"
    >
      <h2 className="text-lg font-semibold text-slate-100">
        {turnoId ? 'Editar Turno' : 'Novo Turno'}
      </h2>

      {/* Data */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="data" className="text-sm font-medium text-slate-200">
          Data <span className="text-red-400">*</span>
        </label>
        <input
          type="date"
          id="data"
          value={data}
          onChange={(e) => setData(e.target.value)}
          disabled={isLoading}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
        />
      </div>

      {/* Período */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="periodo" className="text-sm font-medium text-slate-200">
          Período <span className="text-red-400">*</span>
        </label>
        <select
          id="periodo"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
          disabled={isLoading}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Supervisor Combobox */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="supervisor" className="text-sm font-medium text-slate-200">
          Supervisor <span className="text-red-400">*</span>
        </label>
        <select
          id="supervisor"
          value={supervisorId}
          onChange={(e) => setSupervisorId(e.target.value)}
          disabled={isLoading}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
        >
          <option value="">Selecionar supervisora(r)...</option>
          {colaboradores.map((col) => (
            <option key={col.id} value={col.id}>
              {col.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Supervisor info (read-only) */}
      {supervisor && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-slate-400">Supervisor selecionado:</p>
          <p className="text-xs text-slate-300">{supervisor.nome}</p>
        </div>
      )}

      {/* Observações */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="observacoes" className="text-sm font-medium text-slate-200">
          Observações <span className="text-slate-500">(máximo 500 caracteres)</span>
        </label>
        <textarea
          id="observacoes"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value.slice(0, 500))}
          disabled={isLoading}
          rows={3}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
          placeholder="Notas sobre o turno..."
        />
        <p className="text-xs text-slate-500">{observacoes.length} / 500</p>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {turnosError && <p className="text-xs text-red-400">{turnosError.message}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {isLoading ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="flex-1 rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
