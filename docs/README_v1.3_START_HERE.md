---
title: 'v1.3 Deployment — START HERE'
date: '2026-05-07'
status: '🟢 LIVE'
---

# v1.3 Deployment — START HERE

**You're about to deploy or validate v1.3. Pick your role below.**

---

## Pick Your Role

### 👤 Leadership / Manager / Stakeholder

**Read this (10 min), then approve/go-live:**
→ [v1.3_DEPLOYMENT_EXECUTIVE_SUMMARY.md](v1.3_DEPLOYMENT_EXECUTIVE_SUMMARY.md)

**Key facts:**

- ✅ PRODUCTION DEPLOYED (Step 1+3 LIVE, Step 2 complete, Step 4 pending)
- ✅ Security audit: GREEN
- ✅ Compliance: 78.5% DICQ (audit-ready)
- ✅ 4 new modules live (Bioquímica, Liberação, Reclamações, Críticos)
- ⏳ Smoke tests pending (execute today, ~1 hour)

**Next step:** Say "GO" or "NO-GO" based on success criteria (in summary)

---

### 🔧 Deployment Engineer / DevOps

**Execute this (2–3 hours):**
→ [POST_DEPLOY_CHECKLIST_v1.3.md](POST_DEPLOY_CHECKLIST_v1.3.md)

**Steps you'll take:**

1. Step 4.1 — Firebase Console verification (5 checks, 10 min)
2. Step 4.2 — Routing verification (4 routes, 5 min)
3. Step 4.3 — PWA + Service Worker (2 checks, 5 min)
4. Step 4.4 — Cloud Logs verification (monitor, 30+ min)
5. Step 4.5 — Data integrity spot-checks (3 samples, 10 min)

**Bookmark this:**
→ [CLOUD_LOGS_QUICK_REFERENCE.md](CLOUD_LOGS_QUICK_REFERENCE.md) (copy/paste filters, scripts)

**Questions:** "Did deployment succeed?" → POST_DEPLOY_CHECKLIST_v1.3.md

---

### 🧪 QA / Tester

**Execute this (1–1.5 hours):**
→ [SMOKE_TESTS_EXECUTION_GATE.md](SMOKE_TESTS_EXECUTION_GATE.md)

**Scenarios you'll test:**

1. Bioquímica CIQ (seed analito, run control, verify Levey-Jennings)
2. SGD Drive importer (upload docs, verify hierarchy)
3. Reclamações (complaint intake, LGPD consent, audit trail)
4. Liberação (draft report, RT signature, audit log)

**Setup first (10 min):**
→ [TEST_DATA_QUICK_START.md](TEST_DATA_QUICK_START.md)

**Questions:** "Does it work?" → SMOKE_TESTS_EXECUTION_GATE.md

---

### 🔒 Security / Auditor

**Review this (15–20 min):**
→ [SECURITY_SIGN_OFF_v1.3.md](SECURITY_SIGN_OFF_v1.3.md)

**Status:** ✅ GREEN (all spot-checks passed)

**Then verify:**
→ [FIRESTORE_RULES_SPOT_CHECK_RESULTS.md](FIRESTORE_RULES_SPOT_CHECK_RESULTS.md) (5 audits)

**Compliance:**
→ [COMPLIANCE_SUMMARY_v1.3.md](COMPLIANCE_SUMMARY_v1.3.md) (RDC 978, DICQ, LGPD)

**Questions:** "Is it safe?" → SECURITY_SIGN_OFF_v1.3.md

---

## Status at a Glance

| Step                    | Status          | When             | Owner            |
| ----------------------- | --------------- | ---------------- | ---------------- |
| Step 1: Rules + Indexes | ✅ LIVE         | 2026-05-06 00:32 | Firebase         |
| Step 2: Functions       | ✅ LIVE         | 2026-05-07 14:00 | Cloud Functions  |
| Step 3: Hosting         | ✅ LIVE         | 2026-05-06 02:15 | Firebase Hosting |
| Step 4: Smoke Tests     | ⏳ TODAY        | —                | QA               |
| Step 5: Cloud Logs 24h  | ⏳ TODAY+1      | —                | DevOps           |
| Step 6: Sign-Off        | ⏳ AFTER STEP 5 | —                | All              |

