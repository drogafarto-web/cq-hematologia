---
name: HC Quality - Uroanalise CIQ
description: Clinical dashboard for urinalysis quality control with precision-first dark mode
colors:
  accent-amber: "#f59e0b"
  accent-red: "#ef4444"
  accent-emerald: "#10b981"
  neutral-text-dark: "#0f172a"
  neutral-text-light: "#f9fafb"
  neutral-slate-900: "#0f172a"
  neutral-slate-500: "#64748b"
  neutral-slate-400: "#78909c"
  neutral-slate-200: "#e2e8f0"
  neutral-slate-50: "#f8fafc"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  input-default:
    backgroundColor: "{colors.neutral-slate-50}"
    textColor: "{colors.neutral-text-dark}"
    rounded: "{rounded.xl}"
    padding: "10px 14px"
  input-dark:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    textColor: "rgba(255, 255, 255, 0.9)"
    rounded: "{rounded.xl}"
    padding: "10px 14px"
  button-primary:
    backgroundColor: "{colors.accent-amber}"
    textColor: "{colors.neutral-text-light}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-slate-500}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  button-danger:
    backgroundColor: "{colors.accent-red}"
    textColor: "{colors.neutral-text-light}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: HC Quality — Uroanalise

## 1. Overview

**Creative North Star: "Clinical Dashboard"**

The uroanalise module is a specialist's workbench for quality control analysis. Interface assumes technical expertise. Every element serves precision: operators glance and understand immediately. Dark-first to reduce eye strain in variable lab lighting. No decorative elements. No onboarding in the UI. Design is lean, purposeful, and scientifically restrained.

The system rejects template-SaaS defaults (card grids, hero metrics, gradient text, glassmorphism). It rejects consumer-friendly casualness (pastel colors, playful microinteractions, conversational tone). It looks like it was built by someone who understands urinalysis, not by a design algorithm.

**Key Characteristics:**
- Specialist's interface; zero pedagogical scaffolding
- Dark-first with high contrast for variable lab lighting
- Precision hierarchy: complex data immediately legible
- Restrained color strategy: tinted neutrals + amber accent ≤10%
- Keyboard-native workflow; visual feedback is instant
- Compliance visible: assinatura, auditoria, soft-delete reflected in structure

## 2. Colors

Single accent color used sparingly (≤10% per screen). Neutral palette tinted toward slate (cool, professional). Error and status colors are functional, not decorative.

### Primary (Accent)

- **Amber Alert** (`#f59e0b` / `oklch(70% 0.17 45)`): Selected state, focus, highlights. Guides attention. Used ONLY when an operator choice requires acknowledgment or visual emphasis. High contrast in dark mode.

### Status

- **Emerald Confirm** (`#10b981` / `oklch(65% 0.13 160)`): Valid/passing result. Levey-Jennings conformity. Rare; used only when status is unambiguously positive.
- **Red Error** (`#ef4444` / `oklch(62% 0.19 30)`): Non-conform, rejection, critical alerts. Bold and unavoidable.

### Neutral (Tinted Slate)

- **Slate 900** (`#0f172a`): Text on light; darkest bg in light mode.
- **Slate 500** (`#64748b`): Tertiary text, disabled state, dimmed labels.
- **Slate 400** (`#78909c`): Faint text, hints, sublabels (e.g., measure unit, optional marker).
- **Slate 200** (`#e2e8f0`): Light borders, dividers, faint bg tints in light mode.
- **Slate 50** (`#f8fafc`): Input bg in light mode; very subtle off-white.

### Dark Mode Neutrals (White/Alpha-based)

- **White/90%** (`rgba(255, 255, 255, 0.9)`): Primary text in dark mode. Slightly below white to reduce glare.
- **White/45%** (`rgba(255, 255, 255, 0.45)`): Secondary text, labels, subtle elements.
- **White/30%** (`rgba(255, 255, 255, 0.3)`): Tertiary text, section dividers.
- **White/[6-9]%** (`.06`–`.09`): Input bg, surface tints, faint borders in dark mode.

### Named Rule: The Amber Scarcity Rule

The amber accent is precious. Use it only when visual prominence serves the workflow: selected toggle, focus ring, critical action button. If a screen has more than one amber element, one of them is noise. Audit ruthlessly.

## 3. Typography

**Display Font:** System sans-serif (uses platform default: `SF Pro Display` on macOS/iOS, `Segoe UI` on Windows, fallback `system-ui`)
**Body Font:** Same stack for consistency and speed (no web font load)

**Character:** Utilitarian scientific. No personality traits. High readability in small sizes and variable lighting. Tabular numbers for data tables. Consistent tracking (letter-spacing) across density levels.

### Hierarchy

- **Label / Caption** (`text-xs`, `font-medium`, `tracking-wider`, 11px–12px): Field labels, section headers, sublabels. Uppercase or small-caps where space allows. Maximum contrast.
- **Body / Form Input** (`text-sm`, regular 400, line-height 1.5, 14px): Operator input, data display, form hints. Max line-length ~65ch (not strictly enforced in tight forms).
- **Button** (`text-sm`, `font-semibold`, 14px): Button labels, action text. MUST be legible at actual button size (not smaller).
- **Mono (if needed)** (`font-mono`, `text-xs`): Run codes, timestamps, serial numbers. Not currently in use; reserved for audit trail.

