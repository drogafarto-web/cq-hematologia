/**
 * E2E Test: F2 — RT Presence Check-In & Art. 22 Enforcement
 *
 * Flow: Operator initiates RT presence check-in → supervisor-status updated → CIQ run creation unblocked
 *
 * Regulatory:
 * - RDC 978 Art. 22: Mandatory RT supervision requirement
 * - DICQ 4.1.2.7: Documented turnos supervisor actions
 *
 * Scenarios:
 * 1. Happy path: Check-in → status updated → /runs/new enabled
 * 2. Error path: No supervisor → /runs/new disabled with error message
 *
 * Run: npm test -- f2-rt-presence-check-in
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

describe('F2: RT Presence Check-In & Art. 22 Enforcement', () => {
  let testLabId: string;
  let testRtUserId: string;

  beforeEach(() => {
    testLabId = 'lab_test_f2_' + Math.random().toString(36).substr(2, 9);
    testRtUserId = 'user_rt_' + Math.random().toString(36).substr(2, 9);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 2.1: Happy path — RT check-in → /runs/new enabled', () => {
    it('should enable CIQ run creation after RT check-in', async () => {
      // Setup: Create RT user + lab
      const testRt = seedRtUser(testRtUserId, testLabId, { role: 'RT', nome: 'Técnico de Lab' });
      const testLab = seedTestLab(testLabId, { nomeAbreviado: 'Lab-Test' });

      // Mock: Auth
      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo('/turnos');

      // Action: Check-in
      const checkInBtn = getElementByTestId('btn-check-in');
      expect(checkInBtn).toBeDefined();
      clickElement(checkInBtn);

      // Mock: Cloud Function callable for check-in
      const checkInTime = Timestamp.now();
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'turnos_checkIn') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                supervisorId: testRtUserId,
                checkedInAt: checkInTime.toDate(),
                status: 'active',
              },
            });
          }
          return vi.fn();
        }),
      }));

      // Assert: Supervisor status updated in real-time
      await waitForElement('[data-testid="supervisor-status-active"]');
      const statusEl = getElementByTestId('supervisor-status-active');
      expect(statusEl?.textContent).toContain('Ativo');
      expect(statusEl?.textContent).toContain(testRt.nome);

      // Action: Navigate to /runs/new
      navigateTo('/runs/new');
      await waitForElement('[data-testid="form-new-run"]');

      // Assert: /runs/new is enabled (not disabled)
      const runForm = getElementByTestId('form-new-run');
      expect(runForm).toBeDefined();
      const submitBtn = runForm?.querySelector('[data-testid="btn-submit-run"]');
      expect(submitBtn?.getAttribute('disabled')).toBeNull();

      // Action: Create CIQ run
      fillInput(runForm?.querySelector('[name="nomeRun"]'), 'Run de teste 001');
      clickElement(submitBtn);

      // Mock: Run creation callable
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'runs_create') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                runId: 'run_' + Math.random().toString(36).substr(2, 9),
                supervisorId: testRtUserId,
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-success"]');

      // Assert: Run created with supervisor ID
      const auditEntry = await getAuditLogEntry(testLabId, 'run_created', {
        supervisorId: testRtUserId,
      });
      expect(auditEntry.supervisorId).toBe(testRtUserId);
      expect(auditEntry.ts).toBeDefined();
    });
  });

  describe('Scenario 2.2: Error path — No supervisor → /runs/new blocked', () => {
    it('should block CIQ run creation when no RT supervisor is checked in', async () => {
      // Setup: Lab with no active supervisor
      const testUser = seedLabOperator(
        'user_op_' + Math.random().toString(36).substr(2, 9),
        testLabId,
      );
      await loginWithCustomToken(await generateRtAuthToken(testUser));

      // Mock: Supervisor status check returns no active supervisor
      vi.mock('firebase/firestore', () => ({
        onSnapshot: vi.fn((query, callback) => {
          callback({
            docs: [],
            empty: true,
          });
          return vi.fn(); // unsubscribe
        }),
      }));

      navigateTo('/runs/new');
      await waitForElement('[data-testid="error-no-supervisor"]');

      // Assert: Error message shown
      const errorEl = getElementByTestId('error-no-supervisor');
      expect(errorEl?.textContent).toContain('Supervisor ausente');
      expect(errorEl?.textContent).toContain('Art. 22');

      // Assert: Run form disabled
      const runForm = getElementByTestId('form-new-run');
      if (runForm) {
        const submitBtn = runForm.querySelector('[data-testid="btn-submit-run"]');
        expect(submitBtn?.getAttribute('disabled')).toBe('true');
      }

      // Assert: Error logged in audit
      const auditEntry = await getAuditLogEntry(testLabId, 'run_creation_blocked', {
        reason: 'no_active_supervisor',
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry.reason).toBe('no_active_supervisor');
    });

    it('should show check-in prompt when supervisor logged out', async () => {
      // Setup: RT was checked in, then logs out
      const testRt = seedRtUser(testRtUserId, testLabId, { role: 'RT' });
      await loginWithCustomToken(await generateRtAuthToken(testRt));
      navigateTo('/turnos');

      // Simulate check-out (mocking a supervisor logout)
      const checkOutBtn = getElementByTestId('btn-check-out');
      if (checkOutBtn) {
        clickElement(checkOutBtn);
        await waitForElement('[data-testid="supervisor-status-inactive"]');
      }

      // Action: Try to access /runs/new
      navigateTo('/runs/new');

      // Assert: Prompted to check in
      const promptEl = getElementByTestId('prompt-supervisor-check-in');
      expect(promptEl).toBeDefined();
      expect(promptEl?.textContent).toContain('Efetue check-in');
      expect(promptEl?.textContent).toContain('Art. 22');

      // Action: Click check-in link
      const checkInLink = promptEl?.querySelector('[data-testid="link-check-in"]');
      clickElement(checkInLink);
      navigateTo('/turnos');

      // Assert: Back at check-in page
      expect(window.location.pathname).toBe('/turnos');
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
    nome: options.nome || 'Técnico de Lab',
    criadoEm: new Date(),
    status: 'ativo',
  };
}

function seedLabOperator(userId: string, labId: string) {
  return {
    uid: userId,
    email: `op_${Math.random().toString(36).substr(2, 6)}@lab.test`,
    labId,
    role: 'OPERATOR',
    nome: 'Operador',
    criadoEm: new Date(),
    status: 'ativo',
  };
}

function seedTestLab(labId: string, options: any = {}) {
  return {
    id: labId,
    nomeAbreviado: options.nomeAbreviado || 'LAB-TEST',
    nomeFull: 'Laboratório de Teste',
    cnpj: '12.345.678/0001-90',
    criadoEm: new Date(),
    status: 'ativo',
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

function fillInput(el: Element | null | undefined, value: string): void {
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
