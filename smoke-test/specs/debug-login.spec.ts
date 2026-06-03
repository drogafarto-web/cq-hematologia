import { test, expect } from '@playwright/test';

test('debug login flow', async ({ page }) => {
  // Listen to console messages
  page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
  
  await page.goto('https://hmatologia2.web.app/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  console.log('Title:', await page.title());
  
  // Full page text to see what's rendered
  const bodyText = await page.locator('body').innerText().catch(() => '(empty)');
  console.log('=== BODY TEXT (first 2000 chars) ===');
  console.log(bodyText.substring(0, 2000));
  
  // Check for login form
  const emailField = page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first();
  const pwField = page.getByLabel(/senha/i).or(page.locator('input[type="password"]')).first();
  const emailVisible = await emailField.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Email field visible:', emailVisible);
  
  if (emailVisible) {
    await emailField.fill('e2e-operator@hcquality-test.com');
    await pwField.fill('Test@123456');
    
    // List all buttons
    const buttons = page.locator('button');
    const btnCount = await buttons.count();
    console.log(`Found ${btnCount} buttons`);
    for (let i = 0; i < btnCount; i++) {
      const text = await buttons.nth(i).innerText().catch(() => '(no text)');
      console.log(`  Button[${i}]: "${text}"`);
    }
    
    const submitBtn = page.getByRole('button', { name: /entrar|login|sign.?in/i })
      .or(page.locator('button[type="submit"]'))
      .first();
    await submitBtn.click();
    await page.waitForTimeout(8000);
    console.log('URL after login:', page.url());
    
    const bodyText2 = await page.locator('body').innerText().catch(() => '(empty)');
    console.log('=== BODY AFTER LOGIN (first 2000) ===');
    console.log(bodyText2.substring(0, 2000));
    
    // Check for Sair do painel button
    const sairBtn = page.locator('button', { hasText: /Sair/i }).first();
    console.log('Sair button visible:', await sairBtn.isVisible({ timeout: 2000 }).catch(() => false));
    
    // Check for lab selector
    const labText = page.locator('text=Selecione').first();
    console.log('Lab selector text visible:', await labText.isVisible({ timeout: 2000 }).catch(() => false));
    
    // Check for Coagulação v2
    const coag = page.locator('text=Coagulação').first();
    console.log('Coagulação text visible:', await coag.isVisible({ timeout: 2000 }).catch(() => false));
  }
  
  await page.screenshot({ path: 'debug-login.png', fullPage: true });
  console.log('Screenshot saved');
});
