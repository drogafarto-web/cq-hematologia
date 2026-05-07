# v1.5 Feature 1: Audit Trail Console — Task Breakdown

**Date:** 2026-05-07  
**Total Effort:** 5–6 days (4 granular tasks)  
**Status:** Ready to assign (all prerequisites shipped)  
**Owner:** [Assign team member]

---

## Overview

Feature 1 decomposes the Audit Trail Console into 4 implementable tasks with clear APIs and dependencies. All callables and types are ready. UI implementation is self-contained within `src/features/qualidade/components/`.

---

## Task Allocation Strategy

### Option A: Single Engineer (Sequential)
**Timeline:** 5–6 days continuous  
**Pros:** Deep ownership, fewer integration hiccups  
**Cons:** Slower feedback loops, one person blocked = whole feature blocked

- Day 1–1.5: Task 1.1 (List view)
- Day 1.5–2.5: Task 1.2 (Chain validator)
- Day 2.5–4: Task 1.3 (Export)
- Day 4–4.5: Task 1.4 (Route + hub tile)

### Option B: 2 Engineers (Parallel)
**Timeline:** 3–4 days (concurrent)  
**Pros:** Faster, parallel feedback  
**Cons:** Requires task isolation + merge coordination

- **Engineer A:** Task 1.1 (List) + Task 1.4 (Route) — 2 days
  - Owns data fetching, pagination, filtering UX
  - Leaves Task 1.4 until 1.1 is mostly done (day 1.5+)
- **Engineer B:** Task 1.2 (Chain validator) + Task 1.3 (Export) — 2 days
  - Owns modal logic, export formats, file generation
  - Can start immediately, independent of 1.1

**Merge point:** End of day 2 for shared state (optional—each component manages its own Zustand store or local state).

---

## Detailed Task Cards

### Task 1.1: Audit Trail List View + Filters

**ID:** `V15-FEAT1-1.1`  
**Effort:** 1.5 days  
**Status:** Ready  
**Owner:** [Assign]

**Scope:**
- Component: `src/features/qualidade/components/AuditTrailList.tsx`
- Hook: `src/features/qualidade/hooks/useGetAuditTrail.ts` (new, wraps callable)
- Types: ✅ import from `src/features/qualidade/types/auditUI.ts`

**API Contract:**

```typescript
// Input: filters + pagination state
interface AuditTrailListProps {
  labId: LabId;  // from useActiveLabId()
}

// Output: component manages own state (Zustand optional)
interface AuditTrailListState {
  entries: AuditTrailEntry[];
  filters: AuditTrailFilters;
  offset: number;
  limit: number;
  hasMore: boolean;
  isLoading: boolean;
  error?: Error | null;
}

// Callable integration
const useGetAuditTrail = (filters: AuditTrailFilters, offset: number, limit: number) => {
  const [state, setState] = useState<AuditTrailListState>(...);
  useEffect(() => {
    callGetAuditTrail({ labId, ...filters, offset, limit })
      .then(result => setState({ entries: result.entries, hasMore: result.hasMore, ... }))
      .catch(err => setState({ error: err }));
  }, [filters, offset, limit]);
  return { ...state, setFilters, setOffset, ... };
};
```

**Acceptance Criteria:**

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Component renders dark table (Tailwind `bg-[#1a1a1e]`, text `white/90`)
- [ ] Columns: modulo, operadorId, resultado (color-coded: green/yellow/red badges), timestamp, detalhes (expandable)
- [ ] Date range picker (native `<input type="date">`) defaults to "last 90 days"
- [ ] Filters work: filter by modulo dropdown, operadorId combobox (type-to-search), resultado badges (toggle)
- [ ] Pagination: Previous/Next buttons, "page X of Y" indicator, "hasMore" disables Next when false
- [ ] Sorting: click column header to sort by timestamp (↑/↓ icon), resultado
- [ ] Loading state: skeleton rows while fetching, "Carregando..." placeholder
- [ ] Error state: toast or inline error message with retry button
- [ ] Clear filters button resets all to defaults
- [ ] Responsive: scrollable table on mobile (375px), sticky header with filters
- [ ] WCAG AA: Lighthouse a11y score ≥ 90, keyboard navigation (Tab through filters + table), `aria-label` on buttons
- [ ] Performance: renders 50+ entries in <500ms (Lighthouse LCP <2.5s)

