# Load Testing Integration — HC Quality Phase 3

## Visão geral

Este documento descreve a integração da suíte de load testing do HC Quality Phase 3 no workflow de desenvolvimento e deployment.

**Deliverables:**

- `scripts/load-test-phase-3.js` — Script k6 com 4 workloads realistas
- `scripts/load-test-phase-3.ps1` — Wrapper PowerShell (Windows)
- `scripts/load-test-phase-3.sh` — Wrapper Bash (Linux/macOS)
- `docs/LOAD_TEST_QUICK_REFERENCE.md` — Quick ref de uso
- Este guia — integração em CI/CD + pre-deploy

---

## Arquitetura do teste

### Workloads simulados

```
Phase 3 Schema Load Test
├─ Portal config reads (50% weight)
│  └─ 10k pacientes acessando portal
│     ├─ GET /portalConfig
│     ├─ Expected latency P95: <150ms
│     └─ Firestore reads: ~1 per request
│
├─ NOTIVISA events (20% weight)
│  └─ Criação de eventos (laudo published)
│     ├─ POST /notiVisaEvents
│     ├─ Expected latency P95: <300ms
│     └─ Firestore writes: 1 + audit trail
│
├─ Critical escalations (15% weight)
│  └─ Escalação de resultados críticos
│     ├─ POST /criticalResults
│     ├─ Expected latency P95: <200ms
│     └─ Firestore writes: 1 + notification trigger
│
└─ Draft locks (15% weight)
   └─ Aquisição/liberação de locks (edição RT)
      ├─ POST /draftLocks (acquire)
      ├─ DELETE /draftLocks/{id} (release)
      ├─ Expected latency P95: <100ms
      └─ Firestore writes: 2 per cycle
```

### Métricas capturadas

| Métrica                                 | Fonte             | Threshold                |
| --------------------------------------- | ----------------- | ------------------------ |
| `portal_read_duration_ms` (p95)         | k6 timing         | <150ms                   |
| `notivisa_create_duration_ms` (p95)     | k6 timing         | <300ms                   |
| `critical_escalation_duration_ms` (p95) | k6 timing         | <200ms                   |
| `draft_lock_duration_ms` (p95)          | k6 timing         | <100ms                   |
| `http_req_duration` (p95)               | k6 aggregate      | <250ms                   |
| `errors` (rate)                         | k6 check failures | <5% baseline, <5% stress |
| `http_req_failed` (rate)                | HTTP 5xx          | <1%                      |
| `firestore_reads`                       | manual counter    | info only                |
| `firestore_writes`                      | manual counter    | info only                |
| `quota_exceeded`                        | 429 responses     | <10 total                |

### Cenários de teste

#### Baseline

- **VUs:** 10 concurrent users
- **Duration:** 7 min total (1m ramp-up, 5m sustain, 1m ramp-down)
- **Propósito:** Detectar regressões em carga normal
- **SLA:** error rate <1%, P95 <250ms

#### Stress

- **VUs:** 100 concurrent users
- **Duration:** 14 min total (2m ramp-up, 10m sustain, 2m ramp-down)
- **Propósito:** Encontrar ponto de quebra, verificar escalabilidade
- **SLA:** error rate <5%, P95 <250ms

#### Spike

- **VUs:** 500 concurrent (spike inesperado)
- **Duration:** 4 min total (1m base, 30s spike, 2m sustain, 1m ramp-down)
- **Propósito:** Simular picos (batch laudo, escalação em massa)
- **SLA:** error rate <5%, recuperação após pico <2m

---

## Setup inicial

### Pré-requisitos

```bash
# 1. Instalar k6
# macOS
brew install k6

# Linux
curl https://dl.k6.io/release/v0.50.0/k6-v0.50.0-linux-amd64.tar.gz | tar xz
sudo mv k6 /usr/local/bin/

# Windows (Chocolatey)
choco install k6

# Verificar
k6 version

# 2. (Opcional) Instalar k6-reporter para HTML reports
npm i -g k6-reporter

# 3. (Opcional) gcloud CLI para exportar métricas Firebase
# Já deve estar instalado se desenvolvimento local está setup
gcloud auth application-default login
```

### Tornar scripts executáveis (macOS/Linux)

```bash
chmod +x scripts/load-test-phase-3.sh
```

### Validar setup

```bash
# PowerShell (Windows)
.\scripts\load-test-phase-3.ps1 -SkipReport

# Bash (Linux/macOS)
./scripts/load-test-phase-3.sh baseline --skip-report
```

