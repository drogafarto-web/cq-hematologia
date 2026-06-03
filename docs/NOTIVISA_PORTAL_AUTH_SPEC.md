# NOTIVISA Portal OAuth/Credential Authentication — Complete Specification

**Version:** 1.0  
**Date:** 2026-05-07  
**Status:** Implementation-Ready  
**Author:** CTO / Engineering Lead  
**Compliance:** RDC 978 Art. 41 (timely reporting), DICQ 4.4 (audit trail), LGPD Art. 32 (information security), OAuth 2.0 spec

---

## 1. Overview

NOTIVISA Portal Auth provides unified OAuth 2.0 authentication layer for healthcare professionals (RT, physicians, auditors) accessing NOTIVISA government API for adverse event reporting.

### Key Features

- **OAuth 2.0 Authorization Code Flow** — secure code exchange with NOTIVISA IDP
- **Token Refresh** — automatic token renewal with expiry tracking
- **Multi-Session Management** — one user, multiple labs, independent sessions
- **Secure Token Storage** — OAuth tokens encrypted at rest via Firebase
- **Custom Firebase Tokens** — client-side session tokens with embedded claims
- **Audit Trail** — all OAuth events logged (RDC 978 Art. 41 compliance)
- **Error Recovery** — rate limiting, retry logic, graceful degradation
- **Firestore Rules** — multi-tenant session isolation, role-based access

---

## 2. Architecture Overview

### 2.1 Components

```
┌──────────────────┐
│   Healthcare     │
│   Professional   │  (RT, Physician, Auditor)
└────────┬─────────┘
         │
         │ 1. Clicks "Login with NOTIVISA"
         │
         v
┌──────────────────────────────┐
│  HC Quality Portal Web       │  Initiates OAuth flow
│  - generates state param     │  - redirects to NOTIVISA IDP
└────────┬─────────────────────┘
         │
         │ 2. Authorizes access
         │
         v
┌──────────────────────────────┐
│  NOTIVISA IDP                │  OAuth 2.0 provider
│  (Government server)         │
└────────┬─────────────────────┘
         │
         │ 3. Redirects with auth code
         │
         v
┌──────────────────────────────┐
│  HC Quality Portal Web       │
│  - calls authenticatePortal()│  Cloud Function callable
└────────┬─────────────────────┘
         │
         │ 4. Exchanges code for token
         │
         v
┌──────────────────────────────┐
│  Cloud Function Backend      │
│  - validates state           │  - exchanges OAuth code
│  - extracts idToken claims   │  - creates session in Firestore
│  - issues custom Firebase token
└────────┬─────────────────────┘
         │
         │ 5. Returns session + custom token
         │
         v
┌──────────────────────────────┐
│  HC Quality Portal Web       │
│  - stores custom token       │  localStorage or sessionStorage
│  - redirects to /portal      │
└────────┬─────────────────────┘
         │
         │ 6. Uses custom token for API calls
         │
         v
┌──────────────────────────────┐
│  NOTIVISA API Gateway        │
│  - validates Firebase token  │  Subsequent requests
│  - checks session active     │  - checks token expiry
│  - calls NOTIVISA services   │
└──────────────────────────────┘
```

### 2.2 Data Flow

#### Login Flow

1. Professional navigates to `/portal/login`
2. Frontend generates OAuth state parameter: `state = generateOAuthState()`
3. Frontend redirects to NOTIVISA IDP:
   ```
   GET https://idp.notivisa.saude.gov.br/oauth/authorize?
     client_id=<ID>
     redirect_uri=https://portal.hmatologia2.web.app/callback
     response_type=code
     scope=notivisa:read%20notivisa:write
     state=<state>
   ```
4. Professional authorizes access on IDP
5. IDP redirects back with authorization code:
   ```
   https://portal.hmatologia2.web.app/callback?
     code=<code>
     state=<state>
   ```
6. Frontend extracts code, calls Cloud Function:
   ```typescript
   const response = await httpsCallable(
     functions,
     'authenticatePortal',
   )({
     labId: selectedLabId,
     code: authCode,
     redirectUri: window.location.origin + '/callback',
     state: storedState,
   });
   ```
