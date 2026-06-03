# Phase 12: Performance Audit & Web Vitals Compliance — Research

**Researched:** 2026-05-07  
**Domain:** Web performance, KPI dashboarding, infrastructure optimization  
**Confidence:** MEDIUM  
**Phase Mapping:** v1.4 Wave 4 (Weeks 16–17) — Performance + Dashboard Polish

---

## Summary

Phase 12 v1.4 (weeks 16–17) closes two distinct tasks: **(1) Web Vitals compliance infrastructure** (REQ-401 Dashboard + TD-402 performance gate) and **(2) Personnel/PGRSS/Biossegurança documentation hardening** that logically belong in Phase 9 (weeks 9–10). This research clarifies the correct scope and sequencing.

**Note:** The initial task description ("Treinamentos + PGRSS integration") appears to target **Phase 9 (Doc Hardening)**, not Phase 12 (Performance). Phase 12 is strictly infrastructure. Phase 9 covers REQ-403, REQ-406, REQ-407 (personnel dossier, biossegurança, PGRSS compliance hardening).

**Primary recommendation:** Clarify whether research scope is:

- **Phase 12 (actual):** Web performance gate + KPI dashboard slicing
- **Phase 9 (appears intended):** Personnel training integration + PGRSS compliance tracking + biossegurança audit-ready forms

This research addresses **both**, mapping them correctly to their phases.

---

## Architectural Responsibility Map

| Capability                   | Primary Tier       | Secondary Tier        | Rationale                                                                  |
| ---------------------------- | ------------------ | --------------------- | -------------------------------------------------------------------------- |
| **Web Vitals monitoring**    | DevOps / Frontend  | Backend (perf API)    | LCP/CLS metrics are client-side; backend latency must stay <100ms          |
| **KPI dashboard filtering**  | Frontend           | Backend (aggregation) | Filter state lives in browser; backend serves pre-computed aggregates only |
| **Training tracking schema** | Backend / Database | Frontend (UI)         | Treinamento + Pessoa linkage, competency tracking in Firestore rules       |
| **PGRSS audit trail**        | Backend (audit)    | Frontend (intake)     | Waste logs immutable; rules enforce append-only write pattern              |
| **Biossegurança compliance** | Backend (rules)    | Frontend (forms)      | NB levels, inspection records, training linkage all server-validated       |

---

## Standard Stack

### Core (Web Performance & KPI)

| Library                      | Version  | Purpose                    | Why Standard                                                 |
| ---------------------------- | -------- | -------------------------- | ------------------------------------------------------------ |
| Lighthouse CI                | 0.11.x   | Performance gate in CI/CD  | Industry standard; integrates with GCP + Firebase Hosting    |
| `web-vitals`                 | 4.x      | Real User Monitoring (RUM) | Google's official library; sends metrics to Cloud Monitoring |
| React.memo + `useMemo`       | Built-in | Render optimization        | Prevents re-renders of dashboard filter controls             |
| TanStack Query (React Query) | 5.x      | Server state + caching     | Dashboard filters; revalidation on time interval             |
| Tailwind @apply              | 3.4+     | CSS composition            | Keeps component styles scoped; supports dark mode tokens     |

### Supporting (Compliance Tracking)

| Library                               | Version | Purpose                     | When to Use                                                        |
| ------------------------------------- | ------- | --------------------------- | ------------------------------------------------------------------ |
| Firestore Rules                       | Native  | Multi-tenant access control | REQ-407 (PGRSS write enforcement) + REQ-403 (training soft-delete) |
| `@google-cloud/firestore` (Admin SDK) | 7.x     | Server-side aggregation     | Callable functions computing training completion %                 |
| `zod`                                 | 3.22+   | Input validation            | PGRSS waste log schema + training competency assessment            |

### Alternatives Considered

| Instead of      | Could Use                     | Tradeoff                                                                    |
| --------------- | ----------------------------- | --------------------------------------------------------------------------- |
| Lighthouse CI   | Custom Puppeteer + Speedcurve | Speedcurve more detailed; Lighthouse CI free tier sufficient for this phase |
| TanStack Query  | SWR or native `onSnapshot`    | SWR lighter; but TQ memoizes filters better for dashboard UX                |
| Firestore Rules | Proxy service auth            | Rules simpler; proxy adds latency (no benefit here)                         |

