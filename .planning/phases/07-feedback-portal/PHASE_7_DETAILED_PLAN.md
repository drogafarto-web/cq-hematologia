---
phase: 07-feedback-portal
type: detailed-plan
scope: 'Satisfação/Feedback Portal Integration — Patient NPS + Staff Suggestions + Trending Dashboard + Complaint Integration'
duration: '1.5 weeks'
wave: 2
depends_on: ['Phase 3 Complete (Foundation)', 'Phase 11 Reclamacoes Foundation']
deliverables:
  [
    'Patient feedback portal (NPS + comments)',
    'Staff suggestions intake (web + mobile)',
    'Trending dashboard (NPS + RCA + suggestions)',
    'Complaint closure loop integration',
    'Email campaign triggers (critical laudo → NPS)',
    'Anonimização cron (>90d PII zero-out)',
    'E2E test specs (8 tests)',
  ]
compliance:
  ['DICQ 4.14.3', 'DICQ 4.14.4', 'RDC 978 Art. 36', 'LGPD Lei 13.709/18', 'CDC Lei 8.078/90']

must_haves:
  truths:
    - 'Patient NPS form accepts 0–10 score + optional comment; 0–6 detrator, 7–8 neutro, 9–10 promotor per NPS standard'
    - 'NPS responses anonymized after 90d: pacienteId → null, cpfHash retained for analytics'
    - 'Staff suggestions state machine: novo → review → implementado|rejected with upvote dedup'
    - 'Trending dashboard shows NPS trend (monthly), complaint RCA word cloud, suggestion volume + implementation %'
    - 'Email trigger on laudo marked critical/urgente: 5-day delay, NPS survey link via token-based access'
    - 'Complaint closure flow visible in feedback portal: status → notification on NPS submission'
    - 'Gemini sentiment classification optional (Phase 7.2+); baseline MVP is manual classification'
    - 'All writes to satisfacao/sugestoes enforce LogicalSignature + chainHash per ADR-0001'
  artifacts:
    - path: 'src/features/satisfacao/components/NPSPortalForm.tsx'
      provides: 'Patient-facing NPS form (0–10 scale, sentiment icons, comment box, reCAPTCHA v3)'
      contains: 'export const NPSPortalForm'
    - path: 'src/features/sugestoes/components/SuggestionsIntake.tsx'
      provides: 'Staff + public suggestion form (web + PWA-optimized mobile)'
      contains: 'export const SuggestionsIntake'
    - path: 'src/features/satisfacao/components/TrendingDashboard.tsx'
      provides: 'Trending analysis: NPS monthly trend, RCA wordcloud, suggestion stats'
      contains: 'export const TrendingDashboard'
    - path: 'src/features/reclamacoes/hooks/useReclamacaoClosureNotification.ts'
      provides: 'Listen to reclamacao status changes, emit NPS trigger'
      exports: ['useReclamacaoClosureNotification']
    - path: 'functions/src/modules/satisfacao/email-campaigns.ts'
      provides: 'Cloud Function callables for NPS email dispatch (post-laudo, recurring quarterly)'
      exports: ['dispatchNPSPostLaudo', 'dispatchNPSQuarterly']
    - path: 'functions/src/scheduled-tasks/anonimizarRespostas.ts'
      provides: 'Pub/Sub daily cron to zero-out PII >90d old'
      exports: 'Function: anonimizarRespostas'
    - path: 'firestore.rules'
      provides: 'Security rules for satisfacao + sugestoes collections'
      contains: 'match /labs/{labId}/satisfacao-respostas, match /labs/{labId}/sugestoes'
    - path: 'firestore.indexes.json'
      provides: 'Composite indices for NPS trending + suggestion queries'
      contains: '[nodePaths: labs/{labId}/(satisfacao-respostas|sugestoes)]'
  key_links:
    - from: 'src/features/satisfacao/components/NPSPortalForm.tsx'
      to: 'functions/src/modules/satisfacao/email-campaigns.ts'
      via: 'submitNPSResposta callable'
      pattern: 'callable.*satisfacao.*npsResposta'
    - from: 'src/features/reclamacoes/hooks/useReclamacaoClosureNotification.ts'
      to: 'functions/src/modules/satisfacao/email-campaigns.ts'
      via: 'dispatchNPSPostLaudo trigger on Resolvida status'
      pattern: 'onUpdate.*Reclamacao.*status.*Resolvida'
    - from: 'functions/src/scheduled-tasks/anonimizarRespostas.ts'
      to: 'src/features/satisfacao/types/satisfacao.ts'
      via: 'NPSResposta.anonimizadoEm + piiMask'
      pattern: 'timestamp.*90d.*anonimizado'
---

## 1. Objective

Complete the feedback loop for HC Quality v1.4 Wave 2:

- **Patient-centric**: Post-resolution NPS form + optional Gemini sentiment analysis
- **Staff-engaged**: Suggestion intake with voting + implementation tracking
- **Analytics-ready**: Monthly NPS trending, RCA root-cause word cloud, suggestion volume % implemented
- **Compliant**: DICQ 4.14.3/4.4 satisfaction + suggestions; LGPD anonymization >90d; RDC 978 5-year retention via soft-delete
- **Integrated**: Complaint closure triggers NPS email; feedback portal shows reclamacao status

---

## 2. Context & Dependencies

### Existing Foundation (Phase 11 — Reclamacoes)

- **Reclamacao** type: complaint workflow (Nova → Analisando → RCA → Resolvida → Comunicada → Fechada)
- **Sugestao** type: suggestion state machine (aberta → analisada → implementada|rejeitada)
- **NPSResposta** type: 0–10 scale, origem (pos-resolucao|recurring-trimestral), anonymized after 90d
- **Services**: `satisfacaoService.ts`, `sugestaoService.ts`, `reclamacaoService.ts` (client-side CRUD)
- **Cloud Functions (Phase 11-03+)**: callable stubs for createReclamacao, criarSugestao, submitNPSResposta

### Design System

- Dark-first, Tailwind 4 + tokens in `DESIGN_SYSTEM.md`
- References: Linear, Stripe, Apple (sophisticated, editorial typography)
- Tablet-responsive PWA (critical for mobile staff intake)
- No color-only UX — icons + labels for sentiment (😠 detrator, 😐 neutro, 😊 promotor)

