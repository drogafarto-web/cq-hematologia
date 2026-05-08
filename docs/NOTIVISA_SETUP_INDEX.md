---
title: "NOTIVISA Sandbox Setup — Complete Index"
subtitle: "Find what you need quickly"
date: "2026-05-07"
---

# NOTIVISA Sandbox Setup — Complete Index

Quick navigation for all NOTIVISA setup and operational documentation.

---

## For Phase 4 Implementation (NOW)

Start here if you're implementing sandbox environment configuration.

| Document | Purpose | Time | Link |
|----------|---------|------|------|
| **Quick Setup Guide** | Copy-paste commands (30 min total) | 30 min | [`docs/NOTIVISA_SANDBOX_QUICK_SETUP_GUIDE.md`](./NOTIVISA_SANDBOX_QUICK_SETUP_GUIDE.md) |
| **Environment Setup** | Detailed walkthrough (all parts) | 2-3 hours | [`docs/NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md`](./NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md) |
| **.env.sandbox** | Configuration template | 5 min | [`.env.sandbox`](../.env.sandbox) |

## For Testing & Validation

Once credentials are in hand.

| Document | Purpose | Link |
|----------|---------|------|
| **Connectivity Test (Bash)** | Test sandbox API access | [`scripts/test-notivisa-sandbox-connectivity.sh`](../scripts/test-notivisa-sandbox-connectivity.sh) |
| **Connectivity Test (PowerShell)** | Windows version of test | [`scripts/test-notivisa-sandbox-connectivity.ps1`](../scripts/test-notivisa-sandbox-connectivity.ps1) |
| **Readiness Validation** | Pre-Phase 4 checklist (8 items) | [`scripts/validate-notivisa-sandbox-readiness.sh`](../scripts/validate-notivisa-sandbox-readiness.sh) |

## For Government Registration (Legal/Ops)

Before implementing sandbox (ANVISA provisioning takes 3-5 days).

| Document | Purpose | Link |
|----------|---------|------|
| **Government Onboarding** | Part 1: Registration documents + ANVISA portal | [`docs/v1.4_NOTIVISA_SANDBOX_SETUP.md`](./v1.4_NOTIVISA_SANDBOX_SETUP.md) (Parts 1-2) |

## For Operations & Support

Runtime management and emergency procedures.

| Document | Purpose | Link |
|----------|---------|------|
| **Credential Rotation** | Annual rotation + emergency revocation | [`docs/NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md`](./NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md) |
| **Ops Runbook** | Alerts + manual retries + troubleshooting | [`docs/v1.4_NOTIVISA_SANDBOX_SETUP.md`](./v1.4_NOTIVISA_SANDBOX_SETUP.md) (Part 6-7) |
| **Operational Quick Ref** | Fast checklist for common issues | [`docs/NOTIVISA_OPERATIONAL_QUICK_REFERENCE.md`](./NOTIVISA_OPERATIONAL_QUICK_REFERENCE.md) |

## Architecture & Design

For understanding the design decisions.

| Document | Purpose | Link |
|----------|---------|------|
| **ADR-0014** | NOTIVISA sandbox → production pathway | [`docs/adr/ADR-0014-notivisa-integration-sandbox-to-production.md`](./adr/ADR-0014-notivisa-integration-sandbox-to-production.md) |
| **ADR-0021** | Queue & retry pattern | [`docs/adr/ADR-0021-notivisa-queue-pattern.md`](./adr/ADR-0021-notivisa-queue-pattern.md) |
| **ADR-0026** | Queue processing (async append-only) | [`docs/adr/ADR-0026-notivisa-queue-processing-async-append-only.md`](./adr/ADR-0026-notivisa-queue-processing-async-append-only.md) |
| **Firestore Rules** | NOTIVISA collection security | [`.claude/rules/notivisa-firestore-rules.md`](../.claude/rules/notivisa-firestore-rules.md) |

## Implementation Guides

Step-by-step walkthroughs for specific tasks.

