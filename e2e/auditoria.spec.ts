import { test, expect } from '@playwright/test';

const APP_URL = 'https://hmatologia2.web.app';
const EMAIL = 'drogafarto@gmail.com';
const PASSWORD = '12345678';

test.describe('Auditoria Interna', () => {
  test.use({ actionTimeout: 15000 });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input#email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(EMAIL);

    const passwordInput = page.locator('input#password');
    await passwordInput.fill(PASSWORD);

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Wait for dashboard to load (menu item visible = logged in)
    await page
      .locator('text=Auditoria Interna')
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  test('login succeeds and dashboard loads', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Olá, bruno');
    await page.screenshot({ path: 'e2e/screenshots/01-dashboard.png' });
  });

  test('navigate to auditoria interna', async ({ page }) => {
    await page.goto(`${APP_URL}/auditoria-interna`);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'e2e/screenshots/02-auditoria-page.png' });
    const bodyText = await page.locator('body').innerText();
    const fs = await import('fs');
    fs.writeFileSync('e2e/screenshots/auditoria-page-text.txt', bodyText);
    await expect(page.locator('body')).not.toContainText('permission-denied');
    await expect(page.locator('body')).not.toContainText('resource-exhausted');
  });

  test('create auditoria via UI', async ({ page }) => {
    await page.goto(`${APP_URL}/auditoria-interna`);
    await page.waitForTimeout(5000);

    const createBtn = page
      .locator(
        'button:has-text("Nova"), button:has-text("Criar"), button:has-text("Planejar"), button:has-text("Agendar")',
      )
      .first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/screenshots/03-create-modal.png' });
    } else {
      await page.screenshot({ path: 'e2e/screenshots/03-page-state.png' });
    }

    await expect(page.locator('body')).not.toContainText('resource-exhausted');
    await expect(page.locator('body')).not.toContainText('permission-denied');
  });
});
