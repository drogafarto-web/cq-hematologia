import { Timestamp } from 'firebase-admin/firestore';

/**
 * ADR 0003 — Non-Conformidade (NC) Global Spine
 */

export type NCOrigin = 'insumo' | 'controle' | 'equipamento' | 'pessoas' | 'processo' | 'outro';
export type NCSeveridade = 'leve' | 'grave' | 'critica';
export type NCStatus = 'aberta' | 'investig' | 'correcao' | 'verif_eficacia' | 'fechada' | 'cancelada';
export type CapaStatus = 'planejada' | 'em_exec' | 'concluida';
export type EficaciaResult = 'eficaz' | 'ineficaz' | 'nao_concluida';

export interface NCStatusHistoryEntry {
  timestamp: Timestamp;
  novoStatus: NCStatus;
  mudadoPor: string;
  motivo?: string;
  hmac: string;
}

export interface Investigacao {
  realizada: boolean;
  dataInicio?: Timestamp;
  dataFim?: Timestamp;
  descricao?: string;
  investigadorId?: string;
  achados?: string[];
}

export interface AcaoCorretiva {
  descricao: string;
  dataPrevista: Timestamp;
  dataRealizacao?: Timestamp;
  responsavel: string;
  status: CapaStatus;
  resultado?: string;
}

export interface VerificacaoEficacia {
  realizada: boolean;
  resultado?: EficaciaResult;
  dataVerificacao?: Timestamp;
  verificadoPor?: string;
  evidencia?: string;
  observacoes?: string;
}

export interface CAPA {
  investigacao?: Investigacao;
  acaoCorretiva?: AcaoCorretiva;
  verificacaoEficacia?: VerificacaoEficacia;
  reabertura?: boolean;
}

export interface NaoConformidade {
  id: string;
  labId: string;
  numero: string;
  origem: NCOrigin;
  origemId?: string;
  moduloOrigemId: string;
  descricao: string;
  severidade: NCSeveridade;
  status: NCStatus;
  statusHistory: NCStatusHistoryEntry[];
  capa: CAPA;
  aberta: {
    timestamp: Timestamp;
    uid: string;
    motivo: string;
  };
  fechada?: {
    timestamp: Timestamp;
    uid: string;
    motivo: string;
  };
  bloqueiaOperacoes: boolean;
  operacoesTodasBloqueadas?: string[];
  hmac: string;
  previousHash: string | null;
  _ncAuditTrailRef?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
