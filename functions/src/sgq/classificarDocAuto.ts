/**
 * functions/src/sgq/classificarDocAuto.ts
 *
 * Cloud Function callable: Automatically classify a document based on LM-01 code
 *
 * Heuristics:
 * - MQ-XXX → tipo: MQ, confidence: 1.0
 * - PQ-XX → tipo: PQ, confidence: 1.0
 * - IT-XXX → tipo: IT (or ITA/ITE/CCE based on content), confidence: 0.7-1.0
 * - FR-XX → tipo: FR, confidence: 1.0
 * - POL-XXX → tipo: POL, confidence: 1.0
 * - DC-XXX → tipo: DC, confidence: 1.0
 * - etc.
 *
 * Also suggests lista de distribuição based on LM-01 entry.
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { TipoDocumentoType } from './_drive/lm01Parser';

export interface ClassificarDocAutoInput {
  labId: string;
  codigo: string; // e.g., "MQ-001", "IT-005"
  titulo: string;
  preview?: string; // Document content preview (optional, for refinement)
  lm01SetoresLD?: string[]; // Lista de distribuição from LM-01
}

export interface ClassificarDocAutoOutput {
  tipo: TipoDocumentoType;
  confidence: number; // 0.0-1.0
  sugerirSetoresLD?: string[];
  reasoning: string;
}

/**
 * Classify document type from LM-01 código
 */
function classificaFromCodigo(codigo: string): {
  tipo: TipoDocumentoType;
  confidence: number;
  reasoning: string;
} {
  const prefix = codigo.split('-')[0];

  const classifications: Record<
    string,
    { tipo: TipoDocumentoType; confidence: number }
  > = {
    MQ: { tipo: 'MQ', confidence: 1.0 },
    PQ: { tipo: 'PQ', confidence: 1.0 },
    IT: { tipo: 'IT', confidence: 0.8 }, // Could be ITA/ITE/CCE, refine later
    FR: { tipo: 'FR', confidence: 1.0 },
    POL: { tipo: 'POL', confidence: 1.0 },
    DC: { tipo: 'DC', confidence: 1.0 },
    LM: { tipo: 'LM', confidence: 1.0 },
    EXT: { tipo: 'EXT', confidence: 1.0 },
    INF: { tipo: 'INF', confidence: 1.0 },
    CER: { tipo: 'CER', confidence: 1.0 },
    REL: { tipo: 'REL', confidence: 1.0 },
    ATA: { tipo: 'ATA', confidence: 1.0 },
    ITA: { tipo: 'ITA', confidence: 1.0 },
    ITE: { tipo: 'ITE', confidence: 1.0 },
    CCE: { tipo: 'CCE', confidence: 1.0 },
  };

  const classification = classifications[prefix] || {
    tipo: 'EXT' as TipoDocumentoType,
    confidence: 0.5,
  };

  return {
    ...classification,
    reasoning: `Classified from código prefix: ${prefix}`,
  };
}

/**
 * Refine IT classification based on content keywords
 */
function refineITClassification(titulo: string, preview?: string): {
  tipo: TipoDocumentoType;
  confidence: number;
} {
  const content = `${titulo} ${preview || ''}`.toLowerCase();

  if (
    content.includes('análise') ||
    content.includes('analítica') ||
    content.includes('biochemistry')
  ) {
    return { tipo: 'ITA', confidence: 0.85 };
  } else if (
    content.includes('coleta') ||
    content.includes('venosa') ||
    content.includes('punção')
  ) {
    return { tipo: 'ITE', confidence: 0.85 };
  } else if (
    content.includes('controle') ||
    content.includes('qualidade externa') ||
    content.includes('ceq')
  ) {
    return { tipo: 'CCE', confidence: 0.85 };
  }

  return { tipo: 'IT', confidence: 0.7 };
}

export const classificarDocAuto = onCall<ClassificarDocAutoInput, Promise<ClassificarDocAutoOutput>>(
  async (request: CallableRequest<ClassificarDocAutoInput>) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    const { labId, codigo, titulo, preview, lm01SetoresLD } = request.data;
    const userId = request.auth.uid;

    try {
      let classification = classificaFromCodigo(codigo);

      // Refine IT classification if preview available
      if (classification.tipo === 'IT' && preview) {
        const refined = refineITClassification(titulo, preview);
        classification = { ...classification, ...refined };
      }

      // Log operation
      await admin
        .firestore()
        .collection('labs')
        .doc(labId)
        .collection('sgq-classificacao-logs')
        .doc()
        .set({
          userId,
          codigo,
          titulo,
          classificacao: classification.tipo,
          confidence: classification.confidence,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      return {
        tipo: classification.tipo,
        confidence: classification.confidence,
        sugerirSetoresLD: lm01SetoresLD,
        reasoning: classification.reasoning,
      } as ClassificarDocAutoOutput;
    } catch (error) {
      console.error('[classificarDocAuto] error:', error);
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Classification failed',
      );
    }
  },
);
