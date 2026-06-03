---
phase: v1.4-final-closure
macro_phase: MP-6
label: Patient Portal Phase 2 — Complaint intake (RCA Five Whys) + NPS + suggestion voting
type: execute
model: haiku
escalation_model: sonnet
depends_on: ['MP-5a']
# MP-5b (CEQ deepening) e MP-5c (analytics consent) deferidos — ver FINAL-REPORT.md
depends_on_deferred: ['MP-5b', 'MP-5c']
autonomous: true
human_gates: 0
total_subagents: 8
total_waves: 2
estimated_runtime: 2h
---

# MP-6 — Patient Portal Phase 2 (8 SAs across 2 waves)

**Goal:** Extend the live `portal-paciente` module with patient-facing complaint intake (with admin-side RCA Five Whys workflow), NPS survey, and 1-user-1-vote suggestion voting.

**Compliance hooks:**

- RDC 978/2025 Art. 86 (gestão de não-conformidades + ações corretivas).
- DICQ 4.14.3 (reclamações e sugestões), 4.14.6 (gestão de riscos via RCA), 4.14.4 (pesquisa de satisfação).
- LGPD Arts. 9, 11, 13, 17 (consent, anonymization, transparency, data subject rights).

**Wave dependency graph:**

```
W1 (complaint intake + RCA)   4 SAs ‖
  └─> W2 (NPS + voting)        4 SAs ‖
```

**Existing canonical files to read:**

- `src/features/portal-paciente/` — current live module (consent gate + result viewer pattern).
- `src/features/sgq/` — Documentos da Qualidade module (RN-06 + audit chainHash patterns).
- `functions/src/modules/portal-paciente/` — patient-facing callables.
- `.claude/rules/firestore-security.md` — multi-tenant rule patterns.
- `.claude/rules/notivisa-firestore-rules.md` — example callable-only collection rules.
- `./CLAUDE.md`, `src/features/bioquimica/CLAUDE.md` (module CLAUDE.md pattern).

---

## Wave 11p-W1 — Complaint Intake + RCA Five Whys (4 SAs ‖)

deps: nothing. All 4 SAs dispatch simultaneously.

---

### SA-74 — `src/features/reclamacoes/types/index.ts`

Type system for the reclamações (complaints) domain. Zero logic — types only.

**Exports obrigatórios:**

```typescript
export type ReclamacaoCanal = 'patient-portal' | 'phone' | 'email' | 'in-person' | 'social-media';
export type ReclamacaoStatus =
  | 'new' // submitted by patient, awaiting triage
  | 'triaged' // admin reviewed, classified
  | 'rca-in-progress' // Five Whys workflow open
  | 'rca-completed' // root cause identified
  | 'capa-linked' // a CAPA opened from this complaint
  | 'closed' // resolved
  | 'rejected'; // not actionable (out of scope, duplicate, etc.)

export type ReclamacaoSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: number;
}

export interface ReclamacaoAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';
  storagePath: string;
  hash: string; // SHA-256 hex64
  uploadedAt: number;
}

export interface RCAFiveWhysAnswer {
  level: 1 | 2 | 3 | 4 | 5;
  question: string; // "Por que X aconteceu?"
  answer: string;
  answeredBy: string;
  answeredAt: number;
}

export interface RCAFiveWhys {
  workflowId: string;
  startedAt: number;
  startedBy: string;
  answers: RCAFiveWhysAnswer[]; // length 0..5
  rootCause?: string; // populated when answers.length === 5
  completedAt?: number;
  completedBy?: string;
  signature?: LogicalSignature;
}

export interface Reclamacao {
  id: string;
  labId: string;
  canal: ReclamacaoCanal;
  status: ReclamacaoStatus;
  severity: ReclamacaoSeverity;
  patientName?: string; // optional (anonymous complaints permitted)
  patientContact?: string; // email or phone (LGPD: encrypted at rest server-side)
  consentToken?: string; // LGPD consent if patient identified themselves
  description: string; // ≥ 30 chars
  attachments: ReclamacaoAttachment[];
  signaturePatient?: LogicalSignature; // when submitted via portal
  rca?: RCAFiveWhys;
  capaId?: string; // link to capa-tracking doc when escalated
  createdAt: number;
  triagedAt?: number;
  triagedBy?: string;
  closedAt?: number;
  closedBy?: string;
  closingReason?: string;
  deletedAt?: number;
}

export interface CreateReclamacaoInput {
  labId: string;
  canal: ReclamacaoCanal;
  patientName?: string;
  patientContact?: string;
  consentToken?: string;
  description: string;
  attachmentIds?: string[];
}

export const RCA_QUESTION_TEMPLATES: readonly [string, string, string, string, string];
// 5 default question prompts: ["Por que isso aconteceu?", "Por que essa causa imediata existiu?", ...]
```

