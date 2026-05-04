import * as admin from 'firebase-admin';

/**
 * ADR 0003 — Não-Conformidade Global Spine
 */

export enum NCSeveridade {
  LEVE = 'leve',
  MODERADA = 'moderada',
  GRAVE = 'grave',
  CRITICA = 'critica',
}

export type NCOrigem = 'auditoria' | 'modulo' | 'cliente' | 'interno';

export type CAPAStatus = 'nao_iniciada' | 'investigacao' | 'acao' | 'eficacia' | 'fechada' | 'reaberta';

export interface CAPAHistoricoEntry {
  estado: CAPAStatus;
  dataTransicao: admin.firestore.Timestamp;
  responsavel: string;
  descricao?: string;
  achados?: any[];
  dataPrevista?: admin.firestore.Timestamp;
  resultado?: 'eficaz' | 'ineficaz' | 'nao_concluida';
  evidencia?: string;
}

export interface NaoConformidade {
  id?: string;
  labId: string;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria?: string;
  severidade: NCSeveridade | string;
  capaStatus: CAPAStatus;
  capaHistorico: CAPAHistoricoEntry[];
  bloqueiaOperacoes?: boolean;
  origem: NCOrigem;
  abertaPor: string;
  criadoEm: admin.firestore.Timestamp;
  atualizadoEm: admin.firestore.Timestamp;
  deletadoEm?: admin.firestore.Timestamp | null;
  hmac?: string;
  previousHash?: string | null;
  // ADR 0003 Wave 3: Module-level blocking gates
  moduloOrigemId?: string; // 'equipamento', 'pessoas', 'procedimentos', etc
  origemId?: string; // FK to specific resource (equipId, userId, popId, etc)
}

// ADR 0001 Wave 2 — Compliance Reporting Types
export interface QualidadeAuditEntry {
  labId: string;
  operation: string;
  modulo: string;
  acao: string;
  resultado: 'sucesso' | 'falha' | 'aviso';
  operatorId: string;
  payload: Record<string, any>;
  timestamp: admin.firestore.Timestamp;
  deletadoEm: null;
  previousHash: string | null;
  hmac: string;
  hash: string;
}

export interface AuditTrailFilters {
  modulo?: string;
  operadorId?: string;
  resultado?: string;
}

export interface ComplianceReport {
  labId: string;
  generatedAt: admin.firestore.Timestamp;
  generatedBy: string;
  dateRange: {
    inicio: Date;
    fim: Date;
  };
  summary: {
    totalEntries: number;
    operatorsInvolved: number;
    modulesCovered: string[];
    successCount: number;
    failureCount: number;
    warningCount: number;
  };
  chainStatus: 'válida' | 'inválida' | 'parcial';
  chainViolations?: Array<{
    entryId: string;
    reason: string;
  }>;
  rdc978Compliance: {
    auditTrailComplete: boolean;
    noGapsinSequence: boolean;
    hmacIntegrityValid: boolean;
  };
  dicq44Compliance: {
    entriesImmutable: boolean;
    operatorIdentification: boolean;
    timestampServerGenerated: boolean;
    auditTrailIsolated: boolean;
  };
}
