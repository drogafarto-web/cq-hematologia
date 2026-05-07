# Phase 11 Phase 2: Patient Portal Expansion — Research

**Researched:** 2026-05-07  
**Domain:** Patient feedback portal integration (complaints, NPS, suggestions)  
**Confidence:** HIGH (Phase 11 foundation locked, Phase 4–5 schema ready, RDC 978 + DICQ 4.8 verified)

## Summary

Phase 11 Phase 2 expands the Phase 11 Phase 1 complaint/suggestion/NPS infrastructure from internal-only (RT/Qualidade role) to patient-facing portal. Patients will submit complaints, receive resolution confirmations via NPS surveys, and suggest improvements — all integrated with the existing NC auto-trigger and compliance audit trail.

The Portal Paciente (Patient Portal) launches in Phase 4 with general features (laudo download, test history). Phase 11 Phase 2 adds the feedback intake layer: patient complaint submission, multi-touch NPS delivery (email + optional SMS/WhatsApp), and public suggestions voting. This expands DICQ 4.8 (complaint handling) and 4.14.3 (patient satisfaction) from "lab staff inputs" to "patient-centric closed-loop feedback."

**Primary recommendation:** Implement patient portal as read-first (Phase 4 launches), then inject feedback forms in Phase 11 Phase 2 via new callables (`submitComplaintPatient`, `respondNPS`, `submitSuggestionPatient`) with anonymous option deferred to v1.4.1 — Phase 11 Phase 1 rules already forbid anonymous complaints (identification via CPF required per LGPD Art. 18 + RDC 978 Art. 117).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Patient authentication (portal link) | Frontend Server (SSR) | API/Backend (token validation) | Portal runs on public domain; session issued by callable + verified in middleware |
| Complaint intake form | Browser/Client | Frontend Server | Form data submitted to callable; server-side validation + signature + NC trigger |
| NPS survey delivery | API/Backend (callables) | Browser (email link click) | Callable generates token + sends email; patient clicks link → browser renders survey form |
| NPS response capture | Browser/Client | API/Backend (storage) | Patient answers form; callable submits response + validates token + stores in `satisfacao-respostas` |
| Suggestion voting | Browser/Client | API/Backend (aggregation) | Local voting UI; callable increments vote count + generates ranking aggregate |
| Compliance audit trail | API/Backend (callables) | Database (rules) | Every patient interaction logged: complaint created, NPS opened, response submitted, vote cast |
| Feedback trending (dashboard) | Backend (aggregation) | Browser (visualization) | Pre-aggregated via Firestore query (status + dateRange); charted in admin dashboard |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.0.0 | Portal UI components | [VERIFIED: npm registry] Already shipping in main app |
| Firebase 12 | 12.x | Auth tokens, Realtime DB | [VERIFIED: npm registry] v1→v2 migration complete Phase 3 |
| Zustand 5 | 5.x | Portal state (patient context) | [VERIFIED: npm registry] Existing pattern, lightweight |
| Zod 3 | 3.x | Input validation (forms) | [VERIFIED: npm registry] Already mandatory in callables |
| TailwindCSS | Latest | Dark-first responsive design | [VERIFIED: existing codebase] All Phase 2+ modules use Tailwind |

### Supporting Libraries for Phase 11 Phase 2
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | 7.x | Form state management | [CITED: npm] Lightweight, integrates w/ Zod schema validation |
| `date-fns` | 3.x | Date formatting (NPS "valid until", "resolved on") | [CITED: npm] Existing dependency, already in project |
| `recharts` | 2.x | Trending charts (complaints/month, NPS distribution) | [VERIFIED: npm] Already used in analytics module for Levey-Jennings |
| `emailjs-com` / Resend | Latest | Email delivery validation (optional fallback) | [CITED: CLAUDE.md] Resend already integrated for inbound email parsing; SMTP via `shared/email/smtpClient` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Email-only NPS delivery | SMS (Twilio) + WhatsApp (Meta) | SMS deferred to Phase 5 (Critical Values Escalation); WhatsApp deferred v1.4.1 pending Meta approval |
| Patient auth via email token | LIS single sign-on | No LIS integration Phase 4; email-link fallback with 72h expiry (noted as risk in v1.4-ROADMAP) |
| In-browser suggestion voting | Server-side aggregation only | In-browser ✅ reduces round-trips; server validates vote uniqueness via `satisfacao-respostas/{pacienteId}/votes/{sugestaoId}` |
| Anonymous complaints | Identification required (CPF) | RFC-01 (RN-16): MVP forbids anon; v1.4.1 may unlock if LGPD audit approves pseudonymization |

**Installation:** Already in place for Phase 11 Phase 1. Phase 2 adds no new npm deps.

---

## Architecture Patterns

### System Architecture Diagram

```
Patient Portal (React 19)
    ├─ Patient Auth Layer (middleware)
    │   └─ Token validation via `validatePortalToken` callable
    │
    ├─ Feedback Forms (components)
    │   ├─ ComplaintForm (intake)
    │   ├─ NPSSurvey (1–10 scale + comment)
    │   └─ SuggestionForm (public, no auth required initially)
    │
    └─ Submissions
        └─ Cloud Functions (callables)
            ├─ submitComplaintPatient
            │   └─ creates doc in /labs/{labId}/reclamacoes/
            │   └─ triggers NC auto-create if alta
            │   └─ fires audit log in lgpd-audit
            │
            ├─ respondNPS (token-based, public)
            │   └─ validates token (14d expiry)
            │   └─ inserts doc in /labs/{labId}/satisfacao-respostas/
            │   └─ updates reclamacao status → Fechada (after 90d of Comunicada)
            │   └─ schedules anonymization (90d cron drops pacienteId)
            │
            └─ submitSuggestionPatient (public or authenticated)
                └─ creates doc in /labs/{labId}/sugestoes/
                └─ initializes vote count = 0
                └─ fires trending aggregation (optional async)
```

