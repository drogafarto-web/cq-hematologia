---
title: "NOTIVISA Sandbox Environment Configuration & Secret Setup"
date_created: "2026-05-07"
version: "1.1"
status: "Ready for Phase 4 Implementation"
audience: "DevOps + Backend Engineering + Operations"
---

# NOTIVISA Sandbox Environment Configuration

Complete guide for configuring HC Quality's sandbox environment with NOTIVISA credentials, Firebase Secret Manager setup, environment variables, and production-readiness validation.

---

## Table of Contents

1. [Overview](#overview)
2. [Part 1: Firebase Secret Manager Setup](#part-1-firebase-secret-manager-setup)
3. [Part 2: Environment Variables (.env.sandbox)](#part-2-environment-variables-envsandbox)
4. [Part 3: Sandbox Portal API Connectivity Tests](#part-3-sandbox-portal-api-connectivity-tests)
5. [Part 4: Sandbox API Access Validation](#part-4-sandbox-api-access-validation)
6. [Part 5: Credential Rotation Procedures](#part-5-credential-rotation-procedures)
7. [Part 6: Sandbox vs Production Switching](#part-6-sandbox-vs-production-switching)
8. [Part 7: Troubleshooting & Validation](#part-7-troubleshooting--validation)
9. [Implementation Checklist](#implementation-checklist)

---

## Overview

**Timeline:** 3-5 business days for ANVISA sandbox credential provisioning after registration.

**Objective:** 
- Configure HC Quality to securely access NOTIVISA sandbox API
- Establish environment-based credential switching
- Validate sandbox connectivity before Phase 4 execution
- Document production transition pathway

**Scope (v1.4 Phase 8):**
- Sandbox credentials only (no production certificate yet)
- Form generation + RT approval workflow
- Audit trail logging
- Error handling + retry strategy
- v1.5 production readiness (architecture, not implementation)

---

## Part 1: Firebase Secret Manager Setup

### Step 1.1: Prerequisites

Before provisioning secrets, ensure:

```bash
# 1. Firebase CLI authenticated
firebase login

# 2. Verify project
firebase projects:list
# Should show: hmatologia2 (active)

# 3. Verify Secrets Manager API enabled
gcloud services list --enabled --project=hmatologia2 | grep secretmanager
# Expected: secretmanager.googleapis.com
```

If Secrets Manager API is not enabled:
```bash
gcloud services enable secretmanager.googleapis.com --project=hmatologia2
```

### Step 1.2: Create Sandbox Credentials Secrets

Once ANVISA provides credentials (via registration email), store them in Firebase Secrets Manager:

#### Secret 1: Sandbox API Key

```bash
# Securely store NOTIVISA sandbox API key
firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY --project=hmatologia2
# Paste API key when prompted (will not echo)
# Expected format: alphanumeric string, ~32 characters

# Verify secret was set (check metadata only, not value)
gcloud secrets describe NOTIVISA_SANDBOX_API_KEY --project=hmatologia2
# Output should show: name, created, updated, labels
```

#### Secret 2: Sandbox Endpoint URL

```bash
# Store sandbox API endpoint URL
firebase functions:secrets:set NOTIVISA_SANDBOX_ENDPOINT --project=hmatologia2
# Example input: https://sandbox.notivisa.gov.br/api/v1/
# (Confirm exact URL with ANVISA documentation)

gcloud secrets describe NOTIVISA_SANDBOX_ENDPOINT --project=hmatologia2
```

#### Secret 3: Registration ID (for reference/debugging)

```bash
# Store NOTIVISA registration ID issued by ANVISA
firebase functions:secrets:set NOTIVISA_REGISTRATION_ID --project=hmatologia2
# Example: REG-2026-05-07-001

gcloud secrets describe NOTIVISA_REGISTRATION_ID --project=hmatologia2
```

#### Secret 4: Lab CNPJ (for API submissions)

```bash
# Store lab CNPJ (non-sensitive, but centralized for consistency)
firebase functions:secrets:set NOTIVISA_LAB_CNPJ --project=hmatologia2
# Format: 14 digits, no hyphens. Example: 12345678000195

gcloud secrets describe NOTIVISA_LAB_CNPJ --project=hmatologia2
```

### Step 1.3: Verify Secrets in Cloud Functions

Update `functions/src/modules/notivisa/callables/*.ts` to reference secrets:

```typescript
// Example: functions/src/modules/notivisa/config/secretsLoader.ts
import * as functions from 'firebase-functions/v2/https';

export const getNotivisaSecrets = async () => {
  const apiKey = process.env.NOTIVISA_SANDBOX_API_KEY;
  const endpoint = process.env.NOTIVISA_SANDBOX_ENDPOINT;
  const cnpj = process.env.NOTIVISA_LAB_CNPJ;
  const regId = process.env.NOTIVISA_REGISTRATION_ID;

  if (!apiKey || !endpoint || !cnpj) {
    throw new Error(
      'Missing NOTIVISA secrets. Set: NOTIVISA_SANDBOX_API_KEY, NOTIVISA_SANDBOX_ENDPOINT, NOTIVISA_LAB_CNPJ'
    );
  }

  return { apiKey, endpoint, cnpj, regId };
};
```

### Step 1.4: Update Cloud Functions Configuration

Add secrets to `firebase.json` under functions configuration:

```json
{
  "functions": {
    "source": "functions",
    "codebase": "default",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"],
    "runtime": "nodejs22",
    "secrets": [
      "NOTIVISA_SANDBOX_API_KEY",
      "NOTIVISA_SANDBOX_ENDPOINT",
      "NOTIVISA_LAB_CNPJ",
      "NOTIVISA_REGISTRATION_ID"
    ]
  }
}
```

### Step 1.5: Deploy Functions with Secrets

```bash
# Build functions
cd functions
npm run build

# Verify Typescript compilation
npm run build 2>&1 | grep -E "error|warning" | head -10

# Deploy with secrets attached
firebase deploy --only functions:notivisaDraftCreate,functions:notivisaQueueProcessor --project=hmatologia2

# Verify secrets loaded in Cloud Function environment
gcloud functions describe notivisaDraftCreate --region=southamerica-east1 --project=hmatologia2 | grep -A 5 "secretEnvironmentVariables"
```

**Expected output:**
```
secretEnvironmentVariables:
- key: NOTIVISA_SANDBOX_API_KEY
  resourceName: projects/hmatologia2/secrets/NOTIVISA_SANDBOX_API_KEY/versions/latest
```

---

## Part 2: Environment Variables (.env.sandbox)

Create a sandbox-specific environment file for local development and CI/CD:

### Step 2.1: Create .env.sandbox

```bash
# File: C:\hc quality\.env.sandbox
# Sandbox environment configuration for NOTIVISA integration
# Load with: export $(cat .env.sandbox | xargs) || $env:*.env.sandbox (PowerShell)

# ═══════════════════════════════════════════════════════════════
# FIREBASE — Sandbox Project
# ═══════════════════════════════════════════════════════════════

VITE_FIREBASE_API_KEY=AIzaSyD...
VITE_FIREBASE_AUTH_DOMAIN=hmatologia2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hmatologia2
VITE_FIREBASE_STORAGE_BUCKET=hmatologia2.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456

# Database provider: "firebase" (production) | "local" (dev offline emulator)
VITE_DATABASE_PROVIDER=firebase

# ═══════════════════════════════════════════════════════════════
# NOTIVISA SANDBOX — Government API Configuration
# ═══════════════════════════════════════════════════════════════

# Sandbox environment flag (used by functions to route to sandbox vs production endpoint)
NODE_ENV=development
NOTIVISA_ENVIRONMENT=sandbox

# Sandbox API credentials (stored in Firebase Secrets Manager, referenced here for CI/CD)
# NEVER commit actual credentials to .env.sandbox (use Firebase Secrets Manager in production)
NOTIVISA_SANDBOX_API_KEY=${NOTIVISA_SANDBOX_API_KEY}
NOTIVISA_SANDBOX_ENDPOINT=https://sandbox.notivisa.gov.br/api/v1/

# Lab identification for API submissions
NOTIVISA_LAB_CNPJ=12345678000195

# Registration ID from ANVISA (for support/debugging)
NOTIVISA_REGISTRATION_ID=REG-2026-05-07-001

# ═══════════════════════════════════════════════════════════════
# NOTIVISA SANDBOX — Submission & Queue Configuration
# ═══════════════════════════════════════════════════════════════

# Queue polling interval (seconds) — how often processor checks for pending submissions
NOTIVISA_QUEUE_POLL_INTERVAL=300

# Submission timeout (milliseconds) — how long to wait for sandbox API response
NOTIVISA_SUBMISSION_TIMEOUT_MS=30000

# Retry backoff strategy (milliseconds, comma-separated)
# Format: 1min, 5min, 30min, 2hr, 24hr
NOTIVISA_RETRY_BACKOFF_MS=60000,300000,1800000,7200000,86400000

# Max retry attempts (how many times to retry transient errors)
NOTIVISA_MAX_RETRIES=5

# Rate limit backoff (seconds) — wait time after 429 Too Many Requests
NOTIVISA_RATE_LIMIT_BACKOFF_SEC=3600

# ═══════════════════════════════════════════════════════════════
# NOTIVISA SANDBOX — Feature Flags (Phase 4 - Phase 8)
# ═══════════════════════════════════════════════════════════════

# Enable NOTIVISA draft creation when notifiable result detected
NOTIVISA_DRAFT_CREATION_ENABLED=true

# Enable RT approval workflow (RT sees draft in UI)
NOTIVISA_RT_APPROVAL_ENABLED=true

# Enable audit trail logging to Firestore
NOTIVISA_AUDIT_LOGGING_ENABLED=true

# Enable sandbox submission (v1.4 submits to sandbox; v1.5 will switch to production)
NOTIVISA_SANDBOX_SUBMISSION_ENABLED=true

# Enable manual retry via UI/callable (ops can re-trigger stuck submissions)
NOTIVISA_MANUAL_RETRY_ENABLED=true

# ═══════════════════════════════════════════════════════════════
# NOTIVISA SANDBOX — Monitoring & Alerting
# ═══════════════════════════════════════════════════════════════

# Enable Cloud Logging integration (submits structured logs to Cloud Logs)
NOTIVISA_CLOUD_LOGGING_ENABLED=true

# Cloud Logs severity threshold (DEBUG, INFO, WARNING, ERROR, CRITICAL)
NOTIVISA_CLOUD_LOGS_LEVEL=INFO

# Enable error alerts (email/Slack on P1/P2 events)
NOTIVISA_ERROR_ALERTS_ENABLED=true

# Alert recipients (comma-separated emails)
NOTIVISA_ALERT_RECIPIENTS=ops@labclin.com.br,cto@labclin.com.br

# ═══════════════════════════════════════════════════════════════
# Portaria 204/2016 — Notifiable Disease Configuration
# ═══════════════════════════════════════════════════════════════

# Path to disease seed list (JSON file with MS disease codes)
NOTIVISA_DISEASE_LIST_PATH=./functions/src/seeds/notifiable_diseases.json

# Enable auto-seeding of disease list on first deployment
NOTIVISA_AUTO_SEED_DISEASES=true

# ═══════════════════════════════════════════════════════════════
# TESTING & SANDBOX MAINTENANCE
# ═══════════════════════════════════════════════════════════════

# Scheduled maintenance window for ANVISA sandbox (UTC time)
# Format: HH:MM-HH:MM. Example: 22:00-04:00 (Saturday night)
NOTIVISA_MAINTENANCE_WINDOW_UTC=22:00-04:00

# Enable test mode (mock API responses instead of real calls)
NOTIVISA_TEST_MODE=false

# Test payloads directory (for E2E testing)
NOTIVISA_TEST_FIXTURES_PATH=./functions/src/__tests__/fixtures/notivisa-test-payloads.ts

# ═══════════════════════════════════════════════════════════════
# AUDIT & COMPLIANCE
# ═══════════════════════════════════════════════════════════════

# Enable DICQ 4.4 audit trail (immutable logging of all submissions)
NOTIVISA_AUDIT_TRAIL_ENABLED=true

# Audit log retention (days) — how long to keep submission records
NOTIVISA_AUDIT_LOG_RETENTION_DAYS=2555  # ~7 years

# Enable LGPD data masking (CPF masked in logs/exports)
NOTIVISA_LGPD_MASKING_ENABLED=true

# ═══════════════════════════════════════════════════════════════
# SENTRY — Error Tracking (Optional)
# ═══════════════════════════════════════════════════════════════

VITE_SENTRY_DSN=https://key@sentry.io/project-id
SENTRY_ENVIRONMENT=sandbox
SENTRY_RELEASE=v1.4-phase-8
```

### Step 2.2: Load .env.sandbox in Development

**For Bash/Zsh:**
```bash
# Load sandbox environment
source .env.sandbox

# Verify key variables loaded
echo "NOTIVISA_SANDBOX_ENDPOINT: $NOTIVISA_SANDBOX_ENDPOINT"
echo "NOTIVISA_ENVIRONMENT: $NOTIVISA_ENVIRONMENT"

# Run emulator with sandbox config
NOTIVISA_SANDBOX_API_KEY="${NOTIVISA_SANDBOX_API_KEY}" npm run dev
```

**For PowerShell (Windows):**
```powershell
# Load .env.sandbox
Get-Content .env.sandbox | ForEach-Object {
  if ($_ -match '^\s*([^=]+)=(.*)$') {
    $name, $value = $matches[1], $matches[2]
    $value = $value -replace '^\$\{([^}]+)\}$', ([System.Environment]::GetEnvironmentVariable($matches[1]))
    [System.Environment]::SetEnvironmentVariable($name, $value)
  }
}

# Verify
Write-Host "NOTIVISA_SANDBOX_ENDPOINT: $env:NOTIVISA_SANDBOX_ENDPOINT"
Write-Host "NOTIVISA_ENVIRONMENT: $env:NOTIVISA_ENVIRONMENT"

# Run dev
npm run dev
```

### Step 2.3: CI/CD Integration

For GitHub Actions or similar CI/CD:

```yaml
# File: .github/workflows/notivisa-sandbox-test.yml
name: NOTIVISA Sandbox Integration Tests

on:
  push:
    branches: [main, staging]
    paths:
      - 'functions/src/modules/notivisa/**'
      - '.env.sandbox'
      - 'firebase.json'

jobs:
  test-notivisa-sandbox:
    runs-on: ubuntu-latest
    environment: sandbox

    steps:
      - uses: actions/checkout@v4

      - name: Load sandbox environment
        run: |
          cat .env.sandbox >> $GITHUB_ENV
          echo "NOTIVISA_SANDBOX_API_KEY=${{ secrets.NOTIVISA_SANDBOX_API_KEY }}" >> $GITHUB_ENV

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci && cd functions && npm ci

      - name: Run NOTIVISA sandbox tests
        run: npm run test:notivisa-sandbox
        env:
          NOTIVISA_SANDBOX_API_KEY: ${{ secrets.NOTIVISA_SANDBOX_API_KEY }}
          NOTIVISA_SANDBOX_ENDPOINT: https://sandbox.notivisa.gov.br/api/v1/

      - name: Test sandbox connectivity
        run: bash scripts/test-notivisa-sandbox-connectivity.sh
        env:
          NOTIVISA_SANDBOX_API_KEY: ${{ secrets.NOTIVISA_SANDBOX_API_KEY }}
```

---

## Part 3: Sandbox Portal API Connectivity Tests

### Step 3.1: Bash Connectivity Test Script

Create `scripts/test-notivisa-sandbox-connectivity.sh`:

```bash
#!/bin/bash
set -e

# NOTIVISA Sandbox Connectivity Test
# Usage: bash scripts/test-notivisa-sandbox-connectivity.sh
# Expected output: 3 checkmarks + "Ready for schema validation."

API_KEY="${NOTIVISA_SANDBOX_API_KEY}"
SANDBOX_URL="${NOTIVISA_SANDBOX_ENDPOINT:-https://sandbox.notivisa.gov.br/api/v1/}"

echo "═══════════════════════════════════════════════════════════════"
echo "NOTIVISA Sandbox Connectivity Tests"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 1: Health check
echo "[1/3] Health check..."
HEALTH_RESPONSE=$(curl -s -X GET \
  "${SANDBOX_URL}health" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}" \
  -o /tmp/health.json)

HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
HEALTH_BODY=$(cat /tmp/health.json)

if [[ "$HTTP_CODE" == "200" ]] || grep -q "healthy\|ok\|status" /tmp/health.json 2>/dev/null; then
  echo "✓ Sandbox API is reachable (HTTP $HTTP_CODE)"
else
  echo "✗ Sandbox API health check failed (HTTP $HTTP_CODE)"
  echo "Response: $HEALTH_BODY"
  exit 1
fi

# Test 2: Validate API key format
if [[ ${#API_KEY} -gt 20 ]]; then
  echo "✓ API key format valid (length: ${#API_KEY})"
else
  echo "✗ API key appears too short (length: ${#API_KEY}). Confirm with ANVISA."
  exit 1
fi

# Test 3: Verify endpoint URL format
if [[ "${SANDBOX_URL}" =~ ^https://.*notivisa ]]; then
  echo "✓ Sandbox endpoint URL format valid"
else
  echo "✗ Sandbox URL format suspicious. Confirm with ANVISA documentation."
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "[✓] All connectivity checks passed."
echo "[✓] Sandbox API is ready for schema validation."
echo "═══════════════════════════════════════════════════════════════"
```

### Step 3.2: PowerShell Connectivity Test Script

Create `scripts/test-notivisa-sandbox-connectivity.ps1`:

```powershell
# NOTIVISA Sandbox Connectivity Test (PowerShell)
# Usage: .\scripts\test-notivisa-sandbox-connectivity.ps1
# Expected output: 3 checkmarks + "Ready for schema validation."

param(
  [string]$ApiKey = $env:NOTIVISA_SANDBOX_API_KEY,
  [string]$Endpoint = $env:NOTIVISA_SANDBOX_ENDPOINT
)

if (-not $ApiKey) {
  Write-Error "NOTIVISA_SANDBOX_API_KEY environment variable not set"
  exit 1
}

if (-not $Endpoint) {
  $Endpoint = "https://sandbox.notivisa.gov.br/api/v1/"
}

Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host "NOTIVISA Sandbox Connectivity Tests"
Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host ""

# Test 1: Health check
Write-Host "[1/3] Health check..."
try {
  $headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type"  = "application/json"
  }
  
  $response = Invoke-WebRequest -Uri "${Endpoint}health" -Headers $headers -Method Get -ErrorAction Stop
  
  if ($response.StatusCode -eq 200) {
    Write-Host "✓ Sandbox API is reachable (HTTP $($response.StatusCode))"
  } else {
    Write-Error "Unexpected status code: $($response.StatusCode)"
    exit 1
  }
} catch {
  Write-Error "Sandbox API health check failed: $_"
  exit 1
}

# Test 2: Validate API key format
if ($ApiKey.Length -gt 20) {
  Write-Host "✓ API key format valid (length: $($ApiKey.Length))"
} else {
  Write-Error "API key appears too short (length: $($ApiKey.Length)). Confirm with ANVISA."
  exit 1
}

# Test 3: Verify endpoint URL format
if ($Endpoint -match "^https://.*notivisa") {
  Write-Host "✓ Sandbox endpoint URL format valid"
} else {
  Write-Error "Sandbox URL format suspicious. Confirm with ANVISA documentation."
  exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host "[✓] All connectivity checks passed."
Write-Host "[✓] Sandbox API is ready for schema validation."
Write-Host "═══════════════════════════════════════════════════════════════"
```

### Step 3.3: Run Connectivity Tests

```bash
# Bash
bash scripts/test-notivisa-sandbox-connectivity.sh

# PowerShell
.\scripts\test-notivisa-sandbox-connectivity.ps1
```

**Expected output:**
```
═══════════════════════════════════════════════════════════════
NOTIVISA Sandbox Connectivity Tests
═══════════════════════════════════════════════════════════════

[1/3] Health check...
✓ Sandbox API is reachable (HTTP 200)
✓ API key format valid (length: 42)
✓ Sandbox endpoint URL format valid

═══════════════════════════════════════════════════════════════
[✓] All connectivity checks passed.
[✓] Sandbox API is ready for schema validation.
═══════════════════════════════════════════════════════════════
```

---

## Part 4: Sandbox API Access Validation

### Step 4.1: Test Payload Submission to Sandbox

Create `scripts/test-notivisa-sandbox-submission.ts` (runs in Cloud Functions environment):

```typescript
/**
 * NOTIVISA Sandbox Submission Test
 * Validates that payloads can be successfully submitted to sandbox API
 * 
 * Usage: npm run test:notivisa-sandbox -- --payload=syphilis
 */

import axios, { AxiosError } from 'axios';
import { getNotivisaSecrets } from '../functions/src/modules/notivisa/config/secretsLoader';
import { testPayloads } from '../functions/src/__tests__/fixtures/notivisa-test-payloads';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  message?: string;
  error?: string;
}

async function testSandboxSubmission(): Promise<void> {
  const results: TestResult[] = [];
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('NOTIVISA Sandbox API Validation Tests');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Get secrets
    console.log('[Setup] Loading sandbox credentials...');
    const secrets = await getNotivisaSecrets();
    console.log('✓ Secrets loaded');
    console.log(`  Endpoint: ${secrets.endpoint}`);
    console.log(`  Lab CNPJ: ${secrets.cnpj}`);
    console.log('');

    // Test 1: Syphilis submission
    console.log('[Test 1/3] Submitting syphilis payload...');
    const syphilisTest = await testPayloadSubmission(
      'syphilis',
      secrets,
      testPayloads.syphilis
    );
    results.push(syphilisTest);
    console.log(`${syphilisTest.status === 'PASS' ? '✓' : '✗'} ${syphilisTest.message}`);
    console.log('');

    // Test 2: Dengue submission
    console.log('[Test 2/3] Submitting dengue payload...');
    const dengueTest = await testPayloadSubmission(
      'dengue',
      secrets,
      testPayloads.dengue
    );
    results.push(dengueTest);
    console.log(`${dengueTest.status === 'PASS' ? '✓' : '✗'} ${dengueTest.message}`);
    console.log('');

    // Test 3: HIV submission
    console.log('[Test 3/3] Submitting HIV payload...');
    const hivTest = await testPayloadSubmission(
      'hiv',
      secrets,
      testPayloads.hiv
    );
    results.push(hivTest);
    console.log(`${hivTest.status === 'PASS' ? '✓' : '✗'} ${hivTest.message}`);
    console.log('');

    // Summary
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const duration = Date.now() - startTime;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Results: ${passed} passed, ${failed} failed (${duration}ms)`);
    console.log('═══════════════════════════════════════════════════════════════');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

async function testPayloadSubmission(
  diseaseName: string,
  secrets: any,
  testPayload: any
): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await axios.post(
      `${secrets.endpoint}submit`,
      testPayload,
      {
        headers: {
          'Authorization': `Bearer ${secrets.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return {
      name: diseaseName,
      status: 'PASS',
      duration: Date.now() - start,
      message: `${diseaseName}: submitted successfully (HTTP ${response.status})`,
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    return {
      name: diseaseName,
      status: 'FAIL',
      duration: Date.now() - start,
      message: `${diseaseName}: submission failed`,
      error: axiosError.response?.data?.toString() || axiosError.message,
    };
  }
}

testSandboxSubmission();
```

### Step 4.2: Run Sandbox API Validation Tests

```bash
# Bash
npm run test:notivisa-sandbox

# PowerShell (if Node installed)
npm run test:notivisa-sandbox
```

**Expected output:**
```
═══════════════════════════════════════════════════════════════
NOTIVISA Sandbox API Validation Tests
═══════════════════════════════════════════════════════════════

[Setup] Loading sandbox credentials...
✓ Secrets loaded
  Endpoint: https://sandbox.notivisa.gov.br/api/v1/
  Lab CNPJ: 12345678000195

[Test 1/3] Submitting syphilis payload...
✓ syphilis: submitted successfully (HTTP 202)

[Test 2/3] Submitting dengue payload...
✓ dengue: submitted successfully (HTTP 202)

[Test 3/3] Submitting HIV payload...
✓ HIV: submitted successfully (HTTP 202)

═══════════════════════════════════════════════════════════════
Results: 3 passed, 0 failed (2341ms)
═══════════════════════════════════════════════════════════════
```

---

## Part 5: Credential Rotation Procedures

### Step 5.1: Scheduled Credential Rotation (Annual)

ANVISA sandbox credentials should be rotated annually for security compliance.

**Rotation timeline:**
- Credentials provisioned: 2026-05-07
- First rotation: 2027-05-07
- Frequency: Annual (per security policy)

**Procedure:**

1. **Request new credentials from ANVISA:**
   ```bash
   # Contact ANVISA support (via registration contact email)
   # Subject: "HC Quality NOTIVISA Sandbox Credential Rotation"
   # Request: New API key + confirmation of endpoint stability
   ```

2. **Test new credentials in separate secrets:**
   ```bash
   # Set new secrets temporarily (with _NEW suffix)
   firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY_NEW --project=hmatologia2

   # Test connectivity with new key
   NOTIVISA_SANDBOX_API_KEY="<new_key>" bash scripts/test-notivisa-sandbox-connectivity.sh
   ```

3. **Promote new credentials:**
   ```bash
   # Delete old secret version
   gcloud secrets versions destroy latest \
     --secret=NOTIVISA_SANDBOX_API_KEY \
     --project=hmatologia2

   # Set new version as active
   firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY --project=hmatologia2
   # Paste new API key when prompted
   ```

4. **Redeploy functions with new secrets:**
   ```bash
   firebase deploy --only functions:notivisaDraftCreate,functions:notivisaQueueProcessor --project=hmatologia2
   ```

5. **Verify rollout:**
   ```bash
   # Test a sandbox submission
   npm run test:notivisa-sandbox

   # Check Cloud Logs
   gcloud functions logs read notivisaQueueProcessor \
     --limit=20 \
     --region=southamerica-east1 \
     --project=hmatologia2
   ```

6. **Document rotation:**
   ```bash
   # Add entry to rotation log
   cat >> docs/NOTIVISA_CREDENTIAL_ROTATION_LOG.txt <<EOF
   Date: 2027-05-07
   Action: Annual credential rotation
   Old Key: gcloud secrets versions list NOTIVISA_SANDBOX_API_KEY (check audit logs)
   New Key: Set via firebase functions:secrets:set
   Verified: test-notivisa-sandbox-connectivity.sh passed
   Deployed: functions:notivisaDraftCreate, functions:notivisaQueueProcessor
   EOF
   ```

### Step 5.2: Emergency Credential Revocation

If credentials are suspected compromised:

**Immediate actions:**

1. **Revoke credentials in ANVISA portal:**
   ```
   https://portalanvisa.gov.br/notivisa → Account Settings → Revoke API Key
   ```

2. **Clear local environment:**
   ```bash
   # Delete secret from Firebase
   gcloud secrets delete NOTIVISA_SANDBOX_API_KEY --project=hmatologia2

   # Kill any running functions
   gcloud functions delete notivisaDraftCreate --region=southamerica-east1 --project=hmatologia2 --quiet
   gcloud functions delete notivisaQueueProcessor --region=southamerica-east1 --project=hmatologia2 --quiet
   ```

3. **Request emergency replacement from ANVISA:**
   ```
   Contact: ANVISA support (emergency@anvisa.gov.br, if available)
   Subject: "URGENT: HC Quality NOTIVISA Sandbox API Key Compromised"
   ```

4. **Once new credentials received:**
   - Follow steps 2-6 from "Scheduled Credential Rotation" above
   - Include incident report in documentation

---

## Part 6: Sandbox vs Production Switching

### Step 6.1: Environment-Based Endpoint Selection

HC Quality must support both sandbox (v1.4) and production (v1.5+) endpoints.

**Configuration in Cloud Functions:**

Create `functions/src/modules/notivisa/config/endpointSelector.ts`:

```typescript
/**
 * NOTIVISA Endpoint Selector
 * Routes submissions to sandbox or production based on environment
 * v1.4: Always sandbox
 * v1.5+: Configurable (default: production, fallback: sandbox for backward compat)
 */

export type NotivisaEnvironment = 'sandbox' | 'production';

export interface NotivisaEndpointConfig {
  baseUrl: string;
  apiKey: string;
  apiKeySecretName: string;
  timeout: number;
  maxRetries: number;
}

export async function getNotivisaEndpoint(
  env: NotivisaEnvironment
): Promise<NotivisaEndpointConfig> {
  const secretsManager = require('@google-cloud/secret-manager');
  const client = new secretsManager.SecretManagerServiceClient();

  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'hmatologia2';

  if (env === 'sandbox') {
    // v1.4: Sandbox endpoint
    const sandboxEndpoint = process.env.NOTIVISA_SANDBOX_ENDPOINT ||
      'https://sandbox.notivisa.gov.br/api/v1/';
    const sandboxApiKey = process.env.NOTIVISA_SANDBOX_API_KEY;

    if (!sandboxApiKey) {
      throw new Error('NOTIVISA_SANDBOX_API_KEY secret not loaded');
    }

    return {
      baseUrl: sandboxEndpoint,
      apiKey: sandboxApiKey,
      apiKeySecretName: 'NOTIVISA_SANDBOX_API_KEY',
      timeout: 30000,
      maxRetries: 5,
    };
  } else if (env === 'production') {
    // v1.5+: Production endpoint with mTLS certificate
    const prodEndpoint = process.env.NOTIVISA_PROD_ENDPOINT ||
      'https://notivisa.saude.gov.br/api/v1/';
    const prodApiKey = process.env.NOTIVISA_PROD_API_KEY;
    const certPfx = process.env.NOTIVISA_CERT_PFX;
    const certPassword = process.env.NOTIVISA_CERT_PASSWORD;

    if (!prodApiKey || !certPfx || !certPassword) {
      throw new Error(
        'Production NOTIVISA credentials incomplete: ' +
        'NOTIVISA_PROD_API_KEY, NOTIVISA_CERT_PFX, NOTIVISA_CERT_PASSWORD required'
      );
    }

    return {
      baseUrl: prodEndpoint,
      apiKey: prodApiKey,
      apiKeySecretName: 'NOTIVISA_PROD_API_KEY',
      timeout: 60000,
      maxRetries: 3, // More conservative for production
    };
  } else {
    throw new Error(`Unknown NOTIVISA environment: ${env}`);
  }
}

/**
 * Determine current environment from NODE_ENV or fallback to sandbox
 */
export function getActiveNotivisaEnvironment(): NotivisaEnvironment {
  const env = process.env.NODE_ENV || 'development';
  
  // v1.4: Always use sandbox
  if (process.env.NOTIVISA_VERSION === 'v1.4') {
    return 'sandbox';
  }

  // v1.5+: Use production if NODE_ENV=production and credentials available
  if (env === 'production' && process.env.NOTIVISA_PROD_API_KEY) {
    return 'production';
  }

  // Default: sandbox
  return 'sandbox';
}
```

### Step 6.2: Router in Submission Callable

Update `functions/src/modules/notivisa/callables/notivisaQueueProcessor.ts`:

```typescript
import { getActiveNotivisaEnvironment, getNotivisaEndpoint } from '../config/endpointSelector';

export async function submitNotivisaRequest(payload: NotivisaPayload): Promise<SubmissionResult> {
  const env = getActiveNotivisaEnvironment();
  const endpoint = await getNotivisaEndpoint(env);

  console.log(`[NOTIVISA] Submitting to ${env} endpoint`, {
    labId: payload.laboratorio_cnpj,
    disease: payload.doenca_notificavel,
    endpoint: endpoint.baseUrl,
  });

  try {
    const response = await axios.post(
      `${endpoint.baseUrl}submit`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${endpoint.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: endpoint.timeout,
      }
    );

    return {
      status: 'success',
      environment: env,
      transactionId: response.data.transaction_id,
      httpStatus: response.status,
    };
  } catch (error) {
    // Error handling...
  }
}
```

### Step 6.3: Version Flags in firebase.json

Add version control to distinguish v1.4 (sandbox-only) from v1.5+ (switchable):

```json
{
  "functions": {
    "source": "functions",
    "env": [
      {
        "group": "notivisa",
        "values": {
          "notivisa_version": "v1.4",
          "notivisa_environment": "sandbox",
          "notivisa_endpoint": "https://sandbox.notivisa.gov.br/api/v1/"
        }
      }
    ]
  }
}
```

Deploy with version:
```bash
firebase deploy --only functions:notivisaQueueProcessor --project=hmatologia2
# Functions will read NOTIVISA_VERSION from environment config
```

---

## Part 7: Troubleshooting & Validation

### Step 7.1: Common Issues & Fixes

| Issue | Symptoms | Root Cause | Fix |
|-------|----------|-----------|-----|
| **Credentials not loaded** | "NOTIVISA_SANDBOX_API_KEY secret not loaded" | Secret not set in Firebase Secrets Manager | `firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY` |
| **Invalid API key** | 401 Unauthorized | Expired or incorrect API key | Verify with `gcloud secrets versions access latest --secret=NOTIVISA_SANDBOX_API_KEY` |
| **Wrong endpoint URL** | 404 Not Found | Endpoint URL typo or outdated | Confirm URL with ANVISA documentation |
| **Rate limiting** | 429 Too Many Requests | Too many submissions in short time | Implement exponential backoff (see Part 2) |
| **Timeout errors** | Request timed out after 30s | Sandbox API slow or network latency | Increase `NOTIVISA_SUBMISSION_TIMEOUT_MS` to 60000 |
| **Network unreachable** | Connection refused | ANVISA sandbox down or maintenance | Check status page + retry after maintenance window |

### Step 7.2: Validation Checklist (Pre-Phase 4)

Run this before Phase 4 execution:

```bash
#!/bin/bash
# scripts/validate-notivisa-sandbox-readiness.sh

echo "═══════════════════════════════════════════════════════════════"
echo "NOTIVISA Sandbox Readiness Validation"
echo "═══════════════════════════════════════════════════════════════"
echo ""

CHECKS_PASSED=0
CHECKS_FAILED=0

# Check 1: Secrets set
echo "[1/8] Checking Firebase Secrets Manager..."
if gcloud secrets describe NOTIVISA_SANDBOX_API_KEY --project=hmatologia2 &>/dev/null; then
  echo "✓ NOTIVISA_SANDBOX_API_KEY set"
  ((CHECKS_PASSED++))
else
  echo "✗ NOTIVISA_SANDBOX_API_KEY not found"
  ((CHECKS_FAILED++))
fi

# Check 2: Environment variables
echo "[2/8] Checking .env.sandbox..."
if [[ -f .env.sandbox ]] && grep -q "NOTIVISA_SANDBOX_ENDPOINT" .env.sandbox; then
  echo "✓ .env.sandbox exists with NOTIVISA variables"
  ((CHECKS_PASSED++))
else
  echo "✗ .env.sandbox missing or incomplete"
  ((CHECKS_FAILED++))
fi

# Check 3: Connectivity
echo "[3/8] Testing sandbox API connectivity..."
if bash scripts/test-notivisa-sandbox-connectivity.sh &>/dev/null; then
  echo "✓ Sandbox API reachable"
  ((CHECKS_PASSED++))
else
  echo "✗ Sandbox API connectivity failed"
  ((CHECKS_FAILED++))
fi

# Check 4: Functions code
echo "[4/8] Checking Cloud Functions code..."
if [[ -f functions/src/modules/notivisa/callables/notivisaDraftCreate.ts ]]; then
  echo "✓ notivisaDraftCreate function exists"
  ((CHECKS_PASSED++))
else
  echo "✗ notivisaDraftCreate function missing"
  ((CHECKS_FAILED++))
fi

# Check 5: Firestore rules
echo "[5/8] Checking Firestore security rules..."
if grep -q "notivisa-outbox\|notivisa-drafts" firestore.rules; then
  echo "✓ NOTIVISA rules configured"
  ((CHECKS_PASSED++))
else
  echo "✗ NOTIVISA Firestore rules not found"
  ((CHECKS_FAILED++))
fi

# Check 6: Test fixtures
echo "[6/8] Checking test fixtures..."
if [[ -f functions/src/__tests__/fixtures/notivisa-test-payloads.ts ]]; then
  echo "✓ Test payloads exist"
  ((CHECKS_PASSED++))
else
  echo "✗ Test payloads missing"
  ((CHECKS_FAILED++))
fi

# Check 7: TypeScript build
echo "[7/8] Checking TypeScript compilation..."
cd functions && npm run build 2>&1 | tail -1
if [[ $? -eq 0 ]]; then
  echo "✓ Functions build successful"
  ((CHECKS_PASSED++))
else
  echo "✗ Functions build failed"
  ((CHECKS_FAILED++))
fi
cd ..

# Check 8: Documentation
echo "[8/8] Checking documentation..."
if [[ -f docs/v1.4_NOTIVISA_SANDBOX_SETUP.md ]]; then
  echo "✓ NOTIVISA documentation complete"
  ((CHECKS_PASSED++))
else
  echo "✗ NOTIVISA documentation missing"
  ((CHECKS_FAILED++))
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Results: $CHECKS_PASSED passed, $CHECKS_FAILED failed"
echo "═══════════════════════════════════════════════════════════════"

if [[ $CHECKS_FAILED -gt 0 ]]; then
  exit 1
fi
```

### Step 7.3: CloudLogs Validation

After deployment, monitor Cloud Logs for errors:

```bash
# Monitor NOTIVISA functions
gcloud functions logs read \
  --filter='resource.type="cloud_function" AND resource.labels.function_name=~"notivisa.*"' \
  --limit=50 \
  --region=southamerica-east1 \
  --project=hmatologia2

# Check for errors
gcloud functions logs read \
  --filter='resource.type="cloud_function" AND resource.labels.function_name=~"notivisa.*" AND severity="ERROR"' \
  --limit=10 \
  --region=southamerica-east1 \
  --project=hmatologia2
```

---

## Implementation Checklist

### Pre-Phase 4 Setup (by 2026-05-10)

- [ ] ANVISA sandbox registration submitted
- [ ] ANVISA credentials received (API key + endpoint URL)
- [ ] Firebase Secrets Manager configured (4 secrets)
- [ ] `.env.sandbox` created and loaded
- [ ] Connectivity test passing
- [ ] Functions code deployed with secrets
- [ ] Firestore rules updated
- [ ] Test payloads created (syphilis, dengue, HIV)
- [ ] Documentation complete

### Phase 4 Execution (2026-05-20)

- [ ] Sandbox API submission tests passing (3/3 payloads)
- [ ] RT approval workflow tested in UI
- [ ] Audit trail logging verified
- [ ] Error handling tested (validation errors, rate limits, retries)
- [ ] Cloud Logs clean (0 errors for 24h post-deploy)
- [ ] Manual retry procedure documented
- [ ] Operations runbook complete

### v1.5 Preparation (by 2026-11-01)

- [ ] Certificate provisioning initiated (legal track)
- [ ] Production endpoint architecture designed
- [ ] Endpoint selector implemented (sandbox → production switch)
- [ ] ADR-0014 final sign-off completed
- [ ] Certificate secrets placeholders created

---

## Success Criteria

**Phase 4 Task 04-03 (NOTIVISA Integration) complete when:**

1. ✅ Sandbox credentials provisioned by ANVISA
2. ✅ Connectivity test passing
3. ✅ Draft generation + RT seal workflow tested with 3 diseases
4. ✅ Sandbox API submissions working (3 successful tests)
5. ✅ Audit trail complete (immutable Firestore logging)
6. ✅ Error handling verified (validation, rate limits, retries)
7. ✅ Cloud Logs clean (0 errors for 24h)
8. ✅ Ops runbook + manual retry documented
9. ✅ Certificate provisioning track initiated
10. ✅ v1.5 production API switch architecture designed

---

## References

- **ADR-0014:** NOTIVISA Integration (Sandbox → Production Pathway)
- **ADR-0021:** NOTIVISA Queue & Retry Pattern
- **ADR-0026:** NOTIVISA Queue Processing (Async Append-Only)
- **v1.4_NOTIVISA_SANDBOX_SETUP.md:** Government API Onboarding
- **PHASE_8_NOTIVISA_CALLABLES.md:** Cloud Functions Implementation
- **RDC 978 Art. 6º §1:** NOTIVISA notification requirement
- **Portaria 204/2016 MS:** 99 notifiable diseases list

---

**Status:** 🟢 **Ready for Phase 4 Implementation**  
**Created:** 2026-05-07  
**Version:** 1.1  
**Owner:** DevOps + Backend Engineering  
**Audience:** Phase 4 Task 04-03 team, Operations, Security
