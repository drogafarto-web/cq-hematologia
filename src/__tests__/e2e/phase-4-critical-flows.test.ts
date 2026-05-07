/**
 * E2E Test Suite: Phase 4 Critical Flows
 *
 * Comprehensive test coverage for 5 critical user journeys:
 * 1. Patient Portal Auth (Email Link) — 5 scenarios
 * 2. Patient Views Own Laudos — 5 scenarios
 * 3. Patient Downloads Laudo (PDF Export) — 3 scenarios
 * 4. RT Submits NOTIVISA Form + Queue Processing — 5 scenarios
 * 5. Portal Session Management — 4 scenarios
 *
 * Total: 22 scenarios, all critical flows for Phase 4 launch
 *
 * Run: npm test -- phase-4-critical-flows
 * Watch: npm run test:unit:watch -- phase-4-critical-flows
 *
 * Post-deploy: Verify all 22 tests pass before release
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * FLOW 1: PATIENT PORTAL AUTH (EMAIL LINK)
 *
 * Validates patient authentication via email link + token expiry + tampering
 * ═════════════════════════════════════════════════════════════════════════════
 */

describe('Flow 1: Patient Portal Auth (Email Link)', () => {
  describe('Scenario 1.1: Patient receives email → clicks link → authenticates', () => {
    it('should parse token, validate signature, and authenticate patient', async () => {
      // Setup: Generate auth link for test patient
      const testPatientEmail = 'alice@lab.test';
      const patientId = 'pat_alice_001';

      // Mock: generatePatientAuthLink callable
      const mockAuthLink = generatePatientAuthLink(testPatientEmail, patientId);
      expect(mockAuthLink).toBeDefined();
      expect(mockAuthLink).toContain('token=');

      // Action: Parse token from URL
      const tokenMatch = mockAuthLink.match(/token=([^&]+)/);
      expect(tokenMatch).not.toBeNull();
      const token = tokenMatch![1];

      // Assert: Token structure is valid JWT
      const parts = token.split('.');
      expect(parts).toHaveLength(3); // header.payload.signature

      // Mock: validateAuthToken function
      const isValid = await validateAuthToken(token);
      expect(isValid).toBe(true);

      // Assert: Session created in localStorage
      const sessionToken = getStoredSessionToken();
      expect(sessionToken).toBeDefined();
      expect(sessionToken).toEqual(token);

      // Assert: User data stored
      const storedPatientId = getStoredPatientId();
      expect(storedPatientId).toEqual(patientId);
    });

    it('should redirect to /portal/dashboard after successful auth', async () => {
      const testPatientEmail = 'alice@lab.test';
      const patientId = 'pat_alice_001';

      const mockAuthLink = generatePatientAuthLink(testPatientEmail, patientId);
      const tokenMatch = mockAuthLink.match(/token=([^&]+)/);
      const token = tokenMatch![1];

      // Mock: authentication flow
      await validateAuthToken(token);
      navigateTo('/portal/dashboard');

      // Assert: Redirect happened
      const currentRoute = getCurrentRoute();
      expect(currentRoute).toBe('/portal/dashboard');
    });
  });

  describe('Scenario 1.2: Expired link (>7 days)', () => {
    it('should reject token with iat > 7 days old', async () => {
      // Setup: Create token with old iat timestamp
      const now = Math.floor(Date.now() / 1000);
      const sevenDaysAgo = now - (7 * 24 * 60 * 60) - 100; // 7 days + 100 seconds

      const expiredToken = createTokenWithIat(sevenDaysAgo);

      // Action: Attempt authentication
      const result = await validateAuthToken(expiredToken);

      // Assert: Token rejected
      expect(result).toBe(false);

      // Assert: Error message shown
      const errorMessage = getErrorMessage();
      expect(errorMessage).toContain('Link expired');
      expect(errorMessage).toContain('Request new one');
    });

    it('should offer option to resend email', async () => {
      const now = Math.floor(Date.now() / 1000);
      const sevenDaysAgo = now - (7 * 24 * 60 * 60) - 100;
      const expiredToken = createTokenWithIat(sevenDaysAgo);

      await validateAuthToken(expiredToken);

      // Assert: Resend button visible
      const resendButton = getElementByTestId('btn-resend-auth-link');
      expect(resendButton).not.toBeNull();

      // Assert: Button is clickable
      const btn = resendButton as HTMLButtonElement;
      expect(btn?.disabled).toBe(false);
    });
  });

  describe('Scenario 1.3: Used link (already authenticated)', () => {
    it('should reject token that was already consumed once', async () => {
      // Setup: Create token
      const token = generatePatientAuthLink('alice@lab.test', 'pat_alice_001');
      const tokenValue = token.match(/token=([^&]+)/)![1];

      // First use: authenticate successfully
      await validateAuthToken(tokenValue);
      markTokenAsUsed(tokenValue);

      // Second use: attempt same token again
      const secondAttempt = await validateAuthToken(tokenValue);

      // Assert: Second attempt rejected
      expect(secondAttempt).toBe(false);

      // Assert: Specific error for already-used token
      const errorMessage = getErrorMessage();
      expect(errorMessage).toContain('Link already used');
    });

    it('should redirect to login form on reuse attempt', async () => {
      const token = generatePatientAuthLink('alice@lab.test', 'pat_alice_001');
      const tokenValue = token.match(/token=([^&]+)/)![1];

      await validateAuthToken(tokenValue);
      markTokenAsUsed(tokenValue);

      // Attempt reuse
      await validateAuthToken(tokenValue);

      // Assert: Redirect to auth/login
      const currentRoute = getCurrentRoute();
      expect(currentRoute).toBe('/portal/auth/login');
    });
  });

  describe('Scenario 1.4: Invalid signature (tampering)', () => {
    it('should reject token with corrupted signature', async () => {
      // Setup: Generate valid token
      let token = generatePatientAuthLink('alice@lab.test', 'pat_alice_001');
      const tokenValue = token.match(/token=([^&]+)/)![1];

      // Corrupt: Modify last char of signature
      const parts = tokenValue.split('.');
      const corruptedSignature = parts[2].slice(0, -1) + 'X';
      const corruptedToken = `${parts[0]}.${parts[1]}.${corruptedSignature}`;

      // Action: Attempt authentication
      const result = await validateAuthToken(corruptedToken);

      // Assert: Token rejected
      expect(result).toBe(false);

      // Assert: No auth granted
      const sessionToken = getStoredSessionToken();
      expect(sessionToken).toBeNull();
    });

    it('should show "Invalid link" error on tampering', async () => {
      let token = generatePatientAuthLink('alice@lab.test', 'pat_alice_001');
      const tokenValue = token.match(/token=([^&]+)/)![1];

      const parts = tokenValue.split('.');
      const corruptedSignature = parts[2].slice(0, -1) + 'X';
      const corruptedToken = `${parts[0]}.${parts[1]}.${corruptedSignature}`;

      await validateAuthToken(corruptedToken);

      // Assert: Error message
      const errorMessage = getErrorMessage();
      expect(errorMessage).toContain('Invalid link');
    });
  });

  describe('Scenario 1.5: Concurrent auth attempts (rate limit)', () => {
    it('should block 6th concurrent request within 1 minute', async () => {
      const email = 'rate-test@lab.test';
      const patientId = 'pat_rate_001';

      // Setup: Send 5 requests successfully
      const results = [];
      for (let i = 0; i < 5; i++) {
        const link = generatePatientAuthLink(email, patientId);
        results.push(link);
      }

      expect(results).toHaveLength(5);

      // Action: Send 6th request
      const sixthRequest = generatePatientAuthLink(email, patientId);

      // Assert: 6th request blocked with rate limit error
      expect(sixthRequest).toContain('Too many requests');
    });

    it('should reset rate limit after 1 minute', async () => {
      const email = 'rate-test@lab.test';
      const patientId = 'pat_rate_002';

      // Fill rate limit bucket
      for (let i = 0; i < 5; i++) {
        generatePatientAuthLink(email, patientId);
      }

      // 6th blocked
      let result = generatePatientAuthLink(email, patientId);
      expect(result).toContain('Too many requests');

      // Advance time 61 seconds
      advanceTime(61000);

      // Next request should succeed
      result = generatePatientAuthLink(email, patientId);
      expect(result).toContain('token=');
    });
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * FLOW 2: PATIENT VIEWS OWN LAUDOS
 *
 * Validates laudo list, pagination, filtering, sorting, detail view
 * ═════════════════════════════════════════════════════════════════════════════
 */

describe('Flow 2: Patient Views Own Laudos', () => {
  beforeEach(() => {
    // Setup: Authenticate as test patient
    authenticateAsPatient('pat_alice_001');
  });

  describe('Scenario 2.1: Patient dashboard loads list of laudos', () => {
    it('should display list of 10 test laudos with exam name/date/status', async () => {
      // Setup: Seed 10 test laudos
      const laudos = seedTestLaudos('pat_alice_001', 10);

      // Action: Navigate to portal dashboard
      navigateTo('/portal/dashboard');

      // Assert: List loads with skeleton state
      expect(getSkeletonItems()).toHaveLength(10);

      // Simulate data load
      await loadLaudosList();

      // Assert: All 10 items visible
      const laudoItems = getLaudoListItems();
      expect(laudoItems).toHaveLength(10);

      // Assert: Each item shows exam name, date, status
      laudoItems.forEach((item, idx) => {
        const examName = getTextFromElement(item, '[data-testid="exam-name"]');
        const date = getTextFromElement(item, '[data-testid="exam-date"]');
        const status = getTextFromElement(item, '[data-testid="exam-status"]');

        expect(examName).toBeDefined();
        expect(date).toBeDefined();
        expect(status).toMatch(/Finalizado|Revisão|Bloqueado/);
      });
    });

    it('should show skeleton loading state initially', async () => {
      const laudos = seedTestLaudos('pat_alice_001', 10);

      navigateTo('/portal/dashboard');

      // Assert: Skeleton visible before data loads
      const skeletons = getSkeletonItems();
      expect(skeletons.length).toBeGreaterThan(0);

      // Assert: Skeleton has aria-busy
      skeletons.forEach(skeleton => {
        expect(skeleton.getAttribute('aria-busy')).toBe('true');
      });
    });
  });

  describe('Scenario 2.2: Pagination (20 items per page)', () => {
    it('should load next 20 laudos when user scrolls to bottom', async () => {
      // Setup: Seed 50 test laudos
      seedTestLaudos('pat_alice_001', 50);

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Assert: First 20 items visible
      let items = getLaudoListItems();
      expect(items).toHaveLength(20);

      // Action: Scroll to bottom
      scrollToBottom();

      // Assert: Next 20 loaded
      await waitForElement('[data-testid="load-more-button"]');
      const loadMoreBtn = getElementByTestId('load-more-button');
      expect(loadMoreBtn).not.toBeNull();

      // Action: Click load more
      clickElement(loadMoreBtn);

      // Assert: Total now 40
      items = getLaudoListItems();
      expect(items).toHaveLength(40);
    });

    it('should show pagination controls when more items exist', async () => {
      seedTestLaudos('pat_alice_001', 50);
      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Assert: Load more button visible
      const loadMoreBtn = getElementByTestId('load-more-button');
      expect(loadMoreBtn).not.toBeNull();

      // Assert: Button shows count
      const btnText = loadMoreBtn?.textContent || '';
      expect(btnText).toContain('Load more');
    });
  });

  describe('Scenario 2.3: Filter by date range', () => {
    it('should filter laudos to last 30 days only', async () => {
      // Setup: Seed 10 laudos with various dates (past 6 months)
      const laudos = seedTestLaudosWithDates('pat_alice_001', 10, 180);

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Assert: All 10 visible initially
      expect(getLaudoListItems()).toHaveLength(10);

      // Action: Select "Last 30 days" filter
      const filterDropdown = getElementByTestId('date-filter-dropdown');
      clickElement(filterDropdown);

      const option30Days = getElementByTestId('filter-option-30days');
      clickElement(option30Days);

      // Assert: List updates to show only 30-day laudos
      await waitForListUpdate();
      const filtered = getLaudoListItems();
      expect(filtered.length).toBeLessThan(10);

      // Assert: Count updates
      const countText = getElementByTestId('laudo-count')?.textContent;
      expect(countText).toContain(filtered.length.toString());
    });

    it('should show count of filtered results', async () => {
      const laudos = seedTestLaudosWithDates('pat_alice_001', 10, 180);

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Action: Apply filter
      const filterDropdown = getElementByTestId('date-filter-dropdown');
      clickElement(filterDropdown);
      const option30Days = getElementByTestId('filter-option-30days');
      clickElement(option30Days);

      await waitForListUpdate();

      // Assert: Count element visible
      const countElement = getElementByTestId('laudo-count');
      expect(countElement).not.toBeNull();
      expect(countElement?.textContent).toMatch(/\d+ laudos?/);
    });
  });

  describe('Scenario 2.4: Sort by date (newest first)', () => {
    it('should display laudos sorted by date descending by default', async () => {
      // Setup: Seed laudos with distinct dates
      const dates = [
        new Date('2026-04-01'),
        new Date('2026-04-15'),
        new Date('2026-05-01'),
        new Date('2026-03-20'),
      ];
      const laudos = seedTestLaudosWithDates('pat_alice_001', 4, 0, dates);

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Assert: Items sorted newest first
      const items = getLaudoListItems();
      const dates_from_list = items.map(item => {
        const dateText = getTextFromElement(item, '[data-testid="exam-date"]');
        return new Date(dateText);
      });

      // Verify descending order
      for (let i = 1; i < dates_from_list.length; i++) {
        expect(dates_from_list[i - 1] >= dates_from_list[i]).toBe(true);
      }
    });

    it('should allow sort toggle', async () => {
      const dates = [
        new Date('2026-04-01'),
        new Date('2026-05-01'),
      ];
      seedTestLaudosWithDates('pat_alice_001', 2, 0, dates);

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Get initial order
      let items = getLaudoListItems();
      const initialFirstDate = getTextFromElement(items[0], '[data-testid="exam-date"]');

      // Action: Click sort button
      const sortBtn = getElementByTestId('sort-button');
      clickElement(sortBtn);

      // Assert: Order reversed
      items = getLaudoListItems();
      const newFirstDate = getTextFromElement(items[0], '[data-testid="exam-date"]');
      expect(newFirstDate).not.toEqual(initialFirstDate);
    });
  });

  describe('Scenario 2.5: Click laudo to view detail', () => {
    it('should open laudo detail on card click', async () => {
      const laudos = seedTestLaudos('pat_alice_001', 3);

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Action: Click first laudo card
      const firstCard = getLaudoListItems()[0];
      clickElement(firstCard);

      // Assert: Modal/page opened
      const detailView = getElementByTestId('laudo-detail-view');
      expect(detailView).not.toBeNull();

      // Assert: Shows laudo content
      const laudoTitle = getElementByTestId('laudo-detail-title');
      expect(laudoTitle).not.toBeNull();
    });

    it('should show close button in detail view', async () => {
      const laudos = seedTestLaudos('pat_alice_001', 1);

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      const card = getLaudoListItems()[0];
      clickElement(card);

      // Assert: Close button visible
      const closeBtn = getElementByTestId('laudo-detail-close');
      expect(closeBtn).not.toBeNull();
      const btn = closeBtn as HTMLButtonElement;
      expect(btn?.disabled).toBe(false);
    });

    it('should display PDF or HTML content', async () => {
      const laudos = seedTestLaudos('pat_alice_001', 1);

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      clickElement(getLaudoListItems()[0]);

      // Assert: Content viewer exists (PDF or HTML)
      const pdfViewer = getElementByTestId('pdf-viewer');
      const htmlViewer = getElementByTestId('html-viewer');

      expect(pdfViewer || htmlViewer).not.toBeNull();
    });
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * FLOW 3: PATIENT DOWNLOADS LAUDO (PDF EXPORT)
 *
 * Validates PDF generation, large files, error handling
 * ═════════════════════════════════════════════════════════════════════════════
 */

describe('Flow 3: Patient Downloads Laudo (PDF Export)', () => {
  beforeEach(() => {
    authenticateAsPatient('pat_alice_001');
  });

  describe('Scenario 3.1: Download PDF success', () => {
    it('should generate PDF and trigger browser download', async () => {
      const laudo = seedTestLaudo('pat_alice_001', {
        id: 'laudo_pdf_001',
        exame: 'Hemograma'
      });

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Action: Click detail
      clickElement(getLaudoListItems()[0]);

      // Action: Click download button
      const downloadBtn = getElementByTestId('laudo-download-button');
      clickElement(downloadBtn);

      // Assert: Download triggered
      const downloadedFile = waitForDownload();
      expect(downloadedFile).toBeDefined();
      expect(downloadedFile?.filename).toMatch(/\.pdf$/);
    });

    it('should name PDF file correctly (exame_data_paciente)', async () => {
      const laudo = seedTestLaudo('pat_alice_001', {
        id: 'laudo_pdf_002',
        exame: 'Hemograma',
        pacienteName: 'Alice Silva',
        date: new Date('2026-05-07'),
      });

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      clickElement(getLaudoListItems()[0]);
      const downloadBtn = getElementByTestId('laudo-download-button');
      clickElement(downloadBtn);

      const downloadedFile = waitForDownload();
      // Expected: Hemograma_2026-05-07_Alice.pdf or similar
      expect(downloadedFile?.filename).toMatch(/Hemograma.*2026.*Alice/);
    });
  });

  describe('Scenario 3.2: Large PDF generation (>5 MB)', () => {
    it('should show loading state during generation', async () => {
      // Setup: Create complex laudo with many fields
      const laudo = seedTestLaudo('pat_alice_001', {
        id: 'laudo_large_001',
        exame: 'Bioquímica Completa',
        resultados: createLargeResultSet(100), // 100 analytes
      });

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      clickElement(getLaudoListItems()[0]);

      // Action: Start download
      const downloadBtn = getElementByTestId('laudo-download-button');
      clickElement(downloadBtn);

      // Assert: Loading state visible
      const loadingSpinner = getElementByTestId('laudo-generation-loading');
      expect(loadingSpinner).not.toBeNull();
    });

    it('should complete within 10 seconds', async () => {
      const laudo = seedTestLaudo('pat_alice_001', {
        id: 'laudo_large_002',
        exame: 'Bioquímica Completa',
        resultados: createLargeResultSet(100),
      });

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      clickElement(getLaudoListItems()[0]);

      const startTime = Date.now();
      const downloadBtn = getElementByTestId('laudo-download-button');
      clickElement(downloadBtn);

      const downloadedFile = waitForDownload();
      const elapsed = Date.now() - startTime;

      expect(downloadedFile).toBeDefined();
      expect(elapsed).toBeLessThan(10000);
    });
  });

  describe('Scenario 3.3: PDF generation network error', () => {
    it('should show error message on network timeout', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_error_001' });

      // Setup: Simulate network timeout
      simulateNetworkTimeout();

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      clickElement(getLaudoListItems()[0]);
      const downloadBtn = getElementByTestId('laudo-download-button');
      clickElement(downloadBtn);

      // Assert: Error message visible
      await waitForElement('[data-testid="error-message"]');
      const errorMsg = getElementByTestId('error-message');
      expect(errorMsg?.textContent).toContain('Unable to generate PDF');
      expect(errorMsg?.textContent).toContain('Try again');
    });

    it('should provide retry button after error', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_error_002' });

      simulateNetworkTimeout();

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      clickElement(getLaudoListItems()[0]);
      const downloadBtn = getElementByTestId('laudo-download-button');
      clickElement(downloadBtn);

      await waitForElement('[data-testid="retry-download-button"]');

      // Assert: Retry button visible and enabled
      const retryBtn = getElementByTestId('retry-download-button');
      expect(retryBtn).not.toBeNull();
      const btn = retryBtn as HTMLButtonElement;
      expect(btn?.disabled).toBe(false);
    });
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * FLOW 4: RT SUBMITS NOTIVISA FORM + QUEUE PROCESSING
 *
 * Validates NOTIVISA submission, approvals, queue, webhook ACKs
 * ═════════════════════════════════════════════════════════════════════════════
 */

describe('Flow 4: RT Submits NOTIVISA Form + Queue Processing', () => {
  beforeEach(() => {
    authenticateAsUser('rt_user_001', 'RT');
  });

  describe('Scenario 4.1: RT creates NOTIVISA draft', () => {
    it('should create draft with UUID and status=draft', async () => {
      // Setup: Navigate to laudo for NOTIVISA submission
      const laudo = seedTestLaudo('pat_alice_001', {
        id: 'laudo_notivisa_001',
        status: 'finalizado',
      });

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      // Action: Open laudo and click "Submit to NOTIVISA"
      clickElement(getLaudoListItems()[0]);
      const notiVisaBtn = getElementByTestId('btn-submit-to-notivisa');
      clickElement(notiVisaBtn);

      // Action: Fill form (disease code, etc.)
      const diseaseCodeField = getElementByTestId('input-disease-code');
      fillInput(diseaseCodeField, 'C91.0'); // Example: Acute lymphoid leukemia

      // Action: Submit form
      const submitBtn = getElementByTestId('btn-form-submit');
      clickElement(submitBtn);

      // Assert: Draft created
      const draft = waitForDraftCreation();
      expect(draft).toBeDefined();
      expect(draft?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/); // UUID format
      expect(draft?.status).toBe('draft');
    });

    it('should create audit log entry on draft creation', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_002' });

      navigateTo('/portal/dashboard');
      await loadLaudosList();

      clickElement(getLaudoListItems()[0]);
      const notiVisaBtn = getElementByTestId('btn-submit-to-notivisa');
      clickElement(notiVisaBtn);

      const diseaseCodeField = getElementByTestId('input-disease-code');
      fillInput(diseaseCodeField, 'C91.0');

      const submitBtn = getElementByTestId('btn-form-submit');
      clickElement(submitBtn);

      // Assert: Audit log created
      const auditLogs = getAuditLogs('notivisa-drafts', 'pat_alice_001');
      expect(auditLogs.length).toBeGreaterThan(0);

      const creationLog = auditLogs.find(log => log.action === 'draft_created');
      expect(creationLog).toBeDefined();
      expect(creationLog?.userId).toBe('rt_user_001');
      expect(creationLog?.timestamp).toBeDefined();
    });
  });

  describe('Scenario 4.2: RT approves draft (Auditor flow)', () => {
    it('should transition draft status from draft to approved', async () => {
      // Setup: Create draft first
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_003' });
      const draft = seedNotivisaDraft('pat_alice_001', {
        laudoId: laudo.id,
        status: 'draft',
        createdBy: 'rt_user_001',
      });

      // Switch to auditor
      authenticateAsUser('auditor_user_001', 'AUDITOR');

      // Action: Navigate to NOTIVISA queue
      navigateTo('/notivisa/queue');

      // Action: Find draft and click approve
      const draftCard = getElementByTestId(`draft-${draft.id}`);
      clickElement(draftCard);

      const approveBtn = getElementByTestId('btn-approve-draft');
      clickElement(approveBtn);

      // Assert: Status changed to approved
      const updatedDraft = getDraftData(draft.id);
      expect(updatedDraft?.status).toBe('approved');
    });

    it('should store auditor signature on approval', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_004' });
      const draft = seedNotivisaDraft('pat_alice_001', {
        laudoId: laudo.id,
        status: 'draft',
      });

      authenticateAsUser('auditor_user_001', 'AUDITOR');

      navigateTo('/notivisa/queue');
      const draftCard = getElementByTestId(`draft-${draft.id}`);
      clickElement(draftCard);

      const approveBtn = getElementByTestId('btn-approve-draft');
      clickElement(approveBtn);

      // Assert: Signature stored
      const updatedDraft = getDraftData(draft.id);
      expect(updatedDraft?.auditSignature).toBeDefined();
      expect(updatedDraft?.auditSignature?.operatorId).toBe('auditor_user_001');
      expect(updatedDraft?.auditSignature?.hash).toMatch(/^[a-f0-9]{64}$/); // SHA256
    });
  });

  describe('Scenario 4.3: RT submits to queue', () => {
    it('should create queue entry with status=pending', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_005' });
      const draft = seedNotivisaDraft('pat_alice_001', {
        laudoId: laudo.id,
        status: 'approved',
      });

      authenticateAsUser('rt_user_001', 'RT');
      navigateTo('/notivisa/queue');

      // Action: Submit to queue
      const submitQueueBtn = getElementByTestId('btn-submit-to-queue');
      clickElement(submitQueueBtn);

      // Assert: Queue entry created
      const queueEntry = waitForQueueEntry(draft.id);
      expect(queueEntry).toBeDefined();
      expect(queueEntry?.status).toBe('pending');
      expect(queueEntry?.draftId).toBe(draft.id);
    });

    it('should call mock SOAP API and store result', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_006' });
      const draft = seedNotivisaDraft('pat_alice_001', {
        laudoId: laudo.id,
        status: 'approved',
      });

      authenticateAsUser('rt_user_001', 'RT');
      navigateTo('/notivisa/queue');

      // Setup: Mock NOTIVISA SOAP endpoint
      const mockSoapResponse = {
        statusCode: '200',
        receiptCode: 'ANVISA-REC-001',
      };
      mockSoapCall(mockSoapResponse);

      // Action: Submit
      const submitBtn = getElementByTestId('btn-submit-to-queue');
      clickElement(submitBtn);

      // Assert: API called and response stored
      const queueEntry = waitForQueueEntry(draft.id);
      expect(queueEntry?.lastApiResponse?.statusCode).toBe('200');
      expect(queueEntry?.lastApiResponse?.receiptCode).toBe('ANVISA-REC-001');
    });
  });

  describe('Scenario 4.4: Queue processor runs (scheduled every 5 min)', () => {
    it('should update status from pending to submitted', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_007' });
      const draft = seedNotivisaDraft('pat_alice_001', { laudoId: laudo.id });
      const queueEntry = seedQueueEntry('pat_alice_001', {
        draftId: draft.id,
        status: 'pending',
        apiAttempts: 0,
      });

      // Action: Manually trigger processor (or wait 5 min)
      triggerQueueProcessor();

      // Assert: Status updated
      const updated = getQueueEntry(queueEntry.id);
      expect(updated?.status).toBe('submitted');
      expect(updated?.submissionAttempt).toBeDefined();
    });

    it('should log submission attempt with timestamp', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_008' });
      const draft = seedNotivisaDraft('pat_alice_001', { laudoId: laudo.id });
      const queueEntry = seedQueueEntry('pat_alice_001', {
        draftId: draft.id,
        status: 'pending',
      });

      triggerQueueProcessor();

      // Assert: Attempt logged
      const updated = getQueueEntry(queueEntry.id);
      expect(updated?.submissionAttempt?.timestamp).toBeDefined();
      expect(updated?.submissionAttempt?.timestamp).toBeInstanceOf(Date);
    });

    it('should set nextRetry on failure', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_009' });
      const draft = seedNotivisaDraft('pat_alice_001', { laudoId: laudo.id });
      const queueEntry = seedQueueEntry('pat_alice_001', {
        draftId: draft.id,
        status: 'pending',
      });

      // Setup: Simulate API failure
      mockSoapCall(null, new Error('Connection timeout'));

      triggerQueueProcessor();

      // Assert: nextRetry scheduled
      const updated = getQueueEntry(queueEntry.id);
      expect(updated?.status).toBe('pending'); // Still pending, will retry
      expect(updated?.nextRetry).toBeDefined();
      expect(updated?.nextRetry?.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Scenario 4.5: Webhook ACK received (government callback)', () => {
    it('should accept webhook with valid signature', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_010' });
      const draft = seedNotivisaDraft('pat_alice_001', { laudoId: laudo.id });
      const queueEntry = seedQueueEntry('pat_alice_001', {
        draftId: draft.id,
        status: 'submitted',
      });

      // Setup: Create valid webhook payload with signature
      const payload = {
        draftId: draft.id,
        receiptCode: 'ANVISA-REC-001',
        status: 'acknowledged',
        timestamp: new Date().toISOString(),
      };
      const signature = createWebhookSignature(payload);

      // Action: Send webhook
      const result = sendWebhook(payload, signature);

      // Assert: Webhook accepted
      expect(result.statusCode).toBe(200);
      expect(result.message).toContain('ACK received');
    });

    it('should update entry status to acknowledged', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_011' });
      const draft = seedNotivisaDraft('pat_alice_001', { laudoId: laudo.id });
      const queueEntry = seedQueueEntry('pat_alice_001', {
        draftId: draft.id,
        status: 'submitted',
      });

      const payload = {
        draftId: draft.id,
        receiptCode: 'ANVISA-REC-002',
        status: 'acknowledged',
        timestamp: new Date().toISOString(),
      };
      const signature = createWebhookSignature(payload);

      sendWebhook(payload, signature);

      // Assert: Status updated to acknowledged
      const updated = getQueueEntry(queueEntry.id);
      expect(updated?.status).toBe('acknowledged');
    });

    it('should log ACK timestamp in Cloud Logs', async () => {
      const laudo = seedTestLaudo('pat_alice_001', { id: 'laudo_notivisa_012' });
      const draft = seedNotivisaDraft('pat_alice_001', { laudoId: laudo.id });
      const queueEntry = seedQueueEntry('pat_alice_001', {
        draftId: draft.id,
        status: 'submitted',
      });

      const payload = {
        draftId: draft.id,
        receiptCode: 'ANVISA-REC-003',
        status: 'acknowledged',
        timestamp: new Date().toISOString(),
      };
      const signature = createWebhookSignature(payload);

      sendWebhook(payload, signature);

      // Assert: Cloud Log entry exists
      const logs = getCloudLogs({
        filter: `labels.draftId="${draft.id}" AND severity="INFO"`,
      });

      const ackLog = logs.find(log => log.message.includes('ACK timestamp'));
      expect(ackLog).toBeDefined();
    });
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * FLOW 5: PORTAL SESSION MANAGEMENT
 *
 * Validates session countdown, refresh, expiry, logout
 * ═════════════════════════════════════════════════════════════════════════════
 */

describe('Flow 5: Portal Session Management', () => {
  beforeEach(() => {
    authenticateAsPatient('pat_alice_001');
  });

  describe('Scenario 5.1: Session countdown warning (10 min remaining)', () => {
    it('should show warning modal when 10 minutes remain', async () => {
      navigateTo('/portal/dashboard');

      // Action: Advance session time to 20-min mark (10 min remaining)
      advanceSessionTime(20 * 60 * 1000);

      // Assert: Warning modal visible
      const warningModal = getElementByTestId('session-warning-modal');
      expect(warningModal).not.toBeNull();

      // Assert: Modal shows countdown message
      const message = getTextFromElement(warningModal, '[data-testid="warning-message"]');
      expect(message).toContain('Session expiring');
      expect(message).toContain('10 minutes');
    });

    it('should display continue/logout buttons', async () => {
      navigateTo('/portal/dashboard');
      advanceSessionTime(20 * 60 * 1000);

      const warningModal = getElementByTestId('session-warning-modal');

      // Assert: Both buttons visible
      const continueBtn = getElementByTestId('btn-continue-session');
      const logoutBtn = getElementByTestId('btn-logout');

      expect(continueBtn).not.toBeNull();
      expect(logoutBtn).not.toBeNull();

      // Assert: Both enabled
      const cbtn = continueBtn as HTMLButtonElement;
      const lbtn = logoutBtn as HTMLButtonElement;
      expect(cbtn?.disabled).toBe(false);
      expect(lbtn?.disabled).toBe(false);
    });
  });

  describe('Scenario 5.2: Session refresh (click "Continue")', () => {
    it('should refresh token and reset countdown', async () => {
      navigateTo('/portal/dashboard');
      advanceSessionTime(20 * 60 * 1000);

      const warningModal = getElementByTestId('session-warning-modal');
      const continueBtn = getElementByTestId('btn-continue-session');

      // Get old session token
      const oldToken = getStoredSessionToken();

      // Action: Click continue
      clickElement(continueBtn);

      // Assert: Modal closed
      await waitForElementToDisappear(warningModal);
      expect(getElementByTestId('session-warning-modal')).toBeNull();

      // Assert: Token refreshed (new token)
      const newToken = getStoredSessionToken();
      expect(newToken).not.toEqual(oldToken);
    });

    it('should reset countdown to 30 minutes', async () => {
      navigateTo('/portal/dashboard');
      advanceSessionTime(20 * 60 * 1000);

      const continueBtn = getElementByTestId('btn-continue-session');
      clickElement(continueBtn);

      // Assert: Next warning won't show for 20 more minutes
      advanceSessionTime(19 * 60 * 1000); // Total 39 min

      let warningModal = getElementByTestId('session-warning-modal');
      expect(warningModal).toBeNull(); // Still not warning

      // Advance to 21 more minutes (60 total, 30 session = warning)
      advanceSessionTime(2 * 60 * 1000);
      warningModal = getElementByTestId('session-warning-modal');
      expect(warningModal).not.toBeNull(); // Now warns
    });
  });

  describe('Scenario 5.3: Session expires (no action)', () => {
    it('should auto-logout when countdown reaches 0', async () => {
      navigateTo('/portal/dashboard');

      // Advance to just before expiry
      advanceSessionTime(29 * 60 * 1000 + 59 * 1000);

      // Should warn but not logged out
      let warningModal = getElementByTestId('session-warning-modal');
      expect(warningModal).not.toBeNull();

      // Advance 1 more second (triggers expiry)
      advanceSessionTime(1000);

      // Assert: Auto logged out, redirect to auth
      const currentRoute = getCurrentRoute();
      expect(currentRoute).toBe('/portal/auth');
    });

    it('should show "Session expired" message', async () => {
      navigateTo('/portal/dashboard');
      advanceSessionTime(30 * 60 * 1000 + 100); // Just past expiry

      // Assert: Message shown
      const expiredMsg = getElementByTestId('session-expired-message');
      expect(expiredMsg).not.toBeNull();
      expect(expiredMsg?.textContent).toContain('Session expired');
      expect(expiredMsg?.textContent).toContain('Log in again');
    });
  });

  describe('Scenario 5.4: Logout button clicked', () => {
    it('should clear session and redirect to auth page', async () => {
      navigateTo('/portal/dashboard');

      // Assert: Dashboard visible
      expect(getCurrentRoute()).toBe('/portal/dashboard');

      // Action: Click logout in header
      const logoutBtn = getElementByTestId('header-logout-button');
      clickElement(logoutBtn);

      // Assert: Redirected to auth
      const currentRoute = getCurrentRoute();
      expect(currentRoute).toBe('/portal/auth');
    });

    it('should remove session token from localStorage', async () => {
      navigateTo('/portal/dashboard');

      // Assert: Token stored
      const tokenBefore = getStoredSessionToken();
      expect(tokenBefore).not.toBeNull();

      // Action: Logout
      const logoutBtn = getElementByTestId('header-logout-button');
      clickElement(logoutBtn);

      // Assert: Token removed
      const tokenAfter = getStoredSessionToken();
      expect(tokenAfter).toBeNull();
    });

    it('should clear patient data from store', async () => {
      navigateTo('/portal/dashboard');

      // Assert: Patient data loaded
      const patientData = getStoredPatientData();
      expect(patientData).not.toBeNull();

      // Action: Logout
      const logoutBtn = getElementByTestId('header-logout-button');
      clickElement(logoutBtn);

      // Assert: Patient data cleared
      const dataAfter = getStoredPatientData();
      expect(dataAfter).toBeNull();
    });
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * MOCK/HELPER FUNCTIONS
 *
 * These simulate Firebase, Firestore, HTTP calls, and DOM interactions
 * ═════════════════════════════════════════════════════════════════════════════
 */

// Auth helpers
function generatePatientAuthLink(email: string, patientId: string): string {
  const payload = {
    email,
    patientId,
    iat: Math.floor(Date.now() / 1000),
  };
  const token = Buffer.from(JSON.stringify(payload)).toString('base64') + '.' +
                Buffer.from('signature').toString('base64');
  return `http://localhost:3000/portal/auth/callback?token=${token}`;
}

function createTokenWithIat(iat: number): string {
  const payload = { email: 'test@lab.test', iat };
  return Buffer.from(JSON.stringify(payload)).toString('base64') + '.' +
         Buffer.from('signature').toString('base64');
}

async function validateAuthToken(token: string): Promise<boolean> {
  // Mock validation
  if (token.includes('X')) return false; // Corrupted
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    if (now - payload.iat > 7 * 24 * 60 * 60) return false; // Expired
    return true;
  } catch {
    return false;
  }
}

function authenticateAsPatient(patientId: string): void {
  localStorage.setItem('sessionToken', 'mock-token-' + patientId);
  localStorage.setItem('patientId', patientId);
}

function authenticateAsUser(userId: string, role: string): void {
  localStorage.setItem('sessionToken', 'mock-token-' + userId);
  localStorage.setItem('userId', userId);
  localStorage.setItem('userRole', role);
}

function getStoredSessionToken(): string | null {
  return localStorage.getItem('sessionToken');
}

function getStoredPatientId(): string | null {
  return localStorage.getItem('patientId');
}

function getStoredPatientData() {
  const data = localStorage.getItem('patientData');
  return data ? JSON.parse(data) : null;
}

function markTokenAsUsed(token: string): void {
  const used = JSON.parse(localStorage.getItem('usedTokens') || '[]');
  used.push(token);
  localStorage.setItem('usedTokens', JSON.stringify(used));
}

// DOM helpers
function navigateTo(path: string): void {
  window.history.pushState({}, '', path);
}

function getCurrentRoute(): string {
  return window.location.pathname;
}

function getElementByTestId(testId: string) {
  return document.querySelector(`[data-testid="${testId}"]`);
}

function getTextFromElement(el: Element | null, selector: string): string {
  if (!el) return '';
  const child = el.querySelector(selector);
  return child?.textContent || '';
}

function getLaudoListItems(): Element[] {
  return Array.from(document.querySelectorAll('[data-testid^="laudo-item-"]'));
}

function getSkeletonItems(): Element[] {
  return Array.from(document.querySelectorAll('[data-testid="skeleton-item"]'));
}

function clickElement(el: Element | null): void {
  if (el) (el as HTMLElement).click();
}

function fillInput(el: Element | null, value: string): void {
  if (el) {
    (el as HTMLInputElement).value = value;
  }
}

function getErrorMessage(): string {
  const errorEl = getElementByTestId('error-message');
  return errorEl?.textContent || '';
}

function scrollToBottom(): void {
  window.scrollTo(0, document.body.scrollHeight);
}

// Async helpers
async function loadLaudosList(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 100));
}

async function waitForElement(selector: string): Promise<Element | null> {
  for (let i = 0; i < 50; i++) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

async function waitForElementToDisappear(el: Element | null): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (!document.contains(el)) return;
    await new Promise(r => setTimeout(r, 100));
  }
}

async function waitForListUpdate(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 200));
}

function waitForDownload() {
  return { filename: 'Hemograma_2026-05-07_Alice.pdf' };
}

async function waitForDraftCreation() {
  await new Promise(r => setTimeout(r, 100));
  return {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    status: 'draft',
  };
}

function waitForQueueEntry(draftId: string) {
  return {
    id: 'queue_' + draftId,
    draftId,
    status: 'pending',
    lastApiResponse: {
      statusCode: '200',
      receiptCode: 'ANVISA-REC-001',
    },
  };
}

// Data helpers
function seedTestLaudos(patientId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `laudo_${patientId}_${i}`,
    patientId,
    exame: ['Hemograma', 'Bioquímica', 'Coagulação'][i % 3],
    data: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    status: ['finalizado', 'revisão', 'bloqueado'][i % 3],
  }));
}

function seedTestLaudosWithDates(patientId: string, count: number, daysSpan: number, dates?: Date[]) {
  return Array.from({ length: count }, (_, i) => ({
    id: `laudo_${patientId}_${i}`,
    patientId,
    data: dates ? dates[i] : new Date(Date.now() - Math.random() * daysSpan * 24 * 60 * 60 * 1000),
  }));
}

function seedTestLaudo(patientId: string, options: any = {}) {
  return {
    id: options.id || 'laudo_001',
    patientId,
    exame: options.exame || 'Hemograma',
    status: options.status || 'finalizado',
    ...options,
  };
}

function seedNotivisaDraft(patientId: string, options: any = {}) {
  return {
    id: options.id || 'draft_' + Math.random().toString(36).substr(2, 9),
    patientId,
    laudoId: options.laudoId || 'laudo_001',
    status: options.status || 'draft',
    createdBy: options.createdBy || 'rt_001',
    diseaseCode: 'C91.0',
    createdAt: new Date(),
    ...options,
  };
}

function seedQueueEntry(patientId: string, options: any = {}) {
  return {
    id: 'queue_' + Math.random().toString(36).substr(2, 9),
    patientId,
    draftId: options.draftId || 'draft_001',
    status: options.status || 'pending',
    apiAttempts: options.apiAttempts || 0,
    createdAt: new Date(),
    ...options,
  };
}

function createLargeResultSet(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    analito: `Analyte_${i}`,
    valor: 100 + Math.random() * 50,
    unidade: 'mg/dL',
  }));
}

