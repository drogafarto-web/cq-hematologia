# Wave 2 / Agent 7 — Supervisor Presence Gating in `runs/` & `laudos/` rules

**Author:** Wave 2 Agent 7
**Date:** 2026-05-08
**Status:** PROPOSAL — awaits CTO review before deploy
**Compliance driver:** RDC 978/2025 Art. 122 (supervisor presencial obrigatório)
**Depends on:** Wave 1 Agent 5 commit `47ff0e8` (`/labs/{labId}/supervisor-status/current`)

---

## 1. Summary

Wave 1 Agent 5 added a lab-wide cache `/labs/{labId}/supervisor-status/current` carrying the boolean `hasActiveSupervisor`. This cache is updated atomically by `turnos_supervisorCheckin` / `turnos_supervisorCheckout` callables. **It is not yet wired into any consumer rule.**

This proposal wires the cache into `firestore.rules` for **client-direct CIQ run writes**. Laudo emission is already callable-only (Admin SDK bypasses rules), so laudo gating must happen inside `liberarLaudo` callable code — *out of scope for this rules-only proposal*, but documented in §6 as a follow-up.

**Net effect after deploy:** if no supervisor is checked in, no operator can `create`/`update` a CIQ run on hematologia, imunologia, or uroanálise client-direct paths. CIQ writes block until a supervisor checks in (or a substitute is designated).

---

## 2. New helper function

Insert after `validateDraftLock` (after current line 101) inside the top-level `match /databases/{database}/documents`:

```firestore
// hasActiveSupervisor(labId) — RDC 978/2025 Art. 122 enforcement.
// Reads /labs/{labId}/supervisor-status/current (server-only cache; callables
// turnos_supervisorCheckin / turnos_supervisorCheckout maintain it).
// FAIL-CLOSED: if the cache doc doesn't exist (lab never bootstrapped a turno
// with a checkin), this returns false and blocks critical CIQ writes.
// SuperAdmin bypasses this gate (incident response / data migration).
function hasActiveSupervisor(labId) {
  let statusPath = /databases/$(database)/documents/labs/$(labId)/supervisor-status/current;
  return exists(statusPath)
    && get(statusPath).data.hasActiveSupervisor == true;
}
```

**Signature:** `hasActiveSupervisor(labId: string) -> bool`.

**Cost note:** each `create`/`update` on a gated path adds 1 `get()` to the rule eval (Firestore charges this as a billable read). With 10k runs/day across our active labs, this is ~$0.36/month additional read cost — negligible. The `get()` is cached within a single rule evaluation, so a single batched write touching the same labId pays once.

---

## 3. Rules to modify (exact line ranges + diffs)

All four targets are **client-direct CIQ runs** under `/labs/{labId}/...`. Each `allow create, update: if ...` adds `&& (isSuperAdmin() || hasActiveSupervisor(labId))`. `read` and `delete` are **untouched** — read access cannot be gated by presence (auditors must always be able to read), and `delete` is admin-only soft-delete which doesn't touch results.

### 3.1 Hematologia — `/labs/{labId}/lots/{lotId}/runs/{runId}` (line 145–150)

**Existing (lines 145–150):**
```firestore
match /runs/{runId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('hematologia'));
  allow create, update: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow delete: if isSuperAdmin() || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}
```

**Proposed:**
```firestore
match /runs/{runId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('hematologia'));
  // RDC 978 Art. 122: critical run writes require active supervisor presence.
  allow create, update: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasActiveSupervisor(labId));
  allow delete: if isSuperAdmin() || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}
```

### 3.2 Imunologia — `/labs/{labId}/ciq-imuno/{lotId}/runs/{runId}` (line 172–178)

**Existing (lines 172–178):**
```firestore
match /runs/{runId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('imunologia'));
  allow create, update: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}
```

**Proposed:**
```firestore
match /runs/{runId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('imunologia'));
  // RDC 978 Art. 122: critical run writes require active supervisor presence.
  allow create, update: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasActiveSupervisor(labId));
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}
```