**Definition of Done:**
- [ ] Component exported and testable in Storybook (optional)
- [ ] Hook tested with mock callable (unit test in `src/__tests__/`)
- [ ] Integrated into `AuditTrailPage.tsx` (Task 1.4 owns page shell)
- [ ] Mobile preview confirmed (iPhone SE 375px)

**Notes:**
- Use `Timestamp` from Firestore for ts field; format as `YYYY-MM-DD HH:MM:SS` in table
- `operadorId` should resolve to operator name via separate hook (educacao-continuada/colaboradores) if available; fallback to ID
- `detalhes` field is optional; render as expandable row or tooltip
- No external table library (use Tailwind `<table>` + semantic HTML)

---

### Task 1.2: Chain Validator Modal

**ID:** `V15-FEAT1-1.2`  
**Effort:** 1 day  
**Status:** Ready  
**Owner:** [Assign] (can be parallel with 1.3)

**Scope:**
- Component: `src/features/qualidade/components/ChainValidator.tsx`
- Modal: use Radix `Dialog` or headless UI
- Types: ✅ import from `src/features/qualidade/types/auditUI.ts`

**API Contract:**

```typescript
interface ChainValidatorProps {
  labId: LabId;
}

interface ChainValidatorState {
  result?: ValidateChainResult;
  isValidating: boolean;
  lastValidated?: number;
  isOpen: boolean;
}

const callValidateChain = async (payload: ValidateChainPayload) => {
  // Returns: { ok: true, status: 'valido' | 'quebrado', firstViolation?, lastCheckTime }
};
```

**Acceptance Criteria:**

- [ ] TypeScript compiles without errors
- [ ] Button "Verificar integridade da corrente" renders in top bar (or wherever Task 1.1 places it)
- [ ] Click opens modal dialog with:
  - Status badge (green "Válido" or red "Quebrado")
  - Last check timestamp ("Última verificação: YYYY-MM-DD HH:MM:SS")
  - "Verificar agora" button (triggers `callValidateChain()`)
- [ ] While validating: show spinner, disable button, text "Aguardando verificação..."
- [ ] On success (valid): show "✓ Cadeia íntegra desde [timestamp]"
- [ ] On success (broken): show red badge + first violation detail:
  ```
  Cadeia quebrada em: [docId]
  Expected: [hash]
  Actual: [hash]
  Remediation: Contacte o administrador para investigação.
  ```
- [ ] Auto-refresh every 24h: on mount, check localStorage `lastChainValidation_${labId}`, if >24h ago, call `callValidateChain()` automatically
- [ ] Locked state: if broken, button disabled + text "Aguardando investigação do administrador"
- [ ] Keyboard: Esc closes modal, Enter on "Verificar agora" fires validation
- [ ] Error handling: toast with error message on callable failure
- [ ] WCAG AA: focus visible on button, modal labeled, dismiss button has `aria-label`
- [ ] Mobile: modal centered and responsive on 375px (full-width on small screens)

**Definition of Done:**
- [ ] Modal tested with valid/broken/error states
- [ ] Auto-refresh logic verified (localStorage timestamps)
- [ ] Error messages in PT-BR
- [ ] Integrated into `AuditTrailPage.tsx`

**Notes:**
- Store last validation time in localStorage to avoid redundant calls within 24h window
- If callable takes >5s, show warning "Aguarde..." + cancel option
- Violation detail should be copy-able (select text or copy button for hash values)

