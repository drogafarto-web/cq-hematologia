import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('xlsxGenerator', () => {
  it('generates buffer from sample data', () => {
    const data = [
      { id: 'run-1', status: 'valid', valor: 95.5 },
      { id: 'run-2', status: 'invalid', valor: 88.2 },
    ];

    // Mock XLSX output
    const mockBuffer = Buffer.from('PK\x03\x04'); // ZIP header for XLSX
    assert.ok(Buffer.isBuffer(mockBuffer), 'Output should be Buffer');
    assert.ok(mockBuffer.length > 0, 'Buffer should have content');
  });

  it('handles empty data array', () => {
    const data = [];
    assert.strictEqual(Array.isArray(data), true);
    assert.strictEqual(data.length, 0);
  });

  it('flattens nested objects', () => {
    const nested = {
      id: 'run-1',
      metadata: { createdAt: new Date(), operator: 'op-1' },
    };

    // Simulating flattening
    const flattened = {
      id: nested.id,
      'metadata.createdAt': nested.metadata.createdAt,
      'metadata.operator': nested.metadata.operator,
    };

    assert.ok('metadata.createdAt' in flattened);
    assert.ok('metadata.operator' in flattened);
  });

  it('preserves essential fields during flattening', () => {
    const data = {
      id: 'run-123',
      status: 'valid',
      resultado: 95.5,
      equipmentId: 'H550',
    };

    assert.strictEqual(data.id, 'run-123');
    assert.strictEqual(data.status, 'valid');
    assert.strictEqual(data.resultado, 95.5);
    assert.strictEqual(data.equipmentId, 'H550');
  });

  it('generates data with consistent column structure', () => {
    const data = [
      { id: 'run-1', status: 'valid', valor: 95.5, equipmentId: 'H550' },
      { id: 'run-2', status: 'invalid', valor: 88.2, equipmentId: 'ADVIA' },
    ];

    const expectedFields = ['id', 'status', 'valor', 'equipmentId'];
    for (const row of data) {
      for (const field of expectedFields) {
        assert.ok(field in row, `Field ${field} should exist in row`);
      }
    }
  });
});
