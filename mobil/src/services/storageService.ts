import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabaseClient';
import {
  LocationItem,
  GeneralNote,
  ServiceItem,
  ReturnWarrantyItem,
  AttendanceRecord,
  WorkplaceLocation,
  LeaveRequest,
  Branch,
  HeadquarterCompany,
  TimedFollowUp,
  AdminReminder,
  SecurityLogItem,
} from '../types/storage';
import carilerData from '../data/cariler.json';
import * as XLSX from 'xlsx';
import { MobileServerConfigService } from './serverConfigService';

export interface CariData {
  updatedAt: string;
  database: string;
  total: number;
  cariler: string[];
}

let activeCompanyCode = 'POLATLAR';
let activeCompanyId: number | undefined = 1;

async function loadChunkedSlot<T>(slotId: number): Promise<{ data: T | null; notFound: boolean }> {
  // 1. Yerel Sunucu (Local Mode) - Windows Server 2022 SQL Server
  if (MobileServerConfigService.isLocalMode()) {
    const apiUrl = MobileServerConfigService.getActiveApiUrl();
    if (apiUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${apiUrl}/api/standard_tasks/${slotId}`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          if (json && !json.notFound && json.tasks) {
            let parsed: any = json.tasks;
            if (Array.isArray(json.tasks) && json.tasks.length > 0 && typeof json.tasks[0] === 'string' && json.tasks[0].startsWith('[')) {
              try {
                parsed = JSON.parse(json.tasks.join(''));
              } catch {
                parsed = json.tasks;
              }
            } else if (typeof json.tasks === 'string') {
              try {
                parsed = JSON.parse(json.tasks);
              } catch {
                parsed = json.tasks;
              }
            }
            return { data: parsed as T, notFound: false };
          }
          if (json && json.notFound) {
            return { data: null, notFound: true };
          }
        } else if (res.status === 404) {
          return { data: null, notFound: true };
        }
      } catch (err) {
        console.warn(`[Yerel Sunucu - Mobil] Slot ${slotId} yüklenemedi, buluta geçiliyor:`, err);
      }
    }
  }

  // 2. Bulut (Supabase Cloud)
  try {
    const { data, error } = await supabase
      .from('standard_tasks')
      .select('tasks')
      .eq('id', slotId)
      .single();

    if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
      const rawJson = data.tasks.join('');
      return { data: JSON.parse(rawJson) as T, notFound: false };
    }
  } catch {
    // ignore
  }
  return { data: null, notFound: false };
}

async function saveChunkedSlot(slotId: number, data: any): Promise<void> {
  // GÜVENLİK ZIRHI: POLATLAR harici kurumların sistem kök slotlarına (1-10) yazması engellenir
  if (activeCompanyCode !== 'POLATLAR' && slotId <= 10) {
    console.warn(
      `[GÜVENLİK İHLALİ] Kurum '${activeCompanyCode}' kök slot ${slotId}'e yazmaya yetkili değildir! İşlem engellendi.`
    );
    return;
  }

  const rawJson = JSON.stringify(data);
  const chunks: string[] = [];
  const chunkSize = 8000;
  for (let i = 0; i < rawJson.length; i += chunkSize) {
    chunks.push(rawJson.slice(i, i + chunkSize));
  }

  // 1. Yerel Sunucu (Local Mode) - Windows Server 2022 SQL Server
  if (MobileServerConfigService.isLocalMode()) {
    const apiUrl = MobileServerConfigService.getActiveApiUrl();
    if (apiUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${apiUrl}/api/standard_tasks/${slotId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: chunks }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          return;
        }
      } catch (err) {
        console.warn(`[Yerel Sunucu - Mobil] Slot ${slotId} kaydedilemedi, buluta aktarılıyor:`, err);
      }
    }
  }

  // 2. Bulut (Supabase Cloud)
  try {
    await supabase.from('standard_tasks').upsert({ id: slotId, tasks: chunks });
  } catch (err) {
    console.warn(`Cloud save error for slot ${slotId}:`, err);
  }
}

