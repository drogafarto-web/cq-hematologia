---
macro_phase: MP-2
phase_label: Phase 7 Advanced Auditoria — W4 UI + W5 PDF/Archive + W6 Verification Gate
total_subagents: 14
waves: 3
parallel: true
autonomous: true
human_gates: 0
worker_model: claude-haiku-4-5-20251001
estimated_runtime: 2h
depends_on: [MP-1]
---

# MP-2 — Phase 7 W4-W6

**Goal:** Finish Phase 7 (Advanced Auditoria + AI Insights) by shipping the W4 UI components, the W5 PDF export + archive + email + ExportWizard integration, and the W6 verification gate.
**Dependencies:** MP-1 (no functional dep, but ordering keeps git history clean). Phase 7 W0-W3 already LIVE on `main` — do not touch their files.
**Output:**

- 5 new UI components in `src/features/auditoria/components/`
- Polished PDF callable + 2 new callables (archive, email)
- Auditoria registered as ExportWizard source
- 3 test files (28 tests) + 1 verification doc + Phase 7 overview status flipped to COMPLETE

**W0-W3 already-shipped surface (do not modify; only consume):**

- Hook `useAnomalyAlerts` exists — `src/features/auditoria/hooks/useAnomalyAlerts.ts`
- Hook `useAuditReportExport` exists
- Callable `acknowledgeAlert` exists
- Callable `generateAuditReportPDF` exists at `functions/src/modules/auditoria/generatePDF.ts` (read it; SA-16 polishes it, does not rewrite)
- `cfAuditTrigger` and `anomalyDetector` exist

---

## Wave MP-2-W4 — UI Components (5 SAs ‖)

All 5 SAs run in parallel — each owns a distinct component file.

**Shared style invariants for all W4 SAs:**

- Dark-first: `bg-[#141417]` containers, `bg-white/5` surfaces, `text-white/90` body, `text-white/60` muted, `border-white/10` rules
- Accents: `violet-500` for primary, `emerald-500` for success/positive, `rose-500` for danger/severity-high
- 4px grid spacing — only `p-1`, `p-2`, `p-4`, `p-6`, `p-8`, `gap-2`, `gap-4`, `gap-6`
- Tabular numbers in any data table: `tabular-nums`
- WCAG AA: every interactive element has `:focus-visible` ring, every icon-only button has `aria-label`
- Inline SVG with `currentColor` — no icon library
- Transitions 150-200ms; honor `prefers-reduced-motion`
- Use design tokens cached at `.planning/phases/v1.4-final-closure/tokens-cache.json` if any ambiguity
- Component files use named default export pattern matching siblings in `src/features/criticos/components/`

---

### SA-11 — `src/features/auditoria/components/AlertDashboard.tsx`

**Path:** `src/features/auditoria/components/AlertDashboard.tsx`
**LOC target:** ~180
**Depends on:** none (W4)

**Contract:**

```typescript
type Props = {
  labId: string;
  initialFilters?: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    from?: number;
    to?: number;
  };
};

export default function AlertDashboard(props: Props): JSX.Element;
```

**Behavior:**

- Calls `useAnomalyAlerts(labId, filters)` → `{ alerts, loading, error }`.
- Filter bar at top: severity multi-select pill buttons + date-range (two `<input type="date">`).
- Empty state: "Nenhum alerta no período" with a subtle violet pulse dot.
- Loading state: 3 skeleton rows (`<div class="h-12 bg-white/5 animate-pulse rounded-lg" />`).
- Error state: red-tinted banner with retry button.
- Data state: list of cards, each showing severity badge, lab/scope, timestamp, short description, and an "Abrir detalhes" button that calls `props.onOpenDetail(alert)` (lift via callback prop or local state pairing with SA-12).
- Severity badge colors:
  - low → `bg-white/10 text-white/70`
  - medium → `bg-amber-500/15 text-amber-300`
  - high → `bg-rose-500/15 text-rose-300`
  - critical → `bg-rose-500/30 text-rose-100 ring-1 ring-rose-400/40`
