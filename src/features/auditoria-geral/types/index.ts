import type { Timestamp } from 'firebase/firestore';

export type StatusAuditoria = 'rascunho' | 'em_andamento' | 'finalizada';
export type BlocoId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';
export type ScoresPorBloco = Record<BlocoId, number>;

export interface Auditor {
  uid: string;
  nome: string;
}

export interface AuditoriaGeral {
  readonly id: string;
  readonly labId: string;
  titulo: string;
  status: StatusAuditoria;
  auditor: Auditor;
  dataInicio: Timestamp;
  dataFim: Timestamp | null;
  blocoAtual: BlocoId;
  scoreTotal: number;
  scoresPorBloco: ScoresPorBloco;
  totalRespondidos: number;
  totalNaoAplica: number;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type AuditoriaGeralInput = Pick<AuditoriaGeral, 'titulo' | 'auditor' | 'dataInicio'>;

export interface FotoEvidencia {
  url: string;
  path: string;
  nome: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

export interface AudioEvidencia {
  url: string;
  path: string;
  duration: number;
  transcription: string | null;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

export interface RespostaIndicador {
  readonly id: string;
  numero: number;
  indicador: string;
  bloco: BlocoId;
  score: number | null;
  critica: CriticaStatus | null;
  naoAplica: boolean;
  justificativaNA: string | null;
  observacoes: string;
  fotos: FotoEvidencia[];
  audios: AudioEvidencia[];
  comprovacaoLink: string | null;
  respondidoEm: Timestamp | null;
  respondidoPor: string | null;
}

export type CriticaStatus = 'CONFORME' | 'NÃO CONFORME' | 'NÃO APLICA';

export interface Indicador {
  id: string;
  numero: number;
  indicador: string;
  bloco: BlocoId;
  categoria: string;
  marcoRegulatorio: string;
  moduloVinculado: string | null;
  criticaDefault: CriticaStatus | null;
  niveis: Record<number, string>;
}

export interface BlocoMeta {
  id: BlocoId;
  nome: string;
  indicadores: number[];
}

export interface PlanoAcao {
  indicadorId: string;
  numero: number;
  indicador: string;
  bloco: BlocoId;
  score: number;
  acaoCorretiva: string;
  responsavel: string;
  prazo: Timestamp | null;
  status: 'pendente' | 'em_andamento' | 'concluido';
  criadoEm: Timestamp;
}

export type TipoAchado =
  | 'nc-critica'
  | 'nc-maior'
  | 'nc-menor'
  | 'oportunidade-melhoria'
  | 'observacao';

export interface Achado {
  id: string;
  auditoriaId: string;
  indicadorId: string;
  numero: number;
  indicador: string;
  bloco: BlocoId;
  tipo: TipoAchado;
  descricao: string;
  evidenciaObjetiva: string;
  causaRaiz: string;
  metodoCausaRaiz: '5-porques' | 'ishikawa' | 'outro' | '';
  status: 'aberto' | 'em-tratamento' | 'fechado';
  acaoCorretiva: string;
  responsavel: string;
  prazo: Timestamp | null;
  dataConclusao: Timestamp | null;
  verificacaoEficacia: VerificacaoEficacia | null;
  criadoEm: Timestamp;
  criadoPor: string;
}

export interface VerificacaoEficacia {
  verificadorUid: string;
  verificadorNome: string;
  data: Timestamp;
  resultado: 'eficaz' | 'parcialmente-eficaz' | 'ineficaz';
  evidencia: string;
  observacoes: string;
}

export interface QualificacaoAuditor {
  uid: string;
  nome: string;
  email: string;
  totalAuditorias: number;
  mediaScore: number;
  ultimaAuditoria: Timestamp | null;
  certificacoes: string[];
  status: 'qualificado' | 'em_treinamento' | 'inativo';
}
