---
phase: v1.4-final-closure
macro_phase: MP-5b
label: Mobile Analytics — Biometric auth + offline sync + analytics dashboard
type: execute
model: haiku
escalation_model: sonnet
depends_on: ["MP-4"]
parallel_with: ["MP-5a", "MP-5c"]
autonomous: true
human_gates: 0
total_subagents: 5
total_waves: 2
estimated_runtime: 1h
---

# MP-5b — Mobile Analytics (5 SAs across 2 waves)

**Goal:** Add an analytics dashboard to `hc-quality-mobile/` (React Native + NativeWind + Detox), wired to biometric auth and an offline-first sync queue.

**Stack constraints (project rules):**
- React Native (Expo SDK 51+, RN 0.74+)
- NativeWind 4 — never `StyleSheet`. Tailwind classes only.
- Detox for E2E (already in repo, see `hc-quality-mobile/e2e/`)
- Firebase JS SDK (multi-tenant via `useActiveLabId`)
- Dark-first; respect `prefers-reduced-motion` (RN Animated.timing with `useNativeDriver`)

**Wave dependency graph:**
```
W1 (auth + sync foundation)        2 SAs ‖
  └─> W2 (engine + dashboard + e2e) 3 SAs ‖
```

**Existing canonical files to read:**
- `hc-quality-mobile/src/screens/Home.tsx` — current screen pattern.
- `hc-quality-mobile/src/services/` — existing Firebase service wrappers if any.
- `hc-quality-mobile/src/store/` — Zustand store (mirror of web `useAuthStore`).
- `hc-quality-mobile/tailwind.config.js` — design tokens (must reuse).
- `hc-quality-mobile/e2e/` — Detox patterns.
- `./CLAUDE.md` — global invariants.

---

## Wave 9m-W1 — Auth & Sync (2 SAs ‖)

deps: nothing. Both SAs dispatch simultaneously.

---

### SA-65 — `hc-quality-mobile/src/features/auth/biometricAuth.ts`

Biometric authentication wrapper around `expo-local-authentication`. Face ID on iOS, fingerprint on Android.

**Exports obrigatórios:**

```typescript
export type BiometricCapability =
  | 'face-id'
  | 'touch-id'
  | 'fingerprint'
  | 'iris'
  | 'none';

export type BiometricAuthResult =
  | { ok: true; method: BiometricCapability }
  | { ok: false; reason: 'not-enrolled' | 'cancelled' | 'lockout' | 'hardware-unavailable' | 'unknown'; native?: string };

export async function detectBiometricCapability(): Promise<BiometricCapability>;
export async function authenticateWithBiometrics(promptMessage: string): Promise<BiometricAuthResult>;
export async function isBiometricEnrolled(): Promise<boolean>;
export async function persistBiometricPreference(uid: string, enabled: boolean): Promise<void>;
export async function loadBiometricPreference(uid: string): Promise<boolean>;
```

**Invariantes:**
- Usa `expo-local-authentication` (`hasHardwareAsync`, `isEnrolledAsync`, `supportedAuthenticationTypesAsync`, `authenticateAsync`).
- Persiste preferência por `uid` em `expo-secure-store` (key: `biometric-pref:{uid}`). Nunca em AsyncStorage.
- `authenticateWithBiometrics` passa `disableDeviceFallback: false` (permite PIN como fallback no lockout).
- Mapeia erros nativos para enum estável (`reason` field) — nunca expõe string nativa exceto via `native` opcional.
- Rejeita `hardware-unavailable` antes de tentar prompt.
- Sem dependência de Firebase — pure expo wrapper.

**Files to read:** `hc-quality-mobile/package.json` (verify expo-local-authentication + expo-secure-store presentes; se não, listar como dep a adicionar via `expo install` no commit message).

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5b-W1-SA-65): biometric auth wrapper for mobile`

---

### SA-66 — `hc-quality-mobile/src/features/sync/offlineSync.ts`

Offline-first sync queue backed by SQLite, with conflict resolution.

**Exports obrigatórios:**

```typescript
export type SyncOperation = 'create' | 'update' | 'softDelete';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface SyncQueueItem {
  id: string;                    // uuid
  labId: string;
  collection: string;            // e.g. 'bioquimica/runs'
  docId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  payloadHash: string;           // SHA-256 hex64
  baseVersion: number;           // server version at the time the local edit started
  status: SyncStatus;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
  createdAt: number;
}

export interface SyncResolutionStrategy {
  onConflict: 'local-wins' | 'remote-wins' | 'manual';
}

