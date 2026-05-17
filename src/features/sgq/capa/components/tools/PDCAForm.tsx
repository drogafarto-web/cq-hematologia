/**
 * PDCAForm — Ciclo Plan-Do-Check-Act
 *
 * Framework de melhoria contínua. DICQ 4.12 + ISO 15189 cl. 10
 */

import React, { useState } from 'react';
import type { PDCAData, PDCAFase } from '../../types/qualityTools';

interface Props {
  initialData?: PDCAData;
  onSave: (data: PDCAData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const INPUT_CLS = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-transparent';

const FASE_INFO: Record<PDCAFase, { label: string; color: string; hint: string }> = {
  plan: { label: 'Plan (Planejar)', color: 'text-blue-400', hint: 'Identifique o problema, analise causas, defina metas e ações' },
  do: { label: 'Do (Executar)', color: 'text-emerald-400', hint: 'Implemente as ações planejadas, treine a equipe' },
  check: { label: 'Check (Verificar)', color: 'text-amber-400', hint: 'Monitore indicadores, compare resultados com metas' },
  act: { label: 'Act (Agir)', color: 'text-violet-400', hint: 'Padronize se eficaz, ou inicie novo ciclo se ineficaz' },
};

export function PDCAForm({ initialData, onSave, onCancel, saving }: Props) {
  const [objetivo, setObjetivo] = useState(initialData?.objetivo ?? '');
  const [indicadorSucesso, setIndicadorSucesso] = useState(initialData?.indicadorSucesso ?? '');
  const [fases, setFases] = useState(initialData?.fases ?? { plan: '', do: '', check: '', act: '' });
  const [faseAtual, setFaseAtual] = useState<PDCAFase>(initialData?.faseAtual ?? 'plan');
  const [resultado, setResultado] = useState<'em-andamento' | 'eficaz' | 'novo-ciclo'>(initialData?.resultado ?? 'em-andamento');

  function updateFase(fase: PDCAFase, value: string) {
    setFases({ ...fases, [fase]: value });
  }

  const isValid = objetivo.trim().length >= 5 && fases.plan.trim().length >= 5;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      tipo: 'pdca',
      objetivo: objetivo.trim(),
      indicadorSucesso: indicadorSucesso.trim(),
      fases,
      faseAtual,
      resultado,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">↻</span>
        <h3 className="text-lg font-semibold text-white">Ciclo PDCA</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/90">Objetivo do ciclo <span className="text-red-400">*</span></label>
          <input type="text" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="O que este ciclo pretende resolver?" className={INPUT_CLS} disabled={saving} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/90">Indicador de sucesso</label>
          <input type="text" value={indicadorSucesso} onChange={(e) => setIndicadorSucesso(e.target.value)} placeholder="Como medir se funcionou?" className={INPUT_CLS} disabled={saving} />
        </div>
      </div>

      <div className="space-y-3">
        {(Object.keys(FASE_INFO) as PDCAFase[]).map((fase) => (
          <div key={fase} className={`p-3 rounded-xl border ${faseAtual === fase ? 'bg-white/[0.04] border-violet-500/30' : 'bg-white/[0.01] border-white/[0.06]'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${FASE_INFO[fase].color}`}>
                {FASE_INFO[fase].label}
              </span>
              <button type="button" onClick={() => setFaseAtual(fase)} className={`text-[10px] px-2 py-0.5 rounded ${faseAtual === fase ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-white/40 hover:text-white/60'}`}>
                {faseAtual === fase ? 'Fase atual' : 'Marcar como atual'}
              </button>
            </div>
            <p className="text-[10px] text-white/30 mb-2">{FASE_INFO[fase].hint}</p>
            <textarea
              value={fases[fase]}
              onChange={(e) => updateFase(fase, e.target.value)}
              placeholder={`Descreva o que foi feito nesta fase...`}
              className={`${INPUT_CLS} resize-none`}
              rows={3}
              disabled={saving}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">Resultado do ciclo</label>
        <select value={resultado} onChange={(e) => setResultado(e.target.value as any)} className={INPUT_CLS} disabled={saving}>
          <option value="em-andamento">Em andamento</option>
          <option value="eficaz">Eficaz — padronizar</option>
          <option value="novo-ciclo">Ineficaz — novo ciclo necessário</option>
        </select>
      </div>

      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/[0.15] text-white rounded-lg transition-colors" disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={!isValid || saving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
          {saving ? 'Salvando...' : 'Salvar ciclo'}
        </button>
      </div>
    </form>
  );
}