**Invariantes:**

- 0 lógica.
- Sem imports externos.
- `RCA_QUESTION_TEMPLATES` é tuple `as const` com exatamente 5 elementos em PT-BR.

**Files to read:** `src/features/sgq/types/index.ts` ou similar para padrão de types regulatórios; `src/features/portal-paciente/types/` se existir.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-6-W1-SA-74): reclamacoes domain types`

---

### SA-75 — `src/features/reclamacoes/services/reclamacoesService.ts` + `functions/src/modules/reclamacoes/intakeReclamacao.ts`

Two-file SA: thin client read-only service + callable v2 for write (regulatory write per RDC 978 + project invariants).

**File 1 — `src/features/reclamacoes/services/reclamacoesService.ts` (read-only client):**

```typescript
import type { Reclamacao } from '../types';

export interface ReclamacaoFilters {
  status?: Reclamacao['status'][];
  severity?: Reclamacao['severity'][];
  fromMs?: number;
  toMs?: number;
}

export function subscribeReclamacoes(
  labId: string,
  filters: ReclamacaoFilters,
  onChange: (rows: Reclamacao[]) => void,
): () => void;

export function getReclamacao(labId: string, id: string): Promise<Reclamacao | undefined>;
```

**File 2 — `functions/src/modules/reclamacoes/intakeReclamacao.ts` (callable v2):**

```typescript
import { onCall } from 'firebase-functions/v2/https';
export const intakeReclamacao: ReturnType<typeof onCall>;
export const triageReclamacao: ReturnType<typeof onCall>;
export const startRCAFiveWhys: ReturnType<typeof onCall>;
export const submitRCAAnswer: ReturnType<typeof onCall>;
export const completeRCAFiveWhys: ReturnType<typeof onCall>;
export const closeReclamacao: ReturnType<typeof onCall>;
```

**Callable contracts:**

| Callable              | Input                                                                                | Output             | Auth                                                                                       | Key invariants                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `intakeReclamacao`    | `CreateReclamacaoInput + signaturePatient?`                                          | `{ reclamacaoId }` | optional (patient may be anonymous; if `patientContact` provided, `consentToken` required) | `description.length >= 30 && <= 5000`. Status = `'new'`. Severity defaulta `'medium'`. ChainHash audit append.                         |
| `triageReclamacao`    | `{ labId, reclamacaoId, severity, status: 'triaged' \| 'rejected', closingReason? }` | `{ ok: true }`     | required (RT/admin/qualidade)                                                              | Source status must be `'new'`. Append audit.                                                                                           |
| `startRCAFiveWhys`    | `{ labId, reclamacaoId }`                                                            | `{ workflowId }`   | required (RT/admin/qualidade)                                                              | Source status must be `'triaged'` with severity ≥ `'medium'`. Set status `'rca-in-progress'`. Initialize empty answers array.          |
| `submitRCAAnswer`     | `{ labId, reclamacaoId, level: 1\|2\|3\|4\|5, question, answer }`                    | `{ ok: true }`     | required                                                                                   | Append answer atomically. Reject if level out of order. `answer.length >= 10`.                                                         |
| `completeRCAFiveWhys` | `{ labId, reclamacaoId, rootCause, signature }`                                      | `{ ok: true }`     | required                                                                                   | `answers.length === 5`. `rootCause.length >= 30`. `signature.operatorId === request.auth.uid`. Set status `'rca-completed'`.           |
| `closeReclamacao`     | `{ labId, reclamacaoId, closingReason, capaId? }`                                    | `{ ok: true }`     | required                                                                                   | If `capaId` provided, set status `'capa-linked'` AND `'closed'` (with reason). Source status must be `'rca-completed'` or `'triaged'`. |

**Global callable invariants:**

- `onCall({ region: 'southamerica-east1', cors: true, memory: '256MiB', timeoutSeconds: 30 })`.
- Auth callable rules per row above.
- All writes via `runTransaction` for state transitions; appendsLogs (`labs/{labId}/reclamacoes/audit/{logId}`) atomic with state change.
- Logical Signature validated when present: `hash.match(/^[a-f0-9]{64}$/) && operatorId === request.auth.uid && typeof ts === 'number'`.
- All Cloud Logs entries: `console.log(JSON.stringify({ event: 'reclamacao_*', labId, reclamacaoId, ... }))`. NEVER log `description` or `patientContact` (LGPD).
- RN-06 soft-delete only — `deleteReclamacao` would set `deletedAt`; not implemented in this SA (admin-only, deferred).

**Files to read:** `functions/src/modules/portal-paciente/` (existing patient callable patterns), `src/features/sgq/services/` (thin-service read-only pattern), `.claude/rules/firestore-security.md`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$' && cd functions && npm run build 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-6-W1-SA-75): reclamacoes service + 6 callables (intake/triage/RCA/close)`

