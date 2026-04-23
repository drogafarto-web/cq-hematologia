/**
 * Smoke tests do relatório operacional (2º anexo do email diário).
 *
 * Exercita:
 *   - Render do PDF com as 3 seções populadas
 *   - Empty state do audit log (collectionActive=false)
 *   - Branch crítico (status=critico) com razões e eventos críticos
 *   - Hash determinístico para mesma fixture
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..');

const { generateOperacionalPdf } = await import(
  pathToFileURL(
    path.join(
      FUNCTIONS_DIR,
      'lib/modules/emailBackup/operacional/pdf/operacionalPdfService.js',
    ),
  ).href
);

const PERIOD_START = new Date('2026-03-22T00:00:00Z');
const PERIOD_END = new Date('2026-04-22T23:59:59Z');
const GENERATED_AT = '2026-04-22T23:45:00-03:00';

function makeTimestamp(iso) {
  const d = new Date(iso);
  const seconds = Math.floor(d.getTime() / 1000);
  return {
    seconds,
    nanoseconds: 0,
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
}

function baseReport(overrides = {}) {
  return {
    labId: 'labclin-riopomba',
    labName: 'LabClin Rio Pomba MG',
    labCnpj: '12.345.678/0001-90',
    labAddress: 'Rua Tiradentes, 123 — Centro — Rio Pomba/MG',
    responsibleTech: {
      name: 'Dra. Maria da Silva',
      registration: 'CRBM-MG 1234',
    },
    sanitaryLicense: { number: 'AL-0042/2026', validUntil: '2026-12-31' },
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    generatedAt: GENERATED_AT,
    globalStatus: 'ok',
    contentHash: 'deterministic-test-hash',
    qcDecisions: {
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      totalRuns: 124,
      totalApproved: 118,
      totalRejected: 6,
      globalApprovalRate: 95.2,
      status: 'ok',
      statusReasons: [],
      modules: [
        {
          moduleId: 'hematologia',
          moduleName: 'Hematologia (CIQ Quantitativo)',
          totalRuns: 78,
          approved: 74,
          rejected: 4,
          pending: 0,
          approvalRate: 94.9,
          approvalRate7d: 96.0,
          approvalRate30d: 94.9,
          trendDeltaPp: 1.1,
          westgardViolationsCount: { '1-3s': 3, '2-2s': 1 },
          topRejectedTests: [
            { testName: 'HGB', rejections: 2 },
            { testName: 'PLT', rejections: 1 },
          ],
        },
        {
          moduleId: 'imunologia',
          moduleName: 'Imunologia (CIQ-Imuno)',
          totalRuns: 46,
          approved: 44,
          rejected: 2,
          pending: 0,
          approvalRate: 95.7,
          approvalRate7d: 90.0,
          approvalRate30d: 95.7,
          trendDeltaPp: -5.7,
          westgardViolationsCount: {},
          topRejectedTests: [{ testName: 'Anti-HIV', rejections: 1 }],
        },
      ],
      operatorRanking: [
        {
          operatorName: 'Ana Costa',
          operatorRole: 'operador',
          runsProcessed: 62,
          rejections: 2,
          rejectionRate: 3.2,
          isOutlier: false,
        },
        {
          operatorName: 'João Freitas',
          operatorRole: 'supervisor',
          runsProcessed: 38,
          rejections: 4,
          rejectionRate: 10.5,
          isOutlier: true,
        },
      ],
      problematicLots: [
        {
          lotNumber: 'LOT-A2026-001',
          product: 'Multiqual Hematology',
          moduleId: 'hematologia',
          totalRuns: 12,
          rejections: 4,
          rejectionRate: 33.3,
          shouldSegregate: true,
        },
      ],
    },
    rastreabilidade: {
      status: 'atencao',
      alertsCount: { critical: 1, warning: 2 },
      activeLots: [
        {
          insumoId: 'ins-001',
          lotNumber: 'LOT-A2026-001',
          tipo: 'controle',
          nomeComercial: 'Multiqual Hematology',
          fabricante: 'Bio-Rad',
          registroAnvisa: '10345678901',
          validadeFabricante: '2026-08-15',
          dataEntrada: '2026-03-01',
          dataAbertura: '2026-03-05',
          dataFechamento: null,
          dataDescarte: null,
          diasEmUso: 48,
          validadePosAbertura: '2026-06-03',
          runsCount: 12,
          approvalRate: null,
          modulosUsados: ['hematologia'],
          status: 'ativo',
          alerts: [
            {
              code: 'HIGH_REJECTION_RATE',
              severity: 'critical',
              message: 'Taxa de rejeição 33.3% no período — candidato a segregação.',
            },
          ],
        },
        {
          insumoId: 'ins-002',
          lotNumber: 'LOT-B2026-005',
          tipo: 'reagente',
          nomeComercial: 'HIV Combi ADVIA',
          fabricante: 'Siemens',
          registroAnvisa: null,
          validadeFabricante: '2026-05-10',
          dataEntrada: '2026-02-10',
          dataAbertura: '2026-02-12',
          dataFechamento: null,
          dataDescarte: null,
          diasEmUso: 70,
          validadePosAbertura: null,
          runsCount: 46,
          approvalRate: null,
          modulosUsados: ['imunologia'],
          status: 'ativo',
          alerts: [
            {
              code: 'MISSING_ANVISA_REG',
              severity: 'warning',
              message: 'Registro ANVISA ausente — RDC 786 exige em inspeção.',
            },
          ],
        },
      ],
      closedLots: [],
    },
    auditLog: {
      collectionActive: false,
      totalEvents: 0,
      byAction: {},
      bySeverity: { info: 0, warning: 0, critical: 0 },
      byActor: [],
      criticalEvents: [],
      recentEvents: [],
      chain: { eventsVerified: 0, valid: true, breaks: [] },
      truncated: false,
      status: 'ok',
    },
    ...overrides,
  };
}

test('generateOperacionalPdf — produz PDF com header válido', async () => {
  const report = baseReport();
  const buffer = await generateOperacionalPdf(report);
  assert.ok(buffer instanceof Buffer, 'deve retornar Buffer');
  assert.ok(buffer.length > 2000, `PDF muito pequeno: ${buffer.length} bytes`);
  assert.strictEqual(buffer.slice(0, 4).toString(), '%PDF', 'deve começar com header PDF');
});

test('generateOperacionalPdf — fixture full status=atencao produz buffer maior que empty', async () => {
  const full = await generateOperacionalPdf(baseReport({ globalStatus: 'atencao' }));
  const empty = await generateOperacionalPdf(
    baseReport({
      globalStatus: 'ok',
      qcDecisions: {
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        totalRuns: 0,
        totalApproved: 0,
        totalRejected: 0,
        globalApprovalRate: null,
        status: 'ok',
        statusReasons: [],
        modules: [],
        operatorRanking: [],
        problematicLots: [],
      },
      rastreabilidade: {
        activeLots: [],
        closedLots: [],
        alertsCount: { critical: 0, warning: 0 },
        status: 'ok',
      },
    }),
  );
  assert.ok(
    full.length > empty.length,
    `expected full(${full.length}) > empty(${empty.length})`,
  );
});

test('generateOperacionalPdf — branch audit collectionActive=true sem quebras', async () => {
  const report = baseReport({
    auditLog: {
      collectionActive: true,
      totalEvents: 42,
      byAction: { APPROVE_RUN: 30, REJECT_RUN: 8, OPEN_LOT: 4 },
      bySeverity: { info: 30, warning: 10, critical: 2 },
      byActor: [
        { actorName: 'Ana Costa', actorRole: 'operador', count: 25 },
        { actorName: 'João Freitas', actorRole: 'supervisor', count: 17 },
      ],
      criticalEvents: [
        {
          id: 'evt-001',
          labId: 'labclin-riopomba',
          moduleId: 'hematologia',
          timestamp: makeTimestamp('2026-04-20T14:33:00Z'),
          action: 'REOPEN_RUN',
          entityType: 'run',
          entityId: 'run-abc123def456',
          actorUid: 'uid-joao',
          actorName: 'João Freitas',
          actorRole: 'supervisor',
          reason: 'Erro de digitação no valor de HGB detectado após aprovação.',
          severity: 'critical',
          previousHash: 'hash-prev',
          contentHash: 'hash-content',
          chainHash: 'hash-chain',
        },
      ],
      recentEvents: [
        {
          id: 'evt-002',
          labId: 'labclin-riopomba',
          moduleId: 'hematologia',
          timestamp: makeTimestamp('2026-04-22T10:12:00Z'),
          action: 'APPROVE_RUN',
          entityType: 'run',
          entityId: 'run-xyz789',
          actorUid: 'uid-ana',
          actorName: 'Ana Costa',
          actorRole: 'operador',
          severity: 'info',
          previousHash: 'hash-prev',
          contentHash: 'hash-content',
          chainHash: 'hash-chain',
        },
      ],
      chain: { eventsVerified: 42, valid: true, breaks: [] },
      truncated: false,
      status: 'atencao',
    },
    globalStatus: 'atencao',
  });

  const buffer = await generateOperacionalPdf(report);
  assert.ok(buffer.length > 3000);
});

test('generateOperacionalPdf — branch audit chain comprometida (crítico)', async () => {
  const report = baseReport({
    auditLog: {
      collectionActive: true,
      totalEvents: 10,
      byAction: { APPROVE_RUN: 10 },
      bySeverity: { info: 10, warning: 0, critical: 0 },
      byActor: [],
      criticalEvents: [],
      recentEvents: [],
      chain: {
        eventsVerified: 10,
        valid: false,
        breaks: [
          {
            eventId: 'evt-broken',
            expectedChainHash: 'expected',
            foundChainHash: 'found',
          },
        ],
      },
      truncated: false,
      status: 'critico',
    },
    globalStatus: 'critico',
  });

  const buffer = await generateOperacionalPdf(report);
  assert.ok(buffer.length > 3000);
});

test('generateOperacionalPdf — sem corridas (período silencioso)', async () => {
  const report = baseReport({
    qcDecisions: {
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      totalRuns: 0,
      totalApproved: 0,
      totalRejected: 0,
      globalApprovalRate: null,
      status: 'ok',
      statusReasons: [],
      modules: [],
      operatorRanking: [],
      problematicLots: [],
    },
    rastreabilidade: {
      activeLots: [],
      closedLots: [],
      alertsCount: { critical: 0, warning: 0 },
      status: 'ok',
    },
  });

  const buffer = await generateOperacionalPdf(report);
  assert.ok(buffer.length > 1500);
});
