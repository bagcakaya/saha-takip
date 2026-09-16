import { supabase } from './supabaseClient';
import { CompanyService } from './companyService';
import { UserService } from './userService';

export interface PasswordResetRequest {
  id: string;
  companyCode: string;
  adminId: string;
  adminUsername: string;
  adminEmail: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const PASSWORD_RESETS_SLOT_ID = 99;
const LOCAL_RESETS_KEY = '@saha_takip_password_resets';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  const first = local[0];
  const last = local[local.length - 1];
  return `${first}${'*'.repeat(Math.min(local.length - 2, 4))}${last}@${domain}`;
}

export const PasswordResetService = {
  /**
   * Loads password reset requests from Supabase slot 99 and local storage
   */
  async getResetRequests(): Promise<PasswordResetRequest[]> {
    let list: PasswordResetRequest[] = [];

    // 1. Try local cache
    try {
      const raw = localStorage.getItem(LOCAL_RESETS_KEY);
      if (raw) {
        list = JSON.parse(raw);
      }
    } catch {
      // ignore
    }

    // 2. Try Supabase cloud slot 99
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', PASSWORD_RESETS_SLOT_ID)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const cloudList: PasswordResetRequest[] = JSON.parse(data.tasks.join(''));
        if (Array.isArray(cloudList)) {
          const map = new Map<string, PasswordResetRequest>();
          list.forEach((r) => map.set(r.id, r));
          cloudList.forEach((r) => map.set(r.id, r));
          list = Array.from(map.values());
          try {
            localStorage.setItem(LOCAL_RESETS_KEY, JSON.stringify(list));
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      console.warn('Bulut sıfırlama talepleri okunamadı:', e);
    }

    return list;
  },

  /**
   * Saves password reset requests to cloud slot 99 and local storage
   */
  async saveResetRequests(requests: PasswordResetRequest[]): Promise<void> {
    // Retain only requests younger than 24 hours to keep slot clean
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const cleanList = requests.filter((r) => r.createdAt > oneDayAgo);

    try {
      localStorage.setItem(LOCAL_RESETS_KEY, JSON.stringify(cleanList));
    } catch {
      // ignore
    }

    try {
      const rawJson = JSON.stringify(cleanList);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: PASSWORD_RESETS_SLOT_ID, tasks: chunks });
    } catch (err) {
      console.warn('Sıfırlama talepleri buluta kaydedilemedi:', err);
    }
  },

  /**
   * Initiates password reset for a company administrator:
   * Verifies company and email, generates 6-digit code, saves to cloud, and sends email.
   */
  async requestReset(
    companyCode: string,
    emailInput: string
  ): Promise<{
    success: boolean;
    error?: string;
    maskedEmail?: string;
    expiresAt?: number;
  }> {
    const cleanCompany = (companyCode || 'POLATLAR').trim().toUpperCase();
    const cleanEmail = (emailInput || '').trim().toLowerCase();

    if (!cleanCompany) {
      return { success: false, error: 'Lütfen kurum kodunu giriniz.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Lütfen geçerli bir e-posta adresi giriniz.' };
    }

    // 1. Verify company existence
    let company = await CompanyService.getCompanyByCode(cleanCompany);
    if (!company) {
      const cloudCompanies = await CompanyService.fetchCompanies();
      company = cloudCompanies.find((c) => c.code.toUpperCase() === cleanCompany) || null;
    }

    if (!company && cleanCompany !== 'POLATLAR') {
      return {
        success: false,
        error: `"${cleanCompany}" koduna sahip bir kurum bulunamadı.`,
      };
    }

    const companyAdminEmail = company?.adminEmail?.trim().toLowerCase();

    // 2. Verify admin user for this company
    const users = await UserService.fetchUsersFromCloud();
    const adminUser = users.find((u) => {
      const uComp = (u.companyCode || 'POLATLAR').toUpperCase();
      if (uComp !== cleanCompany || u.role !== 'admin') return false;

      const userEmail = u.email?.trim().toLowerCase();
      return (
        userEmail === cleanEmail ||
        (companyAdminEmail && companyAdminEmail === cleanEmail)
      );
    });

    if (!adminUser && companyAdminEmail !== cleanEmail) {
      return {
        success: false,
        error: 'Girdiğiniz e-posta adresi bu kurumun kayıtlı yönetici e-postasıyla eşleşmedi.',
      };
    }

    const targetAdminId = adminUser ? adminUser.id : 'admin-root';
    const targetAdminUsername = adminUser ? adminUser.username : 'admin';
    const targetAdminName = adminUser?.name || company?.adminName || 'Yönetici';
    const targetEmail = companyAdminEmail || adminUser?.email || cleanEmail;

    // 3. Generate secure 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes validity

    const newRequest: PasswordResetRequest = {
      id: now.toString(36) + Math.random().toString(36).substring(2, 7),
      companyCode: cleanCompany,
      adminId: targetAdminId,
      adminUsername: targetAdminUsername,
      adminEmail: targetEmail,
      code,
      createdAt: now,
      expiresAt,
      used: false,
    };

    // 4. Save to cloud slot 99
    const allRequests = await this.getResetRequests();
    allRequests.push(newRequest);
    await this.saveResetRequests(allRequests);

    // 5. Send email via serverless proxy / API
    try {
      await fetch('/api/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetEmail,
          companyName: company?.name || cleanCompany,
          companyCode: cleanCompany,
          adminName: targetAdminName,
          code,
        }),
      });
    } catch (mailErr) {
      console.warn('Mail gönderim API çağrısı sırasında hata oluştu:', mailErr);
    }

    return {
      success: true,
      maskedEmail: maskEmail(targetEmail),
      expiresAt,
    };
  },

  /**
   * Verifies the 6-digit code and updates admin password
   */
  async verifyAndResetPassword(
    companyCode: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanCompany = (companyCode || 'POLATLAR').trim().toUpperCase();
    const cleanCode = (code || '').trim();
    const cleanPass = (newPassword || '').trim();

    if (!cleanCode || cleanCode.length !== 6) {
      return { success: false, error: 'Doğrulama kodu 6 haneli olmalıdır.' };
    }
    if (!cleanPass || cleanPass.length < 3) {
      return { success: false, error: 'Yeni şifre en az 3 karakter olmalıdır.' };
    }

    const allRequests = await this.getResetRequests();
    const now = Date.now();

    // Find the latest valid matching request
    const matchingRequest = allRequests
      .filter((r) => r.companyCode === cleanCompany && r.code === cleanCode && !r.used)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!matchingRequest) {
      return {
        success: false,
        error: 'Girdiğiniz 6 haneli doğrulama kodu geçersiz veya daha önce kullanılmış.',
      };
    }

    if (now > matchingRequest.expiresAt) {
      return {
        success: false,
        error: 'Bu doğrulama kodunun 15 dakikalık süresi dolmuş. Lütfen yeni bir kod talep ediniz.',
      };
    }

    // 1. Update user password in UserService
    const users = await UserService.fetchUsersFromCloud();
    let adminAccount = users.find(
      (u) =>
        (u.companyCode || 'POLATLAR').toUpperCase() === cleanCompany &&
        (u.id === matchingRequest.adminId || u.username === matchingRequest.adminUsername || u.role === 'admin')
    );

    if (!adminAccount) {
      // Fallback: search by admin email
      adminAccount = users.find(
        (u) =>
          (u.companyCode || 'POLATLAR').toUpperCase() === cleanCompany &&
          u.email?.toLowerCase() === matchingRequest.adminEmail.toLowerCase()
      );
    }

    if (adminAccount) {
      const updateRes = await UserService.updateUser(adminAccount.id, { password: cleanPass });
      if (!updateRes.success) {
        return { success: false, error: updateRes.error || 'Şifre güncellenemedi.' };
      }
    } else {
      return { success: false, error: 'Kuruma ait yönetici hesabı bulunamadı.' };
    }

    // 2. Mark code as used
    matchingRequest.used = true;
    await this.saveResetRequests(allRequests);

    return { success: true };
  },
};