---

### SA-76 — `src/features/reclamacoes/components/ReclamacaoIntakeForm.tsx`

Patient-facing form with file upload + signature. Dark-first, WCAG AA, LGPD-compliant.

**Exports obrigatórios:**

```typescript
import type { ReclamacaoCanal, LogicalSignature } from '../types';

export interface ReclamacaoIntakeFormProps {
  labId: string;
  canal?: ReclamacaoCanal; // default 'patient-portal'
  onSubmitted: (reclamacaoId: string) => void;
  onCancel?: () => void;
}

export function ReclamacaoIntakeForm(props: ReclamacaoIntakeFormProps): JSX.Element;
```

**Invariantes (UX + visual):**

- Container: `bg-[#0e0e10]` page-level. Form card `bg-[#141417] border border-white/10 rounded-2xl p-8 max-w-2xl mx-auto`.
- Tipografia editorial: title `text-2xl font-medium tracking-tight text-white`, body `text-sm text-white/70 leading-relaxed`.
- 4-step progressive disclosure (numbered nav at top): Identificação → Descrição → Anexos → Confirmação.
- Identificação step: anonymous toggle (`bg-white/5 rounded-lg p-4`); when toggled off, name + email/phone fields appear with **explicit LGPD consent checkbox** ("Concordo com [Política de Privacidade] para comunicação"). Without consent, identified submission blocked.
- Descrição step: `<textarea>` w/ live char counter (min 30, max 5000). `tabular-nums` no counter. Empty state: ghost text `"Descreva o ocorrido com clareza — quanto mais contexto, melhor poderemos investigar."`
- Anexos step: drag-drop area accepting PDF/PNG/JPEG/WEBP, max 10MB total, max 5 files. Each file row mostra name + size (`tabular-nums`) + remove button.
- Confirmação step: summary of inputs + submit button. Ao submit: gera `signaturePatient` (sha256 do payload + timestamp + opcional uid), chama `intakeReclamacao` callable, e ao sucesso → `onSubmitted(id)`.
- Estados: idle / submitting (Skeleton button) / success / error inline.
- Microinterações: step transition `transition-all duration-200`. Field focus `ring-2 ring-violet-500/40`. Hover em buttons `bg-violet-500/15` → `bg-violet-500/25`.
- A11y: cada step tem `role="region"` + `aria-labelledby`. Step nav `<nav role="navigation" aria-label="Etapas do formulário">`. File input acessível via teclado. Erros inline com `role="alert"` + `aria-describedby` no field.
- `prefers-reduced-motion`: desabilita transitions.
- Sem libs de ícone — SVG inline `currentColor`.
- LGPD privacy notice link visível em todas as steps (rodapé).

