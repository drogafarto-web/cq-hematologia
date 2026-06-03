/**
 * EquipamentoDocumento — documento/arquivo vinculado a um equipamento.
 *
 * Firestore: /labs/{labId}/equipamentos/{equipamentoId}/documentos/{docId}
 * Storage:   labs/{labId}/equipamentos/{equipamentoId}/docs/{uuid}.{ext}
 *
 * Tipos: NF de compra, manual do fabricante, contrato de manutenção,
 * laudo de manutenção, certificado de calibração, qualificação, outro.
 *
 * Soft-delete only (RDC 978 — retenção 5 anos).
 */

import type { Timestamp } from 'firebase/firestore';

export type DocumentoTipo =
  | 'nota_fiscal'
  | 'manual'
  | 'contrato_manutencao'
  | 'laudo_manutencao'
  | 'certificado_calibracao'
  | 'qualificacao'
  | 'outro';

export const DOCUMENTO_TIPO_LABEL: Record<DocumentoTipo, string> = {
  nota_fiscal: 'Nota Fiscal',
  manual: 'Manual do Fabricante',
  contrato_manutencao: 'Contrato de Manutenção',
  laudo_manutencao: 'Laudo de Manutenção',
  certificado_calibracao: 'Certificado de Calibração',
  qualificacao: 'Qualificação (IQ/OQ/PQ)',
  outro: 'Outro',
};

export interface EquipamentoDocumento {
  id: string;
  labId: string;
  equipamentoId: string;
  tipo: DocumentoTipo;
  titulo: string;
  descricao?: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
  deletadoEm: Timestamp | null;
}

/** MIME types aceitos para upload. */
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

/** Tamanho máximo de arquivo: 10 MB. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
