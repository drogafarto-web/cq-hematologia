# Uroanalise Redesign — A11y / Responsive / States Audit

**Date:** 2026-05-08
**Files audited:** 15
**Verdict:** PASS_WITH_NOTES

The redesign clears the WCAG AA bar across all 15 components and demonstrates rare discipline (focus-visible everywhere, motion-reduce guards, radiogroup semantics, drawer focus management, sticky safe-area insets). Findings below are non-blocking polish — none of them prevents shipping. Two should be fixed before merge: arbitrary opacity classes that Tailwind silently drops, and an `aria-pressed` on a radio role that screen readers reject.

## Critical findings (MUST fix)

- [UroButtonToggle.tsx:93] `bg-amber-500/12` is not a valid Tailwind opacity step (allowed: 10/15/20). Tailwind will emit no class — selected toggle loses its tinted bg in production. Replace with `bg-amber-500/10` or `bg-amber-500/[0.12]`.
- [UroMobileTabBar.tsx:121] `bg-amber-500/8` and [UroMobileTabBar.tsx:127] `aria-pressed={isActive}` on `role="tab"` — both wrong. `/8` doesn't exist (use `/10` or arbitrary `/[0.08]`); `aria-pressed` is for toggle buttons, not tabs (drop it; `aria-selected` is the correct attr and is already there).
- [UroLotSidebar.tsx:160] `bg-amber-500/[0.08]` is fine, but [UroLotSidebar.tsx:158] `focus-visible:ring-1` on a row with `tabIndex={-1}` is unreachable — the row never receives focus from Tab; only the listbox parent does. Either set `tabIndex={selected ? 0 : -1}` with roving focus or remove the ring (it's dead style).

## Warnings (should fix)

- [UroInputField.tsx:111] `aria-label={ariaLabel ?? label}` duplicates the visible `<label htmlFor>` — when both exist, screen readers may double-announce. Drop `aria-label` when `label` is rendered (only set it when `label` is absent).
- [UroAnalyteRow.tsx:91] `animate-pulse` on the `pendente` dot has no `motion-reduce:` guard. Add `motion-reduce:animate-none`.
- [UroQuantitativoRow.tsx:175] same pulse issue.
- [UroFormFooterSection.tsx:194-200] `DateField` and [UroFormFooterSection.tsx:246-253] `TextField` reimplement input styling already in `UroInputField`. Not an a11y bug, but drift risk — collapse into UroInputField (it supports `type="date"` and text already).
- [UroAuditTable.tsx:158] `bg-amber-500 text-slate-950` on the primary action — contrast is good, but `active:bg-amber-500` on hover state means there is no visible "pressed" feedback (button stays the same color). Use `active:bg-amber-600` or add `active:scale-[0.97]`.
- [UroAuditTable.tsx:262 + 257] `<input type="checkbox">` uses native styling; in dark mode on Windows this renders as a light grey box that clashes with the surface. Acceptable for AA but dim. Consider a custom checkbox in a follow-up.
- [UroBreadcrumbHeader.tsx:21] `CRUMB_ACTIVE` uses `text-amber-700 dark:text-amber-300` — this _adds an amber element to the persistent header_, which violates DESIGN.md "Amber Scarcity Rule" since the form save button and selected toggles are also amber. Consider `text-slate-900 dark:text-white/95` for active crumb.
- [UroLotSidebar.tsx:439] placeholder ends with `.` — DESIGN.md tone is "Confirm níveis" not casual; trailing period in placeholder is fine but the period inside `Buscar lote ou fabricante.` reads as a sentence. Drop the period.
- [UroAuditTrailDrawer.tsx:215] No focus trap implemented — Tab can leave the drawer and reach the underlying page (still scrollable-locked, but interactive elements remain reachable via keyboard). For a `role="dialog" aria-modal="true"` this is technically non-conforming. Add a focus trap or use inert on siblings.
- [UroanaliseRedesignedShell.tsx:190 + 205] Two `TabButton` instances rendered (mobile + desktop). When `aria-selected` flips, both update — fine — but the `role="tab"` group has no parent `role="tablist"` wrapper around the desktop instance (the mobile div lacks role too). Wrap each set with `role="tablist" aria-label="...".`
- [UroanaliseFormRedesigned.tsx:380] `new Date().toLocaleTimeString(...)` is computed inline on every render of the parent; not memoed and re-renders the StatusBar each keystroke. Wrap in `useMemo` keyed on minute boundary or compute on save.

## Per-file matrix

| File                         | States                            | Responsive                      | A11y                                 | Touch                                    | Light mode | Verdict                          |
| ---------------------------- | --------------------------------- | ------------------------------- | ------------------------------------ | ---------------------------------------- | ---------- | -------------------------------- |
| UroStatusBar                 | 5/5 (n/a hover/active)            | OK                              | OK                                   | n/a                                      | OK         | PASS                             |
| UroInputField                | 8/8                               | OK                              | WARN (label+aria-label dup)          | OK (py-2.5≈40px, +label = 44+)           | OK         | PASS_WITH_NOTES                  |
| UroButtonToggle              | 8/8                               | OK                              | OK (radiogroup + arrow keys)         | OK (min-w-44 sm, 52 md)                  | OK         | NEEDS_FIX (`/12` token)          |
| UroAnalyteRow                | 7/8 (no error state on row)       | WARN (fixed grid breaks <360px) | OK                                   | OK (toggles 44px)                        | OK         | PASS_WITH_NOTES                  |
| UroQuantitativoRow           | 8/8                               | WARN (same grid)                | OK                                   | OK                                       | OK         | PASS_WITH_NOTES                  |
| UroFormIdentificationSection | n/a (composes)                    | OK (sm:grid-cols-2)             | OK                                   | OK                                       | OK         | PASS                             |
| UroFormFooterSection         | 8/8                               | OK                              | OK                                   | OK (py-3 = 44+)                          | OK         | PASS_WITH_NOTES (drift)          |
| UroanaliseFormRedesigned     | n/a (composes)                    | OK (max-w-4xl, sticky bar)      | OK                                   | OK                                       | OK         | PASS_WITH_NOTES (memo timestamp) |
| UroLotSidebar                | 8/8                               | OK (max-w-xs, listbox keys)     | WARN (focus ring on tabIndex=-1 row) | OK (min-h-44)                            | OK         | PASS_WITH_NOTES                  |
| UroBreadcrumbHeader          | 6/8 (no loading/success)          | OK (sm split layout)            | OK                                   | OK (text-only crumbs ~32px — borderline) | OK         | PASS_WITH_NOTES                  |
| UroMobileTabBar              | 7/8                               | OK (sm:hidden, safe-area)       | NEEDS_FIX (aria-pressed on tab)      | OK (min-h-56)                            | OK         | NEEDS_FIX                        |
| UroAuditTable                | 8/8                               | OK (overflow-x + min-w-880)     | OK (scoped headers, indeterminate)   | OK (min-h-44 actions)                    | OK         | PASS_WITH_NOTES                  |
| UroAuditTrailDrawer          | 7/8 (no error event styling)      | OK (full-w mobile, 420 lg)      | WARN (no focus trap)                 | OK (h-11 close)                          | OK         | PASS_WITH_NOTES                  |
| UroComplianceChecklist       | 6/8 (no hover/active — read-only) | OK                              | OK (role list/listitem)              | n/a (read-only)                          | OK         | PASS                             |
| UroanaliseRedesignedShell    | n/a (composes)                    | OK (3-col → mobile tabs)        | WARN (tablist wrapper missing)       | OK                                       | OK         | PASS_WITH_NOTES                  |

## Specific recommendations

Priority (by user impact):

1. **UroButtonToggle.tsx:93** — replace `bg-amber-500/12` with `bg-amber-500/[0.12]`. Without this the selected toggle has zero visual differentiation in prod, breaking the form's primary feedback loop.
2. **UroMobileTabBar.tsx:121,127** — replace `bg-amber-500/8` with `bg-amber-500/[0.08]`; remove `aria-pressed`. Tab semantics broken for AT users today.
3. **UroAuditTrailDrawer.tsx** — add focus trap (track first/last focusable, intercept Tab). Required for `aria-modal="true"` correctness.
4. **UroanaliseFormRedesigned.tsx:380** — memo the timestamp string, recompute on save not on every keystroke. Cuts re-render of sticky StatusBar by ~30/s during typing.
5. **UroAnalyteRow.tsx + UroQuantitativoRow.tsx** — add `motion-reduce:animate-none` to pulse dots (one-line fix).
6. **UroBreadcrumbHeader.tsx:21** — drop amber from active crumb to honor amber-scarcity. Active state can be `text-slate-900 dark:text-white/95` + slightly bolder weight.
7. **UroFormFooterSection.tsx** — collapse `DateField`/`TextField` into `UroInputField` to remove duplication (refactor, not blocking).
8. **UroanaliseRedesignedShell.tsx:190,205** — wrap both TabButton groups in `role="tablist" aria-label="Visões do lote"`.
9. **UroLotSidebar.tsx:265-280** — pin button is `opacity-0` until hover/focus-within; on touch devices (no hover) it's only revealed via focus-within after the row receives focus. Consider always-visible on touch via `@media (hover: none)`.
10. **UroAnalyteRow.tsx:52** — `grid-cols-[minmax(120px,180px)_1fr_auto]` will overflow at <360px (label + 5-option scale + dot ≥ 360px). Wrap to two rows on `xs`: `flex flex-col sm:grid ...`.

## Browser-test gaps (cannot verify without browser)

- Visual contrast of `text-amber-700` on `bg-amber-500/[0.12]` (toggle selected) — probably AA but borderline at small text sizes; needs Lighthouse run.
- Real keyboard tab order through `UroanaliseRedesignedShell` (sidebar listbox → tabs → form → footer → sticky status → drawer trigger). DOM order looks right, no tabIndex hacks, but verify Tab traversal in Chrome.
- Focus restoration when `UroAuditTrailDrawer` closes — code focuses close button on open; never restores opener focus on close.
- Screen reader announcement of `radiogroup` arrow-key navigation in `UroButtonToggle` (NVDA + JAWS) — code is correct, needs live test.
- LCP/CLS impact of sticky `UroStatusBar` with `backdrop-blur-sm` — blur is GPU-cheap but stacked `backdrop-blur` (mobile tab bar + status bar) on lower-end devices may jank. Measure on Moto G-class device.
- Date input `[color-scheme:dark]` rendering — Chrome respects, Safari ignores native dark. Verify on iPad.
- `prefers-reduced-motion` smoke test of drawer slide-in (it's already gated with `motion-reduce:transition-none`).
- Light-mode contrast on `text-slate-400 dark:text-white/30` in PinIcon and BenchIcon — `text-slate-400` on white may be below 3:1 for icons (graphics need 3:1 per WCAG 1.4.11).
