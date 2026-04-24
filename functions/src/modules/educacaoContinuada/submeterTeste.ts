/**
 * ec_submeterTeste — Fase 8 correção server-side.
 *
 * Cliente envia respostas (apenas `questaoId` + `opcaoId` ou `respostaTexto`);
 * NUNCA envia gabarito. Server:
 *   1. Valida execução está `realizada` e colaborador foi `presente`
 *   2. Lê `questoesGabarito` via Admin SDK (rules bloqueiam read client)
 *   3. Para cada resposta: compara `opcaoId` com `opcoesCorretas` → `correta`
 *      boolean; dissertativa fica `correta: null` (correção manual posterior)
 *   4. Calcula `pontuacaoObtida` por questão e total
 *   5. Batch atomic: cria AvaliacaoTeste `status='corrigido'` (ou `'submetido'`
 *      se houver dissertativas) + N RespostaAvaliacao
 *
 * RN-10: `correta` booleano é o único campo retornado ao cliente sobre
 * correção. A opção correta em si NUNCA é revelada nessa callable.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import { assertEcAccess, ecCollection, ensureEcLabRoot } from './validators';

const RespostaInputSchema = z
  .object({
    questaoId: z.string().min(1),
    opcaoId: z.string().min(1).optional(),
    respostaTexto: z.string().optional(),
  })
  .refine(
    (r) => r.opcaoId !== undefined || (r.respostaTexto !== undefined && r.respostaTexto.trim().length > 0),
    { message: 'Resposta precisa ter opcaoId OU respostaTexto.' },
  );

const SubmeterTesteInputSchema = z.object({
  labId: z.string().min(1),
  execucaoId: z.string().min(1),
  colaboradorId: z.string().min(1),
  respostas: z.array(RespostaInputSchema).min(1),
});

/** Threshold hard-coded MVP — 70% de acerto = aprovado. */
const THRESHOLD_APROVACAO = 70;

interface SubmeterTesteResult {
  ok: true;
  avaliacaoTesteId: string;
  pontuacaoTotal: number;
  percentualAcerto: number;
  aprovado: boolean;
  /** True quando há questões dissertativas aguardando correção manual. */
  temDissertativasPendentes: boolean;
}

