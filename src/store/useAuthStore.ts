import { create } from 'zustand';
import type { AppProfile, Lab, UserRole } from '../types';

interface AuthState {
  appProfile: AppProfile | null;
  isLoading: boolean;
  error: string | null;
  /** userDoc.disabled === true — lands on SuspendedScreen even after signOut. */
  isSuspended: boolean;
  /** firebaseUser.emailVerified === false — lands on EmailVerificationScreen. */
  isUnverified: boolean;
  /** User submitted a pending lab access request — distinguishes first_setup from pending_access. */
  pendingLabId: string | null;

  // Actions
  setProfile: (profile: AppProfile) => void;
  setActiveLab: (lab: Lab, role: UserRole) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setSuspended: (v: boolean) => void;
  setUnverified: (v: boolean) => void;
  setPendingLabId: (id: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  appProfile: null,
  isLoading: true, // true on mount — auth state is unknown until Firebase resolves
  error: null,
  isSuspended: false,
  isUnverified: false,
  pendingLabId: null,

  setProfile: (profile) => set({ appProfile: profile, isLoading: false, error: null }),

  setActiveLab: (lab, role) =>
    set((state) => ({
      appProfile: state.appProfile ? { ...state.appProfile, activeLab: lab, role } : null,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setSuspended: (isSuspended) => set({ isSuspended }),
  setUnverified: (isUnverified) => set({ isUnverified }),
  setPendingLabId: (pendingLabId) => set({ pendingLabId }),

  reset: () =>
    set({
      appProfile: null,
      isLoading: false,
      error: null,
      isSuspended: false,
      isUnverified: false,
      pendingLabId: null,
    }),
}));

// ─── Atomic selectors — never select new objects on every render ───────────────

export const useUser = () => useAuthStore((s) => s.appProfile?.user ?? null);
export const useActiveLab = () => useAuthStore((s) => s.appProfile?.activeLab ?? null);
export const useActiveLabId = () => useAuthStore((s) => s.appProfile?.activeLab?.id ?? null);
export const useUserRole = () => useAuthStore((s) => s.appProfile?.role ?? null);
export const useIsSuperAdmin = () => useAuthStore((s) => s.appProfile?.isSuperAdmin ?? false);
export const useAvailableLabs = () => useAuthStore((s) => s.appProfile?.labs ?? []);
export const useAuthIsLoading = () => useAuthStore((s) => s.isLoading);
export const useAuthError = () => useAuthStore((s) => s.error);
