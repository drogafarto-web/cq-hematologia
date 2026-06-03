---
milestone: v1.3
name: 'Deploy Roadmap'
status: draft
last_updated: 2026-05-06
target_window: 'TBD — gated by Phase 8.5 fixes'
---

# v1.3 Deploy Roadmap

End-to-end deploy plan for milestone v1.3. **CTO authorization required at each step.**

---

## 0. Current State

| Layer                  | Status                                                        |
| ---------------------- | ------------------------------------------------------------- |
| Web TypeScript         | ✅ Clean (`tsc --noEmit` 0 errors)                            |
| Web Build              | ✅ Succeeds (28.46s, 0 warnings)                              |
| Functions TypeScript   | ✅ Clean (`tsc --noEmit` 0 errors)                            |
| Functions Build        | ✅ Succeeds (compiles to `functions/lib/`)                    |
| Firestore Rules        | 🟡 Drafted per module — emulator smoke pending                |
| Firestore Indexes      | 🟡 ~25 new composite indexes — not yet deployed               |
| Tests (web)            | 🟡 42 unit (bioquimica) + scaffolds — full regression pending |
| Bundle Sizes           | ✅ All within budget                                          |
| Phase 8.5 Housekeeping | ✅ Complete (4 batches, 0 errors)                             |

**Deploy unblocked.** Pre-deploy checklist (Section 1) is the next gate.

---

## 1. Pre-Deploy Checklist

### 1.1 Code Quality Gates

- [x] `npx tsc --noEmit` (web root) — **0 errors** ✅ (verified 2026-05-06)
- [x] `cd functions && npx tsc --noEmit` — **0 errors** ✅ (verified 2026-05-06)
- [x] `cd functions && npm run build` — clean compilation ✅ (verified 2026-05-06)
- [ ] `npm run build` (web) — clean, 0 warnings
- [ ] `npm run lint` — baseline maintained (88 pre-existing warnings ok; new = block)
- [ ] No `console.log` / `console.warn` in v1.3 modules
- [ ] No `any` introduced without justification comment

### 1.2 Security Blockers (MUST resolve before deploy)

- [x] **B-01** Functions TSC errors fixed (Phase 8.5 Batch 1–4) ✅
- [x] **B-02** Firebase Functions v2 API migration complete ✅
- [x] **B-03** `functions/package.json` deps complete ✅
- [ ] **B-04** Phase 10 partial scope confirmed with auditor (PDF/portal deferred)

### 1.3 Tests

- [ ] `npm run test:unit` — all green (target: 800+ tests passing)
- [ ] `npm run test:rules` (Firestore emulator) — new rule blocks pass
- [ ] E2E smoke (manual on staging): bioquimica, sgq import, reclamacao intake
- [ ] No regression in existing module test suites
- [ ] Chain-hash verifier (`scripts/verify-chain.ts`) — 100% on bioquimica + sgq sample

### 1.4 Bundle Sizes (within budget)

- [ ] Main shell ≤ 400 KB gzip
- [ ] `module-bioquimica` ≤ 60 KB gzip
- [ ] `module-sgq` (extended) ≤ 80 KB gzip
- [ ] `module-reclamacoes` ≤ 80 KB gzip
- [ ] No new chunk > 50 KB without justification

### 1.5 Firestore Rules

- [ ] `firestore.rules` pre-deploy backup → `docs/audits/firestore.rules.v1.3-backup.txt`
- [ ] Diff reviewed: only **additive** rule blocks (bioquimica, liberacao, criticos, reclamacoes, satisfacao, sugestoes, sgq-extended, calibracao, personnel, management-review)
- [ ] Existing module rules unchanged (sanity check via `git diff firestore.rules`)
- [ ] Rules linted via Firebase CLI: `firebase deploy --only firestore:rules --dry-run`
- [ ] Emulator smoke: 5 read + 5 write attempts per new module → expected pass/deny

### 1.6 Firestore Indexes

- [ ] `firestore.indexes.json` reviewed — ~25 new composite indexes
- [ ] No duplicate indexes
- [ ] Indexes deploy timing: BEFORE functions (callables may query during cold start)

### 1.7 Cloud Functions

