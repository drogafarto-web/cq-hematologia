/**
 * E2E Test: F7 — Supervisor Absence CIQ Block (Art. 22 Fail-Safe)
 *
 * Flow: No active supervisor → CIQ run creation blocked (fail-closed enforcement)
 *
 * Regulatory:
 * - RDC 978 Art. 22: Mandatory RT supervision requirement
 * - Fail-safe by design: default deny when supervisor status unknown
 *
 * Scenarios:
 * 1. Happy path: No active supervisor → run creation blocked → error message
 * 2. Regression test: Supervisor logged out → realtime status update → run blocked immediately
 *
 * Run: npm test -- f7-supervisor-absence-blocked
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

describe('F7: Supervisor Absence CIQ Block (Fail-Safe)', () => {
  let testLabId: string;
  let testOperatorId: string;

  beforeEach(() => {
    testLabId = 'lab_test_f7_' + Math.random().toString(36).substr(2, 9);
    testOperatorId = 'op_' + Math.random().toString(36).substr(2, 9);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 7.1: No active supervisor → Run creation blocked', () => {
    it('should block CIQ run creation when no RT is checked in', async () => {
      // Setup: Operator (non-RT) user
      const testOperator = seedOperator(testOperatorId, testLabId);

      // Mock: No active supervisor in Firestore
      vi.mock('firebase/firestore', () => ({
        onSnapshot: vi.fn((query, callback) => {
          callback({
            docs: [],
            empty: true,
          });
          return vi.fn(); // unsubscribe
        }),
      }));

      // Action: Auth + navigate to /runs/new
      await loginWithCustomToken(await generateAuthToken(testOperator));
      navigateTo('/runs/new');

      // Assert: Blocked by fail-safe
      await waitForElement('[data-testid="error-no-supervisor"]', 5000);

      // Assert: Error message clear and references regulation
      const errorEl = getElementByTestId('error-no-supervisor');
      expect(errorEl?.textContent).toContain('Supervisor ausente');
      expect(errorEl?.textContent).toContain('Art. 22');
      expect(errorEl?.textContent).toContain('RDC 978');

      // Assert: Form inputs disabled
      const nomeRunInput = document.querySelector('[name="nomeRun"]') as HTMLInputElement;
      expect(nomeRunInput?.disabled).toBe(true);

      // Assert: Submit button disabled
      const submitBtn = getElementByTestId('btn-submit-run');
      expect(submitBtn?.getAttribute('disabled')).toBe('true');

      // Assert: Audit logged for blocked attempt
      const auditEntry = await getAuditLogEntry(testLabId, 'run_creation_blocked', {
        operatorId: testOperatorId,
        reason: 'no_active_supervisor',
      });
      expect(auditEntry.reason).toBe('no_active_supervisor');
    });

    it('should show prompt to check in RT when supervisor list is empty', async () => {
      // Setup: Operator accessing /runs/new without active supervisor
      const testOperator = seedOperator(testOperatorId, testLabId);
      await loginWithCustomToken(await generateAuthToken(testOperator));

      // Mock: Empty supervisor list
      vi.mock('firebase/firestore', () => ({
        onSnapshot: vi.fn(() => {
          return vi.fn(); // unsubscribe immediately
        }),
      }));

      navigateTo('/runs/new');
      await waitForElement('[data-testid="prompt-check-in-supervisor"]');

      // Assert: Prompt shown
      const prompt = getElementByTestId('prompt-check-in-supervisor');
      expect(prompt?.textContent).toContain('Supervisor');
      expect(prompt?.textContent).toContain('check-in');

      // Assert: Link to /turnos/check-in available
      const checkInLink = prompt?.querySelector('[data-testid="link-turnos-check-in"]');
      expect(checkInLink?.getAttribute('href')).toContain('/turnos');

      // Action: Click check-in link
      clickElement(checkInLink);

      // Assert: Redirected to check-in
      await new Promise((r) => setTimeout(r, 500));
      expect(window.location.pathname).toContain('/turnos');
    });
  });

  describe('Scenario 7.2: Regression — Supervisor logout → Realtime status update → Run blocked', () => {
    it('should immediately block run creation when supervisor logs out (realtime)', async () => {
      // Setup: Supervisor checked in initially
      const testRt = seedRtUser('rt_checked_in', testLabId);
      const testOperator = seedOperator(testOperatorId, testLabId);

      // Mock: Supervisor initially active
      let supervisorActive = true;
      vi.mock('firebase/firestore', () => ({
        onSnapshot: vi.fn((query, callback) => {
          callback({
            docs: supervisorActive
              ? [
                  {
                    id: 'rt_checked_in',
                    data: () => ({ status: 'active', checkedInAt: Timestamp.now() }),
                  },
                ]
              : [],
            empty: !supervisorActive,
          });
          return vi.fn(); // unsubscribe
        }),
      }));

      // Action: Auth + navigate to /runs/new
      await loginWithCustomToken(await generateAuthToken(testOperator));
      navigateTo('/runs/new');
      await waitForElement('[data-testid="form-new-run"]', 5000);

      // Assert: Form initially enabled
      const submitBtn = getElementByTestId('btn-submit-run');
      expect(submitBtn?.getAttribute('disabled')).toBeNull();

      // Simulate: Supervisor logs out (realtime listener fires with empty docs)
      supervisorActive = false;

      // Trigger listener update
      await new Promise((r) => setTimeout(r, 500));

      // Assert: Form immediately disabled after logout
      expect(submitBtn?.getAttribute('disabled')).toBe('true');

      // Assert: Error message appears
      await waitForElement('[data-testid="error-supervisor-logout"]');
      const errorEl = getElementByTestId('error-supervisor-logout');
      expect(errorEl?.textContent).toContain('Supervisor saiu');

      // Assert: Audit logged the logout event
      const auditEntry = await getAuditLogEntry(testLabId, 'supervisor_logged_out', {
        supervisorId: testRt.uid,
      });
      expect(auditEntry.supervisorId).toBeDefined();
    });

    it('should recover when supervisor checks back in (realtime)', async () => {
      // Setup: Supervisor absent, operator trying to create run
      const testRt = seedRtUser('rt_absent', testLabId);
      const testOperator = seedOperator(testOperatorId, testLabId);

      let supervisorActive = false;

      // Mock: Listener that fires with updates
      vi.mock('firebase/firestore', () => ({
        onSnapshot: vi.fn((query, callback) => {
          callback({
            docs: supervisorActive
              ? [
                  {
                    id: testRt.uid,
                    data: () => ({ status: 'active', checkedInAt: Timestamp.now() }),
                  },
                ]
              : [],
            empty: !supervisorActive,
          });
          return vi.fn(); // unsubscribe
        }),
      }));

      // Action: Auth + navigate
      await loginWithCustomToken(await generateAuthToken(testOperator));
      navigateTo('/runs/new');

      // Assert: Initially blocked
      await waitForElement('[data-testid="error-no-supervisor"]');
      let submitBtn = getElementByTestId('btn-submit-run');
      expect(submitBtn?.getAttribute('disabled')).toBe('true');

      // Simulate: Supervisor checks in (realtime update)
      supervisorActive = true;
      await new Promise((r) => setTimeout(r, 500));

      // Assert: Form re-enabled
      submitBtn = getElementByTestId('btn-submit-run');
      expect(submitBtn?.getAttribute('disabled')).toBeNull();

      // Assert: Success message shown
      await waitForElement('[data-testid="toast-supervisor-active"]');
      const toast = getElementByTestId('toast-supervisor-active');
      expect(toast?.textContent).toContain('ativo');

      // Assert: Audit logged the check-in
      const auditEntry = await getAuditLogEntry(testLabId, 'supervisor_checked_in', {
        supervisorId: testRt.uid,
      });
      expect(auditEntry.supervisorId).toBe(testRt.uid);

      // Action: Create run (should succeed now)
      fillInput(document.querySelector('[name="nomeRun"]'), 'Run após check-in');
      clickElement(submitBtn);

      // Mock: Run creation succeeds with supervisor ID
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn((name) => {
          if (name === 'runs_create') {
            return vi.fn().mockResolvedValue({
              data: {
                success: true,
                runId: 'run_with_supervisor_' + Math.random().toString(36).substr(2, 9),
                supervisorId: testRt.uid,
              },
            });
          }
          return vi.fn();
        }),
      }));

      await waitForElement('[data-testid="toast-run-created"]');

      // Assert: Run created with supervisor validation
      const runAuditEntry = await getAuditLogEntry(testLabId, 'run_created', {
        supervisorId: testRt.uid,
      });
      expect(runAuditEntry.supervisorId).toBe(testRt.uid);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function seedOperator(opId: string, labId: string) {
  return {
    uid: opId,
    email: `op_${Math.random().toString(36).substr(2, 6)}@lab.test`,
    labId,
    role: 'OPERATOR',
    nome: 'Operador',
  };
}

function seedRtUser(rtId: string, labId: string) {
  return {
    uid: rtId,
    email: `rt_${Math.random().toString(36).substr(2, 6)}@lab.test`,
    labId,
    role: 'RT',
    nome: 'RT Supervisor',
  };
}

async function generateAuthToken(user: any): Promise<string> {
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

function fillInput(el: Element | null, value: string): void {
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