---

## Uso no desenvolvimento

### Antes de mergear código que toca schema

```bash
# 1. Rodar localmente (baseline)
./scripts/load-test-phase-3.sh

# 2. Revisar LOAD_TEST_RESULTS.md
cat LOAD_TEST_RESULTS.md

# 3. Se algum threshold falhou:
# - Investigar via logs
# - Corrigir (índice Firestore? query pesada? function lenta?)
# - Re-testar
# - Documentar achado em commit message

# Exemplo:
# git commit -m "perf: add missing firestore index for portal read query
#
# Portal config reads were hitting P95 287ms (target 150ms).
# Cause: unindexed field 'status' in 'labs/{labId}/portalConfig' collection.
# Fixed by creating composite index (portalEnabled + modifiedTime).
# Post-fix baseline: P95 142ms ✓
#"
```

### Antes de mergear após mudança em Functions

```bash
# 1. Deploy Functions em staging
firebase deploy --only functions:myFunction --project hmatologia2

# 2. Executar stress test (mais rigoroso que baseline)
./scripts/load-test-phase-3.sh stress

# 3. Comparar com baseline anterior (commit 2 semanas atrás)
git show HEAD~20:LOAD_TEST_RESULTS.md | grep "Critical Escalations"
#   Expected: P95 <200ms
#   Before: 185ms
#   After: 192ms
#   Acceptable variance: ±10%

# 4. Se degradação > 10% e sem causa óbvia: investigar
```

### Durante debug de performance

```bash
# Se reclamar que "laudo demora pra aparecer no portal":

# 1. Coletar baseline de quando estava funcionando
git log --oneline -n 20 | head -1  # último commit ok
git show <commit>:LOAD_TEST_RESULTS.md > baseline-ok.md

# 2. Rodar teste atual
./scripts/load-test-phase-3.sh baseline

# 3. Comparar
diff baseline-ok.md LOAD_TEST_RESULTS.md
# Se portal_read_duration_ms subiu: query está lenta
# Se notivisa_create_duration_ms subiu: função é bottleneck

# 4. Corrigir + re-testar
```

---

## Integração em CI/CD

### GitHub Actions — Rodar em cada merge

```yaml
# .github/workflows/load-test.yml
name: Load Test Phase 3
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      scenario:
        description: 'Test scenario'
        required: true
        default: 'baseline'
        type: choice
        options:
          - baseline
          - stress
          - spike

jobs:
  load-test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 50 # Para comparação com commits anteriores

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install k6
        run: |
          curl https://dl.k6.io/release/v0.50.0/k6-v0.50.0-linux-amd64.tar.gz | tar xz
          sudo mv k6 /usr/local/bin/

      - name: Install k6-reporter
        run: npm i -g k6-reporter

      - name: Setup gcloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: hmatologia2
          service_account_key: ${{ secrets.GCP_SA_KEY }}

      - name: Run load test
        id: load-test
        run: ./scripts/load-test-phase-3.sh ${{ github.event.inputs.scenario || 'baseline' }}
        env:
          BASE_URL: https://hmatologia2.web.app
          TEST_LAB_ID: lab_ci_${{ github.run_id }}_${{ github.run_attempt }}

      - name: Get previous baseline
        continue-on-error: true
        run: |
          git show HEAD~1:LOAD_TEST_RESULTS.md > /tmp/baseline-previous.md || echo "No previous baseline"

      - name: Compare with previous
        continue-on-error: true
        run: |
          if [ -f /tmp/baseline-previous.md ]; then
            echo "## Load Test Comparison" >> $GITHUB_STEP_SUMMARY
            diff -u /tmp/baseline-previous.md LOAD_TEST_RESULTS.md >> $GITHUB_STEP_SUMMARY || true
          fi

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results-${{ github.run_id }}
          path: |
            load-test-results-*.json
            load-test-results-*.html
            LOAD_TEST_RESULTS.md
          retention-days: 30

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const md = fs.readFileSync('LOAD_TEST_RESULTS.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Load Test Results\n\n${md}`
            });

      - name: Fail if thresholds not met
        run: |
          if grep -q "✗ FAIL" LOAD_TEST_RESULTS.md; then
            echo "Load test thresholds not met"
            exit 1
          fi
```

### Pre-deploy gate (antes de `firebase deploy`)

```bash
#!/usr/bin/env bash
# scripts/preflight-load-test.sh — chamar antes de deploy de functions

set -euo pipefail

echo "▶ Pre-deploy load test gate..."

