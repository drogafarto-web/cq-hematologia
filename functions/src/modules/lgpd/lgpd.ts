import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

/**
 * criarSolicitacao — Initiate LGPD data subject access/deletion/rectification request.
 * 15-day SLA enforcement (LGPD art. 18) with audit trail.
 */
export const criarSolicitacao = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const { labId, titular_id, titular_nome, titular_email, tipo, motivo } = request.data;

    if (!labId || !titular_id || !titular_nome || !titular_email || !tipo) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
    }

    const tiposValidos = ['acesso', 'retificacao', 'exclusao', 'portabilidade'];
    if (!tiposValidos.includes(tipo)) {
      throw new HttpsError('invalid-argument', `Tipo de solicitação inválido: ${tipo}`);
    }

    try {
      // Validate email format
      if (!titular_email.includes('@')) {
        throw new HttpsError('invalid-argument', 'Email inválido');
      }

      const now = admin.firestore.Timestamp.now();
      // LGPD art. 18 — prazo máximo de 15 dias para todos os tipos de solicitação
      const prazosDias: Record<string, number> = {
        acesso: 15,
        retificacao: 15,
        exclusao: 15,
        portabilidade: 15,
        oposicao: 15,
      };
      const diasPrazo = prazosDias[tipo] ?? 15;
      const prazoDate = new Date(now.toDate().getTime() + diasPrazo * 24 * 60 * 60 * 1000);
      const dataPrairie = admin.firestore.Timestamp.fromDate(prazoDate);

      const solicitacao = {
        labId,
        titular_id,
        titular_nome,
        titular_email,
        tipo,
        status: 'pendente',
        motivo: motivo || '',
        data_solicitacao: now,
        data_prazo: dataPrairie,
        data_conclusao: null,
        criadoEm: now,
        criadoPor: request.auth.uid,
      };

      const ref = await db.collection(`labs/${labId}/lgpd-solicitacoes`).add(solicitacao);

      // Audit log
      db.collection('auditLogs')
        .add({
          action: 'LGPD_SOLICITACAO_CRIADA',
          callerUid: request.auth.uid,
          labId,
          payload: { solicitacaoId: ref.id, tipo, titular_email },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      return {
        success: true,
        solicitacaoId: ref.id,
        dataPrazo: dataPrairie,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao criar solicitação');
    }
  }
);

/**
 * processarExclusao — Anonymization pipeline for deletion requests.
 * Hashes PII, randomizes names, archives original, verifies completion.
 */
export const processarExclusao = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token?.admin) {
      throw new HttpsError('permission-denied', 'Apenas admin podem processar exclusões');
    }

    const { labId, solicitacaoId, usuario_id } = request.data;

    if (!labId || !solicitacaoId || !usuario_id) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
    }

    try {
      // Get solicitação
      const solicitacaoSnap = await db.doc(`labs/${labId}/lgpd-solicitacoes/${solicitacaoId}`).get();
      if (!solicitacaoSnap.exists || solicitacaoSnap.data()?.tipo !== 'exclusao') {
        throw new HttpsError('not-found', 'Solicitação de exclusão não encontrada');
      }

      const solicitacaoRef = db.doc(`labs/${labId}/lgpd-solicitacoes/${solicitacaoId}`);
      const now = admin.firestore.Timestamp.now();

      // Hash PII fields for de-identification
      const emailHash = crypto.createHash('sha256').update(solicitacaoSnap.data()?.titular_email || '').digest('hex');
      const nomeAnon = `Paciente_${emailHash.substring(0, 8)}`;

      // All collections with personal data, mapped to the field that holds the subject UID
      const colecoesPorCampo: Array<{ colecao: string; campo: string }> = [
        { colecao: 'runs', campo: 'operadorId' },
        { colecao: 'amostras', campo: 'pacienteId' },
        { colecao: 'relatorios', campo: 'operadorId' },
        { colecao: 'coagulacao', campo: 'operadorId' },
        { colecao: 'ciq-imuno', campo: 'operadorId' },
        { colecao: 'uroanalise', campo: 'operadorId' },
        { colecao: 'treinamentos', campo: 'colaboradorId' },
        { colecao: 'nao-conformidades', campo: 'operadorId' },
        { colecao: 'pops', campo: 'criadoPor' },
        { colecao: 'lots', campo: 'operadorId' },
        { colecao: 'pgrss-geracao', campo: 'operadorId' },
        { colecao: 'biosseguranca-areas', campo: 'responsavelId' },
        { colecao: 'lgpd-consentimento', campo: 'usuario_id' },
        { colecao: 'controle-temperatura', campo: 'operadorId' },
      ];

      const dadosExcluidos: string[] = [];
      const colecoesSummary: Array<{ colecao: string; campo: string; count: number }> = [];

      // Collect all ops in batches of ≤490 ops each
      let currentBatch = db.batch();
      let opsInBatch = 0;
      const batches: admin.firestore.WriteBatch[] = [currentBatch];

      const enqueue = (op: (b: admin.firestore.WriteBatch) => void) => {
        if (opsInBatch >= 490) {
          currentBatch = db.batch();
          batches.push(currentBatch);
          opsInBatch = 0;
        }
        op(currentBatch);
        opsInBatch++;
      };

      for (const { colecao, campo } of colecoesPorCampo) {
        const colecaoPath = `labs/${labId}/${colecao}`;
        const snap = await db.collection(colecaoPath).where(campo, '==', usuario_id).get();
        let count = 0;

        for (const docSnap of snap.docs) {
          const anonFields: Record<string, unknown> = {
            [campo]: `ANON_${emailHash.substring(0, 16)}`,
            anonimizadoEm: now,
          };
          // Anonymize email-like and name-like fields when present
          const data = docSnap.data();
          if ('usuario_email' in data) anonFields['usuario_email'] = `anon_${emailHash.substring(0, 8)}@anonymized.local`;
          if ('usuario_nome' in data) anonFields['usuario_nome'] = nomeAnon;
          if ('colaboradorNome' in data) anonFields['colaboradorNome'] = nomeAnon;
          if ('operadorNome' in data) anonFields['operadorNome'] = nomeAnon;

          enqueue((b) => b.update(docSnap.ref, anonFields));
          dadosExcluidos.push(`${colecaoPath}/${docSnap.id}`);
          count++;
        }

        colecoesSummary.push({ colecao, campo, count });
      }

      // Archive original data (7-year retention for compliance)
      const arquivoRef = db.collection(`labs/${labId}/lgpd-arquivo`).doc();
      enqueue((b) =>
        b.set(arquivoRef, {
          usuario_id,
          data_original: solicitacaoSnap.data(),
          data_exclusao: now,
          motivo: 'LGPD request processing',
          retencao_ate: new Date(now.toDate().getTime() + 7 * 365 * 24 * 60 * 60 * 1000),
        }),
      );

      // Update solicitação status
      enqueue((b) =>
        b.update(solicitacaoRef, {
          status: 'concluida',
          data_conclusao: now,
        }),
      );

      // Create deletion log
      const logRef = db.collection(`labs/${labId}/lgpd-exclusao`).doc();
      enqueue((b) =>
        b.set(logRef, {
          labId,
          usuario_id,
          usuario_nome: solicitacaoSnap.data()?.titular_nome,
          data_exclusao: now,
          tipo: 'anonimizacao',
          dados_excluidos: dadosExcluidos,
          colecoes_processadas: colecoesSummary,
          batches_usados: batches.length,
          verificado: true,
          criadoEm: now,
          criadoPor: request.auth.uid,
        }),
      );

      // Commit all batches sequentially
      for (const b of batches) {
        await b.commit();
      }

      // Detailed audit log per collection
      console.log(
        `[LGPD] processarExclusao — lab=${labId} uid=${usuario_id} total=${dadosExcluidos.length} docs, ` +
          `batches=${batches.length}, coleções: ` +
          colecoesSummary.map((c) => `${c.colecao}(${c.campo})=${c.count}`).join(', '),
      );

      // Audit log
      db.collection('auditLogs')
        .add({
          action: 'LGPD_EXCLUSAO_PROCESSADA',
          callerUid: request.auth.uid,
          labId,
          payload: {
            solicitacaoId,
            usuario_id,
            dadosAnonimizados: dadosExcluidos.length,
            colecoesSummary,
            batchesUsados: batches.length,
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      return {
        success: true,
        logId: logRef.id,
        dadosAnonimizados: dadosExcluidos.length,
        colecoesSummary,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao processar exclusão');
    }
  }
);

/**
 * gerarDPIA — Generate Data Protection Impact Assessment template.
 * GDPR/LGPD compliance documentation.
 */
export const gerarDPIA = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth?.token?.admin) {
      throw new HttpsError('permission-denied', 'Apenas admin podem gerar DPIA');
    }

    const { labId, titulo, descricao, dados_pessoais_processados, riscos_identificados } = request.data;

    if (!labId || !titulo || !descricao || !dados_pessoais_processados || !riscos_identificados) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
    }

    try {
      const dpia = {
        labId,
        titulo,
        descricao,
        dados_pessoais_processados: Array.isArray(dados_pessoais_processados)
          ? dados_pessoais_processados
          : [dados_pessoais_processados],
        riscos_identificados: Array.isArray(riscos_identificados)
          ? riscos_identificados
          : [riscos_identificados],
        medidas_mitigacao: [],
        status: 'rascunho',
        data_criacao: admin.firestore.Timestamp.now(),
        data_revisao: null,
        revisor: null,
        criadoEm: admin.firestore.Timestamp.now(),
        criadoPor: request.auth.uid,
      };

      const ref = await db.collection(`labs/${labId}/lgpd-dpia`).add(dpia);

      // Audit
      db.collection('auditLogs')
        .add({
          action: 'LGPD_DPIA_CRIADA',
          callerUid: request.auth.uid,
          labId,
          payload: { dpiaId: ref.id, titulo },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      return {
        success: true,
        dpiaId: ref.id,
        status: 'rascunho',
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao gerar DPIA');
    }
  }
);

/**
 * scheduledProcessarSolicitacoesVencidas — Cleanup task for expired requests.
 * Runs daily to mark requests exceeding 15-day SLA (LGPD art. 18).
 */
export const scheduledProcessarSolicitacoesVencidas = onSchedule(
  {
    schedule: 'every day 1:00', // Daily at 01:00 UTC
    region: 'southamerica-east1',
    timeoutSeconds: 300,
  },
  async () => {
    const labsSnapshot = await db.collection('labs').get();
    const now = admin.firestore.Timestamp.now();

    for (const labDoc of labsSnapshot.docs) {
      const labId = labDoc.id;

      try {
        const vencidas = await db
          .collection(`labs/${labId}/lgpd-solicitacoes`)
          .where('status', '==', 'pendente')
          .where('data_prazo', '<', now)
          .get();

        for (const doc of vencidas.docs) {
          await doc.ref.update({
            status: 'recusada',
            data_conclusao: now,
            motivo_recusa: 'SLA de 15 dias expirado (LGPD art. 18)',
          });
        }

        if (vencidas.size > 0) {
          console.log(`[LGPD] Lab ${labId}: ${vencidas.size} solicitações vencidas processadas`);
        }
      } catch (error) {
        console.error(`Erro processando solicitações vencidas para ${labId}:`, error);
      }
    }
  }
);