- Sort: most recent first.
- No external chart libs; no icon libs.

**Invariants:**

- `useEffect` with `onSnapshot` cleanup is the hook's responsibility — do not re-subscribe inside the component.
- Memoize `alerts.map(...)` with `useMemo` if list >50 items.

**Files to read first:**

- `src/features/auditoria/hooks/useAnomalyAlerts.ts` (verify return shape)
- `src/features/criticos/components/EscalacaoDashboard.tsx` (canonical dark-first dashboard)
- `DESIGN_SYSTEM.md`
- `.planning/phases/v1.4-final-closure/tokens-cache.json`
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` 0 errors for this file
- Component renders without prop violations under Storybook-style harness (covered by SA-20 test)

**Commit:** `feat(MP-2-W4-SA-11): AlertDashboard — filter + severity-coded list`

---

### SA-12 — `src/features/auditoria/components/AlertDetailModal.tsx`

**Path:** `src/features/auditoria/components/AlertDetailModal.tsx`
**LOC target:** ~160
**Depends on:** none (W4)

**Contract:**

```typescript
type Props = {
  alert: AnomalyAlert | null; // null => closed
  onClose: () => void;
  onAcknowledged?: (alertId: string) => void;
};

export default function AlertDetailModal(props: Props): JSX.Element | null;
```

**Behavior:**

- When `alert == null` → returns `null`.
- Otherwise renders an accessible modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus-trap (focus first interactive on open, return focus on close), close on Escape, close on backdrop click.
- Sections: Header (title + severity), Anomaly evidence (key/value list with `tabular-nums`), Detected pattern (free text from `alert.patternSummary`), Recommended actions (bullet list from `alert.recommendations`), Footer with two buttons: "Fechar" (secondary), "Reconhecer" (primary, violet).
- "Reconhecer" calls `acknowledgeAlert` callable via `httpsCallable` — read sibling service for wrapping pattern. On success, calls `onAcknowledged(alert.id)` and `onClose()`. On failure, shows inline error.
- Loading state on the button (disabled + small spinner inline svg).
- Background overlay: `bg-black/60 backdrop-blur-sm`.

**Invariants:**

- No `document.body` style mutation outside `useEffect` cleanup.
- Keyboard: Tab cycles only inside the modal.
- No new dependencies (no `headlessui`, no `radix-ui`).

**Files to read first:**

- `src/features/auditoria/hooks/useAnomalyAlerts.ts`
- `src/features/criticos/components/ComunicacaoModal.tsx` (canonical modal)
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` 0 errors
- Manual axe pass would yield 0 critical (verified by SA-20 jest-axe assertions)

**Commit:** `feat(MP-2-W4-SA-12): AlertDetailModal — focus-trap dialog + acknowledge`

---

### SA-13 — `src/features/auditoria/components/ReportViewer.tsx`

**Path:** `src/features/auditoria/components/ReportViewer.tsx`
**LOC target:** ~200
**Depends on:** none (W4)

**Contract:**

```typescript
type Props = {
  labId: string;
  reportId: string;
};

export default function ReportViewer(props: Props): JSX.Element;
```

**Behavior:**

- Fetches the NLP-summarized report from `/labs/{labId}/audit-reports/{reportId}` via existing service or hook (search `src/features/auditoria/services/` first; if no fetcher exists, inline a `getDoc` call using `firebase/firestore`).
- Renders:
  1. **Header:** report title, period (from/to dates), generated-by user, generation timestamp.
  2. **Executive summary:** prose paragraph (from `report.summary`), max-width `prose prose-invert`.
  3. **Diff table:** two-column comparison ("Período anterior" vs "Período atual") for each tracked metric. Use `tabular-nums`. Use color coding: improvements `text-emerald-400`, regressions `text-rose-400`, neutral `text-white/70`.
  4. **Expandable sections:** each `report.sections[]` (e.g. "CIQ", "CEQ", "Calibração") rendered as a `<details>` element styled with `marker:text-violet-400`.
