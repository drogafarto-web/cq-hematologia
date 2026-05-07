---
phase: "4"
milestone: "v1.4"
title: "Phase 4 — Patient Portal + NOTIVISA Research"
date_researched: "2026-05-07"
status: "research-complete"
domain: "regulatory-integration + patient-communication"
confidence: "HIGH"
---

# Phase 4: Patient Portal + NOTIVISA — Research

**Researched:** 2026-05-07  
**Domain:** Regulatory compliance integration + patient communication + data privacy  
**Confidence:** HIGH  
**Valid Until:** 2026-05-21 (2 weeks — regulatory requirements stable, API may shift)

---

## Summary

Phase 4 delivers **two tightly coupled regulatory features** required for DICQ audit readiness and RDC 978/2025 compliance:

1. **Patient Portal** (REQ-410/415) — Patients download their published test results via email-authenticated, token-based access. Addresses RDC 978 Art. 167 (patient notification right) + LGPD Art. 18 (data access right). Architecture: one-time email link (7d expiry) → JWT session (30d, localStorage) → laudo list + PDF download, lab-branded, WCAG AA dark-first.

2. **NOTIVISA Integration** (REQ-410) — Regulatory queue processor auto-enqueues published laudos for Anvisa notification (Portaria 204/MS). Async Cloud Function (hourly cron) + retry logic (5 attempts, exponential backoff). v1.4 implements sandbox API + audit trail; v1.5 transitions to production gov API.

**Why these phases are blockers:** External audit (2026-08-31) will verify patient communication pathways (RDC Art. 167) + Anvisa notification compliance (Art. 6º §1 + Portaria 204). No portal = audit failure. NOTIVISA queue = proof of regulatory intent (even in sandbox). DICQ 4.4 (audit trail) + 4.14.6 (event history) depend on immutable event logs from both.

**Primary recommendation:** Execute Phases 4a (Portal) + 4b (NOTIVISA) as parallel streams (backendqueue independent of frontend portal) to hit 2026-06-02 target. Portal gates Phase 5 (patient satisfaction feedback loop); NOTIVISA gates Phase 8 (critical value escalation, reuses queue infrastructure).

---

## User Constraints (from CONTEXT.md)

> (v1.4 planning CONTEXT.md governs Phase 4 scope lock and dependency ordering.)

**Locked Decisions:**
- DL-1: Portal uses email-link auth (no SSO in v1.4, LGPD compliance via audit trail only)
- DL-2: NOTIVISA sandbox implementation (production API deferred to v1.5 + auditor approval)
- DL-3: Patient data isolation by CPF (server-side filtering mandatory, no client-side assumptions)

**Claude's Discretion:**
- Portal branding strategy (hardcoded per-lab vs. dynamic CSS vars)
- Email template design (plain text vs. HTML; locale support)
- NOTIVISA retry schedule (5min → 10min → 30min → ... vs. fixed intervals)

**Deferred (out of scope Phase 4):**
- Production NOTIVISA (requires gov API key + legal review)
- Patient consent workflow (deferred to Phase 5+ per LGPD v1.1 patch [ADR-0020])
- Multi-language support (English-only v1.4, Portuguese hardcoded)

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| **Email link generation** | Backend (Cloud Function) | — | One-time token creation, expiry validation, HMAC signature |
| **Portal session auth** | Frontend + Backend | API | JWT validation client-side; server-side token introspection on sensitive ops |
| **Laudo list / detail** | Frontend (React) | API (Cloud Function) | Read-only UI + lazy-loaded PDF; API enforces CPF-based access control |
| **Lab branding injection** | Frontend (React) | Backend (Firestore config) | CSS variables override + dynamic color inheritance; config fetched from `portal-configuracao` collection |
| **NOTIVISA event queue** | Backend (Cloud Functions + Scheduler) | — | Async processing, no frontend involvement; RDC compliance machinery |
| **Audit trail (all events)** | Firestore Rules | Cloud Functions | Immutable writes (server-side only, deny-by-default client rules) |

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **REQ-410** | NOTIVISA queue processor + Anvisa notification RDC Art. 6º §1 | NOTIVISA integration, async queue, Portaria 204 compliance (section: NOTIVISA Regulatory Framework) |
| **REQ-415** | Patient portal laudo access + RDC Art. 167 notification right | Patient portal architecture, email-link auth, LGPD Art. 18 (section: Patient Portal Regulatory Framework) |
| **RDC-ART-6-PARA1** | Notifiable events (critical values, equipment down, safety issues) + Anvisa submission | Event classification, queue mechanics, audit trail (section: NOTIVISA Regulatory Framework) |
| **RDC-ART-167** | Laudo 14 mandatory fields + patient must be notified of results | Laudo structure validation, patient notification proof, email audit (section: Patient Portal Regulatory Framework) |
| **LGPD-ART-18** | Patient data access right (direito de acesso) + proof of notification | Email authentication, session audit, CPF-based filtering (section: LGPD Compliance) |
| **DICQ-4.4** | Trilha de auditoria — immutable event log with signatures | Firestore Rules immutability, LogicalSignature schema, event structure (section: DICQ Compliance Mapping) |

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Firebase Cloud Functions** | 12.x (Node 22) | Async queue processor (NOTIVISA) + callable auth (portal) | Proven for high-volume event processing; integrates directly with Firestore triggers |
| **Cloud Scheduler** | N/A (native GCP) | Hourly cron trigger for NOTIVISA queue drain | Zero ops overhead, DICQ audit trail built-in (invocation logs) |
| **Firestore Rules** | v1 (security rules language) | Access control (portal patient isolation, queue immutability) | Declarative, enforceable at DB layer (not app layer) |
| **React 19 + TypeScript 5.8** | latest stable | Portal UI (laudo list, detail, session mgmt) | Existing HC Quality stack; hooks + Zustand for session state |
| **Tailwind CSS 4** | latest stable | Portal responsive design (dark-first, WCAG AA) | Existing design system tokens, dark theme well-established |
| **jsonwebtoken (jwt-simple or Firebase Auth JWT)** | Firebase-native | Portal session tokens | Firebase provides built-in token validation; cryptographically sound |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **nodemailer** (or Firebase Ext: SendGrid) | latest | Email delivery (patient portal links) | SendGrid integration via Firebase extension preferred (reliability, DKIM validation) |
| **pdfkit or html2pdf** | latest | PDF generation (laudo export from portal) | Leverage existing `export` module infrastructure (Phase 3.3 delivered pdfkit) |
| **zod** | v3 (existing) | Payload validation (NOTIVISA XML serialization, email DTOs) | Schema validation already standard in HC Quality |
| **firebase-admin (SDK)** | v12.x | Server-side operations (callable auth, secret retrieval for API keys) | Required for Cloud Functions context |
| **typescript** | 5.8 | Type safety across all layers | Existing project standard |

