# Load Testing — HC Quality Phase 3 — Quick Reference

## TL;DR

```bash
# Instalar k6 (uma vez)
# macOS: brew install k6
# Linux: sudo apt-get install k6
# Windows: choco install k6

# Instalar k6-reporter (opcional, para HTML report)
npm i -g k6-reporter

# Executar teste
## PowerShell (Windows)
.\scripts\load-test-phase-3.ps1                    # baseline
.\scripts\load-test-phase-3.ps1 -Scenario stress    # stress test

## Bash (Linux/macOS)
./scripts/load-test-phase-3.sh                      # baseline
./scripts/load-test-phase-3.sh stress               # stress test
```

---

## O que testa?

**Cenários:**

1. **Baseline** (padrão) — 10 concurrent users × 5 min
   - Detecta regressões em carga normal
   - SLA targets: P95 <250ms, error rate <1%

2. **Stress** — 100 concurrent users × 10 min
   - Encontra o ponto de quebra
   - SLA targets: P95 <250ms, error rate <5%

3. **Spike** — 500 concurrent users × 2 min pico
   - Simula picos inesperados (laudo em batch, escalação crítica)
   - Verifica recuperação após pico

**Workload Distribution:**

| Workload | Peso | Descrição | SLA |
|----------|------|-----------|-----|
| Portal config reads | 50% | 10k pacientes acessando portal | <150ms P95 |
| NOTIVISA events | 20% | Criação de eventos (publicação de laudos) | <300ms P95 |
| Critical escalations | 15% | Escalação de resultados críticos | <200ms P95 |
| Draft locks | 15% | Aquisição/liberação de locks (edição RT) | <100ms P95 |

---

## Uso detalhado

### PowerShell (Windows)

```powershell
# Baseline padrão
.\scripts\load-test-phase-3.ps1

# Stress test customizado
.\scripts\load-test-phase-3.ps1 -Scenario stress -Duration 10m

# Spike test com VUs explícito
.\scripts\load-test-phase-3.ps1 -Scenario spike -VUs 500

# Sem gerar HTML report (rápido)
.\scripts\load-test-phase-3.ps1 -SkipReport

# Lab ID customizado (staging)
.\scripts\load-test-phase-3.ps1 -TestLabId lab_staging_001
```

### Bash (Linux/macOS)

```bash
# Baseline padrão
./scripts/load-test-phase-3.sh

# Stress test
./scripts/load-test-phase-3.sh stress

# Spike test customizado
./scripts/load-test-phase-3.sh spike --vus 500 --duration 2m

# Sem HTML report
./scripts/load-test-phase-3.sh baseline --skip-report

# Lab ID customizado
TEST_LAB_ID=lab_staging_001 ./scripts/load-test-phase-3.sh
```

---

## Outputs

Após o teste, três arquivos são gerados:

1. **`load-test-results-{timestamp}.json`**
   - Métricas brutas k6 em JSON
   - Importar em ferramentas de análise customizada se necessário

2. **`load-test-results-{timestamp}.html`** (se k6-reporter instalado)
   - Relatório visual interativo
   - Gráficos de latency, throughput, errors
   - Comparação de percentis

3. **`LOAD_TEST_RESULTS.md`**
   - Resumo em Markdown
   - SLA assessment (✓ PASS / ✗ FAIL)
   - Próximos passos

### Exemplo de resumo:

```
# Load Test Results — HC Quality Phase 3

Date: 2026-05-07 14:32:15
Scenario: baseline
Lab ID: lab_test_load_001
Duration: 360s

## Key Metrics

### Response Times
- Portal Config Reads (p95): 142ms ✓
- NOTIVISA Creates (p95): 285ms ✓
- Critical Escalations (p95): 195ms ✓
- Draft Locks (p95): 89ms ✓

### Throughput
- Firestore Reads: 2,847
- Firestore Writes: 687
- Quota Exceeded: 0

## SLA Assessment

| Metric | Target | Status |
|--------|--------|--------|
| Error Rate | <5% | ✓ PASS |
| Portal Reads P95 | <150ms | ✓ PASS |
| Quota Exceeded | <10 | ✓ PASS |
```

---

## Interpretação dos resultados

### ✓ Resultado bom (PASS):

```
Portal Config Reads (p95): 142ms
└─ Dentro do target (<150ms)
   Significa: 95% dos portal reads resolvem em <142ms
   Ação: Nenhuma. Baseline está saudável.
```

### ✗ Resultado ruim (FAIL):

