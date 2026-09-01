import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserAccount, UserRole } from '../types/auth';
import { UserService } from '../services/userService';

interface AuthContextType {
  user: User | null;
  users: UserAccount[];
  isAuthenticated: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addUser: (params: { username: string; password: string; name: string; role: UserRole }) => { success: boolean; error?: string };
  updateUser: (id: string, updates: { name?: string; role?: UserRole; password?: string }) => { success: boolean; error?: string };
  deleteUser: (id: string) => { success: boolean; error?: string };
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
  }, [user]);

  // Sync users list whenever modified
  const refreshUsers = () => {
    setUsers(UserService.getUsers());
  };

  const login = async (
    username: string,
    password: string,
    rememberMe = true
  ): Promise<{ success: boolean; error?: string }> => {
    const authResult = UserService.authenticate(username, password);

    if (!authResult.success || !authResult.user) {
      return { success: false, error: authResult.error || 'Giriş yapılamadı.' };
    }

    const authenticatedUser = authResult.user;
    setUser(authenticatedUser);
    setIsAuthenticated(true);

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
    setUser(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.warn('Oturum silinemedi:', e);
    }
  };

  const addUser = (params: { username: string; password: string; name: string; role: UserRole }) => {
    const res = UserService.addUser(params);
    if (res.success) {
      refreshUsers();
    }
    return res;
  };

  const updateUser = (id: string, updates: { name?: string; role?: UserRole; password?: string }) => {
    const res = UserService.updateUser(id, updates);
    if (res.success) {
      refreshUsers();
      // If updating currently logged in user, refresh their session
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

  const deleteUser = (id: string) => {
    const res = UserService.deleteUser(id);
    if (res.success) {
      refreshUsers();
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
