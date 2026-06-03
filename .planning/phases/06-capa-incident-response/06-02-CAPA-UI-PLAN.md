---
phase: '06-capa-incident-response'
plan: '02'
type: 'execute'
wave: 2
depends_on: ['06-01']
files_modified:
  - 'src/features/sgq/capa/hooks/useCAPAList.ts'
  - 'src/features/sgq/capa/hooks/useCAPADetail.ts'
  - 'src/features/sgq/capa/components/CAPAListView.tsx'
  - 'src/features/sgq/capa/components/CAPADetailView.tsx'
  - 'src/features/sgq/capa/components/CAPAForm.tsx'
  - 'src/features/sgq/capa/components/ActionCard.tsx'
  - 'src/features/sgq/capa/components/VerificationForm.tsx'
  - 'src/features/sgq/capa/pages/CAPAHome.tsx'
  - 'src/routes.tsx'

autonomous: false
requirements: ['RDC-978-ART-99', 'DICQ-4.14.2', 'WCAG-AA']

must_haves:
  truths:
    - 'User can navigate to /capa and see list of all CAPAs (filtered by status: aberta/em-tratamento/verificada/fechada)'
    - 'User can click CAPA to view details: finding, assigned actions, verification history, audit trail'
    - 'RT can create new CAPA via form: titulo, descricao, prioridade, dataPrazo'
    - 'RT can assign corrective actions to users with dueDate and evidence tracking'
    - 'RT can verify actions after completion (efetiva/não-efetiva) and auto-close if verified'
    - 'All state changes appear in audit trail visible on detail page'
    - 'Dark-first UI (Tailwind dark mode) with accessible buttons, forms, tables'
    - 'WCAG AA compliance: contrast ≥4.5:1, focus visible, keyboard navigation functional'

  artifacts:
    - path: 'src/features/sgq/capa/hooks/useCAPAList.ts'
      provides: 'Hook for listing CAPAs with filtering (status, assignee)'
      exports: ['useCAPAList']
      uses_subscribe: true

    - path: 'src/features/sgq/capa/hooks/useCAPADetail.ts'
      provides: 'Hook for loading single CAPA + subcollections (actions, verifications) with realtime updates'
      exports: ['useCAPADetail']

    - path: 'src/features/sgq/capa/components/CAPAListView.tsx'
      provides: 'Table view of all CAPAs with status badges, due dates, assignee names; sortable by status/due date'
      contains: 'export default CAPAListView'
      world_class: true

    - path: 'src/features/sgq/capa/components/CAPADetailView.tsx'
      provides: 'Detail page: finding summary, actions section, verification section, audit trail history'
      contains: 'export default CAPADetailView'

    - path: 'src/features/sgq/capa/components/CAPAForm.tsx'
      provides: 'Modal/drawer form for RT to create new CAPA with validation'
      exports: ['CAPAForm']

    - path: 'src/features/sgq/capa/components/ActionCard.tsx'
      provides: 'Card component for single CAPA action with status, assignee, due date, evidence links'
      exports: ['ActionCard']

    - path: 'src/features/sgq/capa/components/VerificationForm.tsx'
      provides: 'Form for RT to submit verification (resultado, notas, evidencia links)'
      exports: ['VerificationForm']

    - path: 'src/features/sgq/capa/pages/CAPAHome.tsx'
      provides: 'Top-level page for CAPA module: list view + create button + filters'
      contains: 'export default CAPAHome'

    - path: 'src/routes.tsx'
      provides: 'Routes definition for /capa and /capa/:capaId'
      must_contain: "path: '/capa'"

  key_links:
    - from: 'src/features/sgq/capa/pages/CAPAHome.tsx'
      to: 'src/features/sgq/capa/components/CAPAListView.tsx'
      via: 'useCAPAList hook invocation'
      pattern: 'useCAPAList'

    - from: 'src/features/sgq/capa/components/CAPAListView.tsx'
      to: 'src/features/sgq/capa/components/CAPADetailView.tsx'
      via: 'Click CAPA row → navigate to /capa/{capaId}'
      pattern: 'navigate.*capaId'

    - from: 'src/features/sgq/capa/components/CAPADetailView.tsx'
      to: 'src/features/sgq/capa/services/capaService.ts'
      via: 'Calls updateCAPAStatus, assignCAPA, verifyCAPA from service'
      pattern: "capaService\\.(update|assign|verify)"
