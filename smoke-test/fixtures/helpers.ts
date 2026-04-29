import { Page } from '@playwright/test';

export async function closeAnyOpenModal(page: Page) {
  // Try Escape first
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);

  // Fallback: click close button if visible
  const closeBtn = page.locator('[aria-label="Fechar"]').first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}
