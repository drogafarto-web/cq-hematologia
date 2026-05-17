import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { logger } from 'firebase-functions';
import { getGeminiModel } from '../../shared/gemini/getModelConfig';

const db = admin.firestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');

const inputSchema = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  indicadorId: z.string().min(1),
  evidenciaUrl: z.string().url(),
  indicadorNome: z.string().min(1),
  marcoRegulatorio: z.string().min(1),
  niveis: z.record(z.string()),
  scoreAtual: z.number().nullable(),
});

type ValidateOutput = {
  veredito: 'adequada' | 'parcial' | 'inadequada' | 'inconclusiva';
  justificativa: string;
  confianca: number;
  sugestao: string | null;
};

export const validateEvidenciaIA = onCall(
  {
    region: 'southamerica-east1',
    memory: '512MiB',
    timeoutSeconds: 60,
    secrets: [geminiApiKey],
  },
  async (request): Promise<ValidateOutput> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
    }

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Dados invalidos: ' + parsed.error.message);
    }

    const { labId, evidenciaUrl, indicadorNome, marcoRegulatorio, niveis, scoreAtual } = parsed.data;
    const uid = request.auth.uid;

    const memberSnap = await db.doc(`labs/${labId}/members/${uid}`).get();
    if (!memberSnap.exists || memberSnap.data()?.active !== true) {
      throw new HttpsError('permission-denied', 'Sem acesso ao laboratorio.');
    }

    let imageBase64: string;
    let mimeType: string;

    try {
      const response = await fetch(evidenciaUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      imageBase64 = buffer.toString('base64');
      mimeType = response.headers.get('content-type') || 'image/jpeg';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('validateEvidenciaIA: fetch failed', { evidenciaUrl, error: message });
      throw new HttpsError('internal', 'Erro ao acessar evidencia.');
    }

    const niveisText = Object.entries(niveis)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([score, desc]) => `  ${score}: ${desc}`)
      .join('\n');

    const prompt = `Voce e um auditor de qualidade laboratorial especialista em RDC 978/2025 e DICQ.

Indicador: ${indicadorNome}
Marco regulatorio: ${marcoRegulatorio}
Score atual do auditor: ${scoreAtual !== null ? scoreAtual + '/5' : 'nao avaliado'}

Criterios (rubrica):
${niveisText}

Analise a evidencia anexada e avalie se ela comprova adequadamente o atendimento ao indicador acima.

Responda APENAS com um JSON valido:
{
  "veredito": "adequada" | "parcial" | "inadequada" | "inconclusiva",
  "justificativa": "<1-2 frases objetivas>",
  "confianca": <0.0 a 1.0>,
  "sugestao": "<o que falta ou poderia melhorar, null se adequada>"
}

Criterios de julgamento:
- "adequada": evidencia comprova claramente o atendimento ao requisito
- "parcial": evidencia existe mas esta incompleta, vencida, ou parcialmente legivel
- "inadequada": evidencia nao corresponde ao requisito ou esta ilegivel
- "inconclusiva": nao e possivel determinar (imagem cortada, baixa qualidade, etc)

Retorne APENAS o JSON, sem markdown.`;

    try {
      const modelId = await getGeminiModel(labId);
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: modelId });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
        prompt,
      ]);

      const responseText = result.response.text();
      const cleaned = responseText
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '')
        .trim();

      const output = JSON.parse(cleaned) as ValidateOutput;

      if (!['adequada', 'parcial', 'inadequada', 'inconclusiva'].includes(output.veredito)) {
        output.veredito = 'inconclusiva';
      }
      output.confianca = Math.max(0, Math.min(1, output.confianca ?? 0.5));
      output.sugestao = output.sugestao || null;

      logger.info('validateEvidenciaIA success', {
        labId,
        indicadorNome,
        veredito: output.veredito,
        confianca: output.confianca,
      });

      return output;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('validateEvidenciaIA Gemini error', { error: message });
      throw new HttpsError('internal', 'Erro ao validar evidencia com IA.');
    }
  },
);
