---
phase: 3
title: 'Schema Extensions & Cross-Cutting Prep'
period: '2026-05-07 → 2026-05-14 (1 week)'
owner: 'Stream A + Stream D'
objective: 'Deploy all Firestore schema changes, rules extensions, shared utilities for Phases 4–12'
status: in-progress
target_date: 2026-05-14
last_updated: 2026-05-07
---

# Phase 3 PLAN — Schema Extensions & Cross-Cutting Prep

**Strategic objective:** Establish the foundational schema, rules, helpers, and Cloud Functions base for all downstream phases (Portals, NOTIVISA, IA strip prep, CAPA closure).

**Duration:** 1 week (5 business days: 2026-05-08 → 2026-05-14)  
**Teams:** Stream A (Rules audit, CTO) + Stream D (DevOps, DB eng)  
**Success Gate:** All TypeScript ✓, Rules audit ✓, staging deploy ✓

---

## REQ Mapping → Tasks

| REQ     | Task  | Description                                            | Owner   | Duration |
| ------- | ----- | ------------------------------------------------------ | ------- | -------- |
| REQ-3.1 | 03-01 | Firestore Schema v1.4 (5 collections + indexes)        | Agent 1 | 2 days   |
| REQ-3.2 | 03-02 | Firestore Rules v1.4 (portal + notivisa gates)         | Agent 2 | 1.5 days |
| REQ-3.3 | 03-03 | Shared Helpers (4 modules: notivisa, SMS, laudo, IA)   | Agent 3 | 1.5 days |
| REQ-3.4 | 03-04 | Cloud Functions base structure (module skeletons)      | Agent 4 | 1 day    |
| REQ-3.5 | 03-04 | Test infrastructure (portal + IA + notivisa callables) | Agent 4 | 1.5 days |

**Total effort:** ~7 agent-days across 5 days → 40% parallel efficiency

---

## Task Breakdown (4 Agents, Single Shot)

### **Task 03-01: Firestore Schema v1.4 Extensions** (Agent 1)

**Owner:** Stream D (DB engineer)  
**Duration:** 2 days  
**Status:** Ready to start

**Deliverables:**

