import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

const db = admin.firestore();

/**
 * Trigger: quando um novo membro é adicionado a um lab, copia o token OAuth
 * do Drive (se existir) de qualquer membro existente para o novo membro.
 * Isso garante que todos os membros do lab possam usar o Google Docs para revisão.
 */
export const onMemberCreatedCopyOAuth = onDocumentCreated(
  {
    document: 'labs/{labId}/members/{memberId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const { labId, memberId } = event.params;

    const tokensCol = db.collection(`labs/${labId}/sgq-oauth-tokens`);
    const existingTokens = await tokensCol.limit(1).get();

    if (existingTokens.empty) {
      logger.info('No OAuth token to copy for new member', { labId, memberId });
      return;
    }

    const sourceToken = existingTokens.docs[0].data();
    await tokensCol.doc(memberId).set(sourceToken);

    logger.info('Copied OAuth token to new member', { labId, memberId });
  },
);
