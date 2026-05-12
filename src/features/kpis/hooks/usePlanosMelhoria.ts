/**
 * usePlanosMelhoria — onSnapshot em `/labs/{labId}/planos-melhoria` com filtros opcionais.
 */

import { useEffect, useState } from 'react';
import {
  Timestamp,
  collection,
  onSnapshot,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { PlanoMelhoria, PlanoMelhoriaStatus } from '../types/PlanoMelhoria';

const STATUS_SET: ReadonlySet<PlanoMelhoriaStatus> = new Set([
  'rascunho',
  'ativo',
  'concluido',
  'cancelado',
]);

function mapPlanoDoc(labId: string, doc: QueryDocumentSnapshot): PlanoMelhoria | null {
  const raw = doc.data();
  if (raw.deletadoEm != null) {
    return null;
  }

  const titulo = typeof raw.titulo === 'string' ? raw.titulo : '';
  const descricao = typeof raw.descricao === 'string' ? raw.descricao : '';
  const status = raw.status as string | undefined;
  const responsavelId = typeof raw.responsavelId === 'string' ? raw.responsavelId : '';
  const responsavelNome = typeof raw.responsavelNome === 'string' ? raw.responsavelNome : '';
  const prazoMeta = raw.prazoMeta;
  const criadoEm = raw.criadoEm;
  const updatedAt = raw.updatedAt;

  if (
    !titulo ||
    !status ||
    !STATUS_SET.has(status as PlanoMelhoriaStatus) ||
    !responsavelId ||
    !(prazoMeta instanceof Timestamp) ||
    !(criadoEm instanceof Timestamp) ||
    !(updatedAt instanceof Timestamp)
  ) {
    return null;
  }

  const docLabId = typeof raw.labId === 'string' && raw.labId.length > 0 ? raw.labId : labId;

  const kpiOrigemId =
    typeof raw.kpiOrigemId === 'string' && raw.kpiOrigemId.length > 0 ? raw.kpiOrigemId : undefined;

  const conclusaoEm = raw.conclusaoEm instanceof Timestamp ? raw.conclusaoEm : undefined;
  const deletadoEm = raw.deletadoEm instanceof Timestamp ? raw.deletadoEm : undefined;

  let logicalSignature: PlanoMelhoria['logicalSignature'];
  const ls = raw.logicalSignature;
  if (ls && typeof ls === 'object') {
    const o = ls as Record<string, unknown>;
    const hash = o.hash;
    const operatorId = o.operatorId;
    const ts = o.ts;
    if (
      typeof hash === 'string' &&
      hash.length === 64 &&
      typeof operatorId === 'string' &&
      operatorId.length > 0 &&
      ts instanceof Timestamp
    ) {
      logicalSignature = { hash, operatorId, ts };
    }
  }

  const plano: PlanoMelhoria = {
    id: doc.id,
    labId: docLabId,
    titulo,
    descricao,
    ...(kpiOrigemId !== undefined ? { kpiOrigemId } : {}),
    status: status as PlanoMelhoriaStatus,
    responsavelId,
    responsavelNome,
    prazoMeta,
    ...(conclusaoEm !== undefined ? { conclusaoEm } : {}),
    ...(logicalSignature !== undefined ? { logicalSignature } : {}),
    criadoEm,
    updatedAt,
    ...(deletadoEm !== undefined ? { deletadoEm } : {}),
  };

  return plano;
}

export interface UsePlanosMelhoriaFilters {
  readonly status?: PlanoMelhoriaStatus;
  readonly responsavelId?: string;
}

export interface UsePlanosMelhoriaResult {
  readonly planos: PlanoMelhoria[];
  readonly loading: boolean;
  readonly error: Error | null;
}

export function usePlanosMelhoria(filters?: UsePlanosMelhoriaFilters): UsePlanosMelhoriaResult {
  const labId = useActiveLabId();
  const status = filters?.status;
  const responsavelId = filters?.responsavelId;

  const [planos, setPlanos] = useState<PlanoMelhoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setPlanos([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const col = collection(db, `labs/${labId}/planos-melhoria`);
    const constraints = [];
    if (status !== undefined) {
      constraints.push(where('status', '==', status));
    }
    if (responsavelId !== undefined && responsavelId.length > 0) {
      constraints.push(where('responsavelId', '==', responsavelId));
    }
    const qRef = constraints.length > 0 ? query(col, ...constraints) : col;

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: PlanoMelhoria[] = [];
        for (const d of snap.docs) {
          const p = mapPlanoDoc(labId, d);
          if (p) list.push(p);
        }
        list.sort((a, b) => {
          const byPrazo = a.prazoMeta.toMillis() - b.prazoMeta.toMillis();
          if (byPrazo !== 0) return byPrazo;
          return a.titulo.localeCompare(b.titulo, 'pt-BR');
        });
        setPlanos(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsub();
    };
  }, [labId, status, responsavelId]);

  return { planos, loading, error };
}
