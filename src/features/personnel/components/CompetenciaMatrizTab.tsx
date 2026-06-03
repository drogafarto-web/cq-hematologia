/**
 * personnel/components/CompetenciaMatrizTab.tsx
 *
 * Grid visual: Colaboradores (linhas) x Itens (colunas).
 * Células coloridas por nível de competência.
 * DICQ 5.1.4 + ISO 15189:2022 6.2.3
 */

import React, { useState } from 'react';
import { useCompetenciaMatriz } from '../hooks/useCompetenciaMatriz';
import { CompetenciaFormModal } from './CompetenciaFormModal';
import { AvaliacoesResumoCard } from './AvaliacoesResumoCard';
import type {
  CategoriaCompetencia,
  CompetenciaTecnica,
  NivelCompetencia,
} from '../types/CompetenciaMatriz';
import { NIVEL_LABEL, CATEGORIA_LABEL } from '../types/CompetenciaMatriz';

// ─── Visual tokens ──────────────────────────────────────────────────────────

const NIVEL_CELL: Record<NivelCompetencia, { bg: string; text: string; short: string }> = {
  nao_habilitado: { bg: 'bg-slate-800/40', text: 'text-slate-500', short: '—' },
  em_treinamento: { bg: 'bg-amber-500/20', text: 'text-amber-300', short: 'ET' },
  habilitado: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', short: 'H' },
  especialista: { bg: 'bg-violet-500/20', text: 'text-violet-300', short: 'E' },
};

interface CompetenciaMatrizTabProps {}

export function CompetenciaMatrizTab(_props: CompetenciaMatrizTabProps) {
  const [categoriaFilter, setCategoriaFilter] = useState<CategoriaCompetencia | ''>('');
  const { competencias, loading, error, grid, colaboradores, itens, alertas, upsert, remove } =
    useCompetenciaMatriz(categoriaFilter ? { categoria: categoriaFilter } : undefined);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CompetenciaTecnica | null>(null);
  const [prefilledColaboradorId, setPrefilledColaboradorId] = useState<string | undefined>();
  const [prefilledItemId, setPrefilledItemId] = useState<string | undefined>();

  const handleCellClick = (colaboradorId: string, itemId: string) => {
    const existing = grid.get(colaboradorId)?.get(itemId);
    if (existing) {
      setEditingItem(existing);
    } else {
      setEditingItem(null);
      setPrefilledColaboradorId(colaboradorId);
      setPrefilledItemId(itemId);
    }
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setPrefilledColaboradorId(undefined);
    setPrefilledItemId(undefined);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const now = Date.now();
  const isVencendo = (c: CompetenciaTecnica | undefined) => {
    if (!c?.dataProximaAvaliacao) return false;
    const diff = c.dataProximaAvaliacao.toDate().getTime() - now;
    return diff <= 30 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="space-y-4">
      {/* Resumo de Avaliações */}
      <AvaliacoesResumoCard />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white/90">Matriz de Competencias Tecnicas</h3>
          <p className="text-xs text-white/40 mt-0.5">
            DICQ 5.1.4 — Colaborador x Analito/Equipamento/Procedimento
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro categoria */}
          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value as CategoriaCompetencia | '')}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.09] text-xs text-white/80"
          >
            <option value="">Todas categorias</option>
            <option value="analito">Analitos</option>
            <option value="equipamento">Equipamentos</option>
            <option value="procedimento">Procedimentos</option>
          </select>
          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar
          </button>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs font-medium text-amber-300">
            {alertas.length} competencia(s) com avaliacao vencendo ou vencida
          </p>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-3">
        {(
          Object.entries(NIVEL_CELL) as [NivelCompetencia, (typeof NIVEL_CELL)[NivelCompetencia]][]
        ).map(([nivel, cfg]) => (
          <div key={nivel} className="flex items-center gap-1.5">
            <span
              className={`w-5 h-5 rounded ${cfg.bg} flex items-center justify-center text-[9px] font-bold ${cfg.text}`}
            >
              {cfg.short}
            </span>
            <span className="text-[10px] text-white/40">{NIVEL_LABEL[nivel]}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-white/40 text-center py-8">Carregando...</p>
      ) : error ? (
        <p className="text-sm text-red-400 text-center py-4">{error.message}</p>
      ) : competencias.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-white/[0.08] rounded-xl">
          <p className="text-sm text-white/40">Nenhuma competencia registrada.</p>
          <p className="text-xs text-white/25 mt-1">
            Clique em &quot;Adicionar&quot; para mapear colaboradores a analitos, equipamentos ou
            procedimentos.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="text-left px-3 py-2 text-white/50 font-medium sticky left-0 bg-[#141417] z-10 min-w-[140px]">
                  Colaborador
                </th>
                {itens.map((item) => (
                  <th
                    key={item.id}
                    className="px-2 py-2 text-white/50 font-medium text-center min-w-[80px]"
                    title={`${CATEGORIA_LABEL[item.categoria]}: ${item.nome}`}
                  >
                    <div className="truncate max-w-[80px]">{item.nome}</div>
                    <div className="text-[9px] text-white/25 font-normal">
                      {CATEGORIA_LABEL[item.categoria]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((colab) => (
                <tr key={colab.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-white/80 font-medium sticky left-0 bg-[#141417] z-10">
                    {colab.nome}
                  </td>
                  {itens.map((item) => {
                    const cell = grid.get(colab.id)?.get(item.id);
                    const nivel = cell?.nivel || 'nao_habilitado';
                    const cfg = NIVEL_CELL[nivel];
                    const vencendo = isVencendo(cell);

                    return (
                      <td key={item.id} className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleCellClick(colab.id, item.id)}
                          className={`w-full h-8 rounded-lg ${cfg.bg} ${cfg.text} font-bold text-[10px] transition-all hover:scale-105 hover:ring-1 hover:ring-white/20 ${
                            vencendo ? 'ring-1 ring-amber-400/50 animate-pulse' : ''
                          }`}
                          title={
                            cell
                              ? `${NIVEL_LABEL[nivel]}${vencendo ? ' (vencendo!)' : ''}`
                              : 'Clique para registrar'
                          }
                        >
                          {cfg.short}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <CompetenciaFormModal
          editing={editingItem}
          prefilledColaboradorId={prefilledColaboradorId}
          prefilledItemId={prefilledItemId}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