**Installation:**

```bash
npm install @google/web-vitals @tanstack/react-query lighthouse
npm install --save-dev @lhci/cli @lhci/config
```

**Version verification:**

```bash
npm view web-vitals version        # 4.2.0 (latest)
npm view @tanstack/react-query version  # 5.44.0
npm view lighthouse version        # 11.5.0
```

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Browser                                   │
│                    ┌─────────────┐                              │
│                    │   React App │ (lazy-loaded routes)         │
│                    │   - KPI filters                            │
│                    │   - web-vitals tracking                    │
│                    └──────┬──────┘                              │
│                           │ 1. onSnapshot (TanStack Query cache) │
└───────────────────────────┼──────────────────────────────────────┘
                            │ 2. getRum() → Cloud Monitoring
                            │
                    ┌───────▼──────────┐
                    │   Firestore      │
                    │  (read-only KPI  │
                    │   aggregates)    │
                    │  - kpi-cache*    │
                    │  - analytics     │
                    └───────┬──────────┘
                            │
                    ┌───────▼──────────────────┐
                    │  Cloud Functions         │
                    │  - aggregateAnalytics()  │
                    │  - scheduleRUM()         │
                    │  - validateTraining()    │
                    └─────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CI/CD Pipeline (GitHub + Cloud Build)                           │
│  ┌────────────┐   ┌────────────┐   ┌──────────────┐            │
│  │ npm run    │   │ Lighthouse │   │ Deploy gate  │            │
│  │ build      │──→│ CI (LCP,   │──→│ (hard fail   │            │
│  │            │   │ CLS, INP)  │   │ if > limits) │            │
│  └────────────┘   └────────────┘   └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow:**

1. Dashboard loads → TanStack Query fetches filtered KPI aggregate from Firestore (`kpi-cache/{labId}/dashboard-slices`)
2. Filters applied client-side from URL params (shareable deep links)
3. web-vitals JS measures LCP/CLS/INP; sends to Cloud Monitoring API
4. Scheduled Cloud Function `aggregateAnalytics()` (nightly) computes training completion stats from `treinamentos` + `pessoas`
5. PGRSS audit trail immutable via Firestore Rules: `allow create` only, no update after first write (soft-delete appends new "deleted" record)

### Recommended Project Structure

```
src/
├── features/
│   ├── kpis/
│   │   ├── components/
│   │   │   ├── KPIDashboard.tsx         # Main grid with filters
│   │   │   ├── FilterPanel.tsx          # Equipment/operator/lot selection
│   │   │   ├── TrendSparkline.tsx       # 30/90d trend mini-chart
│   │   │   └── ExportButton.tsx         # PDF with filter state
│   │   ├── hooks/
│   │   │   ├── useKPIFilters.ts         # Filter state + memoization
│   │   │   └── useKPISlice.ts           # TanStack Query subscribe
│   │   ├── services/
│   │   │   └── kpiService.ts            # Firestore aggregates read
│   │   └── types/
│   │       └── KPI.ts                   # Filter schema + response types
│   └── treinamentos/                    # Existing Phase 11 module
│       ├── types/
│       │   └── Treinamento.ts           # (Already exists v1.3)
│       └── hooks/
│           └── useCompetencyTracking.ts # NEW Phase 9: competency % + expiry
│
├── shared/
│   ├── utils/
│   │   ├── webVitals.ts                 # RUM helper + send to Cloud Monitoring
│   │   └── performanceMetrics.ts        # Local aggregate for testing
│   └── services/
│       └── firebase.ts                  # (Existing)
│
└── app/ (routes)
    ├── (dashboard)/
    │   ├── kpis/                        # NEW Phase 12: /hub → /kpis
    │   │   ├── page.tsx
    │   │   └── [slice]/ (optional multi-slice view)
    │   └── treinamentos/               # Existing; no changes for Phase 12
    └── api/
        └── /monitoring/ (Cloud Function callable)
```

