# NOTIVISA Portal OAuth/Credential Flow — Implementation Guide

**Version:** 1.0  
**Date:** 2026-05-07  
**Phase:** 4 (Patient Portal + Government Integration)  
**Scope:** Complete portal authentication module + Cloud Function + Firestore rules

---

## Executive Summary

This document provides step-by-step guidance for integrating the complete NOTIVISA Portal OAuth authentication system into HC Quality. Includes:

1. **Client-side service module** — PortalAuthService (session management, token refresh, audit logging)
2. **Cloud Function callable** — authenticatePortal (OAuth code exchange, idToken validation, session creation)
3. **Firestore security rules** — multi-tenant isolation, role-based access control
4. **Complete specifications** — type definitions, error codes, audit events, compliance mappings

**Estimated Implementation Time:** 8–12 hours (including tests + deploy)

---

## Files Provided

### Deliverables

| File                                                                    | Purpose                                | Language        | Lines  | Status   |
| ----------------------------------------------------------------------- | -------------------------------------- | --------------- | ------ | -------- |
| `src/features/notivisa-portal/services/PortalAuthService.ts`            | Client-side session + auth management  | TypeScript      | 586    | ✅ Ready |
| `functions/src/modules/notivisa-portal/callables/authenticatePortal.ts` | OAuth code exchange + session creation | TypeScript      | 460    | ✅ Ready |
| `docs/NOTIVISA_PORTAL_AUTH_SPEC.md`                                     | Complete specification (§1–14)         | Markdown        | 1,200+ | ✅ Ready |
| `firestore.rules.notivisa-portal.txt`                                   | Firestore security rules + indexes     | Firestore Rules | 120    | ✅ Ready |

### Total Deliverables: ~2,500 lines of production-ready code + specification

---

## Implementation Checklist

### Phase 1: Setup & Configuration (2 hours)

- [ ] **1.1 Create Feature Directory**

  ```bash
  mkdir -p src/features/notivisa-portal/services
  mkdir -p src/features/notivisa-portal/components
  mkdir -p src/features/notivisa-portal/hooks
  mkdir -p functions/src/modules/notivisa-portal/callables
  ```

- [ ] **1.2 Copy Client Service**

  ```bash
  cp /path/to/PortalAuthService.ts \
    src/features/notivisa-portal/services/
  ```

- [ ] **1.3 Copy Cloud Function**

  ```bash
  cp /path/to/authenticatePortal.ts \
    functions/src/modules/notivisa-portal/callables/
  ```

- [ ] **1.4 Create Cloud Function Index**
      Create `functions/src/modules/notivisa-portal/index.ts`:

  ```typescript
  export { authenticatePortal } from './callables/authenticatePortal';
  ```

- [ ] **1.5 Register in Functions Entry Point**
      Add to `functions/src/index.ts`:

  ```typescript
  import * as notivisaPortal from './modules/notivisa-portal';
  export const authenticatePortal = notivisaPortal.authenticatePortal;
  ```

- [ ] **1.6 Configure Environment Variables**
      In `.env.local` (local dev):

  ```bash
  VITE_NOTIVISA_IDP_BASE=https://idp-sandbox.notivisa.saude.gov.br
  VITE_NOTIVISA_CLIENT_ID=<SANDBOX_CLIENT_ID>
  ```

  In `functions/.env.local`:

  ```bash
  NOTIVISA_IDP_BASE=https://idp-sandbox.notivisa.saude.gov.br
  NOTIVISA_OAUTH_CLIENT_ID=<SANDBOX_CLIENT_ID>
  NOTIVISA_OAUTH_CLIENT_SECRET=<will_set_via_Secret_Manager>
  ```

- [ ] **1.7 Provision Secret Manager**

  ```bash
  firebase functions:secrets:set NOTIVISA_OAUTH_CLIENT_SECRET \
    --project=hmatologia2
  # Paste secret when prompted
  ```

  Verify:

  ```bash
  gcloud secrets list --project=hmatologia2 | grep NOTIVISA
  ```

---

### Phase 2: Create Supporting Files (2 hours)

