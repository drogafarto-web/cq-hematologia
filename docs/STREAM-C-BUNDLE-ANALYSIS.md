# Stream C — Bundle Analysis & Lighthouse CI

**Track:** Performance Hardening (Stream C)  
**Updated:** 2026-05-05

---

## Current Bundle Breakdown (estimated from dependencies)

| Chunk | Libraries | Estimated gzip |
|---|---|---|
| `vendor-react` | react, react-dom | ~50 KB |
| `vendor-firebase` | firebase/app, auth, firestore, functions | ~200 KB |
| `vendor-charts` | recharts | ~90 KB |
| `vendor-pdf` | pdfjs-dist | ~500 KB (lazy) |
| `vendor-zod` | zod | ~30 KB |
| `module-educacao` | educacao-continuada | ~80 KB |
| `module-ct` | controle-temperatura | ~60 KB |
| `module-sgq` | sgq | ~50 KB |
| `module-bulaparser` | bulaparser | ~30 KB |
| `shared` | shared services, store, utils | ~40 KB |
| app shell | everything else | ~120 KB |
| **Total (estimated)** | | **~1,250 KB raw / ~850 KB gzip** |

> Run `npm run analyze` to generate the interactive treemap at `dist/stats.html`
> for exact sizes from the last build.

### Known Heavy Dependencies

- **`pdfjs-dist`** (~500 KB gzip) — already in `vendor-pdf` chunk, lazy-loaded
  only when PDF viewer opens via `ControlTemperaturaView` tab switch.
- **`xlsx` (SheetJS)** (~220 KB gzip) — dynamic `import('xlsx')` in both
  `educacao-continuada/services/ecImportService.ts` and
  `controle-temperatura/services/ctXlsxService.ts`. Does NOT inflate the
  initial bundle. Loads on first user interaction with import/export feature.
- **`recharts`** (~90 KB gzip) — segregated to `vendor-charts` chunk, loaded
  only by modules using Levey-Jennings or temperature charts.

---

## Changes Made (2026-05-05)

### 1. Lighthouse CI workflow (`.github/workflows/lighthouse-ci.yml`)

- Triggers on push to `main` and weekly on Mondays at 08:00 UTC.
- Builds the project with `npm run build`, then runs `@lhci/cli` against the
  static `dist/` output using its built-in server.
- Uploads the Lighthouse report as a GitHub artifact with 30-day retention.
- Thresholds (warnings, not hard failures):
  - Performance score ≥ 0.85
  - Accessibility score ≥ 0.90
  - FCP ≤ 2,000 ms
  - LCP ≤ 2,500 ms
  - TBT ≤ 300 ms
  - CLS ≤ 0.1

### 2. Lighthouse config (`lighthouserc.js`)

- Audits `https://hmatologia2.web.app` with 3 runs and uploads to
  temporary public storage for team sharing.

### 3. Bundle visualizer (`rollup-plugin-visualizer`)

- Added to `vite.config.ts` behind `ANALYZE=true` guard.
- Generates `dist/stats.html` as an interactive treemap with gzip and
  brotli size columns.

### 4. `vendor-zod` chunk

- `zod` was previously bundled into the app shell. Now segregated to its
  own chunk, reutilizable across modules without duplicate hydration.

### 5. xlsx import — already fixed (no change needed)

- Both `ecImportService.ts` and `ctXlsxService.ts` already use the cached
  dynamic import pattern (`let xlsxPromise = import('xlsx')`).
- SheetJS is correctly excluded from the initial bundle.

---

## How to Run the Analyzer Locally

```bash
# Windows (PowerShell / cmd)
npm run analyze
# Opens dist/stats.html in the default browser after the build completes.

# Bash / macOS / Linux
ANALYZE=true npm run build && open dist/stats.html
```

The `npm run analyze` script uses `cross-env` so it works on Windows without
manually setting environment variables.

---

## Lighthouse CI Setup Instructions

### Prerequisites

1. Install `@lhci/cli` globally or via `npx` (CI uses `npx @lhci/cli@0.14.x`).
2. (Optional) Install the [LHCI GitHub App](https://github.com/apps/lighthouse-ci)
   and add `LHCI_GITHUB_APP_TOKEN` to repository secrets for PR status checks.

### Run locally against the production URL

```bash
npx @lhci/cli autorun
# Reads lighthouserc.js — collects 3 runs against hmatologia2.web.app
```

### Run locally against the dist build

```bash
npm run build
npx @lhci/cli autorun \
  --collect.staticDistDir=./dist \
  --collect.url=http://localhost \
  --collect.numberOfRuns=3
```

### Interpreting results

Reports are saved to `.lighthouseci/`. Open `*.html` files locally or follow
the temporary-public-storage link printed at the end of the run.

---

## Stream C Targets

| Metric | Target | Status |
|---|---|---|
| Main bundle (gzip) | < 800 KB | ~850 KB (Week 2 baseline) |
| LCP | < 2.5 s | Measuring |
| INP | < 200 ms | Measuring |
| CLS | < 0.1 | Measuring |
| Lighthouse Performance | ≥ 85 | Measuring |

---

## Next Steps — Week 3-4 Optimizations

1. **Route-level code splitting** — wrap every module entry in `React.lazy` +
   `Suspense`. The feature chunk splitting already segregates code at the
   Rollup level; adding lazy imports at the router prevents even the chunk
   metadata from loading until navigation.

2. **pdfjs-dist tree-shaking** — verify `pdfjs-dist/legacy/build/pdf` is not
   imported anywhere via static import. Enforce lazy-only via a lint rule.

3. **Recharts selective import** — import individual recharts components
   (`LineChart`, `Line`, `XAxis`) instead of the barrel to drop unused chart
   types from the `vendor-charts` chunk.

4. **Firebase modular SDK audit** — confirm all firebase imports use the
   modular v9+ path (`firebase/app`, `firebase/firestore`) rather than
   compat paths, which include the full legacy SDK.

5. **Critical CSS inlining** — extract above-the-fold CSS (~4 KB) and inline
   it in `index.html` via a Vite plugin to eliminate the render-blocking
   stylesheet request.

6. **Service Worker cache tuning** — scope Workbox `CacheFirst` to include
   font files and SVG icons; increase `maxEntries` for vendor chunks to
   reduce repeat fetch on hard reload.

7. **Lighthouse budget file** — add `budget.json` to enforce file size budgets
   per chunk in CI, complementing the score thresholds in `lighthouserc.js`.
