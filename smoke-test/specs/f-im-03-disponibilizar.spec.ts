import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';
import { generateSmokeNames } from '../fixtures/names';
import { closeAnyOpenModal } from '../fixtures/helpers';

/**
 * F-IM-03 — Disponibilizar lote p/ corrida (FEATURE NOVA — 2026-04-26)
 *
 * Cobre o fluxo deployado em commit `6255906` que fechou o gap "cadastrei
 * insumo, quero rodar corrida de validação". Antes: operador travava porque
 * cadastrar Insumo só criava /insumos doc, não envelope CIQImunoLot.
 *
 * Fluxo:
 *   1. Cadastra 1 reagente imuno SMOKE (setup mínimo)
 *   2. Clica botão azul "Disponibilizar p/ corrida" no row
 *   3. Modal DisponibilizarBancadaImunoModal abre
 *   4. Pick testType (Dengue NS1 já existe no lab)
 *   5. Confirm "Disponibilizar como Em Validação"
 *   6. Auto-navega pra Bancada de Imunoensaios
 *   7. Card "Em Validação" aparece com testType + lote
 *   8. Volta InsumoRow → badge "Em validação · bancada" presente
 *   9. Botão "Disponibilizar p/ corrida" sumiu (estado correto pós-pin)
 */

test.describe('F-IM-03 — Disponibilizar lote p/ corrida (Bancada Imuno)', () => {
  const names = generateSmokeNames();
  const today = new Date().toISOString().split('T')[0];
  const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    .toISOString()
    .split('T')[0];

  // testType pré-existente no lab Riopomba (criado em runs anteriores).
  // Se o lab não tiver, F-IM-01 deve rodar antes pra cadastrar um SMOKE.
  const TEST_TYPE = 'Dengue NS1';

  test('Reagente imuno é vinculado à Bancada como Em Validação', async ({ loggedInPage: page }) => {
    test.setTimeout(180_000);

    // ─── 1. Setup: cadastrar 1 reagente SMOKE ─────────────────────────────
    await closeAnyOpenModal(page);

    if (!page.url().includes('ciq-imuno')) {
      await page.click('text=CIQ-Imuno');
      await page.waitForTimeout(2000);
    }

    await page.click('text=Insumos e Catálogo');
    await page.waitForTimeout(1000);
    await page.click('text=Todos os lotes');
    await page.click('text=Reagentes');

    console.log(`\n--- Setup: cadastrando reagente ${names.reagente} ---`);

    await page.click('button:has-text("+ Novo lote")');
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("+ Cadastrar novo produto no catálogo")');
    await page.waitForSelector('input#fabricante', { state: 'visible', timeout: 5000 });

    const produtoModal = page.locator('[role="dialog"]').last();
    await produtoModal.locator('input#fabricante').fill('SMOKE_Wama');
    await produtoModal.locator('input#nomeComercial').fill(names.reagente);
    await produtoModal.locator('button').filter({ hasText: 'Reagente' }).first().click();
    await produtoModal.locator('button:has-text("Imunologia")').click();
    await produtoModal.locator('input#diasEstab').fill('30');
    await produtoModal.locator('button:has-text("Cadastrar produto")').click();

    await page.waitForTimeout(2000);
    const dupWarning = page.locator('text=Já existe produto com mesmo fabricante');
    if (await dupWarning.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // Garante filtro reagente no picker
    const selects = page.locator('[role="dialog"] select');
    await selects.nth(0).selectOption('reagente');
    await page.waitForTimeout(500);

    const pickerList = page.locator('ul');
    const reagenteRow = pickerList.locator('button').getByText(names.reagente, { exact: true });
    await reagenteRow.waitFor({ state: 'visible', timeout: 15000 });
    await reagenteRow.click();

    const loteModal = page.locator('[role="dialog"]').last();
    await loteModal.locator('input#loteNum').waitFor({ state: 'visible', timeout: 5000 });
    await loteModal.locator('input#loteNum').fill(names.loteRG);
    await loteModal.locator('input#validade').fill(nextYear);
    await loteModal.locator('input#alreadyOpen').check();
    await loteModal.locator('input#dataAbertura').fill(today);
    await loteModal.locator('input#diasEstab').fill('30');
    await loteModal.locator('button:has-text("Cadastrar lote")').click();

    await page.waitForTimeout(3000);
    await closeAnyOpenModal(page);

    // ─── 2. Localiza o row do reagente SMOKE em "Todos os lotes" ──────────
    console.log(`\n--- Localizando row do reagente ${names.loteRG} ---`);

    await page.click('text=Reagentes');
    // Cada InsumoRow é um div.grid com classes grid-cols-[1fr,140px,...].
    // Usa o texto único "Lote SMOKE-RG-<ts>" pra ancorar e sobe pro ancestral
    // grid mais próximo — `.first()` no div externo pegava o wrapper inteiro
    // com todas as rows.
    const reagenteEmListaRow = page
      .getByText(`Lote ${names.loteRG}`, { exact: false })
      .locator('xpath=ancestor::div[contains(@class,"grid-cols-")][1]');
    await expect(reagenteEmListaRow).toBeVisible({ timeout: 10_000 });

    // ─── 3. Clica "Disponibilizar p/ corrida" no row ──────────────────────
    console.log('\n--- Click em Disponibilizar p/ corrida ---');

    const disponibilizarBtn = reagenteEmListaRow.locator(
      'button:has-text("Disponibilizar p/ corrida")',
    );
    await expect(disponibilizarBtn).toBeVisible({ timeout: 5000 });
    await disponibilizarBtn.click();

    // ─── 4. Modal DisponibilizarBancadaImunoModal abre ────────────────────
    console.log('\n--- Modal Disponibilizar abriu ---');

    const dispModal = page.locator('[role="dialog"]').filter({
      hasText: 'Disponibilizar lote para corrida de validação',
    });
    await expect(dispModal).toBeVisible({ timeout: 5000 });

    // Header confirma o lote
    await expect(dispModal.getByText(names.reagente)).toBeVisible();
    await expect(dispModal.getByText(names.loteRG)).toBeVisible();

    // ─── 5. Seleciona testType ────────────────────────────────────────────
    console.log(`\n--- Selecionando testType: ${TEST_TYPE} ---`);

    const testTypeSelect = dispModal.locator('select');
    await testTypeSelect.waitFor({ state: 'visible', timeout: 5000 });
    await testTypeSelect.selectOption(TEST_TYPE);

    // ─── 6. Confirma ──────────────────────────────────────────────────────
    console.log('\n--- Confirmando "Disponibilizar como Em Validação" ---');

    const confirmBtn = dispModal.locator('button:has-text("Disponibilizar como Em Validação")');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // ─── 7. Auto-navega pra Bancada de Imunoensaios ───────────────────────
    console.log('\n--- Aguardando auto-navegação pra Bancada ---');

    await page.waitForFunction(() => document.body.innerText.includes('Bancada de Imunoensaios'), {
      timeout: 10_000,
    });

    // Card do setup aparece com testType + lote
    const setupCard = page
      .locator('div')
      .filter({ hasText: TEST_TYPE })
      .filter({ hasText: names.loteRG })
      .first();
    await expect(setupCard).toBeVisible({ timeout: 5000 });

    console.log(`✓ Setup card visível na Bancada: ${TEST_TYPE} · Lote ${names.loteRG}`);

    // ─── 8. Volta pra InsumoRow → badge "Em validação · bancada" ──────────
    console.log('\n--- Verificando badge no InsumoRow ---');

    await page.click('text=Insumos e Catálogo');
    await page.waitForTimeout(1000);
    await page.click('text=Todos os lotes');
    await page.click('text=Reagentes');

    const rowDepois = page
      .getByText(`Lote ${names.loteRG}`, { exact: false })
      .locator('xpath=ancestor::div[contains(@class,"grid-cols-")][1]');
    await expect(rowDepois).toBeVisible({ timeout: 10_000 });
    await expect(rowDepois.getByText('Em validação · bancada')).toBeVisible();

    // ─── 9. Botão "Disponibilizar p/ corrida" sumiu (estado terminal) ─────
    const dispBtnDepois = rowDepois.locator('button:has-text("Disponibilizar p/ corrida")');
    await expect(dispBtnDepois).toHaveCount(0);

    console.log('\n✓ F-IM-03 PASS: lote disponibilizado + badge presente + botão removido');
  });
});