- Empty diff table state: "Sem dados comparáveis no período anterior".
- Print-friendly: include `@media print` styles via Tailwind `print:` classes (light background for print).

**Invariants:**

- No chart library — diff is a table.
- All financial/numeric cells use `tabular-nums`.

**Files to read first:**

- `src/features/auditoria/services/` (any existing report service)
- `src/features/auditoria/hooks/useAuditReportExport.ts`
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` 0 errors

**Commit:** `feat(MP-2-W4-SA-13): ReportViewer — exec summary + diff table + expandable sections`

---

### SA-14 — `src/features/auditoria/components/AnomalyTimeline.tsx`

**Path:** `src/features/auditoria/components/AnomalyTimeline.tsx`
**LOC target:** ~170
**Depends on:** none (W4)

**Contract:**

```typescript
type Props = {
  labId: string;
  from: number; // ms epoch
  to: number; // ms epoch
  granularity?: 'day' | 'week'; // default 'day'
};

export default function AnomalyTimeline(props: Props): JSX.Element;
```

**Behavior:**

- Calls `useAnomalyAlerts(labId, { from, to })` and groups results by day (or week).
- Renders a heatmap grid with X-axis = time bucket, Y-axis = severity (low/med/high/critical, top=critical).
- Each cell is a `<div>` with `aria-label="Dia 2026-05-09 — 3 alertas críticos"`. Color intensity scales with count using a 5-stop alpha ramp on the severity hue:
  - Empty: `bg-white/5`
  - 1: `bg-rose-500/20`
  - 2-3: `bg-rose-500/40`
  - 4-7: `bg-rose-500/60`
  - 8+: `bg-rose-500/80`
- Hover: tooltip (HTML `title` attribute is fine for this SA, no portal needed).
- Legend at the bottom showing the 5 stops.
- No external libraries — pure CSS grid.

**Invariants:**

- Cells responsive: grid-template-columns auto-fits between 12 and 32 columns.
- Empty period (from > to or no alerts) renders the grid with all empty cells + a "Sem anomalias no período" overlay.
- Memoize the bucketing computation with `useMemo`.

**Files to read first:**

- `src/features/auditoria/hooks/useAnomalyAlerts.ts`
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` 0 errors

**Commit:** `feat(MP-2-W4-SA-14): AnomalyTimeline — CSS-grid heatmap, no chart deps`

---

### SA-15 — `src/features/auditoria/components/RuleBasedAlertList.tsx`

**Path:** `src/features/auditoria/components/RuleBasedAlertList.tsx`
**LOC target:** ~150
**Depends on:** none (W4)

**Contract:**

```typescript
type Props = {
  labId: string;
  ruleId?: string; // optional filter by single rule
};

export default function RuleBasedAlertList(props: Props): JSX.Element;
```

**Behavior:**

- Fetches detection rules from `/labs/{labId}/audit-detection-rules` (collection group; if path differs, read existing `cfAuditTrigger.ts` to confirm).
- For each rule, fetches the count of alerts triggered in the last 30 days.
- Renders a list of cards: rule name, description, last-triggered timestamp, alert count badge, and a link `Editar regra →` pointing to `/auditoria/rules/{ruleId}/edit` (router path).
- If `props.ruleId` is set, render only that rule + the alerts it triggered (paginated 25/page).
- Empty: "Nenhuma regra configurada — defina sua primeira regra".

**Invariants:**

- Use existing `react-router` `<Link>` (the project uses it; verify in `src/AppRouter.tsx`). If the route doesn't exist yet, generate the link anyway — wiring the route is out-of-scope for this SA.
- No `useEffect` polling; rely on Firestore `onSnapshot` for the rule list.

**Files to read first:**