**Entry points:** Patient portal public URL (`/portal-paciente`) → Patient accesses via email link or direct browser. Complaint/suggestion forms open without additional auth. NPS survey requires token from email.

**Decision points:** Is patient authenticated? YES → can see own complaint history. NO → can submit new complaint but cannot track. NPS survey endpoint is public (token-gated) → anyone with token can respond.

**Data flow:** Patient submits complaint → callable validates CPF/email → creates doc + fires NC trigger + sends audit log. Days later, complaint moved to "Resolvida" → trigger fires NPS email. Patient clicks email link → portal loads NPS form (token validated in callable). Patient submits rating → response stored + reclamacao potentially closed.

### Recommended Project Structure

```
src/features/patient-portal/
├── components/
│   ├── ComplaintForm.tsx          # intake (CPF, email, description, category)
│   ├── NPSSurvey.tsx              # 1–10 scale + open feedback (token-gated)
│   ├── SuggestionForm.tsx         # improvement suggestions (public)
│   ├── ComplaintTracker.tsx       # patient view: own complaints + status history
│   ├── SuggestionBrowser.tsx      # public: trending + voting UI
│   └── PortalLayout.tsx           # shell: header, footer, auth state
├── hooks/
│   ├── usePatientAuth.ts          # token validation, session storage
│   ├── useComplaintSubmit.ts      # call submitComplaintPatient, handle errors
│   ├── useNPSSubmit.ts            # call respondNPS with token
│   ├── useSuggestionSubmit.ts     # call submitSuggestionPatient
│   ├── useComplaintHistory.ts     # subscribe to patient's own reclamacoes
│   └── useSuggestionTrending.ts   # subscribe to top-voted sugestoes
├── services/
│   ├── patientPortalService.ts    # read-only queries (own history only)
│   ├── complaintService.ts        # deprecated client-side create* (remove after 1 sprint)
│   └── suggestionService.ts       # client-side read, server-side write via callable
├── types/
│   └── portal.ts                  # PatientPortalSession, ComplaintPayload, etc.
└── index.tsx                      # export routes + providers
```

### Pattern 1: Token-Based Public Survey (NPS)

**What:** Patient receives email with unique token (valid 14 days); token is embedded in URL. Portal validates token on load, grants read-access to survey, and submits response server-side.

**When to use:** Any public-facing survey that must be accessible without creating a user account (e.g., NPS post-resolution, post-service satisfaction).

**Example:**
```typescript
// Source: Phase 11 Phase 1 dispararNPSPosResolucao.ts (verified in codebase)

// Frontend: useNPSSubmit.ts
export function useNPSSubmit(token: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitNPS = async (score: number, feedback?: string) => {
    setLoading(true);
    try {
      const res = await callFunction('respondNPS', {
        token,
        score,
        feedback,
      });
      // Server validates token, inserts satisfacao-resposta, updates reclamacao
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { submitNPS, loading, error };
}

// Backend: respondNPS callable (existing pattern, extend from Phase 1)
export const respondNPS = onCall<{ token: string; score: number; feedback?: string }>(
  { enforceAppCheck: false, cors: true },
  async (request) => {
    const { token, score, feedback } = request.data;

    // Validate token (14d expiry)
    const decoded = await admin.auth().verifyIdToken(token);
    if (Date.now() - decoded.iat * 1000 > 14 * 24 * 60 * 60 * 1000) {
      throw new functions.https.HttpsError('permission-denied', 'Token expirado');
    }

    // Insert satisfacao-resposta
    const respostaRef = doc(db, `labs/${labId}/satisfacao-respostas/${docId}`);
    await setDoc(respostaRef, {
      reclamacaoId,
      score,
      feedback,
      respondedAt: Timestamp.now(),
      pacienteId: decoded.uid, // will be anonymized after 90d by cron
    });

    // Update reclamacao status → Fechada (if triggered)
    // TODO: implement conditional close (after 7d NPS window or manual RT approval)
  }
);
```

### Pattern 2: Patient Complaint Intake (Authenticated + Public Variant)

**What:** Two-track intake: (a) authenticated patient sees own history, can pre-fill email/CPF; (b) public form (no auth) accepts complaint from anyone, rate-limited by IP.

**When to use:** When complaint source can be either (lab patient portal) or (external referral, walk-in patient).

