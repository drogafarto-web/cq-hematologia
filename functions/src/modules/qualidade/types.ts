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
