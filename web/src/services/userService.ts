import { UserAccount, UserRole, User } from '../types/auth';

const USERS_STORAGE_KEY = '@gorev_tamamlama_users_list';

const DEFAULT_ADMIN: UserAccount = {
  id: 'admin-root',
  username: 'admin',
  password: '1234',
  name: 'Sistem Yöneticisi',
  role: 'admin',
  createdAt: Date.now(),
};

export const UserService = {
  /**
   * Retrieves all user accounts from local storage
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
   * Saves users list to storage
   */
  saveUsers(users: UserAccount[]): void {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Kullanıcılar kaydedilemedi:', e);
    }
  },

  /**
   * Adds a new user account
   */
  addUser(params: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
  }): { success: boolean; error?: string; user?: User } {
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
  updateUser(
    id: string,
    updates: {
      name?: string;
      role?: UserRole;
      password?: string;
    }
  ): { success: boolean; error?: string } {
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
    users[userIndex] = {
      ...current,
      name: updates.name !== undefined && updates.name.trim() ? updates.name.trim() : current.name,
      role: updates.role !== undefined ? updates.role : current.role,
      password: updates.password !== undefined && updates.password.trim() ? updates.password.trim() : current.password,
    };

    this.saveUsers(users);
    return { success: true };
  },

  /**
   * Deletes a user account
   */
  deleteUser(id: string): { success: boolean; error?: string } {
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
    return { success: true };
  },

  /**
   * Authenticates user against registered accounts
   */
  authenticate(username: string, password: string): { success: boolean; error?: string; user?: User } {
    const users = this.getUsers();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    const account = users.find(
      (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
    );

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
