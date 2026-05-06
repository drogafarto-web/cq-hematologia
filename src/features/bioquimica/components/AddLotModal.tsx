/**
 * AddLotModal — bioquímica
 * 3 paths: Bula PDF | Sem bula (≤7d) | Avulso
 *
 * Each path creates a ControlMaterial with different origin + metadata
 */

import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { createLotAvulso, createLotSemBula } from '../services/lotService';
import { applyBula } from '../services/bulaService';
import { EquipamentoMultiselect } from './EquipamentoMultiselect';
import { BulaProcessor } from './BulaProcessor';
import type { BulaParseResult } from '../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4 4l10 10M14 4L4 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1L13 13H1L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 6v3M7 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddLotModalProps {
  onClose: () => void;
  onLotCreated?: (lotId: string) => void;
}

type Tab = 'bula' | 'sem-bula' | 'avulso';

// ─── Component ────────────────────────────────────────────────────────────────

export function AddLotModal({ onClose, onLotCreated }: AddLotModalProps) {
  const labId = useActiveLabId();
  const [tab, setTab] = useState<Tab>('bula');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common fields
  const [lotNumber, setLotNumber] = useState('');
  const [validade, setValidade] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);

  // Avulso-only fields
  const [niveis, setNiveis] = useState<Array<{ level: 1 | 2 | 3; enabled: boolean }>>([
    { level: 1, enabled: true },
    { level: 2, enabled: false },
    { level: 3, enabled: false },
  ]);
  const [stats, setStats] = useState<Record<string, { mean: number; sd: number }>>({});

  // Bula-only state
  const [bulaProcessed, setBulaProcessed] = useState<BulaParseResult | null>(null);
  const [lotIdForBula, setLotIdForBula] = useState<string | null>(null);

  if (!labId) return null;

  // Validation
  const commonValid = lotNumber.trim() && validade && fornecedor.trim() && equipmentIds.length > 0;
  const validDate = validade && !isNaN(new Date(validade).getTime());
  const canSubmit = commonValid && validDate;

  // Submit handlers
  const handleCreateAvulso = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const selectedNiveis = niveis.filter((n) => n.enabled);
      if (selectedNiveis.length === 0) {
        setError('Selecione pelo menos um nível');
        setLoading(false);
        return;
      }

      const nivelData = selectedNiveis.map((n) => ({
        level: n.level as 1 | 2 | 3,
        manufacturerStats: Object.keys(stats).reduce(
          (acc, analito) => {
            acc[analito] = stats[analito];
            return acc;
          },
          {} as Record<string, { mean: number; sd: number }>,
        ),
      }));

      const lotId = await createLotAvulso(labId, {
        lotNumber,
        validade: new Date(validade),
        fornecedor,
        equipmentIds,
        niveis: nivelData,
      });

      onLotCreated?.(lotId);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar lote');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSemBula = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const lotId = await createLotSemBula(labId, {
        lotNumber,
        validade: new Date(validade),
        fornecedor,
        equipmentIds,
      });

      onLotCreated?.(lotId);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar lote');
    } finally {
      setLoading(false);
    }
  };

  const handleBulaProcessed = async (parseResult: BulaParseResult) => {
    setBulaProcessed(parseResult);
    // Lot will be created when BulaProcessor applies it
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl bg-gradient-to-b from-[#141417] to-[#0a0a0b] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/[0.08] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#141417]/80 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Novo Lote</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.08] transition-colors text-white/60 hover:text-white/90"
            aria-label="Fechar modal"
          >
            <XIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.08] px-6 -mb-4">
          {[
            { id: 'bula', label: 'Bula PDF' },
            { id: 'sem-bula', label: 'Sem bula (≤7d)' },
            { id: 'avulso', label: 'Avulso' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-violet-500/60 text-white/90'
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-5">
          {/* Bula path */}
          {tab === 'bula' && (
            <div className="space-y-5">
              <BulaProcessor
                lotId="temp"
                onApplySuccess={onClose}
                onCancel={onClose}
              />
            </div>
          )}

          {/* Sem bula path */}
          {tab === 'sem-bula' && (
            <div className="space-y-5">
              <div>
                <label htmlFor="lot-num-sem-bula" className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
                  Número do lote
                  <span className="text-red-400/70 ml-0.5">*</span>
                </label>
                <input
                  id="lot-num-sem-bula"
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-white/90 placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
                  placeholder="ex: 1234567"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="val-sem-bula" className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
                    Validade <span className="text-red-400/70">*</span>
                  </label>
                  <input
                    id="val-sem-bula"
                    type="date"
                    value={validade}
                    onChange={(e) => setValidade(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-white/90 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="forn-sem-bula" className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
                    Fornecedor <span className="text-red-400/70">*</span>
                  </label>
                  <input
                    id="forn-sem-bula"
                    type="text"
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-white/90 placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
                    placeholder="ex: BioMérieux"
                  />
                </div>
              </div>

              <EquipamentoMultiselect
                selectedIds={equipmentIds}
                onChange={setEquipmentIds}
              />

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 flex gap-3">
                <div className="text-amber-400 mt-0.5">
                  <AlertIcon />
                </div>
                <p className="text-xs text-amber-300/80">
                  Você tem 7 dias para anexar a bula. Após esse prazo, novas runs ficarão bloqueadas.
                </p>
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreateSemBula}
                  disabled={!canSubmit || loading}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-50
                    border border-violet-500/30 text-violet-300 text-sm font-medium transition-colors"
                >
                  {loading ? 'Criando...' : 'Criar lote'}
                </button>
                <button
                  onClick={onClose}
                  className="px-3.5 py-2.5 rounded-xl border border-white/[0.09]
                    text-white/70 hover:text-white/90 text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Avulso path */}
          {tab === 'avulso' && (
            <div className="space-y-5">
              <div>
                <label htmlFor="lot-num-avulso" className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
                  Número do lote <span className="text-red-400/70">*</span>
                </label>
                <input
                  id="lot-num-avulso"
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-white/90 placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
                  placeholder="ex: 1234567"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="val-avulso" className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
                    Validade <span className="text-red-400/70">*</span>
                  </label>
                  <input
                    id="val-avulso"
                    type="date"
                    value={validade}
                    onChange={(e) => setValidade(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-white/90 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="forn-avulso" className="block text-xs font-medium text-white/45 mb-1.5 ml-0.5">
                    Fornecedor <span className="text-red-400/70">*</span>
                  </label>
                  <input
                    id="forn-avulso"
                    type="text"
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-white/90 placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
                    placeholder="ex: BioMérieux"
                  />
                </div>
              </div>

              <EquipamentoMultiselect
                selectedIds={equipmentIds}
                onChange={setEquipmentIds}
              />

              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-xs text-blue-300/80">
                Modo avulso usa estatística manual. Recomendado apenas em emergência.
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreateAvulso}
                  disabled={!canSubmit || loading}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-50
                    border border-violet-500/30 text-violet-300 text-sm font-medium transition-colors"
                >
                  {loading ? 'Criando...' : 'Criar lote'}
                </button>
                <button
                  onClick={onClose}
                  className="px-3.5 py-2.5 rounded-xl border border-white/[0.09]
                    text-white/70 hover:text-white/90 text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
