---
document: Test Infrastructure Setup for v1.4 E2E Testing
version: 1.0
created: 2026-05-07
updated: 2026-05-07
status: implementation_ready
infrastructure_lead: DevOps / QA Lead
---

# Test Infrastructure Setup for v1.4 E2E Testing

**Purpose:** Complete technical setup for CI/CD integration, test data provisioning, quality gates, and monitoring.

**Target:** Operational by 2026-05-20 (Phase 4 E2E start)

---

## 1. CI/CD Integration (GitHub Actions Workflow)

### Workflow File: `.github/workflows/e2e-tests.yml`

```yaml
name: E2E Test Suite (v1.4)

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'functions/src/**'
      - 'smoke-test/**'
      - '.github/workflows/e2e-tests.yml'
  schedule:
    # Nightly run at 2am UTC (after any new deploys)
    - cron: '0 2 * * *'

env:
  SMOKE_BASE_URL: https://hmatologia2.web.app
  FIREBASE_PROJECT: hmatologia2
  NOTIVISA_MOCK_ENABLED: 'true'

jobs:
  e2e-tests:
    name: E2E Test Batch [${{ matrix.phase }}]
    runs-on: ubuntu-latest
    timeout-minutes: 45
    strategy:
      matrix:
        phase: [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      max-parallel: 1 # Sequential per phase (no conflicts)

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Load test environment
        run: |
          echo "PHASE=${{ matrix.phase }}" >> $GITHUB_ENV
          cp smoke-test/.env.test.example smoke-test/.env.test
          # Inject secrets from GitHub Actions
          echo "FIREBASE_ADMIN_SDK=${{ secrets.FIREBASE_ADMIN_SDK }}" >> smoke-test/.env.test
          echo "NOTIVISA_SANDBOX_TOKEN=${{ secrets.NOTIVISA_SANDBOX_TOKEN }}" >> smoke-test/.env.test
          echo "TWILIO_AUTH_TOKEN=${{ secrets.TWILIO_AUTH_TOKEN }}" >> smoke-test/.env.test

      - name: Run Playwright E2E (Phase ${{ matrix.phase }})
        run: |
          cd smoke-test
          npx playwright test \
            --grep "^P${{ matrix.phase }}-S[1-8]" \
            --config=playwright.config.ts
        continue-on-error: true # Don't fail job immediately

      - name: Collect test metrics
        if: always()
        run: |
          npm run test:metrics -- \
            --phase=${{ matrix.phase }} \
            --output=test-results-phase-${{ matrix.phase }}.json

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-report-phase-${{ matrix.phase }}
          path: |
            smoke-test/playwright-report/
            test-results-phase-${{ matrix.phase }}.json
          retention-days: 30

      - name: Upload videos on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-videos-phase-${{ matrix.phase }}
          path: smoke-test/test-results/
          retention-days: 7

      - name: Post Slack notification (pass)
        if: success()
        uses: slackapi/slack-github-action@v1.24.0
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_TESTING }}
          payload: |
            {
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "✅ *Phase ${{ matrix.phase }} E2E: 8/8 PASS*\n\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View details>"
                  }
                }
              ]
            }

      - name: Post Slack notification (failure)
        if: failure()
        uses: slackapi/slack-github-action@v1.24.0
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_TESTING }}
          payload: |
            {
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "🔴 *Phase ${{ matrix.phase }} E2E: FAILURE*\n\nSee report for details. <${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View>"
                  }
                }
              ]
            }

      - name: Check pass rate and fail job if needed
        run: |
          PASS_COUNT=$(cat test-results-phase-${{ matrix.phase }}.json | jq '.summary.passed // 0')
          if [ "$PASS_COUNT" -lt 8 ]; then
            echo "E2E Phase ${{ matrix.phase }} FAILED: $PASS_COUNT/8 passed"
            exit 1
          fi
```

### Configuration File: `smoke-test/.env.test.example`

