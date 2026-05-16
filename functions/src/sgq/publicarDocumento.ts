/**
 * publicarDocumento.ts
 *
 * Cloud Function callable that publishes an SGQ document:
 * - Transitions status atomically in Firestore (source of truth)
 * - Generates official PDF snapshot from Google Doc
 * - Updates Google Doc header to VIGENTE
 * - Revokes edit access post-publication
 *
 * Requires RT or admin claim.
 * Uses OAuth2 user token for Google Docs/Drive operations.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { updateHeaderStatus, exportAsPdf, revokeEditAccess } from './_drive/docsClient';
import { getAccessToken, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } from './_drive/oauthClient';
import { generateLogicalSignature } from '../shared/auditHash';
import { logger } from 'firebase-functions/v2';

const db = admin.firestore();

// ─── Types ───────────────────────────────────────────────────────────────────

interface PublicarDocumentoInput {
  labId: string;
  documentoId: string;
  pin: string;
  razao?: string;
}

interface PublicarDocumentoOutput {
  success: boolean;
  pdfUrl: string;
  pdfHash: string;
  versao: number;
  publicadoEm: string;
}

interface SGQDocData {
  status: string;
  versao: number;
  codigo: string;
  titulo: string;
  googleDocId?: string;
  substitui?: string;
  url?: string;
}

interface CustomClaims {
  labs?: string[];
  'rt-member'?: boolean;
  admin?: boolean;
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
  if (!data || !data.codigo || typeof data.versao !== 'number') {
    throw new HttpsError('internal', 'Documento com dados incompletos no Firestore');
  }
  return {
    status: data.status,
    versao: data.versao,
    codigo: data.codigo,
    titulo: data.titulo ?? '',
    googleDocId: data.googleDocId ?? undefined,
    substitui: data.substitui ?? undefined,
    url: data.url ?? undefined,
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

    const { versao, codigo, googleDocId } = doc;
    const now = admin.firestore.Timestamp.now();
    const today = now.toDate().toISOString().split('T')[0];

    // 4. Firestore atomic batch FIRST (source of truth)
    let pdfUrl = doc.url || '';
    let pdfHash = '';

    const batch = db.batch();

    batch.update(docRef, {
      status: 'vigente',
      publicadoEm: now,
      publicadoPor: userId,
      dataEmissao: now,
      ultimaAtualizacao: now,
      aud: {
        operatorId: userId,
        hash: generateLogicalSignature({
          status: 'vigente',
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

      // Audit: anterior → obsoleto
      const prevAuditRef = db.collection(`/labs/${data.labId}/sgq-documentos-audit`).doc();
      batch.set(prevAuditRef, {
        labId: data.labId,
        documentoId: doc.substitui,
        codigoSnapshot: codigo,
        versaoSnapshot: versao - 1,
        type: 'status-changed',
        fromStatus: 'vigente',
        toStatus: 'obsoleto',
        motivo: `Substituído pela versão ${versao}`,
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
      versao,
      operatorId: userId,
      razao: data.razao || null,
      ts: now,
      hash: generateLogicalSignature({
        event: 'publicado',
        documentoId: data.documentoId,
        operatorId: userId,
        ts: now.toDate(),
      }),
    });

    await batch.commit();

    // 5. Google Docs operations (best-effort after Firestore commit)
    if (googleDocId) {
      let accessToken: string;
      try {
        accessToken = await getAccessToken(data.labId, userId);
      } catch {
        logger.warn('OAuth token unavailable for GDoc update post-publication', {
          documentoId: data.documentoId,
        });
        return { success: true, pdfUrl, pdfHash, versao, publicadoEm: now.toDate().toISOString() };
      }

      try {
        await updateHeaderStatus(accessToken, googleDocId, 'VIGENTE', today);

        const pdfBuffer = await exportAsPdf(accessToken, googleDocId);
        pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

        const bucket = admin.storage().bucket();
        const storagePath = `labs/${data.labId}/sgq/snapshots/${codigo}_v${versao}.pdf`;
        const file = bucket.file(storagePath);

        await file.save(pdfBuffer, {
          contentType: 'application/pdf',
          metadata: {
            metadata: {
              documentoId: data.documentoId,
              codigo,
              versao: String(versao),
              publicadoPor: userId,
              publicadoEm: now.toDate().toISOString(),
            },
          },
        });

        // 7-day signed URL (regenerate on demand via client)
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        pdfUrl = signedUrl;

        // Update Firestore with PDF data
        await docRef.update({
          snapshotPdfUrl: pdfUrl,
          snapshotPdfHash: pdfHash,
        });

        // Update audit entry with PDF hash
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
      versao,
      publicadoEm: now.toDate().toISOString(),
    };
  },
);