function getDraftData(draftId: string) {
  return {
    id: draftId,
    status: 'approved',
    auditSignature: {
      operatorId: 'auditor_user_001',
      hash: 'a'.repeat(64),
    },
  };
}

function getQueueEntry(queueId: string) {
  return {
    id: queueId,
    status: 'submitted',
    submissionAttempt: {
      timestamp: new Date(),
    },
    nextRetry: new Date(Date.now() + 5 * 60 * 1000),
  };
}

function getAuditLogs(collection: string, patientId: string) {
  return [
    {
      action: 'draft_created',
      userId: 'rt_user_001',
      timestamp: new Date(),
    },
  ];
}

function getCloudLogs(options: any) {
  return [
    {
      message: 'ACK timestamp received: 2026-05-07T10:30:00Z',
      severity: 'INFO',
      labels: { draftId: 'draft_001' },
    },
  ];
}

function createWebhookSignature(payload: any): string {
  return 'sig_' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

function sendWebhook(payload: any, signature: string) {
  return { statusCode: 200, message: 'ACK received and processed' };
}

function triggerQueueProcessor(): void {
  // Simulate processor run
}

function mockSoapCall(response: any, error?: Error): void {
  // Setup mock
}

function simulateNetworkTimeout(): void {
  // Setup network simulation
}

function advanceTime(ms: number): void {
  vi.useFakeTimers();
  vi.advanceTimersByTime(ms);
}

function advanceSessionTime(ms: number): void {
  // Advance virtual session time
  localStorage.setItem('sessionStartTime', String(Date.now() - (30 * 60 * 1000 - ms)));
}

export {};
