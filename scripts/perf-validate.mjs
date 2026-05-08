#!/usr/bin/env node
/**
 * perf-validate.mjs — Phase 4+ performance gate orchestrator.
 *
 * Runs the 7-metric validation suite defined in .planning/PERFORMANCE_VALIDATION.md,
 * compares each result against .planning/perf-baseline.json, and emits a printable
 * Markdown report. Exits 0 (pass) / 1 (fail) so CI can gate on it.
 *
 * Metrics:
 *   1. Bundle size (local build, gzip-measured)
 *   2. Lighthouse score (5 routes, average)
 *   3. Web Vitals (LCP / INP / CLS, derived from Lighthouse)
 *   4. Auth latency p95
 *   5. Laudo load p95
 *   6. Queue processing p95
 *   7. Firestore rules latency p95
 *
 * Sources of truth (in order):
 *   - $PERF_RESULTS_FILE (JSON) — explicit overrides from upstream collectors
 *   - dist/assets/*.js + zlib.gzipSync()       (bundle, always local)
 *   - .lighthouseci/lhr-*.json                  (Lighthouse, if LHCI ran first)
 *   - $PERF_TELEMETRY_FILE (JSON)              (auth/laudo/queue/rules from prod telemetry)
 *
 * If a source is missing the metric is reported as "skipped" (not a failure unless
 * --strict is passed). This makes the gate usable in pre-build, post-build, and
 * post-deploy contexts.
 *
 * Flags:
 *   --baseline=PATH   override baseline file (default .planning/perf-baseline.json)
 *   --out=PATH        override report output (default dist/perf-report-{ts}.md)
 *   --strict          treat skipped metrics as failures
 *   --only=a,b,c      run only listed metrics (bundle,lighthouse,webVitals,auth,laudo,queue,rules)
 *   --json            also emit dist/perf-report-{ts}.json
 *   --pr-summary      also write dist/perf-pr-summary.md (compact, for PR comment)
 */

import { promises as fs } from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ───────────────────────────────────────────────────────────── argv
const argv = parseArgs(process.argv.slice(2));
const BASELINE_PATH = path.resolve(REPO_ROOT, argv.baseline ?? '.planning/perf-baseline.json');
const STRICT = Boolean(argv.strict);
const ONLY = argv.only ? new Set(argv.only.split(',').map((s) => s.trim())) : null;
const EMIT_JSON = Boolean(argv.json);
const EMIT_PR_SUMMARY = Boolean(argv['pr-summary']);
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_PATH = path.resolve(
  REPO_ROOT,
  argv.out ?? `dist/perf-report-${TIMESTAMP}.md`,
);

// ───────────────────────────────────────────────────────────── status helpers
const STATUS = Object.freeze({
  PASS: 'pass',
  WARN: 'warn',
  FAIL: 'fail',
  SKIP: 'skip',
});

function classify(value, spec) {
  if (value == null || Number.isNaN(value)) return STATUS.SKIP;
  const { warn, fail, direction } = spec;
  if (direction === 'higher-is-better') {
    if (value < fail) return STATUS.FAIL;
    if (value < warn) return STATUS.WARN;
    return STATUS.PASS;
  }
  // lower-is-better (default)
  if (value > fail) return STATUS.FAIL;
  if (value > warn) return STATUS.WARN;
  return STATUS.PASS;
}

function statusGlyph(s) {
  return { pass: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'SKIP' }[s] ?? '?';
}

function delta(value, baseline, direction = 'lower-is-better') {
  if (value == null || baseline == null) return null;
  const diff = value - baseline;
  const pct = baseline === 0 ? 0 : (diff / baseline) * 100;
  return { diff, pct, regression: direction === 'lower-is-better' ? diff > 0 : diff < 0 };
}

// ───────────────────────────────────────────────────────────── data loaders

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(`Baseline not found at ${BASELINE_PATH}`);
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function loadOverrides() {
  const explicit = process.env.PERF_RESULTS_FILE;
  if (explicit && existsSync(explicit)) {
    return JSON.parse(readFileSync(explicit, 'utf8'));
  }
  return {};
}

