import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LocationItem, TaskStatus, GeneralNote, BackupData, NoteTargetMode, ReturnWarrantyItem, ServiceItem, WorkplaceLocation, Branch, AttendanceRecord, AdminReminder, AdminReminderCategory, LeaveRequest, SecurityLogItem } from '../types/storage';
import { isUserAdmin, canUserAddBranch } from '../types/auth';
import { StorageService } from '../services/storageService';
import { DEFAULT_STANDARD_TASKS } from '../constants/defaultTasks';
import { NotificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { OneSignalService } from '../services/oneSignalService';
import { UserService } from '../services/userService';
import { TabType } from '../components/layout/Header';
import { LocationService } from '../services/locationService';
import { DeviceService } from '../services/deviceService';

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
  branches: Branch[];
  attendanceRecords: AttendanceRecord[];
  adminReminders: AdminReminder[];
  leaveRequests: LeaveRequest[];
  securityLogs: SecurityLogItem[];
  unreadLogsCount: number;
  lastReadTime: number;
  badgeCount: number;
  markAllAsRead: () => Promise<void>;
  markSecurityLogsAsRead: () => Promise<void>;
  deleteSecurityLog: (logId: string) => Promise<void>;
  clearAllSecurityLogs: () => Promise<void>;
  isLoading: boolean;
  activeToast: { title: string; body: string; tab?: TabType; filter?: string } | null;
  dismissToast: () => void;
  addLocation: (name: string, cariName?: string) => Promise<void>;
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
  completeLocation: (id: string, completionNote?: string, completionPhotos?: string[]) => Promise<void>;
  approveLocation: (id: string) => Promise<void>;
  rejectLocation: (id: string, reason?: string) => Promise<void>;
  addNote: (
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode?: NoteTargetMode,
    targetUserIds?: string[],
    targetUserNames?: string[],
    photos?: string[],
    cariName?: string
  ) => Promise<void>;
  updateNote: (
    id: string,
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode?: NoteTargetMode,
    targetUserIds?: string[],
    targetUserNames?: string[],
    photos?: string[],
    cariName?: string
  ) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  completeNote: (id: string, completionNote?: string, completionPhotos?: string[]) => Promise<void>;
  approveNote: (id: string) => Promise<void>;
  rejectNote: (id: string, reason?: string) => Promise<void>;
  addAdminReminder: (data: {
    title: string;
    content: string;
    category?: AdminReminderCategory;
    isPinned?: boolean;
    photos?: string[];
    sendPush?: boolean;
  }) => Promise<void>;
  updateAdminReminder: (id: string, updates: Partial<AdminReminder>) => Promise<void>;
  deleteAdminReminder: (id: string) => Promise<void>;
  markReminderAsRead: (id: string) => Promise<void>;
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
  completeService: (id: string, completionNote?: string, completionPhotos?: string[]) => Promise<void>;
  approveService: (id: string) => Promise<void>;
  rejectService: (id: string, reason?: string) => Promise<void>;
  updateWorkplaceLocation: (
    address: string,
    latitude: number,
    longitude: number,
    radiusMeters?: number
  ) => Promise<void>;
  addBranch: (
    branch: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'> & { companyCode?: string }
  ) => Promise<Branch>;
  updateBranch: (id: string, updates: Partial<Branch>) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  assignStaffToBranch: (branchId: string, userIds: string[]) => Promise<void>;
  checkInStaff: (options?: {
    allowOutside?: boolean;
    note?: string;
  }) => Promise<{
    success: boolean;
    message: string;
    distance?: number;
    requiresConfirmation?: boolean;
    confirmationType?: 'checkin' | 'checkout';
    address?: string;
    isPendingApproval?: boolean;
    isLocationDisabled?: boolean;
  }>;
  checkOutStaff: (options?: {
    allowOutside?: boolean;
    note?: string;
  }) => Promise<{
    success: boolean;
    message: string;
    distance?: number;
    requiresConfirmation?: boolean;
    confirmationType?: 'checkin' | 'checkout';
    address?: string;
    isPendingApproval?: boolean;
    isLocationDisabled?: boolean;
  }>;
  approveAttendance: (
    recordId: string,
    actionType: 'checkin' | 'checkout'
  ) => Promise<{ success: boolean; message: string }>;
  rejectAttendance: (
    recordId: string,
    actionType: 'checkin' | 'checkout',
    reason?: string
  ) => Promise<{ success: boolean; message: string }>;
  cancelAttendanceRequest: (recordId: string) => Promise<{ success: boolean; message: string }>;
  deleteAttendanceRecord: (id: string) => Promise<void>;
  updateAttendanceRecord: (id: string, updates: Partial<AttendanceRecord>) => Promise<void>;
  refreshAttendance: () => Promise<void>;
  importBackupData: (backupData: BackupData) => Promise<void>;
  requestLeave: (params: {
    leaveType: 'hourly' | 'daily';
    date: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    durationText: string;
    reason: string;
  }) => Promise<{ success: boolean; message: string }>;
  approveLeaveRequest: (requestId: string) => Promise<{ success: boolean; message: string }>;
  rejectLeaveRequest: (requestId: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  cancelLeaveRequest: (requestId: string) => Promise<{ success: boolean; message: string }>;
  deleteLeaveRequest: (requestId: string) => Promise<void>;
  cariler: string[];
  carilerUpdatedAt: string | null;
  carilerTotal: number;
  importCarilerFromExcelFile: (file: File) => Promise<number>;
  exportCarilerToExcelFile: () => void;
  refreshCariler: () => Promise<void>;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

const sanitizeCompCode = (compCode?: string) => (compCode || 'POLATLAR').trim().toUpperCase();

const SEEN_NOTES_KEY = (userId: string, compCode?: string) => `@seen_notes_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_REMINDERS_KEY = (userId: string, compCode?: string) => `@seen_reminders_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_LOCATIONS_KEY = (userId: string, compCode?: string) => `@seen_locations_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_WARRANTY_REMINDERS_KEY = (userId: string, compCode?: string) => `@seen_warranty_reminders_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_COMPLETED_LOCATIONS_KEY = (userId: string, compCode?: string) => `@seen_completed_locations_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_SERVICES_KEY = (userId: string, compCode?: string) => `@seen_services_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_COMPLETED_NOTES_KEY = (userId: string, compCode?: string) => `@seen_completed_notes_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_APPROVAL_NOTES_KEY = (userId: string, compCode?: string) => `@seen_approval_notes_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_COMPLETED_SERVICES_KEY = (userId: string, compCode?: string) => `@seen_completed_services_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_APPROVAL_SERVICES_KEY = (userId: string, compCode?: string) => `@seen_approval_services_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_APPROVAL_LOCATIONS_KEY = (userId: string, compCode?: string) => `@seen_approval_locations_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_INITIALIZED_KEY = (userId: string, compCode?: string) => `@seen_initialized_${sanitizeCompCode(compCode)}_${userId}`;

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
  const { user, users, company } = useAuth();

  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [standardTasks, setStandardTasks] = useState<string[]>([]);
  const [allNotes, setAllNotes] = useState<GeneralNote[]>([]);
  const [returnWarrantyItems, setReturnWarrantyItems] = useState<ReturnWarrantyItem[]>([]);
  const [allServices, setAllServices] = useState<ServiceItem[]>([]);
  const [workplaceLocation, setWorkplaceLocation] = useState<WorkplaceLocation | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [adminReminders, setAdminReminders] = useState<AdminReminder[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLogItem[]>([]);
  const [cariler, setCariler] = useState<string[]>([]);
  const [carilerUpdatedAt, setCarilerUpdatedAt] = useState<string | null>(null);
  const [carilerTotal, setCarilerTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dataCompanyCode, setDataCompanyCode] = useState<string>('');
  const [activeToast, setActiveToast] = useState<{
    title: string;
    body: string;
    tab?: TabType;
    filter?: string;
  } | null>(null);

  const unreadLogsCount = useMemo(() => securityLogs.filter((l) => !l.read).length, [securityLogs]);

  // Load initial data on mount + Supabase Realtime listener
  useEffect(() => {
    if (!user) {
      setAllLocations([]);
      setStandardTasks([]);
      setAllNotes([]);
      setReturnWarrantyItems([]);
      setAllServices([]);
      setWorkplaceLocation(null);
      setBranches([]);
      setAttendanceRecords([]);
      setAdminReminders([]);
      setLeaveRequests([]);
      setSecurityLogs([]);
      setCariler([]);
      setCarilerUpdatedAt(null);
      setCarilerTotal(0);
      setIsLoading(false);
      setDataCompanyCode('');
      return;
    }

    const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
    const compId = company?.id || (compCode === 'POLATLAR' ? 1 : undefined);

    // Immediately clear state from any previous company / session and indicate loading
    setAllLocations([]);
    setStandardTasks([]);
    setAllNotes([]);
    setReturnWarrantyItems([]);
    setAllServices([]);
    setWorkplaceLocation(null);
    setBranches([]);
    setAttendanceRecords([]);
    setAdminReminders([]);
    setLeaveRequests([]);
    setSecurityLogs([]);
    setCariler([]);
    setCarilerUpdatedAt(null);
    setCarilerTotal(0);
    setIsLoading(true);
    setDataCompanyCode('');

    StorageService.setCompany(compCode, compId);

    let isMounted = true;
    const isPolatlar = compCode === 'POLATLAR';

    const initData = async () => {
      try {
        const [locs, tasks, nts, returns, srvs, wpLoc, branchList, attRecs, reminders, cariData, leaveReqs, secLogs] = await Promise.all([
          StorageService.getLocations(),
          StorageService.getStandardTasks(),
          StorageService.getNotes(),
          StorageService.getReturnWarrantyItems(),
          StorageService.getServices(),
          StorageService.getWorkplaceLocation(),
          StorageService.getBranches(),
          StorageService.getAttendanceRecords(),
          StorageService.getAdminReminders(),
          StorageService.getCarilerData(),
          StorageService.getLeaveRequests(),
          StorageService.getSecurityLogs(),
        ]);
        if (!isMounted) return;

        const migratedLocs = locs.map((l) => ({
          ...l,
          createdBy: l.createdBy || 'admin-root',
          createdByName: l.createdByName || 'Sistem Yöneticisi',
        }));

        // First-time device seeding: Seed existing historical records so they don't blast notifications on first login
        const initKey = SEEN_INITIALIZED_KEY(user.id, compCode);
        if (localStorage.getItem(initKey) === null) {
          const now = Date.now();

          // 1. Locations
          const seenLocs = getStoredSet(SEEN_LOCATIONS_KEY(user.id, compCode));
          migratedLocs.forEach((l) => seenLocs.add(l.id));
          saveStoredSet(SEEN_LOCATIONS_KEY(user.id, compCode), seenLocs);

          // 2. Completed Locations
          const seenCompletedLocs = getStoredSet(SEEN_COMPLETED_LOCATIONS_KEY(user.id, compCode));
          migratedLocs.forEach((l) => {
            const isComplete =
              l.tasks.length > 0 &&
              l.tasks.every((t) => t.status === 'completed' || t.status === 'not_present');
            if (isComplete) seenCompletedLocs.add(l.id);
          });
          saveStoredSet(SEEN_COMPLETED_LOCATIONS_KEY(user.id, compCode), seenCompletedLocs);

          // 3. Services
          const seenServices = getStoredSet(SEEN_SERVICES_KEY(user.id, compCode));
          srvs.forEach((s) => seenServices.add(s.id));
          saveStoredSet(SEEN_SERVICES_KEY(user.id, compCode), seenServices);

          // 4. Notes
          const seenNotes = getStoredSet(SEEN_NOTES_KEY(user.id, compCode));
          nts.forEach((n) => seenNotes.add(n.id));
          saveStoredSet(SEEN_NOTES_KEY(user.id, compCode), seenNotes);

          // 5. Timed Reminders
          const seenReminders = getStoredSet(SEEN_REMINDERS_KEY(user.id, compCode));
          nts.forEach((n) => {
            if (n.reminderActive && n.reminderDate) {
              const reminderTime = new Date(n.reminderDate).getTime();
              if (reminderTime <= now) seenReminders.add(n.id);
            }
          });
          saveStoredSet(SEEN_REMINDERS_KEY(user.id, compCode), seenReminders);

          // 6. Warranty Reminders
          const seenWarranty = getStoredSet(SEEN_WARRANTY_REMINDERS_KEY(user.id, compCode));
          returns.forEach((r) => {
            if (r.reminderActive && r.reminderDate) {
              const reminderTime = new Date(r.reminderDate).getTime();
              if (reminderTime <= now) seenWarranty.add(r.id);
            }
          });
          saveStoredSet(SEEN_WARRANTY_REMINDERS_KEY(user.id, compCode), seenWarranty);

          // 7. Completed Notes
          const seenCompletedNotes = getStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id, compCode));
          nts.forEach((n) => {
            if (n.status === 'pending_approval' && n.completedAt) {
              seenCompletedNotes.add(`${n.id}_${n.completedAt}`);
            }
          });
          saveStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id, compCode), seenCompletedNotes);

          // 8. Approved/Rejected Notes
          const seenApprovalNotes = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode));
          nts.forEach((n) => {
            if (n.status === 'approved' && n.approvedAt) {
              seenApprovalNotes.add(`${n.id}_approved_${n.approvedAt}`);
            }
            if (n.status === 'rejected' && n.rejectedAt) {
              seenApprovalNotes.add(`${n.id}_rejected_${n.rejectedAt}`);
            }
          });
          saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode), seenApprovalNotes);

          // 9. Completed Services
          const seenCompletedServices = getStoredSet(SEEN_COMPLETED_SERVICES_KEY(user.id, compCode));
          srvs.forEach((s) => {
            if (s.status === 'pending_approval' && s.completedAt) {
              seenCompletedServices.add(`${s.id}_${s.completedAt}`);
            }
          });
          saveStoredSet(SEEN_COMPLETED_SERVICES_KEY(user.id, compCode), seenCompletedServices);

          // 10. Approved/Rejected Services
          const seenApprovalServices = getStoredSet(SEEN_APPROVAL_SERVICES_KEY(user.id, compCode));
          srvs.forEach((s) => {
            if (s.status === 'approved' && s.approvedAt) {
              seenApprovalServices.add(`${s.id}_approved_${s.approvedAt}`);
            }
            if (s.status === 'rejected' && s.rejectedAt) {
              seenApprovalServices.add(`${s.id}_rejected_${s.rejectedAt}`);
            }
          });
          saveStoredSet(SEEN_APPROVAL_SERVICES_KEY(user.id, compCode), seenApprovalServices);

          // 11. Approved/Rejected Locations
          const seenApprovalLocations = getStoredSet(SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode));
          migratedLocs.forEach((l) => {
            if (l.status === 'pending_approval' && l.completedAt) {
              seenApprovalLocations.add(`${l.id}_pending_${l.completedAt}`);
            }
            if (l.status === 'approved' && l.approvedAt) {
              seenApprovalLocations.add(`${l.id}_approved_${l.approvedAt}`);
            }
            if (l.status === 'rejected' && l.rejectedAt) {
              seenApprovalLocations.add(`${l.id}_rejected_${l.rejectedAt}`);
            }
          });
          saveStoredSet(SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode), seenApprovalLocations);

          localStorage.setItem(initKey, 'true');
        }

        setAllLocations(migratedLocs);
        setStandardTasks(tasks);
        setAllNotes(nts);
        setReturnWarrantyItems(returns);
        setAllServices(srvs);
        if (wpLoc) {
          const finalWp = { ...wpLoc, radiusMeters: (!wpLoc.radiusMeters || wpLoc.radiusMeters === 10) ? 20 : wpLoc.radiusMeters };
          setWorkplaceLocation(finalWp);
        } else {
          setWorkplaceLocation(null);
        }
        setBranches(branchList);
        setAttendanceRecords(attRecs);
        setAdminReminders(reminders);
        setLeaveRequests(leaveReqs);
        setSecurityLogs(secLogs);
        setCariler(cariData.cariler);
        setCarilerUpdatedAt(cariData.updatedAt);
        setCarilerTotal(cariData.total);
        setDataCompanyCode(compCode);
      } catch (err) {
        console.error('Veriler yüklenirken hata oluştu:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    initData();

    // Realtime listeners for locations, notes, standard_tasks, return_warranty & services
    const channel = supabase
      .channel(`schema-db-changes-${compCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        async () => {
          if (!isMounted) return;
          if (isPolatlar) {
            const locs = await StorageService.getLocations();
            if (isMounted) setAllLocations(locs);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        async () => {
          if (!isMounted) return;
          if (isPolatlar) {
            const nts = await StorageService.getNotes();
            if (isMounted) setAllNotes(nts);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'standard_tasks' },
        async () => {
          if (!isMounted) return;
          const [tasks, returns, srvs, nts, wpLoc, branchList, attRecs, reminders, leaveReqs, secLogs, locs, cariData] = await Promise.all([
            StorageService.getStandardTasks(),
            StorageService.getReturnWarrantyItems(),
            StorageService.getServices(),
            StorageService.getNotes(),
            StorageService.getWorkplaceLocation(),
            StorageService.getBranches(),
            StorageService.getAttendanceRecords(),
            StorageService.getAdminReminders(),
            StorageService.getLeaveRequests(),
            StorageService.getSecurityLogs(),
            StorageService.getLocations(),
            StorageService.getCarilerData(),
          ]);
          if (!isMounted) return;
          setStandardTasks(tasks);
          setReturnWarrantyItems(returns);
          setAllServices(srvs);
          setAllNotes(nts);
          setAllLocations(locs);
          if (wpLoc) {
            const finalWp = { ...wpLoc, radiusMeters: (!wpLoc.radiusMeters || wpLoc.radiusMeters === 10) ? 20 : wpLoc.radiusMeters };
            setWorkplaceLocation(finalWp);
          } else {
            setWorkplaceLocation(null);
          }
          setBranches(branchList);
          setAttendanceRecords(attRecs);
          setAdminReminders(reminders);
          setLeaveRequests(leaveReqs);
          setSecurityLogs(secLogs);
          setCariler(cariData.cariler);
          setCarilerUpdatedAt(cariData.updatedAt);
          setCarilerTotal(cariData.total);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'return_warranty' },
        async () => {
          if (!isMounted) return;
          if (isPolatlar) {
            const returns = await StorageService.getReturnWarrantyItems();
            if (isMounted) setReturnWarrantyItems(returns);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        async () => {
          if (!isMounted) return;
          if (isPolatlar) {
            const srvs = await StorageService.getServices();
            if (isMounted) setAllServices(srvs);
          }
        }
      )
      .subscribe();

    // High-frequency background sync for mobile devices
    const syncInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const [locs, nts, returns, srvs, wpLoc, branchList, attRecs] = await Promise.all([
          StorageService.getLocations(),
          StorageService.getNotes(),
          StorageService.getReturnWarrantyItems(),
          StorageService.getServices(),
          StorageService.getWorkplaceLocation(),
          StorageService.getBranches(),
          StorageService.getAttendanceRecords(),
        ]);
        if (!isMounted) return;
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
        setBranches((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(branchList)) {
            return branchList;
          }
          return prev;
        });
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
      isMounted = false;
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
    };
  }, [user?.id, user?.companyCode, company?.id]);

  // Filter locations based on role:
  // Admin -> Sees ALL locations from all staff members
  // Staff (Saha Yetkilisi) -> ONLY sees locations created by himself
  const visibleLocations = useMemo(() => {
    if (!user) return [];
    if (isUserAdmin(user)) {
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
    if (isUserAdmin(user)) {
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
    if (isUserAdmin(user)) {
      return allServices;
    }
    // Staff role: strictly only own creations
    return allServices.filter(
      (srv) => srv.createdBy === user.id || (srv.createdByName && srv.createdByName === user.name)
    );
  }, [allServices, user]);

  // Check incoming direct notes & timed reminders per user device
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || allNotes.length === 0) return;

    const notesStorageKey = SEEN_NOTES_KEY(user.id, compCode);
    const remindersStorageKey = SEEN_REMINDERS_KEY(user.id, compCode);

    if (localStorage.getItem(notesStorageKey) === null) {
      const seenNotes = getStoredSet(notesStorageKey);
      allNotes.forEach((n) => seenNotes.add(n.id));
      saveStoredSet(notesStorageKey, seenNotes);
      return;
    }

    const seenNotes = getStoredSet(notesStorageKey);
    const seenReminders = getStoredSet(remindersStorageKey);
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
      saveStoredSet(notesStorageKey, seenNotes);
    }
    if (seenRemindersChanged) {
      saveStoredSet(remindersStorageKey, seenReminders);
    }
  }, [allNotes, user, dataCompanyCode]);

  // Check return & warranty reminders for all users (1-week auto or custom reminder)
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || returnWarrantyItems.length === 0) return;

    const storageKey = SEEN_WARRANTY_REMINDERS_KEY(user.id, compCode);
    const seenWarrantyReminders = getStoredSet(storageKey);
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
          const targetName = item.cariName ? `${item.cariName} (${item.companyName})` : item.companyName;
          const title = `🛡️ ${typeLabel} Durum Takibi: ${targetName}`;
          const body = `${targetName} için gönderilen ${typeLabel.toLowerCase()} ürününün durum sorgulama tarihi geldi. Lütfen son durumunu sorgulayın.`;
          NotificationService.sendNotification(title, body);
          setActiveToast({ title, body, tab: 'returns' });
        }
      }
    });

    if (seenWarrantyChanged) {
      saveStoredSet(storageKey, seenWarrantyReminders);
    }
  }, [returnWarrantyItems, user, dataCompanyCode]);

  // Check incoming locations from staff members (Admin notification)
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || user.role !== 'admin' || dataCompanyCode.toUpperCase() !== compCode || allLocations.length === 0) return;

    const storageKey = SEEN_LOCATIONS_KEY(user.id, compCode);
    if (localStorage.getItem(storageKey) === null) {
      const seenLocs = getStoredSet(storageKey);
      allLocations.forEach((loc) => seenLocs.add(loc.id));
      saveStoredSet(storageKey, seenLocs);
      return;
    }

    const seenLocs = getStoredSet(storageKey);
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
      saveStoredSet(storageKey, seenLocs);
    }
  }, [allLocations, user, dataCompanyCode]);

  // Check completed locations from staff members (Admin notification)
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || user.role !== 'admin' || dataCompanyCode.toUpperCase() !== compCode || allLocations.length === 0) return;

    const storageKey = SEEN_COMPLETED_LOCATIONS_KEY(user.id, compCode);
    if (localStorage.getItem(storageKey) === null) {
      const seenDone = getStoredSet(storageKey);
      allLocations.forEach((loc) => {
        const isComplete =
          loc.tasks.length > 0 &&
          loc.tasks.every((t) => t.status === 'completed' || t.status === 'not_present');
        if (isComplete) seenDone.add(loc.id);
      });
      saveStoredSet(storageKey, seenDone);
      return;
    }

    const seenDone = getStoredSet(storageKey);
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
      saveStoredSet(storageKey, seenDone);
    }
  }, [allLocations, user, dataCompanyCode]);

  // Check incoming services from staff members (Admin notification)
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || user.role !== 'admin' || dataCompanyCode.toUpperCase() !== compCode || allServices.length === 0) return;

    const storageKey = SEEN_SERVICES_KEY(user.id, compCode);
    if (localStorage.getItem(storageKey) === null) {
      const seenServices = getStoredSet(storageKey);
      allServices.forEach((srv) => seenServices.add(srv.id));
      saveStoredSet(storageKey, seenServices);
      return;
    }

    const seenServices = getStoredSet(storageKey);
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
      saveStoredSet(storageKey, seenServices);
    }
  }, [allServices, user, dataCompanyCode]);

  // Check incoming note completions (for Admin) & approval/rejection results (for Staff)
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || allNotes.length === 0) return;

    // 1. For Admin: Alert when a staff member completes a work order (pending_approval)
    if (isUserAdmin(user)) {
      const completedStorageKey = SEEN_COMPLETED_NOTES_KEY(user.id, compCode);
      const seenCompleted = getStoredSet(completedStorageKey);
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
        saveStoredSet(completedStorageKey, seenCompleted);
      }
    }

    // 2. For Staff: Alert when Admin approves or rejects the staff's work order
    if (user.role !== 'admin') {
      const approvalStorageKey = SEEN_APPROVAL_NOTES_KEY(user.id, compCode);
      const seenApproval = getStoredSet(approvalStorageKey);
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
        saveStoredSet(approvalStorageKey, seenApproval);
      }
    }
  }, [allNotes, user, dataCompanyCode]);

  // Check incoming service completions (for Admin) & approval/rejection results (for Staff)
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || allServices.length === 0) return;

    // 1. For Admin: Alert when a staff member completes a service (pending_approval)
    if (isUserAdmin(user)) {
      const completedStorageKey = SEEN_COMPLETED_SERVICES_KEY(user.id, compCode);
      const seenCompleted = getStoredSet(completedStorageKey);
      let seenChanged = false;

      allServices.forEach((s) => {
        if (s.status === 'pending_approval' && s.completedAt && s.completedBy !== user.id) {
          const key = `${s.id}_${s.completedAt}`;
          if (!seenCompleted.has(key)) {
            seenCompleted.add(key);
            seenChanged = true;

            const staff = s.completedByName || 'Saha Yetkilisi';
            const title = '🔧 Servis Onay Bekliyor!';
            const body = `${staff}, "${s.companyName}" servis kaydını tamamladı.${s.completionNote ? ` Not: ${s.completionNote}` : ''}`;
            NotificationService.sendNotification(title, body);
            setActiveToast({ title, body, tab: 'services', filter: 'pending_approval' });
          }
        }
      });

      if (seenChanged) {
        saveStoredSet(completedStorageKey, seenCompleted);
      }
    }

    // 2. For Staff: Alert when Admin approves or rejects the staff's service
    if (user.role !== 'admin') {
      const approvalStorageKey = SEEN_APPROVAL_SERVICES_KEY(user.id, compCode);
      const seenApproval = getStoredSet(approvalStorageKey);
      let seenChanged = false;

      allServices.forEach((s) => {
        const isMyService = s.completedBy === user.id || s.createdBy === user.id;

        if (isMyService) {
          // Check Approved
          if (s.status === 'approved' && s.approvedAt) {
            const key = `${s.id}_approved_${s.approvedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;

              const admin = s.approvedByName || 'Yönetici';
              const title = '✅ Servis Kaydınız Onaylandı!';
              const body = `${admin}, "${s.companyName}" servis kaydınızı başarıyla onayladı.`;
              NotificationService.sendNotification(title, body);
              setActiveToast({ title, body, tab: 'services', filter: 'approved' });
            }
          }

          // Check Rejected
          if (s.status === 'rejected' && s.rejectedAt) {
            const key = `${s.id}_rejected_${s.rejectedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;

              const admin = s.rejectedByName || 'Yönetici';
              const title = '❌ Servis Kaydınız Reddedildi!';
              const body = `${admin}, "${s.companyName}" servis kaydını reddetti. Gerekçe: ${s.rejectionReason || 'Eksikler var'}`;
              NotificationService.sendNotification(title, body);
              setActiveToast({ title, body, tab: 'services', filter: 'rejected' });
            }
          }
        }
      });

      if (seenChanged) {
        saveStoredSet(approvalStorageKey, seenApproval);
      }
    }
  }, [allServices, user, dataCompanyCode]);

  // Check incoming location completions (for Admin) & approval/rejection results (for Staff)
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || allLocations.length === 0) return;

    // 1. For Admin: Alert when a staff member completes a location (pending_approval)
    if (isUserAdmin(user)) {
      const completedStorageKey = SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode);
      const seenCompleted = getStoredSet(completedStorageKey);
      let seenChanged = false;

      allLocations.forEach((loc) => {
        if (loc.status === 'pending_approval' && loc.completedAt && loc.completedBy !== user.id) {
          const key = `${loc.id}_pending_${loc.completedAt}`;
          if (!seenCompleted.has(key)) {
            seenCompleted.add(key);
            seenChanged = true;

            const staff = loc.completedByName || 'Saha Personeli';
            const title = '📍 Kurulum Onay Bekliyor!';
            const body = `${staff}, "${loc.name}" kurulumunu tamamladı.${loc.completionNote ? ` Not: ${loc.completionNote}` : ''}`;
            NotificationService.sendNotification(title, body);
            setActiveToast({ title, body, tab: 'installations', filter: 'pending_approval' });
          }
        }
      });

      if (seenChanged) {
        saveStoredSet(completedStorageKey, seenCompleted);
      }
    }

    // 2. For Staff: Alert when Admin approves or rejects the staff's location
    if (user.role !== 'admin') {
      const approvalStorageKey = SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode);
      const seenApproval = getStoredSet(approvalStorageKey);
      let seenChanged = false;

      allLocations.forEach((loc) => {
        const isMyLoc = loc.completedBy === user.id || loc.createdBy === user.id;

        if (isMyLoc) {
          // Check Approved
          if (loc.status === 'approved' && loc.approvedAt) {
            const key = `${loc.id}_approved_${loc.approvedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;

              const admin = loc.approvedByName || 'Yönetici';
              const title = '✅ Kurulumunuz Onaylandı!';
              const body = `${admin}, "${loc.name}" kurulumunuzu başarıyla onayladı.`;
              NotificationService.sendNotification(title, body);
              setActiveToast({ title, body, tab: 'installations', filter: 'approved' });
            }
          }

          // Check Rejected
          if (loc.status === 'rejected' && loc.rejectedAt) {
            const key = `${loc.id}_rejected_${loc.rejectedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;

              const admin = loc.rejectedByName || 'Yönetici';
              const title = '❌ Kurulumunuz Reddedildi!';
              const body = `${admin}, "${loc.name}" kurulumunu reddetti. Gerekçe: ${loc.rejectionReason || 'Eksikler var'}`;
              NotificationService.sendNotification(title, body);
              setActiveToast({ title, body, tab: 'installations', filter: 'rejected' });
            }
          }
        }
      });

      if (seenChanged) {
        saveStoredSet(approvalStorageKey, seenApproval);
      }
    }
  }, [allLocations, user, dataCompanyCode]);

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

  // Save services helper
  const saveServices = async (newServices: ServiceItem[]) => {
    setAllServices(newServices);
    await StorageService.saveServices(newServices);
  };

  // Add location with creator tracking & Admin notification
  const addLocation = async (name: string, cariName?: string) => {
    if (!name.trim()) return;
    const newLocation: LocationItem = {
      id: generateId(),
      name: name.trim(),
      cariName: cariName?.trim() || undefined,
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
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenLocs = getStoredSet(SEEN_LOCATIONS_KEY(user.id, compCode));
      seenLocs.add(newLocation.id);
      saveStoredSet(SEEN_LOCATIONS_KEY(user.id, compCode), seenLocs);
    }

    const newLocations = [newLocation, ...allLocations];
    await saveLocations(newLocations);

    // If added by Field Staff, send hardware push notification directly to all Admins!
    if (!isUserAdmin(user)) {
      const adminIds = users.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
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
    const target = allLocations.find((l) => l.id === id);
    if (!target) return;
    if (!isUserAdmin(user) && target.createdBy !== user?.id) {
      alert('Yalnızca kendi eklediğiniz kurulum kayıtlarını silebilirsiniz.');
      return;
    }

    const updated = allLocations.filter((l) => l.id !== id);
    await saveLocations(updated);
  };

  // Update task status inside a location (guarded: admin or creator only)
  const updateTaskStatus = async (locationId: string, taskId: string, status: TaskStatus) => {
    const target = allLocations.find((loc) => loc.id === locationId);
    if (target && !isUserAdmin(user) && target.createdBy !== user?.id) {
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
              return {
                ...task,
                status,
                completedAt: status === 'completed' ? new Date().toISOString() : undefined,
              };
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
      const adminIds = users.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);

      if (adminIds.length > 0) {
        await OneSignalService.sendPushNotification({
          title: '✅ Kurulum Tamamlandı!',
          message: `${staffName}, "${updatedTarget.name}" kurulumundaki tüm görevleri başarıyla tamamladı.`,
          targetMode: 'custom',
          targetUserIds: adminIds,
          url: 'https://saha-takip-beige.vercel.app/?tab=installations',
        });
      }

      if (isUserAdmin(user)) {
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
    const isPolatlar = (user?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR';
    await saveStandardTasks(isPolatlar ? DEFAULT_STANDARD_TASKS : []);
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

  // Complete location checklist & submit for admin approval
  const completeLocation = async (id: string, completionNote?: string, completionPhotos?: string[]) => {
    const targetLocation = allLocations.find((l) => l.id === id);
    if (!targetLocation) return;

    const completedAt = Date.now();
    const staffName = user?.name || user?.username || 'Saha Personeli';
    const trimmedNote = completionNote?.trim() || undefined;

    const newLocations = allLocations.map((l) => {
      if (l.id === id) {
        return {
          ...l,
          status: 'pending_approval' as const,
          completedAt,
          completedBy: user?.id,
          completedByName: staffName,
          completionNote: trimmedNote,
          completionPhotos: completionPhotos !== undefined ? completionPhotos : l.completionPhotos || [],
          // Reset previous rejection if resubmitted
          rejectedAt: undefined,
          rejectedBy: undefined,
          rejectedByName: undefined,
          rejectionReason: undefined,
        };
      }
      return l;
    });

    // Mark as seen on staff device immediately
    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode));
      seenApprovals.add(`${id}_pending_${completedAt}`);
      saveStoredSet(SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode), seenApprovals);
    }

    await saveLocations(newLocations);

    // Send instant hardware push notification to Admin(s)
    let adminIds = users.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
    if (adminIds.length === 0) {
      try {
        const cloudUsers = await UserService.fetchUsersFromCloud();
        adminIds = cloudUsers.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
      } catch {
        // ignore
      }
    }
    if (adminIds.length === 0) {
      adminIds = ['admin-1'];
    }

    const locSnippet = targetLocation.name.length > 50 ? `${targetLocation.name.slice(0, 50)}...` : targetLocation.name;
    const locExplanation = trimmedNote ? `\nAçıklama: ${trimmedNote}` : '';

    await OneSignalService.sendPushNotification({
      title: '📍 Kurulum Tamamlandı (Onay Bekliyor)',
      message: `${staffName}, "${locSnippet}" kurulumunu tamamladı ve onayınıza sundu.${locExplanation}`,
      targetMode: 'custom',
      targetUserIds: adminIds,
      url: 'https://saha-takip-beige.vercel.app/?tab=installations&filter=pending_approval',
    });

    await OneSignalService.sendPushNotification({
      title: '📍 Kurulum Tamamlandı (Onay Bekliyor)',
      message: `${staffName}, "${locSnippet}" kurulumunu tamamladı ve onayınıza sundu.${locExplanation}`,
      targetMode: 'admin',
      url: 'https://saha-takip-beige.vercel.app/?tab=installations&filter=pending_approval',
    });
  };

  // Admin approves completed location
  const approveLocation = async (id: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler kurulum kayıtlarını onaylayabilir.');
      return;
    }

    const targetLoc = allLocations.find((l) => l.id === id);
    if (!targetLoc) return;

    const approvedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';

    const newLocations = allLocations.map((l) => {
      if (l.id === id) {
        return {
          ...l,
          status: 'approved' as const,
          approvedAt,
          approvedBy: user?.id,
          approvedByName: adminName,
        };
      }
      return l;
    });

    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode));
      seenApprovals.add(`${id}_approved_${approvedAt}`);
      saveStoredSet(SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode), seenApprovals);
    }

    await saveLocations(newLocations);

    const targetRecipientIds = Array.from(
      new Set(
        [targetLoc.completedBy, targetLoc.createdBy].filter(Boolean) as string[]
      )
    );

    const locSnippet = targetLoc.name.length > 50 ? `${targetLoc.name.slice(0, 50)}...` : targetLoc.name;

    if (targetRecipientIds.length > 0) {
      await OneSignalService.sendPushNotification({
        title: '✅ Kurulum Onaylandı!',
        message: `${adminName}, "${locSnippet}" kurulumunuzu onayladı.`,
        targetMode: 'custom',
        targetUserIds: targetRecipientIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=installations&filter=approved',
      });
    }
  };

  // Admin rejects completed location with reason
  const rejectLocation = async (id: string, reason?: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler kurulum kayıtlarını reddedebilir.');
      return;
    }

    const targetLoc = allLocations.find((l) => l.id === id);
    if (!targetLoc) return;

    const rejectedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';
    const trimmedReason = reason?.trim() || 'Yönetici tarafından eksik görüldü';

    const newLocations = allLocations.map((l) => {
      if (l.id === id) {
        return {
          ...l,
          status: 'rejected' as const,
          rejectedAt,
          rejectedBy: user?.id,
          rejectedByName: adminName,
          rejectionReason: trimmedReason,
        };
      }
      return l;
    });

    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode));
      seenApprovals.add(`${id}_rejected_${rejectedAt}`);
      saveStoredSet(SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode), seenApprovals);
    }

    await saveLocations(newLocations);

    const targetRecipientIds = Array.from(
      new Set(
        [targetLoc.completedBy, targetLoc.createdBy].filter(Boolean) as string[]
      )
    );

    const locSnippet = targetLoc.name.length > 50 ? `${targetLoc.name.slice(0, 50)}...` : targetLoc.name;

    if (targetRecipientIds.length > 0) {
      await OneSignalService.sendPushNotification({
        title: '❌ Kurulum Reddedildi!',
        message: `${adminName}, "${locSnippet}" kurulumunu reddetti. Gerekçe: ${trimmedReason}`,
        targetMode: 'custom',
        targetUserIds: targetRecipientIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=installations&filter=rejected',
      });
    }
  };

  // Add general note with single/multi target user sharing and photo support
  const addNote = async (
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode: NoteTargetMode = 'self',
    targetUserIds?: string[],
    targetUserNames?: string[],
    photos?: string[],
    cariName?: string
  ) => {
    if (!content.trim()) return;
    const newNote: GeneralNote = {
      id: generateId(),
      cariName: cariName?.trim() || undefined,
      content: content.trim(),
      photos: photos || [],
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
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenNotes = getStoredSet(SEEN_NOTES_KEY(user.id, compCode));
      seenNotes.add(newNote.id);
      saveStoredSet(SEEN_NOTES_KEY(user.id, compCode), seenNotes);
    }

    // Send hardware push notification directly to locked phones via OneSignal
    if (targetMode !== 'self') {
      const notifTitle = newNote.cariName
        ? `📋 ${newNote.cariName} - İş Emri (${newNote.createdByName})`
        : `📋 ${newNote.createdByName} Size Yeni Bir İş Emri İletti!`;

      const notifMsg = newNote.cariName
        ? `🏢 CARİ: ${newNote.cariName}\n📝 ${newNote.content}`
        : newNote.content;

      // 1. Immediate arrival alert
      await OneSignalService.sendPushNotification({
        title: notifTitle,
        message: notifMsg,
        targetMode,
        targetUserIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=pending',
      });

      // 2. Scheduled reminder alert (OneSignal server will wake up locked phone at exact reminder time)
      if (reminderActive && reminderDate) {
        await OneSignalService.sendPushNotification({
          title: newNote.cariName ? `⏰ [${newNote.cariName}] Hatırlatıcı` : `⏰ İş Emri Hatırlatıcısı (${newNote.createdByName})`,
          message: notifMsg,
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

  // Update general note with single/multi target user sharing and photo support
  const updateNote = async (
    id: string,
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode?: NoteTargetMode,
    targetUserIds?: string[],
    targetUserNames?: string[],
    photos?: string[],
    cariName?: string
  ) => {
    if (!content.trim()) return;
    const newNotes = allNotes.map((n) => {
      if (n.id === id) {
        const nextMode = targetMode !== undefined ? targetMode : n.targetMode || 'self';
        const nextIds = targetUserIds !== undefined ? targetUserIds : n.targetUserIds || [];
        const nextNames = targetUserNames !== undefined ? targetUserNames : n.targetUserNames || [];

        return {
          ...n,
          cariName: cariName !== undefined ? (cariName.trim() || undefined) : n.cariName,
          content: content.trim(),
          reminderActive,
          reminderDate: reminderActive ? reminderDate : undefined,
          targetMode: nextMode,
          targetUserIds: nextIds,
          targetUserNames: nextNames,
          targetUserId: nextMode === 'all' ? 'all' : nextMode === 'self' ? 'self' : nextIds[0] || 'self',
          targetUserName: nextMode === 'all' ? 'Tüm Personeller' : nextMode === 'self' ? 'Sadece Kendim' : nextNames.join(', ') || 'Özel',
          photos: photos !== undefined ? photos : n.photos || [],
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
  const completeNote = async (id: string, completionNote?: string, completionPhotos?: string[]) => {
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
          completionPhotos: completionPhotos !== undefined ? completionPhotos : n.completionPhotos || [],
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
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenCompleted = getStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id, compCode));
      seenCompleted.add(`${id}_${completedAt}`);
      saveStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id, compCode), seenCompleted);
    }

    await saveNotes(newNotes);

    // Send instant hardware push notification to Admin(s)
    let adminIds = users.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
    if (adminIds.length === 0) {
      try {
        const cloudUsers = await UserService.fetchUsersFromCloud();
        adminIds = cloudUsers.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
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
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode));
      seenApprovals.add(`${id}_approved_${approvedAt}`);
      saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode), seenApprovals);
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
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode));
      seenApprovals.add(`${id}_rejected_${rejectedAt}`);
      saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode), seenApprovals);
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

  // Admin Reminder / Directive Management
  const addAdminReminder = async (data: {
    title: string;
    content: string;
    category?: AdminReminderCategory;
    isPinned?: boolean;
    photos?: string[];
    sendPush?: boolean;
  }) => {
    if (!data.title.trim() || !data.content.trim()) return;

    const newReminder: AdminReminder = {
      id: generateId(),
      title: data.title.trim(),
      content: data.content.trim(),
      category: data.category || 'general',
      isPinned: data.isPinned || false,
      photos: data.photos || [],
      createdAt: Date.now(),
      createdBy: user?.id,
      createdByName: user?.name || user?.username || 'Yönetici',
      readBy: user?.id ? [user.id] : [],
    };

    const updated = [newReminder, ...adminReminders];
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);

    if (data.sendPush !== false) {
      // Send push notification to all personnel
      OneSignalService.sendPushNotification({
        title: `📢 Yönetici Hatırlatması: ${newReminder.title}`,
        message: newReminder.content.slice(0, 100),
        targetMode: 'all',
        url: 'https://saha-takip-beige.vercel.app/?tab=reminders',
      }).catch(() => {});
    }
  };

  const updateAdminReminder = async (id: string, updates: Partial<AdminReminder>) => {
    const updated = adminReminders.map((r) =>
      r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
    );
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);
  };

  const deleteAdminReminder = async (id: string) => {
    const updated = adminReminders.filter((r) => r.id !== id);
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);
  };

  const markReminderAsRead = async (id: string) => {
    if (!user?.id) return;
    const updated = adminReminders.map((r) => {
      if (r.id === id) {
        const currentRead = r.readBy || [];
        if (!currentRead.includes(user.id)) {
          return { ...r, readBy: [...currentRead, user.id] };
        }
      }
      return r;
    });
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);
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
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenServices = getStoredSet(SEEN_SERVICES_KEY(user.id, compCode));
      seenServices.add(newService.id);
      saveStoredSet(SEEN_SERVICES_KEY(user.id, compCode), seenServices);
    }

    const updated = [newService, ...allServices];
    setAllServices(updated);
    await StorageService.saveServices(updated);

    // If added by Field Staff, send hardware push notification directly to all Admins!
    if (!isUserAdmin(user)) {
      let adminIds = users.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
      if (adminIds.length === 0) {
        try {
          const cloudUsers = await UserService.fetchUsersFromCloud();
          adminIds = cloudUsers.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
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

  // Complete service & submit for admin approval
  const completeService = async (id: string, completionNote?: string, completionPhotos?: string[]) => {
    const targetService = allServices.find((s) => s.id === id);
    if (!targetService) return;

    const completedAt = Date.now();
    const staffName = user?.name || user?.username || 'Saha Yetkilisi';
    const trimmedNote = completionNote?.trim() || undefined;

    const newServices = allServices.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          status: 'pending_approval' as const,
          completedAt,
          completedBy: user?.id,
          completedByName: staffName,
          completionNote: trimmedNote,
          completionPhotos: completionPhotos !== undefined ? completionPhotos : s.completionPhotos || [],
          // Reset previous rejection if resubmitted
          rejectedAt: undefined,
          rejectedBy: undefined,
          rejectedByName: undefined,
          rejectionReason: undefined,
        };
      }
      return s;
    });

    // Mark as seen on staff device immediately
    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenCompleted = getStoredSet(SEEN_COMPLETED_SERVICES_KEY(user.id, compCode));
      seenCompleted.add(`${id}_${completedAt}`);
      saveStoredSet(SEEN_COMPLETED_SERVICES_KEY(user.id, compCode), seenCompleted);
    }

    await saveServices(newServices);

    // Send instant hardware push notification to Admin(s)
    let adminIds = users.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
    if (adminIds.length === 0) {
      try {
        const cloudUsers = await UserService.fetchUsersFromCloud();
        adminIds = cloudUsers.filter((u) => u.role === 'admin' || isUserAdmin(u)).map((u) => u.id);
      } catch {
        // ignore
      }
    }
    if (adminIds.length === 0) {
      adminIds = ['admin-1'];
    }

    const srvSnippet = targetService.companyName.length > 50 ? `${targetService.companyName.slice(0, 50)}...` : targetService.companyName;
    const srvExplanation = trimmedNote ? `\nAçıklama: ${trimmedNote}` : '';

    await OneSignalService.sendPushNotification({
      title: '🔧 Servis Tamamlandı (Onay Bekliyor)',
      message: `${staffName}, "${srvSnippet}" servis kaydını tamamladı ve onayınıza sundu.${srvExplanation}`,
      targetMode: 'custom',
      targetUserIds: adminIds,
      url: 'https://saha-takip-beige.vercel.app/?tab=services&filter=pending_approval',
    });

    await OneSignalService.sendPushNotification({
      title: '🔧 Servis Tamamlandı (Onay Bekliyor)',
      message: `${staffName}, "${srvSnippet}" servis kaydını tamamladı ve onayınıza sundu.${srvExplanation}`,
      targetMode: 'admin',
      url: 'https://saha-takip-beige.vercel.app/?tab=services&filter=pending_approval',
    });
  };

  // Admin approves completed service
  const approveService = async (id: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler servis kayıtlarını onaylayabilir.');
      return;
    }

    const targetService = allServices.find((s) => s.id === id);
    if (!targetService) return;

    const approvedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';

    const newServices = allServices.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          status: 'approved' as const,
          approvedAt,
          approvedBy: user?.id,
          approvedByName: adminName,
        };
      }
      return s;
    });

    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_SERVICES_KEY(user.id, compCode));
      seenApprovals.add(`${id}_approved_${approvedAt}`);
      saveStoredSet(SEEN_APPROVAL_SERVICES_KEY(user.id, compCode), seenApprovals);
    }

    await saveServices(newServices);

    const targetRecipientIds = Array.from(
      new Set(
        [targetService.completedBy, targetService.createdBy].filter(Boolean) as string[]
      )
    );

    const srvSnippet = targetService.companyName.length > 50 ? `${targetService.companyName.slice(0, 50)}...` : targetService.companyName;

    if (targetRecipientIds.length > 0) {
      await OneSignalService.sendPushNotification({
        title: '✅ Servis Onaylandı!',
        message: `${adminName}, "${srvSnippet}" servis kaydınızı onayladı.`,
        targetMode: 'custom',
        targetUserIds: targetRecipientIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=services&filter=approved',
      });
    }
  };

  // Admin rejects completed service with reason
  const rejectService = async (id: string, reason?: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler servis kayıtlarını reddedebilir.');
      return;
    }

    const targetService = allServices.find((s) => s.id === id);
    if (!targetService) return;

    const rejectedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';
    const trimmedReason = reason?.trim() || 'Yönetici tarafından eksik görüldü';

    const newServices = allServices.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          status: 'rejected' as const,
          rejectedAt,
          rejectedBy: user?.id,
          rejectedByName: adminName,
          rejectionReason: trimmedReason,
        };
      }
      return s;
    });

    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_SERVICES_KEY(user.id, compCode));
      seenApprovals.add(`${id}_rejected_${rejectedAt}`);
      saveStoredSet(SEEN_APPROVAL_SERVICES_KEY(user.id, compCode), seenApprovals);
    }

    await saveServices(newServices);

    const targetRecipientIds = Array.from(
      new Set(
        [targetService.completedBy, targetService.createdBy].filter(Boolean) as string[]
      )
    );

    const srvSnippet = targetService.companyName.length > 50 ? `${targetService.companyName.slice(0, 50)}...` : targetService.companyName;

    if (targetRecipientIds.length > 0) {
      await OneSignalService.sendPushNotification({
        title: '❌ Servis Reddedildi!',
        message: `${adminName}, "${srvSnippet}" servis kaydını reddetti. Gerekçe: ${trimmedReason}`,
        targetMode: 'custom',
        targetUserIds: targetRecipientIds,
        url: 'https://saha-takip-beige.vercel.app/?tab=services&filter=rejected',
      });
    }
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
    radiusMeters = 20
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

  // Branch CRUD operations
  const addBranch = async (
    branchData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'> & { companyCode?: string }
  ): Promise<Branch> => {
    if (!canUserAddBranch(user)) {
      alert('Şube ekleme yetkisi sadece ve sadece POLATLAR firmasının yöneticileri olan admin ve murat kullanıcılarına aittir.');
      throw new Error('Unauthorized');
    }

    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const targetCompCode = (branchData.companyCode || currentCompCode).trim().toUpperCase();

    const newBranch: Branch = {
      id: generateId(),
      companyCode: targetCompCode,
      name: branchData.name.trim(),
      address: branchData.address.trim(),
      latitude: branchData.latitude,
      longitude: branchData.longitude,
      radiusMeters: branchData.radiusMeters || 20,
      phone: branchData.phone?.trim() || undefined,
      assignedUserIds: branchData.assignedUserIds || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (targetCompCode === currentCompCode) {
      const updated = [newBranch, ...branches];
      setBranches(updated);
      await StorageService.saveBranches(updated);
    } else {
      // Save directly to the target company's cloud slot 14
      const targetExisting = await StorageService.getBranchesForCompany(targetCompCode);
      const targetUpdated = [newBranch, ...targetExisting];
      await StorageService.saveBranchesForCompany(targetCompCode, targetUpdated);
      alert(`"${targetCompCode}" firmasına "${newBranch.name}" şubesi başarıyla eklendi ve buluta kaydedildi.`);
    }

    return newBranch;
  };

  const updateBranch = async (id: string, updates: Partial<Branch>) => {
    if (!canUserAddBranch(user)) {
      alert('Şube düzenleme yetkisi sadece POLATLAR firmasının yöneticilerine aittir.');
      return;
    }
    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const targetBranch = branches.find((b) => b.id === id);
    const branchCompCode = (targetBranch?.companyCode || currentCompCode).trim().toUpperCase();

    if (branchCompCode === currentCompCode) {
      const updated = branches.map((b) =>
        b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b
      );
      setBranches(updated);
      await StorageService.saveBranches(updated);
    } else {
      const targetExisting = await StorageService.getBranchesForCompany(branchCompCode);
      const targetUpdated = targetExisting.map((b) =>
        b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b
      );
      await StorageService.saveBranchesForCompany(branchCompCode, targetUpdated);
    }
  };

  const deleteBranch = async (id: string) => {
    if (!canUserAddBranch(user)) {
      alert('Şube silme yetkisi sadece POLATLAR firmasının yöneticilerine aittir.');
      return;
    }
    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const targetBranch = branches.find((b) => b.id === id);
    const branchCompCode = (targetBranch?.companyCode || currentCompCode).trim().toUpperCase();

    if (branchCompCode === currentCompCode) {
      const updated = branches.filter((b) => b.id !== id);
      setBranches(updated);
      await StorageService.saveBranches(updated);
    } else {
      const targetExisting = await StorageService.getBranchesForCompany(branchCompCode);
      const targetUpdated = targetExisting.filter((b) => b.id !== id);
      await StorageService.saveBranchesForCompany(branchCompCode, targetUpdated);
    }
  };

  const assignStaffToBranch = async (branchId: string, userIds: string[]) => {
    const updated = branches.map((b) => {
      if (b.id === branchId) {
        return { ...b, assignedUserIds: userIds, updatedAt: Date.now() };
      } else {
        return {
          ...b,
          assignedUserIds: (b.assignedUserIds || []).filter((uid) => !userIds.includes(uid)),
          updatedAt: Date.now(),
        };
      }
    });
    setBranches(updated);
    await StorageService.saveBranches(updated);
  };

  // Staff check-in (Within 20 meters of assigned branch = direct; Outside or other branch = requires manager confirmation & approval)
  const checkInStaff = async (options?: {
    allowOutside?: boolean;
    note?: string;
  }): Promise<{
    success: boolean;
    message: string;
    distance?: number;
    requiresConfirmation?: boolean;
    confirmationType?: 'checkin' | 'checkout';
    address?: string;
    isPendingApproval?: boolean;
    isLocationDisabled?: boolean;
  }> => {
    if (!user) {
      return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    }
    if (user.role !== 'admin') {
      const curDevId = DeviceService.getCurrentDeviceId();
      const devCheck = await DeviceService.verifyDeviceAccess({
        userId: user.id,
        role: user.role,
        currentDeviceId: curDevId,
        userName: user.name,
        username: user.username,
      });
      if (!devCheck.allowed) {
        return {
          success: false,
          message: devCheck.error || 'Bu cihaz yetkili resmi cihazınız değildir. İşe giriş engellendi.',
        };
      }
    }

    const hasBranches = branches && branches.length > 0;
    const hasWorkplace = !!(workplaceLocation && workplaceLocation.latitude && workplaceLocation.longitude);

    if (!hasBranches && !hasWorkplace) {
      return {
        success: false,
        message: 'İş yeri veya şube konumu henüz yönetici tarafından belirlenmemiş. Lütfen yöneticiniz ile iletişime geçin.',
      };
    }

    let userPos;
    try {
      userPos = await LocationService.getCurrentPosition();
    } catch (err: any) {
      return {
        success: false,
        isLocationDisabled: true,
        message: err?.message || 'İşe giriş yapabilmek için konum servislerinin açık olması gerekmektedir. Lütfen cihazınızın konum servisini açın.',
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const existingRecord = attendanceRecords.find(
      (r) => r.userId === user.id && r.date === todayStr && (r.status === 'checked_in' || r.status === 'pending_checkin_approval')
    );

    if (existingRecord) {
      if (existingRecord.status === 'pending_checkin_approval') {
        return {
          success: false,
          message: 'Bugün için zaten yönetici onayı bekleyen bir işe giriş talebiniz bulunmaktadır.',
        };
      }
      return {
        success: false,
        message: 'Bugün için zaten aktif bir işe giriş kaydınız bulunmaktadır.',
      };
    }

    // --- MULTI-BRANCH LOGIC ---
    if (hasBranches) {
      // Find user's assigned branch
      const assignedBranch = branches.find(
        (b) => (b.assignedUserIds && b.assignedUserIds.includes(user.id)) || (user.branchId && b.id === user.branchId)
      );

      if (assignedBranch) {
        const distToAssigned = LocationService.calculateDistance(
          userPos.latitude,
          userPos.longitude,
          assignedBranch.latitude,
          assignedBranch.longitude
        );
        const allowedRadius = assignedBranch.radiusMeters || 20;

        // 1. If inside assigned branch's 20m radius -> Direct on-site check-in!
        if (distToAssigned <= allowedRadius) {
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
            checkInDistance: distToAssigned,
            checkInOutside: false,
            checkInApprovalStatus: 'approved',
            branchId: assignedBranch.id,
            branchName: assignedBranch.name,
            status: 'checked_in',
          };

          const updated = [newRecord, ...attendanceRecords];
          setAttendanceRecords(updated);
          await StorageService.saveAttendanceRecords(updated);

          OneSignalService.sendPushNotification({
            title: '🟢 Personel İşe Giriş Yaptı',
            message: `${user.name}, saat ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla ${assignedBranch.name} şubesinde mesaiye başladı. (Mesafe: ${LocationService.formatDistance(distToAssigned)})`,
            targetMode: 'admin',
            url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
          }).catch(() => {});

          return {
            success: true,
            distance: distToAssigned,
            message: `${assignedBranch.name} şubesinde işe girişiniz başarıyla onaylandı! (Şubeye mesafe: ${LocationService.formatDistance(distToAssigned)})`,
          };
        }

        // 2. Outside assigned branch -> Check if located at another company branch within 20m
        const otherBranch = branches.find((b) => {
          if (b.id === assignedBranch.id) return false;
          const d = LocationService.calculateDistance(
            userPos.latitude,
            userPos.longitude,
            b.latitude,
            b.longitude
          );
          return d <= (b.radiusMeters || 20);
        });

        if (otherBranch) {
          // Located at another branch -> Requires Manager Approval!
          if (!options?.allowOutside) {
            return {
              success: false,
              requiresConfirmation: true,
              confirmationType: 'checkin',
              distance: distToAssigned,
              address: userPos.address,
              message: `Kendi şubeniz olan "${assignedBranch.name}" yerine "${otherBranch.name}" şubesinde bulunuyorsunuz. Başka bir şubede mesaiye başlamak için Yönetici Onayı gereklidir. Onaya gönderilsin mi?`,
            };
          }

          const otherBranchDist = LocationService.calculateDistance(
            userPos.latitude,
            userPos.longitude,
            otherBranch.latitude,
            otherBranch.longitude
          );

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
            checkInDistance: otherBranchDist,
            checkInOutside: true,
            checkInApprovalStatus: 'pending',
            branchId: otherBranch.id,
            branchName: otherBranch.name,
            assignedBranchName: assignedBranch.name,
            isOtherBranch: true,
            approvalNote: options.note,
            notes: `Farklı Şube Talebi: Asıl şubesi (${assignedBranch.name}) yerine ${otherBranch.name} şubesinde mesaiye başlamak istiyor.${options.note ? ' Not: ' + options.note : ''}`,
            status: 'pending_checkin_approval',
          };

          const updated = [newRecord, ...attendanceRecords];
          setAttendanceRecords(updated);
          await StorageService.saveAttendanceRecords(updated);

          OneSignalService.sendPushNotification({
            title: '⚠️ Farklı Şubede Mesai Onay Talebi',
            message: `${user.name}, bağlı olduğu ${assignedBranch.name} yerine ${otherBranch.name} şubesinde mesaiye başlamak için onay talep etti.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
            targetMode: 'admin',
            url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
          }).catch(() => {});

          return {
            success: true,
            isPendingApproval: true,
            distance: otherBranchDist,
            message: `Farklı şubede (${otherBranch.name}) mesaiye başlama onay talebiniz yöneticiye iletildi.`,
          };
        }

        // 3. Outside all company branches
        if (!options?.allowOutside) {
          return {
            success: false,
            requiresConfirmation: true,
            confirmationType: 'checkin',
            distance: distToAssigned,
            address: userPos.address,
            message: `Bağlı olduğunuz "${assignedBranch.name}" şubesinin 20 metre dışında bulunuyorsunuz (${LocationService.formatDistance(distToAssigned)}). Yönetici onayına gönderilsin mi?`,
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
          checkInDistance: distToAssigned,
          checkInOutside: true,
          checkInApprovalStatus: 'pending',
          branchId: assignedBranch.id,
          branchName: assignedBranch.name,
          approvalNote: options.note,
          status: 'pending_checkin_approval',
        };

        const updated = [newRecord, ...attendanceRecords];
        setAttendanceRecords(updated);
        await StorageService.saveAttendanceRecords(updated);

        OneSignalService.sendPushNotification({
          title: '⚠️ Konum Dışı İşe Giriş Onay Talebi',
          message: `${user.name}, ${assignedBranch.name} şubesinden ${LocationService.formatDistance(distToAssigned)} uzakta işe giriş onay talebi gönderdi.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
          targetMode: 'admin',
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        }).catch(() => {});

        return {
          success: true,
          isPendingApproval: true,
          distance: distToAssigned,
          message: 'Konum dışı giriş onay talebiniz yöneticiye iletildi.',
        };
      } else {
        // Staff has no assigned branch yet -> Check if within 20m of any branch
        const nearBranch = branches.find(
          (b) => LocationService.calculateDistance(userPos.latitude, userPos.longitude, b.latitude, b.longitude) <= (b.radiusMeters || 20)
        );

        if (nearBranch) {
          const nearDist = LocationService.calculateDistance(userPos.latitude, userPos.longitude, nearBranch.latitude, nearBranch.longitude);
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
            checkInDistance: nearDist,
            checkInOutside: false,
            checkInApprovalStatus: 'approved',
            branchId: nearBranch.id,
            branchName: nearBranch.name,
            status: 'checked_in',
          };

          const updated = [newRecord, ...attendanceRecords];
          setAttendanceRecords(updated);
          await StorageService.saveAttendanceRecords(updated);

          OneSignalService.sendPushNotification({
            title: '🟢 Personel İşe Giriş Yaptı',
            message: `${user.name}, ${nearBranch.name} şubesinde mesaiye başladı. (Mesafe: ${LocationService.formatDistance(nearDist)})`,
            targetMode: 'admin',
            url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
          }).catch(() => {});

          return {
            success: true,
            distance: nearDist,
            message: `${nearBranch.name} şubesinde işe girişiniz başarıyla kaydedildi!`,
          };
        }

        // Outside all branches without assigned branch
        let closestBranch = branches[0];
        let minDist = LocationService.calculateDistance(userPos.latitude, userPos.longitude, closestBranch.latitude, closestBranch.longitude);
        for (let i = 1; i < branches.length; i++) {
          const d = LocationService.calculateDistance(userPos.latitude, userPos.longitude, branches[i].latitude, branches[i].longitude);
          if (d < minDist) {
            minDist = d;
            closestBranch = branches[i];
          }
        }

        if (!options?.allowOutside) {
          return {
            success: false,
            requiresConfirmation: true,
            confirmationType: 'checkin',
            distance: minDist,
            address: userPos.address,
            message: `Herhangi bir şubenin 20 metre yakınında bulunmuyorsunuz (En yakın şube: ${closestBranch.name}, Mesafe: ${LocationService.formatDistance(minDist)}). Yönetici onayına gönderilsin mi?`,
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
          checkInDistance: minDist,
          checkInOutside: true,
          checkInApprovalStatus: 'pending',
          branchId: closestBranch.id,
          branchName: closestBranch.name,
          approvalNote: options.note,
          status: 'pending_checkin_approval',
        };

        const updated = [newRecord, ...attendanceRecords];
        setAttendanceRecords(updated);
        await StorageService.saveAttendanceRecords(updated);

        OneSignalService.sendPushNotification({
          title: '⚠️ Konum Dışı İşe Giriş Onay Talebi',
          message: `${user.name}, en yakın ${closestBranch.name} şubesinden ${LocationService.formatDistance(minDist)} uzakta işe giriş onay talebi gönderdi.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
          targetMode: 'admin',
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        }).catch(() => {});

        return {
          success: true,
          isPendingApproval: true,
          distance: minDist,
          message: 'Konum dışı giriş onay talebiniz yöneticiye iletildi.',
        };
      }
    }

    // --- LEGACY SINGLE WORKPLACE FALLBACK ---
    const distance = LocationService.calculateDistance(
      userPos.latitude,
      userPos.longitude,
      workplaceLocation!.latitude,
      workplaceLocation!.longitude
    );
    const allowedRadius = (workplaceLocation!.radiusMeters && workplaceLocation!.radiusMeters !== 10)
      ? workplaceLocation!.radiusMeters
      : 20;

    if (distance > allowedRadius) {
      if (!options?.allowOutside) {
        return {
          success: false,
          requiresConfirmation: true,
          confirmationType: 'checkin',
          distance,
          address: userPos.address,
          message: 'Konum dışında giriş yapıyorsunuz. Yönetici onayına gönderilsin mi?',
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
        checkInOutside: true,
        checkInApprovalStatus: 'pending',
        approvalNote: options.note,
        status: 'pending_checkin_approval',
      };

      const updated = [newRecord, ...attendanceRecords];
      setAttendanceRecords(updated);
      await StorageService.saveAttendanceRecords(updated);

      OneSignalService.sendPushNotification({
        title: '⚠️ Konum Dışı İşe Giriş Onay Talebi',
        message: `${user.name}, iş yerinden ${LocationService.formatDistance(distance)} uzakta işe giriş onay talebi gönderdi.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
        targetMode: 'admin',
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch(() => {});

      return {
        success: true,
        isPendingApproval: true,
        distance,
        message: 'Konum dışı giriş onay talebiniz yöneticiye iletildi.',
      };
    }

    // Inside allowed radius (Normal on-site check-in)
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
      checkInOutside: false,
      checkInApprovalStatus: 'approved',
      status: 'checked_in',
    };

    const updated = [newRecord, ...attendanceRecords];
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);

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

  // Staff check-out (Within 20 meters = direct; Outside = requires manager confirmation & approval)
  const checkOutStaff = async (options?: {
    allowOutside?: boolean;
    note?: string;
  }): Promise<{
    success: boolean;
    message: string;
    distance?: number;
    requiresConfirmation?: boolean;
    confirmationType?: 'checkin' | 'checkout';
    address?: string;
    isPendingApproval?: boolean;
    isLocationDisabled?: boolean;
  }> => {
    if (!user) {
      return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    }
    if (user.role !== 'admin') {
      const curDevId = DeviceService.getCurrentDeviceId();
      const devCheck = await DeviceService.verifyDeviceAccess({
        userId: user.id,
        role: user.role,
        currentDeviceId: curDevId,
        userName: user.name,
        username: user.username,
      });
      if (!devCheck.allowed) {
        return {
          success: false,
          message: devCheck.error || 'Bu cihaz yetkili resmi cihazınız değildir. İşten çıkış engellendi.',
        };
      }
    }

    // Find user's active check-in or pending checkout record
    const recordIndex = attendanceRecords.findIndex(
      (r) => r.userId === user.id && (r.status === 'checked_in' || r.status === 'pending_checkout_approval')
    );

    if (recordIndex === -1) {
      const hasPendingCheckin = attendanceRecords.some(
        (r) => r.userId === user.id && r.status === 'pending_checkin_approval'
      );
      if (hasPendingCheckin) {
        return {
          success: false,
          message: 'İşe giriş onay talebiniz henüz yönetici tarafından onaylanmamış.',
        };
      }
      return {
        success: false,
        message: 'Aktif bir işe giriş kaydınız bulunmuyor. Önce işe giriş yapmalısınız.',
      };
    }

    const record = attendanceRecords[recordIndex];

    if (record.status === 'pending_checkout_approval') {
      return {
        success: false,
        message: 'İşten çıkışınız için zaten yönetici onayı bekleniyor.',
      };
    }

    let userPos;
    try {
      userPos = await LocationService.getCurrentPosition();
    } catch (err: any) {
      return {
        success: false,
        isLocationDisabled: true,
        message: err?.message || 'İşten çıkış yapabilmek için konum servislerinin açık olması gerekmektedir. Lütfen cihazınızın konum servisini açın.',
      };
    }

    // Determine target location to measure checkout against:
    let targetLat = workplaceLocation?.latitude;
    let targetLon = workplaceLocation?.longitude;
    let targetRadius = (workplaceLocation?.radiusMeters && workplaceLocation.radiusMeters !== 10) ? workplaceLocation.radiusMeters : 20;
    let targetName = 'İş yeri';

    if (record.branchId && branches.length > 0) {
      const b = branches.find((item) => item.id === record.branchId);
      if (b) {
        targetLat = b.latitude;
        targetLon = b.longitude;
        targetRadius = b.radiusMeters || 20;
        targetName = b.name;
      }
    } else if (branches.length > 0) {
      const assignedBranch = branches.find(
        (b) => (b.assignedUserIds && b.assignedUserIds.includes(user.id)) || (user.branchId && b.id === user.branchId)
      );
      if (assignedBranch) {
        targetLat = assignedBranch.latitude;
        targetLon = assignedBranch.longitude;
        targetRadius = assignedBranch.radiusMeters || 20;
        targetName = assignedBranch.name;
      }
    }

    if (!targetLat || !targetLon) {
      return {
        success: false,
        message: 'İş yeri veya şube konumu belirlenemedi.',
      };
    }

    const distance = LocationService.calculateDistance(
      userPos.latitude,
      userPos.longitude,
      targetLat,
      targetLon
    );

    const allowedRadius = targetRadius;
    const checkOutTime = Date.now();
    const durationMinutes = Math.max(1, Math.round((checkOutTime - record.checkInTime) / 60000));
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationText = hours > 0 ? `${hours} saat ${mins} dakika` : `${mins} dakika`;

    // If outside 20m, require confirmation & approval
    if (distance > allowedRadius) {
      if (!options?.allowOutside) {
        return {
          success: false,
          requiresConfirmation: true,
          confirmationType: 'checkout',
          distance,
          address: userPos.address,
          message: `${targetName} şubesinin 20 metre dışında çıkış yapıyorsunuz (${LocationService.formatDistance(distance)}). Yönetici onayına gönderilsin mi?`,
        };
      }

      // User confirmed -> Create pending checkout approval record
      const updatedRecord: AttendanceRecord = {
        ...record,
        checkOutTime,
        checkOutLat: userPos.latitude,
        checkOutLon: userPos.longitude,
        checkOutAddress: userPos.address,
        checkOutDistance: distance,
        checkOutOutside: true,
        checkOutApprovalStatus: 'pending',
        approvalNote: options.note || record.approvalNote,
        status: 'pending_checkout_approval',
        workDurationMinutes: durationMinutes,
      };

      const updatedRecords = [...attendanceRecords];
      updatedRecords[recordIndex] = updatedRecord;
      setAttendanceRecords(updatedRecords);
      await StorageService.saveAttendanceRecords(updatedRecords);

      // CRITICAL: Push notification to admins
      OneSignalService.sendPushNotification({
        title: '⚠️ Konum Dışı İşten Çıkış Onay Talebi',
        message: `${user.name}, ${targetName} konumundan ${LocationService.formatDistance(distance)} uzakta işten çıkış onay talebi gönderdi.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
        targetMode: 'admin',
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch(() => {});

      return {
        success: true,
        isPendingApproval: true,
        distance,
        message: 'Konum dışı çıkış onay talebiniz yöneticiye iletildi.',
      };
    }

    // Inside allowed radius (Normal on-site check-out)
    const updatedRecord: AttendanceRecord = {
      ...record,
      checkOutTime,
      checkOutLat: userPos.latitude,
      checkOutLon: userPos.longitude,
      checkOutAddress: userPos.address,
      checkOutDistance: distance,
      checkOutOutside: false,
      checkOutApprovalStatus: 'approved',
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
      message: `${user.name}, saat ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla ${targetName} şubesinden çıkış yaptı. (Toplam Mesai: ${durationText})`,
      targetMode: 'admin',
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch(() => {});

    return {
      success: true,
      distance,
      message: `İşten çıkışınız onaylandı! Toplam mesai süreniz: ${durationText}.`,
    };
  };

  const approveAttendance = async (
    recordId: string,
    actionType: 'checkin' | 'checkout'
  ): Promise<{ success: boolean; message: string }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: 'Bu işlemi yapmaya sadece yöneticiler yetkilidir.' };
    }
    const idx = attendanceRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) {
      return { success: false, message: 'İlgili katılım kaydı bulunamadı.' };
    }
    const record = attendanceRecords[idx];
    let updatedRecord: AttendanceRecord;

    if (actionType === 'checkin') {
      updatedRecord = {
        ...record,
        status: 'checked_in',
        checkInApprovalStatus: 'approved',
        checkInApprovedBy: user.name,
        checkInApprovedAt: Date.now(),
      };

      OneSignalService.sendPushNotification({
        title: '✅ İşe Girişiniz Onaylandı',
        message: `Yönetici ${user.name}, konum dışı işe giriş talebinizi onayladı. İyi çalışmalar!`,
        targetMode: 'custom',
        targetUserIds: [record.userId],
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch(() => {});
    } else {
      const now = Date.now();
      const checkoutTime = record.checkOutTime || now;
      const durationMinutes = Math.max(1, Math.round((checkoutTime - record.checkInTime) / 60000));
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const durationText = hours > 0 ? `${hours} saat ${mins} dakika` : `${mins} dakika`;

      updatedRecord = {
        ...record,
        status: 'completed',
        checkOutTime: checkoutTime,
        checkOutApprovalStatus: 'approved',
        checkOutApprovedBy: user.name,
        checkOutApprovedAt: now,
        workDurationMinutes: durationMinutes,
      };

      OneSignalService.sendPushNotification({
        title: '✅ İşten Çıkışınız Onaylandı',
        message: `Yönetici ${user.name}, konum dışı çıkış talebinizi onayladı. (Toplam Mesai: ${durationText})`,
        targetMode: 'custom',
        targetUserIds: [record.userId],
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch(() => {});
    }

    const updated = [...attendanceRecords];
    updated[idx] = updatedRecord;
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);
    return { success: true, message: 'Talep başarıyla onaylandı.' };
  };

  const rejectAttendance = async (
    recordId: string,
    actionType: 'checkin' | 'checkout',
    reason?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: 'Bu işlemi yapmaya sadece yöneticiler yetkilidir.' };
    }
    const idx = attendanceRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) {
      return { success: false, message: 'İlgili katılım kaydı bulunamadı.' };
    }
    const record = attendanceRecords[idx];

    if (actionType === 'checkin') {
      const updated = attendanceRecords.filter((r) => r.id !== recordId);
      setAttendanceRecords(updated);
      await StorageService.saveAttendanceRecords(updated);

      OneSignalService.sendPushNotification({
        title: '❌ İşe Giriş Talebiniz Reddedildi',
        message: `Yönetici ${user.name}, konum dışı işe giriş talebinizi onaylamadı.${reason ? ' Gerekçe: ' + reason : ''}`,
        targetMode: 'custom',
        targetUserIds: [record.userId],
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch(() => {});
    } else {
      const updatedRecord: AttendanceRecord = {
        ...record,
        status: 'checked_in',
        checkOutTime: undefined,
        checkOutLat: undefined,
        checkOutLon: undefined,
        checkOutAddress: undefined,
        checkOutDistance: undefined,
        checkOutOutside: undefined,
        checkOutApprovalStatus: 'rejected',
        workDurationMinutes: undefined,
      };
      const updated = [...attendanceRecords];
      updated[idx] = updatedRecord;
      setAttendanceRecords(updated);
      await StorageService.saveAttendanceRecords(updated);

      OneSignalService.sendPushNotification({
        title: '❌ İşten Çıkış Talebiniz Reddedildi',
        message: `Yönetici ${user.name}, konum dışı çıkış talebinizi onaylamadı.${reason ? ' Gerekçe: ' + reason : ''}`,
        targetMode: 'custom',
        targetUserIds: [record.userId],
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch(() => {});
    }

    return { success: true, message: 'Talep reddedildi.' };
  };

  const cancelAttendanceRequest = async (
    recordId: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Kullanıcı bulunamadı.' };
    const idx = attendanceRecords.findIndex((r) => r.id === recordId && r.userId === user.id);
    if (idx === -1) {
      return { success: false, message: 'Talebiniz bulunamadı.' };
    }
    const record = attendanceRecords[idx];

    if (record.status === 'pending_checkin_approval') {
      const updated = attendanceRecords.filter((r) => r.id !== recordId);
      setAttendanceRecords(updated);
      await StorageService.saveAttendanceRecords(updated);
      return { success: true, message: 'Giriş onay talebiniz iptal edildi.' };
    } else if (record.status === 'pending_checkout_approval') {
      const updatedRecord: AttendanceRecord = {
        ...record,
        status: 'checked_in',
        checkOutTime: undefined,
        checkOutLat: undefined,
        checkOutLon: undefined,
        checkOutAddress: undefined,
        checkOutDistance: undefined,
        checkOutOutside: undefined,
        checkOutApprovalStatus: undefined,
        workDurationMinutes: undefined,
      };
      const updated = [...attendanceRecords];
      updated[idx] = updatedRecord;
      setAttendanceRecords(updated);
      await StorageService.saveAttendanceRecords(updated);
      return { success: true, message: 'Çıkış onay talebiniz iptal edildi.' };
    }
    return { success: false, message: 'İptal edilecek bekleyen talep bulunamadı.' };
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

  const importCarilerFromExcelFile = async (file: File): Promise<number> => {
    const res = await StorageService.importCarilerFromExcel(file);
    setCariler(res.cariler);
    setCarilerUpdatedAt(res.updatedAt);
    setCarilerTotal(res.total);
    return res.total;
  };

  const exportCarilerToExcelFile = () => {
    StorageService.exportCarilerToExcel(cariler);
  };

  const refreshCariler = async () => {
    const res = await StorageService.getCarilerData();
    setCariler(res.cariler);
    setCarilerUpdatedAt(res.updatedAt);
    setCarilerTotal(res.total);
  };

  // ==========================================
  // STAFF LEAVE REQUESTS (HOURLY / DAILY)
  // ==========================================

  const requestLeave = async (params: {
    leaveType: 'hourly' | 'daily';
    date: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    durationText: string;
    reason: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    }

    const newRequest: LeaveRequest = {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      leaveType: params.leaveType,
      date: params.date,
      endDate: params.endDate,
      startTime: params.startTime,
      endTime: params.endTime,
      durationText: params.durationText,
      reason: params.reason,
      status: 'pending',
      requestedAt: Date.now(),
    };

    const updated = [newRequest, ...leaveRequests];
    setLeaveRequests(updated);
    await StorageService.saveLeaveRequests(updated);

    // Format date details for notification
    let details = '';
    try {
      const dateFormatted = new Date(params.date).toLocaleDateString('tr-TR');
      if (params.leaveType === 'hourly') {
        details = `${dateFormatted} saat ${params.startTime || ''}-${params.endTime || ''} (${params.durationText})`;
      } else {
        const endFormatted =
          params.endDate && params.endDate !== params.date
            ? ` - ${new Date(params.endDate).toLocaleDateString('tr-TR')}`
            : '';
        details = `${dateFormatted}${endFormatted} (${params.durationText})`;
      }
    } catch {
      details = `${params.date} (${params.durationText})`;
    }

    // Send OneSignal Push Notification to Admins
    try {
      await OneSignalService.sendPushNotification({
        title: `📝 Yeni İzin Talebi: ${user.name}`,
        message: `${user.name}, ${details} ${
          params.leaveType === 'hourly' ? 'Saatlik' : 'Günlük'
        } İzin talebinde bulundu. Neden: ${params.reason}`,
        targetMode: 'admin',
        url: 'https://saha-takip-beige.vercel.app',
      });
    } catch (pushErr) {
      console.warn('İzin talebi bildirim gönderim hatası:', pushErr);
    }

    return {
      success: true,
      message: 'İzin talebiniz başarıyla oluşturuldu ve yönetici onayına iletildi.',
    };
  };

  const approveLeaveRequest = async (
    requestId: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    const req = leaveRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'İzin talebi bulunamadı.' };

    const updated = leaveRequests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'approved' as const,
            reviewedBy: user.name,
            reviewedAt: Date.now(),
          }
        : r
    );

    setLeaveRequests(updated);
    await StorageService.saveLeaveRequests(updated);

    // Notify employee via push notification
    try {
      await OneSignalService.sendPushNotification({
        title: '✅ İzin Talebiniz Onaylandı',
        message: `Sayın ${req.userName}, ${
          req.leaveType === 'hourly' ? 'saatlik' : 'günlük'
        } izin talebiniz (${req.durationText}) onaylandı.`,
        targetUserIds: [req.userId],
        targetMode: 'custom',
        url: 'https://saha-takip-beige.vercel.app',
      });
    } catch (e) {
      console.warn('İzin onay bildirimi hatası:', e);
    }

    return {
      success: true,
      message: `${req.userName} kullanıcısının izin talebi onaylandı.`,
    };
  };

  const rejectLeaveRequest = async (
    requestId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    const req = leaveRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'İzin talebi bulunamadı.' };

    const updated = leaveRequests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'rejected' as const,
            reviewedBy: user.name,
            reviewedAt: Date.now(),
            reviewNote: reason,
          }
        : r
    );

    setLeaveRequests(updated);
    await StorageService.saveLeaveRequests(updated);

    // Notify employee via push notification
    try {
      await OneSignalService.sendPushNotification({
        title: '❌ İzin Talebiniz Reddedildi',
        message: `Sayın ${req.userName}, ${
          req.leaveType === 'hourly' ? 'saatlik' : 'günlük'
        } izin talebiniz reddedildi.${reason ? ` Gerekçe: ${reason}` : ''}`,
        targetUserIds: [req.userId],
        targetMode: 'custom',
        url: 'https://saha-takip-beige.vercel.app',
      });
    } catch (e) {
      console.warn('İzin ret bildirimi hatası:', e);
    }

    return {
      success: true,
      message: `${req.userName} kullanıcısının izin talebi reddedildi.`,
    };
  };

  const cancelLeaveRequest = async (
    requestId: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    const req = leaveRequests.find((r) => r.id === requestId && (r.userId === user.id || isUserAdmin(user)));
    if (!req) return { success: false, message: 'İptal edilecek izin talebi bulunamadı.' };

    const updated = leaveRequests.filter((r) => r.id !== requestId);
    setLeaveRequests(updated);
    await StorageService.saveLeaveRequests(updated);

    return {
      success: true,
      message: 'İzin talebiniz iptal edildi.',
    };
  };

  const deleteLeaveRequest = async (requestId: string): Promise<void> => {
    const updated = leaveRequests.filter((r) => r.id !== requestId);
    setLeaveRequests(updated);
    await StorageService.saveLeaveRequests(updated);
  };

  const markSecurityLogsAsRead = async (): Promise<void> => {
    const updated = securityLogs.map((l) => ({ ...l, read: true }));
    setSecurityLogs(updated);
    await StorageService.saveSecurityLogs(updated);
  };

  const deleteSecurityLog = async (logId: string): Promise<void> => {
    const updated = securityLogs.filter((l) => l.id !== logId);
    setSecurityLogs(updated);
    await StorageService.saveSecurityLogs(updated);
  };

  const clearAllSecurityLogs = async (): Promise<void> => {
    setSecurityLogs([]);
    await StorageService.saveSecurityLogs([]);
  };

  const [lastReadTime, setLastReadTime] = useState<number>(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const val = localStorage.getItem(`@saha_takip_last_read_time_${user.id}`);
      if (val) return Number(val);
    }
    return Date.now() - 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const val = localStorage.getItem(`@saha_takip_last_read_time_${user.id}`);
      if (val) {
        setLastReadTime(Number(val));
      } else {
        setLastReadTime(Date.now() - 24 * 60 * 60 * 1000);
      }
    }
  }, [user?.id]);

  const markAllAsRead = async (): Promise<void> => {
    const now = Date.now();
    setLastReadTime(now);
    if (user?.id) {
      try {
        localStorage.setItem(`@saha_takip_last_read_time_${user.id}`, String(now));
      } catch {
        // ignore
      }
    }
    // Mark security logs as read in storage and state
    const updated = securityLogs.map((l) => ({ ...l, read: true }));
    setSecurityLogs(updated);
    await StorageService.saveSecurityLogs(updated);
  };

  const badgeCount = useMemo(() => {
    if (!user) return 0;
    let count = 0;
    const effectiveIsAdmin = isUserAdmin(user);

    if (effectiveIsAdmin) {
      // 1. Pending approval notes newer than lastReadTime
      count += allNotes.filter(
        (n) => n.status === 'pending_approval' && (n.completedAt || n.createdAt) > lastReadTime
      ).length;

      // 2. Notes created by others newer than lastReadTime
      count += allNotes.filter(
        (n) => n.createdBy !== user.id && n.status !== 'pending_approval' && n.createdAt > lastReadTime
      ).length;

      // 3. New services from staff
      count += allServices.filter(
        (s) => s.createdBy !== user.id && s.status !== 'pending_approval' && s.createdAt > lastReadTime
      ).length;

      // 3b. Pending approval services
      count += allServices.filter(
        (s) => s.status === 'pending_approval' && (s.completedAt || s.createdAt) > lastReadTime
      ).length;

      // 4. New locations from staff
      count += allLocations.filter(
        (l) => l.createdBy !== user.id && l.status !== 'pending_approval' && l.createdAt > lastReadTime
      ).length;

      // 4b. Pending approval locations
      count += allLocations.filter(
        (l) => l.status === 'pending_approval' && (l.completedAt || l.createdAt) > lastReadTime
      ).length;

      // 5. Active reminders due
      count += allNotes.filter((n) => {
        if (!n.reminderActive || !n.reminderDate) return false;
        const remTime = new Date(n.reminderDate).getTime();
        return remTime <= Date.now() && remTime > lastReadTime;
      }).length;

      // 6. Security Logs newer than lastReadTime
      count += securityLogs.filter((l) => l.timestamp > lastReadTime && !l.read).length;

      // 7. Leave Requests newer than lastReadTime
      count += leaveRequests.filter((r) => r.requestedAt > lastReadTime).length;

      // 8. Attendance check-ins/check-outs newer than lastReadTime
      count += attendanceRecords.filter((a) =>
        a.checkInTime > lastReadTime ||
        (a.checkOutTime && a.checkOutTime > lastReadTime)
      ).length;
    } else {
      // Staff
      // 1. Targeted notes newer than lastReadTime
      count += allNotes.filter(
        (n) =>
          n.createdBy !== user.id &&
          n.createdAt > lastReadTime &&
          (n.targetMode === 'all' ||
            n.targetUserId === 'all' ||
            (n.targetMode === 'custom' && Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
            n.targetUserId === user.id)
      ).length;

      // 2. Approved notes newer than lastReadTime
      count += allNotes.filter(
        (n) =>
          n.status === 'approved' &&
          (n.approvedAt || n.createdAt) > lastReadTime &&
          (n.completedBy === user.id ||
            (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
            n.targetUserId === user.id)
      ).length;

      // 3. Rejected notes newer than lastReadTime
      count += allNotes.filter(
        (n) =>
          n.status === 'rejected' &&
          (n.rejectedAt || n.createdAt) > lastReadTime &&
          (n.completedBy === user.id ||
            (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
            n.targetUserId === user.id)
      ).length;

      // 3b. Approved / Rejected services newer than lastReadTime
      count += allServices.filter(
        (s) =>
          (s.status === 'approved' || s.status === 'rejected') &&
          (s.approvedAt || s.rejectedAt || s.createdAt) > lastReadTime &&
          (s.completedBy === user.id || s.createdBy === user.id)
      ).length;

      // 3c. Approved / Rejected locations newer than lastReadTime
      count += allLocations.filter(
        (l) =>
          (l.status === 'approved' || l.status === 'rejected') &&
          (l.approvedAt || l.rejectedAt || l.createdAt) > lastReadTime &&
          (l.completedBy === user.id || l.createdBy === user.id)
      ).length;

      // 4. Active reminders due
      count += allNotes.filter((n) => {
        if (!n.reminderActive || !n.reminderDate) return false;
        const remTime = new Date(n.reminderDate).getTime();
        const isTargeted =
          n.createdBy === user.id ||
          (n.targetMode === 'custom' && Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
          n.targetUserId === user.id;
        return isTargeted && remTime <= Date.now() && remTime > lastReadTime;
      }).length;

      // 5. Admin reminders newer than lastReadTime
      count += adminReminders.filter((r) => r.createdAt > lastReadTime).length;

      // 6. Leave Requests reviewed newer than lastReadTime
      count += leaveRequests.filter(
        (r) =>
          r.userId === user.id &&
          (r.status === 'approved' || r.status === 'rejected') &&
          (r.reviewedAt || r.requestedAt) > lastReadTime
      ).length;

      // 7. Attendance check-in / check-out reviewed newer than lastReadTime
      count += attendanceRecords.filter((a) => {
        if (a.userId !== user.id) return false;
        const inApproved =
          a.checkInApprovalStatus === 'approved' &&
          a.checkInOutside &&
          (a.checkInApprovedAt || a.checkInTime) > lastReadTime;
        const inRejected = a.checkInApprovalStatus === 'rejected' && a.checkInTime > lastReadTime;
        const outApproved =
          a.checkOutApprovalStatus === 'approved' &&
          a.checkOutOutside &&
          (a.checkOutApprovedAt || a.checkOutTime || a.checkInTime) > lastReadTime;
        const outRejected =
          a.checkOutApprovalStatus === 'rejected' &&
          (a.checkOutTime || a.checkInTime) > lastReadTime;
        return inApproved || inRejected || outApproved || outRejected;
      }).length;
    }

    return count;
  }, [
    allNotes,
    allServices,
    allLocations,
    securityLogs,
    leaveRequests,
    attendanceRecords,
    adminReminders,
    user,
    lastReadTime,
  ]);

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
        branches,
        attendanceRecords,
        adminReminders,
        cariler,
        carilerUpdatedAt,
        carilerTotal,
        importCarilerFromExcelFile,
        exportCarilerToExcelFile,
        refreshCariler,
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
        completeLocation,
        approveLocation,
        rejectLocation,
        addNote,
        updateNote,
        deleteNote,
        completeNote,
        approveNote,
        rejectNote,
        addAdminReminder,
        updateAdminReminder,
        deleteAdminReminder,
        markReminderAsRead,
        addReturnWarrantyItem,
        updateReturnWarrantyItem,
        deleteReturnWarrantyItem,
        addService,
        updateService,
        deleteService,
        completeService,
        approveService,
        rejectService,
        updateWorkplaceLocation,
        addBranch,
        updateBranch,
        deleteBranch,
        assignStaffToBranch,
        checkInStaff,
        checkOutStaff,
        approveAttendance,
        rejectAttendance,
        cancelAttendanceRequest,
        deleteAttendanceRecord,
        updateAttendanceRecord,
        refreshAttendance,
        importBackupData,
        leaveRequests,
        requestLeave,
        approveLeaveRequest,
        rejectLeaveRequest,
        cancelLeaveRequest,
        deleteLeaveRequest,
        securityLogs,
        unreadLogsCount,
        lastReadTime,
        badgeCount,
        markAllAsRead,
        markSecurityLogsAsRead,
        deleteSecurityLog,
        clearAllSecurityLogs,
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
