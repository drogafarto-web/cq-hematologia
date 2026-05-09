/**
 * auditDiffDetector.test.ts
 *
 * 8 test cases for field-by-field diff engine
 */

import { describe, it, expect } from '@jest/globals';
import { buildDiff } from '../auditDiffDetector';

describe('auditDiffDetector', () => {
  it('should detect string field change', () => {
    const before = { status: 'draft' };
    const after = { status: 'published' };
    const diffs = buildDiff(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: 'status',
      before: 'draft',
      after: 'published',
      type: 'update',
    });
  });

  it('should detect nested object change', () => {
    const before = { tratamento: { inicio: '2026-01-01' } };
    const after = { tratamento: { inicio: '2026-01-02' } };
    const diffs = buildDiff(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: 'tratamento.inicio',
      before: '2026-01-01',
      after: '2026-01-02',
      type: 'update',
    });
  });

  it('should detect field addition', () => {
    const before = { name: 'Test' };
    const after = { name: 'Test', email: 'test@example.com' };
    const diffs = buildDiff(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: 'email',
      before: undefined,
      after: 'test@example.com',
      type: 'add',
    });
  });

  it('should detect field removal', () => {
    const before = { name: 'Test', email: 'test@example.com' };
    const after = { name: 'Test' };
    const diffs = buildDiff(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: 'email',
      before: 'test@example.com',
      after: undefined,
      type: 'remove',
    });
  });

  it('should detect array item addition', () => {
    const before = { tags: ['a', 'b'] };
    const after = { tags: ['a', 'b', 'c'] };
    const diffs = buildDiff(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: 'tags[2]',
      before: undefined,
      after: 'c',
      type: 'array-item',
    });
  });

  it('should detect array item removal', () => {
    const before = { tags: ['a', 'b', 'c'] };
    const after = { tags: ['a', 'b'] };
    const diffs = buildDiff(before, after);

    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: 'tags[2]',
      before: 'c',
      after: undefined,
      type: 'array-item',
    });
  });

  it('should return empty array when objects are identical', () => {
    const before = { status: 'active', name: 'Test' };
    const after = { status: 'active', name: 'Test' };
    const diffs = buildDiff(before, after);

    expect(diffs).toEqual([]);
  });

  it('should handle null before → all add', () => {
    const before = null;
    const after = { name: 'Test', value: 42 };
    const diffs = buildDiff(before, after);

    expect(diffs).toHaveLength(2);
    expect(diffs).toContainEqual({
      path: 'name',
      before: undefined,
      after: 'Test',
      type: 'add',
    });
    expect(diffs).toContainEqual({
      path: 'value',
      before: undefined,
      after: 42,
      type: 'add',
    });
  });
});
