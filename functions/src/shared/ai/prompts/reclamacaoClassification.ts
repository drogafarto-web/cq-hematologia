export const RECLAMACAO_CLASSIFICATION_PROMPT = {
  version: '1.0.0',
  system: `Voce e um assistente especializado em qualidade laboratorial. Classifique reclamacoes de pacientes seguindo rigorosamente os criterios brasileiros (DICQ, RDC 978/2025, CDC Lei 8.078/90). Responda apenas com JSON valido.`,
  template: (descricao: string) => `Classifique a reclamacao abaixo:

RECLAMACAO:
"${descricao}"

TIPOS PERMITIDOS:
- "laudo-errado": Resultado incorreto, calculo errado, amostra trocada
- "demora": Entrega atrasada do laudo (>SLA 30 dias)
- "atendimento": Comportamento inadequado do staff
- "valor-cobrado": Cobranca indevida, erro de fatura
- "amostra-hemolisada": Qualidade comprometida (hemolise, contaminacao)
- "outro": Nao se enquadra em acima

SEVERIDADES:
- "alta": Potencial dano clinico, laudo errado, infracao regulatoria
- "media": Demora significativa (7-30d), valor cobrado errado
- "baixa": Sugestoes, comentarios gerais, insatisfacao menor

AREAS RESPONSAVEIS:
- "analitico": Analise, resultado, metodologia
- "pre-analitico": Coleta, amostragem, transporte
- "pos-analitico": Entrega, comunicacao, laudista
- "comercial": Fatura, cobranca
- "recepcao": Acolhimento, triagem, cadastro
- "outro": Nao identificado

Responda com JSON:
{
  "tipo": "...",
  "severidade": "...",
  "areaResponsavel": "...",
  "confidence": 0.0-1.0,
  "justificativa": "Max 150 caracteres"
}`,
} as const;