---

### Task 1.3: Signed CSV + PDF Export

**ID:** `V15-FEAT1-1.3`  
**Effort:** 1.5 days  
**Status:** Ready  
**Owner:** [Assign] (can be parallel with 1.2)

**Scope:**
- Component: `src/features/qualidade/components/AuditExportButton.tsx`
- Utilities: `src/features/qualidade/services/auditExportFormatter.ts` (new, handles CSV/PDF generation)
- Types: ✅ import from `src/features/qualidade/types/auditUI.ts`

**API Contract:**

```typescript
interface AuditExportButtonProps {
  entries: AuditTrailEntry[];
  filters: AuditTrailFilters;
  chainStatus?: ValidateChainResult;
  labName: string;
}

// Formatter utilities (pure functions)
const formatAuditCSV = (
  entries: AuditTrailEntry[],
  filters: AuditTrailFilters,
  chainStatus: ValidateChainResult,
  labName: string
): string => { /* CSV with headers + data */ };

const generateAuditPDF = (
  entries: AuditTrailEntry[],
  filters: AuditTrailFilters,
  chainStatus: ValidateChainResult,
  labName: string,
  signature: { hash: string; operatorId: string; ts: number }
): Blob => { /* PDF blob */ };
```

**Acceptance Criteria:**

- [ ] TypeScript compiles without errors
- [ ] Button "Exportar" in toolbar opens popover with radio group: "CSV" / "PDF"
- [ ] CSV export:
  - [ ] Metadata header rows:
    - `Relatório de Auditoria`
    - `Data de Exportação: YYYY-MM-DD HH:MM:SS`
    - `Laboratório: [labName]`
    - `Período: [dataInicio] a [dataFim]`
    - `Filtros Aplicados: modulo=[...], operador=[...], resultado=[...]`
    - `Validação de Cadeia: [status] (YYYY-MM-DD HH:MM:SS)`
    - (blank line)
  - [ ] Data table with headers: modulo, operadorId, operadorNome, resultado, timestamp, detalhes, chainHashValido
  - [ ] Rows formatted: resultado as text (sucesso/falha/aviso), timestamp as `YYYY-MM-DD HH:MM:SS`
  - [ ] Proper CSV escaping (quotes for strings with commas/newlines)
  - [ ] File name: `auditreport_[labId]_[YYYYMMDD].csv`
  - [ ] Download triggers automatically on button click

- [ ] PDF export:
  - [ ] Header: lab name, report title, date range, filters applied
  - [ ] Summary section: count by resultado (table: 3 rows for sucesso/falha/aviso)
  - [ ] Chain validation status: "✓ Válido" or "✗ Quebrado (primeiro erro em [docId])"
  - [ ] Detail table: entries with same columns as CSV (fit to page width, break rows if needed)
  - [ ] Footer: signature block
    - `Relatório assinado por: [operatorId]`
    - `Hash: [hash]`
    - `Timestamp: YYYY-MM-DD HH:MM:SS`
  - [ ] Professional formatting: dark-friendly colors (check readability on white PDF background)
  - [ ] Single-page report for ≤50 entries; multi-page with headers/footers for >50
  - [ ] File name: `auditreport_[labId]_[YYYYMMDD].pdf`
  - [ ] Download triggers automatically on button click

- [ ] Loading state: toast "Gerando arquivo..." while processing
- [ ] Success state: toast "Arquivo exportado" + file name
- [ ] Error handling: toast with error message (e.g., "Falha ao gerar PDF — tente novamente", "Muitos registros — export em lotes")
- [ ] Batch handling: if >1000 entries, offer to download as ZIP with multiple files (chunk by 500)
- [ ] Responsive: button visible on mobile, popover positioned correctly
- [ ] WCAG AA: button has proper `aria-label`, popover labeled