**Go/No-Go Decision:** All 4 smoke tests must PASS + Cloud Logs must show 0 new ERRORs

---

## Critical Documents

**Executive:** [v1.3_DEPLOYMENT_EXECUTIVE_SUMMARY.md](v1.3_DEPLOYMENT_EXECUTIVE_SUMMARY.md) (1 page, all roles)

**Navigation Hub:** [v1.3_DEPLOYMENT_ARTIFACT_INDEX.md](v1.3_DEPLOYMENT_ARTIFACT_INDEX.md) (28+ docs indexed by role)

**Verification Checklist:** [POST_DEPLOY_CHECKLIST_v1.3.md](POST_DEPLOY_CHECKLIST_v1.3.md) (15 checks post-deploy)

**Testing Workflow:** [SMOKE_TESTS_EXECUTION_GATE.md](SMOKE_TESTS_EXECUTION_GATE.md) (4 scenarios, structured)

**Security Audit:** [SECURITY_SIGN_OFF_v1.3.md](SECURITY_SIGN_OFF_v1.3.md) (GREEN status)

**Compliance:** [COMPLIANCE_SUMMARY_v1.3.md](COMPLIANCE_SUMMARY_v1.3.md) (78.5% DICQ, audit-ready)

---

## Deployed Modules

**Live as of 2026-05-07:**

| Module                | Function                              | Status  |
| --------------------- | ------------------------------------- | ------- |
| **bioquimica**        | Quantitative QC (17 analitos)         | ✅ PROD |
| **liberacao**         | Release workflow + RT signature       | ✅ PROD |
| **reclamacoes**       | Complaint intake + RCA                | ✅ PROD |
| **criticos**          | Critical value framework              | ✅ PROD |
| **sgd**               | Document master list + Drive importer | ✅ PROD |
| **25+ other modules** | Phase 2 complete                      | ✅ PROD |

---

## Next 48 Hours (Critical Path)

**Today:**

1. Execute smoke tests (1 hour) — SMOKE_TESTS_EXECUTION_GATE.md
2. Monitor Cloud Logs (ongoing, 30 min setup) — CLOUD_LOGS_QUICK_REFERENCE.md
3. Verify Firestore indexes (5 min) — POST_DEPLOY_CHECKLIST_v1.3.md Step 4.1.2

**Today EOD:** 4. Stakeholder notification (status = GO/NO-GO) 5. Archive deployment artifacts

**Within 24h:** 6. Audit trail spot-check (5 logs) 7. Cloud Logs summary export (CSV)

**Within 72h:** 8. Production issue SLA (3 engineers on-call)

---

## If Something Goes Wrong

1. **Check Cloud Logs immediately:** [CLOUD_LOGS_QUICK_REFERENCE.md](CLOUD_LOGS_QUICK_REFERENCE.md)
2. **Consult error guide:** [CLOUD_LOGS_MONITORING_GUIDE.md](CLOUD_LOGS_MONITORING_GUIDE.md)
3. **Escalate to CTO** if security/compliance impact
4. **Rollback procedure** (1-click, 15–30 min)

---

## Support

**Full document index:** [v1.3_DEPLOYMENT_ARTIFACT_INDEX.md](v1.3_DEPLOYMENT_ARTIFACT_INDEX.md)

**Current status:** [../../.planning/STATE.md](../../.planning/STATE.md)

**Escalation:** See EXECUTIVE_SUMMARY.md (Key Contacts section)

---

**Last Updated:** 2026-05-07 14:00 UTC  
**Status:** 🟢 LIVE  
**Questions?** Pick your role above and go to your document.