- [ ] All new callables deploy region = `southamerica-east1`
- [ ] Memory + timeout configured per function (default 256MB / 60s; PDF gen 1GB / 300s)
- [ ] Pub/Sub topics created (`exports`, `nps-recurring` if not exists)
- [ ] Cron schedules verified in code (no typos in cron strings)
- [ ] Environment variables set: `GEMINI_API_KEY`, `RESEND_API_KEY`, `DRIVE_OAUTH_CLIENT_ID`, `DRIVE_OAUTH_CLIENT_SECRET`

### 1.8 PWA Service Worker

- [ ] Vite build produces hashed assets → SW will pick up
- [ ] No manual SW version bump needed (auto via `registerType: 'autoUpdate'`)
- [ ] Test on staging: install PWA → trigger update → verify reload prompt

### 1.9 Hosting

- [ ] `dist/` size sanity check (no orphan large files)
- [ ] `firebase.json` rewrites correct (no new SPA routes broken)
- [ ] Environment vars (Vite `VITE_*`) reviewed

### 1.10 Authorization

- [ ] CTO sign-off on this checklist (commit hash + timestamp)
- [ ] Deploy window scheduled (recommended: Saturday 09:00 BRT, off-peak)
- [ ] Rollback plan reviewed (Section 4)
- [ ] On-call engineer identified for 24h post-deploy

---

## 2. Deployment Sequence

**Order matters.** Each step waits for the previous to complete and verify.

### Step 1: Firestore Rules + Indexes (≈3-5 min)

```bash
# Backup current rules
cp firestore.rules docs/audits/firestore.rules.v1.3-backup.txt

# Deploy rules + indexes together
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
```

**Verify:**

- Console → Firestore → Rules → Last published timestamp = now
- Console → Firestore → Indexes → New indexes status = `Building` (will go to `Ready` in 5–60 min)

**Wait** for indexes to reach `Ready` before Step 2 if any new callable queries them at cold start. Otherwise proceed.

### Step 2: Cloud Functions (≈10-15 min per module batch)

Deploy in module groups to limit blast radius. **Each batch must be smoke-tested before next.**

```bash
# Batch A — Bioquímica
firebase deploy --only "functions:parseBulaBioquimica,functions:recordRunBioquimica,functions:applyBulaToLot,functions:recordTraceabilityEvent,functions:generateMonthlyReport,functions:chainHashTrigger_bioquimica" --project hmatologia2

# Smoke: invoke parseBulaBioquimica with test PDF → expect Zod-validated response

# Batch B — SGQ extension
firebase deploy --only "functions:listarDocsDrive,functions:previewDocDrive,functions:aprovarBatchImport,functions:transitarVigencia" --project hmatologia2

# Batch C — Liberação + Críticos (partial — only Plans 01-03 callables)
firebase deploy --only "functions:liberarLaudo,functions:enviarComunicacaoEmail,functions:escalarCritico,functions:transitarLaudoState" --project hmatologia2

# Batch D — Feedback Loop
firebase deploy --only "functions:criarReclamacao,functions:transitarReclamacao,functions:classificarDocAuto,functions:dispararNPSPosResolucao,functions:dispararNPSRecurring,functions:submitNPSResposta,functions:anonimizarRespostas,functions:criarSugestao,functions:transitarSugestao,functions:upvoteSugestao" --project hmatologia2

# Batch E — Phase 8 micro-modules (foundations)
firebase deploy --only "functions:registrarCalibracao,functions:aprovarDesignacao,functions:submitManagementReview" --project hmatologia2
```

**Verify each batch:**

- Cloud Console → Functions → version + last deploy timestamp
- Cloud Logging tail: `gcloud functions logs read --region=southamerica-east1 --limit=20`
- No `Error` or `panic` in last 5 invocations

### Step 3: Hosting (≈2-3 min)

```bash
npm run build
firebase deploy --only hosting --project hmatologia2
```

**Verify:**

- Visit `https://hmatologia2.web.app` → hard reload (Cmd+Shift+R / Ctrl+F5)
- New routes load: `/bioquimica`, `/sgq/lista-mestra`, `/reclamacoes`, `/sugestoes`
- Service Worker version updated (DevTools → Application → Service Workers)

### Step 4: Post-Deploy Smoke Tests

