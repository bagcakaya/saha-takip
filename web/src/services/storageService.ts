import { get, set } from 'idb-keyval';
import { LocationItem, GeneralNote, BackupData, ReturnWarrantyItem, ReturnWarrantyType, ServiceItem, WorkplaceLocation, AttendanceRecord, AdminReminder, CariData, LeaveRequest } from '../types/storage';
import { DEFAULT_STANDARD_TASKS } from '../constants/defaultTasks';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import defaultCarilerData from '../data/cariler.json';

const LOCATIONS_KEY = '@gorev_tamamlama_locations';
const STANDARD_TASKS_KEY = '@gorev_tamamlama_standard_tasks';
const NOTES_KEY = '@gorev_tamamlama_general_notes';
const RETURN_WARRANTY_KEY = '@gorev_tamamlama_return_warranty';
const SERVICES_KEY = '@gorev_tamamlama_services';
const WORKPLACE_LOCATION_KEY = '@saha_takip_workplace_location';
const ATTENDANCE_RECORDS_KEY = '@saha_takip_attendance_records';
const ADMIN_REMINDERS_KEY = '@saha_takip_admin_reminders';
const CARILER_DATA_KEY = '@saha_takip_cariler_data';
const LEAVE_REQUESTS_KEY = '@saha_takip_leave_requests';

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