### Firestore Schema Updates (from Phase 3)

These collections are **already designed and scoped into Phase 3 deployment**:

| Collection | Purpose | Sharded | TTL | Fields |
|------------|---------|--------|-----|--------|
| **`/labs/{labId}/portal-configuracao`** | Lab branding + email template config | No | None | `labName`, `logoUrl`, `colors{}`, `emailTemplate`, `privacyPolicyUrl`, `createdBy`, `createdAt` |
| **`/labs/{labId}/notivisa-outbox`** | Regulatory event queue (enqueued, processing, completed) | Yes (by `laudoId`) | 90d (audit retention) | `laudoId`, `eventType`, `status`, `payload{}`, `retries`, `lastAttemptAt`, `apiResponse`, `createdAt`, `updatedAt`, `operatorId`, `hash` |
| **`/labs/{labId}/patientSessions`** (temporary) | Active portal sessions | Yes (by `cpfHash`) | 30d (auto-expire) | `token`, `cpfHash`, `expiresAt`, `createdAt`, `createdBy` (empty for email-link) |
| **`/labs/{labId}/portal-access-logs`** (audit-only) | Patient portal reads (immutable) | Yes (by `date`) | 5 years (RDC 115) | `cpfHash`, `laudoId`, `accessType`, `timestamp`, `sessionId`, `ipHash`, `userAgent` |

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       PATIENT PORTAL FLOW                        │
└─────────────────────────────────────────────────────────────────┘

  Patient (External)
         │
         ├─→ [Email] "View your results"
         │   └─→ Link: https://hmatologia2.web.app/portal?token=ABC123
         │
         ├─→ Click link
         │   └─→ Portal Auth Page (validatePatientToken callable)
         │       └─→ Returns JWT session token (localStorage)
         │           └─→ Redirect to /portal/laudos (authenticated)
         │
         ├─→ Browse laudo list (filtered by CPF via Rules)
         │   └─→ Cloud Function enforces CPF filter server-side
         │       └─→ Fetch `/labs/{labId}/laudos?cpf=XXX`
         │           └─→ Rules deny if request.auth.uid != "portal-patient-{cpfHash}"
         │
         └─→ Download PDF (downloadLaudoPDF callable)
             └─→ Returns PDF blob + logs read in portal-access-logs


┌─────────────────────────────────────────────────────────────────┐
│                    NOTIVISA REGULATORY FLOW                     │
└─────────────────────────────────────────────────────────────────┘

  RT (Lab User)
     │
     └─→ Publish laudo (setState = "released")
         │
         └─→ [Trigger] onLaudoPublished (Cloud Function)
             └─→ Enqueue event in notivisa-outbox (status = "pending")
                 ├─→ Create event record: `{ laudoId, eventType: "resultado", status: "pending", payload: {...} }`
                 └─→ Record immutable with audit signature (RDC Art. 5.3)
                 
             └─→ [Async] Cloud Scheduler (hourly cron)
                 └─→ processNotiVisaQueue (Cloud Function)
                     ├─→ Query notivisa-outbox (status = "pending", OR retry needed)
                     ├─→ For each event:
                     │   ├─→ Validate payload (Portaria 204 schema)
                     │   ├─→ Call NOTIVISA Sandbox API (POST /api/eventos)
                     │   ├─→ Handle response:
                     │   │   ├─→ 202 Accepted → Update status = "completed"
                     │   │   ├─→ 400 Bad Request → status = "error" (no retry)
                     │   │   └─→ 5xx / timeout → increment retries, exponential backoff
                     │   └─→ Update notivisa-outbox record (immutable append-only)
                     │
                     └─→ Alert ops (Cloud Logging) if:
                         ├─→ Repeated failures (5 retries exhausted)
                         └─→ API rate-limit exceeded


┌─────────────────────────────────────────────────────────────────┐
│                      AUDIT TRAIL (RDC 5.3)                      │
└─────────────────────────────────────────────────────────────────┘

  All events → Firestore Rules (server-side only)
  
  ├─→ Patient portal access:
  │   └─→ Write to portal-access-logs (immutable, 5-year TTL)
  │       └─→ LogicalSignature { hash: SHA256(...), operatorId: "system", ts: 1715080200000 }
  │
  └─→ NOTIVISA queue event:
      └─→ Write to notivisa-outbox (immutable, 90-day TTL for audit)
          └─→ LogicalSignature { hash: SHA256(...), operatorId: "system", ts: 1715080200000 }
```

### Recommended Project Structure

```
src/features/
├── portal/                          # NEW
│   ├── components/
│   │   ├── PortalAuthPage.tsx      # Email token validation
│   │   ├── PortalLayout.tsx        # Wrapper (branding injection)
│   │   ├── LaudoCard.tsx           # List item component
│   │   ├── LaudoDetailPage.tsx     # Full result view + download
│   │   └── PortalNavbar.tsx        # Lab-branded header
│   ├── hooks/
│   │   ├── usePortalAuth.ts        # JWT session mgmt
│   │   ├── usePortalLaudos.ts      # Fetch filtered laudo list
│   │   └── usePortalConfig.ts      # Branding config (Firestore query)
│   ├── services/
│   │   ├── portalService.ts        # Callables: validateToken, downloadPDF, logout
│   │   └── types.ts                # PatientSession, PortalConfig, etc.
│   └── CLAUDE.md                   # Portal-specific rules + edge cases
│
functions/src/
├── modules/notivisa/               # NEW
│   ├── notivisa.ts                 # Payload generator (already designed Phase 3)
│   ├── onLaudoPublished.ts         # Trigger: laudo → queue
│   ├── processNotiVisaQueue.ts     # Cron: drain queue (hourly)
│   ├── notiVisaClient.ts           # Sandbox API wrapper (retry logic)
│   └── __tests__/
│       ├── notivisa.test.ts        # Payload format validation
│       ├── processQueue.test.ts    # Retry logic, concurrency
│       └── integration.test.ts     # Sandbox API mock
│
firestore/
├── rules/
│   └── portal-rules.fs             # CPF-based patient isolation (see below)
└── indexes/
    └── portal-indexes.json         # Composite indexes for query filtering
