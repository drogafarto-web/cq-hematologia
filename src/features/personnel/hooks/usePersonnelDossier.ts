/**
 * Snapshot em tempo real do dossiê + upsert validado (Zod).
 */

import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import type { LabId, PersonnelDossier, PersonnelDossierEditable } from '../types';
import {
  subscribePersonnelDossier,
  upsertPersonnelDossier,
} from '../services/personnelDossierService';

interface UsePersonnelDossierResult {
  dossier: PersonnelDossier | null;
  loading: boolean;
  error: Error | null;
  save: (patch: PersonnelDossierEditable) => Promise<void>;
}

export function usePersonnelDossier(colaboradorId: string | null): UsePersonnelDossierResult {
  const labId = useActiveLabId() as LabId | null;
  const [dossier, setDossier] = useState<PersonnelDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !colaboradorId) {
      setDossier(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribePersonnelDossier(
      labId,
      colaboradorId,
      (d) => {
        setDossier(d);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId, colaboradorId]);

  const save = useCallback(
    async (patch: PersonnelDossierEditable) => {
      if (!labId || !colaboradorId) {
        throw new Error('Lab ou colaborador não selecionado.');
      }
      await upsertPersonnelDossier(labId, colaboradorId, patch);
    },
    [labId, colaboradorId],
  );

  return { dossier, loading, error, save };
}