function loadTelemetry() {
  const explicit = process.env.PERF_TELEMETRY_FILE;
  if (explicit && existsSync(explicit)) {
    return JSON.parse(readFileSync(explicit, 'utf8'));
  }
  // Fallback: convention path — populated by prod monitoring scripts.
  const conventionPath = path.resolve(REPO_ROOT, 'dist/perf-telemetry.json');
  if (existsSync(conventionPath)) {
    return JSON.parse(readFileSync(conventionPath, 'utf8'));
  }
  return null;
}

// ───────────────────────────────────────────────────────────── 1. bundle

async function measureBundle() {
  const distAssets = path.resolve(REPO_ROOT, 'dist/assets');
  if (!existsSync(distAssets)) {
    return { skipped: true, reason: 'dist/assets not found — run `npm run build` first' };
  }
  const files = (await fs.readdir(distAssets)).filter((f) => f.endsWith('.js'));
  if (files.length === 0) {
    return { skipped: true, reason: 'no .js chunks in dist/assets' };
  }

  let mainShellGzip = 0;
  let totalGzip = 0;
  const chunks = [];
  for (const file of files) {
    const buf = await fs.readFile(path.join(distAssets, file));
    const gz = zlib.gzipSync(buf, { level: 9 });
    const gzipKb = +(gz.length / 1024).toFixed(1);
    const rawKb = +(buf.length / 1024).toFixed(1);
    chunks.push({ file, gzipKb, rawKb });
    totalGzip += gz.length;
    if (file.startsWith('index') && file.endsWith('.js')) {
      mainShellGzip = Math.max(mainShellGzip, gz.length);
    }
  }
  chunks.sort((a, b) => b.gzipKb - a.gzipKb);

  return {
    skipped: false,
    mainShellGzipKb: Math.round(mainShellGzip / 1024),
    totalGzipKb: Math.round(totalGzip / 1024),
    chunks,
  };
}

// ───────────────────────────────────────────────────────────── 2-3. lighthouse + web vitals

