import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { checkNCs } from '../qualidade/naoConformidade';

const db = admin.firestore();

/**
 * registrarGeracao — Record waste generation with segregation validation.
 * RDC 222/2018 compliance: validates waste type and quantity.
 */
export const registrarGeracao = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação obrigatória');
    }

    // PGRSS-FIX-1: Admin SDK bypasses Firestore Rules — validate membership manually.
    const { labId, tipo, descricao, peso_kg, responsavel, observacoes } = request.data;

    if (!labId || typeof labId !== 'string') {
      throw new HttpsError('invalid-argument', 'labId é obrigatório');
    }

    const memberSnap = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
    if (!memberSnap.exists || memberSnap.data()?.active !== true) {
      throw new HttpsError('permission-denied', 'Usuário não é membro ativo deste laboratório');
    }

    const modulosAcesso: string[] = memberSnap.data()?.modulosAcesso ?? [];
    if (!modulosAcesso.includes('pgrss') && !request.auth.token?.admin) {
      throw new HttpsError('permission-denied', 'Sem acesso ao módulo PGRSS');
    }

    if (!tipo || !descricao || peso_kg === undefined || !responsavel) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
    }

    // Validar tipo de resíduo
    const tiposValidos = ['biologico', 'quimico', 'radioativo', 'perfuro-cortante', 'comum'];
    if (!tiposValidos.includes(tipo)) {
      throw new HttpsError('invalid-argument', `Tipo de resíduo inválido: ${tipo}`);
    }

    if (peso_kg <= 0) {
      throw new HttpsError('invalid-argument', 'Peso deve ser maior que zero');
    }

    try {
      // ADR 0003: Check for blocking NCs
      const ncCheck = await checkNCs(labId, 'pgrss');
      if (ncCheck.blocked) {
        throw new HttpsError(
          'failed-precondition',
          ncCheck.message || 'NC crítica aberta bloqueia operações neste módulo'
        );
      }

      const registro = {
        labId,
        data: admin.firestore.Timestamp.now(),
        tipo,
        descricao,
        peso_kg,
        responsavel,
        status: 'gerado',
        observacoes: observacoes || '',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
        deletadoEm: null,
      };

      const ref = await db.collection(`labs/${labId}/pgrss-geracao`).add(registro);

      // Audit log
      db.collection('auditLogs')
        .add({
          action: 'PGRSS_GERAR',
          callerUid: request.auth.uid,
          labId,
          payload: { registroId: ref.id, tipo, peso_kg },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      return {
        success: true,
        registroId: ref.id,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao registrar geração');
    }
  }
);

/**
 * registrarColeta — Record waste collection with evidence tracking.
 * Links to one or more waste generation records.
 */
export const registrarColeta = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação obrigatória');
    }

    // PGRSS-FIX-1 + PGRSS-FIX-2: replaced admin-only check with member+module validation.
    // Admin SDK bypasses Firestore Rules — validate membership manually.
    const { labId, empresa_coletora, registroGeracaoIds, peso_total_kg, comprovante_url } = request.data;

    if (!labId || typeof labId !== 'string') {
      throw new HttpsError('invalid-argument', 'labId é obrigatório');
    }

    const memberSnap = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
    if (!memberSnap.exists || memberSnap.data()?.active !== true) {
      throw new HttpsError('permission-denied', 'Usuário não é membro ativo deste laboratório');
    }

    const modulosAcesso: string[] = memberSnap.data()?.modulosAcesso ?? [];
    if (!modulosAcesso.includes('pgrss') && !request.auth.token?.admin) {
      throw new HttpsError('permission-denied', 'Sem acesso ao módulo PGRSS');
    }

    if (!empresa_coletora || !registroGeracaoIds || !Array.isArray(registroGeracaoIds) || registroGeracaoIds.length === 0 || peso_total_kg === undefined) {
      throw new HttpsError('invalid-argument', 'Campos obrigatórios incompletos');
    }

    if (peso_total_kg <= 0) {
      throw new HttpsError('invalid-argument', 'Peso total deve ser maior que zero');
    }

    try {
      const coleta = {
        labId,
        data: admin.firestore.Timestamp.now(),
        empresa_coletora,
        registroGeracaoIds,
        peso_total_kg,
        comprovante_url: comprovante_url || null,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        criadoPor: request.auth.uid,
      };

      const batch = db.batch();
      const coletaRef = db.collection(`labs/${labId}/pgrss-coleta`).doc();

      batch.set(coletaRef, coleta);

      // Update all referenced waste generation records to 'coletado'
      for (const registroId of registroGeracaoIds) {
        const registroRef = db.collection(`labs/${labId}/pgrss-geracao`).doc(registroId);
        batch.update(registroRef, { status: 'coletado' });
      }

      await batch.commit();

      // Audit log
      db.collection('auditLogs')
        .add({
          action: 'PGRSS_COLETA',
          callerUid: request.auth.uid,
          labId,
          payload: { coletaId: coletaRef.id, empresa_coletora, quantidadeRegistros: registroGeracaoIds.length },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      return {
        success: true,
        coletaId: coletaRef.id,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao registrar coleta');
    }
  }
);

/**
 * validarSegregacao — Check if waste generation follows RDC 222 segregation rules.
 * Triggered by creation of generation records, or called manually for verification.
 */
export const validarSegregacao = onCall(
  { region: 'southamerica-east1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação obrigatória');
    }

    // PGRSS-FIX-1: Admin SDK bypasses Firestore Rules — validate membership manually.
    const { labId } = request.data;

    if (!labId || typeof labId !== 'string') {
      throw new HttpsError('invalid-argument', 'labId obrigatório');
    }

    const memberSnap = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
    if (!memberSnap.exists || memberSnap.data()?.active !== true) {
      throw new HttpsError('permission-denied', 'Usuário não é membro ativo deste laboratório');
    }

    const modulosAcesso: string[] = memberSnap.data()?.modulosAcesso ?? [];
    if (!modulosAcesso.includes('pgrss') && !request.auth.token?.admin) {
      throw new HttpsError('permission-denied', 'Sem acesso ao módulo PGRSS');
    }

    try {
      // RDC 222/2018 segregation rules:
      // Biological waste must NOT be mixed with chemical
      // Chemical waste must NOT be mixed with radioactive
      // Sharps must be in designated containers
      // Compliance check: ensure each generation is properly categorized

      const geracoes = await db
        .collection(`labs/${labId}/pgrss-geracao`)
        .where('deletadoEm', '==', null)
        .get();

      const violations: any[] = [];
      const tiposCounts: Record<string, number> = {};

      for (const doc of geracoes.docs) {
        const data = doc.data();
        tiposCounts[data.tipo] = (tiposCounts[data.tipo] || 0) + 1;

        // Check for common violations
        if (data.tipo === 'biologico' && data.descricao.toLowerCase().includes('quimico')) {
          violations.push({
            registroId: doc.id,
            tipo: 'BIOLOGICAL_CHEMICAL_MIX',
            descricao: 'Resíduo biológico descrito como químico',
          });
        }

        if (data.tipo === 'perfuro-cortante' && data.peso_kg > 30) {
          violations.push({
            registroId: doc.id,
            tipo: 'SHARPS_OVERWEIGHT',
            descricao: 'Container de perfuro-cortante pode estar superlotado',
          });
        }
      }

      // If violations found, auto-create NC (ADR 0003 integration)
      if (violations.length > 0) {
        const naoConformidade = {
          labId,
          titulo: `Violação de segregação PGRSS — ${violations.length} registro(s)`,
          descricao: `Detectadas ${violations.length} violação(ões) de segregação de resíduos conforme RDC 222/2018`,
          modulo: 'pgrss',
          severidade: violations.length > 3 ? 'critica' : 'grave',
          status: 'aberta',
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
          criadoPor: 'system',
          referencias: {
            violacoes: violations,
          },
        };

        await db.collection(`labs/${labId}/nao-conformidades`).add(naoConformidade);
      }

      return {
        success: true,
        violacoes: violations,
        counts: tiposCounts,
        totalRegistros: geracoes.size,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Erro ao validar segregação');
    }
  }
);

