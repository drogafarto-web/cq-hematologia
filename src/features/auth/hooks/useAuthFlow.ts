import { useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../../shared/services/firebase';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  getUserDocument,
  getOrCreateUserDocument,
  getLabsForUser,
  getUserRole,
  persistActiveLab,
  signOut,
  signInWithGoogle,
} from '../services/authService';
import type { Lab } from '../../../types';

// ─── Auth state machine ───────────────────────────────────────────────────────
//
//  loading              Firebase resolving onAuthStateChanged
//  unauthenticated      No Firebase user                            → LoginScreen
//  suspended            userDoc.disabled === true                   → SuspendedScreen
//  email_not_verified   firebaseUser.emailVerified === false        → EmailVerificationScreen
//  first_setup          User has no labs, no pending request        → FirstLabSetupScreen
//  pending_access       User submitted a request, awaiting          → PendingLabAccessScreen
//  select_lab           User has multiple labs, none active         → LabSelectorScreen
//  ready                Active lab loaded                           → Main app
//                       (isSuperAdmin + no activeLab lands here too → SuperAdminDashboard)

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'suspended'
  | 'email_not_verified'
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

  // Module-level ref moved here: isolated to hook instance, resets with unmount
  const pendingLabIdRef  = useRef<string | null>(null);
  const isSuspendedRef   = useRef(false);
  const isUnverifiedRef  = useRef(false);

  // ── Bootstrap: subscribe to Firebase auth state ──────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Reset per-user derived flags on every auth change
      pendingLabIdRef.current  = null;
      isSuspendedRef.current   = false;
      isUnverifiedRef.current  = false;

      if (!firebaseUser) {
        reset();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // ── ITEM 1 / 2: Try read-only lookup first ────────────────────────
        // getOrCreateUserDocument is the legacy fallback for email/password
        // accounts that pre-date admin-managed creation.
        const isGoogleProvider = firebaseUser.providerData.some(
          (p) => p.providerId === 'google.com',
        );

        let userDoc = await getUserDocument(firebaseUser.uid);

        if (!userDoc) {
          if (isGoogleProvider) {
            // Google users without a doc are NEVER auto-created.
            // Sign them out immediately and surface an error.
            await signOut();
            reset();
            setError(
              'Acesso não autorizado. Solicite ao administrador do seu laboratório.',
            );
            return;
          }
          // Legacy email/password fallback — create a skeleton document.
          userDoc = await getOrCreateUserDocument(firebaseUser);
        }

        // ── ITEM 2: Suspended check BEFORE any state update ───────────────
        if (userDoc.disabled) {
          await signOut();
          reset();
          isSuspendedRef.current = true;
          setError('Conta suspensa. Entre em contato com o administrador.');
          return;
        }

        // ── ITEM 6: Email verification check (skip for SuperAdmins) ──────
        if (!firebaseUser.emailVerified && !userDoc.isSuperAdmin) {
          isUnverifiedRef.current = true;
          // We still set a minimal profile so the verification screen can
          // show user info and offer the resend option.
          setProfile({
            user: firebaseUser,
            labs: [],
            activeLab: null,
            role: null,
            isSuperAdmin: false,
          });
          return;
        }

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

        setProfile({
          user: firebaseUser,
          labs,
          activeLab,
          role,
          isSuperAdmin: userDoc.isSuperAdmin,
        });

        pendingLabIdRef.current = userDoc.pendingLabId;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar perfil. Tente novamente.',
        );
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derive current screen from profile state ──────────────────────────────
  const status: AuthStatus = (() => {
    if (isLoading) return 'loading';

    // Suspended: userDoc.disabled was true → signOut → no appProfile
    if (isSuspendedRef.current && !appProfile) return 'suspended';

    if (!appProfile) return 'unauthenticated';

    // Email not verified
    if (isUnverifiedRef.current) return 'email_not_verified';

    const { activeLab, labs, isSuperAdmin } = appProfile;

    // Super admin with no lab → go directly to admin dashboard
    if (isSuperAdmin && !activeLab) return 'ready';

    if (labs.length === 0) {
      return pendingLabIdRef.current ? 'pending_access' : 'first_setup';
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
    [appProfile?.user, setActiveLab, setError],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } finally {
      reset(); // Always clear local state, even if Firebase signOut throws
    }
  }, [reset]);

  /**
   * ITEM 9 — Google OAuth sign-in.
   * Handles the full flow: popup → user check → error or success.
   * onAuthStateChanged picks up the valid session automatically.
   */
  const handleGoogleSignIn = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged handles the rest
    } catch (err: unknown) {
      setLoading(false);
      // Cancelled by user — suppress error
      if ((err as { code?: string }).code === 'auth/popup-closed-by-user') return;
      if ((err as { code?: string }).code === 'auth/cancelled-popup-request') return;
      setError('Erro ao entrar com Google. Tente novamente.');
    }
  }, [setError, setLoading]);

  /**
   * ITEM 6 — Resend email verification.
   */
  const resendVerificationEmail = useCallback(async () => {
    const firebaseUser = appProfile?.user;
    if (!firebaseUser) return;
    try {
      await sendEmailVerification(firebaseUser);
    } catch {
      // Best-effort; UI shows a generic confirmation regardless
    }
  }, [appProfile?.user]);

  return {
    status,
    profile: appProfile,
    isLoading,
    error,
    selectLab,
    signOut: handleSignOut,
    handleGoogleSignIn,
    resendVerificationEmail,
  } as const;
}
