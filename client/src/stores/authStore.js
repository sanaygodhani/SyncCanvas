import { create } from 'zustand';
import { authApi, usersApi } from '../lib/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,

  init: async () => {
    try {
      set({ loading: true });
      const user = await usersApi.getMe();
      set({ user, loading: false, error: null });
    } catch {
      set({ user: null, loading: false, error: null });
    }
  },

  login: async (data) => {
    try {
      set({ loading: true, error: null });
      const session = await authApi.login(data);
      const user = await usersApi.getMe();
      set({ user, loading: false });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed';
      set({ loading: false, error: message });
      return { success: false, error: message };
    }
  },

  register: async (data) => {
    try {
      set({ loading: true, error: null });
      await authApi.register(data);
      const user = await usersApi.getMe();
      set({ user, loading: false });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed';
      set({ loading: false, error: message });
      return { success: false, error: message };
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    set({ user: null, loading: false });
  },

  updateProfile: async (data) => {
    try {
      const user = await usersApi.updateMe(data);
      set({ user });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Update failed';
      return { success: false, error: message };
    }
  },

  clearError: () => set({ error: null }),
}));

// Listen for unauthorized events
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().logout();
  });
}