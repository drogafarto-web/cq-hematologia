import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { logger } from 'firebase-functions';
import { createAIClient } from '../../shared/ai/aiClient';
import { AUDIT_SUMMARY_PROMPT, AuditSummaryContext } from '../../shared/ai/prompts/auditSummary';

const db = admin.firestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');

const inputSchema = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
});

const BLOCOS: Record<string, string> = {
  A: 'Documentacao Legal e Governanca',
  B: 'Contratos e Terceirizacao',
  C: 'Tecnologias e Equipamentos',
  D: 'Risco e Documentos',
  E: 'Pessoal e Educacao',
  F: 'Infraestrutura e Ambiente',
  G: 'Sistemas e Biosseguranca',
  H: 'Procedimentos e Rastreabilidade',
  I: 'Fase Pre-Analitica',
  J: 'Fase Analitica',
  K: 'Fase Pos-Analitica e Laudos',
  L: 'Controle da Qualidade (CIQ/CEQ)',
};

export const generateAuditoriaSummary = onCall(
  {
    region: 'southamerica-east1',
    memory: '512MiB',
    timeoutSeconds: 60,
    secrets: [geminiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
    }

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'labId e auditoriaId obrigatorios.');
    }

    const { labId, auditoriaId } = parsed.data;
    const uid = request.auth.uid;

    const memberSnap = await db.doc(`labs/${labId}/members/${uid}`).get();
    if (!memberSnap.exists || memberSnap.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'Sem acesso ao laboratorio.');
    }

    const auditoriaSnap = await db.doc(`auditoria-geral/${labId}/auditorias/${auditoriaId}`).get();
    if (!auditoriaSnap.exists) {
      throw new HttpsError('not-found', 'Auditoria nao encontrada.');
    }

    const auditoria = auditoriaSnap.data()!;
    const respostasSnap = await db
      .collection(`auditoria-geral/${labId}/auditorias/${auditoriaId}/respostas`)
      .get();

    const respostas = respostasSnap.docs.map((d) => {
      const data = d.data();
      return {
        numero: data.numero,
        indicador: data.indicador,
        bloco: data.bloco,
        blocoNome: BLOCOS[data.bloco] ?? data.bloco,
        score: data.score,
        observacoes: data.observacoes ?? '',
      };
    });

    const criticos = respostas.filter((r) => r.score !== null && r.score <= 2);
    const scoresPorBloco = auditoria.scoresPorBloco ?? {};

    const ctx: AuditSummaryContext = {
      scoreTotal: auditoria.scoreTotal,
      scoresPorBloco,
      criticalIndicators: criticos.map((r) => ({
        numero: r.numero,
        indicador: r.indicador,
        bloco: r.blocoNome,
        score: r.score,
        obs: r.observacoes,
      })),
      totalRespondidos: auditoria.totalRespondidos,
      totalIndicadores: 57,
      titulo: auditoria.titulo,
    };

    try {
      const client = createAIClient({ apiKey: geminiApiKey.value(), model: 'gemini-2.5-flash' });
      const result = await client.generateText({
        systemPrompt: AUDIT_SUMMARY_PROMPT.system,
        prompt: AUDIT_SUMMARY_PROMPT.template(ctx),
      });
      const summary = result.text;

      logger.info('generateAuditoriaSummary success', {
        labId,
        auditoriaId,
        summaryLength: summary.length,
      });

      return { summary };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('generateAuditoriaSummary Gemini error', { labId, auditoriaId, error: message });
      throw new HttpsError('internal', 'Erro ao gerar resumo com IA.');
    }
  },
);
