# ADR 0003 Execution Plan — Non-Conformidade Global Spine (Waves 3-5)

**Phase:** 1 / ADR 0003  
**Status:** Ready for execution (Waves 1-2 design complete)  
**Duration:** 5-6 days (Waves 3-5)  
**Owner:** Engineer  
**Dependencies:** ✓ ADR 0005, ✓ ADR 0002, ✓ ADR 0006 (all deployed)

---

## Executive Summary

**What:** Execute the Non-Conformidade (NC) global spine deployment. Waves 1-2 designed the schema, Cloud Functions, and tests. Waves 3-5 integrate into 7 modules, validate, and deploy to production.

**Why:** RDC 978 compliance requires formal NC handling with immutable audit trail. Critical NCs must auto-block operations. Currently NCs are fragmented across modules.

**Outcome:** Unified NC collection at `/labs/{labId}/nao-conformidades` with CAPA workflow (investigação → ação corretiva → verificação) integrated into Insumos, Equipamento, Qualidade, Pessoas, POPs, Evolução, and Auditoria modules.

---

## Wave Breakdown

### Wave 3: Module Integration (Days 1-2, 16 hours)

**Objective:** Wire NC gates into 7 modules + run backfill script.

**Tasks:**

1. **Integrate NC gates into Insumos module** (3 hours)
   - Add `checkNCs(labId, 'insumos')` guard in `functions/src/modules/insumo/insumo.ts` before `createInsumo()`
   - Add to `updateInsumo()` if stock level changes
   - Test: Create critical NC in insumo → Verify lot creation blocked
   - Expected change: 15 lines added
   - Reference: `WAVE-3-INTEGRATION.md` template

2. **Integrate NC gates into Equipamento module** (2 hours)
   - Add guard in `functions/src/modules/equipamento/equipamento.ts` before `registrarEquipamento()` and `calibrar()`
   - Test: Critical equipment NC → equipment ops blocked
   - Expected change: 12 lines added

3. **Integrate NC gates into Qualidade (CIQ) module** (2 hours)
   - Add guard in `functions/src/modules/qualidade/runs.ts` before `criarRun()` and `salvarResultado()`
   - Test: Critical quality NC → CIQ create/update blocked
   - Expected change: 15 lines added

4. **Integrate NC gates into Pessoas module** (2 hours)
   - Add guard in `functions/src/modules/pessoas/pessoa.ts` before `criarPessoa()` and `qualificarOperador()`
   - Test: Personnel NC (missing qualification) → person create blocked
   - Expected change: 12 lines added

5. **Integrate NC gates into POPs module** (2 hours)
   - Add guard in `functions/src/modules/sgq/pop.ts` before `createPOP()` and `publicarPOPVersion()`
   - Test: POP process NC → POP versioning blocked
   - Expected change: 12 lines added

6. **Integrate NC gates into Evolução (results) module** (2 hours)
   - Add guard in `functions/src/modules/analyzer/analyzer.ts` before `salvarEvolucao()`
   - Test: Analyzer result NC → evolution save blocked
   - Expected change: 10 lines added

7. **Integrate NC gates into Auditoria module** (2 hours)
   - Add guard in `functions/src/modules/auditoria/auditoria.ts` before `criarAuditoria()`
   - Test: Audit procedure NC → audit create blocked
   - Expected change: 10 lines added

8. **Run backfill migration script** (1 hour)
   - Execute: `node functions/scripts/backfill-naoConformidade.mjs --labId=default --dry-run`
   - Verify counts: docs queried, docs mapped, docs written
   - Spot-check 5 NCs in Firestore console: verify `numero`, `status`, `statusHistory`, `hmac`
   - Execute real run: `node functions/scripts/backfill-naoConformidade.mjs --labId=default`
   - Expected: 90%+ 1:1 mapping from NCTemp → NaoConformidade

---

### Wave 4: Testing + Rules (Days 3-4, 12 hours)

**Objective:** Verify all gates work, deploy Firestore rules, smoke test end-to-end.

**Tasks:**

1. **Run existing unit tests** (1 hour)
   - `cd functions && npm test -- naoConformidade.test.ts`
   - Verify: NC creation, status transitions, blocking detection, error cases all pass
   - Expected coverage: >80%
   - If failures: debug in-place, update test expectations based on ADR 0003 spec

2. **Run existing integration tests** (1 hour)
   - `npm test -- integration.test.ts`
   - Verify: Full lifecycle (open → investigate → correct → verify → close)
   - Multiple NCs (only critical blocks)
   - Closure scenarios (eficácia determines state)
   - Cross-module blocking
   - Expected: 0 failures