- [ ] **2.1 Create Type Definitions**
      Create `src/types/notivisa-portal.ts`:

  ```typescript
  // Re-export types from service (or define inline)
  export type {
    PortalSession,
    PortalOAuthToken,
  } from '../features/notivisa-portal/services/PortalAuthService';
  ```

- [ ] **2.2 Update CONSTANTS**
      Add to `src/constants.ts`:

  ```typescript
  export const NOTIVISA_CONFIG = {
    IDP_BASE: import.meta.env.VITE_NOTIVISA_IDP_BASE,
    CLIENT_ID: import.meta.env.VITE_NOTIVISA_CLIENT_ID,
    REDIRECT_URI: `${window.location.origin}/notivisa-callback`,
    SESSION_TIMEOUT_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
    TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000, // 5 minutes
  };
  ```

- [ ] **2.3 Create OAuth Callback Page**
      Create `src/features/notivisa-portal/pages/OAuthCallbackPage.tsx`:

  ```typescript
  import { useEffect } from 'react';
  import { useNavigate, useSearchParams } from 'react-router-dom';

  export function OAuthCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        navigate('/notivisa-login?error=missing_params');
        return;
      }

      // Call authenticatePortal(...)
      // Handle response, store token, redirect
    }, []);

    return <div className="flex items-center justify-center min-h-screen">Processando login...</div>;
  }
  ```

- [ ] **2.4 Create Login Page**
      Create `src/features/notivisa-portal/pages/LoginPage.tsx`:

  ```typescript
  import { generateOAuthState, generateOAuthAuthorizeUrl } from '../services/PortalAuthService';
  import { NOTIVISA_CONFIG } from '../../../constants';

  export function LoginPage() {
    const handleLogin = () => {
      const state = generateOAuthState();
      sessionStorage.setItem('oauth_state', state);

      const url = generateOAuthAuthorizeUrl(
        NOTIVISA_CONFIG.IDP_BASE,
        NOTIVISA_CONFIG.CLIENT_ID,
        NOTIVISA_CONFIG.REDIRECT_URI,
        selectedLabId,
        state,
      );

      window.location.href = url;
    };

    return (
      <button onClick={handleLogin}>
        Login com NOTIVISA
      </button>
    );
  }
  ```

- [ ] **2.5 Create Token Refresh Hook**
      Create `src/features/notivisa-portal/hooks/usePortalTokenRefresh.ts`:

  ```typescript
  import { useEffect } from 'react';
  import {
    getPortalSessionTimeRemaining,
    needsPortalTokenRefresh,
  } from '../services/PortalAuthService';

  export function usePortalTokenRefresh(session: PortalSession | null) {
    useEffect(() => {
      if (!session) return;

      const checkRefresh = () => {
        if (needsPortalTokenRefresh(session)) {
          // Call refreshPortalToken() callable
        }
      };

      const interval = setInterval(checkRefresh, 60000); // Check every minute
      return () => clearInterval(interval);
    }, [session]);
  }
  ```

- [ ] **2.6 Create Session Store Hook**
      Create `src/features/notivisa-portal/hooks/usePortalSession.ts`:

  ```typescript
  import { useEffect, useState } from 'react';
  import { getPortalSession } from '../services/PortalAuthService';

  export function usePortalSession(labId: string, sessionId: string | null) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!sessionId) return;

      setLoading(true);
      getPortalSession(labId, sessionId)
        .then(setSession)
        .finally(() => setLoading(false));
    }, [labId, sessionId]);

    return { session, loading };
  }
  ```

---

### Phase 3: Update Firestore Rules & Indexes (1.5 hours)

- [ ] **3.1 Update firestore.rules**

  ```bash
  # Open firestore.rules in editor
  code firestore.rules
  ```

  Add the NOTIVISA portal rules block (from `firestore.rules.notivisa-portal.txt`):

  ```firestore
  // NOTIVISA Portal Sessions Collection
  match /notivisa-portal-sessions/{labId}/sessions/{sessionId} {
    allow read: if isActiveMemberOfLab(labId) &&
                (request.auth.uid == resource.data.userId ||
                 isAdminOrOwner(labId) ||
                 request.auth.token.role == 'AUDITOR');
    allow create: if false;
    allow update: if false;
    allow delete: if false;
  }

  // ... (add remaining blocks from firestore.rules.notivisa-portal.txt)
  ```

