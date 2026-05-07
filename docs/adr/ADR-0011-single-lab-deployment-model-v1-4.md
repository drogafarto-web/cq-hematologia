# ADR-0011: Single-Lab Deployment Model (v1.4) — Multi-Tenant Deferred to v1.5+

- **Status:** Accepted
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

HC Quality v1.3 foi deployado como single-lab instance (Riopomba) em https://hmatologia2.web.app. Firebase schema é architectured multi-tenant-ready (`/labs/{labId}/collection` pattern), mas operationally, apenas 1 lab existe no production.

v1.4 expande DICQ compliance (25 modules → mature feature set), RDC 978 coverage (100%), e patient-facing portals. Timeline é 22 semanas até auditoria 2026-10-15.

**Questão arquitetural:** v1.4 investe em multi-tenant v2 (N labs, 1 deploy) ou mantém single-lab e escalas a v1.5+?

**Contexto mercado:**
- TAM addressable: 1,500–2,000 labs @ $50–$200/month = ~$75M–$300M.
- Go-to-market viável single-lab (Riopomba) com case studies + SBAC partnership (roadmap v1.4).
- Multi-tenant é diferentiador (competitors WinLab, Labcat, PNCQ são per-server), mas não blocker para primeira venda.

## Problema

Pressão conflitante:

1. **Multi-tenant demand.** Investors / market may ask: "quando escalamos para 10 labs?" Roadmap precisa responder.
2. **Timeline risk.** Multi-tenant requer:
   - Full audit de Firestore Rules (labId isolation, cross-tenant queries bloqueadas). 2–3 semanas.
   - Refactor seeding + onboarding (multi-lab setup flow). 1–2 semanas.
   - RBAC hierarchy (org admin vs lab admin vs operator). 1 semana.
   - Billing + subscription engine. 2+ semanas (produto, não só infra).
   - E2E testing (100+ scenarios × N tenants). 1–2 semanas.
   - **Total: ~10-14 semanas.** Leaves 8-12 weeks para DICQ + portals + IA. **Risky.**

3. **Architecture lock-in.** Single-lab release now means: if multi-tenant goes wrong, rollback is data-migration nightmare. One shot to get this right.

**Decision imperative:** Lock v1.4 single-lab, plan v1.5+ multi-tenant with proper runway.

## Decisão

**v1.4 explicitly maintains single-lab deployment model (Riopomba). Multi-tenant architecture deferred to v1.5 / v2.0.**

### 1. v1.4 Single-Lab Constraints

**Firestore schema stays multi-tenant-ready** (for future; `/labs/{labId}` prefix respected everywhere). But:
- Config: `labId` hardcoded to Riopomba's ID in Firebase auth + app config.
- Auth: Single Firebase Auth project (`hmatologia2`); no "switch lab" UX.
- Onboarding: Assume all users are employees of Riopomba (pre-populated; no signup).
- Billing: Flat rate v1.4 (no per-lab metering). v1.5 introduces per-lab subscription.

**Production deployment:**
```
   /labs/riopomba-labId-hardcoded
    ├─ /members
    ├─ /nao-conformidades
    ├─ /ciq-*
    ├─ /ceq
    └─ ... (all modules scoped to Riopomba)
```

### 2. v1.5+ Multi-Tenant Architecture (Planned)

v1.5 kickoff planning (Week 1-2 nov/2026):

**Design gate:**
- Define N labs per deploy (estimate: 10–100 labs per instance, depending on load testing).
- Refine RBAC: Org admin (all labs) vs Lab admin (single lab) vs Operator (assigned analytes).
- Billing architecture: recurring subscription, multi-tenant accounting, per-lab API quotas.
- Onboarding: self-service lab registration + invitation-based employee add.

**Engineering execution:**
- 3–4 weeks: Rules audit + multi-tenant isolation validation.
- 1–2 weeks: Seeding + onboarding refactor.
- 2–3 weeks: Billing engine (Stripe integration?).
- 1–2 weeks: E2E testing.
- **Total: ~8-12 weeks** (parallel waves, not sequential).

**Gate to production:** 0 cross-tenant data leaks (security audit required).

### 3. Firestore Rules — Future-Proof but Single-Lab v1.4

Example rule (current):
```javascript
// v1.4: labId is constant (hardcoded app config)
match /labs/{labId}/nao-conformidades/{ncId} {
  allow read: if request.auth.uid != null 
    && get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.isActiveMember;
  allow write: if isQAManager() && labId == RIOPOMBA_LAB_ID; // hardcoded
}

// v1.5: rule stays same, but labId dynamic (user can switch labs)
// No rule change needed; just app context changes
```

**Rationale:** Rules are **immutable after ACCEPTED**. If we design them multi-tenant-compatible now, v1.5 onboarding is just an app config + seeding refactor (no Rules re-audit).

