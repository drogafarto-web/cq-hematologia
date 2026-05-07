# Pre-Step 4 Readiness Checklist (5 min)

**Run this checklist 5 minutes before starting STEP_4_SMOKE_TESTS_EXECUTION.md**

---

## Infrastructure (3 min)

### Firebase Console — Cloud Functions
- [ ] All 32 functions show ACTIVE status
  - Go to: `console.firebase.google.com` → hmatologia2 → Cloud Functions
  - Expected: Green ACTIVE badge on every function
  - If grayed out: Refresh page, wait 30s (post-deploy propagation)
  - ⏱️ 60 sec

### Firebase Console — Firestore Rules
- [ ] Rules deployed within last 30 minutes
  - Go to: Firestore → Rules tab
  - Expected: `.deployed` timestamp shows recent timestamp
  - ⏱️ 20 sec

### Firebase Console — Firestore Indexes
- [ ] All composite indexes ENABLED
  - Go to: Firestore → Indexes tab
  - Expected: ≥25 indexes, all ENABLED (no CREATING or ERROR)
  - ⏱️ 20 sec

### Hosting — Web App Load
- [ ] https://hmatologia2.web.app loads without 5xx
  - Open in test browser
  - Expected: App shell renders (logo/nav visible)
  - DevTools Console: 0 ERROR entries (warnings OK)
  - ⏱️ 60 sec

---

## Test Lab Setup (1 min)

### Riopomba Lab Active
- [ ] Lab document exists and is active
  - Firestore: `/labs/riopomba`
  - Expected: Document exists, `active: true`
  - ⏱️ 30 sec

### Test Data Exists
- [ ] Bioquímica materials ≥5
  - Firestore: `/labs/riopomba/bioquimica-materials/`
  - Expected: ≥5 materials in collection
- [ ] SGQ documents ≥10 in draft
  - Firestore: `/labs/riopomba/sgq-documentos/`
  - Expected: ≥10 docs with `status: 'draft'`
  - ⏱️ 30 sec

---

## Monitoring Setup (1 min)

### Cloud Logs Monitor
- [ ] Start background log monitor
  - Windows PowerShell: `.\scripts\monitor-cloud-logs.ps1 -Hours 1 -IntervalMinutes 5`
  - macOS/Linux bash: `bash scripts/monitor-cloud-logs.sh 1 5`
  - Expected: Script prints "Monitoring started..." and runs in background
  - ⏱️ 30 sec

### DevTools Ready
- [ ] Open DevTools in test browser
  - Press **F12** → Console tab
  - Run: Clear console (`Ctrl+L` or button)
  - Expected: Blank console, no errors
  - ⏱️ 30 sec

---

## Timing & Readiness

### Checkpoint
- [ ] Note start time: \_\_ : \_\_ 
  - Allocate **90 min** for execution (30 min core + monitoring + buffer)
- [ ] All items above are ✅

---

## GO / NO-GO Decision

**If ALL checks ✅**  
→ **GO** Proceed to `STEP_4_SMOKE_TESTS_EXECUTION.md`

**If ANY check ❌**  
→ **STOP** — Do not proceed. Troubleshoot:
1. Refresh Firebase console (2–3 sec)
2. Check Firestore path typo (3 sec)
3. Verify lab name matches exactly: `riopomba` (not `Riopomba`)
4. If still failing: Escalate before continuing

---

## Ready to Start Smoke Tests?

- [ ] Yes — all checks pass, infrastructure stable
- [ ] No — something failed, need to troubleshoot

**If YES:** Open `STEP_4_SMOKE_TESTS_EXECUTION.md` and begin.  
**If NO:** Do not proceed. Fix blocker first.

---

**Total checklist time: 5–7 minutes**
