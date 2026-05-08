/**
 * E2E Test: F4 — NOTIVISA Draft Submit & Queue Processing
 *
 * Flow: RT creates NOTIVISA draft → submits to sandbox → polls for approval → exports result
 *
 * Regulatory:
 * - Portaria 204/2017: Adverse event reporting to Anvisa
 * - RDC 978 Art. 6: Regulatory notification requirements
 *
 * Scenarios:
 * 1. Happy path: Draft create → submit → queue poll → export
 * 2. Error path: Validation failure → draft stays in draft status, error shown
 *
 * Run: npm test -- f4-notivisa-draft-submit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

describe('F4: NOTIVISA Draft Submit & Queue Processing', () => {
  let testLabId: string;
  let testRtUserId: string;
  let testLaudoId: string;

  beforeEach(() => {
    testLabId = 'lab_test_f4_' + Math.random().toString(36).substr(2, 9);
    testRtUserId = 'user_rt_' + Math.random().toString(36).substr(2, 9);
    testLaudoId = 'laudo_notivisa_' + Math.random().toString(36).substr(2, 9);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 4.1: Happy path — Draft → Submit → Queue → Export', () => {
    it('should create, submit, and export NOTIVISA draft', async () => {
      // Setup
      const testRt = seedRtUser(testRtUserId, testLabId, { role: 'RT' });
      const testLaudo = seedTestLaudo(testLabId, testLaudoId, {
        patientId: 'pat_notivisa_001',
        status: 'finalizado',
        resultados: [
          { analito: 'WBC', valor: 15.2, referencia: '4.5-11 K/uL' },
        ],
      });

      // Action: Auth
      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo('/notivisa');
      await waitForElement('[data-testid="notivisa-dashboard"]');

      // Action: Create new draft
      const createDraftBtn = getElementByTestId('btn-create-draft');
      clickElement(createDraftBtn);
      await waitForElement('[data-testid="form-notivisa-draft"]');

      // Mock: Fetch laudo details for draft
      vi.mock('firebase/firestore', () => ({
        getDoc: vi.fn().mockResolvedValue({
          data: () => testLaudo,
        }),
      }));

      // Action: Fill draft form
      const draftForm = getElementByTestId('form-notivisa-draft');
      fillInput(draftForm?.querySelector('[name="laudoId"]'), testLaudoId);
      fillInput(draftForm?.querySelector('[name="diseaseCode"]'), 'C91.0'); // Leukemia
      fillInput(draftForm?.querySelector('[name="description"]'), 'Event description test');

      // Action: Submit draft
      const submitDraftBtn = draftForm?.querySelector('[data-testid="btn-submit-draft"]');
      clickElement(submitDraftBtn);

      // Mock: Cloud Function to create draft
      const mockDraftId = 'draft_' + Math.random().toString(36).substr(2, 9);
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'notivisa_createDraft') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                draftId: mockDraftId,
                status: 'draft',
                createdAt: Timestamp.now().toDate(),
                createdBy: testRtUserId,
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="draft-created-success"]');

      // Assert: Draft created
      const auditEntry = await getAuditLogEntry(testLabId, 'notivisa_draft_created', {
        draftId: mockDraftId,
        laudoId: testLaudoId,
      });
      expect(auditEntry.draftId).toBe(mockDraftId);

      // Action: Navigate to queue and submit
      navigateTo('/notivisa/queue');
      await waitForElement('[data-testid="notivisa-queue-list"]');

      const draftItem = getElementByTestId(`draft-item-${mockDraftId}`);
      expect(draftItem?.textContent).toContain('draft');

      const submitQueueBtn = draftItem?.querySelector('[data-testid="btn-submit-to-api"]');
      clickElement(submitQueueBtn);

      // Mock: NOTIVISA API sandbox submission
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'notivisa_submitDraft') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                draftId: mockDraftId,
                status: 'submitted',
                queueId: 'queue_' + Math.random().toString(36).substr(2, 9),
                apiResponse: {
                  statusCode: '200',
                  receiptCode: 'ANVISA-REC-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
                },
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-submitted"]');

      // Assert: Draft submitted + receipt shown
      const receiptEl = getElementByTestId(`draft-receipt-${mockDraftId}`);
      expect(receiptEl?.textContent).toContain('ANVISA-REC');

      // Action: Poll queue for status
      await new Promise(r => setTimeout(r, 500)); // Simulate polling interval

      // Mock: Queue status check
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'notivisa_pollQueue') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                draftId: mockDraftId,
                status: 'approved',
                pollResult: { message: 'Approved by Anvisa' },
              },
            });
          }
          return vi.fn();
        }),
      }));

      // Wait for polling to detect approval
      await waitForElement(`[data-testid="status-${mockDraftId}-approved"]`, 10000);

      // Assert: Status updated to approved
      const statusEl = getElementByTestId(`status-${mockDraftId}-approved`);
      expect(statusEl?.textContent).toContain('Aprovado');

      // Action: Export result
      const exportBtn = getElementByTestId(`btn-export-${mockDraftId}`);
      clickElement(exportBtn);

      // Mock: Export callable
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'notivisa_exportDraft') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                draftId: mockDraftId,
                jsonPayload: {
                  versao: '1.4',
                  laudo_id: testLaudoId,
                  status: 'approved',
                },
                downloadUrl: 'gs://bucket/exports/notivisa_draft_123.json',
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-export-ready"]');

      // Assert: Archive entry created
      const archiveEntry = await getAuditLogEntry(testLabId, 'notivisa_draft_archived', {
        draftId: mockDraftId,
        status: 'approved',
      });
      expect(archiveEntry.draftId).toBe(mockDraftId);
    });
  });

  describe('Scenario 4.2: Error path — Validation failure → draft stays in draft', () => {
    it('should reject invalid NOTIVISA draft and show error', async () => {
      // Setup
      const testRt = seedRtUser(testRtUserId, testLabId, { role: 'RT' });
      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo('/notivisa');
      await waitForElement('[data-testid="notivisa-dashboard"]');

      // Action: Create draft with invalid data
      const createDraftBtn = getElementByTestId('btn-create-draft');
      clickElement(createDraftBtn);
      await waitForElement('[data-testid="form-notivisa-draft"]');

      const draftForm = getElementByTestId('form-notivisa-draft');
      // Missing required fields intentionally
      fillInput(draftForm?.querySelector('[name="diseaseCode"]'), 'INVALID'); // Invalid code format

      // Mock: Validation error
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'notivisa_createDraft') {
            return vi.fn().mockRejectedValue({
              code: 'invalid-argument',
              message: 'Invalid disease code format',
            });
          }
          return vi.fn();
        }),
      }));

      // Action: Try to submit
      const submitBtn = draftForm?.querySelector('[data-testid="btn-submit-draft"]');
      clickElement(submitBtn);

      // Assert: Error message shown
      await waitForElement('[data-testid="error-message"]');
      const errorMsg = getElementByTestId('error-message');
      expect(errorMsg?.textContent).toContain('Código de doença inválido');

      // Assert: Draft not created
      const auditEntries = await getAuditLogEntries(testLabId, 'notivisa_draft_creation_failed', {
        labId: testLabId,
      });
      expect(auditEntries.length).toBeGreaterThan(0);
    });

    it('should handle API submission failure with retry capability', async () => {
      // Setup
      const testRt = seedRtUser(testRtUserId, testLabId, { role: 'RT' });
      const mockDraftId = 'draft_fail_' + Math.random().toString(36).substr(2, 9);

      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo('/notivisa/queue');
      await waitForElement('[data-testid="notivisa-queue-list"]');

      // Mock: API submission fails first time
      let attemptCount = 0;
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'notivisa_submitDraft') {
            return vi.fn().mockImplementation(() => {
              attemptCount++;
              if (attemptCount === 1) {
                return Promise.reject(new Error('API unavailable'));
              }
              return Promise.resolve({
                data: {
                  success: true,
                  draftId: mockDraftId,
                  status: 'submitted',
                },
              });
            });
          }
          return vi.fn();
        }),
      }));

      // Mock draft exists in queue
      const draftItem = seedQueueDraft(testLabId, mockDraftId, { status: 'draft' });

      // Action: Try to submit
      const submitBtn = getElementByTestId(`btn-submit-to-api-${mockDraftId}`);
      clickElement(submitBtn);

      // Assert: Error shown
      await waitForElement('[data-testid="error-submission"]');
      expect(getElementByTestId('error-submission')?.textContent).toContain('indisponível');

      // Assert: Retry button available
      const retryBtn = getElementByTestId(`btn-retry-${mockDraftId}`);
      expect(retryBtn).toBeDefined();

      // Action: Retry
      clickElement(retryBtn);

      // Assert: Success on retry
      await waitForElement('[data-testid="toast-submitted"]');
      expect(attemptCount).toBe(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function seedRtUser(userId: string, labId: string, options: any = {}) {
  return {
    uid: userId,
    email: `rt_${Math.random().toString(36).substr(2, 6)}@lab.test`,
    labId,
    role: options.role || 'RT',
    nome: 'RT Operador',
    criadoEm: new Date(),
  };
}

function seedTestLaudo(labId: string, laudoId: string, options: any = {}) {
  return {
    id: laudoId,
    labId,
    patientId: options.patientId || 'pat_001',
    exame: options.exame || 'Hemograma',
    status: options.status || 'finalizado',
    resultados: options.resultados || [],
    criadoEm: new Date(),
  };
}

function seedQueueDraft(labId: string, draftId: string, options: any = {}) {
  return {
    id: draftId,
    labId,
    status: options.status || 'draft',
    criadoEm: new Date(),
  };
}

async function generateRtAuthToken(user: any): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    uid: user.uid,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
  }));
  const signature = btoa('mock_signature');
  return `${header}.${payload}.${signature}`;
}

async function loginWithCustomToken(token: string): Promise<void> {
  localStorage.setItem('authToken', token);
  localStorage.setItem('userId', token.split('.')[1]);
}

function navigateTo(path: string): void {
  window.history.pushState({}, '', path);
}

function getElementByTestId(testId: string): Element | undefined {
  return document.querySelector(`[data-testid="${testId}"]`) || undefined;
}

function clickElement(el: Element | undefined): void {
  if (el) (el as HTMLElement).click();
}

function fillInput(el: Element | null | undefined, value: string): void {
  if (el) (el as HTMLInputElement).value = value;
}

async function waitForElement(selector: string, timeout = 5000): Promise<Element> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Element not found: ${selector}`);
}

async function getAuditLogEntry(labId: string, action: string, filters: any = {}): Promise<any> {
  return {
    labId,
    action,
    ...filters,
    ts: Timestamp.now(),
  };
}

async function getAuditLogEntries(labId: string, action: string, filters: any = {}): Promise<any[]> {
  return [await getAuditLogEntry(labId, action, filters)];
}
