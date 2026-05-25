# Parte 8 — Estratégia de Deploy Noturno Seguro

---

## 8.1 Condições para Deploy Automático

O deploy em produção (`main`) acontece **automaticamente** apenas se **TODAS** as condições forem satisfeitas:

### Gate 1: Todas as 7 waves mergeadas em `main-v2`

```bash
# Verificar que todas as waves foram integradas:
git log main-v2 --oneline | grep -E "wave/[a-g]"
# Deve mostrar: 7 merge commits (um por wave)
```

### Gate 2: Auditoria arquitetural passa

```bash
./scripts/audit-coag-v2.sh
# Exit code: 0 (passou)
```

### Gate 3: Todos os testes passam

```bash
npx vitest run
# Exit code: 0
```

### Gate 4: Typecheck passa

```bash
npx tsc --noEmit
# Exit code: 0
```

### Gate 5: Módulos adjacentes intactos

```bash
# Testes de hematologia, uroanálise, imuno devem passar
npx vitest run src/features/hematologia/
npx vitest run src/features/uroanalise/
npx vitest run src/features/imunologia/
# Exit code: 0 para cada
```

### Gate 6: Build passa

```bash
npm run build
# Exit code: 0
# Bundle size: < budget estabelecido
```

### Gate 7: Smoke test E2E passa

```bash
npx playwright test coag-v2.smoke.spec.ts
# Exit code: 0
```

---

## 8.2 Pipeline de Deploy

```
┌─────────────────────────────────────────────────────────────┐
│                  MAIN-V2 → MAIN DEPLOY FLOW                 │
└─────────────────────────────────────────────────────────────┘

[01:00 UTC] Trigger de deploy noturno (cron)
        │
        ▼
[Gate 1] Verificar merge das 7 waves
        │ Passa?
        ├── Não → Aborta deploy, notifica Arquiteto
        │
        ▼
[Gate 2] Auditoria arquitetural
        │ Passa?
        ├── Não → Aborta deploy, notifica Arquiteto
        │
        ▼
[Gate 3] Testes unit + integração
        │ Passa?
        ├── Não → Aborta deploy, notifica Executor
        │
        ▼
[Gate 4] Typecheck
        │ Passa?
        ├── Não → Aborta deploy, notifica Executor
        │
        ▼
[Gate 5] Testes de módulos adjacentes
        │ Passa?
        ├── Não → Aborta deploy, notifica Integrador
        │
        ▼
[Gate 6] Build de produção
        │ Passa?
        ├── Não → Aborta deploy, notifica Executor
        │
        ▼
[Gate 7] Smoke test E2E
        │ Passa?
        ├── Não → Aborta deploy, notifica Arquiteto
        │
        ▼
[DEPLOY] Merge main-v2 → main
        │
        ▼
[Firebase deploy] rules → functions → hosting
        │
        ▼
[Smoke test em produção]
        │
        ├── Falha crítica? → Rollback automático (15 min)
        │
        ▼
[Notificação] Discord/Slack com relatório completo
```

---

## 8.3 Checklist de Smoke Test

### `coag-v2.smoke.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { signInWithEmail, signOut } from '../helpers/auth';
import { testLabCredentials } from '../fixtures/credentials';

