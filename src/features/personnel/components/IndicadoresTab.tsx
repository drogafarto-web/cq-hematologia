/**
 * personnel/components/IndicadoresTab.tsx
 *
 * KPI dashboard for Personnel module.
 * All data derived from existing hooks (no new Firestore reads).
 */

import React, { useMemo, useState } from 'react';
import { useDesignacoes } from '../hooks/useDesignacoes';
import { useCargos } from '../hooks/useCargos';
import { useCompetenciaMatriz } from '../hooks/useCompetenciaMatriz';
import { useCiencias } from '../hooks/useCiencias';
import type { NivelCompetencia } from '../types/CompetenciaMatriz';
import { NIVEL_LABEL } from '../types/CompetenciaMatriz';

// ─── Visual tokens ──────────────────────────────────────────────────────────

const CARD_CLS = 'rounded-xl border border-white/[0.08] bg-white/[0.03] p-5';

const NIVEL_COLORS: Record<NivelCompetencia, string> = {
  nao_habilitado: 'bg-slate-600',
  em_treinamento: 'bg-amber-500',
  habilitado: 'bg-emerald-500',
  especialista: 'bg-violet-500',
};

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return (
    <div className={CARD_CLS}>
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {subtitle && <p className="text-[10px] text-white/30 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Main Tab ───────────────────────────────────────────────────────────────

export function IndicadoresTab() {
  const { designacoes } = useDesignacoes();
  const { cargos } = useCargos();
  const { competencias, alertas } = useCompetenciaMatriz();
  const { pendentes } = useCiencias();

  // Colaboradores ativos: designações where dataFim == null
  const colaboradoresAtivos = useMemo(() => {
    const ids = new Set<string>();
    for (const d of designacoes) {
      if (d.dataFim === null) {
        ids.add(d.pessoaId);
      }
    }
    return ids.size;
  }, [designacoes]);

  // Cargos preenchidos vs total
  const cargosPreenchidos = useMemo(() => {
    const filled = new Set<string>();
    for (const d of designacoes) {
      if (d.dataFim === null) {
        filled.add(d.cargoId);
      }
    }
    return filled.size;
  }, [designacoes]);

  // Competências avaliadas no prazo (not in alertas)
  const competenciasNoPrazo = useMemo(() => {
    const alertIds = new Set(alertas.map((a) => a.id));
    return competencias.filter((c) => !alertIds.has(c.id)).length;
  }, [competencias, alertas]);

  // Competências por nível (for bar chart)
  const competenciasPorNivel = useMemo(() => {
    const counts: Record<NivelCompetencia, number> = {
      nao_habilitado: 0,
      em_treinamento: 0,
      habilitado: 0,
      especialista: 0,
    };
    for (const c of competencias) {
      counts[c.nivel] = (counts[c.nivel] || 0) + 1;
    }
    return counts;
  }, [competencias]);

  const maxNivel = Math.max(...Object.values(competenciasPorNivel), 1);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Colaboradores Ativos"
          value={colaboradoresAtivos}
          subtitle="Designações vigentes"
        />
        <KpiCard
          label="Cargos Preenchidos"
          value={`${cargosPreenchidos}/${cargos.length}`}
          subtitle="Designações ativas / cargos"
        />
        <KpiCard
          label="Competências no Prazo"
          value={competenciasNoPrazo}
          subtitle={`${alertas.length} vencendo/vencidas`}
        />
        <KpiCard
          label="Ciências Pendentes"
          value={pendentes.length}
          subtitle="Designações sem ciência"
        />
        <KpiCard
          label="Supervisões Ativas"
          value="—"
          subtitle="Dados via hook supervisões"
        />
      </div>

      {/* Bar chart: competências por nível */}
      <div className={CARD_CLS}>
        <h4 className="text-xs font-semibold text-white/70 mb-4">Competências por Nível</h4>
        {competencias.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-6">Nenhuma competência registrada.</p>
        ) : (
          <div className="space-y-3">
            {(Object.entries(competenciasPorNivel) as [NivelCompetencia, number][]).map(([nivel, count]) => (
              <div key={nivel} className="flex items-center gap-3">
                <span className="text-[10px] text-white/50 w-28 shrink-0 text-right">
                  {NIVEL_LABEL[nivel]}
                </span>
                <div className="flex-1 h-6 rounded-lg bg-white/[0.04] overflow-hidden">
                  <div
                    className={`h-full rounded-lg ${NIVEL_COLORS[nivel]} transition-all duration-500`}
                    style={{ width: `${(count / maxNivel) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white/60 tabular-nums w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
