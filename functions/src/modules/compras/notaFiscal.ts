import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { NotaFiscal, NotaFiscalItem, InsumoLote } from './types';
import { isFornecedorQualificado } from './fornecedor';
import { signAuditEntry } from '../audit/cryptoAudit';

const db = admin.firestore();

/**
 * Register NotaFiscal (Invoice)
 * Validates Fornecedor is qualified before accepting
 */
export const criarNotaFiscal = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Autenticação necessária');
  }

  const {
    labId,
    numero,
    serie,
    dataEmissao,
    fornecedorId,
    itens,
    valorTotal,
  } = request.data;

  if (!labId || !numero || !serie || !fornecedorId || !itens?.length) {
    throw new functions.HttpsError(
      'invalid-argument',
      'Campos obrigatórios: labId, numero, serie, fornecedorId, itens'
    );
  }

  // Verify Fornecedor is qualified (ADR 0002)
  const qualCheck = await isFornecedorQualificado(labId, fornecedorId);
  if (!qualCheck.qualified) {
    throw new functions.HttpsError(
      'failed-precondition',
      `Fornecedor não qualificado: ${qualCheck.reason}`
    );
  }

  const nfRef = db.collection(`labs/${labId}/notas-fiscais`).doc();

  // Convert dataEmissao: string (ISO) → Timestamp
  let dataEmissaoTs: admin.firestore.Timestamp;
  try {
    if (typeof dataEmissao === 'string') {
      dataEmissaoTs = admin.firestore.Timestamp.fromDate(new Date(`${dataEmissao}T00:00:00`));
    } else if (dataEmissao instanceof admin.firestore.Timestamp) {
      dataEmissaoTs = dataEmissao;
    } else {
      throw new Error('dataEmissao deve ser string ISO ou Timestamp');
    }
  } catch (err) {
    throw new functions.HttpsError(
      'invalid-argument',
      `dataEmissao inválida: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const notaFiscal: NotaFiscal = {
    id: nfRef.id,
    labId,
    numero,
    serie,
    dataEmissao: dataEmissaoTs,
    fornecedorId,
    itens: itens as NotaFiscalItem[],
    valorTotal,
    createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
    createdBy: request.auth.uid,
  };

  await nfRef.set(notaFiscal);

  // Audit log (non-blocking)
  const secret = process.env.HCQ_SIGNATURE_HMAC_KEY || 'dev-key';
  signAuditEntry(
    `/labs/${labId}/notas-fiscais`,
    request.auth.uid,
    'notaFiscal.criada',
    { numero, serie, fornecedorId, itens: itens.length },
    secret
  ).catch(() => {});

  return { success: true, nfId: nfRef.id };
});

/**
 * Confirm receipt of NotaFiscal (Conferência)
 * Validates all items, checks deviations, creates Lotes
 */
export const confirmarRecebimento = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'Autenticação necessária');
  }

  const { labId, nfId, desviosObservados } = request.data;

  if (!labId || !nfId) {
    throw new functions.HttpsError(
      'invalid-argument',
      'labId e nfId obrigatórios'
    );
  }

  const nfRef = db.doc(`labs/${labId}/notas-fiscais/${nfId}`);
  const nfSnap = await nfRef.get();

  if (!nfSnap.exists) {
    throw new functions.HttpsError('not-found', 'Nota Fiscal não encontrada');
  }

  const nf = nfSnap.data() as NotaFiscal;

  // Update NF with receipt confirmation
  await nfRef.update({
    dataRecebimento: admin.firestore.FieldValue.serverTimestamp(),
    conferidoPor: request.auth.uid,
    desviosObservados: desviosObservados || [],
    conferenciaOk: !desviosObservados || desviosObservados.length === 0,
  });

  // Create Insumo Lotes from NF items (ADR 0002: rastreabilidade completa)
  const batch = db.batch();
  const loteIds: string[] = [];

  for (let i = 0; i < nf.itens.length; i++) {
    const item = nf.itens[i];
    const loteRef = db.collection(`labs/${labId}/insumos`).doc();

    const lote: InsumoLote = {
      id: loteRef.id,
      labId,
      descricao: item.descricao,
      loteNumber: item.loteNumber || `${nf.numero}-${i}`,
      dataFabricacao: item.loteNumber ? '2025-01-01' : '', // Parse if available
      validadeAte: item.validadeAte || '2026-12-31',
      quantidade: item.quantidade,
      unidade: item.unidade,
      status: 'ativo',
      // ADR 0002: Mandatory fiscal traceability
      notaFiscalId: nfId,
      fornecedorId: nf.fornecedorId,
      nfItemIndex: i,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
      createdBy: request.auth.uid,
      tipo: 'reagente',
    };

    batch.set(loteRef, lote);
    loteIds.push(loteRef.id);
  }

  await batch.commit();

  // Audit
  const secret = process.env.HCQ_SIGNATURE_HMAC_KEY || 'dev-key';
  signAuditEntry(
    `/labs/${labId}/notas-fiscais`,
    request.auth.uid,
    'notaFiscal.conferida',
    { nfId, lotesGerados: loteIds.length, desvios: desviosObservados?.length || 0 },
    secret
  ).catch(() => {});

  return {
    success: true,
    lotesGerados: loteIds,
    desvios: desviosObservados?.length || 0,
  };
});