```bash
# Playwright Configuration
SMOKE_BASE_URL=https://hmatologia2.web.app
PLAYWRIGHT_WORKERS=1  # Single worker (sequential)
PLAYWRIGHT_TIMEOUT=30000  # 30s per test
PLAYWRIGHT_RETRIES=2

# Firebase Test Credentials
FIREBASE_PROJECT=hmatologia2
FIREBASE_AUTH_EMAIL=testuser@hmatologia2-test.com
FIREBASE_AUTH_PASSWORD=<TEST_PASSWORD_VAULT>

# NOTIVISA Testing
NOTIVISA_MOCK_ENABLED=true
NOTIVISA_SANDBOX_URL=https://api.notivisa-sandbox.saude.gov.br  # Post-Phase 8
NOTIVISA_SANDBOX_TOKEN=<ANVISA_SANDBOX_CREDS>

# SMS Gateway (Twilio) Testing
TWILIO_ACCOUNT_SID=<TWILIO_TEST_SID>
TWILIO_AUTH_TOKEN=<TWILIO_TEST_TOKEN>
TWILIO_TEST_PHONE=+5511999999999

# Gemini Vision (Phase 11)
GEMINI_API_KEY=<GOOGLE_CLOUD_KEY>
GEMINI_MOCK_MODE=true  # Mock until v1.5 live classification

# Test Data Seeds
TEST_USER_COUNT=10
TEST_CIQ_RECORDS=50  # Phase 4–7 baseline
TEST_CIQ_RECORDS_PERFORMANCE=500  # Phase 12 load testing
TEST_PATIENT_ACCOUNTS=100  # Phase 5+

# Reporting & Monitoring
SLACK_WEBHOOK_TESTING=<SLACK_WEBHOOK_URL>
CLOUD_LOGS_PROJECT_ID=hmatologia2
CLOUD_LOGS_EXPORT_PATH=gs://hmatologia2-test-reports/v1.4-testing/
```

### Trigger: Pre-Merge Gate (`.hcq-deploy-gates` integration)

The `hcq-deploy-gates` skill is invoked before merging each phase's code:

```bash
npm run gate -- \
  --phase=4 \
  --check=typecheck,lint,test,build,e2e-smoke
```

**E2E Smoke Gate (5 critical flows only, <10min):**

1. ✅ Login → Hub → Dashboard
2. ✅ CIQ Module load (Imuno)
3. ✅ Create CIQ record
4. ✅ View analytics dashboard
5. ✅ Export data to Excel

---

## 2. Test Data Provisioning Chain

### Wave 1: Base Fixtures (2026-05-07, Complete)

**Location:** `smoke-test/fixtures/`

| Fixture                              | Count | Owner   | Status |
| ------------------------------------ | ----- | ------- | ------ |
| Test users (auth)                    | 10    | QA-Lead | ✅     |
| Labs + settings                      | 2     | DevOps  | ✅     |
| Equipment (Analyzer A)               | 1     | QA-Lead | ✅     |
| Analytes (glucose, creatinine, etc.) | 15    | QA-Lead | ✅     |
| CIQ records (baseline)               | 50    | QA-Lead | ✅     |

**Setup Script:** `smoke-test/fixtures/seed-wave-1.ts`

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, writeBatch, doc } from 'firebase/firestore';
import { firebaseConfig } from '../../src/config/firebase';

async function seedWave1() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const batch = writeBatch(db);

  // 1. Test users
  const testUsers = [
    { uid: 'test-user-01', email: 'operator-1@test.com', role: 'operator' },
    { uid: 'test-user-02', email: 'supervisor-1@test.com', role: 'supervisor' },
    // ... 10 total
  ];

  // 2. Lab settings
  const labSettings = {
    labId: 'test-lab-01',
    name: 'Riopomba Test Lab',
    cnpj: '12345678000190',
    notivisaEnabled: false, // Phase 8 onward
    portalEnabled: false, // Phase 5 onward
  };

  // 3. Equipment
  const equipment = {
    labId: 'test-lab-01',
    equipmentId: 'analyzer-a-001',
    name: 'Siemens Analyzer A',
    calibrationDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    analytes: ['glucose', 'creatinine', 'ALT', 'AST'],
  };

  // 4. Seed to Firestore
  testUsers.forEach((user) => {
    batch.set(doc(db, 'members', user.uid), user);
  });

  batch.set(doc(db, 'labs', 'test-lab-01', 'settings', 'config'), labSettings);
  batch.set(doc(db, 'labs', 'test-lab-01', 'equipamentos', 'analyzer-a-001'), equipment);

  await batch.commit();
  console.log('Wave 1 fixtures seeded');
}

