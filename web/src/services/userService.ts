import { UserAccount, UserRole, User, Company, isUserAdmin } from '../types/auth';
import { supabase } from './supabaseClient';
import { CompanyService } from './companyService';
import { PasswordSecurity } from './passwordSecurity';
import { AuthSecurityService } from './authSecurityService';
import { StorageService } from './storageService';
import { SanitizeService } from './sanitizeService';

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
            const comp = (u.companyCode || 'POLATLAR').toUpperCase();
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
   * Fetches latest users from Supabase cloud database with company isolation scoping
   */
  async fetchUsersFromCloud(companyCodeFilter?: string): Promise<UserAccount[]> {
    const localUsers = this.getUsers();

    try {
      // 1. Fetch companies directory to enrich admin users with their registered email
      const companiesMap = new Map<string, string>();
      try {
        const companies = await CompanyService.fetchCompanies();
        companies.forEach((c) => {
          if (c.code && c.adminEmail) {
            companiesMap.set(c.code.toUpperCase(), c.adminEmail.toLowerCase());
          }
        });
      } catch {
        // ignore
      }

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
        const cloudUsers: UserAccount[] = data.map((row) => {
          let companyCode = 'POLATLAR';
          let username = row.username;
          let email: string | undefined = undefined;

          // Parse embedded email format (e.g. "BURAKDEV:admin#b.agcakaya@gmail.com")
          if (row.username && row.username.includes('#')) {
            const hashParts = row.username.split('#');
            username = hashParts[0];
            email = hashParts[1]?.toLowerCase();
          }

          // Parse composite companyCode:username format
          if (username && username.includes(':')) {
            const parts = username.split(':');
            companyCode = parts[0].toUpperCase();
            username = parts.slice(1).join(':');
          }

          // If email is not in username, resolve from company directory if admin
          if (!email && row.role === 'admin' && companiesMap.has(companyCode)) {
            email = companiesMap.get(companyCode);
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

        // Merge any local users not yet in cloud
        const cloudKeys = new Set(cloudUsers.map((u) => `${u.companyCode}:${u.username.toLowerCase()}`));
        const missingLocal = localUsers.filter(
          (u) => !cloudKeys.has(`${u.companyCode}:${u.username.toLowerCase()}`)
        );

        if (missingLocal.length > 0) {
          try {
            await supabase.from('app_users').upsert(
              missingLocal.map((u) => {
                let cloudUsername =
                  u.companyCode === 'POLATLAR' ? u.username : `${u.companyCode}:${u.username}`;
                if (u.email) {
                  cloudUsername = `${cloudUsername}#${u.email}`;
                }
                return {
                  id: u.id,
                  username: cloudUsername,
                  password: u.password,
                  name: u.name,
                  role: u.role,
                  created_at: u.createdAt,
                };
              })
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
            localUsers.map((u) => {
              let cloudUsername =
                u.companyCode === 'POLATLAR' ? u.username : `${u.companyCode}:${u.username}`;
              if (u.email) {
                cloudUsername = `${cloudUsername}#${u.email}`;
              }
              return {
                id: u.id,
                username: cloudUsername,
                password: u.password,
                name: u.name,
                role: u.role,
                created_at: u.createdAt,
              };
            })
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

    const updatedUser = {
      ...current,
      name:
        updates.name !== undefined && updates.name.trim()
          ? SanitizeService.sanitizeText(updates.name, 80)
          : current.name,
      role: updates.role !== undefined ? updates.role : current.role,
      password: newPassword,
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
      // Record failed attempt and throttle with artificial delay
      const attemptStatus = AuthSecurityService.recordFailedAttempt(cleanCompany, cleanIdentifier);
      await AuthSecurityService.delay(800);

      if (attemptStatus.isLocked) {
        // Record brute-force security incident log for company admins
        StorageService.addSecurityLog({
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
      },
    };
  },
};
