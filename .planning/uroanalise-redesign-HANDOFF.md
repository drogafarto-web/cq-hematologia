---
context: spike_design
project: HC Quality
focus: uroanalise-module-redesign
status: paused_at_crafting
last_updated: 2026-05-08T18:30:00Z
---

# Uroanalise Module Redesign — Handoff

## Current State

**What we just completed:**
1. ✅ PRODUCT.md — strategic context (specialist scientific, RDC compliance, operadores + RTs)
2. ✅ DESIGN.md — visual system (Clinical Dashboard, amber+slate, dark-first)
3. ✅ .impeccable/design.json — sidecar with components, colors, motion, narrative
4. ✅ Design Brief — confirmed and approved (pain points → implementation phases)
5. ✅ UroStatusBar.tsx — first component (color-coded status indicator)

**Where we paused:**
- Mid-craft phase (Phase 1 of 6: Components Base)
- Reason: Context budget at 70% (approaching token limit)
- All design decisions made and locked; implementation is straightforward component composition

## Implementation Roadmap (6 Phases)

### Phase 1: Components Base ✓ Started
- [x] Create UroStatusBar.tsx (paused here)
- [ ] Create UroAnalyteRow.tsx (single-line analito)
- [ ] Create UroInputField.tsx (refined input)
- [ ] Create UroButtonToggle.tsx (nivel N/P)

### Phase 2: Run Entry Form Redesign
- [ ] UroanaliseFormRedesigned.tsx wrapper
- [ ] Integrate status bar (fixed/sticky)
- [ ] Keyboard navigation (Tab/Enter)
- [ ] Validation on blur + real-time status

### Phase 3: Lot List & Navigation
- [ ] Refactor sidebar (favorites + recent)
- [ ] Breadcrumb header (Lot > Run #)
- [ ] Mobile tab bar

### Phase 4: Audit View & Compliance
- [ ] RT audit table (runs + status + signature)
- [ ] Audit trail sidebar
- [ ] Compliance checklist
- [ ] Inline signature flow

### Phase 5: Responsive & Polish
- [ ] Container queries (3 breakpoints)
- [ ] Touch targets (44px)
- [ ] Light mode support
- [ ] All 8 interaction states

### Phase 6: Browser Testing & Iterate
- [ ] Screenshot validation
- [ ] Design brief alignment
- [ ] DESIGN.md audit
- [ ] Critique loop

## Design Pillars (Locked)

| Pillar | Decision | Why | Consequence |
|--------|----------|-----|-------------|
| North Star | Clinical Dashboard | Operator stressed, variable lab light. RT needs audit trail. | Colors, density, interaction follow this |
| Pain Points Solved | Status bar + clarity + org + compliance | All 4 main issues addressed | Status dot (color-coded), layout redesign, hierarchy |
| Color Strategy | Restrained (amber ≤10%) | Medical professional context | Limits accent; forces hierarchy via space+weight |
| Keyboard-Native | Tab advances, Enter submits | Operator can't rely on mouse | Every field handles Tab order |
| Compliance Visible | Audit trail + signature always visible | RDC 978 requirement | Not hidden in modal or deep menu |

## Critical Implementation Rules

**MUST:**
- Preserve all RDC 978 compliance logic (no changes to validation rules)
- Keep Firestore multi-tenant paths unchanged (labs/{labId}/...)
- Use soft-delete only (no deleteDoc calls)
- Maintain signature flow logic (LogicalSignature structure)
- Test responsive (mobile/tablet/desktop) as you build

**MUST NOT:**
- Rewrite UroanaliseView completely (integrate gradually)
- Skip interaction states (default/hover/focus/active/disabled/loading/error/success)
- Add dependencies without justification
- Commit without browser testing

**Optional But Smart:**
- Use storybook or component isolation for testing
- Feature flag the new form (parallel version for A/B testing)
- Screenshot each component at 3 viewports before final integration

## Files to Read (Resume Checklist)

1. ✅ PRODUCT.md — strategic foundation
2. ✅ DESIGN.md — visual & interaction spec
3. ⚠️ Design Brief (in conversation history) — scope + states + open questions
4. ✅ .impeccable/design.json — component reference
5. ⏳ UroanaliseView.tsx (current entry point) — understand structure before integrating

## Uncommitted Files

- `src/features/uroanalise/components/UroStatusBar.tsx` (new, ready to commit)

## Open Questions (Answer During Build)

These still require decisions — DO NOT assume:
1. Tira marca selection timing? (before entry or default to last-used)
2. RT bulk-sign? (multiple runs or one-by-one)
3. Audit trail detail level? (every field or run-level events)
4. Mobile app? (web-first or also native)
5. Offline sync? (capability needed)

## Next Action When Resuming

```bash
1. /gsd-resume-work  # Load full context
2. Create UroAnalyteRow.tsx
3. Create UroInputField.tsx
4. Create UroButtonToggle.tsx
5. Create UroanaliseFormRedesigned.tsx wrapper
6. Integrate into UroanaliseView (test at mobile/tablet/desktop)
7. Iterate until all 8 states work at all viewports
```

**Estimated effort:** 4-6 hours for all 6 phases (component composition is rapid once design is locked).

---

**To resume:** `/gsd-resume-work`
