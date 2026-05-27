import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';

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
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userProfile: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setUserProfile: (profile) => set({ userProfile: profile }),
      setLoading: (loading) => set({ isLoading: loading }),
      isAdmin: () => get().user?.email === ADMIN_EMAIL,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ userProfile: state.userProfile }),
    }
  )
);
