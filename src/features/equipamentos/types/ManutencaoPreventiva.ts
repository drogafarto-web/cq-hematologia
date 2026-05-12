/**
 * Manutenção preventiva/corretiva vinculada a equipamento.
 *
 * Firestore: `/labs/{labId}/equipamentos/{equipamentoId}/manutencoes/{id}`
 */

import type { Timestamp } from 'firebase/firestore';
import type { LogicalSignature } from '../../educacao-continuada/types/_shared_refs';

export type ManutencaoStatus = 'agendada' | 'realizada' | 'cancelada';

export interface ManutencaoPreventiva {
  id: string;
  labId: string;
  equipamentoId: string;
  tipo: 'preventiva' | 'corretiva';
  descricao: string;
  responsavelId: string;
  responsavelNome: string;
  dataPrevista: Timestamp;
  dataRealizada?: Timestamp;
  status: ManutencaoStatus;
  observacoes?: string;
  logicalSignature?: LogicalSignature;
  criadoEm: Timestamp;
  updatedAt: Timestamp;
}