See Section 3.

---

## 3. Smoke Test Scenarios (Post-Deploy)

Run on **production** with test data isolated to a staging-flagged lab account.

### Smoke 1 — Bioquímica End-to-End (≈10 min)

1. Login as RT
2. `/bioquimica/admin` → verify 16 seed analitos visible
3. Upload bula PDF (BioPlus) → expect Gemini parse response in <30s
4. Create lot from bula → status `EM USO`
5. Run new corrida (3 controles) → expect Westgard validation green
6. View Levey-Jennings chart → 1 point rendered
7. Check `/labs/{labId}/bioquimica-runs/{id}/events` → chainHash present

**Pass criteria:** All 7 steps complete without error. Run record visible. ChainHash verifies via CLI.

### Smoke 2 — SGD Drive Importer (≈15 min)

1. Login as RT
2. `/sgq/importar-drive` → OAuth flow → consent screen
3. Authorize → Drive folder list loads
4. Select 5 test docs → preview modal renders all
5. Approve batch → 5 docs created in `draft`
6. Approve each → status `vigente`
7. View `/sgq/lista-mestra` → 5 docs visible

**Pass criteria:** OAuth completes. Preview renders. Batch approval works. Documents searchable.

### Smoke 3 — Reclamação Multi-Channel (≈8 min)

1. Public form: submit reclamação anonymous → expect protocol returned
2. Login as RT → `/reclamacoes` → new reclamação visible
3. Open detail → Gemini classification populated
4. Transition `Nova → Analisando → Resolvida`
5. Verify NPS email triggered (check `/labs/{labId}/satisfacao-respostas/`)
6. Submit NPS via public link → verify response stored

**Pass criteria:** Public form works. Classification fired. State machine transitions. NPS triggered.

### Smoke 4 — Liberação State Machine (partial) (≈5 min)

1. Login as RT
2. Pick a bioquimica run aprovada → trigger laudo creation
3. State `Pendente → Em Revisão` → RT signature gate
4. Sign → state `Liberado`
5. Verify event in `/laudos/{id}/versions`
6. **Note:** PDF generation + portal médico are v1.4 (not testing here)

**Pass criteria:** State transitions work. Signature recorded. Event chain valid.

### Smoke 5 — Existing Module Regression (≈10 min)

Quick spot-check that v1.2 modules still work:

- [ ] `/analyzer` — open OCR flow → upload sample
- [ ] `/coagulacao` — view chart
- [ ] `/auditoria` — checklist loads
- [ ] `/treinamentos` — list view
- [ ] `/educacao-continuada` — colaboradores list

**Pass criteria:** No errors in browser console. All routes render. No 500s in network tab.

---

## 4. Rollback Procedures

### Rollback Trigger Criteria

Initiate rollback if any of:

- 🔴 Critical: data loss or chain-hash break detected
- 🔴 Critical: rules deny legitimate user reads/writes (lockout)
- 🔴 Critical: Cloud Function 5xx rate >5% in 10-min window
- 🟠 High: PWA not loading on >10% of clients
- 🟠 High: bundle bloat >50% over baseline

### Rollback Procedure (per layer)

**Hosting:**

```bash
# List recent releases
firebase hosting:channel:list --project hmatologia2

# Rollback to previous
firebase hosting:rollback --project hmatologia2
```

**Cloud Functions:**

- Cloud Console → Functions → select function → "Rollback to previous version"
- Or redeploy previous git tag: `git checkout v1.2.x && cd functions && firebase deploy --only functions:<name>`

**Firestore Rules:**

```bash
cp docs/audits/firestore.rules.v1.3-backup.txt firestore.rules
firebase deploy --only firestore:rules --project hmatologia2
```

**Firestore Indexes:**

- Indexes are additive. Removal is rare. If needed, manually delete in Console → Firestore → Indexes.

**Data:**

- v1.3 writes are append-only (events) or new collections.
- If a Cloud Function corrupts data: stop function (disable in Console) → restore from latest backup (`/labs/{labId}/_backups/<date>`) using DR runbook (`docs/runbooks/dr-restore.md`).

### Rollback Decision Matrix

