import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LocationItem, TaskStatus, GeneralNote, BackupData, NoteTargetMode } from '../types/storage';
import { StorageService } from '../services/storageService';
import { DEFAULT_STANDARD_TASKS } from '../constants/defaultTasks';
import { NotificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { OneSignalService } from '../services/oneSignalService';

interface StorageContextType {
  locations: LocationItem[];
  allLocations: LocationItem[];
  standardTasks: string[];
  notes: GeneralNote[];
  allNotes: GeneralNote[];
  isLoading: boolean;
  activeToast: { title: string; body: string } | null;
  dismissToast: () => void;
  addLocation: (name: string) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  updateTaskStatus: (locationId: string, taskId: string, status: TaskStatus) => Promise<void>;
  addCustomTaskToLocation: (locationId: string, taskName: string) => Promise<void>;
  deleteCustomTaskFromLocation: (locationId: string, taskId: string) => Promise<void>;
  addStandardTask: (taskName: string) => Promise<void>;
  deleteStandardTask: (index: number) => Promise<void>;
  resetStandardTasks: () => Promise<void>;
  updateLocationDetails: (
    locationId: string,
    address: string,
    notes: string,
    latitude?: number,
    longitude?: number,
    name?: string
  ) => Promise<void>;
  addPhotoToLocation: (locationId: string, photoDataUrl: string) => Promise<void>;
  deletePhotoFromLocation: (locationId: string, photoDataUrl: string) => Promise<void>;
  addNote: (
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode?: NoteTargetMode,
    targetUserIds?: string[],
    targetUserNames?: string[]
  ) => Promise<void>;
  updateNote: (
    id: string,
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode?: NoteTargetMode,
    targetUserIds?: string[],
    targetUserNames?: string[]
  ) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  importBackupData: (backupData: BackupData) => Promise<void>;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

const SEEN_NOTES_KEY = (userId: string) => `@seen_notes_${userId}`;
const SEEN_REMINDERS_KEY = (userId: string) => `@seen_reminders_${userId}`;
const SEEN_LOCATIONS_KEY = (userId: string) => `@seen_locations_${userId}`;

const getStoredSet = (key: string): Set<string> => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
};

const saveStoredSet = (key: string, setObj: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(setObj)));
  } catch {
    // ignore
  }
};

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, users } = useAuth();

  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [standardTasks, setStandardTasks] = useState<string[]>([]);
  const [allNotes, setAllNotes] = useState<GeneralNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeToast, setActiveToast] = useState<{ title: string; body: string } | null>(null);

  // Load initial data on mount + Supabase Realtime listener
  useEffect(() => {
    const initData = async () => {
      try {
        const [locs, tasks, nts] = await Promise.all([
          StorageService.getLocations(),
          StorageService.getStandardTasks(),
          StorageService.getNotes(),
        ]);
        const migratedLocs = locs.map((l) => ({
          ...l,
          createdBy: l.createdBy || 'admin-root',
          createdByName: l.createdByName || 'Sistem Yöneticisi',
        }));
        setAllLocations(migratedLocs);
        setStandardTasks(tasks);
        setAllNotes(nts);
      } catch (err) {
        console.error('Veriler yüklenirken hata oluştu:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initData();

    // Realtime listeners for locations, notes & standard_tasks
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        async () => {
          const locs = await StorageService.getLocations();
          setAllLocations(locs);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        async () => {
          const nts = await StorageService.getNotes();
          setAllNotes(nts);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'standard_tasks' },
        async () => {
          const tasks = await StorageService.getStandardTasks();
          setStandardTasks(tasks);
        }
      )
      .subscribe();

    // High-frequency background sync for mobile devices
    const syncInterval = setInterval(async () => {
      try {
        const [locs, nts] = await Promise.all([
          StorageService.getLocations(),
          StorageService.getNotes(),
        ]);
        setAllLocations((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(locs)) {
            return locs;
          }
          return prev;
        });
        setAllNotes((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(nts)) {
            return nts;
          }
          return prev;
        });
      } catch {
        // ignore
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
    };
  }, []);

  // Filter locations based on role:
  // Admin -> Sees ALL locations from all staff members
  // Staff (Saha Yetkilisi) -> ONLY sees locations created by himself
  const visibleLocations = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') {
      return allLocations;
    }
    // Staff role: strictly only own creations
    return allLocations.filter((loc) => loc.createdBy === user.id);
  }, [allLocations, user]);

  // Filter notes based on role and target sharing:
  // Admin -> Sees ALL notes
  // Staff -> Strictly sees notes created by themselves, OR notes targeted directly to them (single/multi), OR public announcements ('all')
  const visibleNotes = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') {
      return allNotes;
    }
    return allNotes.filter((n) => {
      // 1. Creator always sees own notes
      if (n.createdBy === user.id) return true;
      // 2. Public notes for all
      if (n.targetMode === 'all' || n.targetUserId === 'all') return true;
      // 3. Multi-user targeted notes
      if (n.targetMode === 'custom' && Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) {
        return true;
      }
      // 4. Legacy single user target
      if (n.targetUserId === user.id) return true;
      return false;
    });
  }, [allNotes, user]);

  // Check incoming direct notes & timed reminders per user device
  useEffect(() => {
    if (!user || allNotes.length === 0) return;

    const seenNotes = getStoredSet(SEEN_NOTES_KEY(user.id));
    const seenReminders = getStoredSet(SEEN_REMINDERS_KEY(user.id));
    const now = Date.now();
    let seenNotesChanged = false;
    let seenRemindersChanged = false;

    allNotes.forEach((n) => {
      // 1. Check if note is targeted to this user
      const isTargetedToMe =
        n.createdBy !== user.id &&
        (n.targetMode === 'all' ||
          n.targetUserId === 'all' ||
          (n.targetMode === 'custom' && Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
          n.targetUserId === user.id);

      // 2. Instant Arrival Notification for targeted note
      if (isTargetedToMe) {
        if (!seenNotes.has(n.id)) {
          seenNotes.add(n.id);
          seenNotesChanged = true;

          const sender = n.createdByName || 'Yönetici';
          const title = `📩 ${sender} Size Yeni Bir Not İletti!`;
          NotificationService.sendNotification(title, n.content);
          setActiveToast({ title, body: n.content });
        }
      } else if (n.createdBy === user.id) {
        // Mark creator's own note as already seen so creator never gets arrival alert
        if (!seenNotes.has(n.id)) {
          seenNotes.add(n.id);
          seenNotesChanged = true;
        }
      }

      // 3. Timed Reminders Check (Only trigger for the intended recipient/creator)
      if (n.reminderActive && n.reminderDate) {
        const isReminderForMe =
          (n.targetMode === 'self' && n.createdBy === user.id) ||
          isTargetedToMe ||
          (n.createdBy === user.id && (!n.targetMode || n.targetMode === 'self'));

        if (isReminderForMe) {
          const reminderTime = new Date(n.reminderDate).getTime();
          if (reminderTime <= now && !seenReminders.has(n.id)) {
            seenReminders.add(n.id);
            seenRemindersChanged = true;

            const title = '🔔 Görev & Not Hatırlatıcısı';
            NotificationService.sendNotification(title, n.content);
            setActiveToast({ title, body: n.content });
          }
        }
      }
    });

    if (seenNotesChanged) {
      saveStoredSet(SEEN_NOTES_KEY(user.id), seenNotes);
    }
    if (seenRemindersChanged) {
      saveStoredSet(SEEN_REMINDERS_KEY(user.id), seenReminders);
    }
  }, [allNotes, user]);

  // Check incoming locations from staff members (Admin notification)
  useEffect(() => {
    if (!user || user.role !== 'admin' || allLocations.length === 0) return;

    const seenLocs = getStoredSet(SEEN_LOCATIONS_KEY(user.id));
    let seenChanged = false;

    allLocations.forEach((loc) => {
      // If created by a staff member (or someone else)
      if (loc.createdBy && loc.createdBy !== user.id) {
        if (!seenLocs.has(loc.id)) {
          seenLocs.add(loc.id);
          seenChanged = true;

          const staffName = loc.createdByName || 'Saha Personeli';
          const title = '📍 Yeni Kurulum Eklendi!';
          const body = `${staffName}, "${loc.name}" için yeni bir kurulum kaydı oluşturdu.`;

          NotificationService.sendNotification(title, body);
          setActiveToast({ title, body });
        }
      } else if (loc.createdBy === user.id) {
        if (!seenLocs.has(loc.id)) {
          seenLocs.add(loc.id);
          seenChanged = true;
        }
      }
    });

    if (seenChanged) {
      saveStoredSet(SEEN_LOCATIONS_KEY(user.id), seenLocs);
    }
  }, [allLocations, user]);

  const dismissToast = () => {
    setActiveToast(null);
  };

  // Save locations helper
  const saveLocations = async (newLocations: LocationItem[]) => {
    setAllLocations(newLocations);
    await StorageService.saveLocations(newLocations);
  };

  // Save standard tasks helper
  const saveStandardTasks = async (newTasks: string[]) => {
    setStandardTasks(newTasks);
    await StorageService.saveStandardTasks(newTasks);
  };

  // Save notes helper
  const saveNotes = async (newNotes: GeneralNote[]) => {
    setAllNotes(newNotes);
    await StorageService.saveNotes(newNotes);
  };

  // Add location with creator tracking & Admin notification
  const addLocation = async (name: string) => {
    if (!name.trim()) return;
    const newLocation: LocationItem = {
      id: generateId(),
      name: name.trim(),
      createdAt: Date.now(),
      createdBy: user?.id,
      createdByName: user?.name || user?.username || 'Yetkili',
      tasks: standardTasks.map((taskName) => ({
        id: generateId(),
        name: taskName,
        status: 'pending',
      })),
    };

    // Mark as seen on creator's device immediately
    if (user?.id) {
      const seenLocs = getStoredSet(SEEN_LOCATIONS_KEY(user.id));
      seenLocs.add(newLocation.id);
      saveStoredSet(SEEN_LOCATIONS_KEY(user.id), seenLocs);
    }

    const newLocations = [newLocation, ...allLocations];
    await saveLocations(newLocations);

    // If added by Field Staff, send hardware push notification directly to all Admins!
    if (user?.role !== 'admin') {
      const adminIds = users.filter((u) => u.role === 'admin').map((u) => u.id);
      if (adminIds.length > 0) {
        const staffName = user?.name || user?.username || 'Saha Personeli';
        OneSignalService.sendPushNotification({
          title: '📍 Yeni Kurulum Eklendi!',
          message: `${staffName}, "${newLocation.name}" için yeni bir kurulum kaydı oluşturdu.`,
          targetMode: 'custom',
          targetUserIds: adminIds,
          url: 'https://saha-takip-beige.vercel.app',
        });
      }
    }
  };

  // Delete location (guarded: admin or creator only)
  const deleteLocation = async (id: string) => {
    const target = allLocations.find((loc) => loc.id === id);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      alert('Bu kurulumu silme yetkiniz bulunmuyor.');
      return;
    }
    const newLocations = allLocations.filter((loc) => loc.id !== id);
    await saveLocations(newLocations);
  };

  // Update task status inside a location (guarded: admin or creator only)
  const updateTaskStatus = async (locationId: string, taskId: string, status: TaskStatus) => {
    const target = allLocations.find((loc) => loc.id === locationId);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      return;
    }
    const newLocations = allLocations.map((loc) => {
      if (loc.id === locationId) {
        return {
          ...loc,
          tasks: loc.tasks.map((task) => {
            if (task.id === taskId) {
              return { ...task, status };
            }
            return task;
          }),
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Add custom task to specific location (guarded: admin or creator only)
  const addCustomTaskToLocation = async (locationId: string, taskName: string) => {
    if (!taskName.trim()) return;
    const target = allLocations.find((loc) => loc.id === locationId);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      return;
    }
    const newLocations = allLocations.map((loc) => {
      if (loc.id === locationId) {
        return {
          ...loc,
          tasks: [
            ...loc.tasks,
            {
              id: generateId(),
              name: taskName.trim(),
              status: 'pending' as TaskStatus,
            },
          ],
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Delete custom task from specific location (guarded: admin or creator only)
  const deleteCustomTaskFromLocation = async (locationId: string, taskId: string) => {
    const target = allLocations.find((loc) => loc.id === locationId);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      return;
    }
    const newLocations = allLocations.map((loc) => {
      if (loc.id === locationId) {
        return {
          ...loc,
          tasks: loc.tasks.filter((task) => task.id !== taskId),
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Add standard task to template
  const addStandardTask = async (taskName: string) => {
    if (!taskName.trim()) return;
    const newTasks = [...standardTasks, taskName.trim()];
    await saveStandardTasks(newTasks);
  };

  // Delete standard task from template
  const deleteStandardTask = async (index: number) => {
    const newTasks = standardTasks.filter((_, idx) => idx !== index);
    await saveStandardTasks(newTasks);
  };

  // Reset standard tasks to default template
  const resetStandardTasks = async () => {
    await saveStandardTasks(DEFAULT_STANDARD_TASKS);
  };

  // Update location address, notes, and optionally name & coordinates (guarded: admin or creator only)
  const updateLocationDetails = async (
    locationId: string,
    address: string,
    notes: string,
    latitude?: number,
    longitude?: number,
    name?: string
  ) => {
    const target = allLocations.find((loc) => loc.id === locationId);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      return;
    }
    const newLocations = allLocations.map((loc) => {
      if (loc.id === locationId) {
        return {
          ...loc,
          name: name !== undefined && name.trim() ? name.trim() : loc.name,
          address: address,
          notes: notes,
          latitude: latitude !== undefined ? latitude : loc.latitude,
          longitude: longitude !== undefined ? longitude : loc.longitude,
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Add photo to location (guarded: admin or creator only)
  const addPhotoToLocation = async (locationId: string, photoDataUrl: string) => {
    const target = allLocations.find((loc) => loc.id === locationId);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      return;
    }
    const newLocations = allLocations.map((loc) => {
      if (loc.id === locationId) {
        const currentPhotos = loc.photos || [];
        return {
          ...loc,
          photos: [...currentPhotos, photoDataUrl],
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Delete photo from location (guarded: admin or creator only)
  const deletePhotoFromLocation = async (locationId: string, photoDataUrl: string) => {
    const target = allLocations.find((loc) => loc.id === locationId);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      return;
    }
    const newLocations = allLocations.map((loc) => {
      if (loc.id === locationId) {
        const currentPhotos = loc.photos || [];
        return {
          ...loc,
          photos: currentPhotos.filter((p) => p !== photoDataUrl),
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Add general note with single/multi target user sharing
  const addNote = async (
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode: NoteTargetMode = 'self',
    targetUserIds?: string[],
    targetUserNames?: string[]
  ) => {
    if (!content.trim()) return;
    const newNote: GeneralNote = {
      id: generateId(),
      content: content.trim(),
      createdAt: Date.now(),
      createdBy: user?.id,
      createdByName: user?.name || user?.username || 'Yetkili',
      targetMode,
      targetUserIds: targetUserIds || [],
      targetUserNames: targetUserNames || [],
      // For backwards compatibility
      targetUserId: targetMode === 'all' ? 'all' : targetMode === 'self' ? 'self' : targetUserIds?.[0] || 'self',
      targetUserName: targetMode === 'all' ? 'Tüm Personeller' : targetMode === 'self' ? 'Sadece Kendim' : targetUserNames?.join(', ') || 'Özel',
      reminderActive,
      reminderDate: reminderActive ? reminderDate : undefined,
      notified: false,
    };

    // Mark as seen on creator's device immediately
    if (user?.id) {
      const seenNotes = getStoredSet(SEEN_NOTES_KEY(user.id));
      seenNotes.add(newNote.id);
      saveStoredSet(SEEN_NOTES_KEY(user.id), seenNotes);
    }

    // Send hardware push notification directly to locked phones via OneSignal
    if (targetMode !== 'self') {
      // 1. Immediate arrival alert
      OneSignalService.sendPushNotification({
        title: `📩 ${newNote.createdByName} Size Yeni Bir Not İletti!`,
        message: newNote.content,
        targetMode,
        targetUserIds,
        url: 'https://saha-takip-beige.vercel.app',
      });

      // 2. Scheduled reminder alert (OneSignal server will wake up locked phone at exact reminder time)
      if (reminderActive && reminderDate) {
        OneSignalService.sendPushNotification({
          title: `🔔 Görev & Not Hatırlatıcısı (${newNote.createdByName})`,
          message: newNote.content,
          targetMode,
          targetUserIds,
          url: 'https://saha-takip-beige.vercel.app',
          sendAfter: new Date(reminderDate).toISOString(),
        });
      }
    }

    const newNotes = [newNote, ...allNotes];
    await saveNotes(newNotes);
  };

  // Update general note with single/multi target user sharing
  const updateNote = async (
    id: string,
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode?: NoteTargetMode,
    targetUserIds?: string[],
    targetUserNames?: string[]
  ) => {
    if (!content.trim()) return;
    const newNotes = allNotes.map((n) => {
      if (n.id === id) {
        const nextMode = targetMode !== undefined ? targetMode : n.targetMode || 'self';
        const nextIds = targetUserIds !== undefined ? targetUserIds : n.targetUserIds || [];
        const nextNames = targetUserNames !== undefined ? targetUserNames : n.targetUserNames || [];

        return {
          ...n,
          content: content.trim(),
          reminderActive,
          reminderDate: reminderActive ? reminderDate : undefined,
          targetMode: nextMode,
          targetUserIds: nextIds,
          targetUserNames: nextNames,
          targetUserId: nextMode === 'all' ? 'all' : nextMode === 'self' ? 'self' : nextIds[0] || 'self',
          targetUserName: nextMode === 'all' ? 'Tüm Personeller' : nextMode === 'self' ? 'Sadece Kendim' : nextNames.join(', ') || 'Özel',
          notified: false,
        };
      }
      return n;
    });
    await saveNotes(newNotes);
  };

  // Delete general note
  const deleteNote = async (id: string) => {
    const newNotes = allNotes.filter((n) => n.id !== id);
    await saveNotes(newNotes);
  };

  // Import backup data (merges / replaces)
  const importBackupData = async (backupData: BackupData) => {
    if (backupData.locations && Array.isArray(backupData.locations)) {
      await saveLocations(backupData.locations);
    }
    if (backupData.standardTasks && Array.isArray(backupData.standardTasks)) {
      await saveStandardTasks(backupData.standardTasks);
    }
    if (backupData.notes && Array.isArray(backupData.notes)) {
      await saveNotes(backupData.notes);
    }
  };

  return (
    <StorageContext.Provider
      value={{
        locations: visibleLocations,
        allLocations,
        standardTasks,
        notes: visibleNotes,
        allNotes,
        isLoading,
        activeToast,
        dismissToast,
        addLocation,
        deleteLocation,
        updateTaskStatus,
        addCustomTaskToLocation,
        deleteCustomTaskFromLocation,
        addStandardTask,
        deleteStandardTask,
        resetStandardTasks,
        updateLocationDetails,
        addPhotoToLocation,
        deletePhotoFromLocation,
        addNote,
        updateNote,
        deleteNote,
        importBackupData,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
};