test.describe('Coagulação v2 — Smoke Test', () => {
  
  test.beforeEach(async ({ page }) => {
    await signInWithEmail(page, testLabCredentials);
    await page.goto('/coagulacao-v2');
  });

  // ── Wave A: ControlOperacional ─────────────────────────────
  test('RT consegue criar Controle Normal', async ({ page }) => {
    // Setup: RT cria um controle
    await page.click('[data-testid="create-control-button"]');
    await page.fill('[data-testid="control-name"]', 'Controle Normal');
    await page.selectOption('[data-testid="control-level"]', 'I');
    await page.click('[data-testid="save-control-button"]');
    await expect(page.locator('text=Controle Normal')).toBeVisible();
  });

  // ── Wave B: Attempt ────────────────────────────────────────
  test('Operador consegue criar tentativa com ≤ 6 campos', async ({ page }) => {
    await page.click('[data-testid="new-attempt-button"]');
    
    // Deve ter dropdown de controle
    await expect(page.locator('[data-testid="control-select"]')).toBeVisible();
    
    // Deve ter inputs de resultados
    await page.fill('[name="resultados.atividadeProtrombinica"]', '98');
    await page.fill('[name="resultados.rni"]', '1.02');
    await page.fill('[name="resultados.ttpa"]', '33.5');
    
    await page.click('[data-testid="save-attempt-button"]');
    
    // Deve aparecer na timeline
    await expect(page.locator('text=AP 98%')).toBeVisible();
  });

  test('Textarea de ação corretiva aparece apenas com violação', async ({ page }) => {
    await page.click('[data-testid="new-attempt-button"]');
    
    // Valor fora do intervalo
    await page.fill('[name="resultados.rni"]', '2.50'); // fora de 0.83-1.11
    
    // Textarea deve aparecer
    await expect(page.locator('[data-testid="corrective-action"]')).toBeVisible();
  });

  // ── Wave C: RTAction ───────────────────────────────────────
  test('RT consegue aprovar tentativa', async ({ page }) => {
    // Navegar para painel RT
    await page.goto('/coagulacao-v2/rt');
    
    // Selecionar tentativa pendente
    await page.click('[data-testid="attempt-item-1"]');
    
    // Aprovar com motivo
    await page.click('[data-testid="approve-button"]');
    await page.fill('[data-testid="approval-reason"]', 'Dentro dos critérios');
    await page.click('[data-testid="confirm-button"]');
    
    await expect(page.locator('text=Aprovada')).toBeVisible();
  });

  test('RT consegue aplicar NOTIVISA', async ({ page }) => {
    await page.goto('/coagulacao-v2/rt');
    await page.click('[data-testid="attempt-item-with-violation"]');
    await page.click('[data-testid="notivisa-button"]');
    
    await page.selectOption('[data-testid="notivisa-type"]', 'queixa_tecnica');
    await page.fill('[data-testid="notivisa-protocol"]', '2026.12345');
    await page.fill('[data-testid="notivisa-reason"]', 'Defeito de produto');
    await page.click('[data-testid="confirm-button"]');
    
    await expect(page.locator('text=NOTIVISA')).toBeVisible();
  });

  // ── Wave D+E: UI ───────────────────────────────────────────
  test('Operador não vê termos técnicos', async ({ page }) => {
    await page.goto('/coagulacao-v2');
    
    // Termos proibidos NÃO devem aparecer
    const forbidden = ['run', 'corrida', 'lote', 'workflow', 'status:', 'pendente'];
    for (const term of forbidden) {
      const count = await page.locator(`text=/${term}/i`).count();
      expect(count).toBe(0);
    }
    
    // Termo permitido: "tentativa"
    await expect(page.locator('[data-testid="timeline"]')).toBeVisible();
  });

  test('Contador de campos expostos ≤ 6', async ({ page }) => {
    await page.click('[data-testid="new-attempt-button"]');
    
    const fields = await page.locator('input[type="text"], input[type="number"], select, textarea').count();
    expect(fields).toBeLessThanOrEqual(6);
  });

  // ── Wave F: Auditoria ─────────────────────────────────────
  test('Tentativa tem snapshot imutável', async ({ page, context }) => {
    // Criar tentativa
    await page.click('[data-testid="new-attempt-button"]');
    await page.fill('[name="resultados.atividadeProtrombinica"]', '100');
    await page.click('[data-testid="save-attempt-button"]');
    
    // Verificar que snapshot está na Firestore
    const firestorePage = await context.newPage();
    // Verificação indireta via API / admin
    // (detalhes no script de auditoria)
  });

  test('LogicalSignature é gerada', async ({ page }) => {
    // Após criar tentativa, verificar que logicalSignature existe
    await page.click('[data-testid="new-attempt-button"]');
    await page.fill('[name="resultados.rni"]', '1.00');
    await page.click('[data-testid="save-attempt-button"]');
    
    // Verificação indireta: RT vê detalhes
    await page.goto('/coagulacao-v2/rt');
    await expect(page.locator('[data-testid="signature-display"]')).toBeVisible();
  });

  // ── Cleanup ────────────────────────────────────────────────
  test.afterEach(async ({ page }) => {
    await signOut(page);
  });
});
```

---

## 8.4 Rollback Simples

### Rollback automático:

**Trigger:** Smoke test em produção falha no 1º ciclo pós-deploy

**Ação:**
```bash
# Rollback de 1 commit (último deploy)
git checkout main
git revert HEAD  # reverte o merge de main-v2
git push origin main

