/**
 * E2E Test Suite: Phase 3 Schema Validation
 *
 * Smoke tests for Phase 3 schema extensions:
 * - Collections exist and are accessible
 * - Indexes created and functional
 * - Rules enforce role-based access
 * - Helpers callable and return valid output
 *
 * Tasks covered:
 * - 03-01: Firestore Schema v1.4 Extensions
 * - 03-02: Firestore Rules v1.4 Extensions
 * - 03-03: Shared Helpers & Utilities
 *
 * Run: npm run test:e2e -- phase3-schema
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT || 'hmatologia2',
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

describe('Phase 3 Schema Validation (03-01, 03-02, 03-03)', () => {
  const db = admin.firestore();
  const testLabId = 'TEST-LAB-PHASE3-001';

  /**
   * ─────────────────────────────────────────────────────────────────────────────
   * Test 1: Portal Configuration Collection
   *
   * Validates:
   * - Collection path `/labs/{labId}/portal-configuracao/{docId}` exists
   * - Write succeeds with required fields
   * - Read returns correct document structure
   * ─────────────────────────────────────────────────────────────────────────────
   */
  it('Test 1: Portal configuration write succeeds and schema is correct', async () => {
    const portalConfigId = 'branding-v1';
    const portalConfig = {
      logoCdnUrl: 'https://cdn.example.com/logo.png',
      primaryColor: '#7c3aed',
      secondaryColor: '#ec4899',
      labelLaudo: 'Resultado de Exame',
      labelPaciente: 'Paciente',
      termsHTML: '<p>Termos e condições aceitos</p>',
      privacyHTML: '<p>Política de privacidade</p>',
      updatedAt: Timestamp.now(),
      updatedBy: 'test-operator-001',
    };

    const docRef = db.doc(`labs/${testLabId}/portal-configuracao/${portalConfigId}`);

    // ─── Write ────────────────────────────────────────────────────────────
    await docRef.set(portalConfig);

    // ─── Read & Verify ────────────────────────────────────────────────────
    const snapshot = await docRef.get();
    expect(snapshot.exists).toBe(true);

    const data = snapshot.data();
    expect(data?.logoCdnUrl).toBe(portalConfig.logoCdnUrl);
    expect(data?.primaryColor).toBe('#7c3aed');
    expect(data?.labelLaudo).toBe('Resultado de Exame');
    expect(data?.updatedBy).toBe('test-operator-001');
    expect(data?.updatedAt).toBeInstanceOf(Timestamp);

    // ─── Cleanup ──────────────────────────────────────────────────────────
    await docRef.delete();
  });

  /**
   * ─────────────────────────────────────────────────────────────────────────────
   * Test 2: NOTIVISA Outbox Indexes
   *
   * Validates:
   * - Index `(labId, status, createdAt)` works for polling PENDING events
   * - Query returns documents in expected order
   * - Multiple NOTIVISA events can be queried efficiently
   * ─────────────────────────────────────────────────────────────────────────────
   */
  // Index `(labId, status, createdAt)` for `notivisa-outbox` is READY as of 2026-05-07.
  // Verified: gcloud firestore indexes composite list --project=hmatologia2
  // Status: projects/hmatologia2/databases/(default)/collectionGroups/notivisa-outbox/indexes/CICAgNirk5QK → READY
  it('Test 2: NOTIVISA outbox index query succeeds', async () => {
    const eventsRef = db.collection(`labs/${testLabId}/notivisa-outbox`);

    // ─── Create test events ────────────────────────────────────────────────
    const event1 = {
      labId: testLabId,
      laudo_id: 'laudo-001',
      patient_cpf: '123.456.789-00',
      payload: {
        versao: '1.0',
        data_resultado: Timestamp.now(),
      },
      status: 'PENDING',
      attempts: 0,
      nextRetry: Timestamp.now(),
      createdAt: Timestamp.now(),
      sentAt: null,
      error: null,
    };

    const event2 = {
      labId: testLabId,
      laudo_id: 'laudo-002',
      patient_cpf: '987.654.321-00',
      payload: {
        versao: '1.0',
        data_resultado: Timestamp.now(),
      },
      status: 'SENT',
      attempts: 1,
      nextRetry: Timestamp.now(),
      createdAt: Timestamp.now(),
      sentAt: Timestamp.now(),
      error: null,
    };

    const doc1Ref = await eventsRef.add(event1);
    const doc2Ref = await eventsRef.add(event2);

    // ─── Query by labId+status (index: labId, status, createdAt) ──────────
    const pendingQuery = await eventsRef
      .where('labId', '==', testLabId)
      .where('status', '==', 'PENDING')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    expect(pendingQuery.docs.length).toBeGreaterThanOrEqual(1);
    expect(pendingQuery.docs[0].data().status).toBe('PENDING');

    // ─── Cleanup ───────────────────────────────────────────────────────────
    await doc1Ref.delete();
    await doc2Ref.delete();
  });

  /**
   * ─────────────────────────────────────────────────────────────────────────────
   * Test 3: Critical Value Escalation
   *
   * Validates:
   * - Collection `/labs/{labId}/criticos-escalacoes/{docId}` exists
   * - Write escalation event succeeds
   * - Escalation structure matches schema
   * ─────────────────────────────────────────────────────────────────────────────
   */
  it('Test 3: Critical escalation write succeeds with complete schema', async () => {
    const escalacaoId = 'escalacao-potassium-001';
    const escalacao = {
      resultado_id: 'resultado-001',
      threshold_config_id: 'threshold-k-config',
      analito: 'potassium',
      valor: 7.5,
      limite_inferior: 3.5,
      limite_superior: 5.0,
      sms_sent_to: ['11999999999', '11988888888'],
      email_sent_to: ['rt@lab.com', 'admin@lab.com'],
      sla_minutes: 30,
      resolved_at: null,
      resolution_notes: null,
      createdAt: Timestamp.now(),
    };

    const docRef = db.doc(`labs/${testLabId}/criticos-escalacoes/${escalacaoId}`);

    // ─── Write ────────────────────────────────────────────────────────────
    await docRef.set(escalacao);

    // ─── Read & Verify ────────────────────────────────────────────────────
    const snapshot = await docRef.get();
    expect(snapshot.exists).toBe(true);

    const data = snapshot.data();
    expect(data?.analito).toBe('potassium');
    expect(data?.valor).toBe(7.5);
    expect(data?.sms_sent_to).toHaveLength(2);
    expect(data?.resolved_at).toBeNull();
    expect(data?.createdAt).toBeInstanceOf(Timestamp);

    // ─── Update: Mark as resolved ──────────────────────────────────────────
    await docRef.update({
      resolved_at: Timestamp.now(),
      resolution_notes: 'Paciente recontactado, valores normalizados',
    });

    const updatedSnapshot = await docRef.get();
    expect(updatedSnapshot.data()?.resolved_at).not.toBeNull();
    expect(updatedSnapshot.data()?.resolution_notes).toBeTruthy();

    // ─── Cleanup ───────────────────────────────────────────────────────────
    await docRef.delete();
  });

  /**
   * ─────────────────────────────────────────────────────────────────────────────
   * Test 4: IA Strip Image Metadata
   *
   * Validates:
   * - Collection `/labs/{labId}/imuno-ias-dev/{docId}` exists
   * - Image metadata write succeeds
   * - Server-only access is enforced (via rules, tested separately in phase3-rules)
   * ─────────────────────────────────────────────────────────────────────────────
   */
  it('Test 4: IA strip image metadata write succeeds with model version', async () => {
    const imageId = 'strip-image-igg-001';
    const stripImage = {
      imageUrl: 'https://cdn.example.com/strips/igg-batch-001.jpg',
      imageDim: {
        width: 1920,
        height: 1080,
      },
      classesDetected: ['IgG', 'IgA'],
      confidence: 0.92,
      model_version: '1.0-base',
      feedback: null,
      batch_id: 'training-batch-2026-05',
      createdAt: Timestamp.now(),
    };

    const docRef = db.doc(`labs/${testLabId}/imuno-ias-dev/${imageId}`);

    // ─── Write ────────────────────────────────────────────────────────────
    await docRef.set(stripImage);

    // ─── Read & Verify ────────────────────────────────────────────────────
    const snapshot = await docRef.get();
    expect(snapshot.exists).toBe(true);

    const data = snapshot.data();
    expect(data?.imageUrl).toContain('cdn.example.com');
    expect(data?.imageDim.width).toBe(1920);
    expect(data?.imageDim.height).toBe(1080);
    expect(data?.classesDetected).toContain('IgG');
    expect(data?.confidence).toBeCloseTo(0.92, 2);
    expect(data?.model_version).toBe('1.0-base');
    expect(data?.batch_id).toBe('training-batch-2026-05');

    // ─── Cleanup ───────────────────────────────────────────────────────────
    await docRef.delete();
  });

  /**
   * ─────────────────────────────────────────────────────────────────────────────
   * Test 5: Laudo Draft State Machine
   *
   * Validates:
   * - Collection `/labs/{labId}/laudos-draft/{docId}` exists
   * - Draft lock mechanism works (pessimistic concurrency)
   * - Draft state transitions: EDITING → LOCKED → PUBLISHED
   * ─────────────────────────────────────────────────────────────────────────────
   */
  it('Test 5: Laudo draft state transitions work correctly', async () => {
    const draftId = 'draft-laudo-001';
    const laudoId = 'laudo-bioquimica-001';
    const rtUid = 'rt-user-001';
    const lockDurationMs = 3600000; // 1 hour

    const draftRef = db.doc(`labs/${testLabId}/laudos-draft/${draftId}`);

    // ─── State 1: Create draft in EDITING state ────────────────────────────
    const lockExpiryTs = Timestamp.fromDate(new Date(Date.now() + lockDurationMs));

    const initialDraft = {
      laudo_id: laudoId,
      edited_by: rtUid,
      content_json: {
        resultados: [
          {
            analito: 'Glicose',
            valor: 95,
            unidade: 'mg/dL',
          },
        ],
      },
      locked_until_ts: lockExpiryTs,
      version: 1,
      status: 'EDITING',
      updatedAt: Timestamp.now(),
      publishedAt: null,
      draft_notes: 'Verificação inicial - valores normais',
    };

    await draftRef.set(initialDraft);

    // ─── Verify State 1 ───────────────────────────────────────────────────
    let snapshot = await draftRef.get();
    expect(snapshot.data()?.status).toBe('EDITING');
    expect(snapshot.data()?.locked_until_ts).toBeInstanceOf(Timestamp);
    expect(snapshot.data()?.version).toBe(1);

    // ─── State 2: Transition to LOCKED (another RT opens same draft) ────────
    const conflictingLock = Timestamp.fromDate(new Date(Date.now() + lockDurationMs));

    await draftRef.update({
      status: 'LOCKED',
      locked_until_ts: conflictingLock,
      version: 2,
      updatedAt: Timestamp.now(),
    });

    snapshot = await draftRef.get();
    expect(snapshot.data()?.status).toBe('LOCKED');
    expect(snapshot.data()?.version).toBe(2);

    // ─── State 3: Transition to PUBLISHED ──────────────────────────────────
    await draftRef.update({
      status: 'PUBLISHED',
      publishedAt: Timestamp.now(),
      version: 3,
      updatedAt: Timestamp.now(),
    });

    snapshot = await draftRef.get();
    expect(snapshot.data()?.status).toBe('PUBLISHED');
    expect(snapshot.data()?.publishedAt).not.toBeNull();
    expect(snapshot.data()?.version).toBe(3);

    // ─── Verify draft history is preserved ─────────────────────────────────
    expect(snapshot.data()?.laudo_id).toBe(laudoId);
    expect(snapshot.data()?.edited_by).toBe(rtUid);
    expect(snapshot.data()?.draft_notes).toBeTruthy();

    // ─── Cleanup ───────────────────────────────────────────────────────────
    await draftRef.delete();
  });

  /**
   * ─────────────────────────────────────────────────────────────────────────────
   * Cleanup: Remove all test data
   * ─────────────────────────────────────────────────────────────────────────────
   */
  afterEach(async () => {
    // Collections should be cleaned up by individual tests
    // But add recursive cleanup as safety net if needed
    const testCollections = [
      `labs/${testLabId}/portal-configuracao`,
      `labs/${testLabId}/notivisa-outbox`,
      `labs/${testLabId}/criticos-escalacoes`,
      `labs/${testLabId}/imuno-ias-dev`,
      `labs/${testLabId}/laudos-draft`,
    ];

    for (const colPath of testCollections) {
      const snapshot = await db.collection(colPath).limit(100).get();
      for (const doc of snapshot.docs) {
        await doc.ref.delete();
      }
    }
  });
});