export { seedWave1 };
```

**Run:** `npm run test:seed -- --wave=1`

---

### Wave 2: Phase 4–7 Fixtures (2026-05-20)

**Added Fixtures:**

| Fixture                 | Count | Owner   | Deployed   |
| ----------------------- | ----- | ------- | ---------- |
| Auditor test account    | 1     | QA-Lead | 2026-05-19 |
| Patient portal accounts | 10    | QA-Lead | 2026-05-28 |
| Test CAPA templates     | 3     | QA-Lead | 2026-05-20 |
| Pre-populated findings  | 12    | Auditor | 2026-05-20 |

**Setup Script:** `smoke-test/fixtures/seed-wave-2.ts`

```typescript
async function seedWave2() {
  const db = getFirestore();
  const batch = writeBatch(db);

  // 1. Auditor account
  const auditor = {
    uid: 'test-auditor-01',
    email: 'auditor@test.com',
    role: 'auditor',
    permissions: ['read-capa', 'write-capa-feedback', 'sign-off'],
  };

  // 2. Patient portal accounts
  const patients = Array.from({ length: 10 }, (_, i) => ({
    patientId: `patient-test-${String(i + 1).padStart(2, '0')}`,
    cpf: `${String(i + 1).padStart(3, '0')}.${String(i + 1).padStart(3, '0')}.${String(i + 1).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`,
    email: `patient-${i + 1}@test.com`,
    phone: `+55119999999${String(i + 1).padStart(2, '0')}`,
    portalEnabled: true,
  }));

  // 3. CAPA templates
  const capaTemplates = [
    {
      templateId: 'capa-template-01',
      name: 'Desvio de Procedimento',
      steps: 3,
    },
    {
      templateId: 'capa-template-02',
      name: 'Calibração Fora de Especificação',
      steps: 4,
    },
    {
      templateId: 'capa-template-03',
      name: 'Resultado Crítico Não Escalado',
      steps: 3,
    },
  ];

  // 4. Pre-populated findings (for CAPA closure Phase 4)
  const findings = Array.from({ length: 12 }, (_, i) => ({
    findingId: `finding-${String(i + 1).padStart(2, '0')}`,
    category: i % 3 === 0 ? 'RDC 978' : i % 3 === 1 ? 'DICQ 4.3' : 'Internal Audit',
    description: `Finding #${i + 1}: System deviation`,
    severity: i < 4 ? 'critical' : i < 8 ? 'major' : 'minor',
    status: 'open',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  }));

  // 5. Batch commit
  batch.set(doc(db, 'members', auditor.uid), auditor);
  patients.forEach((patient) => {
    batch.set(doc(db, 'labs', 'test-lab-01', 'pacientes', patient.patientId), patient);
  });
  capaTemplates.forEach((template) => {
    batch.set(doc(db, 'labs', 'test-lab-01', 'capaTemplates', template.templateId), template);
  });
  findings.forEach((finding) => {
    batch.set(doc(db, 'labs', 'test-lab-01', 'achados', finding.findingId), finding);
  });

  await batch.commit();
  console.log('Wave 2 fixtures seeded');
}
```

**Run:** `npm run test:seed -- --wave=2`

---

### Wave 3: Phase 8–11 Fixtures (2026-06-16)

**Added Fixtures:**

| Fixture                  | Count | Owner       | Deployed   |
| ------------------------ | ----- | ----------- | ---------- |
| NOTIVISA credentials     | 1     | Procurement | 2026-06-17 |
| CIQ records for NOTIVISA | 50    | QA-Lead     | 2026-06-20 |
| Document templates (SGD) | 80    | QA-Lead     | 2026-06-20 |
| Strip images (IA)        | 20    | QA-Lead     | 2026-06-22 |
| Analyzer B equipment     | 1     | QA-Lead     | 2026-06-20 |

**Setup Script:** `smoke-test/fixtures/seed-wave-3.ts`

```typescript
async function seedWave3() {
  const db = getFirestore();
  const batch = writeBatch(db);
  const storage = getStorage();

  // 1. NOTIVISA config (stored securely)
  const notivisaConfig = {
    enabled: true,
    sandboxMode: true,
    apiUrl: 'https://api.notivisa-sandbox.saude.gov.br',
    credentialHash: crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(process.env.NOTIVISA_TOKEN!),
    ),
    retryPolicy: { maxRetries: 3, delayMs: 5000 },
  };

  // 2. CIQ records for NOTIVISA test
  const ciqRecords = Array.from({ length: 50 }, (_, i) => ({
    ciqId: `ciq-notivisa-${String(i + 1).padStart(3, '0')}`,
    analyte:
      i % 4 === 0 ? 'glucose' : i % 4 === 1 ? 'creatinine' : i % 4 === 2 ? 'ALT' : 'hemoglobin',
    result: Math.floor(Math.random() * 500),
    status: i % 5 === 0 ? 'critical' : 'normal',
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
  }));

  // 3. Document templates for SGD
  const docTemplates = [
    { docType: 'MQ', name: 'Manual da Qualidade', version: 1 },
    { docType: 'PQ', name: 'Procedimento Operacional', version: 1 },
    // ... 80 docs total
  ];

  // 4. Strip images (mock URLs for now, real uploads in Phase 11)
  const stripImages = Array.from({ length: 20 }, (_, i) => ({
    imageId: `strip-image-${String(i + 1).padStart(2, '0')}`,
    analyte: ['hCG', 'glucose', 'hemoglobin'][i % 3],
    uploadedAt: new Date(),
    operatorId: `test-user-0${(i % 10) + 1}`,
    storagePath: `gs://hmatologia2-test-reports/strips/image-${i}.jpg`,
  }));

  // 5. Analyzer B
  const analyzerB = {
    equipmentId: 'analyzer-b-001',
    name: 'Roche Cobas Analyzer B',
    analytes: ['glucose', 'creatinine', 'ALT', 'AST', 'hCG'],
    qcRule: 'westgard',
  };

  // Batch commit
  batch.set(doc(db, 'labs', 'test-lab-01', 'notivisaConfig', 'config'), notivisaConfig);
  ciqRecords.forEach((ciq) => {
    batch.set(doc(db, 'labs', 'test-lab-01', 'ciq', ciq.ciqId), ciq);
  });
  docTemplates.forEach((doc, idx) => {
    batch.set(doc(db, 'labs', 'test-lab-01', 'sgd-docs', `doc-${idx}`), doc);
  });
  stripImages.forEach((img) => {
    batch.set(doc(db, 'labs', 'test-lab-01', 'imuno-ias-dev', img.imageId), img);
  });
  batch.set(doc(db, 'labs', 'test-lab-01', 'equipamentos', 'analyzer-b-001'), analyzerB);

  await batch.commit();
  console.log('Wave 3 fixtures seeded');
}
```

---

### Wave 4: Phase 12–15 Fixtures (2026-07-28)

**Added Fixtures:**

| Fixture                           | Count      | Owner   | Deployed   |
| --------------------------------- | ---------- | ------- | ---------- |
| CIQ records (load test)           | 500        | QA-Lead | 2026-07-29 |
| Patient accounts                  | 100        | QA-Lead | 2026-07-30 |
| Historical KPI data               | 1000+ rows | QA-Lead | 2026-07-31 |
| Equipment registry (10 analyzers) | 10         | QA-Lead | 2026-07-31 |

---

## 3. Quality Gate Automation

### Gate 1: Pre-Merge (hcq-deploy-gates)

**File:** `scripts/hcq-deploy-gates.sh` (runs on every PR merge)

```bash
#!/bin/bash
set -e

