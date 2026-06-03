/**
 * LotSwitcher — modal compact pra trocar lote em uso por equipamento
 */

import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useLotes } from '../hooks/useLotes';
import { setLotEmUso } from '../services/lotService';
import { useUser } from '../../../store/useAuthStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 3l10 10M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 7l3 3 6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LotSwitcherProps {
  lotId: string;
  onClose: () => void;
  onSwitch?: () => void;
}

export function LotSwitcher({ lotId, onClose, onSwitch }: LotSwitcherProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const { lotes } = useLotes();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!labId || !user) return null;

  const targetLot = lotes.find((l) => l.id === lotId);
  if (!targetLot) return null;

  const handleSwitch = async () => {
    setLoading(true);
    setError(null);

    try {
      // For each equipment, switch to this lot
      for (const equipmentId of targetLot.equipmentIds) {
        await setLotEmUso(labId, lotId, equipmentId, user.uid);
      }
      onSwitch?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao trocar lote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#141417] rounded-2xl shadow-2xl border border-white/[0.08]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h3 className="text-base font-semibold text-white">Confirmar troca de lote</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-white/60"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-4">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] p-3.5">
            <p className="text-xs text-white/40 mb-2">Lote selecionado</p>
            <p className="text-sm font-medium text-white/90">{targetLot.lote}</p>
            <p className="text-xs text-white/50 mt-1">{targetLot.fornecedor}</p>
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3.5">
            <p className="text-xs text-blue-300/80">
              Trocar lote requer assinatura do operador. O novo lote será marcado como ativo para{' '}
              {targetLot.equipmentIds.length} equipamento
              {targetLot.equipmentIds.length !== 1 ? 's' : ''}.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-white/[0.08] px-5 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-white/[0.09] text-white/70 hover:text-white/90 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSwitch}
            disabled={loading}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 rounded-full border border-emerald-300 border-t-transparent animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <CheckIcon />
                Confirmar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
