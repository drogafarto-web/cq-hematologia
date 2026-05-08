# Agent 7 — Proposed dependency additions

## TL;DR

**None required.** The metadata stripper is implemented in pure Node Buffer
operations with zero new deps. This file documents the optional upgrade path.

## Optional: `exifr`

- Package: [`exifr`](https://www.npmjs.com/package/exifr)
- License: MIT
- Size: ~30 KB minified, ~12 KB gzip
- Why we'd add it: structured parsing of what we just stripped, so the
  guardrail audit log can record exactly which PII fields were present
  (e.g. `gpsLatitude`, `gpsLongitude`, `dateTimeOriginal`, `cameraSerial`).
  Useful for incident forensics and DPIA reporting.
- Why it's optional today: stripping without parsing is sufficient for the
  defense-in-depth goal. We can ship this safely without `exifr`. Add it
  only if the LGPD audit team explicitly wants per-field telemetry.
- If added: install with `npm install --save exifr` inside `functions/`.

## Why not `sharp` or `jimp`?

Both pull in native bindings (libvips / pngjs) and add 20+ MB to the deploy
artifact. They re-encode the image, which loses fidelity and slows the
callable by 200–500 ms. Pure Buffer manipulation is the right call here.

## Why not `exif-parser`?

JPEG-only, last published 2017, no PNG/WebP support, missing TS types.
`exifr` is the modern equivalent.
