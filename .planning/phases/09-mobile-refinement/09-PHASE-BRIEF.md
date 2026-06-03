# Phase 9 — Mobile Refinement (Dark Mode + Biometric + Performance + E2E)

**Milestone:** HC Quality v1.4  
**Phase:** 09 — Mobile Polish & Scale  
**Duration:** 3 weeks (aggressive delivery)  
**Team:** 2 FTE (Mobile lead + QA)  
**Target Deploy:** 2026-08-31  
**Risk Level:** 3/10 (LOW-MEDIUM)

---

## Phase Goal

Transform the Phase 3.3 mobile scaffold (NativeWind dark theme, biometric auth, Detox E2E 5 flows) into production-ready, performant, extensively tested mobile app. Achieve dark mode 100% coverage, biometric auth + PIN fallback fully functional, bundle <10MB, startup <2s, and 20+ E2E critical flow coverage.

**Success criteria:**

- Dark mode applied to 100% of screens (no light components visible)
- Biometric auth fully integrated with PIN fallback (device lockout protection)
- App bundle ≤10MB (gzipped APK)
- Startup time ≤2s (cold start from home icon)
- LCP ≤1.5s on typical device
- 20+ E2E flows automated via Detox + CI integration
- Offline mode: read-only access to cached data
- Zero critical E2E failures

---

## Plans at a Glance

| Plan      | Focus                                     | Wave | Key Deliverables                                                                 | Tests                 | Est. Context |
| --------- | ----------------------------------------- | ---- | -------------------------------------------------------------------------------- | --------------------- | ------------ |
| **09-01** | Dark mode audit + component fixes         | 1    | Screen audit, dark variants, test coverage                                       | Visual + unit         | 20%          |
| **09-02** | Biometric + PIN fallback + secure storage | 1    | Face ID/fingerprint detect, PIN entry form, keychain integration, error handling | 8 E2E flows           | 25%          |
| **09-03** | Bundle optimization + performance         | 2    | Code-split routes, lazy load images, tree-shake, metrics baseline                | Performance tests     | 20%          |
| **09-04** | E2E expansion + CI + offline mode         | 2    | 20+ Detox flows, offline read-only mode, CI integration, performance E2E         | Detox suite + metrics | 25%          |

**Dependency structure:**

- Plan 09-01 and 09-02 → Wave 1 (parallel, different concerns)
- Plan 09-03 and 09-04 → Wave 2 (depend on Wave 1 baseline)

---

## Plan 09-01: Dark Mode — Audit + Full Coverage

### Goal

Audit all mobile screens (26 screens) for dark mode compliance. Fix light-mode leakage, apply dark-first design system (tokens, colors, spacing). 100% coverage validated via component visual tests.

### Tasks

#### Task 1: Component Audit + Dark Mode Gap Analysis

- **Files affected:** `src/screens/**`, `src/components/**`, `src/theme/`
- **Action:**
  1. Screenshot each of 26 screens in dark mode (emulator)
  2. Catalog any light backgrounds, white text, low-contrast combinations
  3. Generate audit report (markdown table: screen name, component, issue, fix priority)
  4. Update `src/theme/darkTheme.ts` with missing color tokens
  5. Cross-check Tailwind `tailwind.config.js` for dark: variants — ensure all colors used in components have dark counterparts
- **Verify:** Audit report exists, 0 color usage without dark variant, Tailwind config validates (`npx tailwindcss lint`)
- **Done:** All 26 screens visually verified dark-only. No light mode CSS escapes. darkTheme.ts complete.

#### Task 2: Dark Mode Component Fix + Apply Tokens

