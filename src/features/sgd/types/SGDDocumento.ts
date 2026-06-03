import { Timestamp } from 'firebase/firestore';

export type DICABloco = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';

export type SiglaDocExterno =
  | 'RDC' // Resolução da Diretoria Colegiada (ANVISA)
  | 'NR' // Norma Regulamentadora (MTE)
  | 'RF' // Documento Normativo Federal
  | 'DE' // Documento Externo Técnico (certificados, laudos)
  | 'ME' // Manual de Equipamento
  | 'FDS' // Ficha de Dados de Segurança
  | 'PF' // Portaria Federal
  | 'LE' // Legislação Estadual
  | 'LMU'; // Legislação Municipal

export const SIGLA_LABEL: Record<SiglaDocExterno, string> = {
  RDC: 'Resolução da Diretoria Colegiada',
  NR: 'Norma Regulamentadora',
  RF: 'Documento Normativo Federal',
  DE: 'Documento Externo Técnico',
  ME: 'Manual de Equipamento',
  FDS: 'Ficha de Dados de Segurança',
  PF: 'Portaria Federal',
  LE: 'Legislação Estadual',
  LMU: 'Legislação Municipal',
};

export interface LogicalSignature {
  hash: string; // SHA-256 hex, 64 chars
  operatorId: string; // user UID
  ts: Timestamp;
}

export interface LinkSuggestion {
  targetModule: 'sgq' | 'pop' | 'treinamentos' | 'biosseguranca';
  targetId: string;
  targetNome: string;
  confidence: number; // 0-1 from Gemini classifier
}

export interface ModuleLink {
  targetModule: string;
  targetId: string;
  targetNome: string;
  confirmedAt: Timestamp;
  confirmedBy: string;
}

export interface SGDDocumento {
  id: string;
  labId: string;
  titulo: string;
  descricao?: string;
  driveFileId: string;
  driveFileName: string;
  mimeType: string;
  driveFolderId: string;
  fileSize?: number; // bytes
  categoriaICQ?: DICABloco | null;
  sigla?: SiglaDocExterno;
  codigoExterno?: string;
  orgaoEmissor?: string;
  dataEmissaoDoc?: Timestamp;
  dataRevisaoDoc?: Timestamp;
  situacao?: 'ativo' | 'inativo';
  versaoExterna?: string;
  linksSugeridos?: LinkSuggestion[];
  linksConfirmados?: ModuleLink[];
  criadoEm: Timestamp;
  criadoPor: string;
  atualizadoEm?: Timestamp | null;
  atualizadoPor?: string | null;
  deletadoEm?: Timestamp | null;
  aud: LogicalSignature;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parents: string[];
  createdTime: string;
  modifiedTime: string;
}

export interface ImportJob {
  jobId: string;
  labId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  filesTotal: number;
  filesProcessed: number;
  filesError: number;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  errorMessage?: string;
}

export interface SGDAuditEvent {
  id: string;
  labId: string;
  event:
    | 'batch_imported'
    | 'document_classified'
    | 'link_confirmed'
    | 'document_viewed'
    | 'document_deleted';
  documentId?: string | null;
  details?: Record<string, unknown>;
  operatorId: string;
  operatorEmail: string;
  consent: boolean;
  ts: Timestamp;
}
