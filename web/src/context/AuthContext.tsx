import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserAccount, UserRole, Company, isUserAdmin } from '../types/auth';
import { UserService } from '../services/userService';
import { CompanyService } from '../services/companyService';
import { StorageService } from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import { OneSignalService } from '../services/oneSignalService';
import { DeviceService } from '../services/deviceService';

interface AuthContextType {
  user: User | null;
  users: UserAccount[];
  company: Company | null;
  isAuthenticated: boolean;
  login: (
    companyCode: string,
    usernameOrEmail: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  registerCompany: (params: {
    name: string;
    code: string;
    adminName: string;
    adminEmail: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  createCompanyByAdmin: (params: {
    name: string;
    code: string;
    adminName: string;
    adminEmail: string;
    password: string;
  }) => Promise<{
    success: boolean;
    error?: string;
    company?: Company;
    adminUser?: User;
  }>;
  addUser: (params: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  updateUser: (
    id: string,
    updates: { name?: string; role?: UserRole; password?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  suggestUsername: (name: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = '@gorev_tamamlama_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [company, setCompany] = useState<Company | null>(null);

  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed: User = JSON.parse(saved);
        if (parsed && parsed.companyCode) {
          StorageService.setCompany(parsed.companyCode);
        } else if (parsed) {
          parsed.companyCode = 'POLATLAR';
          StorageService.setCompany('POLATLAR', 1);
        }
        if (isUserAdmin(parsed)) {
          parsed.role = 'admin';
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Oturum bilgisi okunamadı:', e);
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(user));

  // Load company metadata whenever user changes
  useEffect(() => {
    if (user?.companyCode) {
      CompanyService.getCompanyByCode(user.companyCode).then((comp) => {
        if (comp) {
          setCompany(comp);
          StorageService.setCompany(comp.code, comp.id);
        }
      });
    } else {
      setCompany(null);
    }
  }, [user]);

  useEffect(() => {
    setIsAuthenticated(Boolean(user));
    if (user) {
      // Check device authorization guard on session start (Admins exempt)
      if (!isUserAdmin(user)) {
        const currentDeviceId = DeviceService.getCurrentDeviceId();
        DeviceService.verifyDeviceAccess({
          userId: user.id,
          role: user.role,
          currentDeviceId,
          userName: user.name,
          username: user.username,
        }).then((check) => {
          if (!check.allowed) {
            alert(check.error || 'Bu cihaz yetkili cihazınız olmadığı için oturum kapatıldı.');
            logout();
          }
        });
      }

      const effectiveRole = isUserAdmin(user) ? 'admin' : user.role;
      OneSignalService.loginUser(user.id, user.name, effectiveRole, user.companyCode);
      OneSignalService.selfHealSubscription({ ...user, role: effectiveRole }).catch(() => {});
    }
  }, [user]);

  // Keep OneSignal device registration alive on app resume / tab switch via Self-Healing
  useEffect(() => {
    if (!user) return;

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        if (!isUserAdmin(user)) {
          const currentDeviceId = DeviceService.getCurrentDeviceId();
          DeviceService.verifyDeviceAccess({
            userId: user.id,
            role: user.role,
            currentDeviceId,
            userName: user.name,
            username: user.username,
          }).then((check) => {
            if (!check.allowed) {
              alert(check.error || 'Bu cihaz yetkili cihazınız olmadığı için oturum kapatıldı.');
              logout();
            }
          });
        }

        const effectiveRole = isUserAdmin(user) ? 'admin' : user.role;
        OneSignalService.loginUser(user.id, user.name, effectiveRole, user.companyCode);
        OneSignalService.selfHealSubscription({ ...user, role: effectiveRole }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [user]);

  // Initial cloud fetch & realtime subscription for app_users
  useEffect(() => {
    const syncCurrentSession = (cloudUsers: UserAccount[]) => {
      setUser((currentUser) => {
        if (!currentUser) return null;
        const fresh = cloudUsers.find(
          (u) =>
            u.id === currentUser.id ||
            ((u.companyCode || 'POLATLAR').toUpperCase() === (currentUser.companyCode || 'POLATLAR').toUpperCase() &&
              u.username.toLowerCase() === currentUser.username.toLowerCase())
        );
        const shouldBeAdmin = isUserAdmin(currentUser) || (fresh && isUserAdmin(fresh));
        const finalRole = shouldBeAdmin ? 'admin' : (fresh ? fresh.role : currentUser.role);
        const finalName = fresh ? fresh.name : currentUser.name;

        if (finalRole !== currentUser.role || finalName !== currentUser.name) {
          const updated: User = {
            ...currentUser,
            role: finalRole,
            name: finalName,
          };
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        }
        return currentUser;
      });
    };

    UserService.fetchUsersFromCloud().then((cloudUsers) => {
      setUsers(cloudUsers);
      syncCurrentSession(cloudUsers);
    });

    const channel = supabase
      .channel('app_users_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, async () => {
        const cloudUsers = await UserService.fetchUsersFromCloud();
        setUsers(cloudUsers);
        syncCurrentSession(cloudUsers);
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
    companyCode: string,
    usernameOrEmail: string,
    password: string,
    rememberMe = true
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanCompanyCode = (companyCode || 'POLATLAR').trim().toUpperCase();

    // 1. Verify Company exists
    const matchedCompany = await CompanyService.getCompanyByCode(cleanCompanyCode);
    if (!matchedCompany) {
      return {
        success: false,
        error: `"${cleanCompanyCode}" koduna ait bir kurum bulunamadı. Lütfen kurum kodunu kontrol edin.`,
      };
    }

    // 2. Authenticate User within this company
    const authResult = await UserService.authenticate(
      matchedCompany.code,
      usernameOrEmail,
      password
    );

    if (!authResult.success || !authResult.user) {
      return { success: false, error: authResult.error || 'Giriş yapılamadı.' };
    }
    const authenticatedUser = authResult.user;

    // 3. Anti-Fraud Device Lock Verification
    if (!isUserAdmin(authenticatedUser)) {
      const currentDeviceId = DeviceService.getCurrentDeviceId();
      const accessCheck = await DeviceService.verifyDeviceAccess({
        userId: authenticatedUser.id,
        role: authenticatedUser.role,
        currentDeviceId,
        userName: authenticatedUser.name,
        username: authenticatedUser.username,
      });

      if (!accessCheck.allowed) {
        return {
          success: false,
          error: accessCheck.error || 'Bu cihaz yetkili resmi cihazınız değildir. Giriş engellendi.',
        };
      }
    }

    // 4. Configure Storage & OneSignal for this company
    const effectiveRole: UserRole = isUserAdmin(authenticatedUser) ? 'admin' : authenticatedUser.role;
    const finalUser: User = isUserAdmin(authenticatedUser) ? { ...authenticatedUser, role: 'admin' } : authenticatedUser;

    StorageService.setCompany(matchedCompany.code, matchedCompany.id);
    setCompany(matchedCompany);
    setUser(finalUser);
    setIsAuthenticated(true);
    OneSignalService.loginUser(
      finalUser.id,
      finalUser.name,
      effectiveRole,
      matchedCompany.code
    );

    try {
      if (rememberMe) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(finalUser));
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(finalUser));
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      localStorage.setItem('@saha_takip_company_code', matchedCompany.code);
    } catch (e) {
      console.warn('Oturum kaydedilemedi:', e);
    }

    return { success: true };
  };

  const registerCompany = async (params: {
    name: string;
    code: string;
    adminName: string;
    adminEmail: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!params.password || params.password.length < 3) {
      return { success: false, error: 'Şifre en az 3 karakter olmalıdır.' };
    }

    // 1. Register Company
    const compRes = await CompanyService.registerCompany({
      name: params.name,
      code: params.code,
      adminName: params.adminName,
      adminEmail: params.adminEmail,
    });

    if (!compRes.success || !compRes.company) {
      return { success: false, error: compRes.error || 'Kurum kaydı oluşturulamadı.' };
    }

    const newCompany = compRes.company;

    // 2. Create Admin Account for Company
    const adminRes = await UserService.createAdminForCompany(newCompany, params.password);
    if (!adminRes.success || !adminRes.user) {
      return { success: false, error: adminRes.error || 'Yönetici hesabı oluşturulamadı.' };
    }

    // 3. Automatically log in to the new company
    return login(newCompany.code, adminRes.user.username, params.password, true);
  };

  const createCompanyByAdmin = async (params: {
    name: string;
    code: string;
    adminName: string;
    adminEmail: string;
    password: string;
  }): Promise<{
    success: boolean;
    error?: string;
    company?: Company;
    adminUser?: User;
  }> => {
    if (!params.password || params.password.length < 3) {
      return { success: false, error: 'Şifre en az 3 karakter olmalıdır.' };
    }

    // 1. Register Company
    const compRes = await CompanyService.registerCompany({
      name: params.name,
      code: params.code,
      adminName: params.adminName,
      adminEmail: params.adminEmail,
    });

    if (!compRes.success || !compRes.company) {
      return { success: false, error: compRes.error || 'Kurum kaydı oluşturulamadı.' };
    }

    const newCompany = compRes.company;

    // 2. Create Admin Account for Company
    const adminRes = await UserService.createAdminForCompany(newCompany, params.password);
    if (!adminRes.success || !adminRes.user) {
      return { success: false, error: adminRes.error || 'Yönetici hesabı oluşturulamadı.' };
    }

    // Update users in memory without logging out the current admin
    setUsers(UserService.getUsers());

    return {
      success: true,
      company: newCompany,
      adminUser: adminRes.user,
    };
  };

  const logout = () => {
    OneSignalService.logoutUser();
    setUser(null);
    setCompany(null);
    setIsAuthenticated(false);
    StorageService.setCompany('POLATLAR', 1);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('@saha_takip_company_code');
      localStorage.removeItem('@saha_takip_company_id');
    } catch (e) {
      console.warn('Oturum silinemedi:', e);
    }
  };

  const addUser = async (params: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
  }) => {
    const currentCompCode = user?.companyCode || 'POLATLAR';
    const res = await UserService.addUser({
      ...params,
      companyCode: currentCompCode,
    });
    if (res.success) {
      await refreshUsers();
    }
    return res;
  };

  const updateUser = async (
    id: string,
    updates: { name?: string; role?: UserRole; password?: string }
  ) => {
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

  const suggestUsername = (name: string): string => {
    const currentCompCode = user?.companyCode || 'POLATLAR';
    return UserService.generateSuggestedUsername(name, currentCompCode);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        company,
        isAuthenticated,
        login,
        logout,
        registerCompany,
        createCompanyByAdmin,
        addUser,
        updateUser,
        deleteUser,
        suggestUsername,
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
