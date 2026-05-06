/**
 * LotManager — lot lifecycle management
 * Tabs: EM USO / DISPONÍVEIS / HISTÓRICO
 */

import React, { useState } from 'react';
import { useLotes, useLotesEmUso, useLotesDisponiveis, useLotesHistorico } from '../hooks/useLotes';
import { softDeleteLot, restoreLot, setLotDisponivel } from '../services/lotService';
import { useActiveLabId } from '../../../store/useAuthStore';
import { LotSwitcher } from './LotSwitcher';
import type { ControlMaterial } from '../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 4h10M5.5 4V2.5a1 1 0 011-1h1a1 1 0 011 1V4M2 4v7.5a1 1 0 001 1h8a1 1 0 001-1V4M5 7v4M7 7v4M9 7v4"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7a5 5 0 0110 0M12 7V4h-3"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 4h6v2M12 10H6v-2M2 4l1.5 1.5M12 10l-1.5-1.5"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LotManagerProps {
  onLotCreated?: () => void;
}

type Tab = 'em-uso' | 'disponiveis' | 'historico';

// ─── Component ────────────────────────────────────────────────────────────────

export function LotManager({ onLotCreated }: LotManagerProps) {
  const labId = useActiveLabId();
  const [tab, setTab] = useState<Tab>('em-uso');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [switchingFor, setSwitchingFor] = useState<string | null>(null);
  const lotsEmUso = useLotesEmUso();
  const lotsDisponiveis = useLotesDisponiveis();
  const lotsHistorico = useLotesHistorico();

  if (!labId) return null;

  const handleDelete = async (lotId: string) => {
    if (!window.confirm('Confirmar exclusão? Será movido para histórico.')) return;
    setDeletingId(lotId);
    try {
      await softDeleteLot(labId, lotId);
    } catch (err) {
      console.error('Erro ao deletar lote:', err);
      alert('Erro ao deletar lote');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (lotId: string) => {
    setDeletingId(lotId);
    try {
      await restoreLot(labId, lotId);
    } catch (err) {
      console.error('Erro ao restaurar lote:', err);
      alert('Erro ao restaurar lote');
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkDisponivel = async (lotId: string) => {
    setDeletingId(lotId);
    try {
      await setLotDisponivel(labId, lotId);
    } catch (err) {
      console.error('Erro ao marcar como disponível:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-white/[0.08]">
        {[
          { id: 'em-uso', label: 'Em uso', count: lotsEmUso.length },
          { id: 'disponiveis', label: 'Disponíveis', count: lotsDisponiveis.length },
          { id: 'historico', label: 'Histórico', count: lotsHistorico.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === t.id
                ? 'border-violet-500/60 text-white/90'
                : 'border-transparent text-white/40 hover:text-white/60'
            }`}
          >
            {t.label}
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/[0.08] text-white/50">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {tab === 'em-uso' &&
          (lotsEmUso.length === 0 ? (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-6 text-center">
              <p className="text-sm text-white/40">Nenhum lote em uso</p>
            </div>
          ) : (
            lotsEmUso.map((lot) => <LotCard key={lot.id} lot={lot} onDelete={handleDelete} loading={deletingId === lot.id} />)
          ))}

        {tab === 'disponiveis' &&
          (lotsDisponiveis.length === 0 ? (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-6 text-center">
              <p className="text-sm text-white/40">Nenhum lote disponível</p>
            </div>
          ) : (
            lotsDisponiveis.map((lot) => (
              <div key={lot.id} className="rounded-lg border border-white/[0.09] bg-white/[0.02] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 font-medium">{lot.lote}</p>
                    <p className="text-xs text-white/40 mt-1">
                      Fornecedor: {lot.fornecedor}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkDisponivel(lot.id)}
                    disabled={deletingId === lot.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30
                      border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <SwapIcon />
                    Ativar
                  </button>
                </div>
              </div>
            ))
          ))}

        {tab === 'historico' &&
          (lotsHistorico.length === 0 ? (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-6 text-center">
              <p className="text-sm text-white/40">Histórico vazio</p>
            </div>
          ) : (
            lotsHistorico.map((lot) => (
              <div key={lot.id} className="rounded-lg border border-white/[0.09] bg-white/[0.02] p-3.5 opacity-60">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/60">{lot.lote}</p>
                    <p className="text-xs text-white/30 mt-1">
                      {lot.deletadoEm ? 'Deletado' : 'Vencido'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(lot.id)}
                    disabled={deletingId === lot.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30
                      border border-blue-500/30 text-blue-300 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <RestoreIcon />
                    Restaurar
                  </button>
                </div>
              </div>
            ))
          ))}
      </div>

      {switchingFor && (
        <LotSwitcher
          lotId={switchingFor}
          onClose={() => setSwitchingFor(null)}
          onSwitch={() => setSwitchingFor(null)}
        />
      )}
    </div>
  );
}

// ─── LotCard ──────────────────────────────────────────────────────────────────

interface LotCardProps {
  lot: ControlMaterial;
  onDelete: (id: string) => void;
  loading: boolean;
}

function LotCard({ lot, onDelete, loading }: LotCardProps) {
  const today = new Date();
  const validadeDate = lot.validade instanceof Date ? lot.validade : lot.validade.toDate?.();
  const expiresIn = validadeDate ? Math.ceil((validadeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isExpiringSoon = expiresIn <= 7 && expiresIn > 0;
  const isExpired = expiresIn <= 0;

  return (
    <div className="rounded-lg border border-white/[0.09] bg-white/[0.02] p-3.5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 font-medium">{lot.lote}</p>
          <p className="text-xs text-white/40 mt-1">
            {lot.fornecedor} • {lot.origem}
          </p>
        </div>
        {lot.bulaPendente && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-300">
            Aguardando bula
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-white/40">
        <span>
          Válido até {validadeDate?.toLocaleDateString('pt-BR')}
          {isExpiringSoon && ` (${expiresIn}d)`}
          {isExpired && ' (VENCIDO)'}
        </span>
        <button
          onClick={() => onDelete(lot.id)}
          disabled={loading}
          className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
