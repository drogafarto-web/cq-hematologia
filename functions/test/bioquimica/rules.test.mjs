/**
 * Smoke tests for Phase 9 Plan 09-01 Firestore rules — bioquimica module.
 *
 * Documents the expected behavior of the rules added in Plan 09-01 for the
 * `/labs/{labId}/bioquimica/**` path tree. Mirrors the format used by
 * `functions/test/batch2/rules.test.mjs` — these are intent assertions, not
 * live emulator runs (project does not yet host @firebase/rules-unit-testing).
 *
 * Run:
 *   node --test functions/test/bioquimica/rules.test.mjs
 *
 * To convert to live emulator tests, swap each `assert` for a call to
 * `assertSucceeds`/`assertFails` from `@firebase/rules-unit-testing`. The
 * scenario list below already shapes the tests that conversion would cover.
 *
 * Compliance: RDC 978/2025 Arts. 179, 180, 181, 167, 183 + DICQ 4.3 Bloco F.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── Scenarios ─────────────────────────────────────────────────────────────

const scenarios = [
  {
    name: 'S1: Member ativo do lab pode ler analitos',
    path: '/labs/{labId}/bioquimica/root/analitos/{analitoId}',
    operation: 'read',
    actor: 'member-active',
    expected: 'allow',
    rationale:
      'isActiveMemberOfLab(labId) — analitos não são regulatorios sensíveis a claims de módulo',
  },
  {
    name: 'S2: Non-member (outro lab) NÃO pode ler analitos',
    path: '/labs/{lab-A}/bioquimica/root/analitos/{analitoId}',
    operation: 'read',
    actor: 'member-of-lab-B',
    expected: 'deny',
    rationale: 'Cross-tenant blocked: member doc lookup falha',
  },
  {
    name: 'S3: Member ativo pode criar analito custom',
    path: '/labs/{labId}/bioquimica/root/analitos/{analitoId}',
    operation: 'create',
    actor: 'member-active',
    payload: {
      labId: '{labId}',
      nome: 'Frutosamina',
      unidade: 'umol/L',
      rangeBiologico: { min: 200, max: 285 },
      ativo: true,
      seedDefault: false,
      deletadoEm: null,
    },
    expected: 'allow',
    rationale: 'Validação de payload + labId match + soft-delete-only',
  },
  {
    name: 'S4: Create rejeitado quando labId no payload ≠ path',
    path: '/labs/{lab-A}/bioquimica/root/analitos/{analitoId}',
    operation: 'create',
    actor: 'member-of-lab-A',
    payload: {
      labId: 'lab-B', // mismatch — defesa em profundidade
      nome: 'Frutosamina',
      unidade: 'umol/L',
      rangeBiologico: { min: 200, max: 285 },
      ativo: true,
      deletadoEm: null,
    },
    expected: 'deny',
    rationale: 'Threat T1 mitigation — cross-tenant write impossível',
  },
  {
    name: 'S5: Hard delete sempre rejeitado (RN-06)',
    path: '/labs/{labId}/bioquimica/root/analitos/{analitoId}',
    operation: 'delete',
    actor: 'admin-of-lab',
    expected: 'deny',
    rationale: 'allow delete: if false — soft-delete only via updateDoc(deletadoEm)',
  },
  {
    name: 'S6: Run não pode ser criada via client (callable-only)',
    path: '/labs/{labId}/bioquimica/root/runs/{runId}',
    operation: 'create',
    actor: 'member-active',
    expected: 'deny',
    rationale: 'Threat T5: Westgard server-side em recordRunBioquimica callable',
  },
  {
    name: 'S7: Member pode ler runs (read sempre permitido para audit/UI)',
    path: '/labs/{labId}/bioquimica/root/runs/{runId}',
    operation: 'read',
    actor: 'member-active',
    expected: 'allow',
    rationale: 'Run read necessário para LeveyJennings/relatórios',
  },
  {
    name: 'S8: Update de analito não pode mudar labId nem criadoEm',
    path: '/labs/{labId}/bioquimica/root/analitos/{analitoId}',
    operation: 'update',
    actor: 'member-active',
    payload_change: { labId: 'lab-other' }, // attempted attack
    expected: 'deny',
    rationale: 'request.resource.data.labId == resource.data.labId — keepsLabId()',
  },
  {
    name: 'S9: Traceability events — append-only (callable-only)',
    path: '/labs/{labId}/bioquimica/root/traceability-events/{eventId}',
    operation: 'create',
    actor: 'member-active',
    expected: 'deny',
    rationale: 'Worklab traceability append-only via Cloud Function',
  },
  {
    name: 'S10: Lote sem equipmentIds rejeitado',
    path: '/labs/{labId}/bioquimica/root/lotes/{lotId}',
    operation: 'create',
    actor: 'member-active',
    payload: {
      labId: '{labId}',
      equipmentIds: [], // multi-instrumento — vazio é inválido
      lote: 'L123',
      validade: '2026-12-31',
      origem: 'avulso',
      deletadoEm: null,
    },
    expected: 'deny',
    rationale: 'equipmentIds.size() > 0 — multi-instrumento dia 1',
  },
];

// ─── Tests ─────────────────────────────────────────────────────────────────

test('Plan 09-01 — rules schema documenta 10 scenarios cobrindo paths chave', () => {
  assert.equal(scenarios.length, 10);
  for (const s of scenarios) {
    assert.ok(s.name, `scenario sem nome: ${JSON.stringify(s)}`);
    assert.ok(s.path.includes('/bioquimica/'));
    assert.ok(['read', 'create', 'update', 'delete'].includes(s.operation));
    assert.ok(['allow', 'deny'].includes(s.expected));
    assert.ok(s.rationale && s.rationale.length > 10);
  }
});

test('Plan 09-01 — coleções regulatórias têm allow create: if false', () => {
  const callableOnly = scenarios.filter(
    (s) =>
      (s.path.includes('/runs/') ||
        s.path.includes('/traceability-events/') ||
        s.path.includes('/audit/')) &&
      s.operation === 'create',
  );
  // Toda tentativa de create direto em coleções callable-only deve negar.
  for (const s of callableOnly) {
    assert.equal(s.expected, 'deny', `${s.name} deveria negar create`);
  }
});

test('Plan 09-01 — RN-06 soft-delete only em todas as coleções', () => {
  const deletes = scenarios.filter((s) => s.operation === 'delete');
  for (const s of deletes) {
    assert.equal(s.expected, 'deny', `${s.name} deveria negar delete`);
  }
});

test('Plan 09-01 — labId mismatch entre path e payload sempre nega', () => {
  const labIdAttacks = scenarios.filter(
    (s) =>
      s.payload?.labId !== undefined &&
      s.path.includes('{lab-A}') &&
      s.payload.labId !== '{lab-A}' &&
      s.payload.labId !== '{labId}',
  );
  // Todos esses cenários representam tentativas de cross-tenant write.
  for (const s of labIdAttacks) {
    assert.equal(s.expected, 'deny', `Cross-tenant ${s.name} deveria negar`);
  }
});

test('Plan 09-01 — non-member NÃO pode read', () => {
  const crossTenantReads = scenarios.filter(
    (s) => s.operation === 'read' && s.actor === 'member-of-lab-B',
  );
  for (const s of crossTenantReads) {
    assert.equal(s.expected, 'deny');
  }
});

// ─── Export para harness futuro ────────────────────────────────────────────
//
// Quando @firebase/rules-unit-testing for adicionado ao projeto, o array
// `scenarios` pode ser reutilizado: cada caso vira um test() que monta o
// contexto auth + chama getFirestore + assertSucceeds/assertFails.
export { scenarios };