- `functions/src/modules/auditoria/` (locate detection rules schema)
- `src/AppRouter.tsx`
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` 0 errors

**Commit:** `feat(MP-2-W4-SA-15): RuleBasedAlertList — per-rule grouping + edit link`

---

## Wave MP-2-W5 — PDF Export + Archive (4 SAs ‖, after W4)

---

### SA-16 — Polish `functions/src/modules/auditoria/generatePDF.ts`

**Path:** `functions/src/modules/auditoria/generatePDF.ts` (existing file — extend, do not rewrite)
**LOC target:** +200 (additions)
**Depends on:** none (functions-side, parallel with W5 siblings)

**Actions:**

1. Read the file. Locate the existing PDF render function (likely uses `pdfkit` or `puppeteer`).
2. Add three new sections to the rendered PDF, in this exact order:
   - **Cover page** — lab name, lab CNPJ, report period, RT name, generation timestamp, the violet primary at top-left as a 4mm bar (use a hex color so it renders in PDF; tokens-cache.json has the mapping).
   - **Executive summary** — first page after cover. 1-2 paragraphs, pulled from `report.summary` field. If field absent, fallback to `"Sumário não disponível."`.
   - **Rule-by-rule sections** — for each detection rule that fired in the period, a section with rule name (h2), description, count, and a table of triggered alerts (timestamp, severity, target).
3. Preserve the existing footer/header pagination logic untouched.
4. Wrap PDF byte assembly in try/catch — on error, throw `HttpsError('internal', 'PDF generation failed: ' + err.message)`.

**Invariants:**

- onCall v2 with `cors: true` and `region: 'southamerica-east1'` — confirm in the existing handler; if missing, fix.
- Output remains a Buffer or base64 string (whatever the existing contract is — do not change return shape).
- No new heavy npm dependency. Reuse what's already in `functions/package.json`.

**Files to read first:**

- `functions/src/modules/auditoria/generatePDF.ts` (full)
- `functions/package.json`
- `.claude/rules/performance.md` (puppeteer/pdfkit must be functions-side only)
- `./CLAUDE.md`

**Verification:**

- `(cd functions && npm run build)` exit 0
- `cd functions && npm test -- generatePDF` passes existing tests + new ones from SA-22

**Commit:** `feat(MP-2-W5-SA-16): generatePDF — cover page + exec summary + per-rule sections`

---

### SA-17 — `functions/src/modules/auditoria/archiveAuditReport.ts`

**Path:** `functions/src/modules/auditoria/archiveAuditReport.ts`
**LOC target:** ~140
**Depends on:** none (W5)

**Contract:**

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const ArchiveInput = z.object({
  labId: z.string().min(1),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/), // e.g. "2026-05"
  reportId: z.string().min(1),
});

export const archiveAuditReport = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    /* archives one report immutably */
  },
);

export const archiveAuditReportsMonthly = onSchedule(
  { schedule: '0 3 1 * *', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1' },
  async () => {
    /* iterates all labs + archives previous month */
  },
);
```

**Behavior of `archiveAuditReport` (callable):**

1. Auth + lab membership guard.
2. Read source report at `/labs/{labId}/audit-reports/{reportId}`.
3. Compute `crypto.createHash('sha256').update(JSON.stringify(reportData)).digest('hex')`.
4. Generate server-side `LogicalSignature` over `{labId, yearMonth, reportId, hash, uid, ts}`.
5. Write to `/labs/{labId}/auditoria-archive/{yearMonth}/{reportId}` with payload:
   ```typescript
   {
     labId, yearMonth, reportId,
     snapshot: reportData,
     hash, assinatura: signature,
     archivedAt: serverTimestamp(),
     archivedBy: request.auth.uid,
   }
   ```
6. Return `{ archiveId: ref.id, hash }`.

**Behavior of `archiveAuditReportsMonthly` (cron):**

- Runs 03:00 Sao_Paulo on day 1 of each month.
- Iterates `/labs` collection (top-level), then for each lab queries reports in the previous calendar month, calling the same archive logic.
- Skips reports already archived (idempotent — check existence at target path).

**Invariants:**

