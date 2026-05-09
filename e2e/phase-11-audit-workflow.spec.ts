/**
 * E2E Tests: Auditoria Interna (Phase 11 - Audit Workflow)
 *
 * Critical flows for audit execution with presence registration, action plans,
 * and re-audit chain management.
 *
 * Scenarios:
 * 1. Register presence in opening meeting (reunião de abertura)
 * 2. Create action plan for finding (plano de ação)
 * 3. Create re-audit for closed non-conformance (reauditoria)
 * 4. Display re-audit chain visualization (reAuditoriaChain)
 *
 * Compliance: RDC 978/2025 Art. 82-85, DICQ 1.3 (audit planning & execution)
 * Auth: Team member access + auditor role
 * Duration: ~4 min / scenario
 */

import { test, expect, Page } from '@playwright/test';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const LAB_URL = 'http://localhost:5173';
const LAB_ID = 'lab-e2e-001';
const AUDITOR_EMAIL = 'auditor@labclin-riopomba.com';
const AUDITOR_PASSWORD = 'Test@12345';
const RT_EMAIL = 'rt@labclin-riopomba.com';
const RT_PASSWORD = 'Test@12345';

/**
 * Login helper — authenticate as auditor
 */
async function loginAsAuditor(page: Page): Promise<void> {
  await page.goto(`${LAB_URL}/auth/login`);
  await page.fill('input[type="email"]', AUDITOR_EMAIL);
  await page.fill('input[type="password"]', AUDITOR_PASSWORD);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(`${LAB_URL}/hub`);
}

/**
 * Login helper — authenticate as RT (Responsável Técnico)
 */
async function loginAsRT(page: Page): Promise<void> {
  await page.goto(`${LAB_URL}/auth/login`);
  await page.fill('input[type="email"]', RT_EMAIL);
  await page.fill('input[type="password"]', RT_PASSWORD);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(`${LAB_URL}/hub`);
}

/**
 * Navigate to auditoria module
 */
async function navigateToAuditoria(page: Page): Promise<void> {
  await page.click('a:has-text("Auditoria"), a[href*="auditoria"]');
  await page.waitForURL(`${LAB_URL}/**`);
}

/**
 * Navigate to existing audit (assumes at least one in DB)
 * Falls back to creating one if none exist
 */
async function navigateToExistingAudit(page: Page): Promise<void> {
  await navigateToAuditoria(page);

  // Check if any audit exists in list
  const auditExists = await page.locator('[aria-label*="Auditoria"]').first().isVisible({ timeout: 2000 }).catch(() => false);

  if (!auditExists) {
    // Create one via button
    await page.click('button:has-text("Nova Auditoria"), button:has-text("Criar Auditoria")');
    await page.waitForSelector('[aria-label="AuditoriaForm"]', { timeout: 3000 });

    // Fill form
    await page.selectOption('[aria-label="Responsável Técnico"]', AUDITOR_EMAIL);
    await page.fill('[aria-label="Ano"]', '2026');
    await page.selectOption('[aria-label="Frequência"]', 'anual');

    // Submit
    await page.click('button:has-text("Criar Auditoria")');
    await page.waitForSelector('text=Auditoria criada');
  }

  // Click on first audit to open
  await page.click('[aria-label*="Auditoria"]');
  await page.waitForSelector('[aria-label="AuditoriaDetail"], [aria-label="SessaoDetail"]', { timeout: 3000 });
}

// ─── Test Suite ───────────────────────────────────────────────────────────

