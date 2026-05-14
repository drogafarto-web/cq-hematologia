import { Timestamp } from 'firebase/firestore';

export interface AuditorQualification {
  id: string;
  labId: string;
  userId: string;
  nome: string;
  formacaoAcademica: string;
  registroProfissional: string;
  treinamentos: AuditorTraining[];
  certificacoes: AuditorCertification[];
  escoposAutorizados: AuditScope[];
  totalAuditoriasRealizadas: number;
  ultimaAuditoriaData: Timestamp | null;
  qualificacaoValidaAte: Timestamp;
  necessitaReciclagem: boolean;
  status: 'ativo' | 'inativo' | 'vencido' | 'em-formacao';
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}

export interface AuditorTraining {
  id: string;
  titulo: string;
  instituicao: string;
  cargaHoraria: number;
  dataRealizacao: Timestamp;
  certificadoUrl?: string;
  tipo: 'formacao-inicial' | 'reciclagem' | 'especializacao';
}

export interface AuditorCertification {
  id: string;
  titulo: string;
  emissor: string;
  dataEmissao: Timestamp;
  dataValidade: Timestamp;
  tipo: 'auditor-lider' | 'auditor-interno' | 'auditor-externo';
  status: 'vigente' | 'vencida';
}

export interface AuditScope {
  bloco: string;
  descricao: string;
  autorizado: boolean;
  impedimento?: string;
}

export interface AuditorImpediment {
  auditorId: string;
  setorImpedido: string;
  motivo: string;
  tipo: 'responsabilidade-direta' | 'conflito-interesse' | 'qualificacao-insuficiente';
}

export type AuditorQualificationInput = Omit<AuditorQualification, 'id' | 'criadoEm' | 'atualizadoEm'>;
