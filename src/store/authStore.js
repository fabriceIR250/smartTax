import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { token, user } = response.data;
          localStorage.setItem('token', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ token, user, isLoading: false });
          return { success: true };
        } catch (error) {
          set({ error: error.response?.data?.message || 'Login failed', isLoading: false });
          return { success: false, error: error.response?.data?.message };
        }
      },

      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', userData);
          const { token, user } = response.data;
          localStorage.setItem('token', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ token, user, isLoading: false });
          return { success: true };
        } catch (error) {
          set({ error: error.response?.data?.message || 'Registration failed', isLoading: false });
          return { success: false, error: error.response?.data?.message };
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null });
      },

      checkAuth: () => {
        const token = localStorage.getItem('token');
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ token });
        }
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      }
    }),
    {
      name: 'auth-storage'
    }
  )
);  