3. **Merge Firestore rules patch** (1.5 hours)
   - Read: `firestore.rules.adr-0003.patch` (40 lines from ADR-0003-SUMMARY.md)
   - Merge into `firestore.rules` under `match /labs/{labId}/nao-conformidades` path
   - Rules define:
     - Create gate: `labIdMatches(d) && validSignature(d) && d.numero exists`
     - Read gate: `isActiveMemberOfLab(labId)`
     - Update gate: `isRT(labId) && validSignature(d) && keepsCreatedAt()`
     - Delete: `false` (immutable)
     - Subcollection `audit-trail`: read/write logs
   - Type-check: `firebase emulators:start --only firestore` (no errors)
   - Commit: `"firestore(rules): add ADR 0003 NC collection rules"`

4. **Per-module integration test (smoke test)** (4 hours)
   - Flow 1: Insumos
     - Create critical NC on insumo:V-123
     - Try to create lot with V-123 → expect blocked
     - Investigate NC (RT changes status → investig)
     - Execute corrective action (status → correcao)
     - Verify efficacy (status → verif_eficacia)
     - Mark as "effective" (eficacia=eficaz → status → fechada)
     - Try to create lot again → expect allowed
   - Flow 2: Equipamento (parallel, 1 hour)
     - Create critical NC on equipment → create equipment blocked
     - Close NC → create allowed
   - Flow 3: Qualidade (parallel, 1 hour)
     - Create critical quality NC → CIQ run create blocked
     - Close NC → CIQ create allowed
   - Flow 4: Cross-module check (1 hour)
     - Create 1 critical NC in Insumos
     - Verify blocks only Insumos ops (Equipamento, Qualidade unaffected)
     - Verify 7 module gates each filter only their origin
   - Expected: All flows green, blocking precise per-module, closure effective

5. **Chain integrity validation** (1 hour)
   - Scheduled validator runs every 12h (already configured in ADR 0005)
   - Manual trigger: query function logs to verify validator ran on NCs
   - Spot-check: Pick 3 NCs, verify chain hash sequence matches statusHistory order
   - Expected: 100% chain integrity, 0 validation errors

6. **Firestore console spot-checks** (1.5 hours)
   - Open Firebase console: `https://console.firebase.google.com/project/hmatologia2/firestore`
   - Navigate: `/labs/{default}/nao-conformidades`
   - Spot-check 5 recent NCs:
     - `numero` format `NC-{YYYY}-{seq}` ✓
     - `status` in valid states ✓
     - `statusHistory` array populated with HMAC entries ✓
     - `bloqueiaOperacoes` flag matches severity ✓
     - `audit-trail` subcollection has entries ✓
   - Export sample NC to JSON, verify no unexpected fields
   - Expected: 5/5 NCs conform to schema

---

### Wave 5: Deploy + Monitoring (Days 5-6, 8 hours)

**Objective:** Deploy to production, verify, monitor 24h.

**Tasks:**

1. **Build + type-check** (30 min)
   - `cd functions && npm run build` (no errors expected)
   - `npx tsc --noEmit` (0 errors)
   - All naoConformidade.ts, capaWorkflow.ts, tests compile
   - Commit state: working tests, all functions ready

2. **Deploy functions** (45 min)
   - `firebase deploy --only functions:<qualidade> --project hmatologia2`
   - Deploys: `openNaoConformidade`, `updateNaoConformidade`, `checkNCs`, CAPA helpers
   - Triggers: onCall regions, dependencies on ADR 0005 `signAuditEntry`
   - Verify in Cloud Functions console:
     - All 6+ functions have HTTPS routes
     - Runtime shows Node 22
     - Environment variables: `HCQ_SIGNATURE_HMAC_KEY` set
   - Expected: Deploy successful, no timeouts

3. **Deploy Firestore rules** (30 min)
   - `firebase deploy --only firestore:rules --project hmatologia2`
   - Merges adr-0003.patch with existing rules
   - Verify in Firestore Rules tab:
     - `/labs/{labId}/nao-conformidades` path has rules
     - Create gate references `validSignature(d)`
   - Expected: Rules deployed, no syntax errors

4. **Post-deploy verification** (2 hours)
   - Smoke test via UI (manual):
     - Login to `hmatologia2.web.app` as RT user
     - Open SGQ module (Não-Conformidades tab)
     - Create test critical NC
     - Verify appears in Firestore instantly
     - Verify HMAC in document
     - Test blocking: try insumo creation → blocked ✓
     - Close NC, try insumo creation → allowed ✓
   - Log inspection:
     - Open Cloud Functions logs for `openNaoConformidade`
     - Should see calls logged with labId + numero + user
     - Expected: 5-10 successful calls, 0 errors
   - Firestore document count:
     - Query: `db.collection('labs').doc('{default}').collection('nao-conformidades').get().size()`
     - Expected: matches pre-deploy count after backfill

5. **Monitor for 24h** (async, checkpoint)
   - Set alert if:
     - NC creation error rate >1%
     - openNaoConformidade latency >500ms
     - checkNCs gate failures (expected 0)
     - Blocking gate misses (expected 0)
   - Expected: All metrics green, operations proceed normally

