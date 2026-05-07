# Phase 12 Plans 04–06 — Execution Ready

**Status**: ✅ READY TO EXECUTE  
**Prerequisite**: Plans 01–03 complete (deployed to staging/production)  
**Timeline**: Estimated 7 days (3+4+5 working days per plan)  
**Owner**: CTO (authorization) + RT Bruno Riopomba (validation)

---

## Plan 12-04: Riopomba Pilot (Staging) — 30 docs

### Pre-flight Checklist

```
[ ] Staging Firebase project verified (same as Phases 9/10/11)
[ ] Google Cloud OAuth credentials created + configured
[ ] LM-01 Google Sheets ID obtained (Riopomba's official master list)
[ ] RT Bruno scheduled for 8h Day 1 + 4h Day 2
[ ] Stage 1: Deploy code to staging
  [ ] firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2-staging
  [ ] firebase deploy --only functions --project hmatologia2-staging
  [ ] firebase deploy --only hosting --project hmatologia2-staging
[ ] Stage 2: RT walkthrough
  [ ] User logs in as RT
  [ ] Click "Importar documentos do Drive"
  [ ] Authorize Drive (OAuth flow)
```

### Pilot Scope (30 docs)

**Critical path docs** (validated subset before production):

1. **MQ-001** (Manual da Qualidade) — 1 doc
2. **PQ-01 to PQ-25** (Procedimentos da Qualidade) — 25 docs
3. **IT principais** (Instruções de Trabalho) — 3 docs (IT-001, IT-005, IT-012)
4. **FR-027** (Formulário) — 1 doc

**Expected outcomes**:
- All 30 docs import to staging with status `draft`
- Classification accuracy ≥85% (confidence ≥0.9)
- LD (lista de distribuição) suggests match Riopomba sectors
- Hierarquia: tree shows MQ→PQ→IT connections
- Zero duplicates on re-run

### Validation Workflow

1. **RT inspects imported docs**:
   - Open `/sgq/lista-mestra` in staging
   - Filter by `em_revisao` status
   - Verify 30 docs present with correct códigos + titles

2. **Sample 5 docs for format check**:
   - Click each → view classification + preview
   - Verify tipo, título, setoresLD match LM-01

3. **Anomalies logged**:
   - Create PILOT-IMPORT-LOG.md entry per issue
   - If blocking: document fix before Plan 12-05
   - If minor: proceed with note

4. **Sign-off**:
   - RT approves via email: "Staging pilot OK"
   - CTO documents decision: "Approve production migration"

### Output Artifacts

**File**: `.planning/phases/12-sgd-drive-importer/PILOT-IMPORT-LOG.md`

```markdown
# Pilot Import Log (Staging)

**Date**: 2026-05-XX
**Docs imported**: 30 (MQ-001 + PQ-01..25 + IT main + FR-027)
**Status**: All `em_revisao` (draft)
**Zero duplicates on re-run**: ✓

## Classification Accuracy

- Total: 30
- Confidence ≥0.9: 28 (93%)
- Confidence 0.7–0.9: 2 (7%)
- Average confidence: 0.91

## Anomalies

1. **IT-005 — ambiguous classification** (ITA vs IT generic)
   - Solution: Adjust preview heuristic in Plan 12-06
   - Severity: Low (fixable before production)

2. **FR-027 — no preview** (PDF too large >10MB)
   - Solution: Use Drive URL as preview fallback
   - Severity: Info (acceptable, user sees link)

## Setores LD Coverage

- Samples: 3 docs checked manually
- Setores match LM-01 distribution: 100%
- Sample: PQ-15 distributed to [HEMATOLOGIA, IMUNOLOGIA, COLETA] ✓

## Sign-off

**RT Bruno**: "Pilot completo. Nenhum blocker. Pronto para produção." ✓
**CTO**: "Approve Plan 12-05 production migration." ✓

**Date signed**: 2026-05-XX
```

---

## Plan 12-05: Production Migration (~80 docs)

### Pre-flight Checklist

```
[ ] Plan 12-04 sign-off obtained
[ ] Production Firestore backup taken (automatic via PITR or manual)
[ ] Riopomba lab notified: "Drive will become read-only after go-live"
[ ] RT Bruno scheduled for 8h Day 1 (import) + 4h Day 2 (approval batch)
[ ] Production deploy verified
[ ] Rollback plan documented (not executed, validated only)
```

### Migration Scope (~80 docs)

**All Riopomba documents** from official LM-01:
- 1 MQ
- 25 PQ (all)
- 30+ IT (all analyzed types)
- 20+ FR (forms)
- 5 DC (descriptions)
- + EXT, POL, INF (external + policies + newsletters)

**Expected outcomes**:
- All 80 docs import to production with status `draft`
- Zero duplicates on re-run (idempotency verified)
- chainHash sequential validation OK
- Tree hierarchy complete (all parent refs resolve)

### Migration Workflow

**Day 1 (Morning) — Import Phase**:

1. **RT logs in to production**:
   - Click "Importar documentos do Drive"
   - Authorize Drive (may be cached from staging)

2. **System executes**:
   - `listarDocsDrive` parses LM-01 (80 entries)
   - `previewDocDrive` samples 10 docs
   - `classificarDocAuto` runs heuristics for all 80
   - User reviews summary: "80 docs, 5 gaps, 0 duplicates"

3. **RT reviews + approves**:
   - Mapping editor: adjust any misclassifications
   - Confirm button: trigger `aprovarBatchImport`
   - System creates 80 docs in batch (30s window)

4. **Audit log**:
   - importJob created + logged
   - All 80 docs + corresponding events in sgq-documentos-audit

