/**
 * Testes unitários do validador CNPJ (labApoio module).
 *
 * Garante:
 *   - validateCNPJ rejeita strings inválidas (comprimento, checksum)
 *   - validateCNPJ aceita CNPJs válidos com ou sem máscara
 *   - validateCNPJ rejeita sequências repetidas (00.000.000/0000-00, etc)
 *   - validateAVS rejeita strings muito curtas
 *   - validateAVS aceita strings válidas
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..');

const { validateCNPJ, validateAVS } = await import(
  pathToFileURL(
    path.join(FUNCTIONS_DIR, 'lib/modules/labApoio/validators.js'),
  ).href
);

// ─── CNPJ Valid cases ────────────────────────────────────────────────────────

test('validateCNPJ — CNPJ válido sem máscara', () => {
  // CNPJ: 11.222.333/0001-81 (calculado com Mod-11)
  // Testamos um CNPJ conhecido válido
  const cnpj = '11222333000181';
  assert.strictEqual(validateCNPJ(cnpj), true);
});

test('validateCNPJ — CNPJ válido com máscara', () => {
  const cnpj = '11.222.333/0001-81';
  assert.strictEqual(validateCNPJ(cnpj), true);
});

// ─── CNPJ Invalid cases ──────────────────────────────────────────────────────

test('validateCNPJ — rejeita string vazia', () => {
  assert.strictEqual(validateCNPJ(''), false);
});

test('validateCNPJ — rejeita menos de 14 dígitos', () => {
  assert.strictEqual(validateCNPJ('1122233300018'), false);
});

test('validateCNPJ — rejeita mais de 14 dígitos', () => {
  assert.strictEqual(validateCNPJ('112223330001811'), false);
});

test('validateCNPJ — rejeita sequência repetida (todos zeros)', () => {
  assert.strictEqual(validateCNPJ('00000000000000'), false);
});

test('validateCNPJ — rejeita sequência repetida (todos uns)', () => {
  assert.strictEqual(validateCNPJ('11111111111111'), false);
});

test('validateCNPJ — rejeita checksum inválido', () => {
  // Modificamos o checksum do CNPJ válido
  const cnpj = '11222333000182'; // Último dígito errado
  assert.strictEqual(validateCNPJ(cnpj), false);
});

test('validateCNPJ — rejeita CNPJ com letras', () => {
  assert.strictEqual(validateCNPJ('11.222.333/000A-81'), false);
});

// ─── AVS Valid cases ────────────────────────────────────────────────────────

test('validateAVS — AVS válido (6+ chars)', () => {
  assert.strictEqual(validateAVS('000123'), true);
});

test('validateAVS — AVS válido com números', () => {
  assert.strictEqual(validateAVS('ANVISA-12345'), true);
});

test('validateAVS — AVS válido (whitespace trimmed)', () => {
  assert.strictEqual(validateAVS('  ANVISA-12345  '), true);
});

// ─── AVS Invalid cases ───────────────────────────────────────────────────────

test('validateAVS — rejeita string vazia', () => {
  assert.strictEqual(validateAVS(''), false);
});

test('validateAVS — rejeita menos de 6 chars', () => {
  assert.strictEqual(validateAVS('00012'), false);
});

test('validateAVS — rejeita apenas espaços', () => {
  assert.strictEqual(validateAVS('      '), false);
});
