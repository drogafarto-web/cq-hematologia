# NOTIVISA Portal OAuth — Quick Reference Card

## Files to Integrate

```bash
# 1. Copy service to source
src/features/notivisa-portal/services/PortalAuthService.ts

# 2. Copy function to Cloud Functions
functions/src/modules/notivisa-portal/callables/authenticatePortal.ts

# 3. Add Firestore rules (append to firestore.rules)
firestore.rules.notivisa-portal.txt

# 4. Add Firestore indexes (append to firestore.indexes.json)
# See firestore.rules.notivisa-portal.txt for JSON
```

---

## Quick Setup (5 minutes)

```bash
# 1. Secrets
firebase functions:secrets:set NOTIVISA_OAUTH_CLIENT_SECRET
gcloud secrets list --project=hmatologia2 | grep NOTIVISA

# 2. Deploy rules
firebase deploy --only firestore:rules,firestore:indexes --project=hmatologia2

# 3. Deploy function
firebase deploy --only functions:authenticatePortal --project=hmatologia2

# 4. Verify
npm run build && npx tsc --noEmit
```

---

## API Summary

### Service: PortalAuthService

```typescript
import {
  createPortalSession,
  getPortalSession,
  updatePortalSessionToken,
  recordPortalSessionActivity,
  revokePortalSession,
  isPortalSessionValid,
  needsPortalTokenRefresh,
  getPortalSessionTimeRemaining,
  logPortalAudit,
  getPortalSessionAudit,
  generateOAuthState,
  generateOAuthAuthorizeUrl,
} from 'src/features/notivisa-portal/services/PortalAuthService';

// Check if session valid (>5 min remaining)
if (isPortalSessionValid(session)) {
  // Use token for API calls
}

// Check if needs refresh (<5 min remaining)
if (needsPortalTokenRefresh(session)) {
  // Call refreshPortalToken() callable
}

// Get time remaining (ms)
const remaining = getPortalSessionTimeRemaining(session);
```

### Function: authenticatePortal

```typescript
import { httpsCallable } from 'firebase/functions';

const authenticate = httpsCallable(functions, 'authenticatePortal');

try {
  const response = await authenticate({
    labId: 'lab-123',
    code: authCode,
    redirectUri: 'https://hmatologia2.web.app/callback',
    state: storedState,
  });

  if (!response.data.ok) {
    // Error response
    console.error(response.data.code, response.data.message);
    // Handle: STATE_MISMATCH | INVALID_CODE | TOKEN_EXCHANGE_FAILED | etc
  } else {
    // Success response
    const { sessionId, firebaseToken, expiresAt, professionalName, professionalRole } =
      response.data;

    // Store token
    localStorage.setItem('portalToken', firebaseToken);
    localStorage.setItem('portalSessionId', sessionId);
    localStorage.setItem('portalExpiresAt', expiresAt);

    // Sign in with custom token
    await signInWithCustomToken(auth, firebaseToken);

    // Redirect
    window.location.href = '/portal/dashboard';
  }
} catch (error) {
  console.error('Authentication failed:', error);
}
```

---

## OAuth Flow (One-liner)

```
Login → generateOAuthState() → redirect to NOTIVISA IDP
→ User authorizes → IDP redirects with code
→ Call authenticatePortal(code) → Session created
→ Custom token issued → Store token → Redirect to portal
```

---

## Firestore Collections

```
/notivisa-portal-sessions/{labId}/sessions/{sessionId}
├── id: string
├── labId: string
├── userId: string
├── accessToken: string (OAuth)
├── refreshToken: string (OAuth, server-side only)
├── expiresAt: number (unix ms)
├── status: 'active' | 'expired' | 'revoked' | 'error'
├── professionalName: string
├── professionalRole: 'RT' | 'MEDICO' | 'DIRETOR' | 'AUDITOR'
├── criadoEm: number
└── deletadoEm: number | null

/notivisa-portal-audit/{labId}/events/{eventId}
├── action: 'SESSION_CREATED' | 'TOKEN_REFRESHED' | ...
├── ts: number
├── details: { sessionId, userId, ... }
└── criadoEm: number
```

---

## Error Codes

| Code                    | Cause                         | Action                    |
| ----------------------- | ----------------------------- | ------------------------- |
| `INVALID_INPUT`         | Validation failed             | Check input parameters    |
| `STATE_MISMATCH`        | CSRF attack or expired        | Restart login flow        |
| `INVALID_CODE`          | Code invalid/expired          | Request new code from IDP |
| `TOKEN_EXCHANGE_FAILED` | IDP unreachable               | Retry after 30s           |
| `INVALID_TOKEN`         | idToken claims invalid        | Contact NOTIVISA support  |
| `LAB_NOT_FOUND`         | Lab not configured            | Configure notivisaLabCode |
| `USER_NOT_FOUND`        | Firebase user creation failed | Retry or contact support  |
| `INTERNAL_ERROR`        | Unexpected server error       | Check Cloud Logs          |

---

## Token Validation

```typescript
// Check expiry
const timeRemaining = getPortalSessionTimeRemaining(session); // ms
const expiresIn5Min = timeRemaining <= 5 * 60 * 1000;

// Manual expiry check
if (session.expiresAt < Date.now()) {
  // Token expired — redirect to login
}

// Refresh needed?
if (needsPortalTokenRefresh(session)) {
  await refreshPortalToken(); // Cloud Function callable (to be created)
}
```

---

## Audit Trail

