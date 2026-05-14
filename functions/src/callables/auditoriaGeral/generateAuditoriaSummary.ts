import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { logger } from 'firebase-functions';

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

    const criticosJson = JSON.stringify(
      criticos.map((r) => ({
        numero: r.numero,
        indicador: r.indicador,
        bloco: r.blocoNome,
        score: r.score,
        obs: r.observacoes,
      }))
    );

    const prompt = [
      'Voce e um auditor de qualidade laboratorial especialista em RDC 978/2025 e DICQ.',
      'Analise os resultados desta auditoria geral e gere um resumo executivo em portugues com:',
      '',
      '1) Visao geral do nivel de conformidade (score total: ' + auditoria.scoreTotal + '%)',
      '2) Pontos fortes identificados (blocos com score acima de 80%)',
      '3) Pontos criticos que requerem acao imediata (' + criticos.length + ' indicadores com score <= 2)',
      '4) Recomendacoes priorizadas por urgencia',
      '',
      'Dados da auditoria:',
      '- Titulo: ' + auditoria.titulo,
      '- Score total: ' + auditoria.scoreTotal + '%',
      '- Scores por bloco: ' + JSON.stringify(scoresPorBloco),
      '- Indicadores criticos: ' + criticosJson,
      '- Total respondidos: ' + auditoria.totalRespondidos + '/57',
      '',
      'Seja objetivo, use linguagem tecnica de qualidade laboratorial. Maximo 500 palavras.',
    ].join('\n');

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const summary = result.response.text();

      logger.info('generateAuditoriaSummary success', { labId, auditoriaId, summaryLength: summary.length });

      return { summary };
    } catch (err: any) {
      logger.error('generateAuditoriaSummary Gemini error', { labId, auditoriaId, error: err.message });
      throw new HttpsError('internal', 'Erro ao gerar resumo com IA.');
    }
  },
);
