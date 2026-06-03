import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/manual/screenshots/coag');
const FS_BASE =
  'https://firestore.googleapis.com/v1/projects/hmatologia2/databases/(default)/documents';
const AUTH_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDXLZlp-vDfDDHI-JG1I91yIamTo65fwio';
const EMAIL = process.env.RT_EMAIL || 'drogafarto@gmail.com';
const PASS = process.env.RT_PASSWORD || '12345678';

async function restAuth(): Promise<string> {
  const r = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}

async function getUserLabIds(token: string): Promise<string[]> {
  const r = await fetch(`${FS_BASE}/labs`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json();
  return (data.documents || []).map((d: any) => d.name.split('/').pop());
}

async function seedControlAndAttempts(token: string, labId: string, uid: string): Promise<string> {
  const ctrlRes = await fetch(`${FS_BASE}/labs/${labId}/control-operacional`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        nome: { stringValue: 'Manual Screenshot Controle' },
        nivel: { stringValue: 'I' },
        status: { stringValue: 'ativo' },
        loteControle: { stringValue: 'LOT-SS-2026' },
        fabricanteControle: { stringValue: 'Bio-Rad' },
        validadeControle: { stringValue: '2027-12-31' },
        equipamentoId: { stringValue: 'Clotimer Duo' },
        criadoEm: { stringValue: new Date().toISOString() },
        criadoPor: { stringValue: uid },
        atualizadoEm: { stringValue: new Date().toISOString() },
      },
    }),
  });
  const ctrlData = await ctrlRes.json();
  const ctrlId = ctrlData.name?.split('/').pop() || '';

  const vals = [
    { ap: 100, rni: 0.97, ttpa: 33, c: 'A' },
    { ap: 98, rni: 0.95, ttpa: 34, c: 'A' },
    { ap: 102, rni: 0.99, ttpa: 32.5, c: 'A' },
    { ap: 105, rni: 1.01, ttpa: 33.5, c: 'A' },
    { ap: 95, rni: 0.94, ttpa: 35, c: 'A' },
    { ap: 101, rni: 0.98, ttpa: 32, c: 'A' },
    { ap: 87, rni: 0.88, ttpa: 37, c: 'A' },
    { ap: 100, rni: 0.96, ttpa: 33.5, c: 'A' },
    { ap: 131, rni: 1.2, ttpa: 24, c: 'R', v: ['1-3s'] },
    { ap: 95, rni: 0.93, ttpa: 34, c: 'A' },
  ];

  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    const d = new Date();
    d.setDate(d.getDate() - (vals.length - i - 1));
    const fields: any = {
      controlOperacionalId: { stringValue: ctrlId },
      resultados: {
        mapValue: {
          fields: {
            atividadeProtrombinica: { doubleValue: v.ap },
            rni: { doubleValue: v.rni },
            ttpa: { doubleValue: v.ttpa },
          },
        },
      },
      conformidade: { stringValue: v.c },
      data: { stringValue: d.toISOString() },
      operadorId: { stringValue: uid },
      criadoEm: { stringValue: d.toISOString() },
    };
    if (v.v) fields.violacoes = { arrayValue: { values: v.v.map((x) => ({ stringValue: x })) } };
    await fetch(`${FS_BASE}/labs/${labId}/attempts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  }
  return ctrlId;
}

function shot(page: Page, name: string) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  return page.screenshot({ path: p, fullPage: false }).then(() => {
    console.log(`  ${name}.png`);
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(page: Page, email: string, password: string) {
  console.log(`[auth] login: ${email}`);
  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Entrar")');
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), {
    timeout: 30000,
  });

  // Wait for either: (a) app ready with hub, or (b) lab selector
  await sleep(1500);

  // If lab selector screen appears, select first lab
  const labSelectorHeading = page.locator('h2:has-text("Selecione o laboratório")');
  if (await labSelectorHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('[auth] lab selector appeared');
    // LabRow buttons have bg-white/[0.04] class and contain lab name
    const firstLab = page.locator('button.bg-white\\/\\[0\\.04\\]').first();
    if (await firstLab.isVisible({ timeout: 2000 }).catch(() => false)) {
      const labName = await firstLab.innerText();
      await firstLab.click();
      console.log(`[auth] selected lab: ${labName?.trim().slice(0, 40)}`);
      await sleep(2000);
    }
  }

  // Wait for app to fully load
  await sleep(2000);
  console.log('[auth] logged in');
}

async function getLabId(page: Page): Promise<string> {
  // Try to get labId from Firestore SDK or from URL/state
  const labId = await page.evaluate(async () => {
    // Use Firebase SDK to get the currently selected lab
    try {
      const { getFirestore, doc, getDoc } =
        await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
      const { getApps, initializeApp, getApp } =
        await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
      const { getAuth } =
        await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');

      const app =
        getApps()[0] ||
        initializeApp({
          apiKey: 'AIzaSyDXLZlp-vDfDDHI-JG1I91yIamTo65fwio',
          authDomain: 'hmatologia2.firebaseapp.com',
          projectId: 'hmatologia2',
        });
      const auth = getAuth(app);
      if (auth.currentUser) {
        // Get user's custom claims or lab from users doc
        const db = getFirestore(app);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          return data?.activeLabId || data?.selectedLabId || '';
        }
      }
    } catch (e) {}
    return '';
  });
  console.log(`[lab] detected labId: ${labId}`);
  return labId || 'lab-1778299217184-v74s397xib';
}

async function navigateTo(page: Page, view: string) {
  await page.evaluate((v) => {
    // Tenta acessar o Zustand store via window
    const stores = (window as any).__ZUSTAND_STORES__;
    if (stores?.appStore) {
      stores.appStore.getState().setCurrentView(v);
      return;
    }
    // Fallback: navega via URL se app usa hash routing
    if (window.location.hash) {
      window.location.hash = `#/${v}`;
    }
  }, view);
  await sleep(500);

  // Verify navigation worked by checking if we're still on the same page
  const currentPath = await page.evaluate(() => window.location.pathname + window.location.hash);
  console.log(`[nav] navigated to: ${currentPath}`);
}

