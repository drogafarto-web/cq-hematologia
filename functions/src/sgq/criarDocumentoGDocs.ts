import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  createDocument,
  createDocumentFromSource,
  shareWithUsers,
} from './_drive/docsClient';
import { getAccessToken, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } from './_drive/oauthClient';
import { logger } from 'firebase-functions/v2';

const db = admin.firestore();
const storage = admin.storage();

interface CriarDocGDocsInput {
  labId: string;
  documentoId: string;
}

interface CriarDocGDocsOutput {
  googleDocId: string;
  googleDocUrl: string;
}

interface CustomClaims {
  labs?: string[];
  'rt-member'?: boolean;
  admin?: boolean;
  isSuperAdmin?: boolean;
}

const SHARE_BATCH_SIZE = 5;

const SOURCE_MIME_TYPES: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.doc': 'application/msword',
};

const SOURCE_EXTENSIONS = Object.keys(SOURCE_MIME_TYPES);

async function tryGetSourceFile(
  labId: string,
  codigo: string,
): Promise<{ buffer: Buffer; mimeType: string; path: string } | null> {
  const bucket = storage.bucket();

  for (const ext of SOURCE_EXTENSIONS) {
    const path = `labs/${labId}/sgq/documentos/${codigo}/source${ext}`;
    const file = bucket.file(path);

    try {
      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        return { buffer, mimeType: SOURCE_MIME_TYPES[ext], path };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export const criarDocumentoGDocs = onCall<CriarDocGDocsInput>(
  {
    region: 'southamerica-east1',
    memory: '512MiB',
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET],
  },
  async (request): Promise<CriarDocGDocsOutput> => {
    const { labId, documentoId } = request.data;

    // 1. Auth
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const userId = request.auth.uid;

    // 2. Lab membership (via Firestore, not claims)
    const claims = request.auth.token as unknown as CustomClaims;
    const isSuperAdmin = claims?.isSuperAdmin === true;

    if (!isSuperAdmin) {
      const memberRef = db.collection(`labs/${labId}/members`).doc(userId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists || memberSnap.data()?.active !== true) {
        throw new HttpsError('permission-denied', `Acesso negado ao lab ${labId}`);
      }
    }

    // 3. Fetch document
    const docRef = db.collection(`/labs/${labId}/sgq-documentos`).doc(documentoId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Documento não encontrado');
    }

    const docData = docSnap.data()!;

    // 4. Idempotent: already linked
    if (docData.googleDocId) {
      return {
        googleDocId: docData.googleDocId,
        googleDocUrl: docData.googleDocUrl,
      };
    }

    // 5. Status check
    if (docData.status !== 'em_revisao') {
      throw new HttpsError(
        'failed-precondition',
        `Documento deve estar em revisão para criar Google Doc (status atual: ${docData.status})`,
      );
    }

    // 6. Lab Drive config
    const configSnap = await db.doc(`/labs/${labId}/sgq-config/drive`).get();
    if (!configSnap.exists || !configSnap.data()?.folderId) {
      throw new HttpsError(
        'failed-precondition',
        'Configuração do Drive não encontrada. Configure a pasta do lab.',
      );
    }
    const { folderId } = configSnap.data()!;

    // 7. Get OAuth2 access token for user
    let accessToken: string;
    try {
      accessToken = await getAccessToken(labId, userId);
    } catch {
      throw new HttpsError(
        'failed-precondition',
        'Autorização do Google Drive não encontrada. Re-autorize o acesso ao Drive nas configurações do SGQ.',
      );
    }

    // 8. Create Google Doc (from source .docx if available, otherwise empty)
    const title = `${docData.codigo} — ${docData.titulo}`;
    let docId: string;
    let docUrl: string;

    try {
      const sourceFile = await tryGetSourceFile(labId, docData.codigo);

      if (sourceFile) {
        logger.info(`Creating Doc from source: ${sourceFile.path}`, { codigo: docData.codigo });
        const result = await createDocumentFromSource(
          accessToken,
          title,
          folderId,
          sourceFile.buffer,
          sourceFile.mimeType,
        );
        docId = result.docId;
        docUrl = result.docUrl;
      } else {
        logger.info('No source file found, creating empty Doc', { codigo: docData.codigo });
        const result = await createDocument(accessToken, title, folderId);
        docId = result.docId;
        docUrl = result.docUrl;
      }
    } catch (err) {
      throw new HttpsError(
        'internal',
        `Falha ao criar documento no Google Drive: ${(err as Error).message}`,
      );
    }

    // 9. Header is NOT injected into the document body (carimbo virtual).
    // Metadata lives in Firestore; rendered by the client viewer and PDF export.

    // 10. Share with active lab members (batched to avoid rate limits)
    const membersSnap = await db
      .collection(`/labs/${labId}/members`)
      .where('status', '==', 'active')
      .get();

    const memberEmails = membersSnap.docs
      .map((m) => m.data().email as string | undefined)
      .filter((e): e is string => !!e);

    if (memberEmails.length > 0) {
      for (let i = 0; i < memberEmails.length; i += SHARE_BATCH_SIZE) {
        const chunk = memberEmails.slice(i, i + SHARE_BATCH_SIZE);
        try {
          await shareWithUsers(accessToken, docId, chunk, 'writer');
        } catch (err) {
          logger.warn('Failed to share doc with some members', {
            chunk,
            error: (err as Error).message,
          });
        }
      }
    }

    // 11. Atomic Firestore update + audit log
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    batch.update(docRef, {
      googleDocId: docId,
      googleDocUrl: docUrl,
      ultimaAtualizacao: now,
    });

    const auditRef = db.collection(`/labs/${labId}/sgq-documentos-audit`).doc();
    batch.set(auditRef, {
      event: 'google-doc-created',
      documentoId,
      googleDocId: docId,
      googleDocUrl: docUrl,
      operatorId: userId,
      ts: now,
    });

    await batch.commit();

    return { googleDocId: docId, googleDocUrl: docUrl };
  },
);