export const ec_submeterTeste = onCall<unknown, Promise<SubmeterTesteResult>>(
  {},
  async (request) => {
    const parsed = SubmeterTesteInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertEcAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    // Valida execução realizada
    const execRef = ecCollection(db, input.labId, 'execucoes').doc(input.execucaoId);
    const execSnap = await execRef.get();
    if (!execSnap.exists || execSnap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Execução não encontrada.');
    }
    if (execSnap.data()?.['status'] !== 'realizado') {
      throw new HttpsError('failed-precondition', 'Teste só pode ser submetido em execução realizada.');
    }

    // Valida colaborador presente
    const presencaQuery = await ecCollection(db, input.labId, 'participantes')
      .where('execucaoId', '==', input.execucaoId)
      .where('colaboradorId', '==', input.colaboradorId)
      .where('presente', '==', true)
      .limit(1)
      .get();
    if (presencaQuery.empty) {
      throw new HttpsError(
        'failed-precondition',
        'Colaborador não consta como presente — não pode submeter teste.',
      );
    }

    // Carrega todas as questões referidas nas respostas + seus gabaritos
    const questaoIds = Array.from(new Set(input.respostas.map((r) => r.questaoId)));
    const [questoesSnaps, gabaritosSnaps] = await Promise.all([
      Promise.all(
        questaoIds.map((id) => ecCollection(db, input.labId, 'questoes').doc(id).get()),
      ),
      Promise.all(
        questaoIds.map((id) => ecCollection(db, input.labId, 'questoesGabarito').doc(id).get()),
      ),
    ]);

    const questaoMap = new Map<string, { tipo: string; pontuacao: number }>();
    for (const snap of questoesSnaps) {
      if (!snap.exists) continue;
      const d = snap.data()!;
      questaoMap.set(snap.id, {
        tipo: d['tipo'] as string,
        pontuacao: d['pontuacao'] as number,
      });
    }

    const gabaritoMap = new Map<string, string[]>();
    for (const snap of gabaritosSnaps) {
      if (!snap.exists) continue;
      const d = snap.data()!;
      gabaritoMap.set(snap.id, (d['opcoesCorretas'] ?? []) as string[]);
    }

    await ensureEcLabRoot(db, input.labId);

    // Correção objetiva; dissertativa → null (manual)
    let pontuacaoTotal = 0;
    let pontuacaoMaxima = 0;
    let temDissertativasPendentes = false;

    const correcoes = input.respostas.map((resp) => {
      const questao = questaoMap.get(resp.questaoId);
      if (!questao) {
        // Questão inexistente — resposta inválida, zera
        return {
          questaoId: resp.questaoId,
          opcaoId: resp.opcaoId,
          respostaTexto: resp.respostaTexto,
          correta: false,
          pontuacaoObtida: 0,
        };
      }
      pontuacaoMaxima += questao.pontuacao;
      if (questao.tipo === 'dissertativa') {
        temDissertativasPendentes = true;
        return {
          questaoId: resp.questaoId,
          opcaoId: undefined,
          respostaTexto: resp.respostaTexto,
          correta: null as boolean | null,
          pontuacaoObtida: 0, // manual depois
        };
      }
      const gabarito = gabaritoMap.get(resp.questaoId) ?? [];
      const correta = resp.opcaoId !== undefined && gabarito.includes(resp.opcaoId);
      const pontuacao = correta ? questao.pontuacao : 0;
      pontuacaoTotal += pontuacao;
      return {
        questaoId: resp.questaoId,
        opcaoId: resp.opcaoId,
        respostaTexto: undefined,
        correta,
        pontuacaoObtida: pontuacao,
      };
    });

    const percentualAcerto = pontuacaoMaxima > 0
      ? Math.round((pontuacaoTotal / pontuacaoMaxima) * 100)
      : 0;
    const aprovado = !temDissertativasPendentes && percentualAcerto >= THRESHOLD_APROVACAO;

    const avaliacaoRef = ecCollection(db, input.labId, 'avaliacoesTeste').doc();
    const now = admin.firestore.Timestamp.now();

    const batch = db.batch();
    batch.set(avaliacaoRef, {
      labId: input.labId,
      execucaoId: input.execucaoId,
      colaboradorId: input.colaboradorId,
      status: temDissertativasPendentes ? 'submetido' : 'corrigido',
      pontuacaoTotal,
      percentualAcerto,
      aprovado,
      iniciadoEm: now,
      submetidoEm: now,
      corrigidoEm: temDissertativasPendentes ? null : now,
    });

    for (const c of correcoes) {
      const respostaRef = ecCollection(db, input.labId, 'respostasAvaliacao').doc();
      const respostaDoc: Record<string, unknown> = {
        labId: input.labId,
        avaliacaoTesteId: avaliacaoRef.id,
        colaboradorId: input.colaboradorId,
        questaoId: c.questaoId,
        correta: c.correta,
        pontuacaoObtida: c.pontuacaoObtida,
        respondidaEm: now,
      };
      if (c.opcaoId !== undefined) respostaDoc['opcaoId'] = c.opcaoId;
      if (c.respostaTexto !== undefined) respostaDoc['respostaTexto'] = c.respostaTexto;
      batch.set(respostaRef, respostaDoc);
    }

    await batch.commit();

    db.collection('auditLogs')
      .add({
        action: 'EC_SUBMETER_TESTE',
        callerUid: uid,
        labId: input.labId,
        payload: {
          avaliacaoTesteId: avaliacaoRef.id,
          execucaoId: input.execucaoId,
          colaboradorId: input.colaboradorId,
          pontuacaoTotal,
          percentualAcerto,
          aprovado,
          temDissertativasPendentes,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    return {
      ok: true,
      avaliacaoTesteId: avaliacaoRef.id,
      pontuacaoTotal,
      percentualAcerto,
      aprovado,
      temDissertativasPendentes,
    };
  },
);
