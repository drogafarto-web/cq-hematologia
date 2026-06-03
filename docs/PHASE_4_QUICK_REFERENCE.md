---
title: 'Phase 4 Quick Reference — Copy-Paste Commands'
date: 2026-05-07
version: '1.0'
document_type: 'CHEATSHEET'
audience: 'Engineers (all streams)'
---

# Phase 4 Quick Reference — Copy-Paste Commands

**Print this. Bookmark it. Use it daily.**

---

## Pre-Kickoff Setup (2026-05-19)

### 1. SMTP Credentials (Email Escalation)

**Choose ONE option:**

#### Option A: Gmail (dev/test)

```bash
# Create app password at https://myaccount.google.com/apppasswords
firebase functions:secrets:set SMTP_HOST --data="smtp.gmail.com"
firebase functions:secrets:set SMTP_PORT --data="587"
firebase functions:secrets:set SMTP_USER --data="labclin-noreply@gmail.com"
firebase functions:secrets:set SMTP_PASS --data="<16-char-app-password>"

# Verify
firebase functions:secrets:list
```

#### Option B: Brevo (production) — RECOMMENDED

```bash
# Sign up at https://www.brevo.com (free tier: 300/day)
firebase functions:secrets:set SMTP_HOST --data="smtp-relay.brevo.com"
firebase functions:secrets:set SMTP_PORT --data="587"
firebase functions:secrets:set SMTP_USER --data="noreply@company.com"
firebase functions:secrets:set SMTP_PASS --data="<brevo-api-key>"

# Verify
firebase functions:secrets:list
```

**Test (optional):**

```bash
firebase deploy --only functions:criticos_escalate
# Wait for deploy, then send test via Firebase console callable
# Expected: email arrives in <10 min with ⚠️ LAUDO CRÍTICO subject
```

---

### 2. Cloud Tasks Queue (NOTIVISA)

```bash
gcloud tasks queues create notivisa-outbox-queue \
  --location=southamerica-east1 \
  --max-attempts=5 \
  --max-retry-delay=3600s \
  --max-dispatches-per-second=100 \
  --project=hmatologia2

# Verify
gcloud tasks queues describe notivisa-outbox-queue \
  --location=southamerica-east1 \
  --project=hmatologia2
```

---

### 3. Email-Link Auth (Optional, Phase 5)