- onCall v2 + onSchedule v2 — both with `region: 'southamerica-east1'`.
- Archive docs are append-only — no rules updates needed if the rule for `auditoria-archive` denies update/delete (SA-08-equivalent rule may need to be added; if missing, append a block in this SA to `firestore.rules` denying update/delete on `auditoria-archive`).
- Idempotent — running twice for the same `yearMonth/reportId` is a no-op.

**Files to read first:**

- `functions/src/modules/auditoria/auditoria.ts` (callable pattern)
- `functions/src/modules/auditoria/generatePDF.ts` (PDF source path)
- Any existing `onSchedule` example in `functions/src/modules/` (e.g. `firestoreBackup`, `criticos/cron.ts`)
- `firestore.rules`
- `./CLAUDE.md`

**Verification:**

- `(cd functions && npm run build)` exit 0
- Rules emulator test denies client write to `auditoria-archive`

**Commit:** `feat(MP-2-W5-SA-17): archiveAuditReport callable + monthly cron — immutable hash+signature`

---

### SA-18 — Register auditoria as ExportWizard source

**Path:** `src/features/export/services/exportSourceRegistry.ts` (existing — extend)
**LOC target:** +60
**Depends on:** none (W5)

**Actions:**

1. Read `src/features/export/services/exportSourceRegistry.ts` — confirm the registry shape (likely `Record<SourceKey, SourceDescriptor>`).
2. Add a new entry `'auditoria'` with descriptor:
   ```typescript
   {
     key: 'auditoria',
     label: 'Auditoria — Relatórios',
     description: 'Relatórios de auditoria avançada (anomalias, alertas, rule-engine)',
     callable: 'generateAuditReportPDF',           // existing callable name
     formats: ['pdf', 'xlsx'],
     filters: [
       { key: 'from', label: 'Início', type: 'date', required: true },
       { key: 'to',   label: 'Fim',    type: 'date', required: true },
       { key: 'severity', label: 'Severidade', type: 'multi-select',
         options: ['low','medium','high','critical'], required: false },
     ],
     permission: 'rt-or-admin',   // match existing permission keys in registry
   }
   ```
3. If the registry uses a typed enum/union for `SourceKey`, extend it to include `'auditoria'`.
4. Confirm `npx tsc --noEmit` is clean.

**Invariants:**

- Append only — do not edit unrelated entries.
- Format strings (`'pdf'`, `'xlsx'`) must match the existing union — verify before writing.
- `permission` value must match an existing key (read the file to find it).

**Files to read first:**

- `src/features/export/services/exportSourceRegistry.ts`
- `src/features/export/types/` (if exists)
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` 0 errors
- `grep -E "key:\\s*'auditoria'" src/features/export/services/exportSourceRegistry.ts` returns 1

**Commit:** `feat(MP-2-W5-SA-18): register auditoria as ExportWizard source`

---

### SA-19 — `functions/src/modules/auditoria/emailAuditReport.ts`

**Path:** `functions/src/modules/auditoria/emailAuditReport.ts`
**LOC target:** ~160
**Depends on:** none (W5)

**Contract:**

```typescript
const EmailReportInput = z.object({
  labId: z.string().min(1),
  reportId: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(10).optional(),
  // if absent, defaults to lab admin + auditor on file
});

