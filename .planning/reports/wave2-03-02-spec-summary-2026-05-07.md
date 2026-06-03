# Wave 2 / Plan 03-02 / v1.4 — Spec Summary

**Recon date:** 2026-05-07
**Phase folder:** `C:\hc quality\.planning\phases\03-schema-extensions\`
**Plan:** Task 03-02 — "Firestore Rules v1.4 Extensions" (Wave 2 of Phase 3 / `03-schema-extensions`)
**Owner of record:** Stream A — Rules Auditor (CTO)
**Marked complete on:** 2026-05-07 (same day as plan creation)

Source documents read in full:

- `.planning/phases/03-schema-extensions/03-PLAN.md` (parent phase plan)
- `.planning/phases/03-schema-extensions/03-02-PLAN.md` (the Wave 2 / 03-02 spec)
- `.planning/phases/03-schema-extensions/03-02-IMPLEMENTATION_CHECKLIST.md`
- `.planning/phases/03-schema-extensions/03-02-SESSION_REPORT.md`
- `.planning/phases/03-schema-extensions/WAVE2_FINDINGS.md` (pre-flight findings)
- `.planning/phases/03-schema-extensions/WAVE2_EXECUTIVE_SUMMARY.md`
- `.planning/phases/03-schema-extensions/PHASE3_E2E_TESTS_COMPLETE.md`
- `functions/test/phase-3-2/rules-v1-4.test.mjs` (the test file the plan refers to)

> Note: there is a parallel `.planning/milestones/v1.4-*` document set (REQUIREMENTS, ROADMAP, RDC-COVERAGE-MATRIX, etc.) that defines the broader v1.4 milestone. Wave 2 of `03-02` is the Phase 3 implementation slice that adds Firestore Rules tied to the v1.4 schema. Those milestone docs were not re-read in full for this report — they are programmatic, not the Wave-2 execution contract.

---

## What was planned

Per `03-02-PLAN.md` Section "Objective":

> "Add role-based rules for portal access, NOTIVISA outbox, critical escalations, IA strip dev, and laudo drafts. Verify security posture."

Five concrete rule blocks were planned, one per new schema collection introduced in 03-01:

1. **Portal Access** — patient + lab member read of `/labs/{labId}/portal-configuracao/{docId}`; admin/RT write with `updatedBy == request.auth.uid`. Plus a patient-scoped `read` on `/labs/{labId}/laudos/{laudoId}` gated by `paciente_id == request.auth.uid && publicado == true`.
2. **NOTIVISA Outbox** — admin/RT `create` (with payload validation), server `read+update` for polling/retry, member `read` for audit, on `/labs/{labId}/notivisa-outbox/events/{docId}`.
3. **Critical Escalations** — admin/RT `create`, member `read`, admin/RT `update` requiring `resolved_at != null`, on `/labs/{labId}/criticos-escalacoes/escalacoes/{docId}`.
4. **IA Strip Dev Collection** — server-or-admin only `read+write` on `/labs/{labId}/imuno-ias-dev/images/{docId}` (IA training dataset).
5. **Laudo Drafts** — admin/RT `create+write` gated by `validateDraftLock`, member `read`, patient `read`, on `/labs/{labId}/laudos-draft/rascunhos/{docId}`.

Plus two new helper functions: `validateNotivisaPayload(payload)` and `validateDraftLock(request)`.

---

## Rules changes planned

| Collection                                             | Change                                                                                                        | Reason                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `/labs/{labId}/portal-configuracao/{docId}`            | NEW match block — patient/member read; admin/RT write with `updatedBy` signature                              | Patient portal branding (Phase 4 portal feature)           |
| `/labs/{labId}/laudos/{laudoId}`                       | ADD allow-read clause for patient on own published laudo                                                      | Patient portal access to own published reports             |
| `/labs/{labId}/notivisa-outbox/events/{docId}`         | NEW match block — admin/RT create + payload validation; server read/update; member audit read; no delete      | RDC 978/2025 Art. 6º §1 NOTIVISA notification queue        |
| `/labs/{labId}/criticos-escalacoes/escalacoes/{docId}` | NEW match block — admin/RT create; member read (dashboard); admin/RT update requires `resolved_at`; no delete | ISO 15189 5.8.7 critical-value tracking                    |
| `/labs/{labId}/imuno-ias-dev/images/{docId}`           | NEW match block — server or admin only; no patient/member access                                              | Phase 9 IA strip classification training dataset isolation |
| `/labs/{labId}/laudos-draft/rascunhos/{docId}`         | NEW match block — admin/RT create/write with pessimistic lock; member + patient read; no delete               | RT laudo edit portal with concurrent-edit safety           |
| Helpers (top of file)                                  | ADD `validateNotivisaPayload(payload)` (4 fields, status enum)                                                | Enforce Art. 6º §1 payload structure server-side           |
| Helpers (top of file)                                  | ADD `validateDraftLock(request)` (`locked_until_ts > now \|\| locked_by == uid`)                              | Pessimistic lock for concurrent draft edits                |

Total addition stated in plan: ~185 lines across `firestore.rules` (5 match blocks ~150 lines + 2 helpers ~35 lines). Actual addition reported in the SESSION_REPORT was ~88 lines (helpers at lines 59–92, match blocks at lines 1935–1987) — line count differs because pre-flight findings (`WAVE2_FINDINGS.md`) discovered the helpers and match-block scaffolds **already existed** from Phase 3.1, so 03-02 became "refine + fix one line" rather than "add from scratch".

---

## Tests planned/required

The plan **explicitly required tests as a deliverable** (not pre-existing).

From `03-02-PLAN.md` "Testing" section (verbatim):

> **Existing test suite:** `npm run test:rules`
>
> - 18 existing role-based tests (should all still pass)
>
> **New tests to add:** 5 new test suites in `firestore.rules.test.ts`

Test files named in the spec: `firestore.rules.test.ts` (5 new `describe` blocks for Portal / NOTIVISA / Críticos / IA / Laudo Draft).

> **Target:** 23 total tests (18 existing + 5 new), all passing

The IMPLEMENTATION_CHECKLIST claims this was satisfied via a different file: `functions/test/phase-3-2/rules-v1-4.test.mjs` (294 lines, "23+ assertions").

**Reality check on the test file** (read directly, 2026-05-07): `functions/test/phase-3-2/rules-v1-4.test.mjs` is **not a real emulator-driven security-rules test**. It uses `node:test` to assert properties of a hand-authored JavaScript object literal (`rulesDefinition` array describing expected rule semantics in prose). It does not run against the Firebase rules emulator, does not load `firestore.rules`, and cannot detect a rules regression. The file's own banner says "Mock test cases — in real execution, use Firebase Emulator". The plan's `npm run test:rules` and `firestore.rules.test.ts` deliverable were not produced.

There is also a separate file `src/__tests__/e2e/phase3-rules.e2e.test.ts` (5 tests) referenced by `PHASE3_E2E_TESTS_COMPLETE.md`. Per that document, those 5 rules tests were "Ready" but not executed because they "depend on Phase 3 deploy" / Firebase Emulator. Only the 18 helper tests were reported as actually passing.

---

## Out of scope

Explicitly deferred in `03-02-IMPLEMENTATION_CHECKLIST.md` "Known Limitations & Defer Items":

- **Portal URL validation** — deferred to Phase 4 UI. Rules don't validate CDN URL format; treated as app responsibility.
- **NOTIVISA retry logic** — deferred to Phase 3.3 Callables. Rules permit server update; the polling/retry implementation is not part of 03-02.
- **Draft auto-lock cleanup** — deferred to Phase 4 cron. Rules don't enforce lock timeout; lifecycle is app-managed.
- **IA model versioning** — deferred to Phase 9. Rules permit server write; versioning logic is later.
- **Production deploy** — explicitly held until Phase 4+ ("Deploy to production — Task 03-05 or Phase 4"); Wave 2 only commits to staging deploy.
- **Linting** — declared N/A ("firestore.rules is declarative DSL, not TypeScript/JavaScript").

---

## Acceptance criteria

Verbatim from `03-02-PLAN.md` "Success Criteria":

> - ✅ All 5 rules blocks implemented + correct syntax
> - ✅ 23/23 tests passing
> - ✅ Security audit passed
> - ✅ Deploys to staging without errors
> - ✅ No regressions in existing rules functionality

Plus, verbatim from `03-02-PLAN.md` "Validation Checklist":

> - [ ] All 5 match blocks added to `firestore.rules`
> - [ ] All 2 helper functions added + correct syntax
> - [ ] 23/23 tests passing (18 existing + 5 new)
> - [ ] 0 linting errors (`npm run lint:firestore` if available)
> - [ ] Peer review by Stream D engineer (optional but recommended)
> - [ ] `firestore.rules` deploys to staging without errors

And from "Security Audit Checklist":

> - [ ] No overly permissive rules (e.g., `allow read, write: if true`)
> - [ ] Patient data isolation: patients can only read own laudos
> - [ ] Server-only collections properly restricted (IA, NOTIVISA polling)
> - [ ] Admin overrides justified and audited (e.g., NOTIVISA retry)
> - [ ] No path traversal vulnerabilities
> - [ ] No privilege escalation paths

---

## Execution status

- **Marked complete on:** 2026-05-07 (same calendar day the plan was created — see `03-02-IMPLEMENTATION_CHECKLIST.md` header "Status: IMPLEMENTATION COMPLETE / Completed: 2026-05-07" and `03-02-SESSION_REPORT.md` "Status: ✅ COMPLETE").

- **Outstanding items at completion time** (from the checklist itself, marked as deferred but still open):
  - "23/23 tests passing" — checklist marks this as **"READY FOR EXECUTION"**, not "PASS". Verbatim: _"Verification method: `npm test -- test/phase-3-2/rules-v1-4.test.mjs` (to be run in emulator environment)"_. The tests were not actually run as a gate.
  - "Deploys to staging without errors" — marked **"READY FOR DEPLOYMENT"**, not "PASS". Deploy command is documented but no deploy log is referenced.
  - QA Approval — explicitly listed as still required: _"QA Approval Needed: Before production deployment"_.
  - Production deploy — explicitly held for ≥24h staging validation.
  - 4 deferred items moved to later phases (portal URL validation, NOTIVISA retry, draft auto-lock cron, IA model versioning).

- **Tests passing at completion:**
  - **0 rules tests actually executed against the emulator.** The new file `functions/test/phase-3-2/rules-v1-4.test.mjs` is a structural assertion over a literal — it can pass without `firestore.rules` even existing. The plan's named deliverable (`firestore.rules.test.ts` + `npm run test:rules` going from 18 to 23 passing) was not produced.
  - 18 helper tests in `src/__tests__/e2e/phase3-helpers.e2e.test.ts` reported passing — these are _helper-module_ tests (notivisa formatter, SMS template, draft manager mock, IA validator), not rules tests.
  - 5 rules E2E tests in `src/__tests__/e2e/phase3-rules.e2e.test.ts` exist but `PHASE3_E2E_TESTS_COMPLETE.md` states they require emulator + deployed rules and were not run.

---

## Discrepancies (planned vs delivered)

1. **Test gate not satisfied as specified.** Plan required "23/23 tests passing" as a Success Criterion and named `firestore.rules.test.ts` + `npm run test:rules` as the deliverable. Delivered artifact (`functions/test/phase-3-2/rules-v1-4.test.mjs`) is a node:test assertion over a JS object literal describing expected semantics — it does not exercise the rules emulator and cannot fail if `firestore.rules` regresses. This is the most likely root of the 10 failing E2E rules tests the user is investigating: the gate was marked green without ever being executed against actual rules.

2. **Plan vs. reality of "additions".** Plan said 03-02 would _add_ 5 match blocks + 2 helpers (~185 lines). Pre-flight (`WAVE2_FINDINGS.md`) found that 03-01 already scaffolded all 5 match blocks and both helpers. Actual delta was a 1-line fix (IA strip: `isAdminOrRT` → `isAdmin`) plus a few comment/split edits — totaling ~88 lines per the SESSION_REPORT. The IMPLEMENTATION_CHECKLIST and SESSION_REPORT still report "5 blocks added" rather than "5 blocks refined", which obscures the real change footprint.

3. **Status semantics inflated.** Both Acceptance Criterion 2 ("23/23 tests passing") and Criterion 4 ("Deploys to staging without errors") are reported in the checklist as ✅ but the supporting cells say "READY FOR EXECUTION" / "READY FOR DEPLOYMENT". The check icon is a planning artifact, not evidence of execution. Treating these as PASS allowed the task to be archived as COMPLETE on the same day it was specified.

4. **No staging deploy log produced.** The plan's deployment sequence (Steps 1–4) and the "24h staging validation" gate before production are referenced but no deploy log, smoke-test output, or Cloud Logs sweep tied to 03-02 is in `.planning/reports/` (only post-deploy reports for 2026-05-07 _runtime_ exist, none scoped to firestore:rules of 03-02).

5. **Test file scope mismatch.** The plan said the new tests would live in `firestore.rules.test.ts` (TS, root-adjacent, runnable via `npm run test:rules`). Delivered file lives under `functions/test/phase-3-2/` as `.mjs`. Even at the structural level the file does not import `@firebase/rules-unit-testing` or any equivalent — so even if executed it would not validate rules behavior.

6. **"23+ assertions" is not "23 tests" in the original sense.** The checklist counts helper-function validation, "Security Posture cross-cutting" descriptions, "Multi-tenant Isolation" descriptions, "Backward Compatibility" descriptions, and a "Test Coverage Summary" toward the 23. The plan's intent (5 new test suites that exercise the 5 new match blocks + 18 pre-existing rules tests still passing) was not satisfied.

---

## Files referenced (absolute paths)

- `C:\hc quality\.planning\phases\03-schema-extensions\03-02-PLAN.md`
- `C:\hc quality\.planning\phases\03-schema-extensions\03-02-IMPLEMENTATION_CHECKLIST.md`
- `C:\hc quality\.planning\phases\03-schema-extensions\03-02-SESSION_REPORT.md`
- `C:\hc quality\.planning\phases\03-schema-extensions\03-PLAN.md`
- `C:\hc quality\.planning\phases\03-schema-extensions\WAVE2_FINDINGS.md`
- `C:\hc quality\.planning\phases\03-schema-extensions\WAVE2_EXECUTIVE_SUMMARY.md`
- `C:\hc quality\.planning\phases\03-schema-extensions\WAVE2_RULES_INSERTION_GUIDE.md` (line-by-line change map; not re-quoted)
- `C:\hc quality\.planning\phases\03-schema-extensions\PHASE3_E2E_TESTS_COMPLETE.md`
- `C:\hc quality\functions\test\phase-3-2\rules-v1-4.test.mjs` (the as-shipped test file — confirmed mock)
- `C:\hc quality\docs\RULES_v1.4_DIFF.md` (auditor change summary referenced by checklist; not re-read in this recon)
- `C:\hc quality\src\__tests__\e2e\phase3-rules.e2e.test.ts` (the 5 E2E rules tests referenced as "ready, not run")
- `C:\hc quality\src\__tests__\e2e\phase3-helpers.e2e.test.ts` (the 18 helper tests reported passing)
- Milestone-level v1.4 docs at `C:\hc quality\.planning\milestones\v1.4-*` — not the Wave-2 execution contract; not re-read here.
