---
phase: "10-liberacao-criticos"
plan: "04"
title: "PDF Generation + QR Validation + Public Endpoint"
status: "COMPLETE (MVP scope)"
completed_date: 2026-05-06
---

# Plan 10-04 Execution Summary

**Phase 10 Plan 04: PDF Generation + QR Validation** — MVP shipped per scope decision.

## Execution Status: COMPLETE (MVP scope) ✅

MVP scope delivered. v1.4-deferred items: per-lab template customization, bulk PDF generation, Plan 10-05 (Medical Portal) entire plan deferred per CTO directive.

---

## Deliverables Checklist

### Server-side (Cloud Functions)

| File | Purpose | Status |
|---|---|---|
| `functions/src/liberacao/_pdf/qrCode.ts` | QR Code data-url generator + validation URL builder | ✓ |
| `functions/src/liberacao/_pdf/template.ts` | A4 portrait HTML template with 14 RDC 978 fields, watermark, QR footer | ✓ |
| `functions/src/liberacao/_shared/pdfStorage.ts` | Cloud Storage upload + signed URL helper (1h default expiration) | ✓ |
| `functions/src/liberacao/generateLaudoPDF.ts` | Callable: Puppeteer render → 10MB cap → SHA-256 → upload → audit | ✓ |
| `functions/src/liberacao/validarLaudoPublico.ts` | Public HTTPS endpoint: rate-limited (60/h/IP), no PII, HTML+JSON | ✓ |
| `functions/src/liberacao/index.ts` | Wired new exports | ✓ |
| `functions/src/index.ts` | Added top-level exports | ✓ |

### Client-side (React)

| File | Purpose | Status |
|---|---|---|
| `src/features/liberacao/services/pdfService.ts` | Typed wrapper for `generateLaudoPDF` callable + browser download trigger | ✓ |
| `src/features/liberacao/hooks/usePDFUrl.ts` | Hook: idle/loading/ready/error state + `isExpiringSoon` flag | ✓ |
| `src/features/liberacao/components/LaudoPDFPreview.tsx` | Iframe preview with lazy generation + skeleton + renew URL | ✓ |
| `src/features/liberacao/components/LaudoDownloadButton.tsx` | Primary CTA with 1h expiration tooltip + error state | ✓ |
| `src/features/liberacao/components/QRValidator.tsx` | Standalone validator UI for auditors (paste URL → view metadata) | ✓ |
| `src/features/liberacao/{hooks,components,index}.ts` barrels | Updated exports | ✓ |

### Infrastructure

| File | Change | Status |
|---|---|---|
| `storage.rules` | New rule for `laudos/{labId}/{laudoId}/{filename}` — read by lab members, write blocked (server-only) | ✓ |
| `functions/test/liberacao/pdfFlow.test.mjs` | Intent assertions for callable + endpoint contract + PII guarantees | ✓ |

---

## Key Behaviors

### `generateLaudoPDF` callable
- **Region:** southamerica-east1 · **Memory:** 2GiB · **Timeout:** 120s
- **Auth:** authenticated + active member of `labs/{labId}/members/{uid}`
- **Pipeline:**
  1. Fetch `Laudo` + `LaudoVersion` (defaults to currentVersion)
  2. Build validation URL: `{base}/api/validar-laudo/{laudoId}/v{version}?h={hashPrefix}`
  3. QR code: error correction `M`, 120px, B/W
  4. Render HTML template (14 RDC 978 Art. 167 fields, watermark "DOCUMENTO CONTROLADO")
  5. Puppeteer → A4 portrait PDF with page numbering footer
  6. **Hard cap 10MB** — throws `resource-exhausted` if exceeded
  7. SHA-256 hash of PDF buffer (forward integrity)
  8. Upload `gs://hmatologia2.appspot.com/laudos/{labId}/{laudoId}/v{version}.pdf`
  9. Update `LaudoVersion`: `pdfUrl`, `pdfStoragePath`, `pdfHash`, `pdfGeneratedAt`
  10. Audit log: `tipo: 'laudo_pdf_gerado'`
  11. Return `{ ok, signedUrl, pdfHash, sizeBytes, validationUrl }`

