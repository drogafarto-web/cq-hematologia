/**
 * ParetoForm — Diagrama de Pareto (80/20)
 *
 * Priorização de causas/categorias por frequência.
 * Auto-calcula percentuais e acumulado.
 * DICQ 4.10 — análise de tendência de NCs
 */

import React, { useState, useMemo } from 'react';
import type { ParetoItem, ParetoData } from '../../types/qualityTools';

interface Props {
  initialData?: ParetoData;
  onSave: (data: ParetoData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const INPUT_CLS =
  'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-transparent';

export function ParetoForm({ initialData, onSave, onCancel, saving }: Props) {
  const [periodoInicio, setPeriodoInicio] = useState(initialData?.periodoInicio ?? '');
  const [periodoFim, setPeriodoFim] = useState(initialData?.periodoFim ?? '');
  const [itens, setItens] = useState<ParetoItem[]>(
    initialData?.itens?.length ? initialData.itens : [{ categoria: '', frequencia: 0 }],
  );
  const [conclusao, setConclusao] = useState(initialData?.conclusao ?? '');

  function addItem() {
    setItens([...itens, { categoria: '', frequencia: 0 }]);
  }

  function removeItem(idx: number) {
    if (itens.length <= 1) return;
    setItens(itens.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: 'categoria' | 'frequencia', value: any) {
    const updated = [...itens];
    updated[idx] = {
      ...updated[idx],
      [field]: field === 'frequencia' ? Math.max(0, parseInt(value) || 0) : value,
    };
    setItens(updated);
  }

  const computed = useMemo(() => {
    const valid = itens.filter((i) => i.categoria.trim() && i.frequencia > 0);
    const sorted = [...valid].sort((a, b) => b.frequencia - a.frequencia);
    const total = sorted.reduce((sum, i) => sum + i.frequencia, 0);
    let acumulado = 0;
    return sorted.map((item) => {
      const percentual = total > 0 ? (item.frequencia / total) * 100 : 0;
      acumulado += percentual;
      return {
        ...item,
        percentual: Math.round(percentual * 10) / 10,
        acumulado: Math.round(acumulado * 10) / 10,
      };
    });
  }, [itens]);

  const corte80 = computed.findIndex((i) => i.acumulado! >= 80);
  const isValid = computed.length >= 2;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      tipo: 'pareto',
      periodoInicio,
      periodoFim,
      itens: computed,
      conclusao: conclusao.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">
          ▊
        </span>
        <h3 className="text-lg font-semibold text-white">Diagrama de Pareto</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Período início</label>
          <input
            type="date"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            className={INPUT_CLS}
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Período fim</label>
          <input
            type="date"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            className={INPUT_CLS}
            disabled={saving}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">
          Categorias e frequências <span className="text-red-400">*</span>
        </label>
        <p className="text-[10px] text-white/30">
          Mínimo 2 categorias. Ex: tipos de NC, setores, causas recorrentes.
        </p>
        {itens.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="text"
              value={item.categoria}
              onChange={(e) => updateItem(idx, 'categoria', e.target.value)}
              placeholder="Categoria..."
              className={`${INPUT_CLS} flex-1`}
              disabled={saving}
            />
            <input
              type="number"
              value={item.frequencia || ''}
              onChange={(e) => updateItem(idx, 'frequencia', e.target.value)}
              placeholder="Freq"
              className={`${INPUT_CLS} w-20 text-center tabular-nums`}
              min={0}
              disabled={saving}
            />
            {itens.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-red-400/60 hover:text-red-400 text-xs"
                disabled={saving}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="text-xs text-violet-400 hover:text-violet-300"
          disabled={saving}
        >
          + categoria
        </button>
      </div>

      {/* Visual Pareto */}
      {computed.length >= 2 && (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <p className="text-xs font-medium text-white/60 mb-3">
            Resultado (ordenado por frequência):
          </p>
          {computed.map((item, idx) => {
            const isVitalFew = idx <= corte80;
            return (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="w-28 truncate text-white/70">{item.categoria}</span>
                <div className="flex-1 h-4 bg-white/[0.04] rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${isVitalFew ? 'bg-violet-500/60' : 'bg-white/10'}`}
                    style={{ width: `${item.percentual}%` }}
                  />
                </div>
                <span className="w-10 text-right tabular-nums text-white/50">
                  {item.frequencia}
                </span>
                <span className="w-12 text-right tabular-nums text-white/40">
                  {item.percentual}%
                </span>
                <span
                  className={`w-14 text-right tabular-nums ${item.acumulado! >= 80 && idx === corte80 ? 'text-amber-400' : 'text-white/30'}`}
                >
                  {item.acumulado}%
                </span>
              </div>
            );
          })}
          {corte80 >= 0 && (
            <p className="text-[10px] text-amber-400 mt-2">
              Linha 80%: as {corte80 + 1} primeiras categorias representam{' '}
              {computed[corte80]?.acumulado}% das ocorrências
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">Conclusão / Priorização</label>
        <textarea
          value={conclusao}
          onChange={(e) => setConclusao(e.target.value)}
          placeholder="Com base no Pareto, quais categorias devem ser priorizadas?"
          className={`${INPUT_CLS} resize-none`}
          rows={2}
          disabled={saving}
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/[0.15] text-white rounded-lg transition-colors"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || saving}
          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Pareto'}
        </button>
      </div>
    </form>
  );
}
