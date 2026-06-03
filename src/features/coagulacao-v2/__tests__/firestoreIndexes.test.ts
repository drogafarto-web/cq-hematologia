import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface IndexField {
  fieldPath: string;
  order: 'ASCENDING' | 'DESCENDING';
}

interface FirestoreIndex {
  collectionGroup: string;
  queryScope: string;
  fields: IndexField[];
}

interface RequiredQuery {
  collection: string;
  filters: { field: string; order: 'ASCENDING' | 'DESCENDING' }[];
  orderBy: { field: string; order: 'ASCENDING' | 'DESCENDING' };
  source: string;
}

const indexesPath = resolve(__dirname, '../../../../firestore.indexes.json');
const indexesFile = JSON.parse(readFileSync(indexesPath, 'utf-8'));
const indexes: FirestoreIndex[] = indexesFile.indexes;

function hasMatchingIndex(query: RequiredQuery): boolean {
  const candidates = indexes.filter(
    (idx) => idx.collectionGroup === query.collection,
  );

  const requiredFields: IndexField[] = [
    ...query.filters.map((f) => ({ fieldPath: f.field, order: f.order })),
    { fieldPath: query.orderBy.field, order: query.orderBy.order },
  ];

  return candidates.some((idx) => {
    if (idx.fields.length !== requiredFields.length) return false;
    return requiredFields.every(
      (req, i) =>
        idx.fields[i].fieldPath === req.fieldPath &&
        idx.fields[i].order === req.order,
    );
  });
}

describe('Coagulação v2 — Firestore composite indexes', () => {
  const requiredQueries: RequiredQuery[] = [
    {
      collection: 'attempts',
      filters: [{ field: 'controlOperacionalId', order: 'ASCENDING' }],
      orderBy: { field: 'criadoEm', order: 'DESCENDING' },
      source: 'useAttempts.ts / attemptService.ts',
    },
    {
      collection: 'attempts',
      filters: [
        { field: 'controlOperacionalId', order: 'ASCENDING' },
        { field: 'conformidade', order: 'ASCENDING' },
      ],
      orderBy: { field: 'criadoEm', order: 'DESCENDING' },
      source: 'attemptService.ts (listAttempts with conformidade filter)',
    },
    {
      collection: 'control-operacional',
      filters: [{ field: 'status', order: 'ASCENDING' }],
      orderBy: { field: 'criadoEm', order: 'DESCENDING' },
      source: 'controlOperacionalService.ts (listControlOperacionals)',
    },
    {
      collection: 'rt-actions',
      filters: [
        { field: 'targetRef.type', order: 'ASCENDING' },
        { field: 'targetRef.id', order: 'ASCENDING' },
      ],
      orderBy: { field: 'criadoEm', order: 'DESCENDING' },
      source: 'rtActionService.ts (listRTActionsByTarget)',
    },
    {
      collection: 'rt-actions',
      filters: [{ field: 'tipo', order: 'ASCENDING' }],
      orderBy: { field: 'criadoEm', order: 'DESCENDING' },
      source: 'rtActionService.ts (listNotivisaPendentes)',
    },
  ];

  it.each(requiredQueries)(
    'index exists for $collection ($source)',
    (query) => {
      const found = hasMatchingIndex(query);
      expect(
        found,
        `Missing composite index in firestore.indexes.json for collection "${query.collection}": ` +
          `fields [${[...query.filters.map((f) => f.field), query.orderBy.field].join(', ')}]. ` +
          `Source: ${query.source}`,
      ).toBe(true);
    },
  );
});