async function measureLighthouse(overrides) {
  // 1) Allow upstream collectors (LHCI workflow) to inject results.
  if (overrides?.lighthouse) {
    return { skipped: false, source: 'override', ...overrides.lighthouse };
  }

  // 2) Look for LHCI artifacts in .lighthouseci/.
  const lhciDir = path.resolve(REPO_ROOT, '.lighthouseci');
  if (!existsSync(lhciDir)) {
    return { skipped: true, reason: '.lighthouseci/ not found — run `npx lhci autorun` first' };
  }
  const files = (await fs.readdir(lhciDir)).filter(
    (f) => f.startsWith('lhr-') && f.endsWith('.json'),
  );
  if (files.length === 0) {
    return { skipped: true, reason: 'no LHR JSON in .lighthouseci/' };
  }

  const perRoute = [];
  let perfSum = 0;
  let perfCount = 0;
  let a11ySum = 0;
  let a11yCount = 0;
  const lcps = [];
  const inps = [];
  const clss = [];

  for (const f of files) {
    const data = JSON.parse(await fs.readFile(path.join(lhciDir, f), 'utf8'));
    const url = data.finalUrl ?? data.requestedUrl ?? f;
    const route = new URL(url).pathname || '/';
    const perf = Math.round((data.categories?.performance?.score ?? 0) * 100);
    const a11y = Math.round((data.categories?.accessibility?.score ?? 0) * 100);
    perfSum += perf;
    perfCount += 1;
    a11ySum += a11y;
    a11yCount += 1;
    const audits = data.audits ?? {};
    const lcpMs = audits['largest-contentful-paint']?.numericValue;
    const cls = audits['cumulative-layout-shift']?.numericValue;
    const inp = audits['interaction-to-next-paint']?.numericValue
      ?? audits['max-potential-fid']?.numericValue;
    if (lcpMs != null) lcps.push(lcpMs);
    if (cls != null) clss.push(cls);
    if (inp != null) inps.push(inp);
    perRoute.push({ route, perf, a11y, lcpMs, inpMs: inp, cls });
  }

  return {
    skipped: false,
    source: 'lhci',
    averagePerformance: perfCount ? Math.round(perfSum / perfCount) : null,
    averageAccessibility: a11yCount ? Math.round(a11ySum / a11yCount) : null,
    perRoute,
    webVitals: {
      lcpP95Ms: percentile(lcps, 95),
      inpP95Ms: percentile(inps, 95),
      clsP95: percentile(clss, 95),
    },
  };
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

// ───────────────────────────────────────────────────────────── 4-7. backend telemetry

function measureTelemetry(telemetry, overrides) {
  // Telemetry shape: { auth: {p95Ms, p99Ms}, laudoLoad: {p95Ms,p99Ms}, queue: {p95Ms,p99Ms}, firestoreRules: {p95Ms,p99Ms} }
  // overrides.telemetry overrides telemetry on a per-key basis.
  const merged = { ...(telemetry ?? {}), ...(overrides?.telemetry ?? {}) };
  return {
    auth: merged.auth ?? null,
    laudoLoad: merged.laudoLoad ?? null,
    queue: merged.queue ?? null,
    firestoreRules: merged.firestoreRules ?? null,
  };
}

// ───────────────────────────────────────────────────────────── evaluate

function evaluateMetric(value, spec) {
  const status = classify(value, spec);
  const d = value != null ? delta(value, spec.baseline, spec.direction) : null;
  return {
    value: value ?? null,
    baseline: spec.baseline,
    warn: spec.warn,
    fail: spec.fail,
    limit: spec.limit ?? spec.limitKb ?? spec.limitMs ?? null,
    unit: spec.unit,
    direction: spec.direction,
    status,
    delta: d,
    rationale: spec.rationale,
  };
}

function buildResults({ baseline, bundle, lighthouse, telemetry }) {
  const results = {};

  if (shouldRun('bundle')) {
    results.bundle = bundle.skipped
      ? { status: STATUS.SKIP, reason: bundle.reason }
      : {
          status: combineStatus([
            classify(bundle.mainShellGzipKb, baseline.metrics.bundle.mainShellGzipKb),
            classify(bundle.totalGzipKb, baseline.metrics.bundle.totalInitialJsGzipKb),
          ]),
          mainShellGzipKb: evaluateMetric(
            bundle.mainShellGzipKb,
            baseline.metrics.bundle.mainShellGzipKb,
          ),
          totalGzipKb: evaluateMetric(
            bundle.totalGzipKb,
            baseline.metrics.bundle.totalInitialJsGzipKb,
          ),
          topChunks: bundle.chunks.slice(0, 8),
        };
  }

  if (shouldRun('lighthouse')) {
    results.lighthouse = lighthouse.skipped
      ? { status: STATUS.SKIP, reason: lighthouse.reason }
      : {
          status: combineStatus([
            classify(lighthouse.averagePerformance, baseline.metrics.lighthouse.averagePerformance),
            classify(
              lighthouse.averageAccessibility,
              baseline.metrics.lighthouse.averageAccessibility,
            ),
          ]),
          averagePerformance: evaluateMetric(
            lighthouse.averagePerformance,
            baseline.metrics.lighthouse.averagePerformance,
          ),
          averageAccessibility: evaluateMetric(
            lighthouse.averageAccessibility,
            baseline.metrics.lighthouse.averageAccessibility,
          ),
          perRoute: lighthouse.perRoute,
        };
  }

  if (shouldRun('webVitals')) {
    if (lighthouse.skipped) {
      results.webVitals = { status: STATUS.SKIP, reason: 'depends on lighthouse output' };
    } else {
      const wv = lighthouse.webVitals;
      results.webVitals = {
        status: combineStatus([
          classify(wv.lcpP95Ms, baseline.metrics.webVitals.lcpP95Ms),
          classify(wv.inpP95Ms, baseline.metrics.webVitals.inpP95Ms),
          classify(wv.clsP95, baseline.metrics.webVitals.clsP95),
        ]),
        lcpP95Ms: evaluateMetric(wv.lcpP95Ms, baseline.metrics.webVitals.lcpP95Ms),
        inpP95Ms: evaluateMetric(wv.inpP95Ms, baseline.metrics.webVitals.inpP95Ms),
        clsP95: evaluateMetric(wv.clsP95, baseline.metrics.webVitals.clsP95),
      };
    }
  }

  for (const key of ['auth', 'laudo', 'queue', 'rules']) {
    if (!shouldRun(key)) continue;
    const tel = telemetry[
      key === 'laudo' ? 'laudoLoad' : key === 'rules' ? 'firestoreRules' : key
    ];
    const baseKey = key === 'laudo' ? 'laudoLoad' : key === 'rules' ? 'firestoreRules' : key;
    if (!tel) {
      results[key] = {
        status: STATUS.SKIP,
        reason: `no telemetry for ${baseKey} — set $PERF_TELEMETRY_FILE`,
      };
      continue;
    }
    results[key] = {
      status: combineStatus([
        classify(tel.p95Ms, baseline.metrics[baseKey].p95Ms),
        classify(tel.p99Ms, baseline.metrics[baseKey].p99Ms),
      ]),
      p95Ms: evaluateMetric(tel.p95Ms, baseline.metrics[baseKey].p95Ms),
      p99Ms: evaluateMetric(tel.p99Ms, baseline.metrics[baseKey].p99Ms),
    };
  }

  return results;
}

function combineStatus(statuses) {
  if (statuses.includes(STATUS.FAIL)) return STATUS.FAIL;
  if (statuses.includes(STATUS.WARN)) return STATUS.WARN;
  if (statuses.every((s) => s === STATUS.SKIP)) return STATUS.SKIP;
  return STATUS.PASS;
}

function shouldRun(metric) {
  if (!ONLY) return true;
  return ONLY.has(metric);
}

// ───────────────────────────────────────────────────────────── verdict

function computeVerdict(results) {
  const flat = Object.values(results).map((r) => r.status);
  const fails = flat.filter((s) => s === STATUS.FAIL).length;
  const warns = flat.filter((s) => s === STATUS.WARN).length;
  const skips = flat.filter((s) => s === STATUS.SKIP).length;

  let verdict = STATUS.PASS;
  if (fails > 0) verdict = STATUS.FAIL;
  else if (STRICT && skips > 0) verdict = STATUS.FAIL;
  else if (warns > 0) verdict = STATUS.WARN;
  else if (skips > 0) verdict = STATUS.SKIP;

  return { verdict, fails, warns, skips, total: flat.length };
}

function buildRecommendations(results) {
  const recs = [];
  if (results.bundle?.status === STATUS.FAIL || results.bundle?.status === STATUS.WARN) {
    recs.push(
      'Bundle regression detected. Run `npm run analyze` and inspect dist/stats.html. Check for new static imports of xlsx/pdf-lib/recharts in src/.',
    );
  }
  if (results.lighthouse?.status === STATUS.FAIL || results.lighthouse?.status === STATUS.WARN) {
    recs.push(
      'Lighthouse regressed. Re-run locally (`npm run build && npm run preview` + `npx lhci autorun`) and diff per-route scores against baseline.',
    );
  }
  if (results.webVitals?.status === STATUS.FAIL || results.webVitals?.status === STATUS.WARN) {
    recs.push(
      'Web Vitals regressed. Profile DevTools Performance tab on the affected route. CLS issues -> check missing width/height. INP issues -> check long tasks in JS.',
    );
  }
  if (results.auth?.status === STATUS.FAIL) {
    recs.push(
      'Auth p95 over budget. Inspect `triggerUserCreation` Cloud Function logs and Firebase Auth dashboard. Check for cold-start spikes.',
    );
  }
  if (results.laudo?.status === STATUS.FAIL) {
    recs.push(
      'Laudo load p95 over budget. Verify Firestore composite indexes are deployed and query plans are not full collection scans.',
    );
  }
  if (results.queue?.status === STATUS.FAIL) {
    recs.push(
      'Queue dispatch p95 over budget. Check Cloud Tasks backlog + Cloud Scheduler invocation timing.',
    );
  }
  if (results.rules?.status === STATUS.FAIL) {
    recs.push(
      'Firestore rules eval over budget. Audit rules for expensive `exists()` / `get()` calls in conditions; cache token claims where possible.',
    );
  }
  if (recs.length === 0) recs.push('No action required. All metrics within budget.');
  return recs;
}

// ───────────────────────────────────────────────────────────── report rendering

function fmtValue(metric) {
  if (metric.value == null) return '—';
  if (metric.unit === 'ms') return `${Math.round(metric.value)} ms`;
  if (metric.unit === 'KB') return `${Math.round(metric.value)} KB`;
  if (metric.unit === 'score/100') return `${metric.value}/100`;
  if (metric.unit === 'score') return metric.value.toFixed(3);
  return String(metric.value);
}

function fmtDelta(metric) {
  if (!metric.delta) return '—';
  const sign = metric.delta.diff > 0 ? '+' : '';
  const pct = metric.delta.pct;
  const pctStr = Number.isFinite(pct) ? `${sign}${pct.toFixed(1)}%` : '—';
  const flag = metric.delta.regression ? ' (regression)' : '';
  return `${pctStr}${flag}`;
}

function metricRow(name, m) {
  if (!m || m.value == null) {
    return `| ${name} | — | ${m?.baseline ?? '—'} | ${m?.fail ?? '—'} | SKIP | — |`;
  }
  return `| ${name} | ${fmtValue(m)} | ${m.baseline}${unitSuffix(m)} | ${m.fail}${unitSuffix(m)} | ${statusGlyph(m.status)} | ${fmtDelta(m)} |`;
}

function unitSuffix(m) {
  if (m.unit === 'ms') return ' ms';
  if (m.unit === 'KB') return ' KB';
  if (m.unit === 'score/100') return '/100';
  return '';
}

function renderReport({ results, verdict, baseline, ctx }) {
  const lines = [];
  lines.push(`# Performance Validation Report`);
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Baseline:** ${baseline.version} (captured ${baseline.capturedAt})`);
  lines.push(`**Commit:** ${ctx.commit ?? 'unknown'}`);
  lines.push(`**Mode:** ${STRICT ? 'strict' : 'non-strict'}${ONLY ? ` · only=${[...ONLY].join(',')}` : ''}`);
  lines.push('');
  lines.push(`## Verdict: ${statusGlyph(verdict.verdict)}`);
  lines.push('');
  lines.push(
    `${verdict.fails} fail · ${verdict.warns} warn · ${verdict.skips} skip · ${verdict.total} total`,
  );
  lines.push('');
  lines.push('## Metrics');
  lines.push('');
  lines.push('| Metric | Current | Baseline | Hard limit | Status | Δ vs baseline |');
  lines.push('| --- | --- | --- | --- | --- | --- |');

  if (results.bundle) {
    if (results.bundle.status === STATUS.SKIP) {
      lines.push(`| 1. Bundle (main shell) | — | ${baseline.metrics.bundle.mainShellGzipKb.baseline} KB | ${baseline.metrics.bundle.mainShellGzipKb.fail} KB | SKIP | ${results.bundle.reason} |`);
    } else {
      lines.push(metricRow('1. Bundle (main shell, gzip)', results.bundle.mainShellGzipKb));
      lines.push(metricRow('1b. Bundle (total JS, gzip)', results.bundle.totalGzipKb));
    }
  }
  if (results.lighthouse) {
    if (results.lighthouse.status === STATUS.SKIP) {
      lines.push(`| 2. Lighthouse (avg perf) | — | ${baseline.metrics.lighthouse.averagePerformance.baseline}/100 | ${baseline.metrics.lighthouse.averagePerformance.fail}/100 | SKIP | ${results.lighthouse.reason} |`);
    } else {
      lines.push(metricRow('2. Lighthouse (avg perf)', results.lighthouse.averagePerformance));
      lines.push(metricRow('2b. Lighthouse (avg a11y)', results.lighthouse.averageAccessibility));
    }
  }
  if (results.webVitals) {
    if (results.webVitals.status === STATUS.SKIP) {
      lines.push(`| 3. Web Vitals | — | — | — | SKIP | ${results.webVitals.reason} |`);
    } else {
      lines.push(metricRow('3a. LCP p95', results.webVitals.lcpP95Ms));
      lines.push(metricRow('3b. INP p95', results.webVitals.inpP95Ms));
      lines.push(metricRow('3c. CLS p95', results.webVitals.clsP95));
    }
  }
  if (results.auth) {
    if (results.auth.status === STATUS.SKIP) {
      lines.push(`| 4. Auth latency | — | ${baseline.metrics.auth.p95Ms.baseline} ms | ${baseline.metrics.auth.p95Ms.fail} ms | SKIP | ${results.auth.reason} |`);
    } else {
      lines.push(metricRow('4. Auth p95', results.auth.p95Ms));
    }
  }
  if (results.laudo) {
    if (results.laudo.status === STATUS.SKIP) {
      lines.push(`| 5. Laudo load | — | ${baseline.metrics.laudoLoad.p95Ms.baseline} ms | ${baseline.metrics.laudoLoad.p95Ms.fail} ms | SKIP | ${results.laudo.reason} |`);
    } else {
      lines.push(metricRow('5. Laudo load p95', results.laudo.p95Ms));
    }
  }
  if (results.queue) {
    if (results.queue.status === STATUS.SKIP) {
      lines.push(`| 6. Queue processing | — | ${baseline.metrics.queue.p95Ms.baseline} ms | ${baseline.metrics.queue.p95Ms.fail} ms | SKIP | ${results.queue.reason} |`);
    } else {
      lines.push(metricRow('6. Queue p95', results.queue.p95Ms));
    }
  }
  if (results.rules) {
    if (results.rules.status === STATUS.SKIP) {
      lines.push(`| 7. Firestore rules | — | ${baseline.metrics.firestoreRules.p95Ms.baseline} ms | ${baseline.metrics.firestoreRules.p95Ms.fail} ms | SKIP | ${results.rules.reason} |`);
    } else {
      lines.push(metricRow('7. Rules p95', results.rules.p95Ms));
    }
  }

  lines.push('');

  // Per-route Lighthouse table
  if (results.lighthouse?.perRoute?.length) {
    lines.push('## Lighthouse per route');
    lines.push('');
    lines.push('| Route | Perf | A11y | LCP (ms) | INP (ms) | CLS |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const r of results.lighthouse.perRoute) {
      lines.push(
        `| ${r.route} | ${r.perf} | ${r.a11y} | ${fmtNum(r.lcpMs)} | ${fmtNum(r.inpMs)} | ${fmtCls(r.cls)} |`,
      );
    }
    lines.push('');
  }

  // Bundle top chunks
  if (results.bundle?.topChunks?.length) {
    lines.push('## Top 8 JS chunks (gzip)');
    lines.push('');
    lines.push('| File | Gzip KB | Raw KB |');
    lines.push('| --- | --- | --- |');
    for (const c of results.bundle.topChunks) {
      lines.push(`| ${c.file} | ${c.gzipKb} | ${c.rawKb} |`);
    }
    lines.push('');
  }

  lines.push('## Recommendations');
  lines.push('');
  for (const r of buildRecommendations(results)) {
    lines.push(`- ${r}`);
  }
  lines.push('');
  lines.push('## How to read this report');
  lines.push('');
  lines.push('See `docs/observability/PERF_VALIDATION_RUNBOOK.md` for status semantics, suppression policy, and escalation.');
  lines.push('');
  lines.push('---');
  lines.push(`Generated by \`scripts/perf-validate.mjs\``);

  return lines.join('\n');
}

function fmtNum(v) {
  if (v == null) return '—';
  return Math.round(v);
}
function fmtCls(v) {
  if (v == null) return '—';
  return Number(v).toFixed(3);
}

function renderPrSummary({ results, verdict, baseline }) {
  const lines = [];
  lines.push(`### Performance gate: ${statusGlyph(verdict.verdict)}`);
  lines.push('');
  lines.push(
    `${verdict.fails} fail · ${verdict.warns} warn · ${verdict.skips} skip · vs baseline ${baseline.version}`,
  );
  lines.push('');
  lines.push('| Metric | Current | Baseline | Status |');
  lines.push('| --- | --- | --- | --- |');
  if (results.bundle?.mainShellGzipKb) {
    lines.push(
      `| Main shell | ${fmtValue(results.bundle.mainShellGzipKb)} | ${results.bundle.mainShellGzipKb.baseline} KB | ${statusGlyph(results.bundle.mainShellGzipKb.status)} |`,
    );
  }
  if (results.lighthouse?.averagePerformance) {
    lines.push(
      `| Lighthouse perf | ${fmtValue(results.lighthouse.averagePerformance)} | ${results.lighthouse.averagePerformance.baseline}/100 | ${statusGlyph(results.lighthouse.averagePerformance.status)} |`,
    );
  }
  if (results.webVitals?.lcpP95Ms) {
    lines.push(
      `| LCP p95 | ${fmtValue(results.webVitals.lcpP95Ms)} | ${results.webVitals.lcpP95Ms.baseline} ms | ${statusGlyph(results.webVitals.lcpP95Ms.status)} |`,
    );
  }
  for (const key of ['auth', 'laudo', 'queue', 'rules']) {
    const r = results[key];
    if (r?.p95Ms) {
      lines.push(
        `| ${key} p95 | ${fmtValue(r.p95Ms)} | ${r.p95Ms.baseline} ms | ${statusGlyph(r.p95Ms.status)} |`,
      );
    }
  }
  lines.push('');
  lines.push('See full report artifact `perf-report-*.md`.');
  return lines.join('\n');
}

// ───────────────────────────────────────────────────────────── argparse

function parseArgs(args) {
  const out = {};
  for (const a of args) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    out[k] = v ?? true;
  }
  return out;
}