---

<objective>
Build dark-first, world-class UI for CAPA lifecycle management. Users can create CAPAs, assign actions, verify completion, and review audit trail. WCAG AA compliant with no accessibility violations.

**Purpose:** Operationalize CAPA tracking for lab operators and RT. Must integrate with 06-01 schema/callables seamlessly.

**Output:**

- List view (filterable, sortable, real-time)
- Detail view with action cards + verification form
- Create CAPA form with validation
- Audit trail display on detail page
- Dark-first design matching v1.3 conventions (Apple/Linear reference)
- WCAG AA compliance verified
  </objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06/06-RESEARCH.md
@.planning/phases/06-capa-incident-response/06-01-CAPA-SCHEMA-PLAN.md

# Design system reference

- Dark-first theme: bg-[#141417], text-white/90, accents violet-500 + emerald-500
- Typography: Geist Sans (or system sans-serif), kerning intentional
- Spacing: 4px grid (p-1, p-2, p-4, p-6, p-8)
- Form validation: error states with border-red-500, hint text
- Buttons: primary (violet-600 hover:violet-700), secondary (white/10), danger (red-600)

# WCAG AA targets

- Text contrast: 4.5:1 normal text, 3:1 large text (18pt+)
- Focus visible on all interactive elements
- Keyboard navigation: Tab + Enter sufficient to operate all features
- Color not sole means of conveying info (status uses icon + color + text label)
  </context>

<tasks>

<task type="auto">
  <name>Task 1: Build custom hooks for CAPA list + detail with real-time subscriptions</name>
  <files>src/features/sgq/capa/hooks/useCAPAList.ts, src/features/sgq/capa/hooks/useCAPADetail.ts</files>
  <action>
**useCAPAList hook:**
```typescript
export function useCAPAList(labId: string, options?: {status?: string; assigneeId?: string}) {
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
// Subscribe to CAPAs via service
const unsubscribe = subscribeCAPAs(labId, options).on(
(data) => {
setCapas(data);
setLoading(false);
},
(err) => {
setError(err.message);
setLoading(false);
}
);

    return () => unsubscribe();

}, [labId, options]);

return { capas, loading, error };
}

````

Features:
- Filters by status and/or assigneeId (optional)
- Real-time updates via onSnapshot
- Error handling + loading state
- Cleanup unsubscribe on unmount

**useCAPADetail hook:**
```typescript
export function useCAPADetail(labId: string, capaId: string) {
  const [capa, setCapa] = useState<CAPA | null>(null);
  const [acoes, setAcoes] = useState<CAPAAcao[]>([]);
  const [verificacoes, setVerificacoes] = useState<Verificacao[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch root doc + subcollections in parallel
    const tasks = [
      getCAPA(labId, capaId).then(setCapa),
      subscribeAcoes(labId, capaId).on((data) => setAcoes(data)),
      subscribeVerificacoes(labId, capaId).on((data) => setVerificacoes(data)),
      subscribeAuditTrail(labId, `capa/${capaId}`).on((data) => setAuditTrail(data)),
    ];

    Promise.all(tasks).then(() => setLoading(false)).catch(console.error);

    return () => {
      // Cleanup all subscriptions
    };
  }, [labId, capaId]);

  return { capa, acoes, verificacoes, auditTrail, loading };
}
````

Per project conventions:

- Use existing capaService for all calls (no direct Firestore)
- Cleanup on unmount (return unsubscribe from useEffect)
- Error state optional (details page will show error boundary)
  </action>
  <verify>
  <automated>npm run build -- src/features/sgq/capa/hooks/\*.ts && grep -c "export function use" src/features/sgq/capa/hooks/useCAPAList.ts</automated>
  </verify>
  <done>Both hooks export, subscribe functions integrated, cleanup handlers present</done>
  </task>

<task type="auto">
  <name>Task 2: Implement CAPAListView component (table with filters, sorting, dark-first design)</name>
  <files>src/features/sgq/capa/components/CAPAListView.tsx</files>
  <action>
Build world-class table component per design system:

**Layout:**

