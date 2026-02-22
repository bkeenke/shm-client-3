import { create } from 'zustand';
import { removeCookie } from '../api/cookie';

interface User {
  user_id: number;
  login: string;
  gid?: number;
  full_name?: string;
  phone?: string;
  balance?: number;
  bonus?: number;
  credit?: number;
  discount?: number;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  telegramPhoto: string | null;

  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setTelegramPhoto: (photo: string | null) => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  telegramPhoto: localStorage.getItem('shm_telegram_photo'),

  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
  }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setTelegramPhoto: (photo) => {
    if (photo) {
      localStorage.setItem('shm_telegram_photo', photo);
    } else {
      localStorage.removeItem('shm_telegram_photo');
    }
    set({ telegramPhoto: photo });
  },
  logout: () => {
    removeCookie();
    localStorage.removeItem('shm_telegram_photo');
    set({ user: null, isAuthenticated: false, telegramPhoto: null });
  },
}));