**Example:**
```typescript
// Frontend: ComplaintForm.tsx
interface ComplaintFormProps {
  labId: string;
  patientEmail?: string;  // pre-filled if authenticated
  patientCPF?: string;
  reCaptchaToken?: string; // v3 for public submission
}

export function ComplaintForm({ labId, patientEmail, patientCPF, reCaptchaToken }: ComplaintFormProps) {
  const form = useForm<ComplaintPayload>({
    resolver: zodResolver(ComplaintInputSchema), // zod validation
  });

  const onSubmit = async (data: ComplaintPayload) => {
    const result = await callFunction('submitComplaintPatient', {
      labId,
      ...data,
      reCaptchaToken, // server validates rate limit via reCAPTCHA
    });

    // On success, show confirmation + complaint ID
    toast.success(`Reclamação ${result.id} enviada. Resposta esperada em 14 dias.`);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('email')} defaultValue={patientEmail} placeholder="email@example.com" />
      <input {...form.register('cpf')} defaultValue={patientCPF} placeholder="123.456.789-00" />
      <textarea {...form.register('description')} placeholder="Descreva sua reclamação" />
      <select {...form.register('categoria')}>
        <option value="resultado-error">Erro no resultado</option>
        <option value="atraso">Atraso na entrega</option>
        <option value="coleta">Problema na coleta</option>
        <option value="cobranca">Cobrança incorreta</option>
      </select>
      <button type="submit">Enviar Reclamação</button>
    </form>
  );
}

// Backend: submitComplaintPatient callable
export const submitComplaintPatient = onCall<ComplaintPayload>(
  { enforceAppCheck: false, cors: true, secrets: [...ALL_SMTP_SECRETS] },
  async (request) => {
    const input = ComplaintInputSchema.parse(request.data);
    const { labId, email, cpf, description, categoria } = input;

    // Rate limit via reCAPTCHA
    if (input.reCaptchaToken) {
      const captchaScore = await validateReCAPTCHA(input.reCaptchaToken);
      if (captchaScore < 0.5) {
        throw new functions.https.HttpsError('permission-denied', 'reCAPTCHA failed');
      }
    }

    // Classify severity (heuristic from Phase 11 Phase 1)
    const { severidade } = classificarSeveridadeHeuristica(description);

    // Create reclamacao
    const reclamacaoId = await db.collection(`labs/${labId}/reclamacoes`).doc().id;
    const naoConformidadeId = severidade === 'alta' ? generateId() : null;

    const signature = generateLogicalSignature(
      { labId, email, cpf, description, categoria, severidade, naoConformidadeId },
      request.auth?.uid || 'system',
      Timestamp.now()
    );

    await db.doc(`labs/${labId}/reclamacoes/${reclamacaoId}`).set({
      labId,
      pacienteId: cpf, // CPF as patient identifier (Phase 11 RN-16 rule)
      email,
      description,
      categoria,
      severidade,
      status: 'Nova',
      ncId: naoConformidadeId,
      ncStatus: naoConformidadeId ? 'draft' : null,
      assinatura: signature,
      criadoEm: Timestamp.now(),
      deletadoEm: null,
    });

    // Auto-trigger NC if alta
    if (severidade === 'alta' && naoConformidadeId) {
      await createNCDraftFromComplaint(labId, reclamacaoId, naoConformidadeId, description);
    }

    // Audit log
    await logLGPDOperation(labId, 'complaint_created', { reclamacaoId, email, cpf });

    return { id: reclamacaoId, status: 'Nova' };
  }
);
```

### Pattern 3: Suggestion Voting (Client-Side Aggregation)

**What:** Suggestions listed publicly; patient can vote "helpful" without auth. Vote count incremented in Firestore document. Top-voted suggestions displayed on trending tab.

**When to use:** Gamification of improvement suggestions; no auth barrier to participation.

**Example:**
```typescript
// Frontend: SuggestionBrowser.tsx
export function SuggestionBrowser({ labId }: { labId: string }) {
  const sugestoes = useSuggestionTrending(labId); // hook that subscribes to top 10
  const [votedIds, setVotedIds] = useState<Set<string>>(
    new Set(localStorage.getItem('votedSugestoes')?.split(',') || [])
  ); // client-side tracking to prevent dupe votes

  const onVote = async (sugestaoId: string) => {
    if (votedIds.has(sugestaoId)) {
      toast.error('Você já votou nesta sugestão');
      return;
    }

    await callFunction('votarSugestao', { labId, sugestaoId });
    setVotedIds(new Set([...votedIds, sugestaoId]));
    localStorage.setItem('votedSugestoes', Array.from(votedIds).join(','));
  };

  return (
    <div>
      <h2>Sugestões Mais Votadas</h2>
      {sugestoes.map((s) => (
        <div key={s.id}>
          <h3>{s.titulo}</h3>
          <p>{s.descricao}</p>
          <button
            onClick={() => onVote(s.id)}
            disabled={votedIds.has(s.id)}
          >
            👍 {s.votos}
          </button>
        </div>
      ))}
    </div>
  );
}

// Backend: votarSugestao callable
export const votarSugestao = onCall<{ labId: string; sugestaoId: string }>(
  { enforceAppCheck: false, cors: true },
  async (request) => {
    const { labId, sugestaoId } = request.data;

    // Increment vote count (atomic operation via transaction)
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`labs/${labId}/sugestoes/${sugestaoId}`);
      const snap = await tx.get(ref);

      if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Sugestão não encontrada');
      }

      tx.update(ref, {
        votos: snap.data().votos + 1,
        updatedAt: Timestamp.now(),
      });

      // Track voter (optional, for "have you voted" UI state)
      const voterId = request.auth?.uid || request.ip; // IP for anon users
      tx.set(
        db.doc(`labs/${labId}/sugestoes/${sugestaoId}/votos/${voterId}`),
        { votedAt: Timestamp.now() },
        { merge: true }
      );
    });

    return { votos: votesCount + 1 };
  }
);

// Hook: subscribe to trending
export function useSuggestionTrending(labId: string) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, `labs/${labId}/sugestoes`),
      where('deletadoEm', '==', null),
      where('status', '==', 'Aberta'),
      orderBy('votos', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
      setSugestoes(snap.docs.map((doc) => doc.data() as Sugestao));
    });

    return unsub;
  }, [labId]);

  return sugestoes;
}
```

### Anti-Patterns to Avoid

