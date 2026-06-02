import React, { useMemo, useState, useCallback } from 'react';
import { useUroAberturas } from '../hooks/useUroAberturas';
import { createAbertura, getAberturaById } from '../services/uroAberturaService';
import type { UroAberturaLote, UroanaliseLot } from '../types/Uroanalise';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';

interface UroAberturaSelectorProps {
  lotId: string;
  lot: UroanaliseLot;
  abertura: UroAberturaLote | null;
  tipo: 'controle' | 'tira';
  onAberturaChange: (novaAbertura: UroAberturaLote | null) => void;
}

export function UroAberturaSelector({
  lotId,
  lot,
  abertura: selectedAbertura,
  tipo,
  onAberturaChange,
}: UroAberturaSelectorProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const { aberturas, isLoading: loading } = useUroAberturas(labId, lotId);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newWorklabId, setNewWorklabId] = useState('');
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    return aberturas.map((ab) => ({
      value: ab.id,
      label: `Worklab #${ab.worklabId}`,
      abertura: ab,
    }));
  }, [aberturas]);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === '__new__') {
        setShowNewForm(true);
        return;
      }
      const sel = options.find((o) => o.value === val);
      if (sel) {
        onAberturaChange(sel.abertura);
      }
    },
    [options, onAberturaChange],
  );

  const cancelNewForm = useCallback(() => {
    setShowNewForm(false);
    setNewWorklabId('');
  }, []);

  const buildSnapshotLote = useCallback((): UroAberturaLote['snapshotLote'] => {
    if (tipo === 'controle') {
      return {
        tipo: 'controle',
        lote: lot.loteControle,
        fabricante: lot.fabricanteControle,
        validade: lot.validadeControle,
        nivel: lot.nivel,
      };
    }
    return {
      tipo: 'tira',
      lote: lot.tiraReferencia ?? lot.id,
      fabricante: lot.tiraFabricante ?? '',
      validade: '',
      tiraNome: lot.tiraNome,
      tiraReferencia: lot.tiraReferencia,
    };
  }, [tipo, lot]);

  const handleNovaAbertura = async () => {
    if (!newWorklabId.trim() || !labId) return;
    setSaving(true);
    try {
      const newId = await createAbertura({
        labId,
        lotId,
        worklabId: newWorklabId,
        abertoPor: user?.uid ?? '',
        abertoPorNome: user?.displayName ?? user?.email ?? '',
        snapshotLote: buildSnapshotLote(),
      });
      const nova = await getAberturaById(labId, lotId, newId);
      onAberturaChange(nova);
      cancelNewForm();
    } catch (err: unknown) {
      console.error('[UroAberturaSelector] create abertura failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (showNewForm) {
    return (
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={newWorklabId}
          onChange={(e) => setNewWorklabId(e.target.value)}
          placeholder="Nº Worklab"
          className="flex-1 bg-[#1a1a1e] border border-[#2a2a30] rounded-lg px-3 py-2 text-sm text-[#e0e0e5] placeholder:text-[#555] focus:border-emerald-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNovaAbertura();
            if (e.key === 'Escape') cancelNewForm();
          }}
        />
        <button
          type="button"
          onClick={handleNovaAbertura}
          disabled={saving || !newWorklabId.trim()}
          className="px-3 py-2 text-sm font-medium bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Criando...' : 'Criar'}
        </button>
        <button
          type="button"
          onClick={cancelNewForm}
          className="px-3 py-2 text-sm text-[#888] hover:text-[#bbb] transition-colors"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <select
      className="w-full bg-[#1a1a1e] border border-[#2a2a30] rounded-lg px-3 py-2 text-sm text-[#e0e0e5] focus:border-violet-500 focus:outline-none"
      value={selectedAbertura?.id ?? ''}
      onChange={handleSelect}
      disabled={loading}
      aria-label={`Selecionar abertura para ${tipo === 'controle' ? 'controle' : 'tira de urina'}`}
    >
      <option value="">{loading ? 'Carregando aberturas...' : 'Selecionar worklab...'}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
          {opt.abertura.id === selectedAbertura?.id ? ' (atual)' : ''}
        </option>
      ))}
      <option value="__new__">+ Nova abertura...</option>
    </select>
  );
}
