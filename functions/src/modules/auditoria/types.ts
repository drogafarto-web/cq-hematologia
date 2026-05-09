import type { Timestamp } from 'firebase-admin/firestore';

export type SeveridadeAchado = 'crítica' | 'grave' | 'moderada' | 'leve' | 'observação';
export type PlanoAcaoStatus = 'nao_iniciado' | 'em_execucao' | 'fechado' | 'vencido';

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: Timestamp;
}

export interface Achado {
  id: string;
  sessaoId: string;
  labId: string;
  checklistItemId: string;
  descricao: string;
  evidencia: string;
  severidade: SeveridadeAchado;
  statusNC: 'pendente' | 'criada' | 'fechada';
  ncId?: string;
  assinatura: LogicalSignature;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export interface PlanoAcao {
  auditoriaId: string;
  achadoId: string;
  descricao: string;
  responsavel: string;
  prazo: Timestamp;
  evidencia?: string;
  status: PlanoAcaoStatus;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  concluídoEm?: Timestamp;
}

export interface Auditoria {
  readonly id: string;
  readonly labId: string;
  ano: number;
  frequencia: 'anual' | 'semestral' | 'trimestral' | 'mensal';
  responsavelTecnico: string;
  proximaAuditoriaPlanejada: Timestamp;
  status: 'planejada' | 'em_execução' | 'finalizada';
  // Re-audit support (PQ-24 §6.6 — Effectiveness verification)
  tipoExecucao?: 'inicial' | 'reAuditoria';
  auditoriaOriginalId?: string; // FK quando tipoExecucao === 'reAuditoria'
  escopoSetores?: string[]; // ['Bioquímica', 'Imuno', ...]
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export interface Sessao {
  readonly id: string;
  readonly auditoriaId: string;
  readonly labId: string;
  auditor: string;
  dataInicio: Timestamp;
  dataFim: Timestamp | null;
  status: 'planejada' | 'em-execução' | 'finalizada';
  totalItens: number;
  itensConforme: number;
  itensNãoConforme: number;
  itensNA: number;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export interface ChecklistItem {
  readonly id: string;
  readonly sessaoId: string;
  readonly labId: string;
  readonly numeroDICQ: string;
  readonly descricao: string;
  readonly categoria: string;
  readonly bloco: string;
  isApplicable: boolean;
  resposta: 'conforme' | 'não-conforme' | 'N/A' | null;
  severidade: SeveridadeAchado | null;
  observacoes: string;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
}

export interface Presenca {
  readonly id: string;
  readonly sessaoId: string;
  readonly auditoriaId: string;
  readonly labId: string;
  readonly userId: string;
  nome: string;
  papel: 'auditor' | 'auditado' | 'observador' | 'rt' | 'gerente_qc' | 'direcao';
  reuniao: 'abertura' | 'encerramento';
  assinatura: LogicalSignature;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export interface Reuniao {
  readonly id: string;
  readonly sessaoId: string;
  readonly auditoriaId: string;
  readonly labId: string;
  reuniao: 'abertura' | 'encerramento';
  pauta: string;
  dataHora: Timestamp;
  presencasConfirmadas: number;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}