7. Function validates state, exchanges code for OAuth token
8. Function creates session document in Firestore
9. Function issues custom Firebase token with embedded OAuth claims
10. Frontend stores token, redirects to `/portal/dashboard`
11. Subsequent API calls attach custom token to `Authorization` header

#### Token Refresh Flow

1. Client detects token expiry approaching (<5 min remaining)
2. Client calls `refreshPortalToken()` callable with:
   ```typescript
   {
     labId,
     sessionId,
     refreshToken,
   }
   ```
3. Function validates session, calls NOTIVISA token endpoint
4. Function updates session with new access token
5. Function returns updated token to client
6. Client stores new token, continues API calls

#### Session Expiry Flow

1. Cloud Scheduler cron runs daily: `cleanupExpiredPortalSessions()`
2. Cron queries sessions with `expiresAt < now && status == 'active'`
3. Cron marks matching sessions as expired
4. Client-side token validation catches expired tokens
5. Client redirects to login with error message

---

## 3. API Reference

### 3.1 Client-Side Service: PortalAuthService

Location: `src/features/notivisa-portal/services/PortalAuthService.ts`

#### Session Management

```typescript
// Create session (called by Cloud Function after OAuth exchange)
async function createPortalSession(
  labId: string,
  userId: string,
  oauthToken: PortalOAuthToken,
  professionalInfo: {
    id: string;
    name: string;
    email: string;
    role: 'RT' | 'MEDICO' | 'DIRETOR' | 'AUDITOR';
  },
  notivisaLabCode: string,
  ipAddress: string,
  userAgent: string,
): Promise<PortalSession>;

// Get active session
async function getPortalSession(labId: string, sessionId: string): Promise<PortalSession | null>;

// List all active sessions for user (across labs)
async function getUserPortalSessions(userId: string): Promise<PortalSession[]>;

// Update token after refresh
async function updatePortalSessionToken(
  labId: string,
  sessionId: string,
  newAccessToken: string,
  newRefreshToken: string | undefined,
  expiresIn: number,
): Promise<void>;

// Record activity (for lastActivityAt tracking)
async function recordPortalSessionActivity(labId: string, sessionId: string): Promise<void>;

// Revoke session (immediate logout)
async function revokePortalSession(
  labId: string,
  sessionId: string,
  reason?: string,
): Promise<void>;

// Mark expired (after expiresAt reached)
async function markPortalSessionExpired(labId: string, sessionId: string): Promise<void>;

// Record error on session
async function recordPortalSessionError(
  labId: string,
  sessionId: string,
  error: string,
): Promise<void>;
```

#### Token Validation

```typescript
// Check if session token still valid (>5 min remaining)
function isPortalSessionValid(session: PortalSession): boolean;

// Check if token needs refresh (<5 min remaining)
function needsPortalTokenRefresh(session: PortalSession): boolean;

// Get time remaining (ms)
function getPortalSessionTimeRemaining(session: PortalSession): number;
```

#### OAuth Utilities

```typescript
// Generate CSRF-protection state parameter
function generateOAuthState(): string;

// Generate NOTIVISA IDP authorization URL
function generateOAuthAuthorizeUrl(
  idpBaseUrl: string,
  clientId: string,
  redirectUri: string,
  labId: string,
  state: string,
): string;

// Validate OAuth token structure
function validateOAuthToken(token: PortalOAuthToken): boolean;

// Validate session document format
function validatePortalSession(session: PortalSession): boolean;
```

#### Audit Trail

```typescript
// Log OAuth event
async function logPortalAudit(
  labId: string,
  action:
    | 'SESSION_CREATED'
    | 'TOKEN_REFRESHED'
    | 'SESSION_REVOKED'
    | 'SESSION_EXPIRED'
    | 'SESSION_ERROR'
    | 'AUTH_FAILED'
    | 'API_CALL_MADE',
  details: Record<string, unknown>,
  operatorId?: string,
): Promise<void>;

// Retrieve audit events for session
async function getPortalSessionAudit(
  labId: string,
  sessionId: string,
  limit: number = 50,
): Promise<PortalAuditEvent[]>;
```

#### Cleanup

```typescript
// Mark expired sessions (called by Cloud Scheduler)
async function cleanupExpiredPortalSessions(labId: string): Promise<number>;
```

### 3.2 Cloud Function Callable: authenticatePortal

Location: `functions/src/modules/notivisa-portal/callables/authenticatePortal.ts`