/**
 * gerarRelatorioMensal — Scheduled function generating monthly waste compliance report.
 * Runs at 01:00 UTC on the first day of each month.
 * RDC 222/2018 compliance documentation.
 */
export const gerarRelatorioMensal = onSchedule(
  {
    schedule: 'every month 1 0:00', // First day of month at 00:00 UTC
    region: 'southamerica-east1',
    timeoutSeconds: 300,
  },
  async () => {
    const labsSnapshot = await db.collection('labs').get();

    for (const labDoc of labsSnapshot.docs) {
      const labId = labDoc.id;

      try {
        const now = admin.firestore.Timestamp.now();
        const startOfMonth = new Date(now.toDate().getFullYear(), now.toDate().getMonth(), 1);
        const startOfMonthTimestamp = admin.firestore.Timestamp.fromDate(startOfMonth);

        // Aggregate waste data for the month
        const geracoes = await db
          .collection(`labs/${labId}/pgrss-geracao`)
          .where('deletadoEm', '==', null)
          .where('data', '>=', startOfMonthTimestamp)
          .where('data', '<', now)
          .get();

        const coletas = await db
          .collection(`labs/${labId}/pgrss-coleta`)
          .where('data', '>=', startOfMonthTimestamp)
          .where('data', '<', now)
          .get();

        // Calculate metrics
        const tiposAcumulado: Record<string, { peso_kg: number; quantidade: number }> = {};
        let pesoTotalGerado = 0;
        let pesoTotalColetado = 0;

        for (const doc of geracoes.docs) {
          const data = doc.data();
          const tipo = data.tipo;
          tiposAcumulado[tipo] = tiposAcumulado[tipo] || { peso_kg: 0, quantidade: 0 };
          tiposAcumulado[tipo].peso_kg += data.peso_kg;
          tiposAcumulado[tipo].quantidade += 1;
          pesoTotalGerado += data.peso_kg;
        }

        for (const doc of coletas.docs) {
          const data = doc.data();
          pesoTotalColetado += data.peso_total_kg;
        }

        // Calculate pending (not yet collected)
        const pesoPendente = pesoTotalGerado - pesoTotalColetado;
        const compliance = pesoTotalGerado > 0 ? (pesoTotalColetado / pesoTotalGerado) * 100 : 100;

        // Store report
        const relatorio = {
          labId,
          ano: now.toDate().getFullYear(),
          mes: now.toDate().getMonth() + 1,
          periodo: `${now.toDate().getFullYear()}-${String(now.toDate().getMonth() + 1).padStart(2, '0')}`,
          pesoTotalGerado,
          pesoTotalColetado,
          pesoPendente,
          compliancePercentual: compliance,
          tiposAcumulado,
          quantidadeGeracoes: geracoes.size,
          quantidadeColetas: coletas.size,
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection(`labs/${labId}/pgrss-relatorios`).add(relatorio);

        // Audit
        db.collection('auditLogs')
          .add({
            action: 'PGRSS_RELATORIO_GERADO',
            labId,
            payload: { mes: relatorio.mes, ano: relatorio.ano, compliancePercentual: compliance },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      } catch (error) {
        console.error(`Erro gerando relatório PGRSS para ${labId}:`, error);
      }
    }
  }
);
