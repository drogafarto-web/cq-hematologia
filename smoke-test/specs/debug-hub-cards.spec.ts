import { test } from '@playwright/test';

test('debug hub', async ({ page }) => {
  const email = process.env.SMOKE_USER || 'drogafarto@gmail.com';
  const pass = process.env.SMOKE_PASS || '12345678';

  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button:has-text("Entrar")');
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), {
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .slice(0, 80)
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 100),
        class: el.className?.toString().slice(0, 80) || '',
      }));
  });

  console.log('\n=== CLICKABLE ELEMENTS ON PAGE ===\n');
  buttons.forEach((b, i) => {
    console.log(`${i}: [${b.tag}] "${b.text}" class="${b.class}"`);
  });

  const allText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000));
  console.log('\n=== PAGE TEXT ===\n', allText);
});
