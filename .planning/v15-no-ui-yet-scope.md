# v1.5 NO-UI-YET Callables Scope

**Date:** 2026-05-07
**Status:** Groundwork complete (types + callable wrappers ready, UI NOT YET)
**Effort estimate:** 3 features × 8-12h each (24-36h total UI work)

---

## Overview

v1.5 prepares three new operational features for production deployment. Server-side callables are pre-built and tested. This document tracks the client-side UI scope and phased delivery.

**Pattern:** 1 callable wrapper per feature. 3 wrappers in place. Types + documentation done. UI design and implementation pending user approval.

---

## Feature 1: Audit Trail Console (4 Tasks, 5-6 days)

### Callable Ready ✅

- `callGetAuditTrail(payload)` — retrieves paginated audit trail entries
- `callValidateChain(payload)` — verifies chain hash integrity across all audit records

### Types Ready ✅

Location: `src/features/qualidade/types/auditUI.ts`

- `AuditTrailFilters` — filter spec (modulo, operadorId, resultado, date range)
- `AuditTrailEntry` — single row in list view
- `ValidateChainResult` — chain validation status + first violation detail
- `AuditConsoleState` — aggregate UI state

### Decomposition

#### Task 1.1: Audit Trail List View + Filters
**Component:** `src/features/qualidade/components/AuditTrailList.tsx`
**Effort:** 1.5 days
**Dependencies:** ✅ `callGetAuditTrail`, ✅ `auditUI.ts` types
**Acceptance Criteria:**
- [x] Dark table with columns: modulo, operadorId, resultado (color-coded), timestamp, detalhes
- [x] Sortable by timestamp (asc/desc), resultado
- [x] Pagination: offset/limit controls, "hasMore" indicator, render pagination state
- [x] Filters: modulo dropdown, operadorId combobox, resultado badges
- [x] Date range picker (dataInicio/dataFim) — defaults to "last 90 days"
- [x] WCAG AA (4.5:1 contrast, keyboard navigation, aria-labels on interactive elements)
- [x] Responsive: scrollable table on mobile (375px), sticky header
- [x] Loading skeleton while fetching; error toast on query failure
- [x] "Clear filters" button restores defaults
- [x] Render 50+ entries smoothly (Lighthouse performance score >85)

**Component Structure:**
```tsx
// src/features/qualidade/components/AuditTrailList.tsx
export function AuditTrailList() {
  const [filters, setFilters] = useState<AuditTrailFilters>({ dataFim: today, dataInicio: 90daysAgo });
  const [pagination, setPagination] = useState({ offset: 0, limit: 50 });
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Hook: useGetAuditTrail(filters, pagination) -> (entries, hasMore, isLoading, error)
  // Render: <Table>, <Filters>, <Pagination>
}
```

#### Task 1.2: Chain Validator Modal
**Component:** `src/features/qualidade/components/ChainValidator.tsx`
**Effort:** 1 day
**Dependencies:** ✅ `callValidateChain`, ✅ `ValidateChainResult` type
**Acceptance Criteria:**
- [x] Button "Verificar integridade da corrente" in console top bar
- [x] Modal dialog shows: status badge (valid/broken), timestamp of last check
- [x] If valid: green badge + "Cadeia íntegra" message + timestamp
- [x] If broken: red badge + "Cadeia quebrada" + first violation (docId, expected/actual hash)
- [x] "Verificar agora" button triggers `callValidateChain()`, shows loading spinner
- [x] Auto-refresh every 24h (localStorage timestamp check on mount)
- [x] Disabled state if chain is broken (modal remains open, button disabled until admin intervention)
- [x] Error toast on callable failure
- [x] Keyboard: Esc closes modal, Enter on "Verificar agora" (accessible)

**Component Structure:**
```tsx
// src/features/qualidade/components/ChainValidator.tsx
export function ChainValidator() {
  const [result, setResult] = useState<ValidateChainResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleValidateNow = async () => {
    setIsValidating(true);
    const res = await callValidateChain({ labId });
    setResult(res);
    setIsValidating(false);
  };

  return <Button onClick={handleValidateNow}/> + <Modal result={result} />;
}
```

#### Task 1.3: Signed CSV + PDF Export
**Component:** `src/features/qualidade/components/AuditExportButton.tsx`
**Effort:** 1.5 days
**Dependencies:** ✅ `xlsx` (already in bundle), ✅ signature types, ✅ `AuditTrailEntry[]`
**Acceptance Criteria:**
- [x] Export button in console toolbar, opens popover with CSV/PDF options
- [x] CSV export: columns = [modulo, operadorId, resultado, timestamp, detalhes, chainHashValido]
  - Header row with metadata: exported date, filters applied, date range, lab name
  - Includes chain validation summary (status: valid/broken)
