/**
 * CincosPorquesForm — Formulário 5 Porquês
 *
 * Pergunte "Por quê?" iterativamente (3-7x) até encontrar a causa raiz.
 * DICQ 4.10.1 — investigação de causa raiz
 */

import React, { useState } from 'react';
import type { CincosPorquesData } from '../../types/qualityTools';

interface Props {
  initialData?: CincosPorquesData;
  onSave: (data: CincosPorquesData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const INPUT_CLS = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-transparent';

export function CincosPorquesForm({ initialData, onSave, onCancel, saving }: Props) {
  const [problema, setProblema] = useState(initialData?.problema ?? '');
  const [porques, setPorques] = useState<{ pergunta: string; resposta: string }[]>(
    initialData?.porques ?? [{ pergunta: 'Por que isso aconteceu?', resposta: '' }]
  );
  const [causaRaiz, setCausaRaiz] = useState(initialData?.causaRaiz ?? '');
  const [evidencia, setEvidencia] = useState(initialData?.evidencia ?? '');

  function addPorque() {
    if (porques.length >= 7) return;
    const n = porques.length + 1;
    setPorques([...porques, { pergunta: `Por que (${n})?`, resposta: '' }]);
  }

  function updatePorque(idx: number, field: 'pergunta' | 'resposta', value: string) {
    const updated = [...porques];
    updated[idx] = { ...updated[idx], [field]: value };
    setPorques(updated);
  }

  function removePorque(idx: number) {
    if (porques.length <= 1) return;
    setPorques(porques.filter((_, i) => i !== idx));
  }

  const isValid = problema.trim().length >= 5 && porques.some((p) => p.resposta.trim().length > 0) && causaRaiz.trim().length >= 5;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      tipo: 'cinco-porques',
      problema: problema.trim(),
      porques: porques.filter((p) => p.resposta.trim()),
      causaRaiz: causaRaiz.trim(),
      evidencia: evidencia.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">?</span>
        <h3 className="text-lg font-semibold text-white">5 Porquês</h3>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">
          Problema / NC <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={problema}
          onChange={(e) => setProblema(e.target.value)}
          placeholder="Descreva o problema observado..."
          className={INPUT_CLS}
          disabled={saving}
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-white/90">
          Cadeia de porquês <span className="text-red-400">*</span>
        </label>
        {porques.map((p, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs text-white/60 mt-2">
              {idx + 1}
            </span>
            <div className="flex-1 space-y-1">
              <input
                type="text"
                value={p.pergunta}
                onChange={(e) => updatePorque(idx, 'pergunta', e.target.value)}
                className={`${INPUT_CLS} text-xs text-white/60`}
                placeholder="Pergunta..."
                disabled={saving}
              />
              <textarea
                value={p.resposta}
                onChange={(e) => updatePorque(idx, 'resposta', e.target.value)}
                className={`${INPUT_CLS} resize-none`}
                rows={2}
                placeholder="Resposta..."
                disabled={saving}
              />
            </div>
            {porques.length > 1 && (
              <button type="button" onClick={() => removePorque(idx)} className="text-red-400/60 hover:text-red-400 text-xs mt-2" disabled={saving}>
                ✕
              </button>
            )}
          </div>
        ))}
        {porques.length < 7 && (
          <button type="button" onClick={addPorque} className="text-xs text-violet-400 hover:text-violet-300" disabled={saving}>
            + Adicionar mais um "Por quê?"
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">
          Causa raiz identificada <span className="text-red-400">*</span>
        </label>
        <textarea
          value={causaRaiz}
          onChange={(e) => setCausaRaiz(e.target.value)}
          placeholder="Qual é a causa raiz fundamental?"
          className={`${INPUT_CLS} resize-none`}
          rows={3}
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">Evidência de suporte</label>
        <textarea
          value={evidencia}
          onChange={(e) => setEvidencia(e.target.value)}
          placeholder="Dados, registros ou observações que confirmam a causa raiz..."
          className={`${INPUT_CLS} resize-none`}
          rows={2}
          disabled={saving}
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/[0.15] text-white rounded-lg transition-colors" disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={!isValid || saving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
          {saving ? 'Salvando...' : 'Salvar análise'}
        </button>
      </div>
    </form>
  );
}