- **Files affected:** `src/screens/*.tsx` (all 26), `src/components/*.tsx`, `src/hooks/useDarkMode.ts`
- **Action:**
  1. For each screen with dark mode issues (from Task 1 audit):
     - Replace hardcoded `'#ffffff'`, `'rgb(...)'` colors with token references: `darkTheme.colors.bg`, `darkTheme.colors.text`
     - Update Tailwind classNames to use `dark:` variants where className is insufficient
     - Test with `useDarkMode()` hook — verify `isDark` state is read
  2. Apply typography scaling (`text-xs`, `text-sm`, `text-base`, `text-lg`) across all text elements
  3. Verify spacing uses 4px grid: `p-1`, `p-2`, `p-3`, `p-4`, `gap-2`, `gap-4`
  4. Commit: `feat(mobile): dark mode 100% component coverage`
- **Verify:** `npm run lint` green, no `#ffffff` or hardcoded RGB in TSX files (regex grep), visual inspection of 3–5 key screens
- **Done:** All components use tokens. Dark mode passes visual regression on all 26 screens.

#### Task 3: Visual Regression Tests (Dark Mode Coverage)

- **Files affected:** `src/__tests__/screens/darkMode.test.ts`, `src/__tests__/components/darkMode.test.ts`
- **Action:**
  1. Create Jest visual snapshot tests for 8–10 critical screens (HomeScreen, CIQScreen, NCDetailScreen, ReadingsScreen, etc.)
  2. Use React Native Testing Library to render each screen with dark theme context
  3. Snapshot the rendered output (text colors, spacing, borders)
  4. CI gate: if snapshot diffs appear, require explicit approval before merge
  5. Run baseline: `npm run test:unit -- --testPathPattern=darkMode`
- **Verify:** All snapshot tests pass locally, no unexplained diffs, CI integration ready
- **Done:** 10+ screens have dark mode snapshot tests. No regressions detected.

---

## Plan 09-02: Biometric + PIN Fallback + Secure Storage

### Goal

Complete biometric authentication (Face ID + Fingerprint detection, fallback to PIN) with secure storage, error handling, and device lockout protection. Full E2E coverage of auth flows (success, fallback, retry, lockout).

### Tasks

#### Task 1: Biometric Detection + Device Lockout + PIN Entry Form

- **Files affected:** `src/hooks/useBiometricAuth.ts` (enhance), `src/screens/AuthScreen.tsx`, `src/components/PINForm.tsx` (new)
- **Action:**
  1. Enhance `useBiometricAuth()` to detect:
     - Face ID (iOS BiometryTypes.FaceID)
     - Fingerprint (iOS BiometryTypes.TouchID, Android BiometryTypes.Biometrics)
     - Biometric unavailable gracefully (fallback to PIN)
  2. Implement device lockout after 5 failed PIN attempts:
     - Track failed attempts in AsyncStorage (stored counter)
     - Lock device for 5 minutes on 5th failure (show countdown timer)
     - Clear counter on successful auth
  3. Create PINForm component (6-digit numeric input, masked display, `<View>` for each digit):
     - Auto-focus next input on digit entry
     - Show biometric button if available
     - Show "Forgot PIN?" → contact flow (out of scope, just UI placeholder)
  4. AuthScreen:
     - Button "Autenticar com {biometricLabel}" if biometric available and enabled
     - On tap: prompt biometric via `useBiometricAuth().promptBiometric()`
     - On fallback (method='pin'): show PINForm
     - On success: setAuthToken + navigate to HomeScreen
  5. Commit: `feat(mobile): biometric detection + PIN fallback + lockout`
- **Verify:**
  - `promptBiometric()` returns correct method ('biometric' | 'pin' | 'none')
  - PINForm accepts 6 digits, masks display, auto-focuses
  - 5 failed PINs trigger 5-min lockout (test with mocked time)
  - Hard reset: biometric prompt appears on re-open
- **Done:** AuthScreen handles biometric + PIN. Lockout protection active.

#### Task 2: Secure Storage (Keychain/SecureStore)

