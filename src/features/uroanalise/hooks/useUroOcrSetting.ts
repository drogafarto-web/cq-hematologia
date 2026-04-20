import { useState, useEffect, useCallback } from 'react';
import { db, doc, onSnapshot, setDoc, serverTimestamp } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import { useActiveLabId } from '../../../store/useAuthStore';

// ─── Path helper ──────────────────────────────────────────────────────────────

function ocrSettingRef(labId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.CIQ_UROANALISE_CONFIG, 'settings');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseUroOcrSettingResult {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  setEnabled: (v: boolean) => Promise<void>;
}

/**
 * useUroOcrSetting — lê e grava a preferência `ocrEnabled` do laboratório ativo.
 *
 * Persistência: `/labs/{labId}/ciq-uroanalise-config/settings.ocrEnabled`.
 * Default: `false` (OCR desabilitado).
 *
 * A alteração fica disponível apenas para owners/admins — a UI deve
 * ocultar/desabilitar o controle para membros regulares.
 *
 * Subscrição em tempo real via Firestore onSnapshot para refletir mudanças
 * feitas em outro dispositivo ou por outro admin.
 */
export function useUroOcrSetting(): UseUroOcrSettingResult {
  const labId = useActiveLabId();

  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setEnabledState(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      ocrSettingRef(labId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { ocrEnabled?: boolean };
          setEnabledState(Boolean(data.ocrEnabled));
        } else {
          setEnabledState(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useUroOcrSetting] listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [labId]);

  const setEnabled = useCallback(
    async (v: boolean) => {
      if (!labId) throw new Error('Nenhum laboratório ativo.');
      try {
        await setDoc(
          ocrSettingRef(labId),
          { ocrEnabled: v, updatedAt: serverTimestamp() },
          { merge: true },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar preferência.';
        setError(msg);
        throw new Error(msg, { cause: err });
      }
    },
    [labId],
  );

  return { enabled, loading, error, setEnabled };
}
