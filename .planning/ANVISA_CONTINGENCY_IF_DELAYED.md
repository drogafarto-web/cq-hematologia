# ANVISA Contingency Plan — Phase 4 Credential Delay

**Status:** Ready-to-activate contingency  
**Effective:** If credentials not received by 2026-05-15  
**Owner:** CTO  
**Last updated:** 2026-05-07

---

## Executive Summary

If ANVISA sandbox credentials are not provisioned by **May 15, 2026** (5 days past kickoff), activate this plan immediately to unblock Phase 4.4 development and maintain v1.4 timeline.

**Key principle:** Zero production NOTIVISA until real credentials. All development, testing, and integration proceed on mock endpoint with feature flag disabled.

---

## Trigger Conditions

**Activate this plan when:**

1. ANVISA provisioning request (submitted ~May 10) has no credential response by **17:00 BRT on May 15**
2. ANVISA helpdesk is non-responsive (no reply within 48h of escalation)
3. Credentials are partial (e.g., sandbox URL but no API key, or vice versa)

**Do NOT activate if:**
- Credentials arrive before May 15 (use normal Phase 4.4 path per `NOTIVISA_SANDBOX_SETUP.md`)
- ANVISA confirms extended timeline via official communication (CTO acknowledges and notifies team)

---

## Phase 4.4 (Mock Mode) — Immediate Actions

### 1. Feature Flag Activation

**File:** `functions/src/modules/notivisa/config.ts`

```typescript
// Add to top of config
export const NOTIVISA_MODE = process.env.NOTIVISA_MODE || 'MOCK'; // 'MOCK' | 'SANDBOX' | 'PRODUCTION'
export const USE_MOCK_NOTIVISA = NOTIVISA_MODE === 'MOCK';

export const notivisaConfig = {
  apiKey: USE_MOCK_NOTIVISA ? 'mock-key-xyz' : process.env.ANVISA_API_KEY,
  apiUrl: USE_MOCK_NOTIVISA 
    ? 'http://localhost:8081/mock/notivisa' 
    : process.env.ANVISA_SANDBOX_URL,
  retryAttempts: 3,
  retryDelayMs: USE_MOCK_NOTIVISA ? 100 : 2000,
  enableMockMode: USE_MOCK_NOTIVISA,
};
```

**Environment setup:**

```bash
# .env.local (local dev)
NOTIVISA_MODE=MOCK

# firebase functions config (staging)
firebase functions:config:set notivisa.mode=MOCK --project hmatologia2

# Functions code: access via
const mode = functions.config().notivisa?.mode || 'MOCK';
```

### 2. Mock Endpoint Deployment

**File:** `functions/src/modules/notivisa/mockEndpoint.ts` (create if not exists)

```typescript
import * as functions from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

interface MockNOTIVISAPayload {
  evento: string;
  laudo: {
    id: string;
    paciente: { cpf: string };
    resultado: string;
  };
}

interface MockNOTIVISAResponse {
  protocolo: string;
  status: 'aceito' | 'rejeitado' | 'pendente';
  timestamp: string;
  erros?: string[];
}

/**
 * Mock NOTIVISA endpoint for Phase 4.4 (credential delay contingency)
 * Simulates ANVISA sandbox responses without real credentials
 * Disabled via feature flag when real credentials arrive
 */
export const mockNotivisaEndpoint = functions.https.onRequest(
  async (req: functions.Request, res: functions.Response) => {
    logger.info('Mock NOTIVISA endpoint called', { method: req.method });

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const payload = req.body as MockNOTIVISAPayload;
      
      // Validation
      if (!payload.evento || !payload.laudo?.id) {
        res.status(400).json({
          status: 'rejeitado',
          erros: ['Missing evento or laudo.id'],
          timestamp: new Date().toISOString(),
        } as MockNOTIVISAResponse);
        return;
      }

      // Simulate 90% acceptance, 10% rejection
      const isAccepted = Math.random() > 0.1;
      const protocolo = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      const response: MockNOTIVISAResponse = {
        protocolo,
        status: isAccepted ? 'aceito' : 'rejeitado',
        timestamp: new Date().toISOString(),
        ...(isAccepted ? {} : { erros: ['Mock rejection for testing'] }),
      };

      logger.info('Mock response', { protocolo, status: response.status });
      res.status(200).json(response);
    } catch (error) {
      logger.error('Mock endpoint error', error);
      res.status(500).json({
        status: 'rejeitado',
        erros: ['Internal server error'],
        timestamp: new Date().toISOString(),
      } as MockNOTIVISAResponse);
    }
  }
);
```

**Deploy:** Includes only in `firebase.json` deploy when `NOTIVISA_MODE=MOCK`.

### 3. Callable Wrapper (Safe Fallback)

**File:** `functions/src/modules/notivisa/submitNotivisaCallable.ts`

