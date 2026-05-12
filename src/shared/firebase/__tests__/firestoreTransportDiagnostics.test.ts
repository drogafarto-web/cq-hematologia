import { describe, expect, it } from 'vitest';
import { FirebaseError } from 'firebase/app';
import {
  classifyFirestoreListenerError,
  type FirestoreUnaryProbeResult,
} from '../firestoreTransportDiagnostics';

function fe(code: string, message = 'x'): FirebaseError {
  return new FirebaseError(code, message);
}

describe('classifyFirestoreListenerError', () => {
  it('classifies permission-denied + unary ok as transport_suspected', () => {
    const unary: FirestoreUnaryProbeResult = { status: 'ok', docCount: 0 };
    const r = classifyFirestoreListenerError({
      err: fe('permission-denied'),
      unaryProbe: unary,
      tokenClaimsCeqTrue: true,
    });
    expect(r.category).toBe('transport_suspected');
  });

  it('classifies permission-denied + unary permission-denied as rbac', () => {
    const unary: FirestoreUnaryProbeResult = {
      status: 'error',
      code: 'permission-denied',
      message: 'denied',
    };
    const r = classifyFirestoreListenerError({
      err: fe('permission-denied'),
      unaryProbe: unary,
      tokenClaimsCeqTrue: false,
    });
    expect(r.category).toBe('rbac');
  });

  it('classifies unavailable as transport_suspected', () => {
    const r = classifyFirestoreListenerError({
      err: fe('unavailable'),
      unaryProbe: null,
      tokenClaimsCeqTrue: null,
    });
    expect(r.category).toBe('transport_suspected');
  });
});
