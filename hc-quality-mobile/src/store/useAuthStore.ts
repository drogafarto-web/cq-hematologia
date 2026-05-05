import { create } from 'zustand';
import { User } from 'firebase/auth';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: User | null;
  activeLabId: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setActiveLabId: (labId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeLabId: null,
      loading: true,

      setUser: (user) => set({ user, loading: false }),
      setActiveLabId: (labId) => set({ activeLabId: labId }),
      clearAuth: () => set({ user: null, activeLabId: null }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