1. Go to [Firebase Auth Console](https://console.firebase.google.com/project/hmatologia2/authentication/providers)
2. Click **Email/Password** → **Edit**
3. Enable **"Email link (passwordless sign-in)"**
4. Set redirect: `https://hmatologia2.web.app/auth/link-callback`
5. Save

---

### 4. Twilio Provisioning (Optional, Phase 5)

```bash
# IF needed (decision at 2026-05-20 standup)
firebase functions:secrets:set TWILIO_ACCOUNT_SID --data="<sid>"
firebase functions:secrets:set TWILIO_AUTH_TOKEN --data="<token>"
firebase functions:secrets:set TWILIO_FROM_NUMBER --data="+551199999999"

firebase deploy --only functions:criticos_escalate
```

---

## Daily Development

### Run Tests

```bash
# Unit tests (Vitest)
npm run test

# Watch mode (recommended during dev)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Local Development + Emulator

```bash
# Start Firestore emulator (in separate terminal)
firebase emulators:start --only firestore,functions

# In another terminal, run tests against emulator
npm run test:emulator
```

### Type-Check

```bash
# Check TS errors (no build)
npx tsc --noEmit

# Watch mode
npx tsc --watch
```

---

## Pre-Deploy Gate (Week 2–2.5)

**Run this before every PR merge:**

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Lint (with baseline of 88 warnings)
npm run lint

# 3. Tests (baseline 274 + Phase 4 new tests)
npm run test

# 4. Build (must be <420 KB gzip main chunk)
npm run build

# 5. Secrets check (blocks PENDING_SET placeholders)
bash scripts/preflight-secrets-check.sh

# If all pass: ✅ READY FOR PR MERGE
```

---

## Deploy Commands (Phase 4 Final Week — 2026-06-01–02)

### Full Deploy (3-step sequence)

**STOP: Have you run the pre-deploy gate above? YES? Continue.**

```bash
# Step 1: Deploy Firestore Rules + Indexes (~2 min)
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# Wait for completion, check Cloud Console for success

# Step 2: Deploy Cloud Functions (~5 min)
firebase deploy --only functions --project hmatologia2

# Wait for completion, check Cloud Console

# Step 3: Deploy Hosting (~2 min)
firebase deploy --only hosting --project hmatologia2

# Expected output:
# ✔ Deploy complete!
# ✔ Hosting URL: https://hmatologia2.web.app
```

---

### Deploy Single Stage (emergency fix)

```bash
# Rules only (if rules-only fix)
firebase deploy --only firestore:rules --project hmatologia2

# Functions only (if function-only fix)
firebase deploy --only functions --project hmatologia2

# Hosting only (if UI-only fix)
firebase deploy --only hosting --project hmatologia2
```

---

## Post-Deploy Monitoring (24-hour tail)

```bash
# Automated script (macOS/Linux)
bash scripts/monitor-cloud-logs.sh 24 30

# Automated script (Windows PowerShell)
powershell -File scripts/monitor-cloud-logs.ps1 -Hours 24 -IntervalSeconds 30

# Manual: Watch Cloud Logs in console
# Filter: severity >= WARNING
# Expected: <5% error rate, 0 CRITICAL
```

---

## Rollback (Emergency Only)

**If post-deploy monitoring finds critical issues:**

```bash
# Rollback Rules
firebase deploy --only firestore:rules --project hmatologia2

# Rollback Functions
firebase deploy --only functions --project hmatologia2

# Rollback Hosting
firebase deploy --only hosting --project hmatologia2

# Document incident + notify CTO
```

---

## Cloud Functions Helpful Commands

### View Recent Logs

```bash
firebase functions:log --limit 50
```

### Call Callable Function (Testing)

```bash
firebase functions:call criticos_escalate \
  --data='{"labId":"labclin-riopomba","laudoId":"test123","email":"test@example.com","phone":""}'

firebase functions:call portals_getLabConfig \
  --data='{"labId":"labclin-riopomba"}'
```

### Delete Function (if needed)

```bash
firebase functions:delete functionName --project hmatologia2
```

---

## Firestore Emulator

### Start Emulator (for local dev)

```bash
firebase emulators:start --only firestore,functions
```

### Run Tests Against Emulator

```bash
npm run test:emulator
```

### View Emulator UI

Open browser: `http://localhost:4000`

---

## Git Workflow (Phase 4)

### Create Feature Branch

```bash
git checkout main
git pull
git checkout -b feature/04-01-patient-portal
# or
git checkout -b feature/04-02-portal-ui
git checkout -b feature/04-03-notivisa-queue
git checkout -b feature/04-04-e2e-testing
```

### Before PR

```bash
# Run pre-deploy gate (see above)
npx tsc --noEmit && npm run test && npm run build

# If all pass:
git add .
git commit -m "feat(04-01): patient portal email-link auth

- Implement validatePatientToken callable
- Add email-link session management
- Deploy to Cloud Functions
- All tests passing (12 new unit tests)

Related: REQ-408, LGPD Art. 18"

git push origin feature/04-01-patient-portal
```

### After Merge to Main

```bash
# Pipeline runs automatically:
# 1. Pre-deploy gate (GitHub Actions)
# 2. If main branch: auto-deploys Rules → Functions → Hosting
# 3. Post-deploy verification (smoke tests + Cloud Logs tail)
```

---

## Firestore Security Rules Quick Check

### Test Rule in Emulator

```bash
npm run test:firestore-rules
```

### View Current Rules in Production

```bash
firebase rules:list
```

### Rollback Rules (if broken)

```bash
firebase deploy --only firestore:rules --project hmatologia2
```

---

## Web Vitals Check (Before Shipping)

### Lighthouse (Chrome DevTools)

1. Open app in Chrome
2. DevTools → Lighthouse
3. Generate report
4. Check targets:
   - LCP: <2.0s ✓
   - INP: <200ms ✓
   - CLS: <0.05 ✓

### Real User Monitoring

Check staging/prod analytics (if configured):

```
https://console.firebase.google.com/project/hmatologia2/performance
```

---

## Common Issues + Fixes

### Issue: SMTP_PASS not found (secret empty)

**Fix:** Re-run secret setup

```bash
firebase functions:secrets:set SMTP_PASS --data="<correct-password>"
firebase deploy --only functions:criticos_escalate
```

---

### Issue: Cloud Tasks queue not found

**Fix:** Create queue

```bash
gcloud tasks queues create notivisa-outbox-queue \
  --location=southamerica-east1 \
  --max-attempts=5 \
  --max-retry-delay=3600s \
  --project=hmatologia2
```

---

### Issue: E2E tests flaky

**Fix:** Add retries + clear cache

```bash
# Run tests 3 times
npm run test:e2e -- --retries 3

# Clear cache
rm -rf .firebase/
npm install
```

---

### Issue: Build >420 KB (fails pre-deploy gate)

**Fix:** Check imports

```bash
npm run build -- --analyze

# Find heavy imports, lazy-load or code-split
```

---

## Phase 4 Module Paths

| Module         | Path                                | Owner    |
| -------------- | ----------------------------------- | -------- |
| Portal Auth    | `src/features/portals/`             | Stream B |
| Portal UI      | `src/features/portals/components/`  | Stream B |
| NOTIVISA Queue | `functions/src/callables/notivisa/` | Stream A |
| E2E Tests      | `src/__tests__/e2e/`                | Stream D |

---

## Important URLs

| Environment          | URL                                                               | Purpose            |
| -------------------- | ----------------------------------------------------------------- | ------------------ |
| **Production**       | https://hmatologia2.web.app                                       | Live portal        |
| **Firebase Console** | https://console.firebase.google.com/project/hmatologia2           | Configuration      |
| **Cloud Functions**  | https://console.firebase.google.com/project/hmatologia2/functions | Deployed functions |
| **Firestore**        | https://console.firebase.google.com/project/hmatologia2/firestore | Database           |
| **Cloud Logs**       | https://console.cloud.google.com/logs/query?project=hmatologia2   | Error tracking     |

---

## Contacts + Escalation

| Role              | Escalation                         |
| ----------------- | ---------------------------------- |
| **CTO**           | Architecture decisions + P0 issues |
| **DevOps**        | Deployment + infrastructure issues |
| **Stream A Lead** | Backend + NOTIVISA blockers        |
| **Stream B Lead** | Portal/UI + mobile blockers        |
| **QA Lead**       | Test + deployment issues           |

---

**Print this. Laminate it. Keep on desk during Phase 4. Update as needed.**

---

**Version:** 1.0  
**Last updated:** 2026-05-07  
**Next update:** 2026-05-20 (post-kickoff, add team contact info)
