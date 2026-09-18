import AsyncStorage from '@react-native-async-storage/async-storage';
import { Company } from '../types/auth';
import { supabase } from '../api/supabaseClient';

const COMPANIES_STORAGE_KEY = '@saha_takip_companies_directory';
const COMPANIES_SLOT_ID = 100;

export const DEFAULT_COMPANY: Company = {
  id: 1,
  code: 'POLATLAR',
  name: 'Polatlar',
  adminEmail: 'admin@polatlar.com',
  adminName: 'Sistem Yöneticisi',
  createdAt: 1700000000000,
};

export const CompanyService = {
  /**
   * Retrieves all registered companies from local storage or defaults to POLATLAR
   */
  async getCompaniesLocal(): Promise<Company[]> {
    try {
      const data = await AsyncStorage.getItem(COMPANIES_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
  async saveCompaniesLocal(companies: Company[]): Promise<void> {
    try {
      await AsyncStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(companies));
    } catch (e) {
      console.warn('Kurum listesi kaydedilemedi:', e);
    }
  },

  /**
   * Fetches latest companies from Supabase cloud slot 100 and merges
   */
  async fetchCompanies(): Promise<Company[]> {
    const local = await this.getCompaniesLocal();

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
          await this.saveCompaniesLocal(merged);
          return merged;
        }
      } else if (!error || error.code === 'PGRST116') {
        await this.syncToCloud(local);
      }
    } catch (e) {
      console.warn('Bulut kurum listesi çekilemedi:', e);
    }

    return local;
  },

  /**
   * Syncs company directory to Supabase cloud slot 100
   */
  async syncToCloud(companies: Company[]): Promise<void> {
    try {
      const json = JSON.stringify(companies);
      const chunkSize = 3000;
      const chunks: string[] = [];
      for (let i = 0; i < json.length; i += chunkSize) {
        chunks.push(json.substring(i, i + chunkSize));
      }

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
   * Registers a brand new company and saves to cloud
   */
  async registerCompany(params: {
    name: string;
    code: string;
    adminName: string;
    adminEmail: string;
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

    const maxId = existingList.reduce((max, c) => Math.max(max, c.id || 1), 1);
    const newId = maxId + 1;

    const newCompany: Company = {
      id: newId,
      code: cleanCode,
      name: cleanName,
      adminEmail: cleanAdminEmail,
      adminName: cleanAdminName,
      createdAt: Date.now(),
    };

    const updated = [...existingList, newCompany];
    await this.saveCompaniesLocal(updated);
    await this.syncToCloud(updated);

    return {
      success: true,
      company: newCompany,
    };
  },
};
