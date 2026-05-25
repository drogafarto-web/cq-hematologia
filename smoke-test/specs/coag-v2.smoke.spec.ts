import { test, expect } from '@playwright/test';

test.describe('Coagulação v2 — Smoke E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and login
    await page.goto('/');
    // Assumes existing auth session — adjust for your env
    await page.waitForLoadState('networkidle');
  });

  test('operador consegue acessar módulo v2', async ({ page }) => {
    await page.goto('/');
    // Look for the hub module entry
    const v2Link = page.locator('text=Coagulação v2');
    await expect(v2Link).toBeVisible({ timeout: 15000 });
  });

  test('RT consegue acessar painel técnico', async ({ page }) => {
    await page.goto('/');
    // Navigate to RT view (direct route)
    await page.evaluate(() => {
      // This simulates setting the view via the store
      window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'coagulacao-v2-rt' } }));
    });
    await page.waitForTimeout(2000);
    // KPI cards should be visible
    await expect(page.locator('text=tentativas').first()).toBeVisible({ timeout: 10000 });
  });

  test('operador consegue selecionar controle e ver resultados', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'coagulacao-v2' } }));
    });
    await page.waitForTimeout(2000);

    // Should see the form
    const formTitle = page.locator('text=Controle');
    await expect(formTitle).toBeVisible({ timeout: 10000 });

    // Should have 3 result input labels
    await expect(page.locator('text=Atividade de Protrombina')).toBeVisible();
    await expect(page.locator('text=RNI')).toBeVisible();
    await expect(page.locator('text=TTPA')).toBeVisible();
  });
});
