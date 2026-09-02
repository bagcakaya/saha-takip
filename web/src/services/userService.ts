import { UserAccount, UserRole, User } from '../types/auth';
import { supabase } from './supabaseClient';

const USERS_STORAGE_KEY = '@gorev_tamamlama_users_list';

const DEFAULT_ADMIN: UserAccount = {
  id: 'admin-root',
  username: 'admin',
  password: '1234',
  name: 'Sistem Yöneticisi',
  role: 'admin',
  createdAt: 1700000000000,
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
          return parsed;
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
   * Fetches latest users from Supabase cloud database
   */
  async fetchUsersFromCloud(): Promise<UserAccount[]> {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const cloudUsers: UserAccount[] = data.map((row) => ({
          id: row.id,
          username: row.username,
          password: row.password,
          name: row.name,
          role: row.role as UserRole,
          createdAt: Number(row.created_at) || Date.now(),
        }));

        this.saveUsers(cloudUsers);
        return cloudUsers;
      }
    } catch (e) {
      console.warn('Supabase kullanıcı senkronizasyonu atlandı:', e);
    }

    return this.getUsers();
  },

  /**
   * Adds a new user account (Syncs locally + Supabase)
   */
  async addUser(params: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
  }): Promise<{ success: boolean; error?: string; user?: User }> {
    const users = this.getUsers();
    const cleanUsername = params.username.trim().toLowerCase();
    const cleanName = params.name.trim() || params.username.trim();
    const cleanPassword = params.password.trim();

    if (!cleanUsername) {
      return { success: false, error: 'Kullanıcı adı zorunludur.' };
    }
    if (!cleanPassword || cleanPassword.length < 3) {
      return { success: false, error: 'Şifre en az 3 karakter olmalıdır.' };
    }
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: 'Bu kullanıcı adı zaten kullanılmaktadır.' };
    }

    const newUser: UserAccount = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      username: cleanUsername,
      password: cleanPassword,
      name: cleanName,
      role: params.role,
      createdAt: Date.now(),
    };

    const updated = [...users, newUser];
    this.saveUsers(updated);

    // Sync to Supabase in background
    try {
      await supabase.from('app_users').insert([
        {
          id: newUser.id,
          username: newUser.username,
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
      },
    };
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

    // Protection: Prevent demoting the last admin
    if (updates.role && updates.role !== 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1 && users[userIndex].role === 'admin') {
        return {
          success: false,
          error: 'Sistemde en az 1 adet Yönetici (Admin) bulunmalıdır. Yetki düşürülemez.',
        };
      }
    }

    const current = users[userIndex];
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
      await supabase
        .from('app_users')
        .update({
          name: updatedUser.name,
          role: updatedUser.role,
          password: updatedUser.password,
        })
        .eq('id', id);
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

    // Protection: Prevent deleting the last admin
    if (target.role === 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        return {
          success: false,
          error: 'Sistemdeki son Yönetici (Admin) hesabı silinemez.',
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
   * Authenticates user against registered accounts (Local + Cloud fallback)
   */
  async authenticate(
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Try local list first
    let users = this.getUsers();
    let account = users.find(
      (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
    );

    // 2. If not found locally, try fetching latest users from Supabase
    if (!account) {
      try {
        const cloudUsers = await this.fetchUsersFromCloud();
        account = cloudUsers.find(
          (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
        );
      } catch {
        // ignore
      }
    }

    if (!account) {
      return { success: false, error: 'Kullanıcı adı veya şifre hatalı.' };
    }

    return {
      success: true,
      user: {
        id: account.id,
        username: account.username,
        name: account.name,
        role: account.role,
        createdAt: account.createdAt,
      },
    };
  },
};