export const emailAuditReport = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'],
  },
  async (request) => {
    // returns { messageId: string, recipientsSent: string[] }
  },
);
```

**Behavior:**

1. Auth + lab membership guard.
2. Default recipients: query `/labs/{labId}/members` for users with `role in ('admin','rt','auditor')` and collect their emails. Cap at 10.
3. Generate the PDF by invoking the existing `generateAuditReportPDF` logic — refactor the rendering function out of `generatePDF.ts` into an exported helper if it isn't already, then `import { renderAuditReportPDF } from './generatePDF'` here. **If extracting a helper, do it in SA-16's same file** — coordinate by adding a TODO at the top of this file referring to that helper. If unfeasible, call the public callable internally via `httpsCallable` (last resort).
4. Send email via SMTP using `nodemailer` (already in `functions/package.json`; verify). Subject: `[HC Quality] Relatório de auditoria — {labName} — {period}`. Body: short Portuguese intro + attachment.
5. Audit log: write to `/labs/{labId}/email-log/{logId}` with `{ messageId, recipients, sentAt, sentBy }`.
6. Return `{ messageId, recipientsSent }`.

**Invariants:**

- onCall v2 with `cors: true`, `region: 'southamerica-east1'`, secrets declared.
- Pre-deploy gate `bash scripts/preflight-secrets-check.sh` will block deploy if SMTP\_\* secrets aren't provisioned. Expected — do not work around it.
- Attachment max 25 MB. If PDF exceeds, throw `HttpsError('resource-exhausted', ...)` with guidance to use Firebase Storage signed URL instead.

**Files to read first:**

- `functions/src/modules/auditoria/generatePDF.ts`
- `functions/package.json` (confirm `nodemailer`)
- Any sibling email callable for nodemailer config pattern (e.g. `functions/src/modules/emailBackup`)
- `.claude/rules/deploy-protocol.md`
- `./CLAUDE.md`

**Verification:**

- `(cd functions && npm run build)` exit 0
- `bash scripts/preflight-secrets-check.sh` lists SMTP\_\* if any are unset (informational; do not break MP-2 on this — deploy gate handles it in MP-8)

**Commit:** `feat(MP-2-W5-SA-19): emailAuditReport callable — SMTP delivery + audit log`

---

## Wave MP-2-W6 — Verification Gate (5 SAs)

SA-20, SA-21, SA-22 run in parallel (each owns a distinct test file). SA-23 depends on those three. SA-24 depends on SA-23.

---

### SA-20 — `src/__tests__/auditoria/alertDashboard.test.tsx`

**Path:** `src/__tests__/auditoria/alertDashboard.test.tsx`
**LOC target:** ~220
**Depends on:** SA-11, SA-12 (components must exist)

**Tests (8 minimum):**

1. Renders empty state when `useAnomalyAlerts` returns `{ alerts: [], loading: false, error: null }`.
2. Renders 3 skeleton rows when `loading: true`.
3. Renders error banner with retry button when `error != null`.
4. Filters by severity: clicking "high" pill shows only high-severity alerts.
5. Filters by date range: changes to `from`/`to` re-trigger hook with new args.
6. Sort: newest alert appears first.
7. Severity badge color: critical alert gets `ring-rose-400/40` class.
8. Detail flow: clicking "Abrir detalhes" opens `<AlertDetailModal>` with the alert; clicking "Reconhecer" calls mocked `acknowledgeAlert` and closes the modal.
9. (bonus) jest-axe `expect(await axe(container)).toHaveNoViolations()` on the rendered tree.

**Harness:**

- vitest + @testing-library/react (read sibling tests in `src/__tests__/` to confirm; install nothing new)
- Mock `useAnomalyAlerts` via `vi.mock('../../features/auditoria/hooks/useAnomalyAlerts', ...)`
- Mock `acknowledgeAlert` callable similarly.

**Verification:**

- `npm test -- src/__tests__/auditoria/alertDashboard.test.tsx` → 8/8 (or 9/9) pass

**Commit:** `test(MP-2-W6-SA-20): AlertDashboard — 8 tests + a11y`

---

### SA-21 — `src/__tests__/auditoria/anomalyDetection.test.ts`

**Path:** `src/__tests__/auditoria/anomalyDetection.test.ts`
**LOC target:** ~250
**Depends on:** none (tests existing W2 code)

**Tests (10 minimum)** for the anomaly detector logic in `functions/src/shared/anomalyDetector.ts` (exists — read it first to learn the API):

1. Z-score detector flags value > 3 SD from baseline.
2. Z-score detector ignores value within 2 SD.
3. Trend detector flags 5 consecutive deteriorating points.
4. Trend detector requires minimum sample size (e.g. ≥10) to fire.
5. Periodicity detector flags new pattern absent from historical window.
6. Threshold detector fires on hard threshold breach regardless of variance.
7. Severity escalation: combination of 3 medium signals escalates to high.
8. Lab-scoping: alerts are tagged with `labId` and never leak across tenants.
9. Empty baseline: detector returns no alerts and does not throw.
10. Idempotent: running detector twice on the same input produces identical alert ids (deterministic hash).

**Harness:**

- Pure unit tests under vitest. No emulator.
- Build deterministic fixtures inline in the test file.

**Verification:**

- `cd functions && npm test -- anomalyDetection` (or root `npm test` depending on config) → 10/10 pass

**Commit:** `test(MP-2-W6-SA-21): anomalyDetector — 10 unit tests`

---

### SA-22 — `src/__tests__/auditoria/reportPDF.test.ts`

**Path:** `src/__tests__/auditoria/reportPDF.test.ts`
**LOC target:** ~180
**Depends on:** SA-16 (PDF must produce cover/exec/per-rule sections)

**Tests:**

1. Golden snapshot: render a fixture report → extract text content from the PDF (use `pdf-parse` if already in deps; if not, fall back to byte-length + section-marker assertions). Assert the snapshot matches `__snapshots__/reportPDF.snap`.
2. Cover page: extracted text contains lab name, period, RT name, generation timestamp.
3. Executive summary: extracted text contains the `report.summary` string.
4. Per-rule section: for a fixture with 3 rules fired, extracted text has 3 occurrences of the rule-section marker (e.g. "Regra: ...").
5. Empty report: rendering still produces a valid PDF (signature `%PDF-` at byte 0..4) and contains "Sumário não disponível.".
6. Determinism: rendering the same fixture twice produces identical byte length (or, if signed/timestamped, identical SHA-256 of all non-timestamp regions).

**Setup:**

- Add an `__snapshots__/reportPDF.snap` file generated on first run. Subsequent runs must match.
- If `pdf-parse` is not installed, document that and use byte-marker assertions only — do not add dependencies.

**Verification:**

- `npm test -- reportPDF` → all pass on second run (first run generates snapshot)

**Commit:** `test(MP-2-W6-SA-22): reportPDF — golden snapshot + 5 assertions`

---

### SA-23 — `.planning/phases/07-advanced-auditoria/07-VERIFICATION.md`

**Path:** `.planning/phases/07-advanced-auditoria/07-VERIFICATION.md`
**LOC target:** ~150
**Depends on:** SA-20, SA-21, SA-22 (all must pass first)

**Doc structure:**

```markdown
# Phase 7 — Verification Gate (W6)

