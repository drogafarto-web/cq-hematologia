# Uroanalise Redesign — Anti-Patterns Audit

**Date:** 2026-05-08
**Files audited:** 15
**Verdict:** PASS_WITH_NOTES

## Critical findings (MUST fix before merge)

- `UroAuditTable.tsx:108` — visible em-dash rendered as null placeholder: `<span...>—</span>` in `NotivisaPill`. Replace with a single hyphen, en-dash, or ASCII dash, or render an empty cell.
- `UroAuditTable.tsx:123` — same pattern in `SignatureCell` for unsigned rows: `<span...>—</span>`. Same fix.

These are the only user-visible em-dashes inside the 15 audited files. All other `—` matches in these files appear inside `{/* */}` JSX comments, which are stripped at build and never reach the DOM.

## Warnings (should fix soon)

- `UroButtonToggle.tsx:93` — selected toggle uses `shadow-sm shadow-amber-500/10`. DESIGN.md Flat-By-Default rule sanctions shadow only on the primary save button. Toggle selection is already signalled by `bg-amber-500/12 + border-amber-500/50 + text-amber-300`; the shadow is decorative. Remove.
- `UroBreadcrumbHeader.tsx:32, 165, 175` — three amber elements may co-exist in one breadcrumb row (active crumb + Nível P badge + `assinado` status pill). Amber Scarcity rule: pick one anchor per region. Recommend leaving amber on the status pill only and demoting nivel P badge + active crumb to neutral high-contrast (white/90 or slate-900) with a leading marker.
- `UroFormFooterSection.tsx:68-93` — `Metric` component renders 4 siblings with identical structure (big number + supporting label). Borderline hero-metric pattern. Functions differ (Preenchidos/Conformes/Desvios/Pendentes), but visual treatment is uniform. Mitigated by `tone` color + `inactive` muting; acceptable but worth re-examining whether a single line-with-pills would be more specialist than four big numbers.

## Notes (acceptable but worth noting)

- `UroAuditTrailDrawer.tsx:208`, `UroanaliseFormRedesigned.tsx:376`, `UroMobileTabBar.tsx:179` — `backdrop-blur-sm` on modal backdrop and sticky bars only. Within DESIGN.md exception.
- `UroFormFooterSection.tsx:448` — save CTA carries `shadow-sm shadow-amber-500/20`. Explicitly the only sanctioned shadow location.
- `UroComplianceChecklist.tsx:243` — amber on remediation text for `warn`/`fail` items. Qualifies as warning marker, not decoration.
- `UroAnalyteRow.tsx:91`, `UroQuantitativoRow.tsx:174` — pulsing amber dot for `pendente` status. Respects `motion-reduce` via base Tailwind only at the toggle layer (`animate-pulse` on the dot ignores `prefers-reduced-motion`). Minor a11y polish: gate with `motion-reduce:animate-none`.

## Per-file summary

### UroStatusBar.tsx
[PASS] Border-top divider, status dot + label, tabular timestamp. No violations.

### UroInputField.tsx
[PASS] Border-based, amber focus ring, error/disabled states, tabular-nums on numeric/right-aligned. Clean.

### UroButtonToggle.tsx
[WARN] Decorative shadow on selected state (line 93). Otherwise correct: amber-tinted bg + border on selection.

### UroAnalyteRow.tsx
[PASS] Grid layout, status dot, expected hint with mono+slate. `animate-pulse` on pendente dot lacks `motion-reduce` opt-out (note).

### UroQuantitativoRow.tsx
[PASS] Mirrors AnalyteRow geometry. Tabular-nums on expected range. Same pulse note as above.

### UroFormIdentificationSection.tsx
[PASS] Block headings, no decorative borders, expiry hint discreet, tabular-nums on numeric inputs via UroInputField.

### UroFormFooterSection.tsx
[WARN] 4-Metric horizontal stack approaches hero-metric template (note above). Save CTA shadow is sanctioned.

### UroanaliseFormRedesigned.tsx
[PASS] Sticky status bar with allowed `backdrop-blur-sm`. Specialist copy. Tabular-nums on summary count.

### UroLotSidebar.tsx
[PASS] Status dot + nivel chip + expiry red marker. Inline SVG only. Amber confined to selected/pinned/focus.

### UroBreadcrumbHeader.tsx
[WARN] Potential triple amber co-occurrence (active crumb + P nivel + assinado pill). Otherwise solid.

### UroMobileTabBar.tsx
[PASS] Inline SVG icons, amber active state, badge uses amber once. Sticky `backdrop-blur-sm` allowed.

### UroAuditTable.tsx
[FAIL] Visible em-dashes in NotivisaPill and SignatureCell empty states (lines 108, 123). Otherwise table is correct (true table, tabular-nums, no card-grid).

### UroAuditTrailDrawer.tsx
[PASS] Drawer is the right affordance for trail-of-events. Inline SVG icons, mono hashes, motion-reduce respected.

### UroComplianceChecklist.tsx
[PASS] List layout (not card-grid), inline SVG status icons, monospace reference codes, neutral pills.

### UroanaliseRedesignedShell.tsx
[PASS] Three-column shell, no decorative chrome, amber underline on active tab, drawer for trail. Comments use em-dash but never reach DOM.

## Anti-pattern matrix

| Anti-pattern | Files affected | Count |
|---|---|---|
| Side-stripe borders | — | 0 |
| Em dashes in user-visible copy | UroAuditTable.tsx | 2 |
| Em dashes in JSX comments only | 6 files | 11 (acceptable) |
| Emojis (non-SVG) | — | 0 |
| Heavy backdrop-blur (md+) | — | 0 |
| Backdrop-blur-sm on sticky/modal | 3 files | 3 (allowed) |
| Decorative shadows (md/lg/xl/2xl) | — | 0 |
| Decorative shadow-sm beyond save CTA | UroButtonToggle.tsx | 1 |
| Gradient text | — | 0 |
| Icon libraries | — | 0 |
| New top-level deps | — | 0 |
| Card-grid template | — | 0 (UroFormFooterSection borderline) |
| Modal as first thought | — | 0 (drawer used correctly) |
| Casual tone | — | 0 |