**Files to read:** `src/features/portal-paciente/` (existing forms — consent pattern), `src/features/lgpd/` (privacy policy link reference), `./CLAUDE.md` (design tokens).

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-6-W1-SA-76): ReclamacaoIntakeForm patient-facing dark-first`

---

### SA-77 — `src/features/reclamacoes/components/RCAFiveWhysWorkflow.tsx`

Admin-facing 5-level "Why?" workflow with auto-save.

**Exports obrigatórios:**

```typescript
import type { RCAFiveWhys } from '../types';

export interface RCAFiveWhysWorkflowProps {
  labId: string;
  reclamacaoId: string;
  initialState?: RCAFiveWhys;
  onCompleted: (rootCause: string) => void;
}

export function RCAFiveWhysWorkflow(props: RCAFiveWhysWorkflowProps): JSX.Element;
```

**Invariantes (UX + visual):**

- Container: `bg-[#141417] rounded-2xl p-6 border border-white/10`.
- 5 levels exibidos como timeline vertical à esquerda (`border-l border-white/10 pl-6 space-y-6`). Cada level: número em circle (`w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center tabular-nums text-sm`), question em `text-sm text-white/80`, answer textarea `bg-[#0e0e10] border border-white/10 rounded-lg p-3 text-sm`.
- Default questions vêm de `RCA_QUESTION_TEMPLATES` (W1 SA-74). Admin pode editar a question (clique no texto → input inline).
- Sequência forçada: level N+1 só desbloqueia após level N ter answer ≥ 10 chars.
- Auto-save por level: ao blur do textarea, chama `submitRCAAnswer` callable. Indicator "Salvo" (`text-emerald-400 text-xs tabular-nums`) com timestamp `HH:MM`.
- Após level 5 respondido: aparece card "Causa raiz identificada" com textarea para admin formalizar `rootCause` (≥ 30 chars). Botão "Concluir RCA" só habilita quando válido. Submit: gera signature + chama `completeRCAFiveWhys`.
- Optimistic UI: ao salvar, level marcado como completo (✓ inline). Erro reverte indicator e mostra toast inline.
- Conflito (duas abas editando): server retorna current state → componente re-syncs state, mostra banner amber "Outras alterações foram detectadas — recarregamos o formulário". Sem perda de dados (last-write-wins por level).
- A11y: `role="form"`, cada level com `aria-labelledby` (question id). Hierarquia `<h2>` para "Análise Cinco Porquês".
- `prefers-reduced-motion`: desabilita micro-anim de level unlock.

**Files to read:** `src/features/reclamacoes/types/index.ts` (W1 SA-74), `src/features/sgq/components/` (workflow component pattern reference), `./CLAUDE.md`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-6-W1-SA-77): RCAFiveWhysWorkflow admin component with auto-save`

---

## Wave 11p-W2 — NPS + Suggestion Voting (4 SAs ‖)

deps: W1 may run in parallel (no shared file). All 4 SAs dispatch simultaneously after W1.

---

### SA-78 — `src/features/nps/types.ts` + `src/features/nps/services/npsService.ts` + `functions/src/modules/nps/submitNPS.ts`

Three-file SA: NPS types + read-only client service + callable v2.

**File 1 — `src/features/nps/types.ts`:**

```typescript
export type NPSCategory = 'detractor' | 'passive' | 'promoter'; // 0-6 / 7-8 / 9-10

export interface NPSResponse {
  id: string;
  labId: string;
  score: number; // 0..10 integer
  category: NPSCategory;
  followUp?: string; // free-text reason (required when score <= 6)
  consentToken?: string; // LGPD if respondent identified
  patientToken?: string; // anonymous device-bound token (one response per patient per cycle)
  cycleId: string; // e.g. "2026-Q2"
  submittedAt: number;
  deletedAt?: number;
}

