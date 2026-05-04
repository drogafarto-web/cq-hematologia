/**
 * Módulo: PGRSS (Plano de Gerenciamento de Resíduos de Serviços de Saúde)
 *
 * Gestão de resíduos de saúde com segregação, coleta e comprovantes.
 * Conformidade com RDC 222/2018 ANVISA.
 *
 * Firestore path: /labs/{labId}/pgrss/{registroId}
 */

import type { Timestamp } from 'firebase/firestore';

export type TipoResiduo = 'biologico' | 'quimico' | 'radioativo' | 'perfuro-cortante' | 'comum';
export type StatusRegistro = 'gerado' | 'segregado' | 'coletado' | 'descartado';

export interface RegistroGeracao {
  readonly id: string;
  readonly labId: string;

  data: Timestamp;
  tipo: TipoResiduo;
  descricao: string;
  peso_kg: number;
  responsavel: string;

  status: StatusRegistro;
  observacoes?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export interface ColletaResiduo {
  readonly id: string;
  readonly labId: string;

  data: Timestamp;
  empresa_coletora: string;
  registroGeracaoIds: string[];
  peso_total_kg: number;
  comprovante_url?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
}

export type RegistroGeracaoInput = Omit<
  RegistroGeracao,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'
>;

export interface ColletaInput {
  labId: string;
  data: Timestamp;
  empresa_coletora: string;
  registroGeracaoIds: string[];
  peso_total_kg: number;
  comprovante_url?: string;
}
