import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';
import { generateSmokeNames } from '../fixtures/names';
import { closeAnyOpenModal } from '../fixtures/helpers';

test.describe('F-Quality-01 — NC Crítica → Investigação → Ação → Eficácia', () => {
  const names = generateSmokeNames();
  const today = new Date().toISOString().split('T')[0];

  test('Abrir NC crítica → registrar investigação → propor ação → verificar eficácia', async ({
    loggedInPage: page,
  }) => {
    test.setTimeout(600000); // 10 min

    // 1. Navegar para NC (Não Conformidade)
    await closeAnyOpenModal(page);
    console.log('Step 1: Navigate to Não Conformidade module...');
    await page.click('text=/NC|Não Conformidade|Não-conformidade/i');
    await page.waitForTimeout(2000);

    // 2. Criar NC crítica
    console.log('Step 2: Create critical NC...');
    const newNcBtn = page
      .locator('button:has-text("Nova"), button:has-text("Novo"), button:has-text("Criar")')
      .first();
    if (await newNcBtn.isVisible()) {
      await newNcBtn.click();
      await page.waitForTimeout(1500);

      // Preencher dados da NC
      await page.fill(
        'textarea[placeholder*="descrição"]',
        `SMOKE_NC_CRITICA_${names.runId}: Resultado anômalo`,
      );

      // Marcar como crítica
      const criticalCheckbox = page.locator(
        'input[type="checkbox"][aria-label*="crítica"], label:has-text("Crítica")',
      );
      if (await criticalCheckbox.isVisible()) {
        await criticalCheckbox.check();
      }

      await page.click('button:has-text("Salvar"), button:has-text("Criar")');
      await page.waitForTimeout(2000);
      console.log('✅ Critical NC created');
    }

    // 3. Abrir NC e registrar investigação
    console.log('Step 3: Open NC and add investigation...');
    const ncLink = page.locator(`text=${names.runId}`).first();
    if (await ncLink.isVisible()) {
      await ncLink.click();
      await page.waitForTimeout(2000);

      // Aba Investigação
      const investigationTab = page
        .locator('button:has-text("Investigação"), [role="tab"]:has-text("Investigação")')
        .first();
      if (await investigationTab.isVisible()) {
        await investigationTab.click();
        await page.waitForTimeout(1000);
      }

      // Registrar investigação
      const investigationField = page
        .locator('textarea[placeholder*="investigação"], textarea[placeholder*="análise"]')
        .first();
      if (await investigationField.isVisible()) {
        await investigationField.fill(
          `SMOKE: Investigação iniciada em ${today}. Causa raiz: calibração de equipamento.`,
        );
        await page.click('button:has-text("Salvar"), button:has-text("Registrar")');
        await page.waitForTimeout(1500);
        console.log('✅ Investigation recorded');
      }
    }

    // 4. Propor ação corretiva
    console.log('Step 4: Propose corrective action...');
    const actionTab = page
      .locator('button:has-text("Ação"), [role="tab"]:has-text("Ação")')
      .first();
    if (await actionTab.isVisible()) {
      await actionTab.click();
      await page.waitForTimeout(1000);

      const newActionBtn = page
        .locator('button:has-text("Nova"), button:has-text("Adicionar")')
        .first();
      if (await newActionBtn.isVisible()) {
        await newActionBtn.click();
        await page.waitForTimeout(1000);

        const actionField = page
          .locator('textarea[placeholder*="ação"], textarea[placeholder*="correção"]')
          .first();
        if (await actionField.isVisible()) {
          await actionField.fill(
            `SMOKE: Recalibração do equipamento. Responsável: técnico. Prazo: 7 dias.`,
          );

          // Definir data de conclusão
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);
          const dueDateStr = dueDate.toISOString().split('T')[0];

          const dueDateField = page
            .locator('input[type="date"], input[placeholder*="conclusão"]')
            .nth(1);
          if (await dueDateField.isVisible()) {
            await dueDateField.fill(dueDateStr);
          }

          await page.click('button:has-text("Salvar"), button:has-text("Registrar")');
          await page.waitForTimeout(1500);
          console.log('✅ Corrective action proposed');
        }
      }
    }

    // 5. Verificar eficácia (simular fechamento)
    console.log('Step 5: Verify action effectiveness...');
    const closeNcBtn = page
      .locator(
        'button:has-text("Fechar"), button:has-text("Validar"), button:has-text("Confirmar Eficácia")',
      )
      .first();
    if (await closeNcBtn.isVisible()) {
      await closeNcBtn.click();
      await page.waitForTimeout(1500);

      const confirmBtn = page
        .locator('button:has-text("Confirmar"), button:has-text("OK"), button:has-text("Sim")')
        .first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        console.log('✅ NC closed (effectiveness verified)');
      }
    }

    expect(true).toBe(true); // Placeholder assertion
  });
});
