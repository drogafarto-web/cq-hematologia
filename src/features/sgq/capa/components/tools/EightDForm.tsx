/**
 * EightDForm — 8 Disciplinas (8D)
 *
 * Metodologia completa para NCs críticas/sistêmicas.
 * D1-D8: Equipe → Descrição → Contenção → Causa raiz → Ação corretiva →
 * Implementação → Prevenção → Reconhecimento
 */

import React, { useState } from 'react';
import type { EightDData } from '../../types/qualityTools';

interface Props {
  initialData?: EightDData;
  onSave: (data: EightDData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const INPUT_CLS = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-transparent';

const STEPS = [
  { key: 'd1', label: 'D1 — Equipe', hint: 'Defina os membros e o líder da investigação' },
  { key: 'd2', label: 'D2 — Descrição do Problema', hint: 'Descreva o problema com dados objetivos (É/Não é)' },
  { key: 'd3', label: 'D3 — Ação de Contenção', hint: 'Ação imediata para conter o impacto enquanto investiga' },
  { key: 'd4', label: 'D4 — Causa Raiz', hint: 'Use Ishikawa + 5 Porquês para identificar a causa fundamental' },
  { key: 'd5', label: 'D5 — Ação Corretiva Permanente', hint: 'Solução definitiva que elimina a causa raiz' },
  { key: 'd6', label: 'D6 — Implementação', hint: 'Plano de execução da ação corretiva (quem, quando, como)' },
  { key: 'd7', label: 'D7 — Prevenção de Recorrência', hint: 'Padronização, treinamento, poka-yoke, atualização de POP' },
  { key: 'd8', label: 'D8 — Reconhecimento', hint: 'Encerramento formal e reconhecimento da equipe' },
] as const;

export function EightDForm({ initialData, onSave, onCancel, saving }: Props) {
  const [membros, setMembros] = useState(initialData?.d1_equipe?.membros?.join(', ') ?? '');
  const [lider, setLider] = useState(initialData?.d1_equipe?.lider ?? '');
  const [d2, setD2] = useState(initialData?.d2_descricao ?? '');
  const [d3Acao, setD3Acao] = useState(initialData?.d3_contencao?.acao ?? '');
  const [d3Resp, setD3Resp] = useState(initialData?.d3_contencao?.responsavel ?? '');
  const [d3Prazo, setD3Prazo] = useState(initialData?.d3_contencao?.prazo ?? '');
  const [d4, setD4] = useState(initialData?.d4_causaRaiz ?? '');
  const [d5, setD5] = useState(initialData?.d5_acaoCorretiva ?? '');
  const [d6, setD6] = useState(initialData?.d6_implementacao ?? '');
  const [d7, setD7] = useState(initialData?.d7_prevencao ?? '');
  const [d8, setD8] = useState(initialData?.d8_reconhecimento ?? '');

  const isValid = lider.trim().length >= 2 && d2.trim().length >= 10 && d4.trim().length >= 5;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      tipo: '8d',
      d1_equipe: { membros: membros.split(',').map((m) => m.trim()).filter(Boolean), lider: lider.trim() },
      d2_descricao: d2.trim(),
      d3_contencao: { acao: d3Acao.trim(), responsavel: d3Resp.trim(), prazo: d3Prazo.trim() },
      d4_causaRaiz: d4.trim(),
      d5_acaoCorretiva: d5.trim(),
      d6_implementacao: d6.trim(),
      d7_prevencao: d7.trim(),
      d8_reconhecimento: d8.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">8</span>
        <h3 className="text-lg font-semibold text-white">8D — Oito Disciplinas</h3>
      </div>

      {/* D1 — Equipe */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
        <p className="text-xs font-semibold text-violet-400">{STEPS[0].label}</p>
        <p className="text-[10px] text-white/30">{STEPS[0].hint}</p>
        <input type="text" value={lider} onChange={(e) => setLider(e.target.value)} placeholder="Líder da investigação *" className={INPUT_CLS} disabled={saving} />
        <input type="text" value={membros} onChange={(e) => setMembros(e.target.value)} placeholder="Membros (separados por vírgula)" className={INPUT_CLS} disabled={saving} />
      </div>

      {/* D2 — Descrição */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
        <p className="text-xs font-semibold text-violet-400">{STEPS[1].label}</p>
        <p className="text-[10px] text-white/30">{STEPS[1].hint}</p>
        <textarea value={d2} onChange={(e) => setD2(e.target.value)} placeholder="Descrição detalhada do problema *" className={`${INPUT_CLS} resize-none`} rows={3} disabled={saving} />
      </div>

      {/* D3 — Contenção */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
        <p className="text-xs font-semibold text-violet-400">{STEPS[2].label}</p>
        <p className="text-[10px] text-white/30">{STEPS[2].hint}</p>
        <input type="text" value={d3Acao} onChange={(e) => setD3Acao(e.target.value)} placeholder="Ação de contenção imediata" className={INPUT_CLS} disabled={saving} />
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={d3Resp} onChange={(e) => setD3Resp(e.target.value)} placeholder="Responsável" className={INPUT_CLS} disabled={saving} />
          <input type="text" value={d3Prazo} onChange={(e) => setD3Prazo(e.target.value)} placeholder="Prazo" className={INPUT_CLS} disabled={saving} />
        </div>
      </div>

      {/* D4 — Causa Raiz */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
        <p className="text-xs font-semibold text-violet-400">{STEPS[3].label}</p>
        <p className="text-[10px] text-white/30">{STEPS[3].hint}</p>
        <textarea value={d4} onChange={(e) => setD4(e.target.value)} placeholder="Causa raiz identificada *" className={`${INPUT_CLS} resize-none`} rows={3} disabled={saving} />
      </div>

      {/* D5 — Ação Corretiva */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
        <p className="text-xs font-semibold text-violet-400">{STEPS[4].label}</p>
        <p className="text-[10px] text-white/30">{STEPS[4].hint}</p>
        <textarea value={d5} onChange={(e) => setD5(e.target.value)} placeholder="Ação corretiva permanente" className={`${INPUT_CLS} resize-none`} rows={2} disabled={saving} />
      </div>

      {/* D6 — Implementação */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
        <p className="text-xs font-semibold text-violet-400">{STEPS[5].label}</p>
        <p className="text-[10px] text-white/30">{STEPS[5].hint}</p>
        <textarea value={d6} onChange={(e) => setD6(e.target.value)} placeholder="Plano de implementação" className={`${INPUT_CLS} resize-none`} rows={2} disabled={saving} />
      </div>

      {/* D7 — Prevenção */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
        <p className="text-xs font-semibold text-violet-400">{STEPS[6].label}</p>
        <p className="text-[10px] text-white/30">{STEPS[6].hint}</p>
        <textarea value={d7} onChange={(e) => setD7(e.target.value)} placeholder="Ações de prevenção de recorrência" className={`${INPUT_CLS} resize-none`} rows={2} disabled={saving} />
      </div>

      {/* D8 — Reconhecimento */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
        <p className="text-xs font-semibold text-violet-400">{STEPS[7].label}</p>
        <p className="text-[10px] text-white/30">{STEPS[7].hint}</p>
        <textarea value={d8} onChange={(e) => setD8(e.target.value)} placeholder="Reconhecimento da equipe e encerramento" className={`${INPUT_CLS} resize-none`} rows={2} disabled={saving} />
      </div>

      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/[0.15] text-white rounded-lg transition-colors" disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={!isValid || saving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
          {saving ? 'Salvando...' : 'Salvar 8D'}
        </button>
      </div>
    </form>
  );
}