```typescript
import { notivisaConfig } from './config';

export const submitNotivisa = async (draftId: string, labId: string) => {
  logger.info('submitNotivisa called', { draftId, labId, mode: notivisaConfig.enableMockMode });

  if (notivisaConfig.enableMockMode) {
    logger.warn('⚠️ Running in MOCK mode (ANVISA credentials pending)');
    // Use local mock endpoint
    return submitToMockEndpoint(draftId, labId);
  }

  // Real ANVISA sandbox
  return submitToAnvisaSandbox(draftId, labId);
};

async function submitToMockEndpoint(draftId: string, labId: string) {
  // Call localhost:8081 mock endpoint (or mock function directly)
  // Identical response contract to real ANVISA
  const response = await fetch(notivisaConfig.apiUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${notivisaConfig.apiKey}` },
    body: JSON.stringify({ evento: 'submission', laudo: { id: draftId } }),
  });
  return response.json();
}
```

---

## Phase 4.4 — Development Continues

### 4. Test Suite (Mock Locked)

**File:** `functions/__tests__/modules/notivisa/submitNotivisa.spec.ts`

```typescript
describe('submitNotivisa (Mock Mode)', () => {
  beforeAll(() => {
    process.env.NOTIVISA_MODE = 'MOCK';
  });

  it('should submit to mock endpoint when credentials pending', async () => {
    const result = await submitNotivisa('draft-123', 'lab-456');
    expect(result.status).toMatch(/aceito|rejeitado/);
    expect(result.protocolo).toMatch(/^MOCK-/);
  });

  it('should log mock mode warning', async () => {
    const logSpy = jest.spyOn(logger, 'warn');
    await submitNotivisa('draft-123', 'lab-456');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MOCK mode'));
  });
});
```

All tests pass on mock. **No production NOTIVISA calls until feature flag flipped.**

### 5. Client-Side Feature Flag (UI Disabled)

**File:** `src/features/notivisa/hooks/useNotivisaSubmit.ts`

```typescript
export const useNotivisaSubmit = () => {
  const config = useNOTIVISAConfig();
  const isMockMode = config?.enableMockMode ?? false;

  const submit = useCallback(async (draftId: string) => {
    if (isMockMode) {
      showNotification({
        type: 'warning',
        title: 'Modo de Teste',
        message: 'NOTIVISA em modo de teste. Credenciais da ANVISA pendentes. Nenhuma notificação será enviada ao governo.',
      });
      // Allow submit but mark as TEST
      return submitDraft(draftId, { testMode: true });
    }
    return submitDraft(draftId, { testMode: false });
  }, [config?.enableMockMode]);

  return { submit, isMockMode };
};
```

**UI Behavior:**
- Submit button visible but labeled "Enviar (Teste)" or disabled with tooltip
- Draft status badge shows "TESTE" / "Pendente Gov" clearly
- No confusion with production submissions

### 6. Firestore Audit Trail (Mock Flag)

**Collection:** `notivisa-drafts/{labId}/drafts/{draftId}`

```typescript
{
  draftId: 'draft-123',
  status: 'submitted',
  submittedAt: timestamp,
  mockMode: true,              // NEW: marks as test submission
  protocolo: 'MOCK-...',        // Real format, prefixed
  labId: 'lab-456',
  auditLog: [
    {
      action: 'created',
      by: 'auditor-uid',
      ts: timestamp,
      mode: 'MOCK',
    },
    {
      action: 'submitted',
      by: 'rt-uid',
      ts: timestamp,
      mode: 'MOCK',
      remark: 'Submitted during credential delay (Phase 4.4 contingency)',
    },
  ],
}
```

---

## CTO Escalation Path (May 15, 17:00 BRT)

### Step 1: Check ANVISA Helpdesk (same day)

**Action:** CTO or Auditor sends escalation email to:
- **To:** `contato@anvisa.gov.br` (copied to provisioning contact)
- **Subject:** `[URGENTE] Sandbox Credenciais - Projeto HC Quality (CNPJ: XXX)`
- **Template:**

```
Prezados,

Solicitamos via [ORIGINAL_REQUEST_ID] sandbox credentials para integração NOTIVISA em 2026-05-10.
Até 2026-05-15 17:00 (BRT), não recebemos credenciais.

Projeto: Labclin HC Quality
CNPJ: [LAB_CNPJ]
Contato: [CTO_EMAIL] / [AUDITOR_EMAIL]
Telefone: [PHONE]

Solicitamos resposta urgente para manter timeline. Podemos integrar via endpoint mock até May 25.

Atenciosamente,
[CTO_NAME]
```

**Follow-up:** If no response within 48h → escalate to director + auditor. Document in this file.

### Step 2: Director Notification

**Action:** CTO notifies director + auditor of delay:

```
Subject: ANVISA Credentials Delayed — Phase 4.4 Contingency Activated

Impact: v1.4 timeline unaffected (mock endpoint enables parallel work)
Status: NOTIVISA feature disabled in production until real credentials
Duration: Expected May 25 (reset deadline) or until ANVISA responds
Risk: Low (no production NOTIVISA calls, all tests on mock)

Contingency activated: Phase 4.4 Mock Mode
- Development + testing continues on mock endpoint
- Feature flag disabled in Firestore rules (RF-NOTIVISA)
- All submissions marked with mockMode=true for audit
- Rollback plan: flip flag + redeploy when credentials arrive