| Document | Purpose | Link |
|----------|---------|------|
| **Sandbox Setup (Detailed)** | Complete setup guide (all 7 parts) | [`docs/NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md`](./NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md) |
| **Payload Validation** | Test payload generation (Part 3 of full guide) | [`docs/NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md#part-3`](./NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md) |
| **Error Handling** | Validation errors, rate limits, retries (Part 4) | [`docs/NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md#part-4`](./NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md) |
| **Credential Rotation** | Step-by-step rotation procedure | [`docs/NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md#scheduled-annual-rotation`](./NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md) |

## Cloud Functions Implementation

Code-level setup and configuration.

| Document | Purpose | Link |
|----------|---------|------|
| **Functions Callables** | notivisaDraftCreate, etc. | [`docs/PHASE_8_NOTIVISA_CALLABLES.md`](./PHASE_8_NOTIVISA_CALLABLES.md) |
| **Cloud Functions config** | Adding secrets to firebase.json | [`docs/NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md#part-1`](./NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md) |

## Troubleshooting & Reference

When something goes wrong.

| Issue | Reference |
|-------|-----------|
| **Connectivity test fails** | [`NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md#part-7`](./NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md) |
| **Credentials not loaded in functions** | [`NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md#part-7-troubleshooting`](./NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md) |
| **Payload validation errors** | [`NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md#part-4-validation-error-handling`](./NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md) |
| **Credential compromised** | [`NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md#emergency-revocation`](./NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md) |
| **Function deployment fails** | [`NOTIVISA_SANDBOX_QUICK_SETUP_GUIDE.md#troubleshooting`](./NOTIVISA_SANDBOX_QUICK_SETUP_GUIDE.md) |

---

## Implementation Paths

### Path 1: Quick Setup (30 min, for experienced team)

1. Read: Quick Setup Guide (5 min)
2. Execute commands (Step 1-9): (25 min)
3. Validate: Run readiness script (5 min)
4. Done! ✅

### Path 2: Careful Walkthrough (2-3 hours, for first-time)

1. Read: Environment Setup full doc (30 min)
2. Execute Part 1-7 step-by-step (90 min)
3. Run all test scripts (30 min)
4. Review Cloud Logs (15 min)
5. Complete readiness checklist (10 min)
6. Done! ✅

### Path 3: Complete Deep Dive (4+ hours, for architecture review)

1. Read ADRs (0014, 0021, 0026) (45 min)
2. Review Firestore rules (15 min)
3. Read environment setup doc (45 min)
4. Execute setup (90 min)
5. Run all tests (30 min)
6. Review Cloud Logs + audit trail (30 min)
7. Create incident playbook from runbook (30 min)
8. Done! ✅

---

## Quick Command Reference

### Setup (one-time)

```bash
# 1. Set secrets
firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY --project=hmatologia2
firebase functions:secrets:set NOTIVISA_SANDBOX_ENDPOINT --project=hmatologia2
firebase functions:secrets:set NOTIVISA_LAB_CNPJ --project=hmatologia2
firebase functions:secrets:set NOTIVISA_REGISTRATION_ID --project=hmatologia2

# 2. Deploy functions
firebase deploy --only functions:notivisaDraftCreate,functions:notivisaQueueProcessor --project=hmatologia2

# 3. Run tests
npm run test:notivisa-sandbox
bash scripts/validate-notivisa-sandbox-readiness.sh
```

### Testing (recurring)

```bash
# Connectivity test
bash scripts/test-notivisa-sandbox-connectivity.sh

# Integration tests
npm run test:notivisa-sandbox

# Check Cloud Logs
gcloud functions logs read notivisaQueueProcessor \
  --limit=20 \
  --region=southamerica-east1 \
  --project=hmatologia2
```

### Maintenance (annual)

```bash
# Annual credential rotation (see NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md)
firebase functions:secrets:set NOTIVISA_SANDBOX_API_KEY --project=hmatologia2
firebase deploy --only functions:notivisaDraftCreate,functions:notivisaQueueProcessor --project=hmatologia2
npm run test:notivisa-sandbox
```

