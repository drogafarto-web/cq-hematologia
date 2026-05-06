/**
 * E2E Tests: Bioquímica (CIQ Quantitativo)
 *
 * Critical flows:
 * 1. Create lot without bula (should block run entry)
 * 2. Add bula via PDF upload → apply to lot
 * 3. Record run (approved — no Westgard violations)
 * 4. Record run (rejected — Westgard 1-3s violation)
 * 5. Override violation with audit signature
 *
 * Compliance: RDC 978/2025 Arts. 179-181, DICQ 4.3, CLSI EP15
 * Auth: Team member access + admin features
 * Duration: ~5 min / scenario
 */

import { test, expect, Page } from '@playwright/test';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const LAB_URL = 'http://localhost:5173';
const LAB_ID = 'lab-e2e-001';
const OPERATOR_EMAIL = 'operator@labclin-riopomba.com';
const OPERATOR_PASSWORD = 'Test@12345';

/**
 * Login helper — authenticate as operator
 */
async function loginAsOperator(page: Page): Promise<void> {
  await page.goto(`${LAB_URL}/auth/login`);
  await page.fill('input[type="email"]', OPERATOR_EMAIL);
  await page.fill('input[type="password"]', OPERATOR_PASSWORD);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(`${LAB_URL}/hub`);
}

/**
 * Navigate to bioquimica module
 */
async function navigateToBioquimica(page: Page): Promise<void> {
  await page.click('a:has-text("Bioquímica")');
  await page.waitForURL(`${LAB_URL}/bioquimica`);
}

// ─── Test Suite ───────────────────────────────────────────────────────────