**Trigger:** Client calls `httpsCallable(functions, 'authenticatePortal')`  
**Region:** `southamerica-east1`

#### Request

```typescript
interface AuthenticatePortalRequest {
  labId: string; // Lab ID (from localStorage or UI selection)
  code: string; // OAuth authorization code from IDP
  redirectUri: string; // Must match OAuth app configuration
  state: string; // CSRF protection (matches generateOAuthState())
}
```

#### Response (Success)

```typescript
interface AuthenticatePortalResponse {
  ok: true;
  sessionId: string; // Firestore session ID
  firebaseToken: string; // Custom Firebase token (use in Authorization header)
  expiresAt: number; // unix timestamp (ms) when token expires
  professionalName: string;
  professionalRole: 'RT' | 'MEDICO' | 'DIRETOR' | 'AUDITOR';
}
```

#### Response (Error)

```typescript
interface AuthenticatePortalError {
  ok: false;
  code:
    | 'INVALID_INPUT' // Validation error on request
    | 'UNAUTHORIZED' // Not authenticated (auth guard)
    | 'INVALID_CODE' // Auth code invalid/expired
    | 'TOKEN_EXCHANGE_FAILED' // NOTIVISA IDP unreachable or rejected
    | 'INVALID_TOKEN' // idToken claims invalid
    | 'LAB_NOT_FOUND' // Lab doesn't exist or not configured
    | 'USER_NOT_FOUND' // Firebase user creation failed
    | 'STATE_MISMATCH' // CSRF state validation failed
    | 'INTERNAL_ERROR'; // Unexpected server error
  message: string; // Human-readable error description
}
```

#### Behavior

1. **Input Validation:** Validates `labId`, `code`, `redirectUri`, `state` against schema
2. **State Validation:** Checks state document exists, matches labId/redirectUri, not expired (10 min)
3. **Lab Verification:** Confirms lab exists and has `notivisaLabCode` configured
4. **Token Exchange:** POST to NOTIVISA IDP token endpoint with authorization code
5. **idToken Parsing:** Extracts JWT claims (professional ID, name, email, role)
6. **User Management:** Creates or retrieves Firebase user by email
7. **Session Creation:** Creates Firestore document with OAuth token + metadata
8. **Token Issuance:** Issues custom Firebase token with embedded claims
9. **Audit Logging:** Logs successful authentication event
10. **Error Handling:** Returns typed error responses with retry suggestions

#### Example Client Usage

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const storedState = sessionStorage.getItem('oauth_state');

  if (state !== storedState) {
    throw new Error('State mismatch — possible CSRF attack');
  }

  const authenticate = httpsCallable(functions, 'authenticatePortal');

  try {
    const response = await authenticate({
      labId: selectedLabId,
      code,
      redirectUri: window.location.origin + '/callback',
      state,
    });

    if (!response.data.ok) {
      throw new Error(response.data.message);
    }

    // Store token and session
    localStorage.setItem('portalToken', response.data.firebaseToken);
    localStorage.setItem('portalSessionId', response.data.sessionId);
    localStorage.setItem('portalExpiresAt', response.data.expiresAt);

    // Sign in with custom token
    await signInWithCustomToken(auth, response.data.firebaseToken);

    // Redirect to portal
    window.location.href = '/portal/dashboard';
  } catch (error) {
    console.error('Authentication failed:', error);
    setErrorMessage(error.message);
  }
}
```

---

## 4. Firestore Schema

### 4.1 Portal Sessions Collection

```
/notivisa-portal-sessions/{labId}/sessions/{sessionId}
```

**Document Structure:**

```typescript
interface PortalSession {
  // Identity
  id: string; // Session ID (auto-generated)
  labId: string; // Lab ID (multi-tenant key)
  userId: string; // Firebase user ID

  // OAuth Token Data
  accessToken: string; // Bearer token for NOTIVISA API
  refreshToken: string; // For token refresh (server-side use only)
  tokenType: 'Bearer'; // Always 'Bearer'
  scope: string; // 'notivisa:read notivisa:write'

  // Token Lifecycle
  issuedAt: number; // unix timestamp (ms) when issued
  expiresAt: number; // unix timestamp (ms) when expires
  refreshedAt: number | null; // unix timestamp (ms) of last refresh

