import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserAccount, Company, UserRole, LicenseInfo, getCompanyLicenseInfo } from '../types/auth';
import { StorageService } from '../services/storageService';
import { supabase } from '../api/supabaseClient';
import { CompanyService } from '../services/companyService';
import { MobileOneSignalService } from '../services/oneSignalService';
import { PasswordSecurity } from '../services/passwordSecurity';
import { MobileAuthSecurityService } from '../services/authSecurityService';

const AUTH_USER_KEY = '@saha_takip_auth_user';
const AUTH_COMPANY_KEY = '@saha_takip_auth_company';
const USERS_STORAGE_KEY = '@saha_takip_users_list';
const USERS_SLOT_ID = 101;

interface AuthContextType {
  user: User | null;
  users: UserAccount[];
  company: Company | null;
  licenseInfo: LicenseInfo;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshCompany: () => Promise<void>;
  login: (companyCode: string, username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
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
    canChangePassword?: boolean;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  updateUser: (
    id: string,
    updates: { name?: string; role?: UserRole; password?: string; canChangePassword?: boolean }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteUsersForCompany: (companyCode: string) => Promise<{ success: boolean; error?: string }>;
  suggestUsername: (name: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Built-in default user accounts
export const DEFAULT_ACCOUNTS: UserAccount[] = [
  { id: 'admin-root', username: 'admin', password: '1234', name: 'Sistem Yöneticisi', role: 'admin', companyCode: 'POLATLAR', createdAt: 1700000000000, canChangePassword: true },
  { id: 'mtjsnufrp8pfa', username: 'murat', password: '4412', name: 'Murat POLAT', role: 'admin', companyCode: 'POLATLAR', createdAt: 1788335296983, canChangePassword: true },
  { id: 'mtjso6drpactx', username: 'burak', password: '1234', name: 'Burak AĞCAKAYA', role: 'staff', companyCode: 'POLATLAR', createdAt: 1788335296990, canChangePassword: true },
  { id: 'mtjsoob6so4wi', username: 'azizcan', password: '1234', name: 'Azizcan ISIYEL', role: 'staff', companyCode: 'POLATLAR', createdAt: 1788335296991, canChangePassword: false },
  { id: 'mu3wz17wbkq2t', username: 'mertagcakaya', password: '1234', name: 'Mert Agcakaya', role: 'staff', companyCode: 'POLATLAR', createdAt: 1788335296992, canChangePassword: false },
  { id: 'mu42age5lqmew', username: 'omerbugracaglar', password: '1234', name: 'Ömer Buğra Çağlar', role: 'staff', companyCode: 'POLATLAR', createdAt: 1788335296993, canChangePassword: false },
  { id: 'mu42b1kqff54r', username: 'mehmetemirpolat', password: '1234', name: 'Mehmet Emir Polat', role: 'staff', companyCode: 'POLATLAR', createdAt: 1788335296994, canChangePassword: false },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_ACCOUNTS);
  const [isLoading, setIsLoading] = useState(true);

  const saveUsersToCloud = async (usersList: UserAccount[]): Promise<void> => {
    try {
      const json = JSON.stringify(usersList);
      const chunkSize = 3000;
      const chunks: string[] = [];
      for (let i = 0; i < json.length; i += chunkSize) {
        chunks.push(json.substring(i, i + chunkSize));
      }

      await supabase.from('standard_tasks').upsert({
        id: USERS_SLOT_ID,
        tasks: chunks,
      });

      // Mirror to app_users table for full cloud parity
      try {
        const appUserRows = usersList.map((u) => {
          const compCode = (u.companyCode || 'POLATLAR').toUpperCase();
          let cloudUsername = compCode === 'POLATLAR' ? u.username : `${compCode}:${u.username}`;
          if (u.email) {
            cloudUsername = `${cloudUsername}#${u.email}`;
          }
          return {
            id: u.id,
            username: cloudUsername,
            password: u.password,
            name: u.name,
            role: u.role,
            created_at: u.createdAt || Date.now(),
          };
        });
        await supabase.from('app_users').upsert(appUserRows);
      } catch (err) {
        console.warn('Mobil app_users aynalama uyarısı:', err);
      }
    } catch (err) {
      console.warn('Bulut kullanıcı listesi kaydedilemedi:', err);
    }
  };

  const fetchUsersFromCloud = async (companyCodeFilter?: string): Promise<UserAccount[]> => {
    let currentLocal: UserAccount[] = [];
    try {
      const saved = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentLocal = parsed;
        }
      }
    } catch {
      // ignore
    }

    try {
      // 1. Fetch from standard_tasks (Slot 101)
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', USERS_SLOT_ID)
        .single();

      let cloudUsers: UserAccount[] = [];
      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        try {
          const rawJson = data.tasks.join('');
          cloudUsers = JSON.parse(rawJson);
        } catch {
          cloudUsers = [];
        }
      }

      // 2. Also fetch from app_users table for full cloud sync & parity
      try {
        let appUsersQuery = supabase.from('app_users').select('*');
        if (companyCodeFilter) {
          const cleanFilter = companyCodeFilter.trim().toUpperCase();
          if (cleanFilter === 'POLATLAR') {
            appUsersQuery = appUsersQuery.or('username.not.like.%:%,username.ilike.POLATLAR:%');
          } else {
            appUsersQuery = appUsersQuery.ilike('username', `${cleanFilter}:%`);
          }
        }
        const { data: appUsersData, error: appUsersError } = await appUsersQuery;
        if (!appUsersError && appUsersData && appUsersData.length > 0) {
          const mappedAppUsers: UserAccount[] = appUsersData.map((row: any) => {
            let companyCode = 'POLATLAR';
            let username = row.username;
            let email: string | undefined = undefined;

            if (row.username && row.username.includes('#')) {
              const hashParts = row.username.split('#');
              username = hashParts[0];
              email = hashParts[1]?.toLowerCase();
            }

            if (username && username.includes(':')) {
              const parts = username.split(':');
              companyCode = parts[0].toUpperCase();
              username = parts.slice(1).join(':');
            }

            return {
              id: row.id,
              username,
              password: row.password,
              name: row.name,
              role: row.role as any,
              createdAt: Number(row.created_at) || Date.now(),
              companyCode,
              email,
            };
          });

          // Merge mappedAppUsers into cloudUsers
          const cloudMap = new Map<string, UserAccount>();
          cloudUsers.forEach((u) => {
            const key = `${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`;
            cloudMap.set(key, u);
          });
          mappedAppUsers.forEach((u) => {
            const key = `${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`;
            if (!cloudMap.has(key)) {
              cloudMap.set(key, u);
            } else {
              // Prefer one with hashed password if existing is plaintext
              const existing = cloudMap.get(key)!;
              if (u.password && u.password.startsWith('$s256$') && !existing.password.startsWith('$s256$')) {
                cloudMap.set(key, { ...existing, password: u.password });
              }
            }
          });
          cloudUsers = Array.from(cloudMap.values());
        }
      } catch (e) {
        // ignore app_users fallback errors
      }

      let merged: UserAccount[] = [];

      if (cloudUsers.length > 0) {
        // Map by companyCode:username
        const map = new Map<string, UserAccount>();
        cloudUsers.forEach((u) => {
          const key = `${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`;
          map.set(key, u);
        });

        // Preserve any accounts in local storage not yet in cloud or customized
        currentLocal.forEach((lu) => {
          const key = `${(lu.companyCode || 'POLATLAR').toUpperCase()}:${(lu.username || '').toLowerCase()}`;
          if (!map.has(key)) {
            map.set(key, lu);
          }
        });

        // Ensure default accounts exist if missing
        DEFAULT_ACCOUNTS.forEach((def) => {
          const key = `${(def.companyCode || 'POLATLAR').toUpperCase()}:${def.username.toLowerCase()}`;
          if (!map.has(key)) {
            map.set(key, def);
          }
        });

        merged = Array.from(map.values());
        setUsers(merged);
        await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      } else {
        // Initial setup for Slot 101: populate cloud with currentLocal or DEFAULT_ACCOUNTS
        merged = currentLocal.length > 0 ? currentLocal : DEFAULT_ACCOUNTS;
        setUsers(merged);
        await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
        await saveUsersToCloud(merged);
        return merged;
      }
    } catch (e) {
      console.warn('fetchUsersFromCloud error:', e);
      if (currentLocal.length > 0) {
        setUsers(currentLocal);
        return currentLocal;
      }
      return users;
    }
  };