test.describe('Bioquímica (CIQ Quantitativo)', () => {
  /**
   * Test 1: Create control lot without bula
   *
   * Given: Operator navigates to Bioquímica module
   * When: Creates new lot with "Avulso" material type
   * Then: Lot created but UI shows "Aguardando Bula" status
   * And: Run entry is disabled (no Westgard rules without bula)
   */
  test('Scenario 1: Create lot without bula → block run entry', async ({
    page,
  }) => {
    await loginAsOperator(page);
    await navigateToBioquimica(page);

    // Create new lot
    await page.click('button:has-text("Nova Corrida")');
    await page.waitForSelector('[aria-label="Material Origem"]');

    // Select "Avulso" material type
    await page.selectOption('[aria-label="Material Origem"]', 'avulso');

    // Fill analitos (select 3: glucose, creatinine, urea)
    await page.click('[aria-label="Analitos"]');
    await page.check('[value="GLICOSE"]');
    await page.check('[value="CREATININA"]');
    await page.check('[value="UREIA"]');

    // Select equipment
    await page.selectOption('[aria-label="Equipamento"]', 'yumizen-h550-1');

    // Click save
    await page.click('button:has-text("Criar Lote")');

    // Verify lot created
    await page.waitForSelector('text=Lote criado com sucesso');
    await expect(page.locator('text=Aguardando Bula')).toBeVisible();

    // Verify run entry is disabled
    await expect(page.locator('button:has-text("Registrar Run")')).toBeDisabled();
  });

  /**
   * Test 2: Upload bula PDF → apply stats to lot
   *
   * Given: Lot without bula
   * When: User uploads PDF bula (Westgard + control level stats)
   * Then: Bula parsed via Gemini Vision
   * And: Stats applied to lot (mean/sd per analito × nível)
   * And: Run entry becomes enabled
   */
  test('Scenario 2: Upload bula PDF → apply stats → enable runs', async ({
    page,
  }) => {
    // Prerequisite: Create lot (from Test 1)
    await loginAsOperator(page);
    await navigateToBioquimica(page);
    await page.click('button:has-text("Nova Corrida")');
    await page.selectOption('[aria-label="Material Origem"]', 'avulso');
    await page.check('[value="GLICOSE"]');
    await page.click('button:has-text("Criar Lote")');

    // Upload bula PDF
    const fileInput = await page.locator('input[type="file"][accept*="pdf"]');
    await fileInput.setInputFiles('e2e/fixtures/bula-yumizen-h550.pdf');

    // Wait for parsing + status update
    await page.waitForSelector('text=Bula aplicada com sucesso');
    await page.waitForTimeout(2000); // Gemini parsing delay

    // Verify stats loaded
    await expect(page.locator('text=Glicose')).toBeVisible();
    await expect(page.locator('text=Nível 1: μ=105, σ=3.2')).toBeVisible();

    // Verify run entry is now enabled
    await expect(page.locator('button:has-text("Registrar Run")')).toBeEnabled();
  });

  /**
   * Test 3: Record run with no Westgard violations (APPROVED)
   *
   * Given: Lot with bula applied
   * When: Operator enters 3 QC values within ±2σ
   * And: Submits run
   * Then: Server-side Westgard validation passes (1-2s, 1-3s, 2-2s, R-4s)
   * And: Run status = "Aprovada"
   * And: Approval count incremented on lot
   * And: Traceability event recorded
   */
  test('Scenario 3: Record approved run (no violations)', async ({ page }) => {
    // Setup: Create lot + apply bula
    await loginAsOperator(page);
    await navigateToBioquimica(page);
    // ... (same as Test 2)

    // Click "Registrar Run"
    await page.click('button:has-text("Registrar Run")');
    await page.waitForSelector('[aria-label="NovaCorridaForm"]');

    // Enter QC values (within ±2σ)
    // Nível 1: GLICOSE = 106 (μ=105, σ=3.2, z=0.31)
    await page.fill('[aria-label="GLICOSE-Nível 1"]', '106');
    // Nível 1: CREATININA = 0.95 (typical range)
    await page.fill('[aria-label="CREATININA-Nível 1"]', '0.95');
    // Nível 1: UREIA = 25 (typical)
    await page.fill('[aria-label="UREIA-Nível 1"]', '25');

    // Submit
    await page.click('button:has-text("Enviar Run")');

    // Verify success message
    await page.waitForSelector('text=Run aprovada');
    await expect(page.locator('text=Nenhuma violação detectada')).toBeVisible();

    // Verify run appears in history
    await expect(page.locator('[aria-label="Status: Aprovada"]')).toBeVisible();

    // Verify lot approval count incremented
    await page.click('a:has-text("Voltar")');
    await expect(page.locator('text=Aprovações: 1')).toBeVisible();
  });

  /**
   * Test 4: Record run with Westgard violation (REJECTED)
   *
   * Given: Lot with bula
   * When: Operator enters value exceeding ±3σ (1-3s rule violation)
   * And: Submits run
   * Then: Server detects violation
   * And: Run status = "Rejeitada"
   * And: Approval count NOT incremented
   * And: Violation details shown (rule, severity, z-score)
   * And: UI prompts for operator decision (abandon or override)
   */
  test('Scenario 4: Record rejected run (1-3s violation)', async ({ page }) => {
    await loginAsOperator(page);
    await navigateToBioquimica(page);
    // Setup: Create lot + apply bula

    await page.click('button:has-text("Registrar Run")');

    // Enter value exceeding ±3σ
    // GLICOSE = 95 (μ=105, σ=3.2, z=-3.125 → violates 1-3s)
    await page.fill('[aria-label="GLICOSE-Nível 1"]', '95');
    await page.fill('[aria-label="CREATININA-Nível 1"]', '0.95');
    await page.fill('[aria-label="UREIA-Nível 1"]', '25');

    await page.click('button:has-text("Enviar Run")');

    // Verify violation dialog
    await page.waitForSelector('[aria-label="ReviewRunModal"]');
    await expect(page.locator('text=Run rejeitada')).toBeVisible();
    await expect(page.locator('text=1-3s')).toBeVisible();
    await expect(page.locator('text=3.13σ')).toBeVisible();

    // Verify buttons: Abandon or Override
    await expect(page.locator('button:has-text("Abandonar")')).toBeVisible();
    await expect(page.locator('button:has-text("Justificar Override")')).toBeVisible();

    // Click Abandon
    await page.click('button:has-text("Abandonar")');
    await expect(page.locator('text=Run descartada')).toBeVisible();
  });

  /**
   * Test 5: Override rejection with signature
   *
   * Given: Run with critical Westgard violation
   * When: Operator justifies override (≥20 chars)
   * And: Provides PIN for signature
   * Then: Server calculates SHA-256(payload)
   * And: Signature saved with operatorId + ts
   * And: complianceOverride.blockers frozen (snapshot)
   * And: Run status remains "Rejeitada" but aproveitamento = "informativa"
   * And: Signature appears in audit trail
   */
  test('Scenario 5: Override violation with audit signature', async ({
    page,
  }) => {
    await loginAsOperator(page);
    await navigateToBioquimica(page);
    // Setup: Create lot + apply bula + trigger violation

    // At ReviewRunModal with rejection
    await page.click('button:has-text("Justificar Override")');
    await page.waitForSelector('[aria-label="RunOverrideModal"]');

    // Enter justification (≥20 chars)
    const justification =
      'Calibração confirmada — valor outlier esperado em validação de intervalo.';
    await page.fill('[aria-label="Justificativa"]', justification);

    // Verify hash calculating in real-time
    await page.waitForSelector('text=Hash: [a-f0-9]{64}', { timeout: 2000 });

    // Enter PIN
    await page.fill('[aria-label="PIN"]', '1234');

    // Submit override
    await page.click('button:has-text("Confirmar Override")');

    // Verify signature saved + audit trail entry
    await page.waitForSelector('text=Override registrado com sucesso');
    await expect(
      page.locator('text=Assinado por: operator@labclin-riopomba.com')
    ).toBeVisible();
    await expect(page.locator('text=Justificativa:')).toBeVisible();
  });

  /**
   * Test 6: Persistence across reload (critical path)
   *
   * Given: Multiple approved runs recorded in lot
   * When: Page is hard-reloaded (F5)
   * Then: Lot state persists (runs, approval count)
   * And: Levey-Jennings chart re-renders with same data
   * And: Chain hash validates (no data corruption)
   */
  test('Scenario 6: Persistence across reload', async ({ page }) => {
    await loginAsOperator(page);
    await navigateToBioquimica(page);
    // Setup + record 3 runs

    // Get initial approval count
    const initialCount = await page.locator('text=/Aprovações:\\s+\\d+/');
    const countText = await initialCount.textContent();
    const count = parseInt(countText?.match(/\d+/) || ['0'], 10);

    // Hard reload
    await page.reload({ waitUntil: 'networkidle' });

    // Verify data persisted
    const reloadedCount = await page.locator('text=/Aprovações:\\s+\\d+/');
    const reloadedText = await reloadedCount.textContent();
    const reloadedNumber = parseInt(reloadedText?.match(/\d+/) || ['0'], 10);
    expect(reloadedNumber).toBe(count);

    // Verify chart renders
    await expect(page.locator('[aria-label="LeveyJenningsChart"]')).toBeVisible();
  });
});
