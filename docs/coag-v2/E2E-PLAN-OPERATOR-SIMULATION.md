# Plano E2E Coagulação v2 — Validação Integrada Automatizada

> **Executor:** DeepSeek V4 Flash como operador virtual via Playwright
> **Alvo:** https://hmatologia2.web.app (produção)
> **Duração estimada:** ~15 minutos (simula 1 semana de operação condensada)
> **Status:** Aprovado para execução manual por ack do CTO

---

## 1. Objetivo

Validar que o módulo Coagulação v2 funciona de ponta a ponta na produção real, como se um operador laboratorial estivesse utilizando o sistema durante uma semana completa. O plano verifica:

1. Autenticação como operador e RT
2. Criação de um Controle Operacional
3. Submissão de 14+ tentativas simulando 1 semana de corridas (2 corridas/dia × 7 dias)
4. Verificação de cada regra Westgard isolada com dados que a disparam intencionalmente
5. Ações de RT (aprovar, rejeitar, NOTIVISA)
6. Verificação da assinatura lógica (SHA-256)
7. Verificação audit trail via Firestore direto
8. Verificação da curva de Levey-Jennings renderizada
9. Limpeza dos dados de teste
10. Geração de relatório final

---

## 2. Pré-condições

### 2.1 Infraestrutura

```bash
cd smoke-test
npm install
npx playwright install chromium
```

### 2.2 Credenciais

Arquivo `smoke-test/.env.test`:

```
SMOKE_BASE_URL=https://hmatologia2.web.app
OPERATOR_EMAIL=<email-de-teste-operador>
OPERATOR_PASSWORD=<senha>
RT_EMAIL=<email-de-teste-rt>
RT_PASSWORD=<senha>
LAB_ID=<id-do-lab-alvo>
```

> **CRÍTICO:** Use contas de teste dedicadas. NUNCA use credenciais de operador real.

### 2.3 Playwright browsers instalados

```bash
npx playwright install chromium
```

---

## 3. Estratégia de Resiliência (A Prova de Falhas)

### 3.1 Retry com Exponential Backoff

Cada ação de UI (click, fill, navigate) é tentada até **3 vezes** com intervalos 1s → 2s → 4s.

### 3.2 Screenshots Automáticos

Screenshot antes e depois de **cada fase**. Salvo em `smoke-test/test-results/phase-{N}-{name}.png`.

### 3.3 Fase Isolada

Cada fase grava checkpoint em `smoke-test/.checkpoints/phase-{N}.json`. Se o script morrer, pode retomar do último checkpoint.

### 3.4 Prefixo Único

Todos os dados de teste usam prefixo `E2E-{TIMESTAMP}` para evitar conflitos com dados reais e permitir limpeza precisa.

### 3.5 Cleanup Garantido

Hook `after` do Playwright executa SEMPRE (mesmo em falha), limpando via API do Firestore:

- Delete `control-operacional/E2E-*`
- Delete `attempts/E2E-*`
- Delete `rt-actions/E2E-*`

### 3.6 Report em JSON + Markdown

Relatório escrito em `smoke-test/test-results/coag-v2-report-{date}.json` e `.md`.

---

## 4. Fases de Execução

### Fase 0: Setup & Login Operator (3 min)

| Step | Ação                             | Validação                               |
| ---- | -------------------------------- | --------------------------------------- |
| 0.1  | Navegar para `/`                 | Page loads, login form visible          |
| 0.2  | Login com OPERATOR_EMAIL         | Redirect to hub, user menu visible      |
| 0.3  | Clicar em "Coagulação v2" no hub | View renders com título "Coagulação v2" |
| 0.4  | Screenshot                       | Fase completa                           |

**Checkpoint:** `{ phase: 0, status: "passed", operatorUid: "...", timestamp }`

---

### Fase 1: Criar Controle Operacional (2 min)

