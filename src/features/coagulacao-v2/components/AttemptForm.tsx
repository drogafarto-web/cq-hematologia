import { useState, useEffect, useMemo } from 'react';
import { useControlOperacional } from '../hooks/useControlOperacional';
import { useAttemptSave } from '../hooks/useAttemptSave';
import { ResultInput } from './internal/ResultInput';
import { ConformityBadge } from './internal/ConformityBadge';
import { CoagLeveyJenningsPanel } from './CoagLeveyJenningsPanel';
import { COAG_ANALYTES, COAG_ANALYTE_IDS } from '../../coagulacao/CoagAnalyteConfig';
import type { CoagAnalyteId } from '../../coagulacao/types/_shared_refs';

interface AttemptFormProps {
  labId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function AttemptForm({ labId, onSaved, onCancel }: AttemptFormProps) {
  const { controls, isLoading: controlsLoading } = useControlOperacional(labId);
  const { save, isSaving, error } = useAttemptSave(labId);

  const [controlId, setControlId] = useState('');
  const [resultados, setResultados] = useState<Record<CoagAnalyteId, number | undefined>>({
    atividadeProtrombinica: undefined,
    rni: undefined,
    ttpa: undefined,
  });
  const [acaoCorretiva, setAcaoCorretiva] = useState('');

  useEffect(() => {
    if (!controlId && controls.length > 0) {
      const firstActive = controls.filter((c) => c.status === 'ativo')[0];
      if (firstActive) {
        setControlId(firstActive.id);
      }
    }
  }, [controls, controlId]);

  const selectedControl = controls.find((c) => c.id === controlId);
  const nivel = selectedControl?.nivel ?? 'I';

  const [equipamentoInfo, setEquipamentoInfo] = useState<{ name: string; modelo: string; fabricante?: string } | null>(null);
  const [reagenteInfo, setReagenteInfo] = useState<{
    nomeComercial: string;
    lote: string;
    fabricante: string;
    validade: string;
    dataAbertura: string | null;
  } | null>(null);

  useEffect(() => {
    if (!selectedControl) {
      setEquipamentoInfo(null);
      setReagenteInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (selectedControl.equipamentoId) {
        const { getEquipamentoOnce } = await import('../../equipamentos/services/equipamentoService');
        const eq = await getEquipamentoOnce(labId, selectedControl.equipamentoId);
        if (!cancelled && eq) {
          setEquipamentoInfo({
            name: eq.name,
            modelo: eq.modelo,
            fabricante: eq.fabricante,
          });
        }
      }
      if (selectedControl.insumoId) {
        const { getInsumoOnce } = await import('../../insumos/services/insumosFirebaseService');
        const ins = await getInsumoOnce(labId, selectedControl.insumoId);
        if (!cancelled && ins) {
          const fmtTs = (t: any) => {
            if (!t) return '?';
            if (typeof t.toDate === 'function') {
              return t.toDate().toISOString().slice(0, 10);
            }
            return String(t);
          };
          setReagenteInfo({
            nomeComercial: ins.nomeComercial,
            lote: ins.lote,
            fabricante: ins.fabricante,
            validade: fmtTs(ins.validade),
            dataAbertura: ins.dataAbertura ? fmtTs(ins.dataAbertura) : null,
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedControl?.id, labId]);

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
      equipamentoId: selectedControl?.equipamentoId ?? 'Clotimer Duo',
      resultados: filled,
      acaoCorretiva: isConforme ? undefined : acaoCorretiva || undefined,
    });
    onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <label className="mb-2 block text-sm text-zinc-400">Controle</label>
        {controlsLoading ? (
          <div className="py-2 text-sm text-zinc-600">Carregando controles...</div>
        ) : controls.filter((c) => c.status === 'ativo').length === 0 ? (
          <div className="py-2 text-sm text-orange-400">Nenhum controle ativo. Crie um no hub.</div>
        ) : (
          <select
            value={controlId}
            onChange={(e) => setControlId(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            {controls
              .filter((c) => c.status === 'ativo')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        )}
      </div>

      {selectedControl && (
        <div className="space-y-2">
          <h3 className="px-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Registro
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <RegistroCard
              icon="🧪"
              title="Controle"
              line1={selectedControl.nome}
              line2={`Nível ${selectedControl.nivel}`}
              line3={`Lote ${selectedControl.loteControle} · ${selectedControl.fabricanteControle}`}
              line4={`Validade ${selectedControl.validadeControle}`}
            />
            <RegistroCard
              icon="⚗️"
              title="Reagente"
              line1={reagenteInfo?.nomeComercial ?? '—'}
              line2={reagenteInfo ? `Lote ${reagenteInfo.lote}` : '—'}
              line3={reagenteInfo?.fabricante ? `Fabr. ${reagenteInfo.fabricante}` : '—'}
              line4={reagenteInfo?.validade ? `Val. ${reagenteInfo.validade}` : '—'}
              loading={!reagenteInfo && !!selectedControl.insumoId}
            />
            <RegistroCard
              icon="⚙️"
              title="Aparelho"
              line1={equipamentoInfo?.name ?? selectedControl.equipamentoId ?? '—'}
              line2={equipamentoInfo?.modelo ?? '—'}
              line3={equipamentoInfo?.fabricante ?? '—'}
              line4=""
              loading={!equipamentoInfo && !!selectedControl.equipamentoId}
            />
          </div>
        </div>
      )}

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

      <div className="pt-4">
        <CoagLeveyJenningsPanel labId={labId} controls={controls} />
      </div>
    </div>
  );
}

function RegistroCard({
  icon,
  title,
  line1,
  line2,
  line3,
  line4,
  loading,
}: {
  icon: string;
  title: string;
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide text-amber-500">{title}</span>
      </div>
      {loading ? (
        <div className="space-y-1">
          <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
        </div>
      ) : (
        <div className="space-y-0.5 text-xs">
          <div className="font-medium text-zinc-200">{line1}</div>
          {line2 && <div className="text-zinc-400">{line2}</div>}
          {line3 && <div className="text-zinc-500">{line3}</div>}
          {line4 && <div className="text-zinc-500">{line4}</div>}
        </div>
      )}
    </div>
  );
}
