import { get, set } from 'idb-keyval';
import { LocationItem, GeneralNote, BackupData } from '../types/storage';
import { DEFAULT_STANDARD_TASKS } from '../constants/defaultTasks';

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

  // LocalStorage fallback
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

// Helper to safely save data to IndexedDB and localStorage mirror (for redundancy)
async function saveItem<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value);
  } catch (e) {
    console.warn(`IndexedDB write failed for ${key}:`, e);
  }

  try {
    // If value is small enough, also mirror to localStorage
    const stringified = JSON.stringify(value);
    // Only mirror if < 4MB to avoid quota exceeded on localStorage
    if (stringified.length < 4000000) {
      localStorage.setItem(key, stringified);
    }
  } catch (e) {
    // quota exceeded on localStorage is fine since IndexedDB has high quota
    console.warn(`localStorage mirror skipped for ${key}:`, e);
  }
}

export const StorageService = {
  async getLocations(): Promise<LocationItem[]> {
    const data = await loadItem<LocationItem[]>(LOCATIONS_KEY);
    return data || [];
  },

  async saveLocations(locations: LocationItem[]): Promise<void> {
    await saveItem(LOCATIONS_KEY, locations);
  },

  async getStandardTasks(): Promise<string[]> {
    const data = await loadItem<string[]>(STANDARD_TASKS_KEY);
    if (data && Array.isArray(data) && data.length > 0) {
      return data;
    }
    // Initialize with default standard tasks
    await saveItem(STANDARD_TASKS_KEY, DEFAULT_STANDARD_TASKS);
    return DEFAULT_STANDARD_TASKS;
  },

  async saveStandardTasks(tasks: string[]): Promise<void> {
    await saveItem(STANDARD_TASKS_KEY, tasks);
  },

  async getNotes(): Promise<GeneralNote[]> {
    const data = await loadItem<GeneralNote[]>(NOTES_KEY);
    return data || [];
  },

  async saveNotes(notes: GeneralNote[]): Promise<void> {
    await saveItem(NOTES_KEY, notes);
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
