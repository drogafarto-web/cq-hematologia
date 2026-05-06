import { Timestamp } from 'firebase/firestore';
import { Laudo } from './laudo';
import type { LabId, UserId } from './_shared_refs';

/**
 * Assinatura lógica SHA-256 seguindo ADR 0001
 * Cada ato (liberação, comunicação) gera LogicalSignature imutável
 */
export interface LogicalSignatureLaudo {
  operatorId: UserId;
  operatorRole: 'RT' | 'RT-Substituto' | 'Sistema';
  operatorName: string;
  operatorRegistro: string; // CRBM, CRF, CRM, CRBio etc
  timestamp: Timestamp; // server-side
  hash: string; // SHA-256(canonical(snapshot + chainHash)) — 64 chars hex
}

/**
 * Versão imutável de um laudo
 * Cada mudança de status gera nova versão (não edita em-place)
 * Retificação cria v2/v3; v1 marcada como "Superado"
 *
 * Cumpre RDC 978 Art. 167 + DICQ 5.9.3 (histórico imutável)
 */
export interface LaudoVersion {
  // Identity
  id: string;
  laudoId: string;
  labId: LabId;

  // Versionamento
  version: number; // 1, 2, 3...
  supersededBy: string | null; // versionId da próxima versão (se retificado)
  motivoRetificacao: string | null; // null em v1; obrigatório em v2+

  // Congelado — snapshot dos dados do laudo no momento
  snapshot: Laudo;

  // Assinatura lógica
  signature: LogicalSignatureLaudo;

  // Auditoria — chain hash sequencial
  chainHash: string; // SHA-256(prevChainHash + hash(snapshot))

  // PDF gerado em cloud function (Plan 10-04)
  pdfUrl?: string;
  pdfHash?: string; // SHA-256 do binário do PDF

  // Audit
  criadoEm: Timestamp;
}