  const licenseInfo = useMemo(() => getCompanyLicenseInfo(company), [company]);

  const refreshCompany = async () => {
    if (user?.companyCode) {
      const comp = await CompanyService.getCompanyByCode(user.companyCode);
      if (comp) {
        setCompany(comp);
        StorageService.setCompany(comp.code, comp.id);
        await AsyncStorage.setItem(AUTH_COMPANY_KEY, JSON.stringify(comp));
      }
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
        const savedCompany = await AsyncStorage.getItem(AUTH_COMPANY_KEY);
        const savedUsers = await AsyncStorage.getItem(USERS_STORAGE_KEY);

        if (savedUsers) {
          try {
            setUsers(JSON.parse(savedUsers));
          } catch {
            // ignore
          }
        }

        if (savedUser) {
          const u: User = JSON.parse(savedUser);
          const compCode = (u.companyCode || 'POLATLAR').trim().toUpperCase();
          const comp = await CompanyService.getCompanyByCode(compCode);
          if (!comp && compCode !== 'POLATLAR') {
            // Kurum silinmişse oturumu derhal temizle
            await AsyncStorage.removeItem(AUTH_USER_KEY);
            await AsyncStorage.removeItem(AUTH_COMPANY_KEY);
            setUser(null);
            setCompany(null);
            return;
          }
          setUser(u);
          if (comp) {
            setCompany(comp);
            await AsyncStorage.setItem(AUTH_COMPANY_KEY, JSON.stringify(comp));
          }
          StorageService.setCompany(compCode, comp?.id);
          MobileOneSignalService.login(u);
        }
        if (savedCompany) {
          setCompany(JSON.parse(savedCompany));
        }

        // Fetch latest users in background
        fetchUsersFromCloud();
      } catch (e) {
        console.warn('Session load error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (companyCode: string, username: string, password: string) => {
    const cleanComp = (companyCode || 'POLATLAR').trim().toUpperCase();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // ANTI-BRUTE FORCE: Check if account is locked out before running queries
    const lockout = await MobileAuthSecurityService.checkLockout(cleanComp, cleanUser);
    if (lockout.isLocked) {
      return {
        success: false,
        error: MobileAuthSecurityService.formatLockoutMessage(lockout.remainingSeconds),
      };
    }

    // 1. Kurumun sistemde var olup olmadığını doğrula
    const realComp = await CompanyService.getCompanyByCode(cleanComp);
    if (!realComp) {
      return {
        success: false,
        error: `"${cleanComp}" koduna ait bir kurum bulunamadı. Lütfen kurum kodunu kontrol edin.`,
      };
    }

    // 2. Fetch fresh users or check current users
    let currentUsers = users;
    try {
      const fresh = await fetchUsersFromCloud(cleanComp);
      if (fresh && fresh.length > 0) {
        currentUsers = fresh;
      }
    } catch {
      // ignore
    }

    let matched: UserAccount | undefined;
    let matchedNeedsRehash = false;

    for (const a of currentUsers) {
      if (
        (a.companyCode || 'POLATLAR').toUpperCase() === cleanComp &&
        a.username.toLowerCase() === cleanUser
      ) {
        const verify = await PasswordSecurity.verifyPassword(cleanPass, a.password);
        if (verify.valid) {
          matched = a;
          matchedNeedsRehash = verify.needsRehash;
          break;
        }
      }
    }

    if (matched) {
      // Lazy migration: If password was plaintext, immediately hash and save in background
      if (matchedNeedsRehash) {
        (async () => {
          try {
            const newHash = await PasswordSecurity.hashPassword(cleanPass);
            matched!.password = newHash;
            const updated = currentUsers.map((u) => (u.id === matched!.id ? { ...u, password: newHash } : u));
            setUsers(updated);
            await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
            await saveUsersToCloud(updated);
          } catch (e) {
            console.warn('Mobil lazy password rehash hatası:', e);
          }
        })();
      }

      const loggedUser: User = {
        id: matched.id,
        username: matched.username,
        name: matched.name,
        role: matched.role,
        companyCode: cleanComp,
        createdAt: matched.createdAt || Date.now(),
        canChangePassword: matched.canChangePassword !== undefined ? matched.canChangePassword : (matched.role === 'admin'),
      };

      const compObj: Company = realComp;

      setUser(loggedUser);
      setCompany(compObj);
      StorageService.setCompany(cleanComp, compObj.id);
      MobileOneSignalService.login(loggedUser);

      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(loggedUser));
      await AsyncStorage.setItem(AUTH_COMPANY_KEY, JSON.stringify(compObj));

      // Reset failed attempts on successful login
      await MobileAuthSecurityService.resetAttempts(cleanComp, cleanUser);

      return { success: true };
    }

    // Record failed login attempt and apply delay
    const attemptStatus = await MobileAuthSecurityService.recordFailedAttempt(cleanComp, cleanUser);
    await MobileAuthSecurityService.delay(800);

    if (attemptStatus.isLocked) {
      // Record brute-force security incident log for company admins
      StorageService.addSecurityLog({
        companyCode: cleanComp,
        attemptedUsername: cleanUser,
        deviceId: 'Mobil Cihaz',
        platform: 'Mobil (Expo)',
        message: `"${cleanUser}" hesabı 5 ardışık hatalı şifre denemesi nedeniyle 5 dakika kilitlendi.`,
        status: 'danger',
      }).catch((err) => console.warn('Mobil güvenlik logu kaydedilemedi:', err));

      return {
        success: false,
        error: MobileAuthSecurityService.formatLockoutMessage(attemptStatus.remainingSeconds),
      };
    }

    return {
      success: false,
      error: MobileAuthSecurityService.formatFailedMessage(cleanComp, attemptStatus.attemptsLeft),
    };
  };

  const logout = async () => {
    MobileOneSignalService.logout();
    setUser(null);
    setCompany(null);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    await AsyncStorage.removeItem(AUTH_COMPANY_KEY);
  };

  const refreshUsers = async () => {
    await fetchUsersFromCloud();
  };

  const suggestUsername = (name: string): string => {
    const trMap: { [k: string]: string } = {
      'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
      'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
    };
    let clean = (name || '').toLowerCase();
    for (const [tr, en] of Object.entries(trMap)) {
      clean = clean.split(tr).join(en);
    }
    clean = clean.replace(/[^a-z0-9]/g, '');
    if (!clean) clean = 'personel';

    const currentCode = (user?.companyCode || 'POLATLAR').toUpperCase();
    const existing = new Set(
      users
        .filter((u) => (u.companyCode || 'POLATLAR').toUpperCase() === currentCode)
        .map((u) => u.username.toLowerCase())
    );

    if (!existing.has(clean)) {
      return clean;
    }

    let counter = 1;
    while (true) {
      const suffix = counter < 10 ? `0${counter}` : `${counter}`;
      const candidate = `${clean}${suffix}`;
      if (!existing.has(candidate)) {
        return candidate;
      }
      counter++;
    }
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

    // Create admin account for new company
    const adminId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const createdAt = Date.now();
    const adminUsername = 'admin';
    const hashedPassword = await PasswordSecurity.hashPassword(params.password);

    const adminAccount: UserAccount = {
      id: adminId,
      username: adminUsername,
      password: hashedPassword,
      name: params.adminName.trim() || `${newCompany.name} Yöneticisi`,
      role: 'admin',
      companyCode: newCompany.code,
      email: params.adminEmail.trim().toLowerCase(),
      createdAt,
      canChangePassword: true,
    };

    const updated = [...users, adminAccount];
    setUsers(updated);
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    await saveUsersToCloud(updated);

    const adminUser: User = {
      id: adminAccount.id,
      username: adminAccount.username,
      name: adminAccount.name,
      role: adminAccount.role,
      companyCode: adminAccount.companyCode,
      email: adminAccount.email,
      createdAt: adminAccount.createdAt,
      canChangePassword: true,
    };

    return {
      success: true,
      company: newCompany,
      adminUser,
    };
  };

  const addUser = async (params: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    canChangePassword?: boolean;
  }) => {
    try {
      const currentComp = (user?.companyCode || 'POLATLAR').toUpperCase();
      const cleanUser = params.username.trim().toLowerCase();
      const newId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const createdAt = Date.now();

      // Check if username already exists in company
      const exists = users.some(
        (u) =>
          (u.companyCode || 'POLATLAR').toUpperCase() === currentComp &&
          u.username.toLowerCase() === cleanUser
      );
      if (exists) {
        return { success: false, error: `"${cleanUser}" kullanıcı adı bu kurumda zaten kullanılıyor.` };
      }

      const hashedPassword = await PasswordSecurity.hashPassword(params.password);

      const newAccount: UserAccount = {
        id: newId,
        username: cleanUser,
        password: hashedPassword,
        name: params.name.trim(),
        role: params.role,
        companyCode: currentComp,
        createdAt,
        canChangePassword: params.role === 'admin' ? true : (params.canChangePassword !== false),
      };

      const updated = [...users, newAccount];
      setUsers(updated);
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      await saveUsersToCloud(updated);
      return { success: true, user: newAccount };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Kullanıcı eklenemedi.' };
    }
  };

