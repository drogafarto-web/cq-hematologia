# Phase 2 Code Review Plan

**Scope**: 20 production modules (Phase 1 core + Phase 2 additions)  
**Focus Areas**: RDC 978 compliance, multi-tenant isolation, soft-delete patterns, Zustand stores, Firestore rules coverage, test gaps  
**Duration**: Parallel review across 5 module clusters

---

## Review Clusters

### Cluster A: Phase 2 Recent Additions (CRITICAL PRIORITY)

| Module                 | Last Deploy | Risk Level | Checklist                                                                |
| ---------------------- | ----------- | ---------- | ------------------------------------------------------------------------ |
| `controle-temperatura` | 2026-05-04  | 🔴 HIGH    | IoT callables, signature validation, CT rules (CT-01, CT-04)             |
| `educacao-continuada`  | 2026-04-24  | 🔴 HIGH    | New callables (trigger defense, cascade), XLSX export, soft-delete logic |

**Task A.1**: Review `controle-temperatura` (FR-11 ESP32 + assinatura callable)

- [ ] `functions/src/modules/controleTemperatura/` callables (auth, signature, rules validation)
- [ ] `firestore.rules` section for `controleTemperatura/*` (CT-01 ✓, CT-04 ✓)
- [ ] `src/features/controle-temperatura/hooks/` (multi-tenant filter by labId)
- [ ] Unit tests coverage >80%
- [ ] RDC 978 violation check: assinatura hash size, operator ID binding, no hard-delete

**Task A.2**: Review `educacao-continuada` (2 new callables + cascade soft-delete)

- [ ] `functions/src/modules/educacaoContinuada/` callables (trigger defense-in-depth, soft-delete cascade)
- [ ] Firestore rules for `educacao-continuada/*` (allow create: soft service only, no hard-delete)
- [ ] `ec_softDeleteExecucaoCascade` atomic batch logic (verify no orphans)
- [ ] `src/features/educacao-continuada/services/` XLSX export (streaming for >5k rows)
- [ ] Test coverage: cascade correctness, edge cases (partial writes, network failures)

---

### Cluster B: Regulatory Core (RDC 978 Dependencies)

| Module         | Last Deploy   | Risk Level | Checklist                                             |
| -------------- | ------------- | ---------- | ----------------------------------------------------- |
| `auditoria`    | 2026-05-03    | 🟡 MEDIUM  | Write intent + read consent audit trail               |
| `sgq` + `pops` | 2026-05-03/04 | 🟡 MEDIUM  | Document versioning, assinatura chains, RT signatures |
| `treinamentos` | 2026-05-05    | 🟡 MEDIUM  | Training registry + certification + revalidation      |

**Task B.1**: Review `auditoria` (RDC 978 5.3 audit trail)

- [ ] `functions/src/modules/audit/` callable gates + logging (write intent hook, read consent capture)
- [ ] `auditLogs/{labId}/` schema (immutable: no update/delete, hash chain integrity)
- [ ] Firestore rules `allow delete: if false` on audit collections
- [ ] HMAC + timestamp validation in callables
- [ ] Test: multi-operator audit trail, consensus verification

**Task B.2**: Review `sgq` (DICQ 4.3 document quality system)

- [ ] `src/features/sgq/services/` document versioning (MQ/PQ/IT/FR/POL)
- [ ] `functions/src/modules/qualidade/` callable for document approval/publish
- [ ] Firestore rules versioning + multi-tenant (labId per document)
- [ ] Unit tests: version history, concurrent edits, cross-lab isolation

**Task B.3**: Review `pops` (Procedimentos Operacionais Padrão)

- [ ] `src/features/pops/services/` versioning + training workflow
- [ ] `functions/src/modules/procedimentos/` callable for POP approval + RT signature
- [ ] Firestore rules: `pop.assinatura` validation (chain-hash integrity)
- [ ] E2E test: POP publish → training requirement → operator certification flow

**Task B.4**: Review `treinamentos` (Training registry + certification)

- [ ] `src/features/treinamentos/services/` training + certification logic
- [ ] `functions/src/modules/treinamentos/` callable for electronic signature
- [ ] Firestore rules: certification expiry enforcement, revalidation gates
- [ ] Multi-tenant: no cross-lab certification leakage

---

### Cluster C: Core Data Access Patterns (Multi-Tenant + Soft-Delete)

| Module             | Pattern                            | Risk Level | Checklist                                    |
| ------------------ | ---------------------------------- | ---------- | -------------------------------------------- |
| `runs`             | CIQ run records + compliance       | 🟡 MEDIUM  | labId isolation, soft-delete, assinatura     |
| `insumos`          | Supply chain + fiscal traceability | 🟡 MEDIUM  | notaFiscalId FK, HMAC audit trail            |
| `equipamentos`     | Equipment lifecycle + calibration  | 🟡 MEDIUM  | proximaCalibracaoPrevista gate, labId filter |
| `naoConformidades` | NC lifecycle + CAPA                | 🟡 MEDIUM  | blocking gates (RDC 978 4.2.1), soft-delete  |

**Task C.1**: Review `runs` (CIQ run collection pattern)