// ───────────────────────────────────────────────────────────── main

async function main() {
  const baseline = loadBaseline();
  const overrides = loadOverrides();
  const telemetry = measureTelemetry(loadTelemetry(), overrides);

  const [bundle, lighthouse] = await Promise.all([
    shouldRun('bundle') ? measureBundle() : Promise.resolve({ skipped: true, reason: 'filtered out by --only' }),
    shouldRun('lighthouse') || shouldRun('webVitals')
      ? measureLighthouse(overrides)
      : Promise.resolve({ skipped: true, reason: 'filtered out by --only' }),
  ]);

  const results = buildResults({ baseline, bundle, lighthouse, telemetry });
  const verdict = computeVerdict(results);

  const ctx = {
    commit:
      process.env.GITHUB_SHA ??
      process.env.COMMIT_SHA ??
      (await tryGitSha()) ??
      'unknown',
  };

  const report = renderReport({ results, verdict, baseline, ctx });

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, report, 'utf8');

  if (EMIT_JSON) {
    const jsonPath = REPORT_PATH.replace(/\.md$/, '.json');
    await fs.writeFile(
      jsonPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), baseline: baseline.version, ctx, verdict, results }, null, 2),
      'utf8',
    );
    console.log(`Wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  }

  if (EMIT_PR_SUMMARY) {
    const prPath = path.resolve(REPO_ROOT, 'dist/perf-pr-summary.md');
    await fs.writeFile(prPath, renderPrSummary({ results, verdict, baseline }), 'utf8');
    console.log(`Wrote ${path.relative(REPO_ROOT, prPath)}`);
  }

  console.log(`Wrote ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  console.log(
    `Verdict: ${statusGlyph(verdict.verdict)} — ${verdict.fails} fail, ${verdict.warns} warn, ${verdict.skips} skip`,
  );

  process.exit(verdict.verdict === STATUS.FAIL ? 1 : 0);
}

async function tryGitSha() {
  try {
    const { execSync } = await import('node:child_process');
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error('perf-validate failed:', err);
  process.exit(2);
});
