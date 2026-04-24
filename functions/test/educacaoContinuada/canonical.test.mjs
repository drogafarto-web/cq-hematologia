/**
 * Testes unitários do `signatureCanonical.ts` (server).
 *
 * Garante:
 *   - sortedStringify é determinístico contra ordem de chaves
 *   - sha256Hex bate com node:crypto manual
 *   - generateEcSignatureServer + verifyEcSignatureServer round-trip
 *   - hash bate com formato canônico esperado pelo verifyEcSignature do web
 *     (caso o web verify seja chamado em docs gerados pela CF)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..');

const { sortedStringify, sha256Hex, generateEcSignatureServer, verifyEcSignatureServer } =
  await import(
    pathToFileURL(
      path.join(FUNCTIONS_DIR, 'lib/modules/educacaoContinuada/signatureCanonical.js'),
    ).href
  );

const admin = await import('firebase-admin');

test('sortedStringify — ordem de chaves não importa', () => {
  const a = sortedStringify({ foo: 'bar', baz: 42 });
  const b = sortedStringify({ baz: 42, foo: 'bar' });
  assert.strictEqual(a, b);
  assert.strictEqual(a, '{"baz":42,"foo":"bar"}');
});

test('sortedStringify — aceita string e number', () => {
  const s = sortedStringify({ id: 'abc', n: 7 });
  assert.strictEqual(s, '{"id":"abc","n":7}');
});

test('sha256Hex — bate com node:crypto manual', () => {
  const expected = createHash('sha256').update('hello').digest('hex');
  assert.strictEqual(sha256Hex('hello'), expected);
});

test('generateEcSignatureServer — round-trip via verify', () => {
  const ts = admin.default.firestore.Timestamp.fromMillis(1700000000000);
  const sig = generateEcSignatureServer('uid-123', { foo: 'bar', n: 1 }, ts);
  assert.strictEqual(sig.operatorId, 'uid-123');
  assert.strictEqual(sig.ts.toMillis(), 1700000000000);
  assert.strictEqual(sig.hash.length, 64); // SHA-256 hex
  assert.strictEqual(verifyEcSignatureServer(sig, { n: 1, foo: 'bar' }), true);
  assert.strictEqual(verifyEcSignatureServer(sig, { n: 2, foo: 'bar' }), false);
});

test('generateEcSignatureServer — formato canônico bate com algoritmo do web', () => {
  // Replica o algoritmo do web `ecSignatureService.generateEcSignature`:
  //   dataString = JSON.stringify({ operatorId, ts: ts.toMillis(), data: sortedStringify(payload) })
  // O hash é determinístico — server e client produzem o mesmo dado o mesmo input.
  const ts = admin.default.firestore.Timestamp.fromMillis(1700000000000);
  const payload = { execucaoId: 'exec-1', resultado: 'eficaz', dataAvaliacao: 1700000000001, fechamento: 1 };
  const sig = generateEcSignatureServer('uid-X', payload, ts);

  const expectedDataString = JSON.stringify({
    operatorId: 'uid-X',
    ts: 1700000000000,
    data: '{"dataAvaliacao":1700000000001,"execucaoId":"exec-1","fechamento":1,"resultado":"eficaz"}',
  });
  const expectedHash = createHash('sha256').update(expectedDataString).digest('hex');
  assert.strictEqual(sig.hash, expectedHash);
});
