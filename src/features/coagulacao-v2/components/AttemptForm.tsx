import { useState, useMemo } from 'react';
import { useControlOperacional } from '../hooks/useControlOperacional';
import { useAttemptSave } from '../hooks/useAttemptSave';
import { ResultInput } from './internal/ResultInput';
import { ConformityBadge } from './internal/ConformityBadge';
import { COAG_ANALYTES, COAG_ANALYTE_IDS } from '../../coagulacao/CoagAnalyteConfig';
import type { CoagAnalyteId } from '../../coagulacao/types/_shared_refs';

interface AttemptFormProps {
  labId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function AttemptForm({ labId, onSaved, onCancel }: AttemptFormProps) {
  const { controls } = useControlOperacional(labId);
  const { save, isSaving, error } = useAttemptSave(labId);

  const [controlId, setControlId] = useState('');
  const [resultados, setResultados] = useState<Record<CoagAnalyteId, number | undefined>>({
    atividadeProtrombinica: undefined,
    rni: undefined,
    ttpa: undefined,
  });
  const [acaoCorretiva, setAcaoCorretiva] = useState('');

  const selectedControl = controls.find((c) => c.id === controlId);
  const nivel = selectedControl?.nivel ?? 'I';

  const isConforme = useMemo(() => {
    if (!selectedControl) return true;
    return COAG_ANALYTE_IDS.every((id) => {
      const val = resultados[id];
      if (val === undefined) return true;
      const baseline = COAG_ANALYTES[id].levels[nivel];
      return val >= baseline.low && val <= baseline.high;
    });
  }, [resultados, selectedControl, nivel]);

  const anyResult = Object.values(resultados).some((v) => v !== undefined);

  async function handleSave() {
    const filled: Record<CoagAnalyteId, number> = {
      atividadeProtrombinica: resultados.atividadeProtrombinica ?? 0,
      rni: resultados.rni ?? 0,
      ttpa: resultados.ttpa ?? 0,
    };
    await save({
      controlOperacionalId: controlId,
      equipamentoId: 'Clotimer Duo',
      resultados: filled,
      acaoCorretiva: isConforme ? undefined : acaoCorretiva || undefined,
    });
    onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <label className="mb-2 block text-sm text-zinc-400">Controle</label>
        <select
          value={controlId}
          onChange={(e) => setControlId(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Selecione um controle</option>
          {controls
            .filter((c) => c.status === 'ativo')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </select>
        {selectedControl && (
          <p className="mt-1 text-xs text-zinc-600">
            {selectedControl.nome} — Clotimer Duo
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="mb-4 text-sm font-medium text-zinc-300">Resultados</h3>
        <div className="space-y-4">
          {COAG_ANALYTE_IDS.map((id) => {
            const cfg = COAG_ANALYTES[id];
            const baseline = cfg.levels[nivel];
            return (
              <ResultInput
                key={id}
                label={cfg.label}
                value={resultados[id]}
                unit={baseline.unit}
                expectedRange={`${baseline.low}–${baseline.high}`}
                onChange={(v) =>
                  setResultados((prev) => ({ ...prev, [id]: v }))
                }
              />
            );
          })}
        </div>
      </div>

      {anyResult && (
        <div className="flex items-center gap-2">
          <ConformityBadge isConforme={isConforme} />
        </div>
      )}

      {anyResult && !isConforme && (
        <div className="rounded-lg border border-red-700 bg-red-900/20 p-4">
          <label className="mb-2 block text-sm text-red-300">
            Descreva a ação corretiva tomada:
          </label>
          <textarea
            value={acaoCorretiva}
            onChange={(e) => setAcaoCorretiva(e.target.value)}
            rows={3}
            placeholder="ex: Repetida a dosagem com nova amostra de controle; valor dentro do intervalo na segunda corrida"
            className="w-full rounded border border-red-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </div>
      )}

      {error && (
        <div className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !controlId}
          className="rounded bg-amber-600 px-6 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