## Status: PASS / FAIL ← actual result

## TSC

- Web: <N> errors
- Functions: <N> errors

## Tests

- Total Phase 7 tests: existing + 18 new = <total>
- Pass rate: <%>
- New tests by SA: SA-20 (8) + SA-21 (10) + SA-22 (5+) = 23+

## Compliance Audit

| Requirement                                   | W4-W6 evidence                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| RDC 978 5.3 — Audit trail who/what/when/where | AlertDashboard surfaces who/what/when/where; AnomalyTimeline visualizes when |
| RDC 978 Art. 107 — Revisões periódicas        | archiveAuditReportsMonthly cron + ReportViewer                               |
| DICQ 4.4 — Trilha + anomalias                 | AlertDashboard + AnomalyTimeline + RuleBasedAlertList                        |
| DICQ 4.4 — Investigação de NC                 | AlertDetailModal "Reconhecer" + acknowledge log                              |

## Bundle

- Auditoria module gzip delta: +<KB> KB (must be < 30 KB)
- Main chunk total gzip: <KB> KB (limit: 450 KB)

## Deploy readiness

- [ ] All tests green
- [ ] TSC 0 errors
- [ ] All callables `cors: true` + `region: southamerica-east1`
- [ ] Rules updated for `auditoria-archive` (SA-17 may have appended)
- [ ] preflight-secrets-check passes (SMTP\_\* required by emailAuditReport)
- [ ] No regressions vs MP-1 baseline

