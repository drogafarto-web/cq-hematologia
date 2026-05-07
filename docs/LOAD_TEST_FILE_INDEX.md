# Load Testing — Complete File Index

Quick navigation guide para todos os arquivos entregues.

---

## Core Scripts

### 🔧 Main k6 Script

**`scripts/load-test-phase-3.js`** (430 lines)

**What it is:**
- k6 load testing script with 4 workloads (portal reads, NOTIVISA, escalations, draft locks)
- 3 scenarios: baseline (10 VUs), stress (100 VUs), spike (500 VUs)
- 10 custom metrics + 8 SLA thresholds

**When to use:**
- Run via `k6 run scripts/load-test-phase-3.js` (direct)
- Or via wrapper: `./scripts/load-test-phase-3.sh` or `.\scripts\load-test-phase-3.ps1`

**Read if:**
- You want to customize workload distribution
- You need to add new metric (Trend, Counter, Rate)
- You want to understand k6 syntax

---

### 🪟 PowerShell Wrapper (Windows)

**`scripts/load-test-phase-3.ps1`** (280 lines)

**What it is:**
- Wrapper script for Windows PowerShell users
- Handles k6 installation check, k6-reporter integration, Markdown output

**When to use:**
```powershell
.\scripts\load-test-phase-3.ps1                    # baseline (default)
.\scripts\load-test-phase-3.ps1 -Scenario stress    # stress test
.\scripts\load-test-phase-3.ps1 -VUs 50             # override VUs
.\scripts\load-test-phase-3.ps1 -SkipReport         # no HTML report
```

**Read if:**
- You're on Windows and want to understand the wrapper
- You need to customize parameters

---

### 🐧 Bash Wrapper (Linux/macOS)

**`scripts/load-test-phase-3.sh`** (350 lines)

**What it is:**
- Equivalent wrapper for Linux/macOS
- Same functionality as PowerShell version
- Graceful fallback for jq, ANSI colors

**When to use:**
```bash
./scripts/load-test-phase-3.sh                 # baseline (default)
./scripts/load-test-phase-3.sh stress           # stress test
./scripts/load-test-phase-3.sh spike --vus 500 # custom scenario
```

**Read if:**
- You're on Linux/macOS and want to understand the wrapper
- You need to debug or customize

---

## Documentation

### 📖 Quick Reference (START HERE)

**`docs/LOAD_TEST_QUICK_REFERENCE.md`** (350 lines)

**Purpose:**
- TL;DR setup (k6 installation, one-time)
- What each test does (workload breakdown + SLA targets)
- Usage examples (Windows + Linux)
- Metric interpretation (PASS vs FAIL)
- Troubleshooting (k6 not found, connection issues, etc)

**Read if:**
- This is your first time using load testing
- You need quick setup + usage examples
- You want to know what each metric means

**Key sections:**
- § TL;DR — 5-minute installation
- § Workload Simulation — what's being tested
- § Uso detalhado — command examples
- § Interpretação dos resultados — PASS vs FAIL

---

### 🏗️ Integration Guide (COMPLETE GUIDE)

**`docs/LOAD_TEST_INTEGRATION_GUIDE.md`** (500 lines)

**Purpose:**
- Full architecture of load test suite
- Setup instructions (detailed)
- Development workflow examples
- CI/CD integration (GitHub Actions template)
- Pre-deploy gate integration
- Post-deploy monitoring patterns
- Roadmap for future enhancements

**Read if:**
- You need to integrate into CI/CD
- You want detailed understanding of architecture
- You're setting up pre/post-deploy gates
- You need full troubleshooting guide

**Key sections:**
- § Arquitetura do teste — 4 workloads × 10 metrics × 8 thresholds
- § Setup inicial — k6 installation + validation
- § Integração em CI/CD — GitHub Actions complete template
- § Pre-deploy gate — automated gate before deploy

---

### 📊 Example Outputs (REAL-WORLD EXAMPLES)

