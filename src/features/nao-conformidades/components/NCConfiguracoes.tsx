/**
 * NCConfiguracoes.tsx
 *
 * Configurações editáveis do módulo de Não Conformidades.
 * Setores, origens, prazos padrão — salvos em Firestore.
 *
 * RDC 978/2025 — Configuração de parâmetros do SGQ
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, functions, httpsCallable } from '../../../shared/services/firebase';

interface NCConfiguracoesProps {
  labId: string;
}

interface NCConfig {
  setores: string[];
  origens: string[];
  prazos: Record<string, number>;
}

const DEFAULT_CONFIG: NCConfig = {
  setores: [
    'Hematologia',
    'Bioquímica',
    'Coagulação',
    'Uroanálise',
    'Imunologia',
    'Microbiologia',
    'Recepção',
    'Coleta',
    'Administrativo',
  ],
  origens: [
    'Auditoria interna',
    'Reclamação de cliente',
    'Controle de qualidade',
    'Desvio de processo',
    'Inspeção',
    'Evento adverso',
    'Indicador fora da meta',
  ],
  prazos: {
    critica: 7,
    grave: 15,
    moderada: 30,
    leve: 60,
  },
};

export function NCConfiguracoes({ labId }: NCConfiguracoesProps) {
  const [config, setConfig] = useState<NCConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSetor, setNewSetor] = useState('');
  const [newOrigem, setNewOrigem] = useState('');

  // Load config from Firestore
  useEffect(() => {
    if (!labId) return;

    const loadConfig = async () => {
      try {
        const configRef = doc(db, 'labs', labId, 'nc-config', 'settings');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data() as Partial<NCConfig>;
          setConfig({
            setores: data.setores || DEFAULT_CONFIG.setores,
            origens: data.origens || DEFAULT_CONFIG.origens,
            prazos: data.prazos || DEFAULT_CONFIG.prazos,
          });
        }
      } catch (err) {
        // Use defaults if can't load
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [labId]);

  // Save config to Firestore
  const saveConfig = async () => {
    if (!labId) return;
    setSaving(true);
    setSaved(false);

    try {
      const configRef = doc(db, 'labs', labId, 'nc-config', 'settings');
      await setDoc(configRef, config, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      // Silently fail — user can retry
    } finally {
      setSaving(false);
    }
  };

  const addSetor = () => {
    const trimmed = newSetor.trim();
    if (!trimmed || config.setores.includes(trimmed)) return;
    setConfig((prev) => ({ ...prev, setores: [...prev.setores, trimmed] }));
    setNewSetor('');
  };

  const removeSetor = (setor: string) => {
    setConfig((prev) => ({ ...prev, setores: prev.setores.filter((s) => s !== setor) }));
  };

  const addOrigem = () => {
    const trimmed = newOrigem.trim();
    if (!trimmed || config.origens.includes(trimmed)) return;
    setConfig((prev) => ({ ...prev, origens: [...prev.origens, trimmed] }));
    setNewOrigem('');
  };

  const removeOrigem = (origem: string) => {
    setConfig((prev) => ({ ...prev, origens: prev.origens.filter((o) => o !== origem) }));
  };

  const updatePrazo = (severidade: string, dias: number) => {
    setConfig((prev) => ({
      ...prev,
      prazos: { ...prev.prazos, [severidade]: Math.max(1, dias) },
    }));
  };

  if (loading) {
    return (
      <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-12 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-sm text-white/50">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Setores */}
      <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Setores</h3>
        <p className="text-xs text-white/40 mb-4">Setores disponíveis para classificação de NCs</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {config.setores.map((setor) => (
            <span
              key={setor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70"
            >
              {setor}
              <button
                type="button"
                onClick={() => removeSetor(setor)}
                className="text-white/30 hover:text-red-400 transition-colors"
                aria-label={`Remover ${setor}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSetor}
            onChange={(e) => setNewSetor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSetor()}
            placeholder="Novo setor..."
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
          />
          <button
            type="button"
            onClick={addSetor}
            disabled={!newSetor.trim()}
            className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Origens */}
      <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Origens</h3>
        <p className="text-xs text-white/40 mb-4">Como a não conformidade foi identificada</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {config.origens.map((origem) => (
            <span
              key={origem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70"
            >
              {origem}
              <button
                type="button"
                onClick={() => removeOrigem(origem)}
                className="text-white/30 hover:text-red-400 transition-colors"
                aria-label={`Remover ${origem}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newOrigem}
            onChange={(e) => setNewOrigem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addOrigem()}
            placeholder="Nova origem..."
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
          />
          <button
            type="button"
            onClick={addOrigem}
            disabled={!newOrigem.trim()}
            className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Prazos Padrão */}
      <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Prazos Padrão</h3>
        <p className="text-xs text-white/40 mb-4">
          Prazo máximo para resolução por gravidade (em dias)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(config.prazos).map(([severidade, dias]) => (
            <div
              key={severidade}
              className="p-4 rounded-lg bg-white/5 border border-white/10 text-center"
            >
              <p className="text-xs text-white/50 capitalize mb-2">{severidade}</p>
              <input
                type="number"
                min={1}
                max={365}
                value={dias}
                onChange={(e) => updatePrazo(severidade, parseInt(e.target.value) || 1)}
                className="w-16 mx-auto text-center text-xl font-bold text-white bg-transparent border-b border-white/20 focus:border-red-500 focus:outline-none"
              />
              <p className="text-[10px] text-white/30 mt-1">dias</p>
            </div>
          ))}
        </div>
      </div>

      {/* Salvar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/40">
          {saved && <span className="text-emerald-400 font-medium">✓ Configurações salvas</span>}
        </div>
        <button
          type="button"
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-[#141417] rounded-xl border border-white/[0.08] p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Referências Regulatórias</h3>
        <div className="space-y-2 text-sm text-white/60 mt-3">
          <p>• RDC 978/2025 — Art. 134: Gestão de não conformidades</p>
          <p>• DICQ 8ª Ed. — Item 4.14: Ações corretivas e preventivas</p>
          <p>• ISO 15189:2022 — Cláusula 8.7: Não conformidade e ação corretiva</p>
        </div>
      </div>

      {/* Migração */}
      <MigrationPanel labId={labId} />
    </div>
  );
}

function MigrationPanel({ labId }: { labId: string }) {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<{
    migrated: number;
    skipped: number;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runMigration = async () => {
    setMigrating(true);
    setError(null);
    setResult(null);

    try {
      const migrate = httpsCallable(functions, 'migrateNCsCollection');
      const res = await migrate({ labId });
      setResult(res.data as any);
    } catch (err: any) {
      setError(err.message || 'Erro ao executar migração');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="bg-[#141417] rounded-xl border border-amber-500/20 p-6">
      <h3 className="text-sm font-semibold text-amber-400 mb-1">Migração de Dados</h3>
      <p className="text-xs text-white/40 mb-4">
        Migra NCs da collection antiga (nao-conformidades) para a collection unificada
        (naoConformidades). NCs criadas pelo CEQ antes da correção serão importadas.
      </p>

      {result && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-sm text-emerald-400">{result.message}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={runMigration}
        disabled={migrating}
        className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {migrating ? 'Migrando...' : 'Executar Migração'}
      </button>
    </div>
  );
}