**Definition of Done:**
- [ ] CSV and PDF files generated correctly (manual test: download and verify content)
- [ ] Signature block present in PDF and CSV
- [ ] File names timestamped and deterministic
- [ ] Performance: export <2s for 100 entries, <10s for 1000 entries
- [ ] Integrated into `AuditTrailPage.tsx`
- [ ] No external PDF library beyond `pdfkit` or `html2pdf` (if already in bundle; check bundle size)

**Notes:**
- CSV and PDF generation is client-side (no callable needed for export itself)
- Signature is passed from parent (Task 1.1 or Task 1.2 can fetch it via `callValidateChain`, which includes timestamp)
- If signature is needed server-side (for certification), add a callable spike later
- Test with various filter combinations and entry counts (10, 50, 500, 1000)

---

### Task 1.4: Route + Hub Tile + Page Shell

**ID:** `V15-FEAT1-1.4`  
**Effort:** 0.5 days  
**Status:** Ready  
**Owner:** [Assign]

**Scope:**
- Route: `src/routes/AuditTrailPage.tsx` (new)
- Hub integration: update `src/hub/` config or router (check existing pattern)
- Dependencies: ✅ Components from Tasks 1.1–1.3

**API Contract:**

```typescript
// Page component
export default function AuditTrailPage() {
  return (
    <PageShell title="Auditoria — Verificação de Cadeia">
      {/* Renders: Breadcrumb | AuditTrailList + ChainValidator + ExportButton */}
    </PageShell>
  );
}

// Route definition (in AppRouter or routing config)
{
  path: '/auditoria-trail',
  element: React.lazy(() => import('../routes/AuditTrailPage')),
  name: 'auditTrail'
}

// Hub tile config
{
  id: 'auditTrail',
  icon: <ShieldCheckIcon />,
  label: 'Auditoria',
  description: 'Verificação de cadeia de integridade',
  path: '/auditoria-trail',
  role: 'admin'  // or leave open based on rules
}
```

**Acceptance Criteria:**

- [ ] TypeScript compiles without errors
- [ ] Route `/auditoria-trail` accessible from browser
- [ ] Page uses `React.lazy()` for lazy loading (verify in bundle analysis)
- [ ] Breadcrumb: "Hub > Auditoria > Verificação de Cadeia" (or shorter "Auditoria" if space-constrained)
- [ ] Hub tile appears in module grid:
  - [ ] Icon visible + title "Auditoria" + description truncated (max 2 lines)
  - [ ] Click tile navigates to `/auditoria-trail`
  - [ ] Tile styling matches hub design (dark-first, minimal, professional)
- [ ] Page shell:
  - [ ] Navbar with module title + back button (→ hub)
  - [ ] Export button positioned top-right (from Task 1.3)
  - [ ] Page content: breadcrumb, AuditTrailList, ChainValidator, ExportButton arranged vertically
- [ ] Mobile (375px):
  - [ ] Hub tile visible and tappable
  - [ ] Page layout stacks vertically
  - [ ] Export button accessible (dropdown on small screens)
- [ ] Role-based access: check if route is protected (query rules for `isAdminOfLab` requirement)

**Definition of Done:**
- [ ] Page renders without errors
- [ ] Lazy loading verified (bundle size check)
- [ ] Hub tile shows in hub page
- [ ] Breadcrumb matches convention used in other modules
- [ ] Mobile preview confirmed
- [ ] No hardcoded paths (use named routes)

**Notes:**
- Check existing pages (e.g., `LabSettingsPage`) for page shell pattern
- Hub tile icon suggestion: `ShieldCheckIcon` or `AuditIcon` (from Lucide or existing icon set)
- If role-based access is needed, coordinate with Firestore rules (RDC 978 Art. 5.3 likely admin-only)
- Lazy route should be under a Suspense boundary with fallback (check AppRouter pattern)

---

## Dependencies & Ordering

