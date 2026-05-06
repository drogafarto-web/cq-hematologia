/**
 * detectarCriticos — Firestore trigger onCreate de laudos
 *
 * Roda quando um laudo é criado:
 * 1. Lê thresholds ativos
 * 2. Roda detectAllCriticos
 * 3. Se hasCritico: flagga laudo + dispara email
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { detectAllCriticos, type CriticoMatch } from './_shared/exameClassifier';

const REGION = 'southamerica-east1';

export const detectarCriticos = onDocumentCreated(
  {
    document: 'labs/{labId}/laudos/{laudoId}',
    region: REGION,
  },
  async (event) => {
    const { labId, laudoId } = event.params;
    const laudo = event.data?.data();

    if (!laudo) {
      console.error(`[detectarCriticos] Laudo não encontrado: ${laudoId}`);
      return;
    }

    const db = admin.firestore();

    // 1. Lê thresholds ativos
    const criticosSnap = await db
      .collection(`labs/${labId}/criticos-thresholds`)
      .where('ativo', '==', true)
      .where('deletadoEm', '==', null)
      .get();

    const thresholds = criticosSnap.docs.map((doc) => doc.data());

    // 2. Se não há thresholds, skip
    if (thresholds.length === 0) {
      console.log(`[detectarCriticos] Sem thresholds para ${labId}, skip`);
      return;
    }

    // 3. Detecta críticos
    const detectionResult = detectAllCriticos(
      laudo.exames || [],
      thresholds as any,
      {
        idade: typeof laudo.pacienteIdade === 'object' && 'value' in laudo.pacienteIdade
          ? laudo.pacienteIdade.value
          : 0,
        sexo: laudo.paciente?.sexo || 'NI',
      },
    );

    // 4. Se há críticos, flagga laudo + dispara email
    if (detectionResult.hasCritico) {
      const batch = db.batch();

      // Update laudo
      const laudoRef = db.doc(`labs/${labId}/laudos/${laudoId}`);
      batch.update(laudoRef, {
        criticoFlag: true,
        criticoDetalhes: detectionResult.criticos.map((c: CriticoMatch) => ({
          exameId: c.exameId,
          analitoNome: c.threshold.analitoNome,
          valor: c.valor,
          severidade: c.severidade,
          motivo: c.reason,
        })),
      });

      // Audit log
      const auditRef = db.collection(`labs/${labId}/audit-logs`).doc();
      batch.set(auditRef, {
        tipo: 'critico_detectado',
        laudoId,
        count: detectionResult.criticos.length,
        criadoEm: admin.firestore.Timestamp.now(),
      });

      await batch.commit();

      // Dispara email (será feito em Plan 10-03 com Resend)
      console.log(
        `[detectarCriticos] ${detectionResult.criticos.length} críticos detectados em ${laudoId}`,
      );
    }
  },
);
