/**
 * testMode.ts — NOTIVISA mode resolver + synthetic responder.
 *
 * The real government NOTIVISA endpoint requires sandbox credentials that
 * are not yet provisioned (see `docs/v1.4_NOTIVISA_SANDBOX_SETUP.md`). To
 * unblock the lifecycle (draft → approve → submit → queue → outbox) we
 * support three modes via `process.env.NOTIVISA_MODE`:
 *
 *   - `test`    (default) — synthetic in-memory responder. No network. No PII leaks.
 *                Returns a deterministic-ish ack with random latency 200–800ms.
 *   - `sandbox` — reserved for the gov sandbox HTTP client. Throws `unimplemented`
 *                until ADR-0026 Phase 4 sandbox onboarding completes.
 *   - `prod`    — reserved for the production gov endpoint. Throws `unimplemented`.
 *
 * Flipping the switch is a single env var change at deploy time. No callable
 * code below this module knows about the underlying transport.
 */

import { HttpsError } from 'firebase-functions/v2/https';

export type NotivisaMode = 'test' | 'sandbox' | 'prod';

export function getNotivisaMode(): NotivisaMode {
  const raw = (process.env['NOTIVISA_MODE'] ?? 'test').toLowerCase();
  if (raw === 'sandbox') return 'sandbox';
  if (raw === 'prod' || raw === 'production') return 'prod';
  return 'test';
}

export interface SyntheticAck {
  receiptCode: string;
  govEventId: string;
  govStatus: 'acknowledged';
  roundTripMs: number;
  respondedAt: number;
  isSynthetic: true;
}

export interface SubmissionFailure {
  errorCode: string;
  errorMessage: string;
  isRetryable: boolean;
  roundTripMs: number;
}

export type SubmissionOutcome =
  | { ok: true; ack: SyntheticAck }
  | { ok: false; failure: SubmissionFailure };

interface SubmitArgs {
  labId: string;
  draftId: string;
  laudoId: string;
  attempt: number;
  injectFailure?: boolean;
}

/**
 * Synthetic responder. Pure async function, side-effect free other than the
 * artificial latency. Logs every call with a clear `[NOTIVISA_TEST_MODE]`
 * prefix so operators know production traffic is not actually being sent.
 *
 * Optional `injectFailure` (used in tests) forces a retryable error to
 * exercise the backoff path.
 */
export async function submitToGovTestMode(
  args: SubmitArgs,
): Promise<SubmissionOutcome> {
  const start = Date.now();
  const latencyMs = 200 + Math.floor(Math.random() * 600); // 200–800ms
  await new Promise((resolve) => setTimeout(resolve, latencyMs));
  const roundTripMs = Date.now() - start;

  console.info('[NOTIVISA_TEST_MODE]', {
    msg: 'synthetic responder invoked — no real API call',
    labId: args.labId,
    draftId: args.draftId,
    laudoId: args.laudoId,
    attempt: args.attempt,
    roundTripMs,
  });

  if (args.injectFailure) {
    return {
      ok: false,
      failure: {
        errorCode: 'SYNTHETIC_FAILURE',
        errorMessage: 'Test-mode forced retryable failure',
        isRetryable: true,
        roundTripMs,
      },
    };
  }

  return {
    ok: true,
    ack: {
      receiptCode: `NV-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      govEventId: `evt-test-${Date.now()}`,
      govStatus: 'acknowledged',
      roundTripMs,
      respondedAt: Date.now(),
      isSynthetic: true,
    },
  };
}

/**
 * Dispatch a submission according to the active mode. Sandbox/prod throw
 * `unimplemented` with a clear message until the real HTTP client lands.
 */
export async function dispatchSubmission(
  mode: NotivisaMode,
  args: SubmitArgs,
): Promise<SubmissionOutcome> {
  if (mode === 'test') {
    return submitToGovTestMode(args);
  }
  throw new HttpsError(
    'unimplemented',
    `NOTIVISA mode '${mode}' não está implementado. ` +
      'O cliente HTTP real será habilitado quando as credenciais ' +
      'do sandbox forem provisionadas (ver docs/v1.4_NOTIVISA_SANDBOX_SETUP.md).',
  );
}
