# Phase 2 Unblock — CTO Sign-off Checklist

**Current date**: 2026-05-03 · **Context available**: 31% remaining (pause after this session)

## ✅ DONE (Phase 1 closure)

| Item | Status | Evidence |
|------|--------|----------|
| Code Phase 1 (100% typed) | ✅ | 6 ADRs finalized, deployed to functions |
| Firestore rules compiled | ✅ | functions/lib/rules.json deployed |
| 41+ Cloud Functions | ✅ | All typed, tested, southamerica-east1 |
| Build (npm run build) | ✅ | Passes in 34.68s, Vite 6.4.2, source maps → Sentry |
| Docs + compliance mapping | ✅ | ADR-0004 Wave 2, ADR-0003, ADR-0007 |
| Git history (atomic) | ✅ | Rastreável desde 0a1f88e |

## 🔴 CRITICAL BLOCKERS (Phase 2 entry)

### 1. Backfill Scripts Execution
**Blocker**: Insumo-movimentacoes lack chain hashes (regulatory non-compliance).

**What needs**: CTO approval + test lab credentials

**Artifacts ready**:
- `functions/scripts/backfill-chainhash.mjs` — Chain hash backfill + validation
- `functions/scripts/backfill-hmac.mjs` — HMAC backfill per lab
- `functions/scripts/backfill-notaFiscal.mjs` — Invoice linking
- `functions/scripts/backfill-pop-reference.mjs` — POP module backref
- `functions/scripts/backfill-naoConformidade.mjs` — NC unification
- **`.claude/docs/BACKFILL_RUNBOOK.md`** — Step-by-step execution + rollback plan

**Decision needed from CTO**:
```
[ ] Approve execution in test lab (post-dry-run validation)?
[ ] Provide test lab labId + Firebase credentials (servicekey.json)?
[ ] Provide HCQ_SIGNATURE_HMAC_KEY for backfill-hmac?
```

---

### 2. E2E Smoke Tests (3 critical flows)
**Blocker**: No validation that Phase 1 integrations work end-to-end.

**What exists**:
- `smoke-test/` directory with Playwright infrastructure
- 3 partial specs (`f-im-02-lotes`, `f-im-03-disponibilizar`, `f-im-04-bancada`)

**What's missing**:
- [ ] Test 1: Create NF → receive → create lote → use in CIQ run → validate chain
- [ ] Test 2: Create NC crítica → investigate → propose action → verify effectiveness
- [ ] Test 3: Create equipamento → register calibration → gate blocks if expired

**Decision needed from CTO**:
```
[ ] Approve creating 3 new Playwright specs (est. 2h to write + first run)?
[ ] Provide test credentials (lab user, test data)?
```

---

### 3. CTO Sign-off (Go/No-Go for Phase 2)
**Blocker**: No explicit approval gate before Phase 2 kickoff.

**What to decide**:
```
Phase 1 is spec-complete + compliance-mapped (10/13 blocks are documented + justified).
All code is typed, tested, deployed to functions.
Build passes, hosting ready to update (after Phase 1 data backfilled).

DECISION: Ready to proceed Phase 2 Batch 1 (POPs, NC, Auditoria)?
  [ ] YES — proceed with Phase 2
  [ ] NO — blockers (specify below)
  [ ] CONDITIONAL — see notes
```

---

## 🟡 RECOMMENDED (before Phase 2, but not blocking)

### 4. Compliance Test in Lab
Run backfills in test lab, validate:
- [ ] No deleteDoc() calls in audit trail
- [ ] Chain hashes valid (recompute vs stored)
- [ ] Audit report generated for CTO signature

**Effort**: 1-2h execution + validation

---

### 5. Deploy Phase 1 to Hosting
Once backfills complete + CTO approves:
```bash
npx tsc --noEmit
npm run build          # ✅ Passes
firebase deploy --only hosting --project hmatologia2
```

Currently hosting is on Phase 0 code. Phase 1 (educacao-continuada, sgq modules) not in prod web yet.

---

## NEXT SESSION TASKS

If CTO approves both blockers:

| Task | Owner | Est. | Notes |
|------|-------|------|-------|
| **Run backfill dry-runs** | Eng | 1h | Inspect output, capture errors |
| **Apply backfills to test lab** | Eng | 1.5h | Step-by-step per runbook |
| **Write 3 E2E specs** | Eng | 2h | NF→run, NC→action, equip→calib |
| **Run smoke tests** | QA | 1h | Playwright on test lab |
| **Generate audit report** | Eng | 0.5h | Backfill validation + compliance |
| **CTO signature** | CTO | 15m | Sign-off on Phase 1 closure |
| **Deploy hosting** | Eng | 10m | hmatologia2.web.app updated |
| **Kickoff Phase 2 Batch 1** | CTO | — | Roadmap review + task creation |

**Total**: ~4-5 hours until Phase 2 entry.

---

## Reference Materials

- **Phase 1 ADRs**: `docs/adr/ADR-000{3,4,7}.md`
- **Compliance mapping**: Obsidian `01_Projetos/HC_Quality_Compliance_DICQ.md`
- **RDC 978 summary**: Obsidian `01_Projetos/HC_Quality_RDC_978_2025_Resumo.md`
- **Backfill execution**: `.claude/docs/BACKFILL_RUNBOOK.md`

---

**Status**: Awaiting CTO decisions on 3 items. Once approved, next session can execute to Phase 2 entry.
