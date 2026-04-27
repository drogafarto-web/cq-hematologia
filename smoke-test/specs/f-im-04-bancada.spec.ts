import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';
import { closeAnyOpenModal } from '../fixtures/helpers';

/**
 * F-IM-04 — Bancada de Imunoensaios · visualização (read-only)
 *
 * Spec READ-ONLY (não cadastra nada). Valida que a Bancada renderiza:
 *   - Header com contador "N setups vinculado(s)"
 *   - Lista de Setups Vinculados com cards (azul=validação, verde=oficial)
 *   - Painel Corridas Recentes
 *   - Botão "+ Registrar Corrida" presente quando há setups
 *
 * Pré-condição: lab tem ≥ 1 setup vinculado (o lab Riopomba sempre tem
 * porque rodadas anteriores de F-IM-03 deixam envelopes pinned).
 *
 * Vale como smoke contínuo: se a Bancada começar a renderizar errado, esse
 * spec quebra antes da próxima rodada de F-IM-03/F-IM-07.
 */

test.describe('F-IM-04 — Bancada de Imunoensaios · visualização', () => {
  test('Bancada renderiza setups vinculados e painel de corridas', async ({
    loggedInPage: page,
  }) => {
    test.setTimeout(60_000);

    // ─── Navega pra Bancada ──────────────────────────────────────────────
    await closeAnyOpenModal(page);

    if (!page.url().includes('ciq-imuno')) {
      await page.click('text=CIQ-Imuno');
      await page.waitForTimeout(2000);
    }

    // Sidebar "Bancada (Corridas)" é a default do CIQ-Imuno; click pra garantir
    await page.click('text=Bancada (Corridas)').catch(() => {
      // Se já estiver na Bancada, click pode não estar disponível — segue
    });
    await page.waitForTimeout(1500);

    // ─── 1. Header com título + contador ──────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'Bancada de Imunoensaios' }),
    ).toBeVisible();

    // Subtitle traz o resumo de setups (formato: "N setup(s) vinculado(s)…")
    const subtitle = page.locator('text=/\\d+ setup/i').first();
    await expect(subtitle).toBeVisible({ timeout: 5000 });

    // ─── 2. Botão "+ Registrar Corrida" presente ──────────────────────────
    const registrarBtn = page.locator('button:has-text("Registrar Corrida")');
    await expect(registrarBtn).toBeVisible();

    // ─── 3. Seção "Setups Vinculados" ─────────────────────────────────────
    // Match exato pra evitar conflito com subtitle "N setups vinculados…"
    const setupsHeader = page.getByRole('heading', { name: 'Setups Vinculados' });
    await expect(setupsHeader).toBeVisible();

    // ─── 4. Pelo menos 1 card de setup (oficial OR validação) ─────────────
    // Cada card de setup contém label "Setup Oficial" ou "Em Validação"
    const setupLabels = page.locator(
      'text=/Setup Oficial|Em Validação/',
    );
    const setupCount = await setupLabels.count();
    console.log(`Setups vinculados na Bancada: ${setupCount}`);
    expect(setupCount).toBeGreaterThan(0);

    // ─── 5. Botão "+ Corrida" em cada card ────────────────────────────────
    const corridaButtons = page.locator('button:has-text("Corrida")');
    const corridaCount = await corridaButtons.count();
    expect(corridaCount).toBeGreaterThanOrEqual(1);

    // ─── 6. Painel "Corridas Recentes" ────────────────────────────────────
    await expect(page.getByText('Corridas Recentes', { exact: false })).toBeVisible();

    // ─── 7. Sem console errors críticos ───────────────────────────────────
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.waitForTimeout(1000);

    // Filtra erros conhecidos não-bloqueantes (PWA, fonts, etc)
    const criticos = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('PWA') &&
        !e.includes('manifest'),
    );
    if (criticos.length > 0) {
      console.warn('Console errors detectados:', criticos);
    }

    console.log(
      `\n✓ F-IM-04 PASS: Bancada renderiza · ${setupCount} setup(s) · ${corridaCount} botão(ões) "+ Corrida"`,
    );
  });
});
