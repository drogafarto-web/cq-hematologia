import type { Timestamp } from 'firebase/firestore';

// ─── Método ────────────────────────────────────────────────────────────────
export type VHSMetodo = 'westergren' | 'automatizado';

// ─── Status ────────────────────────────────────────────────────────────────
export type VHSStatus = 'pendente' | 'liberado' | 'divergente' | 'cancelado';

// ─── Leitura individual (operacional) ──────────────────────────────────────
export interface VHSLeitura {
  valor: number; // mm/h
  responsavelNome: string; // quem fez a leitura física (texto livre)
  leituraEm: Timestamp; // data/hora REAL da leitura (manual, não server)
  assinatura: string; // SHA-256 (64 chars)
}

// ─── Audit trail (automático, não visível no form) ─────────────────────────
export interface VHSAudit {
  registradoPor: string; // uid do user logado que criou o registro
  registradoEm: Timestamp; // serverTimestamp do create
  alteradoPor?: string; // uid do user que fez update
  alteradoEm?: Timestamp; // serverTimestamp do update
}

// ─── Documento Firestore ───────────────────────────────────────────────────
export interface VHSExam {
  id: string;
  labId: string;
  amostraId: string;
  pacienteId?: string;
  pacienteNome?: string;
  metodo: VHSMetodo;
  equipamentoId?: string;
  observacoes?: string;

  leitura1: VHSLeitura;
  leitura2: VHSLeitura | null;

  // Campos de dupla checagem opcional
  isValidationActive?: boolean;
  validacaoLeitura1?: VHSLeitura | null;
  validacaoLeitura2?: VHSLeitura | null;

  status: VHSStatus;
  divergencia?: number; // |L1 - L2| em mm/h

  audit: VHSAudit;

  // Campos de liberação (RT aprova divergente)
  liberadoEm?: Timestamp;
  liberadoPor?: string;
  liberadoMotivo?: string;

  // Campos de cancelamento
  canceladoEm?: Timestamp;
  canceladoPor?: string;
  canceladoMotivo?: string;
}

// ─── Input DTO (frontend → service) ────────────────────────────────────────

export interface VHSLeituraInput {
  valor: number;
  responsavelNome: string;
  leituraEm: Date; // Date JS, convertido em Timestamp no service
}

export interface VHSExamInput {
  amostraId: string;
  pacienteId?: string;
  pacienteNome?: string;
  metodo: VHSMetodo;
  equipamentoId?: string;
  observacoes?: string;
  leitura1: VHSLeituraInput;
  leitura2?: VHSLeituraInput; // opcional — se omitido, status = 'pendente'

  isValidationActive?: boolean;
  validacaoLeitura1?: VHSLeituraInput;
  validacaoLeitura2?: VHSLeituraInput;
}

export interface VHSAddLeitura2Input {
  leitura2: VHSLeituraInput;
}

export interface VHSLiberarInput {
  motivo: string; // >= 10 chars
}
