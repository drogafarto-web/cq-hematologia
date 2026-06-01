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
  const [reagenteTtpaInfo, setReagenteTtpaInfo] = useState<{
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
      setReagenteTtpaInfo(null);
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
      if (selectedControl.reagenteTTPAId) {
        const { getInsumoOnce } = await import('../../insumos/services/insumosFirebaseService');
        const insTtpa = await getInsumoOnce(labId, selectedControl.reagenteTTPAId);
        if (!cancelled && insTtpa) {
          const fmtTs = (t: any) => {
            if (!t) return '?';
            if (typeof t.toDate === 'function') {
              return t.toDate().toISOString().slice(0, 10);
            }
            return String(t);
          };
          setReagenteTtpaInfo({
            nomeComercial: insTtpa.nomeComercial,
            lote: insTtpa.lote,
            fabricante: insTtpa.fabricante,
            validade: fmtTs(insTtpa.validade),
            dataAbertura: insTtpa.dataAbertura ? fmtTs(insTtpa.dataAbertura) : null,
          });
        }
      } else {
        if (!cancelled) setReagenteTtpaInfo(null);
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
      <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] p-4 sm:p-6">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--cl-text-muted)]">Controle</label>
        {controlsLoading ? (
          <div className="py-2 text-sm text-[var(--cl-text-faint)]">Carregando controles...</div>
        ) : controls.filter((c) => c.status === 'ativo').length === 0 ? (
          <div className="py-2 text-sm text-[var(--cl-accent)]">Ative um controle na aba 'Lotes em uso' para começar.</div>
        ) : (
          <select
            value={controlId}
            onChange={(e) => setControlId(e.target.value)}
            className="w-full rounded border border-[var(--cl-border)] bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--cl-border)] pb-4 text-sm sm:gap-x-4 sm:text-base">
          <span className="font-medium text-[var(--cl-text-strong)]">{selectedControl.nome}</span>
          <span className="text-[var(--cl-text-faint)]">•</span>
          <span className="text-[var(--cl-text-muted)]">Soro lote {selectedControl.loteControle || '—'}</span>
          {selectedControl.validadeControle && (
            <>
              <span className="text-[var(--cl-text-faint)]">•</span>
              <span className="text-[var(--cl-text-muted)]">Val. {selectedControl.validadeControle}</span>
            </>
          )}
          <span className="text-[var(--cl-text-faint)]">•</span>
          <span className="text-[var(--cl-text-muted)]">{equipamentoInfo?.name || '—'}</span>
        </div>
      )}

      <div className="space-y-4 sm:space-y-6">
        {/* Reagente TP chip + AP/RNI inputs */}
        {reagenteInfo && (
          <span className="text-xs text-[var(--cl-text-muted)] bg-[var(--cl-card-elevated)] rounded px-2 py-1 mb-2 inline-flex items-center gap-1 sm:text-sm sm:px-3 sm:py-1.5">
            Reagente TP: {reagenteInfo.nomeComercial} — Lote {reagenteInfo.lote}
          </span>
        )}
        {(['atividadeProtrombinica', 'rni'] as const).map((id) => {
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

        {/* Reagente TTPA chip + TTPA input */}
        {(() => {
          const ttpaDisplay = reagenteTtpaInfo || reagenteInfo;
          return ttpaDisplay ? (
            <span className="text-xs text-[var(--cl-text-muted)] bg-[var(--cl-card-elevated)] rounded px-2 py-1 mb-2 mt-4 inline-flex items-center gap-1 sm:text-sm sm:px-3 sm:py-1.5">
              Reagente TTPA: {ttpaDisplay.nomeComercial} — Lote {ttpaDisplay.lote}
            </span>
          ) : null;
        })()}
        {(() => {
          const id = 'ttpa' as const;
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
        })()}
      </div>

      {anyResult && (
        <div className="flex items-center gap-2 sm:gap-3">
          <ConformityBadge isConforme={isConforme} />
        </div>
      )}

      {anyResult && !isConforme && (
        <div className="rounded-lg border border-[var(--cl-danger)]/30 bg-[var(--cl-danger-bg)] p-4 sm:p-6">
          <label className="mb-2 block text-sm text-[var(--cl-danger)]">
            O que foi feito?
          </label>
          <textarea
            value={acaoCorretiva}
            onChange={(e) => setAcaoCorretiva(e.target.value)}
            rows={3}
            placeholder="Descreva brevemente a ação tomada..."
            className="w-full rounded border border-[var(--cl-danger)]/30 bg-[var(--cl-input)] px-3 py-2.5 text-sm text-[var(--cl-text-strong)] placeholder-[var(--cl-text-faint)] focus:border-[var(--cl-border-focus)] focus:outline-none sm:text-base"
          />
        </div>
      )}

      {error && (
        <div className="rounded bg-[var(--cl-danger-bg)] px-3 py-2 text-sm text-[var(--cl-danger)] sm:px-4 sm:py-3 sm:text-base">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-[var(--cl-border)] px-4 py-2 text-sm text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-elevated)] sm:text-base sm:px-6 sm:py-2.5"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !controlId}
          className="rounded bg-[var(--cl-accent)] px-6 py-2 text-sm font-medium text-[var(--cl-accent-text)] hover:bg-[var(--cl-accent-hover)] disabled:opacity-50 sm:text-base sm:px-8 sm:py-2.5"
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="pt-4 sm:pt-6">
        <CoagLeveyJenningsPanel labId={labId} controls={controls} />
      </div>
    </div>
  );
}


