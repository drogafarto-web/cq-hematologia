import * as admin from 'firebase-admin';

/**
 * ADR 0003 — Não-Conformidade Global Spine
 */

export enum NCSeveridade {
  LEVE = 'leve',
  MEDIA = 'media',
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

export interface NaoConformidade {
  id?: string;
  labId: string;
  numero: string;
  titulo: string;
  descricao: string;
  categoria?: string;
  severidade: NCSeveridade | string;
  status: string;
  origem?: NCOrigem | string;
  abertaPor: string;
  dataAbertura?: admin.firestore.Timestamp;
  capa?: CAPA;
  hmac?: string;
  previousHash?: string | null;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  criadoEm?: admin.firestore.Timestamp;
  atualizadoEm?: admin.firestore.Timestamp;
  _version?: number;
}