export interface NPSCycleSummary {
  cycleId: string;
  totalResponses: number;
  averageScore: number;
  npsValue: number; // (%promoters - %detractors) * 100
  detractors: number;
  passives: number;
  promoters: number;
  lastUpdatedAt: number;
}

export function classifyNPSScore(score: number): NPSCategory; // 0-6 / 7-8 / 9-10
```

**File 2 — `src/features/nps/services/npsService.ts`:**

```typescript
export function subscribeNPSCycle(
  labId: string,
  cycleId: string,
  onChange: (s: NPSCycleSummary) => void,
): () => void;
export function getNPSResponses(labId: string, cycleId: string): Promise<NPSResponse[]>;
```

**File 3 — `functions/src/modules/nps/submitNPS.ts`:**

```typescript
export const submitNPS: ReturnType<typeof onCall>;
export const aggregateNPSCycle: ReturnType<typeof onCall>;
```

**Callable contracts:**

| Callable            | Input                                                                | Output                         | Auth                          | Key invariants                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------- | ------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submitNPS`         | `{ labId, score, followUp?, consentToken?, patientToken?, cycleId }` | `{ responseId }`               | optional (anonymous OK)       | `score` integer 0..10. `followUp.length >= 10` if `score <= 6`. `patientToken` enforces idempotency: server query `where('patientToken', '==', token).where('cycleId', '==', cycleId)`; if exists, return existing id (no duplicate). |
| `aggregateNPSCycle` | `{ labId, cycleId }`                                                 | `{ summary: NPSCycleSummary }` | required (RT/admin/qualidade) | Recalcula `NPSCycleSummary` a partir de todas as `NPSResponse` com `deletedAt == null`. Persiste em `labs/{labId}/nps/cycles/{cycleId}/summary`.                                                                                      |

**Global invariants:**

- `onCall({ region: 'southamerica-east1', cors: true, memory: '256MiB' })`.
- All writes audit-logged (event: `nps_submitted`, `nps_cycle_aggregated`).
- NEVER log `followUp` content (LGPD — may contain personal feedback).

**Files to read:** `src/features/portal-paciente/`, `functions/src/modules/portal-paciente/`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$' && cd functions && npm run build 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-6-W2-SA-78): NPS types + service + callables (submit + aggregate)`

---

### SA-79 — `src/features/nps/components/NPSSurveyForm.tsx`

Single-question NPS form with conditional follow-up.

**Exports obrigatórios:**

```typescript
export interface NPSSurveyFormProps {
  labId: string;
  cycleId: string;
  patientToken?: string;
  onSubmitted: (npsResponseId: string) => void;
}

export function NPSSurveyForm(props: NPSSurveyFormProps): JSX.Element;
```

**Invariantes (UX + visual):**

- Container: `bg-[#141417] rounded-2xl p-8 border border-white/10 max-w-xl mx-auto`.
- Question: `text-xl font-medium tracking-tight text-white text-center mb-2` — "Em uma escala de 0 a 10, qual a probabilidade de você recomendar este laboratório a um amigo ou colega?"
- Subtitle: `text-sm text-white/60 text-center mb-8`.
- Score scale: 11 botões (0..10) em `flex flex-row gap-2 justify-center flex-wrap`. Cada botão `w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-base tabular-nums text-white/80 hover:bg-white/10 transition-colors duration-150`.
- Score selecionado: `bg-violet-500/30 border-violet-500/60 text-white`.
- Cor por categoria visual (após selecionar): 0-6 → `bg-rose-500/30`, 7-8 → `bg-amber-500/30`, 9-10 → `bg-emerald-500/30`.
- Labels abaixo da escala: "Pouco provável" (esquerda) / "Muito provável" (direita), `text-xs text-white/40`.
- Follow-up textarea aparece SOMENTE se `score <= 6` (transição `transition-all duration-200`). Placeholder: "O que poderíamos melhorar? (mínimo 10 caracteres)". Char counter inline.
- Submit button: full-width `bg-violet-500 hover:bg-violet-600 text-white font-medium py-3 rounded-xl transition-colors`. Disabled: `bg-white/10 text-white/40 cursor-not-allowed`.
- Estados: idle / submitting (Skeleton overlay) / success (card "Obrigado pelo feedback") / error inline.
- A11y: scale como `role="radiogroup"` com `aria-labelledby` na question; cada button `role="radio" aria-checked`. Follow-up textarea `aria-describedby` no char counter.
- `prefers-reduced-motion`: desabilita color transitions.

