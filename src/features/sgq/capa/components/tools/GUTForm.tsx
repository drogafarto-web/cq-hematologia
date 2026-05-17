/**
 * GUTForm — Matriz GUT (Gravidade × Urgência × Tendência)
 *
 * Priorização de problemas/NCs quando há múltiplos abertos.
 * Score = G × U × T (1-125). Maior score = maior prioridade.
 */

import React, { useState } from 'react';
import type { GUTItem, GUTData } from '../../types/qualityTools';

interface Props {
  initialData?: GUTData;
  onSave: (data: GUTData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const INPUT_CLS = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-transparent';

const SCALE_LABELS = {
  gravidade: ['1 — Sem gravidade', '2 — Pouco grave', '3 — Grave', '4 — Muito grave', '5 — Extremamente grave'],
  urgencia: ['1 — Pode esperar', '2 — Pouco urgente', '3 — Urgente', '4 — Muito urgente', '5 — Ação imediata'],
  tendencia: ['1 — Não piora', '2 — Piora a longo prazo', '3 — Piora a médio prazo', '4 — Piora a curto prazo', '5 — Piora rapidamente'],
};

const EMPTY_ITEM: GUTItem = { problema: '', gravidade: 3, urgencia: 3, tendencia: 3 };

export function GUTForm({ initialData, onSave, onCancel, saving }: Props) {
  const [itens, setItens] = useState<GUTItem[]>(
    initialData?.itens?.length ? initialData.itens : [{ ...EMPTY_ITEM }]
  );
  const [decisao, setDecisao] = useState(initialData?.decisao ?? '');

  function addItem() {
    setItens([...itens, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    if (itens.length <= 1) return;
    setItens(itens.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof GUTItem, value: any) {
    const updated = [...itens];
    updated[idx] = { ...updated[idx], [field]: value };
    setItens(updated);
  }

  function getScore(item: GUTItem): number {
    return item.gravidade * item.urgencia * item.tendencia;
  }

  function getScoreColor(score: number): string {
    if (score >= 64) return 'text-red-400';
    if (score >= 27) return 'text-amber-400';
    return 'text-emerald-400';
  }

  const sorted = [...itens].map((item, idx) => ({ ...item, idx, score: getScore(item) })).sort((a, b) => b.score - a.score);
  const isValid = itens.some((i) => i.problema.trim().length >= 3);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      tipo: 'gut',
      itens: itens.filter((i) => i.problema.trim()).map((i) => ({ ...i, score: getScore(i) })),
      decisao: decisao.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">◆</span>
        <h3 className="text-lg font-semibold text-white">Matriz GUT</h3>
      </div>

      <div className="space-y-4">
        {itens.map((item, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">#{idx + 1}</span>
                <span className={`text-sm font-bold tabular-nums ${getScoreColor(getScore(item))}`}>
                  GUT = {getScore(item)}
                </span>
              </div>
              {itens.length > 1 && (
                <button type="button" onClick={() => removeItem(idx)} className="text-red-400/60 hover:text-red-400 text-xs" disabled={saving}>
                  Remover
                </button>
              )}
            </div>

            <input
              type="text"
              value={item.problema}
              onChange={(e) => updateItem(idx, 'problema', e.target.value)}
              placeholder="Descreva o problema/NC..."
              className={INPUT_CLS}
              disabled={saving}
            />

            <div className="grid grid-cols-3 gap-2">
              {(['gravidade', 'urgencia', 'tendencia'] as const).map((dim) => (
                <div key={dim} className="space-y-1">
                  <label className="text-[10px] font-medium text-white/50 uppercase">{dim.charAt(0).toUpperCase()}</label>
                  <select
                    value={item[dim]}
                    onChange={(e) => updateItem(idx, dim, parseInt(e.target.value) as any)}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white"
                    disabled={saving}
                  >
                    {SCALE_LABELS[dim].map((label, i) => (
                      <option key={i} value={i + 1}>{label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addItem} className="text-xs text-violet-400 hover:text-violet-300" disabled={saving}>
        + Adicionar problema
      </button>

      {itens.filter((i) => i.problema.trim()).length > 1 && (
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-xs font-medium text-white/60 mb-2">Ranking por prioridade:</p>
          <ol className="space-y-1">
            {sorted.filter((i) => i.problema.trim()).map((item, rank) => (
              <li key={item.idx} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-white/40">{rank + 1}.</span>
                <span className={`font-bold tabular-nums ${getScoreColor(item.score)}`}>{item.score}</span>
                <span className="text-white/70 truncate">{item.problema}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">Decisão de priorização</label>
        <textarea value={decisao} onChange={(e) => setDecisao(e.target.value)} placeholder="Com base no ranking, qual problema será tratado primeiro e por quê?" className={`${INPUT_CLS} resize-none`} rows={2} disabled={saving} />
      </div>

      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/[0.15] text-white rounded-lg transition-colors" disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={!isValid || saving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
          {saving ? 'Salvando...' : 'Salvar matriz'}
        </button>
      </div>
    </form>
  );
}
