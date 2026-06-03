/**
 * auditDiffDetector.ts
 *
 * Deterministic field-by-field diff engine for audit trail.
 * Input: two snapshots (before/after). Output: list of changes.
 *
 * Used by contextCapture to record what changed in each operation.
 */

/**
 * Represents a single field change
 */
export interface DiffEntry {
  path: string; // dot-notation: "status", "tratamento.inicio", "evidencias[0]"
  before: unknown; // Value before
  after: unknown; // Value after
  type: 'add' | 'remove' | 'update' | 'array-item';
}

/**
 * Build a deterministic diff between two objects
 * Returns empty array if objects are deep-equal
 */
export function buildDiff(before: unknown, after: unknown): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  // Handle null/undefined cases
  if (before === null || before === undefined) {
    if (after !== null && after !== undefined) {
      // All top-level keys in after are "add"
      if (typeof after === 'object' && !Array.isArray(after)) {
        for (const key of Object.keys(after as Record<string, unknown>)) {
          diffs.push({
            path: key,
            before: undefined,
            after: (after as Record<string, unknown>)[key],
            type: 'add',
          });
        }
      } else {
        diffs.push({
          path: '$root',
          before,
          after,
          type: 'update',
        });
      }
    }
    return diffs;
  }

  if (after === null || after === undefined) {
    if (typeof before === 'object' && !Array.isArray(before)) {
      for (const key of Object.keys(before as Record<string, unknown>)) {
        diffs.push({
          path: key,
          before: (before as Record<string, unknown>)[key],
          after: undefined,
          type: 'remove',
        });
      }
    } else {
      diffs.push({
        path: '$root',
        before,
        after,
        type: 'update',
      });
    }
    return diffs;
  }

  // Both are defined; recurse into structure
  walkDiff(before, after, '', diffs);

  return diffs;
}

/**
 * Recursive walk through objects/arrays
 * Accumulates diffs with dot-notation paths
 */
function walkDiff(before: unknown, after: unknown, pathPrefix: string, diffs: DiffEntry[]): void {
  const beforeType = Array.isArray(before) ? 'array' : typeof before;
  const afterType = Array.isArray(after) ? 'array' : typeof after;

  // Type mismatch → update
  if (beforeType !== afterType) {
    diffs.push({
      path: pathPrefix || '$root',
      before,
      after,
      type: 'update',
    });
    return;
  }

  // Both are arrays
  if (beforeType === 'array') {
    const beforeArr = before as unknown[];
    const afterArr = after as unknown[];

    const maxLen = Math.max(beforeArr.length, afterArr.length);
    for (let i = 0; i < maxLen; i++) {
      const itemBefore = i < beforeArr.length ? beforeArr[i] : undefined;
      const itemAfter = i < afterArr.length ? afterArr[i] : undefined;

      if (itemBefore === undefined) {
        // New array item
        diffs.push({
          path: `${pathPrefix}[${i}]`,
          before: undefined,
          after: itemAfter,
          type: 'array-item',
        });
      } else if (itemAfter === undefined) {
        // Removed array item
        diffs.push({
          path: `${pathPrefix}[${i}]`,
          before: itemBefore,
          after: undefined,
          type: 'array-item',
        });
      } else if (typeof itemBefore === 'object' && typeof itemAfter === 'object') {
        // Recurse into object in array
        walkDiff(itemBefore, itemAfter, `${pathPrefix}[${i}]`, diffs);
      } else if (!deepEqual(itemBefore, itemAfter)) {
        // Scalar item changed
        diffs.push({
          path: `${pathPrefix}[${i}]`,
          before: itemBefore,
          after: itemAfter,
          type: 'update',
        });
      }
    }
    return;
  }

  // Both are objects (or primitives)
  if (beforeType === 'object') {
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;

    // Find keys in before and after
    const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

    for (const key of allKeys) {
      const valBefore = beforeObj[key];
      const valAfter = afterObj[key];
      const newPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (valBefore === undefined) {
        // New key
        diffs.push({
          path: newPath,
          before: undefined,
          after: valAfter,
          type: 'add',
        });
      } else if (valAfter === undefined) {
        // Removed key
        diffs.push({
          path: newPath,
          before: valBefore,
          after: undefined,
          type: 'remove',
        });
      } else if (
        typeof valBefore === 'object' &&
        typeof valAfter === 'object' &&
        valBefore !== null &&
        valAfter !== null
      ) {
        // Recurse
        walkDiff(valBefore, valAfter, newPath, diffs);
      } else if (!deepEqual(valBefore, valAfter)) {
        // Scalar or primitive changed
        diffs.push({
          path: newPath,
          before: valBefore,
          after: valAfter,
          type: 'update',
        });
      }
    }
  } else {
    // Primitives
    if (!deepEqual(before, after)) {
      diffs.push({
        path: pathPrefix || '$root',
        before,
        after,
        type: 'update',
      });
    }
  }
}

/**
 * Simple deep equality check for primitives
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}
