import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, UserAccount, UserRole, Company, isUserAdmin, isSuperAdmin, LicenseInfo, getCompanyLicenseInfo } from '../types/auth';
import { UserService } from '../services/userService';
import { CompanyService } from '../services/companyService';
import { StorageService } from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import { OneSignalService } from '../services/oneSignalService';
import { DeviceService } from '../services/deviceService';
import { ServerConfigService } from '../services/serverConfigService';

interface AuthContextType {
  user: User | null;
  users: UserAccount[];
  company: Company | null;
  homeCompany: Company | null;
  viewingCompany: Company | null;
  activeCompany: Company | null;
  switchViewingCompany: (companyCode: string) => Promise<void>;
  licenseInfo: LicenseInfo;
  isAuthenticated: boolean;
  refreshCompany: () => Promise<void>;
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
    companyCode?: string;
    email?: string;
    phone?: string;
    tcNo?: string;
    address?: string;
    department?: string;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  updateUser: (
    id: string,
    updates: {
      name?: string;
      role?: UserRole;
      password?: string;
      email?: string;
      phone?: string;
      tcNo?: string;
      address?: string;
      department?: string;
      isActive?: boolean;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  suggestUsername: (name: string) => string;
  refreshUsers: () => Promise<void>;
  updateCompanyLogo: (logoUrl: string | undefined, logoFit?: 'cover' | 'contain') => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = '@gorev_tamamlama_auth_user';
const VIEWING_COMPANY_STORAGE_KEY = '@saha_takip_viewing_company_code';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      return UserService.getUsers();
    } catch {
      return [];
    }
  });
  const [homeCompany, setHomeCompany] = useState<Company | null>(null);
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null);

  const activeCompany = viewingCompany || homeCompany;

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

  // Calculate real-time SaaS license status
  const licenseInfo = useMemo(() => getCompanyLicenseInfo(activeCompany), [activeCompany]);

  const refreshCompany = async () => {
    if (user?.companyCode) {
      const comp = await CompanyService.getCompanyByCode(user.companyCode);
      if (comp) {
        setHomeCompany(comp);
      }
    }
    if (viewingCompany?.code) {
      const vComp = await CompanyService.getCompanyByCode(viewingCompany.code);
      if (vComp) {
        setViewingCompany(vComp);
      }
    }
  };

  const switchViewingCompany = async (targetCode: string) => {
    const cleanCode = (targetCode || 'POLATLAR').trim().toUpperCase();
    if (!isSuperAdmin(user)) {
      return;
    }

    if (cleanCode === 'POLATLAR' || cleanCode === (user?.companyCode || 'POLATLAR').trim().toUpperCase()) {
      setViewingCompany(null);
      try {
        localStorage.removeItem(VIEWING_COMPANY_STORAGE_KEY);
      } catch {}
      const targetComp = homeCompany || (await CompanyService.getCompanyByCode('POLATLAR'));
      if (targetComp) {
        StorageService.setCompany(targetComp.code, targetComp.id);
      } else {
        StorageService.setCompany('POLATLAR', 1);
      }
      window.dispatchEvent(
        new CustomEvent('saha:viewing-company-changed', { detail: { companyCode: 'POLATLAR' } })
      );
      return;
    }

    const targetComp = await CompanyService.getCompanyByCode(cleanCode);
    if (targetComp) {
      setViewingCompany(targetComp);
      try {
        localStorage.setItem(VIEWING_COMPANY_STORAGE_KEY, targetComp.code);
      } catch {}
      StorageService.setCompany(targetComp.code, targetComp.id);
      window.dispatchEvent(
        new CustomEvent('saha:viewing-company-changed', { detail: { companyCode: targetComp.code } })
      );
    }
  };

  // Load company metadata whenever user changes
  useEffect(() => {
    if (user?.companyCode) {
      CompanyService.getCompanyByCode(user.companyCode).then((comp) => {
        if (comp) {
          setHomeCompany(comp);
          // If not super admin or no viewing company, set StorageService to home company
          if (!isSuperAdmin(user) || !viewingCompany) {
            StorageService.setCompany(comp.code, comp.id);
          }
        } else if (user.companyCode.trim().toUpperCase() !== 'POLATLAR') {
          logout();
        }
      });

      // Restore viewing company ONLY for POLATLAR super admins if previously chosen
      if (isSuperAdmin(user)) {
        try {
          const savedViewing = localStorage.getItem(VIEWING_COMPANY_STORAGE_KEY);
          if (savedViewing && savedViewing.trim().toUpperCase() !== 'POLATLAR') {
            CompanyService.getCompanyByCode(savedViewing).then((vComp) => {
              if (vComp) {
                setViewingCompany(vComp);
                StorageService.setCompany(vComp.code, vComp.id);
              } else {
                localStorage.removeItem(VIEWING_COMPANY_STORAGE_KEY);
                setViewingCompany(null);
              }
            });
          }
        } catch {}
      } else {
        setViewingCompany(null);
        try {
          localStorage.removeItem(VIEWING_COMPANY_STORAGE_KEY);
        } catch {}
      }
    } else {
      setHomeCompany(null);
      setViewingCompany(null);
    }
  }, [user]);

  // Real-time synchronization of company module permissions across windows/tabs and from cloud
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePermissionsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ companyCode: string; permissions: any }>;
      if (customEvent.detail) {
        const evCode = customEvent.detail.companyCode.toUpperCase();
        if (user?.companyCode && evCode === user.companyCode.toUpperCase()) {
          setHomeCompany((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              modulePermissions: customEvent.detail.permissions,
            };
          });
        }
        setViewingCompany((prev) => {
          if (!prev || prev.code.toUpperCase() !== evCode) return prev;
          return {
            ...prev,
            modulePermissions: customEvent.detail.permissions,
          };
        });
      }
    };

    const handleDirectoryUpdated = () => {
      refreshCompany();
    };

    window.addEventListener('saha:company-permissions-updated', handlePermissionsUpdated);
    window.addEventListener('saha:company-directory-updated', handleDirectoryUpdated);
    return () => {
      window.removeEventListener('saha:company-permissions-updated', handlePermissionsUpdated);
      window.removeEventListener('saha:company-directory-updated', handleDirectoryUpdated);
    };
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
          companyCode: user.companyCode,
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
            companyCode: user.companyCode,
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

  const syncCurrentSession = useCallback((cloudUsers: UserAccount[]) => {
    setUser((currentUser) => {
      if (!currentUser) return null;
      const fresh = cloudUsers.find(
        (u) =>
          u.id === currentUser.id ||
          ((u.companyCode || 'POLATLAR').toUpperCase() === (currentUser.companyCode || 'POLATLAR').toUpperCase() &&
            u.username.toLowerCase() === currentUser.username.toLowerCase())
      );

      // Oturum açıkken kullanıcı pasife alındıysa oturumu derhal sonlandır
      if (fresh && fresh.isActive === false) {
        alert('Hesabınız yönetici tarafından pasife alınmıştır. Oturumunuz sonlandırılıyor.');
        setTimeout(() => logout(), 100);
        return null;
      }

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
  }, []);

  // Initial cloud fetch & realtime subscription for app_users
  useEffect(() => {
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

    const userPollTimer = setInterval(async () => {
      if (ServerConfigService.isLocalMode()) {
        try {
          const freshUsers = await UserService.fetchUsersFromCloud();
          setUsers(freshUsers);
          syncCurrentSession(freshUsers);
        } catch {
          // ignore
        }
      }
    }, 25000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(userPollTimer);
    };
  }, [syncCurrentSession]);

  const refreshUsers = useCallback(async () => {
    try {
      const cloudUsers = await UserService.fetchUsersFromCloud();
      setUsers(cloudUsers);
      syncCurrentSession(cloudUsers);
    } catch (e) {
      console.warn('Kullanıcılar yenilenirken hata:', e);
    }
  }, [syncCurrentSession]);

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
        companyCode: authenticatedUser.companyCode || matchedCompany?.code || 'POLATLAR',
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
    setHomeCompany(matchedCompany);
    setViewingCompany(null);
    try {
      localStorage.removeItem(VIEWING_COMPANY_STORAGE_KEY);
    } catch {}
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
    setHomeCompany(null);
    setViewingCompany(null);
    setIsAuthenticated(false);
    StorageService.setCompany('POLATLAR', 1);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('@saha_takip_company_code');
      localStorage.removeItem('@saha_takip_company_id');
      localStorage.removeItem(VIEWING_COMPANY_STORAGE_KEY);
    } catch (e) {
      console.warn('Oturum silinemedi:', e);
    }
  };

  const addUser = async (params: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    companyCode?: string;
    email?: string;
    phone?: string;
    tcNo?: string;
    address?: string;
    department?: string;
  }) => {
    const currentCompCode = (params.companyCode || activeCompany?.code || user?.companyCode || 'POLATLAR').trim().toUpperCase();
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
    updates: {
      name?: string;
      role?: UserRole;
      password?: string;
      email?: string;
      phone?: string;
      tcNo?: string;
      address?: string;
      department?: string;
      isActive?: boolean;
    }
  ) => {
    const res = await UserService.updateUser(id, updates);
    if (res.success) {
      await refreshUsers();
      if (user && user.id === id) {
        const updatedUser: User = {
          ...user,
          name: updates.name !== undefined ? updates.name : user.name,
          role: updates.role !== undefined ? updates.role : user.role,
          email: updates.email !== undefined ? updates.email : user.email,
          phone: updates.phone !== undefined ? updates.phone : user.phone,
          tcNo: updates.tcNo !== undefined ? updates.tcNo : user.tcNo,
          address: updates.address !== undefined ? updates.address : user.address,
          department: updates.department !== undefined ? updates.department : user.department,
          isActive: updates.isActive !== undefined ? updates.isActive : user.isActive,
        };
        setUser(updatedUser);
      }
    }
    return res;
  };

  const deleteUser = async (id: string) => {
    if (!isSuperAdmin(user)) {
      return {
        success: false,
        error: 'Kullanıcı silme yetkisi sadece POLATLAR Ana Firma Süper Yöneticilerine (murat ve admin) aittir. Diğer yöneticilerin silme yetkisi bulunmamaktadır.',
      };
    }
    const res = await UserService.deleteUser(id, user);
    if (res.success) {
      await refreshUsers();
    }
    return res;
  };

  const suggestUsername = (name: string): string => {
    const currentCompCode = activeCompany?.code || user?.companyCode || 'POLATLAR';
    return UserService.generateSuggestedUsername(name, currentCompCode);
  };

  const updateCompanyLogo = async (logoUrl: string | undefined, logoFit?: 'cover' | 'contain') => {
    const targetCompCode = (activeCompany?.code || user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const res = await CompanyService.updateCompanyLogo(targetCompCode, logoUrl, logoFit);
    if (res.success) {
      await refreshCompany();
    }
    return res;
  };

  // Strictly isolate personnel: Non-super-admins receive ONLY users from their own company!
  // POLATLAR super admins receive all users across all institutions.
  const scopedUsers = useMemo(() => {
    if (!user) return [];
    if (isSuperAdmin(user)) {
      return users;
    }
    const myComp = (user.companyCode || 'POLATLAR').trim().toUpperCase();
    return users.filter((u) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === myComp);
  }, [users, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        users: scopedUsers,
        company: activeCompany,
        homeCompany,
        viewingCompany,
        activeCompany,
        switchViewingCompany,
        licenseInfo,
        isAuthenticated,
        refreshCompany,
        login,
        logout,
        registerCompany,
        createCompanyByAdmin,
        addUser,
        updateUser,
        deleteUser,
        suggestUsername,
        refreshUsers,
        updateCompanyLogo,
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
