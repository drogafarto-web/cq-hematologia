/**
 * Management Review Type System
 *
 * Types para revisão anual da direção (DICQ 4.15, 15 entradas obrigatórias).
 * Multi-tenant: escoped a `/labs/{labId}/management-review`
 */

import { Timestamp } from 'firebase/firestore';

// ──────────────────────────────────────────────────────────────────────────
// PHASE 8 Type System (Wave 0: simplified spec)
// ──────────────────────────────────────────────────────────────────────────

export type EntrySource = 'auto-aggregated' | 'manual' | 'imported';

export interface ManagementReviewEntry {
  entryNumber: number;  // 1–15
  title: string;
  data: Record<string, unknown>;
  source: EntrySource;
  lastUpdated: number;
}

export interface ReviewSignature {
  signerRole: 'diretor' | 'gerente_qualidade';
  signerName: string;
  operatorId: string;
  hash: string;
  ts: number;
}

export interface ManagementReviewMeeting {
  id: string;
  labId: string;
  dataReuniao: number;
  ano: number;
  entries: ManagementReviewEntry[];  // exatamente 15
  attendees: string[];
  decisions: string[];
  actionItems: string[];
  signatures: ReviewSignature[];
  pdfStoragePath?: string;
  createdAt: number;
  createdBy: string;
  approvedAt?: number;
  deletedAt?: number;
}

export const MANAGEMENT_REVIEW_ENTRY_TITLES: readonly string[] = [
  'Resultado de Auditorias',
  'Conformidades e Ações Corretivas',
  'Tendências de Indicadores de Desempenho',
  'Feedback do Cliente',
  'Competência do Pessoal',
  'Infraestrutura e Calibração',
  'Desempenho de Fornecedores',
  'Mudanças Regulatórias',
  'Oportunidades para Melhoria',
  'Avaliação de Riscos',
  'Status de Objetivos de Qualidade',
  'Alocação de Recursos',
  'Mudanças Procedimentais',
  'Iniciativas Estratégicas',
  'Data, Participantes e Assinatura',
];

// ──────────────────────────────────────────────────────────────────────────
// Extended Type System (Wave 1+: full implementation, exports needed by services)
// ──────────────────────────────────────────────────────────────────────────

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: Timestamp;
}

export interface ReviewEntry {
  id: string;
  sectionNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  sectionTitle: string;
  content: string;
  sourceData?: Record<string, any>;
  notes?: string;
}

export interface ReviewTemplate {
  year: number;
  entries: ReviewEntry[];
  sourceDataTimestamp: Timestamp;
  warnings?: string[];
}

export function createEmptyReviewEntry(
  sectionNumber: number,
  sectionTitle: string
): ReviewEntry {
  return {
    id: crypto.randomUUID(),
    sectionNumber: sectionNumber as any,
    sectionTitle,
    content: '',
    sourceData: {},
    notes: ''
  };
}

export function createEmptyReviewTemplate(year: number): ReviewTemplate {
  return {
    year,
    entries: REVIEW_SECTIONS.map((section) =>
      createEmptyReviewEntry(section.number, section.titlePt)
    ),
    sourceDataTimestamp: Timestamp.now(),
    warnings: []
  };
}

