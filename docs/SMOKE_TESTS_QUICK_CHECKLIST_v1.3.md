---
title: Quick Checklist — Smoke Tests v1.3
format: One-Page Test Execution Checklist
---

# Smoke Test v1.3 — Quick Checklist

**Test Duration:** ~45 min total | **Environment:** Production (hmatologia2.web.app)  
**Tester:** _________________ | **Date:** _________________ | **Time:** _________________

---

## Pre-Flight (5 min)

- [ ] Production URL loads: `https://hmatologia2.web.app`
- [ ] Logged in as RT on staging lab
- [ ] Browser DevTools open (Console + Network tabs)
- [ ] Cloud Logging tab open (filter: `severity>=ERROR`)
- [ ] Service Worker updated (DevTools → App → SW)
- [ ] Sample bula PDF ready (BioPlus or synthetic)
- [ ] Google Drive folder ready with 5 test docs

---

## Smoke 1: Bioquímica (10 min)

| Step | Action | Expected | Pass | Fail |
|------|--------|----------|------|------|
| 1 | `/bioquimica/admin` | 16 analitos visible | ☐ | ☐ |
| 2 | Upload bula PDF | Parse <30s, stats extracted | ☐ | ☐ |
| 3 | Create lot | Lot visible, status `EM USO` | ☐ | ☐ |
| 4 | Record run (3 analitos) | Run recorded, chainHash present | ☐ | ☐ |
| 5 | View Levey-Jennings chart | 1 point rendered, lines visible | ☐ | ☐ |
| 6 | Check Firestore events | Event doc exists, hash valid format | ☐ | ☐ |
| 7 | CLI verify chain | `npm run verify-chain` → exit 0 | ☐ | ☐ |

**Smoke 1 Status:** ☐ PASS ☐ FAIL | **Failed Step:** _________ | **Error:** _________________

---

## Smoke 2: SGD Drive Importer (15 min)

| Step | Action | Expected | Pass | Fail |
|------|--------|----------|------|------|
| 1 | Navigate `/sgq/importar-drive` | Page loads, OAuth button visible | ☐ | ☐ |
| 2 | Click "Conectar ao Drive" | Google consent screen appears | ☐ | ☐ |
| 3 | Authorize & callback | Redirect <5s, wizard Step 2 loads | ☐ | ☐ |
| 4 | Enter folder ID, list docs | 5 documents listed | ☐ | ☐ |
| 5 | Preview 3 documents | Preview modal renders, content visible | ☐ | ☐ |
| 6 | Select all 5, approve batch | 5 docs created in `rascunho` status | ☐ | ☐ |
| 7 | Publish all, search "MQ" | All 5 → `vigente`, search filters correctly | ☐ | ☐ |

**Smoke 2 Status:** ☐ PASS ☐ FAIL | **Failed Step:** _________ | **Error:** _________________

---

## Smoke 3 & 4: Optional (if time permits)

- [ ] **Smoke 3 (Reclamação)** — Public form → RT view → state transitions → NPS
- [ ] **Smoke 4 (Liberação)** — Laudo creation → signature gate → state machine

---

## Smoke 5: Regression Check (5 min)

| Module | Route | Load | No Errors | Pass |
|--------|-------|------|-----------|------|
| analyzer | `/analyzer` | ☐ | ☐ | ☐ |
| coagulacao | `/coagulacao` | ☐ | ☐ | ☐ |
| auditoria | `/auditoria` | ☐ | ☐ | ☐ |
| treinamentos | `/treinamentos` | ☐ | ☐ | ☐ |
| educacao-continuada | `/educacao-continuada` | ☐ | ☐ | ☐ |

**Smoke 5 Status:** ☐ PASS ☐ FAIL | **Failed Module:** _________

---

## Post-Deploy Validation

- [ ] Cloud Logging: No ERROR spike in first 5 min
- [ ] Network tab: No 5xx responses during smokes
- [ ] Console: No unhandled Promise rejections
- [ ] Performance: Page loads <2.5s, interactions <200ms

---

## Final Sign-Off

| Item | Status |
|------|--------|
| **All Smokes Passed?** | ☐ YES ☐ NO |
| **Regressions Found?** | ☐ None ☐ Minor (document) ☐ Critical (rollback) |
| **Ready for Next 24h Ops?** | ☐ YES ☐ ESCALATE |
| **Tester Sign:** _________________ | **Time:** _________________ |

---

## Failure Summary (if any)

**Smoke/Step:** _____________  
**Error Message:** _________________________________________________  
**Screenshots:** (link or file path)  
**Workaround Applied:** ☐ Yes | Note: __________________________  
**Escalation Level:** ☐ 🟡 Medium ☐ 🟠 High ☐ 🔴 Critical

---

**For detailed test steps & expected outcomes, see:** `docs/SMOKE_TESTS_v1.3.md`