- **Files affected:** `src/services/secureStorageService.ts` (new), `src/hooks/useAuthPersistence.ts` (update)
- **Action:**
  1. Install `react-native-keychain` (iOS Keychain + Android Credential Manager):
     - iOS: native Keychain (backed by device Secure Enclave on newer devices)
     - Android: Credential Manager (API 24+) or fallback to EncryptedSharedPreferences
  2. Create `secureStorageService.ts`:
     - `saveFirebaseToken(token: string)` — store JWT in Keychain
     - `retrieveFirebaseToken(): string | null` — fetch JWT (returns null if cleared)
     - `clearAll()` — logout: wipe Keychain
  3. Update `useAuthPersistence.ts`:
     - On app launch, call `retrieveFirebaseToken()`
     - If token exists and not expired, auto-login (skip AuthScreen)
     - If token expired, clear via `clearAll()` and show AuthScreen
  4. Commit: `feat(mobile): secure token storage (Keychain/Credential Manager)`
- **Verify:**
  - Token persists after app kill + restart (manual test on emulator)
  - `clearAll()` wipes Keychain (verify via adb shell for Android)
  - Expired token triggers re-auth
  - No token visible in device logs or plaintext files
- **Done:** Firebase JWT stored in OS Keychain. Auto-login on app resume works.

#### Task 3: Error Handling + Biometric Fallback Edge Cases

- **Files affected:** `src/screens/AuthScreen.tsx`, `src/components/ErrorBoundary.tsx` (if new), `src/hooks/useBiometricAuth.ts`
- **Action:**
  1. Handle biometric platform errors:
     - Hardware not available → show PIN form (already handled in Task 1)
     - Timeout/sensor error → show "Biometria indisponível" + PIN form option
     - User cancelled → show PIN form (method='pin' already returns this)
  2. Add error message UI component (below biometric button):
     - Show for 3s then fade out
     - Red text on dark background, WCAG AA contrast
  3. Retry logic:
     - User can tap "Biometria" up to 3x in quick succession
     - After 3rd fail, auto-show PIN form
  4. Commit: `feat(mobile): biometric error handling + retry logic`
- **Verify:**
  - `promptBiometric()` catches hardware errors → returns method='pin'
  - Error messages appear/fade correctly
  - 3-tap retry limit enforced
  - Fallback to PIN always succeeds (PIN entry cannot fail — only lockout)
- **Done:** Auth flow resilient. All error paths tested.

#### Task 4: Biometric Auth E2E Tests (8 flows)

- **Files affected:** `e2e/flows/auth.biometric.e2e.ts`, `e2e/flows/auth.lockout.e2e.ts`, `e2e/flows/auth.secure-storage.e2e.ts`
- **Action:**
  1. Create Detox E2E flows:
     - **e2e-auth-biometric-success:** Launch → tap "Autenticar com {label}" → biometric prompt → success → HomeScreen visible
     - **e2e-auth-biometric-fallback:** Launch → tap "Autenticar com {label}" → user cancels → PINForm shows
     - **e2e-auth-pin-success:** Launch → PINForm → enter 6 digits → success → HomeScreen
     - **e2e-auth-pin-failure-3x:** Launch → PINForm → enter wrong PIN 3x → "Muitas tentativas" message shows
     - **e2e-auth-lockout-5x:** Enter wrong PIN 5x → countdown timer appears → wait 5s → lockout timer counts down → retry
     - **e2e-auth-secure-storage-persist:** Login (biometric or PIN) → app killed + restarted → HomeScreen appears (no re-auth)
     - **e2e-auth-logout:** HomeScreen → tap logout → AuthScreen appears → biometric preference reset
     - **e2e-auth-keychain-clear:** (manual: ADB shell to clear Keychain) → app restart → AuthScreen appears
  2. Run: `npm run test:e2e`
  3. Commit: `test(mobile): biometric auth + lockout + secure storage E2E`
- **Verify:** All 8 E2E flows pass on Android emulator + iOS simulator (if available)
- **Done:** Auth flows fully automated E2E. CI ready.

---