| Step | Ação                                                               | Validação                              |
| ---- | ------------------------------------------------------------------ | -------------------------------------- |
| 1.1  | Selecionar "Novo Controle" ou equivalente                          | Modal/form opens                       |
| 1.2  | Preencher: Nome = `E2E-{TS} Controle Nível I`                      | Input accepted                         |
| 1.3  | Preencher: Nível = `I`                                             | Dropdown selected                      |
| 1.4  | Preencher: Lote Controle = `CTRL-E2E-{TS}`                         | Input accepted                         |
| 1.5  | Preencher Validade = `{hoje + 180 dias}` (YYYY-MM-DD)              | Date validated                         |
| 1.6  | Não preencher mean/sd (deixe defaults do sistema)                  | Defaults from CoagAnalyteConfig        |
| 1.7  | Clicar "Salvar"                                                    | Control criado, appears na lista       |
| 1.8  | Screenshot                                                         | ControlOperacional with prefix visible |
| 1.9  | **Capturar ID do controle** (via DOM attribute ou Firestore query) | ID saved to `E2E_CONTEXT.controlId`    |

**Fallback:** Se o UI não permite criar controle, criar via Firestore SDK diretamente:

```js
await db.collection(`labs/${LAB_ID}/control-operacional`).add({
  nome: `E2E-${TS} Controle Nível I`,
  nivel: 'I',
  loteControle: `CTRL-E2E-${TS}`,
  validadeControle: futureDate,
  status: 'ativo',
  mean: { atividadeProtrombinica: 100, rni: 0.97, ttpa: 33 },
  sd: { atividadeProtrombinica: 10, rni: 0.07, ttpa: 3 },
  equipamentoId: 'Clotimer Duo',
  criadoEm: Timestamp.now(),
  atualizadoEm: Timestamp.now(),
});
```

**Checkpoint:** `{ phase: 1, controlId: "...", status: "passed" }`

---

### Fase 2: Semana Condensada — 14 Tentativas (5 min)

Simula 2 corridas por dia durante 7 dias.

| Dia  | Corrida | AP (%) | RNI  | TTPA (s) | Resultado esperado                 |
| ---- | ------- | ------ | ---- | -------- | ---------------------------------- |
| 1 AM | #1      | 100    | 0.97 | 33.0     | conforme (baseline)                |
| 1 PM | #2      | 98     | 0.95 | 34.0     | conforme                           |
| 2 AM | #3      | 102    | 0.99 | 32.5     | conforme                           |
| 2 PM | #4      | 105    | 1.01 | 33.5     | conforme (leve drift)              |
| 3 AM | #5      | 87     | 0.89 | 36.0     | conforme (próximo do limite)       |
| 3 PM | #6      | 112    | 1.05 | 30.0     | conforme (próximo do limite)       |
| 4 AM | #7      | 95     | 0.94 | 35.0     | conforme                           |
| 4 PM | #8      | 101    | 0.98 | 32.0     | conforme                           |
| 5 AM | #9      | 88     | 0.88 | 37.0     | **1-2s WARNING AP** (beyond 2SD)   |
| 5 PM | #10     | 100    | 0.96 | 33.5     | conforme                           |
| 6 AM | #11     | 86     | 0.88 | 36.5     | **2-2s** (2 consec > +2SD AP)      |
| 6 PM | #12     | 131    | 1.20 | 24.0     | **1-3s REJEITADO** (beyond 3SD AP) |
| 7 AM | #13     | 95     | 0.93 | 34.0     | conforme (recuperação)             |
| 7 PM | #14     | 101    | 0.98 | 32.5     | conforme (estável)                 |

> **Valores calculados com base em:** Nível I: AP mean=100 sd=10 [80-120], RNI mean=0.97 sd=0.07 [0.83-1.11], TTPA mean=33 sd=3 [27-39]
> **1-3s trigger AP:** valor > 130 (mean + 3SD) → #11 usa AP=86 (> -2SD), #12 usa AP=131 (> +3SD)