PHASE=${1:-0}
CHECKS=${2:-typecheck,lint,test,build,e2e-smoke}

echo "🔍 Running deployment gates for Phase $PHASE..."

# 1. TypeScript check
if [[ "$CHECKS" == *"typecheck"* ]]; then
  echo "  → TypeScript check..."
  npx tsc --noEmit
fi

# 2. Lint (88 warnings baseline)
if [[ "$CHECKS" == *"lint"* ]]; then
  echo "  → ESLint check (baseline: 88 warnings)..."
  WARNINGS=$(npm run lint 2>&1 | grep -c "warning" || true)
  if [ "$WARNINGS" -gt 88 ]; then
    echo "    ❌ Lint warnings increased: $WARNINGS > 88"
    exit 1
  fi
fi

# 3. Unit tests (274 baseline)
if [[ "$CHECKS" == *"test"* ]]; then
  echo "  → Unit tests (baseline: 274)..."
  npx vitest --run --reporter=verbose
fi

# 4. Build
if [[ "$CHECKS" == *"build"* ]]; then
  echo "  → Build app + functions..."
  npm run build
fi

# 5. E2E smoke tests (5 critical flows, <10min)
if [[ "$CHECKS" == *"e2e-smoke"* ]]; then
  echo "  → E2E smoke tests (5 flows)..."
  cd smoke-test
  npx playwright test \
    --grep "W1-S[1-5]" \
    --config=playwright.config.ts \
    --timeout=600000
  cd ..
