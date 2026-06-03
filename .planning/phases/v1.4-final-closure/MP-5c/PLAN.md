---
phase: v1.4-final-closure
macro_phase: MP-5c
label: Mobile Refinement — Push notifications + perf + a11y + error boundary
type: execute
model: haiku
escalation_model: sonnet
depends_on: ['MP-4']
parallel_with: ['MP-5a', 'MP-5b']
autonomous: true
human_gates: 0
total_subagents: 4
total_waves: 1
estimated_runtime: 1h
---

# MP-5c — Mobile Refinement (4 SAs in 1 wave)

**Goal:** Polish + performance + accessibility on the existing mobile app. No new feature surface — only quality lift on what already shipped.

**Stack constraints:**

- React Native + Expo SDK 51+
- NativeWind 4 only (no `StyleSheet`)
- Firebase Cloud Messaging via `@react-native-firebase/messaging` or `expo-notifications` (decide based on which is already installed; if neither, prefer `expo-notifications` for managed-workflow compatibility).
- WCAG AA: contrast ratio ≥ 4.5:1 normal text, ≥ 3:1 large; semantic accessibility roles; keyboard/switch-control nav.

**Existing canonical files to read:**

- `hc-quality-mobile/src/screens/Home.tsx`
- `hc-quality-mobile/src/screens/` (all screens for a11y + perf audit scope)
- `hc-quality-mobile/App.tsx` (root for ErrorBoundary integration)
- `hc-quality-mobile/package.json` (verify push lib presence)
- `./CLAUDE.md`, `.claude/rules/performance.md`

---

## Wave 9r-W1 — Polish (4 SAs ‖)

deps: nothing. All 4 SAs dispatch simultaneously.

---

### SA-70 — `hc-quality-mobile/src/features/notifications/pushNotifications.ts`

Firebase Cloud Messaging integration for critical alerts (CAPA deadline, calibration overdue, NC critical).

**Exports obrigatórios:**

```typescript
export type PushPermission = 'granted' | 'denied' | 'undetermined';

export type PushTopic =
  | 'capa-deadline'
  | 'calibracao-overdue'
  | 'nc-critical'
  | 'westgard-reject'
  | 'system-broadcast';

export interface PushPayload {
  topic: PushTopic;
  title: string;
  body: string;
  data: Record<string, string>; // deep-link path, ids
  priority: 'low' | 'normal' | 'high';
}

export async function requestPushPermission(): Promise<PushPermission>;
export async function getDeviceToken(): Promise<string | null>;
export async function registerDeviceForLab(
  uid: string,
  labId: string,
  token: string,
): Promise<void>;
export async function unregisterDevice(uid: string): Promise<void>;
export async function subscribeTopics(topics: PushTopic[]): Promise<void>;
export function onForegroundMessage(handler: (p: PushPayload) => void): () => void; // returns unsubscribe
export function onTapNotification(handler: (p: PushPayload) => void): () => void;
```

**Invariantes:**

- Detect & branch: se `@react-native-firebase/messaging` instalado, usar; senão usar `expo-notifications` + Expo push token.
- `registerDeviceForLab`: escreve `labs/{labId}/push-tokens/{uid}` doc com `{ token, platform, lastSeenAt: Date.now() }`. Soft-delete via `unregisterDevice` (set `deletedAt`, never `deleteDoc`).
- `requestPushPermission` chama `Notifications.requestPermissionsAsync` (Expo) ou `messaging().requestPermission` (RNFB).
- Topic subscription: backed by FCM topics (não cliente-side filtering).
- `onForegroundMessage` retorna função de cleanup (compatible com useEffect).
- Handlers de tap: extraem `data.deepLink` e usam navegador (caller responsabilidade — handler só extrai).
- Sem hardcode de FCM project key — server-side cert config only.

**Files to read:** `hc-quality-mobile/package.json`, `hc-quality-mobile/App.tsx`.

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5c-W1-SA-70): push notifications integration for mobile`

---

### SA-71 — Refactor `hc-quality-mobile/src/screens/Home.tsx` for performance

**Diff scope:**

- Wrap heavy computations in `useMemo`.
- Wrap event handlers passed as props in `useCallback`.
- Convert any `ScrollView` rendering N items to `FlatList` with `keyExtractor`, `getItemLayout` (when item height fixed), `removeClippedSubviews`, `initialNumToRender={8}`, `maxToRenderPerBatch={6}`, `windowSize={10}`.
- Wrap presentational item components with `React.memo` and pure prop comparison.
- Drop unused imports introduced by the diff itself.

**Invariantes:**

- Behavior preserved 100% — no UX regression. NativeWind classes unchanged.
- No new dependencies.
- Cleanup uses Karpathy Surgical Changes rule — touch only what is required for the perf goal. Do not "improve" adjacent code.
- If Home.tsx already uses FlatList correctly and the only issue is missing memoization, scope the diff to memoization only.

**Files to read:** `hc-quality-mobile/src/screens/Home.tsx` (full file). `.claude/rules/performance.md`.

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `perf(MP-5c-W1-SA-71): memoize Home + FlatList virtualization`

---

### SA-72 — A11y audit + fixes across `hc-quality-mobile/src/screens/`

**Output:**

1. Diff fixes inside each screen file as needed.
2. New report file: `hc-quality-mobile/A11Y_REPORT.md`.

**Audit dimensions (per screen):**

- VoiceOver / TalkBack: every interactive element has `accessibilityRole` + `accessibilityLabel` + `accessibilityHint` (when non-obvious).
- Contrast: every text on its background ≥ 4.5:1 (normal) or 3:1 (large >18pt). Tool: `wcag-contrast` evaluation against tailwind tokens. Document any violation.
- Focus order: tab order matches visual order.
- Touch targets: minimum 44×44 (iOS) / 48×48 (Android). Inflate via `hitSlop` if visual is smaller.
- Dynamic type: text scales with `accessibilityFontScaleFactor`.
- Reduced motion: animations gated via `AccessibilityInfo.isReduceMotionEnabled()`.
- Headings: each screen has a single `accessibilityRole="header"` h1; subsections use `header` with appropriate level if RN supports.

**A11Y_REPORT.md required sections:**

```markdown
# Mobile A11y Audit — MP-5c

