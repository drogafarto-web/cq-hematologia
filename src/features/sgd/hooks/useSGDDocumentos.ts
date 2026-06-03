import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { SGDDocumento, DICABloco } from '../types/SGDDocumento';

interface UseSGDDocumentosOptions {
  categoria?: DICABloco;
  includeDeleted?: boolean;
}

interface UseSGDDocumentosResult {
  data: SGDDocumento[];
  loading: boolean;
  error: Error | null;
}

export function useSGDDocumentos(
  labId: string,
  options?: UseSGDDocumentosOptions,
): UseSGDDocumentosResult {
  const [data, setData] = useState<SGDDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      let q = query(collection(db, `labs/${labId}/sgd-externos`), orderBy('criadoEm', 'desc'));

      // Add filters
      const constraints = [];

      if (!options?.includeDeleted) {
        constraints.push(where('deletadoEm', '==', null));
      }

      if (options?.categoria) {
        constraints.push(where('categoriaICQ', '==', options.categoria));
      }

      if (constraints.length > 0) {
        q = query(
          collection(db, `labs/${labId}/sgd-externos`),
          ...constraints,
          orderBy('criadoEm', 'desc'),
        );
      }

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              }) as SGDDocumento,
          );

          setData(docs);
          setLoading(false);
        },
        (err) => {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        },
      );

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [labId, options?.categoria, options?.includeDeleted]);

  return { data, loading, error };
}

export function useSGDDocumento(labId: string, docId: string | null) {
  const [data, setData] = useState<SGDDocumento | null>(null);
  const [loading, setLoading] = useState(!docId);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = collection(db, `labs/${labId}/sgd-externos`);
    const q = query(docRef, where('__name__', '==', docId));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setData(null);
        } else {
          const doc = snap.docs[0];
          setData({
            id: doc.id,
            ...doc.data(),
          } as SGDDocumento);
        }
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, docId]);

  return { data, loading, error };
}

/**
 * Hook to watch audit events for a document.
 * Useful for real-time audit trail display.
 */
export function useSGDAuditEvents(labId: string, docId?: string) {
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    let q = query(collection(db, `labs/${labId}/sgd-externos-audit`), orderBy('ts', 'desc'));

    if (docId) {
      q = query(
        collection(db, `labs/${labId}/sgd-externos-audit`),
        where('documentId', '==', docId),
        orderBy('ts', 'desc'),
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEvents(docs);
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, docId]);

  return { events, loading, error };
}