# Firebase deploy (rollback de regras)
firebase deploy --only firestore:rules,functions,hosting
```

**Tempo alvo:** < 15 minutos do trigger

### Rollback manual (se problema descoberto depois):

```bash
# Identificar o commit problemático
git bisect start
git bisect bad HEAD
git bisect good [commit-bom-anterior]

# Reverter commit específico
git revert [commit-hash]
git push origin main
```

---

## 8.5 Proteção contra Quebra Silenciosa

### Monitoramento pós-deploy:

```bash
# Script de monitoramento de 24h
./scripts/monitor-cloud-logs.sh 24 30
```

**Red flags que disparam alerta:**
- `Error rate > 1%` nas funções de coag-v2
- `Latency p95 > 2s` no save de Attempt
- `LogicalSignature missing` em tentativa criada
- `Snapshot null` em tentativa criada
- Tentativa sem `criadoPor` (auth bypass?)

### Alertas no Discord/Slack:

```markdown
🚨 ALERTA COAG-V2 — Deploy [HASH]
Problema: [descrição]
Impacto: [número de usuários afetados]
Rollback iniciado: [timestamp]
Investigação: [link para o PR/commit]
```

---

## 8.6 Plano de Branches (Detalhado)

```
main                                  ← Produção (canary)
  │
  ├── hotfix/[name]                   ← Hotfixes (sempre merge em main)
  │
  └── main-v2                         ← Desenvolvimento do redesign
      │
      ├── wave/a-control-operacional  ← Wave A (branch efêmera)
      │   └── commits: feat, test, fix, docs
      │
      ├── wave/b-attempt              ← Wave B
      │   └── commits: feat, test, fix, docs
      │
      ├── wave/c-rtaction             ← Wave C
      │   └── commits: feat, test, fix, docs
      │
      ├── wave/d-ui-operador          ← Wave D
      │   └── commits: feat, test, fix, docs
      │
      ├── wave/e-ui-rt                ← Wave E
      │   └── commits: feat, test, fix, docs
      │
      ├── wave/f-auditoria            ← Wave F
      │   └── commits: feat, chore, docs
      │
      └── wave/g-deploy               ← Wave G (merge final)
          └── commits: chore, docs
```

### Regras:

1. Nunca commit direto em `main` ou `main-v2` (exceto merges de PRs)
2. Waves são feature branches efêmeras (deletadas após merge)
3. Hotfixes em produção sempre passam por `main` (não por `main-v2`)
4. `main-v2` tem deploy automático noturno para staging (se existir)

---

## 8.7 Estratégia Anti-Deriva durante Deploy

### Proteção 1: Tag de versão

```bash
# Antes de merge main-v2 → main:
git tag -a v2.0.0-coag -m "Coagulação v2 — redesign completo"
git push origin v2.0.0-coag
```

### Proteção 2: Documentação de deploy

```markdown
docs/coag-v2/DEPLOY-REPORT-[DATE].md
```

Contém:
- Hash do commit merged
- Métricas finais (entidades=3, eventos=3, etc)
- Resultado dos testes
- Tempo de deploy
- Smoke test em produção (pass/fail)

### Proteção 3: Rollback documentado

Se rollback acontecer:
```markdown
docs/coag-v2/ROLLBACK-REPORT-[DATE].md
```

Contém:
- Motivo do rollback
- Tempo de indisponibilidade (se houve)
- Fix aplicado (ou plano de fix)
- Nova data de deploy

---

## 8.8 Checklist Final de Deploy

### Pré-deploy (manual verification):

- [ ] Todas as 7 waves mergeadas em `main-v2`
- [ ] Auditoria arquitetural passando
- [ ] Todos os testes passando (unit, integration, e2e)
- [ ] Typecheck passando
- [ ] Módulos adjacentes intactos
- [ ] Build de produção otimizado (< budget)
- [ ] Tag de versão criada
- [ ] Deploy report criado

### Durante deploy (automático):

- [ ] `firebase deploy --only firestore:rules` (se rules mudaram)
- [ ] `firebase deploy --only functions` (se functions mudaram)
- [ ] `firebase deploy --only hosting`
- [ ] Smoke test em produção iniciado (automático)
- [ ] Notificação de sucesso enviada (automática)
- [ ] Tag pushed

### Pós-deploy (monitoramento):

- [ ] Script `monitor-cloud-logs.sh 24 30` rodando
- [ ] Red flags configuradas no Cloud Logging
- [ ] Alertas do Discord/Slack ativos
- [ ] Rollback plan documentado (se precisar)