export const REVIEW_SECTIONS = [
  {
    number: 1 as const,
    titlePt: 'Análise de Resultados de Auditorias',
    titleEn: 'Review of Audit Results',
    placeholder: 'Summary of internal audits conducted, findings, strengths, areas for improvement...'
  },
  {
    number: 2 as const,
    titlePt: 'Análise de Conformidades e Ações Corretivas',
    titleEn: 'Review of NC/CAPA Status',
    placeholder: 'Status of non-conformities and corrective actions: open count, closed count, effectiveness of remediation...'
  },
  {
    number: 3 as const,
    titlePt: 'Tendências de Indicadores de Desempenho',
    titleEn: 'Review of KPI Trends',
    placeholder: 'Performance indicators trends (turnaround, rework, customer complaints, etc.) over past 12 months...'
  },
  {
    number: 4 as const,
    titlePt: 'Análise de Feedback do Cliente',
    titleEn: 'Review of Customer Feedback',
    placeholder: 'Customer complaints, suggestions, satisfaction metrics, trends in feedback...'
  },
  {
    number: 5 as const,
    titlePt: 'Análise de Competência do Pessoal',
    titleEn: 'Review of Personnel Competency',
    placeholder: 'Staff competency assessment, training completion, certification status, gaps, development plans...'
  },
  {
    number: 6 as const,
    titlePt: 'Análise de Infraestrutura e Calibração',
    titleEn: 'Review of Infrastructure + Calibration',
    placeholder: 'Equipment status, maintenance records, calibration certificates, due dates, infrastructure adequacy...'
  },
  {
    number: 7 as const,
    titlePt: 'Análise de Desempenho de Fornecedores',
    titleEn: 'Review of Supplier Performance',
    placeholder: 'Vendor/supplier evaluation: quality, delivery, communication, compliance with specifications...'
  },
  {
    number: 8 as const,
    titlePt: 'Análise de Mudanças Regulatórias',
    titleEn: 'Review of Regulatory Changes',
    placeholder: 'New or updated regulations (RDC, ANVISA, DICQ), impact on operations, required changes...'
  },
  {
    number: 9 as const,
    titlePt: 'Oportunidades para Melhoria',
    titleEn: 'Review of Improvement Opportunities',
    placeholder: 'Identified opportunities for improvement, suggestions from staff/customers, innovation initiatives...'
  },
  {
    number: 10 as const,
    titlePt: 'Avaliação de Riscos e Mitigação',
    titleEn: 'Risk Assessment + Mitigation',
    placeholder: 'Quality risks identified, likelihood/impact assessment, mitigation strategies, action ownership...'
  },
  {
    number: 11 as const,
    titlePt: 'Status de Objetivos de Qualidade',
    titleEn: 'Quality Objectives Status',
    placeholder: 'Progress toward annual quality objectives: achieved, at-risk, deferred, new objectives for next year...'
  },
  {
    number: 12 as const,
    titlePt: 'Decisões sobre Alocação de Recursos',
    titleEn: 'Resource Allocation Decisions',
    placeholder: 'Decisions on budget allocation, staffing, equipment purchase, training investment, facility improvements...'
  },
  {
    number: 13 as const,
    titlePt: 'Mudanças Procedimentais Aprovadas',
    titleEn: 'Approved Procedural Changes',
    placeholder: 'POPs (Standard Operating Procedures) approved, modified, or retired in review period...'
  },
  {
    number: 14 as const,
    titlePt: 'Direcionamento sobre Iniciativas Estratégicas',
    titleEn: 'Direction on Strategic Initiatives',
    placeholder: 'Strategic direction for coming year: priorities, new modules, compliance initiatives, growth plans...'
  },
  {
    number: 15 as const,
    titlePt: 'Data, Participantes e Assinatura',
    titleEn: 'Date, Attendees + Signature',
    placeholder: 'Review date, list of attendees with roles, director signature with timestamp and hash verification...'
  }
] as const;

export enum ReviewStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  ARCHIVED = 'archived'
}

export interface ManagementReview {
  id: string;
  labId: string;
  year: number;
  dataRevisao: Timestamp;
  entries: ReviewEntry[];
  participantes: string[];
  diretor: string;
  gerenteQualidade: string;
  outrasCargos?: string[];
  chainHash: LogicalSignature;
  status: 'draft' | 'submitted' | 'approved' | 'archived';
  ataIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;
}

export interface Ata {
  id: string;
  labId: string;
  managementReviewId?: string;
  dataReuniao: Timestamp;
  horaInicio: string;
  horaFim: string;
  local: string;
  pauta: string;
  conteudo: string;
  participantes: string[];
  decisoes: string[];
  assinado: boolean;
  assinadoPor?: string;
  chainHash?: LogicalSignature;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;
}
