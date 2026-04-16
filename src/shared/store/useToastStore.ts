import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (type: ToastType, message: string) => void;
  remove: (id: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  add: (type, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    // Auto-dismiss after 3.5 s
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },

  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// ─── Imperative API (usable outside React — in hooks, services) ───────────────

export const toast = {
  success: (msg: string) => useToastStore.getState().add('success', msg),
  error:   (msg: string) => useToastStore.getState().add('error',   msg),
  warning: (msg: string) => useToastStore.getState().add('warning', msg),
  info:    (msg: string) => useToastStore.getState().add('info',    msg),
};
