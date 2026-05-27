import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ADMIN_EMAIL = 'smartzonelk101@gmail.com';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: 'admin' | 'user';
  avatar?: string;
  createdAt: string;
  isActive: boolean;
}

interface AuthState {
  user: any;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isCustomAuth: boolean;
  setUser: (user: any) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setCustomAuth: (custom: boolean) => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userProfile: null,
      isLoading: true,
      isCustomAuth: false,
      setUser: (user) => set({ user }),
      setUserProfile: (profile) => set({ userProfile: profile }),
      setLoading: (loading) => set({ isLoading: loading }),
      setCustomAuth: (custom) => set({ isCustomAuth: custom }),
      isAdmin: () => get().userProfile?.role === 'admin' || get().user?.email === ADMIN_EMAIL,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        userProfile: state.userProfile,
        user: state.user,
        isCustomAuth: state.isCustomAuth
      }),
    }
  )
);
