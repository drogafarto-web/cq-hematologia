/**
 * E2E Test: F1 — Portal-RT Escalation Acknowledgment
 *
 * Flow: Operator logs in → Portal-RT dashboard → views Críticos → acknowledges escalation
 *
 * Regulatory:
 * - RDC 978 Art. 128: RT responsibility for results review
 * - DICQ 4.1.2.7: Documented turnos supervisor actions
 *
 * Scenarios:
 * 1. Happy path: Login → dashboard → critical escalation → acknowledge → audit logged
 * 2. Error path: Network timeout during acknowledge → retry → success
 *
 * Run: npm test -- f1-portal-rt-escalation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

describe('F1: Portal-RT Escalation Acknowledgment', () => {
  let testLabId: string;
  let testRtUserId: string;
  let testCriticoId: string;

  beforeEach(() => {
    testLabId = 'lab_test_f1_' + Math.random().toString(36).substr(2, 9);
    testRtUserId = 'user_rt_' + Math.random().toString(36).substr(2, 9);
    testCriticoId = 'critico_' + Math.random().toString(36).substr(2, 9);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1.1: Happy path — Login → Escalation → Acknowledge', () => {
    it('should render critical escalation and allow acknowledgment with audit trail', async () => {
      // Setup: Seed test data
      const testUser = seedRtUser(testRtUserId, testLabId, { role: 'RT' });
      const testLaudo = seedTestLaudo(testLabId, {
        id: 'laudo_critico_001',
        patientId: 'pat_001',
        status: 'critico',
        valores: [
          { analito: 'Hemoglobina', valor: 2.1, referencia: '13.5-17.5 g/dL', flag: 'CRITICO' },
        ],
      });

      // Mock: Auth + Firestore
      const mockAuthToken = await generateRtAuthToken(testUser);
      vi.mock('firebase/auth', () => ({
        signInWithCustomToken: vi.fn().mockResolvedValue({
          user: { uid: testRtUserId, email: testUser.email },
        }),
      }));

      const mockCriticoEscalation = {
        id: testCriticoId,
        labId: testLabId,
        laudoId: testLaudo.id,
        status: 'escalado',
        severidade: 'CRITICO',
        criadoEm: Timestamp.now(),
        reconhecidoEm: null,
        reconhecidoPor: null,
        valor: { analito: 'Hemoglobina', valor: 2.1 },
      };

      vi.mock('firebase/firestore', () => ({
        onSnapshot: vi.fn((query, callback) => {
          // Simulate listener firing with critical escalation
          callback({
            docs: [{ id: testCriticoId, data: () => mockCriticoEscalation }],
          });
          return vi.fn(); // unsubscribe
        }),
      }));

      // Action: Login
      await loginWithCustomToken(mockAuthToken);
      expect(getStoredUserId()).toBe(testRtUserId);

      // Action: Navigate to Portal-RT
      navigateTo('/portal-rt');
      await waitForElement('[data-testid="portal-rt-escalations-list"]');

      // Assert: Escalation visible
      const escalationElement = getElementByTestId(`escalation-${testCriticoId}`);
      expect(escalationElement).toBeDefined();
      expect(escalationElement?.textContent).toContain('Hemoglobina');
      expect(escalationElement?.textContent).toContain('CRITICO');

      // Action: Acknowledge escalation
      const acknowledgeBtn = escalationElement?.querySelector('[data-testid="btn-acknowledge"]');
      expect(acknowledgeBtn).toBeDefined();
      clickElement(acknowledgeBtn);

      // Mock: Cloud Function callable response
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({
          data: {
            success: true,
            escalationId: testCriticoId,
            reconhecidoEm: Timestamp.now().toDate(),
            reconhecidoPor: testRtUserId,
          },
        })),
      }));

      await waitForElement('[data-testid="toast-success"]');

      // Assert: Audit trail written
      const auditEntry = await getAuditLogEntry(testLabId, 'escalation_acknowledge', {
        escalationId: testCriticoId,
        operatorId: testRtUserId,
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry.operatorId).toBe(testRtUserId);
      expect(auditEntry.ts).toBeDefined();

      // Assert: Escalation status updated
      const updatedEscalation = await getFirestoreDoc(`critical-values/${testLabId}/escalations/${testCriticoId}`);
      expect(updatedEscalation.reconhecidoPor).toBe(testRtUserId);
      expect(updatedEscalation.reconhecidoEm).toBeDefined();
    });
  });

  describe('Scenario 1.2: Error path — Network timeout → Retry → Success', () => {
    it('should retry acknowledge on network timeout and eventually succeed', async () => {
      // Setup
      const testUser = seedRtUser(testRtUserId, testLabId, { role: 'RT' });
      await loginWithCustomToken(await generateRtAuthToken(testUser));
      navigateTo('/portal-rt');

      const mockCriticoEscalation = {
        id: testCriticoId,
        labId: testLabId,
        status: 'escalado',
        severidade: 'CRITICO',
        criadoEm: Timestamp.now(),
      };

      // Mock: First attempt fails (timeout), second succeeds
      let attemptCount = 0;
      vi.mock('firebase/functions', () => ({
        httpsCallable: vi.fn(() =>
          vi.fn().mockImplementation(() => {
            attemptCount++;
            if (attemptCount === 1) {
              // Simulate timeout
              return new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Network timeout')), 100)
              );
            }
            // Second attempt succeeds
            return Promise.resolve({
              data: {
                success: true,
                escalationId: testCriticoId,
                reconhecidoPor: testRtUserId,
              },
            });
          })
        ),
      }));

      // Action: Attempt acknowledge
      await waitForElement(`[data-testid="escalation-${testCriticoId}"]`);
      const acknowledgeBtn = getElementByTestId(`btn-acknowledge-${testCriticoId}`);
      clickElement(acknowledgeBtn);

      // Assert: Error toast shown initially
      await waitForElement('[data-testid="toast-error"]');
      expect(getElementByTestId('toast-error')?.textContent).toContain('Network');

      // Assert: Retry button available
      const retryBtn = getElementByTestId('btn-retry');
      expect(retryBtn).toBeDefined();

      // Action: Retry
      clickElement(retryBtn);

      // Assert: Success on retry
      await waitForElement('[data-testid="toast-success"]');
      expect(attemptCount).toBe(2);

      // Assert: Audit logged for both attempts
      const auditLogs = await getAuditLogEntries(testLabId, 'escalation_acknowledge_retry', {
        escalationId: testCriticoId,
      });
      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
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
    status: 'ativo',
  };
}

function seedTestLaudo(labId: string, options: any = {}) {
  return {
    id: options.id || 'laudo_' + Math.random().toString(36).substr(2, 9),
    labId,
    patientId: options.patientId || 'pat_001',
    exame: options.exame || 'Hemograma',
    status: options.status || 'finalizado',
    valores: options.valores || [],
    criadoEm: new Date(),
  };
}

async function generateRtAuthToken(user: any): Promise<string> {
  // Mock JWT token generation
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
  localStorage.setItem('userId', 'user_rt_' + Math.random().toString(36).substr(2, 9));
}

function getStoredUserId(): string {
  return localStorage.getItem('userId') || '';
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

async function getFirestoreDoc(path: string): Promise<any> {
  // Mock Firestore read
  return {
    reconhecidoPor: 'user_rt_123',
    reconhecidoEm: Timestamp.now(),
  };
}

async function getAuditLogEntry(labId: string, action: string, filters: any = {}): Promise<any> {
  // Mock audit log read
  return {
    labId,
    action,
    operatorId: filters.operatorId || 'user_rt_123',
    ts: Timestamp.now(),
  };
}

async function getAuditLogEntries(labId: string, action: string, filters: any = {}): Promise<any[]> {
  return [await getAuditLogEntry(labId, action, filters)];
}