export async function initSyncDb(): Promise<void>;
export async function enqueue(item: Omit<SyncQueueItem, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string>;
export async function listPending(labId: string): Promise<SyncQueueItem[]>;
export async function processQueue(strategy: SyncResolutionStrategy): Promise<{ synced: number; failed: number; conflicts: number }>;
export async function clearSyncedOlderThan(ms: number): Promise<number>;
export function isOnline(): Promise<boolean>;
```

**Invariantes:**
- Usa `expo-sqlite` (table `sync_queue` com schema acima; índice em `(labId, status, createdAt)`).
- `processQueue` itera pending por ordem `createdAt ASC`, faz HTTP/Firestore call via callable, atualiza status atomicamente.
- Conflito detectado quando server `version > baseVersion`. `local-wins` força overwrite com novo `baseVersion`. `remote-wins` descarta payload local e marca `synced`. `manual` deixa `status: 'conflict'` para UI resolver.
- Backoff exponencial: `delay = min(60_000, 2^attempts * 1000)`. Após 5 attempts → `status: 'failed'`.
- `isOnline` consulta `@react-native-community/netinfo` (`NetInfo.fetch().then(s => s.isConnected && s.isInternetReachable)`).
- Sem direct Firestore writes para coleções regulatórias — sempre via callables (RDC 978 path: callable v2 `cors:true` em `southamerica-east1`). Esse module só conhece collection paths abstratos; mapping para callable name fica no caller.

**Files to read:** `hc-quality-mobile/package.json` (expo-sqlite + @react-native-community/netinfo presentes), `hc-quality-mobile/src/services/` (firebase wrapper pattern).

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5b-W1-SA-66): offline sync queue with SQLite + conflict resolution`

---

## Wave 9m-W2 — Analytics Engine + Dashboard + Detox E2E (3 SAs ‖)

deps: W1. All 3 SAs dispatch simultaneously.

---

### SA-67 — `hc-quality-mobile/src/features/analytics/analyticsEngine.ts`

Pure-function analytics over locally-cached data: trends, alerts, KPI summary.

**Exports obrigatórios:**

```typescript
export interface KPIDataPoint {
  date: number;          // unix ms
  metricId: string;      // e.g. 'turnaround-min', 'retrabalho-pct'
  value: number;
  labId: string;
}

export interface KPISummary {
  metricId: string;
  current: number;
  previous: number;
  deltaPct: number;
  trend: 'up' | 'down' | 'flat';     // |deltaPct| < 2 → 'flat'
  sparkline: number[];                // last 14 points, normalized 0..1
}

export interface AnalyticsAlert {
  id: string;
  metricId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: number;
}

export interface AnalyticsFilters {
  labId: string;
  dateFromMs: number;
  dateToMs: number;
  metricIds?: string[];     // empty / undefined ⇒ all metrics
  equipmentId?: string;
  operatorId?: string;
}

export function computeKPISummaries(points: KPIDataPoint[], filters: AnalyticsFilters): KPISummary[];
export function detectAnalyticsAlerts(summaries: KPISummary[]): AnalyticsAlert[];
export function normalizeSparkline(values: number[]): number[];
```

**Invariantes:**
- Pure functions — no I/O, no Date.now().
- `computeKPISummaries`: groupBy `metricId`, ordena por `date ASC`, current = último valor, previous = média dos N anteriores (N=7 ou comprimento total - 1).
- `deltaPct = (current - previous) / previous * 100` (guard `previous === 0` → `deltaPct = 0` se current=0, senão Infinity → cap em ±999).
- `detectAnalyticsAlerts`: regras simples — `|deltaPct| > 25 && trend !== 'flat'` → `'warning'`; `|deltaPct| > 50` → `'critical'`. Mensagens hardcoded por severity.
- `normalizeSparkline`: min-max normalize, NaN-safe (constantes → array de 0.5).

**Files to read:** none (pure module). Optionally `hc-quality-mobile/src/types/` if KPI types já existem.

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5b-W2-SA-67): analytics engine for mobile`

---

### SA-68 — `hc-quality-mobile/src/screens/AnalyticsDashboard.tsx`

Analytics dashboard screen with custom SVG charts (no external chart lib). Filter by date / lab / equipment / operator. Dark-first NativeWind.

**Exports obrigatórios:**

```typescript
export function AnalyticsDashboard(): JSX.Element;
```

**Invariantes (UX + visual):**
- NativeWind classes only — zero `StyleSheet`.
- Container: `flex-1 bg-[#141417]`. Safe area respected (`SafeAreaView` from `react-native-safe-area-context`).
- Title: `text-white text-2xl font-medium tracking-tight px-6 pt-6`.
- Filter bar: horizontal scroll de pill buttons (Date range / Equipment / Operator) — `bg-white/5 rounded-full px-4 py-2 text-sm text-white/80` idle, `bg-violet-500/20 border border-violet-500/40` active. `tabular-nums` em valores numéricos.
- KPI cards grid: `flex-row flex-wrap gap-4 px-6 py-4`. Cada card: `bg-[#1a1a1f] rounded-2xl p-4 border border-white/5 w-[48%]`.
  - `metricId` label `text-xs text-white/50 uppercase tracking-wide`.
  - `current` value `text-2xl text-white tabular-nums`.
  - `deltaPct` chip — emerald-500 se trend 'down' (KPI positiva), amber/rose se 'up' (KPI negativa). Convention: callsite passa `inversePolarity` flag por metric.
  - Sparkline custom SVG: `react-native-svg` `<Svg viewBox="0 0 100 30">` + `<Polyline>` com `currentColor` (passar via prop `stroke="currentColor"` não funciona em RN-SVG; usar `stroke={tw('text-violet-400')}` color literal).
- Alerts banner topo: lista de `AnalyticsAlert` ordenado por severity DESC (critical first). Tap navigates to detail.
- Polling 30s via `setInterval` cleared no unmount; meta-diff guard: só `setState` se hash novo difere de hash atual. (Cumpre regra `.claude/rules/performance.md`.)
- Loading state: 4 Skeleton cards (`bg-white/5 rounded-2xl animate-pulse`). Empty state: ilustração SVG inline + texto.
- Tablet responsive: `useWindowDimensions` — em `width >= 768`, grid `w-[31%]` (3 col).
- A11y: cada card `accessible accessibilityRole="summary" accessibilityLabel`.
- `prefers-reduced-motion`: desabilita animação de pulse e transições.

**Files to read:** `hc-quality-mobile/src/screens/Home.tsx`, `hc-quality-mobile/tailwind.config.js`, `hc-quality-mobile/src/features/analytics/analyticsEngine.ts` (W2 SA-67).

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'`

**Commit:** `feat(MP-5b-W2-SA-68): AnalyticsDashboard screen with custom SVG charts`

---

### SA-69 — `hc-quality-mobile/e2e/analytics.e2e.ts`

Detox E2E specs covering biometric login + analytics view + offline sync.

**Required scenarios (5 tests):**

```typescript
describe('Analytics + Biometric + Sync E2E', () => {
  it('login with biometrics — happy path', async () => { /* ... */ });
  it('login with biometrics — cancellation falls back to PIN', async () => { /* ... */ });
  it('analytics dashboard renders KPIs after login', async () => { /* ... */ });
  it('alert chip is tappable and navigates to detail', async () => { /* ... */ });
  it('offline mode queues a write and syncs on reconnect', async () => { /* ... */ });
});
```

**Invariantes:**
- Detox `device.launchApp({ newInstance: true })` em cada test.
- Biometric tests usam `device.setBiometricEnrollment(true)` + `device.matchFace()` (iOS) / `device.matchFinger()` (Android).
- Offline test: `device.setURLBlacklist(['.*'])` antes de write, verifica banner "offline" visível, cria run via UI, depois `device.setURLBlacklist([])` e verifica sync.
- testIDs adicionados nos componentes via `testID` prop (callsite responsabilidade — documentar no commit message lista de testIDs requeridos).
- Timeout default 30s; `await waitFor(...).toBeVisible().withTimeout(10000)` em assertions críticas.
- Sem reliance em strings localizadas — usa `testID` ou `accessibilityLabel`.

**Files to read:** `hc-quality-mobile/e2e/` arquivos existentes (pattern reference), `hc-quality-mobile/.detoxrc.js`, `hc-quality-mobile/jest.config.js`.

**Verify:** `cd hc-quality-mobile && npx tsc --noEmit -p e2e/tsconfig.json 2>&1 | grep -v '^#' | grep -c error | grep -E '^0$'` (E2E TSC compile-only — actual run requires simulator)

**Commit:** `test(MP-5b-W2-SA-69): 5 Detox E2E specs for biometric + analytics + offline`

---

## MP-5b Master Verification Gate

| Gate | Pass criteria |
|------|---------------|
| **G-Build** | `cd hc-quality-mobile && npx tsc --noEmit` exit 0 |
| **G-NativeWind** | grep `StyleSheet.create` against W2 SA-68 file → 0 hits (forbidden) |
| **G-Detox-Compile** | `npx tsc --noEmit -p hc-quality-mobile/e2e/tsconfig.json` exit 0 |
| **G-Detox-iOS** | Detox suite passes on iOS simulator (manual run; result appended to MP-5b SUMMARY) |
| **G-Detox-Android** | Detox suite passes on Android emulator (manual run; result appended to MP-5b SUMMARY) |
| **G-Biometric** | `expo-local-authentication` listed in `hc-quality-mobile/package.json` (grep enforced) |
| **G-Offline** | `expo-sqlite` + `@react-native-community/netinfo` listed (grep enforced) |

Failure of any G-* compile gate → escalate to Sonnet 4.6. iOS/Android sim runs are manual gates documented in MP-8 deploy checklist.
