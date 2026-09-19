import { Company } from '../types/auth';
import { supabase } from './supabaseClient';
import { ServerConfigService } from './serverConfigService';

const COMPANIES_STORAGE_KEY = '@saha_takip_companies_directory';
const COMPANIES_SLOT_ID = 100;

export const DEFAULT_COMPANY: Company = {
  id: 1,
  code: 'POLATLAR',
  name: 'Polatlar',
  adminEmail: 'info@polatlaryazilim.com',
  adminName: 'Sistem Yöneticisi',
  createdAt: 1700000000000,
  licenseType: 'lifetime',
  licenseExpiresAt: 0,
  isFrozen: false,
};

export const CompanyService = {
  /**
   * Retrieves all registered companies from local storage or defaults to POLATLAR
   */
  getCompaniesLocal(): Company[] {
    try {
      const data = localStorage.getItem(COMPANIES_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Guarantee POLATLAR is always present as company #1
          if (!parsed.some((c) => c.code === 'POLATLAR')) {
            parsed.unshift(DEFAULT_COMPANY);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Kurum listesi yerelden okunamadı:', e);
    }
    return [DEFAULT_COMPANY];
  },

  /**
   * Saves company directory to local storage
   */
  saveCompaniesLocal(companies: Company[]): void {
    try {
      localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(companies));
    } catch (e) {
      console.warn('Kurum listesi kaydedilemedi:', e);
    }
  },

  /**
   * Fetches latest companies from Cloud (Supabase) or Local SQL Server (Slot 100) and merges
   */
  async fetchCompanies(): Promise<Company[]> {
    const local = this.getCompaniesLocal();

    // 1. If in Local Server Mode (SQL Server Windows Server 2022)
    if (ServerConfigService.isLocalMode()) {
      try {
        const res = await ServerConfigService.apiGet<{ id: number; tasks: string[]; notFound?: boolean }>(
          `/api/standard_tasks/${COMPANIES_SLOT_ID}`
        );
        if (res.data && Array.isArray(res.data.tasks) && res.data.tasks.length > 0) {
          const rawJson = res.data.tasks.join('');
          const serverCompanies: Company[] = JSON.parse(rawJson);
          if (Array.isArray(serverCompanies) && serverCompanies.length > 0) {
            const map = new Map<string, Company>();
            map.set('POLATLAR', DEFAULT_COMPANY);

            serverCompanies.forEach((c) => {
              if (c.code) map.set(c.code.toUpperCase(), c);
            });
            local.forEach((c) => {
              if (c.code && !map.has(c.code.toUpperCase())) {
                map.set(c.code.toUpperCase(), c);
              }
            });

            const merged = Array.from(map.values()).sort((a, b) => a.id - b.id);
            this.saveCompaniesLocal(merged);
            return merged;
          }
        }
      } catch (err) {
        console.warn('Yerel sunucudan kurum listesi çekilemedi:', err);
      }
      return local;
    }

    // 2. Cloud Mode (Supabase Slot 100)
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', COMPANIES_SLOT_ID)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const cloudCompanies: Company[] = JSON.parse(rawJson);

        if (Array.isArray(cloudCompanies) && cloudCompanies.length > 0) {
          // Merge local & cloud by company code
          const map = new Map<string, Company>();
          map.set('POLATLAR', DEFAULT_COMPANY);

          cloudCompanies.forEach((c) => {
            if (c.code) map.set(c.code.toUpperCase(), c);
          });
          local.forEach((c) => {
            if (c.code && !map.has(c.code.toUpperCase())) {
              map.set(c.code.toUpperCase(), c);
            }
          });

          const merged = Array.from(map.values()).sort((a, b) => a.id - b.id);
          this.saveCompaniesLocal(merged);
          return merged;
        }
      } else if (!error || error.code === 'PGRST116') {
        // Slot does not exist yet -> Seed with local/default
        await this.syncToCloud(local);
      }
    } catch (e) {
      console.warn('Bulut kurum listesi çekilemedi:', e);
    }

    return local;
  },

  /**
   * Syncs company directory to Cloud (Supabase) or Local SQL Server (Slot 100)
   */
  async syncToCloud(companies: Company[]): Promise<void> {
    const json = JSON.stringify(companies);
    const chunkSize = 3000;
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += chunkSize) {
      chunks.push(json.substring(i, i + chunkSize));
    }

    // 1. Local Server Mode
    if (ServerConfigService.isLocalMode()) {
      try {
        await ServerConfigService.apiPost(`/api/standard_tasks/${COMPANIES_SLOT_ID}`, {
          tasks: chunks,
        });
      } catch (err) {
        console.warn('Yerel sunucuya kurum listesi kaydedilemedi:', err);
      }
      return;
    }

    // 2. Cloud Mode (Supabase)
    try {
      await supabase.from('standard_tasks').upsert({
        id: COMPANIES_SLOT_ID,
        tasks: chunks,
      });
    } catch (err) {
      console.warn('Bulut kurum listesi kaydedilemedi:', err);
    }
  },

  /**
   * Finds a company by its unique code (case-insensitive)
   */
  async getCompanyByCode(code: string): Promise<Company | null> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return null;

    if (cleanCode === 'POLATLAR') {
      return DEFAULT_COMPANY;
    }

    const list = await this.fetchCompanies();
    return list.find((c) => c.code.toUpperCase() === cleanCode) || null;
  },

  /**
   * Registers a brand new company and saves to cloud with initial 1-year SaaS license
   */
  async registerCompany(params: {
    name: string;
    code: string;
    adminName: string;
    adminEmail: string;
    licenseType?: Company['licenseType'];
    licenseExpiresAt?: number;
  }): Promise<{ success: boolean; error?: string; company?: Company }> {
    const cleanName = params.name.trim();
    const cleanCode = params.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const cleanAdminName = params.adminName.trim();
    const cleanAdminEmail = params.adminEmail.trim().toLowerCase();

    if (!cleanName) {
      return { success: false, error: 'Kurum/Şirket adı zorunludur.' };
    }
    if (!cleanCode || cleanCode.length < 3) {
      return { success: false, error: 'Kurum kodu en az 3 karakter olmalıdır (Örn: POLATLAR, AKARSU).' };
    }
    if (!cleanAdminName) {
      return { success: false, error: 'Yönetici adı ve soyadı zorunludur.' };
    }
    if (!cleanAdminEmail || !cleanAdminEmail.includes('@')) {
      return { success: false, error: 'Geçerli bir yönetici e-posta adresi giriniz.' };
    }

    const existingList = await this.fetchCompanies();
    if (existingList.some((c) => c.code.toUpperCase() === cleanCode)) {
      return { success: false, error: `"${cleanCode}" kurum kodu zaten kayıtlıdır. Lütfen başka bir kod seçin.` };
    }

    // Determine next numeric ID
    const maxId = existingList.reduce((max, c) => Math.max(max, c.id || 1), 1);
    const newId = maxId + 1;

    // Default 1-year annual license from today
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const defaultExpiresAt = params.licenseExpiresAt || Date.now() + oneYearMs;

    const newCompany: Company = {
      id: newId,
      code: cleanCode,
      name: cleanName,
      adminEmail: cleanAdminEmail,
      adminName: cleanAdminName,
      createdAt: Date.now(),
      licenseType: params.licenseType || 'annual',
      licenseExpiresAt: defaultExpiresAt,
      isFrozen: false,
    };

    const updated = [...existingList, newCompany];
    this.saveCompaniesLocal(updated);
    await this.syncToCloud(updated);

    return {
      success: true,
      company: newCompany,
    };
  },

  /**
   * Updates company licensing parameters (super admin only)
   */
  async updateCompanyLicense(
    companyCode: string,
    updates: Partial<Pick<Company, 'licenseType' | 'licenseExpiresAt' | 'isFrozen' | 'freezeReason' | 'notes' | 'maxBranches' | 'maxUsers'>>
  ): Promise<{ success: boolean; error?: string; company?: Company }> {
    const cleanCode = (companyCode || '').trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'Geçersiz kurum kodu.' };

    if (cleanCode === 'POLATLAR' && (updates.isFrozen || updates.licenseExpiresAt)) {
      return { success: false, error: 'Ana sistem kurumu (POLATLAR) dondurulamaz ve lisansı sınırlandırılamaz.' };
    }

    const list = await this.fetchCompanies();
    const index = list.findIndex((c) => c.code.toUpperCase() === cleanCode);
    if (index === -1) {
      return { success: false, error: 'Kurum bulunamadı.' };
    }

    const existing = list[index];
    const updatedCompany: Company = {
      ...existing,
      ...updates,
      code: existing.code, // Prevent code change
      id: existing.id,
    };

    const updatedList = [...list];
    updatedList[index] = updatedCompany;

    this.saveCompaniesLocal(updatedList);
    await this.syncToCloud(updatedList);

    return { success: true, company: updatedCompany };
  },

  /**
   * Extends company license by given number of days/months or exact timestamp
   */
  async extendLicense(
    companyCode: string,
    params: { days?: number; months?: number; exactTimestamp?: number; notes?: string }
  ): Promise<{ success: boolean; error?: string; company?: Company }> {
    const cleanCode = (companyCode || '').trim().toUpperCase();
    const list = await this.fetchCompanies();
    const target = list.find((c) => c.code.toUpperCase() === cleanCode);

    if (!target) {
      return { success: false, error: 'Kurum bulunamadı.' };
    }

    let targetExpiration: number;

    if (params.exactTimestamp !== undefined) {
      targetExpiration = params.exactTimestamp;
    } else {
      const now = Date.now();
      // If currently active and in future, extend from existing expiration; otherwise from now
      const baseTime = (target.licenseExpiresAt && target.licenseExpiresAt > now) ? target.licenseExpiresAt : now;
      let addedMs = 0;
      if (params.months) {
        addedMs = params.months * 30 * 24 * 60 * 60 * 1000;
      } else if (params.days) {
        addedMs = params.days * 24 * 60 * 60 * 1000;
      } else {
        addedMs = 365 * 24 * 60 * 60 * 1000; // Default 1 year
      }
      targetExpiration = baseTime + addedMs;
    }

    return this.updateCompanyLicense(cleanCode, {
      licenseExpiresAt: targetExpiration,
      isFrozen: false, // Automatically unfreeze when license is extended
      freezeReason: undefined,
      notes: params.notes !== undefined ? params.notes : target.notes,
    });
  },

  /**
   * Freezes or unfreezes a company account
   */
  async toggleFreezeCompany(
    companyCode: string,
    isFrozen: boolean,
    freezeReason?: string
  ): Promise<{ success: boolean; error?: string; company?: Company }> {
    const cleanCode = (companyCode || '').trim().toUpperCase();
    if (cleanCode === 'POLATLAR' && isFrozen) {
      return { success: false, error: 'Ana sistem kurumu (POLATLAR) dondurulamaz.' };
    }

    return this.updateCompanyLicense(cleanCode, {
      isFrozen,
      freezeReason: isFrozen ? (freezeReason || 'Hizmet geçici olarak durdurulmuştur.') : undefined,
    });
  },

  /**
   * Deletes a company by code (Strictly disallowed for POLATLAR)
   */
  async deleteCompany(companyCode: string): Promise<{ success: boolean; error?: string }> {
    const cleanCode = (companyCode || '').trim().toUpperCase();
    if (cleanCode === 'POLATLAR') {
      return { success: false, error: 'Ana sistem kurumu (POLATLAR) silinemez.' };
    }
    const list = await this.fetchCompanies();
    const filtered = list.filter((c) => c.code.toUpperCase() !== cleanCode);
    if (filtered.length === list.length) {
      return { success: false, error: 'Kurum bulunamadı.' };
    }
    await this.saveCompaniesLocal(filtered);
    await this.syncToCloud(filtered);
    return { success: true };
  },
};

