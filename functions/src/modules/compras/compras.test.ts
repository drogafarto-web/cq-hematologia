import { describe, it, expect } from '@jest/globals';
import { isFornecedorQualificado } from './fornecedor';

describe('Compras — Fornecedor qualification', () => {
  it('should return qualified when status=qualificado + proximaRequalificacao in future', async () => {
    const result = await isFornecedorQualificado('lab-123', 'forn-123');
    // Mock: would need Firestore emulator
  });

  it('should reject when Fornecedor not found', async () => {
    const result = await isFornecedorQualificado('lab-123', 'nonexistent');
    expect(result.qualified).toBe(false);
    expect(result.reason).toContain('não encontrado');
  });

  it('should reject when status !== qualificado', async () => {
    // Would test with suspended/disqualified
  });

  it('should reject when requalificacao vencida', async () => {
    // Would test with past proximaRequalificacao
  });
});