```
Graph:

Task 1.1 (List) ──┐
                  │
Task 1.2 (Chain)  ├──> Task 1.4 (Route + Hub)
                  │
Task 1.3 (Export) ┘
```

**Recommended Order:**
1. **Start Task 1.1 and 1.2 in parallel** (no cross-dependencies)
2. **Task 1.3 can start immediately** (uses callables + types, independent of 1.1/1.2 logic)
3. **Task 1.4 starts once 1.1 is 80% done** (needs components present to compose page)

**Integration Point:** Task 1.4 composes the three components into a single page. Minimal changes to individual components post-composition.

---

## Testing & Verification

### Pre-Implementation Checklist
- [ ] Read existing module patterns (e.g., `educacao-continuada`, `controle-temperatura`)
- [ ] Verify callables are deployed to staging (`functions/` built successfully)
- [ ] Smoke test callables with Firestore emulator or staging project

### Unit Tests (per task)
- [ ] Task 1.1: Hook `useGetAuditTrail` mocked callable, pagination logic
- [ ] Task 1.2: Modal open/close, validation state machine, auto-refresh logic
- [ ] Task 1.3: CSV/PDF formatters generate valid output (Jest snapshots)
- [ ] Task 1.4: Route loads, lazy import works, hub tile renders

### E2E Tests (post-integration)
- [ ] Load `/auditoria-trail` from hub tile, filters work, export downloads file
- [ ] Chain validation updates on "Verificar agora" click
- [ ] Mobile: page loads and renders on 375px viewport

### Performance Baseline
- [ ] Lighthouse LCP <2.5s, CLS <0.1, INP <200ms (main page)
- [ ] Export <5s for 100 entries, <30s for 1000 entries

---

## Sign-Off Checklist

### Before Merge
- [ ] `npm run build` passes (TypeScript + minification)
- [ ] `npm run test` passes (unit tests for tasks)
- [ ] `npm run lint` passes (ESLint, max 88 pre-existing warnings)
- [ ] Lighthouse a11y ≥90, performance ≥80
- [ ] Staging deploy: no errors in Cloud Logs

### Before Release
- [ ] Design review: UI matches Apple/Linear reference (dark, minimal, professional)
- [ ] QA sign-off: test plan executed (filter combinations, export formats, mobile)
- [ ] RDC 978 Art. 5.3 compliance check: audit trail is immutable, chain validation works
- [ ] Performance regression test: bundle size <5% increase from v1.4

---

## Known Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| `callGetAuditTrail` latency on >10k entries | Medium | Pagination (max 50/page), Firestore indexes, caching |
| CSV with 1000+ rows exceeds browser memory | Low | Batch export, stream to IndexedDB first |
| PDF generation library adds 200KB+ to bundle | Medium | Use lightweight `pdfkit` or `html2pdf`, defer if not already in bundle |
| Mobile table overflows on small screens | Low | Responsive design with horizontal scroll, collapsible columns |
| Chain validator auto-refresh misses checks (localStorage sync issues) | Low | Fallback: button always available, localStorage is best-effort |

---

## Success Metrics

By end of Feature 1 implementation:

- ✅ All 4 tasks merged and deployed to production
- ✅ Zero regressions in existing modules (test suite passes)
- ✅ Audit trail renders ≥50 entries smoothly
- ✅ Chain validation detects broken hashes correctly
- ✅ Export files are valid CSV/PDF and can be imported into analysis tools
- ✅ Mobile-responsive and WCAG AA compliant
- ✅ RDC 978 Art. 5.3 compliance validated by QA

---

## References

- Scope: [`v15-no-ui-yet-scope.md`](./v15-no-ui-yet-scope.md)
- Callables: `src/features/qualidade/services/auditCallables.ts`
- Types: `src/features/qualidade/types/auditUI.ts`
- Design tokens: `src/lib/DESIGN_SYSTEM.md` (or dark theme in Tailwind config)
- Module pattern: `src/features/educacao-continuada/` (reference implementation)
