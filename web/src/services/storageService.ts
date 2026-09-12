import { get, set } from 'idb-keyval';
import { LocationItem, GeneralNote, BackupData, ReturnWarrantyItem, ReturnWarrantyType, ServiceItem } from '../types/storage';
import { DEFAULT_STANDARD_TASKS } from '../constants/defaultTasks';
import { supabase } from './supabaseClient';

const LOCATIONS_KEY = '@gorev_tamamlama_locations';
const STANDARD_TASKS_KEY = '@gorev_tamamlama_standard_tasks';
const NOTES_KEY = '@gorev_tamamlama_general_notes';
const RETURN_WARRANTY_KEY = '@gorev_tamamlama_return_warranty';
const SERVICES_KEY = '@gorev_tamamlama_services';

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

    // Try fetching from Supabase
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
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
        }));

        await saveItem(NOTES_KEY, cloudNotes);
        return cloudNotes;
      }
    } catch (e) {
      console.warn('Supabase notes fetch error:', e);
    }

    return localData;
  },

  /**
   * Saves notes to local cache and syncs with Supabase
   */
  async saveNotes(notes: GeneralNote[]): Promise<void> {
    await saveItem(NOTES_KEY, notes);

    try {
      const rows = notes.map((n) => ({
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

      if (rows.length > 0) {
        await supabase.from('notes').upsert(rows);
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
    } catch (err) {
      console.warn('Supabase save notes error:', err);
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

  async exportBackup(): Promise<string> {
    const locations = await this.getLocations();
    const standardTasks = await this.getStandardTasks();
    const notes = await this.getNotes();
    const returnWarrantyItems = await this.getReturnWarrantyItems();
    const services = await this.getServices();
    const backup: BackupData = { locations, standardTasks, notes, returnWarrantyItems, services };
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
  },
};
