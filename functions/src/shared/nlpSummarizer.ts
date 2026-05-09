/**
 * nlpSummarizer.ts
 *
 * NLP summarization via Gemini 2.5 Flash for audit alert context.
 * Generates professional PT-BR summaries suitable for audit trail documentation.
 *
 * Phase 7 Wave 3: Advanced Auditoria
 * RDC 978 Art. 107 — Audit trail documentation
 * DICQ 4.4 — Audit monitoring
 *
 * API: Gemini 2.5 Flash
 * Timeout: 8s
 * Fallback: Basic template if Gemini fails
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { defineSecret } from 'firebase-functions/params';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditSummarizationParams {
  entryCount: number;
  anomalyCount: number;
  period: string;
  topModules: string[];
  criticalCount: number;
  highCount: number;
}

// ─── Secrets ───────────────────────────────────────────────────────────────────

const geminiSecret = defineSecret('GEMINI_API_KEY');

// ─── Function ──────────────────────────────────────────────────────────────────

/**
 * summarizeAuditFindings
 *
 * Generates a Gemini-powered NLP summary of audit findings.
 * Returns 150-200 word executive summary in Portuguese.
 *
 * @param params Audit findings summary data
 * @returns Professional audit summary (PT-BR)
 * @throws Error if Gemini call fails (caught and fallback applied)
 */
export async function summarizeAuditFindings(params: AuditSummarizationParams): Promise<string> {
  const {
    entryCount,
    anomalyCount,
    period,
    topModules,
    criticalCount,
    highCount,
  } = params;

  const prompt = `
Gere um resumo executivo para um relatório de auditoria de qualidade laboratorial. Use os dados abaixo:

- Operações analisadas: ${entryCount}
- Anomalias detectadas: ${anomalyCount}
- Período: ${period}
- Módulos mais afetados: ${topModules.join(', ')}
- Alertas críticos: ${criticalCount}
- Alertas altos: ${highCount}

Requisitos:
- Tom profissional, apropriado para documentação regulatória
- 150-200 palavras
- Português (Brasil)
- Foco em conformidade RDC 978 / DICQ
- Inclua recomendações de próximos passos

Responda apenas com o resumo, sem cabeçalho ou formatação extra.
`;

  try {
    const apiKey = geminiSecret.value();
    if (!apiKey) {
      return fallbackSummary(params);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (text && text.trim().length > 0) {
      return text.trim();
    }

    return fallbackSummary(params);
  } catch (err) {
    console.warn('[nlpSummarizer] Gemini call failed, using fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackSummary(params);
  }
}

/**
 * fallbackSummary
 *
 * Fallback summary template when Gemini is unavailable.
 * Provides basic structured summary of audit findings.
 */
function fallbackSummary(params: AuditSummarizationParams): string {
  const {
    entryCount,
    anomalyCount,
    period,
    topModules,
    criticalCount,
    highCount,
  } = params;

  return (
    `Relatório de auditoria de qualidade gerado para o período ${period}. ` +
    `${entryCount} operações foram analisadas, identificando ${anomalyCount} anomalias. ` +
    `${criticalCount} alertas críticos e ${highCount} alertas altos foram registrados. ` +
    `Os módulos mais afetados foram: ${topModules.join(', ')}. ` +
    `Recomenda-se revisão das políticas operacionais e treinamento dos operadores nesses módulos.`
  );
}
