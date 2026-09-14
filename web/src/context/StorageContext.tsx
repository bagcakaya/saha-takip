import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LocationItem, TaskStatus, GeneralNote, BackupData, NoteTargetMode, ReturnWarrantyItem, ServiceItem, WorkplaceLocation, AttendanceRecord } from '../types/storage';
import { StorageService } from '../services/storageService';
import { DEFAULT_STANDARD_TASKS } from '../constants/defaultTasks';
import { NotificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { OneSignalService } from '../services/oneSignalService';
import { UserService } from '../services/userService';
import { TabType } from '../components/layout/Header';
import { LocationService } from '../services/locationService';

interface StorageContextType {
  locations: LocationItem[];
  allLocations: LocationItem[];
  standardTasks: string[];
  notes: GeneralNote[];
  allNotes: GeneralNote[];
  returnWarrantyItems: ReturnWarrantyItem[];
  services: ServiceItem[];
  allServices: ServiceItem[];
  workplaceLocation: WorkplaceLocation | null;
  attendanceRecords: AttendanceRecord[];
  isLoading: boolean;
  activeToast: { title: string; body: string; tab?: TabType; filter?: string } | null;
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
  completeNote: (id: string, completionNote?: string) => Promise<void>;
  approveNote: (id: string) => Promise<void>;
  rejectNote: (id: string, reason?: string) => Promise<void>;
  addReturnWarrantyItem: (
    item: Omit<ReturnWarrantyItem, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>
  ) => Promise<void>;
  updateReturnWarrantyItem: (id: string, updates: Partial<ReturnWarrantyItem>) => Promise<void>;
  deleteReturnWarrantyItem: (id: string) => Promise<void>;
  addService: (
    service: Omit<ServiceItem, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>
  ) => Promise<void>;
  updateService: (id: string, updates: Partial<ServiceItem>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  updateWorkplaceLocation: (
    address: string,
    latitude: number,
    longitude: number,
    radiusMeters?: number
  ) => Promise<void>;
  checkInStaff: () => Promise<{ success: boolean; message: string; distance?: number }>;
  checkOutStaff: () => Promise<{ success: boolean; message: string; distance?: number }>;
  deleteAttendanceRecord: (id: string) => Promise<void>;
  updateAttendanceRecord: (id: string, updates: Partial<AttendanceRecord>) => Promise<void>;
  refreshAttendance: () => Promise<void>;
  importBackupData: (backupData: BackupData) => Promise<void>;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

const SEEN_NOTES_KEY = (userId: string) => `@seen_notes_${userId}`;
const SEEN_REMINDERS_KEY = (userId: string) => `@seen_reminders_${userId}`;
const SEEN_LOCATIONS_KEY = (userId: string) => `@seen_locations_${userId}`;
const SEEN_WARRANTY_REMINDERS_KEY = (userId: string) => `@seen_warranty_reminders_${userId}`;
const SEEN_COMPLETED_LOCATIONS_KEY = (userId: string) => `@seen_completed_locations_${userId}`;
const SEEN_SERVICES_KEY = (userId: string) => `@seen_services_${userId}`;
const SEEN_COMPLETED_NOTES_KEY = (userId: string) => `@seen_completed_notes_${userId}`;
const SEEN_APPROVAL_NOTES_KEY = (userId: string) => `@seen_approval_notes_${userId}`;

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
  const [returnWarrantyItems, setReturnWarrantyItems] = useState<ReturnWarrantyItem[]>([]);
  const [allServices, setAllServices] = useState<ServiceItem[]>([]);
  const [workplaceLocation, setWorkplaceLocation] = useState<WorkplaceLocation | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeToast, setActiveToast] = useState<{
    title: string;
    body: string;
    tab?: TabType;
    filter?: string;
  } | null>(null);

  // Load initial data on mount + Supabase Realtime listener
  useEffect(() => {
    const initData = async () => {
      try {
        const [locs, tasks, nts, returns, srvs, wpLoc, attRecs] = await Promise.all([
          StorageService.getLocations(),
          StorageService.getStandardTasks(),
          StorageService.getNotes(),
          StorageService.getReturnWarrantyItems(),
          StorageService.getServices(),
          StorageService.getWorkplaceLocation(),
          StorageService.getAttendanceRecords(),
        ]);
        const migratedLocs = locs.map((l) => ({
          ...l,
          createdBy: l.createdBy || 'admin-root',
          createdByName: l.createdByName || 'Sistem Yöneticisi',
        }));
        setAllLocations(migratedLocs);
        setStandardTasks(tasks);
        setAllNotes(nts);
        setReturnWarrantyItems(returns);
        setAllServices(srvs);
        if (wpLoc) setWorkplaceLocation(wpLoc);
        setAttendanceRecords(attRecs);
      } catch (err) {
        console.error('Veriler yüklenirken hata oluştu:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initData();

    // Realtime listeners for locations, notes, standard_tasks, return_warranty & services
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
          const [tasks, returns, srvs, nts, wpLoc, attRecs] = await Promise.all([
            StorageService.getStandardTasks(),
            StorageService.getReturnWarrantyItems(),
            StorageService.getServices(),
            StorageService.getNotes(),
            StorageService.getWorkplaceLocation(),
            StorageService.getAttendanceRecords(),
          ]);
          setStandardTasks(tasks);
          setReturnWarrantyItems(returns);
          setAllServices(srvs);
          setAllNotes(nts);
          if (wpLoc) setWorkplaceLocation(wpLoc);
          setAttendanceRecords(attRecs);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'return_warranty' },
        async () => {
          const returns = await StorageService.getReturnWarrantyItems();
          setReturnWarrantyItems(returns);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        async () => {
          const srvs = await StorageService.getServices();
          setAllServices(srvs);
        }
      )
      .subscribe();

    // High-frequency background sync for mobile devices
    const syncInterval = setInterval(async () => {
      try {
        const [locs, nts, returns, srvs, wpLoc, attRecs] = await Promise.all([
          StorageService.getLocations(),
          StorageService.getNotes(),
          StorageService.getReturnWarrantyItems(),
          StorageService.getServices(),
          StorageService.getWorkplaceLocation(),
          StorageService.getAttendanceRecords(),
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
        setReturnWarrantyItems((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(returns)) {
            return returns;
          }
          return prev;
        });
        setAllServices((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(srvs)) {
            return srvs;
          }
          return prev;
        });
        if (wpLoc) {
          setWorkplaceLocation((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(wpLoc)) {
              return wpLoc;
            }
            return prev;
          });
        }
        setAttendanceRecords((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(attRecs)) {
            return attRecs;
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

  // Filter services based on role:
  // Admin -> Sees ALL services from all staff members
  // Staff (Saha Yetkilisi) -> ONLY sees services created by himself
  const visibleServices = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') {
      return allServices;
    }
    // Staff role: strictly only own creations
    return allServices.filter(
      (srv) => srv.createdBy === user.id || (srv.createdByName && srv.createdByName === user.name)
    );
  }, [allServices, user]);

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
          const title = `📋 ${sender} Size Yeni Bir İş Emri İletti!`;
          NotificationService.sendNotification(title, n.content);
          setActiveToast({ title, body: n.content, tab: 'notes', filter: 'pending' });
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

            const title = '⏰ İş Emri Hatırlatıcısı';
            NotificationService.sendNotification(title, n.content);
            setActiveToast({ title, body: n.content, tab: 'notes', filter: 'reminders' });
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

  // Check return & warranty reminders for all users (1-week auto or custom reminder)
  useEffect(() => {
    if (!user || returnWarrantyItems.length === 0) return;

    const seenWarrantyReminders = getStoredSet(SEEN_WARRANTY_REMINDERS_KEY(user.id));
    let seenWarrantyChanged = false;
    const now = Date.now();

    returnWarrantyItems.forEach((item) => {
      if (
        item.reminderActive &&
        item.reminderDate &&
        item.status !== 'completed'
      ) {
        const reminderTime = new Date(item.reminderDate).getTime();
        if (reminderTime <= now && !seenWarrantyReminders.has(item.id)) {
          seenWarrantyReminders.add(item.id);
          seenWarrantyChanged = true;

          const typeLabel = item.type === 'warranty' ? 'Garanti' : 'İade';
          const title = `🛡️ ${typeLabel} Durum Takibi: ${item.companyName}`;
          const body = `${item.companyName} firmasına gönderilen ${typeLabel.toLowerCase()} ürününün durum sorgulama tarihi geldi. Lütfen son durumunu sorgulayın.`;
          NotificationService.sendNotification(title, body);
          setActiveToast({ title, body, tab: 'returns' });
        }
      }
    });

    if (seenWarrantyChanged) {
      saveStoredSet(SEEN_WARRANTY_REMINDERS_KEY(user.id), seenWarrantyReminders);
    }
  }, [returnWarrantyItems, user]);

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
          setActiveToast({ title, body, tab: 'installations' });
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

  // Check completed locations from staff members (Admin notification)
  useEffect(() => {
    if (!user || user.role !== 'admin' || allLocations.length === 0) return;

    const seenDone = getStoredSet(SEEN_COMPLETED_LOCATIONS_KEY(user.id));
    let seenChanged = false;

    allLocations.forEach((loc) => {
      const isComplete =
        loc.tasks.length > 0 &&
        loc.tasks.every((t) => t.status === 'completed' || t.status === 'not_present');

      if (isComplete) {
        if (!seenDone.has(loc.id)) {
          seenDone.add(loc.id);
          seenChanged = true;

          const staffName = loc.createdByName || 'Saha Personeli';
          const title = '✅ Kurulum Tamamlandı!';
          const body = `${staffName}, "${loc.name}" kurulumundaki tüm görevleri tamamladı.`;

          NotificationService.sendNotification(title, body);
          setActiveToast({ title, body, tab: 'installations' });
        }
      }
    });

    if (seenChanged) {
      saveStoredSet(SEEN_COMPLETED_LOCATIONS_KEY(user.id), seenDone);
    }
  }, [allLocations, user]);

  // Check incoming services from staff members (Admin notification)
  useEffect(() => {
    if (!user || user.role !== 'admin' || allServices.length === 0) return;

    const seenServices = getStoredSet(SEEN_SERVICES_KEY(user.id));
    let seenChanged = false;

    allServices.forEach((srv) => {
      if (srv.createdBy && srv.createdBy !== user.id) {
        if (!seenServices.has(srv.id)) {
          seenServices.add(srv.id);
          seenChanged = true;

          const staffName = srv.createdByName || 'Saha Personeli';
          const title = '🔧 Yeni Servis Kaydı!';
          const body = `${staffName}, "${srv.companyName}" için servis kaydı ekledi.`;

          NotificationService.sendNotification(title, body);
          setActiveToast({ title, body, tab: 'services' });
        }
      } else if (srv.createdBy === user.id) {
        if (!seenServices.has(srv.id)) {
          seenServices.add(srv.id);
          seenChanged = true;
        }
      }
    });

    if (seenChanged) {
      saveStoredSet(SEEN_SERVICES_KEY(user.id), seenServices);
    }
  }, [allServices, user]);

  // Check incoming note completions (for Admin) & approval/rejection results (for Staff)
  useEffect(() => {
    if (!user || allNotes.length === 0) return;

    // 1. For Admin: Alert when a staff member completes a work order (pending_approval)
    if (user.role === 'admin') {
      const seenCompleted = getStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id));
      let seenChanged = false;

      allNotes.forEach((n) => {
        if (n.status === 'pending_approval' && n.completedAt && n.completedBy !== user.id) {
          const key = `${n.id}_${n.completedAt}`;
          if (!seenCompleted.has(key)) {
            seenCompleted.add(key);
            seenChanged = true;

            const staff = n.completedByName || 'Saha Personeli';
            const title = '📋 İş Emri Onay Bekliyor!';
            const body = `${staff}, "${n.content.slice(0, 50)}" iş emrini tamamladı.${n.completionNote ? ` Not: ${n.completionNote}` : ''}`;
            NotificationService.sendNotification(title, body);
            setActiveToast({ title, body, tab: 'notes', filter: 'pending' });
          }
        }
      });

      if (seenChanged) {
        saveStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id), seenCompleted);
      }
    }

    // 2. For Staff: Alert when Admin approves or rejects the staff's work order
    if (user.role !== 'admin') {
      const seenApproval = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id));
      let seenChanged = false;

      allNotes.forEach((n) => {
        const isMyTask =
          n.completedBy === user.id ||
          (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
          n.targetUserId === user.id;

        if (isMyTask) {
          // Check Approved
          if (n.status === 'approved' && n.approvedAt) {
            const key = `${n.id}_approved_${n.approvedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;

              const admin = n.approvedByName || 'Yönetici';
              const title = '✅ İş Emriniz Onaylandı!';
              const body = `${admin}, "${n.content.slice(0, 50)}" iş emrinizi başarıyla onayladı.`;
              NotificationService.sendNotification(title, body);
              setActiveToast({ title, body, tab: 'notes', filter: 'approved' });
            }
          }

          // Check Rejected
          if (n.status === 'rejected' && n.rejectedAt) {
            const key = `${n.id}_rejected_${n.rejectedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;

              const admin = n.rejectedByName || 'Yönetici';
              const title = '❌ İş Emriniz Reddedildi!';
              const body = `${admin}, "${n.content.slice(0, 50)}" iş emrini reddetti. Gerekçe: ${n.rejectionReason || 'Eksikler var'}`;
              NotificationService.sendNotification(title, body);
              setActiveToast({ title, body, tab: 'notes', filter: 'rejected' });
            }
          }
        }
      });

      if (seenChanged) {
        saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id), seenApproval);
      }
    }
  }, [allNotes, user]);

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
        await OneSignalService.sendPushNotification({
          title: '📍 Yeni Kurulum Eklendi!',
          message: `${staffName}, "${newLocation.name}" için yeni bir kurulum kaydı oluşturdu.`,
          targetMode: 'custom',
          targetUserIds: adminIds,
          url: 'https://saha-takip-beige.vercel.app/?tab=installations',
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

    const wasAlreadyComplete = Boolean(
      target &&
        target.tasks.length > 0 &&
        target.tasks.every((t) => t.status === 'completed' || t.status === 'not_present')
    );

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

    const updatedTarget = newLocations.find((loc) => loc.id === locationId);
    const isNowComplete = Boolean(
      updatedTarget &&
        updatedTarget.tasks.length > 0 &&
        updatedTarget.tasks.every((t) => t.status === 'completed' || t.status === 'not_present')
    );

    // If just transitioned to complete, send hardware push notification directly to all Admins!
    if (!wasAlreadyComplete && isNowComplete && updatedTarget) {
      const staffName = user?.name || user?.username || 'Saha Personeli';
      const adminIds = users.filter((u) => u.role === 'admin').map((u) => u.id);

      if (adminIds.length > 0) {
        await OneSignalService.sendPushNotification({
          title: '✅ Kurulum Tamamlandı!',
          message: `${staffName}, "${updatedTarget.name}" kurulumundaki tüm görevleri başarıyla tamamladı.`,
          targetMode: 'custom',
          targetUserIds: adminIds,
          url: 'https://saha-takip-beige.vercel.app/?tab=installations',
        });
      }

      if (user?.role === 'admin') {
        setActiveToast({
          title: '✅ Kurulum Tamamlandı!',
          body: `"${updatedTarget.name}" kurulumundaki tüm görevler tamamlandı.`,
          tab: 'installations',
        });
      }
    }
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
      await OneSignalService.sendPushNotification({
        title: `📋 ${newNote.createdByName} Size Yeni Bir İş Emri İletti!`,
        message: newNote.content,
        targetMode,
        targetUserIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=pending',
      });

      // 2. Scheduled reminder alert (OneSignal server will wake up locked phone at exact reminder time)
      if (reminderActive && reminderDate) {
        await OneSignalService.sendPushNotification({
          title: `⏰ İş Emri Hatırlatıcısı (${newNote.createdByName})`,
          message: newNote.content,
          targetMode,
          targetUserIds,
          url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=reminders',
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

  // Mark note as completed by Staff (submits to Admin for approval)
  const completeNote = async (id: string, completionNote?: string) => {
    const targetNote = allNotes.find((n) => n.id === id);
    if (!targetNote) return;

    const completedAt = Date.now();
    const staffName = user?.name || user?.username || 'Saha Personeli';
    const trimmedNote = completionNote?.trim() || undefined;

    const newNotes = allNotes.map((n) => {
      if (n.id === id) {
        return {
          ...n,
          status: 'pending_approval' as const,
          completedAt,
          completedBy: user?.id,
          completedByName: staffName,
          completionNote: trimmedNote,
          // Reset previous rejection if resubmitted
          rejectedAt: undefined,
          rejectedBy: undefined,
          rejectedByName: undefined,
          rejectionReason: undefined,
        };
      }
      return n;
    });

    // Mark as seen on staff device immediately
    if (user?.id) {
      const seenCompleted = getStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id));
      seenCompleted.add(`${id}_${completedAt}`);
      saveStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id), seenCompleted);
    }

    await saveNotes(newNotes);

    // Send instant hardware push notification to Admin(s)
    let adminIds = users.filter((u) => u.role === 'admin').map((u) => u.id);
    if (adminIds.length === 0) {
      try {
        const cloudUsers = await UserService.fetchUsersFromCloud();
        adminIds = cloudUsers.filter((u) => u.role === 'admin').map((u) => u.id);
      } catch {
        // ignore
      }
    }
    if (adminIds.length === 0) {
      adminIds = ['admin-1'];
    }

    const noteSnippet =
      targetNote.content.length > 50 ? `${targetNote.content.slice(0, 50)}...` : targetNote.content;
    const noteExplanation = trimmedNote ? `\nAçıklama: ${trimmedNote}` : '';

    // 1. Direct hardware push to admin user IDs
    await OneSignalService.sendPushNotification({
      title: '📋 İş Emri Tamamlandı (Onay Bekliyor)',
      message: `${staffName}, "${noteSnippet}" iş emrini tamamladı.${noteExplanation}`,
      targetMode: 'custom',
      targetUserIds: adminIds,
      url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=pending',
    });

    // 2. Broadcast to admin role devices
    await OneSignalService.sendPushNotification({
      title: '📋 İş Emri Tamamlandı (Onay Bekliyor)',
      message: `${staffName}, "${noteSnippet}" iş emrini tamamladı.${noteExplanation}`,
      targetMode: 'admin',
      url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=pending',
    });
  };

  // Admin approves completed work order
  const approveNote = async (id: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler iş emirlerini onaylayabilir.');
      return;
    }

    const targetNote = allNotes.find((n) => n.id === id);
    if (!targetNote) return;

    const approvedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';

    const newNotes = allNotes.map((n) => {
      if (n.id === id) {
        return {
          ...n,
          status: 'approved' as const,
          approvedAt,
          approvedBy: user?.id,
          approvedByName: adminName,
        };
      }
      return n;
    });

    // Mark as seen on admin device immediately
    if (user?.id) {
      const seenApprovals = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id));
      seenApprovals.add(`${id}_approved_${approvedAt}`);
      saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id), seenApprovals);
    }

    await saveNotes(newNotes);

    // Notify Staff who completed it or was targeted
    const targetRecipientIds = Array.from(
      new Set(
        [
          targetNote.completedBy,
          ...(targetNote.targetUserIds || []),
          targetNote.targetUserId !== 'all' && targetNote.targetUserId !== 'self'
            ? targetNote.targetUserId
            : undefined,
        ].filter(Boolean) as string[]
      )
    );

    const noteSnippet =
      targetNote.content.length > 50 ? `${targetNote.content.slice(0, 50)}...` : targetNote.content;

    if (targetRecipientIds.length > 0) {
      await OneSignalService.sendPushNotification({
        title: '✅ İş Emri Onaylandı!',
        message: `${adminName}, "${noteSnippet}" iş emrinizi başarıyla onayladı.`,
        targetMode: 'custom',
        targetUserIds: targetRecipientIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=approved',
      });
    }
  };

  // Admin rejects completed work order with reason
  const rejectNote = async (id: string, reason?: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler iş emirlerini reddedebilir.');
      return;
    }

    const targetNote = allNotes.find((n) => n.id === id);
    if (!targetNote) return;

    const rejectedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';
    const trimmedReason = reason?.trim() || 'Yönetici tarafından eksik görüldü';

    const newNotes = allNotes.map((n) => {
      if (n.id === id) {
        return {
          ...n,
          status: 'rejected' as const,
          rejectedAt,
          rejectedBy: user?.id,
          rejectedByName: adminName,
          rejectionReason: trimmedReason,
        };
      }
      return n;
    });

    // Mark as seen on admin device immediately
    if (user?.id) {
      const seenApprovals = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id));
      seenApprovals.add(`${id}_rejected_${rejectedAt}`);
      saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id), seenApprovals);
    }

    await saveNotes(newNotes);

    // Notify Staff who completed it or was targeted
    const targetRecipientIds = Array.from(
      new Set(
        [
          targetNote.completedBy,
          ...(targetNote.targetUserIds || []),
          targetNote.targetUserId !== 'all' && targetNote.targetUserId !== 'self'
            ? targetNote.targetUserId
            : undefined,
        ].filter(Boolean) as string[]
      )
    );

    const noteSnippet =
      targetNote.content.length > 50 ? `${targetNote.content.slice(0, 50)}...` : targetNote.content;

    if (targetRecipientIds.length > 0) {
      await OneSignalService.sendPushNotification({
        title: '❌ İş Emri Reddedildi!',
        message: `${adminName}, "${noteSnippet}" iş emrini reddetti. Gerekçe: ${trimmedReason}`,
        targetMode: 'custom',
        targetUserIds: targetRecipientIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=rejected',
      });
    }
  };

  // Add return / warranty item
  const addReturnWarrantyItem = async (
    itemData: Omit<ReturnWarrantyItem, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>
  ) => {
    const newItem: ReturnWarrantyItem = {
      ...itemData,
      id: generateId(),
      createdAt: Date.now(),
      createdBy: user?.id,
      createdByName: user?.name || user?.username || 'Yetkili',
    };

    // If warranty, schedule hardware push alert via OneSignal at 20 days exact timestamp
    if (newItem.type === 'warranty' && newItem.reminderActive && newItem.reminderDate) {
      await OneSignalService.sendPushNotification({
        title: `🛡️ Garanti Takibi (20 Gün): ${newItem.companyName}`,
        message: `${newItem.companyName} firmasına gönderilen garanti ürününün 20 günü doldu. Lütfen son durumunu sorgulayın.`,
        targetMode: 'all',
        url: 'https://saha-takip-beige.vercel.app/?tab=returns',
        sendAfter: new Date(newItem.reminderDate).toISOString(),
      });
    }

    const updated = [newItem, ...returnWarrantyItems];
    setReturnWarrantyItems(updated);
    await StorageService.saveReturnWarrantyItems(updated);
  };

  // Update return / warranty item
  const updateReturnWarrantyItem = async (id: string, updates: Partial<ReturnWarrantyItem>) => {
    const updated = returnWarrantyItems.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    setReturnWarrantyItems(updated);
    await StorageService.saveReturnWarrantyItems(updated);
  };

  // Delete return / warranty item
  const deleteReturnWarrantyItem = async (id: string) => {
    const updated = returnWarrantyItems.filter((item) => item.id !== id);
    setReturnWarrantyItems(updated);
    await StorageService.saveReturnWarrantyItems(updated);
  };

  // Add service record
  const addService = async (
    serviceData: Omit<ServiceItem, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>
  ) => {
    const newService: ServiceItem = {
      ...serviceData,
      id: generateId(),
      createdAt: Date.now(),
      createdBy: user?.id,
      createdByName: user?.name || user?.username || 'Saha Yetkilisi',
    };

    // Mark as seen on creator's device immediately
    if (user?.id) {
      const seenServices = getStoredSet(SEEN_SERVICES_KEY(user.id));
      seenServices.add(newService.id);
      saveStoredSet(SEEN_SERVICES_KEY(user.id), seenServices);
    }

    const updated = [newService, ...allServices];
    setAllServices(updated);
    await StorageService.saveServices(updated);

    // If added by Field Staff, send hardware push notification directly to all Admins!
    if (user?.role !== 'admin') {
      let adminIds = users.filter((u) => u.role === 'admin').map((u) => u.id);
      if (adminIds.length === 0) {
        try {
          const cloudUsers = await UserService.fetchUsersFromCloud();
          adminIds = cloudUsers.filter((u) => u.role === 'admin').map((u) => u.id);
        } catch {
          // ignore
        }
      }
      if (adminIds.length === 0) {
        adminIds = ['admin-1'];
      }

      const staffName = user?.name || user?.username || 'Saha Personeli';
      const locText = newService.location ? ` (${newService.location})` : '';

      // 1. Direct hardware push to all Admin User IDs
      await OneSignalService.sendPushNotification({
        title: '🔧 Yeni Servis Kaydı!',
        message: `${staffName}, "${newService.companyName}"${locText} için yeni bir servis kaydı ekledi: ${newService.workDone.slice(0, 80)}`,
        targetMode: 'custom',
        targetUserIds: adminIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=services',
      });

      // 2. Broadcast to any admin device by role tag
      await OneSignalService.sendPushNotification({
        title: '🔧 Yeni Servis Kaydı!',
        message: `${staffName}, "${newService.companyName}"${locText} için yeni bir servis kaydı ekledi: ${newService.workDone.slice(0, 80)}`,
        targetMode: 'admin',
        url: 'https://saha-takip-beige.vercel.app/?tab=services',
      });
    }
  };

  // Update service record (guarded: admin or creator only)
  const updateService = async (id: string, updates: Partial<ServiceItem>) => {
    const target = allServices.find((s) => s.id === id);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      alert('Bu servis kaydını düzenleme yetkiniz bulunmuyor.');
      return;
    }
    const updated = allServices.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    setAllServices(updated);
    await StorageService.saveServices(updated);
  };

  // Delete service record
  const deleteService = async (id: string) => {
    const target = allServices.find((s) => s.id === id);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      alert('Bu servis kaydını silme yetkiniz bulunmuyor.');
      return;
    }
    const updated = allServices.filter((s) => s.id !== id);
    setAllServices(updated);
    await StorageService.saveServices(updated);
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
    if (backupData.returnWarrantyItems && Array.isArray(backupData.returnWarrantyItems)) {
      setReturnWarrantyItems(backupData.returnWarrantyItems);
      await StorageService.saveReturnWarrantyItems(backupData.returnWarrantyItems);
    }
    if (backupData.services && Array.isArray(backupData.services)) {
      setAllServices(backupData.services);
      await StorageService.saveServices(backupData.services);
    }
    if (backupData.workplaceLocation) {
      setWorkplaceLocation(backupData.workplaceLocation);
      await StorageService.saveWorkplaceLocation(backupData.workplaceLocation);
    }
    if (backupData.attendanceRecords && Array.isArray(backupData.attendanceRecords)) {
      setAttendanceRecords(backupData.attendanceRecords);
      await StorageService.saveAttendanceRecords(backupData.attendanceRecords);
    }
  };

  // Update workplace location (Admin only)
  const updateWorkplaceLocation = async (
    address: string,
    latitude: number,
    longitude: number,
    radiusMeters = 10
  ) => {
    const loc: WorkplaceLocation = {
      address: address.trim(),
      latitude,
      longitude,
      radiusMeters,
      updatedAt: Date.now(),
      updatedBy: user?.id,
      updatedByName: user?.name,
    };
    setWorkplaceLocation(loc);
    await StorageService.saveWorkplaceLocation(loc);
  };

  // Staff check-in (Must be within 10 meters of workplace)
  const checkInStaff = async (): Promise<{ success: boolean; message: string; distance?: number }> => {
    if (!user) {
      return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    }
    if (!workplaceLocation || !workplaceLocation.latitude || !workplaceLocation.longitude) {
      return {
        success: false,
        message: 'İş yeri konumu henüz yönetici tarafından belirlenmemiş. Lütfen yöneticiniz ile iletişime geçin.',
      };
    }

    let userPos;
    try {
      userPos = await LocationService.getCurrentPosition();
    } catch (err: any) {
      return {
        success: false,
        message: `GPS konumu alınamadı: ${err?.message || 'Lütfen cihazınızın konum servisini açın.'}`,
      };
    }

    const distance = LocationService.calculateDistance(
      userPos.latitude,
      userPos.longitude,
      workplaceLocation.latitude,
      workplaceLocation.longitude
    );

    const allowedRadius = workplaceLocation.radiusMeters || 10;

    // Rule: Must be within 10 meters (<= 10m)
    if (distance > allowedRadius) {
      return {
        success: false,
        distance,
        message: `İş yerine olan mesafeniz: ${LocationService.formatDistance(distance)}. İşe giriş yapabilmek için iş yerinin ${allowedRadius} metre çapı içerisinde olmalısınız.`,
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const existingIndex = attendanceRecords.findIndex(
      (r) => r.userId === user.id && r.date === todayStr && r.status === 'checked_in'
    );

    if (existingIndex !== -1) {
      return {
        success: false,
        distance,
        message: 'Bugün için zaten aktif bir işe giriş kaydınız bulunmaktadır.',
      };
    }

    const newRecord: AttendanceRecord = {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      date: todayStr,
      checkInTime: Date.now(),
      checkInLat: userPos.latitude,
      checkInLon: userPos.longitude,
      checkInAddress: userPos.address,
      checkInDistance: distance,
      status: 'checked_in',
    };

    const updated = [newRecord, ...attendanceRecords];
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);

    // Push notification to admins
    OneSignalService.sendPushNotification({
      title: '🟢 Personel İşe Giriş Yaptı',
      message: `${user.name}, saat ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla iş yerine giriş yaptı. (Mesafe: ${LocationService.formatDistance(distance)})`,
      targetMode: 'admin',
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch(() => {});

    return {
      success: true,
      distance,
      message: `İşe girişiniz başarıyla onaylandı! (İş yerine mesafe: ${LocationService.formatDistance(distance)})`,
    };
  };

  // Staff check-out (Must be outside 10 meters of workplace)
  const checkOutStaff = async (): Promise<{ success: boolean; message: string; distance?: number }> => {
    if (!user) {
      return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    }
    if (!workplaceLocation || !workplaceLocation.latitude || !workplaceLocation.longitude) {
      return {
        success: false,
        message: 'İş yeri konumu henüz belirlenmemiş.',
      };
    }

    // Find user's active check-in record
    const recordIndex = attendanceRecords.findIndex(
      (r) => r.userId === user.id && r.status === 'checked_in'
    );

    if (recordIndex === -1) {
      return {
        success: false,
        message: 'Aktif bir işe giriş kaydınız bulunmuyor. Önce işe giriş yapmalısınız.',
      };
    }

    const record = attendanceRecords[recordIndex];

    let userPos;
    try {
      userPos = await LocationService.getCurrentPosition();
    } catch (err: any) {
      return {
        success: false,
        message: `GPS konumu alınamadı: ${err?.message || 'Lütfen cihazınızın konum servisini açın.'}`,
      };
    }

    const distance = LocationService.calculateDistance(
      userPos.latitude,
      userPos.longitude,
      workplaceLocation.latitude,
      workplaceLocation.longitude
    );

    const allowedRadius = workplaceLocation.radiusMeters || 10;

    // Rule: Must be outside 10 meters (> 10m)
    if (distance <= allowedRadius) {
      return {
        success: false,
        distance,
        message: `Hala iş yerinin 10 metre çapı içerisindesiniz (${LocationService.formatDistance(distance)}). İşten çıkış yapabilmek için iş yerinin dışına çıkmış olmalısınız.`,
      };
    }

    const checkOutTime = Date.now();
    const durationMinutes = Math.max(1, Math.round((checkOutTime - record.checkInTime) / 60000));
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationText = hours > 0 ? `${hours} saat ${mins} dakika` : `${mins} dakika`;

    const updatedRecord: AttendanceRecord = {
      ...record,
      checkOutTime,
      checkOutLat: userPos.latitude,
      checkOutLon: userPos.longitude,
      checkOutAddress: userPos.address,
      checkOutDistance: distance,
      status: 'completed',
      workDurationMinutes: durationMinutes,
    };

    const updatedRecords = [...attendanceRecords];
    updatedRecords[recordIndex] = updatedRecord;

    setAttendanceRecords(updatedRecords);
    await StorageService.saveAttendanceRecords(updatedRecords);

    // Push notification to admins
    OneSignalService.sendPushNotification({
      title: '🔴 Personel İşten Çıkış Yaptı',
      message: `${user.name}, saat ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla çıkış yaptı. (Toplam Mesai: ${durationText})`,
      targetMode: 'admin',
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch(() => {});

    return {
      success: true,
      distance,
      message: `İşten çıkışınız onaylandı! Toplam mesai süreniz: ${durationText}.`,
    };
  };

  const deleteAttendanceRecord = async (id: string) => {
    const updated = attendanceRecords.filter((r) => r.id !== id);
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);
  };

  const updateAttendanceRecord = async (id: string, updates: Partial<AttendanceRecord>) => {
    const updated = attendanceRecords.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);
  };

  const refreshAttendance = async () => {
    const [loc, recs] = await Promise.all([
      StorageService.getWorkplaceLocation(),
      StorageService.getAttendanceRecords(),
    ]);
    if (loc) setWorkplaceLocation(loc);
    setAttendanceRecords(recs);
  };

  return (
    <StorageContext.Provider
      value={{
        locations: visibleLocations,
        allLocations,
        standardTasks,
        notes: visibleNotes,
        allNotes,
        returnWarrantyItems,
        services: visibleServices,
        allServices,
        workplaceLocation,
        attendanceRecords,
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
        completeNote,
        approveNote,
        rejectNote,
        addReturnWarrantyItem,
        updateReturnWarrantyItem,
        deleteReturnWarrantyItem,
        addService,
        updateService,
        deleteService,
        updateWorkplaceLocation,
        checkInStaff,
        checkOutStaff,
        deleteAttendanceRecord,
        updateAttendanceRecord,
        refreshAttendance,
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
