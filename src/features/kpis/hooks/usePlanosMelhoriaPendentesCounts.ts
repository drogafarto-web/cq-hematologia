/**
 * usePlanosMelhoriaPendentesCounts — conta ações com `status === 'pendente'` por plano (lista).
 * Um listener por plano; limpa todos no unmount.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, type QueryDocumentSnapshot } from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';

function countPendentes(docs: readonly QueryDocumentSnapshot[]): number {
  let n = 0;
  for (const d of docs) {
    if (d.get('status') === 'pendente') n += 1;
  }
  return n;
}

export function usePlanosMelhoriaPendentesCounts(
  labId: string | null,
  planoIds: readonly string[],
): Readonly<Record<string, number>> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const idsKey = useMemo(() => [...new Set(planoIds)].sort().join('\0'), [planoIds]);
  const activeIdsRef = useRef<ReadonlySet<string>>(new Set());

  useEffect(
    () => {
      const ids = [...new Set(planoIds)];
      activeIdsRef.current = new Set(ids);

      if (!labId || ids.length === 0) {
        setCounts({});
        return;
      }

      setCounts(Object.fromEntries(ids.map((id) => [id, 0])));

      const unsubs = ids.map((planoId) =>
        onSnapshot(
          collection(db, `labs/${labId}/planos-melhoria/${planoId}/acoes`),
          (snap) => {
            if (!activeIdsRef.current.has(planoId)) return;
            const n = countPendentes(snap.docs);
            setCounts((prev) => ({ ...prev, [planoId]: n }));
          },
          () => {
            if (!activeIdsRef.current.has(planoId)) return;
            setCounts((prev) => ({ ...prev, [planoId]: 0 }));
          },
        ),
      );

      return () => {
        activeIdsRef.current = new Set();
        unsubs.forEach((u) => {
          u();
        });
      };
    },
    // idsKey is the stable fingerprint of planoIds (array identity churns without semantic change).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- planoIds intentionally omitted; idsKey captures the set
    [labId, idsKey],
  );

  return counts;
}
