/**
 * Testes unitários do HMAC signature verifier (Onda 5).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHmac } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..');

const { computeHmac, verify } = await import(
  pathToFileURL(
    path.join(FUNCTIONS_DIR, 'lib/modules/signatures/verifier.js'),
  ).href
);

const { canonicalStringify } = await import(
  pathToFileURL(
    path.join(FUNCTIONS_DIR, 'lib/modules/signatures/canonical.js'),
  ).href
);

const KEY = 'test-key-32-bytes-long-enough-01';

test('computeHmac — determinístico com ordem de chaves diferente', () => {
  const a = computeHmac(KEY, { foo: 'bar', baz: 42 });
  const b = computeHmac(KEY, { baz: 42, foo: 'bar' });
  assert.strictEqual(a, b, 'canonicalize deve ordenar chaves');
});

test('computeHmac — bate com HMAC-SHA256 manual', () => {
  const payload = { labId: 'lab01', value: 7 };
  const expected = createHmac('sha256', KEY)
    .update(canonicalStringify(payload))
    .digest('hex');
  assert.strictEqual(computeHmac(KEY, payload), expected);
});

test('verify — match retorna ok=true sem divergência', () => {
  const payload = { a: 1, b: 'x' };
  const sig = computeHmac(KEY, payload);
  const result = verify(KEY, payload, sig);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.divergence, false);
});

test('verify — mismatch retorna divergência', () => {
  const payload = { a: 1 };
  const wrongSig = 'f'.repeat(64);
  const result = verify(KEY, payload, wrongSig);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.divergence, true);
});

test('verify — sem clientSignature: divergência=false (legacy)', () => {
  const result = verify(KEY, { a: 1 }, null);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.divergence, false);
});

test('canonicalize — normaliza Date para ISO', () => {
  const d = new Date('2026-04-22T12:00:00Z');
  const s = canonicalStringify({ ts: d });
  assert.ok(s.includes('2026-04-22T12:00:00.000Z'));
});

test('canonicalize — arrays mantêm ordem', () => {
  const s = canonicalStringify({ xs: [3, 1, 2] });
  assert.strictEqual(s, '{"xs":[3,1,2]}');
});

test('canonicalize — nested objects com chaves ordenadas', () => {
  const s = canonicalStringify({ z: { y: 1, x: 2 }, a: 1 });
  // a vem antes de z; dentro de z, x vem antes de y
  assert.strictEqual(s, '{"a":1,"z":{"x":2,"y":1}}');
});