| Step | Ação                                                                             | Validação                                  |
| ---- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| 2.1  | Para cada tentativa i (1-14):                                                    | Loop                                       |
| 2.2  | Select controle `E2E-{TS}` no dropdown                                           | Control name visible                       |
| 2.3  | Fill AP = valor da tabela                                                        | Input accepted                             |
| 2.4  | Fill RNI = valor da tabela                                                       | Input accepted                             |
| 2.5  | Fill TTPA = valor da tabela                                                      | Input accepted                             |
| 2.6  | Verificar ConformityBadge antes de salvar                                        | Badge shows A ou R conforme esperado       |
| 2.7  | Se badge = R → preencher acaoCorretiva = "Ação corretiva teste E2E corrida #{i}" | Textarea visible, texto entered            |
| 2.8  | Clicar "Salvar"                                                                  | Button state changes to "Salvando..."      |
| 2.9  | Aguardar tela de sucesso "Tentativa salva com sucesso"                           | Text appears within 5s                     |
| 2.10 | Clicar "Nova tentativa"                                                          | Form re-opens                              |
| 2.11 | Screenshot cada 3 tentativas                                                     | Progress captured                          |
| 2.12 | **Registrar ID da tentativa** (via URL ou Firestore)                             | ID salvo em array `E2E_CONTEXT.attemptIds` |

**Checkpoint:** `{ phase: 2, attemptIds: [...], conformeCount: N, rejectCount: M, status: "passed" }`

---

### Fase 3: Verificação Westgard Específica (2 min)

Validar que as regras foram aplicadas corretamente consultando Firestore diretamente.

| Rule            | Tentativa #                | Verificação                                                     |
| --------------- | -------------------------- | --------------------------------------------------------------- |
| Conforme (none) | #1, #2, #14                | `conformidade == 'A'`, `violacoes.length == 0`                  |
| 1-2s            | #9 (AP=87, 1.3SD above)    | `conformidade == 'A'`, `violacoes includes '1-2s'` como warning |
| 1-3s            | #12 (AP=131, 3.1SD)        | `conformidade == 'R'`, `violacoes includes '1-3s'`              |
| 2-2s            | #11 (AP=86, consec com #9) | `conformidade == 'R'`, `violacoes includes '2-2s'`              |
| 4-1s            | #6, #7, #5, #11 (trends)   | Verifique se alguma corrida triggerou 4-1s consecutivos         |

```js
// Para cada attemptId salvo:
const snap = await db.doc(`labs/${LAB_ID}/attempts/${id}`).get();
const data = snap.data();
assert(data.conformidade === expected, `conformidade ${data.conformidade} != ${expected}`);
assert(data.violacoes.includes(expectedRule), `missing ${expectedRule}`);
```

**Checkpoint:** `{ phase: 3, rulesVerified: ["1-3s", "2-2s"], status: "passed" }`

---

### Fase 4: RT Panel (2 min)

| Step | Ação                                                                | Validação                      |
| ---- | ------------------------------------------------------------------- | ------------------------------ |
| 4.1  | Logout operator, Login como RT                                      | RT menu visible                |
| 4.2  | Navegar para Coagulação v2 → RT Panel (ou view equivalente)         | Attempts list visible          |
| 4.3  | Verificar KPIs: `14 tentativas`, `<100% conformes`, `>0 rejeitadas` | KPIs displayed correctly       |
| 4.4  | Verificar tentativas listadas com ID prefix `E2E-`                  | All 14 visible (truncated IDs) |
| 4.5  | Clicar "Aprovar" em uma tentativa conforme                          | ActionModal appears            |
| 4.6  | Motivo = "Aprovação E2E teste"                                      | Textarea filled                |
| 4.7  | Confirmar aprovação                                                 | Toast/success, RTAction criado |
| 4.8  | Clicar "Rejeitar" em uma tentativa com conformidade R               | ActionModal appears            |
| 4.9  | Motivo = "Rejeição E2E teste"                                       | Textarea filled                |
| 4.10 | Confirmar rejeição                                                  | Toast/success, RTAction criado |
| 4.11 | Clicar "NOTIVISA" em uma tentativa rejectada                        | NotivisaModal appears          |
| 4.12 | Select "queixa_tecnica", Motivo = "NOTIVISA E2E teste"              | Form filled                    |
| 4.13 | Confirmar NOTIVISA                                                  | Toast/success, RTAction criado |
| 4.14 | Screenshot final do painel                                          | All actions visible            |

