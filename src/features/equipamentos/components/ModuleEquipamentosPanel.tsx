/**
 * ModuleEquipamentosPanel — painel de um módulo com seus equipamentos.
 *
 * Fase D (2026-04-21 — 2º turno). Central da nova InsumosView. Mostra:
 *   - Header do módulo (nome + CTA "+ Novo equipamento")
 *   - Lista de EquipamentoCard (ativo + manutenção)
 *   - Seção collapsible "Aposentados" (relatório histórico)
 *   - Empty state guiado quando sem equipamentos cadastrados
 */

import React, { useMemo, useState } from 'react';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { EquipamentoCard } from './EquipamentoCard';
import { EquipamentoFormModal } from './EquipamentoFormModal';
import type { InsumoModulo } from '../../insumos/types/Insumo';

const MODULE_LABEL: Record<InsumoModulo, string> = {
  hematologia: 'Hematologia',
  coagulacao: 'Coagulação',
  uroanalise: 'Uroanálise',
  imunologia: 'Imunologia',
};

const MODULE_SUBTITLE: Record<InsumoModulo, string> = {
  hematologia: 'Hemogramas · CIQ quantitativo',
  coagulacao: 'TP/TTPA · CIQ quantitativo',
  uroanalise: 'Tiras reagentes · CIQ híbrido',
  imunologia: 'Imunoensaios R/NR · CIQ qualitativo',
};

interface ModuleEquipamentosPanelProps {
  labId: string;
  module: InsumoModulo;
  canMutate: boolean;
  onTrocarSlot?: (slot: 'reagente' | 'controle' | 'tira', equipamentoId: string) => void;
  /** Abre a aba Catálogo de produtos com filtro de módulo pré-aplicado. */
  onOpenCatalogo?: (moduloFilter?: InsumoModulo) => void;
}

export function ModuleEquipamentosPanel({
  labId,
  module,
  canMutate,
  onTrocarSlot,
  onOpenCatalogo,
}: ModuleEquipamentosPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [showAposentados, setShowAposentados] = useState(false);

  const filtroAtivos = useMemo(
    () => ({ module, status: ['ativo', 'manutencao'] as Array<'ativo' | 'manutencao'> }),
    [module],
  );
  const { equipamentos: ativos, isLoading } = useEquipamentos(filtroAtivos);

  const filtroAposentados = useMemo(
    () => ({ module, status: 'aposentado' as const }),
    [module],
  );
  const { equipamentos: aposentados } = useEquipamentos(
    showAposentados ? filtroAposentados : {},
  );

  return (
    <section
      aria-labelledby={`module-${module}-title`}
      className="bg-slate-50/50 dark:bg-white/[0.015] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-5"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30">
            Módulo
          </p>
          <h2
            id={`module-${module}-title`}
            className="text-lg font-semibold text-slate-900 dark:text-white/90"
          >
            {MODULE_LABEL[module]}
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-white/45">
              · {ativos.length} equipamento{ativos.length !== 1 ? 's' : ''}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
            {MODULE_SUBTITLE[module]}
          </p>
        </div>

        {canMutate && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all inline-flex items-center gap-2 shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M6 2v8M2 6h8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Novo equipamento
          </button>
        )}
      </header>

      {/* Lista ativa */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-500 dark:text-white/40">
          Carregando equipamentos…
        </div>
      ) : ativos.length === 0 ? (
        <EmptyState
          module={module}
          canMutate={canMutate}
          onCadastrar={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-3">
          {ativos.map((e) => (
            <EquipamentoCard
              key={e.id}
              equipamento={e}
              canMutate={canMutate}
              onTrocarSlot={onTrocarSlot}
              onOpenCatalogo={onOpenCatalogo}
            />
          ))}
        </div>
      )}

      {/* Aposentados (collapsible — histórico 5 anos) */}
      <div className="mt-4 border-t border-slate-200 dark:border-white/[0.06] pt-3">
        <button
          type="button"
          onClick={() => setShowAposentados((v) => !v)}
          className="text-xs font-medium text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/65 inline-flex items-center gap-1.5 transition-all"
          aria-expanded={showAposentados}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden
            className={`transition-transform ${showAposentados ? 'rotate-90' : ''}`}
          >
            <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {showAposentados ? 'Ocultar' : 'Ver'} aposentados
          <span className="text-slate-400 dark:text-white/30">· RDC 786 · retenção 5 anos</span>
        </button>
        {showAposentados && (
          <div className="mt-3 space-y-2">
            {aposentados.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-white/30 italic">
                Nenhum equipamento aposentado no módulo.
              </p>
            ) : (
              aposentados.map((e) => (
                <EquipamentoCard
                  key={e.id}
                  equipamento={e}
                  canMutate={false}
                />
              ))
            )}
          </div>
        )}
      </div>

      {showForm && (
        <EquipamentoFormModal
          labId={labId}
          module={module}
          onClose={() => setShowForm(false)}
        />
      )}
    </section>
  );
}

// ─── Empty state guiado ──────────────────────────────────────────────────────

function EmptyState({
  module,
  canMutate,
  onCadastrar,
}: {
  module: InsumoModulo;
  canMutate: boolean;
  onCadastrar: () => void;
}) {
  return (
    <div className="border-2 border-dashed border-slate-300 dark:border-white/[0.08] rounded-xl p-8 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-white/70">
        Nenhum equipamento em {MODULE_LABEL[module]}
      </p>
      <p className="text-xs text-slate-500 dark:text-white/40 mt-1 max-w-md mx-auto leading-relaxed">
        Cadastre cada analisador/leitor do módulo. Em seguida cadastre os produtos (reagentes,
        controles, tiras) do catálogo e por fim os lotes físicos em uso. As corridas diárias
        passam a consumir esse setup automaticamente.
      </p>
      {canMutate && (
        <button
          type="button"
          onClick={onCadastrar}
          className="mt-4 px-5 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium"
        >
          Cadastrar primeiro equipamento
        </button>
      )}
    </div>
  );
}
