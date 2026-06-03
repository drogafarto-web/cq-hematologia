/**
 * Wave 3 E2E Test — Audit PDF Export
 *
 * Flow:
 * 1. Create auditoria (admin)
 * 2. Install checklist template
 * 3. Register achado with severity
 * 4. Generate PDF via Cloud Function
 * 5. Verify PDF <10MB
 * 6. Download and validate structure
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getFunctions } from 'firebase-admin/functions';

// Test config
const projectId = 'hmatologia2';
const labId = 'labclin-riopomba';
const testTimeout = 60000; // 60s per test

let app;
let db;
let auth;
let functions;

describe('Wave 3 — Audit PDF Export', () => {
  before(async () => {
    // Initialize Firebase Admin
    app = initializeApp({
      projectId,
    });
    db = getFirestore(app);
    auth = getAuth(app);
    functions = getFunctions(app, 'southamerica-east1');
  });

  it('should create auditoria', async () => {
    const createAuditoria = functions.httpsCallable('createAuditoria');

    const result = await createAuditoria({
      labId,
      ano: 2026,
      frequencia: 'anual',
      responsavelTecnico: 'RT-001',
      proximaAuditoriaPlanejada: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });

    assert.ok(result.data.success);
    assert.ok(result.data.auditoriaId);
    console.log('✓ Auditoria created:', result.data.auditoriaId);

    return result.data.auditoriaId;
  }).timeout(testTimeout);

  it('should install checklist template', async function () {
    const auditoriaId = await this.parent.tests[0].result;
    const installTemplate = functions.httpsCallable('installChecklistTemplate');

    const result = await installTemplate({
      labId,
      auditoriaId,
      templateId: 'dicq-rdc-978-v1',
    });

    assert.ok(result.data.success);
    assert.ok(result.data.sessaoId);
    assert.equal(result.data.itemsCreated, 115); // ~115 DICQ items
    console.log(
      '✓ Checklist installed:',
      result.data.sessaoId,
      'with',
      result.data.itemsCreated,
      'items',
    );

    return { auditoriaId, sessaoId: result.data.sessaoId };
  }).timeout(testTimeout);

  it('should register achado with severity crítica', async function () {
    const context = await this.parent.tests[1].result;
    const { auditoriaId, sessaoId } = context;

    const registerAchado = functions.httpsCallable('registerAchado');

    const result = await registerAchado({
      labId,
      auditoriaId,
      sessaoId,
      checklistItemId: 'item-001',
      descricao: 'Sistema de validação de assinatura não está implementado corretamente',
      severidade: 'crítica',
      evidencia: 'Verificado durante teste de conformidade.',
    });

    assert.ok(result.data.success);
    assert.ok(result.data.achadoId);
    assert.equal(result.data.ncCreated, true); // Crítica triggers NC
    assert.ok(result.data.ncId);
    console.log('✓ Achado registered:', result.data.achadoId, '→ NC:', result.data.ncId);

    return { ...context, achadoId: result.data.achadoId, ncId: result.data.ncId };
  }).timeout(testTimeout);

  it('should generate audit PDF <10MB', async function () {
    const context = await this.parent.tests[2].result;
    const { auditoriaId, sessaoId } = context;

    const generatePDF = functions.httpsCallable('generateAuditReportPDF');

    const result = await generatePDF({
      labId,
      auditoriaId,
      sessaoId,
    });

    assert.ok(result.data.success);
    assert.ok(result.data.pdfUrl);
    assert.ok(result.data.pdfSizeMB);
    assert.ok(result.data.filename);

    const pdfSizeMB = Number(result.data.pdfSizeMB);
    assert.ok(pdfSizeMB < 10, `PDF size ${pdfSizeMB}MB exceeds 10MB limit`);

    console.log(`✓ PDF generated: ${result.data.filename} (${pdfSizeMB}MB)`);
    console.log(`  URL: ${result.data.pdfUrl.substring(0, 80)}...`);

    return { ...context, pdfUrl: result.data.pdfUrl, pdfSizeMB };
  }).timeout(testTimeout);

  it('should verify PDF structure via download', async function () {
    const context = await this.parent.tests[3].result;
    const { pdfUrl } = context;

    // Fetch PDF to verify it's valid
    const response = await fetch(pdfUrl);
    assert.equal(response.status, 200);

    const buffer = await response.arrayBuffer();
    const pdf = Buffer.from(buffer);

    // Check PDF magic number (4 bytes: %PDF)
    const magic = pdf.toString('utf8', 0, 4);
    assert.equal(magic, '%PDF', 'Invalid PDF magic number');

    console.log('✓ PDF structure valid');
    console.log(`  Total size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
  }).timeout(testTimeout);

  after(async () => {
    if (app) {
      await deleteApp(app);
    }
  });
});