**Files to read:** `src/features/nps/types.ts` (W2 SA-78), `src/features/portal-paciente/` (form pattern), `./CLAUDE.md`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-6-W2-SA-79): NPSSurveyForm component`

---

### SA-80 — `src/features/sugestoes/services/votingService.ts` + `functions/src/modules/sugestoes/voteSugestao.ts`

Two-file SA: read-only client + callable v2 with fairness enforcement (1 user per item).

**File 1 — `src/features/sugestoes/services/votingService.ts`:**

```typescript
import type { Sugestao } from '../types'; // assume types file already exists in sugestoes module

export type VoteDirection = 'up' | 'down' | 'cleared';

export interface SugestaoWithUserVote extends Sugestao {
  userVote: VoteDirection; // current user's vote on this item
}

export function subscribeSugestoesRanked(
  labId: string,
  uid: string,
  onChange: (rows: SugestaoWithUserVote[]) => void,
): () => void;
```

**File 2 — `functions/src/modules/sugestoes/voteSugestao.ts`:**

```typescript
export const voteSugestao: ReturnType<typeof onCall>;
export const recomputeSugestaoRank: ReturnType<typeof onCall>;
```

**Callable contracts:**

| Callable                | Input                                                           | Output                   | Auth                         | Key invariants                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------- | ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `voteSugestao`          | `{ labId, sugestaoId, direction: 'up' \| 'down' \| 'cleared' }` | `{ newScore, userVote }` | required (any active member) | Atomic transaction: read `labs/{labId}/sugestoes/{id}/votes/{uid}` for previous vote, compute delta, update `score`, update `votes/{uid}` doc with new direction. **Idempotent: same direction twice = no-op.** Cleared deletes the vote subdoc (soft-delete `deletedAt`) and reverts the score. |
| `recomputeSugestaoRank` | `{ labId, sugestaoId? }`                                        | `{ updated: number }`    | required (admin)             | Recompute `score` from votes count (live). Used to fix drift after manual data ops.                                                                                                                                                                                                              |

**Score formula:**

- `score = upvotes - downvotes` (simple). Optionally weighted by recency in future — not in this SA.
- Ranked subscription: `orderBy('score', 'desc'), orderBy('createdAt', 'desc')`.

**Fairness invariants (CRITICAL — Threat: vote stuffing):**

- Per-user vote document path: `labs/{labId}/sugestoes/{sugestaoId}/votes/{uid}` — `uid` is the doc id, enforces 1-vote-per-user.
- Firestore rule for `votes/{uid}`: `request.auth.uid == uid` (user can only write their own vote).
- Server-side transaction reads `votes/{uid}` before mutating `score` — never trusts client-supplied delta.
- All votes audit-logged: `console.log(JSON.stringify({ event: 'sugestao_vote', labId, sugestaoId, direction, uid }))`.

**Global invariants:**

- `onCall({ region: 'southamerica-east1', cors: true, memory: '256MiB' })`.
- RN-06 soft-delete on `votes/{uid}` when direction === 'cleared'.

**Files to read:** `src/features/sugestoes/types/` (existing), `src/features/sugestoes/services/` (existing patterns), `.claude/rules/firestore-security.md`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$' && cd functions && npm run build 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-6-W2-SA-80): sugestoes voting service + callables with 1-user-1-vote fairness`

---

### SA-81 — `src/features/sugestoes/components/SugestaoVotingPanel.tsx`

Suggestion list with upvote/downvote buttons, rank display. Dark-first.

**Exports obrigatórios:**

