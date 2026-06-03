/**
 * CAPA Tracking Type System — Phase 8 Wave 0 (Simplified spec)
 *
 * Unificado para CAPA closure. Zero lógica — apenas interfaces, enums e helpers puros.
 * Multi-tenant: escoped a `/labs/{labId}/<coleção>`
 * Soft-delete only (RN-06): todos carregam `deletedAt: number | undefined`
 *
 * Note: Existing components use older type names (CAPAStatus, CAPA, etc.).
 * Both type systems are exported for backward compatibility.
 */

// ──────────────────────────────────────────────────────────────────────────
// PHASE 8 Simplified Type System
// ──────────────────────────────────────────────────────────────────────────

// English status per plan spec
export type CapaStateNew =
  | 'open'
  | 'in-progress'
  | 'evidence-submitted'
  | 'auditor-reviewing'
  | 'closed';
export type CapaSeverityNew = 'critical' | 'major' | 'minor';

// Portuguese status for backward compatibility with components
export type CapaStateLegacy =
  | 'aberto'
  | 'em-andamento'
  | 'evidencia-submetida'
  | 'auditor-revisando'
  | 'fechado';
export type CapaSeverityLegacy = 'critica' | 'alta' | 'media';

// Union types for public API (components don't distinguish)
export type CapaState = CapaStateNew | CapaStateLegacy;
export type CapaSeverity = CapaSeverityNew | CapaSeverityLegacy;

export type RFIStatus = 'pending' | 'answered';

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: number;
}

export interface Evidence {
  id: string;
  labId: string;
  capaId: string;
  fileName: string;
  filename?: string; // Legacy alias
  fileSize: number;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'text/plain';
  storagePath: string;
  uploadedBy: string;
  uploadedAt: number;
  hash: string;
  signature: LogicalSignature;
  description?: string;
  type?: 'foto' | 'documento' | 'certificado' | 'pop' | 'treinamento'; // Legacy field
  deletedAt?: number;
}

export interface AuditorRFI {
  rfiId: string;
  question: string;
  askedBy: string;
  askedAt: number;
  dueDate: number;
  response?: string;
  respondedBy?: string;
  respondedAt?: number;
  status: RFIStatus;
  deletedAt?: number;
}

export interface CapaFinding {
  findingId: string;
  title: string;
  severity: CapaSeverity;
  dicqBlocks: string[];
  rdcArticles: string[];
}

export interface CapaStateTransition {
  from: CapaState | null;
  to: CapaState;
  transitionedAt: number;
  transitionedBy: string;
  reason?: string;
}

export interface CapaDocument {
  id: string;
  labId: string;
  ncId?: string; // Legacy: was the NC id this CAPA links to
  finding: CapaFinding;
  state: CapaState;
  createdAt: number | { toMillis(): number };
  createdBy: string;
  rootCause: string;
  correctiveAction: string;
  deadlineDate: number | { toMillis(): number };
  evidence: Evidence[];
  rfiLog: AuditorRFI[];
  stateHistory: CapaStateTransition[];
  auditorSignOffEmail?: string;
  auditorSignOffAt?: number;
  deletedAt?: number;
  // Legacy field aliases for backward compatibility with components
  // These are populated by the useCAPAs hook
  priority: CapaSeverity; // Alias for finding.severity
  dicqRef: string; // Alias for finding.dicqBlocks[0]
  deadline: number; // Alias for deadlineDate (as timestamp number)
  status: CapaState; // Alias for state
  owner?: string; // Legacy: who owns the CAPA
  ownerName?: string; // Legacy: owner name denormalized
}

// Helpers puros
export function isValidStateTransition(from: CapaState, to: CapaState): boolean {
  // Normalize to English for comparison
  const normalizedFrom =
    from === 'aberto'
      ? 'open'
      : from === 'em-andamento'
        ? 'in-progress'
        : from === 'evidencia-submetida'
          ? 'evidence-submitted'
          : from === 'auditor-revisando'
            ? 'auditor-reviewing'
            : from === 'fechado'
              ? 'closed'
              : from;

  const normalizedTo =
    to === 'aberto'
      ? 'open'
      : to === 'em-andamento'
        ? 'in-progress'
        : to === 'evidencia-submetida'
          ? 'evidence-submitted'
          : to === 'auditor-revisando'
            ? 'auditor-reviewing'
            : to === 'fechado'
              ? 'closed'
              : to;

  // closed não tem transições válidas
  if (normalizedFrom === 'closed') return false;
  // auditor-reviewing pode voltar para in-progress
  if (normalizedFrom === 'auditor-reviewing' && normalizedTo === 'in-progress') return true;
  // Caso geral: transições sequenciais conforme estado atual
  const validNext: Record<CapaStateNew, CapaStateNew[]> = {
    open: ['in-progress'],
    'in-progress': ['evidence-submitted'],
    'evidence-submitted': ['auditor-reviewing'],
    'auditor-reviewing': ['closed', 'in-progress'],
    closed: [],
  };
  return validNext[normalizedFrom as CapaStateNew]?.includes(normalizedTo as CapaStateNew) ?? false;
}

export function daysRemaining(deadlineDate: number): number {
  const now = Date.now();
  const days = (deadlineDate - now) / (1000 * 60 * 60 * 24);
  return Math.floor(days);
}

// ──────────────────────────────────────────────────────────────────────────
// Backward Compatibility — Legacy Type System (for existing components)
// ──────────────────────────────────────────────────────────────────────────

// Aliases for existing components that use old naming
export type CAPAStatus = CapaState;
export type CAPASeverity = CapaSeverity;
export interface CAPA extends CapaDocument {}
export interface CAPATransition extends CapaStateTransition {}
export interface CAPAEvidenceRef extends Evidence {}

export interface DeadlineStatus {
  daysRemaining: number;
  status: 'on-track' | 'at-risk' | 'overdue';
  color: 'emerald' | 'amber' | 'red';
}

export interface CAPAWithDeadlineStatus extends CapaDocument {
  readonly deadlineStatus: DeadlineStatus;
}

export type CAPAInput = Omit<
  CapaDocument,
  'id' | 'labId' | 'createdAt' | 'createdBy' | 'deletedAt'
>;