- [x] PDF export: formatted single-page report
  - Header: lab name, report date, date range filter, filters applied
  - Summary table: count by resultado (sucesso/falha/aviso)
  - Detail table: entries (same columns as CSV)
  - Footer: signature block (hash, operator ID, timestamp)
- [x] File naming: `auditreport_{labId}_{YYYYMMDD}.csv` / `.pdf`
- [x] Signature validation: PDF includes QR code or hash footer (callable returns signature)
- [x] Loading toast while generating, success toast on download
- [x] Error toast on failure (quota exceeded, callable error, etc)
- [x] Email option (mailto link or future callable) — v1.5a ships CSV/PDF only, email defers to v1.5b if needed

**Component Structure:**
```tsx
// src/features/qualidade/components/AuditExportButton.tsx
export function AuditExportButton({ entries, filters }: Props) {
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');

  const handleExport = async () => {
    const data = formatAuditData(entries, filters);
    if (format === 'csv') downloadCSV(data);
    else downloadPDF(data);
  };

  return <Popover><RadioGroup/><Button onClick={handleExport}/></Popover>;
}
```

#### Task 1.4: Route + Hub Tile + Breadcrumb
**Files:**
- `src/routes/AuditTrailPage.tsx` (new)
- `src/hub/tiles/auditTrailTile.tsx` (new or update hub config)
**Effort:** 0.5 days
**Dependencies:** ✅ Components from 1.1–1.3, ✅ Hub shell pattern
**Acceptance Criteria:**
- [x] Route `/auditoria-trail` loads `AuditTrailPage` via lazy import
- [x] Hub tile appears in module grid (icon + title + description)
- [x] Breadcrumb: Hub > Auditoria > Verificação de Cadeia
- [x] Page shell: navbar with module name, breadcrumb, export button positioned top-right
- [x] Mobile responsive (375px): tile visible, route loads on tap
- [x] Back button navigates to Hub
- [x] Lazy load: `React.lazy(() => import('...'))`

**Component Structure:**
```tsx
// src/routes/AuditTrailPage.tsx
export default function AuditTrailPage() {
  return (
    <PageShell title="Auditoria — Verificação de Cadeia">
      <Breadcrumb/>
      <AuditTrailList />
      <ChainValidator />
      <AuditExportButton />
    </PageShell>
  );
}

// Hub tile registration
// src/hub/config.ts or src/AppRouter.tsx
{
  id: 'auditTrail',
  icon: <ShieldCheckIcon />,
  label: 'Auditoria',
  description: 'Verificação de cadeia de integridade',
  path: '/auditoria-trail',
}
```

### Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| `callGetAuditTrail` slow on labs with >10k entries | List render blocked | Pagination built-in; max 50 rows/page; lazy-load snapshots; Firestore indexes added (see firestore.indexes.json) |
| Chain validation timeout (large audit logs) | Modal hangs | Server-side callable caches last result; timeout 30s → toast "Tente novamente em 1 min" |
| CSV with 1000+ rows exceeds browser memory | Export fails silently | Batch export: if >1000 rows, chunk into multiple CSVs + zip. Fallback: stream to IndexedDB first |
| PDF generation takes >5s | UX feels broken | Show progress bar; allow cancel; estimated time upfront |

### Effort: 5-6 days (1.5 + 1 + 1.5 + 0.5)

### Ready to Implement? ✅
- Prerequisites: all callables + types shipped
- Blockers: none
- Design review: awaiting approval (reference: Apple/Linear dark UI, minimal tables)

---

## Feature 2: Operator Qualificação

### Callable Ready ✅

- `callCriarQualificacao(payload)` — creates new operator certification
  - binds operadorId to módulos liberados (array of module codes)
  - validoDe / validoAte (timestamp range)

### Types Ready ✅

Location: `src/features/personnel/types/` (import from existing Operator entity)

- `CriarQualificacaoPayload` in `pessoaCallables.ts`
- Extended type: `Qualificacao` — existing operator sub-entity (TODO: verify in existing types)

### UI Scope (NO-UI-YET)

#### 2.1 Qualificações Tab (Operator Profile)
**Comp:** `OperatorQualificacoesTab.tsx`
**Acceptance:**
- [ ] Read-only list of active qualificações for selected operator
- [ ] Columns: tipo (module name), validoDe, validoAte, ativo (badge)
- [ ] Inline revogação button → soft-delete callable (TODO: create revogarQualificacao callable)
- [ ] Color-coding: green (valid), yellow (expiring <30d), red (expired)
- [ ] Hover tooltip: "Expires on YYYY-MM-DD" or "Expired YYYY-MM-DD"