```typescript
import type { SugestaoWithUserVote, VoteDirection } from '../services/votingService';

export interface SugestaoVotingPanelProps {
  labId: string;
  filterTopic?: string; // optional filter by topic tag
}

export function SugestaoVotingPanel(props: SugestaoVotingPanelProps): JSX.Element;
```

**Invariantes (UX + visual):**

- Layout: vertical list `space-y-3 max-w-3xl mx-auto`. Cada card `bg-[#141417] border border-white/10 rounded-2xl p-5 flex flex-row gap-4`.
- Vote column (left, `w-12`): vertical stack — up arrow button, score (`text-lg tabular-nums font-medium text-white`), down arrow button.
  - Up arrow idle: `text-white/40 hover:text-emerald-400`. Active (user upvoted): `text-emerald-400`.
  - Down arrow idle: `text-white/40 hover:text-rose-400`. Active: `text-rose-400`.
  - Score color tint: positive score `text-emerald-300/80`, negative `text-rose-300/80`, zero `text-white/60`.
- Content column: title `text-base font-medium text-white tracking-tight`, description `text-sm text-white/70 leading-relaxed line-clamp-3`. Author + date row at bottom: `text-xs text-white/40`.
- Topic chips: `bg-violet-500/15 text-violet-300 text-xs px-2 py-1 rounded-full` next to title.
- Rank badge top-3: badge dorado (`bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded-full`) com "#1", "#2", "#3".
- Optimistic UI: clique em vote atualiza score local imediatamente, depois faz callable. Em erro: revert + toast inline (`bg-rose-500/20 border-rose-500/40 text-rose-200`).
- Estados: loading (3 Skeleton cards), empty (centered illustration + "Seja o primeiro a sugerir uma melhoria"), error (inline retry button).
- A11y: cada vote button `aria-pressed` (true se userVote ativo). Score `aria-live="polite"` para screen readers anunciarem mudança.
- Polling 30s para refresh ranks (subscribe via `subscribeSugestoesRanked` é realtime — não precisa polling extra; mas re-render só dispara em diff).
- `prefers-reduced-motion`: desabilita score-change animation.

**Files to read:** `src/features/sugestoes/services/votingService.ts` (W2 SA-80), `src/features/sugestoes/types/`, `./CLAUDE.md`.

**Verify:** `npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-6-W2-SA-81): SugestaoVotingPanel dark-first ranked list`

---

## MP-6 Master Verification Gate

| Gate               | Pass criteria                                                                                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G-Build**        | `npx tsc --noEmit` exit 0 + `cd functions && npm run build` exit 0                                                                                                                                                                                              |
| **G-Test**         | New tests (if added by sibling QA pass) pass; no Phase 8 / MP-5\* regression                                                                                                                                                                                    |
| **G-CORS**         | All 14 new callables (`intakeReclamacao`, `triageReclamacao`, `startRCAFiveWhys`, `submitRCAAnswer`, `completeRCAFiveWhys`, `closeReclamacao`, `submitNPS`, `aggregateNPSCycle`, `voteSugestao`, `recomputeSugestaoRank`, ...) have `cors:true` (grep enforced) |
| **G-Region**       | All callables in `southamerica-east1` (grep `region: 'southamerica-east1'`)                                                                                                                                                                                     |
| **G-LGPD**         | Reclamação form requires `consentToken` when patient identified; NPS does not log `followUp`; Cloud Logs sample shows zero PII in logged events                                                                                                                 |
| **G-Fairness**     | Manual smoke: same uid voting twice on same sugestaoId → score increments only once; reverting (cleared) decrements correctly                                                                                                                                   |
| **G-Soft-Delete**  | grep `deleteDoc(` in new code → 0 hits (only `softDelete*` allowed; vote `cleared` uses `deletedAt`)                                                                                                                                                            |
| **G-RCA-Sequence** | Manual: attempting `submitRCAAnswer` with `level: 3` while level 2 unanswered → callable rejects `failed-precondition`                                                                                                                                          |

Failure of build / CORS / region / soft-delete / LGPD gates → escalate to Sonnet 4.6. Fairness + RCA sequence gates manual; documented in MP-8 deploy checklist.
