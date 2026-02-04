import React from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null, token: string | null) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  
  setUser: async (user, token) => {
    if (user && token) {
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, token, isLoading: false });
  },

  updateUser: async (updates) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },

  refreshUser: async () => {
    // Simply reload user from AsyncStorage - the API already saved the data
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        set({ user });
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  },
  
  logout: async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    set({ user: null, token: null });
  },
  
  loadAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');
      
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, token, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error loading auth:', error);
      set({ isLoading: false });
    }
  },
}));