### Compliance Baseline

| Standard           | Requirement                       | Phase 7 Scope                                        |
| ------------------ | --------------------------------- | ---------------------------------------------------- |
| DICQ 4.14.3        | Customer satisfaction measurement | NPS campaign + quarterly recurring + post-resolution |
| DICQ 4.14.4        | Suggestion/improvement feedback   | Suggestion intake + status tracking + upvote         |
| RDC 978 Art. 36–39 | Complaint handling SLA (30d)      | Reclamacao workflow + closure notification           |
| LGPD Art. 18       | Right to access + deletion        | LgpdRequest callable + audit trail                   |
| LGPD Art. 9        | Special category PII (health)     | pacienteId → null after 90d; cpfHash retained        |
| CDC Lei 8.078/90   | Consumer protection               | 30-day response SLA on reclamacao                    |

---

## 3. Architecture & Data Model

### 3.1 Firestore Schema Extensions

**Existing collections (reused from Phase 11):**

```
/labs/{labId}/
  satisfacao-respostas/{respostaId}
    — id, labId, pacienteId (→ null after 90d), cpfHash, nota (0–10)
    — origem (pos-resolucao | recurring-trimestral), reclamacaoId, respondidoEm
    — comentario?, anonimizadoEm?, signature { hash, operatorId, ts }
    — criadoEm, deletadoEm

  sugestoes/{sugestaoId}
    — id, labId, autorId?, autorTipo, titulo, descricao, categoria
    — status (aberta → analisada → implementada|rejeitada)
    — votos, votaraisPor[], comentarios[]
    — signature, criadoEm, deletadoEm
```

**New subcollections (Phase 7):**

```
/labs/{labId}/
  satisfacao-respostas/{respostaId}/
    sentimento-gemini/{analiseId}     [Phase 7.2+]
      — score (1–5, derived from nota 0–10)
      — sentimentoGemini (positivo|neutro|negativo)
      — topicos[] (extracted keywords)
      — confianca (0–1)
      — criadoEm

  satisfacao-campanhas/{campanhaId}
    — trimestre (e.g., 2026-Q2)
    — dataInicio, dataFim, status (ativa|encerrada|processando)
    — quantidadeConvidados, quantidadeRespostas
    — npsResultado (float -100 to +100)
    — filterPacientes? (optional: dept, faixa-etaria)
    — criadoEm

  sugestoes-implementacoes/{implementacaoId}  [Phase 7.2+]
    — sugestaoId, status (em-progresso|implementada|cancelada)
    — dataImplementacao?, motivo?, responsavelId
    — signature, criadoEm
```

**Top-level analytics (read-only aggregates, computed daily):**

```
/labs/{labId}/
  analytics-feedback/
    nps-trending/{ano-mes}/
      — mes (2026-05), npsScore, detratores, neutros, promotores
      — respondentes, taxaResposta, criadoEm

    suggestion-stats/{ano-mes}/
      — mes, totalAberto, implementado, rejeitado, %Implementacao
      — topCategoria, volumeDescricao
      — criadoEm

    rca-wordcloud/{ano-mes}/     [Phase 7.2+]
      — mes, topWords[] { word, count, rootCauseFreq }
      — criadoEm
```

### 3.2 State Machines

**Reclamacao → NPS Trigger:**

```
Reclamacao status changes:
  Nova → [internal review] → Resolvida
    ↓ (trigger)
  Email: "Feedback appreciated. Rate your experience (5 mins)"
  Link: https://hmatologia2.web.app/portal-paciente/nps/{token}

  Resolvida state lasts 14 days max:
    Day 1–14: NPS email is resent if no response
    Day 15: Status → Fechada automatically

  Comunicada (after NPS received) → Fechada
    NPS submitted = status transition eligible
```

**Sugestao Workflow (State Machine):**

```
           +─────────────────────────────────────┐
           │                                     │
           v                                     │
       Aberta                                    │
      (novo, votos=0)                           │
           │                                    │
        [Staff/RT review]                       │
           │                                    │
           v                                    │
       Analisada                                │
    (priorized, votos counting)                 │
           │                          Rejeitada │
      [Implementation decision]            ←────┘
           │
           ├─→ Implementada (dataImplementacao set, votos locked)
           │
           └─→ Rejeitada (motivoRejeicao, votos reset to 0)

Transitions:
  - aberta → analisada: Internal RT decision (no event)
  - analisada → implementada: dataImplementacao = now(), votaraisPor [] locked
  - analisada → rejeitada: motivoRejeicao required (50+ chars), votos reset
  - any state → any state: Soft-delete safe (deletadoEm timestamp)
```

**Email Campaign Trigger (Critical Laudo → NPS):**

```
Workflow: LauroEntity marked critical/urgente
  ↓ (Pub/Sub trigger via functions)
  [Wait 5 days]
  ↓
  generateNPSToken(lauroId, pacienteId, labId) → encrypted JWT
  ↓
  sendNPSEmail(pacienteId email, titulo: "Feedback on your laudo", link with token)
  ↓
  Portal: /portal-paciente/nps/{token} opens form
  ↓
  On submit: validateToken() → reclamacaoId = null (lauro-driven), origem = 'pos-laudo'
  ↓
  HMAC: signature generated server-side via callable submitNPSResposta
```

---

## 4. Feature Breakdown & Components

### 4.1 Patient Feedback Portal (NPSPortalForm)

**Component: `src/features/satisfacao/components/NPSPortalForm.tsx`**

```typescript
interface NPSPortalFormProps {
  token?: string; // token-based, no auth required
  reclamacaoId?: string; // if triggered from reclamacao closure
  initialFocus?: boolean;
}

interface NPSFormState {
  nota: number; // 0–10
  categoria: NPSCategoria; // derived (detrator|neutro|promotor)
  comentario: string;
  ipHash: string; // computed client-side for rate limiting
  isSubmitting: boolean;
  error?: string;
}
```

**UI Elements:**

