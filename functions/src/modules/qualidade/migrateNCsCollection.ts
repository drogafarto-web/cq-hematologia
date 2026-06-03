/**
 * migrateNCsToCorrectCollection.ts
 *
 * Script de migração: move documentos de /labs/{labId}/nao-conformidades
 * para /labs/{labId}/naoConformidades (collection correta usada pelo frontend).
 *
 * Mantém o documento original como backup (não deleta).
 * Adapta o schema antigo para o schema NaoConformidade do ADR 0003.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();

const db = getFirestore();

export const migrateNCsCollection = onCall(
  { memory: '512MiB', timeoutSeconds: 300, region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login obrigatório.');
    }

    const { labId } = request.data as { labId: string };
    if (!labId) {
      throw new HttpsError('invalid-argument', 'labId obrigatório.');
    }

    // Verify admin/owner/rt role
    const memberSnap = await db.doc(`labs/${labId}/members/${request.auth.uid}`).get();
    const memberData = memberSnap.data();
    if (!memberSnap.exists || !['owner', 'admin', 'rt'].includes(memberData?.role)) {
      throw new HttpsError('permission-denied', 'Apenas owner/admin/rt pode executar migração.');
    }

    // Read all docs from old collection
    const oldCollRef = db.collection(`labs/${labId}/nao-conformidades`);
    const oldSnap = await oldCollRef.get();

    if (oldSnap.empty) {
      return { migrated: 0, message: 'Nenhuma NC encontrada na collection antiga.' };
    }

    const newCollRef = db.collection(`labs/${labId}/naoConformidades`);
    let migrated = 0;
    let skipped = 0;

    for (const doc of oldSnap.docs) {
      const oldData = doc.data();

      // Check if already migrated (same id exists in new collection)
      const existingDoc = await newCollRef.doc(doc.id).get();
      if (existingDoc.exists) {
        skipped++;
        continue;
      }

      // Map old schema to new schema (ADR 0003)
      const newDoc: Record<string, any> = {
        id: doc.id,
        labId,
        codigo: oldData.numero || oldData.codigo || `NC-MIG-${doc.id.substring(0, 6)}`,
        titulo: oldData.titulo || oldData.descricao?.substring(0, 80) || 'NC migrada',
        descricao: oldData.descricao || '',
        severidade: oldData.severidade || 'grave',
        origem: mapOrigem(oldData.origem),
        moduloOrigem: oldData.moduloOrigemId || oldData.moduloOrigem || null,
        auditoriaId: oldData.auditoriaId || oldData.origemRef || null,
        bloqueiaOperacoes: oldData.bloqueiaOperacoes ?? true,
        modulosBloqueados: oldData.modulosBloqueados || [],
        capaStatus: mapStatus(oldData.status || oldData.capaStatus),
        capaHistorico: oldData.capaHistorico || [
          {
            status: 'nao_iniciada',
            timestamp: oldData.criadoEm || oldData.createdAt || Timestamp.now(),
            realizadoPor: oldData.criadoPor || oldData.aberta?.uid || 'system',
            realizadoPorName: 'Sistema (migração)',
            descricao: 'NC migrada da collection antiga.',
            evidencias: [],
          },
        ],
        abertaEm: oldData.abertaEm || oldData.criadoEm || oldData.createdAt || Timestamp.now(),
        abertaPor: oldData.abertaPor || oldData.criadoPor || oldData.aberta?.uid || 'system',
        prazoClosure: oldData.prazoClosure || null,
        fechadaEm: oldData.fechadaEm || null,
        fechadaPor: oldData.fechadaPor || null,
        deletadoEm: oldData.deletadoEm || null,
        // Metadata de migração
        _migratedFrom: 'nao-conformidades',
        _migratedAt: Timestamp.now(),
        _originalDocId: doc.id,
      };

      await newCollRef.doc(doc.id).set(newDoc);
      migrated++;
    }

    return {
      migrated,
      skipped,
      total: oldSnap.size,
      message: `Migração concluída: ${migrated} NCs migradas, ${skipped} já existiam.`,
    };
  },
);

function mapOrigem(origem: string | undefined): string {
  if (!origem) return 'interno';
  if (origem === 'controle') return 'modulo';
  if (origem === 'auditoria-avancada') return 'modulo';
  if (['auditoria', 'modulo', 'cliente', 'interno'].includes(origem)) return origem;
  return 'interno';
}

function mapStatus(status: string | undefined): string {
  if (!status) return 'nao_iniciada';
  if (status === 'aberta') return 'nao_iniciada';
  if (status === 'em_investigacao') return 'investigacao';
  if (status === 'acao_corretiva') return 'acao';
  if (status === 'validacao') return 'eficacia';
  if (status === 'encerrada' || status === 'fechada') return 'fechada';
  if (['nao_iniciada', 'investigacao', 'acao', 'eficacia', 'fechada', 'reaberta'].includes(status))
    return status;
  return 'nao_iniciada';
}