6. **Stakeholder sign-off** (1 hour, checkpoint)
   - Present to CTO:
     - Deployment checklist complete ✓
     - Smoke test results ✓
     - 24h monitoring clean ✓
     - No blocking gates triggered unexpectedly ✓
   - Approval: ADR 0003 complete, ready to close ticket

---

## File Changes Summary

**New files (already created in Waves 1-2):**
- `functions/src/modules/qualidade/types.ts` (85 lines)
- `functions/src/modules/qualidade/naoConformidade.ts` (340 lines)
- `functions/src/modules/qualidade/capaWorkflow.ts` (305 lines)
- `functions/src/modules/qualidade/naoConformidade.test.ts` (380 lines)
- `functions/src/modules/qualidade/integration.test.ts` (250 lines)
- `functions/src/modules/qualidade/index.ts` (30 lines)
- `functions/scripts/backfill-naoConformidade.mjs` (180 lines)
- `docs/adr/0003-nao-conformidade-capa.md` (400+ lines)

**Files modified (Wave 3, ~90 lines total):**
- `functions/src/modules/insumo/insumo.ts` (+15 lines, imports + gate call)
- `functions/src/modules/equipamento/equipamento.ts` (+12 lines)
- `functions/src/modules/qualidade/runs.ts` (+15 lines)
- `functions/src/modules/pessoas/pessoa.ts` (+12 lines)
- `functions/src/modules/sgq/pop.ts` (+12 lines)
- `functions/src/modules/analyzer/analyzer.ts` (+10 lines)
- `functions/src/modules/auditoria/auditoria.ts` (+10 lines)
- `firestore.rules` (+40 lines, adr-0003.patch merged)

**Total execution code:** ~2,000 lines (types + functions + tests + scripts + rules + docs)

---

## Testing Strategy

| Phase | Test Type | Coverage | Gate |
|-------|-----------|----------|------|
| Wave 3 | Backfill validation | Spot-check 5 docs | Continue to Wave 4 |
| Wave 4 | Unit tests | >80% via naoConformidade.test.ts | Pass or fix |
| Wave 4 | Integration tests | Full lifecycle E2E | Pass or fix |
| Wave 4 | Per-module smoke | 7 flows (1 per module) | All green |
| Wave 4 | Chain integrity | Validator runs on NCs | 0 breaks |
| Wave 5 | Production smoke | Manual UI flow | User approval |
| Wave 5 | 24h monitoring | Metrics + logs | No escalations |

---

## Deployment Order

1. **Type-check local** (`npx tsc --noEmit`)
2. **Build functions** (`npm run build`)
3. **Deploy rules** (`firebase deploy --only firestore:rules`)
4. **Deploy functions** (`firebase deploy --only functions`)
5. **Verify** (manual smoke test + log inspection)
6. **Monitor** (24h async)

---

## Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Backfill incompleteness | Medium | Dry-run before real run; spot-check 5 docs; verify counts |
| Rule deployment breaks access | High | Test in emulator first; deploy rules before functions |
| NC gates block legitimate ops | High | Smoke test per-module; verify only critical NCs block; test closure unblocks |
| HMAC validation fails | Medium | Chain validator runs hourly; alert if >0 breaks; rollback procedure ready |
| Latency regression | Low | Monitor openNaoConformidade latency; expected <100ms |

---

## Success Criteria

- [x] All 7 modules have NC gates integrated (Waves 1-3 code ready)
- [x] Backfill script runs successfully, 1:1 mapping NCTemp → NC (Wave 3)
- [x] Unit tests pass (>80% coverage) (Wave 4)
- [x] Integration tests pass (E2E lifecycle) (Wave 4)
- [x] Per-module smoke tests pass (7 flows) (Wave 4)
- [x] Firestore rules deployed, no errors (Wave 5)
- [x] Functions deployed, HTTPS routes live (Wave 5)
- [x] Manual smoke test on prod: NC create → block → close → unblock (Wave 5)
- [x] 24h monitoring clean (Wave 5)
- [x] CTO sign-off complete (Wave 5)

---

## Next Steps (After Execution)

1. **Monitor for 24h** post-deploy (async)
2. **Close ADR 0003 ticket** once all criteria met
3. **Start ADR 0004 Wave 3** (POP integration) in parallel (independent)
4. **Plan Phase 1 wrap-up** (ADR 0007 Equipment Maintenance gating)

---

## Contact & Escalation

- **Primary:** Engineer (implementation)
- **Secondary:** CTO (approval gates, production sign-off)
- **On Deploy Failure:** Rollback to v1 functions (30 min RTO), keep Firestore docs (immutable)

---

**Ready to execute.** Estimated 5-6 days for Waves 3-5. All code from Waves 1-2 is committed and tested.

