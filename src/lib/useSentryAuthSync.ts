import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { setSentryUser, clearSentryUser } from './sentry';

/**
 * Sincroniza o contexto de usuário do Sentry com o `appProfile` do Zustand.
 * Toda exceção subsequente fica taggeada com `user.id`, `user.email`, `labId`
 * e `superAdmin` — permite filtrar issues por cliente no dashboard.
 *
 * Ouvinte direto do store evita re-render desnecessário no caller; o hook
 * só dispara efeito quando os campos relevantes mudam.
 */
export function useSentryAuthSync(): void {
  useEffect(() => {
    const sync = (state: ReturnType<typeof useAuthStore.getState>) => {
      const profile = state.appProfile;
      if (!profile?.user) {
        clearSentryUser();
        return;
      }
      setSentryUser({
        uid: profile.user.uid,
        email: profile.user.email,
        labId: profile.activeLab?.id ?? null,
        isSuperAdmin: profile.isSuperAdmin,
      });
    };

    sync(useAuthStore.getState());
    return useAuthStore.subscribe(sync);
  }, []);
}