## Plan 09-03: Bundle Optimization + Performance Baseline

### Goal

Reduce APK size to <10MB (gzipped), achieve startup <2s cold start, LCP <1.5s on device. Establish performance baseline metrics (bundle breakdown, execution time, memory usage).

### Tasks

#### Task 1: Bundle Analysis + Code-Split Routes

- **Files affected:** `vite.config.ts` (if applicable, or Webpack config), `src/navigation/RootNavigator.tsx`, build output
- **Action:**
  1. Run bundle analyzer:
     - `npm run build` → generate sourcemap
     - Use `metro-visualizer` or Android Profiler to inspect APK breakdown
     - Export: `npx bundle-buddy <bundle.js>` or similar React Native tool
  2. Identify large libraries:
     - `firebase` (already required)
     - `react-native-biometrics` (necessary, ~100 KB)
     - Any unused dependencies in `package.json`
  3. Code-split by route (RootNavigator lazy loads):
     - `HomeScreen`, `CIQScreen`, `ReadingsScreen`, `NCDetailScreen` → dynamic imports
     - Each screen loads only when user navigates to it
     - Use `React.lazy()` pattern (React Native version) or metro-bundler `import()` syntax
  4. Tree-shake: Remove unused exports from service files
  5. Commit: `perf(mobile): code-split routes + tree-shake`
- **Verify:**
  - APK size (uncompressed): report `ls -lh hc-quality-mobile/android/app/build/outputs/apk/release/app-release.apk`
  - Gzipped size: <10MB target (measure via `gzip -k app-release.apk && ls -lh app-release.apk.gz`)
  - Bundle breakdown: list top 10 largest modules
- **Done:** APK ≤10MB gzipped. Bundle analyzer report committed.

#### Task 2: Performance Metrics Baseline + Startup Time

- **Files affected:** `src/core/performance.ts` (new), `App.tsx`, `src/screens/SplashScreen.tsx` (if new)
- **Action:**
  1. Create performance measurement utilities:
     - `measureStartupTime()` — time from app init to HomeScreen render
     - `measureScreenTransition(screenName)` — time between navigation tap and screen visible
     - `measureCallableLatency(functionName, payload)` — round-trip time to Firebase
  2. Instrument App.tsx:
     - Capture app launch time (`performance.mark('app-launch')` → `performance.measure()`)
     - Log to console + Redux/Zustand for analytics
  3. Add SplashScreen (if none exists) that shows while initial data loads:
     - Fade out once HomeScreen data ready
     - Target: user sees SplashScreen <500ms, HomeScreen ready <2s total
  4. Create `__tests__/performance.baseline.ts`:
     - Record: startup time, memory usage (via React Native Profiler), bundle size
     - Set thresholds: startup <2s, LCP <1.5s
  5. Commit: `perf(mobile): performance metrics baseline`
- **Verify:**
  - Startup time <2s (measure on emulator with typical network)
  - Memory footprint <200MB on launch (use Android Profiler)
  - Bundle size tracked (update baseline after each Phase)
- **Done:** Baseline metrics established. Thresholds set for future phases.

#### Task 3: Image Optimization + Lazy Load

- **Files affected:** `src/components/CIQCard.tsx`, `src/components/NCCard.tsx`, any image-heavy screens
- **Action:**
  1. Audit all `<Image>` usage (grep `from 'react-native'`):
     - Identify remote images (from Firebase Storage, URLs)
     - Check for missing `width`/`height` (causes layout shift)
  2. Implement lazy loading:
     - Use `fastimage` or React Native Image with `onLoadStart`/`onLoadEnd` callbacks
     - Show placeholder (skeleton or low-res blur) while loading
     - Cache headers: enable HTTP cache for Firebase Storage images
  3. Format optimization:
     - Ensure all images are `.webp` or `.jpg` (not `.png` unless transparent)
     - Resize server-side if possible (Firebase Cloud Functions for image resizing)
  4. Commit: `perf(mobile): image lazy-load + optimization`