```
Portal Config Reads (p95): 287ms
└─ Acima do target (<150ms)
   Significa: 95% dos reads levam >150ms — pode ser gargalo
   Ação: Investigar:
     1. Está usando onSnapshot? Verificar unsubscribe em cleanup
     2. Índices Firestore criados? Ver Firebase Console → Firestore → Indexes
     3. Query escaneando muitos docs? Adicionar filter ou limit
     4. Function em cascata? Verificar logs em Cloud Logging
```

### Quota Exceeded > 0:

```
Quota Exceeded: 5
└─ Alguns requests bateram rate limit
   Ação: Verificar:
     1. Quotas do projeto: https://console.cloud.google.com/quotas
     2. Rate limiting em Functions (se aplicável)
     3. Considerar cache para reads repetidos (onSnapshot com localCache)
```

### Error Rate > 5%:

```
Error Rate: 8.3%
└─ Muitos requests falharam sob stress
   Ação: Verificar Cloud Logs:
     gcloud logging read --limit=100 --format=json | jq '.[] | select(.severity=="ERROR")'
     Procurar: timeout, PERMISSION_DENIED, RESOURCE_EXHAUSTED
```

---

## Comparar com Firebase Console em tempo real

Enquanto o teste roda (ou após), monitor as métricas reais no Cloud Logging:

### Errors em Functions:

```bash
# Últimos 100 erros
gcloud logging read --limit=100 --format=json resource.labels.function_name | jq '.[] | select(.severity=="ERROR")'

# Erros de um função específica
gcloud logging read 'resource.type="cloud_function" AND resource.labels.function_name="criticalResultsEscalation"' --limit=50
```

### Execution time de Functions:

```bash
# Ver duração de execução
gcloud logging read 'resource.type="cloud_function" AND labels.execution_id=*' --format=json | jq '.[] | {duration: .jsonPayload.duration_ms, function: .resource.labels.function_name}'
```

### Firestore quota:

```
1. Abrir Firebase Console → Hubs → Firestore
2. Aba "Usage" → ver reads/writes em tempo real
3. Se atingir quota: ajustar em Project Settings → Quotas
```

---

## Troubleshooting

### k6 não encontrado

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
curl https://dl.k6.io/release/v0.50.0/k6-v0.50.0-linux-amd64.tar.gz | tar xz
sudo mv k6 /usr/local/bin/

# Windows (Chocolatey)
choco install k6

# Verificar
k6 version
```

### k6-reporter não encontrado

```bash
npm i -g k6-reporter

# Se usar nvm/volta
volta install k6-reporter
```

### Teste falha com "Connection refused"

- Verifica se `https://hmatologia2.web.app` está acessível
- Se em staging: usar `BASE_URL=https://staging.example.com`
- Verificar firewall / network policies

### Erro "Permission denied" em Functions

- Verifica se Cloud Functions estão deployadas (`firebase deploy --only functions`)
- Checks security rules (`firestore.rules` permite leitura)
- Se novo módulo: rodar `hcq-deploy-gates` antes

### Métricas "N/A" no relatório

- Pode ser que k6-reporter ou jq não estejam instalados
- Verificar JSON bruto em `load-test-results-{timestamp}.json`
- Abrir JSON em editor e procurar `"metrics":` para validar coleta

---

## Integrar em CI/CD

Exemplo de GitHub Actions para rodar load test em cada merge:

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
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install k6
        run: |
          curl https://dl.k6.io/release/v0.50.0/k6-v0.50.0-linux-amd64.tar.gz | tar xz
          sudo mv k6 /usr/local/bin/
      
      - name: Install k6-reporter
        run: npm i -g k6-reporter
      
      - name: Run load test
        run: ./scripts/load-test-phase-3.sh ${{ inputs.scenario || 'baseline' }}
        env:
          TEST_LAB_ID: lab_ci_${{ github.run_id }}
      
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: load-test-results-*.{json,html}
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const md = fs.readFileSync('LOAD_TEST_RESULTS.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: md
            });
```

---

## Regras de ouro

1. **Roda antes de qualquer deploy de mudança em schema/functions**
2. **Compare baseline atual com baseline anterior** — há regressão? Investigar antes de merge
3. **Não publique sem passar em stress test** — validar sob carga, não só em dev
4. **Documenta achados em commit/PR** — registre outliers encontrados
5. **Re-teste após otimizações** — antes/depois comparação é melhor evidência

---

## Referências

- k6 docs: https://k6.io/docs/
- k6-reporter: https://github.com/benc-uk/k6-reporter
- Firebase quota limits: https://firebase.google.com/docs/firestore/quotas
- Cloud Functions scaling: https://cloud.google.com/functions/docs/concepts/rates
- RDC 978 (requisitos operacionais): `docs/RDC_978_2025_Resumo.md` no Obsidian
