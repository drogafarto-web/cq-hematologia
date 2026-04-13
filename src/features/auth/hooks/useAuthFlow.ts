import { useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../shared/services/firebase';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  getOrCreateUserDocument,
  getLabsForUser,
  getUserRole,
  persistActiveLab,
  signOut,
} from '../services/authService';
import type { Lab } from '../../../types';

// ─── Auth state machine ───────────────────────────────────────────────────────
//
//  loading          Firebase resolving onAuthStateChanged
//  unauthenticated  No Firebase user                       → LoginScreen
//  first_setup      User has no labs, no pending request   → FirstLabSetupScreen
//  pending_access   User submitted a request, awaiting     → PendingLabAccessScreen
//  select_lab       User has multiple labs, none active    → LabSelectorScreen
//  ready            Active lab loaded                      → Main app
//                   (isSuperAdmin + no activeLab also lands here — SuperAdminDashboard)

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'first_setup'
  | 'pending_access'
  | 'select_lab'
  | 'ready';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthFlow() {
  const {
    appProfile,
    isLoading,
    error,
    setProfile,
    setActiveLab,
    setLoading,
    setError,
    reset,
  } = useAuthStore();

  // ── Bootstrap: subscribe to Firebase auth state ──────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        reset();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const userDoc = await getOrCreateUserDocument(firebaseUser);
        const labs = await getLabsForUser(userDoc.labIds);

        let activeLab: Lab | null = null;
        let role = null;

        // 1. Try to restore previously active lab
        if (userDoc.activeLabId) {
          const candidate = labs.find((l) => l.id === userDoc.activeLabId) ?? null;
          if (candidate) {
            role = await getUserRole(candidate.id, firebaseUser.uid);
            // Guard: access might have been revoked since last session
            activeLab = role ? candidate : null;
          }
        }

        // 2. Auto-select when there is exactly one lab (no picker needed)
        if (!activeLab && labs.length === 1) {
          const candidate = labs[0];
          role = await getUserRole(candidate.id, firebaseUser.uid);
          if (role) {
            activeLab = candidate;
            await persistActiveLab(firebaseUser.uid, candidate.id);
          }
        }

        // 3. Super admins bypass lab requirement — they land in ready state
        //    immediately so they can access the SuperAdminDashboard.
        //    They may still select a lab later to work within it.

        setProfile({
          user: firebaseUser,
          labs,
          activeLab,
          role,
          isSuperAdmin: userDoc.isSuperAdmin,
        });

        // Store the pending flag so deriveStatus can read it below
        // (stored as a React ref via closure is sufficient — no extra store key needed)
        _pendingLabId.current = userDoc.pendingLabId;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar perfil. Tente novamente.'
        );
      }
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derive current screen from profile state ──────────────────────────────
  const status: AuthStatus = (() => {
    if (isLoading) return 'loading';
    if (!appProfile) return 'unauthenticated';

    const { activeLab, labs, isSuperAdmin } = appProfile;

    // Super admin with no lab → go directly to admin dashboard
    if (isSuperAdmin && !activeLab) return 'ready';

    if (labs.length === 0) {
      return _pendingLabId.current ? 'pending_access' : 'first_setup';
    }

    if (!activeLab) return 'select_lab';

    return 'ready';
  })();

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectLab = useCallback(
    async (lab: Lab) => {
      if (!appProfile?.user) return;

      setError(null);
      try {
        const role = await getUserRole(lab.id, appProfile.user.uid);
        if (!role) throw new Error('Você não tem acesso a este laboratório.');

        await persistActiveLab(appProfile.user.uid, lab.id);
        setActiveLab(lab, role);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao selecionar laboratório.');
      }
    },
    [appProfile?.user, setActiveLab, setError]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } finally {
      reset(); // Always clear local state, even if Firebase signOut throws
    }
  }, [reset]);

  return {
    status,
    profile: appProfile,
    isLoading,
    error,
    selectLab,
    signOut: handleSignOut,
  } as const;
}

// ─── Module-level ref for pendingLabId ───────────────────────────────────────
// Avoids adding a non-domain field to the Zustand auth store.
// Reset on every onAuthStateChanged callback so it stays consistent.

const _pendingLabId = { current: null as string | null };