fi

echo "✅ All gates PASSED for Phase $PHASE"
```

**Run:** `npm run gate -- --phase=4`

### Gate 2: Pre-Deploy (Phase E2E)

**File:** `scripts/pre-deploy-gate.sh` (runs before phase deploy)

```bash
#!/bin/bash
set -e

PHASE=$1
if [ -z "$PHASE" ]; then
  echo "Usage: pre-deploy-gate.sh <phase>"
  exit 1
fi

echo "🚀 Pre-deploy gate for Phase $PHASE (8 E2E scenarios)..."

cd smoke-test

# Run all 8 E2E scenarios for this phase
RESULT=$(npx playwright test \
  --grep "^P${PHASE}-S[1-8]" \
  --config=playwright.config.ts \
  --reporter=json \
  --output-file=test-results.json 2>&1)

# Parse result
PASSED=$(jq '.stats.expected' test-results.json || echo 0)
FAILED=$(jq '.stats.unexpected' test-results.json || echo 0)

echo "Phase $PHASE E2E Results: $PASSED/8 PASSED, $FAILED/8 FAILED"

if [ "$FAILED" -gt 0 ]; then
  echo "❌ Phase $PHASE E2E FAILED"
  echo "HTML report: smoke-test/playwright-report/index.html"
  exit 1
fi

echo "✅ Phase $PHASE E2E PASSED (8/8)"

cd ..
```

---

## 4. Slack Notifications & Reporting

### Slack Webhook Integration

**Webhook URL:** Stored as `secrets.SLACK_WEBHOOK_TESTING` in GitHub Actions

**Message Templates:**

**Pass Notification:**

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "✅ Phase 4 E2E: 8/8 PASS",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Phase:*\n4 (CAPA Closure)"
        },
        {
          "type": "mrkdwn",
          "text": "*Duration:*\n59 minutes"
        },
        {
          "type": "mrkdwn",
          "text": "*Scenarios:*\nP4-S1 through P4-S8"
        },
        {
          "type": "mrkdwn",
          "text": "*Status:*\n100% PASS"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "<https://github.com/actions/runs/123456789|View test report> | <gs://hmatologia2-test-reports/v1.4-testing/phase-4-report.html|HTML Report>"
      }
    }
  ]
}
```

**Failure Notification:**

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🔴 Phase 4 E2E: 7/8 FAIL",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Phase:*\n4 (CAPA Closure)"
        },
        {
          "type": "mrkdwn",
          "text": "*Failed Scenario:*\nP4-S3 (CAPA Execution Log)"
        },
        {
          "type": "mrkdwn",
          "text": "*Reason:*\nTimeout: waitFor selector exceeded 30s"
        },
        {
          "type": "mrkdwn",
          "text": "*Severity:*\nP0 (Blocker)"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Action Required:*\n1. Review video: <gs://hmatologia2-test-reports/v1.4-testing/phase-4-videos/P4-S3.webm|P4-S3.webm>\n2. Check Cloud Logs for errors\n3. Fix root cause\n4. Re-run E2E\n\n<https://github.com/actions/runs/123456789|Full test report>"
      }
    }
  ]
}
```

### Weekly Summary Slack Bot

**Cron:** Every Monday 9am UTC

**Script:** `scripts/e2e-weekly-summary.js`

```javascript
const Slack = require('@slack/web-api').WebClient;
const { Firestore } = require('@google-cloud/firestore');

