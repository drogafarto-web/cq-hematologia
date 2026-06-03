---
title: 'NOTIVISA Sandbox Quick Setup Guide'
subtitle: 'Copy-paste commands for Phase 4 implementation'
date_created: '2026-05-07'
version: '1.0'
status: 'Ready for Phase 4'
audience: 'DevOps Engineers + Backend Team'
---

# NOTIVISA Sandbox — Quick Setup Guide

**Faster alternative** to the full setup guide. Contains all commands, in order, with expected outputs.

**Timeline:** 30 minutes (assuming ANVISA credentials already received)

---

## Prerequisites

Before starting, ensure:

```bash
# 1. Firebase CLI installed and authenticated
firebase login

# 2. gcloud CLI installed and authenticated
gcloud auth login

# 3. Node 22+ installed
node --version  # Should be v22.x.x

# 4. ANVISA sandbox credentials on hand
# Should have:
#   - API Key (alphanumeric string)
#   - Sandbox endpoint URL (https://sandbox.notivisa.gov.br/api/v1/ or similar)
#   - Lab CNPJ (14 digits)
#   - Registration ID (from registration email)
```

---

## Step 1: Store Credentials in Firebase Secrets Manager (3 min)

```bash
# 1.1 Set sandbox API key
firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY --project=hmatologia2
# When prompted, paste API key (will not echo)
# Expected: "Set secret NOTIVISA_SANDBOX_API_KEY"

# 1.2 Set sandbox endpoint URL
firebase functions:secrets:set NOTIVISA_SANDBOX_ENDPOINT --project=hmatologia2
# Example: https://sandbox.notivisa.gov.br/api/v1/
# Expected: "Set secret NOTIVISA_SANDBOX_ENDPOINT"

# 1.3 Set lab CNPJ
firebase functions:secrets:set NOTIVISA_LAB_CNPJ --project=hmatologia2
# Example: 12345678000195 (14 digits, no hyphens)
# Expected: "Set secret NOTIVISA_LAB_CNPJ"

# 1.4 Set registration ID (for reference)
firebase functions:secrets:set NOTIVISA_REGISTRATION_ID --project=hmatologia2
# Example: REG-2026-05-07-001
# Expected: "Set secret NOTIVISA_REGISTRATION_ID"

# 1.5 Verify all secrets set
gcloud secrets list --project=hmatologia2 | grep NOTIVISA
# Expected output:
# NOTIVISA_LAB_CNPJ
# NOTIVISA_REGISTRATION_ID
# NOTIVISA_SANDBOX_API_KEY
# NOTIVISA_SANDBOX_ENDPOINT
```

---

## Step 2: Update firebase.json (1 min)

Add secrets to `firebase.json`:

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

---

## Step 3: Update .env.sandbox (2 min)

Edit `C:\hc quality\.env.sandbox`:

```bash
# Fill in actual values (copy from registration email)
sed -i 's/NOTIVISA_SANDBOX_API_KEY=$/NOTIVISA_SANDBOX_API_KEY=YOUR_KEY_HERE/' .env.sandbox
sed -i 's/NOTIVISA_SANDBOX_ENDPOINT=$/NOTIVISA_SANDBOX_ENDPOINT=https:\/\/sandbox.notivisa.gov.br\/api\/v1\//' .env.sandbox
sed -i 's/NOTIVISA_LAB_CNPJ=$/NOTIVISA_LAB_CNPJ=12345678000195/' .env.sandbox
sed -i 's/NOTIVISA_REGISTRATION_ID=$/NOTIVISA_REGISTRATION_ID=REG-2026-05-07-001/' .env.sandbox
```

---

## Step 4: Test Sandbox Connectivity (2 min)

```bash
# Load environment
export $(cat .env.sandbox | grep NOTIVISA | xargs)

# Test connectivity
bash scripts/test-notivisa-sandbox-connectivity.sh

# Expected output:
# ═══════════════════════════════════════════════════════════════
# NOTIVISA Sandbox Connectivity Tests
# ═══════════════════════════════════════════════════════════════
#
# [1/3] Health check...
# ✓ Sandbox API is reachable (HTTP 200)
# ✓ API key format valid (length: 42)
# ✓ Sandbox endpoint URL format valid
#
# ═══════════════════════════════════════════════════════════════
# [✓] All connectivity checks passed.
# [✓] Sandbox API is ready for schema validation.
# ═══════════════════════════════════════════════════════════════
```