**Checkpoint:** `{ phase: 4, rtActionsCreated: 3, status: "passed" }`

---

### Fase 5: Verificação de Dados Persistentes (2 min)

```js
// 1. Verificar logicalSignature das tentativas
for (const id of E2E_CONTEXT.attemptIds) {
  const snap = await db.doc(`labs/${LAB_ID}/attempts/${id}`).get();
  const data = snap.data();
  assert(data.logicalSignature, 'logicalSignature missing');
  assert(data.logicalSignature.length === 64, 'invalid SHA-256 length');
  assert(data.signedBy, 'signedBy missing');
  assert(data.signedAt, 'signedAt missing');
  assert(data.snapshot.controle, 'snapshot.controle missing');
  assert(data.snapshot.equipamento, 'snapshot.equipamento missing');
}

// 2. Verificar RTActions
const rtSnap = await db
  .collection(`labs/${LAB_ID}/rt-actions`)
  .where('targetRef.id', 'in', E2E_CONTEXT.attemptIds.slice(0, 5))
  .get();
assert(rtSnap.size >= 3, `expected >=3 RT actions, got ${rtSnap.size}`);

// 3. Verificar que ControlOperacional still existe
const ctrlSnap = await db.doc(`labs/${LAB_ID}/control-operacional/${E2E_CONTEXT.controlId}`).get();
assert(ctrlSnap.exists, 'ControlOperacional deleted unexpectedly');
```

**Checkpoint:** `{ phase: 5, allSignaturesValid: true, rtActionsCount: 3, status: "passed" }`

---

### Fase 6: Verificação Visual da Curva (1 min)

| Step | Ação                                                        | Validação                 |
| ---- | ----------------------------------------------------------- | ------------------------- |
| 6.1  | Como operador ou RT, abrir view com carta de Levey-Jennings | Canvas/SVG renders        |
| 6.2  | Verificar que a curva mostra os 14 pontos                   | Dots rendered             |
| 6.3  | Verificar linhas de ±1SD, ±2SD, ±3SD                        | Reference lines present   |
| 6.4  | Verificar que pontos violadores são destacados em vermelho  | Red dots visible          |
| 6.5  | Screenshot da curva completa                                | Curve captured for report |

**Checkpoint:** `{ phase: 6, curveRendered: true, violationMarkers: N, status: "passed" }`

---

### Fase 7: Cleanup (1 min) — SEMPRE EXECUTA

```js
// Delete tentativas
for (const id of E2E_CONTEXT.attemptIds) {
  await db.doc(`labs/${LAB_ID}/attempts/${id}`).delete();
}

// Delete RT actions
for (const id of E2E_CONTEXT.rtActionIds) {
  await db.doc(`labs/${LAB_ID}/rt-actions/${id}`).delete();
}

// Soft-delete control (mark as aposentado, do NOT delete — chain-hash)
await db.doc(`labs/${LAB_ID}/control-operacional/${E2E_CONTEXT.controlId}`).update({
  status: 'aposentado',
  atualizadoEm: Timestamp.now(),
});
```

> **IMPORTANTE:** Nunca DELETE documentos de `control-operacional` — apenas mark como `aposentado` para preservar audit trail. Attempts e RT-actions podem ser deletados pois são dados de teste.

---

## 5. Formato do Relatório

### 5.1 JSON Report (`coag-v2-e2e-report-{YYYY-MM-DD}.json`)