  // Professional Identity (from NOTIVISA idToken)
  professionalId: string; // CREMESP/CRN/etc ID
  professionalName: string; // Full name
  professionalEmail: string; // Email (unique across labs)
  professionalRole: 'RT' | 'MEDICO' | 'DIRETOR' | 'AUDITOR';

  // Lab Configuration
  notivisaLabCode: string; // Lab's NOTIVISA registration code

  // Connection Metadata
  connectedAt: number; // unix timestamp (ms) of first login
  lastActivityAt: number; // unix timestamp (ms) of last API call

  // Security
  ipAddress: string; // Client IP (for fraud detection)
  userAgent: string; // Client user agent

  // Status
  status: 'active' | 'expired' | 'revoked' | 'error';
  errorMessage: string | null; // Error reason if status != 'active'

  // Audit
  assinatura?: {
    // Optional logical signature (RDC 978)
    hash: string; // HMAC-SHA256 (64 hex chars)
    operatorId: string; // User who created session
    ts: number; // unix timestamp (ms)
  };

  // Metadata
  criadoEm: number; // unix timestamp (ms)
  atualizadoEm: number; // unix timestamp (ms)
  deletadoEm: number | null; // unix timestamp (ms) if soft-deleted
}
```

**Indexes Required:**

```
1. (userId, status) — query user's active sessions
2. (status, lastActivityAt) — idle session detection
3. (status, expiresAt) — expiry cleanup cron
```

### 4.2 Portal Audit Events Collection

```
/notivisa-portal-audit/{labId}/events/{eventId}
```

**Document Structure:**

```typescript
interface PortalAuditEvent {
  id: string; // Event ID
  labId: string; // Lab ID
  action:
    | 'SESSION_CREATED' // OAuth authentication succeeded
    | 'TOKEN_REFRESHED' // Token refresh succeeded
    | 'SESSION_REVOKED' // User logged out
    | 'SESSION_EXPIRED' // Token expiry reached
    | 'SESSION_ERROR' // Token refresh failed
    | 'AUTH_FAILED' // OAuth flow failed
    | 'API_CALL_MADE'; // Professional called NOTIVISA API

  ts: number; // unix timestamp (ms)
  details: {
    sessionId?: string;
    userId?: string;
    professionalEmail?: string;
    professionalRole?: string;
    notivisaLabCode?: string;
    expiresIn?: number;
    error?: string;
    [key: string]: unknown;
  };

  operatorId?: string; // Firebase user ID (if applicable)