- [ ] **3.2 Create firestore.indexes.json entries**
      Add to `firestore.indexes.json`:

  ```json
  {
    "indexes": [
      {
        "collectionGroup": "sessions",
        "queryScope": "Collection",
        "fields": [
          { "fieldPath": "userId", "order": "ASCENDING" },
          { "fieldPath": "status", "order": "ASCENDING" }
        ]
      },
      {
        "collectionGroup": "sessions",
        "queryScope": "Collection",
        "fields": [
          { "fieldPath": "status", "order": "ASCENDING" },
          { "fieldPath": "expiresAt", "order": "ASCENDING" }
        ]
      }
    ]
  }
  ```

- [ ] **3.3 Deploy Rules + Indexes**

  ```bash
  firebase deploy --only firestore:rules,firestore:indexes \
    --project=hmatologia2
  ```

- [ ] **3.4 Verify Rules in Emulator**
  ```bash
  npm run dev:emulator &
  npm run test:firestore-rules
  ```

---

### Phase 4: Build & Test (3 hours)

- [ ] **4.1 Type Check**

  ```bash
  npx tsc --noEmit
  # Should have 0 errors
  ```

- [ ] **4.2 Build Frontend**

  ```bash
  npm run build
  # Should succeed without warnings
  ```

- [ ] **4.3 Build Functions**

  ```bash
  cd functions
  npm run build
  cd ..
  ```

- [ ] **4.4 Unit Tests (Service)**
      Create `test/notivisa-portal-service.test.ts`:

  ```typescript
  import { describe, it, expect, beforeEach } from 'vitest';
  import {
    generateOAuthState,
    isPortalSessionValid,
    needsPortalTokenRefresh,
  } from '../src/features/notivisa-portal/services/PortalAuthService';

  describe('PortalAuthService', () => {
    it('should generate cryptographically secure state', () => {
      const state = generateOAuthState();
      expect(state).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(state)).toBe(true);
    });

    it('should detect valid session', () => {
      const now = Date.now();
      const session = {
        status: 'active',
        expiresAt: now + 10 * 60 * 1000, // 10 min
      } as any;
      expect(isPortalSessionValid(session)).toBe(true);
    });

    it('should detect session needing refresh', () => {
      const now = Date.now();
      const session = {
        status: 'active',
        expiresAt: now + 3 * 60 * 1000, // 3 min
      } as any;
      expect(needsPortalTokenRefresh(session)).toBe(true);
    });
  });
  ```

  Run:

  ```bash
  npm test test/notivisa-portal-service.test.ts
  ```

- [ ] **4.5 Integration Tests (Function)**
      Create `test/notivisa-portal-callable.test.ts`:

  ```typescript
  import { initializeApp } from 'firebase/app';
  import { connectFunctionsEmulator, httpsCallable, getFunctions } from 'firebase/functions';

  describe('authenticatePortal Callable', () => {
    beforeEach(() => {
      const app = initializeApp({
        /* test config */
      });
      const functions = getFunctions(app, 'southamerica-east1');
      connectFunctionsEmulator(functions, 'localhost', 5001);
    });

    it('should return error on invalid state', async () => {
      const authenticate = httpsCallable(functions, 'authenticatePortal');
      const response = await authenticate({
        labId: 'test-lab',
        code: 'test-code',
        redirectUri: 'http://localhost:3000/callback',
        state: 'invalid-state',
      });

      expect(response.data.ok).toBe(false);
      expect(response.data.code).toBe('STATE_MISMATCH');
    });
  });
  ```

  Run:

  ```bash
  firebase emulators:exec --only firestore,functions "npm test test/notivisa-portal-callable.test.ts"
  ```

- [ ] **4.6 E2E Tests**
      Create `test/notivisa-portal-e2e.test.ts`:

  ```typescript
  import { test, expect } from '@playwright/test';

  test('Portal login flow', async ({ page }) => {
    await page.goto('http://localhost:3000/notivisa-login');

    // Mock NOTIVISA IDP
    await page.route('**/idp.notivisa.saude.gov.br/**', async (route) => {
      // Simulate OAuth callback
    });

    await page.click('button:has-text("Login com NOTIVISA")');
    // ... assertions
  });
  ```

  Run:

  ```bash
  npx playwright test test/notivisa-portal-e2e.test.ts
  ```