### 4. Data Model (No Changes v1.4 → v1.5)

Existing schema supports multi-tenant (all collections under `/labs/{labId}`). v1.4 doesn't add any single-lab-specific fields (e.g., no "global" shared collections cross-lab). This keeps migration path clean.

## Alternativas consideradas

### Alternativa A — Multi-Tenant v1.4 (full build now)

Invest 10–14 weeks in v1.5 multi-tenant architecture in v1.4 timeline.

**Rejeitada porque:**
- v1.4 timeline is fixed (auditoria 2026-10-15). Compliance deadline > product scaling.
- Multi-tenant adds complexity (Rules audit, billing, RBAC hierarchy). Any gap blocks launch.
- Single-lab case study (Riopomba) is stronger than "multi-tenant beta" for market positioning. Case studies sell better.

### Alternativa B — Create separate per-lab instances (v1.4 onward)

Each lab gets its own Firebase project + deploy (status quo: WinLab, Labcat model).

**Rejeitada because:**
- Operational overhead explodes (N projects to monitor, N deploy pipelines, N secret mgmt).
- COGS per lab increases (Firebase org management, billing overhead).
- No shared learning (each lab is isolated; can't aggregate KPIs or build network effects).
- Precludes future multi-tenant upsell (customer adds lab, needs new project = friction).

## Consequências

### Positivas

1. **Execution focus.** v1.4 energies 100% on compliance + features + IA foundation. No multi-tenant tax.
2. **Clean transition.** v1.5 multi-tenant is greenfield (Riopomba data migrated, not retrofitted). Less technical debt.
3. **Market positioning.** "Premium case study: Riopomba DICQ accredited with HC Quality" > "beta multi-tenant product".
4. **Financial clarity.** v1.4 revenue model is simple (flat SaaS fee). v1.5 can introduce per-lab metering without retrofit.

### Negativas

1. **Scaling friction.** If Riopomba succeeds, scaling to lab-2 requires major refactor (v1.5). Time-to-revenue on lab-2 is 4+ months.
2. **Investor narrative.** Pitch decks will say "multi-tenant Q1 2027" instead of "multi-tenant Q3 2026". May affect funding rounds.
3. **Tech debt if multi-tenant blocks.** If v1.5 multi-tenant has unexpected blocker, single-lab is locked longer. Mitigated: v1.5 planning starts early (Week 1 nov/2026), not last-minute.

## Compromissos derivados

1. **v1.5 Multi-Tenant Planning (explicit).**
   - Week 1-2 nov/2026: Design doc for multi-tenant architecture (RBAC, billing, data isolation).
   - Week 3-4 nov/2026: Rules audit + prototype isolation validation.
   - Week 5+: Parallel engineering (rules, seeding, billing, E2E).

2. **Firestore Rules governance (v1.4).**
   - All rules written to be **multi-tenant-compatible** (even if labId is hardcoded app-side). No single-lab-specific rules (e.g., no `/global/` collections unless explicitly cross-lab by design).
   - Rules audit checklist includes: "Is this rule ready for dynamic labId in v1.5?" (Answer: yes or documented reason).

3. **Onboarding script v1.4 (hardcoded but parameterized).**
   - `scripts/seed-lab.sh` accepts `LAB_ID` env var.
   - v1.4 release: `LAB_ID=riopomba seed-lab.sh`.
   - v1.5 onboarding: same script, new `LAB_ID=lab2`. No refactor.

4. **Billing model placeholder (v1.4).**
   - v1.4 charges flat $X/month (Riopomba).
   - v1.5 design introduces per-lab subscription (v1.4 customer gets grandfathered legacy pricing or upgrades to per-lab).
   - Billing engine not built v1.4 (Stripe integration, usage metering deferred).

5. **Data export / portability (v1.4).**
   - If lab-2 onboards v1.5, Riopomba data is exportable (CF + GCS backup).
   - Ensures no lock-in if customer ever wants to self-host or switch provider.

## Referências

- `src/config/labConfig.ts`: Hardcoded labId (Riopomba).
- `firestore.rules`: Multi-tenant-ready; labId validation everywhere.
- `scripts/seed-lab.sh`: Parameterized seeding.
- `v1.4-ROADMAP.md` Phase 15: v1.5 preview.
- Obsidian `HC_Quality_Roadmap.md`: Multi-tenant v2 decision log.

---

**Aplicabilidade:** Architektura + onboarding + Firestore Rules v1.4.

---

**ADR Status:** ACCEPTED (2026-05-07)  
**Review Date:** 2026-07-07 (Phase 6 mid-point: confirm single-lab stability; no cross-tenant data leaks)  
**v1.5 Planning Gate:** 2026-11-01 (multi-tenant design review before engineering kickoff)