```json
{
  "runId": "E2E-20260525-143000",
  "timestamp": "2026-05-25T14:30:00.000Z",
  "duration": 873420,
  "environment": "production",
  "targetUrl": "https://hmatologia2.web.app",
  "executor": "DeepSeek V4 Flash",
  "phases": [
    {
      "id": 0,
      "name": "Login Operator",
      "status": "passed",
      "duration": 12340,
      "steps": 4,
      "screenshots": ["phase-0-login.png"]
    },
    {
      "id": 1,
      "name": "Create ControlOperacional",
      "status": "passed",
      "duration": 5210,
      "dataCreated": { "controlId": "abc123" }
    },
    {
      "id": 2,
      "name": "Week Simulation (14 attempts)",
      "status": "passed",
      "duration": 284500,
      "attemptsCreated": 14,
      "conforme": 11,
      "rejeitada": 3
    },
    {
      "id": 3,
      "name": "Westgard Rules Verification",
      "status": "passed",
      "rulesVerified": ["1-2s", "1-3s", "2-2s", "4-1s"]
    },
    {
      "id": 4,
      "name": "RT Panel Operations",
      "status": "passed",
      "rtActionsCreated": 3
    },
    {
      "id": 5,
      "name": "Data Persistence Verification",
      "status": "passed",
      "allSignaturesValid": true,
      "sha256Length": 64
    },
    {
      "id": 6,
      "name": "Levey-Jennings Curve",
      "status": "passed",
      "pointsRendered": 14,
      "violationMarkers": 2
    },
    {
      "id": 7,
      "name": "Cleanup",
      "status": "passed",
      "attemptsDeleted": 14,
      "controlRetired": true
    }
  ],
  "summary": {
    "totalPhases": 8,
    "passed": 8,
    "failed": 0,
    "warnings": 0
  },
  "artifacts": {
    "screenshots": 16,
    "firestoreDocs": 31,
    "cleanupConfirmed": true
  }
}
```

### 5.2 Markdown Summary (`coag-v2-e2e-summary-{YYYY-MM-DD}.md`)

```markdown
# Relatório E2E Coagulação v2

**Data:** 2026-05-25 14:30 UTC
**Status:** ✅ ALL PASSED (8/8 fases)
**Duração:** 14m 33s

## Resumo Executivo

| Fase | Nome                        | Status  | Duração |
| ---- | --------------------------- | ------- | ------- |
| 0    | Login Operator              | ✅ PASS | 12s     |
| 1    | Criar Controle              | ✅ PASS | 5s      |
| 2    | Semana Condensada (14 runs) | ✅ PASS | 4m 44s  |
| 3    | Verificação Westgard        | ✅ PASS | 8s      |
| 4    | Ações RT                    | ✅ PASS | 15s     |
| 5    | Persistência                | ✅ PASS | 6s      |
| 6    | Curva Levey-Jennings        | ✅ PASS | 4s      |
| 7    | Cleanup                     | ✅ PASS | 3s      |

## Regras Westgard Verificadas

| Regra | Disparo na corrida                  | Status                          |
| ----- | ----------------------------------- | ------------------------------- |
| 1-2s  | Corrida #9 (AP=87)                  | ✅ Warning corretamente gerado  |
| 1-3s  | Corrida #12 (AP=131)                | ✅ Rejeição corretamente gerada |
| 2-2s  | Corrida #11 (AP=86, consec #9)      | ✅ Rejeição corretamente gerada |
| 4-1s  | N/A (não disparada nesta sequência) | ⚠️ Não verificada nesta corrida |

## Assinatura Lógica

- SHA-256 de 64 caracteres em todas as 14 tentativas: ✅
- `signedBy` correto (operatorUid): ✅
- `signedAt` timestamp presente: ✅

## Dados de Teste

**Criados:** 1 controle, 14 tentativas, 3 RT actions
**Limpos:** 14 tentativas deletadas, 3 RT actions deletadas, 1 controle aposentado
**Prefixo:** `E2E-20260525143000`

## Screenshots

- `phase-0-login.png` — Login bem-sucedido
- `phase-1-control.png` — Controle criado no Firestore
- `phase-2-attempts.png` — Tentativas registradas
- `phase-3-westgard.png` — Regras verificadas no Firestore
- `phase-4-rt.png` — Painel RT com ações
- `phase-6-curve.png` — Curva de Levey-Jennings com violações

## Conclusão

Módulo Coagulação v2 opera corretamente em produção. As regras Westgard foram aplicadas conforme CLSI C24-A3, a assinatura lógica é íntegra, e o fluxo RT funciona. Nenhuma regressão detectada.
```

