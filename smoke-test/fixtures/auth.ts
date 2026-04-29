import { test as base, Page } from '@playwright/test';

export const test = base.extend<{
  loggedInPage: Page;
}>({
  loggedInPage: async ({ page }, use) => {
    const email = process.env.SMOKE_USER!;
    const password = process.env.SMOKE_PASS!;
    const labName = process.env.SMOKE_LAB_NAME!;

    await page.goto('/');
    
    // Login flow
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Entrar")');
    
    // Select lab if needed
    try {
      const labButton = page.locator(`button:has-text("${labName}")`);
      await labButton.waitFor({ state: 'visible', timeout: 5000 });
      await labButton.click();
    } catch (e) {
      // Lab might already be selected or selector didn't appear
      console.log('Lab selector not found or already selected');
    }

    // Wait for any authenticated route
    await page.waitForFunction(() => {
      return !document.querySelector('input[type="password"]');
    }, { timeout: 30000 }).catch(async (e) => {
      console.log(`Current URL after timeout: ${page.url()}`);
      throw e;
    });
    
    await use(page);
  },
});