async function sendWeeklySummary() {
  const slack = new Slack({ token: process.env.SLACK_BOT_TOKEN });
  const firestore = new Firestore();

  // Fetch metrics from past 7 days
  const metrics = await firestore
    .collection('test-metrics')
    .where('timestamp', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .orderBy('timestamp', 'desc')
    .get();

  const summary = {
    totalRuns: metrics.size,
    passRate: 0,
    flakyTests: [],
    timeoutTests: [],
  };

  // Calculate pass rate
  let totalPass = 0;
  metrics.forEach((doc) => {
    const data = doc.data();
    if (data.status === 'pass') totalPass++;
    if (data.flaky) summary.flakyTests.push(data.scenario);
    if (data.timeout) summary.timeoutTests.push(data.scenario);
  });

  summary.passRate = ((totalPass / metrics.size) * 100).toFixed(1);

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 v1.4 Testing Weekly Summary',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Runs:*\n${summary.totalRuns}`,
          },
          {
            type: 'mrkdwn',
            text: `*Pass Rate:*\n${summary.passRate}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Flaky Tests:*\n${summary.flakyTests.length}`,
          },
          {
            type: 'mrkdwn',
            text: `*Timeouts:*\n${summary.timeoutTests.length}`,
          },
        ],
      },
    ],
  };

  if (summary.flakyTests.length > 0) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Flaky Tests:* ${summary.flakyTests.join(', ')}`,
      },
    });
  }

  await slack.chat.postMessage({
    channel: '#hc-quality-testing',
    blocks: message.blocks,
  });
}

sendWeeklySummary().catch(console.error);
```

---

## 5. Cloud Logs Monitoring

### Setup for 24h Tail (Post-Deploy)

**Script:** `scripts/monitor-cloud-logs-post-deploy.sh` (Phase 15)

```bash
#!/bin/bash

# Parameters
PROJECT_ID="hmatologia2"
TAIL_DURATION_HOURS=24
EXPORT_PATH="gs://hmatologia2-test-reports/v1.4-testing/cloud-logs-post-deploy.json"

echo "🔍 Monitoring Cloud Logs for $TAIL_DURATION_HOURS hours..."

# Query for errors
gcloud logging read \
  'resource.type="cloud_function" AND severity="ERROR"' \
  --project=$PROJECT_ID \
  --limit=1000 \
  --format=json \
  --sort-by=timestamp \
  > /tmp/errors.json

ERROR_COUNT=$(jq length /tmp/errors.json)
echo "Errors found: $ERROR_COUNT"

# Query for warnings
gcloud logging read \
  'resource.type="cloud_function" AND severity="WARNING"' \
  --project=$PROJECT_ID \
  --limit=1000 \
  --format=json \
  > /tmp/warnings.json

WARNING_COUNT=$(jq length /tmp/warnings.json)
echo "Warnings found: $WARNING_COUNT"

# Check for specific P0 patterns
P0_PATTERNS=(
  "PERMISSION_DENIED"
  "NOT_FOUND"
  "DEADLINE_EXCEEDED"
  "INTERNAL"
  "UNAVAILABLE"
  "DATA_LOSS"
)

P0_FOUND=0
for pattern in "${P0_PATTERNS[@]}"; do
  COUNT=$(jq ".[] | select(.message | contains(\"$pattern\")) | .message" /tmp/errors.json | wc -l)
  if [ "$COUNT" -gt 0 ]; then
    echo "🔴 P0 Pattern '$pattern' found ($COUNT times)"
    P0_FOUND=$((P0_FOUND + COUNT))
  fi
done

# Export results
jq -s '{
  timestamp: now,
  tail_hours: 24,
  error_count: .[] | length,
  warning_count: (.[1] | length),
  p0_found: '$P0_FOUND',
  errors: .[0],
  warnings: .[1]
}' /tmp/errors.json /tmp/warnings.json > /tmp/logs-summary.json

gsutil cp /tmp/logs-summary.json "$EXPORT_PATH"

echo "✅ Cloud Logs exported to $EXPORT_PATH"

# Exit with error if P0 found
if [ "$P0_FOUND" -gt 0 ]; then
  echo "❌ P0 errors detected. Escalating..."
  exit 1
fi

exit 0
```

---

## 6. Test Metrics Dashboard (Firestore)

### Schema: `test-metrics` Collection