  // Audit
  criadoEm: number;
  deletadoEm: number | null;
}
```

**Indexes Required:**

```
1. (action, ts) — audit events by action type
```

### 4.3 OAuth State Parameter Storage (Temporary)

```
/notivisa-portal-oauth-state/{state}
```

**Document Structure:**

```typescript
interface OAuthStateDoc {
  labId: string;
  redirectUri: string;
  createdAt: number; // unix timestamp (ms)
  // Expires after 10 minutes (TTL delete via Cloud Task)
}
```

**Lifecycle:**

- Created when frontend initiates OAuth flow
- Deleted when callback processed (or after 10 min expiry)
- Never queried, only point-lookup

---

## 5. Security Specifications

### 5.1 Token Storage & Protection

**Access Tokens (NOTIVISA OAuth):**

- Encrypted at rest by Firebase (default encryption)
- Never exposed to client-side JavaScript
- Server-side only (Cloud Functions)
- Stored in Firestore under auth-protected rules

**Custom Firebase Tokens:**

- Issued by `admin.auth().createCustomToken()`
- Embedded with session ID + professional role + lab ID
- 1-hour default TTL (configurable)
- Signed with Firebase service account private key
- Client stores in localStorage or sessionStorage

**Refresh Tokens:**

- Never transmitted to client
- Server-side only (Cloud Functions)
- Used exclusively for token refresh operation
- Stored encrypted in Firestore

### 5.2 Multi-Tenant Isolation

**Path Structure:**

```
/notivisa-portal-sessions/{labId}/sessions/{sessionId}
/notivisa-portal-audit/{labId}/events/{eventId}
```

**Firestore Rules Enforcement:**

- Read: `isActiveMemberOfLab(labId) AND (owner OR auditor)`
- Create/Update: Cloud Function only (`allow create/update: if false`)
- No cross-tenant access possible (labId in path)

**Custom Token Claims:**

```typescript
{
  labId: string; // Claim limit to lab
  portalSessionId: string; // Link to session doc
  professionalRole: string; // Role-based access
  portalOAuthToken: {
    // Embedded OAuth details
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }
}
```

### 5.3 CSRF Protection (State Parameter)

**State Generation:**

```typescript
function generateOAuthState(): string {
  // 32 bytes random, hex-encoded
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0'),
  ).join('');
}
```

**Validation:**

1. Frontend generates state, saves to sessionStorage
2. Frontend includes state in OAuth redirect URL
3. NOTIVISA IDP returns state in callback
4. Frontend validates returned state matches saved state
5. Cloud Function validates state doc exists + not expired (10 min)
6. Cloud Function consumes state doc (one-time use)

### 5.4 Rate Limiting & Brute-Force Protection

**OAuth Token Exchange:**

- Max 5 failed attempts per IP per 15 minutes
- Implemented via Cloud Functions middleware
- Logs all failures to audit trail

**Token Refresh:**

- Max 10 refresh attempts per session per hour
- Prevents token refresh loop attacks

**Session Creation:**

- Max 10 sessions per user per lab
- Older inactive sessions auto-revoked

### 5.5 IP Whitelisting (Optional, Phase 5+)

For sensitive labs:

- Store `allowedIpRanges` in lab settings
- Validate `x-forwarded-for` header against ranges
- Block login if IP not in range
- Log blocked attempts to audit trail

---

## 6. Error Handling & Recovery

### 6.1 Error Categories

| Error Code              | Cause                         | Recovery                      |
| ----------------------- | ----------------------------- | ----------------------------- |
| `INVALID_INPUT`         | Request validation failed     | Retry with valid input        |
| `STATE_MISMATCH`        | CSRF check failed             | Restart OAuth flow            |
| `INVALID_CODE`          | Auth code expired/revoked     | Request new code from IDP     |
| `TOKEN_EXCHANGE_FAILED` | IDP unreachable               | Retry after 30s (backoff)     |
| `INVALID_TOKEN`         | idToken claims invalid        | Contact IDP support           |
| `LAB_NOT_FOUND`         | Lab not configured            | Verify lab ID + configuration |
| `USER_NOT_FOUND`        | Firebase user creation failed | Retry or contact support      |
| `INTERNAL_ERROR`        | Unexpected server error       | Log + retry after 60s         |

### 6.2 Client-Side Error Handling

```typescript
async function authenticateWithRetry(
  maxRetries: number = 3,
  backoffMs: number = 1000,
): Promise<AuthenticatePortalResponse> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await httpsCallable(functions, 'authenticatePortal')(request);

      if (!response.data.ok) {
        // Non-retryable error
        if (['INVALID_INPUT', 'STATE_MISMATCH'].includes(response.data.code)) {
          throw new Error(response.data.message);
        }

        // Retryable error
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
          continue;
        }
      }

      return response.data;
    } catch (error: any) {
      lastError = error;

      // Don't retry network errors on final attempt
      if (attempt === maxRetries - 1) {
        break;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
    }
  }

  throw lastError;
}
```

### 6.3 Server-Side Error Recovery

**Token Refresh Failure:**

```typescript
// If refresh fails 3 times consecutively:
// 1. Mark session as error status
// 2. Log error event to audit trail
// 3. Notify user to re-authenticate
// 4. Set auto-cleanup to 1 day (instead of 30 days)
```

**OAuth Token Exchange Timeout:**

```typescript
// If IDP doesn't respond within 10 seconds:
// 1. Return TOKEN_EXCHANGE_FAILED
// 2. Log timeout event
// 3. Client retries after 30s backoff
// 4. After 3 failures: suggest contacting IDP support
```

---

## 7. Compliance & Audit Trail

### 7.1 RDC 978 Art. 41 (Timely Adverse Event Reporting)

**Audit Trail Requirements:**

- ✅ Session creation logged (who authenticated, when, from where)
- ✅ Token refresh logged (when token rotated)
- ✅ API calls logged (which operations performed)
- ✅ Failures logged (auth failures, token expiry)
- ✅ Revocation logged (logout, admin revoke)

**Audit Fields:**

```
- ts: timestamp (RDC 978 5.3 — data/hora)
- operatorId: user ID (RDC 978 5.3 — identificação)
- action: operation (RDC 978 5.3 — tipo de acesso)
- details: context (RDC 978 5.3 — resultado)
```

### 7.2 DICQ 4.4 (Information Security)

**Authentication Security:**

- ✅ OAuth 2.0 standard (vs custom auth)
- ✅ Token encryption at rest
- ✅ HTTPS only (enforced by Firebase)
- ✅ CSRF protection (state parameter)
- ✅ Rate limiting (brute-force protection)

**Session Management:**

- ✅ Automatic expiry (no persistent sessions)
- ✅ Token refresh with new nonce
- ✅ Logout on demand (revoke)
- ✅ Idle timeout (48 hours via Cloud Scheduler)

### 7.3 LGPD Art. 32 (Information Security Measures)

**Technical Measures:**

- ✅ Encryption (at rest + in transit)
- ✅ Access control (Firestore rules)
- ✅ Audit logging (all OAuth events)
- ✅ Incident response (error logging)

**Data Minimization:**

- ✅ No password storage (OAuth 2.0)
- ✅ No session storage on client (custom tokens only)
- ✅ PII encrypted in Firestore

---

## 8. Configuration & Deployment

### 8.1 Environment Variables (Functions)

```bash
# NOTIVISA OAuth IDP Configuration
NOTIVISA_IDP_BASE=https://idp.notivisa.saude.gov.br
NOTIVISA_OAUTH_CLIENT_ID=<CLIENT_ID>
NOTIVISA_OAUTH_CLIENT_SECRET=<CLIENT_SECRET>  # Stored in Secret Manager
NOTIVISA_OAUTH_REDIRECT_URI=https://portal.hmatologia2.web.app/callback

