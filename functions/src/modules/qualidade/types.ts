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

export interface NCOrigem {
  tipo: 'ciq' | 'auditoria' | 'reclamacao' | 'manual' | 'cq';
  modulo: string;
  referenciaId?: string;
}

export interface CAPA {
  investigacao?: {
    realizada: boolean;
    dataInicio?: admin.firestore.Timestamp;
    dataFim?: admin.firestore.Timestamp;
    descricao?: string;
    investigadorId?: string;
    achados?: any[];
  };
  acaoCorretiva?: {
    descricao: string;
    dataPrevista: admin.firestore.Timestamp;
    responsavel: string;
    status: 'planejada' | 'em_execucao' | 'concluida';
  };
  verificacaoEficacia?: {
    realizada: boolean;
    resultado: 'eficaz' | 'ineficaz' | 'nao_concluida';
    dataVerificacao: admin.firestore.Timestamp;
    verificadoPor: string;
    evidencia: string;
  };
  reabertura?: boolean;
}

export type CAPAStatus = 'nao_iniciada' | 'investigacao' | 'acao' | 'eficacia' | 'fechada' | 'reaberta';

export interface NaoConformidade {
  readonly id: string;
  readonly labId: string;
  codigo: string;
  titulo: string;
  descricao: string;
  severidade: 'critica' | 'grave' | 'moderada' | 'leve';
  origem: 'auditoria' | 'modulo' | 'cliente' | 'interno';
  moduloOrigem?: string;
  auditoriaId?: string;
  bloqueiaOperacoes: boolean;
  modulosBloqueados?: string[];
  capaStatus: CAPAStatus;
  capaHistorico: Array<{
    estado: CAPAStatus;
    dataTransicao: admin.firestore.Timestamp;
    responsavel: string;
    anotacoes?: string;
  }>;
  abertaEm: admin.firestore.Timestamp;
  abertaPor: string;
  prazoClosure?: admin.firestore.Timestamp;
  fechadaEm?: admin.firestore.Timestamp | null;
  fechadaPor?: string;
  // Audit fields
  hmac?: string;
  previousHash?: string | null;
  criadoEm: admin.firestore.Timestamp;
  deletadoEm: admin.firestore.Timestamp | null;
  _version?: number;
}