**Day 1 (Afternoon) — Smoke Test Phase**:

1. **Verify import completeness**:
   - Query: `/sgq/lista-mestra` → all 80 visible + status `draft`
   - Verify chainHash sequential (hash_n = hash(hash_{n-1} + doc_n))

2. **Smoke test 3 sectors**:
   - Sector 1 (HEMATOLOGIA): 12 docs, all in `/sgq/distribuicao` matrix
   - Sector 2 (IMUNOLOGIA): 8 docs, correct LD
   - Sector 3 (COLETA): 15 docs, verified random sample

**Day 2 (Morning) — RT Batch Approval**:

1. **RT initiates approval workflow**:
   - Click on first doc → "Transitar para vigente"
   - Modal pops: transition reason + PIN signature
   - System calls `transitarVigencia` callable

2. **Batch approval (can be optimized)**:
   - RT approves batch by tipo (e.g., "all PQ from draft → vigente")
   - Or: mass-approve with confirmation dialog
   - Target: 80 docs approved in ≤2h

3. **Verification**:
   - After 100% vigente: run DICQ audit baseline check
   - Expected: 71.3% → ≥76% (DICQ Block B +5 points)

### Output Artifacts

**File**: `.planning/phases/12-sgd-drive-importer/PROD-IMPORT-LOG.md`

```markdown
# Production Import Log

**Date**: 2026-05-XX
**Migration**: Riopomba full (80 docs from Drive → SGD)
**Execution time**: 2h 15m (import + smoke test)
**Status**: ✓ COMPLETE

## Import Stats

- Documents imported: 80
- Duplicates skipped (re-run test): 0
- Missing from Drive (gaps): 0
- Average classification confidence: 0.94

## Verification

### Completeness
- /sgq/lista-mestra count: 80 ✓
- Status distribution: 80 em_revisao, 0 vigente (pre-RT-approval) ✓
- chainHash validation: all sequential ✓

### Smoke Test (3 sectors sampled)
- HEMATOLOGIA: 12/12 docs, LD correct ✓
- IMUNOLOGIA: 8/8 docs, LD correct ✓
- COLETA: 15/15 docs, LD correct ✓

### Approval Batch (RT Bruno)
- Time to approve all 80: 1h 45m ✓
- Status after approval: 80 vigente ✓

## Compliance Impact

**DICQ Baseline Before**: 71.3%
**DICQ Baseline After**: 78.5% (+7.2 points)

**Closed items**:
- 4.2.2.2 Lista Mestra ✓
- 4.3 Hierarquia ✓
- 4.3 Versionamento ✓
- 4.3 Distribuição ✓

## Sign-off

**RT Bruno**: "80 docs em produção, todos vigentes, setor HEMATOLOGIA 100% OK." ✓
**CTO**: "Riopomba migration complete. Drive → read-only as communicated." ✓

**Date**: 2026-05-XX
**Rollback not executed** (no issues encountered)
```

**File**: `.planning/phases/12-sgd-drive-importer/RIOPOMBA-MIGRATION-COMPLETE.md`

```markdown
# Riopomba Migration — Completion Summary

**Migration Period**: 2026-05-XX → 2026-05-XX  
**Status**: ✅ COMPLETE

## What Happened

Riopomba operou sua Gestão Documental via Google Drive (~80 docs em LM-01).  
SGD Phase 12 transferiu tudo para HC Quality nativa com zero perda de dados.

### Before
- Docs: 80 em Drive (MQ, PQ, IT, FR, etc.)
- Master list: Google Sheets LM-01
- Approval: Manual offline
- Audit trail: Nenhuma (arquivo de texto)
- Setores: 17, sem sincronização automática

### After
- Docs: 80 em `/labs/labclin-riopomba/sgq-documentos`
- Master list: `/sgq/lista-mestra` (tabela dinâmica)
- Approval: RT within system (transitarVigencia)
- Audit trail: Completo + chainHash (RDC 978 + DICQ 4.13)
- Setores: Sincronizados com módulo Pessoal (dinâmico)

## DICQ Impact

| Bloco | Antes | Depois | Δ |
|-------|-------|--------|---|
| **Block B (Docs)** | 71.3% | 78.5% | +7.2 |
| 4.2.2.2 (LM) | ❌ | ✅ | +25pts |
| 4.3 (Hierarquia) | ❌ | ✅ | +10pts |
| 4.3 (Versão) | ~50% | ✅ | +25pts |
| 4.3 (Distribuição) | ❌ | ✅ | +10pts |

## Files Migrated

```
MQ-001           1 doc
PQ-01..PQ-25    25 docs
IT-main         30 docs
FR-XXX          20 docs
DC, POL, etc.    4 docs
─────────────────────
Total:          80 docs
```

## Risk Mitigation

- ✓ Pilot tested in staging (30 docs)
- ✓ Idempotency verified (no duplicates on re-run)
- ✓ Zero data loss (Drive URL preserved in urlDriveOriginal)
- ✓ Rollback capacity validated (not executed)
- ✓ 2-day approval window (RT could revert if needed)

## Go-Forward

1. Riopomba uses SGD as system of record (not Drive)
2. Drive marked read-only (notification sent to lab)
3. Backup drive → Archive folder (reference only)
4. All future docs created in SGD via ModuleHub
5. Next labs (Mercês, Tabuleiro) use same infra

## Operational Notes

- Import time: 2h 15m (one-time)
- No downtime (staging → production, zero cutover impact)
- RT training: 30m (same workflow as POPs)
- Support escalation: CTO handles OAuth/Drive issues only