- **Score Selector**: 0–10 scale with visual sentiment (0–3 😠 red, 4–6 😐 yellow, 7–8 😐 blue, 9–10 😊 green)
  - Touch-friendly: 44px × 44px buttons (minimum)
  - Hover: scale + shadow + smooth transition
  - Selected state: solid bg, white text
- **Comment Box**: Optional textarea, max 500 chars, char counter (light gray)
- **Sentiment Preview**: As user types, show preview: "Detractor feedback" / "Neutral feedback" / "Promoter feedback"
- **Submit Button**: Disabled until nota selected; loading state with spinner
- **reCAPTCHA v3 Badge**: Bottom right (required for rate limit)
- **Accessibility**:
  - `aria-label` on each score button ("Rate 0 — Very Dissatisfied")
  - Focus visible on all inputs
  - Keyboard navigation (0–9 keys trigger score)

**Logic Flow:**

1. Parse token (if provided) → extract lauroId|reclamacaoId, pacienteId (optional), labId
2. Validate token: check expiry (7 days), HMAC signature, rate limit (5 submits/IP/day)
3. On score change: compute categoria, update preview
4. On submit:
   - Validate: nota selected, comentario max 500 chars
   - Call `submitNPSResposta(nota, comentario, origem, reclamacaoId?, lauroId?)`
   - Show success toast: "Thank you! Your feedback helps us improve."
   - Redirect to `/portal-paciente/agradecimento` (thank you page) after 2s

**Gemini Integration (Phase 7.2+):**

```
On submit (server-side callable):
  IF comentario.length > 50:
    → gemini.generateContent({
        prompt: `Classify sentiment: "${comentario}" as positivo|neutro|negativo`,
        temperature: 0.1
      })
    → store in sentimento-gemini subcollection
    → update trending dashboard
```

**Dark-mode UI (Tailwind):**

```css
.nps-container: bg-[#141417], border-white/10
.score-button:
  default: bg-white/5, text-white/60, border-white/10
  hover: bg-white/10, shadow-lg
  selected: bg-violet-500, text-white, shadow-violet-500/50
.comment-box: bg-white/5, border-white/10, text-white, placeholder-white/40
.submit-button: bg-emerald-500, hover:bg-emerald-600, disabled:bg-white/10
```

---

### 4.2 Staff Suggestions Intake (SuggestionsIntake)

**Component: `src/features/sugestoes/components/SuggestionsIntake.tsx`**

```typescript
interface SuggestionsIntakeProps {
  labId: string;
  userRole: 'colaborador' | 'paciente' | 'externo'; // from auth
  anonymous?: boolean; // if true, autorId = null (internal only)
  mobile?: boolean; // PWA-optimized layout
}

interface SuggestaoFormState {
  titulo: string;
  descricao: string;
  categoria: CategoriasugestaoSugestao;
  autorNome?: string; // display name, not identity
  isSubmitting: boolean;
  error?: string;
}
```

**UI Elements:**

- **Title Input**: 10–100 chars, required, real-time validation
- **Category Select**: 5 options (produto|processo|ambiente|atendimento|outro) with icons
  - 🛠️ Processo, 🏭 Ambiente, 📞 Atendimento, 📦 Produto, 🔧 Outro
- **Description Textarea**: 50–2000 chars, max length indicator
- **Author Name (optional)**: If anonymous=false, collect display name (not email, not identity)
- **Submit Button**: Disabled until título+categoria selected
- **Upvote UI** (only for colaboradores viewing list):
  - Button: "👍 {count} upvotes"
  - Dedup: one upvote per user per suggestion
  - Visual: highlight if user already upvoted

**Logic Flow:**

1. On submit:
   - Validate: título 10–100, descricao 50–2000, categoria selected
   - Call `criarSugestao({ titulo, descricao, categoria, autorTipo, autorId?, autorNome? })`
   - Show success toast: "Suggestion submitted! We'll review it soon."
   - Reset form
2. On upvote (staff only):
   - Call `upvoteSugestao(sugestaoId)` (idempotent, no duplicate vote)
   - Update votaraisPor[] array server-side
3. List View:
   - Show all sugestoes grouped by status (Aberta: N | Analisada: N | Implementada: N | Rejeitada: N)
   - Sort: by votos DESC within each status group
   - If staff: show "Analisar" link to transition status
   - If public: read-only, show only Implementada + top Aberta (by votos)

**Mobile PWA Optimization:**

- Full-screen form on mobile (no sidebar)
- Category buttons as 2×2 grid (mobile) vs horizontal row (desktop)
- Textarea auto-expands as user types (max height before scroll)
- Upvote button: full-width on mobile, compact on desktop

**Dark-mode UI (Tailwind):**

```css
.form-container: bg-[#141417], border-white/10, rounded-lg
.input: bg-white/5, border-white/10, text-white, placeholder-white/40
.category-button:
  default: bg-white/5, text-white/60, border-white/10
  selected: bg-violet-500, text-white, shadow-violet-500/50
.upvote-button:
  default: bg-white/5, text-white/60
  voted: bg-emerald-500/20, text-emerald-400
```

---

### 4.3 Trending Dashboard (TrendingDashboard)

**Component: `src/features/satisfacao/components/TrendingDashboard.tsx`**

```typescript
interface TrendingDashboardProps {
  labId: string;
  dateRange?: { start: Date; end: Date };  // default: last 3 months
  showGeminiAnalysis?: boolean;            // Phase 7.2+
}

interface TrendingData {
  npsMonthly: Array<{ mes: string; score: number; respondentes: number; taxa% }>;
  rcaWordcloud: Array<{ word: string; count: number; frequencia% }>;
  suggestionStats: { aberto: number; implementado: number; rejeitado: number; %impl }
}
```

**Sections:**

1. **NPS Trending (Line Chart)**
   - X-axis: Month (e.g., May 2026, Apr 2026, Mar 2026)
   - Y-axis: NPS Score (-100 to +100)
   - Line: smooth, violet-500
   - Points: clickable to show count + % breakdown (detractors/neutros/promotores)
   - Hover tooltip: "May 2026: +45 (42 responses, 85% participation)"
   - Grid: light white/10 lines
   - Library: Recharts (lightweight, dark-theme ready)

