/**
 * personnel/types/AutorizacaoFormal.ts
 *
 * Documento de Autorização Formal.
 * Registra concessão/revogação de autoridades específicas a colaboradores.
 * DICQ 5.1.3 + RDC 978/2025 Art. 122
 */

import type { Timestamp } from '../../../shared/services/firebase';

export type TipoAutorizacao =
  | 'liberar_laudo'
  | 'operar_equipamento_critico'
  | 'assinar_nc'
  | 'aprovar_ciq'
  | 'supervisionar'
  | 'outro';

export const TIPO_AUTORIZACAO_LABEL: Record<TipoAutorizacao, string> = {
  liberar_laudo: 'Liberar laudos',
  operar_equipamento_critico: 'Operar equipamento crítico',
  assinar_nc: 'Assinar NC/CAPA',
  aprovar_ciq: 'Aprovar CIQ',
  supervisionar: 'Supervisionar equipe',
  outro: 'Outro',
};

export interface AutorizacaoFormal {
  id: string;
  labId: string;
  colaboradorId: string;
  colaboradorNome: string;
  tipo: TipoAutorizacao;
  descricao: string;
  dataConcessao: Timestamp;
  dataRevogacao?: Timestamp;
  concedidoPorId: string;
  concedidoPorNome: string;
  ativa: boolean;
  observacoes?: string;
  criadoEm: Timestamp;
  updatedAt: Timestamp;
  deletadoEm: Timestamp | null;
}

export type AutorizacaoFormalInput = Omit<
  AutorizacaoFormal,
  'id' | 'labId' | 'criadoEm' | 'updatedAt' | 'deletadoEm'
>;
