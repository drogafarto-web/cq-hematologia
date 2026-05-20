/**
 * publicarDocumento.ts
 *
 * Cloud Function callable that publishes an SGQ document:
 * - Accepts tipoAlteracao (major/minor) from operator
 * - Calculates diff % between current and previous version content
 * - Increments version semantically (X.Y)
 * - Transitions status atomically in Firestore (source of truth)
 * - Generates official PDF snapshot from Google Doc
 * - Writes historico-versoes entry with tipoAlteracao + diffPercent
 * - Revokes edit access post-publication
 *
 * Requires RT or admin claim.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { exportAsPdf, revokeEditAccess, getDocContent } from './_drive/docsClient';
import { getAccessToken, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } from './_drive/oauthClient';
import { generateLogicalSignature } from '../shared/auditHash';
import { logger } from 'firebase-functions/v2';

const db = admin.firestore();

// ─── Types ───────────────────────────────────────────────────────────────────

type TipoAlteracao = 'major' | 'minor';

interface PublicarDocumentoInput {
  labId: string;
  documentoId: string;
  pin: string;
  tipoAlteracao: TipoAlteracao;
  razao?: string;
}

interface PublicarDocumentoOutput {
  success: boolean;
  pdfUrl: string;
  pdfHash: string;
  versao: string;
  publicadoEm: string;
  diffPercent: number;
}

interface SGQDocData {
  status: string;
  versao: string;
  codigo: string;
  titulo: string;
  googleDocId?: string;
  substitui?: string;
  url?: string;
  elaboradoPor?: string;
}

interface CustomClaims {
  labs?: string[];
  'rt-member'?: boolean;
  admin?: boolean;
}

// ─── Version helpers ────────────────────────────────────────────────────────

function parseVersao(v: string | number): { major: number; minor: number } {
  if (typeof v === 'number') return { major: v, minor: 0 };
  const parts = String(v).split('.');
  return {
    major: parseInt(parts[0], 10) || 1,
    minor: parseInt(parts[1], 10) || 0,
  };
}

function incrementVersao(current: string | number, tipo: TipoAlteracao): string {
  const { major, minor } = parseVersao(current);
  if (tipo === 'major') return `${major + 1}.0`;
  return `${major}.${minor + 1}`;
}

// ─── Diff calculation ───────────────────────────────────────────────────────

function calculateDiffPercent(oldText: string, newText: string): number {
  if (!oldText && !newText) return 0;
  if (!oldText) return 100;
  if (!newText) return 100;

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const maxLen = Math.max(oldLines.length, newLines.length);
  if (maxLen === 0) return 0;

  let changedLines = 0;
  for (let i = 0; i < maxLen; i++) {
    if ((oldLines[i] ?? '') !== (newLines[i] ?? '')) {
      changedLines++;
    }
  }

  return (changedLines / maxLen) * 100;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateRTClaim(claims: CustomClaims): void {
  if (!claims?.['rt-member'] && !claims?.['admin']) {
    throw new HttpsError('permission-denied', 'Apenas RT pode publicar documentos');
  }
}

function validatePin(pin: string): void {
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw new HttpsError('invalid-argument', 'PIN deve ter exatamente 4 dígitos');
  }
}

function validateDocData(data: FirebaseFirestore.DocumentData | undefined): SGQDocData {
  if (!data || !data.codigo) {
    throw new HttpsError('internal', 'Documento com dados incompletos no Firestore');
  }
  return {
    status: data.status,
    versao: typeof data.versao === 'number' ? `${data.versao}.0` : (data.versao ?? '1.0'),
    codigo: data.codigo,
    titulo: data.titulo ?? '',
    googleDocId: data.googleDocId ?? undefined,
    substitui: data.substitui ?? undefined,
    url: data.url ?? undefined,
    elaboradoPor: data.elaboradoPor ?? undefined,
  };
}

// ─── Callable ────────────────────────────────────────────────────────────────

export const publicarDocumento = onCall<PublicarDocumentoInput>(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET],
  },
  async (request): Promise<PublicarDocumentoOutput> => {
    const data = request.data;

    // 1. Authentication
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userId = request.auth.uid;

    // 2. Authorization
    const claims = request.auth.token as unknown as CustomClaims;
    validateRTClaim(claims);
    validatePin(data.pin);

    const tipoAlteracao: TipoAlteracao = data.tipoAlteracao === 'major' ? 'major' : 'minor';

    const isSuperAdmin = (claims as any)?.isSuperAdmin === true;
    if (!isSuperAdmin) {
      const memberRef = db.collection(`labs/${data.labId}/members`).doc(userId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists || memberSnap.data()?.active !== true) {
        throw new HttpsError('permission-denied', `Acesso negado ao lab ${data.labId}`);
      }
    }

    // 3. Fetch and validate document
    const docRef = db.collection(`/labs/${data.labId}/sgq-documentos`).doc(data.documentoId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Documento não encontrado');
    }

    const doc = validateDocData(docSnap.data());

    if (doc.status !== 'em_revisao') {
      throw new HttpsError(
        'failed-precondition',
        `Documento deve estar em revisão para publicar. Status atual: ${doc.status}`,
      );
    }

    const novaVersao = incrementVersao(doc.versao, tipoAlteracao);
    const { codigo, googleDocId } = doc;
    const now = admin.firestore.Timestamp.now();

    // 4. Calculate diff % (best-effort)
    let diffPercent = 0;
    if (googleDocId && doc.substitui) {
      try {
        const accessToken = await getAccessToken(data.labId, userId);
        const prevDocSnap = await db.doc(`/labs/${data.labId}/sgq-documentos/${doc.substitui}`).get();
        const prevGoogleDocId = prevDocSnap.data()?.googleDocId;

        if (prevGoogleDocId) {
          const [currentContent, prevContent] = await Promise.all([
            getDocContent(accessToken, googleDocId),
            getDocContent(accessToken, prevGoogleDocId),
          ]);
          diffPercent = calculateDiffPercent(prevContent, currentContent);
        }
      } catch (err) {
        logger.warn('Diff calculation failed, defaulting to 0%', {
          error: (err as Error).message,
        });
      }
    }

    // 5. Firestore atomic batch (source of truth)
    let pdfUrl = doc.url || '';
    let pdfHash = '';

    const batch = db.batch();

    batch.update(docRef, {
      status: 'vigente',
      versao: novaVersao,
      publicadoEm: now,
      publicadoPor: userId,
      dataEmissao: now,
      ultimaAtualizacao: now,
      aud: {
        operatorId: userId,
        hash: generateLogicalSignature({
          status: 'vigente',
          versao: novaVersao,
          publicadoEm: now.toDate(),
          publicadoPor: userId,
        }),
        ts: now,
      },
    });

    if (doc.substitui) {
      const prevDocRef = db.collection(`/labs/${data.labId}/sgq-documentos`).doc(doc.substitui);
      batch.update(prevDocRef, {
        status: 'obsoleto',
        substituidoPor: data.documentoId,
        ultimaAtualizacao: now,
      });

      const prevAuditRef = db.collection(`/labs/${data.labId}/sgq-documentos-audit`).doc();
      batch.set(prevAuditRef, {
        labId: data.labId,
        documentoId: doc.substitui,
        codigoSnapshot: codigo,
        versaoSnapshot: doc.versao,
        type: 'status-changed',
        fromStatus: 'vigente',
        toStatus: 'obsoleto',
        motivo: `Substituído pela versão ${novaVersao}`,
        timestamp: now,
        operadorId: userId,
        operadorName: '',
      });
    }

    const auditRef = db.collection(`/labs/${data.labId}/sgq-documentos-audit`).doc();
    batch.set(auditRef, {
      event: 'publicado',
      documentoId: data.documentoId,
      codigo,
      versao: novaVersao,
      tipoAlteracao,
      diffPercent,
      operatorId: userId,
      razao: data.razao || null,
      ts: now,
      hash: generateLogicalSignature({
        event: 'publicado',
        documentoId: data.documentoId,
        versao: novaVersao,
        operatorId: userId,
        ts: now.toDate(),
      }),
    });

    // Historico-versoes entry (append-only, DICQ 4.3)
    const historicoRef = db
      .collection(`/labs/${data.labId}/sgq-documentos/${data.documentoId}/historico-versoes`)
      .doc();
    batch.set(historicoRef, {
      versao: novaVersao,
      tipoAlteracao,
      diffPercent,
      data: now,
      elaboradoPor: doc.elaboradoPor ?? '',
      elaboradoPorId: userId,
      aprovadoPor: '',
      aprovadoPorId: userId,
      alteracao: data.razao || `Publicação da versão ${novaVersao}`,
      documentoId: data.documentoId,
    });

    await batch.commit();

    // 6. Google Docs operations (best-effort after Firestore commit)
    if (googleDocId) {
      let accessToken: string;
      try {
        accessToken = await getAccessToken(data.labId, userId);
      } catch {
        logger.warn('OAuth token unavailable for GDoc update post-publication', {
          documentoId: data.documentoId,
        });
        return { success: true, pdfUrl, pdfHash, versao: novaVersao, publicadoEm: now.toDate().toISOString(), diffPercent };
      }

      try {
        const pdfBuffer = await exportAsPdf(accessToken, googleDocId);
        pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

        const bucket = admin.storage().bucket();
        const storagePath = `labs/${data.labId}/sgq/snapshots/${codigo}_v${novaVersao}.pdf`;
        const file = bucket.file(storagePath);

        await file.save(pdfBuffer, {
          contentType: 'application/pdf',
          metadata: {
            metadata: {
              documentoId: data.documentoId,
              codigo,
              versao: novaVersao,
              tipoAlteracao,
              publicadoPor: userId,
              publicadoEm: now.toDate().toISOString(),
            },
          },
        });

        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        pdfUrl = signedUrl;

        await docRef.update({
          snapshotPdfUrl: pdfUrl,
          snapshotPdfHash: pdfHash,
        });

        await auditRef.update({ pdfHash, pdfUrl });
      } catch (err) {
        logger.error('Google Docs post-publication operations failed', {
          documentoId: data.documentoId,
          error: (err as Error).message,
        });
      }

      // Revoke edit access (best-effort)
      try {
        const membersSnap = await db.collection(`/labs/${data.labId}/members`).get();
        const emails = membersSnap.docs
          .map((m) => m.data().email as string)
          .filter(Boolean);

        if (emails.length > 0) {
          const token = await getAccessToken(data.labId, userId);
          await revokeEditAccess(token, googleDocId, emails);
        }
      } catch (err) {
        logger.warn('Failed to revoke edit access post-publication', {
          documentoId: data.documentoId,
          error: (err as Error).message,
        });
      }
    }

    return {
      success: true,
      pdfUrl,
      pdfHash,
      versao: novaVersao,
      publicadoEm: now.toDate().toISOString(),
      diffPercent,
    };
  },
);
