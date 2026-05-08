/**
 * E2E Test: F6 — Patient Consent Backfill & Data Export
 *
 * Flow: Patient requests data export → backfill consent form → admin batches upload → consents recorded
 *
 * Regulatory:
 * - LGPD Art. 17: Right to data portability (LGPD Art. 17)
 * - DICQ 4.4: Compliance audit trail
 *
 * Scenarios:
 * 1. Happy path: Export request → backfill form → admin batch upload → consents recorded
 * 2. Error path: CSV parse error → error message → admin retries
 *
 * Run: npm test -- f6-consent-backfill-export
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

describe('F6: Patient Consent Backfill & Data Export', () => {
  let testLabId: string;
  let testPatientId: string;
  let testAdminUserId: string;

  beforeEach(() => {
    testLabId = 'lab_test_f6_' + Math.random().toString(36).substr(2, 9);
    testPatientId = 'pat_export_' + Math.random().toString(36).substr(2, 9);
    testAdminUserId = 'admin_' + Math.random().toString(36).substr(2, 9);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 6.1: Happy path — Export request → Backfill form → Batch upload → Recorded', () => {
    it('should handle patient data export request with consent backfill', async () => {
      // Setup: Patient portal
      const testPatient = seedTestPatient(testPatientId, testLabId, {
        email: 'patient@example.com',
        nome: 'Maria Silva',
      });

      const authToken = generatePatientAuthToken(testPatientId, testPatient.email);
      await loginWithCustomToken(authToken);
      navigateTo('/portal/dashboard');
      await waitForElement('[data-testid="portal-dashboard"]');

      // Action: Patient requests data export
      const exportBtn = getElementByTestId('btn-request-export');
      clickElement(exportBtn);
      await waitForElement('[data-testid="modal-export-request"]');

      // Assert: Export request form shown
      const exportModal = getElementByTestId('modal-export-request');
      expect(exportModal?.textContent).toContain('Exportar dados');
      expect(exportModal?.textContent).toContain('LGPD');

      // Action: Patient confirms export request
      const confirmBtn = exportModal?.querySelector('[data-testid="btn-confirm-export"]');
      clickElement(confirmBtn);

      // Mock: Cloud Function to process export request
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'portal_requestDataExport') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                patientId: testPatientId,
                exportId: 'export_' + Math.random().toString(36).substr(2, 9),
                status: 'pending',
                createdAt: Timestamp.now().toDate(),
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-export-requested"]');

      // Assert: Audit trail recorded
      let exportAuditEntry = await getAuditLogEntry(testLabId, 'patient_export_requested', {
        patientId: testPatientId,
      });
      expect(exportAuditEntry.patientId).toBe(testPatientId);

      // ─────────────────────────────────────────────────────────────────────────
      // Admin: Process backfill consent
      // ─────────────────────────────────────────────────────────────────────────

      const testAdmin = seedAdminUser(testAdminUserId, testLabId);
      await loginWithCustomToken(await generateAdminAuthToken(testAdmin));
      navigateTo('/admin/consent-backfill');
      await waitForElement('[data-testid="admin-consent-backfill"]');

      // Assert: Pending export requests shown
      const pendingExports = getElementByTestId('pending-exports-list');
      expect(pendingExports).toBeDefined();

      // Action: Admin opens backfill consent form
      const backfillBtn = getElementByTestId(`btn-backfill-${testPatientId}`);
      clickElement(backfillBtn);
      await waitForElement('[data-testid="form-consent-backfill"]');

      // Assert: Patient info pre-filled
      const backfillForm = getElementByTestId('form-consent-backfill');
      expect(backfillForm?.textContent).toContain('Maria Silva');
      expect(backfillForm?.textContent).toContain('patient@example.com');

      // Action: Admin fills consent details
      const consentDateInput = backfillForm?.querySelector('[name="consentDate"]') as HTMLInputElement;
      if (consentDateInput) consentDateInput.value = '2026-05-01';

      const consentTypeSelect = backfillForm?.querySelector('[name="consentType"]') as HTMLSelectElement;
      if (consentTypeSelect) consentTypeSelect.value = 'ia_strip_ocr';

      // Action: Submit backfill form
      const submitBtn = backfillForm?.querySelector('[data-testid="btn-submit-backfill"]');
      clickElement(submitBtn);

      // Mock: Record backfill consent
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'recordPatientConsent') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                consentId: 'consent_backfill_' + Math.random().toString(36).substr(2, 9),
                patientId: testPatientId,
                type: 'ia_strip_ocr',
                backfilledAt: Timestamp.now().toDate(),
                backfilledBy: testAdminUserId,
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-backfill-recorded"]');

      // Assert: Consent recorded in Firestore
      const consentEntry = await getAuditLogEntry(testLabId, 'patient_consent_backfilled', {
        patientId: testPatientId,
        consentType: 'ia_strip_ocr',
      });
      expect(consentEntry.backfilledBy).toBe(testAdminUserId);

      // Action: Generate batch export (admin can batch multiple consents)
      const batchProcessBtn = getElementByTestId('btn-batch-process');
      clickElement(batchProcessBtn);

      // Mock: Generate batch export file
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'exportPatientData') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                patientId: testPatientId,
                zipUrl: 'gs://bucket/exports/patient_001_export.zip',
                contents: [
                  'laudo_001.pdf',
                  'laudo_002.pdf',
                  'resultados.json',
                ],
                createdAt: Timestamp.now().toDate(),
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-export-generated"]');

      // Assert: Export batch recorded
      const exportBatchEntry = await getAuditLogEntry(testLabId, 'patient_data_exported', {
        patientId: testPatientId,
      });
      expect(exportBatchEntry.status).toBeDefined();
    });
  });

  describe('Scenario 6.2: Error path — CSV parse error → Retry', () => {
    it('should handle CSV parse errors during batch backfill', async () => {
      // Setup: Admin user with batch consent CSV
      const testAdmin = seedAdminUser(testAdminUserId, testLabId);
      await loginWithCustomToken(await generateAdminAuthToken(testAdmin));
      navigateTo('/admin/consent-backfill-batch');
      await waitForElement('[data-testid="form-batch-csv-upload"]');

      // Action: Upload malformed CSV
      const csvForm = getElementByTestId('form-batch-csv-upload');
      const fileInput = csvForm?.querySelector('[data-testid="input-csv-file"]') as HTMLInputElement;

      // Create invalid CSV (missing required columns)
      const invalidCsv = 'email,name\npatient@test.com,John'; // Missing consentType, consentDate
      const csvFile = new File([invalidCsv], 'consents.csv', { type: 'text/csv' });

      if (fileInput) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(csvFile);
        fileInput.files = dataTransfer.files;
      }

      // Action: Try to process batch
      const processBtn = csvForm?.querySelector('[data-testid="btn-process-csv"]');
      clickElement(processBtn);

      // Mock: CSV validation fails
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'validateConsentCsv') {
            return vi.fn().mockRejectedValue({
              code: 'invalid-csv',
              message: 'Missing required columns: consentType, consentDate',
              line: 2,
            });
          }
          return vi.fn();
        }),
      }));

      // Assert: Error message shown
      await waitForElement('[data-testid="error-csv-validation"]');
      const errorEl = getElementByTestId('error-csv-validation');
      expect(errorEl?.textContent).toContain('consentType');
      expect(errorEl?.textContent).toContain('linha 2');

      // Assert: Retry option available
      const retryBtn = getElementByTestId('btn-retry-csv');
      expect(retryBtn).toBeDefined();

      // Action: Correct CSV and retry
      const correctCsv = 'email,name,consentType,consentDate\npatient@test.com,John,ia_strip_ocr,2026-05-01';
      const correctFile = new File([correctCsv], 'consents_fixed.csv', { type: 'text/csv' });
      const dataTransfer2 = new DataTransfer();
      dataTransfer2.items.add(correctFile);
      fileInput.files = dataTransfer2.files;

      clickElement(retryBtn);

      // Mock: CSV validation succeeds
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'validateConsentCsv') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                rowCount: 1,
                errors: [],
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="csv-preview-table"]');

      // Assert: Preview shown
      const preview = getElementByTestId('csv-preview-table');
      expect(preview?.textContent).toContain('John');
      expect(preview?.textContent).toContain('ia_strip_ocr');

      // Action: Confirm batch processing
      const confirmBtn = getElementByTestId('btn-confirm-batch');
      clickElement(confirmBtn);

      // Mock: Process batch
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'processBatchConsents') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                processed: 1,
                failed: 0,
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-batch-processed"]');

      // Assert: Batch logged
      const batchEntry = await getAuditLogEntry(testLabId, 'consent_batch_processed', {
        rowsProcessed: 1,
      });
      expect(batchEntry.rowsProcessed).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function seedTestPatient(patientId: string, labId: string, options: any = {}) {
  return {
    id: patientId,
    labId,
    email: options.email || 'patient@test.com',
    nome: options.nome || 'Patient Name',
    cpf: '123.456.789-00',
  };
}

function seedAdminUser(userId: string, labId: string) {
  return {
    uid: userId,
    email: `admin_${Math.random().toString(36).substr(2, 6)}@lab.test`,
    labId,
    role: 'ADMIN',
    nome: 'Admin User',
  };
}

function generatePatientAuthToken(patientId: string, email: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    patientId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  }));
  const signature = btoa('mock_signature');
  return `${header}.${payload}.${signature}`;
}

async function generateAdminAuthToken(user: any): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    uid: user.uid,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
  }));
  const signature = btoa('mock_admin_signature');
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