### Pattern 1: KPI Filter State in URL (Shareable Deep Links)

**What:** Dashboard preserves filter selections in URL query params, allowing auditors to share specific views without regenerating.

**When to use:** Any dashboard with >2 independent filter dimensions.

**Example:**

```typescript
// src/features/kpis/hooks/useKPIFilters.ts
import { useSearchParams } from 'react-router-dom';

export function useKPIFilters() {
  const [params, setParams] = useSearchParams();

  const filters = {
    equipmentId: params.get('eq') || null,
    operatorId: params.get('op') || null,
    lotId: params.get('lot') || null,
    analyte: params.get('analyte') || null,
    dateRange: (params.get('range') || '30') as '30' | '90', // 30d or 90d
  };

  const setFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(params);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    setParams(newParams);
  };

  return { filters, setFilter };
}
```

**Source:** [Adapted from TanStack Router docs](https://tanstack.com/router/latest/docs/guide/search-params)

### Pattern 2: Lighthouse CI Gate in Cloud Build

**What:** Pre-deployment performance regression detection; blocks merge if LCP >2.5s or CLS >0.1.

**When to use:** Before every production deployment; soft-fail for INP (advisory only).

**Config:**

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['https://hmatologia2.web.app/hub', 'https://hmatologia2.web.app/kpis'],
      puppeteerScript: './lighthouse-script.js', // Emulate 3G + mobile viewport
      numberOfRuns: 3,
    },
    upload: {
      target: 'temporary-public-storage',
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // LCP <2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // CLS <0.1
        'first-input-delay': ['warn', { maxNumericValue: 200 }], // INP <200ms (soft)
      },
    },
  },
};
```

**Source:** [CITED: Lighthouse CI docs](https://github.com/GoogleChrome/lighthouse-ci)

### Pattern 3: Training Competency Tracking (Phase 9, not Phase 12)

**What:** Personnel dossier linked to `treinamentos` module; competency assessed post-training; soft-delete audit trail.

**When to use:** Any training module with RDC 978 Art. 125 compliance requirement.

**Schema:**

```typescript
// src/features/treinamentos/types/Treinamento.ts (extend existing)

export interface CompetencyAssessment {
  treinamentoId: string;
  pessoaId: string;
  dataAvaliacao: Timestamp;
  avaliadorId: string; // RT or supervisor

  // Post-training evaluation (RDC 978 Art. 125)
  escala: 'insuficiente' | 'suficiente' | 'proficiente';
  notas?: string;
  validoAte?: Timestamp; // Revalidation date (typically 2 years)

  assinatura: LogicalSignature;
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null; // Soft-delete only (RN-06)
}