---

### Phase 5: Deployment (2 hours)

- [ ] **5.1 Pre-Deploy Gate**

  ```bash
  bash scripts/preflight-secrets-check.sh
  # Should return 0 (green)
  ```

- [ ] **5.2 Deploy Functions**

  ```bash
  firebase deploy --only functions:authenticatePortal \
    --project=hmatologia2
  ```

  Verify in Cloud Console:

  ```
  https://console.firebase.google.com/project/hmatologia2/functions
  ```

- [ ] **5.3 Deploy Hosting (if UI updated)**

  ```bash
  firebase deploy --only hosting --project=hmatologia2
  ```

  Note: Requires explicit authorization

- [ ] **5.4 Smoke Test**

  ```bash
  # Navigate to production
  # Click login with NOTIVISA (using sandbox IDP)
  # Authorize
  # Verify redirect to callback + session created
  # Check Firestore for new session doc
  ```

- [ ] **5.5 Monitor Logs**

  ```bash
  gcloud logging read \
    'resource.type="cloud_function" AND \
     labels.functionName="authenticatePortal"' \
    --project=hmatologia2 --limit=20 --format=json
  ```

- [ ] **5.6 Verify Firestore**
      Check Firestore Console:
  - Collections tab → `notivisa-portal-sessions` exists
  - Collections tab → `notivisa-portal-audit` exists
  - Indexes → all NOTIVISA indexes listed

---

### Phase 6: Lab Configuration (1 hour)

- [ ] **6.1 Create Sandbox Lab Entry**
      In Firestore Console:

  ```
  labs/{sandboxLabId}
  {
    notivisaLabCode: "12345678",  // Sandbox code from NOTIVISA
    notivisaOAuthEnabled: true,
    notivisaEnvironment: "sandbox",
  }
  ```

- [ ] **6.2 Assign Lab to Test User**

  ```bash
  firebase firestore:set \
    labs/{labId}/members/{uid} \
    '{"role":"RT","status":"active","notivisaOAuthEnabled":true}' \
    --project=hmatologia2
  ```

- [ ] **6.3 Configure OAuth IDP Settings**
  - Verify `NOTIVISA_OAUTH_CLIENT_ID` matches IDP app
  - Verify redirect URI registered in IDP: `https://hmatologia2.web.app/notivisa-callback`
  - Verify `NOTIVISA_OAUTH_CLIENT_SECRET` in Secret Manager

---

### Phase 7: Documentation & Runbooks (1 hour)

- [ ] **7.1 Create Runbook**
      Create `.planning/runbooks/notivisa-portal-auth-issues.md`:

  ```markdown
  # Runbook: NOTIVISA Portal Authentication Issues

  ## Symptom: "OAuth state parameter invalid"

  ...
  ```

- [ ] **7.2 Add to CLAUDE.md**
      Update `src/features/notivisa-portal/CLAUDE.md`:

  ```markdown
  # NOTIVISA Portal Auth Module

  ## Module Overview

  Handles OAuth 2.0 authentication for healthcare professionals
  accessing NOTIVISA government API.

  ## Conventions

  - All sessions scoped to labId (multi-tenant)
  - Token refresh via Cloud Function callable
  - Audit events logged to notivisa-portal-audit collection
  - No password storage (OAuth only)

  ## Key Files

  - `services/PortalAuthService.ts` — session management
  - `callables/authenticatePortal.ts` — OAuth code exchange
  - `.../hooks/usePortalSession.ts` — React hooks

  ## RDC 978 Compliance

  - Art. 41: Timely reporting (session audit trail)
  - Art. 42: Access control (Firestore rules)
  ```

- [ ] **7.3 Update Root CLAUDE.md**
      Add to modules table:
  ```
  | `notivisa-portal` | Em prod · OAuth 2.0 + portal auth | 2026-05-07 |
  ```

---

