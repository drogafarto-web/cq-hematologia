/**
 * Personnel - Designações Type System
 *
 * Types para designações formais (RT, QA Manager, Diretor).
 * Multi-tenant: escoped a `/labs/{labId}/designacoes`
 */

export type DesignacaoType = 'responsavel-tecnico' | 'gerente-qualidade' | 'diretor-laboratorio';

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: number;
}

export interface Designacao {
  id: string;
  labId: string;
  type: DesignacaoType;
  personId: string;
  personName: string;
  cargoId: string;
  dataDesignacao: number;
  motivo: string;
  vigencia: number;
  dataExpiracao: number;
  assinatura: LogicalSignature;
  auditLog: {
    action: 'created' | 'revoked';
    timestamp: number;
    operatorId: string;
    reason?: string;
  }[];
  createdAt: number;
  createdBy: string;
  deletedAt?: number;
}

export interface CreateDesignacaoInput {
  type: DesignacaoType;
  personId: string;
  personName: string;
  cargoId: string;
  dataDesignacao: number;
  motivo: string;
  vigencia: number;
}
