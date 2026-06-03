---
stream: C
phase: 2
title: Batch 1/2 Hardening & Performance Audit
duration: 4-6 weeks
status: in-progress
created: 2026-05-05
---

# Stream C: Live Module Audit + Optimization

**Goal:** Stabilize Batch 1/2 (5 modules live). Zero regressions. Sub-100ms critical paths. Lighthouse >85.

---

## Module Inventory (Live)

| Module          | Status | Last Commit | Type           |
| --------------- | ------ | ----------- | -------------- |
| POPs (sgq)      | Live   | 2026-05-03  | Quality system |
| NC+CAPA (sgq)   | Live   | 2026-05-03  | Quality system |
| Auditoria (sgq) | Live   | 2026-05-03  | Quality system |
| Treinamentos    | Live   | 2026-05-04  | HR             |
| Biosseguranca   | Live   | 2026-05-04  | Infrastructure |

---

## Phase 1: Bundle & Build Analysis (Week 1)

### 1.1 Current Metrics

- [ ] Measure main bundle size (current: 1,043 KB gzip)
- [ ] Identify largest dependencies:
  - `xlsx`: used in educacao-continuada + controle-temperatura (dynamic + static conflict)
  - `pdf.worker`: 2,186 KB (check if lazy-loadable)
  - React + vendor chunks
- [ ] Check code-splitting effectiveness
- [ ] Measure build time (baseline)

### 1.2 Identify High-Impact Fixes

- [ ] **xlsx conflict:** Replace dynamic import in one module, verify both work
- [ ] **pdf.worker:** Lazy-load only when PDF viewer opened
- [ ] **Chunk splitting:** Separate vendor, UI, services into proper chunks
- [ ] **Tailwind:** Check for unused classes, enable `content` purging

**Target:** Reduce to <800 KB gzip

---

## Phase 2: Runtime Performance (Week 2-3)

### 2.1 Web Vitals Baseline

Run on production (hmatologia2.web.app):

- [ ] **LCP (Largest Contentful Paint):** Target <2.5s
  - Measure on each module landing page
  - Check if Firestore auth blocking initial load
  - Profile image/font loading
- [ ] **INP (Interaction to Next Paint):** Target <200ms
  - Test list render performance (POPs list, NC list, etc)
  - Check for janky animations
  - Profile React re-renders with DevTools Profiler
- [ ] **CLS (Cumulative Layout Shift):** Target <0.1
  - Check for skeleton vs content swaps
  - Verify skeleton dimensions match content

### 2.2 Firebase Performance

- [ ] **Firestore query latency:** Target <500ms P95
  - Profile each module's subscription queries
  - Identify missing indexes:
    - POPs: `where('deletadoEm', '==', null) + where('labId', '==', X)`
    - NC: `where('status', 'in', [...]) + where('labId', '==', X)`
    - Auditoria: `where('labId', '==', X) + orderBy('data', 'desc')`
    - Treinamentos: `where('labId', '==', X) + where('operadorId', '==', Y)`
    - Biosseguranca: `where('areaId', '==', Z) + orderBy('data', 'desc')`
  - Create missing indexes in Firestore console
  - Measure before/after

- [ ] **Auth latency:** Target <1s
  - Check if `onAuthStateChanged` blocking render
  - Verify token refresh doesn't cause stalls

### 2.3 React Component Performance

- [ ] Profile top 5 slowest renders (DevTools Profiler)
  - POPsList, NCList, AuditoriaChecklist, TrainingAssignmentUI
- [ ] Identify unnecessary re-renders
  - Check if hooks use stale dependencies
  - Verify `onSnapshot` cleanup (unsubscribe called)
- [ ] Apply optimizations:
  - `React.memo` on list items
  - `useMemo` on heavy computations
  - `useCallback` on event handlers passed to children

---

## Phase 3: Firestore Indexing (Week 3-4)

### 3.1 Current Indexes