2. **RCA Root-Cause Word Cloud (Phase 7.2+)**
   - Text size ∝ frequency of word in RCA "causa raiz" fields
   - Color gradient: red (alta severity) → orange → yellow → green (baixa)
   - Top 20 words only
   - Click word → filter complaints by that keyword
   - E.g., "Calibração" (8), "Reagente" (6), "Temperatura" (5), "Equipamento" (4)

3. **Suggestion Stats (Gauge + Breakdown)**
   - Gauge: "% Implementado" (0–100%)
   - Rings:
     - Aberta (blue): N suggestions
     - Analisada (gray): N suggestions
     - Implementada (emerald): N suggestions
     - Rejeitada (red): N suggestions
   - Title: "45 suggestions, 67% implemented"
   - Click ring → list view of that status

4. **Complaint Closure SLA (Phase 7.2+)**
   - Indicator: "Avg closure time: 8.2 days" (target ≤30d per CDC)
   - Overdue alert: "3 complaints overdue" if any >30d
   - Color: green (<10d), yellow (10–20d), red (>30d)

**Filtering:**

- Date range picker: "Last 3 months" (default) | "Last 6 months" | "Last year" | custom
- Lab filter (if multi-lab admin): select lab from dropdown
- Category filter (suggestions): show stats for product|process|environment|service

**Responsiveness:**

- Desktop: 4-column grid (NPS + RCA + Suggestions + SLA)
- Tablet: 2×2 grid
- Mobile: stacked, full-width

**Data Fetching:**

```typescript
// Server-side aggregates (read-only, computed daily)
subscribeToNPSTrending(labId, dateRange)
  → fires every hour during day, pre-computed
  → returns: { months[], scores[], respondentes[] }

subscribeToRCAWordcloud(labId, dateRange)
  → daily Pub/Sub trigger on suggestion status change
  → extracts top 20 words from RCA causa-raiz fields

subscribeToSuggestionStats(labId, dateRange)
  → real-time count via onSnapshot + filters
```

**Dark-mode UI:**

```css
.dashboard-container: bg-[#141417], border-white/10
.chart: axes-white/40, grid-white/10, line-violet-500, point-fill-violet-500
.gauge: track-white/10, value-emerald-500
.stat-card: bg-white/5, border-white/10, text-white, label-white/60
.alert: bg-red-500/10, border-red-500/20, text-red-400
```

---

### 4.4 Complaint Closure Integration Hook

**Hook: `src/features/reclamacoes/hooks/useReclamacaoClosureNotification.ts`**

```typescript
export function useReclamacaoClosureNotification(
  labId: string,
  reclamacaoId: string,
  onStatusChange?: (status: StatusReclamacao) => void,
): { status: StatusReclamacao; isNPSTriggered: boolean } {
  const [status, setStatus] = useState<StatusReclamacao>('Nova');
  const [isNPSTriggered, setIsNPSTriggered] = useState(false);

  useEffect(() => {
    const unsub = subscribeToReclamacao(labId, reclamacaoId, (rec) => {
      setStatus(rec.status);

      // Trigger NPS when Resolvida
      if (rec.status === 'Resolvida' && !isNPSTriggered) {
        // Call function: dispatchNPSPostLaudo
        // This sends email to pacienteId with NPS token
        setIsNPSTriggered(true);
      }

      onStatusChange?.(rec.status);
    });

    return () => unsub();
  }, [labId, reclamacaoId]);

  return { status, isNPSTriggered };
}
```

**Integration in Complaint Portal:**

- Use hook to listen to Reclamacao status
- Display status badge: "Nova" (gray), "Analisando" (blue), "RCA em progresso" (purple), "Resolvida" (emerald)
- Show notification: "Your complaint has been resolved. Please rate your experience." (when status → Resolvida)
- Link to NPS form auto-populates with token

---

### 4.5 Cloud Functions: Email Campaigns

**Function: `functions/src/modules/satisfacao/email-campaigns.ts`**

#### Callable: `dispatchNPSPostLaudo(lauroId, pacienteId)`

```typescript
export const dispatchNPSPostLaudo = onCall<
  { lauroId: string; pacienteId: string },
  Promise<{ success: boolean; tokenId: string }>
>(async (request) => {
  const { labId, uid } = request.auth;
  const { lauroId, pacienteId } = request.data;

  // 1. Verify auth: user is RT or Qualidade
  const member = await getDoc(doc(db, 'labs', labId, 'members', uid));
  if (!member.exists() || !['RT', 'Qualidade'].includes(member.data().role)) {
    throw new HttpsError('permission-denied', 'Only RT/Qualidade can dispatch NPS');
  }

  // 2. Create NPS token (JWT, 7d expiry)
  const token = jwt.sign(
    {
      lauroId,
      pacienteId,
      labId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
    process.env.NPS_TOKEN_SECRET,
  );

  // 3. Fetch paciente email from /users/{pacienteId}
  const paciente = await getDoc(doc(db, 'users', pacienteId));
  const emailDestinatario = paciente.data()?.email;
  if (!emailDestinatario) {
    throw new HttpsError('not-found', 'Paciente email not found');
  }

  // 4. Send email via Resend
  const npsLink = `https://hmatologia2.web.app/portal-paciente/nps/${token}`;
  await resend.emails.send({
    from: 'feedback@hmatologia2.web.app',
    to: emailDestinatario,
    subject: 'Sua opinião é importante — Avalie sua experiência',
    html: `
      <h1>Obrigado pela confiança</h1>
      <p>Sua análise foi processada. Nos ajude a melhorar respondendo esta pesquisa rápida (2 min):</p>
      <a href="${npsLink}" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
        Avaliar Experiência
      </a>
      <p style="font-size: 12px; color: #999; margin-top: 20px;">Link expira em 7 dias.</p>
    `,
  });

  // 5. Create audit log
  await setDoc(doc(db, 'labs', labId, 'feedback-audit', `nps-dispatch-${Date.now()}`), {
    tipo: 'nps-dispatch-post-laudo',
    lauroId,
    pacienteId,
    tokenId: token,
    emailDestinatario: hashEmail(emailDestinatario),
    sentAt: Timestamp.now(),
    operatorId: uid,
  });

  return { success: true, tokenId: token };
});
```

#### Callable: `submitNPSResposta(nota, comentario, origem, reclamacaoId?)`

```typescript
export const submitNPSResposta = onCall<
  CreateNPSRespostaInput,
  Promise<{ success: boolean; respostaId: string }>
