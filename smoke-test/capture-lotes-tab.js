const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve('C:/hc quality/test-screenshots');
const EMAIL = process.env.RT_EMAIL || 'drogafarto@gmail.com';
const PASS = process.env.RT_PASSWORD || '12345678';

(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login
  console.log('[auth] logging in...');
  await page.goto('https://hmatologia2.web.app/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const emailField = page.locator('input[type="email"]');
  if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailField.fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASS);
    await page.click('button:has-text("Entrar")');
    await page.waitForFunction(() => !document.querySelector('input[type="password"]'), {
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
  }

  // Handle lab selector
  const labSelector = page.locator('h2:has-text("Selecione o laboratório")');
  if (await labSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[auth] selecting lab...');
    const firstLab = page.locator('button').filter({ hasText: /lab/i }).first();
    if (await firstLab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstLab.click();
      await page.waitForTimeout(2000);
    }
  }
  console.log('[auth] logged in');

  // Navigate to Coagulação v2
  const coagLink = page.locator('text="Coagulação v2"').first();
  if (await coagLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await coagLink.click();
    await page.waitForTimeout(3000);
    console.log('[nav] clicked Coagulação v2');
  }

  // Click "Lotes em uso" tab
  const lotesTab = page.locator('button:has-text("Lotes em uso")').first();
  if (await lotesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await lotesTab.click();
    await page.waitForTimeout(3000);
    console.log('[nav] clicked Lotes em uso');
  } else {
    console.log('[nav] Lotes em uso tab not found, trying alternative...');
    const alt = page.locator('text="Lotes em uso"').first();
    if (await alt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await alt.click();
      await page.waitForTimeout(3000);
    }
  }

  // Screenshot
  const shotPath = path.join(SCREENSHOT_DIR, 'lotes-em-uso-editar.png');
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log(`[done] Screenshot saved: ${shotPath}`);

  await browser.close();
})();