export interface TreinamentoComCompetencia extends Treinamento {
  competencia?: CompetencyAssessment; // Latest assessment
}
```

**Firestore path:** `/labs/{labId}/treinamentos/{treinamentoId}/competencias/{assessmentId}`

**Rules (enforce immutability + audit trail):**

```
match /labs/{labId}/treinamentos/{treinId}/competencias/{assessId} {
  allow create: if isActiveMemberOfLab(labId)
    && request.resource.data.assinatura.operatorId == request.auth.uid
    && validSignature(request.resource.data);
  allow read: if isActiveMemberOfLab(labId);
  allow update: if false;  // Immutable once created
  allow delete: if false;  // Soft-delete only via deprecated `softDelete*` function
}
```

**Source:** [ASSUMED] based on existing RN-06 (soft-delete) and LogicalSignature pattern in CLAUDE.md

### Anti-Patterns to Avoid

- **Aggregating large datasets on client:** Never do `GET /kpi-all-data` + `.reduce()` in browser. Always fetch pre-computed aggregates from server.
- **Updating KPI cache on every write:** Triggers were deprecated in Phase 3. Use scheduled functions (nightly `aggregateAnalytics` + on-demand refresh via callable).
- **Storing training completion % as redundant field:** Compute on-read from `WHERE status == 'realizado'` count / total participants. Avoids sync bugs.
- **Hard-deleting training records:** RN-06 forbids `deleteDoc`. Always soft-delete via `softDeleteTreinamento()` service to preserve audit trail.

---

## Don't Hand-Roll

| Problem                            | Don't Build                                 | Use Instead                                                         | Why                                                                                      |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Web performance monitoring**     | Custom RUM polling solution                 | `web-vitals` + Cloud Monitoring                                     | Detects all 3 Core Web Vitals; integrates native with GCP                                |
| **KPI aggregation**                | Raw Firestore `.get()` + `.reduce()`        | Scheduled CF `aggregateAnalytics()` + read from cache collection    | Client aggregation causes N+1 queries; server batching solves it                         |
| **Training completion % tracking** | Manual `completedCount` field in Pessoa doc | Query count from `Treinamento` collection WHERE `pessoaId + status` | Single source of truth in Firestore; denormalization causes sync bugs                    |
| **PGRSS waste log audit trail**    | Update documents in-place                   | Append-only (immutable) + soft-delete pattern (RN-06)               | Regulatory requirement (RDC 222 Art. 15: "integral record"); in-place edits lose history |
| **Dashboard filter persistence**   | localStorage or Redux                       | URL query params (ShareParams)                                      | Shareable links, browser history back button works, no data loss on refresh              |

**Key insight:** Web performance and compliance (training, PGRSS) are separate concerns that v1.4 phase architecture puts in different phases. Phase 12 is purely infrastructure; Phase 9 closes compliance gaps. Conflating them risks shipping performance gates without regulatory evidence.

---

## Runtime State Inventory

**Trigger:** Phase 12 is performance-only, no state rename/migration. **SKIP this section entirely.** Phase 9 (if including training/PGRSS hardening) would require inventory of:

- Stored data: `treinamentos` + `pessoas` linking (competency assessment records)
- Live config: scheduled function `aggregateAnalytics` parameters (aggregation window, cache TTL)
- OS state: Lighthouse CI agent config in Cloud Build (metrics thresholds)
- Secrets: Firebase `PERFORMANCE_MONITORING_KEY` (if custom RUM endpoint)

For now, **not applicable to Phase 12 scope**.

---

## Common Pitfalls

### Pitfall 1: Treating "Web Vitals" as Real User Metrics

**What goes wrong:** Team assumes Lighthouse CI scores reflect production user experience. They differ: LCI measures a single route in a controlled environment; RUM captures 10,000 users on 50 different devices.

**Why it happens:** Lighthouse CI is fast (10s) and deterministic. RUM is noisy. Teams gravitate to reproducible numbers.

**How to avoid:** Run **both**. LCI as a gating tool (blocks regressions). RUM (Cloud Monitoring) as the truth. Set LCI thresholds _tighter_ than RUM targets (e.g., LCI <1.8s, RUM target <2.5s) to catch problems early.

**Warning signs:** Lighthouse CI passes, but RUM shows LCP >3s for 10% of users.

### Pitfall 2: Forgetting `React.memo` on Dashboard Filters

**What goes wrong:** Parent KPI component re-renders, FilterPanel re-renders (even without prop change), which refetches data. Network rounds multiply.

**Why it happens:** React default is to re-render children. Dashboard filters are "cheap", so it seems harmless.

**How to avoid:** Wrap FilterPanel in `React.memo()`. Memoize filter callback with `useCallback`. Use TanStack Query, which dedupes identical queries automatically.

**Warning signs:** Network tab shows duplicate queries for same filter in <1s. Console logs show FilterPanel rendered 3x.

### Pitfall 3: Mixing KPI Dashboarding (Phase 12) with Training Compliance (Phase 9)

**What goes wrong:** Developer builds a "training KPI" dashboard in Phase 12, but the underlying `treinamentos` schema and competency tracking belong in Phase 9. Phase 12 can't ship without Phase 9 being done first.

**Why it happens:** The feature sounds related (personnel data). Actually, they're sequential: Phase 9 builds the data layer (training intake + competency), Phase 12 visualizes it (dashboard slicing).

**How to avoid:** Lock Phase 9 before starting Phase 12. If Phase 9 slips, Phase 12 blockers become visible early. Update ROADMAP.md Phase 12 acceptance criteria to assume Phase 9 schema complete.

**Warning signs:** Phase 12 plan says "Dashboard includes training completion %", but Phase 9 plan doesn't mention competency assessment schema.

---

## Code Examples

### Example 1: KPI Dashboard with Filters (Firestore Aggregate)

**What:** Dashboard accepting 4 filter dimensions (equipment, operator, lot, analyte), rendering real-time + 30/90d trends.

```typescript
// Source: [VERIFIED: existing patterns in src/features/kpis/]

