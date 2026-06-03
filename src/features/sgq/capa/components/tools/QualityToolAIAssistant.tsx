/**
 * QualityToolAIAssistant — Assistente IA (Gemini) para ferramentas da qualidade
 *
 * Usa Gemini 2.5 Flash para sugerir causas, ações e preenchimentos
 * baseado no contexto da NC/CAPA e na ferramenta selecionada.
 *
 * O operador pode pedir sugestões e copiar para o formulário.
 */

import React, { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../../shared/services/firebase';
import { QUALITY_TOOL_LABELS, type QualityToolType } from '../../types/qualityTools';

interface Props {
  toolType: QualityToolType;
  capaTitle: string;
  capaDescription: string;
}

const PROMPTS_BY_TOOL: Record<QualityToolType, string> = {
  'cinco-porques':
    'Sugira uma cadeia de 5 Porquês para investigar a causa raiz desta não conformidade. Para cada "Por quê?", forneça uma pergunta e uma possível resposta baseada no contexto laboratorial. Termine com a causa raiz provável.',
  ishikawa:
    'Sugira possíveis causas para esta não conformidade organizadas nas 6 categorias do Ishikawa (6M): Mão de obra, Método, Material, Máquina, Meio ambiente, Medição. Liste 2-3 causas por categoria, considerando o contexto de laboratório clínico.',
  '5w2h':
    'Sugira um plano de ação 5W2H (O quê, Por quê, Onde, Quando, Quem, Como, Quanto custa) para corrigir esta não conformidade. Considere o contexto de laboratório clínico com equipe técnica.',
  pdca: 'Sugira o preenchimento de um ciclo PDCA para tratar esta não conformidade: Plan (o que investigar e planejar), Do (ações a implementar), Check (como verificar eficácia), Act (como padronizar ou reiniciar).',
  pareto:
    'Sugira categorias típicas para um Diagrama de Pareto relacionado a esta não conformidade em laboratório clínico. Liste 5-8 categorias de causas/tipos que poderiam ser analisadas por frequência.',
  gut: 'Avalie esta não conformidade usando a Matriz GUT. Sugira scores de 1-5 para Gravidade, Urgência e Tendência, justificando cada nota no contexto de laboratório clínico acreditado.',
  '8d': 'Sugira o preenchimento das 8 Disciplinas (8D) para tratar esta não conformidade crítica: D1 (equipe sugerida), D2 (descrição estruturada), D3 (contenção imediata), D4 (causa raiz), D5 (ação corretiva), D6 (implementação), D7 (prevenção), D8 (encerramento).',
  brainstorming:
    'Sugira 8-12 possíveis causas/hipóteses para esta não conformidade, como se fosse uma sessão de brainstorming em laboratório clínico. Inclua causas de diferentes categorias (pessoal, processo, equipamento, ambiente).',
};

export function QualityToolAIAssistant({ toolType, capaTitle, capaDescription }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const askAI = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const callable = httpsCallable<{ prompt: string; context: string }, { text: string }>(
        functions,
        'geminiQualityAssistant',
      );

      const prompt = PROMPTS_BY_TOOL[toolType];
      const context = `Não Conformidade: "${capaTitle}"\nDescrição: "${capaDescription}"\nFerramenta: ${QUALITY_TOOL_LABELS[toolType]}`;

      const result = await callable({ prompt, context });
      setSuggestion(result.data.text);
    } catch (err: any) {
      if (err.code === 'functions/not-found') {
        setError('Função IA não disponível. Sugestões manuais apenas.');
      } else {
        setError(err.message || 'Erro ao consultar IA');
      }
    } finally {
      setLoading(false);
    }
  }, [toolType, capaTitle, capaDescription]);

  const copyToClipboard = () => {
    if (!suggestion) return;
    navigator.clipboard.writeText(suggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/20 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-sm">✦</span>
          <span className="text-xs font-medium text-emerald-300">
            Assistente IA — {QUALITY_TOOL_LABELS[toolType]}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-white/40">
        A IA pode sugerir preenchimentos baseados no contexto da NC. Revise e adapte antes de usar.
      </p>

      {!suggestion && !loading && (
        <button
          type="button"
          onClick={askAI}
          className="w-full px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 text-emerald-300 text-xs font-medium rounded-lg transition-colors"
        >
          Gerar sugestão com IA
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-3">
          <div className="animate-spin w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full" />
          <span className="text-xs text-white/50">Consultando Gemini...</span>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-900/20 border border-red-700/30 rounded-lg">
          <p className="text-xs text-red-300">{error}</p>
          <button
            type="button"
            onClick={askAI}
            className="text-[10px] text-red-400 hover:text-red-300 mt-1"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {suggestion && (
        <div className="space-y-2">
          <div className="max-h-64 overflow-y-auto p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
            <pre className="text-xs text-white/70 whitespace-pre-wrap font-sans leading-relaxed">
              {suggestion}
            </pre>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyToClipboard}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/60 rounded-lg transition-colors"
            >
              {copied ? 'Copiado!' : 'Copiar texto'}
            </button>
            <button
              type="button"
              onClick={askAI}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/60 rounded-lg transition-colors"
            >
              Gerar nova sugestão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