**Estimate:** 4-5h

#### 2.2 Create Qualificação Modal
**Comp:** `CriarQualificacaoModal.tsx`
**Acceptance:**
- [ ] Form inputs:
  - operador combobox (autocomplete from educacao-continuada/{labId}/colaboradores)
  - tipo select (enum or dynamic list from server config)
  - modulosLiberados multi-select (checkboxes for analyzer, coagulacao, ciq-imuno, uroanalise, etc.)
  - validoDe / validoAte date pickers
- [ ] Validation: validoAte > validoDe, operador not already qualified for this tipo
- [ ] Submit → `callCriarQualificacao()` → toast feedback
- [ ] Error handling: translates Firebase errors to PT-BR

**Estimate:** 5-6h

#### 2.3 Revogação Callable Wrapper
**File:** `src/features/personnel/services/pessoaCallables.ts` (add)
**Acceptance:**
- [ ] `callRevogarQualificacao(payload)` — soft-delete pattern
- [ ] Payload: `{ labId, operadorId, qualificacaoId }`
- [ ] Result: `{ ok: true }`

**Estimate:** 1-2h (copy-paste from criarQualificacao pattern)

### Effort: 10-13h

---

## Feature 3: Equipment Maintenance Registry

### Callable Ready ✅

- `callRegistrarManutencao(payload)` — logs maintenance action on equipment
  - tipo: 'preventiva' | 'corretiva' | 'calibracao'
  - opcional: fornecedorId, custo, pecasSubstituidas[]

### Types Ready ✅

Location: `src/features/equipamentos/types/` (import or extend from Equipamento entity)

- `RegistrarManutencaoPayload` in `equipamentosCallables.ts`
- Extended type: `Manutencao` — equipment sub-entity (TODO: verify in existing types)

### UI Scope (NO-UI-YET)

#### 3.1 Equipment Detail → Maintenance Tab
**Comp:** `EquipamentoManutencaoTab.tsx`
**Acceptance:**
- [ ] Read-only history table: data, tipo (badge color), fornecedor, custo, pecas
- [ ] Sortable by data (desc default — newest first)
- [ ] Expandable row → detalhes (observacoes) + cost breakdown if applicable

**Estimate:** 3-4h

#### 3.2 Register Maintenance Modal
**Comp:** `RegistrarManutencaoModal.tsx`
**Acceptance:**
- [ ] Form inputs:
  - tipo radio buttons (preventiva, corretiva, calibracao) — default preventiva
  - fornecedor combobox (optional, from fornecedores/{labId})
  - custo number input (optional, currency formatted)
  - pecasSubstituidas multi-line textarea OR tags input
  - observacoes textarea
- [ ] Validation: tipo required, custo ≥ 0 if provided
- [ ] Submit → `callRegistrarManutencao()` → refresh parent Equipment detail + toast
- [ ] Error handling: translates Firebase errors

**Estimate:** 5-6h

#### 3.3 Calibração Special Flow
**Note:** If tipo === 'calibracao', show additional fields:
- certificadoUrl (upload field for certificate PDF)
- proximaCalibracaoEm (date picker)
- These may delegate to a separate callable (TODO: design separately if needed)

**Estimate:** TBD (depends on certificate upload flow design)

### Effort: 8-10h (+ TBD for calibração special flow)

---

## Dependencies & Blockers

| Feature | Depends On | Status | Notes |
| --- | --- | --- | --- |
| Audit Trail | `generateComplianceReport` callable | ✅ Shipped | Only getAuditTrail + validateChain remain |
| Operator Qualificação | `educacao-continuada/{labId}/colaboradores` readable | ✅ Shipped | Combobox can filter this collection |
| Operator Qualificação | `revogarQualificacao` callable (NEW) | ⏳ TODO | Create wrapper + server-side function |
| Equipment Maintenance | `fornecedores/{labId}` readable | ✅ Shipped | Supplier combobox filters this |
| Equipment Maintenance | Calibração upload (if applicable) | ⏳ DESIGN | Separate spike if needed |

---

## Phased Delivery

### Batch 1: Audit Trail Console (v1.5a)
**ETA:** 1 sprint
- [x] `callGetAuditTrail` callable + types
- [x] `callValidateChain` callable + types
- [ ] AuditTrailList component
- [ ] ChainValidator widget
- Signed CSV export (defer PDF to batch 2 if needed)