Generated by MP-2-W6-SA-23 on 2026-05-09.
```

**Actions:**

- Run all verification commands and fill in real numbers.
- If any test fails, write `Status: FAIL` and list the failing tests — do not gloss over.

**Verification:**

- File exists with real data
- `git diff --stat` shows only this file modified

**Commit:** `docs(MP-2-W6-SA-23): Phase 7 verification gate — TSC + 28 tests + compliance audit`

---

### SA-24 — Update Phase 7 overview status

**Path:** `.planning/phases/07-advanced-auditoria/PHASE-7-OVERVIEW.md`
**LOC target:** small surgical edit
**Depends on:** SA-23

**Actions:**

1. Open the file. In the frontmatter, change `status: planned` → `status: complete`. Add `date_completed: 2026-05-09`.
2. In the body, append (do not rewrite existing waves):
   ```markdown
   ## Completion (2026-05-09)

   - W4 UI shipped: AlertDashboard, AlertDetailModal, ReportViewer, AnomalyTimeline, RuleBasedAlertList
   - W5 PDF/Archive shipped: cover/exec/per-rule sections, archiveAuditReport (callable + monthly cron), ExportWizard registration, emailAuditReport
   - W6 verification: see `07-VERIFICATION.md`
   - Module flipped to "Em prod" in root `CLAUDE.md` Módulos table
   ```
3. Edit `CLAUDE.md` (root) `Módulos em produção` table — add or update the `auditoria` row to reflect "Em prod · Phase 7 W4-W6 (advanced auditoria + AI insights)" with date `2026-05-09`. **Surgical edit only — do not touch other rows.**

**Invariants:**

- Frontmatter must remain valid YAML.
- Do not delete any existing line.

**Files to read first:**

- `.planning/phases/07-advanced-auditoria/PHASE-7-OVERVIEW.md`
- `CLAUDE.md` (root)

**Verification:**

- `grep '^status: complete' .planning/phases/07-advanced-auditoria/PHASE-7-OVERVIEW.md` returns 1
- `git diff --stat` shows exactly 2 files

**Commit:** `docs(MP-2-W6-SA-24): Phase 7 status → complete + module table update`

---

## Verification Gate MP-2

```bash
# G-Build
npx tsc --noEmit
(cd functions && npm run build)

# G-Tests (Phase 7 surface)
npm test -- src/__tests__/auditoria/
# Expect: 8 (alertDashboard) + 10 (anomalyDetection) + 5+ (reportPDF) = 23+ new tests, all green
# Plus all existing Phase 7 W0-W3 tests (49) still green

# G-CORS
grep -c 'cors: true' functions/src/modules/auditoria/archiveAuditReport.ts
grep -c 'cors: true' functions/src/modules/auditoria/emailAuditReport.ts
# Each ≥1

# G-Bundle (after npm run build)
npm run build 2>&1 | grep -E 'index-.*\.js.*gzip'
# Main chunk must remain ≤ 450 KB gzip

# G-Verification doc
test -f .planning/phases/07-advanced-auditoria/07-VERIFICATION.md
grep -q '^Status: PASS' .planning/phases/07-advanced-auditoria/07-VERIFICATION.md \
  || grep -q '^## Status: PASS' .planning/phases/07-advanced-auditoria/07-VERIFICATION.md
```

**Pass criteria:**

- [ ] 14 SA commits landed
- [ ] 5 W4 components compile and pass renders in test SA-20
- [ ] generatePDF outputs cover + exec + per-rule sections (SA-22 snapshot green)
- [ ] archiveAuditReport callable + monthly cron deployed-ready (TSC + build pass)
- [ ] auditoria registered in ExportWizard registry
- [ ] emailAuditReport callable compiles with SMTP secrets declared
- [ ] 23+ new tests green (8 + 10 + 5)
- [ ] No regression on existing 49 Phase 7 tests
- [ ] 07-VERIFICATION.md present and Status: PASS
- [ ] PHASE-7-OVERVIEW.md status flipped to `complete`
- [ ] Root CLAUDE.md module table updated for `auditoria` row
