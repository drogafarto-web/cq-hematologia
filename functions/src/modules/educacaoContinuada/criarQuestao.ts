/**
 * ec_criarQuestao — Fase 8 (RN-10: gabarito server-only).
 *
 * Recebe questão com opções marcadas como `correta` no input. Server SEPARA:
 *   - `/questoes/{id}` — público (read para quem tem claim do módulo). SEM
 *     o flag `correta`. Client nunca vê qual opção é a certa.
 *   - `/questoesGabarito/{id}` — rule `read: if false`. Admin SDK
 *     (via `ec_submeterTeste`) lê para corrigir.
 *
 * Atomic via batch: ou cria ambos, ou nenhum.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import { assertEcAccess, ecCollection, ensureEcLabRoot } from './validators';

const OpcaoQuestaoInputSchema = z.object({
  texto: z.string().trim().min(1),
  correta: z.boolean(),
});

const CriarQuestaoInputSchema = z.object({
  labId: z.string().min(1),
  templateId: z.string().min(1),
  enunciado: z.string().trim().min(1),
  tipo: z.enum(['multipla_escolha', 'verdadeiro_falso', 'dissertativa']),
  opcoes: z.array(OpcaoQuestaoInputSchema).optional(),
  gabaritoTexto: z.string().trim().min(1).optional(),
  pontuacao: z.number().positive(),
  ordem: z.number().int().nonnegative(),
  ativo: z.boolean().default(true),
});

interface CriarQuestaoResult {
  ok: true;
  questaoId: string;
}

export const ec_criarQuestao = onCall<unknown, Promise<CriarQuestaoResult>>(
  {},
  async (request) => {
    const parsed = CriarQuestaoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertEcAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    // Validação: objetivas exigem opcoes com ao menos 1 correta; dissertativa não
    if (input.tipo === 'dissertativa') {
      if (input.opcoes && input.opcoes.length > 0) {
        throw new HttpsError('failed-precondition', 'Dissertativa não deve ter opções.');
      }
    } else {
      if (!input.opcoes || input.opcoes.length < 2) {
        throw new HttpsError(
          'failed-precondition',
          'Questões objetivas exigem ao menos 2 opções.',
        );
      }
      const corretas = input.opcoes.filter((o) => o.correta);
      if (corretas.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          'Questão objetiva precisa ter ao menos 1 opção correta.',
        );
      }
    }

    await ensureEcLabRoot(db, input.labId);

    // Separa gabarito e opções públicas
    const opcoesPublicas = (input.opcoes ?? []).map((o, i) => ({
      id: `opt-${i + 1}`,
      texto: o.texto,
    }));
    const opcoesCorretas = (input.opcoes ?? [])
      .map((o, i) => (o.correta ? `opt-${i + 1}` : null))
      .filter((id): id is string => id !== null);

    const questoesRef = ecCollection(db, input.labId, 'questoes').doc();
    const gabaritoRef = ecCollection(db, input.labId, 'questoesGabarito').doc(questoesRef.id);

    const batch = db.batch();

    const questaoPublica: Record<string, unknown> = {
      labId: input.labId,
      templateId: input.templateId,
      enunciado: input.enunciado,
      tipo: input.tipo,
      pontuacao: input.pontuacao,
      ordem: input.ordem,
      ativo: input.ativo,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (opcoesPublicas.length > 0) {
      questaoPublica['opcoes'] = opcoesPublicas;
    }
    batch.set(questoesRef, questaoPublica);

    const gabarito: Record<string, unknown> = {
      labId: input.labId,
      questaoId: questoesRef.id,
    };
    if (opcoesCorretas.length > 0) gabarito['opcoesCorretas'] = opcoesCorretas;
    if (input.gabaritoTexto) gabarito['gabaritoTexto'] = input.gabaritoTexto;
    batch.set(gabaritoRef, gabarito);

    await batch.commit();

    db.collection('auditLogs')
      .add({
        action: 'EC_CRIAR_QUESTAO',
        callerUid: uid,
        labId: input.labId,
        payload: { questaoId: questoesRef.id, templateId: input.templateId, tipo: input.tipo },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    return { ok: true, questaoId: questoesRef.id };
  },
);

// ─── ec_arquivarQuestao ──────────────────────────────────────────────────────
// Arquiva a questão (ativo=false) mantendo gabarito para histórico.
// Útil quando uma questão é revisada/substituída mas há respostas passadas.

const ArquivarQuestaoInputSchema = z.object({
  labId: z.string().min(1),
  questaoId: z.string().min(1),
});

export const ec_arquivarQuestao = onCall<unknown, Promise<{ ok: true }>>(
  {},
  async (request) => {
    const parsed = ArquivarQuestaoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, questaoId } = parsed.data;

    await assertEcAccess(request.auth, labId);
    const db = admin.firestore();
    await ecCollection(db, labId, 'questoes').doc(questaoId).update({ ativo: false });
    return { ok: true };
  },
);
