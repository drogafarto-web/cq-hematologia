# Load Test — Example Outputs & Interpretations

Exemplos reais de output que você verá ao executar o suite de load testing.

---

## Setup & Pré-requisitos

### Saída de verificação (k6 + k6-reporter OK)

```
▶ Checando k6 instalado...
✓ k6 v0.50.0
▶ Checando k6-reporter...
✓ k6-reporter disponível
```

### Saída de verificação (k6 falta)

```
▶ Checando k6 instalado...
✗ k6 não encontrado. Instale: https://k6.io/docs/getting-started/installation/
Exit code: 1
```

---

## Banner de Início de Teste

### PowerShell (Windows)

```
╔════════════════════════════════════════════════════════════════════════════╗
║                   HC Quality Phase 3 Load Test                             ║
╠════════════════════════════════════════════════════════════════════════════╣
║ Scenario: baseline                                                          ║
║ Lab ID: lab_test_load_001                                                  ║
║                                                                            ║
║ Métricas capturadas:                                                       ║
║   • Response time (p50, p95, p99)                                           ║
║   • Error rate + quota exceeded                                             ║
║   • Firestore reads/writes                                                  ║
║   • Function execution time                                                 ║
║                                                                            ║
║ Resultado será exportado para:                                              ║
║   JSON: scripts/load-test-results-20260507_143215.json                     ║
║   HTML: scripts/load-test-results-20260507_143215.html                     ║
║   MD:   LOAD_TEST_RESULTS.md                                                ║
╚════════════════════════════════════════════════════════════════════════════╝

▶ Iniciando teste k6...
```

---

## k6 Test Execution Output

### Durante ramp-up (1 min)

```
     data_received..................: 45.3 kB  0.76 kB/s
     data_sent......................: 23.2 kB  0.39 kB/s
     http_req_duration..............: avg=142.3ms min=89.2ms med=135ms max=287ms p(90)=195ms p(95)=212ms p(99)=251ms
     http_req_failed................: 0        0%
     iterations.....................: 120      2/s
     vus............................: 3        min=0 max=10
     vus_max........................: 10
```

### Sustain phase (5 min)

```
     draft_lock_duration_ms..........: avg=84.3ms min=32.1ms med=78ms max=156ms p(90)=110ms p(95)=128ms p(99)=142ms
     errors..........................: 0        0%
     firestore_reads................: 847
     firestore_writes...............: 203
     notivisa_create_duration_ms....: avg=267.2ms min=118ms med=251ms max=458ms p(90)=356ms p(95)=378ms p(99)=401ms
     portal_read_duration_ms.........: avg=126.1ms min=45.3ms med=119ms max=243ms p(90)=162ms p(95)=178ms p(99)=201ms
     quota_exceeded.................: 0
```

### Final summary (após ramp-down)

```
running (7m0s), 0/10 VUs, 10 complete and 0 interrupted iterations
baseline ✗ [100%] 10 VUs  7m

     ✓ portal read: status is 200 or 404
     ✗ portal read: response time < 250ms
       expected: true
       actual: false
       failing expression: respTime < 250

     ✓ NOTIVISA create: status is 200 or 201
     ✓ NOTIVISA create: response time < 300ms
     ...

     checks...........................: 89.3% 1257 out of 1408
     data_received...................: 4.3 MB  10.2 kB/s
     data_sent........................: 2.1 MB  5.0 kB/s
     draft_lock_duration_ms..........: avg=84.1ms min=31ms med=78ms max=203ms p(90)=109ms p(95)=127ms p(99)=151ms ✓
     errors...........................: 0.2%    3
     firestore_reads.................: 2847
     firestore_writes................: 687
     http_req_duration..............: avg=168.2ms min=21ms med=142ms max=487ms p(90)=251ms p(95)=287ms p(99)=342ms
     http_req_failed................: 1.1%    15
     notivisa_create_duration_ms....: avg=269.1ms min=112ms med=254ms max=521ms p(90)=367ms p(95)=391ms p(99)=412ms ✓
     portal_read_duration_ms.........: avg=129.3ms min=44ms med=121ms max=298ms p(90)=165ms p(95)=181ms p(99)=208ms ✓
     critical_escalation_duration_ms: avg=187.5ms min=68ms med=179ms max=352ms p(90)=243ms p(95)=267ms p(99)=294ms ✓
     quota_exceeded.................: 0       0
     iterations.....................: 1408    3.36/s
     vus............................: 0       min=0 max=10
     vus_max........................: 10
```