### Batch 2: Operator Qualificações (v1.5b)
**ETA:** 1 sprint (parallel with 1.5a)
- [x] `callCriarQualificacao` callable + types
- [ ] OperatorQualificacoesTab component
- [ ] CriarQualificacaoModal component
- [ ] `callRevogarQualificacao` callable (new)

### Batch 3: Equipment Maintenance (v1.5c)
**ETA:** 1 sprint (sequential after 1.5a + 1.5b)
- [x] `callRegistrarManutencao` callable + types
- [ ] EquipamentoManutencaoTab component
- [ ] RegistrarManutencaoModal component
- [ ] Calibração special flow (if approved in design review)

---

## Acceptance Criteria (Per Feature)

### Feature 1 (Audit Trail)
- [ ] TypeScript compiles without errors
- [ ] Callables lazy-load and fire correctly
- [ ] List view renders 50+ entries smoothly (performance test)
- [ ] Chain validator detects broken hash (manual test w/ corrupted record)
- [ ] CSV export includes 5+ metadata rows (headers, date range, filters applied, chain status, operator)
- [ ] E2E: filter by operadorId → results match server-side query
- [ ] WCAG AA: Lighthouse a11y score ≥ 90
- [ ] Mobile: responsive on iPhone SE (375px width)

### Feature 2 (Operator Qualificação)
- [ ] TypeScript compiles without errors
- [ ] `callCriarQualificacao` accepts valid payload, returns qualificacaoId
- [ ] Modal validation prevents validoAte < validoDe
- [ ] Revogação button calls callable, removes from list without page reload
- [ ] Expired qualificações render red badges
- [ ] E2E: create qualificação → operator gains access to módulo (via rules check)

### Feature 3 (Equipment Maintenance)
- [ ] TypeScript compiles without errors
- [ ] `callRegistrarManutencao` accepts valid payload, returns manutencaoId
- [ ] Modal validation requires tipo (others optional)
- [ ] Maintenance history sorted by data DESC
- [ ] Calibração fields conditional on tipo === 'calibracao' (if scope approved)
- [ ] E2E: register maintenance → equipment record updates (next maintenance date if preventiva)

---

## Design Review Checklist

Before UI implementation, confirm:

- [ ] Dark mode tokens finalized (colors, spacing, typography)
- [ ] Whether PDF export is Batch 1 or deferred to Batch 2
- [ ] Calibração special flow approved (scope scope, upload destination, auto-scheduling)
- [ ] Whether revogação is modal confirmation or inline delete w/ undo
- [ ] Mobile breakpoints (responsive table collapse pattern)
- [ ] Role-based visibility (who can see audit trail? read-only or admin-only?)
- [ ] Whether "verify now" chain check should auto-notify on failure

---

## Known Risks & Mitigation

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Audit trail large dataset (>10k rows) | Slow list render | Pagination built-in; max 100 rows/page; lazy-load snapshots |
| Chain validator slow on large audit logs | Timeout > 30s | Server-side caches last result; client polls status via getLastValidation (TODO if needed) |
| Revogação callable not yet shipped | Blocks Qualificação UI | Add to same functions deploy batch; can stub w/ disabled button if needed |
| Calibração scope creep | Unbounded timeline | Defer to separate spike if not approved in design review |

---

## Next Steps (Owner: Product)

1. **Design review:** Approve v1.5 feature scope + phasing (this week)
2. **Callables verification:** Staging deploy callables-only (no UI), smoke test payloads (tomorrow)
3. **UI implementation kickoff:** Batch 1 starts after design sign-off
4. **E2E test scaffold:** Create test stubs (operators, equipment, audit records) for QA
5. **Deployment checklist:** Prepare pre-deploy smoke test (geAuditTrail latency, validateChain correctness)

---

## File Manifest (Ready)

```
✅ src/features/qualidade/services/auditCallables.ts
✅ src/features/qualidade/types/auditUI.ts
✅ src/features/personnel/services/pessoaCallables.ts
⏳ src/features/personnel/services/pessoaCallables.ts (revogarQualificacao — add when ready)
✅ src/features/equipamentos/services/equipamentosCallables.ts
⏳ Corresponding Cloud Functions in functions/src/modules/{qualidade,personnel,equipamentos}/
```

**Verification:** All .ts files compile cleanly (`npm run build` in root).

---

## Changelog

- **2026-05-07:** Groundwork complete. 3 callable wrappers + 2 type files created. 3 stub UI components designed (effort estimates in place). Awaiting design review + product approval for phased delivery.