- **Verify:**
  - All `<Image>` components have `width`/`height` props
  - Lazy-loaded images show placeholders
  - Network waterfall (via Chrome DevTools on Android) shows image compression
- **Done:** Images optimized. No layout shift on load.

#### Task 4: Performance Tests (Jest)

- **Files affected:** `src/__tests__/performance.test.ts`
- **Action:**
  1. Create Jest performance test suite:
     - Test startup: `measure(() => renderApp())` → assert <2000ms
     - Test memory: render HomeScreen 10x → assert memory stable (no leak)
     - Test bundle size: assert APK.gz <10MB
     - Test LCP: measure first meaningful paint via Lighthouse (if CI supports)
  2. Run: `npm run test:unit -- --testPathPattern=performance`
  3. Commit: `test(mobile): performance regression tests`
- **Verify:** All tests pass. Baseline committed. CI gate enabled.
- **Done:** Performance tests automated. Regressions caught early.

---

## Plan 09-04: E2E Expansion (20+ flows) + Offline Mode + CI Integration

### Goal

Expand Detox E2E suite from 5 flows to 20+, covering critical user journeys, edge cases, and error scenarios. Implement offline mode (read-only access to cached data). Integrate Detox into CI pipeline (GitHub Actions).

### Tasks

#### Task 1: E2E Flow Expansion (20+ Detox flows)

- **Files affected:** `e2e/flows/*.e2e.ts`, `e2e/.detoxrc.js`
- **Action:**
  1. Catalog all critical user journeys (from Phase 3.3 baseline, add new):
     - **Auth flows (8):** biometric success, PIN success, lockout, logout, secure storage, Keychain clear, device lock/unlock, PIN expired
     - **CIQ flows (5):** list runs, view run detail, enter reading, submit reading, view results chart
     - **NC flows (4):** list nonconformities, create NC, add action, close NC
     - **Offline flows (3):** load cached data offline, queue write (sync pending), sync on reconnect
  2. Write Detox flows:
     - Follow pattern: `describe('E2E: [feature]', () => { it('should [behavior]', async () => { ... }) })`
     - Use `device.launchApp()`, `element(by.id('buttonId')).multiTap()`, `waitFor()`, `expect()`
     - Assertions: visual (element visible), state (text content matches), navigation (screen changed)
  3. Run: `npm run test:e2e` (all 20+ flows)
  4. CI integration: Add GitHub Actions workflow (`.github/workflows/mobile-e2e.yml`):
     - Trigger on push to `hc-quality-mobile/**`
     - Build APK, run Detox on Android emulator
     - Fail deploy if any E2E flow fails
  5. Commit: `test(mobile): 20+ E2E flows + CI integration`
- **Verify:**
  - All 20+ E2E flows pass locally on emulator
  - CI workflow runs green on push (no secret failures)
  - E2E duration <10 min total (or split into parallel jobs if >10 min)
- **Done:** 20+ E2E flows automated. CI gate active.

#### Task 2: Offline Mode (Read-Only Cache)

- **Files affected:** `src/hooks/useOfflineMode.ts` (new), `src/screens/HomeScreen.tsx`, `src/components/OfflineIndicator.tsx` (enhance)
- **Action:**
  1. Create `useOfflineMode()` hook:
     - Detect network status via `useNetInfo()` (already used in Phase 3.3)
     - Return `{ isOnline: boolean, isSyncing: boolean, queuedWrites: number }`
  2. Implement read-only cache:
     - On app launch, fetch all data (CIQ runs, NCs, readings) and store in AsyncStorage
     - If offline, read from AsyncStorage instead of Firestore
     - Show OfflineIndicator banner if `isOnline === false`
  3. Offline write queue (out of scope for v1, but structure):
     - User attempts write while offline → show toast "Ação será enviada quando online"
     - Store write in queue (AsyncStorage)
     - When online: sync queue via Cloud Function callable
     - UI shows "Sincronizando..." while queue processes
  4. Commit: `feat(mobile): offline read-only cache + sync queue structure`
