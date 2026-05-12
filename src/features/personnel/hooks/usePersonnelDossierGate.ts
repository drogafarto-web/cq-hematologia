/**
 * Gate REQ-403: quem vê/edita dossiê — espelha `firestore.rules` (superadmin | admin | owner | rt).
 */

import { useEffect, useState } from 'react';

import { db, doc, onSnapshot } from '../../../shared/services/firebase';
import { useActiveLabId, useIsSuperAdmin, useUser } from '../../../store/useAuthStore';

export interface UsePersonnelDossierGateResult {
  /** true quando pode abrir aba Dossiê e gravar (se membro ativo com papel adequado, ou superadmin). */
  canAccess: boolean;
  loading: boolean;
}

export function usePersonnelDossierGate(): UsePersonnelDossierGateResult {
  const labId = useActiveLabId();
  const user = useUser();
  const isSuperAdmin = useIsSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [allowedByRole, setAllowedByRole] = useState(false);

  useEffect(() => {
    if (!labId || !user?.uid) {
      setLoading(false);
      setAllowedByRole(false);
      return;
    }

    if (isSuperAdmin) {
      setLoading(false);
      setAllowedByRole(true);
      return;
    }

    setLoading(true);
    const ref = doc(db, 'labs', labId, 'members', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setAllowedByRole(false);
          return;
        }
        const d = snap.data();
        const active = d.active === true;
        const role = String(d.role ?? '');
        setAllowedByRole(active && (role === 'admin' || role === 'owner' || role === 'rt'));
      },
      () => {
        setLoading(false);
        setAllowedByRole(false);
      },
    );

    return () => unsub();
  }, [labId, user?.uid, isSuperAdmin]);

  const canAccess = Boolean(labId && user?.uid && (isSuperAdmin || allowedByRole));

  return {
    canAccess,
    loading,
  };
}