---

## Markdown Summary Output

### Resultado ✓ PASS (baseline OK)

**File:** `LOAD_TEST_RESULTS.md`

```markdown
# Load Test Results — HC Quality Phase 3

Date: 2026-05-07 14:32:15
Scenario: baseline
Lab ID: lab_test_load_001
Duration: 420s

## Test Configuration

- Scenario: baseline
- VUs Override: none
- Duration Override: none
- Test Lab ID: lab_test_load_001

## Key Metrics

### Response Times
- Portal Config Reads (p95): 181ms
- NOTIVISA Creates (p95): 378ms
- Critical Escalations (p95): 267ms
- Draft Locks (p95): 127ms

### Throughput
- Firestore Reads: 2847
- Firestore Writes: 687
- Quota Exceeded: 0

### Error Rate
- Total Errors: 0.2%

## SLA Assessment

| Metric | Target | Status |
|--------|--------|--------|
| Error Rate | <5% | ✓ PASS |
| P95 Latency | <250ms | ✓ PASS |
| Portal Reads P95 | <150ms | ✗ FAIL |
| Quota Exceeded | <10 | ✓ PASS |

## Outputs

- JSON Results: load-test-results-20260507_143215.json
- HTML Report: load-test-results-20260507_143215.html
- This Summary: LOAD_TEST_RESULTS.md

## Next Steps

1. Review portal reads — 181ms is above 150ms target (120% of target)
2. If recent change to portal schema: investigate query or index
3. Compare with previous baseline: is this regression or expected variance?
4. If >10% above: create issue for optimization
```

### Resultado ✗ FAIL (stress test broke something)

**File:** `LOAD_TEST_RESULTS.md`

```markdown
# Load Test Results — HC Quality Phase 3

Date: 2026-05-07 15:10:42
Scenario: stress
Lab ID: lab_test_load_001
Duration: 840s

## Key Metrics

### Response Times
- Portal Config Reads (p95): 542ms ⚠
- NOTIVISA Creates (p95): 1.2s ⚠
- Critical Escalations (p95): 823ms ⚠
- Draft Locks (p95): 456ms ⚠

### Throughput
- Firestore Reads: 8,247
- Firestore Writes: 2,103
- Quota Exceeded: 47 ⚠

### Error Rate
- Total Errors: 12.3% ⚠

## SLA Assessment

| Metric | Target | Status |
|--------|--------|--------|
| Error Rate | <5% | ✗ FAIL |
| P95 Latency | <250ms | ✗ FAIL |
| Portal Reads P95 | <150ms | ✗ FAIL |
| Quota Exceeded | <10 | ✗ FAIL |

## Outputs

- JSON Results: load-test-results-20260507_151042.json
- HTML Report: load-test-results-20260507_151042.html
- This Summary: LOAD_TEST_RESULTS.md

## Next Steps

1. Multiple thresholds failed under 100 VUs — serious issue
2. Check Cloud Logs for errors:
   gcloud logging read --limit=100 --format=json | jq '.[] | select(.severity=="ERROR")'
3. Review recent changes to Functions or Firestore queries
4. Quota exceeded 47 times: check if queries are unindexed
5. Fix + re-test before merging
```

---

## HTML Report Example

### Portal
Se gerado com k6-reporter, exibe:

```
┌─ Load Test Report
├─ Summary Statistics
│  ├─ Total Requests: 1408
│  ├─ Failed: 15 (1.1%)
│  ├─ Duration: 420s
│  └─ RPS (avg): 3.36
│
├─ Request Metrics
│  ├─ p50: 142ms
│  ├─ p90: 251ms
│  ├─ p95: 287ms ← Primary SLA metric
│  ├─ p99: 342ms
│  └─ max: 487ms
│
├─ Checks
│  ├─ portal read: status is 200 or 404 ... 89.3%
│  ├─ portal read: response time < 250ms ... 67.2% ← Some failed
│  ├─ NOTIVISA create: status is 200 or 201 ... 98.7%
│  └─ ...
│
├─ Trends (gráficos)
│  ├─ Response Time over time (linha)
│  ├─ Request Volume (barra)
│  ├─ Error Rate (linha em vermelho)
│  └─ VU Ramp (linha)
│
└─ Errors
   ├─ GET /portalConfig 504 ... 8 ocorrências
   ├─ POST /notiVisaEvents 429 ... 2 ocorrências
   └─ ...
```

(HTML interativo com zoom, filtros por request type, etc.)

---

## Comparação Antes/Depois de Otimização

### Baseline anterior (commit 2 semanas atrás)

```markdown
## Key Metrics

### Response Times
- Portal Config Reads (p95): 287ms ⚠
- NOTIVISA Creates (p95): 412ms
- Critical Escalations (p95): 301ms
- Draft Locks (p95): 145ms

### Error Rate
- Total Errors: 2.1%
```

### Após adicionar índice Firestore

```markdown
## Key Metrics

### Response Times
- Portal Config Reads (p95): 142ms ✓ (49% melhor)
- NOTIVISA Creates (p95): 378ms ✓ (8% melhor)
- Critical Escalations (p95): 267ms ✓ (11% melhor)
- Draft Locks (p95): 127ms ✓ (12% melhor)

### Error Rate
- Total Errors: 0.2% ✓ (91% melhor)
```

**Documento commit:**

```
perf: add composite index for portal config query

Portal reads were hitting 287ms P95 (target 150ms) due to unindexed
'portalEnabled' + 'modifiedTime' composite query.

Added Firestore index:
  Collection: labs/{labId}/portalConfig
  Fields: portalEnabled (Asc), modifiedTime (Desc)

Results post-index:
  Before: P95 287ms, error rate 2.1%
  After:  P95 142ms, error rate 0.2%
  Improvement: 49% latency reduction, 91% error reduction

Load test: ./scripts/load-test-phase-3.sh baseline
Results committed: LOAD_TEST_RESULTS.md
```

---

## Real-world Scenarios

### Cenário 1: "Portal está lento pra alguns usuários"

**Investigate:**

```bash
# 1. Check baseline de quando estava ok
git log --oneline -n 50 | grep "load test\|baseline"
git show <commit>:LOAD_TEST_RESULTS.md > baseline-ok.md

# 2. Run current baseline
./scripts/load-test-phase-3.sh baseline

# 3. Compare
diff baseline-ok.md LOAD_TEST_RESULTS.md
# Output:
# - Portal Config Reads (p95): 142ms
# + Portal Config Reads (p95): 287ms   ← Regression!

# 4. Culprit: recent query change or missing index
git log -p -n 5 -- src/features/portal/services/

# 5. Fix (add index or optimize query)

# 6. Re-test
./scripts/load-test-phase-3.sh baseline
# Confirm: Portal Config Reads (p95): 145ms ✓
```

### Cenário 2: "App crashes under heavy load"

**Investigate:**

```bash
# 1. Run stress test to reproduce
./scripts/load-test-phase-3.sh stress

# 2. If error rate >5%, check logs
gcloud logging read 'resource.type="cloud_function"' \
  --limit=100 --format=json | \
  jq '.[] | select(.severity=="ERROR") | {function: .resource.labels.function_name, error: .jsonPayload}'

# Example output:
# {
#   "function": "criticalResultsEscalation",
#   "error": "RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'firestore_writes_per_minute'"
# }

# 3. Fix: either optimize writes or increase quota
firebase functions:config:set quotas.escalation_writes=1000

# 4. Re-test
./scripts/load-test-phase-3.sh stress
# Confirm: Error Rate: 0.2% ✓
```

### Cenário 3: "Performance degraded over time (leak?)"

**Investigate:**