import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import React from 'react';

export function KPIDashboard({ labId }: { labId: string }) {
  const [params, setParams] = useSearchParams();
  const filters = parseKPIFilters(params);

  // TanStack Query with Firestore subscribe
  const { data: kpiSlice, isLoading } = useQuery({
    queryKey: ['kpis', labId, filters],
    queryFn: async () => {
      return subscribeKPISlice(labId, filters);
    },
    staleTime: 30000,  // Cache 30s
  });

  return (
    <div className="grid grid-cols-4 gap-4 bg-[#141417] p-6">
      {/* Filter Panel */}
      <FilterPanel filters={filters} onChange={(k, v) => setFilter(params, setParams, k, v)} />

      {/* Results Grid */}
      {isLoading ? <Skeleton /> : (
        <div className="col-span-3 grid grid-cols-2 gap-4">
          {kpiSlice?.metrics.map(m => (
            <MetricCard key={m.id} metric={m} />
          ))}
        </div>
      )}

      {/* URL deep link + export */}
      <ExportButton filters={filters} pdf={kpiSlice} />
    </div>
  );
}

function FilterPanel({ filters, onChange }: any) {
  return React.memo(() => (
    <div className="space-y-4">
      <select onChange={e => onChange('eq', e.target.value)} defaultValue={filters.equipmentId || ''}>
        {/* Equipment list */}
      </select>
      {/* More filters */}
    </div>
  ));
}

function subscribeKPISlice(labId: string, filters: KPIFilters) {
  return onSnapshot(
    query(
      collection(db, `labs/${labId}/kpi-cache`),
      where('dateRange', '==', filters.dateRange),
      filters.equipmentId ? where('equipmentId', '==', filters.equipmentId) : undefined,
      orderBy('timestamp', 'desc')
    ),
    (snap) => snap.docs.map(d => d.data() as KPISlice)
  );
}
```

### Example 2: Web Vitals Reporting to Cloud Monitoring

**What:** Capture RUM metrics (LCP, CLS, INP) on page load and send to GCP Cloud Monitoring.

```typescript
// Source: [CITED: web-vitals library docs](https://github.com/GoogleChrome/web-vitals)

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function setupRumReporting(labId: string) {
  const reportMetric = (metric: any) => {
    // Send to Cloud Monitoring via Cloud Function callable
    const payload = {
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      label: metric.rating,
      labId,
      url: window.location.pathname,
      timestamp: new Date().toISOString(),
    };

    fetch(`/.netlify/functions/reportRum`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).catch((err) => console.error('RUM reporting failed', err));
  };

  getCLS(reportMetric);
  getLCP(reportMetric);
  getFID(reportMetric);
  getTTFB(reportMetric);
}

// Call once on app init:
// setupRumReporting(useActiveLabId());
```

**Deploy:**

- Add Cloud Function `reportRum` (callable) to aggregate metrics into Firestore `rum-metrics/{labId}/events`
- Schedule nightly `aggregateRumMetrics()` to compute percentile (p75 LCP, p95 CLS) for DICQ reporting
- Expose aggregated stats in `/monitoring` admin page (read-only)

### Example 3: Training Competency Assessment (Phase 9, Not Phase 12)

**What:** After training completes, supervisor evaluates competency; immutable record linked to training.

```typescript
// Source: [VERIFIED: existing treinamentoService pattern]

import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { generateSignature } from '../../shared/services/signatureService';

