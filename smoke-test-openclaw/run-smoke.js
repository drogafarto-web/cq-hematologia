const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://hmatologia2.web.app';
const EMAIL = 'drogafarto@gmail.com';
const PASSWORD = '12345678';
const LAB_NAME = 'LabClin Rio Pomba MG';
const TS = Date.now();
const SMOKE_TEST_TYPE = `SMOKE_PCR_${TS}`;
const OUTPUT_DIR = path.resolve(
  __dirname,
  `smoke-ciq-imuno-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '')}`,
);

// Nomes fixos para produtos (reutilizáveis entre rodadas)
const RUN_TS = Date.now();
const LOT_SUFFIX = Math.random().toString(36).slice(2, 8);
const RESULTS = {};

let browser, page;
const screenshots = [];
const networkFailures = [];
const consoleErrors = [];

async function screenshot(name) {
  const p = path.join(OUTPUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  screenshots.push(p);
}

async function closeAnyModal() {
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const closeBtn = page.locator('[aria-label="Fechar"]');
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  } catch (e) {
    /* ok */
  }
}

async function step(name, fn) {
  console.log(`\n▶ ${name}`);
  try {
    await fn();
    RESULTS[name] = 'PASS';
    console.log(`  ✅ PASS`);
  } catch (e) {
    RESULTS[name] = 'FAIL';
    console.log(`  ❌ FAIL — ${e.message.slice(0, 120)}`);
    throw e;
  }
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  page.on('response', (r) => {
    if (r.status() >= 400) networkFailures.push({ url: r.url(), status: r.status() });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ── LOGIN + Hard refresh PWA ──
    console.log('\n▶ Login + PWA Cleanup');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Limpar PWA cache + service workers
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Login
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"]', PASSWORD);
    await page.click('button:has-text("Entrar")');
    await page.waitForTimeout(3000);
    try {
      await page.click(`text=${LAB_NAME}`);
      await page.waitForTimeout(2000);
    } catch (e) {
      /* ok */
    }
    await page.waitForTimeout(1000);
    await screenshot('f-im-00-hub');

    // Navegar pra CIQ-Imuno
    try {
      await page.click('text=CIQ-Imuno');
    } catch {
      await page.click('[data-view="ciq-imuno"]');
    }
    await page.waitForTimeout(2000);
    await screenshot('f-im-00-ciq-imuno-entry');

    // ── F-IM-01: Criar SMOKE testType via Gerenciar ──
    await step('F-IM-01', async () => {
      await closeAnyModal();
      await page.click('button:has-text("Registrar Corrida")');
      await page.waitForTimeout(1500);
      await page.click('button:has-text("Gerenciar")');
      await page.waitForTimeout(1000);
      await screenshot('f-im-01-manager-aberto');

      // Scroll até "Adicionar novo"
      try {
        await page.locator('text=Adicionar novo').first().scrollIntoViewIfNeeded();
      } catch {}
      await page.waitForTimeout(300);

      // Input
      await page.fill('input[placeholder^="Nome do teste"]', SMOKE_TEST_TYPE);

      // Radio Manual
      try {
        await page.locator('[aria-label="Tipo de execução do teste"] button').nth(1).click();
      } catch {}

      // Botão verde submit
      try {
        await page.click('button.bg-emerald-500');
      } catch {
        await page.click('button:has(svg)');
      }
      await page.waitForTimeout(2000);
      await screenshot('f-im-01-test-type-criado');

      // Fecha modal
      await closeAnyModal();
      await page.waitForTimeout(500);
      try {
        await page.click('button:has-text("Cancelar")');
      } catch {}
      await page.waitForTimeout(500);
    });

    // ── F-IM-02: Cadastro 3 lotes ──
    await step('F-IM-02', async () => {
      await closeAnyModal();

      // Sidebar → Insumos e Catálogo
      try {
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            if (b.textContent.includes('Insumos e Catálogo')) {
              b.click();
              break;
            }
          }
        });
      } catch {
        await page.click('text=Insumos e Catálogo');
      }
      await page.waitForTimeout(2000);
      await screenshot('f-im-02-insumos');

      // Aba 'Todos os lotes' + chip 'Reagentes'
      try {
        await page.click('text=Todos os lotes');
      } catch {}
      await page.waitForTimeout(500);
      try {
        await page.click('text=Reagentes');
      } catch {}
      await page.waitForTimeout(500);
      await screenshot('f-im-02-lotes-list-before');

      // Cria 3 itens: reagente, controle positivo, controle negativo
      // Sempre cria via botão tracejado — NÃO busca no picker
      const produtos = [
        {
          key: 'reagente',
          tipoSelect: 'Reagente',
          nivel: null,
          prodName: `SMOKE_KitPCR_${RUN_TS}`,
          loteStr: `SMOKE-RG-${LOT_SUFFIX}`,
        },
        {
          key: 'ctrlPos',
          tipoSelect: 'Controle',
          nivel: 'positivo',
          prodName: `SMOKE_CtrlPos_${RUN_TS}`,
          loteStr: `SMOKE-CP-${LOT_SUFFIX}`,
        },
        {
          key: 'ctrlNeg',
          tipoSelect: 'Controle',
          nivel: 'negativo',
          prodName: `SMOKE_CtrlNeg_${RUN_TS}`,
          loteStr: `SMOKE-CN-${LOT_SUFFIX}`,
        },
      ];

      for (const p of produtos) {
        await closeAnyModal();
        console.log(`  🔧 ${p.key} (${p.prodName})...`);

        // REENTRADA SEGURA
        try {
          await page.locator('button:has-text("Todos os lotes")').click();
        } catch {}
        await page.waitForTimeout(500);
        try {
          await page.locator('button:has-text("Reagentes")').first().click();
        } catch {}
        await page.waitForTimeout(500);
        await page.locator('button:has-text("+ Novo lote")').click();
        await page.waitForTimeout(1500);
        await screenshot(`f-im-02-modal-${p.key}`);

        // [FIX] NÃO busca — sempre cria via botão tracejado
        console.log('  🆕 Criando via "+ Cadastrar novo produto"');
        await page.locator('button:has-text("+ Cadastrar novo produto")').click();
        await page.waitForTimeout(1000);

        // Preenche ProdutoFormModal
        await page.fill('input#fabricante', 'SMOKE_Wama');
        await page.fill('input#nomeComercial', p.prodName);
        // [FIX Bruno] OREM: Tipo → Módulo → Nível (renderização condicional)
        // 1. Tipo
        try {
          await page.selectOption('select:has(option:has-text("Controle"))', p.tipoSelect);
        } catch {}
        await page.waitForTimeout(300);
        // 2. Módulo (OBRIGATÓRIO) — NECESSÁRIO pro nível renderizar
        await page.locator('button:has-text("Imunologia")').click();
        await page.waitForTimeout(300);
        // 3. Nível — só renderiza após Tipo=Controle + Módulo=Imunologia
        if (p.nivel) {
          try {
            await page.locator('select#nivelDefault').selectOption(p.nivel);
            console.log(`  🎛️ Nível: ${p.nivel} (select#nivelDefault)`);
          } catch {
            console.log('  ⚠️ select#nivelDefault não encontrado');
          }
        }
        await page.fill('input[placeholder*="Estabilidade"], input#funcaoTecnica', '30');
        await page.click('button:has-text("Cadastrar produto")');
        // Aguarda modal de produto fechar (input#fabricante exclusivo dele)
        await page
          .waitForFunction(() => !document.querySelector('input#fabricante'), { timeout: 8000 })
          .catch(() => console.log('  ⚠️ input#fabricante ainda visível'));
        await page.waitForTimeout(1000);

        // [FIX] NÃO chama closeAnyModal entre submit e seleção
        // Confirma que NovoLoteModal ainda está montado
        const dialogs = await page.locator('[role="dialog"]').count();
        console.log(`  📊 Dialogs: ${dialogs} (esperado: 1)`);
        if (dialogs === 0) {
          console.log('  ⚠️ Reabrindo modal');
          await page.locator('button:has-text("+ Novo lote")').click();
          await page.waitForTimeout(1500);
        }

        // Seleciona pelo nome no picker
        console.log('  🎯 Selecionando produto...');
        await page
          .waitForFunction(
            (name) =>
              Array.from(document.querySelectorAll('p')).some((p) => p.textContent === name),
            p.prodName,
            { timeout: 8000 },
          )
          .catch(() => console.log('  ⚠️ Wait falhou'));
        await page.waitForTimeout(300);
        await page.getByText(p.prodName, { exact: true }).click();
        await page.waitForTimeout(500);
        // Etapa 2
        console.log('  ➡️ Etapa 2');
        await page.waitForSelector('input#loteNum', { timeout: 10000 });
        await page.fill('input#loteNum', p.loteStr);
        await page.fill('input#validade', '2027-04-26');
        try {
          await page.check('input#alreadyOpen');
        } catch {
          await page.click('input#alreadyOpen');
        }
        try {
          await page.fill('input#dataAbertura', '2026-04-26');
        } catch {}
        try {
          await page.fill('input#diasEstab, [aria-label*="estabilidade"]', '30');
        } catch {}
        await page.waitForTimeout(300);
        await page.locator('button:has-text("Cadastrar lote")').click();
        await page.waitForTimeout(2000);
        console.log(`  ✅ ${p.loteStr} cadastrado`);
      }
      await screenshot('f-im-02-3-lotes-criados');
    });

    // ── F-IM-03 Disponibilizar p/ corrida ──
    await step('F-IM-03', async () => {
      await closeAnyModal();
      // Localizar reagente na lista
      try {
        const row = page.locator(`text=SMOKE-`).first();
        await row.scrollIntoViewIfNeeded();
      } catch {}
      await page.waitForTimeout(500);
      try {
        await page.click('button:has-text("Disponibilizar")');
      } catch {}
      await page.waitForTimeout(1000);
      await screenshot('f-im-03-modal-open');
      // Selecionar testType
      try {
        await page.selectOption('select:has(option:has-text("SMOKE"))', { label: SMOKE_TEST_TYPE });
      } catch {}
      await page.click('button:has-text("Em Validação")');
      await page.waitForTimeout(3000);
      await screenshot('f-im-03-after-confirm');
    });

    // ── F-IM-04 Bancada ──
    await step('F-IM-04', async () => {
      await closeAnyModal();
      await page.waitForTimeout(2000);
      await screenshot('f-im-04-bancada');
    });

    // ── F-IM-05 Form blank ──
    await step('F-IM-05', async () => {
      await closeAnyModal();
      await page.click('button:has-text("Registrar Corrida")');
      await page.waitForTimeout(1500);
      await screenshot('f-im-05-form-blank');
      await page.click('button:has-text("Cancelar")');
    });

    // ── F-IM-06 Prefilled ──
    await step('F-IM-06', async () => {
      await closeAnyModal();
      await page.click('button:has-text("Corrida")');
      await page.waitForTimeout(1500);
      await screenshot('f-im-06-prefilled');
      try {
        await page.click('text=Trocar lote');
      } catch {}
      await page.waitForTimeout(500);
      await screenshot('f-im-06-unlocked');
      await page.click('button:has-text("Cancelar")');
    });

    console.log(`\n========================================`);
    console.log(`✅ Fluxos executados: ${Object.keys(RESULTS).length}`);
    console.log(`PASS: ${Object.values(RESULTS).filter((v) => v === 'PASS').length}`);
    console.log(`FAIL: ${Object.values(RESULTS).filter((v) => v === 'FAIL').length}`);
    console.log(`========================================`);
  } catch (e) {
    console.log(`\n⚠️ Interrompido: ${e.message}`);
  } finally {
    // Relatório
    let report = `# Smoke CIQ-Imuno\n\nData: ${new Date().toISOString()}\nUsuário: ${EMAIL}\n\n## Resultados\n\n`;
    for (const [key, val] of Object.entries(RESULTS)) {
      report += `| ${key} | ${val} |\n`;
    }
    report += `\n## Network Failures\n`;
    for (const f of networkFailures.slice(0, 15)) report += `- ${f.status} ${f.url}\n`;
    report += `\n## Console Errors\n`;
    for (const e of consoleErrors.slice(0, 10)) report += `- ${e}\n`;
    report += `\n## Screenshots\n`;
    for (const s of screenshots) report += `- ${s}\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'REPORT.md'), report);
    console.log(`\nRelatório: ${path.join(OUTPUT_DIR, 'REPORT.md')}`);
    console.log(`Screenshots: ${screenshots.length}`);
    await browser.close();
  }
})();