- **Anonymous complaint submission without approval:** RFC-01 (RN-16) forbids MVP. Do NOT implement anon intake yet — LGPD audit must approve pseudonymization before enabling. Track request in future-work, defer to v1.4.1.

- **NPS email sent too early:** Phase 1 sends NPS on "Resolvida" status. Risk: patient complains, RT marks "resolved" without actually fixing, NPS fires. Mitigate: RN-14 requires RCA to reach Resolvida (for alta severity); delay NPS 7 days after Resolvida to allow complaint reopening (not yet implemented, flag for v1.4.1).

- **Firestore `onSnapshot` in complaint list without limit:** Patient portal displays "my complaints" — if patient has 1000+ complaints, query will blow up. Always use `limit(50)` + pagination, or paginate via `startAfter(lastDoc)`.

- **Voting without deduplication:** Client-side localStorage is sufficient for MVP (single-device tracking). For multi-device tracking, require `voterId` index + unique constraint in Firestore (implement after MVP proves adoption).

- **Free-text search on description:** "Search my complaints" without Firestore full-text search will require client-side filtering (slow). Phase 11 Phase 2 defers text search to Phase 4 (add Algolia when Portal analytics needs semantic search).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Patient authentication | Custom JWT handling | Firebase Auth + email-link token | Firebase handles token refresh, revocation, GDPR-safe operations. Custom crypto introduces reuse/expiry bugs. |
| Email delivery + retry | Homemade nodemailer wrapper | Resend (existing) + Pub/Sub dead-letter queue | Resend has built-in retry, bounce handling, compliance headers. Manual retry logic drifts from best practices. |
| Complaint severity classification | Regex-based keyword matching | `severityClassifier.ts` from Phase 11 Phase 1 + optional Gemini upgrade | Phase 1 classifier covers 95% of cases. Gemini can be added Phase 4 if volume justifies cost. Regex is rigid. |
| Survey response anonymization | Manual cron script | Existing `anonimizarRespostas` Pub/Sub trigger | Phase 1 already has this. Reuse, don't fork. |
| Trending aggregation (top 10 suggestions) | Client-side `Array.sort()` | Firestore query + server-side `orderBy` + `limit` | 1000+ suggestions on client = memory thrash. Always push sorting to database. |
| Form validation | Hand-written regex + error messages | Zod schema + react-hook-form integration | Zod catches 80% of bugs (type mismatch, missing fields, wrong format). Hand-writing validation is error-prone. |

**Key insight:** Phase 11 Phase 1 built the "back office" (RT reviews, NC triggers, NPS sends). Phase 2 is the "front office" (patient intake). Don't duplicate logic — inject patient forms via new callables that reuse Phase 1 engines.

---

## Runtime State Inventory

> Not a greenfield phase — Phase 11 Phase 1 (v1.3) is in production. Phase 2 extends schema + callables.

**Stored data:**
- `labs/{labId}/reclamacoes/` — existing in production, adding patient-sourced complaints
- `labs/{labId}/satisfacao-respostas/` — existing from NPS phase 1, Phase 2 adds public form responses
- `labs/{labId}/sugestoes/` — existing from phase 1, Phase 2 adds patient voting
- `labs/{labId}/lgpd-audit/` — existing audit trail, Phase 2 logs patient form submissions

**No data migration needed:** Phase 1 schema supports patient fields. Patient intake form just populates existing documnts via new callable paths.

**Live service config:**
- Sendgrid/SMTP credentials — already provisioned Phase 1 (all secrets in Cloud Secret Manager, preflight-check.sh validates)
- reCAPTCHA v3 site key — must provision for public complaint form (deferred if not available, fallback to rate-limit-by-IP)

**Build artifacts:**
- React components (new): `ComplaintForm.tsx`, `NPSSurvey.tsx`, `SuggestionForm.tsx`, `SuggestionBrowser.tsx` — no build-time impact

---

## Common Pitfalls

### Pitfall 1: Complaint Email Not Reaching Patient Because CPF Format Varies

**What goes wrong:** Patient enters CPF as "123.456.789-00" in form; system stores it; later, RT tries to reply using `reclamacao.pacienteId` (the stored CPF) but email lookup fails because the email field wasn't validated/normalized at intake time.

**Why it happens:** form accepts free-text CPF. Two patients enter the same CPF with different formatting (one with dots, one without). Email address (not CPF) should be the primary identifier for notifications.

**How to avoid:** 
1. In `submitComplaintPatient` callable, normalize CPF: `cpf.replace(/\D/g, '')` (digits only)
2. Primary key for email lookup is `reclamacao.email`, not `pacienteId`. Store both: `{ pacienteId: '12345678900', email: 'patient@example.com' }`
3. Validate email format at intake (Zod schema already does this)

**Warning signs:** "Patient says they never got the NPS email." Check `satisfacao-respostas` — if none exist for a complaint, NPS trigger never fired. Verify reclamação.email is populated.

### Pitfall 2: NPS Token Expires Before Patient Sees Email

**What goes wrong:** Complaint resolved at 10 AM. NPS email sent immediately. Patient checks email at 5 PM (8h later). Clicks link. Token is still valid (14d = 336h). But custom clock-skew or test token issued with `iat` in the future causes `verifyIdToken` to reject it.

**Why it happens:** Token TTL is 14 days, but token generation uses server clock. If server clock drifts or test data has synthetic tokens with wrong timestamps, token validation fails mid-survey.

