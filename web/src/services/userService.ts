import { UserAccount, UserRole, User, Company, isUserAdmin, isSuperAdmin } from '../types/auth';
import { supabase } from './supabaseClient';
import { CompanyService } from './companyService';
import { PasswordSecurity } from './passwordSecurity';
import { AuthSecurityService } from './authSecurityService';
import { StorageService } from './storageService';
import { SanitizeService } from './sanitizeService';
import { ServerConfigService } from './serverConfigService';

const USERS_STORAGE_KEY = '@gorev_tamamlama_users_list';
const USERS_SLOT_ID = 101;

const DEFAULT_ADMIN: UserAccount = {
  id: 'admin-root',
  username: 'admin',
  password: '1234',
  name: 'Sistem Yöneticisi',
  role: 'admin',
  createdAt: 1700000000000,
  companyCode: 'POLATLAR',
  companyName: 'Polatlar',
};

const DEFAULT_MURAT: UserAccount = {
  id: 'mtjsnufrp8pfa',
  username: 'murat',
  password: '4412',
  name: 'Murat POLAT',
  role: 'admin',
  createdAt: 1788335296983,
  companyCode: 'POLATLAR',
  companyName: 'Polatlar',
};

export const UserService = {
  /**
   * Retrieves all user accounts from local storage / cache
   */
  getUsers(): UserAccount[] {
    try {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u) => {
            let comp = (u.companyCode || u.company_code || '').trim().toUpperCase();
            if (!comp && u.username && u.username.includes(':')) {
              comp = u.username.split(':')[0].trim().toUpperCase();
            }
            if (comp === 'MAYAPASTANELERİ' || comp === 'MAYAPASTANELERI') {
              comp = 'MAYAPASTANE';
            }
            if (!comp) comp = 'POLATLAR';
            const isAdmin = isUserAdmin(u);
            return {
              ...u,
              companyCode: comp,
              role: isAdmin ? ('admin' as UserRole) : u.role,
            };
          });
        }
      }
    } catch (e) {
      console.warn('Kullanıcı listesi okunamadı:', e);
    }

    // Initialize with default admins
    const initialUsers = [DEFAULT_ADMIN, DEFAULT_MURAT];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialUsers));
    return initialUsers;
  },

  /**
   * Resolves company code for a user by id or username
   */
  getUserCompanyCode(userId?: string, username?: string, currentCompany?: string): string | null {
    if (!userId && !username) return null;
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanCurrent = (currentCompany || '').trim().toUpperCase();
    const allUsers = this.getUsers();

    if (userId) {
      const match = allUsers.find((u) => u.id === userId);
      if (match?.companyCode) return match.companyCode.trim().toUpperCase();
    }

    if (cleanUser) {
      const matches = allUsers.filter((u) => u.username.toLowerCase() === cleanUser);
      if (matches.length > 0) {
        if (cleanCurrent && matches.some((u) => (u.companyCode || 'POLATLAR').toUpperCase() === cleanCurrent)) {
          return cleanCurrent;
        }
        const distinct = Array.from(new Set(matches.map((u) => (u.companyCode || 'POLATLAR').trim().toUpperCase())));
        if (distinct.length === 1) {
          return distinct[0];
        }
      }
    }
    return null;
  },

  /**
   * Checks if a user (username or email) exists in a specific company
   */
  async userExistsInCompany(companyCode: string, usernameOrEmail: string): Promise<boolean> {
    const cleanComp = (companyCode || 'POLATLAR').trim().toUpperCase();
    const cleanUser = (usernameOrEmail || '').trim().toLowerCase();
    if (!cleanUser) return false;

    if (cleanComp === 'POLATLAR' && (cleanUser === 'admin' || cleanUser === 'murat')) {
      return true;
    }

    const localUsers = this.getUsers();
    if (
      localUsers.some(
        (u) =>
          (u.companyCode || 'POLATLAR').toUpperCase() === cleanComp &&
          (u.username.toLowerCase() === cleanUser || (u.email && u.email.toLowerCase() === cleanUser))
      )
    ) {
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', USERS_SLOT_ID)
        .single();

      if (!error && data?.tasks) {
        const list: UserAccount[] = Array.isArray(data.tasks)
          ? JSON.parse(data.tasks.join(''))
          : JSON.parse(data.tasks);

        return list.some(
          (u) =>
            (u.companyCode || 'POLATLAR').toUpperCase() === cleanComp &&
            (u.username.toLowerCase() === cleanUser || (u.email && u.email.toLowerCase() === cleanUser))
        );
      }
    } catch {
      // ignore
    }

    return false;
  },

  /**
   * Asynchronously resolves company code for a user across local storage AND cloud slot 101
   */
  async resolveUserCompanyCodeAsync(
    userId?: string,
    username?: string,
    currentCompany?: string
  ): Promise<string | null> {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanCurrent = (currentCompany || '').trim().toUpperCase();

    const local = this.getUserCompanyCode(userId, cleanUser, cleanCurrent);
    if (local && (!cleanCurrent || local === cleanCurrent)) return local;

    if (!userId && !cleanUser) return null;

    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', USERS_SLOT_ID)
        .single();

      if (!error && data?.tasks) {
        const list: UserAccount[] = Array.isArray(data.tasks)
          ? JSON.parse(data.tasks.join(''))
          : JSON.parse(data.tasks);

        if (userId) {
          const match = list.find((u) => u.id === userId);
          if (match?.companyCode) return match.companyCode.trim().toUpperCase();
          return null;
        }

        const matches = list.filter((u) => u.username?.toLowerCase() === cleanUser);
        if (matches.length > 0) {
          if (cleanCurrent && matches.some((u) => (u.companyCode || 'POLATLAR').toUpperCase() === cleanCurrent)) {
            return cleanCurrent;
          }
          const distinct = Array.from(new Set(matches.map((u) => (u.companyCode || 'POLATLAR').trim().toUpperCase())));
          if (distinct.length === 1) {
            return distinct[0];
          }
        }
      }
    } catch {
      // ignore
    }

    if (cleanUser === 'admin' || cleanUser === 'murat') {
      if (cleanCurrent === 'POLATLAR') return 'POLATLAR';
    }

    return null;
  },

  /**
   * Saves users list to local storage
   */
  saveUsers(users: UserAccount[]): void {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Kullanıcılar kaydedilemedi:', e);
    }
  },

  /**
   * Syncs user list to standard_tasks slot 101 for mobile app parity
   */
  async syncToSlot101(userList: UserAccount[]): Promise<void> {
    try {
      let existingList: UserAccount[] = [];

      // 1. Yerel Sunucu (Local Mode)
      if (ServerConfigService.isLocalMode()) {
        try {
          const slotRes = await ServerConfigService.apiGet<{ tasks: string[] }>(`/api/standard_tasks/${USERS_SLOT_ID}`);
          if (slotRes.data?.tasks && Array.isArray(slotRes.data.tasks) && slotRes.data.tasks.length > 0) {
            existingList = JSON.parse(slotRes.data.tasks.join(''));
          }
        } catch {}

        const userMap = new Map<string, UserAccount>();
        existingList.forEach((u) => {
          const key = `${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`;
          userMap.set(key, u);
        });
        userList.forEach((u) => {
          const key = `${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`;
          userMap.set(key, u);
        });

        const merged = Array.from(userMap.values());
        const json = JSON.stringify(merged);
        const chunkSize = 3000;
        const chunks: string[] = [];
        for (let i = 0; i < json.length; i += chunkSize) {
          chunks.push(json.substring(i, i + chunkSize));
        }

        await ServerConfigService.apiPost(`/api/standard_tasks/${USERS_SLOT_ID}`, { tasks: chunks });

        const appUserRows = merged.map((u) => {
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
        await ServerConfigService.apiPost('/api/tables/app_users/upsert', { rows: appUserRows });

        // Dual-write background mirror to Supabase cloud to maintain 100% parity
        void (async () => {
          try {
            await supabase.from('standard_tasks').upsert({ id: USERS_SLOT_ID, tasks: chunks });
            await supabase.from('app_users').upsert(appUserRows);
          } catch {}
        })();

        return;
      }

      // 2. Supabase Cloud Mode
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', USERS_SLOT_ID)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        try {
          existingList = JSON.parse(data.tasks.join(''));
        } catch {
          existingList = [];
        }
      }

      // Merge existing with userList (keyed by companyCode:username)
      const userMap = new Map<string, UserAccount>();
      existingList.forEach((u) => {
        const key = `${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`;
        userMap.set(key, u);
      });
      userList.forEach((u) => {
        const key = `${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`;
        userMap.set(key, u);
      });

      const merged = Array.from(userMap.values());
      const json = JSON.stringify(merged);
      const chunkSize = 3000;
      const chunks: string[] = [];
      for (let i = 0; i < json.length; i += chunkSize) {
        chunks.push(json.substring(i, i + chunkSize));
      }

      await supabase.from('standard_tasks').upsert({
        id: USERS_SLOT_ID,
        tasks: chunks,
      });
    } catch (err) {
      console.warn('Slot 101 kullanıcı senkronizasyon hatası:', err);
    }
  },

  /**
   * Removes specific user from Slot 101
   */
  async removeFromSlot101(userId?: string, username?: string, companyCode?: string): Promise<void> {
    try {
      let existingList: UserAccount[] = [];

      if (ServerConfigService.isLocalMode()) {
        const slotRes = await ServerConfigService.apiGet<{ tasks: string[] }>(`/api/standard_tasks/${USERS_SLOT_ID}`);
        if (slotRes.data?.tasks && Array.isArray(slotRes.data.tasks) && slotRes.data.tasks.length > 0) {
          try {
            existingList = JSON.parse(slotRes.data.tasks.join(''));
          } catch {
            return;
          }
        }
        const cleanComp = (companyCode || 'POLATLAR').toUpperCase();
        const cleanUser = (username || '').toLowerCase();
        const filtered = existingList.filter((u) => {
          if (userId && u.id === userId) return false;
          if (cleanUser && (u.companyCode || 'POLATLAR').toUpperCase() === cleanComp && (u.username || '').toLowerCase() === cleanUser) return false;
          return true;
        });
        const json = JSON.stringify(filtered);
        const chunkSize = 3000;
        const chunks: string[] = [];
        for (let i = 0; i < json.length; i += chunkSize) {
          chunks.push(json.substring(i, i + chunkSize));
        }
        await ServerConfigService.apiPost(`/api/standard_tasks/${USERS_SLOT_ID}`, { tasks: chunks });
        
        // Mirror delete to Supabase in background
        void (async () => {
          try {
            await supabase.from('standard_tasks').upsert({ id: USERS_SLOT_ID, tasks: chunks });
            if (userId) {
              await supabase.from('app_users').delete().eq('id', userId);
            }
          } catch {}
        })();

        return;
      }

      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', USERS_SLOT_ID)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        try {
          existingList = JSON.parse(data.tasks.join(''));
        } catch {
          return;
        }

        const cleanComp = (companyCode || 'POLATLAR').toUpperCase();
        const cleanUser = (username || '').toLowerCase();

        const filtered = existingList.filter((u) => {
          if (userId && u.id === userId) return false;
          if (cleanUser && (u.companyCode || 'POLATLAR').toUpperCase() === cleanComp && (u.username || '').toLowerCase() === cleanUser) return false;
          return true;
        });

        const json = JSON.stringify(filtered);
        const chunkSize = 3000;
        const chunks: string[] = [];
        for (let i = 0; i < json.length; i += chunkSize) {
          chunks.push(json.substring(i, i + chunkSize));
        }

        await supabase.from('standard_tasks').upsert({
          id: USERS_SLOT_ID,
          tasks: chunks,
        });
      }
    } catch (err) {
      console.warn('Slot 101 kullanıcı çıkarma hatası:', err);
    }
  },

  /**
   * Removes all users of a deleted company from Slot 101
   */
  async removeCompanyFromSlot101(companyCode: string): Promise<void> {
    try {
      const clean = (companyCode || '').trim().toUpperCase();
      if (!clean || clean === 'POLATLAR') return;

      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', USERS_SLOT_ID)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        let existingList: UserAccount[] = [];
        try {
          existingList = JSON.parse(data.tasks.join(''));
        } catch {
          return;
        }

        const filtered = existingList.filter(
          (u) => (u.companyCode || 'POLATLAR').toUpperCase() !== clean
        );

        const json = JSON.stringify(filtered);
        const chunkSize = 3000;
        const chunks: string[] = [];
        for (let i = 0; i < json.length; i += chunkSize) {
          chunks.push(json.substring(i, i + chunkSize));
        }

        await supabase.from('standard_tasks').upsert({
          id: USERS_SLOT_ID,
          tasks: chunks,
        });
      }
    } catch (err) {
      console.warn('Slot 101 kurum kullanıcıları çıkarma hatası:', err);
    }
  },

  /**
   * Updates user password hash in both local storage, app_users table, and Slot 101
   */
  async updateUserPasswordHash(userId: string, newHash: string): Promise<void> {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return;

    users[idx].password = newHash;
    this.saveUsers(users);

    try {
      await supabase
        .from('app_users')
        .update({ password: newHash })
        .eq('id', userId);
    } catch (err) {
      console.warn('Supabase password hash update error:', err);
    }

    // Sync to Slot 101 for mobile parity
    await this.syncToSlot101(users);
  },

  /**
   * Converts Full Name into clean suggested username:
   * - Single name: "Ahmet Yılmaz" -> "ayilmaz" (Adın ilk harfi + soyadın tamamı)
   * - Two or more names: "Mehmet Ali Yılmaz" -> "mealyilmaz" (Her iki ismin ilk 2 harfi + soyadın tamamı)
   * - "Ali Can Polat" -> "alcapolat"
   * If exists -> "ayilmaz01", "ayilmaz02"
   */
  generateSuggestedUsername(fullName: string, companyCode: string = 'POLATLAR'): string {
    const trMap: { [k: string]: string } = {
      'ç': 'c', 'Ç': 'c',
      'ğ': 'g', 'Ğ': 'g',
      'ı': 'i', 'İ': 'i', 'I': 'i',
      'ö': 'o', 'Ö': 'o',
      'ş': 's', 'Ş': 's',
      'ü': 'u', 'Ü': 'u',
    };

    let clean = (fullName || '').trim();
    for (const [tr, en] of Object.entries(trMap)) {
      clean = clean.split(tr).join(en);
    }
    clean = clean.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const parts = clean.split(/\s+/).filter(Boolean);

    let base = 'personel';
    if (parts.length === 1) {
      base = parts[0];
    } else if (parts.length >= 2) {
      // Tüm isimlerin ilk harfleri + soyadın tamamı
      // Örn: Ahmet Yılmaz -> ayilmaz
      // Örn: Mehmet Ali Yılmaz -> mayilmaz
      const nameParts = parts.slice(0, parts.length - 1);
      const surname = parts[parts.length - 1];
      const initials = nameParts.map((p) => p.slice(0, 1)).join('');
      base = `${initials}${surname}`;
    }

    base = base.replace(/[^a-z0-9]/g, '');
    if (!base) base = 'personel';

    const users = this.getUsers().filter(
      (u) => (u.companyCode || 'POLATLAR').toUpperCase() === companyCode.toUpperCase()
    );
    const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));

    if (!existingUsernames.has(base)) {
      return base;
    }

    // Find next available suffix (01, 02, 03...)
    let counter = 1;
    while (true) {
      const suffix = counter < 10 ? `0${counter}` : `${counter}`;
      const candidate = `${base}${suffix}`;
      if (!existingUsernames.has(candidate)) {
        return candidate;
      }
      counter++;
    }
  },



  /**
   * Fetches users directly from Supabase (both app_users table and standard_tasks slot 101)
   */
  async fetchUsersDirectFromSupabase(companyCodeFilter?: string): Promise<UserAccount[]> {
    try {
      const companiesMap = new Map<string, string>();
      try {
        const companies = await CompanyService.fetchCompanies();
        companies.forEach((c) => {
          if (c.code && c.adminEmail) {
            companiesMap.set(c.code.toUpperCase(), c.adminEmail.toLowerCase());
          }
        });
      } catch {}

      const userMap = new Map<string, UserAccount>();

      // 1. Fetch from app_users table
      try {
        let query = supabase
          .from('app_users')
          .select('*')
          .order('created_at', { ascending: true });

        if (companyCodeFilter) {
          const cleanFilter = companyCodeFilter.trim().toUpperCase();
          if (cleanFilter === 'POLATLAR') {
            query = query.or('username.not.like.%:%,username.ilike.POLATLAR:%');
          } else {
            query = query.ilike('username', `${cleanFilter}:%`);
          }
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          data.forEach((row) => {
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

            if (!email && row.role === 'admin' && companiesMap.has(companyCode)) {
              email = companiesMap.get(companyCode);
            }

            const isAdminRole = isUserAdmin({ username, companyCode, role: row.role });
            const u: UserAccount = {
              id: row.id,
              username,
              password: row.password,
              name: row.name,
              role: isAdminRole ? ('admin' as UserRole) : (row.role as UserRole),
              createdAt: Number(row.created_at) || Date.now(),
              companyCode,
              email,
            };
            userMap.set(`${companyCode}:${username.toLowerCase()}`, u);
          });
        }
      } catch (err) {
        console.warn('Supabase app_users sorgulanamadı:', err);
      }

      // 2. Also inspect standard_tasks slot 101 on Supabase
      try {
        const { data: slot101Data } = await supabase
          .from('standard_tasks')
          .select('tasks')
          .eq('id', USERS_SLOT_ID)
          .single();

        if (slot101Data?.tasks && Array.isArray(slot101Data.tasks) && slot101Data.tasks.length > 0) {
          const raw = slot101Data.tasks.join('');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((u: UserAccount) => {
              const comp = (u.companyCode || 'POLATLAR').toUpperCase();
              const key = `${comp}:${(u.username || '').toLowerCase()}`;
              if (!userMap.has(key)) {
                userMap.set(key, { ...u, companyCode: comp });
              } else {
                const existing = userMap.get(key)!;
                userMap.set(key, {
                  ...u,
                  ...existing,
                  tcNo: u.tcNo || existing.tcNo,
                  phone: u.phone || existing.phone,
                  address: u.address || existing.address,
                  iban: u.iban || existing.iban,
                  branchId: u.branchId || existing.branchId,
                  branchName: u.branchName || existing.branchName,
                  department: u.department || existing.department,
                  isActive: u.isActive !== undefined ? u.isActive : existing.isActive !== undefined ? existing.isActive : true,
                });
              }
            });
          }
        }
      } catch {}

      const all = Array.from(userMap.values());
      if (companyCodeFilter) {
        const clean = companyCodeFilter.trim().toUpperCase();
        return all.filter((u) => (u.companyCode || 'POLATLAR').toUpperCase() === clean);
      }
      return all;
    } catch (e) {
      console.warn('fetchUsersDirectFromSupabase error:', e);
      return [];
    }
  },

  /**
   * Fetches latest users with Local Server / Supabase cloud multi-tenant resilience
   */
  async fetchUsersFromCloud(companyCodeFilter?: string): Promise<UserAccount[]> {
    const localUsers = this.getUsers();

    // 0. Yerel Sunucu (Local Mode) - Windows Server 2022 SQL Server
    if (ServerConfigService.isLocalMode()) {
      let localFoundUsers: UserAccount[] | null = null;
      try {
        const slotRes = await ServerConfigService.apiGet<{ id: number; tasks: string[]; notFound?: boolean }>(
          `/api/standard_tasks/${USERS_SLOT_ID}`
        );
        if (slotRes.data && Array.isArray(slotRes.data.tasks) && slotRes.data.tasks.length > 0) {
          const rawJson = slotRes.data.tasks.join('');
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localFoundUsers = parsed;
          }
        }
      } catch (err) {
        console.warn('Yerel sunucu slot 101 okunurken hata:', err);
      }

      if (!localFoundUsers || localFoundUsers.length === 0) {
        try {
          const tableRes = await ServerConfigService.apiGet<any[]>('/api/tables/app_users');
          if (tableRes.data && Array.isArray(tableRes.data) && tableRes.data.length > 0) {
            localFoundUsers = tableRes.data.map((row) => {
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

              const isAdminRole = isUserAdmin({ username, companyCode, role: row.role });

              return {
                id: row.id,
                username,
                password: row.password,
                name: row.name,
                role: isAdminRole ? ('admin' as UserRole) : (row.role as UserRole),
                createdAt: Number(row.created_at) || Date.now(),
                companyCode,
                email,
              };
            });
          }
        } catch (err) {
          console.warn('Yerel sunucu app_users tablosu okunurken hata:', err);
        }
      }

      // Check if we need Supabase fallback or merge
      let needCloudFallback = !localFoundUsers || localFoundUsers.length === 0;
      if (companyCodeFilter && localFoundUsers && localFoundUsers.length > 0) {
        const cleanFilter = companyCodeFilter.trim().toUpperCase();
        const hasCompanyUsers = localFoundUsers.some(
          (u) => (u.companyCode || 'POLATLAR').toUpperCase() === cleanFilter
        );
        if (!hasCompanyUsers) {
          needCloudFallback = true;
        }
      }

      if (needCloudFallback) {
        try {
          const cloudUsers = await this.fetchUsersDirectFromSupabase(companyCodeFilter);
          if (cloudUsers && cloudUsers.length > 0) {
            const userMap = new Map<string, UserAccount>();
            (localFoundUsers || []).forEach((u) => {
              userMap.set(`${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`, u);
            });
            cloudUsers.forEach((u) => {
              userMap.set(`${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`, u);
            });
            const merged = Array.from(userMap.values());
            this.saveUsers(merged);
            this.syncToSlot101(merged).catch(() => {});
            return companyCodeFilter
              ? merged.filter((u) => (u.companyCode || 'POLATLAR').toUpperCase() === companyCodeFilter.trim().toUpperCase())
              : merged;
          }
        } catch (e) {
          console.warn('Supabase fallback error:', e);
        }
      }

      if (localFoundUsers && localFoundUsers.length > 0) {
        this.saveUsers(localFoundUsers);
        if (companyCodeFilter) {
          const cleanFilter = companyCodeFilter.trim().toUpperCase();
          return localFoundUsers.filter(
            (u) => (u.companyCode || 'POLATLAR').toUpperCase() === cleanFilter
          );
        }
        return localFoundUsers;
      }

      return localUsers;
    }

    // 1. Supabase Cloud Mode
    try {
      const cloudUsers = await this.fetchUsersDirectFromSupabase(companyCodeFilter);
      if (cloudUsers && cloudUsers.length > 0) {
        const userMap = new Map<string, UserAccount>();
        localUsers.forEach((u) => {
          userMap.set(`${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`, u);
        });
        cloudUsers.forEach((u) => {
          userMap.set(`${(u.companyCode || 'POLATLAR').toUpperCase()}:${(u.username || '').toLowerCase()}`, u);
        });
        const merged = Array.from(userMap.values());
        this.saveUsers(merged);
        return companyCodeFilter
          ? merged.filter((u) => (u.companyCode || 'POLATLAR').toUpperCase() === companyCodeFilter.trim().toUpperCase())
          : merged;
      }
    } catch (e) {
      console.warn('Supabase kullanıcı senkronizasyonu hatası:', e);
    }

    return localUsers;
  },

  /**
   * Adds a new user account within a specific company
   */
  async addUser(params: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    companyCode?: string;
    email?: string;
    phone?: string;
    tcNo?: string;
    address?: string;
    iban?: string;
    department?: string;
  }): Promise<{ success: boolean; error?: string; user?: User }> {
    const users = this.getUsers();

    // XSS / Malicious payload check
    const malicious =
      SanitizeService.detectMaliciousContent(params.username) ||
      SanitizeService.detectMaliciousContent(params.name);
    if (malicious.isMalicious) {
      return {
        success: false,
        error: 'Kullanıcı adı veya isim alanında geçersiz / zararlı karakterler tespit edildi.',
      };
    }

    const cleanCompanyCode = SanitizeService.sanitizeIdentifier(
      params.companyCode || 'POLATLAR',
      30
    ).toUpperCase();
    const cleanUsername = SanitizeService.sanitizeIdentifier(params.username, 40).toLowerCase();
    const cleanName = SanitizeService.sanitizeText(params.name || params.username, 80);
    const cleanEmail = params.email ? SanitizeService.sanitizeEmail(params.email) : undefined;
    const cleanTcNo = params.tcNo ? params.tcNo.replace(/\D/g, '').substring(0, 11) : undefined;
    const cleanPhone = params.phone ? SanitizeService.sanitizeText(params.phone, 30) : undefined;
    const cleanAddress = params.address ? SanitizeService.sanitizeText(params.address, 300) : undefined;
    const cleanIban = params.iban ? params.iban.toUpperCase().replace(/\s+/g, '') : undefined;
    const cleanDepartment = params.department ? SanitizeService.sanitizeText(params.department, 80) : undefined;
    const cleanPassword = params.password.trim();

    if (!cleanUsername) {
      return { success: false, error: 'Kullanıcı adı zorunludur.' };
    }
    if (!cleanPassword || cleanPassword.length < 3) {
      return { success: false, error: 'Şifre en az 3 karakter olmalıdır.' };
    }

    // Check collision within the SAME company
    if (
      users.some(
        (u) =>
          (u.companyCode || 'POLATLAR').toUpperCase() === cleanCompanyCode &&
          u.username.toLowerCase() === cleanUsername
      )
    ) {
      return { success: false, error: `Bu kullanıcı adı "${cleanCompanyCode}" kurumu içinde zaten kullanılmaktadır.` };
    }

    const hashedPassword = await PasswordSecurity.hashPassword(cleanPassword);
    const newUser: UserAccount = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      username: cleanUsername,
      password: hashedPassword,
      name: cleanName,
      role: params.role,
      createdAt: Date.now(),
      companyCode: cleanCompanyCode,
      email: cleanEmail,
      phone: cleanPhone,
      tcNo: cleanTcNo,
      address: cleanAddress,
      iban: cleanIban,
      department: cleanDepartment,
    };

    const updated = [...users, newUser];
    this.saveUsers(updated);

    // Sync to Supabase in background
    try {
      let cloudUsername =
        cleanCompanyCode === 'POLATLAR' ? newUser.username : `${cleanCompanyCode}:${newUser.username}`;
      if (newUser.email) {
        cloudUsername = `${cloudUsername}#${newUser.email}`;
      }

      await supabase.from('app_users').upsert([
        {
          id: newUser.id,
          username: cloudUsername,
          password: newUser.password,
          name: newUser.name,
          role: newUser.role,
          created_at: newUser.createdAt,
        },
      ]);
    } catch (err) {
      console.warn('Supabase kullanıcı kaydı buluta gönderilemedi:', err);
    }

    // Also mirror to Slot 101 for mobile app parity
    try {
      await this.syncToSlot101(updated);
    } catch (err) {
      console.warn('Slot 101 sync error in addUser:', err);
    }

    return {
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt,
        companyCode: newUser.companyCode,
        email: newUser.email,
        phone: newUser.phone,
        tcNo: newUser.tcNo,
        address: newUser.address,
        iban: newUser.iban,
        department: newUser.department,
      },
    };
  },

  /**
   * Creates initial admin user when a new company registers
   */
  async createAdminForCompany(
    company: Company,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    // Generate a default admin username from company code or email
    const username = 'admin';

    return this.addUser({
      username,
      password,
      name: company.adminName || `${company.name} Yöneticisi`,
      role: 'admin',
      companyCode: company.code,
      email: company.adminEmail,
    });
  },

  /**
   * Updates an existing user account (role, name, password)
   */
  async updateUser(
    id: string,
    updates: {
      name?: string;
      role?: UserRole;
      password?: string;
      email?: string;
      phone?: string;
      tcNo?: string;
      address?: string;
      iban?: string;
      department?: string;
      isActive?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    let users = this.getUsers();
    let userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      try {
        users = await this.fetchUsersFromCloud();
        userIndex = users.findIndex((u) => u.id === id);
      } catch {
        // ignore
      }
    }

    if (userIndex === -1) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    const current = users[userIndex];
    const companyCode = current.companyCode || 'POLATLAR';

    // Protection: Prevent demoting the last admin of this company
    if (updates.role && updates.role !== 'admin') {
      const adminCount = users.filter(
        (u) => (u.companyCode || 'POLATLAR') === companyCode && u.role === 'admin'
      ).length;
      if (adminCount <= 1 && current.role === 'admin') {
        return {
          success: false,
          error: 'Bu kurumda en az 1 adet Yönetici (Admin) bulunmalıdır. Yetki düşürülemez.',
        };
      }
    }

    // Protection: Prevent deactivating the last active admin of this company
    if (updates.isActive === false && current.role === 'admin') {
      const activeAdminCount = users.filter(
        (u) => (u.companyCode || 'POLATLAR') === companyCode && u.role === 'admin' && u.isActive !== false
      ).length;
      if (activeAdminCount <= 1) {
        return {
          success: false,
          error: 'Bu kurumda en az 1 adet aktif Yönetici (Admin) bulunmalıdır. Son yönetici pasife alınamaz.',
        };
      }
    }

    if (updates.name !== undefined) {
      const check = SanitizeService.detectMaliciousContent(updates.name);
      if (check.isMalicious) {
        return { success: false, error: 'İsim alanında geçersiz / zararlı karakterler tespit edildi.' };
      }
    }

    let newPassword = current.password;
    if (updates.password !== undefined && updates.password.trim()) {
      newPassword = await PasswordSecurity.hashPassword(updates.password.trim());
    }

    const cleanTcNo = updates.tcNo !== undefined 
      ? (updates.tcNo.trim() ? updates.tcNo.replace(/\D/g, '').substring(0, 11) : undefined) 
      : current.tcNo;
    const cleanPhone = updates.phone !== undefined 
      ? (updates.phone.trim() ? SanitizeService.sanitizeText(updates.phone, 30) : undefined) 
      : current.phone;
    const cleanAddress = updates.address !== undefined 
      ? (updates.address.trim() ? SanitizeService.sanitizeText(updates.address, 300) : undefined) 
      : current.address;
    const cleanIban = updates.iban !== undefined
      ? (updates.iban.trim() ? updates.iban.toUpperCase().replace(/\s+/g, '') : undefined)
      : current.iban;
    const cleanEmail = updates.email !== undefined 
      ? (updates.email.trim() ? SanitizeService.sanitizeEmail(updates.email) : undefined) 
      : current.email;
    const cleanDepartment = updates.department !== undefined
      ? (updates.department.trim() ? SanitizeService.sanitizeText(updates.department, 80) : undefined)
      : current.department;

    const updatedUser = {
      ...current,
      name:
        updates.name !== undefined && updates.name.trim()
          ? SanitizeService.sanitizeText(updates.name, 80)
          : current.name,
      role: updates.role !== undefined ? updates.role : current.role,
      password: newPassword,
      email: cleanEmail,
      phone: cleanPhone,
      tcNo: cleanTcNo,
      address: cleanAddress,
      iban: cleanIban,
      department: cleanDepartment,
      isActive: updates.isActive !== undefined ? updates.isActive : current.isActive,
    };

    users[userIndex] = updatedUser;
    this.saveUsers(users);

    // Sync to Supabase
    try {
      let cloudUsername =
        companyCode === 'POLATLAR' ? updatedUser.username : `${companyCode}:${updatedUser.username}`;
      if (updatedUser.email) {
        cloudUsername = `${cloudUsername}#${updatedUser.email}`;
      }

      const { error: upsertErr } = await supabase.from('app_users').upsert([
        {
          id: updatedUser.id,
          username: cloudUsername,
          name: updatedUser.name,
          role: updatedUser.role,
          password: updatedUser.password,
          created_at: updatedUser.createdAt,
        },
      ]);

      if (upsertErr) {
        console.warn('Supabase app_users upsert hatası, update deneniyor:', upsertErr);
        await supabase
          .from('app_users')
          .update({
            password: updatedUser.password,
            name: updatedUser.name,
            role: updatedUser.role,
          })
          .eq('id', updatedUser.id);
      }
    } catch (err) {
      console.warn('Supabase kullanıcı güncelleme hatası:', err);
    }

    // Also mirror to Slot 101 for mobile app parity
    try {
      await this.syncToSlot101(users);
    } catch (err) {
      console.warn('Slot 101 sync error in updateUser:', err);
    }

    return { success: true };
  },

  /**
   * Deletes a user account.
   * Strictly and exclusively permitted to POLATLAR super admins ('admin' and 'murat').
   */
  async deleteUser(
    id: string,
    actor?: { role?: string; companyCode?: string; username?: string } | null
  ): Promise<{ success: boolean; error?: string }> {
    // Sadece POLATLAR Ana Firma Süper Yöneticileri (admin ve murat) silebilir!
    if (actor && !isSuperAdmin(actor)) {
      return {
        success: false,
        error: 'Kullanıcı silme yetkisi sadece POLATLAR Ana Firma Süper Yöneticilerine (admin ve murat) aittir. Diğer yöneticilerin silme yetkisi yoktur.',
      };
    }

    const users = this.getUsers();
    const target = users.find((u) => u.id === id);

    if (!target) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    // Koruma: POLATLAR Süper Admin hesapları ('admin' ve 'murat') ASLA silinemez
    const targetComp = (target.companyCode || 'POLATLAR').trim().toUpperCase();
    const targetUname = (target.username || '').trim().toLowerCase();
    if (targetComp === 'POLATLAR' && (targetUname === 'admin' || targetUname === 'murat')) {
      return {
        success: false,
        error: 'POLATLAR Ana Firma Süper Yönetici hesapları (admin ve murat) silinemez.',
      };
    }

    const companyCode = target.companyCode || 'POLATLAR';

    // Protection: Prevent deleting the last admin of this company
    if (target.role === 'admin') {
      const adminCount = users.filter(
        (u) => (u.companyCode || 'POLATLAR') === companyCode && u.role === 'admin'
      ).length;
      if (adminCount <= 1) {
        return {
          success: false,
          error: 'Bu kurumdaki son Yönetici (Admin) hesabı silinemez.',
        };
      }
    }

    const filtered = users.filter((u) => u.id !== id);
    this.saveUsers(filtered);

    // 1. Yerel Sunucu (Local Mode)
    if (ServerConfigService.isLocalMode()) {
      await ServerConfigService.apiPost('/api/tables/app_users/delete', { ids: [id] });
      await this.removeFromSlot101(id, target.username, target.companyCode);
      return { success: true };
    }

    // 2. Supabase Cloud Fallback
    try {
      await supabase.from('app_users').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase kullanıcı silme hatası:', err);
    }

    // Also remove from Slot 101 for mobile app parity
    try {
      await this.removeFromSlot101(id, target.username, target.companyCode);
    } catch (err) {
      console.warn('Slot 101 removeFromSlot101 error:', err);
    }

    return { success: true };
  },

  /**
   * Deletes all users belonging to a company (except POLATLAR)
   */
  async deleteUsersForCompany(companyCode: string): Promise<void> {
    const clean = (companyCode || '').trim().toUpperCase();
    if (clean === 'POLATLAR') return;
    const users = this.getUsers();
    const toDelete = users.filter((u) => (u.companyCode || '').toUpperCase() === clean);
    const filtered = users.filter((u) => (u.companyCode || '').toUpperCase() !== clean);
    this.saveUsers(filtered);

    if (ServerConfigService.isLocalMode()) {
      const ids = toDelete.map((u) => u.id);
      if (ids.length > 0) {
        await ServerConfigService.apiPost('/api/tables/app_users/delete', { ids });
      }
      await this.removeCompanyFromSlot101(clean);
      return;
    }

    for (const u of toDelete) {
      try {
        await supabase.from('app_users').delete().eq('id', u.id);
      } catch (err) {
        // ignore
      }
    }
    // Also remove company users from Slot 101 for mobile app parity
    try {
      await this.removeCompanyFromSlot101(clean);
    } catch (err) {
      console.warn('Slot 101 removeCompanyFromSlot101 error:', err);
    }
  },

  /**
   * Authenticates user against registered accounts within a specific company
   */
  async authenticate(
    companyCode: string,
    usernameOrEmail: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    const cleanCompany = (companyCode || 'POLATLAR').trim().toUpperCase();
    const cleanIdentifier = (usernameOrEmail || '').trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanCompany) {
      return { success: false, error: 'Lütfen Kurum Kodunu giriniz (Örn: POLATLAR).' };
    }
    if (!cleanIdentifier) {
      return { success: false, error: 'Lütfen Kullanıcı Adınızı giriniz.' };
    }

    // ANTI-BRUTE FORCE: Check if account is locked out before hitting network
    const lockout = AuthSecurityService.checkLockout(cleanCompany, cleanIdentifier);
    if (lockout.isLocked) {
      return {
        success: false,
        error: AuthSecurityService.formatLockoutMessage(lockout.remainingSeconds),
      };
    }

    // Always fetch company to verify company and get adminEmail
    let company = await CompanyService.getCompanyByCode(cleanCompany);
    if (!company && cleanCompany !== 'POLATLAR') {
      // Force refresh from cloud
      const cloudCompanies = await CompanyService.fetchCompanies();
      company = cloudCompanies.find((c) => c.code.toUpperCase() === cleanCompany) || null;
    }

    if (!company && cleanCompany !== 'POLATLAR') {
      return {
        success: false,
        error: `"${cleanCompany}" koduna sahip bir kurum bulunamadı. Lütfen kurum kodunu kontrol ediniz.`,
      };
    }

    const companyAdminEmail = company?.adminEmail?.trim().toLowerCase();

    // Helper to find match with async password verification
    const findMatch = async (userList: UserAccount[]) => {
      for (const u of userList) {
        const uComp = (u.companyCode || 'POLATLAR').toUpperCase();
        if (uComp !== cleanCompany) continue;

        const isUserMatch = u.username.toLowerCase() === cleanIdentifier;
        const isEmailMatch =
          (u.email && u.email.toLowerCase() === cleanIdentifier) ||
          (u.role === 'admin' && companyAdminEmail && companyAdminEmail === cleanIdentifier);

        if (isUserMatch || isEmailMatch) {
          const verification = await PasswordSecurity.verifyPassword(cleanPass, u.password);
          if (verification.valid) {
            return { account: u, needsRehash: verification.needsRehash };
          }
        }
      }
      return null;
    };

    // 1. Always fetch latest users from Supabase cloud first scoped to target company
    let users: UserAccount[] = [];
    try {
      users = await this.fetchUsersFromCloud(cleanCompany);
    } catch {
      users = this.getUsers();
    }
    if (!users || users.length === 0) {
      users = this.getUsers();
    }

    const matchResult = await findMatch(users);

    if (!matchResult) {
      // Check if user actually exists in the requested target company
      const userExistsInTarget = users.some(
        (u) =>
          (u.companyCode || 'POLATLAR').toUpperCase() === cleanCompany &&
          (u.username.toLowerCase() === cleanIdentifier ||
            (u.email && u.email.toLowerCase() === cleanIdentifier) ||
            (u.role === 'admin' && companyAdminEmail && companyAdminEmail === cleanIdentifier))
      );

      // If user DOES NOT exist in target company at all, check if they uniquely belong to another company
      if (!userExistsInTarget) {
        const foreignCompany = await this.resolveUserCompanyCodeAsync(undefined, cleanIdentifier, cleanCompany);
        if (foreignCompany && foreignCompany !== cleanCompany) {
          // Record failed attempt on foreign company so POLATLAR admins don't receive spam notifications
          AuthSecurityService.recordFailedAttempt(foreignCompany, cleanIdentifier);
          return {
            success: false,
            error: `"${cleanIdentifier}" kullanıcısı "${foreignCompany}" kurumuna aittir. Lütfen Kurum Kodu kutucuğuna "${foreignCompany}" yazarak giriş yapınız.`,
          };
        }
      }

      // Record failed attempt strictly scoped to company
      const attemptStatus = AuthSecurityService.recordFailedAttempt(cleanCompany, cleanIdentifier);
      await AuthSecurityService.delay(800);

      if (attemptStatus.isLocked) {
        // Record brute-force security incident log strictly scoped to target company
        StorageService.logSecurityEvent({
          companyCode: cleanCompany,
          attemptedUsername: cleanIdentifier,
          deviceId: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 80) : 'Web Client',
          platform: 'Web Tarayıcı',
          message: `"${cleanIdentifier}" hesabı 5 ardışık hatalı şifre denemesi nedeniyle 5 dakika kilitlendi.`,
          status: 'danger',
        }).catch((err) => console.warn('Güvenlik logu kaydedilemedi:', err));

        return {
          success: false,
          error: AuthSecurityService.formatLockoutMessage(attemptStatus.remainingSeconds),
        };
      }

      return {
        success: false,
        error: AuthSecurityService.formatFailedMessage(cleanCompany, attemptStatus.attemptsLeft),
      };
    }

    const { account, needsRehash } = matchResult;

    // Check if account is passive / inactive
    if (account.isActive === false) {
      return {
        success: false,
        error: 'Bu kullanıcı hesabı yönetici tarafından pasife alınmıştır. Sisteme giriş yetkiniz bulunmamaktadır.',
      };
    }

    // Reset failed attempts upon successful authentication
    AuthSecurityService.resetAttempts(cleanCompany, cleanIdentifier);

    // LAZY MIGRATION: If password was verified as legacy plaintext, immediately rehash and save
    if (needsRehash) {
      PasswordSecurity.hashPassword(cleanPass)
        .then((newHash) => this.updateUserPasswordHash(account.id, newHash))
        .catch((err) => console.warn('Lazy password migration error:', err));
    }

    if (!account.email && companyAdminEmail) {
      account.email = companyAdminEmail;
    }

    const finalRole = isUserAdmin(account) ? ('admin' as UserRole) : account.role;

    return {
      success: true,
      user: {
        id: account.id,
        username: account.username,
        name: account.name,
        role: finalRole,
        createdAt: account.createdAt,
        companyCode: account.companyCode || cleanCompany,
        email: account.email,
        isActive: true,
      },
    };
  },
};
