import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.resolve('C:/hc quality/test-screenshots');
const EMAIL = process.env.RT_EMAIL || 'drogafarto@gmail.com';
const PASS = process.env.RT_PASSWORD || '12345678';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shot(page: Page, name: string) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  return page.screenshot({ path: p, fullPage: false }).then(() => {
    console.log(`  [screenshot] ${name}.png saved`);
  });
}

async function login(page: Page) {
  console.log(`[auth] logging in as ${EMAIL}`);
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(2000);

  // Screenshot login page first
  await shot(page, '01-login-page');

  const emailField = page.locator('input[type="email"]');
  const pwField = page.locator('input[type="password"]');

  if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailField.fill(EMAIL);
    await pwField.fill(PASS);
    await page.click('button:has-text("Entrar")');
    await page.waitForFunction(
      () => !document.querySelector('input[type="password"]'),
      { timeout: 30000 }
    );
    await sleep(2000);
  }

  // Handle lab selector if it appears
  const labSelectorHeading = page.locator('h2:has-text("Selecione o laboratório")');
  if (await labSelectorHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[auth] lab selector appeared, selecting first lab');
    const firstLab = page.locator('button.bg-white\/\[0\.04\]').first();
    if (await firstLab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstLab.click();
      await sleep(2000);
    }
  }

  await sleep(2000);
  console.log('[auth] logged in, URL:', page.url());
}

test.describe('Coagulação v2 — Screenshots', () => {
  test.setTimeout(120000);

  test('Take screenshots of login + ControlHub + AttemptForm', async ({ page }) => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    // Login
    await login(page);
    await shot(page, '02-hub-after-login');

    // Navigate to Coagulação v2
    const coagLink = page.locator('text="Coagulação v2"').first();
    if (await coagLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await coagLink.click();
      await sleep(3000);
      console.log('[nav] clicked Coagulação v2');
    } else {
      // Try alternative navigation
      const coagAlt = page.locator('[data-module="coagulacao-v2"]').first()
        .or(page.locator('text="Coagulação"').first());
      if (await coagAlt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await coagAlt.click();
        await sleep(3000);
      }
    }

    await shot(page, '03-coag-v2-module');

    // Screenshot the Execução tab (AttemptForm with reagent chips)
    // The form is already showing: Reagente TP and Reagente TTPA chips above inputs
    await shot(page, '04-execucao-attempt-form');

    // Check for reagent info text
    const reagenteTP = page.locator('text=/Reagente TP/').first();
    const reagenteTTPA = page.locator('text=/Reagente TTPA/').first();
    const tpVisible = await reagenteTP.isVisible({ timeout: 3000 }).catch(() => false);
    const ttpaVisible = await reagenteTTPA.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[form] Reagente TP visible: ${tpVisible}, Reagente TTPA visible: ${ttpaVisible}`);

    await shot(page, '05-reagent-chips-above-inputs');

    // Navigate to "Lotes em uso" tab (ControlHub equivalent)
    const lotesTab = page.locator('text="Lotes em uso"').first()
      .or(page.locator('button:has-text("Lotes em uso")').first());

    if (await lotesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lotesTab.click();
      await sleep(2000);
      console.log('[nav] clicked Lotes em uso tab');
    }

    await shot(page, '06-lotes-em-uso-controlhub');

    // Go back to Execução tab to capture the form again
    const execTab = page.locator('text="Execução"').first()
      .or(page.locator('button:has-text("Execução")').first());
    if (await execTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await execTab.click();
      await sleep(2000);
    }

    // Look for reagent chips / info elements
    const chips = page.locator('text=/Reagente (TP|TTPA)/');
    const chipCount = await chips.count();
    console.log(`[attempt-form] Found ${chipCount} reagent info elements`);

    await shot(page, '07-attempt-form-reagent-chips');

    // Full page screenshot for completeness
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-full-page.png'), fullPage: true });
    console.log('  [screenshot] 08-full-page.png saved (full page)');

    console.log('[done] All screenshots saved to test-screenshots directory');
  });
});
