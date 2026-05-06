import { Timestamp } from 'firebase/firestore';

/**
 * Management Review Domain Types
 * DICQ 4.15 — Annual Direction Critical Analysis (Análise Crítica pela Direção)
 *
 * The 15 mandatory sections as per DICQ 4.15:
 * 1. Audit results review
 * 2. NC/CAPA status
 * 3. KPI trends
 * 4. Customer feedback
 * 5. Personnel competency
 * 6. Infrastructure + calibration
 * 7. Supplier performance
 * 8. Regulatory changes
 * 9. Improvement opportunities
 * 10. Risk assessment
 * 11. Quality objectives status
 * 12. Resource allocation
 * 13. Procedural changes
 * 14. Strategic initiatives
 * 15. Attendees + signature
 */

/**
 * LogicalSignature — audit trail format
 * Consistent with controle-temperatura and auditoria-interna patterns
 */
export interface LogicalSignature {
  hash: string;                      // HMAC-SHA256 (exactly 64 chars)
  operatorId: string;                // uid of signer
  ts: Timestamp;                     // moment of signature
}

/**
 * Individual review section entry
 * Maps to one of the 15 mandatory DICQ 4.15 sections
 */
export interface ReviewEntry {
  id: string;                        // UUID
  sectionNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  sectionTitle: string;              // DICQ 4.15 section title (Portuguese)
  content: string;                   // Markdown-formatted content entered by director
  sourceData?: Record<string, any>; // Pre-populated reference data (e.g., NC count, KPI values)
  notes?: string;                    // Optional editor notes
}

/**
 * Template with pre-populated sections
 * Returned by generateReviewTemplate CF
 */
export interface ReviewTemplate {
  year: number;
  entries: ReviewEntry[];            // 15 sections with pre-filled sourceData
  sourceDataTimestamp: Timestamp;   // When source data was pulled
  warnings?: string[];               // Warnings if data sources incomplete (e.g., "KPI collection not found")
}

/**
 * Management Review — the main annual direction critical analysis document
 * Multi-tenant scoped to `/labs/{labId}/management-reviews/{id}`
 */
export interface ManagementReview {
  id: string;                        // UUID
  labId: string;                     // Tenant scoping
  year: number;                      // 2026, 2027, etc.
  dataRevisao: Timestamp;            // When the review meeting took place

  // 15 mandatory sections
  entries: ReviewEntry[];

  // Meeting metadata
  participantes: string[];           // List of attendee names
  diretor: string;                   // Director name/ID who led review
  gerenteQualidade: string;          // Quality Manager name/ID
  outrasCargos?: string[];           // Other attendee roles/names (optional)

  // Signature (director authorizes)
  chainHash: LogicalSignature;

  // Status workflow
  status: 'draft' | 'submitted' | 'approved' | 'archived';

  // Linkage to meeting minutes
  ataIds: string[];                  // FK to Ata documents (if any)

  // Audit trail
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;      // Soft delete only (RN-06)
}

/**
 * Meeting Minutes — Ata
 * Separate document linked to ManagementReview
 * Captures discussion points, decisions, action items
 */
export interface Ata {
  id: string;                        // UUID
  labId: string;                     // Tenant scoping
  managementReviewId: string;        // FK to ManagementReview (may be null if standalone)

  // Meeting details
  dataReuniao: Timestamp;            // Date meeting held
  horaInicio: string;                // "09:00" format
  horaFim: string;                   // "11:30" format
  local: string;                     // Location (e.g., "Sala de Reuniões")

  // Content
  pauta: string;                     // Meeting agenda (Markdown)
  conteudo: string;                  // Full minutes/discussion notes (Markdown)

  // Attendance
  participantes: string[];           // List of attendee names
  decisoes: string[];                // Decisions made (bullet points)

  // Signature
  assinado: boolean;
  assinadoPor?: string;              // Name/ID of person who signed
  chainHash?: LogicalSignature;      // Optional signature with hash

  // Audit trail
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;      // Soft delete only (RN-06)
}

/**
 * Hardcoded definitions of the 15 mandatory DICQ 4.15 sections
 * Used to initialize review form and validate completeness
 */
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

/**
 * Review status enumeration
 */
export enum ReviewStatus {
  DRAFT = 'draft',           // Incomplete, editable
  SUBMITTED = 'submitted',   // All sections complete, signed
  APPROVED = 'approved',     // Auditor or leadership approved
  ARCHIVED = 'archived'      // Archived for records
}

/**
 * Helper: Create empty ReviewEntry for initialization
 */
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

/**
 * Helper: Create empty ReviewTemplate
 */
export function createEmptyReviewTemplate(year: number): ReviewTemplate {
  return {
    year,
    entries: REVIEW_SECTIONS.map(section =>
      createEmptyReviewEntry(section.number, section.titlePt)
    ),
    sourceDataTimestamp: Timestamp.now(),
    warnings: []
  };
}
