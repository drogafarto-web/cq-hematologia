# NOTIVISA Access Credentials — REDACTED

> **SECURITY INCIDENT 2026-05-08:** This document previously contained
> plaintext NOTIVISA portal passwords. The full credential set has been
> redacted from the working tree. Historical commits still expose the
> values until `git filter-repo` is executed (see remediation below).
> Any password that ever appeared in git history MUST be considered
> compromised and rotated immediately.

---

## Where credentials live now

| Field                  | Location                                            |
| ---------------------- | --------------------------------------------------- |
| Portal URL             | `notivisa-config` Firestore doc (lab-scoped)        |
| Portal email (gestor)  | Firebase Secret Manager: `NOTIVISA_PORTAL_EMAIL`    |
| Portal password        | Firebase Secret Manager: `NOTIVISA_PORTAL_PASSWORD` |
| API Client ID          | Firebase Secret Manager: `NOTIVISA_CLIENT_ID`       |
| API Client Secret      | Firebase Secret Manager: `NOTIVISA_CLIENT_SECRET`   |
| Webhook signing secret | Firebase Secret Manager: `NOTIVISA_WEBHOOK_SECRET`  |

Provisioning command:

```bash
firebase functions:secrets:set NOTIVISA_PORTAL_PASSWORD --project hmatologia2
# Paste rotated value when prompted; never commit.
```

Access pattern (Cloud Functions only):

```ts
import { defineSecret } from 'firebase-functions/params';
const NOTIVISA_PORTAL_PASSWORD = defineSecret('NOTIVISA_PORTAL_PASSWORD');
// Inside callable: NOTIVISA_PORTAL_PASSWORD.value()
```

Reference: `docs/adr/ADR-0018-deploy-gate-secret-status-check.md` and
`scripts/preflight-secrets-check.sh` enforce non-empty values pre-deploy.

---

## Required rotation (post-incident)

The following accounts MUST have their password rotated **before the next
NOTIVISA session**, because the previous values were committed in plaintext:

- `gqlabclin@gmail.com` — NOTIVISA portal (Gestor de Qualidade)
- `drogafarto@gmail.com` — Gestor / RT account

Rotation owner: CTO (drogafarto@gmail.com).
Tracking issue: see PHASE_5_SECURITY_REPORT.md § Remediation.

---

## Git history remediation (PENDING USER APPROVAL)

The credential blob landed in commit `af0be47` (2026-05-08). To purge it:

```bash
# 1. Mirror clone for safety
git clone --mirror https://github.com/<org>/<repo> repo-mirror.git
cd repo-mirror.git

# 2. Use git-filter-repo (NOT filter-branch — deprecated)
pip install git-filter-repo
git filter-repo \
  --path docs/NOTIVISA_CREDENCIAIS_AUDIT.md \
  --path src/features/notivisa-portal/NOTIVISA_CREDENTIALS.md \
  --invert-paths

# 3. Force-push rewritten history (DESTRUCTIVE — coordinate with team)
git push --force --all
git push --force --tags

# 4. Notify all clones to re-clone:
#    git fetch + git reset will NOT work; old history remains in reflogs.
```

**Why we have not run this yet:** force-pushing main rewrites every SHA
post-`af0be47`, breaks every open PR, and forces every developer to
re-clone. Requires explicit CTO approval + team coordination window.

**Interim mitigation:** rotate the exposed credentials NOW. Once rotated,
the historical plaintext is no longer a live secret — the urgency drops
from P0 to P2 (history hygiene).

---

## Audit trail

- 2026-05-08 11:51 BRT — Credentials committed in plaintext (`af0be47`)
- 2026-05-08 ~ — Phase 5 security audit identified exposure
- 2026-05-08 ~ — Working-tree files redacted to this stub (this commit)
- TBD — Credentials rotated in NOTIVISA portal
- TBD — `git filter-repo` executed (CTO approval gate)

Contact: drogafarto@gmail.com (CTO)
