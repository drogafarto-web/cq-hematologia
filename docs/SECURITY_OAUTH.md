# SECURITY — OAuth Token Lifecycle (SGD Drive Importer)

**Scope:** `functions/src/sgq/_drive/oauthClient.ts` + `functions/src/sgq/oauthCallbackDrive.ts`
**Status:** Production · post SECURITY_AUDIT.md #1, #2 fixes (2026-05-06)
**Owner:** SGQ module + platform security

---

## Token storage

| Token             | Where                                                         | Encryption at rest                                   | Expiry                                                           |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| `refresh_token`   | `/labs/{labId}/sgq-oauth-tokens/{userId}.refreshToken`        | GCP Firestore default (AES-256, Google-managed keys) | Until user revokes via Drive consent screen                      |
| `access_token`    | `/labs/{labId}/sgq-oauth-tokens/{userId}.accessToken` (cache) | GCP Firestore default                                | `expiresAt` absolute Timestamp; refreshed when < 5 min remaining |
| OAuth state token | `/labs/{labId}/sgq-oauth-pending/{stateHex}`                  | GCP Firestore default                                | 10 min TTL, deleted on first validation                          |

### Why Firestore (interim) instead of Secret Manager

The audit recommended Google Secret Manager (GSM) for the refresh token. We
deferred this to a follow-up because:

1. **Per-user tokens are not a great fit for GSM.** GSM is designed for a
   bounded set of secrets; one secret per user across N labs creates an
   unbounded namespace and makes IAM auditing harder.
2. **Firestore default encryption is AES-256 with Google-managed keys**, the
   same envelope GSM uses. The threat boundary is a Firestore-rules bypass,
   which is mitigated by `allow read,write: if false` on `sgq-oauth-tokens`
   for all client SDKs (only Cloud Functions Admin SDK can touch it).
3. **CMEK migration path is open**: when a tenant requires a Customer-Managed
   Encryption Key, we can move just the `sgq-oauth-tokens` subcollection to a
   CMEK-protected database without changing the call sites.

Future: if a single shared Drive credential is adopted (instead of per-user),
move that one secret to GSM with rotation via Cloud Scheduler.

## Return-value contract

`getAccessToken(labId, userId): Promise<string>` always returns a **short-lived
access token** (1 h max). It NEVER returns the refresh token. Audit log per
SECURITY_AUDIT.md #1 verified after fix.

`exchangeCodeForTokens(...)` writes both tokens to Firestore and returns only
the access token + expiresIn ms.

## Rotation policy

| Event                                                      | Action                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Access token < 5 min from expiry                           | Auto-refresh on next `getAccessToken()` call; cache new access token + new `expiresAt`                                              |
| User revokes access in Google account                      | Next refresh fails → caller sees error → web app prompts re-authorization                                                           |
| Refresh token suspected compromised                        | Manual: `firebase firestore:delete labs/{labId}/sgq-oauth-tokens/{userId}` then user re-authorizes                                  |
| Suspicious activity (e.g., > 3 refresh failures in 1 hour) | TODO Sprint 2: alerting hook on `sgq-oauth-logs` event = `oauth-refresh-failed`                                                     |
| Quarterly key rotation (CMEK)                              | If CMEK enabled, follow [Cloud KMS rotation docs](https://cloud.google.com/kms/docs/rotating-keys); 90-day rotation cadence default |

## State token (CSRF) lifecycle

1. Web app calls `generateStateToken(labId, userId)` from authenticated context.
   `state = crypto.randomBytes(32).toString('hex')` (64 hex chars, 256 bits).
2. State written to `/labs/{labId}/sgq-oauth-pending/{state}` with `expiresAt = now + 10 min`.
3. User redirected to Google with `?state=…&labId=…&userId=…`.
4. Google calls back with `?code=…&state=…&labId=…&userId=…`.
5. `validateStateToken(state, labId, userId)`:
   - Rejects if state isn't 64 lowercase hex chars (anti-injection)
   - Rejects if doc doesn't exist (anti-CSRF)
   - Rejects if stored labId/userId mismatch query (anti cross-tenant)
   - Rejects if `expiresAt < now` (anti late-replay)
   - **Deletes the doc on success** (anti-replay)
6. All rejections logged to `sgq-oauth-logs` with `event = 'oauth-state-invalid'`
   and `reason ∈ {malformed_state, non_hex_state, state_not_found, tenant_mismatch, state_expired}`.

## Audit events

All written to `/labs/{labId}/sgq-oauth-logs`:

| event                   | When                                  | Fields                                              |
| ----------------------- | ------------------------------------- | --------------------------------------------------- |
| `oauth-tokens-granted`  | Successful code → token exchange      | userId, expiresAt, timestamp                        |
| `oauth-token-refreshed` | Successful refresh from refresh_token | userId, expiresAt, timestamp                        |
| `oauth-state-invalid`   | Any state validation failure          | userId, reason, statePrefix, stateSuffix, timestamp |
| `oauth-authorized`      | Successful end-to-end OAuth flow      | userId, expiresIn, ipAddress, timestamp             |

## Threat model (post-fix)

| Threat                                         | Mitigation                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| CSRF on callback                               | State token (256 bits) + tenant binding + 10 min TTL + one-time use |
| Cross-tenant hijack via labId/userId tampering | State doc binds labId+userId; mismatch → reject + log               |
| Replay of stale OAuth callback                 | State deleted on first use; `expiresAt < now` rejected              |
| Refresh token leak via function return value   | `getAccessToken()` never returns refresh token                      |
| Brute-force callback (DOS / state-guessing)    | Per-IP 10/min rate limit; 256-bit state space defeats guessing      |
| State token observable in logs                 | Logger writes only first/last 4 chars                               |
| Headers / framing attacks                      | X-Frame-Options DENY, CSP, HSTS, X-Content-Type-Options             |
| Stale access token cached past expiry          | Refresh-on-read with 5 min margin; absolute Timestamp not relative  |

## Open follow-ups (deferred from SECURITY_AUDIT.md)

- [ ] #2.b — Secret Manager migration for shared service-account scenarios (if adopted)
- [ ] #9 — Token lifecycle diagram in Mermaid (this doc covers the textual flow)
- [ ] Sprint 2 — alerting on > 3 refresh failures / hour per user
- [ ] Sprint 2 — quarterly drill: revoke + re-authorize end-to-end test in staging
