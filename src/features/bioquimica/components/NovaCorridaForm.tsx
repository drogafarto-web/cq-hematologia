/**
 * NovaCorridaForm — capture N analitos × 1 equipamento × 1-3 niveis
 *
 * Flow:
 * 1. Select equipment
 * 2. Show active lot
 * 3. PreFlightCheck gate
 * 4. RunCaptureGrid for data entry
 * 5. Submit (TODO: recordRunBioquimica callable in Plan 09-04)
 */

import React, { useState } from 'react';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useActiveLotForEquipment, useLotes } from '../hooks/useLotes';
import { useAnalitos } from '../hooks/useAnalitos';
import { PreFlightCheck } from './PreFlightCheck';
import { RunCaptureGrid } from './RunCaptureGrid';
import { LotSwitcher } from './LotSwitcher';

// ─── Icons ────────────────────────────────────────────────────────────────────

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 7a5 5 0 0110 0M12 7V4h-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 2h6v3h4v6a1 1 0 01-1 1H3a1 1 0 01-1-1V2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 7h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export function NovaCorridaForm() {
  const labId = useActiveLabId();
  const user = useUser();
  const { equipamentos } = useEquipamentos();
  const { analitos } = useAnalitos();
  const { lotes } = useLotes();

  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [selectedAnalitoIds, setSelectedAnalitoIds] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, number[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchingLot, setSwitchingLot] = useState<string | null>(null);

  const activeLot = useActiveLotForEquipment(selectedEquipmentId);
  const selectedEquipment = equipamentos.find((e) => e.id === selectedEquipmentId);

  if (!labId || !user) {
    return <div className="text-white/40 text-sm">Não autenticado</div>;
  }

  const niveis: (1 | 2 | 3)[] =
    activeLot && activeLot.manufacturerStats
      ? (Object.keys(activeLot.manufacturerStats)
          .map((k) => parseInt(k.replace('nivel', '')) as 1 | 2 | 3)
          .filter((n) => !isNaN(n))
          .sort() as (1 | 2 | 3)[])
      : [1];

  const handleSubmit = async () => {
    if (!selectedEquipmentId || selectedAnalitoIds.length === 0) {
      setError('Selecione equipamento e analitos');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // TODO: Call recordRunBioquimica callable (Plan 09-04)
      console.log('TODO: recordRunBioquimica', {
        labId,
        equipmentId: selectedEquipmentId,
        lotId: activeLot?.id,
        analitoIds: selectedAnalitoIds,
        results,
        operatorId: user.uid,
      });

      alert('✓ Corrida salva (TODO: integração Plan 09-04)');
      setSelectedAnalitoIds([]);
      setResults({});
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar corrida');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Equipment selector */}
      <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-4">
        <label htmlFor="equip-select" className="block text-xs font-medium text-white/45 mb-2">
          Equipamento
        </label>
        <select
          id="equip-select"
          value={selectedEquipmentId}
          onChange={(e) => setSelectedEquipmentId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.09] text-white/90 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#141417] transition-colors"
          aria-label="Selecionar equipamento para captura"
        >
          <option value="">Selecionar equipamento...</option>
          {equipamentos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {/* Active lot info */}
      {selectedEquipmentId && (
        <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-4">
          {activeLot ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-white/40 mb-1">Lote ativo</p>
                  <p className="text-sm font-medium text-white/90">{activeLot.lote}</p>
                </div>
                <button
                  onClick={() => setSwitchingLot(activeLot.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 active:bg-blue-500/40 border border-blue-500/30 text-blue-300 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-[#141417]"
                  aria-label="Trocar lote de controle"
                >
                  <SwapIcon />
                  Trocar
                </button>
              </div>

              {activeLot.bulaPendente && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300">
                  Aguardando bula — Westgard suspenso
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-white/40">Nenhum lote em uso para este equipamento</div>
          )}
        </div>
      )}

      {/* PreFlightCheck */}
      {selectedEquipmentId && activeLot && (
        <PreFlightCheck equipmentId={selectedEquipmentId} analitoIds={selectedAnalitoIds} />
      )}

      {/* Analitos selector */}
      {selectedEquipmentId && (
        <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-white/45 mb-3">Selecione analitos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {analitos.map((analito) => (
              <label
                key={analito.id}
                className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedAnalitoIds.includes(analito.id)}
                  onChange={(e) =>
                    setSelectedAnalitoIds(
                      e.target.checked
                        ? [...selectedAnalitoIds, analito.id]
                        : selectedAnalitoIds.filter((id) => id !== analito.id),
                    )
                  }
                  className="w-4 h-4 rounded border-white/20 accent-violet-500"
                />
                <span className="text-sm text-white/70 truncate">{analito.nome}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Capture grid */}
      {selectedEquipmentId && selectedAnalitoIds.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-white/45">Resultados</p>
          <RunCaptureGrid
            analitoIds={selectedAnalitoIds}
            niveis={niveis}
            onResultsChange={setResults}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Submit */}
      {selectedEquipmentId && selectedAnalitoIds.length > 0 && (
        <div className="flex gap-2 pt-4 border-t border-white/[0.08]">
          <button
            onClick={handleSubmit}
            disabled={submitting || !activeLot}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed
              border border-emerald-500/30 text-emerald-300 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-[#141417]"
            aria-busy={submitting}
          >
            <SaveIcon />
            {submitting ? 'Salvando...' : 'Salvar Corrida'}
          </button>
        </div>
      )}

      {switchingLot && (
        <LotSwitcher
          lotId={switchingLot}
          onClose={() => setSwitchingLot(null)}
          onSwitch={() => setSwitchingLot(null)}
        />
      )}
    </div>
  );
}
