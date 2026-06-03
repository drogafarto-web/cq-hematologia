# Stream C: Web Vitals Manual Testing Guide

**Date:** 2026-05-05  
**Target:** hmatologia2.web.app (production)

---

## Quick Start

1. Open https://hmatologia2.web.app in Chrome
2. Login with test credentials
3. Navigate to hub
4. Open DevTools (F12)
5. Go to Console tab
6. Run commands below for each module

---

## Testing Each Module

### Module 1: POPs List

**URL:** https://hmatologia2.web.app/hub (POPs tile)

**Instructions:**

1. Navigate to hub
2. Click POPs tile
3. Wait for list to load completely
4. In console, run:

```javascript
// Get Web Vitals summary
window.__web_vitals_summary = getWebVitalsSummary?.() || {};
console.log('POPs List Web Vitals:', window.__web_vitals_summary);

// Expected output:
// {
//   lcp: 1850,     // <2500 is GOOD
//   inp: 145,      // <200 is GOOD
//   cls: 0.05      // <0.1 is GOOD
// }
```

5. Record values in **Baseline Metrics** section below
6. **Interaction test:** Click on a POP item
   - Time the dialog opening
   - Should be <200ms from click to interactive

---

### Module 2: NC List

**URL:** https://hmatologia2.web.app/hub (NC tile)

**Instructions:**

1. Navigate to hub
2. Click NC (Não Conformidades) tile
3. Wait for list to load completely
4. In console, run:

```javascript
// Get Web Vitals summary
console.log('NC List Web Vitals:', getWebVitalsSummary?.());

// Test interaction: Open new NC dialog
// Click "Nova NC" button
// Time how long dialog takes to appear
```

5. Record values in **Baseline Metrics** section below
6. **Interaction test:** Click "Nova NC" button
   - Time the dialog opening
   - Should be <500ms from click to dialog visible

---

### Module 3: Auditoria List

**URL:** https://hmatologia2.web.app/hub (Auditoria tile)

**Instructions:**

1. Navigate to hub
2. Click Auditoria tile
3. Wait for checklist to load completely
4. In console, run:

```javascript
// Get Web Vitals summary
console.log('Auditoria Checklist Web Vitals:', getWebVitalsSummary?.());

// Test interaction: Click a checklist item
// Click checkbox or item row
// Time the state update
```

5. Record values in **Baseline Metrics** section below
6. **Interaction test:** Click checklist item
   - Time how long item changes state
   - Should be <200ms from click to update visible

---

### Module 4: Treinamentos List

**URL:** https://hmatologia2.web.app/hub (Treinamentos tile)

**Instructions:**

1. Navigate to hub
2. Click Treinamentos tile
3. Wait for list to load completely
4. In console, run:

```javascript
// Get Web Vitals summary
console.log('Treinamentos List Web Vitals:', getWebVitalsSummary?.());

// Test interaction: Open training assignment dialog
// Click on a training item
```

5. Record values in **Baseline Metrics** section below
6. **Interaction test:** Click training item to open details
   - Time the dialog opening
   - Should be <500ms from click to dialog visible

---

### Module 5: Biosseguranca Areas

**URL:** https://hmatologia2.web.app/hub (Biosseguranca tile)

**Instructions:**

1. Navigate to hub
2. Click Biosseguranca tile
3. Wait for areas list to load completely
4. In console, run:

```javascript
// Get Web Vitals summary
console.log('Biosseguranca Areas Web Vitals:', getWebVitalsSummary?.());

// Test interaction: Open area details
// Click on an area
```

5. Record values in **Baseline Metrics** section below
6. **Interaction test:** Click area to open details
   - Time the details view opening
   - Should be <500ms from click to content visible

---

## Advanced Testing

### Lighthouse Performance Audit

1. Open Chrome DevTools → Lighthouse tab
2. Configure:
   - Mode: **Mobile**
   - Throttling: **Slow 4G**
   - Clear: ✓ Clear storage
3. Click **Analyze page load**
4. Record scores:

**POPs List:**

- Performance: \_\_\_/100
- LCP: \_\_\_ s
- INP: \_\_\_ ms
- CLS: \_\_\_

**NC List:**

- Performance: \_\_\_/100
- LCP: \_\_\_ s
- INP: \_\_\_ ms
- CLS: \_\_\_

_Repeat for Auditoria, Treinamentos, Biosseguranca_

### Chrome DevTools Performance Profiler

**Purpose:** Identify slow components and interactions

**For LCP investigation:**

1. Open DevTools → Performance tab
2. Click red circle (record)
3. Refresh page
4. Wait for list to load
5. Click stop
6. Look at flame chart for:
   - Long JS execution (>50ms tasks)
   - Layout thrashing
   - Large paint areas

**For INP investigation (interaction):**

1. Open DevTools → Performance tab
2. Click red circle (record)
3. Perform interaction (click button, open dialog)
4. Click stop
5. Look at flame chart:
   - Should see event handler (green)
   - Rendering (purple)
   - Painting (yellow)
   - Total should be <200ms

### Network Tab Analysis

