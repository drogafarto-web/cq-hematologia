import { Timestamp } from 'firebase/firestore'

export type DICABloco = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'

export interface LogicalSignature {
  hash: string // SHA-256 hex, 64 chars
  operatorId: string // user UID
  ts: Timestamp
}

export interface LinkSuggestion {
  targetModule: 'sgq' | 'pop' | 'treinamentos' | 'biosseguranca'
  targetId: string
  targetNome: string
  confidence: number // 0-1 from Gemini classifier
}

export interface ModuleLink {
  targetModule: string
  targetId: string
  confirmedAt: Timestamp
  confirmedBy: string
}

export interface SGDDocumento {
  id: string
  labId: string
  titulo: string
  descricao?: string
  driveFileId: string
  driveFileName: string
  mimeType: string
  driveFolderId: string
  fileSize?: number // bytes
  categoriaICQ?: DICABloco | null
  linksSugeridos?: LinkSuggestion[]
  linksConfirmados?: ModuleLink[]
  criadoEm: Timestamp
  criadoPor: string
  atualizadoEm?: Timestamp | null
  atualizadoPor?: string | null
  deletadoEm?: Timestamp | null
  aud: LogicalSignature
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  parents: string[]
  createdTime: string
  modifiedTime: string
}

export interface ImportJob {
  jobId: string
  labId: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  filesTotal: number
  filesProcessed: number
  filesError: number
  createdAt: Timestamp
  completedAt?: Timestamp
  errorMessage?: string
}

export interface SGDAuditEvent {
  id: string
  labId: string
  event: 'batch_imported' | 'document_classified' | 'link_confirmed' | 'document_viewed' | 'document_deleted'
  documentId?: string | null
  details?: Record<string, unknown>
  operatorId: string
  operatorEmail: string
  consent: boolean
  ts: Timestamp
}