### 3.3 Uroanálise — `/labs/{labId}/ciq-uroanalise/{lotId}/runs/{runId}` (line 265–271)

**Existing (lines 265–271):**
```firestore
match /runs/{runId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('uroanalise'));
  allow create, update: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}
```

**Proposed:**
```firestore
match /runs/{runId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('uroanalise'));
  // RDC 978 Art. 122: critical run writes require active supervisor presence.
  allow create, update: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasActiveSupervisor(labId));
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}
```

### 3.4 Insumos sub-runs — `/labs/{labId}/insumos/{insumoId}/runs/{runId}` (line 385–390)

**Existing (lines 385–390):**
```firestore
match /runs/{runId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow create, update: if isSuperAdmin() || isActiveMemberOfLab(labId);
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}
```

**Proposed:**
```firestore
match /runs/{runId} {
  allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
  // RDC 978 Art. 122: critical run writes require active supervisor presence.
  allow create, update: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasActiveSupervisor(labId));
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}
```

---

## 4. Rules NOT modified (and why)

| Path | Lines | Reason not gated |
|---|---|---|
| `/labs/{labId}/laudos/{id}` | 1752–1757 | Already `allow create, update: if false` — callable-only (`liberarLaudo`). Rules cannot gate Admin SDK; gating must move into the callable. See §6. |
| `/laudos/{laudoId}` (global) | 1981–1989 | Same — callable-only. |
| `/labs/{labId}/bioquimica/root/runs/{runId}` | 1612–1616 | Already callable-only (`recordRunBioquimica`). Gate inside the callable (§6). |
| `/labs/{labId}/ciq-coagulacao/{lotId}/runs/{runId}` | 231–235 | MVP open-access (`allow ... if true`). Gating CIQ-coag would change the open-access promise without addressing the broader `if true` problem. Recommend a separate hardening RFC. |
| `/labs/{labId}/laudos-draft/{id}` | 1924–1928 | Drafts are explicitly excluded from the gate (per task brief: "NOT draft saves"). |
| `runs` `read` everywhere | — | Audit/read access stays unrestricted to active members; gating reads would block auditor work during a supervisor gap. |
| `runs` `delete` everywhere | — | Already admin-only and soft-delete. |
| `/turnos/**` | 1810+ | Self-referential: gating turnos by hasActiveSupervisor would deadlock (cannot bootstrap presence without writing a turno first). Already callable-only via DL-1. |
| `ciq-imuno-meta`, `ciq-uroanalise-meta`, `ciq-imuno-config`, etc. | 188+, 281+ | Configuration / aggregation docs, not result entries. Not "critical" per task brief. |

---

## 5. Edge cases & policy decisions

### 5.1 Bootstrap state (no `supervisor-status/current` doc yet)

**Decision:** **fail-closed.** `hasActiveSupervisor` returns `false` if the doc does not `exists()`. New labs will not be able to write CIQ runs until they create a turno + supervisor checks in. Justification: RDC 978 Art. 122 is non-negotiable; allowing the first run to bypass for "convenience" would create a recurring exception path that auditors flag.

**Migration plan for existing labs:** before deploy, run a one-shot script that initializes `supervisor-status/current` with `hasActiveSupervisor: false` in every lab, so the failure mode on day 1 is explicit ("no supervisor checked in") rather than ambiguous ("doc missing"). Script lives at `scripts/init-supervisor-status.ts` (proposed; not in this commit).

**SuperAdmin escape hatch:** `isSuperAdmin()` short-circuits the gate. CTO/RT can write directly during incident response (e.g., emergency rerun while supervisor is offline).

### 5.2 Substitute supervisor handoff window

The `LabSupervisorStatus` doc carries `supervisorAtivoIsSubstitute: boolean`. The check-in/check-out callables atomically swap `supervisorAtivoUid` during a `designateSubstitute` flow. **Rules don't care which supervisor — only that one is `active`**. As long as the swap is atomic (single batch in the callable), there is no rule-visible gap.