---

## Step 5: Build Cloud Functions (5 min)

```bash
cd functions

# Build TypeScript
npm run build
# Expected: No errors, output directory created

# Verify build successful
ls -la lib/modules/notivisa/callables/
# Should show: notivisaDraftCreate.js, notivisaQueueProcessor.js, etc.

cd ..
```

---

## Step 6: Deploy Cloud Functions (10 min)

```bash
# Pre-deployment verification (optional but recommended)
bash scripts/preflight-secrets-check.sh
# Expected: Exit code 0, all secrets found

# Deploy NOTIVISA functions
firebase deploy \
  --only functions:notivisaDraftCreate,functions:notivisaQueueProcessor \
  --project=hmatologia2

# Expected output:
# Function notivisaDraftCreate has been deployed
# Function notivisaQueueProcessor has been deployed
# [SUCCESS] Deploy complete!

# Verify deployment
firebase functions:describe notivisaDraftCreate --project=hmatologia2
# Should show: status: "ACTIVE", runtime: "nodejs22"
```

---

## Step 7: Run Integration Tests (5 min)

```bash
# Test payload submission
npm run test:notivisa-sandbox

# Expected output:
# ═══════════════════════════════════════════════════════════════
# NOTIVISA Sandbox API Validation Tests
# ═══════════════════════════════════════════════════════════════
#
# [Setup] Loading sandbox credentials...
# ✓ Secrets loaded
#   Endpoint: https://sandbox.notivisa.gov.br/api/v1/
#   Lab CNPJ: 12345678000195
#
# [Test 1/3] Submitting syphilis payload...
# ✓ syphilis: submitted successfully (HTTP 202)
#
# [Test 2/3] Submitting dengue payload...
# ✓ dengue: submitted successfully (HTTP 202)
#
# [Test 3/3] Submitting HIV payload...
# ✓ HIV: submitted successfully (HTTP 202)
#
# ═══════════════════════════════════════════════════════════════
# Results: 3 passed, 0 failed (2341ms)
# ═══════════════════════════════════════════════════════════════
```

---

## Step 8: Validate Cloud Logs (5 min)

```bash
# Check for errors
gcloud functions logs read \
  --filter='resource.type="cloud_function" AND resource.labels.function_name=~"notivisa.*" AND severity="ERROR"' \
  --limit=10 \
  --region=southamerica-east1 \
  --project=hmatologia2

# Expected: 0 results (no errors)

# Check recent activity
gcloud functions logs read notivisaQueueProcessor \
  --limit=10 \
  --region=southamerica-east1 \
  --project=hmatologia2

# Expected: Logs showing successful submission attempts, no ERROR level
```

---

## Step 9: Run Readiness Validation (3 min)

```bash
# Complete pre-Phase 4 checklist
bash scripts/validate-notivisa-sandbox-readiness.sh

# Expected output:
# ═══════════════════════════════════════════════════════════════
# NOTIVISA Sandbox Readiness Validation
# ═══════════════════════════════════════════════════════════════
#
# [1/8] Checking Firebase Secrets Manager...
# ✓ NOTIVISA_SANDBOX_API_KEY secret configured
# ✓ NOTIVISA_SANDBOX_ENDPOINT secret configured
# [2/8] Checking .env.sandbox...
# ✓ .env.sandbox exists with NOTIVISA variables
# [3/8] Testing sandbox API connectivity...
# ✓ Sandbox API reachable and responding
# [4/8] Checking Cloud Functions code...
# ✓ notivisaDraftCreate function exists
# ✓ notivisaQueueProcessor function exists
# [5/8] Checking Firestore security rules...
# ✓ NOTIVISA rules configured in firestore.rules
# [6/8] Checking test fixtures...
# ✓ Test payloads with 3+ diseases configured
# [7/8] Checking TypeScript compilation...
# ✓ Functions build successful (no TypeScript errors)
# [8/8] Checking documentation...
# ✓ v1.4_NOTIVISA_SANDBOX_SETUP.md exists
# ✓ NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md exists
#
# ═══════════════════════════════════════════════════════════════
# Validation Results
# ═══════════════════════════════════════════════════════════════
#
#   Passed:  11
#   Failed:  0
#   Skipped: 0
#
# ✓ All critical checks passed or awaiting ANVISA credentials
```

