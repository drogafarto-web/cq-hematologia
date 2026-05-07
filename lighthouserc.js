/** @type {import('@lhci/cli').LHCIConfig} */
module.exports = {
  ci: {
    collect: {
      url: ['https://hmatologia2.web.app'],
      numberOfRuns: 3,
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // ── Performance ───────────────────────────────────────────────────────
        // Phase 12 (2026-05-20): Stricter threshold (0.85) enforced for v1.4.
        // v1.3 baseline shows consistent 88-92 performance scores across routes.
        // This gate ensures v1.4 modules don't regress below this bar.
        'categories:performance': ['error', { minScore: 0.85 }],

        // ── Accessibility ─────────────────────────────────────────────────────
        // All interactive elements have aria-labels; heading hierarchy is correct.
        // Hard-fail at 0.9 — regressions here are unacceptable for a medical SaaS.
        'categories:accessibility': ['error', { minScore: 0.9 }],

        // ── Best Practices ────────────────────────────────────────────────────
        // No mixed content, no deprecated APIs, HTTPS only. Hard-fail at 0.9.
        'categories:best-practices': ['error', { minScore: 0.9 }],

        // ── SEO ───────────────────────────────────────────────────────────────
        // Login-gated B2B SaaS — SEO is irrelevant. Warn only so it never blocks
        // CI on meta/robots issues that don't affect users.
        'categories:seo': ['warn', { minScore: 0.7 }],

        // ── PWA ───────────────────────────────────────────────────────────────
        // App is fully installable (manifest + SW + offline shell via Workbox).
        // Hard-fail at 0.9 — PWA contract is a core product feature.
        'categories:pwa': ['error', { minScore: 0.9 }],

        // ── Web Vitals (individual metrics) ───────────────────────────────────
        // Phase 12 (2026-05-20): Targets hardened based on v1.3 baseline.
        // FCP: login redirect adds ~200ms; 2000ms target is generous but correct.
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        // LCP: Phase 12 target <2.0s (from v1.3 baseline 1.8s desktop, 2.1s mobile)
        'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
        // TBT: Phase 12 target <200ms (from v1.3 300ms threshold)
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        // CLS: Phase 12 target <0.05 for desktop (from v1.3 0.05/0.08 baseline)
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
        // INP: Phase 12 NEW metric — input latency <200ms (v1.3: 85ms desktop)
        'interaction-to-next-paint': ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