### Named Rule: The Clarity-Through-Scale Rule

Hierarchy via size (≥1.25 ratio) + weight contrast (400 → 500 → 600). No flat scales. Every size step has a purpose. Never use the same size + weight for two different roles.

## 4. Elevation

This system is **flat at rest, raised only on interaction** (hover, focus, selection). Depth comes from color tint (background brightness change) and borders, not shadows.

Shadow use is minimal:
- Hover shadow on selected buttons: `shadow-md shadow-amber-500/20` (subtle; visible under amber button only).
- No drop shadows on cards, panels, or fixed UI chrome.
- Focus rings use border style only, not shadow-based halos.

Dark mode has no shadows; contrast is achieved through borders and tinted backgrounds.

### Named Rule: The Flat-By-Default Rule

Surfaces are flat. Depth is structural (layering via z-index + positioning), not shadow-volumetric. Shadows appear *only* as confirmation feedback (e.g., "this button is pressed"). If you feel the urge to add shadow for "visual interest", stop; that's a sign the layout needs hierarchy work, not decoration.

## 5. Components

### Inputs

- **Style:** Border-based, rounded-xl, light bg in light mode, white/6% bg in dark mode. Border is slate-200 / white/9%.
- **Focus:** Border shifts to amber-500/50, bg brightens (white/8% in dark). Outline: none; border is the affordance.
- **Disabled:** Opacity reduced to 40%. No change in color.
- **Error:** Border shifts to red-400/60 in light mode, red-400/40 in dark mode. Background unchanged.
- **Placeholder:** slate-400 / white/20%.

### Buttons

- **Shape:** Border radius varies by context: xl (16px) for secondary, lg (12px) for primary action.
- **Primary:** Amber bg, white text, semibold. Padding 12px 16px. On press: scale 0.96 with spring ease. No border.
- **Secondary:** Transparent bg, slate-400 text, border slate-200 / white/9%. On hover: border brightens, text darkens. No fill.
- **Danger (non-conform):** Red bg, white text, semibold. Padding 12px 16px. Used sparingly.
- **Toggle (nivel/status buttons):** Border-based. Selected state: amber tinted bg + amber border. Unselected: neutral border. Text color changes to match selection state. Padding 12px 14px.

### Fields & Toggles

- **Label:** text-xs, font-medium, slate-500 / white/45%, uppercase tracking. Appears above input.
- **Validation marker:** Required (*) in red; optional hints in slate-400 / white/25%.
- **Toggle/radio pattern:** Button grid with amber selection highlight. Each option is a small button (52px min-width). Grouped in flexbox with gap-1.5.

### Status Dot

Used in lot lists to signal overall CIQ status:
- **sem_dados** (gray): No data yet.
- **válido** (emerald): All runs passing.
- **atenção** (amber): Warning-level deviation.
- **reprovado** (red): Non-conform, requires investigation.

Dots are 8–12px, no shadows, pure solid color. Clear, unambiguous.

### Section Titles

- **Style:** text-11px, font-semibold, uppercase, tracking-wider. Color: slate-400 in light mode, white/30% in dark.
- **Spacing:** mb-3 below title; clear visual break.
- **Hint (optional):** text-10px, slate-400 / white/25%, floated right. Used for units, "(optional)", or brief context.

## 6. Do's and Don'ts

### Do:

- **Do** use amber sparingly. One accent element per logical grouping; no more than two per screen section.
- **Do** make validation immediate and visible. Error borders + error text; no spinner purgatory.
- **Do** respect `prefers-reduced-motion`. Test with motion off; animations are enhancement, not gating.
- **Do** tabular-nums in data tables and number fields (font-variant-numeric: tabular-nums). Columns stay aligned.
- **Do** use high contrast borders and text. WCAG AA is minimum; lab lighting demands AA+ (4.5:1 text, 3:1 large).
- **Do** keep keyboard navigation first. Tab order must match visual left-to-right, top-to-bottom. No JavaScript tab-order hacks.
- **Do** label every button, even if it's icon-only. Aria-label required; visually adjacent label is better.
- **Do** place compliance markers (assinatura, audit trail) in a consistent, visible location. Not hidden in a menu.

### Don't:

- **Don't** use side-stripe borders (border-left / border-right > 1px) as colored accents. Rewrite with full borders or background tints.
- **Don't** add gradient text (background-clip: text + gradient). Use solid color + weight/size for emphasis.
- **Don't** default to glassmorphism. Blurs are rare and purposeful (one-off hero), or nothing.
- **Don't** create card grids with identical icon + heading + text. That's SaaS-template default. If you're using cards, make each one distinct in its function or visual treatment.
- **Don't** use modals as the first thought. Inline edit, progressive disclosure, or a separate screen are often better.
- **Don't** decorate with pastel colors or playful microinteractions. This is not a lifestyle app; it's a precision instrument.
- **Don't** assume light mode is the default. Dark mode is the primary. Light mode is supported for accessibility; never optimize for light.
- **Don't** use casual/conversational tone in UI copy. Assume expertise. "Confirm níveis" not "Please pick the level of your sample!".
