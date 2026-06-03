import { Timestamp } from 'firebase/firestore';
import type { LabId, UserId } from './_shared_refs';
import { ReleaseState, ExamClassification } from './releaseState';

/**
 * RDC 978 Art. 167 — 14 campos obrigatórios
 * 1. Serviço (CNES)
 * 2. Endereço do serviço
 * 3. RT (responsável técnico)
 * 4. Profissional que assina
 * 5. Paciente
 * 6. Idade/data nascimento
 * 7. Data/hora coleta
 * 8. Material
 * 9. Método analítico
 * 10. Resultado
 * 11. Valores referência
 * 12. Interpretação (assinada por RT)
 * 13. Data emissão
 * 14. Assinatura (LogicalSignature)
 */

export interface DuplaVerificacaoMetadata {
  resultadoInicial: number;
  usuarioLeitura1: UserId;
  nomeUsuarioLeitura1: string;
  dataHoraLeitura1: Timestamp;

  resultadoConfirmado?: number;
  usuarioLeitura2?: UserId;
  nomeUsuarioLeitura2?: string;
  dataHoraLeitura2?: Timestamp;

  divergente: boolean;
  statusVerificacao:
    | 'aguardando_segunda_leitura'
    | 'liberado_coincidente'
    | 'divergente_bloqueado'
    | 'revisado_e_liberado';

  usuarioRevisao?: UserId;
  nomeUsuarioRevisao?: string;
  dataHoraRevisao?: Timestamp;
  resultadoFinal?: number;
  justificativaRevisao?: string;
}

export interface ExameLaudo {
  id: string;
  nome: string; // "Glicose"
  tipoMaterial: string; // "Soro"
  metodoAnalitico: string; // "Hexoquinase"
  resultados: Array<{
    value: number;
    unidade: string;
    nivelId?: string; // referência para população de referência (age/sex)
  }>;
  valoresReferencia: {
    min: number;
    max: number;
    descricao: string;
  };
  duplaVerificacao?: DuplaVerificacaoMetadata;
  limitacoesTecnicas?: string;
  interpretacao?: string;
}

export interface Laudo {
  // Identity
  id: string;
  labId: LabId;

  // RDC 978 Art. 167 — 14 campos
  // 1 + 2: Serviço (CNES + endereço)
  cnes: string;
  labName: string;
  labEndereco: string;
  labTelefone: string;

  // 3: RT (responsável técnico)
  rtNome: string;
  rtRegistro: string;

  // 4: Profissional que assina (pode ser RT ou substituto)
  profissionalAssinaName: string;
  profissionalAssinaRegistro: string;

  // 5: Paciente
  paciente: {
    id: string;
    nome: string;
    cpf?: string;
    sexo: 'M' | 'F' | 'NI';
  };

  // 6: Idade ou data de nascimento
  pacienteIdade: { value: number; unit: 'anos' | 'meses' | 'dias' } | { dataNascimento: Timestamp };

  // 7: Data/hora coleta
  coletaEm: Timestamp;

  // 8, 9, 10, 11: Material, método, resultado, valores referência
  exames: ExameLaudo[];

  // 12: Interpretação assinada por RT
  metodologiaPropria: boolean;

  // Material restrito (requer aprovação RT)
  materialRestrito: {
    ativo: boolean;
    descricao?: string;
  };

  // 13: Data emissão
  emissaoEm: Timestamp;

  // 14: Signature (vai em LaudoVersion)
  // + outros campos de negócio

  // Médico solicitante (não é campo RDC mas necessário para portal + rastreabilidade)
  medicoSolicitanteId: string;
  medicoSolicitanteName: string;
  medicoSolicitanteCRM: string;

  // Estado da liberação
  status: ReleaseState;
  classification: ExamClassification;
  criticoFlag: boolean;
  currentVersion: number;

  // Audit
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

/**
 * Input DTO — omit audit/identity fields that only service should set
 */
export type LaudoInput = Omit<Laudo, 'id' | 'labId' | 'currentVersion' | 'criadoEm' | 'deletadoEm'>;