**Purpose:** Identify slow network requests

1. Open DevTools → Network tab
2. Filter: ✓ Disable cache
3. Reload page
4. Look for:
   - Slow Firestore requests (Auth, queries)
   - Large assets (JS, CSS, images)
   - Waterfall chart (dependencies between requests)

**Expected Firestore latency:**

- Auth state: <1s
- Query (single collection): <500ms
- Combined load: <2s

---

## Recording Baseline Metrics

### Template

Fill in as you test each module:

```markdown
## Module: [POPs|NC|Auditoria|Treinamentos|Biosseguranca]

**Date:** 2026-05-05
**Tester:** [Your name]
**Network:** [Wifi/4G/5G] @ [Speed]
**Device:** [Desktop/Mobile]
**Browser:** Chrome v[version]

### Web Vitals

- **LCP:** \_\_\_ ms (target: <2500ms) [GOOD|NEEDS-IMPROVEMENT|POOR]
- **INP:** \_\_\_ ms (target: <200ms) [GOOD|NEEDS-IMPROVEMENT|POOR]
- **CLS:** \_\_\_ (target: <0.1) [GOOD|NEEDS-IMPROVEMENT|POOR]

### Interactions

- **List Load:** \_\_\_ ms
- **Dialog/Details Open:** \_\_\_ ms
- **Click-to-Interactive:** \_\_\_ ms

### Lighthouse Score

- **Performance:** \_\_\_ /100
- **LCP:** \_\_\_ s
- **INP:** \_\_\_ ms
- **CLS:** \_\_\_

### Issues Found

- [ ] Issue 1: [description] → [action needed]
- [ ] Issue 2: [description] → [action needed]

### Notes

[Any observations about performance, visual issues, or bottlenecks]
```

---

## Identifying Blockers

### Common Performance Issues

**1. High LCP (>2.5s)**

**Likely causes:**

- Slow Firestore auth (onAuthStateChanged)
- Large JS bundle not code-split
- Slow network (try with throttling)
- Missing Firestore indexes

**How to debug:**

- Check Network tab for slow Auth requests
- Check DevTools Performance tab for long JS tasks
- Check if component renders before data loads

**Solution:**

- Lazy-load components
- Optimize Firestore queries
- Add Firestore indexes
- Split bundle better

---

**2. High INP (>200ms)**

**Likely causes:**

- Slow event handler
- Large re-render
- Firestore mutation blocking render
- React.memo not applied to list items

**How to debug:**

- Check Performance tab during interaction
- Look for long JS execution (>50ms)
- Check React DevTools Profiler for re-renders

**Solution:**

- Use React.memo on list items
- Move expensive computations to useCallback
- Batch Firestore writes
- Split large renders

---

**3. High CLS (>0.1)**

**Likely causes:**

- Skeleton dimensions don't match content
- Images without width/height
- Fonts loading after render
- DOM manipulations moving content

**How to debug:**

- Look at Lighthouse report
- Use DevTools Console to identify shifting elements
- Check for font-display: swap (should be block or optional)

**Solution:**

- Add width/height to images
- Set skeleton dimensions to match content
- Use font-display: optional for custom fonts
- Avoid inserting elements that shift layout

---

### Firestore Query Performance

**Test query latency:**

1. Open DevTools → Network tab
2. Filter: `firestore`
3. Go to a module that fetches data
4. Look for `v1/projects/hmatologia2/databases/(default)/documents:runQuery`
5. Check response time
6. Should be <500ms

**If >500ms:**

- Query might be missing index
- Check firestore.rules for missing indexes
- Create composite index via Firebase Console

---

## Automated Testing

### Running Locally

```bash
# 1. Build for production locally
npm run build

# 2. Preview production build
npm run preview

# 3. Run Lighthouse via CLI
# First install if not already installed
npm install -g @lhci/cli

# 4. Run audit
lhci autorun --upload.target=temporary-public-storage
```

### Recording Results

Save output to a CSV for tracking over time:

```csv
Date,Module,LCP,INP,CLS,Performance_Score,Blocker
2026-05-05,pops,1850,145,0.05,92,none
2026-05-05,nc,2100,180,0.08,88,slow-query
2026-05-05,auditoria,1950,165,0.06,91,none
2026-05-05,treinamentos,2300,210,0.12,85,high-cls
2026-05-05,biosseguranca,2050,175,0.07,90,none
```

---

## Next Steps

After collecting baseline metrics:

1. **Document findings** in `STREAM-C-WEB-VITALS-FINDINGS.md`
2. **Identify top 3 blockers** by impact
3. **Create optimization plan** for Week 3-4
4. **Set up monitoring** in Firebase Console
5. **Schedule re-test** after optimizations

---

## Support

For questions about specific modules:

- POPs/NC/Auditoria: See `src/features/sgq/CLAUDE.md`
- Treinamentos: See `src/features/treinamentos/CLAUDE.md` (if exists)
- Biosseguranca: See `src/features/biosseguranca/CLAUDE.md` (if exists)

---

**Owner:** Stream C Agent  
**Created:** 2026-05-05