**`docs/LOAD_TEST_EXAMPLE_OUTPUTS.md`** (400 lines)

**Purpose:**
- Real-world examples of test outputs
- PASS vs FAIL scenarios with interpretation
- Before/after optimization examples
- Troubleshooting scenario walkthroughs
- Raw JSON metrics example
- Printable SLA checklist for compliance

**Read if:**
- You want to understand what output looks like
- You need examples of how to interpret results
- You're troubleshooting a specific issue
- You need compliance documentation format

**Key sections:**
- § Banner de Início — what you see when test starts
- § Markdown Summary Output — SLA assessment format
- § Comparação Antes/Depois — optimization before/after
- § Real-world Scenarios — "portal is slow", "crashes under load", etc

---

### ✅ Implementation Checklist

**`docs/LOAD_TEST_IMPLEMENTATION_CHECKLIST.md`** (400 lines)

**Purpose:**
- Step-by-step checklist for implementing load testing
- 7 phases: setup, development, CI/CD, monitoring, baselines, optimization, compliance
- Time estimates per phase
- Detailed commands for each step

**Read if:**
- You're implementing load testing from scratch
- You need a structured approach to rollout
- You want to track progress (check boxes)
- You need to coordinate with team

**Key sections:**
- § Phase 1: Local Setup — k6 installation + validation
- § Phase 2: Development Workflow — daily usage patterns
- § Phase 3: CI/CD Integration — GitHub Actions + pre-deploy gate
- § Phase 4: Post-Deploy Monitoring — real-time alerts
- § Phase 5: Weekly Baseline Tracking — trend analysis
- § Phase 6: Optimization & Iteration — performance fixes
- § Phase 7: Compliance Documentation — audit trail

---

### 📋 Delivery Summary

**`docs/LOAD_TEST_DELIVERY_SUMMARY.md`** (300 lines)

**Purpose:**
- Recap of all deliverables
- What was delivered + line counts
- Usage patterns overview
- Compliance notes
- Next steps (immediate + short-term + medium-term)

**Read if:**
- You want overview of what was delivered
- You need to brief the team on capabilities
- You're planning next steps

---

### 📑 File Index (THIS FILE)

**`docs/LOAD_TEST_FILE_INDEX.md`**

**Purpose:**
- Navigation guide for all load testing files
- Quick reference for which file to read for what purpose

---

## Supporting Files

### 📄 Delivery Manifest

**`LOAD_TEST_DELIVERY.txt`** (root directory)

**Purpose:**
- ASCII formatted summary of entire delivery
- Suitable for copy-paste into email/Slack
- Includes metrics, usage, checklist

---

## Output Files (Generated After Each Run)

### 📊 JSON Metrics

**`load-test-results-{timestamp}.json`**

**What it is:**
- Raw k6 metrics in JSON format
- Contains all trends, counters, rates
- Can be imported into analysis tools

**When generated:**
- After each test run (baseline, stress, spike)

**Use for:**
- Custom analysis
- Importing to monitoring dashboards
- Long-term historical tracking

---

### 🎨 HTML Report

**`load-test-results-{timestamp}.html`**

**What it is:**
- Visual report generated by k6-reporter
- Charts, graphs, percentiles
- Interactive filters and drill-down

**When generated:**
- After each test run (if k6-reporter installed)

**Use for:**
- Visual analysis of performance
- Presenting results to stakeholders
- Spotting trends in the data

---

### 📄 Markdown Summary

**`LOAD_TEST_RESULTS.md`**

**What it is:**
- SLA assessment in Markdown format
- Pass/fail for each threshold
- Key metrics summary
- Exportable to PR comments

**When generated:**
- After each test run

**Use for:**
- Documenting baseline
- PR comments
- Commit messages
- Quick reference (no need to open JSON)

---

## Recommended Reading Order

### For First-Time Users

