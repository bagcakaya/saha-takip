import { get, set } from 'idb-keyval';
import {
  LocationItem,
  GeneralNote,
  BackupData,
  ReturnWarrantyItem,
  ServiceItem,
  WorkplaceLocation,
  Branch,
  AttendanceRecord,
  AdminReminder,
  CariData,
  LeaveRequest,
  SecurityLogItem,
  TimedFollowUp,
} from '../types/storage';
import { DEFAULT_STANDARD_TASKS } from '../constants/defaultTasks';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import defaultCarilerData from '../data/cariler.json';
import { ServerConfigService } from './serverConfigService';

const LOCATIONS_KEY = '@gorev_tamamlama_locations';
const STANDARD_TASKS_KEY = '@gorev_tamamlama_standard_tasks';
const NOTES_KEY = '@gorev_tamamlama_general_notes';
const RETURN_WARRANTY_KEY = '@gorev_tamamlama_return_warranty';
const SERVICES_KEY = '@gorev_tamamlama_services';
const WORKPLACE_LOCATION_KEY = '@saha_takip_workplace_location';
const BRANCHES_KEY = '@saha_takip_branches';
const ATTENDANCE_RECORDS_KEY = '@saha_takip_attendance_records';
const ADMIN_REMINDERS_KEY = '@saha_takip_admin_reminders';
const CARILER_DATA_KEY = '@saha_takip_cariler_data';
const LEAVE_REQUESTS_KEY = '@saha_takip_leave_requests';
const SECURITY_LOGS_KEY = '@saha_takip_security_logs';
const TIMED_FOLLOW_UPS_KEY = '@saha_takip_timed_follow_ups';

function resolveCompanyId(code: string, currentId?: number): number {
  const clean = (code || 'POLATLAR').trim().toUpperCase();
  if (clean === 'POLATLAR') return 1;
  if (currentId && currentId > 1) return currentId;

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_companies_directory') : null;
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const found = list.find((c: any) => c.code && c.code.toUpperCase() === clean);
        if (found && typeof found.id === 'number' && found.id > 1) {
          return found.id;
        }
      }
    }
  } catch {
    // ignore
  }

  // Deterministic fallback hash based on company code (always >= 2, never 1)
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) & 0xffff;
  }
  return (Math.abs(hash) % 1000) + 2;
}

// Active Company state
let activeCompanyCode =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('@saha_takip_company_code') || 'POLATLAR'
    : 'POLATLAR';
let activeCompanyId =
  activeCompanyCode === 'POLATLAR'
    ? 1
    : resolveCompanyId(
        activeCompanyCode,
        Number(typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_company_id') : 0) || 0
      );

// Helper to safely load data from IndexedDB or fallback to localStorage
async function loadItem<T>(key: string): Promise<T | null> {
  try {
    const idbVal = await get<T>(key);
    if (idbVal !== undefined && idbVal !== null) {
      return idbVal;
    }
  } catch (e) {
    console.warn(`IndexedDB read failed for ${key}, falling back to localStorage:`, e);
  }

  try {
    const localVal = localStorage.getItem(key);
    if (localVal) {
      return JSON.parse(localVal) as T;
    }
  } catch (e) {
    console.warn(`localStorage read failed for ${key}:`, e);
  }

  return null;
}

// Helper to safely save data to IndexedDB and localStorage mirror
async function saveItem<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value);
  } catch (e) {
    console.warn(`IndexedDB write failed for ${key}:`, e);
  }

  try {
    const stringified = JSON.stringify(value);
    if (stringified.length < 4000000) {
      localStorage.setItem(key, stringified);
    }
  } catch (e) {
    console.warn(`localStorage mirror skipped for ${key}:`, e);
  }
}

// Helper to load chunked JSON from standard_tasks slot
async function loadChunkedSlot<T>(slotId: number): Promise<{ data: T | null; notFound: boolean }> {
  // 1. Yerel Sunucu (Local Mode) - Windows Server 2022 SQL Server
  if (ServerConfigService.isLocalMode()) {
    const apiUrl = ServerConfigService.getActiveApiUrl();
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
        console.warn(`[Yerel Sunucu] Slot ${slotId} yüklenemedi, buluta geçiliyor:`, err);
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
    if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
      return { data: null, notFound: true };
    }
  } catch {
    // ignore
  }
  return { data: null, notFound: false };
}

