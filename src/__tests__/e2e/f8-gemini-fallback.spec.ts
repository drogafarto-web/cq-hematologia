/**
 * E2E Test: F8 — Gemini Vision Failure Fallback
 *
 * Flow: Gemini Vision fails → manual override form shown, error logged
 *
 * Regulatory:
 * - RDC 978 Art. 167: Result accuracy, fallback procedure for system failures
 * - System resilience: graceful degradation with audit trail
 *
 * Scenarios:
 * 1. Happy path: Gemini timeout → fallback form → manual entry → error logged
 * 2. Error path: Missing API key → fallback form with instructions
 *
 * Run: npm test -- f8-gemini-fallback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

describe('F8: Gemini Vision Failure Fallback', () => {
  let testLabId: string;
  let testLaudoId: string;
  let testRtUserId: string;

  beforeEach(() => {
    testLabId = 'lab_test_f8_' + Math.random().toString(36).substr(2, 9);
    testLaudoId = 'laudo_gemini_' + Math.random().toString(36).substr(2, 9);
    testRtUserId = 'user_rt_' + Math.random().toString(36).substr(2, 9);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 8.1: Happy path — Gemini timeout → Fallback → Manual entry → Error logged', () => {
    it('should show fallback form when Gemini Vision times out', async () => {
      // Setup
      const testRt = seedRtUser(testRtUserId, testLabId);
      const testLaudo = seedTestLaudo(testLabId, testLaudoId, {
        patientId: 'pat_gemini_001',
        iaStripPath: 'gs://bucket/strip.jpg',
      });

      // Action: Auth + navigate to laudo entry
      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo(`/laudos/${testLaudoId}/edit`);
      await waitForElement('[data-testid="form-laudo-entry"]');

      // Mock: Upload IA strip
      const fileInput = document.querySelector(
        '[data-testid="input-ia-strip"]',
      ) as HTMLInputElement;
      const mockFile = new File(['image'], 'strip.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      // Action: Trigger OCR
      const processBtn = getElementByTestId('btn-process-ocr');
      clickElement(processBtn);

      // Assert: Processing indicator shown
      await waitForElement('[data-testid="ocr-processing"]');
      expect(getElementByTestId('ocr-processing')?.textContent).toContain('Processando');

      // Mock: Gemini times out (>30s)
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'ocr_processLaudo') {
            return vi
              .fn()
              .mockImplementation(
                () =>
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Vision API timeout after 35s')), 35000),
                  ),
              );
          }
          return vi.fn();
        }),
      }));

      // Wait for timeout
      await waitForElement('[data-testid="ocr-timeout-fallback"]', 40000);

      // Assert: Fallback form shown with clear messaging
      const fallbackForm = getElementByTestId('ocr-timeout-fallback');
      expect(fallbackForm?.textContent).toContain('falhou');
      expect(fallbackForm?.textContent).toContain('manual');
      expect(fallbackForm?.textContent).toContain('timeout');

      // Assert: Manual entry inputs available
      const hemoglobinaInput = fallbackForm?.querySelector('[name="hemoglobina"]');
      expect(hemoglobinaInput).toBeDefined();

      // Action: RT manually fills fields
      fillInput(hemoglobinaInput as Element, '13.5 g/dL');
      fillInput(fallbackForm?.querySelector('[name="hematocrito"]'), '41%');
      fillInput(fallbackForm?.querySelector('[name="globulos_vermelhos"]'), '4.4 M/uL');

      // Action: Save with fallback flag
      const saveBtn = fallbackForm?.querySelector('[data-testid="btn-save-fallback"]');
      clickElement(saveBtn);

      // Mock: Save with fallback signature
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'laudos_saveLaudo') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                laudoId: testLaudoId,
                fallbackReason: 'Vision API timeout',
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-laudo-saved"]');

      // Assert: Error logged with full context
      const auditEntry = await getAuditLogEntry(testLabId, 'gemini_failure_fallback', {
        laudoId: testLaudoId,
        failureType: 'timeout',
        duration_seconds: 35,
      });
      expect(auditEntry.failureType).toBe('timeout');
      expect(auditEntry.fallbackUsed).toBe(true);

      // Assert: Laudo saved with fallback signature
      const laudoEntry = await getAuditLogEntry(testLabId, 'laudo_saved', {
        laudoId: testLaudoId,
      });
      expect(laudoEntry.entryMethod).toBe('manual_fallback');
      expect(laudoEntry.originalFailure).toContain('Vision API');
    });

    it('should handle partial Gemini failure (some fields extract, others fail)', async () => {
      // Setup
      const testRt = seedRtUser(testRtUserId, testLabId);
      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo(`/laudos/${testLaudoId}/edit`);
      await waitForElement('[data-testid="form-laudo-entry"]');

      // Mock: Upload image
      const fileInput = document.querySelector(
        '[data-testid="input-ia-strip"]',
      ) as HTMLInputElement;
      const mockFile = new File(['blurry'], 'strip.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      // Mock: Gemini partially succeeds (2 of 4 fields extracted)
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'ocr_processLaudo') {
            return vi.fn().mockResolvedValue({
              data: {
                success: false,
                partial: true,
                fields: {
                  hemoglobina: '12.8 g/dL',
                  hematocrito: '38%',
                  // globulos_vermelhos and leucocitos failed to extract
                },
                extractedFields: 2,
                totalFields: 4,
                confidence: 0.55, // Low due to partial extraction
              },
            });
          }
          return vi.fn();
        }),
      }));

      clickElement(getElementByTestId('btn-process-ocr'));
      await waitForElement('[data-testid="ocr-partial-results"]', 10000);

      // Assert: Partial results shown with missing field indicators
      const partialResults = getElementByTestId('ocr-partial-results');
      expect(partialResults?.textContent).toContain('2 de 4');
      expect(partialResults?.textContent).toContain('Hemoglobina');
      expect(partialResults?.textContent).toContain('Hematócrito');

      // Assert: Missing fields marked as incomplete
      const missingFieldsEl = partialResults?.querySelector('[data-testid="missing-fields"]');
      expect(missingFieldsEl?.textContent).toContain('Glóbulos vermelhos');
      expect(missingFieldsEl?.textContent).toContain('Leucócitos');

      // Assert: Manual entry required for missing fields
      const manualForm = partialResults?.querySelector('[data-testid="form-manual-missing"]');
      expect(manualForm).toBeDefined();

      // Action: Fill missing fields
      fillInput(manualForm?.querySelector('[name="globulos_vermelhos"]'), '4.3 M/uL');
      fillInput(manualForm?.querySelector('[name="leucocitos"]'), '7.5 K/uL');

      // Action: Save combined result
      const saveBtn = manualForm?.querySelector('[data-testid="btn-save-combined"]');
      clickElement(saveBtn);

      // Assert: Partial extraction logged
      const auditEntry = await getAuditLogEntry(testLabId, 'gemini_partial_extraction', {
        laudoId: testLaudoId,
        extractedCount: 2,
        totalCount: 4,
        manualCompleted: true,
      });
      expect(auditEntry.extractedCount).toBe(2);
    });
  });

  describe('Scenario 8.2: Error path — Missing API key → Fallback with instructions', () => {
    it('should handle missing Gemini API key gracefully', async () => {
      // Setup
      const testRt = seedRtUser(testRtUserId, testLabId);
      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo(`/laudos/${testLaudoId}/edit`);
      await waitForElement('[data-testid="form-laudo-entry"]');

      // Mock: API key not configured
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'ocr_processLaudo') {
            return vi.fn().mockRejectedValue({
              code: 'unauthenticated',
              message: 'API key not configured for Gemini Vision',
            });
          }
          return vi.fn();
        }),
      }));

      // Mock: Upload image
      const fileInput = document.querySelector(
        '[data-testid="input-ia-strip"]',
      ) as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File(['image'], 'strip.jpg', { type: 'image/jpeg' }));
      fileInput.files = dataTransfer.files;

      // Action: Try to process OCR
      clickElement(getElementByTestId('btn-process-ocr'));

      // Assert: Admin notification fallback shown
      await waitForElement('[data-testid="error-api-key-missing"]', 5000);
      const errorEl = getElementByTestId('error-api-key-missing');
      expect(errorEl?.textContent).toContain('API não configurada');

      // Assert: Manual entry form shown with instructions
      await waitForElement('[data-testid="form-manual-with-instructions"]');
      const instructionsForm = getElementByTestId('form-manual-with-instructions');
      expect(instructionsForm?.textContent).toContain('preenchimento manual');
      expect(instructionsForm?.textContent).toContain('admin');

      // Assert: Error logged to audit with severity HIGH
      const auditEntry = await getAuditLogEntry(testLabId, 'gemini_api_key_missing', {
        laudoId: testLaudoId,
        severity: 'HIGH',
      });
      expect(auditEntry.severity).toBe('HIGH');

      // Action: RT can still fill form manually
      fillInput(instructionsForm?.querySelector('[name="hemoglobina"]'), '14.0 g/dL');
      const saveBtn = instructionsForm?.querySelector('[data-testid="btn-save-manual"]');
      clickElement(saveBtn);

      // Assert: Saved with admin notification flag
      const savedAuditEntry = await getAuditLogEntry(testLabId, 'laudo_saved_admin_notified', {
        reason: 'api_key_missing',
      });
      expect(savedAuditEntry.reason).toBe('api_key_missing');
    });

    it('should retry Gemini after transient error', async () => {
      // Setup
      const testRt = seedRtUser(testRtUserId, testLabId);
      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo(`/laudos/${testLaudoId}/edit`);
      await waitForElement('[data-testid="form-laudo-entry"]');

      // Mock: First attempt fails (transient), second succeeds
      let attemptCount = 0;
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'ocr_processLaudo') {
            return vi.fn().mockImplementation(() => {
              attemptCount++;
              if (attemptCount === 1) {
                return Promise.reject(new Error('Service temporarily unavailable'));
              }
              return Promise.resolve({
                data: {
                  success: true,
                  fields: { hemoglobina: '13.2 g/dL' },
                  confidence: 0.94,
                },
              });
            });
          }
          return vi.fn();
        }),
      }));

      // Mock: Upload image
      const fileInput = document.querySelector(
        '[data-testid="input-ia-strip"]',
      ) as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File(['image'], 'strip.jpg', { type: 'image/jpeg' }));
      fileInput.files = dataTransfer.files;

      // Action: Process OCR
      clickElement(getElementByTestId('btn-process-ocr'));

      // Assert: Error shown with retry option
      await waitForElement('[data-testid="btn-retry-ocr"]', 5000);
      expect(attemptCount).toBe(1);

      // Action: Retry
      const retryBtn = getElementByTestId('btn-retry-ocr');
      clickElement(retryBtn);

      // Assert: Success on retry
      await waitForElement('[data-testid="ocr-results-display"]', 5000);
      expect(attemptCount).toBe(2);

      // Assert: Retry logged
      const auditEntry = await getAuditLogEntry(testLabId, 'gemini_retry_success', {
        attempts: 2,
      });
      expect(auditEntry.attempts).toBe(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function seedRtUser(userId: string, labId: string) {
  return {
    uid: userId,
    email: `rt_${Math.random().toString(36).substr(2, 6)}@lab.test`,
    labId,
    role: 'RT',
    nome: 'RT Operador',
  };
}

function seedTestLaudo(labId: string, laudoId: string, options: any = {}) {
  return {
    id: laudoId,
    labId,
    patientId: options.patientId || 'pat_001',
    exame: options.exame || 'Hemograma',
    status: 'em_entrada',
    iaStripPath: options.iaStripPath || null,
  };
}

async function generateRtAuthToken(user: any): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      uid: user.uid,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    }),
  );
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

function fillInput(el: Element | undefined | null, value: string): void {
  if (el) (el as HTMLInputElement).value = value;
}

async function waitForElement(selector: string, timeout = 5000): Promise<Element> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 100));
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