# Se houver dados não-commitados, rodar baseline e verificar
if ! git diff --quiet; then
  echo "Uncommitted changes detected. Running baseline..."
  ./scripts/load-test-phase-3.sh baseline --skip-report

  if grep -q "✗ FAIL" LOAD_TEST_RESULTS.md; then
    echo "✗ Load test failed. Fix before deploying."
    cat LOAD_TEST_RESULTS.md
    exit 1
  fi
fi

echo "✓ Pre-deploy load test passed"
exit 0
```

**Integrar no deploy:**

```bash
# scripts/deploy.sh
#!/usr/bin/env bash

set -euo pipefail

# Type-check
npx tsc --noEmit

# Build
npm run build

# Pre-deploy gates
bash scripts/preflight-secrets-check.sh
bash scripts/preflight-load-test.sh  # NOVO

# Deploy
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2

echo "✓ Deployment complete"
```

---

## Monitoramento pós-deploy

Após deploy, monitorar métricas reais vs k6 predictions:

```bash
# 1. Comparar latência: k6 vs Cloud Logging
echo "=== k6 predictions ==="
grep "duration_ms" LOAD_TEST_RESULTS.md

echo -e "\n=== Real execution (last 1h) ==="
gcloud logging read \
  'resource.type="cloud_function" AND timestamps_start > "2026-05-07T13:00:00Z"' \
  --format='table(jsonPayload.function_name,jsonPayload.duration_ms)' \
  --limit=100

# 2. Verificar erro rate
echo "=== k6 predictions ==="
grep "Error Rate" LOAD_TEST_RESULTS.md

echo -e "\n=== Real errors (last 1h) ==="
gcloud logging read \
  'resource.type="cloud_function" AND severity="ERROR" AND timestamps_start > "2026-05-07T13:00:00Z"' \
  --format=json | jq 'length'

# 3. Se discrepâncias > 20%: investigar
#    - Cache hitting better than predicted?
#    - Network conditions?
#    - Real workload distribution diferente?
```

---

## Troubleshooting

### "k6 não está instalado"

```bash
# Instalar via package manager
# macOS: brew install k6
# Ubuntu: sudo apt-get install k6
# Windows: choco install k6

# Ou download direto: https://k6.io/docs/getting-started/installation/
```

### "Teste falha com Connection refused"

```bash
# 1. Verificar se Hosting está up
curl -I https://hmatologia2.web.app
# Expected: 200 OK

# 2. Se em staging, sobrescrever BASE_URL
BASE_URL=https://staging.example.com ./scripts/load-test-phase-3.sh

# 3. Verificar se Functions estão deployadas
firebase deploy --only functions --project hmatologia2 --dry-run
```

### "Métricas mostram N/A"

```bash
# Pode ser que JSON parsing falhou
# Verificar JSON bruto:
jq '.metrics' load-test-results-*.json | head -20

# Se vazio: k6 não capturing as métricas esperadas
# Verificar: script usa custom metrics (trends, counters)?
```

### "Threshold FAIL mas deveria PASS"

```bash
# Pode ser variância normal (executar 2-3x)
./scripts/load-test-phase-3.sh baseline
./scripts/load-test-phase-3.sh baseline
./scripts/load-test-phase-3.sh baseline

# Tomar média
awk '/duration_ms.*p95/ { print }' LOAD_TEST_RESULTS.md

# Se consistentemente fail: problema real, investigar
```

---

## Roadmap futuro

- [ ] **Distribuição geográfica:** k6 Cloud para testar de múltiplas regiões
- [ ] **Chaos testing:** simular falhas de Firestore, network latency
- [ ] **Customização de workload:** permite usuário sobrescrever distribuição (50% reads, 30% writes, etc)
- [ ] **Alertas automáticos:** Slack notification se threshold falhar em CI
- [ ] **Histórico:** gráficos de performance ao longo do tempo (antes/depois otimizações)
- [ ] **E2E + load:** combinar com teste e2e real (Detox) sob carga

---

## Referências

- k6 documentation: https://k6.io/docs/
- k6 API: https://k6.io/docs/javascript-api/
- k6-reporter: https://github.com/benc-uk/k6-reporter
- k6 Cloud: https://cloud.k6.io/
- Firebase quotas: https://firebase.google.com/docs/firestore/quotas
- Cloud Functions scaling: https://cloud.google.com/functions/docs/concepts/rates
- Phase 3 schema: `/src/features/[modules]/types` (ver tipos de cada módulo)
