# Rule: Performance — Bundle + Runtime

**Triggers:** `src/features/analytics/**`, `src/features/export/**`, `hc-quality-mobile/**`, `vite.config.ts`, any new route file.

---

## Bundle

- **New dependency >50 KB gzip**: requires explicit justification in the PR. Include gzip size, why no lighter alternative, and which chunk it lands in.
- **xlsx / SheetJS**: client-side only via dynamic `import('xlsx')` — never a static top-level import in `src/`. It is allowed as a static import in `functions/src/` (runs server-side only).
- **puppeteer / canvas / heavy CLI tools**: functions-only. Never import in client code.
- **New route in AppRouter**: must use `React.lazy` + `Suspense`. Eager import into the main shell is a regression — it inflates the 362 KB gzip main chunk.
- **manualChunks**: if a new large library is added, add a named entry in `vite.config.ts` `manualChunks` so chunk names are stable across rebuilds.

## Firebase Listeners

- **onSnapshot**: always return and call the unsubscribe in the `useEffect` cleanup. Leaked listeners silently accumulate billing and memory.
- **No listener for polling**: use `getDoc` / `getDocs` at intervals. `onSnapshot` holds a persistent connection — use it only for data that must be real-time.
- **One listener per path per active view**: do not fork duplicate listeners for the same Firestore path.

## Analytics & Polling

- **Meta diff guard required**: any hook that polls on an interval must compare `lastUpdated` (or equivalent ETag) before calling `setState`. Never update state on every tick if the data hasn't changed.
- **Aggregate reads only**: the KPI/analytics client reads pre-computed server-side aggregates. Never run cross-collection `.reduce()` or `.filter()` over unbounded result sets on the client.
- **30s minimum poll interval**: shorter intervals require explicit justification (e.g. live IoT sensor feed).

## Web Vitals Targets

| Metric | Target | Hard limit |
|---|---|---|
| LCP | <2.0s | 2.5s (Lighthouse error) |
| INP | <200ms | — |
| CLS | <0.05 | 0.1 (Lighthouse error) |
| TBT | <200ms | 300ms (Lighthouse error) |

Full patterns and pre-ship checklist: `docs/PERFORMANCE_PATTERNS.md`.