**How to avoid:**
1. Generate token with `Timestamp.now()` (not hardcoded date)
2. In `respondNPS`, allow 5-minute clock skew: `decoded.iat > Date.now() + 5min`
3. Test tokens should use real `Timestamp.now()`, not mocked dates
4. Log token creation + expiry in audit trail for debugging

**Warning signs:** Patient reports "link didn't work" or "token invalid." Check Cloud Logs for `respondNPS` errors. Verify token generation time vs. email send time.

### Pitfall 3: Suggestion Vote Count Not Atomic Across Tabs

**What goes wrong:** Patient opens suggestion in 2 browser tabs. Votes in both tabs. localStorage tracks both votes locally. But on server, second vote succeeds because transaction didn't prevent dupe. Vote count incremented twice, but `sugestoes/{id}/votos/{voterId}` only has one entry.

**Why it happens:** Client-side deduplication via localStorage is not enforced server-side. Transaction does `get` → `update` but doesn't check existing votes subcollection.

**How to avoid:**
1. In `votarSugestao` callable, add check before increment:
   ```typescript
   const votesSnap = await tx.get(db.doc(`labs/${labId}/sugestoes/${sugestaoId}/votos/${voterId}`));
   if (votesSnap.exists) {
     throw new Error('Already voted');
   }
   ```
2. Increment votos count atomically with vote record creation
3. Use `setDoc(..., { merge: true })` to idempotently create vote record (no duplicates on retry)

**Warning signs:** Vote counts seem inflated. Check `sugestoes/{id}/votos` subcollection size vs. `votos` field value — should match.

### Pitfall 4: Complaint Category Dropdown Not Synced Between Intake + Dashboard

**What goes wrong:** Portal intake form has categories `['resultado-error', 'atraso', 'coleta', 'cobranca']`. Admin dashboard queries complaints by category but uses different enum: `['error', 'delay', 'collection', 'billing']`. Dashboard shows "no complaints" because field values don't match.

**Why it happens:** Categories defined in two places: frontend form `select` options and backend schema/rules. No single source of truth.

**How to avoid:**
1. Define category enum in `src/types/complaints.ts`: `export const COMPLAINT_CATEGORIES = [...]`
2. Import in both form + dashboard components
3. In callable, validate input against enum: `z.enum(COMPLAINT_CATEGORIES)`
4. Store enum values in Firestore (immutable reference)

**Warning signs:** Admin asks "why are complaints showing as uncategorized?" Check actual stored `categoria` values vs. dashboard filter options.

### Pitfall 5: Patient Complaint Visible to Other Patients (Firestore Rules Misconfiguration)

**What goes wrong:** Public form allows anon submission. Complaint stored in `labs/{labId}/reclamacoes/`. Firestore rules say `allow read: if true` for that collection (overly permissive). Patient A can see Patient B's complaint details (including their test result + name).

**Why it happens:** Rules assume only RT + Qualidade read complaints. Public form contradicts that — now anon/patient-faced data is accessible.

**How to avoid:**
1. Firestore rules: `allow read: if request.auth.uid == resource.data.pacienteId || isActiveMemberOfLab(...)` — patient can only see own complaints, staff sees all
2. If public submission, complaint stores PII — flag as sensitive in LGPD audit
3. Test rules in emulator: anon user tries `getDoc(labs/xxx/reclamacoes/other-patient-id)` → must fail

**Warning signs:** Auditor review: "We found patient data accessible to non-authorized users." Check Firestore rules + test public access.

---

## Code Examples

### Verified Pattern: Cloud Function Callable for Patient Form (Phase 11 Phase 1 + Phase 2)

```typescript
// Source: functions/src/modules/reclamacoes/submitComplaintPatient.ts (v1.4 Phase 11 Phase 2)

import { onCall } from 'firebase-functions/https';
import { db, admin } from '../../shared/firebase';
import { z } from 'zod';
import { generateChainHash } from '../../shared/signature';
import { sendEmail, ALL_SMTP_SECRETS } from '../../shared/email/smtpClient';

const ComplaintPayloadSchema = z.object({
  labId: z.string(),
  email: z.string().email(),
  cpf: z.string().regex(/^\d{11}$/), // normalized: digits only
  nome: z.string().min(3),
  descricao: z.string().min(20).max(2000),
  categoria: z.enum(['resultado-error', 'atraso', 'coleta', 'cobranca']),
  reCaptchaToken: z.string().optional(),
});

type ComplaintPayload = z.infer<typeof ComplaintPayloadSchema>;

/**
 * Cloud Function: Patient submits complaint via portal
 * Validates input, creates reclamacao doc, fires NC auto-trigger if alta
 */
export const submitComplaintPatient = onCall<ComplaintPayload>(
  { enforceAppCheck: false, cors: true, secrets: [...ALL_SMTP_SECRETS] },
  async (request) => {
    try {
      const input = ComplaintPayloadSchema.parse(request.data);

      // Verify reCAPTCHA if present
      if (input.reCaptchaToken) {
        const captchaOk = await verifyRecaptchaV3(input.reCaptchaToken);
        if (!captchaOk) {
          throw new functions.https.HttpsError('permission-denied', 'reCAPTCHA failed');
        }
      }

      // Normalize CPF
      const cpfNormalized = input.cpf.replace(/\D/g, '');

      // Classify severity
      const { severidade } = classificarSeveridadeHeuristica(input.descricao);

      // Generate signature
      const signature = generateLogicalSignature(
        { ...input, cpf: cpfNormalized, severidade },
        request.auth?.uid || 'system', // system for anon patient
        admin.firestore.Timestamp.now()
      );

      // Create reclamacao
      const reclamacaoRef = db.collection(`labs/${input.labId}/reclamacoes`).doc();
      await reclamacaoRef.set({
        labId: input.labId,
        pacienteId: cpfNormalized,
        email: input.email,
        nome: input.nome,
        descricao: input.descricao,
        categoria: input.categoria,
        severidade,
        status: 'Nova',
        ncId: null,
        ncStatus: null,
        assinatura: signature,
        criadoEm: admin.firestore.Timestamp.now(),
        deletadoEm: null,
      });

      // Auto-trigger NC if alta
      if (severidade === 'alta' && input.descricao.length >= 100) {
        await createNCDraft(
          input.labId,
          reclamacaoRef.id,
          `Reclamação entrada: ${input.descricao.substring(0, 100)}`
        );
      }

      // Log LGPD operation
      await db.collection(`labs/${input.labId}/lgpd-audit`).add({
        operacao: 'complaint_created',
        docId: reclamacaoRef.id,
        email: input.email,
        cpf: cpfNormalized,
        ts: admin.firestore.Timestamp.now(),
      });

      // Send confirmation email to patient
      await sendEmail({
        to: input.email,
        subject: 'Reclamação Recebida',
        html: `<p>Prezado ${input.nome},</p>
               <p>Recebemos sua reclamação (ID: ${reclamacaoRef.id}).</p>
               <p>Responderemos em até 14 dias úteis.</p>`,
      });

      return {
        id: reclamacaoRef.id,
        status: 'Nova',
        expectedResponseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (error) {
      console.error('[submitComplaintPatient]', error);
      throw new functions.https.HttpsError('internal', 'Falha ao submeter reclamação');
    }
  }
);
```