1. **`LOAD_TEST_QUICK_REFERENCE.md`** (5 min) — understand what it does
2. **`docs/LOAD_TEST_IMPLEMENTATION_CHECKLIST.md`** (Phase 1) (15 min) — install k6
3. Run baseline test locally (5 min)
4. Review generated `LOAD_TEST_RESULTS.md` (5 min)

**Total:** 30 minutes

### For Integration into CI/CD

1. **`LOAD_TEST_INTEGRATION_GUIDE.md`** (30 min) — full architecture
2. § CI/CD Integration (20 min) — copy GitHub Actions template
3. § Pre-deploy gate (10 min) — integrate into deploy script
4. Test locally: `./scripts/deploy.sh` (dry-run)

**Total:** 60 minutes

### For Troubleshooting Issues

1. **`LOAD_TEST_EXAMPLE_OUTPUTS.md`** (10 min) — find your scenario
2. § Real-world Scenarios (10 min) — step-by-step fix
3. § Troubleshooting (5 min) — if still stuck

**Total:** 25 minutes

### For Compliance Documentation

1. **`LOAD_TEST_EXAMPLE_OUTPUTS.md`** § Printable SLA Checklist (5 min)
2. **`docs/LOAD_TEST_IMPLEMENTATION_CHECKLIST.md`** § Phase 7 (10 min)
3. Generate compliance record using example format

**Total:** 15 minutes

---

## File Location Map

```
hc quality/
├── scripts/
│   ├── load-test-phase-3.js         ← Core k6 script
│   ├── load-test-phase-3.ps1         ← Windows wrapper
│   └── load-test-phase-3.sh          ← Linux/macOS wrapper
│
├── docs/
│   ├── LOAD_TEST_QUICK_REFERENCE.md  ← START HERE (quick setup)
│   ├── LOAD_TEST_INTEGRATION_GUIDE.md ← Full architecture guide
│   ├── LOAD_TEST_DELIVERY_SUMMARY.md  ← Delivery recap
│   ├── LOAD_TEST_EXAMPLE_OUTPUTS.md   ← Real-world examples
│   ├── LOAD_TEST_IMPLEMENTATION_CHECKLIST.md ← Step-by-step
│   └── LOAD_TEST_FILE_INDEX.md        ← This file
│
├── LOAD_TEST_DELIVERY.txt            ← ASCII summary
│
└── LOAD_TEST_RESULTS.md              ← Generated after test run
    load-test-results-*.json          ← Generated after test run
    load-test-results-*.html          ← Generated after test run

```

---

## Quick Command Reference

| Task | Command | Output |
|------|---------|--------|
| **Baseline test** | `./scripts/load-test-phase-3.sh baseline` | LOAD_TEST_RESULTS.md |
| **Stress test** | `./scripts/load-test-phase-3.sh stress` | LOAD_TEST_RESULTS.md |
| **Spike test** | `./scripts/load-test-phase-3.sh spike` | LOAD_TEST_RESULTS.md |
| **Custom VUs** | `./scripts/load-test-phase-3.sh baseline --vus 50` | LOAD_TEST_RESULTS.md |
| **No HTML report** | `./scripts/load-test-phase-3.sh baseline --skip-report` | JSON + MD only |
| **Windows (PS)** | `.\scripts\load-test-phase-3.ps1 -Scenario baseline` | LOAD_TEST_RESULTS.md |
| **View results** | `cat LOAD_TEST_RESULTS.md` | Terminal |
| **View HTML** | `open load-test-results-*.html` | Browser |

---

## Key Contacts

- **k6 documentation:** https://k6.io/docs/
- **k6-reporter:** https://github.com/benc-uk/k6-reporter
- **Firebase quotas:** https://firebase.google.com/docs/firestore/quotas
- **RDC 978 (regulations):** See Obsidian: `01_Projetos/HC_Quality_RDC_978_2025_Resumo.md`

---

**Navigation tip:** Use Ctrl+F (Cmd+F) to search this file for specific keywords (e.g., "CI/CD", "troubleshoot", "baseline").
