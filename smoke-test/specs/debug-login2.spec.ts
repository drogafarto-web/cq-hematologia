import { test } from '@playwright/test';

test('deep debug login', async ({ page }) => {
  page.on('console', (msg) => console.log(`[BROWSER ${msg.type()}] ${msg.text()}`));

  await page.goto('https://hmatologia2.web.app/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Login
  const emailField = page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first();
  await emailField.fill('e2e-operator@hcquality-test.com');
  const pwField = page.getByLabel(/senha/i).or(page.locator('input[type="password"]')).first();
  await pwField.fill('Test@123456');
  const submitBtn = page.getByRole('button', { name: /entrar/i }).first();
  await submitBtn.click();

  await page.waitForTimeout(10000);

  // Inject debugging via evaluate — dump Firebase internals
  const debugInfo = await page.evaluate(() => {
    const info: any = {};

    // Try to get Firebase auth current user
    try {
      const app = (window as any).__FIREBASE_APPS__?.[0];
      if (app) {
        const auth = app.auth?.();
        if (auth) {
          info.authUser = auth.currentUser?.uid;
          info.authEmail = auth.currentUser?.email;
          info.emailVerified = auth.currentUser?.emailVerified;
        }
      }
    } catch (e) {
      info.authError = String(e);
    }

    // Try to find React/ Zustand store internals
    try {
      const root = document.getElementById('root');
      if (root && (root as any).__reactFiber$) {
        info.hasReact = true;
      }
    } catch (e) {}

    // Get all text nodes — look for error messages
    const body = document.body.innerText;
    info.bodyText = body.substring(0, 500);

    // Check localStorage for Firebase auth persistence
    info.localStorageKeys = Object.keys(localStorage);
    for (const key of Object.keys(localStorage)) {
      if (key.includes('firebase') || key.includes('auth')) {
        try {
          info[key] = localStorage.getItem(key)?.substring(0, 100);
        } catch (e) {}
      }
    }

    return info;
  });

  console.log('=== DEBUG INFO ===');
  console.log(JSON.stringify(debugInfo, null, 2));

  await page.screenshot({ path: 'debug-login2.png', fullPage: true });
  console.log('Screenshot saved');
});