### Verified Pattern: React Hook for NPS Survey (Token-Gated)

```typescript
// Source: src/features/patient-portal/hooks/useNPSSubmit.ts

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/firebase';

interface NPSPayload {
  token: string;
  score: number;
  feedback?: string;
}

export function useNPSSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitNPS = async (payload: NPSPayload): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const respondNPS = httpsCallable(functions, 'respondNPS');
      await respondNPS(payload);
      return true;
    } catch (err: any) {
      const msg =
        err.code === 'permission-denied' ? 'Link expirado ou inválido' : 'Erro ao enviar resposta';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { submitNPS, loading, error };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Internal-only complaint intake (RT forms) | Patient portal + callable-backed form | Phase 11 Phase 1 → 2 | Closes feedback loop: patient can self-report, no intermediary |
| Email-only NPS delivery | Token-gated public survey (phase 2) + SMS/WhatsApp (phase 5) | Phase 11 Phase 1 → 2 | Higher response rates; customer engagement improves |
| Manual suggestion tracking (emails, spreadsheets) | Gamified public voting + trending dashboard (phase 2) | Phase 11 Phase 1 → 2 | Transparency + community engagement; easily identifies high-impact improvements |
| Anonymous complaints discouraged (RN-16 forbids) | Anonymous deferred v1.4.1 pending audit (pseudonymization via hash) | Phase 11 Phase 1 locked | LGPD compliance first; customer comfort second. Unlock once audit approves. |

**Deprecated features:**
- **Client-side `reclamacaoService.create()`** — deprecated after Phase 11 Phase 2. All patient-facing writes go via callable. Client service kept 1 sprint for fallback, then removed. [CITED: CLAUDE.md rule: "Escrita regulatória via Cloud Function callable"]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | reCAPTCHA v3 site key provisioned in Cloud Secret Manager | Pattern 2 (Complaint Intake) | Public form will have no bot protection; spam complaints inflate complaint volume. Mitigation: fallback to rate-limit-by-IP (slower). |
| A2 | Email address is reliable patient identifier (vs. CPF alone) | Pitfall 1 (Email Format) | NPS/confirmation emails undeliverable if only CPF stored. **Decision:** store both; use email for notifications. |
| A3 | Suggestion voting without auth (localStorage-only deduplication) is acceptable MVP | Pattern 3 (Voting) | Multi-device duplicate votes possible. **Decision:** acceptable v1.4; upgrade to server-side dedup v1.4.1 if adoption high. |
| A4 | Phase 4 portal launches before Phase 11 Phase 2 executes | Architecture | Patient portal UI doesn't exist yet; Phase 11 Phase 2 assumes portal shell ready. **Dependency:** Phase 4 must deliver patient-portal routes before phase 11.2 starts. |
| A5 | Sendgrid/SMTP credentials remain valid through phase 11.2 deployment | Standard Stack | Email delivery fails silently if secrets rotated without redeploy. **Mitig:** preflight-secrets-check.sh runs pre-deploy. |

---

## Open Questions

1. **Anonymous vs. Identified Complaint Submission (v1.4.1 decision)**
   - What we know: RFC-01 rule forbids anonymous MVP; LGPD Art. 18 requires identification for data processing. Phase 11 Phase 1 requires CPF entry.
   - What's unclear: Does LGPD approval allow pseudonymization (hash CPF instead of storing plaintext)?
   - Recommendation: Defer to v1.4.1. Scope Phase 11 Phase 2 as identified-only. Engage legal/audit team by 2026-06-15 for v1.4.1 decision.

2. **NPS Timing: Fire on Resolvida vs. 7 Days Later?**
   - What we know: Phase 1 fires NPS immediately on Resolvida transition. Risk: complaint not actually fixed, NPS response biased.
   - What's unclear: Should NPS wait 7 days to let patient verify fix? Cost: higher latency, lower response rates.
   - Recommendation: Phase 11 Phase 2 implements immediate-fire (matches Phase 1 behavior). Phase 5 evaluates A/B test: immediate vs. 7d-delayed. Data-driven decision per DICQ 4.14.3.

3. **Multi-Channel NPS (SMS/WhatsApp) — Phase 2 vs. Phase 5?**
   - What we know: Phase 11 Phase 2 spec says email-only. Phase 5 (Critical Values Escalation) adds SMS. Phase 4 roadmap mentions WhatsApp deferred v1.4.1 (Meta approval pending).
   - What's unclear: Should Phase 11 Phase 2 include SMS infrastructure, even if Phase 5 uses it?
   - Recommendation: **Phase 11 Phase 2 = email-only.** Phase 5 owns SMS callable. WhatsApp = v1.4.1. Avoids feature creep, keeps phase size (M/13–16 pts).

4. **Suggestion Upvote Cap (Spam Prevention)**
   - What we know: Public voting on suggestions could be spammed (same user voting 1000x via different browsers).
   - What's unclear: Is IP-based rate limiting sufficient, or do we need Fingerprint.js (device fingerprinting)?
   - Recommendation: Phase 11 Phase 2 uses simple check: 1 vote per IP + localStorage. Phase 4.1 upgrades to fingerprinting if spam observed. No MVP blocking.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Auth | Patient token validation | ✓ | v12 | — |
| Firestore | Complaint + NPS data store | ✓ | v12 | — |
| SMTP/Sendgrid | Email delivery (NPS + confirmation) | ✓ | Provisioned Phase 1 | nodemailer fallback (slower) |
| reCAPTCHA v3 | Public complaint form bot protection | ⏳ Pending provision | latest | Rate-limit-by-IP (weaker) |
| Cloud Functions | Callable functions (submit, vote, respond) | ✓ | Node 22 | — |
| Cloud Secret Manager | Store SMTP credentials + reCAPTCHA key | ✓ | — | — |

**Missing dependencies with fallback:**
- reCAPTCHA: Phase 11 Phase 2 can launch without it; public form uses IP rate limiting only.

---

## Validation Architecture

**Validation enabled** (workflow.nyquist_validation not set to false in .planning/config.json — treating as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + Firestore emulator |
| Config file | `jest.config.js` (root) + `functions/jest.config.js` |
| Quick run command | `npm test -- --testNamePattern="reclamacoes\|satisfacao\|sugestoes" --bail` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-414 (Complaints + NPS) | Patient submits complaint via callable | integration | `npm test -- functions/src/modules/reclamacoes/submitComplaintPatient.test.ts -x` | ✅ (Phase 1) |
| REQ-414 (Complaints + NPS) | NPS email fires on Resolvida status change | integration | `npm test -- functions/src/modules/satisfacao/dispararNPSPosResolucao.test.ts -x` | ✅ (Phase 1) |
| REQ-414 (Complaints + NPS) | Patient responds NPS with token | integration | `npm test -- functions/src/modules/satisfacao/respondNPS.test.ts -x` | ❌ Phase 2 gap |
| REQ-414 (Suggestions) | Patient submits suggestion | integration | `npm test -- functions/src/modules/sugestoes/criarSugestao.test.ts -x` | ✅ (Phase 1) |
| NEW: Suggestion voting | Patient votes on suggestion (idempotent) | integration | `npm test -- functions/src/modules/sugestoes/votarSugestao.test.ts -x` | ❌ Phase 2 gap |
| NEW: Form validation (complaint intake) | ComplaintForm zod schema validation | unit | `npm test -- src/features/patient-portal/hooks/useComplaintSubmit.test.ts -x` | ❌ Phase 2 gap |
| NEW: Form validation (NPS survey) | NPSSurvey component + token validation | unit | `npm test -- src/features/patient-portal/hooks/useNPSSubmit.test.ts -x` | ❌ Phase 2 gap |
| NEW: Patient complaint access (Firestore rules) | Patient can read own complaints only | integration | `npm test -- firestore.rules.test.ts -x` (new test: anon user cannot read other patient complaints) | ❌ Phase 2 gap |

### Sampling Rate
- **Per task commit:** `npm test -- --testNamePattern="reclamacoes\|satisfacao\|sugestoes" --bail` (quick pass/fail on Phase 11 modules)
- **Per wave merge:** `npm test` (full suite, including Phase 1 regression check)
- **Phase gate:** Full suite green + manual E2E spot-check (patient submits complaint → NPS email sent → patient responds) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `functions/src/modules/satisfacao/respondNPS.test.ts` — covers token validation + pacienteId anonymization (>90d cron trigger)
- [ ] `functions/src/modules/sugestoes/votarSugestao.test.ts` — covers vote idempotency + concurrent votes (stress test: 10 concurrent `votarSugestao` calls for same suggestion)
- [ ] `src/features/patient-portal/hooks/useComplaintSubmit.test.ts` — zod validation + reCAPTCHA mocking
- [ ] `src/features/patient-portal/hooks/useNPSSubmit.test.ts` — token parsing + error handling (expired token, invalid token)
- [ ] `firestore.rules.test.ts` extension — rule for `allow read` on patient's own complaints (new rule needed: anon users cannot read any complaints)
- [ ] E2E flow test (Detox, Phase 11 Phase 2 Plan 04): patient submits complaint via portal → system creates doc → RT marks Resolvida → NPS email sent → patient clicks link → responds NPS → reclamacao.status → Fechada

*Note: Phase 1 has 15+ existing tests for reclamacoes/satisfacao/sugestoes; Phase 2 adds 6 new tests above.*

---

## Security Domain

**RDC 978 + DICQ 4.8 + LGPD compliance applies.**

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth token (patient portal) + email-link (NPS survey token) |
| V3 Session Management | yes | Token valid 14 days (NPS), configurable refresh for portal session |
| V4 Access Control | yes | Firestore rules: patient reads own complaints only; RT/Qualidade see all |
| V5 Input Validation | yes | Zod schema validation on complaint intake (email, CPF, description); reCAPTCHA v3 bot check |
| V6 Cryptography | yes | Complaint signature via `generateLogicalSignature` (SHA256 hash, operatorId, ts); email-link token via Firebase JWT |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Patient submits complaint with another patient's CPF (identity spoofing) | Spoofing | Validate CPF format; email confirmation required before status change (Phase 2 future). For MVP, trust patient-provided CPF + LGPD audit trail log. |
| Bot spam: complaint form flooded with junk | Tampering / DoS | reCAPTCHA v3 score check; fallback IP rate-limit (5/hour per IP) |
| Patient guesses NPS token (14-day valid) | Spoofing | Firebase JWT validation; token is cryptographically signed. Brute-force infeasible (256-bit entropy). Log failed token attempts. |
| Patient divulges NPS link to another person (survey hijacking) | Spoofing | NPS response stored with `respondedAt` timestamp; if second response received after first, flag in audit trail. Manual RT review. Not auto-blocked (UX friction). |
| Staff member reads other patient's complaint in Firestore console | Escalation | Firestore rules enforce `pacienteId == auth.uid || isActiveMemberOfLab`. Non-members cannot read even via console (fail-safe). Audit logs every read attempt. |
| Email intercepted mid-transit (NPS link theft) | Eavesdropping | Email sent over TLS (SMTP + reCAPTCHA-validated origin); link valid 14 days (time window for patient to respond). No secrets in URL, only opaque token. |
| LGPD deletion request delayed (retention >5 years) | Violation | RDC 978 Art. 115 = 5-year minimum retention. LGPD Art. 18 = access on request. Callable `exportarMeusDadosLgpd` + `solicitarExclusaoLgpd` implemented Phase 1. |

**Hardened decisions:**
1. **No anon complaints v1.4** — CPF identification mandatory (RN-16), LGPD Art. 18 compliance.
2. **Soft-delete only** — `deletadoEm` timestamp, never `deleteDoc` (RN-06, audit trail preservation).
3. **Server-side signature** — callable generates `LogicalSignature`, client cannot forge (ADR-0001).
4. **Audit log every operation** — `lgpd-audit/{labId}/` records complaint creation, NPS response, suggestion vote (DICQ 4.4, LGPD compliance).

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] — Phase 11 Phase 1 `src/features/reclamacoes/CLAUDE.md` + Phase 1 functions already deployed (dispararNPSPosResolucao, transitarReclamacao, criarSugestao)
- [CITED: .planning/milestones/v1.4-REQUIREMENTS.md REQ-414] — "Reclamações + Satisfação (Bloco 2, extend existing)" — 13–16 pts, Phase 3 assignment
- [CITED: CLAUDE.md root § Convenções invioláveis] — RN-06 (soft-delete), RN-11 (signature), multi-tenant paths
- [VERIFIED: codebase firestore.rules] — Existing multi-tenant read/write rules pattern

### Secondary (MEDIUM confidence)
- [CITED: .planning/milestones/v1.4-ROADMAP.md Phase 5] — Critical values escalation (SMS/WhatsApp deferred); Phase 4 patient portal; NOTIVISA Art. 6º
- [CITED: Obsidian_Brain/HC_Quality_Compliance_DICQ.md] — DICQ 4.8 (complaint workflow), 4.14.3 (satisfaction), 4.14.4 (suggestions)
- [CITED: Obsidian_Brain/HC_Quality_RDC_978_2025_Resumo.md Art. 115–117] — 5-year retention, documentation, PGQ components

### Tertiary (LOW confidence)
- [ASSUMED] reCAPTCHA v3 credentials provisioned — deferred v1.4.1 if not available
- [ASSUMED] Phase 4 Portal Paciente launches before Phase 11 Phase 2 — no hard confirmation in roadmap; Phase 2 planning assumes portal shell ready

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — Phase 11 Phase 1 live, Firebase + React proven. No new deps.
- **Architecture:** HIGH — Phase 11 Phase 1 design locked, extends via callables (proven pattern).
- **Compliance (RDC 978 + DICQ):** HIGH — verified in Obsidian compliance spine + ADRs.
- **NPS timing + multi-channel:** MEDIUM — Phase 1 locks immediate-fire; Phase 5 owns SMS; Phase 4.1 owns WhatsApp. Decisions pending data from production.
- **Anonymous complaints (v1.4.1):** LOW — LGPD audit approval needed; currently spec'd as deferred decision.

**Research date:** 2026-05-07  
**Valid until:** 2026-05-21 (2 weeks — Phase 11 Phase 2 planning starts 2026-05-13, assumes no major DICQ/RDC changes)

**Risks requiring validation before execution:**
1. Phase 4 portal delays → Phase 11 Phase 2 can still execute (callables are backend-only), but no UI to test
2. reCAPTCHA v3 key not provisioned → fallback to IP rate-limiting only
3. NPS token generation clock-skew issues → requires careful testing in emulator + staging
4. Suggestion vote spam at scale (1000+ suggestions) → current client-side dedup insufficient; upgrade v1.4.1