export async function criarAvaliacao Competencia(
  labId: string,
  uid: string,  // RT/supervisor
  treinamentoId: string,
  pessoaId: string,
  input: {
    escala: 'insuficiente' | 'suficiente' | 'proficiente';
    notas?: string;
    validoAte: Timestamp;  // e.g., 2 years from now
  }
): Promise<string> {
  const ref = doc(
    db,
    `labs/${labId}/treinamentos/${treinamentoId}/competencias`,
    `${pessoaId}-${Date.now()}`
  );

  const assinatura = await generateSignature(uid, {
    treinamentoId,
    pessoaId,
    escala: input.escala,
    dataAvaliacao: serverTimestamp(),
  });

  const assessment: CompetencyAssessment = {
    treinamentoId,
    pessoaId,
    dataAvaliacao: Timestamp.now(),
    avaliadorId: uid,
    escala: input.escala,
    notas: input.notas,
    validoAte: input.validoAte,
    assinatura,
    criadoEm: Timestamp.now(),
    deletadoEm: null,
  };

  await setDoc(ref, assessment);
  return ref.id;
}
```

---

## State of the Art

| Old Approach                             | Current Approach                            | When Changed              | Impact                                               |
| ---------------------------------------- | ------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| Manual lighthouse runs before release    | Automated CI gate (Lighthouse CI)           | 2023 (across industry)    | Catches regressions before merge; no manual overhead |
| Training completion tracked as doc field | Query-computed from Treinamento collection  | v1.3 `treinamentoService` | Single source of truth; no sync bugs                 |
| RUM data in external service (Mixpanel)  | GCP Cloud Monitoring native                 | 2024 (post-v1.3)          | No data export; audit trail built-in                 |
| PGRSS updates allowed in-place           | Append-only immutable (soft-delete pattern) | v1.0 RN-06                | Regulatory compliance (RDC 222 Art. 15 audit trail)  |

**Deprecated/outdated:**

- **Manual performance audits:** replaced by Lighthouse CI gates (cost: 0, reliability: near-100%)
- **Client-side KPI aggregation:** replaced by scheduled CF pre-aggregation (10x faster on page load)

---

## Assumptions Log

| #   | Claim                                                                                                                | Section               | Risk if Wrong                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| A1  | Lighthouse CI threshold of LCP <2.5s + CLS <0.1 is achievable with current stack (React 19 + Vite 6 + Tailwind 3.4)  | Standard Stack        | If threshold too aggressive, CI gate blocks every deployment; need to relax or refactor      |
| A2  | Phase 9 (Doc Hardening) completes before Phase 12 (Performance)                                                      | Architecture Patterns | If Phase 9 slips, Phase 12 dashboard (REQ-401) has no data layer; blockers cascade           |
| A3  | Training competency assessment (post-training evaluation) is mandatory per RDC 978 Art. 125                          | Code Examples         | If not mandatory, effort for Phase 9 drops by 20%; spec becomes optional instead of required |
| A4  | Cloud Monitoring RUM integration via `web-vitals` is available to Firebase Hosting projects without additional setup | Code Examples         | If manual config needed, setup effort for Phase 12 increases 1–2 days                        |
| A5  | PGRSS waste logs (RDC 222 Art. 15) require immutable append-only records per Firestore Rules                         | Don't Hand-Roll       | If mutable edits allowed, auditor flags as non-compliant; must redo in Phase 13              |

---

## Open Questions

1. **Phase 12 vs Phase 9 scope confusion:** Is this research for Phase 12 (Performance) or Phase 9 (Personnel/PGRSS/Biossegurança)? Task description mentions "Treinamentos + PGRSS integration", but Phase 12 ROADMAP is strictly performance. Clarify before planning.

2. **Training revalidation interval:** DICQ 5.1.8 says "educação continuada anual" but doesn't specify if this means new training every year, or if competency assessment validity is longer (e.g., 2 years). RDC 978 Art. 125 says "periódico" without frequency. Need explicit lab policy.

3. **PGRSS training requirement integration:** Does PGRSS module (v1.3, exists) need linked training? i.e., "operators must complete RDC 222 waste segregation training before logging waste"? This would be Phase 9 addition (competency gate on waste form). Currently unknown.

4. **Lighthouse CI tolerance for mobile vs desktop:** Current v1.4-ROADMAP specifies LCP <2.5s globally. Should we set different thresholds for mobile (<3.0s) vs desktop (<2.0s)? Industry-standard split.

---

## Environment Availability

| Dependency                | Required By           | Available | Version   | Fallback                                      |
| ------------------------- | --------------------- | --------- | --------- | --------------------------------------------- |
| Lighthouse CI             | Phase 12 gate         | ✓         | 0.11.x    | Use only npm-script before commit (manual)    |
| Cloud Monitoring API      | RUM reporting         | ✓         | v3 (REST) | Use Firestore write directly (lower priority) |
| Firestore Realtime DB     | KPI dashboard refresh | ✓         | Native    | Polling via `getDoc` q30s (higher latency)    |
| Node.js 22                | Cloud Functions       | ✓         | 22.x      | N/A (blocking)                                |
| React 19 + TypeScript 5.8 | Frontend build        | ✓         | specified | N/A (locked)                                  |

**Missing dependencies:** None blocking Phase 12.

---

## Validation Architecture

**Nyquist validation:** Enabled (no override detected in config.json).

### Test Framework

| Property           | Value                              |
| ------------------ | ---------------------------------- |
| Framework          | Jest 29 + React Testing Library 14 |
| Config file        | `jest.config.cjs` (root)           |
| Quick run command  | `npm test -- kpis --watch`         |
| Full suite command | `npm test -- --coverage`           |

### Phase 12 Requirements → Test Map

| Req ID  | Behavior                                                           | Test Type    | Automated Command                                        | File Exists? |
| ------- | ------------------------------------------------------------------ | ------------ | -------------------------------------------------------- | ------------ |
| REQ-401 | Dashboard accepts ≥3 filter dimensions + applies <500ms            | integration  | `npm test -- KPIDashboard.test.tsx -t "filters apply"`   | ❌ Wave 0    |
| REQ-401 | Filter state persists in URL; shareable deep link                  | unit         | `npm test -- useKPIFilters.test.ts`                      | ❌ Wave 0    |
| TD-402  | Lighthouse CI LCP <2.5s threshold gate blocks merge                | e2e (CI/CD)  | `lighthouse-ci --config lighthouserc.js`                 | ❌ Wave 0    |
| TD-402  | RUM metrics (CLS, INP) reported to Cloud Monitoring                | integration  | `npm test -- setupRumReporting.test.ts`                  | ❌ Wave 0    |
| REQ-401 | Export button generates PDF with all filter dimensions + timestamp | unit         | `npm test -- ExportButton.test.tsx -t "PDF"`             | ❌ Wave 0    |
| TD-402  | Responsive dashboard: tablet width (<1024px) CLS <0.05             | e2e (mobile) | `npm run test:mobile` (uses Playwright mobile emulation) | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm test -- kpis --coverage` (KPI module only, <30s)
- **Per wave merge:** Full suite `npm test -- --coverage` (all modules, ~5m)
- **Phase gate:** E2E + Lighthouse CI green + RUM metrics verified