1. **portal-configuracao/{labId}/** — Patient portal branding (colors, logo, terms)
   - Fields: `logoCdnUrl`, `primaryColor`, `secondaryColor`, `labelLaudo`, `labelPaciente`, `termsHTML`, `privacyHTML`, `updatedAt`
   - Indexes: `labId` (already exists), no new indexes needed
2. **notivisa-outbox/{labId}/events/{docId}** — NOTIVISA queue
   - Fields: `laudo_id`, `patient_cpf`, `payload` (Art. 6º §1 format), `status` (PENDING|SENT|FAILED), `attempts`, `nextRetry`, `createdAt`
   - Indexes: `labId`, `status`, `createdAt` (for polling)
3. **criticos-escalacoes/{labId}/escalacoes/{docId}** — Critical value log
   - Fields: `resultado_id`, `threshold_config_id`, `sms_sent_to`, `email_sent_to`, `sla_minutes`, `resolve_ts`, `createdAt`
   - Indexes: `labId`, `createdAt`, `resolve_ts`
4. **imuno-ias-dev/{labId}/images/{docId}** — Strip image + metadata for OCR training
   - Fields: `imageUrl`, `imageDim` (width×height), `classesDetected` (multiselect enum: IgG|IgM|IgA|etc), `confidence`, `model_version`, `feedback` (human label), `createdAt`
   - Indexes: `labId`, `model_version`, `createdAt`
5. **laudos-draft/{labId}/rascunhos/{docId}** — Laudo edit state (RT portal)
   - Fields: `laudo_id`, `edited_by` (uid), `content_json`, `locked_until_ts`, `version`, `updatedAt`
   - Indexes: `labId`, `laudo_id`, `locked_until_ts`

**Firestore indexes to create:**

- `notivisa-outbox`: `(labId, status, createdAt)` composite
- `criticos-escalacoes`: `(labId, createdAt)` composite
- `imuno-ias-dev`: `(labId, model_version, createdAt)` composite

**Artifacts:**

- `SCHEMA_v1.4.md` (full schema snapshot, comments for each collection)
- Firebase Console index creation script (or manual verification checklist)

**Verification:**

```bash
npm run firestore:schema-validate
# Should pass all 5 collections, all indexes
```

**Dependency:** None (can start immediately)  
**Blocks:** Task 03-02 (rules reference these collections)

---

### **Task 03-02: Firestore Rules v1.4** (Agent 2)

**Owner:** Stream A (Rules auditor, CTO)  
**Duration:** 1.5 days  
**Status:** Ready after 03-01

**Deliverables:**

1. **Portal access rules** — Patients read `portal-configuracao` + `laudos` (published only), write nothing
   - Match: `/labs/{labId}/portal-configuracao/{configDoc}`
   - Allow: `read if isPatient(labId) && isOwnLaudo(laudo_id)`
   - Match: `/labs/{labId}/laudos/{laudo_id}`
   - Allow: `read if isPatient(labId) && resource.data.paciente_id == request.auth.uid && resource.data.publicado == true`

2. **NOTIVISA outbox rules** — RT/admin write only, server read
   - Match: `/labs/{labId}/notivisa-outbox/events/{docId}`
   - Allow: `create if isAdmin(labId) && validateNotivisaPayload(request.resource.data)`
   - Allow: `read, update if request.auth.token.isServer == true`

3. **Críticos escalacoes rules** — RT/admin write, read for escalation tracking
   - Match: `/labs/{labId}/criticos-escalacoes/{docId}`
   - Allow: `create, update if isAdminOrRT(labId)`
   - Allow: `read if isMemberOfLab(labId)`

4. **IA strip dev collection rules** — Eng write, no external read
   - Match: `/labs/{labId}/imuno-ias-dev/{docId}`
   - Allow: `read, write if request.auth.token.isServer == true || isAdmin(labId)`

5. **Laudo draft rules** — RT write/lock, patient/admin read
   - Match: `/labs/{labId}/laudos-draft/{docId}`
   - Allow: `write if isAdminOrRT(labId) && validateDraftLock(request)`
   - Allow: `read if isMemberOfLab(labId) || isPatient(labId)`

**Firestore Rules diff:**

- Add 5 new match blocks (~150 lines)
- Add helper function `validateNotivisaPayload()` (~20 lines)
- Add helper function `validateDraftLock()` (~15 lines)

**Artifacts:**

- `firestore.rules` (updated full file)
- `docs/RULES_v1.4_DIFF.md` (change summary, auditor-ready)

**Verification:**

```bash
npm run test:rules
# Should pass all 18 role-based rules tests + new 5 portal tests
```

**Dependency:** 03-01 (schema must exist first)  
**Blocks:** None (but recommended before staging deploy)

---

### **Task 03-03: Shared Helpers & Utilities** (Agent 3)

**Owner:** Stream D (Backend eng)  
**Duration:** 1.5 days  
**Status:** Ready to start (independent)

**Deliverables:**

1. **`src/shared/notivisa.ts`** (100 lines)

   ```typescript
   export const notivisaFormatter = (laudo: Laudo): NotivisaPayload
   // Art. 6º §1 format: estrutura obrigatória + Art. 17 assinatura format
   ```

2. **`src/shared/sms.ts`** (80 lines)

   ```typescript
   export const smsTemplate = (critico: Critico, lab: Lab): string
   // "Resultado crítico para {paciente}: {analito} = {valor} ({ref})..."
   ```

3. **`src/shared/laudo.ts`** (120 lines)

   ```typescript
   export const laudoDraftManager = new DraftStateMachine();
   // Transactional lock: create draft → RT edits → publish → archive
   ```

4. **`src/shared/ia.ts`** (150 lines, Zod schema)
   ```typescript
   export const iaStripValidator = z.object({
     imageUrl: z.string().url(),
     imageDim: z.object({ width: z.number(), height: z.number() }),
     classesDetected: z.array(z.enum([IgG, IgM, IgA, ...])),
     confidence: z.number().min(0).max(1),
   })
   ```

**Artifacts:**

- 4 new `.ts` files in `src/shared/`
- `src/shared/__tests__/` with unit tests (≥80% coverage)

**Verification:**

```bash
npm run test -- src/shared
npm run typecheck
# 0 TS errors, ≥80% coverage on all 4 modules
```

**Dependency:** None (independent)  
**Blocks:** 03-04 (functions use these helpers)

---

### **Task 03-04: Cloud Functions Base Structure + Tests** (Agent 4)

**Owner:** Stream A (DevOps, CTO)  
**Duration:** 2.5 days  
**Status:** Ready after 03-01 + 03-03

**Deliverables:**

1. **Module skeletons** — Create base callable structure for Phases 4–12
   - `functions/src/modules/notivisa/` — placeholder for Phase 4
   - `functions/src/modules/portals/` — placeholder for Phase 5–6
   - `functions/src/modules/criticos/` — placeholder for Phase 7
   - `functions/src/modules/ia-strip/` — placeholder for Phase 9

2. **Test infrastructure** — Jest + fixtures for new callables
   - `functions/src/__tests__/fixtures/notivisa-payloads.ts`
   - `functions/src/__tests__/fixtures/portal-users.ts`
   - `functions/src/__tests__/fixtures/critico-thresholds.ts`

3. **Callable gates** (boilerplate, no business logic yet)
   - `notivisaQueue.ts` — return "PLACEHOLDER" for now
   - `portalConfigurationGet.ts` — return mock config
   - `criticalValueEscalation.ts` — return mock SMS log
   - `iaStripUpload.ts` — return mock classification

**Artifacts:**

- `functions/src/modules/*/index.ts` (4 directories, 20 lines each)
- `functions/src/__tests__/integration/` (3 test suites, 50 lines each)
- `functions/package.json` (verify all dependencies present)

**Verification:**

```bash
cd functions && npm run test
cd functions && npm run typecheck
cd functions && npm run build
# 0 TS errors, all tests pass, build succeeds
```

**Dependency:** 03-01 (schema refs) + 03-03 (helpers)  
**Blocks:** Phases 4–12 implementation

---

## Dependencies & Sequencing

```
03-01 (Schema)      03-03 (Helpers)
  ↓                    ↓