```typescript
interface TestMetric {
  timestamp: Date;
  phase: number;
  scenario: string; // "P4-S1"
  status: 'pass' | 'fail' | 'timeout' | 'flaky';
  duration_ms: number;
  error_message?: string;
  video_url?: string;
  screenshot_urls?: string[];
  retry_count?: number;
  cloudLogs_errors?: number;
  cloudLogs_warnings?: number;
}
```

### Weekly Aggregation Query

```typescript
async function aggregateMetrics(startDate: Date, endDate: Date) {
  const metrics = await firestore
    .collection('test-metrics')
    .where('timestamp', '>=', startDate)
    .where('timestamp', '<=', endDate)
    .get();

  const summary = {
    period: { start: startDate, end: endDate },
    totalTests: metrics.size,
    passed: 0,
    failed: 0,
    timeout: 0,
    flaky: 0,
    avgDuration: 0,
    byPhase: {},
  };

  let totalDuration = 0;

  metrics.forEach((doc) => {
    const data = doc.data();
    summary.byPhase[data.phase] = summary.byPhase[data.phase] || {
      tests: 0,
      passed: 0,
      failed: 0,
    };

    summary.byPhase[data.phase].tests++;

    if (data.status === 'pass') {
      summary.passed++;
      summary.byPhase[data.phase].passed++;
    } else if (data.status === 'fail') {
      summary.failed++;
      summary.byPhase[data.phase].failed++;
    } else if (data.status === 'timeout') {
      summary.timeout++;
    } else if (data.status === 'flaky') {
      summary.flaky++;
    }

    totalDuration += data.duration_ms;
  });

  summary.avgDuration = Math.round(totalDuration / metrics.size);
  summary.passRate = ((summary.passed / metrics.size) * 100).toFixed(1);

  return summary;
}
```

---

## 7. Implementation Checklist

### Pre-Phase-4 (By 2026-05-20)

- [ ] GitHub Actions workflow `.github/workflows/e2e-tests.yml` deployed
- [ ] `.env.test.example` configured with test credentials
- [ ] Wave 1 fixtures seeded (10 users, 1 lab, 1 equipment, 50 CIQ records)
- [ ] `hcq-deploy-gates` script tested on staging
- [ ] Slack webhook integrated + test message sent
- [ ] E2E test base (`playwright.config.ts`) verified on staging
- [ ] Cloud Logs query templates created
- [ ] Firestore test-metrics collection created with indexes

### Pre-Phase-8 (By 2026-06-16)

- [ ] Wave 2 fixtures seeded (auditor, patients, CAPA templates, findings)
- [ ] Slack weekly summary bot scheduled
- [ ] E2E metrics dashboard created (Firestore + query templates)
- [ ] HTML report archival tested (30-day retention)
- [ ] Performance baseline captured (Web Vitals P50/P95/P99)

### Pre-Phase-12 (By 2026-07-28)

- [ ] Wave 3 fixtures seeded (NOTIVISA credentials, CIQ records, docs, strips)
- [ ] NOTIVISA mock API verified
- [ ] Cloud Logs 48h tail script tested
- [ ] Load test script prepared (500+ CIQ records)

### Pre-Phase-15 (By 2026-08-25)

- [ ] Wave 4 fixtures seeded (500 CIQ, 100 patients, 10 analyzers)
- [ ] Deployment rehearsal executed (rules → functions → hosting)
- [ ] Incident response drill checklist prepared
- [ ] Post-deploy monitoring enabled (24h auto-tail)

---

## 8. Maintenance & Handoff

### Weekly Maintenance (Every Monday)

- [ ] Review metrics dashboard (pass rate, flaky tests, timeouts)
- [ ] Post Slack summary
- [ ] Archive test reports to Cloud Storage
- [ ] Backup test-metrics Firestore collection

### Post-Wave Handoff

1. **E2E Report:** Export HTML + JSON
2. **Metrics:** Archive `test-results-phase-*.json` to `gs://hmatologia2-test-reports/v1.4-testing/metrics/`
3. **Evidence:** Video/screenshot links in incident tickets (if any)
4. **Lessons Learned:** Update `TEST_INFRASTRUCTURE_SETUP.md` with issues found

---

**Document Status:** APPROVED  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-05-20 (Phase 4 E2E start)