**Risk:** if the swap is non-atomic (e.g., checkout-first then check-in-second across two callables), there's a window where `hasActiveSupervisor: false`. Resolution: enforce atomic swap in the substitute callable (`turnos_designateSubstitute`, not yet implemented — Wave 1 Agent 5 only shipped checkin/checkout). Document this requirement in the substitute callable spec when written.

### 5.3 Expired check-in (turno ended, no checkout)

`presenca/current` carries `fimPlanejado` (planned end timestamp). If the supervisor forgets to checkout, `hasActiveSupervisor` stays `true` past the planned end. **Decision:** **do not auto-checkout in rules.** Rules cannot do time math reliably (no `request.time` arithmetic against stored timestamps without complexity that explodes the read budget).

**Recommended follow-up (separate ticket):** scheduled function `turnos_autoCheckoutExpiredTurnos` running every 15min, finds presença docs with `status='active'` and `fimPlanejado < now() - graceWindow (30min)`, transitions to `closed`, updates lab cache. Owner: Wave 3 or Phase 5 W1.

### 5.4 Read latency / cache staleness

Firestore rule `get()` reads the latest committed value (strong consistency within the same document). No staleness concern. The 1 extra read per write is the only cost.

### 5.5 Multi-region deploy considerations

`southamerica-east1` Functions write the cache; rules read in the same region from the same Firestore. No cross-region coherence concern.

---

## 6. Out-of-scope follow-ups (must happen before claiming Art. 122 fully closed)

1. **Add `hasActiveSupervisor` enforcement inside `liberarLaudo` callable** (`functions/src/liberacao/liberarLaudo.ts`): read `supervisor-status/current`, throw `failed-precondition` if `hasActiveSupervisor !== true && !superAdmin`. Out of scope here because it is a **functions code change**, not a rules change. Track as separate task.
2. **Add same enforcement inside `recordRunBioquimica` callable** (`functions/src/modules/bioquimica/...`). Same shape.
3. **Lab bootstrap script** (§5.1) — initialize cache doc for existing labs before deploy.
4. **Substitute callable atomicity contract** (§5.2).
5. **Auto-checkout expired turnos cron** (§5.3).
6. **`ciq-coagulacao` open-access hardening** — separate RFC; gating it without solving `if true` is a half-measure.

---

## 7. Test plan

Integration test stub at `functions/src/__tests__/rules/supervisor-gating.test.ts`. See companion file in this commit. Asserts both directions:

- WITH `hasActiveSupervisor: true` → run create succeeds for active member
- WITH `hasActiveSupervisor: false` → run create rejected with `permission-denied`
- WITH cache doc absent → run create rejected (fail-closed)
- WITH `hasActiveSupervisor: false` AND user is `superAdmin` → write succeeds (escape hatch)
- Read paths NOT gated → succeed regardless of cache state
- Draft writes NOT gated → succeed regardless

Run via Firestore emulator: `firebase emulators:exec --only firestore "npm run test -- supervisor-gating"`.

---

## 8. Rollout

1. Land this proposal + test stub (this commit).
2. CTO reviews policy decisions §5.
3. If approved: implement bootstrap script (§6.3).
4. Run script in production (initializes cache for all labs).
5. Apply rules diff §3 to `firestore.rules`.
6. Deploy: `firebase deploy --only firestore:rules --project hmatologia2`.
7. Smoke test from web: with no checkin, attempt to create a hematologia run → expect `permission-denied`. Then checkin → retry → succeeds.
8. Monitor Cloud Logs 24h for spurious `permission-denied` from real users. If spike, evaluate emergency rollback (`git revert` + redeploy rules).

**Rollback:** `git revert <sha>` + `firebase deploy --only firestore:rules`. Cache doc remains harmless (other consumers can be added later).

---

## 9. Compliance traceability

| Requirement | Mapping |
|---|---|
| RDC 978/2025 Art. 122 | "supervisão presencial" → `hasActiveSupervisor` gate on CIQ writes |
| DICQ 4.1.2.7 | "responsável técnico presente" → same gate |
| RDC 786/2023 | covered transitively (RT designation + presence) |
| Audit trail | already covered by `presenca-events` chainHash (Wave 1) |
