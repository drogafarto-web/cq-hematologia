/**
 * Tipos compartilhados entre client e server
 * Importados no lugar de duplicar tipos Firebase
 */

import { Timestamp } from 'firebase-admin/firestore';

export type LabId = string & { readonly __brand: 'LabId' };
export type UserId = string & { readonly __brand: 'UserId' };

export function labId(id: string): LabId {
  return id as LabId;
}

export function userId(id: string): UserId {
  return id as UserId;
}

export type ReleaseState =
  | 'Pendente'
  | 'Em Revisão'
  | 'Liberado'
  | 'Auto-Liberado'
  | 'Comunicado'
  | 'Superado';
export type ExamClassification = 'rotina' | 'revisao-rt' | 'bloqueio-critico';

/**
 * Laudo — documento principal
 * Armazenado em /labs/{labId}/laudos/{laudoId}
 */
export interface Laudo {
  id: string;
  labId: LabId;

  // RDC 978 Art. 167 — 14 campos
  cnes: string;
  labName: string;
  labEndereco: string;
  labTelefone: string;

  rtNome: string;
  rtRegistro: string;

  profissionalAssinaName: string;
  profissionalAssinaRegistro: string;

  paciente: {
    id: string;
    nome: string;
    cpf?: string;
    sexo: 'M' | 'F' | 'NI';
  };

  pacienteIdade:
    | {
        value: number;
        unit: 'anos' | 'meses' | 'dias';
      }
    | {
        dataNascimento: Timestamp;
      };

  coletaEm: Timestamp;
  emissaoEm: Timestamp;

  exames: ExameLaudo[];

  // Status e controle
  status: ReleaseState;
  currentVersion: number;

  // Críticos
  criticoFlag: boolean;
  criticoDetalhes?: Array<{
    exameId: string;
    analitoNome: string;
    valor: number;
    severidade: 'alta' | 'baixa';
    motivo: string;
  }>;

  // Audit
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

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
  nome: string;
  tipoMaterial: string;
  metodoAnalitico: string;
  resultados: Array<{
    value: number;
    unidade: string;
    nivelId?: string;
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

/**
 * Versão imutável de laudo
 * Snapshot congelado com assinatura
 * Armazenado em /labs/{labId}/laudo-versions/{versionId}
 */
export interface LaudoVersion {
  id: string;
  labId: LabId;
  laudoId: string;

  version: number;
  snapshot: Laudo; // Snapshot do laudo nesta versão

  signature: LogicalSignature;
  chainHash: string;

  pdfUrl?: string; // URL gerada em Plan 10-04

  criadoEm: Timestamp;
}

export interface LogicalSignature {
  operatorId: UserId;
  operatorRole: 'RT' | 'RT-Substituto' | 'Sistema';
  operatorName: string;
  operatorRegistro: string;
  timestamp: Timestamp;
  hash: string; // SHA-256(canonical(payload + prevChainHash))
}

/**
 * Configuração de exame
 * Armazenado em /labs/{labId}/exames-config/{exameId}
 */
export interface ExameConfig {
  id: string;
  labId: LabId;

  examCode: string;
  examName: string;

  classification: ExamClassification;
  autoReleaseEnabled: boolean;
  cv_alvo?: number;
  rtRevisorObrigatorioId?: UserId;

  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

/**
 * Registro imutável de comunicação crítico
 * Armazenado em /labs/{labId}/comunicacoes/{comunicacaoId}
 */
export interface Comunicacao {
  id: string;
  labId: LabId;
  laudoId: string;

  canal: 'email' | 'verbal' | 'sms'; // MVP: email + verbal

  // Para email
  emailRemetente?: string;
  emailDestinatario?: string;
  emailStatus?: 'sent' | 'bounced' | 'complained';

  // Para verbal
  receptorTipo?: 'medico' | 'responsavel' | 'outro';
  receptorNome?: string;
  receptorContato?: string;

  signature: LogicalSignature;
  observacao?: string;

  criadoEm: Timestamp;
}