---

## Files & Directories

### Documentation Files

```
docs/
├── NOTIVISA_SANDBOX_ENVIRONMENT_SETUP.md      ← Main guide (1,200 lines)
├── NOTIVISA_CREDENTIAL_ROTATION_PROCEDURES.md ← Rotation/emergency (400 lines)
├── NOTIVISA_SANDBOX_QUICK_SETUP_GUIDE.md      ← Fast reference (300 lines)
├── NOTIVISA_SETUP_INDEX.md                    ← This file
├── v1.4_NOTIVISA_SANDBOX_SETUP.md             ← ANVISA onboarding
├── NOTIVISA_OPERATIONAL_QUICK_REFERENCE.md    ← Ops checklist
├── PHASE_8_NOTIVISA_CALLABLES.md              ← Cloud Functions
└── adr/
    ├── ADR-0014-notivisa-integration-sandbox-to-production.md
    ├── ADR-0021-notivisa-queue-pattern.md
    └── ADR-0026-notivisa-queue-processing-async-append-only.md
```

### Configuration Files

```
.env.sandbox                                    ← Environment variables (template)
firebase.json                                   ← Firebase config (secrets section)
```

### Scripts

```
scripts/
├── test-notivisa-sandbox-connectivity.sh       ← Connectivity test (Bash)
├── test-notivisa-sandbox-connectivity.ps1      ← Connectivity test (PowerShell)
└── validate-notivisa-sandbox-readiness.sh      ← Pre-Phase 4 checklist
```

### Source Code

```
functions/src/modules/notivisa/
├── callables/
│   ├── notivisaDraftCreate.ts
│   ├── notivisaQueueProcessor.ts
│   └── ...
├── config/
│   ├── secretsLoader.ts
│   └── endpointSelector.ts
├── crons/
│   └── notivisaQueueProcessor.ts
└── shared/
    └── notivisa.ts

.claude/rules/
└── notivisa-firestore-rules.md
```

---

## Success Criteria Checklist

Before declaring Phase 4 ready, verify:

- [ ] All 4 secrets set in Firebase Secrets Manager
- [ ] firebase.json updated with secrets array
- [ ] .env.sandbox filled with actual ANVISA credentials
- [ ] Connectivity test passes (3/3 checks)
- [ ] Cloud Functions build without errors
- [ ] Functions deployed successfully
- [ ] Integration tests pass (3/3 payloads)
- [ ] Cloud Logs show 0 errors (past 24h)
- [ ] Readiness validation passes (8/8 checks)
- [ ] RT approval workflow tested in UI
- [ ] Audit trail verified in Firestore
- [ ] Manual retry procedure documented

**All green? ✅ Ready for Phase 4 execution (2026-05-20)**

---

## Key Dates

| Date | Event | Reference |
|------|-------|-----------|
| 2026-05-07 | Task #28 complete (today) | This index |
| 2026-05-10 | Pre-Phase 4 deadline (deadline for ANVISA credentials) | All docs |
| 2026-05-20 | Phase 4 kickoff | Quick Setup Guide |
| 2027-05-07 | First annual credential rotation | Rotation Procedures |
| 2026-11-01 | v1.5 production readiness gate | ADR-0014 |

---

## Version Info

- **Setup docs version:** 1.1
- **Script versions:** test-notivisa-sandbox v1.0
- **Rotation procedures version:** 1.0
- **ADRs status:** All accepted (0014, 0021, 0026)
- **Last updated:** 2026-05-07

---

**Navigation Tips:**
- Start with **Quick Setup Guide** for fast implementation
- Use **Environment Setup** for detailed walkthrough
- Check **Credential Rotation** for annual maintenance
- Refer to **ADRs** for architecture decisions
- See **Troubleshooting** section when stuck

---

**Questions?** See the relevant document link above. All answers are in the docs.

**Ready to start?** → [`NOTIVISA_SANDBOX_QUICK_SETUP_GUIDE.md`](./NOTIVISA_SANDBOX_QUICK_SETUP_GUIDE.md)