  const updateUser = async (
    id: string,
    updates: { name?: string; role?: UserRole; password?: string; canChangePassword?: boolean }
  ) => {
    try {
      let hashedPassword: string | undefined = undefined;
      if (updates.password && updates.password.trim()) {
        hashedPassword = await PasswordSecurity.hashPassword(updates.password.trim());
      }

      const updated = users.map((u) => {
        if (u.id === id) {
          return {
            ...u,
            ...(updates.name ? { name: updates.name.trim() } : {}),
            ...(updates.role ? { role: updates.role } : {}),
            ...(hashedPassword ? { password: hashedPassword } : {}),
            ...(updates.canChangePassword !== undefined ? { canChangePassword: updates.canChangePassword } : {}),
          };
        }
        return u;
      });

      setUsers(updated);
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      await saveUsersToCloud(updated);

      // If updating currently logged in user, update user state as well
      if (user && user.id === id) {
        const updatedCurrentUser: User = {
          ...user,
          ...(updates.name ? { name: updates.name.trim() } : {}),
          ...(updates.role ? { role: updates.role } : {}),
          ...(updates.canChangePassword !== undefined ? { canChangePassword: updates.canChangePassword } : {}),
        };
        setUser(updatedCurrentUser);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedCurrentUser));
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Kullanıcı güncellenemedi.' };
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const target = users.find((u) => u.id === id);
      if (!target) {
        return { success: false, error: 'Kullanıcı bulunamadı.' };
      }
      const comp = target.companyCode || 'POLATLAR';
      if (target.role === 'admin') {
        const adminCount = users.filter(
          (u) => (u.companyCode || 'POLATLAR').toUpperCase() === comp.toUpperCase() && u.role === 'admin'
        ).length;
        if (adminCount <= 1) {
          return {
            success: false,
            error: 'Bu kurumdaki son Yönetici (Admin) hesabı silinemez.',
          };
        }
      }

      const updated = users.filter((u) => u.id !== id);
      setUsers(updated);
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      await saveUsersToCloud(updated);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Kullanıcı silinemedi.' };
    }
  };

  const deleteUsersForCompany = async (companyCode: string) => {
    try {
      const clean = (companyCode || '').trim().toUpperCase();
      if (clean === 'POLATLAR') return { success: false, error: 'POLATLAR kullanıcıları silinemez.' };
      const updated = users.filter((u) => (u.companyCode || '').toUpperCase() !== clean);
      setUsers(updated);
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      await saveUsersToCloud(updated);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Kurum personelleri silinemedi.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        company,
        licenseInfo,
        isAuthenticated: !!user,
        isLoading,
        refreshCompany,
        login,
        logout,
        refreshUsers,
        createCompanyByAdmin,
        addUser,
        updateUser,
        deleteUser,
        deleteUsersForCompany,
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
