import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('https://hmatologia2.web.app/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', 'drogafarto@gmail.com');
  await page.fill('input[type="password"]', '12345678');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Click on Uroanalise in the sidebar
  const uroLink = page.locator('nav a, nav button, aside a, aside button, [role="navigation"] a').filter({ hasText: /Uroan/i }).first();
  if (await uroLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await uroLink.click();
    console.log('Clicked Uroanalise sidebar link');
  } else {
    // Fallback: click the tile in the hub
    const uroTile = page.locator('div, a, button').filter({ hasText: /Uroan.lise/i }).first();
    await uroTile.click();
    console.log('Clicked Uroanalise tile');
  }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'C:/hc quality/smoke-test/screenshots/uro-page.png' });
  console.log('Uro page screenshot taken. URL:', page.url());

  // Click "+ Nova corrida" button
  const novaBtn = page.locator('button').filter({ hasText: /Nova corrida/i }).first();
  if (await novaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await novaBtn.click();
    await page.waitForTimeout(3000);
    console.log('Clicked Nova corrida');
  }

  await page.screenshot({ path: 'C:/hc quality/smoke-test/screenshots/uro-form.png' });

  // The form has a config section first (lote, fabricante, etc.)
  // We need to scroll down to find the analytes section with pH and densidade.
  // The densidade input has id="resultado-densidade" in the legacy form.

  // First scroll the page to reveal analyte inputs
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/hc quality/smoke-test/screenshots/uro-form-scrolled.png' });

  // Find densidade input by its id
  let found = false;
  const densInput = page.locator('#resultado-densidade');
  if (await densInput.count() > 0) {
    await densInput.scrollIntoViewIfNeeded();
    await densInput.fill('1020');
    await densInput.press('Tab');
    found = true;
    console.log('Found via #resultado-densidade — typed 1020');
    await page.waitForTimeout(1000);
    // Read back the value to confirm normalization
    const val = await densInput.inputValue();
    console.log(`Input value after Tab: "${val}"`);
  }

  // Fallback: data-analito (redesigned form)
  if (!found) {
    const densRow = page.locator('[data-analito="densidade"]');
    if (await densRow.count() > 0) {
      const inp = densRow.locator('input').first();
      await inp.scrollIntoViewIfNeeded();
      await inp.fill('1020');
      await inp.press('Tab');
      found = true;
      console.log('Found via data-analito — typed 1020');
      await page.waitForTimeout(1000);
      const val = await inp.inputValue();
      console.log(`Input value after Tab: "${val}"`);
    }
  }

  if (!found) {
    console.log('Could not find densidade input. Dumping page state:');
    const allInputs = page.locator('input');
    const total = await allInputs.count();
    for (let i = 0; i < Math.min(total, 20); i++) {
      const inp = allInputs.nth(i);
      const id = await inp.getAttribute('id') || '';
      const type = await inp.getAttribute('type') || 'text';
      const ph = await inp.getAttribute('placeholder') || '';
      console.log(`  [${i}] id="${id}" type=${type} placeholder="${ph}"`);
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/hc quality/smoke-test/screenshots/densidade-1020-result.png', fullPage: true });

  console.log('Done! Screenshot saved. Found:', found);
  await browser.close();
})();