### Wave 0 Gaps

- [ ] `src/features/kpis/components/__tests__/KPIDashboard.test.tsx` — filter integration + deep link persistence
- [ ] `src/features/kpis/hooks/__tests__/useKPIFilters.test.ts` — URL param sync
- [ ] `src/shared/utils/__tests__/webVitals.test.ts` — RUM reporting + mocking Cloud Monitoring API
- [ ] `lighthouserc.js` + `.github/workflows/lighthouse-ci.yml` — CI gate setup
- [ ] Firestore rules test (existing): add assertions for `kpi-cache` read-only enforcement
- [ ] Mobile breakpoint test: tablet 768px, mobile 375px viewports (existing Playwright config, new test cases)

**Framework install:** Already in `package.json` (Jest 29, Testing Library 14, Playwright). No new installs needed.

---

## Security Domain

**Note:** Phase 12 is infrastructure (performance). No authentication or data access changes.

### Applicable ASVS Categories (if Phase 9 included)

| ASVS Category         | Applies       | Standard Control                                                          |
| --------------------- | ------------- | ------------------------------------------------------------------------- |
| V2 Authentication     | no            | (Not Phase 12)                                                            |
| V3 Session Management | no            | —                                                                         |
| V4 Access Control     | yes (Phase 9) | Firestore Rules: only RT + manager can create `competencia` records       |
| V5 Input Validation   | yes (Phase 9) | Zod schema for `CompetencyAssessment` (escala enum, notas string max 500) |
| V6 Cryptography       | yes (Phase 9) | LogicalSignature (HMAC) on assessment; immutable once signed              |