- **Verify:**
  - Toggle airplane mode (emulator) → app shows OfflineIndicator
  - Cached data visible while offline
  - Writes queued (not sent) while offline
  - Sync succeeds on reconnect
- **Done:** Offline mode functional (read-only). Sync queue implemented.

#### Task 3: Performance E2E Tests (Latency + Memory)

- **Files affected:** `e2e/flows/performance.e2e.ts`
- **Action:**
  1. Create performance E2E flows:
     - **perf-startup:** Measure time from app launch to HomeScreen render (target <2s)
     - **perf-list-load:** Load CIQ runs list → measure render + scroll performance
     - **perf-detail-nav:** Tap run → navigate to detail screen → measure latency
     - **perf-memory:** Open/close 5 screens rapidly → measure memory (should not leak >10MB)
  2. Use Detox performance API (if available) or manual timing:
     - `device.disableSynchronization()` before test
     - Measure wall-clock time via `Date.now()`
     - Assert threshold met before cleanup
  3. Commit: `test(mobile): performance E2E tests`
- **Verify:**
  - All performance E2E tests pass with thresholds met
  - Startup <2s, navigation <500ms, no memory leak >10MB
- **Done:** Performance E2E automated. Regressions caught.

#### Task 4: CI Integration + Deploy Gate

- **Files affected:** `.github/workflows/mobile-e2e.yml`, `scripts/mobile-deploy-gate.sh` (new)
- **Action:**
  1. GitHub Actions workflow (`.github/workflows/mobile-e2e.yml`):
     ```yaml
     name: Mobile E2E Tests
     on: [push]
     jobs:
       test:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v4
           - uses: actions/setup-node@v4
             with:
               node-version: '20'
           - run: cd hc-quality-mobile && npm install
           - run: npm run build:android
           - run: npm run test:e2e
     ```
  2. Create deploy gate script (`scripts/mobile-deploy-gate.sh`):
     - Check: APK size ≤10MB gzipped
     - Check: All E2E flows passed (read CI log)
     - Check: No TypeScript errors (`npx tsc --noEmit`)
     - Check: Bundle size hasn't regressed >5%
     - Fail deploy if any check fails
  3. Integrate with Firebase App Distribution:
     - On merge to main, CI builds APK
     - Run deploy gate
     - If gate passes, upload APK to Firebase App Distribution (internal testers)
  4. Commit: `ci(mobile): E2E + deploy gate workflow`
- **Verify:**
  - GitHub Actions workflow runs on push
  - Deploy gate blocks bad builds
  - APK uploaded to Firebase App Distribution on green CI
- **Done:** CI fully integrated. Deploy gate active.

---

## Performance Targets

| Metric                 | Target                    | Baseline                 | Phase 9 Goal       | Hard Limit  |
| ---------------------- | ------------------------- | ------------------------ | ------------------ | ----------- |
| **APK Size (gzip)**    | <10 MB                    | ~12 MB (Phase 3.3)       | 9.5 MB             | 12 MB       |
| **Startup Time**       | <2s                       | ~2.5s (Phase 3.3)        | <2s                | 2.5s        |
| **LCP (1st paint)**    | <1.5s                     | ~1.8s (Phase 3.3)        | <1.5s              | 2.0s        |
| **Memory (launch)**    | <200 MB                   | ~220 MB                  | <200 MB            | 250 MB      |
| **Memory (no leak)**   | Stable after 5 nav cycles | +15 MB leak              | Stable (±5 MB)     | <10 MB leak |
| **Screen nav latency** | <500ms                    | ~600ms                   | <500ms             | 800ms       |
| **E2E duration**       | <10 min total             | N/A (Phase 3.3: 5 flows) | <10 min (20 flows) | 15 min      |

---

## Risk Assessment