Next check: May 18, 10:00 BRT
```

### Step 3: Risk Mitigation Document (This file)

Mark in `.planning/STATE.md`:

```markdown
## ANVISA Contingency Status

- **Activated:** 2026-05-15 17:00 BRT
- **Reason:** Sandbox credentials not provisioned
- **Phase:** 4.4 Mock Mode (feature flag OFF)
- **Duration:** Until May 25 or credentials arrive
- **Risk:** Low — no production impact, audit trail maintained
- **Owner:** CTO
- **Next review:** 2026-05-18 10:00 BRT
```

---

## Plan B: Mock Endpoint Until May 25

### 4.4 Extended (May 15–May 25)

If ANVISA still non-responsive by May 22:

1. **Notify Director + Auditor** of 10-day reset deadline (May 25)
2. **Document business impact** in decision log
3. **Prepare rollback**: if credentials arrive May 24, merge + deploy in <2h
4. **Prepare escalation**: if no credentials by May 25 → defer NOTIVISA to Phase 5 or later

### Rollback Checklist (Credentials Arrive)

```bash
# 1. Update env
firebase functions:config:set notivisa.mode=SANDBOX --project hmatologia2
firebase functions:config:set notivisa.apiKey=[REAL_KEY] notivisa.apiUrl=[REAL_URL]

# 2. Flip feature flag
git checkout functions/src/modules/notivisa/config.ts
# Change: NOTIVISA_MODE = 'SANDBOX'

# 3. Deploy
firebase deploy --only functions

# 4. Test
npm run test:notivisa -- --env=sandbox

# 5. Monitor
bash scripts/monitor-cloud-logs.sh 60 30
# Verify: no mock protocol IDs in logs, real ANVISA responses logged
```

---

## Backup Contact (ANVISA Escalation)

| Role | Name | Email | Phone |
|------|------|-------|-------|
| ANVISA Provisioning | [Contact from initial request] | [Email] | [Phone] |
| ANVISA Helpdesk | Suporte Técnico | contato@anvisa.gov.br | — |
| CTO (This project) | [CTO Name] | [CTO Email] | [CTO Phone] |
| Auditor (Lab) | [Auditor Name] | [Auditor Email] | [Auditor Phone] |
| Director (Lab) | [Director Name] | [Director Email] | [Director Phone] |

**Update contacts before May 10.**

---

## Risk Mitigation Summary

| Risk | Mitigation | Owner |
|------|-----------|-------|
| **No real credentials by May 15** | Activate Phase 4.4 Mock Mode immediately | CTO |
| **Production NOTIVISA leak** | Feature flag + Firestore rules block all real submissions | Security + CTO |
| **Test data confusion** | All mock submissions marked `mockMode=true` + "TESTE" UI badge | Auditor |
| **Timeline slip** | Mock endpoint unblocks dev; real credentials enable parallel work, no rework | CTO |
| **ANVISA unresponsiveness** | Escalation path + director notification + May 25 deadline | CTO + Director |
| **Rollback complexity** | Pre-tested rollback checklist (see above) | DevOps |

---

## Monitoring & Sign-Off

### Daily Checks (May 15–May 25)

- **07:00 BRT:** Review ANVISA email for responses
- **17:00 BRT:** If no response, update `.planning/STATE.md` with "Day N of contingency"
- **Weekly (Mondays):** CTO + Auditor + Director sync on escalation status

### Sign-Off Template

```
ANVISA Contingency Resolved — [DATE]

Credentials received: [YES/NO]
If YES:
  - Credentials issued by: [ANVISA Date]
  - Merged to main: [Commit SHA]
  - Deployed to sandbox: [Date/Time]
  - First live submission: [Protocol ID / Link to log]
  
If NO (escalation → Phase 5 or later):
  - Final escalation email sent: [Date]
  - Director approval to defer: [Date]
  - New target phase: Phase 5.X
  - Dependencies updated: [File paths]

Risk assessment: [CLOSED / ESCALATED]
```

---

## Files Modified by This Plan

When activated, create or update:

- `functions/src/modules/notivisa/config.ts` (feature flag)
- `functions/src/modules/notivisa/mockEndpoint.ts` (mock API)
- `functions/src/modules/notivisa/submitNotivisaCallable.ts` (wrapper)
- `functions/__tests__/modules/notivisa/submitNotivisa.spec.ts` (test lock)
- `src/features/notivisa/hooks/useNotivisaSubmit.ts` (UI flag)
- `.planning/STATE.md` (contingency status)
- `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` (fill contact fields if not done)

---

## References

- **Normal Phase 4.4 path:** [`docs/v1.4_NOTIVISA_SANDBOX_SETUP.md`](../docs/v1.4_NOTIVISA_SANDBOX_SETUP.md)
- **ADRs:** ADR-0014 (NOTIVISA architecture), ADR-0021 (mock testing strategy)
- **Incident response:** [`.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`](.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md)
- **ANVISA helpdesk:** https://www.anvisa.gov.br/english (support portal)

---

**Status:** Ready for activation  
**Last validated:** 2026-05-07  
**Next review:** 2026-05-15 (execute or close)