Audit existing rules + queries:

```bash
firebase firestore:indexes --project hmatologia2
```

### 3.2 Required Indexes (Create if missing)

| Collection              | Query                                | Composite Index |
| ----------------------- | ------------------------------------ | --------------- |
| pops                    | `labId + deletadoEm + criadoEm DESC` | Yes             |
| naoConformidades        | `labId + status + criadoEm DESC`     | Yes             |
| auditorias              | `labId + criadoEm DESC`              | Yes             |
| treinamentos            | `labId + operadorId + data DESC`     | Yes             |
| biosseguranca-inspecoes | `areaId + data DESC`                 | Yes             |

Create indexes:

```bash
firebase firestore:indexes --indexes=<FILE> --project hmatologia2
```

### 3.3 Query Optimization

- [ ] Profile each service's subscription queries
- [ ] Add `limit(100)` to list queries to prevent overloading
- [ ] Use `orderBy('criadoEm', 'desc')` + pagination for large sets
- [ ] Check if `onSnapshot` is properly cleaned up in useEffect

---

## Phase 4: Monitoring & Alerts (Week 4-5)

### 4.1 Setup

- [ ] Enable Firebase Performance Monitoring
- [ ] Add custom traces:
  - `pops_list_load` - time to render POPs list
  - `nc_open_dialog` - time to open NC form
  - `audit_checklist_render` - time to render audit checklist
- [ ] Set alert thresholds:
  - LCP > 3s → alert
  - INP > 300ms → alert
  - Firestore query > 1s → alert

### 4.2 Logging

- [ ] Add structured logging for critical operations:
  - Firestore queries (collection, where clauses, result count, latency)
  - Auth state changes
  - Error rates per module
- [ ] Dashboard: real-time view of key metrics

---

## Phase 5: Documentation & Optimization Patterns (Week 5-6)

### 5.1 Create Learned Patterns Document

```
docs/PERFORMANCE_PATTERNS.md
```

Document:

- Which queries need indexes and why
- Common bottlenecks (Firestore delays, React re-renders, bundle size)
- Optimization recipes for common patterns
- Web Vitals targets per page type

### 5.2 Update Module Guidelines

- [ ] `.claude/rules/performance.md` - rules for future modules
  - Query patterns (with indexes)
  - Component memo guidelines
  - Bundle size targets per feature
  - Web Vitals gates before deploy

### 5.3 Regression Testing

- [ ] Create Lighthouse CI gate (pass/fail on deploy)
- [ ] Smoke test suite for performance regressions
- [ ] Automated alerts on performance dips

---

## Success Criteria

- ✅ Main bundle <800 KB gzip
- ✅ LCP <2.5s on all module landing pages
- ✅ INP <200ms on interactive operations
- ✅ CLS <0.1 (no layout shifts)
- ✅ Firestore queries <500ms P95
- ✅ Zero critical performance regressions
- ✅ All missing indexes created + verified
- ✅ Performance monitoring live
- ✅ PERFORMANCE_PATTERNS.md documented

---

## Tools Needed

- [ ] Lighthouse CI (`npm install -g @lhci/cli`)
- [ ] React DevTools Profiler
- [ ] Firebase Performance Monitoring
- [ ] Chrome DevTools Network/Performance tabs

---

## Weekly Checkpoints

| Week | Deliverable                     | Gate               |
| ---- | ------------------------------- | ------------------ |
| W1   | Bundle analysis + fixes         | <800 KB gzip       |
| W2   | Web Vitals baseline + profile   | LCP <3s            |
| W3   | Firebase indexing complete      | P95 queries <500ms |
| W4   | Monitoring live + dashboards    | Alerts configured  |
| W5-6 | Patterns doc + regression tests | All gates passing  |

---

**Owner:** Stream C Agent  
**Start Date:** 2026-05-05  
**Target Completion:** 2026-06-14 (6 weeks)