```bash
# 1. Compare weekly baselines (track trend)
for week in {1..4}; do
  git show "main~$((week*7))":LOAD_TEST_RESULTS.md | grep "Portal\|Error Rate"
done

# Output:
# Week 1: Portal P95 142ms, Error Rate 0.1%
# Week 2: Portal P95 158ms, Error Rate 0.3%
# Week 3: Portal P95 189ms, Error Rate 0.8%
# Week 4: Portal P95 234ms, Error Rate 1.7%   ← Trending up!

# 2. Check for listener leaks
grep -r "onSnapshot" src/ --include="*.ts" | grep -v "unsubscribe"
# Find unsubscribed listeners and fix cleanup in useEffect

# 3. Re-test
./scripts/load-test-phase-3.sh baseline
# Confirm: Portal P95 145ms, Error Rate 0.1% ✓
```

---

## JSON Raw Metrics

### Excerpt from `load-test-results-*.json`

```json
{
  "metrics": {
    "portal_read_duration_ms": {
      "type": "Trend",
      "values": {
        "avg": 129.3,
        "min": 44.2,
        "med": 121.5,
        "max": 298.7,
        "p(90)": 165.2,
        "p(95)": 181.3,
        "p(99)": 208.4
      }
    },
    "errors": {
      "type": "Rate",
      "value": 0.2
    },
    "firestore_reads": {
      "type": "Counter",
      "value": 2847
    },
    "quota_exceeded": {
      "type": "Counter",
      "value": 0
    },
    "http_req_duration": {
      "type": "Trend",
      "values": {
        "avg": 168.2,
        "p(95)": 287.4,
        "p(99)": 342.1
      }
    }
  }
}
```

---

## Dashboard Integration (Future)

Exemplo de como seria integrado em Grafana/Datadog:

```
┌─ HC Quality Performance Baseline
├─ Portal Reads P95
│  ├─ Target: 150ms
│  ├─ Current: 142ms ✓
│  ├─ Trend: ↓ 2% last week
│  └─ Last test: 2026-05-07 14:32
│
├─ Error Rate
│  ├─ Target: <1%
│  ├─ Current: 0.2% ✓
│  ├─ Trend: ↓ stable
│  └─ Last test: 2026-05-07 14:32
│
├─ Firestore Quota
│  ├─ Target: <10 exceeded
│  ├─ Current: 0 ✓
│  ├─ Trend: ↓ 0 for 30 days
│  └─ Last test: 2026-05-07 14:32
│
└─ Alerts
   └─ None (all green)
```

---

## Printable SLA Checklist

Para colar em docs de compliance (ISO 15189):

```
Load Test Results — HC Quality Phase 3
Date: 2026-05-07
Scenario: Baseline (10 concurrent users × 5 min)
Lab ID: lab_test_load_001

PERFORMANCE REQUIREMENTS

☑ Portal Response Time (P95)
   Target: <150ms
   Actual: 181ms
   Status: WITHIN TOLERANCE (±20%)
   
☑ NOTIVISA Event Latency (P95)
   Target: <300ms
   Actual: 378ms
   Status: EXCEEDED (should investigate)

☑ Critical Escalation (P95)
   Target: <200ms
   Actual: 267ms
   Status: WITHIN TOLERANCE (±35%)

☑ Draft Lock Latency (P95)
   Target: <100ms
   Actual: 127ms
   Status: EXCEEDED (should investigate)

RELIABILITY REQUIREMENTS

☑ Error Rate
   Target: <5%
   Actual: 0.2%
   Status: PASS ✓

☑ HTTP Failures
   Target: <1%
   Actual: 0% (0 failures)
   Status: PASS ✓

☑ Quota Exceeded
   Target: <10 total
   Actual: 0
   Status: PASS ✓

OVERALL ASSESSMENT: CONDITIONAL PASS
- 5 of 7 requirements met
- 2 thresholds exceeded but within acceptable variance
- Recommend investigation: draft lock performance after next feature release
- Document findings in quality records

Signed: Load Test Automation (k6 v0.50.0)
Date: 2026-05-07 14:32:15 UTC
```

---

**Todos esses exemplos são baseados em execuções realistas. Use como referência ao interpretar seus próprios resultados.**