---

## 6. Valores de Teste Calculados (Referência)

### Nível I

| Analito | Mean | SD   | Low (-2σ) | High (+2σ) | -3σ  | +3σ  | -1σ  | +1σ  |
| ------- | ---- | ---- | --------- | ---------- | ---- | ---- | ---- | ---- |
| AP      | 100  | 10   | 80        | 120        | 70   | 130  | 90   | 110  |
| RNI     | 0.97 | 0.07 | 0.83      | 1.11       | 0.76 | 1.18 | 0.90 | 1.04 |
| TTPA    | 33   | 3    | 27        | 39         | 24   | 42   | 30   | 36   |

### Valores para disparar cada regra

| Regra          | Condição                    | Valor usado (AP)                                                                                                  | Corrida # |
| -------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| 1-2s (warning) | > ±2σ                       | AP = 87 (-1.3σ)                                                                                                   | #9        |
| 1-3s (reject)  | > ±3σ                       | AP = 131 (3.1σ)                                                                                                   | #12       |
| 2-2s (reject)  | 2 consec > +2σ mesmo lado   | AP = 87, 86 (consec abaixo)                                                                                       | #9 + #11  |
| 4-1s (reject)  | 4 consec > +1σ mesmo lado   | Difícil sem 4 corridas consecutivas no mesmo lado — pode exigir sequência dedicada                                |
| R-4s (reject)  | 2 consec com amplitude > 4σ | AP = 86 e AP = 131 (amplitude 45 > 4σ=40)                                                                         | #11 + #12 |
| 10x (reject)   | 10 consecutivos mesmo lado  | Exige 10+ corridas — **não testado nesta bateria** (1 week condensado = 14 corridas; requer sequência específica) |

### Recomendação para 4-1s e 10x

Se necessário verificar essas regras, adicione uma **Fase 2B** dedicada:

- 4-1s: Crie 4 tentativas consecutivas com AP entre mean+1σ e mean+2σ (valores: 111, 113, 112, 114)
- 10x: Crie 10 tentativas consecutivas todas com AP > mean (valores: 101-110)

---

## 7. Checklist Pré-Execução

- [ ] Playwright browsers instalados (`npx playwright install chromium`)
- [ ] `.env.test` com credenciais de OPERATOR e RT
- [ ] LAB_ID conhecido e com permissões de operador/RT
- [ ] Rede estável (testes contra produção)
- [ ] Firestore access configurado para cleanup direto (se necessário)
- [ ] Ack do CTO registrado (firebase deploy foi dado; este plano é read-heavy)

---

## 8. Limitações Conhecidas

1. **Fase 6 (Curva):** Depende do componente de carta de Levey-Jennings existir na v2. Se não renderizado ainda, marcar como "skipped" e documentar.
2. **Fase 2 (4-1s/10x):** Valores de 4-1s e 10x são difíceis de disparar em apenas 14 corridas. Podem exigir corrida dedicada.
3. **Fase 1 (UI):** Se o UI não suporta criação de ControleOperacional, usar fallback direto via Firestore SDK.
4. **Network flakiness:** Ações assíncronas podem ter delay. Sempre usar `waitForSelector` com timeout generoso (10s).
5. **Data cleanup:** Soft-delete do control (não hard-delete) para preservar chain-hash integrity.

---

## 9. Execução

```bash
# No diretório smoke-test, após preencher .env.test:
npx playwright test specs/coag-v2-e2e-full.spec.ts --headed

# Ou headless:
npx playwright test specs/coag-v2-e2e-full.spec.ts

# Para retomar de checkpoint:
E2E_RESUME_FROM=phase-3 npx playwright test specs/coag-v2-e2e-full.spec.ts
```

---

## 10. Aprovado para Execução

**Data:** ******\_\_\_******
**CTO Signature:** ******\_\_\_******
**Executor:** DeepSeek V4 Flash
**Re-execution:** Semanalmente (recomendado) ou após qualquer deploy que altere o módulo Coag.
