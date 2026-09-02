import { get, set } from 'idb-keyval';
import { LocationItem, GeneralNote, BackupData } from '../types/storage';
import { DEFAULT_STANDARD_TASKS } from '../constants/defaultTasks';
import { supabase } from './supabaseClient';

const LOCATIONS_KEY = '@gorev_tamamlama_locations';
const STANDARD_TASKS_KEY = '@gorev_tamamlama_standard_tasks';
const NOTES_KEY = '@gorev_tamamlama_general_notes';

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

  async exportBackup(): Promise<string> {
    const locations = await this.getLocations();
    const standardTasks = await this.getStandardTasks();
    const notes = await this.getNotes();
    const backup: BackupData = { locations, standardTasks, notes };
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
  },
};
