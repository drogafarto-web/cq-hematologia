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
        // PWA with Firebase auth + Firestore cold-start. 0.75 is achievable
        // with the current chunk split (vendor-firebase + vendor-react isolated).
        // Kept below 0.85 warn because login-gated apps are penalised by LH for
        // redirect latency on the authenticated shell.
        'categories:performance': ['error', { minScore: 0.75 }],

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
        // FCP: login redirect adds ~200ms; 2000ms target is generous but correct.
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        // LCP: largest element is the login form or hub grid, not a hero image.
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        // TBT: chunk split keeps main thread clear. 300ms is achievable.
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        // CLS: no layout shifts post-skeleton. 0.1 is the "Good" threshold.
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