## Configuration Reference

### Environment Variables

**Development (.env.local)**

```bash
VITE_NOTIVISA_IDP_BASE=https://idp-sandbox.notivisa.saude.gov.br
VITE_NOTIVISA_CLIENT_ID=<SANDBOX_CLIENT_ID>
VITE_API_BASE=http://localhost:5001/hmatologia2/southamerica-east1
```

**Functions (functions/.env.local)**

```bash
NOTIVISA_IDP_BASE=https://idp-sandbox.notivisa.saude.gov.br
NOTIVISA_OAUTH_CLIENT_ID=<SANDBOX_CLIENT_ID>
# NOTIVISA_OAUTH_CLIENT_SECRET is set via Secret Manager
```

**Firestore Rules**

```firestore
// Add to firestore.rules
match /notivisa-portal-sessions/{labId}/sessions/{sessionId} { ... }
match /notivisa-portal-audit/{labId}/events/{eventId} { ... }
```

### Secret Manager

```bash
# Set secret
firebase functions:secrets:set NOTIVISA_OAUTH_CLIENT_SECRET

# Verify
gcloud secrets list --project=hmatologia2 | grep NOTIVISA
```

---

## Validation Checklist

After deployment, verify:

- [ ] **Type Safety:** `npx tsc --noEmit` passes
- [ ] **Build:** `npm run build` succeeds
- [ ] **Tests:** All unit + integration tests pass
- [ ] **Firestore Rules:** Deployed and active
- [ ] **Cloud Function:** Callable is deployable + responds
- [ ] **Environment:** Secret Manager has credentials
- [ ] **Logging:** Cloud Logs show authenticatePortal invocations
- [ ] **Smoke Test:** Login flow works end-to-end with sandbox IDP
- [ ] **Audit Trail:** Events logged to notivisa-portal-audit
- [ ] **Performance:** OAuth exchange <2 seconds
- [ ] **Documentation:** README + runbooks updated

---

## Troubleshooting

### TypeScript Errors

```bash
# Check for issues
npx tsc --noEmit

# Fix common issues
npm install --save-dev @types/node
npm run build  # rebuilds
```

### Deploy Failures

```bash
# Check deploy status
firebase deploy --only functions:authenticatePortal --project=hmatologia2

# View Cloud Logs
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="authenticatePortal" AND \
   severity="ERROR"' \
  --project=hmatologia2 --limit=50
```

### Secret Manager Issues

```bash
# Verify secret exists
gcloud secrets list --project=hmatologia2

# Verify secret value (first 20 chars)
gcloud secrets versions access latest \
  --secret=NOTIVISA_OAUTH_CLIENT_SECRET \
  --project=hmatologia2 | head -c 20
```

### State Parameter Not Found

```bash
# Check notivisa-portal-oauth-state collection
firebase firestore:documents get \
  notivisa-portal-oauth-state/{state} \
  --project=hmatologia2
```

---

## Support & Escalation

| Issue                       | Escalation                                    |
| --------------------------- | --------------------------------------------- |
| NOTIVISA IDP unreachable    | Contact ANVISA support + CTO                  |
| OAuth token exchange fails  | Check Secret Manager + client ID/secret       |
| Firestore rules reject read | Verify user is lab member + rule syntax       |
| Cloud Function timeout      | Check logs for NOTIVISA API latency           |
| Token refresh fails         | Log entry in notivisa-portal-audit collection |

---

## References

- **Specification:** `docs/NOTIVISA_PORTAL_AUTH_SPEC.md` (§1–14)
- **Code:** `src/features/notivisa-portal/services/PortalAuthService.ts`
- **Function:** `functions/src/modules/notivisa-portal/callables/authenticatePortal.ts`
- **Rules:** `firestore.rules.notivisa-portal.txt`
- **RDC 978:** https://www.in.gov.br (ANVISA official gazette)
- **OAuth 2.0:** https://tools.ietf.org/html/rfc6749

---

**Implementation Status:** Ready for Phase 4 Execution  
**Last Updated:** 2026-05-07  
**Assigned to:** Engineering Lead + Backend Engineer  
**Est. Completion:** 2026-05-14 (1 week)