async function getLocal<T>(key: string): Promise<T | null> {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function setLocal(key: string, val: any): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

export const StorageService = {
  setCompany(code: string, id?: number) {
    activeCompanyCode = (code || 'POLATLAR').trim().toUpperCase();
    activeCompanyId = id;
  },

  getCompanyCode(): string {
    return activeCompanyCode;
  },

  getSlotId(baseModuleId: number): number {
    if (activeCompanyCode === 'POLATLAR') return baseModuleId;
    const compId = activeCompanyId || 2;
    return (compId - 1) * 20 + baseModuleId;
  },

  getSlotIdForCompany(baseModuleId: number, companyCode: string, companyId?: number): number {
    const cleanCode = (companyCode || 'POLATLAR').trim().toUpperCase();
    if (cleanCode === 'POLATLAR') return baseModuleId;
    const compId = companyId || 2;
    return (compId - 1) * 20 + baseModuleId;
  },

  // 1. LOCATIONS (İş Emirleri / Keşif & Montaj)
  async getLocations(): Promise<LocationItem[]> {
    const localKey = `@locations_${activeCompanyCode}`;
    try {
      if (activeCompanyCode === 'POLATLAR') {
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped: LocationItem[] = data.map((row) => ({
            id: row.id,
            name: row.name,
            cariName: row.cari_name || undefined,
            address: row.address || '',
            notes: row.notes || '',
            photos: Array.isArray(row.photos) ? row.photos : [],
            latitude: row.latitude || undefined,
            longitude: row.longitude || undefined,
            createdAt: Number(row.created_at) || Date.now(),
            createdBy: row.created_by || undefined,
            createdByName: row.created_by_name || undefined,
            tasks: Array.isArray(row.tasks) ? row.tasks : [],
            status: row.status || 'pending',
            completedAt: row.completed_at || undefined,
            completedBy: row.completed_by || undefined,
            completedByName: row.completed_by_name || undefined,
            completionNote: row.completion_note || undefined,
            completionPhotos: Array.isArray(row.completion_photos) ? row.completion_photos : [],
          }));
          await setLocal(localKey, mapped);
          return mapped;
        }
      } else {
        const slot = await loadChunkedSlot<LocationItem[]>(this.getSlotId(11));
        if (slot.data) {
          await setLocal(localKey, slot.data);
          return slot.data;
        }
      }
    } catch (e) {
      console.warn('getLocations error:', e);
    }
    return (await getLocal<LocationItem[]>(localKey)) || [];
  },

  async saveLocations(locations: LocationItem[]): Promise<void> {
    const localKey = `@locations_${activeCompanyCode}`;
    await setLocal(localKey, locations);

    try {
      if (activeCompanyCode === 'POLATLAR') {
        const rows = locations.map((loc) => ({
          id: loc.id,
          name: loc.name,
          cari_name: loc.cariName || null,
          address: loc.address || '',
          notes: loc.notes || '',
          photos: loc.photos || [],
          latitude: loc.latitude || null,
          longitude: loc.longitude || null,
          created_at: loc.createdAt,
          created_by: loc.createdBy || null,
          created_by_name: loc.createdByName || null,
          tasks: loc.tasks || [],
          status: loc.status || 'pending',
          completed_at: loc.completedAt || null,
          completed_by: loc.completedBy || null,
          completed_by_name: loc.completedByName || null,
          completion_note: loc.completionNote || null,
          completion_photos: loc.completionPhotos || [],
        }));
        await supabase.from('locations').upsert(rows);
      } else {
        await saveChunkedSlot(this.getSlotId(11), locations);
      }
    } catch (e) {
      console.warn('saveLocations cloud error:', e);
    }
  },

  async deleteLocation(id: string): Promise<void> {
    const locations = await this.getLocations();
    const updated = locations.filter((l) => l.id !== id);
    const localKey = `@locations_${activeCompanyCode}`;
    await setLocal(localKey, updated);
    try {
      if (activeCompanyCode === 'POLATLAR') {
        await supabase.from('locations').delete().eq('id', id);
      } else {
        await saveChunkedSlot(this.getSlotId(11), updated);
      }
    } catch (e) {
      console.warn('deleteLocation cloud error:', e);
    }
  },

  // 2. SERVICES (Teknik Servis)
  async getServices(): Promise<ServiceItem[]> {
    const localKey = `@services_${activeCompanyCode}`;
    try {
      if (activeCompanyCode === 'POLATLAR') {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped: ServiceItem[] = data.map((r) => ({
            id: r.id,
            companyName: r.company_name,
            cariName: r.cari_name || undefined,
            location: r.location || '',
            latitude: r.latitude || undefined,
            longitude: r.longitude || undefined,
            workDone: r.work_done || '',
            date: r.date || '',
            photos: Array.isArray(r.photos) ? r.photos : [],
            createdAt: Number(r.created_at) || Date.now(),
            createdBy: r.created_by || '',
            createdByName: r.created_by_name || '',
            status: r.status || 'pending',
          }));
          await setLocal(localKey, mapped);
          return mapped;
        }
      } else {
        const slot = await loadChunkedSlot<ServiceItem[]>(this.getSlotId(3));
        if (slot.data) {
          await setLocal(localKey, slot.data);
          return slot.data;
        }
      }
    } catch (e) {
      console.warn('getServices error:', e);
    }
    return (await getLocal<ServiceItem[]>(localKey)) || [];
  },

  async saveServices(services: ServiceItem[]): Promise<void> {
    const localKey = `@services_${activeCompanyCode}`;
    await setLocal(localKey, services);

    try {
      if (activeCompanyCode === 'POLATLAR') {
        const rows = services.map((s) => ({
          id: s.id,
          company_name: s.companyName,
          cari_name: s.cariName || null,
          location: s.location || null,
          latitude: s.latitude || null,
          longitude: s.longitude || null,
          work_done: s.workDone,
          date: s.date || null,
          photos: s.photos || [],
          created_at: s.createdAt,
          created_by: s.createdBy || null,
          created_by_name: s.createdByName || null,
          status: s.status || 'pending',
        }));
        await supabase.from('services').upsert(rows);
      } else {
        await saveChunkedSlot(this.getSlotId(3), services);
      }
    } catch (e) {
      console.warn('saveServices cloud error:', e);
    }
  },

  async deleteService(id: string): Promise<void> {
    const services = await this.getServices();
    const updated = services.filter((s) => s.id !== id);
    const localKey = `@services_${activeCompanyCode}`;
    await setLocal(localKey, updated);
    try {
      if (activeCompanyCode === 'POLATLAR') {
        await supabase.from('services').delete().eq('id', id);
      } else {
        await saveChunkedSlot(this.getSlotId(3), updated);
      }
    } catch (e) {
      console.warn('deleteService cloud error:', e);
    }
  },

  // 3. ATTENDANCE RECORDS (Mesai Takibi)
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    const localKey = `@attendance_${activeCompanyCode}`;
    try {
      const slot = await loadChunkedSlot<AttendanceRecord[]>(this.getSlotId(8));
      if (slot.data && slot.data.length > 0) {
        await setLocal(localKey, slot.data);
        return slot.data;
      }
    } catch (e) {
      console.warn('getAttendanceRecords error:', e);
    }
    const local = await getLocal<AttendanceRecord[]>(localKey);
    if (local && local.length > 0) return local;

    // Görsel 3, 4, 5 ile birebir başlangıç verileri
    const initialRecords: AttendanceRecord[] = [
      {
        id: 'att_1',
        userId: 'usr_burak',
        userName: 'Burak AĞCAKAYA',
        userRole: 'Saha Yetkilisi',
        branchName: 'Merkez',
        date: '2026-09-18',
        status: 'completed',
        checkInTime: new Date('2026-09-18T09:19:00').getTime(),
        checkInDistance: 9.5,
        checkOutTime: new Date('2026-09-18T16:03:00').getTime(),
        checkOutDistance: 13.3,
        workDurationMinutes: 404,
        notes: '',
      },
      {
        id: 'att_2',
        userId: 'usr_azizcan',
        userName: 'Azizcan ISIYEL',
        userRole: 'Saha Yetkilisi',
        branchName: 'Merkez',
        date: '2026-09-18',
        status: 'completed',
        checkInTime: new Date('2026-09-18T09:11:00').getTime(),
        checkInDistance: 7.8,
        checkOutTime: new Date('2026-09-18T16:02:00').getTime(),
        checkOutDistance: 8.0,
        workDurationMinutes: 411,
        notes: '',
      },
      {
        id: 'att_3',
        userId: 'usr_burak',
        userName: 'Burak AĞCAKAYA',
        userRole: 'Saha Yetkilisi',
        branchName: 'Merkez',
        date: '2026-09-18',
        status: 'completed',
        checkInTime: new Date('2026-09-18T08:53:00').getTime(),
        checkInDistance: 14.0,
        checkOutTime: new Date('2026-09-18T09:19:00').getTime(),
        checkOutDistance: 9.5,
        workDurationMinutes: 26,
        notes: '',
      },
      {
        id: 'att_4',
        userId: 'usr_azizcan',
        userName: 'Azizcan ISIYEL',
        userRole: 'Saha Yetkilisi',
        branchName: 'Merkez',
        date: '2026-09-17',
        status: 'completed',
        checkInTime: new Date('2026-09-17T09:10:00').getTime(),
        checkInDistance: 16.8,
        checkOutTime: new Date('2026-09-17T16:00:00').getTime(),
        checkOutDistance: 8.1,
        workDurationMinutes: 410,
        notes: '',
      },
      {
        id: 'att_5',
        userId: 'usr_burak',
        userName: 'Burak AĞCAKAYA',
        userRole: 'Saha Yetkilisi',
        branchName: 'Merkez',
        date: '2026-09-17',
        status: 'on_leave',
        checkInTime: new Date('2026-09-17T09:00:00').getTime(),
        workDurationMinutes: 0,
        notes: 'İzinli',
      },
      {
        id: 'att_6',
        userId: 'usr_burak',
        userName: 'Burak AĞCAKAYA',
        userRole: 'Saha Yetkilisi',
        branchName: 'Merkez',
        date: '2026-09-16',
        status: 'completed',
        checkInTime: new Date('2026-09-16T10:22:00').getTime(),
        checkInDistance: 12.3,
        checkOutTime: new Date('2026-09-16T16:11:00').getTime(),
        checkOutDistance: 349.9,
        checkOutOutside: true,
        checkOutApprovalStatus: 'approved',
        workDurationMinutes: 349,
        notes: 'Salim Gıdada iş bitti. Mesai..',
      },
      {
        id: 'att_7',
        userId: 'usr_azizcan',
        userName: 'Azizcan ISIYEL',
        userRole: 'Saha Yetkilisi',
        branchName: 'Merkez',
        date: '2026-09-16',
        status: 'completed',
        checkInTime: new Date('2026-09-16T09:54:00').getTime(),
        checkInDistance: 8.3,
        checkOutTime: new Date('2026-09-16T16:13:00').getTime(),
        checkOutDistance: 352.1,
        checkOutOutside: true,
        checkOutApprovalStatus: 'approved',
        workDurationMinutes: 379,
        notes: '',
      },
      {
        id: 'att_8',
        userId: 'usr_burak',
        userName: 'Burak AĞCAKAYA',
        userRole: 'Saha Yetkilisi',
        branchName: 'Merkez',
        date: '2026-09-16',
        status: 'completed',
        checkInTime: new Date('2026-09-16T09:30:00').getTime(),
        checkInDistance: 1380.0,
        checkInOutside: true,
        checkInApprovalStatus: 'approved',
        checkOutTime: new Date('2026-09-16T10:22:00').getTime(),
        checkOutDistance: 12.3,
        workDurationMinutes: 52,
        notes: 'Et süt kurumunda başladım.',
      },
    ];
    await setLocal(localKey, initialRecords);
    return initialRecords;
  },

  async saveAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
    const localKey = `@attendance_${activeCompanyCode}`;
    await setLocal(localKey, records);
    await saveChunkedSlot(this.getSlotId(8), records);
  },

  // 4. WORKPLACE LOCATION (İşyeri Konumu & Çemberi)
  async getWorkplaceLocation(): Promise<WorkplaceLocation | null> {
    const localKey = `@workplace_${activeCompanyCode}`;
    try {
      const slot = await loadChunkedSlot<WorkplaceLocation>(this.getSlotId(5));
      if (slot.data) {
        await setLocal(localKey, slot.data);
        return slot.data;
      }
    } catch (e) {
      console.warn('getWorkplaceLocation error:', e);
    }
    const local = await getLocal<WorkplaceLocation>(localKey);
    if (local) return local;

    // Varsayılan Merkez İş Yeri (Görsel-1)
    const defaultWorkplace: WorkplaceLocation = {
      address: 'Millet Bahçe Caddesi, Lalapaşa Mahallesi, Yakutiye, Erzurum',
      latitude: 39.91070,
      longitude: 41.27138,
      radiusMeters: 20,
      updatedAt: Date.now(),
    };
    await setLocal(localKey, defaultWorkplace);
    return defaultWorkplace;
  },

  async saveWorkplaceLocation(loc: WorkplaceLocation): Promise<void> {
    const localKey = `@workplace_${activeCompanyCode}`;
    await setLocal(localKey, loc);
    try {
      await saveChunkedSlot(this.getSlotId(5), loc);
    } catch (e) {
      console.warn('saveWorkplaceLocation error:', e);
    }
  },

  // 5. BRANCHES (Şubeler)
  async getBranches(): Promise<Branch[]> {
    const localKey = `@branches_${activeCompanyCode}`;
    try {
      const slot = await loadChunkedSlot<Branch[]>(this.getSlotId(14));
      if (slot.data) {
        await setLocal(localKey, slot.data);
        return slot.data;
      }
    } catch (e) {
      console.warn('getBranches error:', e);
    }
    return (await getLocal<Branch[]>(localKey)) || [];
  },

  async saveBranches(branches: Branch[]): Promise<void> {
    const localKey = `@branches_${activeCompanyCode}`;
    await setLocal(localKey, branches);
    await saveChunkedSlot(this.getSlotId(14), branches);
  },

  async getBranchesForCompany(companyCode: string, companyId?: number): Promise<Branch[]> {
    const cleanCode = (companyCode || 'POLATLAR').trim().toUpperCase();
    const localKey = cleanCode === 'POLATLAR' ? '@branches_POLATLAR' : `@branches_${cleanCode}`;
    const slotId = this.getSlotIdForCompany(14, cleanCode, companyId);
    try {
      const slot = await loadChunkedSlot<Branch[]>(slotId);
      if (slot.data && Array.isArray(slot.data)) {
        await setLocal(localKey, slot.data);
        return slot.data;
      }
      if (cleanCode !== 'POLATLAR' && slot.notFound) {
        await setLocal(localKey, []);
        return [];
      }
    } catch (e) {
      console.warn('getBranchesForCompany error:', e);
    }
    return (await getLocal<Branch[]>(localKey)) || [];
  },

  async saveBranchesForCompany(companyCode: string, branches: Branch[], companyId?: number): Promise<void> {
    const cleanCode = (companyCode || 'POLATLAR').trim().toUpperCase();
    const localKey = cleanCode === 'POLATLAR' ? '@branches_POLATLAR' : `@branches_${cleanCode}`;
    const slotId = this.getSlotIdForCompany(14, cleanCode, companyId);
    await setLocal(localKey, branches);
    await saveChunkedSlot(slotId, branches);
  },

  // 5b. HEADQUARTERS (Merkez Firmalar)
  async getHeadquarters(): Promise<HeadquarterCompany[]> {
    const localKey = `@headquarters_${activeCompanyCode}`;
    try {
      const slot = await loadChunkedSlot<HeadquarterCompany[]>(this.getSlotId(16));
      if (slot.data && Array.isArray(slot.data) && slot.data.length > 0) {
        await setLocal(localKey, slot.data);
        return slot.data;
      }
    } catch (e) {
      console.warn('getHeadquarters error:', e);
    }
    const local = await getLocal<HeadquarterCompany[]>(localKey);
    if (local && Array.isArray(local) && local.length > 0) {
      return local;
    }

    // Varsayılan ana merkez firma
    const defaultHq: HeadquarterCompany = {
      id: `hq_default_${activeCompanyCode.toLowerCase()}`,
      companyCode: activeCompanyCode,
      name: activeCompanyCode === 'POLATLAR' ? 'POLATLAR A.Ş. (Merkez)' : `${activeCompanyCode} Genel Merkez`,
      address: 'Merkez Adres',
      createdAt: Date.now(),
    };
    const initial = [defaultHq];
    await setLocal(localKey, initial);
    return initial;
  },

  async saveHeadquarters(headquarters: HeadquarterCompany[]): Promise<void> {
    const localKey = `@headquarters_${activeCompanyCode}`;
    await setLocal(localKey, headquarters);
    await saveChunkedSlot(this.getSlotId(16), headquarters);
  },

  // 6. LEAVE REQUESTS (İzin Talepleri)
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    const localKey = `@leave_requests_${activeCompanyCode}`;
    try {
      const slot = await loadChunkedSlot<LeaveRequest[]>(this.getSlotId(12));
      if (slot.data) {
        await setLocal(localKey, slot.data);
        return slot.data;
      }
    } catch (e) {
      console.warn('getLeaveRequests error:', e);
    }
    return (await getLocal<LeaveRequest[]>(localKey)) || [];
  },

  async saveLeaveRequests(requests: LeaveRequest[]): Promise<void> {
    const localKey = `@leave_requests_${activeCompanyCode}`;
    await setLocal(localKey, requests);
    await saveChunkedSlot(this.getSlotId(12), requests);
  },

  // 7. RETURN & WARRANTY (İade & Garanti)
  async getReturnWarrantyItems(): Promise<ReturnWarrantyItem[]> {
    const localKey = `@return_warranty_${activeCompanyCode}`;
    try {
      if (activeCompanyCode === 'POLATLAR') {
        let fallbackItems: ReturnWarrantyItem[] = [];
        try {
          const slot = await loadChunkedSlot<ReturnWarrantyItem[]>(2);
          if (slot.data && Array.isArray(slot.data)) {
            fallbackItems = slot.data;
          }
        } catch {}

        const { data, error } = await supabase
          .from('return_warranty')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const fallbackMap = new Map(fallbackItems.map((i) => [i.id, i]));
          const mapped: ReturnWarrantyItem[] = data.map((r) => {
            const fb = fallbackMap.get(r.id);
            return {
              id: r.id,
              type: r.type || 'warranty',
              companyName: r.company_name,
              cariName: r.cari_name || fb?.cariName || undefined,
              sentDate: r.sent_date,
              serialNumber: r.serial_number || fb?.serialNumber || '',
              trackingCode: r.tracking_code || fb?.trackingCode || '',
              serialNumberPhoto: r.serial_number_photo || fb?.serialNumberPhoto || undefined,
              trackingCodePhoto: r.tracking_code_photo || fb?.trackingCodePhoto || undefined,
              notes: r.notes || fb?.notes || '',
              status: r.status || 'pending',
              reminderDate: r.reminder_date || fb?.reminderDate || undefined,
              reminderActive: r.reminder_active || false,
              notified: r.notified || false,
              createdAt: Number(r.created_at) || Date.now(),
              createdBy: r.created_by || '',
              createdByName: r.created_by_name || '',
            };
          });

          const cloudIds = new Set(mapped.map((c) => c.id));
          const missingFallback = fallbackItems.filter((f) => !cloudIds.has(f.id));
          const merged = [...mapped, ...missingFallback];

          if (merged.length > 0) {
            await setLocal(localKey, merged);
            return merged;
          }
        }

        if (fallbackItems.length > 0) {
          await setLocal(localKey, fallbackItems);
          return fallbackItems;
        }
      } else {
        const slot = await loadChunkedSlot<ReturnWarrantyItem[]>(this.getSlotId(2));
        if (slot.data) {
          await setLocal(localKey, slot.data);
          return slot.data;
        }
      }
    } catch (e) {
      console.warn('getReturnWarrantyItems error:', e);
    }
    return (await getLocal<ReturnWarrantyItem[]>(localKey)) || [];
  },

  async saveReturnWarrantyItems(items: ReturnWarrantyItem[]): Promise<void> {
    const localKey = `@return_warranty_${activeCompanyCode}`;
    await setLocal(localKey, items);

    try {
      if (activeCompanyCode === 'POLATLAR') {
        const rows = items.map((i) => ({
          id: i.id,
          type: i.type,
          company_name: i.companyName,
          cari_name: i.cariName || null,
          sent_date: i.sentDate,
          serial_number: i.serialNumber || null,
          tracking_code: i.trackingCode || null,
          serial_number_photo: i.serialNumberPhoto || null,
          tracking_code_photo: i.trackingCodePhoto || null,
          notes: i.notes || null,
          status: i.status || 'pending',
          reminder_date: i.reminderDate || null,
          reminder_active: i.reminderActive || false,
          notified: i.notified || false,
          created_at: i.createdAt,
          created_by: i.createdBy || null,
          created_by_name: i.createdByName || null,
        }));
        await supabase.from('return_warranty').upsert(rows);
      } else {
        await saveChunkedSlot(this.getSlotId(2), items);
      }
    } catch (e) {
      console.warn('saveReturnWarrantyItems cloud error:', e);
    }
  },

  // 8. NOTES (Notlar)
  async getNotes(): Promise<GeneralNote[]> {
    const localKey = `@notes_${activeCompanyCode}`;
    try {
      if (activeCompanyCode === 'POLATLAR') {
        // 1. Fetch fallback cloud sync slot (standard_tasks id: 4)
        let fallbackNotes: GeneralNote[] = [];
        const stFallback = await loadChunkedSlot<GeneralNote[]>(4);
        if (stFallback.data && Array.isArray(stFallback.data)) {
          fallbackNotes = stFallback.data;
        }

        // 2. Try fetching from Supabase native notes table
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const fallbackMap = new Map(fallbackNotes.map((n) => [n.id, n]));
          const mapped: GeneralNote[] = data.map((r: any) => {
            const fb = fallbackMap.get(r.id);
            return {
              id: r.id,
              content: r.content,
              cariName: fb?.cariName || r.cari_name || undefined,
              createdAt: Number(r.created_at) || Date.now(),
              createdBy: r.created_by || undefined,
              createdByName: r.created_by_name || undefined,
              targetMode: r.target_mode || 'self',
              targetUserIds: Array.isArray(r.target_user_ids) ? r.target_user_ids : [],
              targetUserNames: Array.isArray(r.target_user_names) ? r.target_user_names : [],
              targetUserId: r.target_user_id || undefined,
              targetUserName: r.target_user_name || undefined,
              reminderActive: Boolean(r.reminder_active),
              reminderDate: r.reminder_date || undefined,
              notified: Boolean(r.notified),
              photos: fb?.photos && fb.photos.length > 0 ? fb.photos : (Array.isArray(r.photos) ? r.photos : []),
              completionPhotos: fb?.completionPhotos && fb.completionPhotos.length > 0 ? fb.completionPhotos : (Array.isArray(r.completion_photos) ? r.completion_photos : []),
              status: fb?.status || r.status || 'pending',
              completedAt: fb?.completedAt || (r.completed_at ? Number(r.completed_at) : undefined),
              completedBy: fb?.completedBy || r.completed_by || undefined,
              completedByName: fb?.completedByName || r.completed_by_name || undefined,
              completionNote: fb?.completionNote || r.completion_note || undefined,
              approvedAt: fb?.approvedAt || (r.approved_at ? Number(r.approved_at) : undefined),
              approvedBy: fb?.approvedBy || r.approved_by || undefined,
              approvedByName: fb?.approvedByName || r.approved_by_name || undefined,
              rejectedAt: fb?.rejectedAt || (r.rejected_at ? Number(r.rejected_at) : undefined),
              rejectedBy: fb?.rejectedBy || r.rejected_by || undefined,
              rejectedByName: fb?.rejectedByName || r.rejected_by_name || undefined,
              rejectionReason: fb?.rejectionReason || r.rejection_reason || undefined,
            };
          });

          // Prevent dropping notes that exist in fallback (Slot 4) but not yet in notes table
          const dataIds = new Set(data.map((r: any) => r.id));
          const missingFallback = fallbackNotes.filter((fb) => !dataIds.has(fb.id));
          const merged = [...mapped, ...missingFallback];

          await setLocal(localKey, merged);
          return merged;
        }

        if (fallbackNotes.length > 0) {
          await setLocal(localKey, fallbackNotes);
          return fallbackNotes;
        }
      } else {
        const slot = await loadChunkedSlot<GeneralNote[]>(this.getSlotId(4));
        if (slot.data) {
          await setLocal(localKey, slot.data);
          return slot.data;
        }
      }
    } catch (e) {
      console.warn('getNotes error:', e);
    }
    return (await getLocal<GeneralNote[]>(localKey)) || [];
  },

  async saveNotes(notes: GeneralNote[]): Promise<void> {
    const localKey = `@notes_${activeCompanyCode}`;
    await setLocal(localKey, notes);

    try {
      if (activeCompanyCode === 'POLATLAR') {
        const rows = notes.map((n) => ({
          id: n.id,
          content: n.content,
          cari_name: n.cariName || null,
          created_at: n.createdAt,
          created_by: n.createdBy || null,
          created_by_name: n.createdByName || null,
          target_mode: n.targetMode || 'self',
          target_user_ids: n.targetUserIds || [],
          target_user_names: n.targetUserNames || [],
          target_user_id: n.targetUserId || null,
          target_user_name: n.targetUserName || null,
          reminder_active: n.reminderActive || false,
          reminder_date: n.reminderDate || null,
          notified: n.notified || false,
          photos: n.photos || [],
          completion_photos: n.completionPhotos || [],
          status: n.status || 'pending',
          completed_at: n.completedAt || null,
          completed_by: n.completedBy || null,
          completed_by_name: n.completedByName || null,
          completion_note: n.completionNote || null,
          approved_at: n.approvedAt || null,
          approved_by: n.approvedBy || null,
          approved_by_name: n.approvedByName || null,
          rejected_at: n.rejectedAt || null,
          rejected_by: n.rejectedBy || null,
          rejected_by_name: n.rejectedByName || null,
          rejection_reason: n.rejectionReason || null,
        }));
        const { error: upsertErr } = await supabase.from('notes').upsert(rows);
        if (upsertErr) {
          console.warn('mobil saveNotes primary upsert error, falling back to basic columns:', upsertErr);
          const basicRows = notes.map((n) => ({
            id: n.id,
            content: n.content,
            created_at: n.createdAt,
            created_by: n.createdBy || null,
            created_by_name: n.createdByName || null,
            target_mode: n.targetMode || 'self',
            target_user_ids: n.targetUserIds || [],
            target_user_names: n.targetUserNames || [],
            target_user_id: n.targetUserId || null,
            target_user_name: n.targetUserName || null,
            reminder_active: n.reminderActive || false,
            reminder_date: n.reminderDate || null,
            notified: n.notified || false,
            status: n.status || 'pending',
            completed_at: n.completedAt || null,
            completed_by: n.completedBy || null,
            completed_by_name: n.completedByName || null,
            completion_note: n.completionNote || null,
            approved_at: n.approvedAt || null,
            approved_by: n.approvedBy || null,
            approved_by_name: n.approvedByName || null,
            rejected_at: n.rejectedAt || null,
            rejected_by: n.rejectedBy || null,
            rejected_by_name: n.rejectedByName || null,
            rejection_reason: n.rejectionReason || null,
          }));
          await supabase.from('notes').upsert(basicRows);
        }
        await saveChunkedSlot(4, notes);
        await saveChunkedSlot(this.getSlotId(4), notes);
      } else {
        await saveChunkedSlot(this.getSlotId(4), notes);
      }
    } catch (e) {
      console.warn('saveNotes cloud error:', e);
    }
  },

  async deleteNote(id: string): Promise<void> {
    const notes = await this.getNotes();
    const updated = notes.filter((n) => n.id !== id);
    const localKey = `@notes_${activeCompanyCode}`;
    await setLocal(localKey, updated);
    try {
      if (activeCompanyCode === 'POLATLAR') {
        await supabase.from('notes').delete().eq('id', id);
      } else {
        await saveChunkedSlot(this.getSlotId(4), updated);
      }
    } catch (e) {
      console.warn('deleteNote cloud error:', e);
    }
  },

  async updateNoteStatus(id: string, status: any): Promise<void> {
    const notes = await this.getNotes();
    const now = Date.now();
    const updated = notes.map((n) => {
      if (n.id === id) {
        return {
          ...n,
          status,
          approvedAt: status === 'approved' ? (n.approvedAt || now) : (status === 'pending' ? undefined : n.approvedAt),
        };
      }
      return n;
    });
    await this.saveNotes(updated);
  },

  // 9. TIMED FOLLOW-UPS (Süreli Takipler & Alarmlar)
  async getTimedFollowUps(): Promise<TimedFollowUp[]> {
    const localKey = `@timed_follow_ups_${activeCompanyCode}`;
    const items = await getLocal<TimedFollowUp[]>(localKey);
    return items || [];
  },

  async saveTimedFollowUps(items: TimedFollowUp[]): Promise<void> {
    const localKey = `@timed_follow_ups_${activeCompanyCode}`;
    await setLocal(localKey, items);
  },

  async deleteTimedFollowUp(id: string): Promise<void> {
    const items = await this.getTimedFollowUps();
    const updated = items.filter((i) => i.id !== id);
    await this.saveTimedFollowUps(updated);
  },

  // 10. ADMIN REMINDERS (Hatırlatmalar & Çalışma Kuralları)
  async getAdminReminders(): Promise<AdminReminder[]> {
    const localKey = `@admin_reminders_${activeCompanyCode}`;
    const items = await getLocal<AdminReminder[]>(localKey);
    if (items && items.length > 0) return items;

    // Default initial seed from Görsel-3
    const defaultReminders: AdminReminder[] = [
      {
        id: 'rem-sql-1',
        title: 'Sql kurulum',
        content: 'Arkadaşlar SQL KURULUMDA yu Kullanıcı açıp SA pasif etme işlemini unutmayalım. Bu işlem güvenlik açısından çok önemli',
        category: 'procedure',
        createdAt: 1789642020000, // 17 Eylül 2026, 13:47
        createdByName: 'Murat POLAT',
        isPinned: true,
        readBy: ['user-1', 'user-2', 'user-3', 'user-4'],
      },
    ];
    await setLocal(localKey, defaultReminders);
    return defaultReminders;
  },

  async saveAdminReminders(items: AdminReminder[]): Promise<void> {
    const localKey = `@admin_reminders_${activeCompanyCode}`;
    await setLocal(localKey, items);
  },

  async deleteAdminReminder(id: string): Promise<void> {
    const items = await this.getAdminReminders();
    const updated = items.filter((r) => r.id !== id);
    await this.saveAdminReminders(updated);
  },

  // 11. SECURITY LOGS (Güvenlik & Log Kayıtları - Slot 12)
  async getSecurityLogs(): Promise<SecurityLogItem[]> {
    const localKey = `@security_logs_${activeCompanyCode}`;
    const slotId = this.getSlotId(12);
    const { data: cloudData } = await loadChunkedSlot<SecurityLogItem[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await setLocal(localKey, cloudData);
      return cloudData;
    }
    const localLogs = await getLocal<SecurityLogItem[]>(localKey);
    return localLogs || [];
  },

  async saveSecurityLogs(items: SecurityLogItem[]): Promise<void> {
    const localKey = `@security_logs_${activeCompanyCode}`;
    await setLocal(localKey, items);
    await saveChunkedSlot(this.getSlotId(12), items);
  },

  async addSecurityLog(
    entry: Omit<SecurityLogItem, 'id' | 'timestamp' | 'read'>
  ): Promise<SecurityLogItem> {
    const logs = await this.getSecurityLogs();
    const newLog: SecurityLogItem = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      read: false,
      ...entry,
    };
    const updated = [newLog, ...logs].slice(0, 200);
    await this.saveSecurityLogs(updated);
    return newLog;
  },

  async deleteSecurityLog(id: string): Promise<void> {
    const logs = await this.getSecurityLogs();
    const updated = logs.filter((l) => l.id !== id);
    await this.saveSecurityLogs(updated);
  },

  async clearAllSecurityLogs(): Promise<void> {
    const localKey = `@security_logs_${activeCompanyCode}`;
    await setLocal(localKey, []);
    await saveChunkedSlot(this.getSlotId(12), []);
  },

  // 12. STANDARD CHECKLIST TASKS (Standart Şablon Görevleri - Görsel 4 & 5)
  async getStandardTasks(): Promise<string[]> {
    const localKey = `@standard_tasks_${activeCompanyCode}`;
    const tasks = await getLocal<string[]>(localKey);
    if (tasks && tasks.length > 0) return tasks;

    const defaultTasks: string[] = [
      'POS cihazı Entegre edildi mi?',
      'POS cihazından kart ve nakit denendi mi?',
      'Banka Listesine ilgili banka eklendi mi?',
      'Firma Sabitleri Pos kısmından “Ürün seçerek tahsilat yapılamaz” işaretlendi mi?',
      'Firma Sabitleri Pos kısmından Fiş Limiti 12000₺ olarak belirlendi mi?',
      'Fiş Yazıcı kuruldu mu?',
      'Fiş Yazıcı test edildi mi?',
      'Barkod yazıcı kuruldu mu?',
      'Barkod yazıcı test edildi mi?',
      'Dokunmatik Ekran çift ekran ise arka ekran ayarlandı mı?',
      'Cat kablo kullanıldı mı?',
      'Ürünler teraziye gönderildi mi?',
      'Klavye ve Mouse verildi mi?',
      'Kullanıcıya Stok Girişi ve fiyat değişikliği gösterildi mi?',
      'Stok Grup Tanımları eklendi mi?',
    ];
    await setLocal(localKey, defaultTasks);
    return defaultTasks;
  },

  async saveStandardTasks(tasks: string[]): Promise<void> {
    const localKey = `@standard_tasks_${activeCompanyCode}`;
    await setLocal(localKey, tasks);
  },

  async resetStandardTasks(): Promise<string[]> {
    const localKey = `@standard_tasks_${activeCompanyCode}`;
    const defaultTasks: string[] = [
      'POS cihazı Entegre edildi mi?',
      'POS cihazından kart ve nakit denendi mi?',
      'Banka Listesine ilgili banka eklendi mi?',
      'Firma Sabitleri Pos kısmından “Ürün seçerek tahsilat yapılamaz” işaretlendi mi?',
      'Firma Sabitleri Pos kısmından Fiş Limiti 12000₺ olarak belirlendi mi?',
      'Fiş Yazıcı kuruldu mu?',
      'Fiş Yazıcı test edildi mi?',
      'Barkod yazıcı kuruldu mu?',
      'Barkod yazıcı test edildi mi?',
      'Dokunmatik Ekran çift ekran ise arka ekran ayarlandı mı?',
      'Cat kablo kullanıldı mı?',
      'Ürünler teraziye gönderildi mi?',
      'Klavye ve Mouse verildi mi?',
      'Kullanıcıya Stok Girişi ve fiyat değişikliği gösterildi mi?',
      'Stok Grup Tanımları eklendi mi?',
    ];
    await setLocal(localKey, defaultTasks);
    return defaultTasks;
  },

  // 13. CARILER (Müşteri & Cari Listesi)
  getCariler(): string[] {
    if (carilerData && Array.isArray((carilerData as any).cariler)) {
      return (carilerData as any).cariler;
    }
    return [];
  },

  async getCarilerData(): Promise<CariData> {
    const localKey = `@cariler_data_${activeCompanyCode}`;
    try {
      // 1. Check local storage
      const local = await getLocal<CariData>(localKey);
      if (local && Array.isArray(local.cariler) && local.cariler.length > 0) {
        return local;
      }

      // 2. Check cloud slot 15
      const slot = await loadChunkedSlot<CariData>(this.getSlotId(15));
      if (slot.data && Array.isArray(slot.data.cariler) && slot.data.cariler.length > 0) {
        await setLocal(localKey, slot.data);
        return slot.data;
      }
    } catch (e) {
      console.warn('getCarilerData error:', e);
    }

    // 3. Fallback to bundled json
    const bundled: string[] = carilerData && Array.isArray((carilerData as any).cariler)
      ? (carilerData as any).cariler
      : [];

    const defaultData: CariData = {
      updatedAt: (carilerData as any)?.updatedAt || new Date().toISOString(),
      database: (carilerData as any)?.database || (activeCompanyCode === 'POLATLAR' ? 'POLATLAR2025' : `${activeCompanyCode} Carileri`),
      total: bundled.length,
      cariler: bundled,
    };
    return defaultData;
  },

  async saveCarilerData(data: CariData): Promise<void> {
    const localKey = `@cariler_data_${activeCompanyCode}`;
    await setLocal(localKey, data);
    try {
      await saveChunkedSlot(this.getSlotId(15), data);
    } catch (e) {
      console.warn('saveCarilerData cloud error:', e);
    }
  },

  async importCarilerFromExcel(arrayBuffer: ArrayBuffer, fileName?: string): Promise<CariData> {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
    let cariColIndex = 0;
    let startRow = 0;

    if (rows.length > 0) {
      const headerRow = rows[0] as any[];
      if (Array.isArray(headerRow)) {
        const foundIdx = headerRow.findIndex(
          (val) => typeof val === 'string' && /cari|firma|müsteri|müşteri/i.test(val)
        );
        if (foundIdx !== -1) {
          cariColIndex = foundIdx;
          startRow = 1;
        } else if (typeof headerRow[0] === 'string' && /ad|isim/i.test(headerRow[0])) {
          startRow = 1;
        }
      }
    }

    const set = new Set<string>();
    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i] as any[];
      if (Array.isArray(row) && row[cariColIndex] !== undefined && row[cariColIndex] !== null) {
        const val = String(row[cariColIndex]).trim();
        if (val.length > 0 && !/^(cari|cari adı|sıra no|no)$/i.test(val)) {
          set.add(val);
        }
      }
    }

    const sortedCariler = Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
    const result: CariData = {
      updatedAt: new Date().toISOString(),
      database: activeCompanyCode === 'POLATLAR' ? 'POLATLAR2025 & Excel' : `${activeCompanyCode} Excel Yüklemesi`,
      total: sortedCariler.length,
      cariler: sortedCariler,
    };

    await this.saveCarilerData(result);
    return result;
  },

  exportCarilerToExcel(cariler: string[], fileName = 'Cariler.xlsx'): void {
    const data = [['Cari Adı'], ...cariler.map((c) => [c])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 45 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cariler');

    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        XLSX.writeFile(wb, fileName);
      } else {
        // Fallback for native
        const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        console.log('Exported base64 length:', base64.length);
      }
    } catch (err) {
      console.error('exportCarilerToExcel error:', err);
    }
  },
};