- Header: "CAPA Management" title + "Create CAPA" button (violet-600)
- Filter bar: dropdown (status), dropdown (assignee), button (clear filters)
- Table: columns [ID, Titulo, Status, Assignee, Prazo, Actions]

**Styling (dark-first):**

- Header: bg-[#141417], text-white/90, border-b border-white/10
- Table rows: bg-white/[0.02], hover:bg-white/[0.04], no background flickering
- Status badge: icon + text (aberta=red, em-tratamento=yellow, verificada=blue, fechada=green)
- Links (ID, Titulo): violet-500, hover:violet-400, underline on hover
- Contrast check: badge text ≥4.5:1 against background

**Functionality:**

1. Load CAPAs via useCAPAList hook
2. Render loading spinner (or skeleton row)
3. Table rows click → navigate to /capa/{capaId}
4. Status filter updates hook options → real-time re-fetch
5. Sorting: click column header (only Prazo, Status) → local sort state

**Accessibility (WCAG AA):**

- `<table>` with `<th scope="col">` headers
- Focus ring visible on all interactive elements (focus:ring-2 ring-violet-500)
- Alt text on status badges (e.g., aria-label="Status: aberta (open)")
- Keyboard navigation: Tab through rows + buttons, Enter to open detail
- No color-only status indication (icon + text + color)

**Example markup:**

```tsx
<div className="flex flex-col gap-4 p-6 bg-[#141417]">
  <h1 className="text-2xl font-semibold text-white">CAPA Management</h1>

  <div className="flex gap-2">
    <select
      value={filters.status}
      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
      className="px-3 py-2 bg-white/5 text-white border border-white/10 rounded"
    >
      <option value="">All statuses</option>
      <option value="aberta">Open</option>
      <option value="em-tratamento">In Treatment</option>
      {/* ... */}
    </select>

    <button
      onClick={() => navigate('/capa/create')}
      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded focus:ring-2 ring-offset-2"
    >
      Create CAPA
    </button>
  </div>

  <table className="w-full border-collapse">
    <thead>
      <tr className="border-b border-white/10">
        <th scope="col" className="text-left p-3 font-semibold text-white/70">
          ID
        </th>
        <th scope="col" className="text-left p-3 font-semibold text-white/70">
          Title
        </th>
        <th scope="col" className="text-left p-3 font-semibold text-white/70">
          Status
        </th>
        {/* ... */}
      </tr>
    </thead>
    <tbody>
      {capas.map((capa) => (
        <tr key={capa.id} className="border-b border-white/[0.05] hover:bg-white/[0.04]">
          <td className="p-3">
            <Link
              to={`/capa/${capa.id}`}
              className="text-violet-500 hover:text-violet-400 underline focus:ring-2 ring-violet-500"
            >
              {capa.id.slice(-4)}
            </Link>
          </td>
          <td className="p-3 text-white/90">{capa.titulo}</td>
          <td className="p-3">
            <StatusBadge status={capa.status} />
          </td>
          {/* ... */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Error/Loading states:**

- Loading: show 5 skeleton rows (Skeleton component from common)
- Error: show error alert with "Retry" button
- Empty: "No CAPAs. Create one to get started."
  </action>
  <verify>
  <automated>npm run build -- src/features/sgq/capa/components/CAPAListView.tsx && grep -c "export default" src/features/sgq/capa/components/CAPAListView.tsx</automated>
  </verify>
  <done>Component renders, dark-first styling applied, accessibility attributes present</done>
  </task>

<task type="auto">
  <name>Task 3: Implement CAPADetailView with actions section, verification form, audit trail</name>
  <files>src/features/sgq/capa/components/CAPADetailView.tsx, src/features/sgq/capa/components/ActionCard.tsx, src/features/sgq/capa/components/VerificationForm.tsx</files>
  <action>
**CAPADetailView structure:**

```
┌─────────────────────────────────────────┐
│ CAPA Detail: [ID] [Status Badge]        │
├─────────────────────────────────────────┤
│ Finding Summary                         │
│ ─ Titulo, Descricao                     │
│ ─ Created by: [Operator], [Date]        │
│ ─ Priority: [1-5], Due: [Date]          │
│                                         │
│ Actions Section                         │
│ ┌─ Action 1: Corretiva                 │
│ │  Assigned to: [User], Due: [Date]   │
│ │  Status: [aberta/concluida]          │
│ │  Evidence: [Link] [Link]             │
│ │  [Edit] [Mark Complete]              │
│ └─────────────────────────────────────│
│ ┌─ [+ Add Action] button              │
│ └─────────────────────────────────────│
│                                         │
│ Verification Section (if actions done) │
│ ┌─ VerificationForm                   │
│ │  Resultado: [efetiva/não-efetiva]   │
│ │  Notes: [textarea]                   │
│ │  [Submit Verification]               │
│ └─────────────────────────────────────│
│                                         │
│ Audit Trail                            │
│ ├─ 2026-05-08 10:15 — CAPA criada    │
│ ├─ 2026-05-08 10:20 — ação criada    │
│ └─ [Show more...]                      │
└─────────────────────────────────────────┘
```

**CAPADetailView.tsx:**

- Load via useCAPADetail hook
- Display finding summary (titulo, descricao, createdBy, priority, dataPrazo)
- Render list of ActionCards (map acoes)
- Show VerificationForm if any action is completed
- Render audit trail (last 10 entries, collapsible "show more")
- Status transitions via button (if RT: "Mark Complete", "Close CAPA")

**ActionCard.tsx:**

- Display single acao with tipo badge (corretiva/preventiva)
- Show assignee name, due date
- Show status badge (aberta/concluida/vencida)
- Evidence links (render as pill buttons)
- If assignee === current user: "Mark Complete" button
- If RT and action complete: allow verification

**VerificationForm.tsx:**

- Dropdown: resultado (efetiva/não-efetiva/parcialmente-efetiva)
- Textarea: notas
- File upload area: evidence (links to drive/S3)
- "Submit Verification" button
- On submit, call capaService.verifyCAPA()
- Success message + auto-close CAPA if efetiva

**Dark-first styling:**

- Card: bg-white/[0.02], border border-white/10, p-4
- Buttons: primary (violet), secondary (white/10), danger (red-600)
- Typography: heading-3 (18pt), body (14pt), caption (12pt/white-70)
- Spacing: consistent 4px grid

**Accessibility:**

- Headings hierarchy (h1 → h3)
- Form fields have labels + aria-describedby
- Buttons have aria-label if icon-only
- Focus rings visible (ring-2 ring-offset-2)
- Keyboard: Tab navigation functional, Enter submits forms
  </action>
  <verify>
  <automated>npm run build -- src/features/sgq/capa/components/CAPADetailView.tsx src/features/sgq/capa/components/ActionCard.tsx src/features/sgq/capa/components/VerificationForm.tsx && grep -c "export" src/features/sgq/capa/components/ActionCard.tsx</automated>
  </verify>
  <done>All 3 components render, dark-first styles applied, form integration working</done>
  </task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
  - CAPA list view with filters and real-time updates
  - CAPA detail view with action cards and verification form
  - Dark-first UI using Tailwind (bg-[#141417], text-white/90, violet accents)
  - WCAG AA accessibility: focus rings, keyboard nav, semantic HTML
  - Integration with 06-01 service layer and Cloud Functions
  </what-built>
  <how-to-verify>
  1. Visit http://localhost:5173/capa after deploying locally
  2. Verify list view loads (show spinner while fetching)
  3. Create a test CAPA via form (fill titulo, descricao, prioridade, dataPrazo)
  4. Click CAPA to open detail view
  5. Verify finding summary, action cards, audit trail visible
  6. Assign an action to yourself (fill responsavel, due date)
  7. Mark action complete and submit verification (resultado=efetiva)
  8. Verify CAPA status changed to "fechada"
  9. Check audit trail shows all state changes
  10. Test keyboard navigation: Tab through all buttons, Enter to activate
  11. Inspect contrast: text ≥4.5:1 (use Chrome DevTools)
  12. Check focus rings visible on all interactive elements
  </how-to-verify>
  <resume-signal>Type "approved" if all checks pass, or describe any issues</resume-signal>
</task>

<task type="auto">
  <name>Task 4: Wire CAPA routes and integrate into main navigation</name>
  <files>src/features/sgq/capa/pages/CAPAHome.tsx, src/routes.tsx</files>
  <action>
**CAPAHome.tsx (top-level page):**
```typescript
export default function CAPAHome() {
  const { labId } = useLabContext();
  const { capas, loading } = useCAPAList(labId);

return (
<div className="min-h-screen bg-[#141417] text-white p-6">
<CAPAListView />
</div>
);
}

````

**Update src/routes.tsx:**
Add route definitions (use existing router config pattern from other modules):
```typescript
{
  path: '/capa',
  element: <CAPAHome />,
  children: [
    {
      path: ':capaId',
      element: <CAPADetailView />,
    },
    {
      path: 'create',
      element: <CAPAForm onSuccess={(id) => navigate(`/capa/${id}`)} />,
    },
  ],
}
````

**Integration into hub/navigation:**

- Add "CAPA" tile to /hub module list (if hub exists; link to /capa)
- Add CAPA to SGQ sidebar (if sidebar exists)

**Test:**

```bash
npm run dev
# Navigate to http://localhost:5173/capa
# Verify routes load correctly
```

  </action>
  <verify>
    <automated>grep -c "path: '/capa'" src/routes.tsx && npm run build 2>&1 | grep -i "error" | grep -v "node_modules" || echo "no errors"</automated>
  </verify>
  <done>Routes defined, no build errors, /capa accessible</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary               | Description                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| User input (form)      | CAPA form accepts user title, description, priority; must validate server-side via callable |
| CAPA state display     | Detail view renders current CAPA status; updates real-time via subscription                 |
| Audit trail visibility | Audit entries are read-only on client; Rules enforce read permission (RT/admin only)        |

## STRIDE Threat Register

| Threat ID | Category               | Component                         | Disposition | Mitigation Plan                                                                             |
| --------- | ---------------------- | --------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| T-06-07   | Tampering              | UI modifies CAPA directly         | mitigate    | All form submissions go through service → callable; client cannot write to Firestore        |
| T-06-08   | Information Disclosure | Non-RT user views all CAPAs       | mitigate    | Rules filter query results by role; list view only shows CAPAs visible to user              |
| T-06-09   | Elevation of Privilege | Regular user assigns CAPA to self | mitigate    | Callable validates assignee role; only RT can assign; UI disables button for non-RT         |
| T-06-10   | Denial of Service      | User spams "Create CAPA"          | mitigate    | Cloud Function rate limiting (future); UI shows "creating..." state to prevent double-click |

</threat_model>

<verification>
**Phase Gate (before moving to 06-03 Incident Response):**

1. All components build without TS errors

   ```bash
   npm run build -- src/features/sgq/capa
   ```

2. List view loads and displays CAPAs

   ```bash
   npm run dev
   # Navigate to /capa, verify table renders
   ```

3. Detail view loads CAPA + actions + verifications

   ```bash
   # Click CAPA from list, verify detail page loads all sections
   ```

4. Forms submit correctly (no client-side Firestore write attempts)

   ```bash
   # Submit CAPA form, check Cloud Functions logs show createCAPA called
   ```

5. Keyboard navigation functional (Tab + Enter)

   ```bash
   # Tab through list, open detail, Tab through buttons, press Enter
   ```

6. Contrast ≥4.5:1 (Chrome DevTools Accessibility panel)

   ```bash
   # Right-click element, Inspect, go to Accessibility panel, check contrast
   ```

7. Focus rings visible on all interactive elements
   ```bash
   # Press Tab, verify ring-2 ring-violet-500 visible
   ```

**Success:** All checks green. Ready for 06-03 Incident Response plan.
</verification>

<success_criteria>

- All 8 React components render without errors
- List view shows all CAPAs with real-time updates (filter by status working)
- Detail view displays finding, actions, verification form, audit trail
- Forms integrate with service layer (no direct Firestore writes)
- Dark-first design applied consistently (bg-[#141417], violet accents)
- WCAG AA compliance: contrast ≥4.5:1, focus rings visible, keyboard navigation functional
- Routes wired and accessible (/capa, /capa/{capaId}, /capa/create)
- No build errors, no TS errors
- Checkpoint approval required before proceeding to 06-03
  </success_criteria>

<output>
After completion, create `.planning/phases/06-capa-incident-response/06-02-PLAN-SUMMARY.md` documenting:
- Component hierarchy and data flow
- Dark-first design decisions and token usage
- Accessibility compliance checklist (WCAG AA)
- Real-time subscription patterns and cleanup
</output>