### `validarLaudoPublico` HTTPS endpoint
- **Region:** southamerica-east1 · **Memory:** 256MiB · **Timeout:** 30s · **Public** (no auth)
- **Path:** `/api/validar-laudo/{laudoId}/v{N}` — also accepts query params
- **Rate limit:** 60 req/h/IP via Firestore counter doc (`rate-limits/lib_validate_pub__{ip}__{hourBucket}`); **soft fail-open** on infra errors
- **Lookup:** collectionGroup query on `laudo-versions` (no labId required from caller)
- **Privacy contract:** response contains ONLY metadata — `hash, hashPrefix, version, isCurrent, supersededBy, rt{name,registro}, lab{name,cnes}, emissaoEm, criadoEm`. NEVER paciente, exames, resultados, médico solicitante.
- **Content negotiation:** HTML by default, JSON when `Accept: application/json`
- **Headers:** `Cache-Control: public, max-age=300`, `X-RateLimit-Remaining`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`
- **Superseded handling:** badge "Vigente" / "Superado" + link to current version

---

## Post-Plan Gates

| Gate | Status |
|---|---|
| TypeScript: liberacao/*.ts (functions) | ✓ 0 errors |
| TypeScript: src/features/liberacao/** (client) | ✓ 0 errors |
| Pre-existing TSC errors elsewhere (sgq/satisfacao) | unchanged (34) |
| Storage rules: laudos path | ✓ added |
| Smoke tests: contract assertions | ✓ written (run gated by sandbox) |
| Build: `npm run build` (functions) | ⏳ deferred to deploy step |
| Deploy | ⏳ requires explicit user authorization |

---

## Key Decisions Locked

| Aspect | Decision | Rationale |
|---|---|---|
| **PDF engine** | Puppeteer (already in `package.json`) | Pixel-perfect; consistent with `auditoria/generatePDF.ts` |
| **Storage path** | `laudos/{labId}/{laudoId}/v{version}.pdf` (top-level) | Matches Plan spec; rule explicitly added |
| **QR error correction** | Level M (medium) | Tolerates photocopy noise, RDC reports often printed/copied |
| **Signed URL TTL** | 1 hour default, 7 days max | Balances UX (no instant expiration) with link sharing risk |
| **Rate limit** | 60 req/h/IP, soft fail-open | Anti-abuse without blocking patients on infra blips |
| **PII redaction** | Whitelist approach in response shape | Defense-in-depth: only declared fields ever serialized |
| **Watermark** | "DOCUMENTO CONTROLADO" rotated 30°, 4% opacity | Discourages tampering / fake reproductions; non-intrusive |
| **chainHash exposure** | Full hash in response (and prefix in QR URL) | Hash is non-secret integrity proof; auditors need full hash to verify |

---

## Deferred to v1.4

- Plan 10-05 entire (Medical Portal — 12 days) — CTO directive
- Per-lab PDF template customization (logos, colors)
- Bulk PDF generation (batch + queue)
- ICP-Brasil A1/A3 signing
- WebRTC QR scanner inside `QRValidator`
- Cloudflare WAF in front of `validarLaudoPublico`

---

## Files Created/Modified

**Created (8 files):**
- `functions/src/liberacao/_pdf/qrCode.ts`
- `functions/src/liberacao/_pdf/template.ts`
- `functions/src/liberacao/_shared/pdfStorage.ts`
- `functions/src/liberacao/generateLaudoPDF.ts`
- `functions/src/liberacao/validarLaudoPublico.ts`
- `functions/test/liberacao/pdfFlow.test.mjs`
- `src/features/liberacao/services/pdfService.ts`
- `src/features/liberacao/hooks/usePDFUrl.ts`
- `src/features/liberacao/components/LaudoPDFPreview.tsx`
- `src/features/liberacao/components/LaudoDownloadButton.tsx`
- `src/features/liberacao/components/QRValidator.tsx`

**Modified (5 files):**
- `functions/src/liberacao/index.ts` (added 2 exports)
- `functions/src/liberacao/_shared/index.ts` (re-export pdfStorage)
- `functions/src/index.ts` (top-level exports + comments)
- `src/features/liberacao/components/index.ts` (3 new components)
- `src/features/liberacao/hooks/index.ts` (`usePDFUrl`)
- `src/features/liberacao/index.ts` (barrel re-exports)
- `storage.rules` (laudos path)

---

## Acceptance: Plan 10-04 COMPLETE

PDF generation + QR validation surface ready. Phase 10 v1.3 close pending deploy gate (rules → functions → hosting) with user authorization.

**Plan 10-05 (Medical Portal):** DEFERRED to v1.4 per scope directive.
