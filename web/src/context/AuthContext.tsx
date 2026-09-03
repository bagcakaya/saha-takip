import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserAccount, UserRole } from '../types/auth';
import { UserService } from '../services/userService';
import { supabase } from '../services/supabaseClient';
import { OneSignalService } from '../services/oneSignalService';

interface AuthContextType {
  user: User | null;
  users: UserAccount[];
  isAuthenticated: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addUser: (params: { username: string; password: string; name: string; role: UserRole }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, updates: { name?: string; role?: UserRole; password?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = '@gorev_tamamlama_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => UserService.getUsers());

  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedLocal = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedLocal) return JSON.parse(savedLocal);

      const savedSession = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (savedSession) return JSON.parse(savedSession);
    } catch (e) {
      console.warn('Oturum bilgisi okunamadı:', e);
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(user));

  useEffect(() => {
    setIsAuthenticated(Boolean(user));
    if (user) {
      OneSignalService.loginUser(user.id, user.name, user.role);
    }
  }, [user]);

  // Initial cloud fetch & realtime subscription
  useEffect(() => {
    UserService.fetchUsersFromCloud().then((cloudUsers) => {
      setUsers(cloudUsers);
    });

    // Supabase Realtime channel for app_users table
    const channel = supabase
      .channel('app_users_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, async () => {
        const cloudUsers = await UserService.fetchUsersFromCloud();
        setUsers(cloudUsers);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshUsers = async () => {
    const cloudUsers = await UserService.fetchUsersFromCloud();
    setUsers(cloudUsers);
  };

  const login = async (
    username: string,
    password: string,
    rememberMe = true
  ): Promise<{ success: boolean; error?: string }> => {
    const authResult = await UserService.authenticate(username, password);

    if (!authResult.success || !authResult.user) {
      return { success: false, error: authResult.error || 'Giriş yapılamadı.' };
    }

    const authenticatedUser = authResult.user;
    setUser(authenticatedUser);
    setIsAuthenticated(true);
    OneSignalService.loginUser(authenticatedUser.id, authenticatedUser.name, authenticatedUser.role);

    try {
      if (rememberMe) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Oturum kaydedilemedi:', e);
    }

    return { success: true };
  };

  const logout = () => {
    OneSignalService.logoutUser();
    setUser(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.warn('Oturum silinemedi:', e);
    }
  };

  const addUser = async (params: { username: string; password: string; name: string; role: UserRole }) => {
    const res = await UserService.addUser(params);
    if (res.success) {
      await refreshUsers();
    }
    return res;
  };

  const updateUser = async (id: string, updates: { name?: string; role?: UserRole; password?: string }) => {
    const res = await UserService.updateUser(id, updates);
    if (res.success) {
      await refreshUsers();
      if (user && user.id === id) {
        const updatedUser: User = {
          ...user,
          name: updates.name || user.name,
          role: updates.role || user.role,
        };
        setUser(updatedUser);
      }
    }
    return res;
  };

  const deleteUser = async (id: string) => {
    const res = await UserService.deleteUser(id);
    if (res.success) {
      await refreshUsers();
    }
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        isAuthenticated,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