# Firebase Configuration
FIREBASE_PROJECT_ID=hmatologia2
FIREBASE_REGION=southamerica-east1
```

### 8.2 Secret Manager Setup

```bash
# Store sensitive credentials
firebase functions:secrets:set NOTIVISA_OAUTH_CLIENT_SECRET

# Verify
gcloud secrets list --project=hmatologia2 | grep NOTIVISA
```

### 8.3 Deploy Steps

```bash
# 1. Type check
npx tsc --noEmit

# 2. Build
npm run build

# 3. Deploy Firestore rules (add NOTIVISA portal rules)
firebase deploy --only firestore:rules,firestore:indexes

# 4. Deploy Cloud Function
firebase deploy --only functions:authenticatePortal

# 5. Deploy hosting (if UI updated)
firebase deploy --only hosting
```

### 8.4 Lab Configuration

Each lab must be configured with:

```typescript
interface LabNotivisaConfig {
  labId: string;
  notivisaLabCode: string; // Government registration code
  notivisaOAuthEnabled: boolean; // Feature flag
  allowedRoles: string[]; // ['RT', 'MEDICO', 'DIRETOR', 'AUDITOR']
  sessionTimeoutMinutes: number; // Default 30 * 24 * 60 = 43,200 (30 days)
}
```

---

## 9. Testing & Validation

### 9.1 Unit Tests (PortalAuthService)

```typescript
describe('PortalAuthService', () => {
  // Session Management
  it('should create portal session with OAuth token', async () => {});
  it('should retrieve active session', async () => {});
  it('should list user sessions across labs', async () => {});
  it('should update session token on refresh', async () => {});
  it('should revoke session on logout', async () => {});
  it('should mark session expired', async () => {});

  // Token Validation
  it('should detect valid session (>5 min remaining)', () => {});
  it('should detect session needing refresh (<5 min)', () => {});
  it('should calculate time remaining', () => {});

  // OAuth Utilities
  it('should generate cryptographically secure state', () => {});
  it('should build OAuth authorize URL with correct params', () => {});
  it('should validate OAuth token format', () => {});

  // Audit Trail
  it('should log session creation event', async () => {});
  it('should retrieve audit events by session', async () => {});

  // Cleanup
  it('should mark sessions as expired', async () => {});
});
```

### 9.2 Integration Tests (authenticatePortal Callable)

```typescript
describe('authenticatePortal Callable', () => {
  // OAuth Flow
  it('should exchange authorization code for token', async () => {});
  it('should validate state parameter', async () => {});
  it('should prevent CSRF attacks (state mismatch)', async () => {});

  // Token Validation
  it('should parse and validate idToken (JWT)', async () => {});
  it('should extract professional info from claims', async () => {});
  it('should reject expired or malformed tokens', async () => {});

  // Session Creation
  it('should create Firestore session document', async () => {});
  it('should store OAuth token securely', async () => {});
  it('should record IP and user agent', async () => {});

  // Firebase Token Issuance
  it('should issue custom Firebase token', async () => {});
  it('should embed session ID in custom token claims', async () => {});

  // Error Handling
  it('should return specific error code on validation failure', async () => {});
  it('should log failed authentication attempts', async () => {});
  it('should implement rate limiting', async () => {});

  // Audit Trail
  it('should create audit event on successful auth', async () => {});
});
```

### 9.3 E2E Tests (Portal Authentication Flow)

```typescript
describe('Portal Authentication E2E', () => {
  it('should complete OAuth flow from login to dashboard', async () => {
    // 1. Navigate to /portal/login
    // 2. Click "Login with NOTIVISA"
    // 3. Authorize on NOTIVISA IDP (mock)
    // 4. Redirect to /callback with code
    // 5. authenticatePortal() called
    // 6. Redirect to /portal/dashboard
    // 7. Verify session active + token stored
  });

  it('should refresh token before expiry', async () => {
    // 1. Create session with 5-min expiry
    // 2. Detect expiry approaching
    // 3. Call refreshPortalToken()
    // 4. Token updated in Firestore + localStorage
    // 5. API calls continue uninterrupted
  });

  it('should logout and revoke session', async () => {
    // 1. Click logout button
    // 2. Call revokePortalSession()
    // 3. Session marked revoked in Firestore
    // 4. localStorage cleared
    // 5. Redirect to /portal/login
  });

  it('should prevent access with expired token', async () => {
    // 1. Create session with past expiresAt
    // 2. Attempt API call
    // 3. Firestore rules reject (isPortalSessionValid check)
    // 4. Redirect to /portal/login
  });

  it('should isolate sessions by lab (multi-tenant)', async () => {
    // 1. Create session for Lab A
    // 2. Create session for Lab B
    // 3. Switch to Lab B
    // 4. Verify Lab B session active
    // 5. Verify Lab A session not accessible
  });
});
```

---

## 10. Performance Targets

| Metric              | Target     | Measurement                          |
| ------------------- | ---------- | ------------------------------------ |
| OAuth code exchange | <2 seconds | Time from callback to Firebase token |
| Token refresh       | <1 second  | Time from refresh call to response   |
| Session lookup      | <100ms     | Firestore document read              |
| Token validation    | <50ms      | JWT parsing + claim validation       |
| Audit logging       | <200ms     | Async write to audit collection      |

---

## 11. Monitoring & Observability

### 11.1 Cloud Logging Queries

```bash
# Authentication failures
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="authenticatePortal" AND \
   (severity="ERROR" OR jsonPayload.code!="")' \
  --project=hmatologia2 --limit=50 --format=json

