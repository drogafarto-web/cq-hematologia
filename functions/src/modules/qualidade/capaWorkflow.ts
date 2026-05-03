import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { NaoConformidade, Investigacao, AcaoCorretiva, VerificacaoEficacia } from './types';
import { signAuditEntry } from '../audit/cryptoAudit';

const db = admin.firestore();

/**
 * CAPA Workflow Helpers
 *
 * These functions encapsulate the CAPA (Ação Corretiva e Preventiva) workflow steps:
 * 1. Investigação: Understand root cause
 * 2. Ação Corretiva: Plan and execute corrective action
 * 3. Verificação de Eficácia: Verify the action was effective
 *
 * Each step updates the NC status and records HMAC-signed audit entries (ADR 0005)
 */

/**
 * Start investigation of NC
 * Transition: 'aberta' → 'investig'
 */
export async function investigarNC(
  labId: string,
  ncId: string,
  uid: string,
  investigadorNome: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not configured');

    const ncDocRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
    const ncSnapshot = await ncDocRef.get();

    if (!ncSnapshot.exists) {
      return { success: false, message: '', error: `NC ${ncId} not found` };
    }

    const nc = ncSnapshot.data() as NaoConformidade;

    if (nc.status !== 'aberta') {
      return {
        success: false,
        message: '',
        error: `Cannot start investigation on NC in status '${nc.status}'. Expected 'aberta'.`,
      };
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Set investigacao data
    const investigacao: Investigacao = {
      realizada: true,
      dataInicio: now as any,
      investigadoPor: uid,
    };

    // Update NC
    await ncDocRef.update({
      status: 'investig',
      'capa.investigacao': investigacao,
      updatedAt: now,
    });

    // Log to audit trail
    await signAuditEntry(
      `labs/${labId}/nao-conformidades/audit-trail`,
      uid,
      'nc.investigada',
      {
        ncId,
        numero: nc.numero,
        investigador: investigadorNome,
      },
      secret
    );

    return { success: true, message: `Investigation started for NC ${nc.numero}` };
  } catch (error: any) {
    return { success: false, message: '', error: error.message };
  }
}

/**
 * Record root cause conclusion from investigation
 */