| Symptom                    | Rollback Layer                              | ETA       |
| -------------------------- | ------------------------------------------- | --------- |
| Specific callable failing  | Functions only                              | 5 min     |
| Rules blocking valid users | Rules only                                  | 3 min     |
| UI bug critical            | Hosting only                                | 3 min     |
| Data corruption            | Data restore from backup                    | 30-60 min |
| Cascading failure          | Full rollback (rules + functions + hosting) | 15 min    |

---

## 5. Monitoring + Alerting (24h Post-Deploy)

### Real-Time Channels

- **Cloud Logging:** tail in another tab — filter `severity>=ERROR`
- **Firebase Console → Functions:** invocation count + error rate per function
- **Firebase Console → Firestore:** read/write ops + index build status
- **Sentry** (if configured): exception surge alerts
- **Browser DevTools** (test session): console errors on real device

### Key Metrics to Watch (first 24h)

| Metric                | Baseline     | Alert Threshold     |
| --------------------- | ------------ | ------------------- |
| Function 5xx rate     | <0.5%        | >2% (10-min window) |
| Function p95 latency  | <2s          | >5s sustained       |
| Firestore reads/s     | TBD baseline | >2× baseline        |
| Hosting 4xx rate      | <1%          | >5% sustained       |
| PWA install fail rate | <5%          | >15%                |

### Alerting Setup (verify before deploy)

- [ ] Firebase budget alert configured (caps surprise costs)
- [ ] Cloud Logging metric on `severity=ERROR` count → email
- [ ] Function timeout metric → alert if any function hits 90% of timeout

---

## 6. Post-Deploy Validation (Days 1-7)

### Day 1

- [ ] Smoke tests 1–5 (Section 3) all pass on production
- [ ] Cloud Logging review: no recurring errors
- [ ] First 50 user sessions: no support tickets > P2

### Day 2-3

- [ ] Riopomba lab onboarding: verify 80 SGD docs accessible
- [ ] First real bioquímica run from Riopomba: chainHash valid
- [ ] First reclamação intake: NPS triggered correctly

### Day 7

- [ ] Indexes all `Ready` (Console → Firestore → Indexes)
- [ ] Function cold-start metrics within budget
- [ ] No memory leak indicators (listener accumulation, billing creep)
- [ ] Auditor preview session scheduled (target Phase 8 sign-off)

### Day 14

- [ ] Phase 8.5 housekeeping fully closed (TSC + bug audit + spine cleanup)
- [ ] Phase 8 CAPA process closure plans (05–07) initiated
- [ ] CLAUDE.md root updated: 4 new modules in production table

---

## 7. Communication Plan

### Pre-Deploy (T-24h)

- Notify Riopomba RT (deploy window + expected downtime if any)
- Notify internal team (CTO + Eng + Ops)
- Confirm auditor not in active session

### Deploy Window

- CTO + on-call engineer in same channel (Slack/WhatsApp/Discord)
- Status updates every 15 min
- "Go/No-Go" decision after each step

### Post-Deploy (T+24h)

- Status report: deploy summary + smoke results + any issues
- Riopomba check-in: "everything working?"
- Update `STATE.md` to `phase-12-deployed`

---

## 8. Out of Scope (this deploy window)

These ship in **v1.4**, not v1.3 deploy:

- Phase 10 Plans 04–07 (PDF, QR, portal médico, full E2E)
- Phase 11 Plans 06–08 (portal paciente, trending dashboard, full E2E)
- Phase 8 Plans 05–07 (CAPA process closure ceremony)
- ICP-Brasil, SMS/Twilio, WhatsApp Business
- Order-entry / cadastro paciente (NC-011)
- Multi-tenant Opção A vs B decision

If any of these surface during smoke as "should ship", **stop and re-plan** — they're explicitly deferred.

---

## 9. Sign-Off

| Role                | Name       | Authorized | Date | Hash |
| ------------------- | ---------- | ---------- | ---- | ---- |
| CTO                 | drogafarto | ☐          | TBD  | TBD  |
| Eng A (deploy lead) | TBD        | ☐          | TBD  | —    |
| Auditor (informed)  | TBD        | ☐          | TBD  | —    |

---

**Deploy gate:** This document must be fully checked (Sections 1, 2, 3) before `firebase deploy` is invoked. Each unchecked item is a blocker.