async function selectControl(page: Page) {
  const sel = page.locator('select').first();
  if (await sel.isVisible().catch(() => false)) {
    const opts = await sel.locator('option').count();
    if (opts > 0) {
      await sel.selectOption({ index: 0 });
      await sleep(800);
    }
  }
}

async function fillResults(page: Page, ap: string, rni: string, ttpa: string) {
  const inputs = page.locator('input[type="number"]');
  const count = await inputs.count();
  if (count >= 3) {
    await inputs.nth(0).fill(ap);
    await inputs.nth(1).fill(rni);
    await inputs.nth(2).fill(ttpa);
    await sleep(500);
  }
}

let seeded = false;

test.describe.serial('Coagulação v2 — Screenshots para Manual', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test.setTimeout(180000);

  test('Part 1: Formulário e resultados (01-11)', async ({ page }) => {
    if (!seeded) {
      console.log('\n[seed] Seed via REST...');
      const token = await restAuth();
      const uid = (
        await fetch(AUTH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
        }).then((r) => r.json())
      ).localId;
      const labs = await getUserLabIds(token);
      console.log(`[seed] user has ${labs.length} labs, seeding first 5`);
      for (const lid of labs.slice(0, 5)) {
        const cid = await seedControlAndAttempts(token, lid, uid);
        console.log(`[seed] lab ${lid}: ctrl=${cid}, 10 attempts`);
      }
      seeded = true;
    }

    const email = EMAIL;
    const pass = PASS;

    await page.setViewportSize({ width: 1440, height: 900 });

    await login(page, email, pass);
    await shot(page, '01-hub-inicial');

    await page.click('text="Coagulação v2"');
    await sleep(1500);
    await shot(page, '02-modulehub-coag-aberto');

    await sleep(500);
    await shot(page, '03-formulario-vazio');

    await selectControl(page);
    await shot(page, '04-form-com-controle');

    await fillResults(page, '98', '0.96', '32');
    await shot(page, '05-resultados-preenchidos');

    await fillResults(page, '100', '0.97', '33');
    await sleep(300);
    await shot(page, '06-resultados-conforme');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(800);
    await shot(page, '07-levey-jennings-vazio');

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await fillResults(page, '135', '1.25', '25');
    await sleep(300);
    await shot(page, '08-resultados-nao-conforme');

    const ta = page.locator('textarea').first();
    if (await ta.isVisible().catch(() => false)) {
      await ta.fill(
        'Repetir análise com novo lote de controle. Verificar calibração do equipamento.',
      );
      await sleep(300);
    }
    await shot(page, '09-acao-corretiva');

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await fillResults(page, '99', '0.97', '33');
    await sleep(300);
    const saveBtn = page.locator('button:has-text("Salvar")').first();
    if (await saveBtn.isEnabled().catch(() => false)) {
      await saveBtn.click();
      await sleep(2000);
    }
    await shot(page, '10-salvou-sucesso');

    const novaBtn = page.locator('button:has-text("Nova tentativa")').first();
    if (await novaBtn.isVisible().catch(() => false)) {
      await novaBtn.click();
      await sleep(1000);
    }
    await navigateTo(page, 'coagulacao-v2');
    await sleep(1500);
    await selectControl(page);
    await fillResults(page, '78', '0.82', '40');
    await sleep(500);
    await shot(page, '11-violacao-westgard');

    console.log('\n✅ Part 1 concluída (screenshots 01-11)');
  });

  test.setTimeout(180000);

  test('Part 2: Levey-Jennings e Painel RT (12-17)', async ({ page }) => {
    const email = EMAIL;
    const pass = PASS;

    await page.setViewportSize({ width: 1440, height: 900 });

    await login(page, email, pass);
    await page.click('text="Coagulação v2"');
    await sleep(3000);
    await selectControl(page);
    await sleep(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);
    await shot(page, '12-levey-jennings-populado');

    // RT Panel: navigate via sidebar if RT link exists
    const rtLink = page.locator('text="Painel RT"').first();
    if (await rtLink.isVisible().catch(() => false)) {
      await rtLink.click();
      await sleep(2000);
      await shot(page, '13-painel-rt');
    } else {
      console.log('[part2] Painel RT link nao encontrado - view sem acesso na sidebar');
      await shot(page, '13-coag-v2-view');
    }

    console.log(`\n✅ Part 2 concluída`);
    console.log(`\n📸 All screenshots saved to: ${SCREENSHOT_DIR}`);
  });
});
