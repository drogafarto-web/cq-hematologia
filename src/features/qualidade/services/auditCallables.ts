/**
 * auditCallables.ts
 *
 * Cloud Function callable wrappers para operações de auditoria e compliance.
 * Wave A WIRE-FIRST: generateComplianceReport (qualidade/auditTrail) → management-review
 *
 * Cada wrapper:
 * 1. Lazy-loads via httpsCallable (não carrega no import)
 * 2. Injeta labId do contexto do caller (via hook)
 * 3. Traduz erros Firebase → Error legível em PT-BR
 */

import { functions, httpsCallable, type HttpsCallable } from '../../../shared/services/firebase';
import type { LabId } from '../types/shared_refs';

// ─── Result types ──────────────────────────────────────────────────────────

export interface ChainViolation {
  entryId: string;
  reason: string;
}

export interface ComplianceReportStats {
  sucessos: number;
  falhas: number;
  avisos: number;
}

export interface AuditEntry {
  id: string;
  modulo: string;
  operadorId: string;
  operacao: string;
  resultado: 'sucesso' | 'falha' | 'aviso';
  timestamp: number;
  hash: string;
  detalhes?: string;
}

export interface CallGenerateComplianceReportResult {
  success: true;
  operadores: number;
  modulos: string[];
  stats: ComplianceReportStats;
  chainViolations?: ChainViolation[];
  validaChain: boolean;
}

export interface CallGetAuditTrailResult {
  ok: true;
  entries: AuditEntry[];
  count: number;
  hasMore: boolean;
}

export interface CallValidateChainResult {
  ok: true;
  status: 'valido' | 'quebrado';
  firstViolation?: {
    docId: string;
    index: number;
    expectedHash: string;
    actualHash: string;
  };
  lastCheckTime: number;
}

// ─── Payload types ──────────────────────────────────────────────────────────

export interface GenerateComplianceReportPayload {
  labId: LabId;
  dataInicio: number; // Unix timestamp (ms)
  dataFim: number;    // Unix timestamp (ms)
}

export interface GetAuditTrailPayload {
  labId: LabId;
  modulo?: string;
  operadorId?: string;
  resultado?: 'sucesso' | 'falha' | 'aviso';
  offset: number;
  limit: number;
}

export interface ValidateChainPayload {
  labId: LabId;
}

export interface ExportAuditTrailPayload {
  labId: LabId;
  formato: 'csv' | 'pdf';
  dataInicio?: number;
  dataFim?: number;
  modulo?: string;
  operadorId?: string;
  resultado?: 'sucesso' | 'falha' | 'aviso';
}

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: number;
}

export interface CallExportAuditTrailResult {
  success: true;
  downloadUrl: string;
  signature: LogicalSignature;
}

// ─── Lazy-loaded callables ──────────────────────────────────────────────────

let _callGenerateComplianceReport: HttpsCallable<
  GenerateComplianceReportPayload,
  CallGenerateComplianceReportResult
> | null = null;
let _callGetAuditTrail: HttpsCallable<GetAuditTrailPayload, CallGetAuditTrailResult> | null =
  null;
let _callValidateChain: HttpsCallable<ValidateChainPayload, CallValidateChainResult> | null =
  null;
let _callExportAuditTrail: HttpsCallable<
  ExportAuditTrailPayload,
  CallExportAuditTrailResult
> | null = null;

function getCallGenerateComplianceReport(): HttpsCallable<
  GenerateComplianceReportPayload,
  CallGenerateComplianceReportResult
> {
  if (!_callGenerateComplianceReport) {
    _callGenerateComplianceReport = httpsCallable(
      functions,
      'qualidade_generateComplianceReport'
    );
  }
  return _callGenerateComplianceReport;
}

function getCallGetAuditTrail(): HttpsCallable<GetAuditTrailPayload, CallGetAuditTrailResult> {
  if (!_callGetAuditTrail) {
    _callGetAuditTrail = httpsCallable(functions, 'qualidade_getAuditTrail');
  }
  return _callGetAuditTrail;
}

function getCallValidateChain(): HttpsCallable<ValidateChainPayload, CallValidateChainResult> {
  if (!_callValidateChain) {
    _callValidateChain = httpsCallable(functions, 'qualidade_validateChain');
  }
  return _callValidateChain;
}

function getCallExportAuditTrail(): HttpsCallable<
  ExportAuditTrailPayload,
  CallExportAuditTrailResult
> {
  if (!_callExportAuditTrail) {
    _callExportAuditTrail = httpsCallable(functions, 'qualidade_exportAuditTrail');
  }
  return _callExportAuditTrail;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate compliance report from audit trail entries within date range.
 * Returns aggregated stats (operators, modules, success/failure/warning counts)
 * and any chain integrity violations detected.
 *
 * Throws Error if labId is not active or date range is invalid.
 */
export async function callGenerateComplianceReport(
  payload: GenerateComplianceReportPayload
): Promise<CallGenerateComplianceReportResult> {
  try {
    const result = await getCallGenerateComplianceReport()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Retrieve paginated audit trail entries with optional filters.
 * Supports filtering by modulo, operadorId, and resultado status.
 *
 * Throws Error if labId is not active, offset/limit invalid, or query fails.
 */
export async function callGetAuditTrail(
  payload: GetAuditTrailPayload
): Promise<CallGetAuditTrailResult> {
  try {
    const result = await getCallGetAuditTrail()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Validate chain hash integrity of audit trail.
 * Returns status ('valido' or 'quebrado') and first violation if found.
 *
 * Throws Error if labId is not active or validation fails.
 */
export async function callValidateChain(
  payload: ValidateChainPayload
): Promise<CallValidateChainResult> {
  try {
    const result = await getCallValidateChain()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Export audit trail as signed CSV or PDF file.
 * Generates a time-stamped, HMAC-signed export matching RDC 978 Art. 5.3 compliance.
 *
 * Returns downloadUrl and signature for verification.
 * Throws Error if labId is not active, format is invalid, or export fails.
 */
export async function callExportAuditTrail(
  payload: ExportAuditTrailPayload
): Promise<CallExportAuditTrailResult> {
  try {
    const result = await getCallExportAuditTrail()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

// ─── Error translation ──────────────────────────────────────────────────────

function translateError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message;

    // Firebase Cloud Function errors
    if (message.includes('UNAUTHENTICATED')) {
      return new Error('Autenticação necessária.');
    }
    if (message.includes('PERMISSION_DENIED')) {
      return new Error('Sem permissão para este módulo — contate o administrador.');
    }
    if (message.includes('NOT_FOUND')) {
      return new Error('Recurso não encontrado.');
    }
    if (message.includes('INVALID_ARGUMENT')) {
      const match = message.match(/Dados inválidos: (.+)/);
      return new Error(match ? match[1] : 'Dados inválidos.');
    }
    if (message.includes('FAILED_PRECONDITION')) {
      const match = message.match(/FAILED_PRECONDITION: (.+)/);
      return new Error(match ? match[1] : 'Operação não permitida no estado atual.');
    }
    if (message.includes('INTERNAL')) {
      return new Error('Erro ao processar solicitação (cloud function).');
    }

    return new Error(message);
  }

  return new Error('Erro desconhecido ao chamar função.');
}
