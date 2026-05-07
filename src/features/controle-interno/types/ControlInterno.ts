import type { LabId, LogicalSignature, Timestamp, UserId } from './_shared_refs';

/**
 * Cargo — role/função no laboratório para designações CAPA (Controle de
 * Atividades de Pessoal Autorizado). Imutável após criação (soft-delete only).
 *
 * Vinculado a operadores via Designacao.cargoId.
 */
export interface Cargo {
  readonly id: string;
  readonly labId: LabId;
  nome: string;
  departamento: string;
  /** Nível hierárquico: 1 (operacional) até 5 (diretoria). */
  nivel: 1 | 2 | 3 | 4 | 5;
  responsabilidades: string;
  readonly criadoEm: Timestamp;
  readonly deletadoEm: Timestamp | null;
}

export type CargoInput = Omit<Cargo, 'id' | 'labId' | 'criadoEm' | 'deletadoEm'>;

/**
 * Designacao — registro digital de atribuição de cargo a operador.
 * Imutável após criação (soft-delete only).
 *
 * Vinculações:
 *   - operatorId: FK para users/{uid}
 *   - cargoId: FK para cargos/{cargoId}
 *   - assinatura.operatorId: UID do Responsável Técnico que fez a designação
 *
 * RDC 978 Art. 122 (Supervisão de turnos): cada designação tem auditoria
 * via assinatura HMAC + trilha de modificações em subcoleção auditLog.
 */
export interface Designacao {
  readonly id: string;
  readonly labId: LabId;
  operatorId: UserId;
  cargoId: string;
  cargoNivel: 1 | 2 | 3 | 4 | 5;
  dataInicio: Timestamp;
  /** null = designação indefinida (válida até revogação explícita) */
  dataFim: Timestamp | null;
  /** HMAC-SHA256 assinado por RT via Cloud Function callable. */
  assinatura: LogicalSignature;
  readonly criadoEm: Timestamp;
  readonly deletadoEm: Timestamp | null;
}

export type DesignacaoInput = Omit<
  Designacao,
  'id' | 'labId' | 'assinatura' | 'criadoEm' | 'deletadoEm'
>;

/**
 * Payload do Cloud Function callable signDesignacao.
 * Server irá gerar assinatura e criar o doc em /labs/{labId}/designacoes/{docId}.
 */
export interface SignDesignacaoInput {
  labId: LabId;
  operatorId: UserId;
  cargoId: string;
  startDate: number; // millis epoch
  endDate: number | null; // millis epoch ou null para indefinido
  rtId: UserId; // Responsável Técnico que autoriza
}

export interface SignDesignacaoResult {
  designacaoId: string;
  seal: LogicalSignature;
  createdAt: number; // millis epoch
}