## Audit date

## Screens audited (list)

## Findings table — per-screen rows: dimension / status / fix-applied / commit-ref

## Compliance summary — WCAG AA pass rate (% of dimensions across all screens)

## Manual verification checklist (3-step VoiceOver smoke)

## Open issues (if any) routed to next milestone
```

**Invariantes:**

- Every screen file in `hc-quality-mobile/src/screens/` audited. (List them in the report.)
- WCAG AA target: 100% on contrast + role+label dimensions. Trade-offs (e.g. dynamic type breaking layout) documented in "Open issues".
- All new `accessibilityLabel` strings in Portuguese-BR (project default).

**Files to read:** all screen files in `hc-quality-mobile/src/screens/`, `hc-quality-mobile/tailwind.config.js` (for color tokens), `./CLAUDE.md`.

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$' && test -f hc-quality-mobile/A11Y_REPORT.md && wc -l hc-quality-mobile/A11Y_REPORT.md | awk '$1 >= 80 { exit 0 } { exit 1 }'`

**Commit:** `a11y(MP-5c-W1-SA-72): WCAG AA audit + fixes across mobile screens`

---

### SA-73 — `hc-quality-mobile/src/utils/errorBoundary.tsx`

Reusable React error boundary with Sentry integration; integrate into all screens.

**Exports obrigatórios:**

```typescript
import { ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  context?: string; // e.g. 'Home', 'AnalyticsDashboard' — sent to Sentry
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, { error?: Error }> {
  // standard componentDidCatch + getDerivedStateFromError
}

export function DefaultErrorFallback(props: {
  error: Error;
  reset: () => void;
  context?: string;
}): JSX.Element;

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context: string,
): React.ComponentType<P>;
```

**Invariantes (boundary behavior):**

- `componentDidCatch(error, info)`: chama `Sentry.captureException(error, { tags: { context, platform: Platform.OS }, extra: info })`. Sentry import condicional: se `@sentry/react-native` ausente, log via `console.error` apenas.
- `getDerivedStateFromError`: set `state.error`.
- Fallback default: NativeWind dark-first card com título "Algo deu errado", error message truncated 200 chars, botão "Tentar novamente" que chama `reset()` (set error: undefined).
- WCAG AA: fallback usa `accessibilityRole="alert"`, contrast verificado.
- `withErrorBoundary` HOC para wrap de screens — display name `withErrorBoundary(${Component.displayName})`.

**Integration scope (modify these files to wrap each screen):**

- `hc-quality-mobile/App.tsx` — root `<ErrorBoundary context="App">` envolvendo navigation.
- Each screen registered in navigator → wrap with `withErrorBoundary(Screen, 'ScreenName')`.

**Invariantes (integration):**

- Diff to App.tsx + navigator file is minimal — ONLY wrap, don't refactor.
- New screens (AnalyticsDashboard from MP-5b SA-68) also wrapped.

**Files to read:** `hc-quality-mobile/App.tsx`, `hc-quality-mobile/src/navigation/` se existir (root navigator), `hc-quality-mobile/package.json` (verify @sentry/react-native presence — se ausente, install instructions vão no commit message).

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$' && grep -l 'withErrorBoundary\|ErrorBoundary' hc-quality-mobile/App.tsx | head -1`

**Commit:** `feat(MP-5c-W1-SA-73): error boundary + Sentry integration for all screens`

---

## MP-5c Master Verification Gate

| Gate                       | Pass criteria                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **G-Build**                | `cd hc-quality-mobile && npx tsc --noEmit` exit 0                                                                        |
| **G-NativeWind**           | `grep -r 'StyleSheet.create' hc-quality-mobile/src/screens/ hc-quality-mobile/src/utils/errorBoundary.tsx` → 0 hits      |
| **G-A11y-Report**          | `hc-quality-mobile/A11Y_REPORT.md` exists with ≥80 lines + compliance summary section                                    |
| **G-A11y-Violations**      | A11y report shows 0 contrast violations + 100% role+label coverage                                                       |
| **G-Push-Lib**             | `expo-notifications` OR `@react-native-firebase/messaging` listed in `hc-quality-mobile/package.json`                    |
| **G-Boundary-Integration** | `App.tsx` uses `<ErrorBoundary>` at root (grep enforced)                                                                 |
| **G-Lighthouse-Mobile**    | Lighthouse mobile score ≥85 (manual run on web parity if applicable; mobile-native excluído pois Lighthouse não suporta) |
| **G-Push-Delivery**        | Manual smoke: send test push from FCM console → device receives notification (logged in MP-8 deploy checklist)           |

`G-Lighthouse-Mobile` and `G-Push-Delivery` are manual gates documented in MP-8 deploy checklist; they do NOT block MP-5c automated completion. The other gates are blocking.