- [ ] `src/features/runs/services/RunService.ts` (labId parameter, soft-delete only)
- [ ] `src/features/runs/hooks/useRuns.ts` (onSnapshot cleanup, client-side soft-delete filter)
- [ ] Firestore rules: `allow create: if validSignature && labIdMatches` (RN-01)
- [ ] Unit tests: labId isolation, cross-lab query rejection, soft-delete cascade

**Task C.2**: Review `insumos` (Supply chain traceability)

- [ ] `src/features/insumos/services/InsumoService.ts` (notaFiscalId FK validation)
- [ ] `src/features/insumos/hooks/useInsumos.ts` (multi-field filtering: status, validadeReal, modulos)
- [ ] Firestore rules: `notaFiscalId` required on create (RDC 978 5.3.1)
- [ ] Unit tests: fiscal traceability, FK integrity

**Task C.3**: Review `equipamentos` (Equipment + calibration gates)

- [ ] `src/features/equipamentos/services/EquipamentoService.ts` (proximaCalibracaoPrevista check)
- [ ] `functions/src/modules/equipamentos/` callable for calibration event + gate
- [ ] Firestore rules: `can CIQ run? if proximaCalibracaoPrevista > now` (RDC 978 4.8.4)
- [ ] Unit tests: overdue calibration blocks CIQ, soft-delete cleans audit trail

**Task C.4**: Review `naoConformidades` (NC blocking + CAPA)

- [ ] `src/features/naoConformidades/services/` (open NC blocking logic)
- [ ] `functions/src/modules/naoConformidades/` callable for NC creation + blocking gate
- [ ] Firestore rules: critical NC blocks write to related modules (RDC 978 4.2.1)
- [ ] Unit tests: blocking gates, CAPA workflow, soft-delete orphan cleanup

---

### Cluster D: State Management + Performance

| Category        | Modules                                                      | Risk Level | Checklist                                         |
| --------------- | ------------------------------------------------------------ | ---------- | ------------------------------------------------- |
| Zustand stores  | All 20                                                       | 🟢 LOW     | Store structure, no circular deps, proper cleanup |
| API callables   | audit, signatures, controle-temperatura, educacao-continuada | 🟡 MEDIUM  | Error handling, timeout, auth claims              |
| Analytics hooks | (Phase 3.1 preview)                                          | 🟢 LOW     | onSnapshot unsubscribe, Firestore indices         |

**Task D.1**: Audit Zustand store patterns across all modules

- [ ] Check each `src/features/*/store/use*.ts` for: proper cleanup, no stale subscriptions
- [ ] Verify no direct mutate of Firestore-sourced state (immutable pattern)
- [ ] Test store reset on lab switch (`useAuthStore.setState({})`)

**Task D.2**: Review Cloud Callable error handling

- [ ] `functions/src/modules/*/` callables for try-catch, user-facing errors, logging
- [ ] Timeout handling (540s for large exports, 60s default)
- [ ] Client-side retry + fallback to deprecated service (Fase 0b pattern)

**Task D.3**: Firestore indices coverage

- [ ] Verify all composite index queries exist in `firestore.indexes.json` (created ✓)
- [ ] Check for client-side filtering that should be server-side (optimization)
- [ ] Query plan: no full scans for large labs (>10k docs)

---

### Cluster E: Test Gaps (Lowest Priority, Defer if Needed)

| Module          | Coverage | Tests Needed                                          |
| --------------- | -------- | ----------------------------------------------------- |
| `lgpd`          | TBD      | CPF hashing, consent flow, data erasure               |
| `kpis`          | TBD      | KPI aggregation correctness, multi-lab handling       |
| `pgrss`         | TBD      | Waste segregation, compliance status, RDC 222 mapping |
| `biosseguranca` | TBD      | Risk area isolation, NB level enforcement             |

**Task E.1**: Gap analysis (quick scan)

- [ ] Run `npm test -- --coverage` in each module
- [ ] Identify functions with 0% coverage
- [ ] Flag: high-risk paths without tests (compliance, auth, data deletion)

---

## Review Execution

### Order (by risk + timeline impact)

1. **Phase 2 Recent** (A.1, A.2) — highest risk, must be clean before Phase 3.1
2. **Regulatory Core** (B.1, B.2, B.3, B.4) — RDC 978 dependencies, blocks compliance audit
3. **Core Data Patterns** (C.1, C.2, C.3, C.4) — systemic risk (multi-tenant, soft-delete)
4. **State + Performance** (D.1, D.2, D.3) — quality gates
5. **Test Gaps** (E.1) — lower priority, can defer post Phase 3.1 if needed

### Checklist Methodology

For each task:

1. **Read** source files (service, hook, callable, rules)
2. **Check** against CLAUDE.md + `.claude/rules/` constraints
3. **Verify** tests exist + cover happy path + error cases
4. **Flag** violations with line numbers + remediation
5. **Document** finding in `.planning/PHASE2_CODE_REVIEW_FINDINGS.md`

---

## Output

**PHASE2_CODE_REVIEW_FINDINGS.md**

- Summary: X modules audited, Y findings (severity: critical/high/medium/low)
- Per-module breakdown with line numbers
- Remediation priority + effort estimate
- Compliance sign-off (ready for Phase 3.1 execution? YES/NO/CONDITIONAL)

---

**Created**: 2026-05-05 (Phase 2 Code Review task #5)