export const StorageService = {
  /**
   * Retrieves locations (Supabase cloud + local IndexedDB cache)
   */
  async getLocations(): Promise<LocationItem[]> {
    const localData = (await loadItem<LocationItem[]>(LOCATIONS_KEY)) || [];

    // Try fetching latest from Supabase
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const cloudLocations: LocationItem[] = data.map((row) => ({
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
        }));

        await saveItem(LOCATIONS_KEY, cloudLocations);
        return cloudLocations;
      }
    } catch (e) {
      console.warn('Supabase locations fetch error:', e);
    }

    return localData;
  },

  /**
   * Saves locations to local cache and syncs with Supabase
   */
  async saveLocations(locations: LocationItem[]): Promise<void> {
    await saveItem(LOCATIONS_KEY, locations);

    // Sync to Supabase
    try {
      const rows = locations.map((loc) => ({
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

      if (rows.length > 0) {
        await supabase.from('locations').upsert(rows);
      }

      // Clean up deleted items from Supabase
      const currentIds = locations.map((l) => l.id);
      if (currentIds.length > 0) {
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
  },

  /**
   * Retrieves standard tasks template
   */
  async getStandardTasks(): Promise<string[]> {
    const localData = await loadItem<string[]>(STANDARD_TASKS_KEY);
    if (localData && Array.isArray(localData) && localData.length > 0) {
      return localData;
    }

    // Try cloud
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 1)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        await saveItem(STANDARD_TASKS_KEY, data.tasks);
        return data.tasks;
      }
    } catch {
      // ignore
    }

    await saveItem(STANDARD_TASKS_KEY, DEFAULT_STANDARD_TASKS);
    return DEFAULT_STANDARD_TASKS;
  },

  /**
   * Saves standard tasks template
   */
  async saveStandardTasks(tasks: string[]): Promise<void> {
    await saveItem(STANDARD_TASKS_KEY, tasks);
    try {
      await supabase.from('standard_tasks').upsert({ id: 1, tasks });
    } catch (err) {
      console.warn('Supabase save standard tasks error:', err);
    }
  },

  /**
   * Retrieves notes (Supabase cloud + local cache)
   */
  async getNotes(): Promise<GeneralNote[]> {
    const localData = (await loadItem<GeneralNote[]>(NOTES_KEY)) || [];

    // 1. Fetch fallback cloud sync slot (standard_tasks id: 4) where workflow fields are mirrored
    let fallbackNotes: GeneralNote[] = [];
    try {
      const { data: stData, error: stError } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 4)
        .single();

      if (!stError && stData?.tasks && Array.isArray(stData.tasks) && stData.tasks.length > 0) {
        const rawJson = stData.tasks.join('');
        const parsed: GeneralNote[] = JSON.parse(rawJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fallbackNotes = parsed;
        }
      }
    } catch {
      // ignore
    }

    // 2. Try fetching from Supabase native notes table
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        // Check if native notes table actually has the status column migrated
        const hasNativeStatus = 'status' in data[0] && data[0].status !== undefined;

        if (hasNativeStatus) {
          const cloudNotes: GeneralNote[] = data.map((row) => ({
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
            cariName: (row as any).cari_name || (fallbackNotes.find((f) => f.id === row.id)?.cariName) || undefined,
            photos: (row as any).photos || (fallbackNotes.find((f) => f.id === row.id)?.photos) || [],
            completionPhotos: (row as any).completion_photos || (fallbackNotes.find((f) => f.id === row.id)?.completionPhotos) || [],
            status: (row.status as any) || 'pending',
            completedAt: row.completed_at ? Number(row.completed_at) : undefined,
            completedBy: row.completed_by || undefined,
            completedByName: row.completed_by_name || undefined,
            completionNote: row.completion_note || undefined,
            approvedAt: row.approved_at ? Number(row.approved_at) : undefined,
            approvedBy: row.approved_by || undefined,
            approvedByName: row.approved_by_name || undefined,
            rejectedAt: row.rejected_at ? Number(row.rejected_at) : undefined,
            rejectedBy: row.rejected_by || undefined,
            rejectedByName: row.rejected_by_name || undefined,
            rejectionReason: row.rejection_reason || undefined,
          }));

          await saveItem(NOTES_KEY, cloudNotes);
          return cloudNotes;
        } else {
          // Native table columns not yet migrated! Merge with fallback mirror (which has status & completion notes)
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

          await saveItem(NOTES_KEY, mergedNotes);
          return mergedNotes;
        }
      }
    } catch (e) {
      console.warn('Supabase notes fetch error:', e);
    }

    if (fallbackNotes.length > 0) {
      await saveItem(NOTES_KEY, fallbackNotes);
      return fallbackNotes;
    }

    return localData;
  },

  /**
   * Saves notes to local cache and syncs with Supabase
   */
  async saveNotes(notes: GeneralNote[]): Promise<void> {
    await saveItem(NOTES_KEY, notes);

    // 1. Try sync to native notes table in Supabase
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
          // If columns don't exist yet in Supabase notes table, fallback to standard columns
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

        // Delete removed notes
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

    // 2. Always maintain fallback cloud mirror in standard_tasks (id: 4) so all phones sync immediately
    try {
      const rawJson = JSON.stringify(notes);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: 4, tasks: chunks });
    } catch (fallbackErr) {
      console.warn('Fallback notes sync mirror error:', fallbackErr);
    }
  },

  /**
   * Retrieves return & warranty tracking items (Supabase cloud + local cache)
   */
  async getReturnWarrantyItems(): Promise<ReturnWarrantyItem[]> {
    const localData = (await loadItem<ReturnWarrantyItem[]>(RETURN_WARRANTY_KEY)) || [];

    // 1. Try fetching from Supabase native table
    try {
      const { data, error } = await supabase
        .from('return_warranty')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const cloudItems: ReturnWarrantyItem[] = data.map((row) => ({
          id: row.id,
          type: (row.type as ReturnWarrantyType) || 'warranty',
          companyName: row.company_name,
          sentDate: row.sent_date,
          serialNumber: row.serial_number || undefined,
          trackingCode: row.tracking_code || undefined,
          serialNumberPhoto: row.serial_number_photo || undefined,
          trackingCodePhoto: row.tracking_code_photo || undefined,
          notes: row.notes || undefined,
          status: row.status || 'pending',
          reminderDate: row.reminder_date || undefined,
          reminderActive: Boolean(row.reminder_active),
          notified: Boolean(row.notified),
          createdAt: Number(row.created_at) || Date.now(),
          createdBy: row.created_by || undefined,
          createdByName: row.created_by_name || undefined,
        }));

        await saveItem(RETURN_WARRANTY_KEY, cloudItems);
        return cloudItems;
      }
    } catch (e) {
      console.warn('Supabase return_warranty fetch error:', e);
    }

    // 2. Fallback cloud sync slot (standard_tasks id: 2) in case return_warranty table is not created yet
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 2)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: ReturnWarrantyItem[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          await saveItem(RETURN_WARRANTY_KEY, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    return localData;
  },

  /**
   * Saves return & warranty items to local cache and syncs with Supabase
   */
  async saveReturnWarrantyItems(items: ReturnWarrantyItem[]): Promise<void> {
    await saveItem(RETURN_WARRANTY_KEY, items);

    // 1. Try sync to native return_warranty table in Supabase
    try {
      const rows = items.map((item) => ({
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

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase.from('return_warranty').upsert(rows);
        if (!upsertErr) {
          // Delete removed items
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
        }
      } else {
        await supabase.from('return_warranty').delete().neq('id', '___');
      }
    } catch (err) {
      console.warn('Native return_warranty table sync skipped:', err);
    }

    // 2. Always maintain fallback cloud mirror in standard_tasks (id: 2) so all phones sync immediately
    try {
      const rawJson = JSON.stringify(items);
      // Chunk string into pieces of 8000 chars for text[] array
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: 2, tasks: chunks });
    } catch (fallbackErr) {
      console.warn('Fallback return_warranty sync mirror error:', fallbackErr);
    }
  },

  /**
   * Retrieves services (Supabase cloud + local cache + standard_tasks id:3 fallback)
   */
  async getServices(): Promise<ServiceItem[]> {
    const localData = (await loadItem<ServiceItem[]>(SERVICES_KEY)) || [];

    // 1. Try fetching from native services table in Supabase
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const cloudServices: ServiceItem[] = data.map((row) => ({
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
        }));

        await saveItem(SERVICES_KEY, cloudServices);
        return cloudServices;
      }
    } catch (e) {
      console.warn('Supabase services fetch error:', e);
    }

    // 2. Fallback cloud sync slot (standard_tasks id: 3) in case services table is not created yet
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 3)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: ServiceItem[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          await saveItem(SERVICES_KEY, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    return localData;
  },

  /**
   * Saves services to local cache and syncs with Supabase
   */
  async saveServices(items: ServiceItem[]): Promise<void> {
    await saveItem(SERVICES_KEY, items);

    // 1. Try sync to native services table in Supabase
    try {
      const rows = items.map((item) => ({
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

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase.from('services').upsert(rows);
        if (!upsertErr) {
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
        }
      } else {
        await supabase.from('services').delete().neq('id', '___');
      }
    } catch (err) {
      console.warn('Native services table sync skipped:', err);
    }

    // 2. Always maintain fallback cloud mirror in standard_tasks (id: 3) so all phones sync immediately
    try {
      const rawJson = JSON.stringify(items);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: 3, tasks: chunks });
    } catch (fallbackErr) {
      console.warn('Fallback services sync mirror error:', fallbackErr);
    }
  },

  /**
   * Retrieves admin-configured workplace location (Supabase cloud + local cache)
   */
  async getWorkplaceLocation(): Promise<WorkplaceLocation | null> {
    const localData = await loadItem<WorkplaceLocation>(WORKPLACE_LOCATION_KEY);

    // Try cloud slot standard_tasks id: 5
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 5)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: WorkplaceLocation = JSON.parse(rawJson);
        if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
          if (!parsed.radiusMeters || parsed.radiusMeters === 10) {
            parsed.radiusMeters = 20;
          }
          await saveItem(WORKPLACE_LOCATION_KEY, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    if (localData && (!localData.radiusMeters || localData.radiusMeters === 10)) {
      localData.radiusMeters = 20;
    }
    return localData;
  },

  /**
   * Saves workplace location to local cache and syncs with Supabase slot 5
   */
  async saveWorkplaceLocation(location: WorkplaceLocation): Promise<void> {
    await saveItem(WORKPLACE_LOCATION_KEY, location);

    try {
      const rawJson = JSON.stringify(location);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: 5, tasks: chunks });
    } catch (err) {
      console.warn('Cloud save workplace location error:', err);
    }
  },

  /**
   * Retrieves attendance records (Supabase cloud + local cache)
   */
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    const localData = (await loadItem<AttendanceRecord[]>(ATTENDANCE_RECORDS_KEY)) || [];

    // Try cloud slot standard_tasks id: 6
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 6)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: AttendanceRecord[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          await saveItem(ATTENDANCE_RECORDS_KEY, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    return localData;
  },

  /**
   * Saves attendance records to local cache and syncs with Supabase slot 6
   */
  async saveAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
    await saveItem(ATTENDANCE_RECORDS_KEY, records);

    try {
      const rawJson = JSON.stringify(records);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: 6, tasks: chunks });
    } catch (err) {
      console.warn('Cloud save attendance records error:', err);
    }
  },

  /**
   * Retrieves admin reminders / directives (Supabase cloud + local cache)
   */
  async getAdminReminders(): Promise<AdminReminder[]> {
    const localData = (await loadItem<AdminReminder[]>(ADMIN_REMINDERS_KEY)) || [];

    // Fallback cloud sync slot (standard_tasks id: 7)
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 7)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: AdminReminder[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          await saveItem(ADMIN_REMINDERS_KEY, parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Cloud fetch admin reminders error:', e);
    }

    return localData;
  },

  /**
   * Saves admin reminders to local cache and syncs with Supabase slot 7
   */
  async saveAdminReminders(reminders: AdminReminder[]): Promise<void> {
    await saveItem(ADMIN_REMINDERS_KEY, reminders);

    try {
      const rawJson = JSON.stringify(reminders);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: 7, tasks: chunks });
    } catch (err) {
      console.warn('Cloud save admin reminders error:', err);
    }
  },

  /**
   * Retrieves leave requests (Supabase cloud slot 10 + local cache)
   */
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    const localData = (await loadItem<LeaveRequest[]>(LEAVE_REQUESTS_KEY)) || [];

    // Fallback cloud sync slot (standard_tasks id: 10)
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 10)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: LeaveRequest[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          await saveItem(LEAVE_REQUESTS_KEY, parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Cloud fetch leave requests error:', e);
    }

    return localData;
  },

  /**
   * Saves leave requests to local cache and syncs with Supabase slot 10
   */
  async saveLeaveRequests(requests: LeaveRequest[]): Promise<void> {
    await saveItem(LEAVE_REQUESTS_KEY, requests);

    try {
      const rawJson = JSON.stringify(requests);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: 10, tasks: chunks });
    } catch (err) {
      console.warn('Cloud save leave requests error:', err);
    }
  },

  /**
   * Retrieves Cari list data (cached locally, static json fallback, or fresh fetch)
   */
  async getCarilerData(): Promise<CariData> {
    const fallback: CariData = {
      updatedAt: (defaultCarilerData as any).updatedAt || new Date().toISOString(),
      database: (defaultCarilerData as any).database || 'POLATLAR2025',
      total: (defaultCarilerData as any).total || ((defaultCarilerData as any).cariler || []).length,
      cariler: (defaultCarilerData as any).cariler || [],
    };

    try {
      const cached = await loadItem<CariData>(CARILER_DATA_KEY);
      if (cached?.cariler && cached.cariler.length > 0) {
        if (!fallback.updatedAt || new Date(cached.updatedAt) >= new Date(fallback.updatedAt)) {
          return cached;
        }
      }
    } catch {
      // ignore
    }

    // Non-blocking background fetch check from public /cariler.json
    if (typeof window !== 'undefined') {
      fetch(`/cariler.json?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((fresh) => {
          if (fresh?.cariler && Array.isArray(fresh.cariler) && fresh.cariler.length > 0) {
            saveItem(CARILER_DATA_KEY, fresh);
          }
        })
        .catch(() => {});
    }

    return fallback;
  },

  /**
   * Saves updated Cari data to local cache
   */
  async saveCarilerData(data: CariData): Promise<void> {
    await saveItem(CARILER_DATA_KEY, data);
  },

  /**
   * Parses an uploaded Excel (.xlsx) file and extracts Cari names
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
      database: 'Excel Yüklemesi',
      total: sortedCariler.length,
      cariler: sortedCariler,
    };

    await saveItem(CARILER_DATA_KEY, result);
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

  async exportBackup(): Promise<string> {
    const locations = await this.getLocations();
    const standardTasks = await this.getStandardTasks();
    const notes = await this.getNotes();
    const returnWarrantyItems = await this.getReturnWarrantyItems();
    const services = await this.getServices();
    const workplaceLocation = (await this.getWorkplaceLocation()) || undefined;
    const attendanceRecords = await this.getAttendanceRecords();
    const adminReminders = await this.getAdminReminders();
    const leaveRequests = await this.getLeaveRequests();
    const cariData = await this.getCarilerData();
    const backup: BackupData = {
      locations,
      standardTasks,
      notes,
      returnWarrantyItems,
      services,
      workplaceLocation,
      attendanceRecords,
      adminReminders,
      leaveRequests,
      cariler: cariData.cariler,
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
    if (backupData.attendanceRecords && Array.isArray(backupData.attendanceRecords)) {
      await this.saveAttendanceRecords(backupData.attendanceRecords);
    }
    if (backupData.adminReminders && Array.isArray(backupData.adminReminders)) {
      await this.saveAdminReminders(backupData.adminReminders);
    }
    if (backupData.leaveRequests && Array.isArray(backupData.leaveRequests)) {
      await this.saveLeaveRequests(backupData.leaveRequests);
    }
    if (backupData.cariler && Array.isArray(backupData.cariler)) {
      await this.saveCarilerData({
        updatedAt: new Date().toISOString(),
        database: 'Yedekten Geri Yükleme',
        total: backupData.cariler.length,
        cariler: backupData.cariler,
      });
    }
  },
};
