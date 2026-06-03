/**
 * QualityToolPicker — Seletor de ferramentas da qualidade
 *
 * Operador escolhe qual ferramenta usar para tratar a NC/CAPA.
 * Cards com resumo educativo + quando usar + fase do workflow.
 * DICQ 4.10 + ISO 15189 10.2
 */

import React, { useState } from 'react';
import {
  QUALITY_TOOL_LABELS,
  QUALITY_TOOL_DESCRIPTIONS,
  QUALITY_TOOL_PHASES,
  type QualityToolType,
} from '../../types/qualityTools';

interface QualityToolPickerProps {
  onSelect: (tool: QualityToolType) => void;
  usedTools?: QualityToolType[];
}

const TOOL_ICONS: Record<QualityToolType, string> = {
  'cinco-porques': '?',
  ishikawa: '⟨',
  '5w2h': 'W',
  pdca: '↻',
  pareto: '▊',
  gut: '◆',
  '8d': '8',
  brainstorming: '💡',
};

const TOOL_ORDER: QualityToolType[] = [
  'cinco-porques',
  'ishikawa',
  'brainstorming',
  '5w2h',
  'pdca',
  'gut',
  'pareto',
  '8d',
];

const TOOL_EDUCATION: Record<
  QualityToolType,
  { quando: string; exemplo: string; complexidade: string }
> = {
  'cinco-porques': {
    quando:
      'NC simples com causa única provável. Ideal para primeiro contato com análise de causa raiz.',
    exemplo:
      '"Resultado errado" → Por quê? Reagente vencido → Por quê? Não verificou validade → Por quê? Sem checklist de abertura → Causa raiz: falta de POP de verificação.',
    complexidade: 'Baixa (5-15 min)',
  },
  ishikawa: {
    quando:
      'NC com múltiplas causas possíveis. Ferramenta mais esperada por auditores DICQ. Use quando não sabe por onde começar.',
    exemplo:
      'Resultado fora do controle → mapear causas em 6M: operador sem treinamento (Mão de obra), POP desatualizado (Método), reagente de lote novo (Material)...',
    complexidade: 'Média (20-40 min com equipe)',
  },
  brainstorming: {
    quando:
      'Antes do Ishikawa — quando a equipe precisa gerar hipóteses livremente. Ideal com 3-8 pessoas de setores diferentes.',
    exemplo:
      'Reunião de 30 min: cada participante sugere causas sem julgamento → depois agrupa por categoria → seleciona as mais prováveis para investigar.',
    complexidade: 'Baixa (30-60 min em grupo)',
  },
  '5w2h': {
    quando:
      'APÓS identificar a causa raiz. Use para detalhar cada ação corretiva com responsável, prazo e custo.',
    exemplo:
      'O quê: Treinar equipe no novo POP | Por quê: Causa raiz foi falta de conhecimento | Quem: RT | Quando: até 15/06 | Como: Treinamento presencial + avaliação.',
    complexidade: 'Baixa (10-20 min por ação)',
  },
  pdca: {
    quando:
      'Ciclo completo de melhoria. Use quando quer acompanhar desde o planejamento até a verificação de eficácia em um único registro.',
    exemplo:
      'Plan: identificar causa → Do: implementar treinamento → Check: monitorar indicador 30 dias → Act: padronizar se eficaz ou reiniciar ciclo.',
    complexidade: 'Média (ciclo de 30-90 dias)',
  },
  gut: {
    quando:
      'Múltiplas NCs abertas e precisa decidir qual tratar primeiro. Prioriza por impacto real.',
    exemplo:
      '3 NCs abertas: NC-01 (GUT=100), NC-02 (GUT=36), NC-03 (GUT=12) → tratar NC-01 primeiro por ter maior score.',
    complexidade: 'Baixa (5-10 min)',
  },
  pareto: {
    quando:
      'Análise de tendência — quando quer ver quais tipos de NC são mais frequentes no período. Ideal para reunião de análise crítica.',
    exemplo:
      '6 meses de NCs: 40% são de "POP não seguido", 25% "equipamento", 15% "reagente" → focar em adesão a POPs resolve 40% das NCs.',
    complexidade: 'Média (requer dados históricos)',
  },
  '8d': {
    quando:
      'NCs CRÍTICAS ou sistêmicas que afetam pacientes ou acreditação. Metodologia mais completa — use quando a NC é grave e precisa de equipe dedicada.',
    exemplo:
      'Resultado crítico não comunicado ao médico → equipe de 4 pessoas → contenção imediata → investigação formal → ação permanente → prevenção → encerramento com RT.',
    complexidade: 'Alta (dias a semanas, equipe dedicada)',
  },
};

export function QualityToolPicker({ onSelect, usedTools = [] }: QualityToolPickerProps) {
  const [expanded, setExpanded] = useState<QualityToolType | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-white/90 mb-1">Ferramentas da Qualidade</h3>
        <p className="text-xs text-white/40">
          Escolha a metodologia para investigar e tratar esta NC. Clique para ver detalhes de cada
          ferramenta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {TOOL_ORDER.map((tool) => {
          const isUsed = usedTools.includes(tool);
          const isExpanded = expanded === tool;
          const edu = TOOL_EDUCATION[tool];

          return (
            <div
              key={tool}
              className={`rounded-xl border transition-all ${
                isUsed
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : tool)}
                className="w-full text-left p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm font-bold text-violet-400">
                    {TOOL_ICONS[tool]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/90">
                        {QUALITY_TOOL_LABELS[tool]}
                      </span>
                      {isUsed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                          usado
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 ml-auto">
                        {edu.complexidade}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">
                      {QUALITY_TOOL_DESCRIPTIONS[tool]}
                    </p>
                    <p className="text-[10px] text-white/30 mt-1">
                      Fase: {QUALITY_TOOL_PHASES[tool]}
                    </p>
                  </div>
                  <span
                    className={`text-white/30 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    ▼
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3 ml-11">
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                      Quando usar
                    </p>
                    <p className="text-xs text-white/60">{edu.quando}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                      Exemplo prático
                    </p>
                    <p className="text-xs text-white/50 italic">{edu.exemplo}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(tool);
                    }}
                    className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Usar {QUALITY_TOOL_LABELS[tool]}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
