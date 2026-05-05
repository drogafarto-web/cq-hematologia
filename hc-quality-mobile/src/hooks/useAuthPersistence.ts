import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../core/firebase';
import { useAuthStore } from '../store/useAuthStore';

export function useAuthPersistence() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      console.log('[Auth] Session restored:', user?.email ?? 'logged out');
    });

    return unsubscribe;
  }, [setUser]);
}