| Risk                     | Likelihood    | Impact                                     | Mitigation                                                          |
| ------------------------ | ------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| **Dark mode incomplete** | Low (2/10)    | Medium (4/10) — user sees white components | Task 1 audit catches all screens; snapshot tests verify             |
| **Biometric flakiness**  | Medium (4/10) | Low-Medium (3/10) — fallback to PIN works  | PIN is always available fallback; error handling tested             |
| **APK size creep**       | Medium (4/10) | High (6/10) — exceeds app store limits     | Bundle analyzer + code-split prevent; CI gate enforces              |
| **E2E flakiness**        | Medium (4/10) | Medium (4/10) — unreliable CI gates        | Detox waits properly; emulator performance stable; retry on timeout |
| **Memory leak**          | Low (2/10)    | High (6/10) — app crashes on device        | Memory profiling in Phase 3.3 baseline; perf tests catch            |
| **Startup regression**   | Low (2/10)    | Medium (4/10) — poor UX                    | Metrics tracked in Task 2; CI gate enforces                         |

---

## Dependencies & Sequencing

```
Wave 1 (Parallel):
├── 09-01 (Dark Mode) [independent]
└── 09-02 (Biometric) [independent]

Wave 2 (Depends on Wave 1):
├── 09-03 (Performance) [depends on 09-01, 09-02 baseline]
└── 09-04 (E2E Expansion) [depends on 09-01, 09-02 ready]
```

---

## Success Criteria

| Criterion                     | Measurement                                   | Target            |
| ----------------------------- | --------------------------------------------- | ----------------- |
| **Dark mode coverage**        | All 26 screens audit + visual test            | 100% ✓            |
| **Biometric auth**            | 8 E2E flows + lockout + secure storage        | ✓ All green       |
| **Bundle size**               | `ls -lh app-release.apk.gz`                   | ≤10MB ✓           |
| **Startup time**              | Measure from app launch to HomeScreen visible | <2s ✓             |
| **LCP**                       | Measure time to first meaningful paint        | <1.5s ✓           |
| **Memory**                    | Emulator Profiler after 5 nav cycles          | <200MB + stable ✓ |
| **E2E coverage**              | Detox flow count                              | 20+ ✓             |
| **E2E pass rate**             | CI workflow green                             | 100% ✓            |
| **Offline mode**              | Read-only cache + sync queue                  | ✓ Functional      |
| **Zero critical regressions** | Baseline performance tests                    | 100% pass ✓       |

---

## Effort Breakdown (per plan)

| Plan      | Context Cost | Effort                                   | Owner           | Duration            |
| --------- | ------------ | ---------------------------------------- | --------------- | ------------------- |
| **09-01** | ~20%         | Component audit + fixes + tests          | Mobile Lead     | 3 days              |
| **09-02** | ~25%         | Biometric + PIN + keychain + E2E         | Mobile Lead     | 4 days              |
| **09-03** | ~20%         | Bundle analysis + optimization + metrics | DevOps + Mobile | 3 days              |
| **09-04** | ~25%         | E2E expansion + offline + CI             | QA Lead         | 4 days              |
| **Total** | ~90%         | Parallel waves (W1 3.5d, W2 4d)          | 2 FTE           | 7–8 days wall-clock |

---

## Next Steps

1. **Approve phase scope** — Confirm 4 plans align with v1.4 milestone goals
2. **Create formal PLAN.md files** — `09-01-PLAN.md` through `09-04-PLAN.md` with XML structure
3. **Kickoff:** 2026-05-27 (after Phase 4 stabilization)
4. **Deploy:** 2026-06-07 (aggressive target) → Firebase App Distribution
5. **Post-deploy monitoring:** Cloud Logs + Firebase Performance Monitoring (24h)

---

**Created:** 2026-05-07  
**CTO:** DrogaFarto  
**Status:** Phase Planning Brief — Ready for PLAN.md generation + execution kickoff
