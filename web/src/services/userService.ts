import { UserAccount, UserRole, User, Company } from '../types/auth';
import { supabase } from './supabaseClient';

const USERS_STORAGE_KEY = '@gorev_tamamlama_users_list';

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
          return parsed.map((u) => ({
            ...u,
            companyCode: (u.companyCode || 'POLATLAR').toUpperCase(),
          }));
        }
      }
    } catch (e) {
      console.warn('Kullanıcı listesi okunamadı:', e);
    }

    // Initialize with default admin
    const initialUsers = [DEFAULT_ADMIN];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialUsers));
    return initialUsers;
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
   * Converts Turkish Full Name into clean suggested username:
   * "Ahmet Yılmaz" -> "ahmetyilmaz", if exists -> "ahmetyilmaz01", "ahmetyilmaz02"
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
    clean = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) clean = 'personel';

    const users = this.getUsers().filter(
      (u) => (u.companyCode || 'POLATLAR').toUpperCase() === companyCode.toUpperCase()
    );
    const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));

    if (!existingUsernames.has(clean)) {
      return clean;
    }

    // Find next available suffix (01, 02, 03...)
    let counter = 1;
    while (true) {
      const suffix = counter < 10 ? `0${counter}` : `${counter}`;
      const candidate = `${clean}${suffix}`;
      if (!existingUsernames.has(candidate)) {
        return candidate;
      }
      counter++;
    }
  },

  /**
   * Fetches latest users from Supabase cloud database and syncs both ways
   */
  async fetchUsersFromCloud(): Promise<UserAccount[]> {
    const localUsers = this.getUsers();

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const cloudUsers: UserAccount[] = data.map((row) => {
          let companyCode = 'POLATLAR';
          let username = row.username;

          // Parse composite companyCode:username format
          if (row.username && row.username.includes(':')) {
            const parts = row.username.split(':');
            companyCode = parts[0].toUpperCase();
            username = parts.slice(1).join(':');
          }

          return {
            id: row.id,
            username,
            password: row.password,
            name: row.name,
            role: row.role as UserRole,
            createdAt: Number(row.created_at) || Date.now(),
            companyCode,
            email: row.email || undefined,
          };
        });

        // Merge any local users not yet in cloud
        const cloudKeys = new Set(cloudUsers.map((u) => `${u.companyCode}:${u.username.toLowerCase()}`));
        const missingLocal = localUsers.filter(
          (u) => !cloudKeys.has(`${u.companyCode}:${u.username.toLowerCase()}`)
        );

        if (missingLocal.length > 0) {
          try {
            await supabase.from('app_users').upsert(
              missingLocal.map((u) => ({
                id: u.id,
                username: u.companyCode === 'POLATLAR' ? u.username : `${u.companyCode}:${u.username}`,
                password: u.password,
                name: u.name,
                role: u.role,
                created_at: u.createdAt,
              }))
            );
          } catch {
            // ignore
          }
        }

        const merged = [...cloudUsers, ...missingLocal];
        this.saveUsers(merged);
        return merged;
      } else if (!error && data && data.length === 0 && localUsers.length > 0) {
        // Cloud table exists but empty -> seed from local
        try {
          await supabase.from('app_users').upsert(
            localUsers.map((u) => ({
              id: u.id,
              username: u.companyCode === 'POLATLAR' ? u.username : `${u.companyCode}:${u.username}`,
              password: u.password,
              name: u.name,
              role: u.role,
              created_at: u.createdAt,
            }))
          );
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn('Supabase kullanıcı senkronizasyonu atlandı:', e);
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
  }): Promise<{ success: boolean; error?: string; user?: User }> {
    const users = this.getUsers();
    const cleanCompanyCode = (params.companyCode || 'POLATLAR').trim().toUpperCase();
    const cleanUsername = params.username.trim().toLowerCase();
    const cleanName = params.name.trim() || params.username.trim();
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

    const newUser: UserAccount = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      username: cleanUsername,
      password: cleanPassword,
      name: cleanName,
      role: params.role,
      createdAt: Date.now(),
      companyCode: cleanCompanyCode,
      email: params.email?.trim().toLowerCase(),
    };

    const updated = [...users, newUser];
    this.saveUsers(updated);

    // Sync to Supabase in background
    try {
      const cloudUsername =
        cleanCompanyCode === 'POLATLAR' ? newUser.username : `${cleanCompanyCode}:${newUser.username}`;

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
    }
  ): Promise<{ success: boolean; error?: string }> {
    const users = this.getUsers();
    const userIndex = users.findIndex((u) => u.id === id);

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

    const updatedUser = {
      ...current,
      name: updates.name !== undefined && updates.name.trim() ? updates.name.trim() : current.name,
      role: updates.role !== undefined ? updates.role : current.role,
      password: updates.password !== undefined && updates.password.trim() ? updates.password.trim() : current.password,
    };

    users[userIndex] = updatedUser;
    this.saveUsers(users);

    // Sync to Supabase
    try {
      const cloudUsername =
        companyCode === 'POLATLAR' ? updatedUser.username : `${companyCode}:${updatedUser.username}`;

      await supabase.from('app_users').upsert([
        {
          id: updatedUser.id,
          username: cloudUsername,
          name: updatedUser.name,
          role: updatedUser.role,
          password: updatedUser.password,
          created_at: updatedUser.createdAt,
        },
      ]);
    } catch (err) {
      console.warn('Supabase kullanıcı güncelleme hatası:', err);
    }

    return { success: true };
  },

  /**
   * Deletes a user account
   */
  async deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
    const users = this.getUsers();
    const target = users.find((u) => u.id === id);

    if (!target) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
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

    // Sync delete to Supabase
    try {
      await supabase.from('app_users').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase kullanıcı silme hatası:', err);
    }

    return { success: true };
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

    // Helper to find match
    const findMatch = (userList: UserAccount[]) => {
      return userList.find((u) => {
        const uComp = (u.companyCode || 'POLATLAR').toUpperCase();
        if (uComp !== cleanCompany) return false;

        const isUserMatch = u.username.toLowerCase() === cleanIdentifier;
        const isEmailMatch = u.email && u.email.toLowerCase() === cleanIdentifier;

        return (isUserMatch || isEmailMatch) && u.password === cleanPass;
      });
    };

    // 1. Try local list first
    let users = this.getUsers();
    let account = findMatch(users);

    // 2. If not found locally, try fetching latest users from Supabase cloud
    if (!account) {
      try {
        const cloudUsers = await this.fetchUsersFromCloud();
        account = findMatch(cloudUsers);
      } catch {
        // ignore
      }
    }

    if (!account) {
      return {
        success: false,
        error: `"${cleanCompany}" kurumu için kullanıcı adı veya şifre hatalı.`,
      };
    }

    return {
      success: true,
      user: {
        id: account.id,
        username: account.username,
        name: account.name,
        role: account.role,
        createdAt: account.createdAt,
        companyCode: account.companyCode || cleanCompany,
        companyName: account.companyName,
        email: account.email,
      },
    };
  },
};
