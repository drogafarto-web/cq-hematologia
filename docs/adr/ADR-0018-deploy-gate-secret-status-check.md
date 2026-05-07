# ADR-0018 — Deploy Gate: Secret-Status Check (2026-05-07)

**Status:** Accepted
**Date:** 2026-05-07
**Decided by:** CTO (drogafarto)
**Related:** ADR-0017 (HMAC Signature Baseline Reset — the incident this ADR prevents)

---

## Context

ADR-0017 documents a 15-day window (2026-04-22 → 2026-05-07) during which `HCQ_SIGNATURE_HMAC_KEY` held the literal string `PENDING_SET_HCQ_SIGNATURE_HMAC_KEY` — Firebase's documented placeholder for an unresolved `defineSecret()` declaration. Three signature triggers signed records against a publicly knowable string; ~25 callable / scheduled functions threw at runtime; `validateChainIntegrityScheduled` produced zero successful chain-integrity verifications during the window. Compliance impact spanned RDC 786 Art. 21, RDC 978 Art. 5.3 / 86 / 122, DICQ 4.4, and Lei 13.787 Art. 6.

The window was possible because Firebase explicitly does **not** validate secret values at deploy time. `firebase deploy --only functions` checks that each `defineSecret('NAME')` references *a secret that exists in Cloud Secret Manager* — but it never inspects the value. A secret created with no version, or a version whose payload is a `PENDING_SET_*` placeholder, deploys cleanly. Functions then start, bind the secret env var to the placeholder string, and silently corrupt every operation that depends on it. There is no warning, no log, no Cloud Run health-check failure — the function returns 200s with garbage cryptography.

A manual checklist ("did you set every new secret before deploying?") is insufficient for three concrete reasons. **(1)** New secrets are added by the same engineer who later runs the deploy, often days apart, often after a context switch — the human in the loop is the same human who already forgot once. **(2)** Multiple engineers and CI pipelines deploy independently; a checklist lives in one person's head. **(3)** The failure mode is invisible — the deploy succeeds, the smoke test passes (the function returns 200), and the only signal is a forensic audit weeks later. The control must be mechanical and must execute on every deploy, local or CI, with no opt-in.

---

## Decision

We adopt a **pre-deploy gate** implemented as `scripts/preflight-secrets-check.sh`, mandatory before `firebase deploy --only functions`. The gate:

1. Greps `functions/src/**/*.ts` for every `defineSecret('NAME')` call and extracts the unique set of declared secret names.
2. For each declared name, runs `firebase functions:secrets:access NAME --project hmatologia2` to fetch the latest stored value. (Firebase exposes per-secret `access` rather than a `list` command in CLI 15.x.)
3. Classifies each value as one of: real (passes), `PENDING_SET_*` placeholder (blocks), empty (blocks), unreadable due to permissions or non-existence (blocks).
4. **Blocks the deploy with exit code 1** if any declared secret is unprovisioned. The error message includes the offending secret name(s) and the exact `firebase functions:secrets:set ...` command(s) to fix each one, plus a back-reference to ADR-0017 so the operator understands the stakes.
5. Allows override via `--allow-pending-secrets` for emergency deploys (e.g. rolling back during an active incident where the secret value is known to be valid but the gate cannot reach the API). The override is logged in red with a mandatory follow-up window of 24 hours.
6. Emits no false positives on successful deploys — exit code 0, single green line, ~3 seconds total.

The gate is wired into `.claude/rules/deploy-protocol.md` as a mandatory step between `npm run build` and `firebase deploy --only functions`. It is also documented in the `hcq-deploy-gates` skill so any agent invoking that skill executes it automatically.

### Rejected alternatives

- **(a) Post-deploy validation only** (e.g. a Cloud Function that reads each secret and writes a health doc). Rejected. By the time the validator runs, the bad function is already serving traffic and signing records. ADR-0017 happened despite the existence of the `validateChainIntegrityScheduled` job — post-deploy detection is a fallback, not a control.
- **(b) CI-only check** (e.g. a GitHub Actions step). Rejected. The project does direct local deploys (`firebase deploy --only functions` from the operator's machine), and several emergency deploys in 2026-04 bypassed CI entirely. A control that runs only in CI is not a control for this project's actual deploy surface.
- **(c) Trust Firebase to validate this**. Rejected. Firebase's documented behavior is that `defineSecret()` validates *binding*, not *value*. A feature request to Google to change this would be welcome but is not a substitute for our own gate.
- **(d) Bash hook on `firebase deploy`** (intercept the binary). Rejected as too magical — operators would not understand why deploy hangs, and CI environments may not load the wrapper.

---

## Consequences

**Immediate:**

- `scripts/preflight-secrets-check.sh` is added to the repo and made executable.
- `.claude/rules/deploy-protocol.md` gains a new "Pre-deploy gate" section with the exact command.
- Any future `defineSecret('NEW_SECRET')` added to `functions/src/` will block the next deploy until the operator runs `firebase functions:secrets:set NEW_SECRET --project hmatologia2`. This is the desired behavior — it converts a silent corruption bug into a loud deploy failure with a remediation command in the error output.

**Cost:**

- ~3 seconds of latency on every functions deploy (one `secrets:access` call per declared secret; currently 8 secrets, batched serially).
- Script maintenance — if Firebase changes the CLI command shape (e.g. introduces a real `secrets:list`), the script needs an update. Low-frequency change (CLI is stable across minor versions).
- Operator must remember to run the gate. Mitigation: it's the first command in the deploy section of `deploy-protocol.md`, and the `hcq-deploy-gates` skill runs it automatically.

**Trade-offs:**

- **False positives**: if the operator's `firebase login` is stale, every secret reads as unreadable and the gate blocks. This is the right default — re-authenticating and retrying is cheaper than shipping a placeholder.
- **Override risk**: `--allow-pending-secrets` exists for emergencies. We accept the residual risk that an operator misuses it; the audit log of deploy commands captures every override.
- **Doesn't catch wrong-value secrets**: the gate verifies the value is *not a placeholder*, not that it is *the correct value*. A valid-but-rotated-incorrectly key would pass. That class of bug is outside this ADR's scope and is addressed by ADR-0017's chain-integrity verifier running on the post-deploy side.

---

## Operational checklist

- [x] Create `scripts/preflight-secrets-check.sh`.
- [x] Update `.claude/rules/deploy-protocol.md` to require the gate before `firebase deploy --only functions`.
- [x] Run gate locally against current `hmatologia2` state — must pass cleanly post-ADR-0017 rotation.
- [ ] **Follow-up:** add the gate as a step in any CI workflow that triggers `firebase deploy --only functions`.
- [ ] **Follow-up:** if a real `firebase functions:secrets:list` ever ships, refactor the script to use it (reduces N round-trips to 1).

---

## References

- ADR-0017 — HMAC Signature Baseline Reset (2026-05-07) — the incident this gate prevents
- `scripts/preflight-secrets-check.sh` — the gate implementation
- `.claude/rules/deploy-protocol.md` — deploy protocol updated to require the gate
- Firebase docs — [Manage secrets](https://firebase.google.com/docs/functions/config-env?gen=2nd#secret-manager) — confirms Firebase does not validate secret *values* at deploy time, only binding existence