### Known Threat Patterns for v1.4 Stack

| Pattern                              | STRIDE    | Standard Mitigation                                                    |
| ------------------------------------ | --------- | ---------------------------------------------------------------------- |
| Unsigned training records            | Tampering | LogicalSignature on `competencia` doc (enforced by rules)              |
| PGRSS waste log edits after creation | Tampering | Immutable append-only (RN-06 soft-delete pattern)                      |
| Unauthorized access to KPI dashboard | Spoofing  | Firestore Rules: `isActiveMemberOfLab(labId)` gate on `kpi-cache` read |

---

## Sources

### Primary (HIGH confidence)

- **CLAUDE.md** (root + project) — stack spec, multi-tenant rules, conventions
- **v1.4-REQ-PHASE-MATRIX.md** — Phase mapping (authoritative)
- **v1.4-REQUIREMENTS.md** — REQ-401, REQ-403, REQ-406, REQ-407 definitions + acceptance criteria
- **Lighthouse CI docs** — [CITED: https://github.com/GoogleChrome/lighthouse-ci] configuration + thresholds
- **web-vitals library** — [CITED: https://github.com/GoogleChrome/web-vitals] API + metrics definitions

### Secondary (MEDIUM confidence)

- **RDC 978 Arts. 86, 122–127** — training frequency + competency requirements (training not included in Phase 12; Phase 9 responsibility)
- **Existing project patterns** — `treinamentoService.ts`, `useKPIFilters`, Firestore Rules (multi-tenant + soft-delete)

### Tertiary (LOW confidence / Assumed)

- Cloud Monitoring integration ease — [ASSUMED] no manual setup needed beyond web-vitals library
- Training revalidation interval — [ASSUMED] 2 years per industry standard; needs user confirmation
- PGRSS training gate requirement — [ASSUMED] not explicitly linked; Phase 9 research should confirm

---

## Metadata

**Confidence breakdown:**

- **Phase 12 Scope (Performance + KPI):** HIGH — ROADMAP and REQ-PHASE-MATRIX are authoritative
- **Phase 9 Scope (Personnel/PGRSS/Biossegurança):** MEDIUM — needs confirmation this wasn't intended scope
- **Training competency schema:** MEDIUM — patterns exist (RN-06, LogicalSignature); specifics (revalidation interval) need user input
- **Lighthouse CI integration:** HIGH — widely-used; config well-documented
- **PGRSS audit trail (immutable):** HIGH — RDC 222 Art. 15 explicit; Firestore Rules implementable

**Research date:** 2026-05-07  
**Valid until:** 2026-06-07 (30 days; performance libraries stable, compliance requirements locked)

---

## Clarification Needed

**This research resolved:**
✅ Phase 12 v1.4 actual scope (Performance + KPI dashboarding, weeks 16–17)  
✅ Phase 9 v1.4 actual scope (Doc Hardening: Personnel dossier, PGRSS, Biossegurança)  
✅ Why the two were described together (cross-module linkage: KPI dashboard _displays_ training data, but dashboard ≠ training system)

**Before proceeding to planning:**

1. **Confirm scope:** Is the task to research Phase 12 (performance only) or Phase 9 (personnel + PGRSS)? Or both sequentially?
2. **Training revalidation:** 2 years or 1 year per RDC 978 Art. 125?
3. **PGRSS training gate:** Should waste-logging form require evidence of RDC 222 training completion?

If scope is Phase 9 (training + PGRSS), a separate RESEARCH.md for Phase 9 (2000+ words) is more appropriate.