// Helper to save chunked JSON to standard_tasks slot
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
  if (ServerConfigService.isLocalMode()) {
    const apiUrl = ServerConfigService.getActiveApiUrl();
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
        console.warn(`[Yerel Sunucu] Slot ${slotId} kaydedilemedi, buluta aktarılıyor:`, err);
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

export const StorageService = {
  getCompanyCode(): string {
    return activeCompanyCode;
  },

  getCompanyId(): number {
    return activeCompanyId;
  },

  setCompany(code: string, id?: number): void {
    activeCompanyCode = (code || 'POLATLAR').trim().toUpperCase();
    if (activeCompanyCode === 'POLATLAR') {
      activeCompanyId = 1;
    } else {
      activeCompanyId = resolveCompanyId(activeCompanyCode, id && id > 1 ? id : 0);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('@saha_takip_company_code', activeCompanyCode);
      localStorage.setItem('@saha_takip_company_id', String(activeCompanyId));
    }
  },

  /**
   * Calculates cloud standard_tasks slot ID for given module.
   * POLATLAR (company 1) uses standard slots 1..10.
   * Other companies use: (companyId - 1) * 20 + moduleId
   */
  getSlotId(moduleId: number): number {
    if (activeCompanyCode === 'POLATLAR') {
      return moduleId;
    }
    const resolvedId = resolveCompanyId(activeCompanyCode, activeCompanyId);
    return (resolvedId - 1) * 20 + moduleId;
  },

  /**
   * Calculates cloud standard_tasks slot ID for an explicit company
   */
  getSlotIdForCompany(moduleId: number, companyCode: string, companyId?: number): number {
    const cleanCode = (companyCode || 'POLATLAR').trim().toUpperCase();
    if (cleanCode === 'POLATLAR') {
      return moduleId;
    }
    const resolvedId = resolveCompanyId(cleanCode, companyId && companyId > 1 ? companyId : 0);
    return (resolvedId - 1) * 20 + moduleId;
  },

  /**
   * Scopes local storage key to active company
   */
  getStorageKey(baseKey: string): string {
    if (activeCompanyCode === 'POLATLAR') {
      return baseKey;
    }
    return `${baseKey}_${activeCompanyCode}`;
  },

  /**
   * Fast Stale-While-Revalidate: Loads all locally cached data from IndexedDB/localStorage
   * in milliseconds so the UI can hydrate instantly without waiting for network requests.
   */
  async getCachedData(): Promise<{
    locations: LocationItem[] | null;
    standardTasks: string[] | null;
    notes: GeneralNote[] | null;
    returnWarranty: ReturnWarrantyItem[] | null;
    services: ServiceItem[] | null;
    workplaceLocation: WorkplaceLocation | null;
    branches: Branch[] | null;
    attendanceRecords: AttendanceRecord[] | null;
    adminReminders: AdminReminder[] | null;
    carilerData: CariData | null;
    leaveRequests: LeaveRequest[] | null;
    securityLogs: SecurityLogItem[] | null;
    timedFollowUps: TimedFollowUp[] | null;
  }> {
    const [
      locations,
      standardTasks,
      notes,
      returnWarranty,
      services,
      workplaceLocation,
      branches,
      attendanceRecords,
      adminReminders,
      carilerData,
      leaveRequests,
      securityLogs,
      timedFollowUps,
    ] = await Promise.all([
      loadItem<LocationItem[]>(this.getStorageKey(LOCATIONS_KEY)),
      loadItem<string[]>(this.getStorageKey(STANDARD_TASKS_KEY)),
      loadItem<GeneralNote[]>(this.getStorageKey(NOTES_KEY)),
      loadItem<ReturnWarrantyItem[]>(this.getStorageKey(RETURN_WARRANTY_KEY)),
      loadItem<ServiceItem[]>(this.getStorageKey(SERVICES_KEY)),
      loadItem<WorkplaceLocation>(this.getStorageKey(WORKPLACE_LOCATION_KEY)),
      loadItem<Branch[]>(this.getStorageKey(BRANCHES_KEY)),
      loadItem<AttendanceRecord[]>(this.getStorageKey(ATTENDANCE_RECORDS_KEY)),
      loadItem<AdminReminder[]>(this.getStorageKey(ADMIN_REMINDERS_KEY)),
      loadItem<CariData>(this.getStorageKey(CARILER_DATA_KEY)),
      loadItem<LeaveRequest[]>(this.getStorageKey(LEAVE_REQUESTS_KEY)),
      loadItem<SecurityLogItem[]>(this.getStorageKey(SECURITY_LOGS_KEY)),
      loadItem<TimedFollowUp[]>(this.getStorageKey(TIMED_FOLLOW_UPS_KEY)),
    ]);

    return {
      locations,
      standardTasks,
      notes,
      returnWarranty,
      services,
      workplaceLocation,
      branches,
      attendanceRecords,
      adminReminders,
      carilerData,
      leaveRequests,
      securityLogs,
      timedFollowUps,
    };
  },

  /**
   * Retrieves locations (Supabase cloud + local IndexedDB cache)
   */
  async getLocations(): Promise<LocationItem[]> {
    const localKey = this.getStorageKey(LOCATIONS_KEY);

    if (activeCompanyCode === 'POLATLAR') {
      const fallbackLocations = (await loadChunkedSlot<LocationItem[]>(11)).data || [];
      const fallbackMap = new Map(fallbackLocations.map((l) => [l.id, l]));

      // Primary POLATLAR table in Supabase
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const cloudLocations: LocationItem[] = data.map((row) => {
            const fb = fallbackMap.get(row.id);
            return {
              id: row.id,
              name: row.name,
              address: row.address || '',
              notes: row.notes || '',
              photos: Array.isArray(row.photos) ? row.photos : [],
              latitude: row.latitude || undefined,
              longitude: row.longitude || undefined,
              createdAt: Number(row.created_at) || Date.now(),
              createdBy: row.created_by || undefined,
              createdByName: row.created_by_name || undefined,
              tasks: Array.isArray(row.tasks) ? row.tasks : [],
              status: (row as any).status || fb?.status || 'pending',
              completedAt: (row as any).completed_at || fb?.completedAt,
              completedBy: (row as any).completed_by || fb?.completedBy,
              completedByName: (row as any).completed_by_name || fb?.completedByName,
              completionNote: (row as any).completion_note || fb?.completionNote,
              completionPhotos: Array.isArray((row as any).completion_photos)
                ? (row as any).completion_photos
                : fb?.completionPhotos || [],
              approvedAt: (row as any).approved_at || fb?.approvedAt,
              approvedBy: (row as any).approved_by || fb?.approvedBy,
              approvedByName: (row as any).approved_by_name || fb?.approvedByName,
              rejectedAt: (row as any).rejected_at || fb?.rejectedAt,
              rejectedBy: (row as any).rejected_by || fb?.rejectedBy,
              rejectedByName: (row as any).rejected_by_name || fb?.rejectedByName,
              rejectionReason: (row as any).rejection_reason || fb?.rejectionReason,
            };
          });

          await saveItem(localKey, cloudLocations);
          return cloudLocations;
        }
      } catch (e) {
        console.warn('Supabase locations fetch error:', e);
      }
      if (fallbackLocations.length > 0) {
        await saveItem(localKey, fallbackLocations);
        return fallbackLocations;
      }
      return (await loadItem<LocationItem[]>(localKey)) || [];
    }

    // Isolated chunked slot 11 for other companies
    const slotId = this.getSlotId(11);
    const { data: cloudData, notFound } = await loadChunkedSlot<LocationItem[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (notFound) {
      await saveItem(localKey, []);
      return [];
    }

    const localData = await loadItem<LocationItem[]>(localKey);
    return Array.isArray(localData) ? localData : [];
  },

  /**
   * Saves locations to local cache and syncs with Supabase
   */
  async saveLocations(locations: LocationItem[]): Promise<void> {
    const localKey = this.getStorageKey(LOCATIONS_KEY);
    await saveItem(localKey, locations);

    if (activeCompanyCode === 'POLATLAR') {
      try {
        const fullRows = locations.map((loc) => ({
          id: loc.id,
          name: loc.name,
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
          approved_at: loc.approvedAt || null,
          approved_by: loc.approvedBy || null,
          approved_by_name: loc.approvedByName || null,
          rejected_at: loc.rejectedAt || null,
          rejected_by: loc.rejectedBy || null,
          rejected_by_name: loc.rejectedByName || null,
          rejection_reason: loc.rejectionReason || null,
        }));

        if (fullRows.length > 0) {
          const { error: upsertErr } = await supabase.from('locations').upsert(fullRows);
          if (upsertErr) {
            // Fallback if columns do not exist in locations table
            const basicRows = locations.map((loc) => ({
              id: loc.id,
              name: loc.name,
              address: loc.address || '',
              notes: loc.notes || '',
              photos: loc.photos || [],
              latitude: loc.latitude || null,
              longitude: loc.longitude || null,
              created_at: loc.createdAt,
              created_by: loc.createdBy || null,
              created_by_name: loc.createdByName || null,
              tasks: loc.tasks || [],
            }));
            await supabase.from('locations').upsert(basicRows);
          }
          const currentIds = locations.map((l) => l.id);
          const { data: cloudData } = await supabase.from('locations').select('id');
          if (cloudData) {
            const idsToDelete = cloudData
              .map((c) => c.id)
              .filter((id) => !currentIds.includes(id));
            if (idsToDelete.length > 0) {
              await supabase.from('locations').delete().in('id', idsToDelete);
            }
          }
        } else {
          await supabase.from('locations').delete().neq('id', '___');
        }
      } catch (err) {
        console.warn('Supabase save locations error:', err);
      }
      await saveChunkedSlot(11, locations);
    } else {
      // Isolated chunked slot 11 for other companies
      await saveChunkedSlot(this.getSlotId(11), locations);
    }
  },

  /**
   * Retrieves standard tasks template
   */
  async getStandardTasks(): Promise<string[]> {
    const localKey = this.getStorageKey(STANDARD_TASKS_KEY);

    if (activeCompanyCode === 'POLATLAR') {
      const localData = await loadItem<string[]>(localKey);
      if (localData && Array.isArray(localData) && localData.length > 0) {
        return localData;
      }

      const { data: cloudData } = await loadChunkedSlot<string[]>(1);
      if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
        await saveItem(localKey, cloudData);
        return cloudData;
      }

      await saveItem(localKey, DEFAULT_STANDARD_TASKS);
      return DEFAULT_STANDARD_TASKS;
    }

    // Non-POLATLAR companies strictly isolated:
    const slotId = this.getSlotId(1);
    const { data: cloudData, notFound } = await loadChunkedSlot<string[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (notFound) {
      await saveItem(localKey, []);
      return [];
    }

    // Check if local cache has leaked DEFAULT_STANDARD_TASKS
    const localData = await loadItem<string[]>(localKey);
    if (localData && Array.isArray(localData)) {
      const isLeakedPolatlar =
        localData.length === DEFAULT_STANDARD_TASKS.length &&
        localData[0] === DEFAULT_STANDARD_TASKS[0];
      if (isLeakedPolatlar) {
        await saveItem(localKey, []);
        return [];
      }
      return localData;
    }

    await saveItem(localKey, []);
    return [];
  },

  /**
   * Saves standard tasks template
   */
  async saveStandardTasks(tasks: string[]): Promise<void> {
    const localKey = this.getStorageKey(STANDARD_TASKS_KEY);
    await saveItem(localKey, tasks);
    try {
      await supabase.from('standard_tasks').upsert({ id: this.getSlotId(1), tasks });
    } catch (err) {
      console.warn('Supabase save standard tasks error:', err);
    }
  },

  /**
   * Retrieves notes (Supabase cloud + local cache)
   */
  async getNotes(): Promise<GeneralNote[]> {
    const localKey = this.getStorageKey(NOTES_KEY);

    if (activeCompanyCode === 'POLATLAR') {
      // 1. Fetch fallback cloud sync slot (standard_tasks id: 4)
      let fallbackNotes: GeneralNote[] = [];
      const stFallback = await loadChunkedSlot<GeneralNote[]>(4);
      if (stFallback.data && Array.isArray(stFallback.data)) {
        fallbackNotes = stFallback.data;
      }

      // 2. Try fetching from Supabase native notes table
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const fallbackMap = new Map(fallbackNotes.map((n) => [n.id, n]));
          const mergedNotes: GeneralNote[] = data.map((row) => {
            const fb = fallbackMap.get(row.id);
            return {
              id: row.id,
              content: row.content,
              createdAt: Number(row.created_at) || Date.now(),
              createdBy: row.created_by || undefined,
              createdByName: row.created_by_name || undefined,
              targetMode: row.target_mode || 'self',
              targetUserIds: Array.isArray(row.target_user_ids) ? row.target_user_ids : [],
              targetUserNames: Array.isArray(row.target_user_names) ? row.target_user_names : [],
              targetUserId: row.target_user_id || undefined,
              targetUserName: row.target_user_name || undefined,
              reminderActive: Boolean(row.reminder_active),
              reminderDate: row.reminder_date || undefined,
              notified: Boolean(row.notified),
              cariName: fb?.cariName || (row as any).cari_name || undefined,
              photos: fb?.photos || (row as any).photos || [],
              completionPhotos: fb?.completionPhotos || (row as any).completion_photos || [],
              status: fb?.status || 'pending',
              completedAt: fb?.completedAt,
              completedBy: fb?.completedBy,
              completedByName: fb?.completedByName,
              completionNote: fb?.completionNote,
              approvedAt: fb?.approvedAt,
              approvedBy: fb?.approvedBy,
              approvedByName: fb?.approvedByName,
              rejectedAt: fb?.rejectedAt,
              rejectedBy: fb?.rejectedBy,
              rejectedByName: fb?.rejectedByName,
              rejectionReason: fb?.rejectionReason,
            };
          });

          await saveItem(localKey, mergedNotes);
          return mergedNotes;
        }
      } catch (e) {
        console.warn('Supabase notes fetch error:', e);
      }

      if (fallbackNotes.length > 0) {
        await saveItem(localKey, fallbackNotes);
        return fallbackNotes;
      }

      return (await loadItem<GeneralNote[]>(localKey)) || [];
    }

    // Isolated chunked slot 4 for other companies
    const slotId = this.getSlotId(4);
    const { data: cloudData, notFound } = await loadChunkedSlot<GeneralNote[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (notFound) {
      await saveItem(localKey, []);
      return [];
    }

    const localData = await loadItem<GeneralNote[]>(localKey);
    if (Array.isArray(localData)) {
      const sanitized = localData.filter(
        (n) => n.createdByName !== 'Murat POLAT' && n.createdByName !== 'Azizcan ISIYEL'
      );
      if (sanitized.length !== localData.length) {
        await saveItem(localKey, sanitized);
      }
      return sanitized;
    }

    await saveItem(localKey, []);
    return [];
  },

  /**
   * Saves notes to local cache and syncs with Supabase
   */
  async saveNotes(notes: GeneralNote[]): Promise<void> {
    const localKey = this.getStorageKey(NOTES_KEY);
    await saveItem(localKey, notes);

    if (activeCompanyCode === 'POLATLAR') {
      try {
        const fullRows = notes.map((n) => ({
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
          reminder_active: n.reminderActive,
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

        if (fullRows.length > 0) {
          const { error: upsertErr } = await supabase.from('notes').upsert(fullRows);
          if (upsertErr) {
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
              reminder_active: n.reminderActive,
              reminder_date: n.reminderDate || null,
              notified: n.notified || false,
            }));
            await supabase.from('notes').upsert(basicRows);
          }

          const currentIds = notes.map((n) => n.id);
          if (currentIds.length > 0) {
            const { data: cloudData } = await supabase.from('notes').select('id');
            if (cloudData) {
              const idsToDelete = cloudData
                .map((c) => c.id)
                .filter((id) => !currentIds.includes(id));
              if (idsToDelete.length > 0) {
                await supabase.from('notes').delete().in('id', idsToDelete);
              }
            }
          } else {
            await supabase.from('notes').delete().neq('id', '___');
          }
        }
      } catch (err) {
        console.warn('Supabase save notes error:', err);
      }
      await saveChunkedSlot(4, notes);
    } else {
      await saveChunkedSlot(this.getSlotId(4), notes);
    }
  },

  mapNoteToRow(n: GeneralNote) {
    return {
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
      reminder_active: n.reminderActive,
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
    };
  },

  /**
   * Atomically saves a single note to local cache and Supabase without overwriting other notes
   */
  async saveSingleNote(note: GeneralNote): Promise<void> {
    const localKey = this.getStorageKey(NOTES_KEY);
    const existing = (await loadItem<GeneralNote[]>(localKey)) || [];
    const idx = existing.findIndex((n) => n.id === note.id);
    let updated: GeneralNote[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = note;
    } else {
      updated = [note, ...existing];
    }
    await saveItem(localKey, updated);

    if (activeCompanyCode === 'POLATLAR') {
      try {
        const row = this.mapNoteToRow(note);
        await supabase.from('notes').upsert([row]);
      } catch (err) {
        console.warn('saveSingleNote Supabase error:', err);
      }
      saveChunkedSlot(4, updated).catch(() => {});
    } else {
      saveChunkedSlot(this.getSlotId(4), updated).catch(() => {});
    }
  },

  /**
   * Atomically saves multiple notes to local cache and Supabase in a single batch
   */
  async saveMultipleNotes(notesToSave: GeneralNote[]): Promise<void> {
    if (!notesToSave || notesToSave.length === 0) return;
    const localKey = this.getStorageKey(NOTES_KEY);
    const existing = (await loadItem<GeneralNote[]>(localKey)) || [];
    const saveMap = new Map(notesToSave.map((n) => [n.id, n]));
    const updated = existing.map((n) => saveMap.get(n.id) || n);
    for (const n of notesToSave) {
      if (!existing.some((e) => e.id === n.id)) {
        updated.unshift(n);
      }
    }
    await saveItem(localKey, updated);

    if (activeCompanyCode === 'POLATLAR') {
      try {
        const rows = notesToSave.map((n) => this.mapNoteToRow(n));
        await supabase.from('notes').upsert(rows);
      } catch (err) {
        console.warn('saveMultipleNotes Supabase error:', err);
      }
      saveChunkedSlot(4, updated).catch(() => {});
    } else {
      saveChunkedSlot(this.getSlotId(4), updated).catch(() => {});
    }
  },

  /**
   * Retrieves return & warranty items (Supabase cloud + local cache + standard_tasks slot 2)
   */
  async getReturnWarrantyItems(): Promise<ReturnWarrantyItem[]> {
    const localKey = this.getStorageKey(RETURN_WARRANTY_KEY);

    if (activeCompanyCode === 'POLATLAR') {
      let fallbackItems: ReturnWarrantyItem[] = [];
      const stFallback = await loadChunkedSlot<ReturnWarrantyItem[]>(2);
      if (stFallback.data && Array.isArray(stFallback.data)) {
        fallbackItems = stFallback.data;
      }

      try {
        const { data, error } = await supabase
          .from('return_warranty')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const fallbackMap = new Map(fallbackItems.map((i) => [i.id, i]));
          const cloudItems: ReturnWarrantyItem[] = data.map((row) => {
            const fb = fallbackMap.get(row.id);
            return {
              id: row.id,
              type: row.type as any,
              companyName: row.company_name,
              cariName: fb?.cariName || (row as any).cari_name || undefined,
              sentDate: row.sent_date,
              serialNumber: row.serial_number || undefined,
              trackingCode: row.tracking_code || undefined,
              serialNumberPhoto: row.serial_number_photo || undefined,
              trackingCodePhoto: row.tracking_code_photo || undefined,
              notes: row.notes || undefined,
              status: row.status as any,
              reminderDate: row.reminder_date || undefined,
              reminderActive: Boolean(row.reminder_active),
              notified: Boolean(row.notified),
              createdAt: Number(row.created_at) || Date.now(),
              createdBy: row.created_by || undefined,
              createdByName: row.created_by_name || undefined,
              followUpNote: (row as any).follow_up_note || fb?.followUpNote || undefined,
              followUpDate: (row as any).follow_up_date || fb?.followUpDate || undefined,
              followUpByName: (row as any).follow_up_by_name || fb?.followUpByName || undefined,
            };
          });

          await saveItem(localKey, cloudItems);
          return cloudItems;
        }
      } catch {
        // ignore
      }

      if (fallbackItems.length > 0) {
        await saveItem(localKey, fallbackItems);
        return fallbackItems;
      }

      return (await loadItem<ReturnWarrantyItem[]>(localKey)) || [];
    }

    // Isolated slot 2 for other companies
    const slotId = this.getSlotId(2);
    const { data: cloudData, notFound } = await loadChunkedSlot<ReturnWarrantyItem[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (notFound) {
      await saveItem(localKey, []);
      return [];
    }

    const localData = await loadItem<ReturnWarrantyItem[]>(localKey);
    return Array.isArray(localData) ? localData : [];
  },

  /**
   * Saves return & warranty items to local cache and syncs with Supabase
   */
  async saveReturnWarrantyItems(items: ReturnWarrantyItem[]): Promise<void> {
    const localKey = this.getStorageKey(RETURN_WARRANTY_KEY);
    await saveItem(localKey, items);

    if (activeCompanyCode === 'POLATLAR') {
      try {
        const fullRows = items.map((item) => ({
          id: item.id,
          type: item.type,
          company_name: item.companyName,
          cari_name: item.cariName || null,
          sent_date: item.sentDate,
          serial_number: item.serialNumber || null,
          tracking_code: item.trackingCode || null,
          serial_number_photo: item.serialNumberPhoto || null,
          tracking_code_photo: item.trackingCodePhoto || null,
          notes: item.notes || null,
          status: item.status,
          reminder_date: item.reminderDate || null,
          reminder_active: item.reminderActive,
          notified: item.notified || false,
          created_at: item.createdAt,
          created_by: item.createdBy || null,
          created_by_name: item.createdByName || null,
          follow_up_note: item.followUpNote || null,
          follow_up_date: item.followUpDate || null,
          follow_up_by_name: item.followUpByName || null,
        }));

        if (fullRows.length > 0) {
          const { error: upsertErr } = await supabase.from('return_warranty').upsert(fullRows);
          if (upsertErr) {
            // Fallback in case cari_name column hasn't been added to SQL yet
            const basicRows = items.map((item) => ({
              id: item.id,
              type: item.type,
              company_name: item.companyName,
              sent_date: item.sentDate,
              serial_number: item.serialNumber || null,
              tracking_code: item.trackingCode || null,
              serial_number_photo: item.serialNumberPhoto || null,
              tracking_code_photo: item.trackingCodePhoto || null,
              notes: item.notes || null,
              status: item.status,
              reminder_date: item.reminderDate || null,
              reminder_active: item.reminderActive,
              notified: item.notified || false,
              created_at: item.createdAt,
              created_by: item.createdBy || null,
              created_by_name: item.createdByName || null,
            }));
            await supabase.from('return_warranty').upsert(basicRows);
          }

          const currentIds = items.map((i) => i.id);
          const { data: cloudData } = await supabase.from('return_warranty').select('id');
          if (cloudData) {
            const idsToDelete = cloudData
              .map((c) => c.id)
              .filter((id) => !currentIds.includes(id));
            if (idsToDelete.length > 0) {
              await supabase.from('return_warranty').delete().in('id', idsToDelete);
            }
          }
        } else {
          await supabase.from('return_warranty').delete().neq('id', '___');
        }
      } catch (err) {
        console.warn('Native return_warranty table sync skipped:', err);
      }
      await saveChunkedSlot(2, items);
    } else {
      await saveChunkedSlot(this.getSlotId(2), items);
    }
  },

  /**
   * Retrieves services (Supabase cloud + local cache)
   */
  async getServices(): Promise<ServiceItem[]> {
    const localKey = this.getStorageKey(SERVICES_KEY);

    if (activeCompanyCode === 'POLATLAR') {
      const fallbackServices = (await loadChunkedSlot<ServiceItem[]>(3)).data || [];
      const fallbackMap = new Map(fallbackServices.map((s) => [s.id, s]));

      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const cloudServices: ServiceItem[] = data.map((row) => {
            const fb = fallbackMap.get(row.id);
            return {
              id: row.id,
              companyName: row.company_name,
              location: row.location || undefined,
              latitude: row.latitude != null ? Number(row.latitude) : undefined,
              longitude: row.longitude != null ? Number(row.longitude) : undefined,
              workDone: row.work_done,
              date: row.date || undefined,
              createdAt: Number(row.created_at) || Date.now(),
              createdBy: row.created_by || undefined,
              createdByName: row.created_by_name || undefined,
              status: (row as any).status || fb?.status || 'pending',
              completedAt: (row as any).completed_at || fb?.completedAt,
              completedBy: (row as any).completed_by || fb?.completedBy,
              completedByName: (row as any).completed_by_name || fb?.completedByName,
              completionNote: (row as any).completion_note || fb?.completionNote,
              completionPhotos: Array.isArray((row as any).completion_photos)
                ? (row as any).completion_photos
                : fb?.completionPhotos || [],
              approvedAt: (row as any).approved_at || fb?.approvedAt,
              approvedBy: (row as any).approved_by || fb?.approvedBy,
              approvedByName: (row as any).approved_by_name || fb?.approvedByName,
              rejectedAt: (row as any).rejected_at || fb?.rejectedAt,
              rejectedBy: (row as any).rejected_by || fb?.rejectedBy,
              rejectedByName: (row as any).rejected_by_name || fb?.rejectedByName,
              rejectionReason: (row as any).rejection_reason || fb?.rejectionReason,
            };
          });

          await saveItem(localKey, cloudServices);
          return cloudServices;
        }
      } catch {
        // ignore
      }

      if (fallbackServices.length > 0) {
        await saveItem(localKey, fallbackServices);
        return fallbackServices;
      }

      return (await loadItem<ServiceItem[]>(localKey)) || [];
    }

    // Isolated slot 3 for other companies
    const slotId = this.getSlotId(3);
    const { data: cloudData, notFound } = await loadChunkedSlot<ServiceItem[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (notFound) {
      await saveItem(localKey, []);
      return [];
    }

    const localData = await loadItem<ServiceItem[]>(localKey);
    return Array.isArray(localData) ? localData : [];
  },

  /**
   * Saves services to local cache and syncs with Supabase
   */
  async saveServices(items: ServiceItem[]): Promise<void> {
    const localKey = this.getStorageKey(SERVICES_KEY);
    await saveItem(localKey, items);

    if (activeCompanyCode === 'POLATLAR') {
      try {
        const fullRows = items.map((item) => ({
          id: item.id,
          company_name: item.companyName,
          location: item.location || null,
          latitude: item.latitude || null,
          longitude: item.longitude || null,
          work_done: item.workDone,
          date: item.date || null,
          created_at: item.createdAt,
          created_by: item.createdBy || null,
          created_by_name: item.createdByName || null,
          status: item.status || 'pending',
          completed_at: item.completedAt || null,
          completed_by: item.completedBy || null,
          completed_by_name: item.completedByName || null,
          completion_note: item.completionNote || null,
          completion_photos: item.completionPhotos || [],
          approved_at: item.approvedAt || null,
          approved_by: item.approvedBy || null,
          approved_by_name: item.approvedByName || null,
          rejected_at: item.rejectedAt || null,
          rejected_by: item.rejectedBy || null,
          rejected_by_name: item.rejectedByName || null,
          rejection_reason: item.rejectionReason || null,
        }));

        if (fullRows.length > 0) {
          const { error: upsertErr } = await supabase.from('services').upsert(fullRows);
          if (upsertErr) {
            // Fallback if columns do not exist in services table
            const basicRows = items.map((item) => ({
              id: item.id,
              company_name: item.companyName,
              location: item.location || null,
              latitude: item.latitude || null,
              longitude: item.longitude || null,
              work_done: item.workDone,
              date: item.date || null,
              created_at: item.createdAt,
              created_by: item.createdBy || null,
              created_by_name: item.createdByName || null,
            }));
            await supabase.from('services').upsert(basicRows);
          }
          const currentIds = items.map((i) => i.id);
          const { data: cloudData } = await supabase.from('services').select('id');
          if (cloudData) {
            const idsToDelete = cloudData
              .map((c) => c.id)
              .filter((id) => !currentIds.includes(id));
            if (idsToDelete.length > 0) {
              await supabase.from('services').delete().in('id', idsToDelete);
            }
          }
        } else {
          await supabase.from('services').delete().neq('id', '___');
        }
      } catch (err) {
        console.warn('Native services table sync skipped:', err);
      }
      await saveChunkedSlot(3, items);
    } else {
      await saveChunkedSlot(this.getSlotId(3), items);
    }
  },

  /**
   * Retrieves workplace location
   */
  async getWorkplaceLocation(): Promise<WorkplaceLocation | null> {
    const localKey = this.getStorageKey(WORKPLACE_LOCATION_KEY);
    const slotId = this.getSlotId(5);
    const { data: cloudData, notFound } = await loadChunkedSlot<WorkplaceLocation>(slotId);
    if (cloudData && typeof cloudData.latitude === 'number' && typeof cloudData.longitude === 'number') {
      if (!cloudData.radiusMeters || cloudData.radiusMeters === 10) {
        cloudData.radiusMeters = 20;
      }
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (activeCompanyCode !== 'POLATLAR' && notFound) {
      await saveItem(localKey, null);
      return null;
    }

    const localData = await loadItem<WorkplaceLocation>(localKey);
    if (localData && (!localData.radiusMeters || localData.radiusMeters === 10)) {
      localData.radiusMeters = 20;
    }
    return localData;
  },

  /**
   * Saves workplace location
   */
  async saveWorkplaceLocation(location: WorkplaceLocation): Promise<void> {
    const localKey = this.getStorageKey(WORKPLACE_LOCATION_KEY);
    await saveItem(localKey, location);
    await saveChunkedSlot(this.getSlotId(5), location);
  },

  /**
   * Retrieves attendance records
   */
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    const localKey = this.getStorageKey(ATTENDANCE_RECORDS_KEY);
    const slotId = this.getSlotId(6);
    const { data: cloudData, notFound } = await loadChunkedSlot<AttendanceRecord[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (activeCompanyCode !== 'POLATLAR') {
      if (notFound) {
        await saveItem(localKey, []);
        return [];
      }
      const localData = await loadItem<AttendanceRecord[]>(localKey);
      if (Array.isArray(localData)) {
        const sanitized = localData.filter(
          (r) => r.userName !== 'Murat POLAT' && r.userName !== 'Azizcan ISIYEL'
        );
        if (sanitized.length !== localData.length) {
          await saveItem(localKey, sanitized);
        }
        return sanitized;
      }
      return [];
    }

    return (await loadItem<AttendanceRecord[]>(localKey)) || [];
  },

  /**
   * Saves attendance records
   */
  async saveAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
    const localKey = this.getStorageKey(ATTENDANCE_RECORDS_KEY);
    await saveItem(localKey, records);
    await saveChunkedSlot(this.getSlotId(6), records);
  },

  /**
   * Retrieves admin reminders
   */
  async getAdminReminders(): Promise<AdminReminder[]> {
    const localKey = this.getStorageKey(ADMIN_REMINDERS_KEY);
    const slotId = this.getSlotId(7);
    const { data: cloudData, notFound } = await loadChunkedSlot<AdminReminder[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (activeCompanyCode !== 'POLATLAR' && notFound) {
      await saveItem(localKey, []);
      return [];
    }

    return (await loadItem<AdminReminder[]>(localKey)) || [];
  },

  /**
   * Saves admin reminders
   */
  async saveAdminReminders(reminders: AdminReminder[]): Promise<void> {
    const localKey = this.getStorageKey(ADMIN_REMINDERS_KEY);
    await saveItem(localKey, reminders);
    await saveChunkedSlot(this.getSlotId(7), reminders);
  },

  /**
   * Retrieves leave requests
   */
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    const localKey = this.getStorageKey(LEAVE_REQUESTS_KEY);
    const slotId = this.getSlotId(10);
    const { data: cloudData, notFound } = await loadChunkedSlot<LeaveRequest[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (activeCompanyCode !== 'POLATLAR' && notFound) {
      await saveItem(localKey, []);
      return [];
    }

    return (await loadItem<LeaveRequest[]>(localKey)) || [];
  },

  /**
   * Saves leave requests
   */
  async saveLeaveRequests(requests: LeaveRequest[]): Promise<void> {
    const localKey = this.getStorageKey(LEAVE_REQUESTS_KEY);
    await saveItem(localKey, requests);
    await saveChunkedSlot(this.getSlotId(10), requests);
  },

  /**
   * Retrieves security log records (unauthorized device attempts)
   */
  async getSecurityLogs(): Promise<SecurityLogItem[]> {
    const localKey = this.getStorageKey(SECURITY_LOGS_KEY);
    const slotId = this.getSlotId(12);
    const { data: cloudData, notFound } = await loadChunkedSlot<SecurityLogItem[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (activeCompanyCode !== 'POLATLAR' && notFound) {
      await saveItem(localKey, []);
      return [];
    }

    return (await loadItem<SecurityLogItem[]>(localKey)) || [];
  },

  /**
   * Saves security log records
   */
  async saveSecurityLogs(logs: SecurityLogItem[]): Promise<void> {
    const localKey = this.getStorageKey(SECURITY_LOGS_KEY);
    await saveItem(localKey, logs);
    await saveChunkedSlot(this.getSlotId(12), logs);
  },

  /**
   * Appends a new security incident log to the company's security logs
   */
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
    const updated = [newLog, ...logs].slice(0, 200); // keep last 200 logs
    await this.saveSecurityLogs(updated);
    return newLog;
  },

  /**
   * Retrieves security logs specifically for a given company (for super admins)
   */
  async getSecurityLogsForCompany(companyCode: string, companyId?: number): Promise<SecurityLogItem[]> {
    const slotId = this.getSlotIdForCompany(12, companyCode, companyId);
    const { data: cloudData } = await loadChunkedSlot<SecurityLogItem[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      return cloudData;
    }
    return [];
  },

  /**
   * Retrieves branches for current company (cloud standard_tasks slot 14 + IndexedDB cache)
   */
  async getBranches(): Promise<Branch[]> {
    const localKey = this.getStorageKey(BRANCHES_KEY);
    const slotId = this.getSlotId(14);
    const { data: cloudData, notFound } = await loadChunkedSlot<Branch[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (activeCompanyCode !== 'POLATLAR' && notFound) {
      await saveItem(localKey, []);
      return [];
    }

    return (await loadItem<Branch[]>(localKey)) || [];
  },

  /**
   * Saves branches to cloud slot 14 and local cache
   */
  async saveBranches(branches: Branch[]): Promise<void> {
    const localKey = this.getStorageKey(BRANCHES_KEY);
    await saveItem(localKey, branches);
    await saveChunkedSlot(this.getSlotId(14), branches);
  },

  /**
   * Retrieves branches for a specific company (cloud slot 14)
   */
  async getBranchesForCompany(companyCode: string, companyId?: number): Promise<Branch[]> {
    const cleanCode = (companyCode || 'POLATLAR').trim().toUpperCase();
    const localKey = cleanCode === 'POLATLAR' ? BRANCHES_KEY : `${BRANCHES_KEY}_${cleanCode}`;
    const slotId = this.getSlotIdForCompany(14, cleanCode, companyId);
    const { data: cloudData, notFound } = await loadChunkedSlot<Branch[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }
    if (cleanCode !== 'POLATLAR' && notFound) {
      await saveItem(localKey, []);
      return [];
    }
    return (await loadItem<Branch[]>(localKey)) || [];
  },

  /**
   * Saves branches for a specific company (cloud slot 14)
   */
  async saveBranchesForCompany(companyCode: string, branches: Branch[], companyId?: number): Promise<void> {
    const cleanCode = (companyCode || 'POLATLAR').trim().toUpperCase();
    const localKey = cleanCode === 'POLATLAR' ? BRANCHES_KEY : `${BRANCHES_KEY}_${cleanCode}`;
    const slotId = this.getSlotIdForCompany(14, cleanCode, companyId);
    await saveItem(localKey, branches);
    await saveChunkedSlot(slotId, branches);
  },

  /**
   * Appends a new security log event directly to cloud slot 12 and local cache
   */
  async logSecurityEvent(
    event: Omit<SecurityLogItem, 'id' | 'timestamp' | 'companyCode' | 'read'> & {
      companyCode?: string;
    }
  ): Promise<SecurityLogItem> {
    const compCode = (event.companyCode || activeCompanyCode || 'POLATLAR').trim().toUpperCase();
    const newLog: SecurityLogItem = {
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      companyCode: compCode,
      timestamp: Date.now(),
      attemptedUsername: event.attemptedUsername,
      attemptedName: event.attemptedName,
      attemptedUserId: event.attemptedUserId,
      boundUserId: event.boundUserId,
      boundUserName: event.boundUserName,
      deviceId: event.deviceId,
      deviceName: event.deviceName,
      platform: event.platform,
      message: event.message,
      status: event.status || 'warning',
      read: false,
    };

    try {
      const currentLogs = await this.getSecurityLogs();
      const updated = [newLog, ...currentLogs.slice(0, 199)]; // Keep latest 200 logs
      await this.saveSecurityLogs(updated);
    } catch (e) {
      console.warn('Güvenlik logu kaydedilemedi:', e);
    }

    return newLog;
  },

  /**
   * Retrieves Cari list data (Supabase cloud slot 15 + local IndexedDB cache)
   */
  async getCarilerData(): Promise<CariData> {
    const localKey = this.getStorageKey(CARILER_DATA_KEY);
    const slotId = this.getSlotId(15);

    // 1. Check local cache (IndexedDB) FIRST for instant UI response (0ms wait)
    const cached = await loadItem<CariData>(localKey);
    if (cached && Array.isArray(cached.cariler) && cached.cariler.length > 0) {
      // Non-blocking background sync from cloud slot 15
      loadChunkedSlot<CariData>(slotId)
        .then(({ data: cloudData }) => {
          if (cloudData && Array.isArray(cloudData.cariler) && cloudData.cariler.length > 0) {
            if (!cached.updatedAt || (cloudData.updatedAt && new Date(cloudData.updatedAt) > new Date(cached.updatedAt))) {
              saveItem(localKey, cloudData);
            }
          }
        })
        .catch(() => {});
      return cached;
    }

    // 2. If no cache, load from cloud slot 15
    try {
      const { data: cloudData, notFound } = await loadChunkedSlot<CariData>(slotId);
      if (cloudData && Array.isArray(cloudData.cariler) && cloudData.cariler.length > 0) {
        await saveItem(localKey, cloudData);
        return cloudData;
      }
      if (activeCompanyCode !== 'POLATLAR' && notFound) {
        const emptyCari: CariData = {
          updatedAt: null,
          database: `${activeCompanyCode} Cariler`,
          total: 0,
          cariler: [],
        };
        await saveItem(localKey, emptyCari);
        return emptyCari;
      }
    } catch (e) {
      console.warn('Cloud cariler load error, checking fallback:', e);
    }

    // 3. Fallback for POLATLAR (defaultCarilerData / cariler.json)
    const fallback: CariData = {
      updatedAt: (defaultCarilerData as any).updatedAt || new Date().toISOString(),
      database: 'POLATLAR2025',
      total: (defaultCarilerData as any).total || ((defaultCarilerData as any).cariler || []).length,
      cariler: (defaultCarilerData as any).cariler || [],
    };

    if (activeCompanyCode === 'POLATLAR') {
      await saveItem(localKey, fallback);
      return fallback;
    }

    const emptyCari: CariData = {
      updatedAt: null,
      database: `${activeCompanyCode} Cariler`,
      total: 0,
      cariler: [],
    };
    await saveItem(localKey, emptyCari);
    return emptyCari;
  },

  /**
   * Saves updated Cari data to local cache and cloud slot 15
   */
  async saveCarilerData(data: CariData): Promise<void> {
    const localKey = this.getStorageKey(CARILER_DATA_KEY);
    await saveItem(localKey, data);
    await saveChunkedSlot(this.getSlotId(15), data);
  },

  /**
   * Parses an uploaded Excel (.xlsx) file and extracts Cari names, saving to cloud slot 15
   */
  async importCarilerFromExcel(file: File): Promise<CariData> {
    const arrayBuffer = await file.arrayBuffer();
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

    const localKey = this.getStorageKey(CARILER_DATA_KEY);
    await saveItem(localKey, result);
    await saveChunkedSlot(this.getSlotId(15), result);
    return result;
  },

  /**
   * Exports the list of Cariler to an Excel (.xlsx) file download
   */
  exportCarilerToExcel(cariler: string[], fileName = 'Cariler.xlsx'): void {
    const data = [['Cari Adı'], ...cariler.map((c) => [c])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 45 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cariler');
    XLSX.writeFile(wb, fileName);
  },

  /**
   * Retrieves timed follow ups for current company (cloud slot 16 + IndexedDB cache)
   */
  async getTimedFollowUps(): Promise<TimedFollowUp[]> {
    const localKey = this.getStorageKey(TIMED_FOLLOW_UPS_KEY);
    const slotId = this.getSlotId(16);
    const { data: cloudData, notFound } = await loadChunkedSlot<TimedFollowUp[]>(slotId);
    if (cloudData && Array.isArray(cloudData)) {
      await saveItem(localKey, cloudData);
      return cloudData;
    }

    if (activeCompanyCode !== 'POLATLAR' && notFound) {
      await saveItem(localKey, []);
      return [];
    }

    return (await loadItem<TimedFollowUp[]>(localKey)) || [];
  },

  /**
   * Saves timed follow ups to cloud slot 16 and local cache
   */
  async saveTimedFollowUps(items: TimedFollowUp[]): Promise<void> {
    const localKey = this.getStorageKey(TIMED_FOLLOW_UPS_KEY);
    await saveItem(localKey, items);
    await saveChunkedSlot(this.getSlotId(16), items);
  },

  async exportBackup(): Promise<string> {
    const locations = await this.getLocations();
    const standardTasks = await this.getStandardTasks();
    const notes = await this.getNotes();
    const returnWarrantyItems = await this.getReturnWarrantyItems();
    const services = await this.getServices();
    const workplaceLocation = (await this.getWorkplaceLocation()) || undefined;
    const branches = await this.getBranches();
    const attendanceRecords = await this.getAttendanceRecords();
    const adminReminders = await this.getAdminReminders();
    const leaveRequests = await this.getLeaveRequests();
    const securityLogs = await this.getSecurityLogs();
    const cariData = await this.getCarilerData();
    const timedFollowUps = await this.getTimedFollowUps();
    const backup: BackupData = {
      locations,
      standardTasks,
      notes,
      returnWarrantyItems,
      services,
      workplaceLocation,
      branches,
      attendanceRecords,
      adminReminders,
      leaveRequests,
      securityLogs,
      cariler: cariData.cariler,
      timedFollowUps,
    };
    return JSON.stringify(backup, null, 2);
  },

  async importBackup(backupData: BackupData): Promise<void> {
    if (backupData.locations && Array.isArray(backupData.locations)) {
      await this.saveLocations(backupData.locations);
    }
    if (backupData.standardTasks && Array.isArray(backupData.standardTasks)) {
      await this.saveStandardTasks(backupData.standardTasks);
    }
    if (backupData.notes && Array.isArray(backupData.notes)) {
      await this.saveNotes(backupData.notes);
    }
    if (backupData.returnWarrantyItems && Array.isArray(backupData.returnWarrantyItems)) {
      await this.saveReturnWarrantyItems(backupData.returnWarrantyItems);
    }
    if (backupData.services && Array.isArray(backupData.services)) {
      await this.saveServices(backupData.services);
    }
    if (backupData.workplaceLocation) {
      await this.saveWorkplaceLocation(backupData.workplaceLocation);
    }
    if (backupData.branches && Array.isArray(backupData.branches)) {
      await this.saveBranches(backupData.branches);
    }
    if (backupData.attendanceRecords && Array.isArray(backupData.attendanceRecords)) {
      await this.saveAttendanceRecords(backupData.attendanceRecords);
    }
    if (backupData.adminReminders && Array.isArray(backupData.adminReminders)) {
      await this.saveAdminReminders(backupData.adminReminders);
    }
    if (backupData.leaveRequests && Array.isArray(backupData.leaveRequests)) {
      await this.saveLeaveRequests(backupData.leaveRequests);
    }
    if (backupData.securityLogs && Array.isArray(backupData.securityLogs)) {
      await this.saveSecurityLogs(backupData.securityLogs);
    }
    if (backupData.cariler && Array.isArray(backupData.cariler)) {
      await this.saveCarilerData({
        updatedAt: new Date().toISOString(),
        database: 'Yedekten Geri Yükleme',
        total: backupData.cariler.length,
        cariler: backupData.cariler,
      });
    }
    if (backupData.timedFollowUps && Array.isArray(backupData.timedFollowUps)) {
      await this.saveTimedFollowUps(backupData.timedFollowUps);
    }
  },
};