# Session creation rate
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="authenticatePortal" AND \
   jsonPayload.ok=true' \
  --project=hmatologia2 --format=json | \
  jq 'group_by(.timestamp | split("T")[0]) | \
      map({date: .[0].timestamp | split("T")[0], count: length})'

# Token refresh errors
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="refreshPortalToken" AND \
   severity="ERROR"' \
  --project=hmatologia2 --limit=50 --format=json
```

### 11.2 Alerts & Thresholds

```yaml
# Alert: High authentication failure rate
- displayName: 'NOTIVISA Portal Auth Failures High'
  conditions:
    - displayName: 'Failure rate >10% over 5 min'
      conditionThreshold:
        filter: 'resource.type="cloud_function" AND labels.functionName="authenticatePortal"'
        comparison: COMPARISON_GT
        thresholdValue: 0.10
        duration: 300s
        aggregations:
          - alignmentPeriod: 60s
            perSeriesAligner: ALIGN_RATE

# Alert: Token exchange timeout
- displayName: 'NOTIVISA IDP Timeout'
  conditions:
    - displayName: 'IDP response >10 sec'
      conditionThreshold:
        filter: 'jsonPayload.code="TOKEN_EXCHANGE_FAILED"'
        comparison: COMPARISON_GT
        thresholdValue: 5
        duration: 300s