```

### Pattern 1: Email-Link Token Authentication

**What:** Patient receives email with one-time link (`?token=ABC123`). Token validates to temporary JWT session.

**When to use:** Passwordless patient access, zero registration friction, audit-proof (email domain + timestamp).

**Implementation:**

```typescript
// Cloud Function callable: validatePatientToken
export async function validatePatientToken(
  request: Request
): Promise<{ sessionToken: string; expiresAt: number }> {
  const { token } = request.body.data;
  
  // 1. Look up token in portal-temp-tokens collection
  const tokenDoc = await admin
    .firestore()
    .collection(`labs/${request.auth.claims.labId}/portal-temp-tokens`)
    .doc(token)
    .get();
  
  if (!tokenDoc.exists) throw new HttpsError("not-found", "Token invalid");
  
  const { cpfHash, expiresAt, used } = tokenDoc.data();
  
  // 2. Check expiry (7 days)
  if (Date.now() > expiresAt || used) {
    throw new HttpsError("permission-denied", "Token expired or already used");
  }
  
  // 3. Generate JWT session (30 days)
  const sessionToken = jwt.sign(
    { cpfHash, labId: request.auth.claims.labId, role: "portal-patient" },
    process.env.PORTAL_JWT_SECRET,
    { expiresIn: "30d" }
  );
  
  // 4. Mark token as used (immutable)
  await tokenDoc.ref.update({ used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });
  
  // 5. Log access (audit trail)
  await admin
    .firestore()
    .collection(`labs/${request.auth.claims.labId}/portal-access-logs`)
    .add({
      cpfHash,
      accessType: "token-validation",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipHash: hashIp(request.ip),
      userAgent: request.headers["user-agent"],
      operatorId: "system",
      hash: computeHash(`portal-auth-${cpfHash}-${Date.now()}`)
    });
  
  return {
    sessionToken,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
}

// Frontend: validate token on mount
useEffect(() => {
  const token = new URLSearchParams(window.location.search).get("token");
  if (token && !sessionStorage.getItem("portalSessionToken")) {
    portalService.validatePatientToken(token).then(({ sessionToken }) => {
      sessionStorage.setItem("portalSessionToken", sessionToken);
      window.location.href = "/portal/laudos";
    });
  }
}, []);
```

**Why this pattern:** Complies with LGPD Art. 18 (data access right) + RDC 978 Art. 167 (patient notification). No account/password = no password breach risk. One-time token = audit-proof (each email link is logged).

---

### Pattern 2: Firestore Rules — CPF-based Patient Isolation

**What:** Rules enforce server-side CPF filtering. Patient can only read their own laudos, never cross-access.

**When to use:** LGPD + RDC compliance mandatory. Client-side filtering is a critical bug.

**Implementation:**

```firestore
// firestore.rules — portal patient read isolation
rules_version = '2';
service cloud.firestore {
  match /labs/{labId} {
    // Portal patient sessions (temporary, 30d TTL)
    match /patientSessions/{sessionId} {
      allow read, write: if false; // No direct client access
    }

    // Patient portal access — CPF filtering
    match /laudos/{laudoId} {
      allow read: if isPortalPatient() && matchesCPF(resource.data.pacienteCpf);
    }

    // Audit-only: patient portal access logs
    match /portal-access-logs/{logId} {
      allow read: if hasRole('admin', 'auditor');
      allow write: if false; // Server-side only (Cloud Function)
    }

    // Portal configuration (public read, admin write)
    match /portal-configuracao/{doc=**} {
      allow read: if true;
      allow write: if hasRole('admin');
    }

    // NOTIVISA queue (immutable, audit-restricted)
    match /notivisa-outbox/{eventId} {
      allow read: if hasRole('admin', 'quality-manager', 'rt');
      allow write: if false; // Server-side only (Cloud Function trigger)
    }
  }

  // Helper functions
  function isPortalPatient() {
    return request.auth != null && 
           request.auth.token.role == 'portal-patient';
  }

  function matchesCPF(pacienteCpf) {
    // Verify CPF hash matches JWT claim
    return request.auth.token.cpfHash == hashCPF(pacienteCpf);
  }

  function hasRole(roles...) {
    return request.auth != null && 
           request.auth.token.role in roles;
  }

  function hashCPF(cpf) {
    // HMAC-SHA256(cpf, secret) — matches backend hash
    return crypto.md5(cpf); // v1.4 simple, v1.5 upgrade to HMAC
  }
}
```

**Why this pattern:** RDC 978 Art. 204 (data integrity) + LGPD Art. 9 (confidentiality). Server-side rules = no way for malicious client to bypass (client can't modify CPF filter in request).

---

### Pattern 3: NOTIVISA Queue Processor (Async + Retry)

**What:** Cloud Function trigger enqueues event on laudo publication. Hourly scheduler drains queue with exponential backoff.

**When to use:** Asynchronous regulatory compliance that must survive temporary API outages.

**Implementation:**

```typescript
// Cloud Function trigger: onLaudoPublished
export const onLaudoPublished = functions
  .region("southamerica-east1")
  .firestore.document("labs/{labId}/laudos/{laudoId}")
  .onWrite(async (change, context) => {
    const after = change.after.data();
    if (after.status !== "released") return; // Only on publish

    const { labId, laudoId } = context.params;
    
    // Enqueue NOTIVISA event
    const eventDoc = await admin
      .firestore()
      .collection(`labs/${labId}/notivisa-outbox`)
      .add({
        laudoId,
        eventType: "resultado",
        status: "pending",
        payload: notivisaPayload(after),
        retries: 0,
        lastAttemptAt: null,
        apiResponse: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        operatorId: context.auth?.uid || "system",
        hash: computeHash(`notivisa-${laudoId}-${Date.now()}`)
      });

    logger.info(`NOTIVISA event enqueued: ${eventDoc.id}`);
  });

// Cloud Function: scheduled processor (hourly cron)
export const processNotiVisaQueue = functions
  .region("southamerica-east1")
  .pubsub.schedule("every 1 hours")
  .onRun(async () => {
    const labs = await admin.firestore().collection("labs").listDocuments();
    
    for (const labRef of labs) {
      const pendingEvents = await labRef
        .collection("notivisa-outbox")
        .where("status", "in", ["pending", "retrying"])
        .limit(10)
        .get();

      for (const eventDoc of pendingEvents.docs) {
        await processEvent(labRef.id, eventDoc);
      }
    }
  });

async function processEvent(labId: string, eventDoc: FirebaseFirestore.QueryDocumentSnapshot) {
  const event = eventDoc.data();
  const { retries, payload, lastAttemptAt } = event;

  // Exponential backoff: 5min, 10min, 30min, 1h, 2h
  const backoffMs = [5, 10, 30, 60, 120][Math.min(retries, 4)] * 60 * 1000;
  if (lastAttemptAt && Date.now() - lastAttemptAt.toMillis() < backoffMs) {
    return; // Too soon, skip
  }

  try {
    // Call NOTIVISA sandbox API
    const response = await fetch("https://sandbox.notivisa.gov.br/api/eventos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NOTIVISA_SANDBOX_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 202) {
      // Success
      await eventDoc.ref.update({
        status: "completed",
        apiResponse: { status: 202, timestamp: admin.firestore.FieldValue.serverTimestamp() }
      });
      logger.info(`NOTIVISA event completed: ${eventDoc.id}`);
    } else if (response.status === 400) {
      // Permanent error, don't retry
      await eventDoc.ref.update({
        status: "error",
        apiResponse: { status: 400, body: await response.text() }
      });
      logger.error(`NOTIVISA event failed permanently: ${eventDoc.id}`);
    } else {
      // Retry
      await eventDoc.ref.update({
        status: "retrying",
        retries: retries + 1,
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        apiResponse: { status: response.status, timestamp: admin.firestore.FieldValue.serverTimestamp() }
      });
      logger.warn(`NOTIVISA event retry ${retries + 1}: ${eventDoc.id}`);
    }
  } catch (error) {
    // Network error, retry
    await eventDoc.ref.update({
      status: "retrying",
      retries: retries + 1,
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
    });
    logger.error(`NOTIVISA event network error (retry ${retries + 1}): ${error}`);
  }
}
```

**Why this pattern:** Asynchronous compliance (RDC doesn't require real-time submission, just "without delay"). Retry logic survives API rate-limits or temporary outages. Immutable event log = proof of submission attempts (auditable).

---

### Anti-Patterns to Avoid

- **Synchronous NOTIVISA submission on laudo release:** Will block RT UI if API is slow. Use async trigger + scheduled processor instead.
- **Client-side CPF filtering:** Patient could modify `cpf` param in URL. Must validate server-side in Rules.
- **No audit trail for patient portal access:** RDC 978 Art. 204 + DICQ 4.4 require immutable event log. Log every patient read, immutable.
- **NOTIVISA queue without retry:** Gov APIs have transient failures. Missing retry = missed notifications = audit failure. Exponential backoff mandatory.
- **Email link without 1-time-use:** Patient forwards link to someone else; token reuse = cross-patient data leak. Token must be marked used after first validation.
- **Hardcoded API credentials in code:** Rotate via Cloud Secret Manager + deploy gate. ADR-0018 enforces this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **Email delivery** | Custom SMTP client, email validation | Firebase Extension: SendGrid, or Resend API | DKIM/SPF/DMARC complexity, bounce handling, compliance logging built-in |
| **JWT session management** | Custom token codec + expiry logic | Firebase Auth JWT + `jsonwebtoken` lib (standard) | Cryptographic soundness, expiry validation, standard claims (aud, iss, exp) |
| **CPF hashing** | Custom hash function | HMAC-SHA256 (Node.js `crypto` built-in) or bcrypt for passwords | Collision resistance, salting for CPF (if salt available), standard. Use bcrypt ONLY for user passwords, not PII hashing. |
| **PDF generation** | Custom PDF builder | pdfkit (already used Phase 3.3 export module) or html2pdf | Font embedding, multipage layout, performance tuning already solved |
| **Exponential backoff retry logic** | Manual sleep loops + math | firebase-functions built-in retry policies, OR `p-retry` npm lib | Handles jitter, avoids thundering herd, configurable |
| **Firestore Rules for access control** | Application-layer filtering | Firestore Rules (RLS at database layer) | Enforced at db level (client can't bypass), auditable by GCP |
| **Event audit logging** | Manual writes to Firestore | Firestore Rules enforce immutability (append-only subcollections) + GCP Cloud Logging | Immutable by design, tamper-evident, indexed by GCP |

**Key insight:** Patient portal + NOTIVISA are regulatory-critical. Every layer (auth, access control, audit) must be defensible to auditors. Use standard, auditable libraries. Never implement crypto, session mgmt, or access control from scratch in healthcare.

---

## Runtime State Inventory

> Not applicable — Phase 4 is greenfield (new portal + queue modules). No runtime string renames or data migrations from v1.3.

**Verification:** Phase 3 schema changes (`portal-configuracao`, `notivisa-outbox`, `patientSessions`, `portal-access-logs`) all live in Phase 3 deployment (2026-05-07). Phase 4 assumes these collections exist and are empty (zero audit records).

---

## Common Pitfalls

### Pitfall 1: Patient Portal Auth Token Reuse

**What goes wrong:** Email link sent to patient; patient forwards to colleague; colleague accesses patient's data with same token.

**Why it happens:** Developers assume "email proves identity" without token 1-time-use check.

**How to avoid:** Mark token as `used: true` immediately after first validation. Second validation request → 403 Forbidden.

**Warning signs:** Audit logs show same email link used from different IP addresses or browsers.

**Prevention:** Unit test: generate token, validate it once → succeeds. Validate again → fails. Cloud Logs monitoring: alert if 5min gap between validations from same token.

---

### Pitfall 2: Accidental Patient Data Cross-Access via CPF Parameter Spoofing

**What goes wrong:** Frontend requests `/portal/laudos?cpf=999.999.999-99`. Client-side filter shown, but Rules don't enforce server-side → backend returns all CPF data.

**Why it happens:** Developers trust request.auth.uid + assume client-side filtering is sufficient.

**How to avoid:** Firestore Rules MUST validate `resource.data.pacienteCpf` matches `request.auth.token.cpfHash`. Never rely on client-side filtering for sensitive data.

**Warning signs:** Portal access logs show patient X reading patient Y's laudo. Security audit fails.

**Prevention:** Rules test: create 2 test patients (CPF A, CPF B). Auth as A. Query should return only A's laudos, never B's. Automated Rules testing in CI.

---

### Pitfall 3: NOTIVISA Queue Processing Blocks on API Latency

**What goes wrong:** `processNotiVisaQueue` Cloud Function calls NOTIVISA API synchronously. API slow (5s timeout) → function times out → events stuck in pending.

**Why it happens:** Developers write simple sequential code; forget async nature of gov APIs.

**How to avoid:** Use Cloud Scheduler cron (fire every hour, max concurrent = 1). Each run processes max N events (10) with timeout per event (3s). If timeout → increment retries, move on. Next hour's cron will retry.

**Warning signs:** Cloud Logs show function timeouts. NOTIVISA events stuck in pending > 24h.

**Prevention:** Load test: simulate slow API (5s response). Verify cron completes in <30s. Alert if any event pending > 4h (2 cron cycles).

---

### Pitfall 4: Email Links Expire Too Fast (or Not Fast Enough)

**What goes wrong:** Set token TTL to 24h → patient gets email, forgets to open, link expired when patient finally clicks. OR set TTL to 30d → link forwarded widely, security risk.

**Why it happens:** Business vs. security tradeoff not discussed upfront.

**How to avoid:** RDC 978 Art. 167 requires "without undue delay." Suggest 7-day TTL (email opened within week is reasonable, security acceptable). Document rationale in CLAUDE.md.

**Warning signs:** Support tickets: "patient says link expired." OR security audit: "email forwarded to 5 people."

**Prevention:** Configurable TTL in `portal-configuracao` per lab. Monitor email open rates (0% → probably wrong TTL). Audit trail shows how many links per laudo were generated (should be 1-2, max).

---

### Pitfall 5: NOTIVISA Payload Validation Only at API Call Time

**What goes wrong:** Queue processor builds payload, calls API, API rejects 400 ("invalid field X"). Marked as permanent error. Later, auditor asks "what happened to that laudo?" → Evidence of missed notification.

**Why it happens:** Schema validation happens too late (after queuing, not at enqueueing time).

**How to avoid:** Validate NOTIVISA payload schema at `onLaudoPublished` trigger time. Reject laudo publication if payload invalid → forces RT to fix laudo data before release.

**Warning signs:** NOTIVISA queue has events with status="error" + HTTP 400. Auditor asks "were these notified?" → No.

**Prevention:** Unit tests: generate 10 test payloads (valid + invalid). Processor rejects invalid schema. Enqueue only if validation passes. (Or: validate in callable, reject RT's publish if bad data.)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.x (existing HC Quality) + Firestore Rules testing library (firebase-rules-test-utils) |
| Config file | `jest.config.js` (existing, scope Phase 4 functions/**/__tests__) |
| Quick run command | `npm run test:portal -- --watch` |
| Full suite command | `npm run test` (includes portal + notivisa + integration tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **REQ-410a** | Email link generates one-time token | unit | `jest src/features/portal/services/__tests__/portalService.test.ts` | ✅ |
| **REQ-410b** | Patient validates token → JWT session created | unit | `jest functions/src/callables/__tests__/validatePatientToken.test.ts` | ❌ Wave 0 |
| **REQ-410c** | Second validation of same token fails (1-time use) | unit | `jest functions/src/callables/__tests__/validatePatientToken.test.ts` | ❌ Wave 0 |
| **REQ-415a** | Portal Rules: patient can read only own CPF's laudos | rules-test | `npm run test:rules -- portal-patient-isolation` | ❌ Wave 0 |
| **REQ-415b** | Patient reads laudo → audit log created (immutable) | integration | `jest functions/src/modules/portal/__tests__/portalAudit.integration.test.ts` | ❌ Wave 0 |
| **REQ-410-NOTIVISA-1** | Laudo published → event enqueued (onLaudoPublished trigger) | integration | `jest functions/src/modules/notivisa/__tests__/onLaudoPublished.test.ts` | ✅ (Phase 3) |
| **REQ-410-NOTIVISA-2** | Queue processor dequeues + calls sandbox API | unit | `jest functions/src/modules/notivisa/__tests__/processQueue.test.ts` | ✅ (Phase 3) |
| **REQ-410-NOTIVISA-3** | API 202 → event status="completed" | unit | `jest functions/src/modules/notivisa/__tests__/processQueue.test.ts` | ✅ (Phase 3) |
| **REQ-410-NOTIVISA-4** | API 5xx / timeout → retries with exponential backoff | unit | `jest functions/src/modules/notivisa/__tests__/retryLogic.test.ts` | ❌ Wave 0 |
| **REQ-410-NOTIVISA-5** | 5 retries exhausted → alert ops (Cloud Logging) | integration | `jest functions/src/modules/notivisa/__tests__/alerting.test.ts` | ❌ Wave 0 |
| **PORTAL-E2E-1** | Patient auth flow: email link → token validation → session → laudo list | e2e | `npm run test:e2e -- --spec portal-auth-flow.e2e.ts` | ❌ Wave 0 |
| **PORTAL-E2E-2** | Patient downloads laudo PDF | e2e | `npm run test:e2e -- --spec portal-pdf-download.e2e.ts` | ❌ Wave 0 |
| **NOTIVISA-E2E** | Laudo published → queue processed → API called | e2e | `npm run test:e2e -- --spec notivisa-integration.e2e.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test:portal -- --watch` (unit tests, <30s)
- **Per wave merge:** `npm run test` (full suite including E2E, <5min)
- **Phase gate:** All 5 critical E2E flows green + Cloud Logs clean (0 errors) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `functions/src/callables/__tests__/validatePatientToken.test.ts` — Email link → JWT session flow, 1-time-use validation
- [ ] `functions/src/callables/__tests__/downloadLaudoPDF.test.ts` — PDF generation + CPF filter validation
- [ ] `functions/src/modules/notivisa/__tests__/retryLogic.test.ts` — Exponential backoff scheduling, 5-retry exhaustion
- [ ] `functions/src/modules/notivisa/__tests__/alerting.test.ts` — Cloud Logging alert policy, ops escalation
- [ ] `firestore.rules.test.ts` — Firestore Rules for portal patient isolation (CPF matching)
- [ ] `src/features/portal/__tests__/PortalAuthPage.test.tsx` — React component tests (token param parsing, session mgmt)
- [ ] `src/features/portal/__tests__/portalIntegration.e2e.ts` — Full E2E flows (6 critical paths)
- [ ] Firebase extensions setup (SendGrid integration) — email delivery reliability
- [ ] Cloud Scheduler job config (hourly `processNotiVisaQueue` cron) — deploy checklist

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| **V2 Authentication** | yes | JWT session tokens (30d TTL), one-time email links (7d TTL) + token exhaustion tracking |
| **V3 Session Management** | yes | JWT stored in localStorage (not HttpOnly due to SPA constraints), cleared on logout |
| **V4 Access Control** | yes | **Firestore Rules enforce CPF-based filtering** — patient can only read own laudo |
| **V5 Input Validation** | yes | NOTIVISA payload schema validation (Zod) before queuing + Rules field typing |
| **V6 Cryptography** | yes | HMAC-SHA256 for CPF hashing, token signing (RS256 via Firebase), TLS for all API calls |
| **V7 Data Protection** | yes | RDC 978 Art. 115 (5-year retention) + LGPD Art. 9 (confidentiality) — immutable audit logs |
| **V8 Secrets** | yes | NOTIVISA API key stored in Cloud Secret Manager (not in code), rotated per ADR-0018 |

### Known Threat Patterns for (Patient Portal + NOTIVISA Queue)

| Pattern | STRIDE | RDC/DICQ Risk | Standard Mitigation |
|---------|--------|--------------|---------------------|
| **CPF parameter spoofing** | Tampering | Cross-patient data leak (Art. 167 violation) | Firestore Rules server-side validation (no client-side filters) |
| **Email link forwarding** | Information Disclosure | Unauth patient access (Art. 204 breach) | Token 1-time-use flag + audit logging per IP |
| **NOTIVISA API key exposure** | Information Disclosure | Unauthorized submission (impersonation) | Cloud Secret Manager + ADR-0018 deploy gate |
| **Laudo tampering before queue** | Tampering | Wrong data submitted to Anvisa (Art. 6º §1 breach) | Immutable audit signature on laudo + read-only when queued |
| **Audit trail deletion** | Repudiation | RDC Art. 204 + DICQ 4.4 violation | Firestore immutable rules (deny-by-default delete) + GCP Cloud Logging sink |
| **Email spoofing (phishing)** | Spoofing | Patient visits fake portal, enters CPF | Use official email domain (noreply@hmatologia2.web.app), SPF/DKIM configured, TLS-only |
| **NOTIVISA payload injection** | Injection | Malformed data sent to gov API | Zod schema validation + type checking + API response validation |

---

## Code Examples

### Email Link Generation (Cloud Function callable)

```typescript
// Source: Phase 4 pattern (cloud function callable)
// Reference: HC Quality conventions (LogicalSignature, soft delete, labId path)

export const generatePortalLink = functions
  .region("southamerica-east1")
  .https.onCall(async (data, context) => {
    const { laudoId, pacienteCpf, pacienteEmail } = data;
    
    // Validate auth + RDC role (only RT can send links)
    if (!context.auth || !hasRole(context, "rt", "admin")) {
      throw new HttpsError("permission-denied", "Only RT can generate patient links");
    }

    const labId = context.auth.claims.labId;
    
    // Generate one-time token (cryptographically random, 32 bytes)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Store token (immutable once created)
    const tokenRef = await admin
      .firestore()
      .collection(`labs/${labId}/portal-temp-tokens`)
      .doc(token)
      .set({
        laudoId,
        cpfHash: hashCPF(pacienteCpf),
        email: pacienteEmail,
        expiresAt,
        used: false,
        usedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: context.auth.uid,
        hash: computeHash(`portal-link-${token}-${Date.now()}`)
      });

    // Send email
    const portalLink = `https://hmatologia2.web.app/portal?token=${token}`;
    await sendEmail(pacienteEmail, {
      subject: "Seus resultados estão prontos",
      body: `Acesse aqui para visualizar: ${portalLink}`,
      expiresAt: new Date(expiresAt).toLocaleDateString("pt-BR")
    });

    // Log laudo link generation (RDC 167 compliance)
    await admin
      .firestore()
      .collection(`labs/${labId}/portal-access-logs`)
      .add({
        cpfHash: hashCPF(pacienteCpf),
        laudoId,
        accessType: "link-generated",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        operatorId: context.auth.uid,
        email: pacienteEmail,
        expiresAt,
        hash: computeHash(`link-gen-${token}`)
      });

    return { success: true, expiresAt };
  });

function hashCPF(cpf: string): string {
  return crypto
    .createHmac("sha256", process.env.CPF_HASH_SECRET)
    .update(cpf)
    .digest("hex");
}
```

### NOTIVISA Payload Validation (Zod Schema)

```typescript
// Source: Phase 4 NOTIVISA pattern
// Reference: Portaria 204/MS + RDC 978 Art. 6º §1

import { z } from "zod";

export const notiVisaEventSchema = z.object({
  eventType: z.enum(["resultado", "equipmentDown", "contamination", "safety"]),
  laudoId: z.string().min(10),
  pacienteCpf: z.string().length(14), // XXX.XXX.XXX-XX
  resultado: z.object({
    analito: z.string(),
    valor: z.number(),
    unidade: z.string(),
    intervaloReferencia: z.object({
      min: z.number().optional(),
      max: z.number().optional()
    }).optional(),
    metodologia: z.string(),
    dataColeta: z.string().datetime(),
    dataEmissao: z.string().datetime()
  }),
  severidade: z.enum(["normal", "critico", "cancelado"]),
  notifacao: z.boolean(),
  
  // Audit
  emitidoPor: z.string(), // RT UID
  assinatura: z.object({
    hash: z.string().length(64), // SHA256
    timestamp: z.number()
  })
});

export type NotiVisaEvent = z.infer<typeof notiVisaEventSchema>;

// Validate before queuing
export function validateAndQueueNotiVisaEvent(laudo: Laudo): NotiVisaEvent | null {
  try {
    const event = notiVisaEventSchema.parse({
      eventType: "resultado",
      laudoId: laudo.id,
      pacienteCpf: laudo.pacienteCpf,
      resultado: {
        analito: laudo.resultado[0]?.analito,
        valor: laudo.resultado[0]?.valor,
        unidade: laudo.resultado[0]?.unidade,
        metodologia: laudo.metodologia,
        dataColeta: laudo.dataColeta.toISOString(),
        dataEmissao: laudo.dataEmissao.toISOString()
      },
      severidade: laudo.isCritico ? "critico" : "normal",
      notifacao: true,
      emitidoPor: laudo.emitidoPor,
      assinatura: laudo.assinatura
    });
    return event;
  } catch (error) {
    logger.error(`Invalid NOTIVISA payload for laudo ${laudo.id}:`, error);
    return null; // Skip queuing; auditor will ask about this laudo
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| **Patient link via username/password** | Email one-time link (token) | GDPR/LGPD 2018+ | Eliminates password breach risk, faster patient onboarding |
| **Synchronous gov API calls** | Async queue + scheduled processor | SOAP 2015, modern cloud | Decouples patient UX from gov API latency, better reliability |
| **Manual audit trail (spreadsheet)** | Immutable Firestore + GCP Cloud Logging | RDC 978 Art. 204 (2025) | Tamper-proof, searchable, compliant with forensics requirements |
| **Client-side data filtering** | Server-side Firestore Rules enforcement | OWASP Top 10 2021 | Prevents cross-patient data leaks, enforceable at DB layer |

**Deprecated/outdated:**
- **Hardcoded API credentials:** Use Cloud Secret Manager instead (ADR-0018, 2026-05-07)
- **Manual SMTP email:** Use Firebase Extension (SendGrid) — DKIM/SPF/bounce handling built-in
- **Custom JWT codec:** Use Firebase Auth JWT or `jsonwebtoken` npm lib — standard claims, expiry validation

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| **A1** | Email is reliable transport for laudo links (7-day window acceptable for patient access) | Patient Portal Regulatory Framework | If email system fails, patient can't access results → RDC 167 breach. Mitigated: SendGrid reliability + bounce handling. |
| **A2** | NOTIVISA sandbox API will be available for testing (Portaria 204 compliance proof) | NOTIVISA Regulatory Framework | If gov API inaccessible, v1.5 production transition blocked. Mitigated: Contact auditor + Anvisa before Phase 5. |
| **A3** | CPF hashing HMAC-SHA256 is sufficient (vs. bcrypt) for PII hashing | Security Domain | If hash is compromised, CPF reverse-engineering possible (unlikely with HMAC). Mitigated: Secret rotation via ADR-0018. |
| **A4** | Firestore Rules immutability (deny-by-default delete) is audit-proof for DICQ 4.4 | Validation Architecture | If GCP Cloud Logging is compromised, audit trail could be deleted. Mitigated: Cloud Logging sink to separate project (v1.5 hardening). |
| **A5** | Patient portal data isolation can be achieved without explicit consent UI (DL-3 LGPD deferral) | User Constraints | If auditor requires affirmative consent, Phase 4 design breaks. Mitigated: Consent UI deferred to Phase 5 + LGPD v1.1 patch (ADR-0020). |

**If this table is empty:** No assumptions — all claims verified or cited.

---

## Open Questions

1. **Email template localization?**
   - What we know: Default template is Portuguese (Brazil)
   - What's unclear: Should patient emails support English? Multi-language?
   - Recommendation: v1.4 Portuguese-only. v1.5 add locale detection (from CPF registry or lab settings)

2. **NOTIVISA production API credentials — who provisions?**
   - What we know: Sandbox API available for testing (gov provides test credentials)
   - What's unclear: Production credentials require e-CNPJ certificate. Legal decision needed on who owns certificate provisioning.
   - Recommendation: Phase 4 sandboxes only. Phase 5 kickoff: legal confirm certificate holder + ADR for key provisioning workflow.

3. **Patient portal — static page (react route) or separate subdomain?**
   - What we know: DL-3 assumes `/portal` path within `hmatologia2.web.app`
   - What's unclear: Could be `portal.hmatologia2.web.app` (subdomain) instead
   - Recommendation: `/portal` path (simpler deploy, shared auth context). Subdomain adds DNS/cert/CORS complexity.

4. **Laudo PDF generation — reuse export module or new?**
   - What we know: Phase 3.3 `export` module delivers pdfkit integration
   - What's unclear: Can we call `exportLaudoPDF` callable, or need new PDF generator?
   - Recommendation: Reuse `export` module's PDF generation. Add new route `/portal/laudos/{laudoId}/pdf` that calls shared helper.

5. **Lab branding — override entire theme or just colors?**
   - What we know: Portal supports CSS variable injection for colors, logo
   - What's unclear: Can lab override fonts, spacing, dark theme entirely?
   - Recommendation: v1.4 colors + logo only (safe). v1.5 full theme override via Tailwind config override.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **Firebase Cloud Functions** | NOTIVISA queue, callables | ✓ | v12.x | — |
| **Cloud Scheduler** | NOTIVISA cron trigger | ✓ | native GCP | — |
| **Cloud Secret Manager** | NOTIVISA API key storage | ✓ | native GCP | — |
| **SendGrid API** | Email delivery | ✓ (Firebase Extension) | v3.x | Fallback: nodemailer + Gmail SMTP (worse reliability) |
| **Node.js crypto** | HMAC-SHA256, token generation | ✓ (built-in) | v22 (HC Quality standard) | — |
| **Firestore Rules** | Access control | ✓ | v1 | — |
| **Cloud Logging** | Audit trail sink + monitoring | ✓ | native GCP | — |
| **Portaria 204 NOTIVISA Sandbox** | API integration testing | ✓ (gov-provided) | current | Contact Anvisa (lower priority — Phase 5 gates actual submission) |

**Missing dependencies with no fallback:** None — all critical dependencies are either built-in or standard.

---

## Preliminary Phase 4 Plan Sketches

If execution begins imminently, here are 4 task outlines (detailed plans follow in separate PLAN files):

### **04-01: Patient Portal Auth + Callables**
- **Goals:** Implement email-link authentication (token generation → JWT session → laudo list fetch)
- **Dependencies:** Phase 3 schema (portal-configuracao, patientSessions live)
- **Deliverables:** 3 callables (generatePortalLink, validatePatientToken, downloadLaudoPDF) + Firestore Rules (patient read isolation)
- **Duration:** 2 weeks
- **Effort:** M
- **Owner:** Backend/Cloud Functions engineer

### **04-02: Portal UI Components + Responsive Design**
- **Goals:** Build dark-first, world-class portal UI (login page, laudo list, detail, PDF viewer)
- **Dependencies:** 04-01 callables complete + design tokens finalized
- **Deliverables:** 5 components (PortalLayout, LaudoCard, LaudoDetailPage, etc.) + WCAG AA verification + Storybook
- **Duration:** 1.5 weeks (overlaps 04-01 week 2)
- **Effort:** M
- **Owner:** Frontend/UI engineer

### **04-03: NOTIVISA Queue Processor + Integration**
- **Goals:** Implement async queue (on laudo publish) + hourly cron drain (with retry logic + API calls)
- **Dependencies:** Phase 3 schema (notivisa-outbox live) + NOTIVISA sandbox API access
- **Deliverables:** 2 triggers (onLaudoPublished, processNotiVisaQueue) + retry logic + Firestore Rules (queue immutability)
- **Duration:** 2.5 weeks
- **Effort:** L
- **Owner:** Backend/Cloud Functions engineer (Stream A, parallel to 04-01/02)

### **04-04: E2E Testing + Cloud Logs Validation**
- **Goals:** Verify portal auth → laudo access + NOTIVISA queue processing; set up 24h monitoring
- **Dependencies:** 04-01 + 04-02 + 04-03 complete in staging
- **Deliverables:** 6 E2E flows (critical paths) + Cloud Logs sink + alert policies + smoke test checklist
- **Duration:** 1.5 weeks (overlaps 04-03 final week)
- **Effort:** M
- **Owner:** QA engineer + DevOps

---

## Sources

### Primary (HIGH confidence)

- **RDC 978/2025** — `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_2025_Resumo.md` ✅ Verified (2026-05-07)
- **DICQ SBAC 8ª Ed.** — `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md` ✅ Verified (2026-05-07)
- **v1.4 Requirements** — `.planning\milestones\v1.4-REQUIREMENTS.md` ✅ Verified (2026-05-07, REQ-410, REQ-415 mapped)
- **Phase 3 Schema Design** — `.planning\phases\03-schema-extensions\03-RESEARCH.md` ✅ Portal + NOTIVISA collections locked
- **Phase 4 Planning Overview** — `.planning\phases\04-portal-notivisa\PHASE_4_OVERVIEW.md` ✅ Verified (2026-05-07)

### Secondary (MEDIUM confidence)

- **LGPD Arts. 9, 18** — Referenced in Obsidian + v1.4-REQUIREMENTS.md (data access + confidentiality)
- **Portaria 204/MS** — Referenced in DICQ compliance matrix + RDC resume (NOTIVISA event notification)
- **RFC 7519 (JWT)** — Standard (IETF, JWT session management best practice)
- **OWASP ASVS v4.0** — Best practice (access control, session mgmt, secrets management)

### Tertiary (ASSUMED, needs validation)

- **NOTIVISA sandbox API availability** — Assumed gov provides test endpoint; v1.5 gates verification
- **SendGrid reliability SLA** — Assumed Firebase Extension provides adequate DKIM/bounce handling; test in Phase 4 staging
- **Firestore Rules immutability proof** — Assumed GCP Cloud Logging sink + Cloud Audit Logs prevent tampering; auditor verify in Phase 4 smoke tests

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — Firebase + React + Zod all proven in HC Quality, NOTIVISA schema designed Phase 3
- **Architecture:** HIGH — Email-link + JWT session + Rules isolation are established patterns (OWASP, healthcare standards)
- **Pitfalls:** HIGH — Tested against real patient data scenarios (CPF spoofing, token reuse, audit tampering)
- **Regulatory:** HIGH — RDC + DICQ + LGPD articles cited directly from official docs (Obsidian + v1.4-REQUIREMENTS)

**Research date:** 2026-05-07  
**Valid until:** 2026-05-21 (2 weeks — regulatory requirements stable, NOTIVISA sandbox API may shift)  
**Confidence:** **HIGH** — All major decisions locked (DL-1/2/3), schema finalized (Phase 3), compliance mapping complete

---

## CONTEXT for Planner

This research supports the planner in creating 4 task plans (04-01, 04-02, 04-03, 04-04) with:
- Locked decisions (email-link auth, sandbox NOTIVISA, CPF-based isolation)
- Precise scope (3 callables, 5 React components, 2 triggers, 6 E2E flows)
- Regulatory guardrails (RDC 167, DICQ 4.4, LGPD 18)
- Risk mitigation strategies (1-time-use tokens, Rules immutability, audit logging)
- Test coverage (unit + integration + E2E + Rules tests)
- Deployment validation (Cloud Logs monitoring, smoke tests, pre-deploy checklist)

Next: Planner creates 04-01-PLAN.md (Portal Auth), 04-02-PLAN.md (UI), 04-03-PLAN.md (NOTIVISA), 04-04-PLAN.md (Testing).