03-02 (Rules)       03-04 (Functions) ← both depend on 03-01 & 03-03
  ↓                    ↓
  └────────┬───────────┘
           ↓
      Staging Deploy (03-05)
```

**Parallel opportunities:**

- 03-01 and 03-03 can run in parallel (no dependencies)
- 03-02 waits for 03-01 only
- 03-04 waits for 03-01 + 03-03

**Critical path:** 03-01 (2d) → 03-02 (1.5d) → Staging (0.5d) = **4 days**

---

## Success Criteria

| Criterion                            | Verification                                              | Owner   |
| ------------------------------------ | --------------------------------------------------------- | ------- |
| All 5 collections exist in Firestore | Console or `npm run firestore:schema-validate`            | Agent 1 |
| All indexes created                  | Firestore Console (check build status)                    | Agent 1 |
| 0 TypeScript errors                  | `npm run typecheck` in both src/ and functions/           | All     |
| Rules audit passing                  | `npm run test:rules` (18 existing + 5 new tests)          | Agent 2 |
| Helper unit tests ≥80% coverage      | `npm run test -- src/shared`                              | Agent 3 |
| Functions build successful           | `cd functions && npm run build`                           | Agent 4 |
| Staging deployment successful        | `firebase deploy --only functions,firestore --to staging` | DevOps  |
| 0 P0 Firestore errors in Cloud Logs  | Dashboard check after 1h staging deploy                   | DevOps  |

---

## Risk Mitigation

| Risk                                       | Likelihood | Impact            | Mitigation                                    |
| ------------------------------------------ | ---------- | ----------------- | --------------------------------------------- |
| Index build timeout (>30min)               | Low        | Phase blocked 30m | Create indexes 3 days before, monitor build   |
| Rules complexity introduces security gap   | Medium     | Audit blocker     | Rules audit (Agent 2) + peer review by CTO    |
| Helper API too broad, leaks sensitive data | Low        | Security finding  | Zod schemas + unit tests validate constraints |
| Functions build fails due to missing deps  | Low        | Blocking          | npm install before 03-04 starts               |

---

## Rollback Plan

**If any task fails:**

1. **Schema (03-01):** Revert collections in Firestore Console, re-index from baseline
2. **Rules (03-02):** `git checkout firestore.rules`, redeploy baseline rules
3. **Helpers (03-03):** `git checkout src/shared`, re-run tests on baseline
4. **Functions (03-04):** `git checkout functions/src/modules`, rebuild

**Full rollback:** `firebase deploy --only functions,firestore --project hmatologia2 --revision [baseline-commit]`

---

## Handoff to Phase 4

Upon Phase 3 completion:

- SCHEMA_v1.4.md circulated to all teams
- Shared helpers imported in all Phase 4 tasks
- Cloud Functions skeletons provide the scaffold for NOTIVISA, Portal, Críticos
- Staging deployment stabilized (0 P0 errors in logs)

---

**Created:** 2026-05-07  
**Status:** Ready for execution  
**Next Step:** `gsd-execute-phase 3` (run all 4 agents in parallel)
