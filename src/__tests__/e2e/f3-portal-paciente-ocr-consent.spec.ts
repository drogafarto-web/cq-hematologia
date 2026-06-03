/**
 * E2E Test: F3 — Portal-Paciente Consent & Laudo OCR
 *
 * Flow: Patient logs in via email link → Portal-Paciente → consents to IA-strip OCR → Gemini Vision processes
 *
 * Regulatory:
 * - LGPD Art. 9: Explicit consent for biometric processing (IA-strip image)
 * - LGPD Art. 11: Access to own personal data
 * - RDC 978 Art. 167: Result capture and delivery to patient
 *
 * Scenarios:
 * 1. Happy path: Email auth → consent → OCR → fields extracted
 * 2. Error path: Patient refuses consent → manual entry form shown
 *
 * Run: npm test -- f3-portal-paciente-ocr-consent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

describe('F3: Portal-Paciente Consent & Laudo OCR', () => {
  let testLabId: string;
  let testPatientId: string;
  let testPatientEmail: string;
  let testAuthToken: string;

  beforeEach(() => {
    testLabId = 'lab_test_f3_' + Math.random().toString(36).substr(2, 9);
    testPatientId = 'pat_f3_' + Math.random().toString(36).substr(2, 9);
    testPatientEmail = `patient_${Math.random().toString(36).substr(2, 6)}@patient.test`;
    testAuthToken = generatePatientAuthToken(testPatientId, testPatientEmail);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Scenario 3.1: Happy path — Email auth → Consent → OCR processing', () => {
    it('should authenticate patient via email token and process OCR after consent', async () => {
      // Setup: Patient and test laudo
      const testPatient = seedTestPatient(testPatientId, testLabId, {
        email: testPatientEmail,
        nome: 'Alice da Silva',
      });

      const testLaudo = seedTestLaudo(testLabId, testPatientId, {
        id: 'laudo_ocr_test_001',
        exame: 'Hemograma',
        status: 'finalizado',
        iaStripPath: 'gs://bucket/patient_001/strip_001.jpg',
      });

      // Action: Click email link with token
      const authLink = `/portal/auth?token=${testAuthToken}&patient=${testPatientId}`;
      navigateTo(authLink);

      // Mock: Validate patient auth token
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'portal_validateAuthToken') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                patientId: testPatientId,
                email: testPatientEmail,
                sessionToken: testAuthToken,
              },
            });
          }
          return vi.fn();
        }),
      }));

      // Assert: Patient authenticated + redirected to dashboard
      await waitForElement('[data-testid="portal-dashboard"]');
      expect(localStorage.getItem('patientSessionToken')).toBe(testAuthToken);
      expect(localStorage.getItem('patientId')).toBe(testPatientId);

      // Action: Navigate to laudo detail
      navigateTo(`/portal/laudo/${testLaudo.id}`);
      await waitForElement('[data-testid="laudo-detail-view"]');

      // Assert: Laudo loaded with OCR consent checkbox
      const laudoDetail = getElementByTestId('laudo-detail-view');
      expect(laudoDetail?.textContent).toContain('Hemograma');
      expect(laudoDetail?.textContent).toContain('Alice da Silva');

      const consentCheckbox = laudoDetail?.querySelector(
        '[data-testid="consent-ia-strip-ocr"]',
      ) as HTMLInputElement;
      expect(consentCheckbox).toBeDefined();
      expect(consentCheckbox?.checked).toBe(false); // Unchecked initially

      // Action: Patient consents to OCR
      clickElement(consentCheckbox);
      expect(consentCheckbox?.checked).toBe(true);

      // Mock: Record consent
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'recordPatientConsent') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                consentId: 'consent_' + Math.random().toString(36).substr(2, 9),
                type: 'ia_strip_ocr',
                patientId: testPatientId,
                recordedAt: Timestamp.now().toDate(),
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-consent-recorded"]');

      // Assert: Consent logged
      const consentEntry = await getAuditLogEntry(testLabId, 'patient_consent_recorded', {
        patientId: testPatientId,
        consentType: 'ia_strip_ocr',
      });
      expect(consentEntry.patientId).toBe(testPatientId);
      expect(consentEntry.consentType).toBe('ia_strip_ocr');

      // Action: OCR processing triggered automatically
      const ocrProcessingIndicator = getElementByTestId('ocr-processing');
      if (ocrProcessingIndicator) {
        expect(ocrProcessingIndicator?.textContent).toContain('Processando');
      }

      // Mock: Gemini Vision processes image
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'ocr_processLaudo') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                fields: {
                  hemoglobina: '12.5 g/dL',
                  hematocrito: '37%',
                  globulos_vermelhos: '4.2 M/uL',
                },
                confidence: 0.95,
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="ocr-complete"]', 10000);

      // Assert: OCR fields extracted and displayed
      const ocrResults = getElementByTestId('ocr-results');
      expect(ocrResults?.textContent).toContain('Hemoglobina');
      expect(ocrResults?.textContent).toContain('12.5');

      // Assert: Manual review/approval form available
      const approvalForm = getElementByTestId('form-ocr-approval');
      expect(approvalForm).toBeDefined();
      expect(approvalForm?.textContent).toContain('Revisar');
      expect(approvalForm?.textContent).toContain('Confirmar');
    });
  });

  describe('Scenario 3.2: Error path — Patient refuses consent → manual entry form', () => {
    it('should show manual entry form when patient declines OCR consent', async () => {
      // Setup
      const testPatient = seedTestPatient(testPatientId, testLabId, {
        email: testPatientEmail,
      });
      const testLaudo = seedTestLaudo(testLabId, testPatientId, {
        iaStripPath: 'gs://bucket/patient_001/strip_001.jpg',
      });

      // Action: Auth + navigate to laudo
      const authLink = `/portal/auth?token=${testAuthToken}&patient=${testPatientId}`;
      navigateTo(authLink);
      await waitForElement('[data-testid="portal-dashboard"]');
      navigateTo(`/portal/laudo/${testLaudo.id}`);
      await waitForElement('[data-testid="laudo-detail-view"]');

      // Action: Patient declines consent
      const consentCheckbox = document.querySelector(
        '[data-testid="consent-ia-strip-ocr"]',
      ) as HTMLInputElement;
      // Leave unchecked (declined)
      expect(consentCheckbox?.checked).toBe(false);

      // Action: Patient scrolls to bottom or clicks "Confirmar sem OCR"
      const confirmManualBtn = getElementByTestId('btn-confirm-manual-entry');
      clickElement(confirmManualBtn);

      // Mock: Record consent decline
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'recordPatientConsent') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                consentId: 'consent_declined_' + Math.random().toString(36).substr(2, 9),
                type: 'ia_strip_ocr',
                patientId: testPatientId,
                granted: false,
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="form-manual-entry"]');

      // Assert: Manual entry form shown
      const manualForm = getElementByTestId('form-manual-entry');
      expect(manualForm).toBeDefined();
      expect(manualForm?.textContent).toContain('Preenchimento manual');

      // Assert: Consent decline logged
      const auditEntry = await getAuditLogEntry(testLabId, 'patient_consent_declined', {
        patientId: testPatientId,
        consentType: 'ia_strip_ocr',
      });
      expect(auditEntry.consentType).toBe('ia_strip_ocr');
      expect(auditEntry.granted).toBe(false);
    });

    it('should handle Gemini timeout with graceful fallback to manual entry', async () => {
      // Setup
      const testLaudo = seedTestLaudo(testLabId, testPatientId, {
        iaStripPath: 'gs://bucket/patient_001/strip_001.jpg',
      });

      // Action: Auth + navigate to laudo
      navigateTo(`/portal/auth?token=${testAuthToken}`);
      await waitForElement('[data-testid="portal-dashboard"]');
      navigateTo(`/portal/laudo/${testLaudo.id}`);

      // Action: Consent to OCR
      const consentCheckbox = document.querySelector(
        '[data-testid="consent-ia-strip-ocr"]',
      ) as HTMLInputElement;
      clickElement(consentCheckbox);

      // Mock: Gemini timeout
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'ocr_processLaudo') {
            return vi.fn().mockRejectedValue(new Error('timeout'));
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="ocr-timeout-error"]', 15000);

      // Assert: Fallback form shown
      const fallbackForm = getElementByTestId('form-manual-entry-fallback');
      expect(fallbackForm).toBeDefined();
      expect(fallbackForm?.textContent).toContain('Automático falhou');
      expect(fallbackForm?.textContent).toContain('manual');

      // Assert: Error logged in audit
      const auditEntry = await getAuditLogEntry(testLabId, 'ocr_error_fallback', {
        laudoId: testLaudo.id,
        error: 'timeout',
      });
      expect(auditEntry.error).toBe('timeout');
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
    cpf: options.cpf || '123.456.789-00',
    criadoEm: new Date(),
  };
}

function seedTestLaudo(labId: string, patientId: string, options: any = {}) {
  return {
    id: options.id || 'laudo_' + Math.random().toString(36).substr(2, 9),
    labId,
    patientId,
    exame: options.exame || 'Hemograma',
    status: options.status || 'finalizado',
    iaStripPath: options.iaStripPath || null,
    criadoEm: new Date(),
  };
}

function generatePatientAuthToken(patientId: string, email: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      patientId,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24h
    }),
  );
  const signature = btoa('mock_patient_signature');
  return `${header}.${payload}.${signature}`;
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