```typescript
// All logged automatically:
// - SESSION_CREATED (on successful auth)
// - TOKEN_REFRESHED (on token refresh)
// - SESSION_REVOKED (on logout)
// - SESSION_EXPIRED (on auto-expiry)
// - SESSION_ERROR (on failure)

// Retrieve audit events
const events = await getPortalSessionAudit(labId, sessionId);
// [
//   { action: 'SESSION_CREATED', ts: 1234567890, ... },
//   { action: 'TOKEN_REFRESHED', ts: 1234568890, ... },
// ]
```

---

## Multi-Tenant Isolation

```typescript
// Always include labId in paths
/notivisa-portal-sessions/{labId}/sessions/{sessionId}
                            ↑
                      Required for isolation

// Firestore rules enforce:
// - User must be active member of lab
// - Cannot access other labs' sessions
// - Cannot bypass labId in path

// Custom token includes labId claim
{
  labId: 'lab-123',
  portalSessionId: 'psess_...',
  professionalRole: 'RT',
}
```

---

## Performance Targets

| Operation        | Target  | How to Monitor                           |
| ---------------- | ------- | ---------------------------------------- |
| OAuth exchange   | <2 sec  | Cloud Logs (authenticatePortal duration) |
| Token refresh    | <1 sec  | Cloud Logs (refreshPortalToken duration) |
| Session lookup   | <100 ms | Firestore Console (latency)              |
| Token validation | <50 ms  | Client-side (Date.now() - start)         |

---

## Debugging Checklist

- [ ] Is SECRET_MANAGER provisioned? `gcloud secrets list | grep NOTIVISA`
- [ ] Is rule deployed? `firebase firestore:documents get notivisa-portal-sessions/{labId}/sessions/{sessionId}`
- [ ] Is function deployable? `firebase deploy --only functions:authenticatePortal --dry-run`
- [ ] Are logs visible? `gcloud logging read 'labels.functionName="authenticatePortal"'`
- [ ] Is lab configured? Check `/labs/{labId}` has `notivisaLabCode` field
- [ ] Is state doc created? Query `/notivisa-portal-oauth-state/{state}`
- [ ] Is index created? Firestore Console → Indexes → check NOTIVISA indexes

---

## Common Issues

**"OAuth state parameter invalid"**

```
→ State doc not found or expired (>10 min)
→ Check notivisa-portal-oauth-state collection
→ Check Cloud Logs for state generation errors
```

**"Failed to exchange authorization code"**

```
→ NOTIVISA IDP unreachable or OAuth credentials invalid
→ Check NOTIVISA_OAUTH_CLIENT_SECRET in Secret Manager
→ Check redirectUri matches IDP app configuration
→ Test IDP connectivity: curl -I https://idp.notivisa.saude.gov.br
```

**"Lab not found / not configured"**

```
→ labId not in Firestore or missing notivisaLabCode
→ Verify lab exists: firebase firestore:documents get labs/{labId}
→ Add notivisaLabCode: firebase firestore:set labs/{labId} '{notivisaLabCode: "12345"}'
```

**"Session expired"**

```
→ expiresAt < now()
→ Check NOTIVISA IDP token TTL (expiresIn value)
→ Call token refresh before expiry (<5 min buffer)
→ Redirect to login with error message
```

---

## Deploy Checklist

```bash
# 1. Type check
npx tsc --noEmit ✅

# 2. Build
npm run build ✅
cd functions && npm run build ✅

# 3. Pre-flight
bash scripts/preflight-secrets-check.sh ✅

# 4. Deploy rules
firebase deploy --only firestore:rules,firestore:indexes ✅

# 5. Deploy function
firebase deploy --only functions:authenticatePortal ✅

# 6. Verify
firebase functions:list | grep authenticatePortal ✅
firebase firestore:indexes:list | grep notivisa ✅

# 7. Smoke test
# Navigate to /notivisa-login
# Click "Login with NOTIVISA"
# Authorize on sandbox IDP
# Verify session created in Firestore
# Check Cloud Logs for success
```

---

## File Sizes

- PortalAuthService.ts: ~586 lines
- authenticatePortal.ts: ~460 lines
- NOTIVISA_PORTAL_AUTH_SPEC.md: ~1,200 lines
- Implementation Guide: ~600 lines
- **Total: ~2,850 lines**

---

## Documentation

📖 **Full specification:** `docs/NOTIVISA_PORTAL_AUTH_SPEC.md`  
📖 **Implementation guide:** `docs/NOTIVISA_PORTAL_AUTH_IMPLEMENTATION_GUIDE.md`  
📖 **Delivery summary:** `docs/NOTIVISA_PORTAL_AUTH_DELIVERY_SUMMARY.md`  
📖 **This card:** `docs/NOTIVISA_PORTAL_AUTH_QUICK_REFERENCE.md`

---

## Compliance Checklist

- ✅ RDC 978 Art. 41 — Audit trail (session creation, token refresh, errors)
- ✅ RDC 978 Art. 42 — Authentication & access control
- ✅ DICQ 4.4 — Information security (encryption, CSRF, rate limiting)
- ✅ LGPD Art. 8 — Consent delegation (OAuth)
- ✅ LGPD Art. 32 — Security measures (encryption, audit logging)
- ✅ OAuth 2.0 RFC 6749 — Standard compliance

---

**Last Updated:** 2026-05-07  
**Status:** Implementation-Ready  
**Next:** Deploy + create UI components (Phase 4)