export async function concluirInvestigacao(
  labId: string,
  ncId: string,
  uid: string,
  conclusao: string,
  dataFim?: Timestamp
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not configured');

    const ncDocRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
    const ncSnapshot = await ncDocRef.get();

    if (!ncSnapshot.exists) {
      return { success: false, message: '', error: `NC ${ncId} not found` };
    }

    const nc = ncSnapshot.data() as NaoConformidade;

    if (nc.status !== 'investig') {
      return {
        success: false,
        message: '',
        error: `Cannot conclude investigation on NC in status '${nc.status}'. Expected 'investig'.`,
      };
    }

    const now = dataFim || admin.firestore.FieldValue.serverTimestamp();

    // Update investigacao with conclusion
    await ncDocRef.update({
      'capa.investigacao.dataFim': now,
      'capa.investigacao.conclusao': conclusao,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log to audit trail
    await signAuditEntry(
      `labs/${labId}/nao-conformidades/audit-trail`,
      uid,
      'nc.investigada',
      {
        ncId,
        numero: nc.numero,
        conclusao: conclusao.substring(0, 200), // Log first 200 chars
      },
      secret
    );

    return { success: true, message: `Investigation concluded for NC ${nc.numero}` };
  } catch (error: any) {
    return { success: false, message: '', error: error.message };
  }
}

/**
 * Execute corrective action
 * Transition: 'investig' → 'correcao'
 */
export async function executarAcaoCorretiva(
  labId: string,
  ncId: string,
  uid: string,
  descricao: string,
  dataPrevista: Timestamp,
  responsavelNome: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not configured');

    const ncDocRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
    const ncSnapshot = await ncDocRef.get();

    if (!ncSnapshot.exists) {
      return { success: false, message: '', error: `NC ${ncId} not found` };
    }

    const nc = ncSnapshot.data() as NaoConformidade;

    if (nc.status !== 'investig') {
      return {
        success: false,
        message: '',
        error: `Cannot execute action on NC in status '${nc.status}'. Expected 'investig' (investigation concluded).`,
      };
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Set acaoCorretiva data
    const acaoCorretiva: AcaoCorretiva = {
      descricao,
      dataPrevista,
      status: 'planejada',
      responsavel: uid,
    };

    // Update NC
    await ncDocRef.update({
      status: 'correcao',
      'capa.acaoCorretiva': acaoCorretiva,
      updatedAt: now,
    });

    // Log to audit trail
    await signAuditEntry(
      `labs/${labId}/nao-conformidades/audit-trail`,
      uid,
      'nc.acao_realizada',
      {
        ncId,
        numero: nc.numero,
        acaoDescricao: descricao.substring(0, 200),
        responsavel: responsavelNome,
        dataPrevista: dataPrevista.toDate?.() || dataPrevista,
      },
      secret
    );

    return { success: true, message: `Corrective action planned for NC ${nc.numero}` };
  } catch (error: any) {
    return { success: false, message: '', error: error.message };
  }
}

/**
 * Record that corrective action was executed
 */
export async function registrarAcaoRealizada(
  labId: string,
  ncId: string,
  uid: string,
  resultadoObtido: string,
  dataRealizacao?: Timestamp
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not configured');

    const ncDocRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
    const ncSnapshot = await ncDocRef.get();

    if (!ncSnapshot.exists) {
      return { success: false, message: '', error: `NC ${ncId} not found` };
    }

    const nc = ncSnapshot.data() as NaoConformidade;

    if (nc.status !== 'correcao') {
      return {
        success: false,
        message: '',
        error: `Cannot register action on NC in status '${nc.status}'. Expected 'correcao'.`,
      };
    }

    const now = dataRealizacao || admin.firestore.FieldValue.serverTimestamp();

    // Update acaoCorretiva with execution info
    await ncDocRef.update({
      'capa.acaoCorretiva.dataRealizacao': now,
      'capa.acaoCorretiva.resultadoObtido': resultadoObtido,
      'capa.acaoCorretiva.status': 'concluida',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log to audit trail
    await signAuditEntry(
      `labs/${labId}/nao-conformidades/audit-trail`,
      uid,
      'nc.acao_realizada',
      {
        ncId,
        numero: nc.numero,
        resultadoObtido: resultadoObtido.substring(0, 200),
      },
      secret
    );

    return { success: true, message: `Corrective action completed for NC ${nc.numero}` };
  } catch (error: any) {
    return { success: false, message: '', error: error.message };
  }
}

/**
 * Verify efficacy of corrective action
 * Transition: 'correcao' → 'verif_eficacia'
 */
export async function verificarEficacia(
  labId: string,
  ncId: string,
  uid: string,
  resultado: 'eficaz' | 'ineficaz' | 'nao_concluida',
  evidencia: string,
  observacoes?: string,
  dataVerificacao?: Timestamp
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not configured');

    const ncDocRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
    const ncSnapshot = await ncDocRef.get();

    if (!ncSnapshot.exists) {
      return { success: false, message: '', error: `NC ${ncId} not found` };
    }

    const nc = ncSnapshot.data() as NaoConformidade;

    if (nc.status !== 'correcao') {
      return {
        success: false,
        message: '',
        error: `Cannot verify efficacy on NC in status '${nc.status}'. Expected 'correcao' (action completed).`,
      };
    }

    const now = dataVerificacao || admin.firestore.FieldValue.serverTimestamp();

    // Set verificacao data
    const verificacao: VerificacaoEficacia = {
      realizada: true,
      resultado,
      dataVerificacao: now as any,
      verificadoPor: uid,
      evidencia,
      observacoes,
    };

    // Determine next state based on efficacy result
    let nextStatus: 'verif_eficacia' | 'fechada' | 'investig';
    if (resultado === 'eficaz') {
      nextStatus = 'fechada';
    } else {
      nextStatus = 'verif_eficacia'; // Always update to verif_eficacia first
    }

    // Update NC
    const updates: any = {
      'capa.verificacaoEficacia': verificacao,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (nextStatus === 'fechada') {
      updates.status = 'fechada';
      updates.fechada = {
        timestamp: now,
        uid,
        motivo: `Ação corretiva verificada como eficaz: ${evidencia}`,
      };
      updates.bloqueiaOperacoes = false; // Unblock operations
    } else {
      updates.status = 'verif_eficacia'; // Just record verification, don't close yet
    }

    await ncDocRef.update(updates);

    // Log to audit trail
    await signAuditEntry(
      `labs/${labId}/nao-conformidades/audit-trail`,
      uid,
      'nc.eficacia_verificada',
      {
        ncId,
        numero: nc.numero,
        resultado,
        evidencia: evidencia.substring(0, 200),
        observacoes: observacoes?.substring(0, 200),
        novoStatus: nextStatus,
      },
      secret
    );

    const resultMessage =
      resultado === 'eficaz'
        ? `NC ${nc.numero} fechada com sucesso`
        : resultado === 'ineficaz'
        ? `Ação foi ineficaz. Investigação será reabierta para NC ${nc.numero}`
        : `Verificação de eficácia não concluída para NC ${nc.numero}`;

    return { success: true, message: resultMessage };
  } catch (error: any) {
    return { success: false, message: '', error: error.message };
  }
}

/**
 * Reopen investigation after ineffective action
 * Transition: 'verif_eficacia' → 'investig'
 */
export async function reabrirInvestigacao(
  labId: string,
  ncId: string,
  uid: string,
  motivo: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not configured');

    const ncDocRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
    const ncSnapshot = await ncDocRef.get();

    if (!ncSnapshot.exists) {
      return { success: false, message: '', error: `NC ${ncId} not found` };
    }

    const nc = ncSnapshot.data() as NaoConformidade;

    if (nc.status !== 'verif_eficacia') {
      return {
        success: false,
        message: '',
        error: `Cannot reopen investigation on NC in status '${nc.status}'. Expected 'verif_eficacia'.`,
      };
    }

    // Clear previous investigation + action, reset to 'investig'
    await ncDocRef.update({
      status: 'investig',
      'capa.investigacao': {
        realizada: true,
        dataInicio: admin.firestore.FieldValue.serverTimestamp(),
        investigadoPor: uid,
      },
      'capa.acaoCorretiva': {}, // Clear previous action
      'capa.verificacaoEficacia': {}, // Clear previous verification
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log to audit trail
    await signAuditEntry(
      `labs/${labId}/nao-conformidades/audit-trail`,
      uid,
      'nc.investigada',
      {
        ncId,
        numero: nc.numero,
        motivo: `Reabertura: ${motivo}`,
      },
      secret
    );

    return { success: true, message: `Investigation reopened for NC ${nc.numero}` };
  } catch (error: any) {
    return { success: false, message: '', error: error.message };
  }
}

/**
 * Cancel NC (supervisor/admin only)
 * Transition: Any state → 'cancelada'
 */
export async function cancelarNC(
  labId: string,
  ncId: string,
  uid: string,
  motivo: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const secret = process.env.HCQ_SIGNATURE_HMAC_KEY;
    if (!secret) throw new Error('HCQ_SIGNATURE_HMAC_KEY not configured');

    const ncDocRef = db.collection(`labs/${labId}/nao-conformidades`).doc(ncId);
    const ncSnapshot = await ncDocRef.get();

    if (!ncSnapshot.exists) {
      return { success: false, message: '', error: `NC ${ncId} not found` };
    }

    const nc = ncSnapshot.data() as NaoConformidade;
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Update NC
    await ncDocRef.update({
      status: 'cancelada',
      bloqueiaOperacoes: false,
      updatedAt: now,
    });

    // Log to audit trail
    await signAuditEntry(
      `labs/${labId}/nao-conformidades/audit-trail`,
      uid,
      'nc.cancelada',
      {
        ncId,
        numero: nc.numero,
        anteriorStatus: nc.status,
        motivo,
      },
      secret
    );

    return { success: true, message: `NC ${nc.numero} cancelada` };
  } catch (error: any) {
    return { success: false, message: '', error: error.message };
  }
}
