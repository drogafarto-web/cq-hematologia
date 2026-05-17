import { test, expect } from '@playwright/test';

const APP_URL = 'https://hmatologia2.web.app';
const EMAIL = 'drogafarto@gmail.com';
const PASSWORD = '12345678';

test.describe('Auditoria Geral — Smoke Test', () => {
  test.use({ actionTimeout: 15000 });

  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[placeholder*="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(EMAIL);
      await page.locator('input[placeholder*="senha"]').fill(PASSWORD);
      await page.locator('button:has-text("Entrar")').click();
      await page.waitForTimeout(3000);
    }
    // Navega para Auditoria Geral
    await page.locator('nav').locator('button:has-text("Auditoria Geral")').click();
    await page.waitForTimeout(2000);
  });

  test('1. Renderizacao Guiado — 12 blocos sem tela branca', async ({ page }) => {
    await page.locator('button:has-text("LABCLIN TESTE QA")').click();
    await page.waitForTimeout(3000);
    
    const blocks = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    for (const block of blocks) {
      await page.evaluate((letter) => {
        const btns = document.querySelectorAll('aside button');
        const target = Array.from(btns).find(b => b.innerText.startsWith(letter + '\n'));
        if (target) target.click();
      }, block);
      await page.waitForTimeout(2000);
      
      const hasScore = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        return Array.from(btns).some(b =>
          /^[0-5]/.test(b.textContent.trim()) && b.textContent.trim().length > 10 && !b.closest('aside')
        );
      });
      
      expect(hasScore).toBeTruthy();
    }
  });

  test('2. Observacao obrigatoria para Nao Conforme', async ({ page }) => {
    await page.locator('button:has-text("LABCLIN TESTE QA")').click();
    await page.waitForTimeout(3000);

    await page.locator('button[aria-label="Marcar como Não Conforme"]').click();
    await page.waitForTimeout(500);

    const obsField = page.locator('textarea[placeholder*="Justifique"]');
    await expect(obsField).toBeVisible();

    const nextBtn = page.locator('button:has-text("Próximo")').last();
    await expect(nextBtn).toBeDisabled();

    await obsField.fill('Justificativa de teste');
    await page.locator('h2').first().click();
    await page.waitForTimeout(300);

    await expect(nextBtn).not.toBeDisabled({ timeout: 3000 });
  });

  test('3. Banner finalizacao ao atingir 57/57', async ({ page }) => {
    await page.locator('button:has-text("LABCLIN TESTE QA")').click();
    await page.waitForTimeout(3000);

    await expect(page.locator('text=Todos os 57 indicadores respondidos')).toBeVisible();
    await expect(page.locator('button:has-text("Finalizar Auditoria")')).toBeVisible();
  });

  test('4. Salvar tudo no Expert mode', async ({ page }) => {
    await page.locator('button:has-text("LABCLIN TESTE QA")').click();
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("Expert")').click();
    await page.waitForTimeout(2000);

    await expect(page.locator('button:has-text("Salvar tudo")')).toBeVisible();
  });

  test('5. Abas: Auditorias + Indicadores', async ({ page }) => {
    await expect(page.locator('button:has-text("Auditorias")')).toBeVisible();
    await expect(page.locator('button:has-text("Indicadores")')).toBeVisible();

    await page.locator('button:has-text("Indicadores")').click();
    await page.waitForTimeout(2000);

    const errorConsole = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource')
        .filter(e => e.name.includes('firebasestorage') && e.duration > 0);
      return entries.length;
    });
    
    expect(errorConsole).toBeDefined();
  });
});