---

## Troubleshooting

### Issue: "NOTIVISA_SANDBOX_API_KEY secret not loaded"

**Cause:** Secret not set in Firebase Secrets Manager or function not deployed with secret configuration.

**Fix:**

```bash
# 1. Verify secret exists
gcloud secrets describe NOTIVISA_SANDBOX_API_KEY --project=hmatologia2

# 2. Verify firebase.json includes secret
grep NOTIVISA firebase.json

# 3. Redeploy with secrets
firebase deploy --only functions:notivisaDraftCreate --project=hmatologia2
```

### Issue: "401 Unauthorized" on API call

**Cause:** API key expired, incorrect, or endpoint URL wrong.

**Fix:**

```bash
# 1. Verify API key format
gcloud secrets versions access latest --secret=NOTIVISA_SANDBOX_API_KEY --project=hmatologia2 | wc -c
# Should be ~32 characters (plus newline)

# 2. Test connectivity directly
export NOTIVISA_SANDBOX_API_KEY=$(gcloud secrets versions access latest --secret=NOTIVISA_SANDBOX_API_KEY --project=hmatologia2)
export NOTIVISA_SANDBOX_ENDPOINT=$(gcloud secrets versions access latest --secret=NOTIVISA_SANDBOX_ENDPOINT --project=hmatologia2)
bash scripts/test-notivisa-sandbox-connectivity.sh

# 3. If still failing, contact ANVISA support
```

### Issue: "Connection timeout" or "DNS resolution failed"

**Cause:** ANVISA sandbox API unreachable (network issue, maintenance, or firewall block).

**Fix:**

```bash
# 1. Check ANVISA status page
# https://portalanvisa.gov.br/ (check for maintenance notices)

# 2. Test network connectivity
curl -v https://sandbox.notivisa.gov.br/api/v1/health

# 3. If blocked by firewall, whitelist endpoint
# Ask DevOps/Infra to allowlist: sandbox.notivisa.gov.br

# 4. Retry after 1 hour (maintenance window)
```

---

## Success Validation Checklist

Before declaring Phase 4 ready, verify all:

- [ ] Step 1: All 4 secrets set in Firebase
- [ ] Step 2: firebase.json updated with secrets array
- [ ] Step 3: .env.sandbox filled with actual ANVISA credentials
- [ ] Step 4: Connectivity test passes (3/3 checks)
- [ ] Step 5: Functions build completes with no errors
- [ ] Step 6: Functions deployed successfully
- [ ] Step 7: Integration tests pass (3/3 payloads)
- [ ] Step 8: Cloud Logs show 0 errors (past 24h)
- [ ] Step 9: Readiness validation passes (11/11 checks)

**If all above pass:** ✅ **Ready for Phase 4 Execution (2026-05-20)**

---

## Next Steps After Setup

1. **Unit Tests:** `npm run test:notivisa-unit`
2. **E2E Tests:** `npm run test:notivisa-e2e`
3. **RT Approval Workflow:** Test in UI (admin panel → NOTIVISA → Drafts)
4. **Audit Trail:** Verify Firestore `auditLogs` collection has entries
5. **Manual Retry:** Test stuck submission recovery in Firestore Console
6. **Documentation:** Review `docs/v1.4_NOTIVISA_SANDBOX_SETUP.md` for RT user guide

---

## Reference Documents

- **Full Setup:** `docs/NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md`
- **ANVISA Onboarding:** `docs/v1.4_NOTIVISA_SANDBOX_SETUP.md`
- **Credential Rotation:** `docs/NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md`
- **Architecture:** `docs/adr/ADR-0014-notivisa-integration-sandbox-to-production.md`

---

**Total Time: ~30 minutes** (assuming credentials already in hand)

**Status:** 🟢 **Ready for Phase 4**  
**Created:** 2026-05-07  
**Owner:** DevOps + Backend Engineering
