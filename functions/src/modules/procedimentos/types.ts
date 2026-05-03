import { Timestamp } from 'firebase-admin/firestore';

/**
 * ADR 0004 — POP Versionado (Procedimentos Operacionais Padrão)
 */

export interface POPVersao {
  numero: string;
  dataVigenciaInicio: Timestamp;
  dataVigenciaFim: Timestamp;
  hashConteudo: string;
  assinadaPor: {
    uid: string;
    nome: string;
    cargo: string;
    timestamp: Timestamp;
    hmac: string;
  };
  proximaRevisao: Timestamp;
  status: 'ativa' | 'obsoleta' | 'em_revisao';
  motivo_obsolescencia?: string;
}

export interface POP {
  id: string;
  labId: string;
  nome: string;
  codigo: string;

  conteudo: {
    markdown?: string;
    pdfUrl?: string;
    versaoDocumento: string;
  };

  versoes: POPVersao[];

  treinamentosObrigatorios: Array<{
    modulo: string;
    tipoTreinamento: 'inicial' | 'reciclagem';
    periodicidadeMeses: number;
  }>;

  criadoEm: Timestamp;
  criadoPor: string;
  modulos: string[];
}

export interface POPVersaoRef {
  popId: string;
  popVersaoNumero: string;
  assinadaPor: string;
  dataAssinatura: Timestamp;
}

export interface TreinamentoPOP {
  popId: string;
  popVersaoNumero: string;
  dataConcluso: Timestamp;
  validoAte: Timestamp;
  certificado_url?: string;
}

// Request/Response types for callables
export interface POPCreationRequest {
  labId: string;
  nome: string;
  codigo: string;
  conteudo: { markdown?: string; pdfUrl?: string };
  treinamentosObrigatorios: Array<{
    modulo: string;
    tipoTreinamento: 'inicial' | 'reciclagem';
    periodicidadeMeses: number;
  }>;
  modulos: string[];
}

export interface POPVersionCreationRequest {
  labId: string;
  popId: string;
  conteudo: { markdown?: string; pdfUrl?: string };
  isMajorVersion?: boolean;
}

export interface POPSignatureRequest {
  labId: string;
  popId: string;
  popVersaoId: string;
}

export interface POPTrainingRequest {
  labId: string;
  operadorUid: string;
  popId: string;
  popVersaoNumero: string;
  certificado_url?: string;
}

export interface POPValidationResult {
  allowed: boolean;
  reason?: string;
  expiraEm?: Timestamp;
}
