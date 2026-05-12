/**
 * usePlanoMelhoria — onSnapshot no plano e na subcoleção `acoes`.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { AcaoMelhoria, AcaoMelhoriaStatus, PlanoMelhoria, PlanoMelhoriaStatus } from '../types/PlanoMelhoria';

const PLANO_STATUS_SET: ReadonlySet<PlanoMelhoriaStatus> = new Set([
  'rascunho',
  'ativo',
  'concluido',
  'cancelado',
]);

const ACAO_STATUS_SET: ReadonlySet<AcaoMelhoriaStatus> = new Set([
  'pendente',
  'em_andamento',
  'concluida',
  'cancelada',
]);

function mapPlanoFromSnap(labId: string, snap: DocumentSnapshot): PlanoMelhoria | null {
  if (!snap.exists()) {
    return null;
  }
  const raw = snap.data();
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
    !PLANO_STATUS_SET.has(status as PlanoMelhoriaStatus) ||
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
    id: snap.id,
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

function mapAcaoDoc(labId: string, planoId: string, doc: QueryDocumentSnapshot): AcaoMelhoria | null {
  const raw = doc.data();
  const descricao = typeof raw.descricao === 'string' ? raw.descricao : '';
  const responsavelId = typeof raw.responsavelId === 'string' ? raw.responsavelId : '';
  const responsavelNome = typeof raw.responsavelNome === 'string' ? raw.responsavelNome : '';
  const prazo = raw.prazo;
  const status = raw.status as string | undefined;
  const criadoEm = raw.criadoEm;
  const updatedAt = raw.updatedAt;

  if (
    !descricao ||
    !responsavelId ||
    !(prazo instanceof Timestamp) ||
    !status ||
    !ACAO_STATUS_SET.has(status as AcaoMelhoriaStatus) ||
    !(criadoEm instanceof Timestamp) ||
    !(updatedAt instanceof Timestamp)
  ) {
    return null;
  }

  const docLabId = typeof raw.labId === 'string' && raw.labId.length > 0 ? raw.labId : labId;
  const docPlanoId =
    typeof raw.planoId === 'string' && raw.planoId.length > 0 ? raw.planoId : planoId;

  const evidencia =
    typeof raw.evidencia === 'string' && raw.evidencia.length > 0 ? raw.evidencia : undefined;

  const acao: AcaoMelhoria = {
    id: doc.id,
    labId: docLabId,
    planoId: docPlanoId,
    descricao,
    responsavelId,
    responsavelNome,
    prazo,
    status: status as AcaoMelhoriaStatus,
    ...(evidencia !== undefined ? { evidencia } : {}),
    criadoEm,
    updatedAt,
  };

  return acao;
}

export interface UsePlanoMelhoriaResult {
  readonly plano: PlanoMelhoria | null;
  readonly acoes: AcaoMelhoria[];
  readonly loading: boolean;
  readonly error: Error | null;
}

export function usePlanoMelhoria(planoId: string | null | undefined): UsePlanoMelhoriaResult {
  const labId = useActiveLabId();
  const [plano, setPlano] = useState<PlanoMelhoria | null>(null);
  const [acoes, setAcoes] = useState<AcaoMelhoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const gateRef = useRef({ plano: false, acoes: false });

  useEffect(() => {
    if (!labId || !planoId) {
      gateRef.current = { plano: false, acoes: false };
      setPlano(null);
      setAcoes([]);
      setLoading(false);
      setError(null);
      return;
    }

    gateRef.current = { plano: false, acoes: false };
    setLoading(true);
    setError(null);
    setPlano(null);
    setAcoes([]);

    const finishIfReady = (): void => {
      if (gateRef.current.plano && gateRef.current.acoes) {
        setLoading(false);
      }
    };

    const planoRef = doc(db, `labs/${labId}/planos-melhoria/${planoId}`);
    const acoesCol = collection(db, `labs/${labId}/planos-melhoria/${planoId}/acoes`);

    const unsubPlano = onSnapshot(
      planoRef,
      (snap) => {
        gateRef.current.plano = true;
        setPlano(mapPlanoFromSnap(labId, snap));
        finishIfReady();
      },
      (err) => {
        gateRef.current.plano = true;
        gateRef.current.acoes = true;
        setError(err);
        setPlano(null);
        setLoading(false);
      },
    );

    const unsubAcoes = onSnapshot(
      acoesCol,
      (snap) => {
        gateRef.current.acoes = true;
        const list: AcaoMelhoria[] = [];
        for (const d of snap.docs) {
          const a = mapAcaoDoc(labId, planoId, d);
          if (a) list.push(a);
        }
        list.sort((a, b) => {
          const byPrazo = a.prazo.toMillis() - b.prazo.toMillis();
          if (byPrazo !== 0) return byPrazo;
          return a.descricao.localeCompare(b.descricao, 'pt-BR');
        });
        setAcoes(list);
        finishIfReady();
      },
      (err) => {
        gateRef.current.acoes = true;
        gateRef.current.plano = true;
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubPlano();
      unsubAcoes();
    };
  }, [labId, planoId]);

  return { plano, acoes, loading, error };
}
