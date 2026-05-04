import type { Timestamp } from 'firebase-admin/firestore';

export type SeveridadeAchado = 'critica' | 'grave' | 'moderada' | 'leve' | 'observacao';
export type PlanoAcaoStatus = 'nao_iniciado' | 'em_execucao' | 'fechado' | 'vencido';

export interface Achado {
  id: string;
  descricao: string;
  severidade: SeveridadeAchado;
  criterio: string;
  evidencias?: string[];
  ncGerada?: string;
  readonly registradoEm: Timestamp;
  readonly registradoPor: string;
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

  codigo: string;
  titulo: string;
  tipo: 'interna' | 'externa' | 'auditoria_cliente';
  escopo: string;

  checklist?: {
    totalItens: number;
    itensConforme: number;
    itensNaoConforme: number;
    itensNA: number;
  };

  achados: Achado[];
  planosAcao: PlanoAcao[];

  readonly agendadaPara: Timestamp;
  readonly realizadaEm?: Timestamp;
  readonly realizadaPor?: string;
  readonly realizadaPorName?: string;
  prazoClosure?: Timestamp;

  status: 'planejada' | 'em_execucao' | 'finalizada' | 'fechada';
  observacoes?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: null | Timestamp;
}
