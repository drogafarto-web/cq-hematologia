# Deploy Readiness — Phase 3.1

**Gate document for production deployment of Phase 3.1 (Analytics + Export Pipeline)**
Last updated: 2026-05-05

All items must be checked before requesting CTO deploy authorization.
See full deploy instructions in `docs/DEPLOY-PHASE3.1.md`.

---

## Go / No-Go gates

- [ ] `npx tsc --noEmit` — 0 errors (root + functions/)
- [ ] `cd functions && npm run build` — clean compilation
- [ ] `npm run test:unit` passing (769+ tests, no regressions)
- [ ] Phase 3.1 unit tests passing (analytics aggregation logic + export job creation)
- [ ] Pub/Sub topic `exports` verified in project `hmatologia2`
- [ ] `firestore.rules` pre-deploy backup saved to `docs/audits/`
- [ ] New rule blocks reviewed: `export-jobs` (read-only) and `analytics/cache` (read-only) — no existing rule modified
- [ ] 3 new indexes reviewed in `firestore.indexes.json`: `entries (status+deletadoEm)`, `entries (deletadoEm+criadoEm)`, `records (status+deletadoEm)`
- [ ] CTO deploy authorization received for this session

## Post-deploy verification (sign off after deploy)

- [ ] `aggregateAnalytics` scheduled function active in Cloud Console
- [ ] `initiateExport` callable deployed in `southamerica-east1`
- [ ] `exportWorker` Pub/Sub subscription active on topic `exports`
- [ ] Firestore rules live: client CANNOT write to `export-jobs`
- [ ] Firestore rules live: client CAN read from `export-jobs` with valid auth
- [ ] Indexes building or READY in Cloud Console → Firestore → Indexes

---

## Status

| Gate | Status |
| --- | --- |
| TypeScript clean | UNKNOWN — run check |
| Functions build | UNKNOWN — run check |
| Unit tests | UNKNOWN — run check |
| Pub/Sub topic | UNKNOWN — verify in console |
| Rules backup | NOT DONE |
| CTO authorization | PENDING |