>(async (request) => {
  const { labId } = request.auth;
  const { nota, comentario, origem, reclamacaoId, token } = request.data;

  // 1. Validate nota
  if (nota < 0 || nota > 10) {
    throw new HttpsError('invalid-argument', 'Nota must be 0–10');
  }

  // 2. If token provided, validate & extract pacienteId
  let pacienteId: string | undefined;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.NPS_TOKEN_SECRET) as any;
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new HttpsError('invalid-argument', 'Token expired');
      }
      pacienteId = decoded.pacienteId;
    } catch {
      throw new HttpsError('invalid-argument', 'Invalid or expired token');
    }
  } else if (request.auth.uid) {
    pacienteId = request.auth.uid; // if auth'd patient
  }

  // 3. Compute categoria
  const categoria: NPSCategoria = nota <= 6 ? 'detrator' : nota <= 8 ? 'neutro' : 'promotor';

  // 4. Compute PII fields
  const ipHash = hashEmail(`${pacienteId}:${request.rawRequest.headers['x-forwarded-for']}`);
  const cpfHash = pacienteId ? hashEmail(pacienteId) : undefined;

  // 5. Create LogicalSignature (server-side)
  const timestamp = Timestamp.now();
  const signatureData = {
    nota: String(nota),
    comentario: comentario || '',
    categoria,
    respondidoEm: timestamp.toDate().toISOString(),
  };
  const hash = sha256(JSON.stringify(signatureData));
  const signature: LogicalSignature = {
    hash,
    operatorId: request.auth.uid || 'anonymous',
    ts: timestamp,
  };

  // 6. Write NPSResposta to Firestore
  const respostaRef = doc(collection(db, 'labs', labId, 'satisfacao-respostas'));
  await setDoc(respostaRef, {
    id: respostaRef.id,
    labId,
    pacienteId: pacienteId || null,
    cpfHash,
    nota,
    categoria,
    comentario,
    origem,
    reclamacaoId: reclamacaoId || null,
    respondidoEm: timestamp,
    ipHash,
    anonimizadoEm: null,
    piiMask: comentario?.includes(/(cpf|telefone|rg|pii)/gi) || false,
    signature,
    criadoEm: timestamp,
    deletadoEm: null,
  } as NPSResposta);

  // 7. If reclamacaoId, trigger transition to Comunicada → Fechada
  if (reclamacaoId) {
    const reclamacaoRef = doc(db, 'labs', labId, 'reclamacoes', reclamacaoId);
    await updateDoc(reclamacaoRef, {
      status: 'Fechada',
      npsRespostaId: respostaRef.id,
      npsResponseReceivedAt: timestamp,
    });
  }

  // 8. Optional: if comentario long enough, trigger Gemini sentiment
  if ((comentario?.length || 0) > 50) {
    // Queue async task (don't await)
    // This is non-blocking; Gemini result stored in sentimento-gemini sub-collection
    queueGeminiSentimentAnalysis(labId, respostaRef.id, comentario);
  }

  return { success: true, respostaId: respostaRef.id };
});
```

#### Pub/Sub Cron: `dispatchNPSQuarterly` (12:00 BRT, 1st of Q month)

```typescript
export const dispatchNPSQuarterly = onSchedule('1 0 1 1,4,7,10 *', async (context) => {
  const db = getFirestore();
  const allLabs = await getDocs(collection(db, 'labs'));

  for (const labDoc of allLabs.docs) {
    const labId = labDoc.id;
    const trimestre = getTrimestre(new Date()); // e.g., '2026-Q2'

    // 1. Fetch config for lab
    const config = await getDoc(doc(db, 'labs', labId, 'satisfacao-config', 'campanhas'));
    if (!config.exists() || !config.data().ativarCampanhaTrimestral) continue;

    // 2. Create CampanhaSatisfacao entry
    const now = Timestamp.now();
    const inicio = now;
    const fim = new Timestamp(now.seconds + 30 * 24 * 60 * 60, 0); // 30 days

    const campanhaRef = doc(collection(db, 'labs', labId, 'satisfacao-campanhas'));
    await setDoc(campanhaRef, {
      id: campanhaRef.id,
      labId,
      trimestre,
      dataInicio: inicio,
      dataFim: fim,
      status: 'ativa',
      quantidadeConvidados: 0, // updated as emails sent
      quantidadeRespostas: 0,
      npsResultado: 0,
      criadoEm: now,
    } as CampanhaSatisfacao);

    // 3. Query all pacientes + colaboradores
    const pacientes = await getDocs(
      query(
        collection(db, 'users'),
        where('role', '==', 'paciente'),
        where('labMemberships', 'array-contains', labId),
      ),
    );

    // 4. Send emails with token-based links
    for (const paciente of pacientes.docs) {
      const emailDestinatario = paciente.data().email;
      const token = jwt.sign(
        {
          labId,
          pacienteId: paciente.id,
          trimestre,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
        process.env.NPS_TOKEN_SECRET,
      );

      const npsLink = `https://hmatologia2.web.app/portal-paciente/nps/${token}`;
      await resend.emails.send({
        from: 'feedback@hmatologia2.web.app',
        to: emailDestinatario,
        subject: `[${trimestre}] Sua opinião importa — Pesquisa de Satisfação`,
        html: `
          <h1>Pesquisa Trimestral de Satisfação</h1>
          <p>Sua participação nos ajuda a entregar melhor qualidade.</p>
          <a href="${npsLink}">Responder Pesquisa</a>
        `,
      });

      // Track invitation count
      await updateDoc(campanhaRef, {
        quantidadeConvidados: increment(1),
      });
    }
  }
});
```

---

### 4.6 Scheduled Task: Anonimização (Daily Cron)

**Function: `functions/src/scheduled-tasks/anonimizarRespostas.ts`**

```typescript
export const anonimizarRespostas = onSchedule('0 3 * * *', async (context) => {
  // 03:00 BRT (6:00 UTC) daily
  const db = getFirestore();
  const allLabs = await getDocs(collection(db, 'labs'));

  for (const labDoc of allLabs.docs) {
    const labId = labDoc.id;

    // Query NPSRespostas created >90 days ago and not yet anonymized
    const ninetyDaysAgo = Timestamp.fromMillis(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const batch = writeBatch(db);
    const respostas = await getDocs(
      query(
        collection(db, 'labs', labId, 'satisfacao-respostas'),
        where('criadoEm', '<', ninetyDaysAgo),
        where('anonimizadoEm', '==', null),
        limit(500), // batch size
      ),
    );

    for (const resposta of respostas.docs) {
      const data = resposta.data() as NPSResposta;

      // Zero out PII, but retain cpfHash for analytics
      batch.update(resposta.ref, {
        pacienteId: null,
        anonimizadoEm: Timestamp.now(),
        // If comentario has PII (CPF, phone, name), filter it
        comentario: filterPII(data.comentario || ''),
        piiMask: true,
      });
    }

    // Commit batch
    if (respostas.docs.length > 0) {
      await batch.commit();

      // Log operation
      await setDoc(doc(db, 'labs', labId, 'anonimizacao-audit', `anon-${Date.now()}`), {
        tipo: 'nps-anonymization',
        quantidadeAnonimizada: respostas.docs.length,
        dataExecucao: Timestamp.now(),
        limiteIdade: ninetyDaysAgo,
      });
    }
  }
});

function filterPII(texto: string): string {
  // Remove CPF pattern: 999.999.999-99
  texto = texto.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[REDACTED]');
  // Remove phone: (XX) XXXXX-XXXX
  texto = texto.replace(/\(\d{2}\)\s?\d{4,5}-\d{4}/g, '[REDACTED]');
  // Remove RG: common pattern
  texto = texto.replace(/\d{1,2}\.\d{3}\.\d{3}-[\dX]/g, '[REDACTED]');
  return texto;
}
```

---

## 5. Firestore Rules & Indexes

### 5.1 Security Rules (firestore.rules)

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... (existing rules)

    // ─── NPS Responses ────────────────────────────────────────────────────
    match /labs/{labId}/satisfacao-respostas/{respostaId} {
      // Read: available to lab members + public (token-based)
      allow read: if
        (request.auth != null && isActiveMemberOfLab(labId)) ||
        (request.auth == null && validateNPSToken(request));

      // Write: via callable only (server-side signature generation)
      allow write: if
        request.auth != null &&
        isActiveMemberOfLab(labId) &&
        hasRole(labId, 'RT', 'Qualidade');

      // Create: via public callable submitNPSResposta
      allow create: if
        validateNPSPayload(request.resource.data);

      // Delete: soft-delete only
      allow delete: if false;

      match /sentimento-gemini/{analiseId} {
        allow read: if isActiveMemberOfLab(labId);
        allow write: if false;  // server-side only
      }

      function validateNPSPayload(d) {
        return d.nota >= 0 && d.nota <= 10 &&
               d.categoria in ['detrator', 'neutro', 'promotor'] &&
               d.signature.hash.size() == 64 &&
               d.signature.operatorId == request.auth.uid &&
               d.signature.ts is timestamp;
      }

      function validateNPSToken(request) {
        // Token validation happens in callable, not in rules
        // Rules accept public reads if PII fields are null
        return request.resource.data.pacienteId == null;
      }
    }

    match /labs/{labId}/satisfacao-campanhas/{campanhaId} {
      allow read: if isActiveMemberOfLab(labId);
      allow create, update: if isActiveMemberOfLab(labId) && hasRole(labId, 'RT', 'Qualidade');
      allow delete: if false;
    }

    // ─── Suggestions ──────────────────────────────────────────────────────
    match /labs/{labId}/sugestoes/{sugestaoId} {
      // Read: available to lab members + public (view only)
      allow read: if request.auth != null && isActiveMemberOfLab(labId);

      // Create: any lab member or public via callable
      allow create: if isActiveMemberOfLab(labId) ||
                       (request.auth == null && validatePublicSuggestao(request.resource.data));

      // Update: staff only, state transitions
      allow update: if
        isActiveMemberOfLab(labId) &&
        (hasRole(labId, 'RT', 'Qualidade') || request.auth.uid == resource.data.autorId) &&
        validSuggestaoTransition(resource.data, request.resource.data);

      // Delete: soft-delete only
      allow delete: if false;

      function validatePublicSuggestao(d) {
        return d.titulo != '' &&
               d.descricao.size() >= 50 &&
               d.categoria in ['produto', 'processo', 'ambiente', 'atendimento', 'outro'] &&
               d.signature.hash.size() == 64 &&
               d.signature.ts is timestamp;
      }

      function validSuggestaoTransition(before, after) {
        let validTransitions = {
          'aberta': ['analisada'],
          'analisada': ['implementada', 'rejeitada'],
          'implementada': [],
          'rejeitada': [],
        };
        return after.status in validTransitions[before.status];
      }
    }

    // ─── Analytics (read-only aggregates) ──────────────────────────────────
    match /labs/{labId}/analytics-feedback/{document=**} {
      allow read: if isActiveMemberOfLab(labId);
      allow write: if false;  // Cloud Functions only
    }

    // Helper functions
    function isActiveMemberOfLab(labId) {
      return exists(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid));
    }

    function hasRole(labId, ...roles) {
      let member = get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid));
      return member.data.role in roles;
    }
  }
}
```

### 5.2 Firestore Indexes (firestore.indexes.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "satisfacao-respostas",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "respondidoEm", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "satisfacao-respostas",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "origem", "order": "ASCENDING" },
        { "fieldPath": "respondidoEm", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "satisfacao-respostas",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "criadoEm", "order": "ASCENDING" },
        { "fieldPath": "anonimizadoEm", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "sugestoes",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "votos", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sugestoes",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "categoria", "order": "ASCENDING" },
        { "fieldPath": "criadoEm", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 6. E2E Test Specifications

All tests use **Detox** (Phase 3+) and run on iOS + Android.

### Test 1: Patient NPS Submission (Public Portal, No Auth)

**Path:** `e2e/satisfacao/npsPortalPublic.e2e.ts`

```gherkin
Scenario: Patient submits NPS via token-based link
  Given patient receives email with NPS link (token-based)
  When patient opens link in mobile browser
  Then NPS form loads with sentiment icons (0–10 scale)

  And patient taps score 9 (promotor, green)
  And patient types comment "Excelente atendimento"
  Then comment preview shows "Promoter feedback"

  When patient taps "Enviar Feedback"
  And reCAPTCHA v3 validates request
  Then success toast appears "Obrigado!"
  And page redirects to thank-you screen
  And NPSResposta doc appears in Firestore
```

### Test 2: Patient NPS Submission (Authenticated, Post-Laudo)

**Path:** `e2e/satisfacao/npsPortalAuth.e2e.ts`

```gherkin
Scenario: Authenticated patient submits NPS after laudo marked critical
  Given patient is logged in
  And patient has received notification "Feedback appreciated"
  When patient taps NPS link in notification
  Then NPS form pre-populates with lauroId + pacienteId

  And patient rates 7 (neutro, yellow)
  And patient submits form
  Then reclamacao status updates to Fechada
  And NPSResposta linked to reclamacaoId
```

### Test 3: Staff Suggestion Submission

**Path:** `e2e/sugestoes/staffSuggestionIntake.e2e.ts`

```gherkin
Scenario: Technician submits suggestion via mobile PWA
  Given technician is logged in + on mobile
  And app is installed as PWA (no address bar)
  When technician navigates to /sugestoes/nova
  Then form layout is full-screen, optimized for touch

  And technician enters:
    titulo: "Upgrade reagente X para versão 2.0"
    descricao: "A nova versão melhora a sensibilidade em 15%"
    categoria: "produto" (auto-focus on touch)

  When technician submits form
  Then success toast "Sugestão enviada!"
  And form resets
  And suggestion appears in /sugestoes list (status: aberta)
```

### Test 4: Suggestion Upvoting (Dedup)

**Path:** `e2e/sugestoes/upvoteSuggestion.e2e.ts`

```gherkin
Scenario: Staff member upvotes suggestion, preventing duplicate votes
  Given suggestion "Upgrade reagente X" exists (status: aberta)
  And technician-A is logged in
  When technician-A taps upvote button "👍 0"
  Then button shows "👍 1" + highlights (emerald-500)
  And votaraisPor contains technician-A's userId

  When technician-A taps again (trying to double-vote)
  Then upvote count stays "👍 1"
  And no duplicate entry in votaraisPor
```

### Test 5: Trending Dashboard NPS Chart

**Path:** `e2e/satisfacao/trendingDashboard.e2e.ts`

```gherkin
Scenario: Admin views NPS trending chart
  Given admin is on dashboard /satisfacao/trending
  When page loads
  Then line chart shows 3 months of NPS scores

  When admin hovers over May 2026 point
  Then tooltip appears "May 2026: +45 (42 responses, 85% participation)"

  When admin clicks "Last 6 months" filter
  Then chart updates to show 6-month trend
  And suggestion stats update accordingly
```

### Test 6: RCA Word Cloud (Phase 7.2+)

**Path:** `e2e/satisfacao/rcaWordcloud.e2e.ts`

```gherkin
Scenario: Manager views complaint root-cause word cloud
  Given manager is on dashboard /satisfacao/trending
  When page loads
  Then word cloud displays top 20 root-cause words

  And word size correlates with frequency:
    "Calibração" (8 occurrences) — largest
    "Reagente" (6) — medium
    "Temperatura" (3) — small

  When manager clicks word "Calibração"
  Then list view filters to show 8 complaints with that root cause
```

### Test 7: Anonimização Cron (Server-side, Audit)

**Path:** `functions/__tests__/scheduled-tasks/anonimizarRespostas.test.ts`

```typescript
describe('anonimizarRespostas Pub/Sub cron', () => {
  it('should anonymize NPSRespostas >90d old', async () => {
    // Create NPSResposta dated 95 days ago
    const old = await createNPSResposta({
      nota: 8,
      comentario: 'CPF: 123.456.789-00',
      criadoEm: Timestamp.fromDate(new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)),
    });

    // Run cron
    await anonimizarRespostas(mockContext);

    // Verify: pacienteId nulled, PII filtered, anonimizadoEm set
    const updated = await getNPSResposta(labId, old.id);
    expect(updated.pacienteId).toBeNull();
    expect(updated.anonimizadoEm).toBeDefined();
    expect(updated.comentario).toBe('[REDACTED]');
  });

  it('should NOT anonymize respostas <90d old', async () => {
    const recent = await createNPSResposta({
      criadoEm: Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    });

    await anonimizarRespostas(mockContext);

    const noChange = await getNPSResposta(labId, recent.id);
    expect(noChange.pacienteId).toBeDefined();
    expect(noChange.anonimizadoEm).toBeNull();
  });
});
```

### Test 8: Complaint Closure → NPS Trigger

**Path:** `e2e/reclamacoes/closureNPSTrigger.e2e.ts`

```gherkin
Scenario: Complaint marked Resolvida triggers NPS email
  Given complaint exists with status "Analisando"
  And paciente email is "user@example.com"

  When RT clicks "Marcar Resolvida" in complaint detail
  Then HTTP callable dispatchNPSPostLaudo is invoked
  And email is sent to user@example.com with NPS link

  And NPSResposta.origem = 'pos-resolucao'
  And NPSResposta.reclamacaoId = complaint.id
  And firestore audit log entry created
```

---

## 7. Implementation Tasks (Parallel Execution)

### Wave 1: Core Infrastructure (Week 1)

- [ ] **Task 1.1**: NPSPortalForm component + reCAPTCHA v3 integration
- [ ] **Task 1.2**: SuggestionsIntake component (web + mobile PWA optimization)
- [ ] **Task 1.3**: TrendingDashboard component (line chart + suggestion stats)
- [ ] **Task 1.4**: Firestore rules + indexes deployment

### Wave 2: Cloud Functions (Week 1)

- [ ] **Task 2.1**: `dispatchNPSPostLaudo` callable (token generation + email)
- [ ] **Task 2.2**: `submitNPSResposta` callable (server-side signature + Firestore write)
- [ ] **Task 2.3**: `dispatchNPSQuarterly` Pub/Sub cron + email batch
- [ ] **Task 2.4**: `anonimizarRespostas` scheduled cron

### Wave 3: Integrations (Week 1.5)

- [ ] **Task 3.1**: useReclamacaoClosureNotification hook
- [ ] **Task 3.2**: Email campaign trigger on critical laudo
- [ ] **Task 3.3**: Portal page `/portal-paciente/nps/{token}` + redirect logic
- [ ] **Task 3.4**: Suggestion state machine transitions (RT approval)

### Wave 4: Testing + Polish (Week 1.5)

- [ ] **Task 4.1**: E2E tests 1–8 (Detox)
- [ ] **Task 4.2**: Firestore rule testing (emulator)
- [ ] **Task 4.3**: Dark-mode UI refinement + accessibility (WCAG AA)
- [ ] **Task 4.4**: Performance audit (Lighthouse)

---

## 8. Success Criteria

| Criterion                 | Acceptance                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Patient NPS**           | Form loads in <2s; token validates; score 0–10 accepted; comment optional; reCAPTCHA v3 passes       |
| **Suggestion Intake**     | Form accepts 50–2000 chars; category select works; upvote dedup confirmed                            |
| **Trending Dashboard**    | Line chart renders 3-month NPS; word cloud displays top 20 words; suggestion % calculated correctly  |
| **Complaint Integration** | Complaint Resolvida → NPS email sent within 5 mins; token expires 7d; Fechada status updates         |
| **Anonimização**          | Daily cron runs 03:00 BRT; pacienteId nulled for >90d old; PII filtered; audit logged                |
| **Email Delivery**        | 99%+ delivery rate (Resend); bounce handling; unsubscribe honored                                    |
| **Security**              | All writes signed (LogicalSignature); token HMAC verified; rate limit 5 NPS/IP/day; soft-delete only |
| **Compliance**            | DICQ 4.14.3/4.4 documented; RDC 978 5-year retention enforced; LGPD audit trail complete             |
| **E2E Coverage**          | All 8 tests green on iOS + Android emulator; no flakes                                               |
| **Accessibility**         | WCAG AA pass; 4.5:1 contrast ratio; keyboard nav; screen reader tested                               |

---

## 9. Known Risks & Mitigations

| Risk                                  | Mitigation                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Email delivery spam filter**        | Use Resend; warm-up domain; monitor bounce rates; add SPF/DKIM records                   |
| **Token expiry confusion**            | Clear error message if token expired; resend invite button; 7-day expiry is generous     |
| **Gemini hallucination on sentiment** | Phase 7.2+ optional; manual RT review fallback; confidence threshold >0.7 before storage |
| **PII in comentario field**           | Regex filter on submit; Gemini redaction (Phase 7.2); audit trail for compliance         |
| **NPS recurring saturation**          | Limit to quarterly + post-resolucao; batch emails 1000/min; Pub/Sub queue                |
| **Word cloud data sparsity**          | Minimum 10 RCAs before rendering; fallback to text list if sparse                        |

---

## 10. Rollout Plan

### Phase 7.1 (Week 1–1.2): MVP Deployment

1. Deploy Firestore rules + indexes (Phase 0 approval)
2. Deploy Cloud Functions: callables + scheduled tasks
3. Launch NPSPortalForm (public + authenticated)
4. Launch SuggestionsIntake (staff + public)
5. Internal testing: E2E tests 1–4
6. Monitor: email delivery, error logs, token validation

### Phase 7.2 (Week 1.3–1.5): Polish + Analytics

1. Deploy Gemini sentiment classification (optional)
2. Launch TrendingDashboard with monthly NPS + RCA word cloud
3. Refine dark-mode UI; accessibility audit
4. Complete E2E tests 5–8
5. Performance optimization: code-split /portal-paciente routes

### Phase 7.3+ (v1.4 Wave 3): Enhancements

- Ishikawa diagram for RCA (visual upgrade)
- WhatsApp notifications (deferred, Meta approval required)
- Ouvidoria/PROCON integration (deferred)
- NPS incentive raffle (deferred, legal barriers in Brazil)

---

## 11. References

- **Reclamacoes Module CLAUDE.md**: `src/features/reclamacoes/CLAUDE.md` (foundation types, state machines, callables)
- **Satisfacao Types**: `src/features/reclamacoes/types/satisfacao.ts` (NPSResposta, CampanhaSatisfacao)
- **Sugestao Types**: `src/features/reclamacoes/types/sugestao.ts` (Sugestao, state machine)
- **Design System**: `DESIGN_SYSTEM.md` (tokens, dark-first, typography)
- **ADR-0001**: `docs/adr/0001-audit-chain.md` (LogicalSignature pattern)
- **ADR-0017**: `docs/adr/0017-anonimizacao.md` (PII anonymization >90d)
- **DICQ 4.14.3, 4.14.4**: Quality standards (satisfaction + suggestions)
- **RDC 978 Art. 36**: Complaint handling + 30-day SLA
- **LGPD Lei 13.709/18**: PII protection + anonymization

---

## Appendix A: Component API Checklist

### NPSPortalForm

```typescript
export interface NPSPortalFormProps {
  token?: string;
  reclamacaoId?: string;
  onSuccess?: (respostaId: string) => void;
  onError?: (error: Error) => void;
}

export const NPSPortalForm: React.FC<NPSPortalFormProps>;
```

### SuggestionsIntake

```typescript
export interface SuggestionsIntakeProps {
  labId: string;
  userRole: 'colaborador' | 'paciente' | 'externo';
  anonymous?: boolean;
  mobile?: boolean;
}

export const SuggestionsIntake: React.FC<SuggestionsIntakeProps>;
```

### TrendingDashboard

```typescript
export interface TrendingDashboardProps {
  labId: string;
  dateRange?: { start: Date; end: Date };
  showGeminiAnalysis?: boolean;
}

export const TrendingDashboard: React.FC<TrendingDashboardProps>;
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Phase:** 07-feedback-portal  
**Status:** Ready for execution planning
