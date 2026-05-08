# NOTIVISA Portal — Credentials & Access Guide (REDACTED)

> **SECURITY INCIDENT 2026-05-08:** This file previously contained
> plaintext NOTIVISA portal passwords and was committed to git in
> commit `af0be47`. Working-tree contents have been redacted. Git
> history still exposes the original values until `git filter-repo`
> is executed under CTO approval — see
> `docs/NOTIVISA_CREDENCIAIS_AUDIT.md` for the full remediation log.

---

## How to get credentials at runtime

All NOTIVISA credentials are stored in **Firebase Secret Manager** and
accessed only from Cloud Functions via `defineSecret()`. They are
**never** committed to source control.

| Secret | Purpose |
|--------|---------|
| `NOTIVISA_PORTAL_EMAIL` | Gestor email for portal automation |
| `NOTIVISA_PORTAL_PASSWORD` | Gestor password for portal automation |
| `NOTIVISA_CLIENT_ID` | OAuth client ID for the SOAP/REST API |
| `NOTIVISA_CLIENT_SECRET` | OAuth client secret |
| `NOTIVISA_WEBHOOK_SECRET` | HMAC signing secret for inbound webhooks |

To provision:

```bash
firebase functions:secrets:set NOTIVISA_CLIENT_SECRET --project hmatologia2
```

The deploy gate `scripts/preflight-secrets-check.sh` (ADR-0018) blocks
any `firebase deploy --only functions` if any of these resolve to a
`PENDING_SET_*` placeholder.

---

## Where to find docs (non-sensitive)

- Sandbox URL pattern, rate-limit defaults, retry backoff schedule:
  `functions/src/modules/notivisa/` (source of truth — code).
- Webhook endpoint contract:
  `functions/src/modules/notivisa/callables/notivisaWebhookHandler.ts`.
- Lab-scoped configuration (clientId reference, NOT the secret value):
  `/labs/{labId}/notivisa-config/sandbox` Firestore doc.
- ANVISA support: `0800-642-9782` (seg–sex 7:30–19:30) /
  `cadastro.sistemas@anvisa.gov.br`.

---

## Credential rotation (post-incident)

Following the 2026-05-08 exposure, these credentials MUST be rotated
before the next NOTIVISA session:

- Portal account `gqlabclin@gmail.com` — rotate password directly in
  the NOTIVISA portal, then `firebase functions:secrets:set
  NOTIVISA_PORTAL_PASSWORD`.
- Gestor account `drogafarto@gmail.com` — same procedure.
- API Client Secret — request a new pair from ANVISA via
  `cadastro.sistemas@anvisa.gov.br`, then update
  `NOTIVISA_CLIENT_SECRET`.

Rotation owner: CTO. Tracking: `PHASE_5_SECURITY_REPORT.md`.

---

## Why this file exists at all

The `notivisa-portal` feature directory ships to git, so every engineer
working on portal integration sees this README. It must contain zero
secrets; instead it tells engineers exactly which secret-name to look
up in Firebase Secret Manager and how to provision a fresh one.

If you find yourself about to paste a password into any `.md`, `.ts`,
or `.json` file under `src/` or `docs/` — **stop**. Use Secret Manager.
