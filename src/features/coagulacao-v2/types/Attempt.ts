import type { Timestamp } from 'firebase/firestore';
import type { CoagAnalyteId } from '../../coagulacao/types/_shared_refs';
import type { WestgardViolation } from '../../../types';
import type { InsumoSnapshot } from '../../insumos/types/InsumoSnapshot';
import type { EquipamentoSnapshot } from '../../equipamentos/types/Equipamento';

export interface Attempt {
  id: string;
  labId: string;
  controlOperacionalId: string;
  equipamentoId: string;
  resultados: Record<CoagAnalyteId, number>;
  dataRealizacao: string;
  conformidade: 'A' | 'R';
  violacoes: WestgardViolation[];
  analitosComViolacao: CoagAnalyteId[];
  acaoCorretiva: string | null;
  snapshot: {
    controle: InsumoSnapshot;
    reagente: InsumoSnapshot;
    reagenteTtpa: InsumoSnapshot | null;
    equipamento: EquipamentoSnapshot;
  };
  overrides: {
    insumoVencido: boolean;
    qcNaoValidado: boolean;
    motivo: string | null;
  };
  logicalSignature: string;
  signedBy: string;
  signedAt: Timestamp;
  criadoEm: Timestamp;
  criadoPor: string;
}

export interface AttemptInput {
  controlOperacionalId: string;
  equipamentoId: string;
  resultados: Record<CoagAnalyteId, number>;
  acaoCorretiva?: string;
}
