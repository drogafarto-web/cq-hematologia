/**
 * notivisa/http/client.ts — Real HTTP client for NOTIVISA government API
 *
 * Wave 3 Agent 3 — Sandbox + Production modes
 *
 * Handles NOTIVISA REST API communication with:
 *   - Exponential backoff retry (2^n, max 5 retries)
 *   - 30s timeout per request
 *   - Comprehensive error logging via writeAuditLog
 *   - Graceful failure returns (never throws on HTTP errors)
 *
 * Credentials sourced from Firebase secrets:
 *   - NOTIVISA_SANDBOX_KEY / NOTIVISA_SANDBOX_URL (test labs)
 *   - NOTIVISA_PROD_KEY / NOTIVISA_PROD_URL (production labs)
 */

import { writeAuditLog } from '../../../shared/audit/writeAuditLog';

export interface NotivisaDraftPayload {
  versao: string;
  laudo_id: string;
  paciente_cpf: string;
  data_resultado: number;
  resultados: Array<{
    analito: string;
    valor: string | number;
    unidade: string;
    referencia: string;
  }>;
  assinador: {
    cpf: string;
    nome: string;
    data_assinatura: number;
  };
}

export interface NotivisaStatusResponse {
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  reason?: string;
  updatedAt?: number;
}

export interface NotivisaApprovalResponse {
  approvalId: string;
  approvedAt: number;
  certificateUrl: string;
}

export interface SubmitDraftResponse {
  statusId: string;
  submittedAt: number;
}

export interface CheckStatusResponse {
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'error';
  reason?: string;
}

export interface RetrieveApprovalResponse {
  approvalId: string;
  approvedAt: number;
  certificateUrl: string;
}

interface HTTPError {
  status: 'error';
  reason: string;
  statusCode?: number;
  retryCount?: number;
}

const TIMEOUT_MS = 30000; // 30s timeout per request
const MAX_RETRIES = 5;

function backoffDelay(attempt: number): number {
  // 2^n seconds: 1, 2, 4, 8, 16
  return Math.pow(2, Math.min(attempt, 4)) * 1000;
}

/**
 * Real HTTP client for NOTIVISA government API
 *
 * Each method is designed to:
 *   1. Make the HTTP request with timeout
 *   2. Retry on transient failures (exponential backoff)
 *   3. Log all errors (not silent failures)
 *   4. Return error objects instead of throwing
 */
export class NotivisaHTTPClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Submit a draft to NOTIVISA government API
   *
   * POST /api/v1/submissions
   * Returns: { statusId, submittedAt }
   * On error: { status: 'error', reason }
   */
  async submitDraft(
    draftId: string,
    payload: NotivisaDraftPayload,
  ): Promise<SubmitDraftResponse | HTTPError> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${this.baseUrl}/api/v1/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'X-Draft-ID': draftId,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = (await response.json()) as any;
          return {
            statusId: data.statusId || data.submissionId,
            submittedAt: Date.now(),
          };
        }

        // Non-200 response
        const errorText = await response.text();
        lastError = new Error(
          `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
        );

        // Determine if retryable
        const isRetryable =
          response.status >= 500 || response.status === 429; // server error or rate limit
        if (!isRetryable) {
          // Don't retry 4xx errors (except 429)
          break;
        }
      } catch (err) {
        lastError =
          err instanceof Error ? err : new Error(String(err));

        // Timeout and network errors are retryable
        if (lastError.message.includes('AbortError')) {
          lastError = new Error('Request timeout');
        }
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = backoffDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    const errorMsg = lastError?.message || 'Unknown error';
    try {
      await writeAuditLog({
        action: 'NOTIVISA_SUBMIT_FAILED',
        payload: {
          draftId,
          error: errorMsg,
          retries: MAX_RETRIES,
        },
      });
    } catch {
      // Silent fail on audit log errors in tests
    }

    return {
      status: 'error' as const,
      reason: errorMsg,
      retryCount: MAX_RETRIES,
    };
  }

  /**
   * Check the status of a submitted draft
   *
   * GET /api/v1/submissions/{statusId}/status
   * Returns: { status, reason }
   * On error: { status: 'error', reason }
   */
  async checkStatus(statusId: string): Promise<CheckStatusResponse | HTTPError> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(
          `${this.baseUrl}/api/v1/submissions/${statusId}/status`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = (await response.json()) as any;
          return {
            status: data.status || 'pending',
            reason: data.reason,
          };
        }

        lastError = new Error(`HTTP ${response.status}`);
        const isRetryable = response.status >= 500 || response.status === 429;
        if (!isRetryable) break;
      } catch (err) {
        lastError =
          err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = backoffDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    try {
      await writeAuditLog({
        action: 'NOTIVISA_CHECK_STATUS_FAILED',
        payload: {
          statusId,
          error: lastError?.message || 'Unknown error',
          retries: MAX_RETRIES,
        },
      });
    } catch {
      // Silent fail on audit log errors in tests
    }

    return {
      status: 'error' as const,
      reason: lastError?.message || 'Unknown error',
    };
  }

  /**
   * Retrieve approval certificate for approved submission
   *
   * GET /api/v1/submissions/{statusId}/approval
   * Returns: { approvalId, approvedAt, certificateUrl }
   * On error: { status: 'error', reason }
   */
  async retrieveApproval(
    statusId: string,
  ): Promise<RetrieveApprovalResponse | HTTPError> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(
          `${this.baseUrl}/api/v1/submissions/${statusId}/approval`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = (await response.json()) as any;
          return {
            approvalId: data.approvalId,
            approvedAt: data.approvedAt || Date.now(),
            certificateUrl: data.certificateUrl,
          };
        }

        lastError = new Error(`HTTP ${response.status}`);
        const isRetryable = response.status >= 500 || response.status === 429;
        if (!isRetryable) break;
      } catch (err) {
        lastError =
          err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = backoffDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    try {
      await writeAuditLog({
        action: 'NOTIVISA_RETRIEVE_APPROVAL_FAILED',
        payload: {
          statusId,
          error: lastError?.message || 'Unknown error',
          retries: MAX_RETRIES,
        },
      });
    } catch {
      // Silent fail on audit log errors in tests
    }

    return {
      status: 'error' as const,
      reason: lastError?.message || 'Unknown error',
    };
  }
}
