import { useAuthStore } from '../../store/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useAuthStore.setState({
      user: null,
      activeLabId: null,
      loading: true,
    });
  });

  it('initializes with null user', () => {
    const store = useAuthStore.getState();
    expect(store.user).toBeNull();
  });

  it('sets active lab ID', () => {
    const store = useAuthStore.getState();
    store.setActiveLabId('lab-123');
    const updated = useAuthStore.getState();
    expect(updated.activeLabId).toBe('lab-123');
  });

  it('clears auth on logout', () => {
    useAuthStore.setState({ user: { email: 'test@example.com' } as any });
    const store = useAuthStore.getState();
    store.clearAuth();
    const cleared = useAuthStore.getState();
    expect(cleared.user).toBeNull();
    expect(cleared.activeLabId).toBeNull();
  });
});