```

---

## 12. Troubleshooting Guide

### 12.1 "State Parameter Invalid"

**Symptoms:** User clicks login, gets "OAuth state parameter invalid or expired"

**Causes:**

- State document not created (Cloud Function for `generateOAuthState()` failed)
- State document expired (>10 min elapsed)
- CSRF attack (state values don't match)

**Solutions:**

1. Verify `notivisa-portal-oauth-state` collection exists
2. Check Cloud Logs for errors during state generation
3. Increase state TTL if users are slow
4. Clear browser sessionStorage and retry

### 12.2 "Token Exchange Failed"

**Symptoms:** "Failed to exchange authorization code"

**Causes:**

- NOTIVISA IDP unreachable (network issue or IDP down)
- Invalid client ID/secret
- Authorization code invalid or expired
- Redirect URI mismatch

**Solutions:**

1. Check NOTIVISA IDP status page
2. Verify `NOTIVISA_OAUTH_CLIENT_ID` and `NOTIVISA_OAUTH_CLIENT_SECRET` in Secret Manager
3. Verify `NOTIVISA_OAUTH_REDIRECT_URI` matches OAuth app configuration
4. Test connectivity to IDP:
   ```bash
   curl -I https://idp.notivisa.saude.gov.br/oauth/token
   ```

### 12.3 "Lab Not Found / Not Configured"

**Symptoms:** "Lab is not configured for NOTIVISA portal integration"

**Causes:**

- Lab document missing `notivisaLabCode` field
- Lab ID incorrect

**Solutions:**

1. Verify lab exists: `firebase firestore document labs/{labId}`
2. Add `notivisaLabCode` to lab settings (Admin UI)
3. Verify lab ID sent to `authenticatePortal()` is correct

### 12.4 Session Expires Too Quickly

**Symptoms:** Users logged out after 5 minutes

**Causes:**

- NOTIVISA IDP returning short token TTL (expiresIn)
- Client-side token validation too aggressive

**Solutions:**

1. Check NOTIVISA IDP token response (`expiresIn` value)
2. Negotiate longer TTL with IDP or request new token more frequently
3. Adjust client-side refresh threshold (currently 5 min buffer)

---

## 13. Future Enhancements (Phase 5+)

- [ ] **IP Whitelisting:** Restrict login to lab network ranges
- [ ] **MFA:** Require second factor (TOTP) for sensitive operations
- [ ] **Device Fingerprinting:** Detect unusual login locations
- [ ] **Session Sharing:** Allow professional to use token across devices
- [ ] **Consent Management:** UI for reviewing + revoking OAuth permissions
- [ ] **Webhook Integration:** Real-time session expiry notifications
- [ ] **SSO:** Federate with health authority SSO systems
- [ ] **Audit Export:** Download audit trail as PDF/CSV

---

## 14. Appendices

### 14.A Glossary

- **OAuth 2.0:** Industry-standard authorization protocol
- **Bearer Token:** Type of access token (RFC 6750)
- **Custom Token:** Firebase-issued token with custom claims
- **idToken:** JWT (JSON Web Token) containing professional identity claims
- **CSRF:** Cross-Site Request Forgery attack (mitigated by state parameter)
- **Multi-tenant:** System supports multiple independent labs

### 14.B References

- OAuth 2.0 Authorization Framework: https://tools.ietf.org/html/rfc6749
- JWT (JSON Web Tokens): https://tools.ietf.org/html/rfc7519
- Firebase Authentication: https://firebase.google.com/docs/auth
- RDC 978/2025 (ANVISA): https://www.in.gov.br (official gazette)
- DICQ (Diretriz Clínica): ANVISA quality guidelines

### 14.C File Locations

- Client Service: `src/features/notivisa-portal/services/PortalAuthService.ts`
- Cloud Function: `functions/src/modules/notivisa-portal/callables/authenticatePortal.ts`
- Firestore Rules: `firestore.rules` (add notivisa-portal blocks)
- Types: `src/types/notivisa-portal.ts` (when created)
- Tests: `test/notivisa-portal.test.ts` (when created)

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-06-07 (post-implementation verification)
