/**
 * classificarReclamacaoIA — Internal Cloud Function
 *
 * Classifies complaint using Gemini 2.5 Flash with structured output (JSON mode).
 * Called async by criarReclamacao; never exposed as public callable.
 *
 * Returns: { tipo, severidade, area, confidence, justificativa }
 * Stores audit log in /labs/{labId}/feedback-classificacao-auto/{logId}
 * Updates reclamacao with classificacaoAuto field
 *
 * Fallback: timeout or error → leaves classificacaoAuto empty (RT classifies manually)
 * Confidence < 0.6 → flags "review needed" in audit
 *
 * RN-13: Audit trail for all IA operations (transparency + fine-tuning)
 * LGPD: raw response logged (not exposed to UI, RT only)
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

type LabId = string;

interface ClassificacaoAuto {
  tipoSugerido: string;
  severidadeSugerida: string;
  areaSugerida: string;
  confidence: number;
  modeloVersao: string;
  rawResponse: string;
  geradoEm: admin.firestore.Timestamp;
}

const db = admin.firestore();
const logger = functions.logger;

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Response Schema
// ─────────────────────────────────────────────────────────────────────────────

const GeminiClassificationResponse = z.object({
  tipo: z.enum([
    'laudo-errado',
    'demora',
    'atendimento',
    'valor-cobrado',
    'amostra-hemolisada',
    'outro',
  ]),
  severidade: z.enum(['alta', 'media', 'baixa']),
  areaResponsavel: z.enum([
    'analitico',
    'pre-analitico',
    'pos-analitico',
    'comercial',
    'recepcao',
    'outro',
  ]),
  confidence: z.number().min(0).max(1),
  justificativa: z.string(),
});

type GeminiClassification = z.infer<typeof GeminiClassificationResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Engineering
// ─────────────────────────────────────────────────────────────────────────────

function buildClassificationPrompt(descricao: string): string {
  return `Você é um assistente especializado em qualidade laboratorial. Classifique a reclamação de paciente abaixo seguindo rigorosamente os critérios brasileiros (DICQ, RDC 978/2025, CDC Lei 8.078/90).

RECLAMAÇÃO:
"${descricao}"

TIPOS PERMITIDOS:
- "laudo-errado": Resultado incorreto, cálculo errado, amostra trocada
- "demora": Entrega atrasada do laudo (>SLA 30 dias)
- "atendimento": Comportamento inadequado do staff, falta de empatia
- "valor-cobrado": Cobrança indevida, fraude, erro de fatura
- "amostra-hemolisada": Qualidade comprometida (hemólise, contaminação)
- "outro": Não se enquadra em acima

SEVERIDADES:
- "alta": Potencial dano clínico, laudo errado, agressão verbal, infração regulatória
- "media": Demora significativa (7-30d), valor cobrado errado, amostra rejeitada
- "baixa": Sugestões, comentários gerais, insatisfação menor

ÁREAS RESPONSÁVEIS:
- "analitico": Análise, resultado, metodologia
- "pre-analitico": Coleta, amostragem, transporte, armazenamento
- "pos-analitico": Entrega, comunicação, laudista
- "comercial": Fatura, cobrança, relacionamento
- "recepcao": Acolhimento, triagem, cadastro
- "outro": Não identificado

RESPONDA APENAS COM JSON VÁLIDO (sem markdown, sem explicação):
{
  "tipo": "...",
  "severidade": "...",
  "areaResponsavel": "...",
  "confidence": 0.0-1.0,
  "justificativa": "Máx 150 caracteres explicando a classificação"
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Callable: classificarReclamacaoIA (internal, via queue)
// ─────────────────────────────────────────────────────────────────────────────

export const classificarReclamacaoIA = functions.tasks.onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 10,
    },
    rateLimits: {
      maxConcurrentDispatches: 10,
    },
    region: 'southamerica-east1',
  },
  async (req): Promise<void> => {
    const { labId, reclamacaoId, descricao } = req.data as {
      labId: LabId;
      reclamacaoId: string;
      descricao: string;
    };

    const startTime = Date.now();

    try {
      // 1. Initialize Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error('GEMINI_API_KEY not configured');
        return;
      }

      const genAI = new GoogleGenAI({
        apiKey,
      });

      // 2. Call Gemini with structured output
      const prompt = buildClassificationPrompt(descricao);
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }

      // 3. Parse and validate response
      let classification: GeminiClassification;
      try {
        const parsed = JSON.parse(responseText);
        classification = GeminiClassificationResponse.parse(parsed);
      } catch (parseErr) {
        logger.warn('Failed to parse Gemini response', { responseText, error: parseErr });
        return;
      }

      // 4. Create audit log
      const now = admin.firestore.Timestamp.now();
      const logId = db
        .collection('labs')
        .doc(labId)
        .collection('feedback-classificacao-auto')
        .doc().id;

      const auditLog = {
        labId,
        reclamacaoId,
        modelo: 'gemini-2.5-flash',
        versao: new Date().toISOString().split('T')[0],
        entrada: {
          descricao: descricao.substring(0, 500), // Truncate for storage
        },
        saida: {
          tipo: classification.tipo,
          severidade: classification.severidade,
          areaResponsavel: classification.areaResponsavel,
          confidence: classification.confidence,
          justificativa: classification.justificativa,
        },
        flagReview: classification.confidence < 0.6,
        latencyMs: Date.now() - startTime,
        rawResponse: responseText,
        criadoEm: now,
      };

      // 5. Update reclamacao atomically
      const batch = db.batch();

      const reclamacaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('reclamacoes')
        .doc(reclamacaoId);

      const classificacaoAuto: ClassificacaoAuto = {
        tipoSugerido: classification.tipo,
        severidadeSugerida: classification.severidade,
        areaSugerida: classification.areaResponsavel,
        confidence: classification.confidence,
        modeloVersao: 'gemini-2.5-flash@2026-06',
        rawResponse: responseText,
        geradoEm: now,
      };

      batch.update(reclamacaoRef, {
        classificacaoAuto,
      });

      // Save audit log
      const auditRef = db
        .collection('labs')
        .doc(labId)
        .collection('feedback-classificacao-auto')
        .doc(logId);

      batch.set(auditRef, auditLog);

      await batch.commit();

      logger.info('Complaint classified successfully', {
        reclamacaoId,
        tipo: classification.tipo,
        severidade: classification.severidade,
        confidence: classification.confidence,
        latencyMs: auditLog.latencyMs,
      });
    } catch (err) {
      logger.error('classificarReclamacaoIA error', {
        reclamacaoId,
        error: err,
        latencyMs: Date.now() - startTime,
      });

      // Log failure for debugging
      const now = admin.firestore.Timestamp.now();
      const failLogRef = db
        .collection('labs')
        .doc(labId)
        .collection('feedback-classificacao-auto')
        .doc();

      await failLogRef.set({
        labId,
        reclamacaoId,
        modelo: 'gemini-2.5-flash',
        status: 'failed',
        erro: String(err),
        criadoEm: now,
      });
    }
  }
);

// Sync testing version removed — use task-based async for production
