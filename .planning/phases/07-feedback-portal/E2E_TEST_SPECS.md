# Phase 7 — E2E Test Specifications (Detox)

**Framework:** Detox v20+  
**Platforms:** iOS + Android emulator  
**Test Count:** 8 critical flows  
**Coverage:** NPS submission, suggestions, trending analytics, email triggers, anonimização

---

## Test 1: Public NPS Submission via Token Link

**File:** `e2e/satisfacao/01-npsPortalPublic.e2e.ts`  
**Duration:** ~45 seconds

```typescript
describe('NPS Portal — Public (No Auth)', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  it('should submit NPS via token-based link and show success', async () => {
    // 1. Navigate to NPS link (simulated via direct URL)
    const npsToken = generateTestToken({
      lauroId: 'test-lauro-123',
      pacienteId: 'test-paciente-456',
      labId: 'test-lab-789',
    });

    await device.openURL({
      url: `hmatologia2://portal-paciente/nps/${npsToken}`,
    });

    // 2. Verify form loads
    await waitFor(element(by.id('nps-score-selector')))
      .toBeVisible()
      .withTimeout(2000);

    // 3. Select score 9 (promotor, green)
    await element(by.id('score-button-9')).multiTap();
    await expect(element(by.id('sentiment-preview'))).toHaveText('Promoter feedback');

    // 4. Enter comment
    await element(by.id('comment-input')).typeText('Excelente atendimento!');
    await expect(element(by.id('char-counter'))).toHaveText('22 / 500');

    // 5. Tap submit button
    await element(by.id('submit-button')).multiTap();

    // 6. Verify reCAPTCHA v3 (mock in emulator)
    await waitFor(element(by.id('recaptcha-badge')))
      .toBeVisible()
      .withTimeout(1000);

    // 7. Verify success toast + redirect
    await waitFor(element(by.text('Obrigado! Sua opinião importa.')))
      .toBeVisible()
      .withTimeout(3000);

    await waitFor(element(by.id('thank-you-screen')))
      .toBeVisible()
      .withTimeout(4000);

    // 8. Verify Firestore write (via test helper)
    const npsResposta = await getFirestoreDoc(`labs/test-lab-789/satisfacao-respostas`, {
      pacienteId: 'test-paciente-456',
    });
    expect(npsResposta).toBeDefined();
    expect(npsResposta.nota).toBe(9);
    expect(npsResposta.categoria).toBe('promotor');
    expect(npsResposta.comentario).toBe('Excelente atendimento!');
    expect(npsResposta.signature).toBeDefined();
    expect(npsResposta.signature.hash.length).toBe(64);
  });

  it('should reject token that is expired', async () => {
    const expiredToken = generateTestToken(
      { lauroId: 'test', pacienteId: 'test', labId: 'test-lab-789' },
      { expiresIn: '-1h' }, // expired
    );

    await device.openURL({
      url: `hmatologia2://portal-paciente/nps/${expiredToken}`,
    });

    await waitFor(element(by.text('Token expirado. Solicite um novo.')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should rate-limit 5 submissions per IP', async () => {
    // Submit 5 valid NPSs
    for (let i = 0; i < 5; i++) {
      const token = generateTestToken({ labId: 'test-lab-789' });
      await device.openURL({
        url: `hmatologia2://portal-paciente/nps/${token}`,
      });
      await element(by.id('score-button-5')).multiTap();
      await element(by.id('submit-button')).multiTap();
      await waitFor(element(by.id('thank-you-screen'))).toBeVisible();
      await device.goBack();
      await device.openURL({ url: 'hmatologia2://home' }); // reset
    }

    // 6th submission should fail
    const sixthToken = generateTestToken({ labId: 'test-lab-789' });
    await device.openURL({
      url: `hmatologia2://portal-paciente/nps/${sixthToken}`,
    });
    await element(by.id('score-button-5')).multiTap();
    await element(by.id('submit-button')).multiTap();

    await waitFor(element(by.text('Muitas submissões. Tente novamente em 1 hora.')))
      .toBeVisible()
      .withTimeout(2000);
  });
});
```

---

## Test 2: Authenticated Patient NPS (Post-Complaint Closure)

**File:** `e2e/satisfacao/02-npsPortalAuth.e2e.ts`  
**Duration:** ~60 seconds

```typescript
describe('NPS Portal — Authenticated (Post-Complaint Closure)', () => {
  const testPatient = {
    uid: 'patient-123',
    email: 'patient@test.com',
    password: 'Test@123456',
  };

  beforeAll(async () => {
    // Create test patient + complaint
    await initializeFirestoreEmulator();
    await createTestPatient(testPatient);
    await createTestComplaint({
      labId: 'test-lab-789',
      pacienteId: testPatient.uid,
      status: 'Nova',
    });
  });

  it('should open NPS form on complaint marked Resolvida', async () => {
    // 1. Login
    await device.openURL({ url: 'hmatologia2://login' });
    await element(by.id('email-input')).typeText(testPatient.email);
    await element(by.id('password-input')).typeText(testPatient.password);
    await element(by.id('login-button')).multiTap();

    await waitFor(element(by.id('dashboard-home')))
      .toBeVisible()
      .withTimeout(3000);

    // 2. Navigate to complaint detail
    await element(by.id('complaints-tab')).multiTap();
    await waitFor(element(by.text('Minhas Reclamações')))
      .toBeVisible()
      .withTimeout(2000);

    await element(by.id('complaint-item-0')).multiTap();

    // 3. Verify status is Nova
    await expect(element(by.id('complaint-status'))).toHaveText('Nova');

    // 4. Simulate complaint marked Resolvida (backend-driven)
    await updateTestComplaint({
      labId: 'test-lab-789',
      id: 'complaint-0',
      status: 'Resolvida',
    });

    // 5. Refresh screen (pull-to-refresh)
    await element(by.id('complaint-detail-scroll')).multiTap();
    await device.setBiometricEnrollment(true); // mock refresh trigger

    // 6. Verify NPS notification appears
    await waitFor(element(by.text('Sua reclamação foi resolvida. Avalie sua experiência.')))
      .toBeVisible()
      .withTimeout(3000);

    // 7. Tap NPS link
    await element(by.id('nps-notification-button')).multiTap();

    // 8. Form opens with pre-filled reclamacaoId
    await waitFor(element(by.id('nps-score-selector')))
      .toBeVisible()
      .withTimeout(2000);

    // Verify reclamacaoId is linked (hidden field)
    const formData = await element(by.id('nps-form')).getAttributes();
    expect(formData.reclamacaoId).toBe('complaint-0');

    // 9. Submit NPS
    await element(by.id('score-button-7')).multiTap();
    await element(by.id('submit-button')).multiTap();

    // 10. Verify complaint status updated to Fechada
    await waitFor(element(by.id('thank-you-screen')))
      .toBeVisible()
      .withTimeout(3000);

    const updatedComplaint = await getFirestoreDoc(`labs/test-lab-789/reclamacoes/complaint-0`);
    expect(updatedComplaint.status).toBe('Fechada');
    expect(updatedComplaint.npsRespostaId).toBeDefined();
  });
});
```

---

## Test 3: Staff Suggestion Submission (Mobile PWA)

**File:** `e2e/sugestoes/03-suggestionsIntakeMobile.e2e.ts`  
**Duration:** ~50 seconds

```typescript
describe('Suggestions Intake — Mobile PWA', () => {
  const testTech = {
    uid: 'tech-456',
    email: 'tech@test.com',
    password: 'Test@123456',
  };

  beforeAll(async () => {
    await createTestUser(testTech, { role: 'colaborador' });
  });

  it('should submit suggestion via mobile PWA with touch-optimized form', async () => {
    // 1. Login
    await device.openURL({ url: 'hmatologia2://login' });
    await element(by.id('email-input')).typeText(testTech.email);
    await element(by.id('password-input')).typeText(testTech.password);
    await element(by.id('login-button')).multiTap();

    // 2. Navigate to suggestions
    await waitFor(element(by.id('hub-screen')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('suggestions-tile')).multiTap();

    // 3. Tap "Nova Sugestão"
    await element(by.id('new-suggestion-button')).multiTap();

    // 4. Verify mobile-optimized form layout
    await waitFor(element(by.id('suggestion-form')))
      .toBeVisible()
      .withTimeout(2000);

    // Form should be full-screen on mobile
    const formAttrs = await element(by.id('suggestion-form')).getAttributes();
    expect(formAttrs.width).toBeGreaterThan(300); // at least device width

    // 5. Enter title (10–100 chars)
    const titleInput = element(by.id('titulo-input'));
    await titleInput.typeText('Upgrade reagente X para versão 2.0');

    // 6. Select category (2×2 grid on mobile)
    await element(by.id('categoria-produto')).multiTap();
    await expect(element(by.id('categoria-produto'))).toHaveToggleValue(true);

    // 7. Enter description (50–2000 chars)
    const descInput = element(by.id('descricao-input'));
    const descText = 'A nova versão melhora a sensibilidade em 15% e reduz custo unitário em 8%.';
    await descInput.typeText(descText);

    // 8. Verify char counter
    await expect(element(by.id('descricao-counter'))).toHaveText(`${descText.length} / 2000`);

    // 9. Verify submit button is enabled
    await expect(element(by.id('submit-suggestion-button'))).toBeEnabled();

    // 10. Submit
    await element(by.id('submit-suggestion-button')).multiTap();

    // 11. Verify success toast (full-width on mobile)
    await waitFor(element(by.text('Sugestão enviada! Obrigado.')))
      .toBeVisible()
      .withTimeout(3000);

    // 12. Verify form reset
    await expect(element(by.id('titulo-input'))).toHaveText('');

    // 13. Verify Firestore entry
    const sugestao = await getFirestoreDoc(`labs/test-lab-789/sugestoes`, {
      autorId: testTech.uid,
    });
    expect(sugestao).toBeDefined();
    expect(sugestao.titulo).toBe('Upgrade reagente X para versão 2.0');
    expect(sugestao.categoria).toBe('produto');
    expect(sugestao.status).toBe('aberta');
    expect(sugestao.votos).toBe(0);
  });

  it('should prevent submission with title < 10 chars', async () => {
    await element(by.id('new-suggestion-button')).multiTap();
    await element(by.id('titulo-input')).typeText('Short');
    await expect(element(by.id('submit-suggestion-button'))).toBeDisabled();

    const error = element(by.id('titulo-error'));
    await expect(error).toHaveText('Mínimo 10 caracteres');
  });
});
```

---

## Test 4: Suggestion Upvoting (Dedup)

**File:** `e2e/sugestoes/04-upvoteSuggestion.e2e.ts`  
**Duration:** ~40 seconds

```typescript
describe('Suggestions — Upvote Deduplication', () => {
  const tech1 = { uid: 'tech-1', email: 'tech1@test.com', password: 'Test@123456' };
  const tech2 = { uid: 'tech-2', email: 'tech2@test.com', password: 'Test@123456' };

  beforeAll(async () => {
    await createTestUser(tech1, { role: 'colaborador' });
    await createTestUser(tech2, { role: 'colaborador' });
    await createTestSuggestion({
      labId: 'test-lab-789',
      id: 'sugestao-0',
      titulo: 'Test suggestion',
      status: 'aberta',
      votos: 0,
    });
  });

  it('should allow upvoting and prevent duplicate votes', async () => {
    // 1. Login as tech1
    await device.openURL({ url: 'hmatologia2://login' });
    await element(by.id('email-input')).typeText(tech1.email);
    await element(by.id('password-input')).typeText(tech1.password);
    await element(by.id('login-button')).multiTap();

    // 2. Navigate to suggestions
    await element(by.id('hub-screen')).swipe({ direction: 'left' }); // scroll
    await element(by.id('suggestions-tile')).multiTap();

    // 3. Find suggestion in list
    await waitFor(element(by.text('Test suggestion')))
      .toBeVisible()
      .withTimeout(2000);

    // 4. Upvote button shows "👍 0"
    await expect(element(by.id('upvote-button-sugestao-0'))).toHaveText('👍 0');

    // 5. Tap upvote
    await element(by.id('upvote-button-sugestao-0')).multiTap();

    // 6. Button updates to "👍 1" + highlights
    await expect(element(by.id('upvote-button-sugestao-0'))).toHaveText('👍 1');

    const upvoteAttrs = await element(by.id('upvote-button-sugestao-0')).getAttributes();
    expect(upvoteAttrs.backgroundColor).toContain('emerald'); // emerald-500

    // 7. Try to upvote again (should be no-op)
    await element(by.id('upvote-button-sugestao-0')).multiTap();
    await expect(element(by.id('upvote-button-sugestao-0'))).toHaveText('👍 1'); // still 1, not 2

    // 8. Login as tech2, verify they can upvote independently
    await element(by.id('profile-menu')).multiTap();
    await element(by.id('logout-button')).multiTap();

    await device.openURL({ url: 'hmatologia2://login' });
    await element(by.id('email-input')).typeText(tech2.email);
    await element(by.id('password-input')).typeText(tech2.password);
    await element(by.id('login-button')).multiTap();

    await element(by.id('hub-screen')).swipe({ direction: 'left' });
    await element(by.id('suggestions-tile')).multiTap();

    await waitFor(element(by.text('Test suggestion')))
      .toBeVisible()
      .withTimeout(2000);

    // 9. tech2 sees "👍 1" (tech1's vote)
    await expect(element(by.id('upvote-button-sugestao-0'))).toHaveText('👍 1');

    // 10. tech2 upvotes
    await element(by.id('upvote-button-sugestao-0')).multiTap();

    // 11. Button updates to "👍 2"
    await expect(element(by.id('upvote-button-sugestao-0'))).toHaveText('👍 2');

    // 12. Verify votaraisPor in Firestore
    const sugestao = await getFirestoreDoc(`labs/test-lab-789/sugestoes/sugestao-0`);
    expect(sugestao.votos).toBe(2);
    expect(sugestao.votaraisPor).toContain(tech1.uid);
    expect(sugestao.votaraisPor).toContain(tech2.uid);
    expect(sugestao.votaraisPor.length).toBe(2); // no duplicates
  });
});
```

---

## Test 5: Trending Dashboard — NPS Chart

**File:** `e2e/satisfacao/05-trendingDashboard.e2e.ts`  
**Duration:** ~55 seconds

```typescript
describe('Trending Dashboard — NPS Line Chart', () => {
  const admin = {
    uid: 'admin-789',
    email: 'admin@test.com',
    password: 'Test@123456',
  };

  beforeAll(async () => {
    // Create admin user
    await createTestUser(admin, { role: 'responsavelTecnico' });

    // Seed NPS responses for 3 months
    const npsData = [
      { mes: '2026-03', score: 35, respondentes: 28 },
      { mes: '2026-04', score: 45, respondentes: 42 },
      { mes: '2026-05', score: 55, respondentes: 38 },
    ];

    for (const month of npsData) {
      await createTestNPSTrendingAggregate({
        labId: 'test-lab-789',
        mes: month.mes,
        npsScore: month.score,
        respondentes: month.respondentes,
      });
    }
  });

  it('should render 3-month NPS trend line chart', async () => {
    // 1. Login
    await device.openURL({ url: 'hmatologia2://login' });
    await element(by.id('email-input')).typeText(admin.email);
    await element(by.id('password-input')).typeText(admin.password);
    await element(by.id('login-button')).multiTap();

    // 2. Navigate to trending dashboard
    await element(by.id('hub-screen')).swipe({ direction: 'left' });
    await element(by.id('analytics-tile')).multiTap();

    // 3. Verify dashboard loads
    await waitFor(element(by.id('trending-dashboard')))
      .toBeVisible()
      .withTimeout(3000);

    // 4. Verify line chart is visible
    await waitFor(element(by.id('nps-trend-chart')))
      .toBeVisible()
      .withTimeout(2000);

    // 5. Verify 3 data points rendered (Recharts canvas)
    const chartPoints = await element(by.id('nps-trend-chart')).getAttributes();
    expect(chartPoints.childrenCount).toBe(3); // Mar, Apr, May

    // 6. Hover over May 2026 point
    await element(by.id('nps-chart-point-2')).multiTap(); // tap instead of hover on mobile

    // 7. Verify tooltip appears with "May 2026: +55 (38 responses, 85% participation)"
    await waitFor(element(by.text('Maio 2026: +55')))
      .toBeVisible()
      .withTimeout(1500);

    const tooltip = element(by.text('38 respostas'));
    await expect(tooltip).toBeVisible();

    // 8. Verify line color is violet-500
    const line = await element(by.id('nps-trend-line')).getAttributes();
    expect(line.stroke).toContain('violet') || expect(line.stroke).toContain('9333ea');

    // 9. Tap "Last 6 months" filter
    await element(by.id('filter-last-6-months')).multiTap();

    // 10. Chart updates (should have more points or same if <6mo data)
    await waitFor(element(by.id('nps-trend-chart')))
      .toExist()
      .withTimeout(2000);

    // 11. Reset to "Last 3 months"
    await element(by.id('filter-last-3-months')).multiTap();
  });
});
```

---

## Test 6: RCA Word Cloud (Phase 7.2+)

**File:** `e2e/satisfacao/06-rcaWordcloud.e2e.ts`  
**Duration:** ~50 seconds

```typescript
describe('Trending Dashboard — RCA Word Cloud', () => {
  const admin = { uid: 'admin-789', email: 'admin@test.com', password: 'Test@123456' };

  beforeAll(async () => {
    // Seed RCA word cloud data
    await createTestRCAWordcloudAggregate({
      labId: 'test-lab-789',
      mes: '2026-05',
      topWords: [
        { word: 'Calibração', count: 8, frequencia: 0.35 },
        { word: 'Reagente', count: 6, frequencia: 0.26 },
        { word: 'Temperatura', count: 5, frequencia: 0.22 },
        { word: 'Equipamento', count: 4, frequencia: 0.17 },
      ],
    });
  });

  it('should display RCA word cloud with frequency-based sizing', async () => {
    // 1. Login
    await device.openURL({ url: 'hmatologia2://login' });
    await element(by.id('email-input')).typeText(admin.email);
    await element(by.id('password-input')).typeText(admin.password);
    await element(by.id('login-button')).multiTap();

    // 2. Navigate to trending dashboard
    await element(by.id('analytics-tile')).multiTap();

    // 3. Verify word cloud is visible
    await waitFor(element(by.id('rca-wordcloud')))
      .toBeVisible()
      .withTimeout(3000);

    // 4. Verify top 4 words are rendered
    await expect(element(by.text('Calibração'))).toBeVisible();
    await expect(element(by.text('Reagente'))).toBeVisible();
    await expect(element(by.text('Temperatura'))).toBeVisible();
    await expect(element(by.text('Equipamento'))).toBeVisible();

    // 5. Verify font size correlation (largest = highest frequency)
    const calibracaoAttrs = await element(by.text('Calibração')).getAttributes();
    const reagenteAttrs = await element(by.text('Reagente')).getAttributes();
    const temperAttrs = await element(by.text('Temperatura')).getAttributes();

    expect(parseFloat(calibracaoAttrs.fontSize)).toBeGreaterThan(
      parseFloat(reagenteAttrs.fontSize),
    );
    expect(parseFloat(reagenteAttrs.fontSize)).toBeGreaterThan(parseFloat(temperAttrs.fontSize));

    // 6. Click "Calibração" to filter complaints
    await element(by.text('Calibração')).multiTap();

    // 7. Verify list view updates
    await waitFor(element(by.id('complaint-list')))
      .toBeVisible()
      .withTimeout(2000);

    // 8. Verify all shown complaints have "Calibração" in RCA
    const complaints = await element(by.id('complaint-list')).getAttributes();
    expect(complaints.filteredBy).toBe('Calibração');
  });
});
```

---

## Test 7: Anonimização Cron (Server-side Unit Test)

**File:** `functions/__tests__/scheduled-tasks/07-anonimizarRespostas.test.ts`  
**Duration:** ~30 seconds (unit test, not E2E)

```typescript
import { initializeAdminApp, clearFirestore } from '../../test-utils';
import { anonimizarRespostas } from '../../scheduled-tasks/anonimizarRespostas';

describe('anonimizarRespostas — Scheduled Cron (03:00 BRT)', () => {
  let db: FirebaseFirestore.Firestore;

  beforeAll(() => {
    db = initializeAdminApp();
  });

  afterEach(async () => {
    await clearFirestore();
  });

  it('should anonymize NPSRespostas >90 days old', async () => {
    const labId = 'test-lab-789';
    const ninetyFiveDaysAgo = Timestamp.fromMillis(Date.now() - 95 * 24 * 60 * 60 * 1000);

    // Create old NPS response
    const oldResposta = {
      id: 'old-resposta',
      labId,
      pacienteId: 'patient-123',
      cpfHash: 'hash-of-cpf',
      nota: 7,
      categoria: 'neutro',
      comentario: 'Bom atendimento. Meu CPF: 123.456.789-00',
      respondidoEm: ninetyFiveDaysAgo,
      ipHash: 'ip-hash-123',
      anonimizadoEm: null,
      piiMask: false,
      signature: {
        hash: 'a'.repeat(64),
        operatorId: 'system',
        ts: ninetyFiveDaysAgo,
      },
      criadoEm: ninetyFiveDaysAgo,
      deletadoEm: null,
    };

    await setDoc(doc(db, 'labs', labId, 'satisfacao-respostas', 'old-resposta'), oldResposta);

    // Run cron
    await anonimizarRespostas(mockContext);

    // Verify: pacienteId nulled, PII filtered
    const updated = await getDoc(doc(db, 'labs', labId, 'satisfacao-respostas', 'old-resposta'));
    const data = updated.data() as any;

    expect(data.pacienteId).toBeNull();
    expect(data.anonimizadoEm).toBeDefined();
    expect(data.anonimizadoEm.seconds).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    expect(data.comentario).toContain('[REDACTED]');
    expect(data.comentario).not.toContain('123.456.789-00');
    expect(data.piiMask).toBe(true);
    expect(data.cpfHash).toBe('hash-of-cpf'); // retained for analytics
  });

  it('should NOT anonymize NPSRespostas <90 days old', async () => {
    const labId = 'test-lab-789';
    const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentResposta = {
      id: 'recent-resposta',
      labId,
      pacienteId: 'patient-456',
      cpfHash: 'hash-of-cpf-456',
      nota: 9,
      categoria: 'promotor',
      comentario: 'Excellent!',
      respondidoEm: thirtyDaysAgo,
      ipHash: 'ip-hash-456',
      anonimizadoEm: null,
      piiMask: false,
      signature: {
        hash: 'b'.repeat(64),
        operatorId: 'system',
        ts: thirtyDaysAgo,
      },
      criadoEm: thirtyDaysAgo,
      deletadoEm: null,
    };

    await setDoc(doc(db, 'labs', labId, 'satisfacao-respostas', 'recent-resposta'), recentResposta);

    // Run cron
    await anonimizarRespostas(mockContext);

    // Verify: unchanged
    const noChange = await getDoc(
      doc(db, 'labs', labId, 'satisfacao-respostas', 'recent-resposta'),
    );
    const data = noChange.data() as any;

    expect(data.pacienteId).toBe('patient-456');
    expect(data.anonimizadoEm).toBeNull();
    expect(data.comentario).toBe('Excellent!');
    expect(data.piiMask).toBe(false);
  });

  it('should create audit log entry for anonymization batch', async () => {
    const labId = 'test-lab-789';
    const ninetyFiveDaysAgo = Timestamp.fromMillis(Date.now() - 95 * 24 * 60 * 60 * 1000);

    // Create 3 old responses
    for (let i = 0; i < 3; i++) {
      const resposta = {
        id: `old-resposta-${i}`,
        labId,
        pacienteId: `patient-${i}`,
        cpfHash: `hash-${i}`,
        nota: 5 + i,
        categoria: 'detrator',
        comentario: 'Not great.',
        respondidoEm: ninetyFiveDaysAgo,
        ipHash: `ip-${i}`,
        anonimizadoEm: null,
        piiMask: false,
        signature: { hash: 'c'.repeat(64), operatorId: 'system', ts: ninetyFiveDaysAgo },
        criadoEm: ninetyFiveDaysAgo,
        deletadoEm: null,
      };

      await setDoc(doc(db, 'labs', labId, 'satisfacao-respostas', `old-resposta-${i}`), resposta);
    }

    // Run cron
    await anonimizarRespostas(mockContext);

    // Verify audit log entry
    const auditLogs = await getDocs(
      query(
        collection(db, 'labs', labId, 'anonimizacao-audit'),
        where('tipo', '==', 'nps-anonymization'),
      ),
    );

    expect(auditLogs.docs.length).toBeGreaterThan(0);
    const latestAudit = auditLogs.docs[0].data();
    expect(latestAudit.quantidadeAnonimizada).toBe(3);
    expect(latestAudit.dataExecucao).toBeDefined();
  });
});
```

---

## Test 8: Complaint Closure → NPS Email Trigger

**File:** `e2e/reclamacoes/08-closureNPSTrigger.e2e.ts`  
**Duration:** ~60 seconds

```typescript
describe('Complaint Closure — NPS Email Trigger', () => {
  const tech = {
    uid: 'tech-123',
    email: 'tech@test.com',
    password: 'Test@123456',
  };

  const patient = {
    uid: 'patient-999',
    email: 'patient@test.com',
    name: 'Test Patient',
  };

  beforeAll(async () => {
    await createTestUser(tech, { role: 'responsavelTecnico' });
    await createTestUser(patient, { role: 'paciente' });
    await createTestComplaint({
      labId: 'test-lab-789',
      id: 'complaint-closure-test',
      pacienteId: patient.uid,
      status: 'Nova',
      descricao: 'Laudo tinha erros',
    });
  });

  it('should send NPS email when complaint marked Resolvida', async () => {
    // 1. Login as RT
    await device.openURL({ url: 'hmatologia2://login' });
    await element(by.id('email-input')).typeText(tech.email);
    await element(by.id('password-input')).typeText(tech.password);
    await element(by.id('login-button')).multiTap();

    // 2. Navigate to complaints
    await element(by.id('hub-screen')).swipe({ direction: 'left' });
    await element(by.id('complaints-tile')).multiTap();

    // 3. Find test complaint
    await waitFor(element(by.text('Laudo tinha erros')))
      .toBeVisible()
      .withTimeout(2000);

    await element(by.id('complaint-item-complaint-closure-test')).multiTap();

    // 4. Verify status is "Nova"
    await expect(element(by.id('complaint-status'))).toHaveText('Nova');

    // 5. Tap "Mark as Resolved" button
    await element(by.id('mark-resolved-button')).multiTap();

    // 6. RCA check dialog (if severity=alta, require RCA)
    const rcaPrompt = element(by.id('rca-required-dialog'));
    if (await rcaPrompt.isVisible()) {
      // Complaint is high-severity; skip RCA for now
      await element(by.id('skip-rca-button')).multiTap();
    }

    // 7. Confirm closure
    await element(by.id('confirm-closure-button')).multiTap();

    // 8. Verify status updated to "Resolvida"
    await waitFor(element(by.id('complaint-status')))
      .toHaveText('Resolvida')
      .withTimeout(2000);

    // 9. Backend: callable dispatchNPSPostLaudo triggered (verify via Cloud Logs)
    // In test environment, we mock email delivery
    await waitFor(() => {
      return expectEmailSent({
        to: patient.email,
        subject: 'Sua opinião é importante',
      });
    }).withTimeout(5000);

    // 10. Verify email contains NPS link with token
    const emailContent = await getLastEmailContent(patient.email);
    expect(emailContent.html).toContain('Avaliar Experiência');
    expect(emailContent.html).toContain('portal-paciente/nps/');

    // 11. Extract token from email
    const tokenMatch = emailContent.html.match(/portal-paciente\/nps\/([^"]+)/);
    const npsToken = tokenMatch ? tokenMatch[1] : null;
    expect(npsToken).toBeDefined();

    // 12. Patient opens email link
    await device.openURL({
      url: `hmatologia2://portal-paciente/nps/${npsToken}`,
    });

    // 13. NPS form loads
    await waitFor(element(by.id('nps-score-selector')))
      .toBeVisible()
      .withTimeout(2000);

    // 14. Submit NPS (score 8)
    await element(by.id('score-button-8')).multiTap();
    await element(by.id('submit-button')).multiTap();

    // 15. Verify complaint status updated to "Fechada"
    const complaint = await getFirestoreDoc(`labs/test-lab-789/reclamacoes/complaint-closure-test`);
    expect(complaint.status).toBe('Fechada');
    expect(complaint.npsRespostaId).toBeDefined();
    expect(complaint.npsResponseReceivedAt).toBeDefined();

    // 16. Verify audit trail
    const auditEntries = await getDocs(
      query(
        collection(db, 'labs', 'test-lab-789', 'feedback-audit'),
        where('tipo', '==', 'nps-dispatch-post-laudo'),
      ),
    );
    expect(auditEntries.docs.length).toBeGreaterThan(0);
  });
});
```

---

## Running All Tests

```bash
# Install Detox (if not already)
npm install detox-cli --save-dev
npm install detox --save-dev

# Build test app (iOS)
detox build-framework-cache
detox build-framework-cache --name ios.sim.release

# Run all E2E tests
detox test e2e --cleanup --record-logs all

# Run specific test
detox test e2e/satisfacao/01-npsPortalPublic.e2e.ts --cleanup

# Run on Android (if applicable)
detox test e2e --configuration android.emu.release --cleanup
```

---

## Test Data Fixtures

```typescript
// test-utils.ts

export function generateTestToken(
  payload: {
    lauroId?: string;
    pacienteId?: string;
    labId: string;
    reclamacaoId?: string;
    trimestre?: string;
  },
  options?: { expiresIn?: string },
): string {
  const expiresIn = options?.expiresIn || '7d';
  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.NPS_TOKEN_SECRET,
    { expiresIn },
  );
}

export async function createTestSuggestion(data: Partial<Sugestao>) {
  const ref = doc(collection(db, 'labs', data.labId, 'sugestoes'));
  await setDoc(ref, {
    id: data.id || ref.id,
    ...data,
  });
}

export async function expectEmailSent(criteria: {
  to: string;
  subject?: string;
}): Promise<boolean> {
  // Mock email service (Resend) stores sent emails
  const sent = await getResendMockStore().getEmails();
  return sent.some(
    (e) => e.to === criteria.to && (!criteria.subject || e.subject.includes(criteria.subject)),
  );
}
```

---

**Test Coverage Summary:**

- ✅ Public NPS submission (token-based)
- ✅ Authenticated NPS (post-complaint)
- ✅ Staff suggestion intake (mobile PWA)
- ✅ Suggestion upvoting (dedup)
- ✅ Trending dashboard (NPS chart)
- ✅ RCA word cloud
- ✅ Anonimização cron
- ✅ Complaint closure → NPS trigger

**All tests use Firestore emulator + mocked email service for isolation.**