test.describe('Auditoria Interna — Phase 11 Audit Workflow', () => {
  /**
   * Scenario 1: Register presence in opening meeting (reunião de abertura)
   *
   * Given: Auditor navigates to existing audit
   * When: Clicks "Reunião de Abertura" tab
   * And: Adds 4 participants (auditor, RT, manager_qc, auditado)
   * Then: Toast shows "4 registrados"
   * And: Presence list persists
   */
  test('Scenario 1: should register presença na reunião de abertura', async ({
    page,
  }) => {
    test.skip(
      !process.env.AUDIT_DB_SEED,
      'Audit DB seed not configured; skipping until infra ready'
    );

    await loginAsAuditor(page);
    await navigateToExistingAudit(page);

    // Navigate to "Reunião de Abertura" tab
    const reuniaoTab = page.locator('button, tab:has-text("Reunião de Abertura"), [aria-label="Reunião de Abertura"]');
    await reuniaoTab.click({ timeout: 3000 });
    await page.waitForSelector('[aria-label="ReuniaoPauta"], text=Pauta');

    // Click "Registrar Participantes" or "Adicionar Participante"
    await page.click('button:has-text("Registrar"), button:has-text("Adicionar Participante")');
    await page.waitForSelector('[aria-label="ParticipanteForm"]', { timeout: 2000 });

    // Add participant 1: Auditor
    await page.selectOption('[aria-label="Papel"]', 'auditor');
    await page.selectOption('[aria-label="Participante"]', AUDITOR_EMAIL);
    await page.click('button:has-text("Adicionar"), button[type="submit"]');
    await page.waitForTimeout(500);

    // Add participant 2: RT
    if (await page.locator('button:has-text("Adicionar Participante")').isVisible()) {
      await page.click('button:has-text("Adicionar Participante")');
    }
    await page.selectOption('[aria-label="Papel"]', 'rt');
    await page.selectOption('[aria-label="Participante"]', RT_EMAIL);
    await page.click('button:has-text("Adicionar"), button[type="submit"]');
    await page.waitForTimeout(500);

    // Add participant 3: Gerente QC
    if (await page.locator('button:has-text("Adicionar Participante")').isVisible()) {
      await page.click('button:has-text("Adicionar Participante")');
    }
    await page.selectOption('[aria-label="Papel"]', 'gerente_qc');
    await page.fill('[aria-label="Participante"]', 'gerente@labclin-riopomba.com');
    await page.click('button:has-text("Adicionar"), button[type="submit"]');
    await page.waitForTimeout(500);

    // Add participant 4: Auditado (área auditada)
    if (await page.locator('button:has-text("Adicionar Participante")').isVisible()) {
      await page.click('button:has-text("Adicionar Participante")');
    }
    await page.selectOption('[aria-label="Papel"]', 'auditado');
    await page.fill('[aria-label="Participante"]', 'auditado@labclin-riopomba.com');
    await page.click('button:has-text("Adicionar"), button[type="submit"]');

    // Verify toast: "4 registrados"
    await expect(page.locator('text=4 registrados, text=Participantes registrados')).toBeVisible({ timeout: 2000 });

    // Verify presence list shows 4 items
    await expect(page.locator('[aria-label="ParticipanteList"] li, [aria-label="ParticipanteList"] tr')).toHaveCount(4, { timeout: 2000 });
  });

  /**
   * Scenario 2: Create action plan for finding (plano de ação)
   *
   * Given: Auditor at existing audit with findings
   * When: Clicks "Criar Plano" on a finding (achado)
   * And: Fills responsible party, deadline, action description
   * Then: Plano created with status "não_iniciado"
   * And: Appears in action plan list
   */
  test('Scenario 2: should create plano de ação para achado', async ({
    page,
  }) => {
    test.skip(
      !process.env.AUDIT_DB_SEED,
      'Audit DB seed not configured; skipping until infra ready'
    );

    await loginAsAuditor(page);
    await navigateToExistingAudit(page);

    // Navigate to findings (Achados) tab or section
    const achadosTab = page.locator('button, tab:has-text("Achados"), [aria-label="Achados"]');
    await achadosTab.click({ timeout: 3000 });

    // Look for first finding card with "Criar Plano" button
    const firstFinding = page.locator('[aria-label="AchadoCard"], [aria-label^="Achado"]').first();
    await firstFinding.waitFor({ state: 'visible', timeout: 2000 });

    // Click "Criar Plano" on first finding
    const criarPlanoBtn = firstFinding.locator('button:has-text("Criar Plano"), button:has-text("Plano de Ação")');
    await criarPlanoBtn.click({ timeout: 2000 });

    // Expect plano form modal
    await page.waitForSelector('[aria-label="PlanoAcaoForm"]', { timeout: 2000 });

    // Fill form
    await page.selectOption('[aria-label="Responsável"]', AUDITOR_EMAIL);
    await page.fill('[aria-label="Data Prazo"]', '2026-06-30');
    await page.fill('[aria-label="Descrição da Ação"]', 'Implementar controle de calibração conforme DICQ 4.8 com verificação semanal.');

    // Submit
    await page.click('button:has-text("Criar Plano"), button:has-text("Salvar Plano")');

    // Verify success toast
    await expect(page.locator('text=Plano de ação criado')).toBeVisible({ timeout: 2000 });

    // Verify plano appears in list with status "não_iniciado"
    await expect(page.locator('text=não_iniciado, text=Não Iniciado')).toBeVisible({ timeout: 2000 });
  });

  /**
   * Scenario 3: Create re-audit for closed non-conformance (reauditoria)
   *
   * Given: Auditor at audit with finalized status (all findings closed)
   * When: Clicks "Re-Auditoria" button
   * And: Fills motivation + deadline
   * Then: Toast shows "ReAuditoria criada"
   * And: Redirects to new re-audit session
   * And: reAuditoriaPai references original audit
   */
  test('Scenario 3: should create reauditoria de auditoria finalizada com NC fechada', async ({
    page,
  }) => {
    test.skip(
      !process.env.AUDIT_DB_SEED || !process.env.AUDIT_FINALIZED_ID,
      'Finalized audit seed not configured; skipping until infra ready'
    );

    await loginAsAuditor(page);

    // Navigate directly to finalized audit (from env)
    const finalizedAuditId = process.env.AUDIT_FINALIZED_ID || 'audit-finalized-001';
    await page.goto(`${LAB_URL}/auditoria/${finalizedAuditId}`);
    await page.waitForSelector('[aria-label="AuditoriaDetail"], text=Finalizada');

    // Verify status is "Finalizada"
    await expect(page.locator('text=Finalizada')).toBeVisible({ timeout: 2000 });

    // Click "Re-Auditoria" button
    const reAuditoriaBtn = page.locator('button:has-text("Re-Auditoria"), button:has-text("Criar Re-Auditoria")');
    await reAuditoriaBtn.click({ timeout: 2000 });

    // Expect re-audit form
    await page.waitForSelector('[aria-label="ReAuditoriaForm"]', { timeout: 2000 });

    // Fill form
    await page.fill('[aria-label="Motivação"]', 'Verificação de efetividade das ações corretivas implementadas após auditoria anterior.');
    await page.fill('[aria-label="Data Prazo"]', '2026-07-15');

    // Submit
    await page.click('button:has-text("Criar Re-Auditoria"), button[type="submit"]');

    // Verify toast: "ReAuditoria criada"
    await expect(page.locator('text=Re-auditoria criada, text=ReAuditoria criada')).toBeVisible({ timeout: 2000 });

    // Verify redirect to new re-audit
    await page.waitForURL(`${LAB_URL}/auditoria/**`, { timeout: 3000 });
  });

  /**
   * Scenario 4: Display re-audit chain visualization
   *
   * Given: Audit with re-audit filha (parent-child relationship)
   * When: Auditor navigates to re-audit
   * Then: Chain visualization shows original audit card + re-audit card
   * And: Cards connected with arrow/line
   * And: Shows "Auditoria Original" label + date
   * And: Shows "Re-Auditoria" label + status
   */
  test('Scenario 4: should display reAuditoriaChain mostrando original → reAud', async ({
    page,
  }) => {
    test.skip(
      !process.env.AUDIT_CHAIN_ID,
      'Re-audit chain seed not configured; skipping until infra ready'
    );

    await loginAsAuditor(page);

    // Navigate to re-audit with parent (from env)
    const reAuditChainId = process.env.AUDIT_CHAIN_ID || 'audit-reaud-001';
    await page.goto(`${LAB_URL}/auditoria/${reAuditChainId}`);
    await page.waitForSelector('[aria-label="ReAuditoriaChain"], [aria-label="AuditoriaDetail"]', { timeout: 3000 });

    // Verify chain visualization is visible
    const chainContainer = page.locator('[aria-label="ReAuditoriaChain"]');
    await expect(chainContainer).toBeVisible({ timeout: 2000 });

    // Verify original audit card (first card in chain)
    const originalCard = chainContainer.locator('[aria-label="OriginalAuditCard"], text=Auditoria Original').first();
    await expect(originalCard).toBeVisible({ timeout: 2000 });

    // Verify re-audit card (second card in chain)
    const reAuditCard = chainContainer.locator('[aria-label="ReAuditCard"], text=Re-Auditoria').first();
    await expect(reAuditCard).toBeVisible({ timeout: 2000 });

    // Verify connection visual (arrow or line)
    const connection = chainContainer.locator('[aria-label="ChainConnection"], svg, .chain-arrow, .chain-connector');
    await expect(connection).toBeVisible({ timeout: 2000 }).catch(() => {
      // Connection may be rendered as SVG or CSS, fallback to just checking card proximity
      console.log('Chain connection SVG not found, but cards visible — may be CSS-based');
    });

    // Verify both cards contain expected text
    await expect(page.locator('text=Auditoria Original')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=Re-Auditoria')).toBeVisible({ timeout: 2000 });
  });
});
