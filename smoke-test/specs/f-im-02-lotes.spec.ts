import { expect } from '@playwright/test';
import { test } from '../fixtures/auth';
import { generateSmokeNames } from '../fixtures/names';
import { closeAnyOpenModal } from '../fixtures/helpers';

test.describe('F-IM-02 — Cadastro de lotes CIQ-Imuno', () => {
  const names = generateSmokeNames();
  const today = new Date().toISOString().split('T')[0];
  const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

  test('Deve cadastrar 3 lotes (Reagente, Positivo, Negativo) com sucesso', async ({ loggedInPage: page }) => {
    test.setTimeout(300000); // 5 minutes
    
    // 1. Navegação inicial
    await closeAnyOpenModal(page);
    
    // Procura por "CIQ-Imuno" no Hub se não estiver lá
    if (!page.url().includes('ciq-imuno')) {
      console.log('Navigating to CIQ-Imuno...');
      await page.click('text=CIQ-Imuno');
      await page.waitForTimeout(2000);
    }

    // Sidebar -> Insumos e Catálogo
    await closeAnyOpenModal(page);
    console.log('Opening Insumos e Catálogo...');
    await page.click('text=Insumos e Catálogo');
    await page.waitForTimeout(1000);

    // Aba "Todos os lotes"
    await page.click('text=Todos os lotes');
    await page.click('text=Reagentes');

    const lotesParaCriar = [
      { 
        tipoProd: 'reagente', 
        tipoLabel: 'Reagente',
        prodName: names.reagente, 
        loteNum: names.loteRG,
        nivel: null 
      },
      { 
        tipoProd: 'controle', 
        tipoLabel: 'Controle',
        prodName: names.ctrlPos, 
        loteNum: names.loteCP,
        nivel: 'positivo' 
      },
      { 
        tipoProd: 'controle', 
        tipoLabel: 'Controle',
        prodName: names.ctrlNeg, 
        loteNum: names.loteCN,
        nivel: 'negativo' 
      }
    ];

    for (const item of lotesParaCriar) {
      console.log(`\n--- Iniciando cadastro de ${item.tipoLabel}: ${item.prodName} ---`);
      
      await page.click('button:has-text("+ Novo lote")');
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
      
      // Etapa 1: Cadastrar novo produto (REGRA: NUNCA BUSCAR)
      console.log('Step 1: Creating new product...');
      await page.click('button:has-text("+ Cadastrar novo produto no catálogo")');
      await page.waitForSelector('input#fabricante', { state: 'visible', timeout: 5000 });
      
      const modal = page.locator('[role="dialog"]').last(); // Last modal (the product form)

      // Preenche modal de produto
      await modal.locator('input#fabricante').fill('SMOKE_Wama');
      await modal.locator('input#nomeComercial').fill(item.prodName);
      
      // Tipo (Botões no ProdutoFormModal)
      console.log(`Selecting type: ${item.tipoLabel}`);
      await modal.locator('button').filter({ hasText: item.tipoLabel }).first().click();
      
      // Módulo: Imunologia (Botão/Chip)
      console.log('Selecting module: Imunologia');
      const imunoBtn = modal.locator('button:has-text("Imunologia")');
      await imunoBtn.click();
      
      if (item.nivel) {
        // Se for controle, o campo nível aparece
        console.log(`Selecting level: ${item.nivel}`);
        await modal.locator('select#nivelDefault').selectOption(item.nivel);
      }
      
      // Estabilidade default
      await modal.locator('input#diasEstab').fill('30');
      
      // Submit produto
      console.log('Submitting product form...');
      await modal.locator('button:has-text("Cadastrar produto")').click();
      
      // Handle potential duplicate warning (stays open with warning)
      await page.waitForTimeout(2000);
      const duplicateWarning = page.locator('text=Já existe produto com mesmo fabricante');
      if (await duplicateWarning.isVisible()) {
          console.log('Duplicate product warning found, closing modal with Escape...');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
      }

      // Aguarda o produto aparecer na lista do seletor (UL)
      // IMPORTANTE: O picker pode estar filtrado por tipo. Precisamos ajustar o filtro.
      console.log(`Setting picker filter to ${item.tipoProd}...`);
      const selects = page.locator('[role="dialog"] select');
      // O primeiro select no Picker (NovoLoteModal) é o Tipo
      await selects.nth(0).selectOption(item.tipoProd);
      await page.waitForTimeout(500);

      console.log('Waiting for product to appear in picker list...');
      const pickerList = page.locator('ul');
      const listItem = pickerList.locator('button').getByText(item.prodName, { exact: true });
      await listItem.waitFor({ state: 'visible', timeout: 15000 });
      
      // Seleciona o produto recém criado
      console.log('Selecting the product from picker...');
      await listItem.click();
      
      // Etapa 2: Lote
      console.log('Step 2: Filling lot details...');
      const loteModal = page.locator('[role="dialog"]').last();
      await loteModal.locator('input#loteNum').waitFor({ state: 'visible', timeout: 5000 });
      await loteModal.locator('input#loteNum').fill(item.loteNum);
      await loteModal.locator('input#validade').fill(nextYear);
      
      // Checkbox "já está em uso"
      await loteModal.locator('input#alreadyOpen').check();
      
      // Datas
      await loteModal.locator('input#dataAbertura').fill(today);
      await loteModal.locator('input#diasEstab').fill('30');
      
      // Submit lote
      console.log('Submitting lot form...');
      await loteModal.locator('button:has-text("Cadastrar lote")').click();
      
      // No HC Quality, após cadastrar lote pode haver uma sugestão de rotação.
      // Vamos fechar o modal/sugestão se aparecer.
      await page.waitForTimeout(3000); 
      await closeAnyOpenModal(page);
    }

    // Asserção final: os 3 lotes aparecem na lista
    await page.click('text=Reagentes');
    await expect(page.getByText(names.loteRG)).toBeVisible();
    
    await page.click('text=Controles');
    await expect(page.getByText(names.loteCP)).toBeVisible();
    await expect(page.getByText(names.loteCN)).toBeVisible();
    console.log('Smoke test SUCCESS!');
  });
});
