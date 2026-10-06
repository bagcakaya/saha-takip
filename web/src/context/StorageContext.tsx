import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { LocationItem, TaskStatus, GeneralNote, BackupData, NoteTargetMode, ReturnWarrantyItem, ServiceItem, WorkplaceLocation, Branch, AttendanceRecord, BreakItem, AdminReminder, AdminReminderCategory, LeaveRequest, SecurityLogItem, TimedFollowUp, PersonalNote, ShiftDefinition, ShiftAssignment } from '../types/storage';
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
import { ServerConfigService } from '../services/serverConfigService';
import { parseDueDateTime, checkMilestoneTrigger } from '../utils/dateUtils';

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
  approveMultipleNotes: (ids: string[]) => Promise<void>;
  completeMultipleNotes: (ids: string[], completionNote?: string) => Promise<void>;
  processNote: (id: string) => Promise<void>;
  unprocessNote: (id: string) => Promise<void>;
  processMultipleNotes: (ids: string[]) => Promise<void>;
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
  updateBranch: (
    id: string,
    updates: Partial<Branch> & { companyCode?: string },
    targetCompanyCode?: string
  ) => Promise<void>;
  deleteBranch: (id: string, targetCompanyCode?: string) => Promise<void>;
  assignStaffToBranch: (branchId: string, userIds: string[], targetCompanyCode?: string) => Promise<void>;
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
  startBreak: (note?: string) => Promise<{ success: boolean; message: string }>;
  endBreak: () => Promise<{ success: boolean; message: string }>;
  endBreakForStaff: (recordId: string) => Promise<{ success: boolean; message: string }>;
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
  timedFollowUps: TimedFollowUp[];
  activeRingingAlarm: TimedFollowUp | null;
  addTimedFollowUp: (data: {
    cariName: string;
    description: string;
    dueDate: string;
    soundAlarm?: boolean;
    sendPush?: boolean;
  }) => Promise<void>;
  updateTimedFollowUp: (id: string, updates: Partial<TimedFollowUp>) => Promise<void>;
  deleteTimedFollowUp: (id: string) => Promise<void>;
  completeTimedFollowUp: (id: string) => Promise<void>;
  snoozeTimedFollowUp: (id: string, minutes?: number) => Promise<void>;
  dismissAlarm: () => Promise<void>;
  personalNotes: PersonalNote[];
  addPersonalNote: (initialData?: Partial<PersonalNote>) => Promise<PersonalNote>;
  updatePersonalNote: (id: string, updates: Partial<PersonalNote>) => Promise<void>;
  deletePersonalNote: (id: string) => Promise<void>;
  togglePinPersonalNote: (id: string) => Promise<void>;
  refreshPersonalNotes: () => Promise<void>;
  shifts: ShiftDefinition[];
  shiftAssignments: ShiftAssignment[];
  createShift: (shift: Omit<ShiftDefinition, 'id' | 'createdAt' | 'updatedAt' | 'companyCode'> & { companyCode?: string }) => Promise<ShiftDefinition>;
  updateShift: (id: string, updates: Partial<ShiftDefinition>) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
  assignUserShift: (userId: string, userName: string, shiftId: string) => Promise<void>;
  removeUserShift: (userId: string) => Promise<void>;
  updateBranchBreakMinutes: (branchId: string, maxBreakMinutes: number) => Promise<void>;
  updateWorkplaceBreakMinutes: (maxBreakMinutes: number) => Promise<void>;
  refreshShifts: () => Promise<void>;
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
const SEEN_ADMIN_REMINDERS_KEY = (userId: string, compCode?: string) => `@seen_admin_reminders_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_REMINDER_READS_KEY = (userId: string, compCode?: string) => `@seen_reminder_reads_${sanitizeCompCode(compCode)}_${userId}`;
const SEEN_COMPLETED_RETURNS_KEY = (userId: string, compCode?: string) => `@seen_completed_returns_${sanitizeCompCode(compCode)}_${userId}`;
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
  const { user, users, company, viewingCompany } = useAuth();
  const activeCompCode = (
    viewingCompany?.code ||
    company?.code ||
    user?.companyCode ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_company_code') : null) ||
    'POLATLAR'
  ).trim().toUpperCase();
  const activeCompId = viewingCompany?.id || company?.id || (activeCompCode === 'POLATLAR' ? 1 : undefined);
  const compCode = activeCompCode;

  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [standardTasks, setStandardTasks] = useState<string[]>([]);
  const [allNotes, setAllNotes] = useState<GeneralNote[]>([]);
  const allNotesRef = useRef<GeneralNote[]>([]);
  allNotesRef.current = allNotes;
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
  const [timedFollowUps, setTimedFollowUps] = useState<TimedFollowUp[]>([]);
  const [personalNotes, setPersonalNotes] = useState<PersonalNote[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [activeRingingAlarm, setActiveRingingAlarm] = useState<TimedFollowUp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataCompanyCode, setDataCompanyCode] = useState<string>('');
  const [activeToast, setActiveToast] = useState<{
    title: string;
    body: string;
    tab?: TabType;
    filter?: string;
  } | null>(null);

  const unreadLogsCount = useMemo(() => securityLogs.filter((l) => !l.read).length, [securityLogs]);

  // 24/7 Autonomous Tenant Watchdog Heartbeat
  // Runs silently on mount and every 30 minutes to auto-heal tenant isolation & verify push service health
  useEffect(() => {
    const runWatchdog = async () => {
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://saha-takip-beige.vercel.app';
        await fetch(`${baseUrl}/api/tenant-watchdog`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });
      } catch {
        // Silent background self-healing
      }
    };

    const initialTimer = setTimeout(runWatchdog, 3000);
    const intervalTimer = setInterval(runWatchdog, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, []);

  // Helper to strictly get admin IDs for a specific company (Prevents cross-tenant leak!)
  const getCompanyAdminIds = (targetCompCode?: string): string[] => {
    const cleanComp = (targetCompCode || user?.companyCode || compCode || 'POLATLAR').trim().toUpperCase();

    // 1. Filter currently loaded users strictly by companyCode
    let compAdmins = users
      .filter((u) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === cleanComp && (u.role === 'admin' || isUserAdmin(u)))
      .map((u) => u.id);

    // 2. If not found, try cached users in localStorage
    if (compAdmins.length === 0 && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('@gorev_tamamlama_users_list');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            compAdmins = parsed
              .filter((u: any) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === cleanComp && (u.role === 'admin' || isUserAdmin(u)))
              .map((u: any) => String(u.id));
          }
        }
      } catch {}
    }

    // 3. Fallback only if POLATLAR: ['admin-1']. For other companies like NESACOCUK, NEVER fallback to POLATLAR super admins!
    if (compAdmins.length === 0 && cleanComp === 'POLATLAR') {
      return ['admin-1'];
    }

    return compAdmins;
  };

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
      setTimedFollowUps([]);
      setPersonalNotes([]);
      setActiveRingingAlarm(null);
      setIsLoading(false);
      setDataCompanyCode('');
      return;
    }

    const currentCompCode = activeCompCode;
    const currentCompId = activeCompId;
    const compCode = currentCompCode;
    const compId = currentCompId;

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
    setTimedFollowUps([]);
    setPersonalNotes([]);
    setShifts([]);
    setShiftAssignments([]);
    setActiveRingingAlarm(null);
    setIsLoading(true);
    setDataCompanyCode('');

    StorageService.setCompany(compCode, compId);

    let isMounted = true;
    const isPolatlar = compCode === 'POLATLAR';

    const initData = async () => {
      // 1. FAST CACHE HYDRATION (Stale-While-Revalidate: ~20ms)
      try {
        const cached = await StorageService.getCachedData();
        if (isMounted) {
          if (cached.locations && cached.locations.length > 0) setAllLocations(cached.locations);
          if (cached.standardTasks && cached.standardTasks.length > 0) setStandardTasks(cached.standardTasks);
          if (cached.notes && cached.notes.length > 0) setAllNotes(cached.notes);
          if (cached.returnWarranty && cached.returnWarranty.length > 0) setReturnWarrantyItems(cached.returnWarranty);
          if (cached.services && cached.services.length > 0) setAllServices(cached.services);
          if (cached.workplaceLocation) setWorkplaceLocation(cached.workplaceLocation);
          if (cached.branches && cached.branches.length > 0) setBranches(cached.branches);
          if (cached.attendanceRecords && cached.attendanceRecords.length > 0) setAttendanceRecords(cached.attendanceRecords);
          if (cached.adminReminders && cached.adminReminders.length > 0) setAdminReminders(cached.adminReminders);
          if (cached.leaveRequests && cached.leaveRequests.length > 0) setLeaveRequests(cached.leaveRequests);
          if (cached.securityLogs && cached.securityLogs.length > 0) setSecurityLogs(cached.securityLogs);
          if (cached.timedFollowUps && cached.timedFollowUps.length > 0) setTimedFollowUps(cached.timedFollowUps);
          if (cached.carilerData && cached.carilerData.cariler && cached.carilerData.cariler.length > 0) {
            setCariler(cached.carilerData.cariler);
            setCarilerUpdatedAt(cached.carilerData.updatedAt);
            setCarilerTotal(cached.carilerData.total);
          }
          // Fast cached personal notes for this user
          StorageService.getPersonalNotes(user.id).then((userCachedNotes) => {
            if (isMounted && userCachedNotes && userCachedNotes.length > 0) {
              setPersonalNotes(userCachedNotes);
            }
          }).catch(() => {});
          // Fast cached shifts for company
          StorageService.getShiftData().then((sData) => {
            if (isMounted && sData) {
              if (sData.definitions && sData.definitions.length > 0) setShifts(sData.definitions);
              if (sData.assignments && sData.assignments.length > 0) setShiftAssignments(sData.assignments);
            }
          }).catch(() => {});
          // If cached data was loaded, unlock the UI immediately
          if (
            (cached.locations && cached.locations.length > 0) ||
            (cached.notes && cached.notes.length > 0) ||
            (cached.services && cached.services.length > 0) ||
            (cached.carilerData && cached.carilerData.cariler.length > 0)
          ) {
            setIsLoading(false);
            setDataCompanyCode(compCode);
          }
        }
      } catch (cacheErr) {
        console.warn('Initial cache hydration error:', cacheErr);
      }

      // 2. NETWORK FETCH (Background synchronization)
      try {
        const [locs, tasks, nts, returns, srvs, wpLoc, branchList, attRecs, reminders, cariData, leaveReqs, secLogs, followUps, myPersonalNotes, shiftData] = await Promise.all([
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
          StorageService.getTimedFollowUps(),
          StorageService.getPersonalNotes(user.id),
          StorageService.getShiftData(),
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

          // 12. Admin Reminders (Talimatlar)
          const seenAdminReminders = getStoredSet(SEEN_ADMIN_REMINDERS_KEY(user.id, compCode));
          reminders.forEach((r) => seenAdminReminders.add(r.id));
          saveStoredSet(SEEN_ADMIN_REMINDERS_KEY(user.id, compCode), seenAdminReminders);

          // 13. Reminder Reads (Okundu Bildirimleri)
          const seenReminderReads = getStoredSet(SEEN_REMINDER_READS_KEY(user.id, compCode));
          reminders.forEach((r) => {
            if (r.readBy && Array.isArray(r.readBy)) {
              r.readBy.forEach((readerId) => seenReminderReads.add(`${r.id}_${readerId}`));
            }
          });
          saveStoredSet(SEEN_REMINDER_READS_KEY(user.id, compCode), seenReminderReads);

          // 14. Completed Returns / Warranty items (Ürün Döndü)
          const seenCompletedReturns = getStoredSet(SEEN_COMPLETED_RETURNS_KEY(user.id, compCode));
          returns.forEach((r) => {
            if (r.status === 'completed' && r.completedAt) {
              seenCompletedReturns.add(`${r.id}_${r.completedAt}`);
            }
          });
          saveStoredSet(SEEN_COMPLETED_RETURNS_KEY(user.id, compCode), seenCompletedReturns);

          localStorage.setItem(initKey, 'true');
        }

        setAllLocations(migratedLocs || []);
        setStandardTasks(tasks || []);
        setAllNotes(nts || []);
        setReturnWarrantyItems(returns || []);
        setAllServices(srvs || []);
        if (wpLoc) {
          const finalWp = { ...wpLoc, radiusMeters: (!wpLoc.radiusMeters || wpLoc.radiusMeters === 10) ? 20 : wpLoc.radiusMeters };
          setWorkplaceLocation(finalWp);
        } else {
          setWorkplaceLocation(null);
        }
        setBranches(branchList || []);
        setAttendanceRecords(attRecs || []);
        setAdminReminders(reminders || []);
        setLeaveRequests(leaveReqs || []);
        setSecurityLogs(secLogs || []);
        setCariler((cariData && cariData.cariler) || []);
        setCarilerUpdatedAt(cariData?.updatedAt);
        setCarilerTotal(cariData?.total || 0);
        setTimedFollowUps(followUps || []);
        setPersonalNotes(myPersonalNotes || []);
        setShifts((shiftData && shiftData.definitions) || []);
        setShiftAssignments((shiftData && shiftData.assignments) || []);
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
        async (payload: any) => {
          if (!isMounted) return;
          const changedSlotId = payload?.new?.id ?? payload?.old?.id;
          if (typeof changedSlotId !== 'number') return;

          try {
            // Targeted update: Only refresh if the changed slot strictly matches our company's slot!
            if (changedSlotId === StorageService.getSlotId(6)) {
              const attRecs = await StorageService.getAttendanceRecords();
              if (isMounted) setAttendanceRecords(attRecs);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(4)) {
              const nts = await StorageService.getNotes();
              if (isMounted) setAllNotes(nts);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(3)) {
              const srvs = await StorageService.getServices();
              if (isMounted) setAllServices(srvs);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(11)) {
              const locs = await StorageService.getLocations();
              if (isMounted) setAllLocations(locs);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(2)) {
              const returns = await StorageService.getReturnWarrantyItems();
              if (isMounted) setReturnWarrantyItems(returns);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(5)) {
              const wpLoc = await StorageService.getWorkplaceLocation();
              if (isMounted) {
                if (wpLoc) {
                  const finalWp = {
                    ...wpLoc,
                    radiusMeters: !wpLoc.radiusMeters || wpLoc.radiusMeters === 10 ? 20 : wpLoc.radiusMeters,
                  };
                  setWorkplaceLocation(finalWp);
                } else {
                  setWorkplaceLocation(null);
                }
              }
              return;
            }
            if (changedSlotId === StorageService.getSlotId(14)) {
              const branchList = await StorageService.getBranches();
              if (isMounted) setBranches(branchList);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(7)) {
              const reminders = await StorageService.getAdminReminders();
              if (isMounted) setAdminReminders(reminders);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(10)) {
              const leaveReqs = await StorageService.getLeaveRequests();
              if (isMounted) setLeaveRequests(leaveReqs);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(12)) {
              const secLogs = await StorageService.getSecurityLogs();
              if (isMounted) setSecurityLogs(secLogs);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(16)) {
              const followUps = await StorageService.getTimedFollowUps();
              if (isMounted) setTimedFollowUps(followUps || []);
              return;
            }
            if (changedSlotId === StorageService.getSlotId(15)) {
              const cariData = await StorageService.getCarilerData();
              if (isMounted) {
                setCariler(cariData.cariler);
                setCarilerUpdatedAt(cariData.updatedAt);
                setCarilerTotal(cariData.total);
              }
              return;
            }
            if (changedSlotId === StorageService.getSlotId(1)) {
              const tasks = await StorageService.getStandardTasks();
              if (isMounted) setStandardTasks(tasks);
              return;
            }
            if (changedSlotId === 100) {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('saha:company-directory-updated'));
              }
              return;
            }
          } catch (e) {
            console.warn('Realtime update error:', e);
          }
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

    // Çevrimdışı Eşitleme Zırhı: İnternet geldiğinde, ekran açıldığında veya periyodik olarak bekleyen mesaileri eşitle
    const triggerOfflineSync = async () => {
      if (!isMounted || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
      try {
        const res = await StorageService.syncOfflineAttendance(compCode);
        if (res.synced && isMounted) {
          const latest = await StorageService.getAttendanceRecords();
          if (isMounted) setAttendanceRecords(latest);
        }
      } catch (err) {
        // ignore
      }
    };

    const refreshCloudAttendance = async () => {
      try {
        if (!isMounted) return;
        const latest = await StorageService.getAttendanceRecords();
        if (isMounted && latest) {
          setAttendanceRecords(latest);
        }
      } catch {}
    };

    const handleOnline = () => {
      console.log('[Çevrimdışı Eşitleme] İnternet bağlantısı sağlandı, mesai kayıtları eşitleniyor...');
      triggerOfflineSync();
      refreshCloudAttendance();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerOfflineSync();
        refreshCloudAttendance();
      }
    };

    const handleWindowFocus = () => {
      triggerOfflineSync();
      refreshCloudAttendance();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('focus', handleWindowFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Her 20 saniyede bir hafif kontrol ve bulut eşitleme (Heartbeat sync)
    const syncInterval = setInterval(() => {
      triggerOfflineSync();
      refreshCloudAttendance();
    }, 20000);

    // Yerel Sunucu (Local Mode) Canlı Kalp Atışı (Live Heartbeat Sync - her 12 saniyede bir)
    const localSyncTimer = setInterval(async () => {
      if (!isMounted || !ServerConfigService.isLocalMode()) return;
      try {
        const [freshNotes, freshLocs, freshServices, freshReturns, freshAtt] = await Promise.all([
          StorageService.getNotes(),
          StorageService.getLocations(),
          StorageService.getServices(),
          StorageService.getReturnWarrantyItems(),
          StorageService.getAttendanceRecords(),
        ]);
        if (isMounted) {
          if (freshNotes && freshNotes.length > 0) setAllNotes(freshNotes);
          if (freshLocs && freshLocs.length > 0) setAllLocations(freshLocs);
          if (freshServices && freshServices.length > 0) setAllServices(freshServices);
          if (freshReturns && freshReturns.length > 0) setReturnWarrantyItems(freshReturns);
          if (freshAtt && freshAtt.length > 0) setAttendanceRecords(freshAtt);
        }
      } catch (err) {
        // silent heartbeat
      }
    }, 12000);

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('focus', handleWindowFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      clearInterval(syncInterval);
      clearInterval(localSyncTimer);
    };
  }, [user?.id, activeCompCode, activeCompId]);

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

      // İlk girişte geçmiş hatırlatıcıların patlamasını da engelle
      if (localStorage.getItem(remindersStorageKey) === null) {
        const seenReminders = getStoredSet(remindersStorageKey);
        const now = Date.now();
        allNotes.forEach((n) => {
          if (n.reminderActive && n.reminderDate) {
            const reminderTime = new Date(n.reminderDate).getTime();
            if (reminderTime <= now) {
              seenReminders.add(n.id);
            }
          }
        });
        saveStoredSet(remindersStorageKey, seenReminders);
      }
      return;
    }

    const seenNotes = getStoredSet(notesStorageKey);
    const seenReminders = getStoredSet(remindersStorageKey);
    const now = Date.now();
    let seenNotesChanged = false;
    let seenRemindersChanged = false;
    const newTargetedNotes: typeof allNotes = [];

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
          newTargetedNotes.push(n);
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
            NotificationService.sendNotification(title, n.content, '/?tab=notes&filter=reminders', {
              tag: `note_rem_${n.id}`,
              skipIfVisible: true,
            });
            setActiveToast({ title, body: n.content, tab: 'notes', filter: 'reminders' });
          }
        }
      }
    });

    if (newTargetedNotes.length === 1) {
      const n = newTargetedNotes[0];
      const sender = n.createdByName || 'Yönetici';
      const title = `📋 ${sender} Size Yeni Bir İş Emri İletti!`;
      NotificationService.sendNotification(title, n.content, '/?tab=notes&filter=pending', {
        tag: `note_new_${n.id}`,
        skipIfVisible: true,
      });
      setActiveToast({ title, body: n.content, tab: 'notes', filter: 'pending' });
    } else if (newTargetedNotes.length > 1) {
      const title = `📋 Size ${newTargetedNotes.length} Yeni İş Emri İletildi!`;
      const body = `${newTargetedNotes.length} adet yeni iş emri atandı.`;
      NotificationService.sendNotification(title, body, '/?tab=notes&filter=pending', {
        tag: `note_batch_new_${Date.now()}`,
        skipIfVisible: true,
      });
      setActiveToast({ title, body, tab: 'notes', filter: 'pending' });
    }

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

    // İlk açılış koruması
    if (localStorage.getItem(storageKey) === null) {
      const seenWarrantyReminders = getStoredSet(storageKey);
      const now = Date.now();
      returnWarrantyItems.forEach((item) => {
        if (item.reminderActive && item.reminderDate) {
          const reminderTime = new Date(item.reminderDate).getTime();
          if (reminderTime <= now) {
            seenWarrantyReminders.add(item.id);
          }
        }
      });
      saveStoredSet(storageKey, seenWarrantyReminders);
      return;
    }

    const seenWarrantyReminders = getStoredSet(storageKey);
    let seenWarrantyChanged = false;
    const now = Date.now();
    const newWarrantyAlerts: typeof returnWarrantyItems = [];

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
          newWarrantyAlerts.push(item);
        }
      }
    });

    if (newWarrantyAlerts.length === 1) {
      const item = newWarrantyAlerts[0];
      const typeLabel = item.type === 'warranty' ? 'Garanti' : 'İade';
      const targetName = item.cariName ? `${item.cariName} (${item.companyName})` : item.companyName;
      const title = `🛡️ ${typeLabel} Durum Takibi: ${targetName}`;
      const body = `${targetName} için gönderilen ${typeLabel.toLowerCase()} ürününün durum sorgulama tarihi geldi. Lütfen son durumunu sorgulayın.`;
      NotificationService.sendNotification(title, body);
      setActiveToast({ title, body, tab: 'returns' });
    } else if (newWarrantyAlerts.length > 1) {
      const title = `🛡️ ${newWarrantyAlerts.length} Garanti/İade Takip Hatırlatması`;
      const body = `${newWarrantyAlerts.length} adet ürünün durum kontrol tarihi geldi.`;
      NotificationService.sendNotification(title, body);
      setActiveToast({ title, body, tab: 'returns' });
    }

    if (seenWarrantyChanged) {
      saveStoredSet(storageKey, seenWarrantyReminders);
    }
  }, [returnWarrantyItems, user, dataCompanyCode]);

  // Check incoming return & warranty completed ("Ürün Döndü") alerts for Admin
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || returnWarrantyItems.length === 0) return;

    if (isUserAdmin(user)) {
      const storageKey = SEEN_COMPLETED_RETURNS_KEY(user.id, compCode);

      // İlk açılış koruması
      if (localStorage.getItem(storageKey) === null) {
        const seenCompletedReturns = getStoredSet(storageKey);
        returnWarrantyItems.forEach((item) => {
          if (item.status === 'completed' && item.completedAt) {
            seenCompletedReturns.add(`${item.id}_${item.completedAt}`);
          }
        });
        saveStoredSet(storageKey, seenCompletedReturns);
        return;
      }

      const seenCompletedReturns = getStoredSet(storageKey);
      let seenChanged = false;
      const newCompletedReturns: typeof returnWarrantyItems = [];

      returnWarrantyItems.forEach((item) => {
        if (item.status === 'completed' && item.completedAt) {
          const key = `${item.id}_${item.completedAt}`;
          if (!seenCompletedReturns.has(key)) {
            seenCompletedReturns.add(key);
            seenChanged = true;

            // Only notify if completed by someone else (avoids duplicate toast on device of person who clicked it)
            if (item.completedBy !== user.id) {
              newCompletedReturns.push(item);
            }
          }
        }
      });

      if (newCompletedReturns.length === 1) {
        const item = newCompletedReturns[0];
        const staff = item.completedByName || 'Yetkili';
        const typeLabel = item.type === 'warranty' ? 'Garanti' : 'İade';
        const cariText = item.cariName ? `[${item.cariName}] ` : '';
        const serialText = item.serialNumber ? ` (Seri No: ${item.serialNumber})` : '';
        const title = `📦 ${typeLabel} Ürünü Geri Döndü!`;
        const body = `${staff}, ${cariText}${item.companyName} firmasına ait ${typeLabel.toLowerCase()} ürününü "Geri Döndü" olarak işaretledi.${serialText}`;
        NotificationService.sendNotification(title, body);
        setActiveToast({ title, body, tab: 'returns' });
      } else if (newCompletedReturns.length > 1) {
        const title = `📦 ${newCompletedReturns.length} Ürün Geri Döndü!`;
        const body = `${newCompletedReturns.length} adet garanti/iade ürünü "Geri Döndü" olarak işaretlendi.`;
        NotificationService.sendNotification(title, body);
        setActiveToast({ title, body, tab: 'returns' });
      }

      if (seenChanged) {
        saveStoredSet(storageKey, seenCompletedReturns);
      }
    }
  }, [returnWarrantyItems, user, dataCompanyCode]);

  // Check incoming admin reminders / talimatlar for all personnel
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || adminReminders.length === 0) return;

    const storageKey = SEEN_ADMIN_REMINDERS_KEY(user.id, compCode);
    if (localStorage.getItem(storageKey) === null) {
      const seenReminders = getStoredSet(storageKey);
      adminReminders.forEach((r) => seenReminders.add(r.id));
      saveStoredSet(storageKey, seenReminders);
      return;
    }

    const seenReminders = getStoredSet(storageKey);
    let seenChanged = false;
    const newRemindersList: typeof adminReminders = [];

    adminReminders.forEach((r) => {
      // If created by someone else and user hasn't seen it yet
      if (r.createdBy && r.createdBy !== user.id) {
        if (!seenReminders.has(r.id)) {
          seenReminders.add(r.id);
          seenChanged = true;
          newRemindersList.push(r);
        }
      } else if (r.createdBy === user.id) {
        if (!seenReminders.has(r.id)) {
          seenReminders.add(r.id);
          seenChanged = true;
        }
      }
    });

    if (newRemindersList.length === 1) {
      const r = newRemindersList[0];
      const author = r.createdByName || 'Yönetici';
      const title = `📢 Yeni Yönetici Talimatı: ${r.title}`;
      const body = `${author}: "${r.content.slice(0, 90)}"`;
      NotificationService.sendNotification(title, body);
      setActiveToast({ title, body, tab: 'reminders' });
    } else if (newRemindersList.length > 1) {
      const title = `📢 ${newRemindersList.length} Yeni Yönetici Talimatı`;
      const body = `${newRemindersList.length} adet yeni yönetici talimatı paylaşıldı.`;
      NotificationService.sendNotification(title, body);
      setActiveToast({ title, body, tab: 'reminders' });
    }

    if (seenChanged) {
      saveStoredSet(storageKey, seenReminders);
    }
  }, [adminReminders, user, dataCompanyCode]);

  // Check read receipts for reminders created by the current user
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || adminReminders.length === 0) return;

    const storageKey = SEEN_REMINDER_READS_KEY(user.id, compCode);
    if (localStorage.getItem(storageKey) === null) {
      const seenReads = getStoredSet(storageKey);
      adminReminders.forEach((r) => {
        if (r.readBy && Array.isArray(r.readBy)) {
          r.readBy.forEach((readerId) => seenReads.add(`${r.id}_${readerId}`));
        }
      });
      saveStoredSet(storageKey, seenReads);
      return;
    }

    const seenReads = getStoredSet(storageKey);
    let seenChanged = false;

    adminReminders.forEach((r) => {
      // Only check reminders created by the current user
      if (r.createdBy === user.id && r.readBy && Array.isArray(r.readBy)) {
        r.readBy.forEach((readerId) => {
          if (readerId !== user.id) {
            const readKey = `${r.id}_${readerId}`;
            if (!seenReads.has(readKey)) {
              seenReads.add(readKey);
              seenChanged = true;

              const readerUser = users.find((u) => u.id === readerId);
              const readerName = readerUser?.name || readerUser?.username || 'Personel';
              const title = `👁️ Talimat Okundu: ${r.title}`;
              const body = `${readerName}, "${r.title}" talimatınızı okudu ve onayladı.`;
              NotificationService.sendNotification(title, body);
              setActiveToast({ title, body, tab: 'reminders' });
            }
          }
        });
      }
    });

    if (seenChanged) {
      saveStoredSet(storageKey, seenReads);
    }
  }, [adminReminders, user, users, dataCompanyCode]);

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
    const newLocsList: typeof allLocations = [];

    allLocations.forEach((loc) => {
      // If created by a staff member (or someone else)
      if (loc.createdBy && loc.createdBy !== user.id) {
        if (!seenLocs.has(loc.id)) {
          seenLocs.add(loc.id);
          seenChanged = true;
          newLocsList.push(loc);
        }
      } else if (loc.createdBy === user.id) {
        if (!seenLocs.has(loc.id)) {
          seenLocs.add(loc.id);
          seenChanged = true;
        }
      }
    });

    if (newLocsList.length === 1) {
      const loc = newLocsList[0];
      const staffName = loc.createdByName || 'Saha Personeli';
      const title = '📍 Yeni Kurulum Eklendi!';
      const body = `${staffName}, "${loc.name}" için yeni bir kurulum kaydı oluşturdu.`;
      NotificationService.sendNotification(title, body, '/?tab=installations', {
        tag: `loc_new_${loc.id}`,
        skipIfVisible: true,
      });
      setActiveToast({ title, body, tab: 'installations' });
    } else if (newLocsList.length > 1) {
      const title = `📍 ${newLocsList.length} Yeni Kurulum Eklendi!`;
      const body = `${newLocsList.length} adet yeni kurulum kaydı eklendi.`;
      NotificationService.sendNotification(title, body, '/?tab=installations', {
        tag: `loc_batch_new_${Date.now()}`,
        skipIfVisible: true,
      });
      setActiveToast({ title, body, tab: 'installations' });
    }

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
    const newDoneList: typeof allLocations = [];

    allLocations.forEach((loc) => {
      const isComplete =
        loc.tasks.length > 0 &&
        loc.tasks.every((t) => t.status === 'completed' || t.status === 'not_present');

      if (isComplete) {
        if (!seenDone.has(loc.id)) {
          seenDone.add(loc.id);
          seenChanged = true;
          newDoneList.push(loc);
        }
      }
    });

    if (newDoneList.length === 1) {
      const loc = newDoneList[0];
      const staffName = loc.createdByName || 'Saha Personeli';
      const title = '✅ Kurulum Tamamlandı!';
      const body = `${staffName}, "${loc.name}" kurulumundaki tüm görevleri tamamladı.`;
      NotificationService.sendNotification(title, body, '/?tab=installations', {
        tag: `loc_alltasks_${loc.id}`,
        skipIfVisible: true,
      });
      setActiveToast({ title, body, tab: 'installations' });
    } else if (newDoneList.length > 1) {
      const title = `✅ ${newDoneList.length} Kurulum Tamamlandı!`;
      const body = `${newDoneList.length} adet kurulumdaki tüm görevler tamamlandı.`;
      NotificationService.sendNotification(title, body, '/?tab=installations', {
        tag: `loc_batch_alltasks_${Date.now()}`,
        skipIfVisible: true,
      });
      setActiveToast({ title, body, tab: 'installations' });
    }

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
    const newServicesList: typeof allServices = [];

    allServices.forEach((srv) => {
      if (srv.createdBy && srv.createdBy !== user.id) {
        if (!seenServices.has(srv.id)) {
          seenServices.add(srv.id);
          seenChanged = true;
          newServicesList.push(srv);
        }
      } else if (srv.createdBy === user.id) {
        if (!seenServices.has(srv.id)) {
          seenServices.add(srv.id);
          seenChanged = true;
        }
      }
    });

    if (newServicesList.length === 1) {
      const srv = newServicesList[0];
      const staffName = srv.createdByName || 'Saha Personeli';
      const title = '🔧 Yeni Servis Kaydı!';
      const body = `${staffName}, "${srv.companyName}" için servis kaydı ekledi.`;
      NotificationService.sendNotification(title, body);
      setActiveToast({ title, body, tab: 'services' });
    } else if (newServicesList.length > 1) {
      const title = `🔧 ${newServicesList.length} Yeni Servis Kaydı!`;
      const body = `${newServicesList.length} adet yeni servis kaydı oluşturuldu.`;
      NotificationService.sendNotification(title, body);
      setActiveToast({ title, body, tab: 'services' });
    }

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

      // İlk oturum / ilk açılış koruması: Geçmişte birikmiş onay bekleyen iş emirlerini sessizce kaydet, ardışık bildirim patlatma!
      if (localStorage.getItem(completedStorageKey) === null) {
        const seenCompleted = getStoredSet(completedStorageKey);
        allNotes.forEach((n) => {
          if (n.status === 'pending_approval' && n.completedAt) {
            seenCompleted.add(`${n.id}_${n.completedAt}`);
          }
        });
        saveStoredSet(completedStorageKey, seenCompleted);
        return;
      }

      const seenCompleted = getStoredSet(completedStorageKey);
      let seenChanged = false;
      const newPendingNotes: typeof allNotes = [];

      allNotes.forEach((n) => {
        if (n.status === 'pending_approval' && n.completedAt && n.completedBy !== user.id) {
          const key = `${n.id}_${n.completedAt}`;
          if (!seenCompleted.has(key)) {
            seenCompleted.add(key);
            seenChanged = true;
            newPendingNotes.push(n);
          }
        }
      });

      if (newPendingNotes.length === 1) {
        const n = newPendingNotes[0];
        const staff = n.completedByName || 'Saha Personeli';
        const title = '📋 İş Emri Onay Bekliyor!';
        const body = `${staff}, "${n.content.slice(0, 50)}" iş emrini tamamladı.${n.completionNote ? ` Not: ${n.completionNote}` : ''}`;
        NotificationService.sendNotification(title, body, '/?tab=notes&filter=pending', {
          tag: `note_comp_${n.id}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'notes', filter: 'pending' });
      } else if (newPendingNotes.length > 1) {
        const title = `📋 ${newPendingNotes.length} Yeni İş Emri Onay Bekliyor!`;
        const body = `${newPendingNotes.length} adet tamamlanan iş emri onayınızı bekliyor.`;
        NotificationService.sendNotification(title, body, '/?tab=notes&filter=pending', {
          tag: `notes_batch_comp_${Date.now()}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'notes', filter: 'pending' });
      }

      if (seenChanged) {
        saveStoredSet(completedStorageKey, seenCompleted);
      }
    }

    // 2. For Staff: Alert when Admin approves or rejects the staff's work order
    if (user.role !== 'admin') {
      const approvalStorageKey = SEEN_APPROVAL_NOTES_KEY(user.id, compCode);

      // İlk açılış koruması
      if (localStorage.getItem(approvalStorageKey) === null) {
        const seenApproval = getStoredSet(approvalStorageKey);
        allNotes.forEach((n) => {
          if (n.status === 'approved' && n.approvedAt) {
            seenApproval.add(`${n.id}_approved_${n.approvedAt}`);
          }
          if (n.status === 'rejected' && n.rejectedAt) {
            seenApproval.add(`${n.id}_rejected_${n.rejectedAt}`);
          }
        });
        saveStoredSet(approvalStorageKey, seenApproval);
        return;
      }

      const seenApproval = getStoredSet(approvalStorageKey);
      let seenChanged = false;
      const newApproved: typeof allNotes = [];
      const newRejected: typeof allNotes = [];

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
              newApproved.push(n);
            }
          }

          // Check Rejected
          if (n.status === 'rejected' && n.rejectedAt) {
            const key = `${n.id}_rejected_${n.rejectedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;
              newRejected.push(n);
            }
          }
        }
      });

      if (newApproved.length === 1) {
        const n = newApproved[0];
        const admin = n.approvedByName || 'Yönetici';
        const title = '✅ İş Emri Onaylandı!';
        const body = `${admin}, "${n.content.slice(0, 50)}" iş emrinizi başarıyla onayladı.`;
        NotificationService.sendNotification(title, body, '/?tab=notes&filter=approved', {
          tag: `note_app_${n.id}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'notes', filter: 'approved' });
      } else if (newApproved.length > 1) {
        const title = `✅ ${newApproved.length} İş Emri Onaylandı!`;
        const body = `Yönetici ${newApproved.length} adet iş emrinizi onayladı.`;
        NotificationService.sendNotification(title, body, '/?tab=notes&filter=approved', {
          tag: `notes_batch_app_${Date.now()}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'notes', filter: 'approved' });
      }

      if (newRejected.length === 1) {
        const n = newRejected[0];
        const admin = n.rejectedByName || 'Yönetici';
        const title = '❌ İş Emri Reddedildi!';
        const body = `${admin}, "${n.content.slice(0, 50)}" iş emrini reddetti. Gerekçe: ${n.rejectionReason || 'Eksikler var'}`;
        NotificationService.sendNotification(title, body, '/?tab=notes&filter=rejected', {
          tag: `note_rej_${n.id}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'notes', filter: 'rejected' });
      } else if (newRejected.length > 1) {
        const title = `❌ ${newRejected.length} İş Emri Reddedildi!`;
        const body = `Yönetici ${newRejected.length} adet iş emrinizi reddetti.`;
        NotificationService.sendNotification(title, body, '/?tab=notes&filter=rejected', {
          tag: `notes_batch_rej_${Date.now()}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'notes', filter: 'rejected' });
      }

      if (seenChanged) {
        saveStoredSet(approvalStorageKey, seenApproval);
      }
    }
  }, [allNotes, user, dataCompanyCode]);


  // Check incoming location completions (for Admin) & approval/rejection results (for Staff)
  useEffect(() => {
    const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    if (!user || dataCompanyCode.toUpperCase() !== compCode || allLocations.length === 0) return;

    // 1. For Admin: Alert when a staff member completes a location (pending_approval)
    if (isUserAdmin(user)) {
      const completedStorageKey = SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode);

      // İlk açılış koruması
      if (localStorage.getItem(completedStorageKey) === null) {
        const seenCompleted = getStoredSet(completedStorageKey);
        allLocations.forEach((loc) => {
          if (loc.status === 'pending_approval' && loc.completedAt) {
            seenCompleted.add(`${loc.id}_pending_${loc.completedAt}`);
          }
        });
        saveStoredSet(completedStorageKey, seenCompleted);
        return;
      }

      const seenCompleted = getStoredSet(completedStorageKey);
      let seenChanged = false;
      const newPendingLocations: typeof allLocations = [];

      allLocations.forEach((loc) => {
        if (loc.status === 'pending_approval' && loc.completedAt && loc.completedBy !== user.id) {
          const key = `${loc.id}_pending_${loc.completedAt}`;
          if (!seenCompleted.has(key)) {
            seenCompleted.add(key);
            seenChanged = true;
            newPendingLocations.push(loc);
          }
        }
      });

      if (newPendingLocations.length === 1) {
        const loc = newPendingLocations[0];
        const staff = loc.completedByName || 'Saha Personeli';
        const title = '📍 Kurulum Onay Bekliyor!';
        const body = `${staff}, "${loc.name}" kurulumunu tamamladı.${loc.completionNote ? ` Not: ${loc.completionNote}` : ''}`;
        NotificationService.sendNotification(title, body, '/?tab=installations&filter=pending_approval', {
          tag: `loc_comp_${loc.id}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'installations', filter: 'pending_approval' });
      } else if (newPendingLocations.length > 1) {
        const title = `📍 ${newPendingLocations.length} Kurulum Onay Bekliyor!`;
        const body = `${newPendingLocations.length} adet kurulum kaydı onayınızı bekliyor.`;
        NotificationService.sendNotification(title, body, '/?tab=installations&filter=pending_approval', {
          tag: `loc_batch_comp_${Date.now()}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'installations', filter: 'pending_approval' });
      }

      if (seenChanged) {
        saveStoredSet(completedStorageKey, seenCompleted);
      }
    }

    // 2. For Staff: Alert when Admin approves or rejects the staff's location
    if (user.role !== 'admin') {
      const approvalStorageKey = SEEN_APPROVAL_LOCATIONS_KEY(user.id, compCode);

      // İlk açılış koruması
      if (localStorage.getItem(approvalStorageKey) === null) {
        const seenApproval = getStoredSet(approvalStorageKey);
        allLocations.forEach((loc) => {
          if (loc.status === 'approved' && loc.approvedAt) {
            seenApproval.add(`${loc.id}_approved_${loc.approvedAt}`);
          }
          if (loc.status === 'rejected' && loc.rejectedAt) {
            seenApproval.add(`${loc.id}_rejected_${loc.rejectedAt}`);
          }
        });
        saveStoredSet(approvalStorageKey, seenApproval);
        return;
      }

      const seenApproval = getStoredSet(approvalStorageKey);
      let seenChanged = false;
      const UpperApprovedLocs: typeof allLocations = [];
      const UpperRejectedLocs: typeof allLocations = [];

      allLocations.forEach((loc) => {
        const isMyLoc = loc.completedBy === user.id || loc.createdBy === user.id;

        if (isMyLoc) {
          // Check Approved
          if (loc.status === 'approved' && loc.approvedAt) {
            const key = `${loc.id}_approved_${loc.approvedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;
              UpperApprovedLocs.push(loc);
            }
          }

          // Check Rejected
          if (loc.status === 'rejected' && loc.rejectedAt) {
            const key = `${loc.id}_rejected_${loc.rejectedAt}`;
            if (!seenApproval.has(key)) {
              seenApproval.add(key);
              seenChanged = true;
              UpperRejectedLocs.push(loc);
            }
          }
        }
      });

      if (UpperApprovedLocs.length === 1) {
        const loc = UpperApprovedLocs[0];
        const admin = loc.approvedByName || 'Yönetici';
        const title = '✅ Kurulum Onaylandı!';
        const body = `${admin}, "${loc.name}" kurulumunuzu başarıyla onayladı.`;
        NotificationService.sendNotification(title, body, '/?tab=installations&filter=approved', {
          tag: `loc_app_${loc.id}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'installations', filter: 'approved' });
      } else if (UpperApprovedLocs.length > 1) {
        const title = `✅ ${UpperApprovedLocs.length} Kurulum Onaylandı!`;
        const body = `Yönetici ${UpperApprovedLocs.length} adet kurulum kaydınızı onayladı.`;
        NotificationService.sendNotification(title, body, '/?tab=installations&filter=approved', {
          tag: `loc_batch_app_${Date.now()}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'installations', filter: 'approved' });
      }

      if (UpperRejectedLocs.length === 1) {
        const loc = UpperRejectedLocs[0];
        const admin = loc.rejectedByName || 'Yönetici';
        const title = '❌ Kurulum Reddedildi!';
        const body = `${admin}, "${loc.name}" kurulumunu reddetti. Gerekçe: ${loc.rejectionReason || 'Eksikler var'}`;
        NotificationService.sendNotification(title, body, '/?tab=installations&filter=rejected', {
          tag: `loc_rej_${loc.id}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'installations', filter: 'rejected' });
      } else if (UpperRejectedLocs.length > 1) {
        const title = `❌ ${UpperRejectedLocs.length} Kurulum Reddedildi!`;
        const body = `Yönetici ${UpperRejectedLocs.length} adet kurulum kaydınızı reddetti.`;
        NotificationService.sendNotification(title, body, '/?tab=installations&filter=rejected', {
          tag: `loc_batch_rej_${Date.now()}`,
          skipIfVisible: true,
        });
        setActiveToast({ title, body, tab: 'installations', filter: 'rejected' });
      }

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
      const activeComp = (user?.companyCode || compCode || 'POLATLAR').trim().toUpperCase();
      const adminIds = getCompanyAdminIds(activeComp);
      if (adminIds.length > 0) {
        const staffName = user?.name || user?.username || 'Saha Personeli';
        OneSignalService.sendPushNotification({
          title: '📍 Yeni Kurulum Eklendi!',
          message: `${staffName}, "${newLocation.name}" için yeni bir kurulum kaydı oluşturdu.`,
          targetMode: 'custom',
          targetUserIds: adminIds,
          companyCode: activeComp,
          url: 'https://saha-takip-beige.vercel.app/?tab=installations',
          collapseId: `loc_new_${newLocation.id}`,
        }).catch((err) => console.warn('OneSignal new loc push error:', err));
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
      const activeComp = (user?.companyCode || compCode || 'POLATLAR').trim().toUpperCase();
      const adminIds = getCompanyAdminIds(activeComp);

      if (adminIds.length > 0) {
        OneSignalService.sendPushNotification({
          title: '✅ Kurulum Tamamlandı!',
          message: `${staffName}, "${updatedTarget.name}" kurulumundaki tüm görevleri başarıyla tamamladı.`,
          targetMode: 'custom',
          targetUserIds: adminIds,
          companyCode: activeComp,
          url: 'https://saha-takip-beige.vercel.app/?tab=installations',
          collapseId: `loc_alltasks_${updatedTarget.id}`,
        }).catch((err) => console.warn('OneSignal complete task push error:', err));
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

    // Send instant hardware push notification to Admin(s) in background
    (async () => {
      try {
        const activeComp = (user?.companyCode || compCode || 'POLATLAR').trim().toUpperCase();
        let adminIds = getCompanyAdminIds(activeComp);
        if (adminIds.length === 0) {
          try {
            const cloudUsers = await UserService.fetchUsersFromCloud();
            adminIds = cloudUsers
              .filter((u) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === activeComp && (u.role === 'admin' || isUserAdmin(u)))
              .map((u) => u.id);
          } catch {
            // ignore
          }
        }
        if (adminIds.length === 0 && activeComp === 'POLATLAR') {
          adminIds = ['admin-1'];
        }

        const locSnippet = targetLocation.name.length > 50 ? `${targetLocation.name.slice(0, 50)}...` : targetLocation.name;
        const locExplanation = trimmedNote ? `\nAçıklama: ${trimmedNote}` : '';

        if (adminIds.length > 0) {
          await OneSignalService.sendPushNotification({
            title: '📍 Kurulum Tamamlandı (Onay Bekliyor)',
            message: `${staffName}, "${locSnippet}" kurulumunu tamamladı ve onayınıza sundu.${locExplanation}`,
            targetMode: 'custom',
            targetUserIds: adminIds,
            companyCode: activeComp,
            url: 'https://saha-takip-beige.vercel.app/?tab=installations&filter=pending_approval',
            collapseId: `loc_comp_${targetLocation.id}`,
          });
        }
      } catch (err) {
        console.warn('OneSignal completeLocation push error:', err);
      }
    })();
  };

  // Admin approves completed location
  const approveLocation = async (id: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler kurulum kayıtlarını onaylayabilir.');
      return;
    }

    const targetLoc = allLocations.find((l) => l.id === id);
    if (!targetLoc || targetLoc.status === 'approved') return;

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

    // Send push notification in background
    (async () => {
      try {
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
            companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
            url: 'https://saha-takip-beige.vercel.app/?tab=installations&filter=approved',
            collapseId: `loc_app_${id}`,
          });
        }
      } catch (err) {
        console.warn('OneSignal approveLocation push error:', err);
      }
    })();
  };

  // Admin rejects completed location with reason
  const rejectLocation = async (id: string, reason?: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler kurulum kayıtlarını reddedebilir.');
      return;
    }

    const targetLoc = allLocations.find((l) => l.id === id);
    if (!targetLoc || targetLoc.status === 'rejected') return;

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

    // Send push notification in background
    (async () => {
      try {
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
            companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
            url: 'https://saha-takip-beige.vercel.app/?tab=installations&filter=rejected',
            collapseId: `loc_rej_${id}`,
          });
        }
      } catch (err) {
        console.warn('OneSignal rejectLocation push error:', err);
      }
    })();
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

    // 1. Instant optimistic state update
    const newNotes = [newNote, ...allNotesRef.current];
    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    // 2. Background atomic persistence
    StorageService.saveSingleNote(newNote).catch((err) => {
      console.warn('saveSingleNote background error:', err);
    });

    // 3. Background hardware push notification directly to locked phones via OneSignal (non-blocking)
    if (targetMode !== 'self') {
      const notifTitle = newNote.cariName
        ? `📋 ${newNote.cariName} - İş Emri (${newNote.createdByName})`
        : `📋 ${newNote.createdByName} Size Yeni Bir İş Emri İletti!`;

      const notifMsg = newNote.cariName
        ? `🏢 CARİ: ${newNote.cariName}\n📝 ${newNote.content}`
        : newNote.content;

      // 1. Immediate arrival alert (if not self)
      OneSignalService.sendPushNotification({
        title: notifTitle,
        message: notifMsg,
        targetMode,
        targetUserIds,
        companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
        url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=pending',
        collapseId: `note_new_${newNote.id}`,
      }).catch((err) => console.warn('OneSignal addNote push error:', err));
    }

    // 2. Scheduled reminder alert (OneSignal server will wake up locked phone at exact reminder time)
    // Runs for all target modes including 'self' so the creator gets their alarm!
    if (reminderActive && reminderDate) {
      const isTargetSelf = targetMode === 'self';
      const effectiveMode = isTargetSelf ? 'custom' : targetMode;
      const effectiveUserIds = isTargetSelf ? (user?.id ? [user.id] : []) : targetUserIds;
      const notifMsg = newNote.cariName
        ? `🏢 CARİ: ${newNote.cariName}\n📝 ${newNote.content}`
        : newNote.content;

      OneSignalService.sendPushNotification({
        title: newNote.cariName ? `⏰ [${newNote.cariName}] Hatırlatıcı` : `⏰ İş Emri Hatırlatıcısı`,
        message: notifMsg,
        targetMode: effectiveMode,
        targetUserIds: effectiveUserIds,
        companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
        url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=reminders',
        sendAfter: new Date(reminderDate).toISOString(),
        collapseId: `note_rem_${newNote.id}`,
      }).catch((err) => console.warn('OneSignal addNote reminder push error:', err));
    }
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
    const newNotes = allNotesRef.current.map((n) => {
      if (n.id === id) {
        const nextMode = targetMode !== undefined ? targetMode : n.targetMode || 'self';
        const nextIds = targetUserIds !== undefined ? targetUserIds : n.targetUserIds || [];
        const nextNames = targetUserNames !== undefined ? targetUserNames : n.targetUserNames || [];

        const updated: GeneralNote = {
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
        return updated;
      }
      return n;
    });

    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    const noteToSave = newNotes.find((n) => n.id === id);
    if (noteToSave) {
      StorageService.saveSingleNote(noteToSave).catch((err) => {
        console.warn('saveSingleNote update error:', err);
      });

      // Send update arrival notification to assigned personnel if not self
      if (noteToSave.targetMode !== 'self') {
        const notifTitle = noteToSave.cariName
          ? `📋 ${noteToSave.cariName} - İş Emri Güncellendi (${user?.name || user?.username || 'Yönetici'})`
          : `📋 ${user?.name || user?.username || 'Yönetici'} İş Emrini Güncelledi!`;

        const notifMsg = noteToSave.cariName
          ? `🏢 CARİ: ${noteToSave.cariName}\n📝 ${noteToSave.content}`
          : noteToSave.content;

        OneSignalService.sendPushNotification({
          title: notifTitle,
          message: notifMsg,
          targetMode: noteToSave.targetMode,
          targetUserIds: noteToSave.targetUserIds,
          companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
          url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=pending',
          collapseId: `note_upd_${noteToSave.id}`,
        }).catch((err) => console.warn('OneSignal updateNote push error:', err));
      }

      // Update or cancel scheduled reminder push
      if (reminderActive && reminderDate) {
        const isTargetSelf = noteToSave.targetMode === 'self';
        const effectiveMode = isTargetSelf ? 'custom' : noteToSave.targetMode;
        const effectiveUserIds = isTargetSelf ? (user?.id ? [user.id] : []) : noteToSave.targetUserIds;
        const notifMsg = noteToSave.cariName
          ? `🏢 CARİ: ${noteToSave.cariName}\n📝 ${noteToSave.content}`
          : noteToSave.content;

        OneSignalService.sendPushNotification({
          title: noteToSave.cariName ? `⏰ [${noteToSave.cariName}] Hatırlatıcı` : `⏰ İş Emri Hatırlatıcısı`,
          message: notifMsg,
          targetMode: effectiveMode,
          targetUserIds: effectiveUserIds,
          companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
          url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=reminders',
          sendAfter: new Date(reminderDate).toISOString(),
          collapseId: `note_rem_${id}`,
        }).catch((err) => console.warn('OneSignal updateNote reminder push error:', err));
      } else {
        OneSignalService.cancelNotification(`note_rem_${id}`).catch(() => {});
      }
    }
  };

  // Delete general note
  const deleteNote = async (id: string) => {
    OneSignalService.cancelNotification(`note_rem_${id}`).catch(() => {});
    const newNotes = allNotesRef.current.filter((n) => n.id !== id);
    allNotesRef.current = newNotes;
    setAllNotes(newNotes);
    try {
      await StorageService.deleteNote(id);
    } catch (err) {
      console.warn('StorageService.deleteNote error:', err);
    }
  };

  // Mark note as completed by Staff (submits to Admin for approval)
  const completeNote = async (id: string, completionNote?: string, completionPhotos?: string[]) => {
    const currentNotes = allNotesRef.current;
    const targetNote = currentNotes.find((n) => n.id === id);
    if (!targetNote) return;

    const completedAt = Date.now();
    const staffName = user?.name || user?.username || 'Saha Personeli';
    const trimmedNote = completionNote?.trim() || undefined;

    const updatedNote: GeneralNote = {
      ...targetNote,
      status: 'pending_approval' as const,
      completedAt,
      completedBy: user?.id,
      completedByName: staffName,
      completionNote: trimmedNote,
      completionPhotos: completionPhotos !== undefined ? completionPhotos : targetNote.completionPhotos || [],
      // Reset previous rejection if resubmitted
      rejectedAt: undefined,
      rejectedBy: undefined,
      rejectedByName: undefined,
      rejectionReason: undefined,
    };

    const newNotes = currentNotes.map((n) => (n.id === id ? updatedNote : n));
    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    // Mark as seen on staff device immediately
    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenCompleted = getStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id, compCode));
      seenCompleted.add(`${id}_${completedAt}`);
      saveStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id, compCode), seenCompleted);
    }

    // Background atomic persistence (non-blocking)
    StorageService.saveSingleNote(updatedNote).catch((err) => {
      console.warn('saveSingleNote completeNote error:', err);
    });

    // Send instant hardware push notification to Admin(s) in background
    (async () => {
      try {
        const activeComp = (user?.companyCode || compCode || 'POLATLAR').trim().toUpperCase();
        let adminIds = getCompanyAdminIds(activeComp);
        if (adminIds.length === 0) {
          try {
            const cloudUsers = await UserService.fetchUsersFromCloud();
            adminIds = cloudUsers
              .filter((u) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === activeComp && (u.role === 'admin' || isUserAdmin(u)))
              .map((u) => u.id);
          } catch {
            // ignore
          }
        }
        if (adminIds.length === 0 && activeComp === 'POLATLAR') {
          adminIds = ['admin-1'];
        }

        const noteSnippet =
          targetNote.content.length > 50 ? `${targetNote.content.slice(0, 50)}...` : targetNote.content;
        const noteExplanation = trimmedNote ? `\nAçıklama: ${trimmedNote}` : '';

        if (adminIds.length > 0) {
          await OneSignalService.sendPushNotification({
            title: '📋 İş Emri Tamamlandı (Onay Bekliyor)',
            message: `${staffName}, "${noteSnippet}" iş emrini tamamladı.${noteExplanation}`,
            targetMode: 'custom',
            targetUserIds: adminIds,
            companyCode: activeComp,
            url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=pending',
            collapseId: `note_comp_${targetNote.id}`,
          });
        }
      } catch (pushErr) {
        console.warn('OneSignal completeNote push error:', pushErr);
      }
    })();
  };

  // Admin approves completed work order
  const approveNote = async (id: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler iş emirlerini onaylayabilir.');
      return;
    }

    const currentNotes = allNotesRef.current;
    const targetNote = currentNotes.find((n) => n.id === id);
    if (!targetNote || targetNote.status === 'approved') return;

    const approvedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';

    const updatedNote: GeneralNote = {
      ...targetNote,
      status: 'approved' as const,
      approvedAt,
      approvedBy: user?.id,
      approvedByName: adminName,
    };

    const newNotes = currentNotes.map((n) => (n.id === id ? updatedNote : n));
    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    // Mark as seen on admin device immediately
    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode));
      seenApprovals.add(`${id}_approved_${approvedAt}`);
      saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode), seenApprovals);
    }

    // Background atomic persistence (non-blocking)
    StorageService.saveSingleNote(updatedNote).catch((err) => {
      console.warn('saveSingleNote approveNote error:', err);
    });

    // Notify Staff who completed it or was targeted in background
    (async () => {
      try {
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
            companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
            url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=approved',
            collapseId: `note_app_${id}`,
          });
        }
      } catch (pushErr) {
        console.warn('OneSignal approveNote push error:', pushErr);
      }
    })();
  };

  // Admin rejects completed work order with reason
  const rejectNote = async (id: string, reason?: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler iş emirlerini reddedebilir.');
      return;
    }

    const currentNotes = allNotesRef.current;
    const targetNote = currentNotes.find((n) => n.id === id);
    if (!targetNote || targetNote.status === 'rejected') return;

    const rejectedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';
    const trimmedReason = reason?.trim() || 'Yönetici tarafından eksik görüldü';

    const updatedNote: GeneralNote = {
      ...targetNote,
      status: 'rejected' as const,
      rejectedAt,
      rejectedBy: user?.id,
      rejectedByName: adminName,
      rejectionReason: trimmedReason,
    };

    const newNotes = currentNotes.map((n) => (n.id === id ? updatedNote : n));
    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    // Mark as seen on admin device immediately
    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode));
      seenApprovals.add(`${id}_rejected_${rejectedAt}`);
      saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode), seenApprovals);
    }

    // Background atomic persistence (non-blocking)
    StorageService.saveSingleNote(updatedNote).catch((err) => {
      console.warn('saveSingleNote rejectNote error:', err);
    });

    // Notify Staff who completed it or was targeted in background
    (async () => {
      try {
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
            companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
            url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=rejected',
            collapseId: `note_rej_${id}`,
          });
        }
      } catch (pushErr) {
        console.warn('OneSignal rejectNote push error:', pushErr);
      }
    })();
  };

  // Bulk: Admin approves multiple work orders in one atomic batch
  const approveMultipleNotes = async (ids: string[]) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler iş emirlerini onaylayabilir.');
      return;
    }
    if (!ids || ids.length === 0) return;

    const currentNotes = allNotesRef.current;
    const targetSet = new Set(ids);
    const approvedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';

    const updatedNotesList: GeneralNote[] = [];
    const newNotes = currentNotes.map((n) => {
      if (targetSet.has(n.id) && n.status !== 'approved') {
        const updated: GeneralNote = {
          ...n,
          status: 'approved' as const,
          approvedAt,
          approvedBy: user?.id,
          approvedByName: adminName,
        };
        updatedNotesList.push(updated);
        return updated;
      }
      return n;
    });

    if (updatedNotesList.length === 0) return;

    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenApprovals = getStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode));
      updatedNotesList.forEach((n) => seenApprovals.add(`${n.id}_approved_${approvedAt}`));
      saveStoredSet(SEEN_APPROVAL_NOTES_KEY(user.id, compCode), seenApprovals);
    }

    // Background atomic batch persistence (non-blocking)
    StorageService.saveMultipleNotes(updatedNotesList).catch((err) => {
      console.warn('saveMultipleNotes approve error:', err);
    });

    // Notify all affected staff in background
    (async () => {
      try {
        const allRecipients = new Set<string>();
        updatedNotesList.forEach((n) => {
          if (n.completedBy) allRecipients.add(n.completedBy);
          if (Array.isArray(n.targetUserIds)) n.targetUserIds.forEach((uid) => allRecipients.add(uid));
          if (n.targetUserId && n.targetUserId !== 'all' && n.targetUserId !== 'self') {
            allRecipients.add(n.targetUserId);
          }
        });

        const recipientList = Array.from(allRecipients);
        if (recipientList.length > 0) {
          await OneSignalService.sendPushNotification({
            title: '✅ İş Emirleri Onaylandı!',
            message: `${adminName}, ${updatedNotesList.length} adet iş emrinizi başarıyla onayladı.`,
            targetMode: 'custom',
            targetUserIds: recipientList,
            companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
            url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=approved',
            collapseId: `bulk_app_${approvedAt}`,
          });
        }
      } catch (pushErr) {
        console.warn('OneSignal approveMultipleNotes push error:', pushErr);
      }
    })();
  };

  // Bulk: Staff completes and submits multiple work orders for approval in one atomic batch
  const completeMultipleNotes = async (ids: string[], completionNote?: string) => {
    if (!ids || ids.length === 0) return;

    const currentNotes = allNotesRef.current;
    const targetSet = new Set(ids);
    const completedAt = Date.now();
    const staffName = user?.name || user?.username || 'Saha Personeli';
    const trimmedNote = completionNote?.trim() || undefined;

    const updatedNotesList: GeneralNote[] = [];
    const newNotes = currentNotes.map((n) => {
      if (targetSet.has(n.id) && n.status !== 'pending_approval' && n.status !== 'approved') {
        const updated: GeneralNote = {
          ...n,
          status: 'pending_approval' as const,
          completedAt,
          completedBy: user?.id,
          completedByName: staffName,
          completionNote: trimmedNote,
          rejectedAt: undefined,
          rejectedBy: undefined,
          rejectedByName: undefined,
          rejectionReason: undefined,
        };
        updatedNotesList.push(updated);
        return updated;
      }
      return n;
    });

    if (updatedNotesList.length === 0) return;

    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenCompleted = getStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id, compCode));
      updatedNotesList.forEach((n) => seenCompleted.add(`${n.id}_${completedAt}`));
      saveStoredSet(SEEN_COMPLETED_NOTES_KEY(user.id, compCode), seenCompleted);
    }

    // Background atomic batch persistence (non-blocking)
    StorageService.saveMultipleNotes(updatedNotesList).catch((err) => {
      console.warn('saveMultipleNotes complete error:', err);
    });

    // Notify Admins in background
    (async () => {
      try {
        const activeComp = (user?.companyCode || compCode || 'POLATLAR').trim().toUpperCase();
        let adminIds = getCompanyAdminIds(activeComp);
        if (adminIds.length === 0) {
          try {
            const cloudUsers = await UserService.fetchUsersFromCloud();
            adminIds = cloudUsers
              .filter((u) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === activeComp && (u.role === 'admin' || isUserAdmin(u)))
              .map((u) => u.id);
          } catch {}
        }
        if (adminIds.length === 0 && activeComp === 'POLATLAR') adminIds = ['admin-1'];

        const noteExplanation = trimmedNote ? `\nAçıklama: ${trimmedNote}` : '';
        if (adminIds.length > 0) {
          await OneSignalService.sendPushNotification({
            title: '📋 Toplu İş Emri Tamamlandı (Onay Bekliyor)',
            message: `${staffName}, ${updatedNotesList.length} adet iş emrini tamamladı.${noteExplanation}`,
            targetMode: 'custom',
            targetUserIds: adminIds,
            companyCode: activeComp,
            url: 'https://saha-takip-beige.vercel.app/?tab=notes&filter=pending',
            collapseId: `bulk_comp_${completedAt}`,
          });
        }
      } catch (pushErr) {
        console.warn('OneSignal completeMultipleNotes push error:', pushErr);
      }
    })();
  };

  // Admin marks approved work order as processed into the company system (Sisteme İşlendi)
  const processNote = async (id: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler iş emirlerini sisteme işlendi olarak işaretleyebilir.');
      return;
    }

    const currentNotes = allNotesRef.current;
    const targetNote = currentNotes.find((n) => n.id === id);
    if (!targetNote || targetNote.status === 'processed') return;

    const processedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';

    const updatedNote: GeneralNote = {
      ...targetNote,
      status: 'processed' as const,
      processedAt,
      processedBy: user?.id,
      processedByName: adminName,
    };

    const newNotes = currentNotes.map((n) => (n.id === id ? updatedNote : n));
    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    // Background atomic persistence
    StorageService.saveSingleNote(updatedNote).catch((err) => {
      console.warn('saveSingleNote processNote error:', err);
    });
  };

  // Revert back from processed to approved
  const unprocessNote = async (id: string) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler bu işlemi yapabilir.');
      return;
    }

    const currentNotes = allNotesRef.current;
    const targetNote = currentNotes.find((n) => n.id === id);
    if (!targetNote || targetNote.status !== 'processed') return;

    const updatedNote: GeneralNote = {
      ...targetNote,
      status: 'approved' as const,
      processedAt: undefined,
      processedBy: undefined,
      processedByName: undefined,
    };

    const newNotes = currentNotes.map((n) => (n.id === id ? updatedNote : n));
    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    StorageService.saveSingleNote(updatedNote).catch((err) => {
      console.warn('saveSingleNote unprocessNote error:', err);
    });
  };

  // Bulk: Admin marks multiple approved work orders as processed in one batch
  const processMultipleNotes = async (ids: string[]) => {
    if (user?.role !== 'admin') {
      alert('Yalnızca yöneticiler iş emirlerini sisteme işlendi olarak işaretleyebilir.');
      return;
    }
    if (!ids || ids.length === 0) return;

    const currentNotes = allNotesRef.current;
    const targetSet = new Set(ids);
    const processedAt = Date.now();
    const adminName = user?.name || user?.username || 'Yönetici';

    const updatedNotesList: GeneralNote[] = [];
    const newNotes = currentNotes.map((n) => {
      if (targetSet.has(n.id) && n.status !== 'processed') {
        const updated: GeneralNote = {
          ...n,
          status: 'processed' as const,
          processedAt,
          processedBy: user?.id,
          processedByName: adminName,
        };
        updatedNotesList.push(updated);
        return updated;
      }
      return n;
    });

    allNotesRef.current = newNotes;
    setAllNotes(newNotes);

    Promise.all(updatedNotesList.map((n) => StorageService.saveSingleNote(n))).catch((err) => {
      console.warn('processMultipleNotes error:', err);
    });
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

    // Mark as seen on creator's own device immediately
    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenReminders = getStoredSet(SEEN_ADMIN_REMINDERS_KEY(user.id, compCode));
      seenReminders.add(newReminder.id);
      saveStoredSet(SEEN_ADMIN_REMINDERS_KEY(user.id, compCode), seenReminders);
    }

    if (data.sendPush !== false) {
      const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
      const creator = newReminder.createdByName || 'Yönetici';
      // Send push notification to all personnel
      OneSignalService.sendPushNotification({
        title: `📢 Yeni Yönetici Talimatı: ${newReminder.title}`,
        message: `${creator}: "${newReminder.content.slice(0, 100)}"`,
        targetMode: 'all',
        companyCode: compCode,
        url: 'https://saha-takip-beige.vercel.app/?tab=reminders',
        collapseId: `admin_rem_${newReminder.id}`,
      }).catch((err) => console.warn('OneSignal push error:', err));
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
    const targetReminder = adminReminders.find((r) => r.id === id);
    if (!targetReminder) return;

    const currentRead = targetReminder.readBy || [];
    if (currentRead.includes(user.id)) return;

    const updated = adminReminders.map((r) => {
      if (r.id === id) {
        return { ...r, readBy: [...currentRead, user.id] };
      }
      return r;
    });
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);

    // Send read confirmation to the creator of the reminder
    if (targetReminder.createdBy && targetReminder.createdBy !== user.id) {
      const readerName = user.name || user.username || 'Bir personel';
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const title = `👁️ Talimat Okundu: ${targetReminder.title}`;
      const message = `${readerName}, "${targetReminder.title}" talimatınızı okudu ve onayladı.`;

      OneSignalService.sendPushNotification({
        title,
        message,
        targetMode: 'custom',
        targetUserIds: [targetReminder.createdBy],
        companyCode: compCode,
        url: 'https://saha-takip-beige.vercel.app/?tab=reminders',
        collapseId: `rem_read_${id}_${user.id}`,
      }).catch((err) => console.warn('OneSignal read push error:', err));
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
      OneSignalService.sendPushNotification({
        title: `🛡️ Garanti Takibi (20 Gün): ${newItem.companyName}`,
        message: `${newItem.companyName} firmasına gönderilen garanti ürününün 20 günü doldu. Lütfen son durumunu sorgulayın.`,
        targetMode: 'all',
        companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
        url: 'https://saha-takip-beige.vercel.app/?tab=returns',
        sendAfter: new Date(newItem.reminderDate).toISOString(),
      }).catch((err) => console.warn('OneSignal warranty reminder push error:', err));
    }

    const updated = [newItem, ...returnWarrantyItems];
    setReturnWarrantyItems(updated);
    await StorageService.saveReturnWarrantyItems(updated);
  };

  // Update return / warranty item
  const updateReturnWarrantyItem = async (id: string, updates: Partial<ReturnWarrantyItem>) => {
    const existingItem = returnWarrantyItems.find((item) => item.id === id);
    const isNowCompleted = updates.status === 'completed' && existingItem?.status !== 'completed';

    const finalUpdates: Partial<ReturnWarrantyItem> = { ...updates };
    if (isNowCompleted) {
      finalUpdates.completedAt = Date.now();
      finalUpdates.completedBy = user?.id;
      finalUpdates.completedByName = user?.name || user?.username || 'Yetkili';
    } else if (updates.status === 'pending' && existingItem?.status === 'completed') {
      finalUpdates.completedAt = undefined;
      finalUpdates.completedBy = undefined;
      finalUpdates.completedByName = undefined;
    }

    const updated = returnWarrantyItems.map((item) =>
      item.id === id ? { ...item, ...finalUpdates } : item
    );
    setReturnWarrantyItems(updated);
    await StorageService.saveReturnWarrantyItems(updated);

    // If marked as completed ("Ürün Döndü"), notify all Admins immediately!
    if (isNowCompleted && existingItem) {
      const compCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();

      // Mark as seen on current user's device immediately to avoid duplicate in-app toast
      if (user?.id) {
        const seenCompleted = getStoredSet(SEEN_COMPLETED_RETURNS_KEY(user.id, compCode));
        if (finalUpdates.completedAt) {
          seenCompleted.add(`${id}_${finalUpdates.completedAt}`);
        }
        saveStoredSet(SEEN_COMPLETED_RETURNS_KEY(user.id, compCode), seenCompleted);
      }

      const updaterName = user?.name || user?.username || 'Yetkili';
      const typeLabel = existingItem.type === 'warranty' ? 'Garanti' : 'İade';
      const cariText = existingItem.cariName ? `[${existingItem.cariName}] ` : '';
      const serialText = existingItem.serialNumber ? ` (Seri No: ${existingItem.serialNumber})` : '';
      const trackingText = existingItem.trackingCode ? ` (Takip No: ${existingItem.trackingCode})` : '';

      const title = `📦 ${typeLabel} Ürünü Geri Döndü!`;
      const message = `${updaterName}, ${cariText}${existingItem.companyName} firmasına gönderilen ${typeLabel.toLowerCase()} ürününü "Geri Döndü" olarak işaretledi.${serialText || trackingText}`;

      // 1. OneSignal hardware push notification directly to all Admins (non-blocking)
      OneSignalService.sendPushNotification({
        title,
        message,
        targetMode: 'admin',
        companyCode: compCode,
        url: 'https://saha-takip-beige.vercel.app/?tab=returns',
        collapseId: `ret_comp_${id}`,
      }).catch((err) => console.warn('OneSignal return completed push error:', err));

      // 2. In-App Toast for current user if admin
      if (isUserAdmin(user)) {
        setActiveToast({ title, body: message, tab: 'returns' });
      }
    }
  };

  // Delete return / warranty item
  const deleteReturnWarrantyItem = async (id: string) => {
    const updated = returnWarrantyItems.filter((item) => item.id !== id);
    setReturnWarrantyItems(updated);
    await StorageService.saveReturnWarrantyItems(updated);
  };

  // Add service record (bilgilendirme amaçlı servis kaydı)
  const addService = async (
    serviceData: Omit<ServiceItem, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>
  ) => {
    const createdAt = Date.now();
    const staffName = user?.name || user?.username || 'Saha Personeli';

    const newService: ServiceItem = {
      ...serviceData,
      id: generateId(),
      createdAt,
      createdBy: user?.id,
      createdByName: staffName,
      status: 'approved',
    };

    // Mark as seen on creator's device immediately
    if (user?.id) {
      const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
      const seenServices = getStoredSet(SEEN_SERVICES_KEY(user.id, compCode));
      seenServices.add(newService.id);
      saveStoredSet(SEEN_SERVICES_KEY(user.id, compCode), seenServices);
    }

    const updated = [newService, ...allServices];
    await saveServices(updated);

    // Send push notification directly to all Admins if created by staff (non-blocking in background)
    if (!isUserAdmin(user)) {
      (async () => {
        try {
          const activeComp = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
          let adminIds = getCompanyAdminIds(activeComp);
          if (adminIds.length === 0) {
            try {
              const cloudUsers = await UserService.fetchUsersFromCloud();
              adminIds = cloudUsers
                .filter((u) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === activeComp && (u.role === 'admin' || isUserAdmin(u)))
                .map((u) => u.id);
            } catch {
              // ignore
            }
          }
          if (adminIds.length === 0 && activeComp === 'POLATLAR') {
            adminIds = ['admin-1'];
          }

          const locText = newService.location ? ` (${newService.location})` : '';
          const cariText = newService.cariName ? `[${newService.cariName}] ` : '';

          if (adminIds.length > 0) {
            await OneSignalService.sendPushNotification({
              title: '🔧 Yeni Servis Kaydı',
              message: `${staffName}, ${cariText}"${newService.companyName}"${locText} için yeni servis ekledi: ${newService.workDone.slice(0, 80)}`,
              targetMode: 'custom',
              targetUserIds: adminIds,
              companyCode: activeComp,
              url: 'https://saha-takip-beige.vercel.app/?tab=services',
              collapseId: `srv_new_${newService.id}`,
            });
          }
        } catch (err) {
          console.warn('OneSignal new service push error:', err);
        }
      })();
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
    await saveServices(updated);
  };

  // Delete service record
  const deleteService = async (id: string) => {
    const target = allServices.find((s) => s.id === id);
    if (target && user?.role !== 'admin' && target.createdBy !== user?.id) {
      alert('Bu servis kaydını silme yetkiniz bulunmuyor.');
      return;
    }
    const updated = allServices.filter((s) => s.id !== id);
    await saveServices(updated);
  };

  const completeService = async (_id: string, _completionNote?: string, _completionPhotos?: string[]) => {};
  const approveService = async (_id: string) => {};
  const rejectService = async (_id: string, _reason?: string) => {};

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
      await saveServices(backupData.services);
    }
    if (backupData.workplaceLocation) {
      setWorkplaceLocation(backupData.workplaceLocation);
      await StorageService.saveWorkplaceLocation(backupData.workplaceLocation);
    }
    if (backupData.attendanceRecords && Array.isArray(backupData.attendanceRecords)) {
      setAttendanceRecords(backupData.attendanceRecords);
      await StorageService.saveAttendanceRecords(backupData.attendanceRecords, { forceOverwrite: true });
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

  const updateBranch = async (
    id: string,
    updates: Partial<Branch> & { companyCode?: string },
    targetCompanyCode?: string
  ) => {
    const isAdmin = isUserAdmin(user);
    if (!isAdmin && !canUserAddBranch(user)) {
      alert('Şube düzenleme yetkisi sadece yöneticilere aittir.');
      return;
    }
    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const targetBranch = branches.find((b) => b.id === id);
    const branchCompCode = (
      targetCompanyCode ||
      updates.companyCode ||
      targetBranch?.companyCode ||
      currentCompCode
    ).trim().toUpperCase();

    if (branchCompCode === currentCompCode) {
      const updated = branches.map((b) =>
        b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b
      );
      setBranches(updated);
      await StorageService.saveBranches(updated);
    } else {
      const targetExisting = await StorageService.getBranchesForCompany(branchCompCode);
      const isExistingInTarget = targetExisting.some((b) => b.id === id);
      let targetUpdated: Branch[];
      if (isExistingInTarget) {
        targetUpdated = targetExisting.map((b) =>
          b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b
        );
      } else {
        targetUpdated = [
          ...targetExisting,
          { id, companyCode: branchCompCode, ...updates, updatedAt: Date.now() } as Branch,
        ];
      }
      await StorageService.saveBranchesForCompany(branchCompCode, targetUpdated);

      // Clean up from local state if it was in branches
      if (branches.some((b) => b.id === id)) {
        const cleaned = branches.filter((b) => b.id !== id);
        setBranches(cleaned);
        await StorageService.saveBranches(cleaned);
      }
    }
  };

  const deleteBranch = async (id: string, targetCompanyCode?: string) => {
    if (!canUserAddBranch(user)) {
      alert('Şube silme yetkisi sadece POLATLAR firmasının yöneticilerine aittir.');
      return;
    }
    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const targetBranch = branches.find((b) => b.id === id);
    const branchCompCode = (targetCompanyCode || targetBranch?.companyCode || currentCompCode).trim().toUpperCase();

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

  const assignStaffToBranch = async (branchId: string, userIds: string[], targetCompanyCode?: string) => {
    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    let branchCompCode = targetCompanyCode ? targetCompanyCode.trim().toUpperCase() : currentCompCode;

    if (!targetCompanyCode) {
      const foundInCurrent = branches.find((b) => b.id === branchId);
      if (foundInCurrent?.companyCode) {
        branchCompCode = foundInCurrent.companyCode.trim().toUpperCase();
      }
    }

    if (branchCompCode === currentCompCode) {
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
    } else {
      const targetExisting = await StorageService.getBranchesForCompany(branchCompCode);
      const targetUpdated = targetExisting.map((b) => {
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
      await StorageService.saveBranchesForCompany(branchCompCode, targetUpdated);
    }
  };

  const updateBranchBreakMinutes = async (branchId: string, maxBreakMinutes: number) => {
    const updatedBranches = branches.map((b) =>
      b.id === branchId ? { ...b, maxBreakMinutes, updatedAt: Date.now() } : b
    );
    setBranches(updatedBranches);
    await StorageService.saveBranches(updatedBranches);
  };

  const updateWorkplaceBreakMinutes = async (maxBreakMinutes: number) => {
    const currentLoc = workplaceLocation || {
      address: 'Genel Merkez / İş Yeri',
      latitude: 0,
      longitude: 0,
      radiusMeters: 20,
      updatedAt: Date.now(),
    };
    const updated: WorkplaceLocation = {
      ...currentLoc,
      maxBreakMinutes,
      updatedAt: Date.now(),
      updatedBy: user?.id,
      updatedByName: user?.name,
    };
    setWorkplaceLocation(updated);
    await StorageService.saveWorkplaceLocation(updated);
  };

  const createShift = async (
    shiftData: Omit<ShiftDefinition, 'id' | 'createdAt' | 'updatedAt' | 'companyCode'> & { companyCode?: string }
  ): Promise<ShiftDefinition> => {
    const newShift: ShiftDefinition = {
      ...shiftData,
      id: generateId(),
      companyCode: shiftData.companyCode || compCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedShifts = [...shifts, newShift];
    setShifts(updatedShifts);
    await StorageService.saveShiftData({
      definitions: updatedShifts,
      assignments: shiftAssignments,
    });
    return newShift;
  };

  const updateShift = async (id: string, updates: Partial<ShiftDefinition>): Promise<void> => {
    const updatedShifts = shifts.map((s) =>
      s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
    );
    setShifts(updatedShifts);
    const updatedAssignments = shiftAssignments.map((a) => {
      if (a.shiftId === id) {
        return {
          ...a,
          shiftName: updates.name || a.shiftName,
          startTime: updates.startTime || a.startTime,
          endTime: updates.endTime || a.endTime,
          updatedAt: Date.now(),
        };
      }
      return a;
    });
    setShiftAssignments(updatedAssignments);
    await StorageService.saveShiftData({
      definitions: updatedShifts,
      assignments: updatedAssignments,
    });
  };

  const deleteShift = async (id: string): Promise<void> => {
    const updatedShifts = shifts.filter((s) => s.id !== id);
    const updatedAssignments = shiftAssignments.filter((a) => a.shiftId !== id);
    setShifts(updatedShifts);
    setShiftAssignments(updatedAssignments);
    await StorageService.saveShiftData({
      definitions: updatedShifts,
      assignments: updatedAssignments,
    });
  };

  const assignUserShift = async (userId: string, userName: string, shiftId: string): Promise<void> => {
    const targetShift = shifts.find((s) => s.id === shiftId);
    if (!targetShift) return;

    const existingIdx = shiftAssignments.findIndex((a) => a.userId === userId);
    let updatedAssignments = [...shiftAssignments];
    if (existingIdx >= 0) {
      updatedAssignments[existingIdx] = {
        ...updatedAssignments[existingIdx],
        shiftId: targetShift.id,
        shiftName: targetShift.name,
        startTime: targetShift.startTime,
        endTime: targetShift.endTime,
        userName: userName || updatedAssignments[existingIdx].userName,
        updatedAt: Date.now(),
        updatedBy: user?.name,
      };
    } else {
      const newAssignment: ShiftAssignment = {
        id: generateId(),
        companyCode: compCode,
        userId,
        userName,
        shiftId: targetShift.id,
        shiftName: targetShift.name,
        startTime: targetShift.startTime,
        endTime: targetShift.endTime,
        updatedAt: Date.now(),
        updatedBy: user?.name,
      };
      updatedAssignments.push(newAssignment);
    }

    setShiftAssignments(updatedAssignments);
    await StorageService.saveShiftData({
      definitions: shifts,
      assignments: updatedAssignments,
    });
  };

  const removeUserShift = async (userId: string): Promise<void> => {
    const updatedAssignments = shiftAssignments.filter((a) => a.userId !== userId);
    setShiftAssignments(updatedAssignments);
    await StorageService.saveShiftData({
      definitions: shifts,
      assignments: updatedAssignments,
    });
  };

  const refreshShifts = async (): Promise<void> => {
    const data = await StorageService.getShiftData();
    setShifts(data.definitions);
    setShiftAssignments(data.assignments);
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
    const currentCompCode = (user.companyCode || dataCompanyCode || compCode || 'POLATLAR').toUpperCase();

    if (user.role !== 'admin') {
      const curDevId = DeviceService.getCurrentDeviceId();
      const devCheck = await DeviceService.verifyDeviceAccess({
        userId: user.id,
        role: user.role,
        currentDeviceId: curDevId,
        userName: user.name,
        username: user.username,
        companyCode: currentCompCode,
      });
      if (!devCheck.allowed) {
        return {
          success: false,
          message: devCheck.error || 'Bu cihaz yetkili resmi cihazınız değildir. İşe giriş engellendi.',
        };
      }
    }

    // --- VARDİYA SAATİ KONTROLÜ (Personele atanan vardiya saati haricinde mesaiye giriş yapamaz) ---
    // Yöneticiler (admin) vardiya saatlerinden ve 20m kuralından tamamen muaftır.
    if (user.role !== 'admin' && !isUserAdmin(user)) {
      const userAssignment = shiftAssignments.find((a) => a.userId === user.id);
      if (userAssignment) {
        const shift = shifts.find((s) => s.id === userAssignment.shiftId) || {
          id: userAssignment.shiftId,
          companyCode: userAssignment.companyCode,
          name: userAssignment.shiftName,
          startTime: userAssignment.startTime,
          endTime: userAssignment.endTime,
          earlyCheckInMinutes: 30,
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          createdAt: 0,
          updatedAt: 0,
        };

        const now = new Date();
        // 1. Gün kontrolü: 1=Pazartesi, ..., 7=Pazar
        let currentDay = now.getDay();
        if (currentDay === 0) currentDay = 7;

        if (shift.daysOfWeek && shift.daysOfWeek.length > 0 && !shift.daysOfWeek.includes(currentDay)) {
          const dayNames: Record<number, string> = {
            1: 'Pazartesi',
            2: 'Salı',
            3: 'Çarşamba',
            4: 'Perşembe',
            5: 'Cuma',
            6: 'Cumartesi',
            7: 'Pazar',
          };
          const allowedDaysText = shift.daysOfWeek.map((d) => dayNames[d] || String(d)).join(', ');
          return {
            success: false,
            message: `Bugün atanan vardiya günleriniz arasında değildir (${shift.name} - İzin verilen günler: ${allowedDaysText}). Vardiya günleriniz haricinde mesaiye giriş yapamazsınız.`,
          };
        }

        // 2. Saat aralığı kontrolü
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = (shift.startTime || '08:30').split(':').map(Number);
        const [endH, endM] = (shift.endTime || '17:30').split(':').map(Number);
        const shiftStartMinutes = startH * 60 + startM;
        const shiftEndMinutes = endH * 60 + endM;
        const earlyTolerance = shift.earlyCheckInMinutes !== undefined ? shift.earlyCheckInMinutes : 30;

        let allowedStart = shiftStartMinutes - earlyTolerance;

        if (shiftEndMinutes >= shiftStartMinutes) {
          // Normal gündüz mesaisi (örn: 08:30 - 17:30)
          if (allowedStart < 0) allowedStart = 0;
          const isWithin = currentMinutes >= allowedStart && currentMinutes <= shiftEndMinutes;
          if (!isWithin) {
            if (currentMinutes < allowedStart) {
              const earliestH = Math.floor(allowedStart / 60);
              const earliestM = allowedStart % 60;
              const earliestStr = `${String(earliestH).padStart(2, '0')}:${String(earliestM).padStart(2, '0')}`;
              return {
                success: false,
                message: `Atanan vardiyanız henüz başlamadı. Vardiya saatleriniz: ${shift.name} (${shift.startTime} - ${shift.endTime}). Girişe en erken saat ${earliestStr} (${earlyTolerance} dk önceden) izin verilmektedir.`,
              };
            } else {
              return {
                success: false,
                message: `Atanan vardiya saatleriniz sona erdi (${shift.name}: ${shift.startTime} - ${shift.endTime}). Vardiya saatleriniz haricinde mesaiye giriş yapamazsınız.`,
              };
            }
          }
        } else {
          // Gece vardiyası (örn: 22:00 - 06:00)
          let nightAllowedStart = allowedStart;
          if (nightAllowedStart < 0) nightAllowedStart += 1440;
          const isWithin = currentMinutes >= nightAllowedStart || currentMinutes <= shiftEndMinutes;
          if (!isWithin) {
            return {
              success: false,
              message: `Atanan vardiya saatleriniz dışındasınız (${shift.name}: ${shift.startTime} - ${shift.endTime}). Vardiya saatleriniz haricinde mesaiye giriş yapamazsınız.`,
            };
          }
        }
      }
    }

    let activeBranches = branches || [];
    if (activeBranches.length === 0) {
      try {
        const freshBranches = await StorageService.getBranches();
        if (freshBranches && freshBranches.length > 0) {
          activeBranches = freshBranches;
          setBranches(freshBranches);
        }
      } catch {}
    }

    const hasBranches = activeBranches && activeBranches.length > 0;
    const hasWorkplace = !!(workplaceLocation && workplaceLocation.latitude && workplaceLocation.longitude);

    if (!hasBranches && !hasWorkplace && user.role !== 'admin') {
      return {
        success: false,
        message: 'İş yeri veya şube konumu henüz yönetici tarafından belirlenmemiş. Lütfen yöneticiniz ile iletişime geçin.',
      };
    }

    let userPos: { latitude: number; longitude: number; address?: string } | undefined;
    try {
      userPos = await LocationService.getCurrentPosition();
    } catch (err: any) {
      if (err?.isMockLocation) {
        return {
          success: false,
          message: err.message,
        };
      }
      if (user.role !== 'admin') {
        const isLocDisabled = !!err?.isLocationDisabled || err?.code === 1;
        return {
          success: false,
          isLocationDisabled: isLocDisabled,
          message: err?.message || 'İşe giriş yapabilmek için konum servislerinin açık olması gerekmektedir. Lütfen cihazınızın konum servisini açın.',
        };
      }
      // Yöneticiler için GPS açılamasa dahi mesai engellenmez
      userPos = { latitude: 0, longitude: 0, address: 'Genel Yönetim' };
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

    // --- YÖNETİCİ / ADMİN AYRICALIĞI: 20 METRE VE ŞUBE KURALINDAN TAMAMEN MUAFTIR ---
    // Yönetici nerede olursa olsun "İşe Geldim" dediğinde anında onaylı mesaiye başlar. Şubeden konum almaz.
    if (user.role === 'admin') {
      const newRecord: AttendanceRecord = {
        id: generateId(),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        companyCode: compCode,
        date: todayStr,
        checkInTime: Date.now(),
        checkInLat: userPos?.latitude,
        checkInLon: userPos?.longitude,
        checkInAddress: userPos?.address || 'Genel Yönetim',
        checkInDistance: 0,
        checkInOutside: false,
        checkInApprovalStatus: 'approved',
        status: 'checked_in',
        notes: 'Yönetici mesaisi (20m kuralından ve şubeden muaf)',
      };

      const updated = [newRecord, ...attendanceRecords];
      setAttendanceRecords(updated);
      await StorageService.saveAttendanceRecords(updated);

      return {
        success: true,
        distance: 0,
        message: 'Yönetici mesainiz başarıyla onaylandı (20m ve şube sınırından muaftır).',
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
            companyCode: compCode,
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
            companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
            url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
          }).catch(() => {});

          return {
            success: true,
            distance: distToAssigned,
            message: `${assignedBranch.name} şubesinde işe girişiniz başarıyla onaylandı!${typeof navigator !== 'undefined' && !navigator.onLine ? ' (Çevrimdışı - Bağlantı sağlandığında eşitlenecektir)' : ` (Şubeye mesafe: ${LocationService.formatDistance(distToAssigned)})`}`,
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
              message: `Kendi şubeniz olan "${assignedBranch.name}" yerine "${otherBranch.name}" şubesinde bulunuyorsunuz. Başka bir şubede mesaiye başlamak için Yönetici Onayı gereklidir. Mesainiz başlatılsın ve onaya gönderilsin mi?`,
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
            companyCode: compCode,
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
            notes: `Farklı Şube Talebi: Asıl şubesi (${assignedBranch.name}) yerine ${otherBranch.name} şubesinde mesaiye başladı.${options.note ? ' Not: ' + options.note : ''}`,
            status: 'pending_checkin_approval',
          };

          const updated = [newRecord, ...attendanceRecords];
          setAttendanceRecords(updated);
          await StorageService.saveAttendanceRecords(updated);

          OneSignalService.sendPushNotification({
            title: '⚠️ Farklı Şubede Mesai Başladı (Onay Bekliyor)',
            message: `${user.name}, bağlı olduğu ${assignedBranch.name} yerine ${otherBranch.name} şubesinde mesaiye başladı. Onayınızı bekliyor.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
            targetMode: 'admin',
            companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
            url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
          }).catch(() => {});

          return {
            success: true,
            isPendingApproval: true,
            distance: otherBranchDist,
            message: `Farklı şubede (${otherBranch.name}) mesainiz başlatıldı. Yönetici onayına iletildi.`,
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
            message: `Bağlı olduğunuz "${assignedBranch.name}" şubesinin 20 metre dışında bulunuyorsunuz (${LocationService.formatDistance(distToAssigned)}). Mesainiz başlatılsın ve yönetici onayına gönderilsin mi?`,
          };
        }

        const newRecord: AttendanceRecord = {
          id: generateId(),
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          companyCode: compCode,
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
          title: '⚠️ Konum Dışı Mesai Başladı (Onay Bekliyor)',
          message: `${user.name}, ${assignedBranch.name} şubesinden ${LocationService.formatDistance(distToAssigned)} uzakta (20m dışı) mesaiye başladı. Onayınızı bekliyor.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
          targetMode: 'admin',
          excludeUserIds: [user.id],
          companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        }).catch(() => {});

        return {
          success: true,
          isPendingApproval: true,
          distance: distToAssigned,
          message: `${assignedBranch.name} şubesi dışında mesainiz başlatıldı (${LocationService.formatDistance(distToAssigned)}). Yönetici onayına iletildi.`,
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
            companyCode: compCode,
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
            excludeUserIds: [user.id],
            companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
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
            message: `Herhangi bir şubenin 20 metre yakınında bulunmuyorsunuz (En yakın şube: ${closestBranch.name}, Mesafe: ${LocationService.formatDistance(minDist)}). Mesainiz başlatılsın ve yönetici onayına gönderilsin mi?`,
          };
        }

        const newRecord: AttendanceRecord = {
          id: generateId(),
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          companyCode: compCode,
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
          title: '⚠️ Konum Dışı Mesai Başladı (Onay Bekliyor)',
          message: `${user.name}, en yakın ${closestBranch.name} şubesinden ${LocationService.formatDistance(minDist)} uzakta (20m dışı) mesaiye başladı. Onayınızı bekliyor.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
          targetMode: 'admin',
          excludeUserIds: [user.id],
          companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        }).catch(() => {});

        return {
          success: true,
          isPendingApproval: true,
          distance: minDist,
          message: `Şube dışında mesainiz başlatıldı (${closestBranch.name} şubesine mesafe: ${LocationService.formatDistance(minDist)}). Yönetici onayına iletildi.`,
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
          message: `Konum dışında giriş yapıyorsunuz (${LocationService.formatDistance(distance)}). Mesainiz başlatılsın ve yönetici onayına gönderilsin mi?`,
        };
      }

      const newRecord: AttendanceRecord = {
        id: generateId(),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        companyCode: compCode,
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
        title: '⚠️ Konum Dışı Mesai Başladı (Onay Bekliyor)',
        message: `${user.name}, iş yerinden ${LocationService.formatDistance(distance)} uzakta (20m dışı) mesaiye başladı. Onayınızı bekliyor.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
        targetMode: 'admin',
        excludeUserIds: [user.id],
        companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch(() => {});

      return {
        success: true,
        isPendingApproval: true,
        distance,
        message: `İş yeri konumu dışında mesainiz başlatıldı (${LocationService.formatDistance(distance)}). Yönetici onayına iletildi.`,
      };
    }

    // Inside allowed radius (Normal on-site check-in)
    const newRecord: AttendanceRecord = {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      companyCode: compCode,
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
      excludeUserIds: [user.id],
      companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch(() => {});

    return {
      success: true,
      distance,
      message: `İşe girişiniz başarıyla onaylandı!${typeof navigator !== 'undefined' && !navigator.onLine ? ' (Çevrimdışı - Bağlantı sağlandığında eşitlenecektir)' : ` (İş yerine mesafe: ${LocationService.formatDistance(distance)})`}`,
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
        companyCode: user.companyCode || compCode,
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

    // --- YÖNETİCİ / ADMİN AYRICALIĞI: 20 METRE VE ŞUBE KURALINDAN TAMAMEN MUAFTIR ---
    if (user.role === 'admin') {
      const checkOutTime = Date.now();
      const durationMinutes = Math.max(1, Math.round((checkOutTime - record.checkInTime) / 60000));
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const durationText = hours > 0 ? `${hours} saat ${mins} dakika` : `${mins} dakika`;

      let finalBreaks = Array.isArray(record.breaks) ? [...record.breaks] : [];
      let totalBreakMinutes = record.totalBreakMinutes || 0;
      if (record.isOnBreak && finalBreaks.length > 0) {
        const lastIndex = finalBreaks.length - 1;
        const bStart = record.currentBreakStartTime || finalBreaks[lastIndex].startTime;
        const bDuration = Math.max(1, Math.round((checkOutTime - bStart) / 60000));
        finalBreaks[lastIndex] = {
          ...finalBreaks[lastIndex],
          endTime: checkOutTime,
          durationMinutes: bDuration,
        };
        totalBreakMinutes = finalBreaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
      }

      let adminPos: { latitude?: number; longitude?: number; address?: string } = { latitude: 0, longitude: 0, address: 'Genel Yönetim' };
      try {
        const pos = await LocationService.getCurrentPosition();
        if (pos) {
          adminPos = { latitude: pos.latitude, longitude: pos.longitude, address: pos.address || 'Genel Yönetim' };
        }
      } catch {}

      const updatedRecord: AttendanceRecord = {
        ...record,
        checkOutTime,
        checkOutLat: adminPos.latitude,
        checkOutLon: adminPos.longitude,
        checkOutAddress: adminPos.address || 'Genel Yönetim',
        checkOutDistance: 0,
        checkOutOutside: false,
        checkOutApprovalStatus: 'approved',
        status: 'completed',
        workDurationMinutes: durationMinutes,
        breaks: finalBreaks,
        isOnBreak: false,
        currentBreakStartTime: undefined,
        totalBreakMinutes,
      };

      const updatedRecords = [...attendanceRecords];
      updatedRecords[recordIndex] = updatedRecord;
      setAttendanceRecords(updatedRecords);
      await StorageService.saveAttendanceRecords(updatedRecords);

      return {
        success: true,
        distance: 0,
        message: `Yönetici mesainiz başarıyla sonlandırıldı (${durationText}).`,
      };
    }

    let userPos;
    try {
      userPos = await LocationService.getCurrentPosition();
    } catch (err: any) {
      if (err?.isMockLocation) {
        return {
          success: false,
          message: err.message,
        };
      }
      const isLocDisabled = !!err?.isLocationDisabled || err?.code === 1;
      return {
        success: false,
        isLocationDisabled: isLocDisabled,
        message: err?.message || 'İşten çıkış yapabilmek için konum servislerinin açık olması gerekmektedir. Lütfen cihazınızın konum servisini açın.',
      };
    }

    let activeBranches = branches || [];
    if (activeBranches.length === 0) {
      try {
        const freshBranches = await StorageService.getBranches();
        if (freshBranches && freshBranches.length > 0) {
          activeBranches = freshBranches;
          setBranches(freshBranches);
        }
      } catch {}
    }

    // Determine target location to measure checkout against:
    let targetLat = workplaceLocation?.latitude;
    let targetLon = workplaceLocation?.longitude;
    let targetRadius = (workplaceLocation?.radiusMeters && workplaceLocation.radiusMeters !== 10) ? workplaceLocation.radiusMeters : 20;
    let targetName = 'İş yeri';

    if (record.branchId && activeBranches.length > 0) {
      const b = activeBranches.find((item) => item.id === record.branchId);
      if (b) {
        targetLat = b.latitude;
        targetLon = b.longitude;
        targetRadius = b.radiusMeters || 20;
        targetName = b.name;
      }
    }
    
    // Şube ID ile bulunamadıysa şube adı ile ara
    if (!targetLat && record.branchName && activeBranches.length > 0) {
      const b = activeBranches.find((item) => item.name.trim().toLowerCase() === record.branchName?.trim().toLowerCase());
      if (b) {
        targetLat = b.latitude;
        targetLon = b.longitude;
        targetRadius = b.radiusMeters || 20;
        targetName = b.name;
      }
    }

    if (!targetLat && activeBranches.length > 0) {
      const assignedBranch = activeBranches.find(
        (b) => (b.assignedUserIds && b.assignedUserIds.includes(user.id)) || (user.branchId && b.id === user.branchId)
      );
      if (assignedBranch) {
        targetLat = assignedBranch.latitude;
        targetLon = assignedBranch.longitude;
        targetRadius = assignedBranch.radiusMeters || 20;
        targetName = assignedBranch.name;
      }
    }

    // KUSURSUZ GÜVENCE: Eğer şube bilgisi hala yoksa ama personelin sabah giriş yaptığı koordinatlar mevcutsa,
    // personelin sabah mesaiye başladığı şube / konum koordinatlarını referans al (asla 'Şube konumu belirlenemedi' hatası verme!)
    if ((!targetLat || !targetLon) && record.checkInLat && record.checkInLon) {
      targetLat = record.checkInLat;
      targetLon = record.checkInLon;
      targetRadius = 20;
      targetName = record.branchName || 'Mesai Şubesi';
    }

    if (!targetLat || !targetLon) {
      return {
        success: false,
        message: 'İş yeri veya şube konumu belirlenemedi. Lütfen yöneticiniz ile iletişime geçin.',
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

      // Close any active break automatically if employee forgot to end break before checkout
      let finalBreaks = Array.isArray(record.breaks) ? [...record.breaks] : [];
      let totalBreakMinutes = record.totalBreakMinutes || 0;
      if (record.isOnBreak && finalBreaks.length > 0) {
        const lastIndex = finalBreaks.length - 1;
        const bStart = record.currentBreakStartTime || finalBreaks[lastIndex].startTime;
        const bDuration = Math.max(1, Math.round((checkOutTime - bStart) / 60000));
        finalBreaks[lastIndex] = {
          ...finalBreaks[lastIndex],
          endTime: checkOutTime,
          durationMinutes: bDuration,
        };
        totalBreakMinutes = finalBreaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
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
        breaks: finalBreaks,
        isOnBreak: false,
        currentBreakStartTime: undefined,
        totalBreakMinutes,
      };

      const updatedRecords = [...attendanceRecords];
      updatedRecords[recordIndex] = updatedRecord;
      setAttendanceRecords(updatedRecords);
      await StorageService.saveAttendanceRecords(updatedRecords);

      // CRITICAL: Push notification to admins
      OneSignalService.sendPushNotification({
        title: '⚠️ Konum Dışı İşten Çıkış Onay Talebi',
        message: `${user.name}, ${targetName} konumundan ${LocationService.formatDistance(distance)} uzakta (20m dışı) işten çıkış onay talebi gönderdi.${options.note ? ' (Not: ' + options.note + ')' : ''}`,
        targetMode: 'admin',
        excludeUserIds: [user.id],
        companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
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
    let finalBreaks = Array.isArray(record.breaks) ? [...record.breaks] : [];
    let totalBreakMinutes = record.totalBreakMinutes || 0;
    if (record.isOnBreak && finalBreaks.length > 0) {
      const lastIndex = finalBreaks.length - 1;
      const bStart = record.currentBreakStartTime || finalBreaks[lastIndex].startTime;
      const bDuration = Math.max(1, Math.round((checkOutTime - bStart) / 60000));
      finalBreaks[lastIndex] = {
        ...finalBreaks[lastIndex],
        endTime: checkOutTime,
        durationMinutes: bDuration,
      };
      totalBreakMinutes = finalBreaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
    }

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
      breaks: finalBreaks,
      isOnBreak: false,
      currentBreakStartTime: undefined,
      totalBreakMinutes,
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
      excludeUserIds: [user.id],
      companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch(() => {});

    return {
      success: true,
      distance,
      message: `İşten çıkışınız onaylandı!${typeof navigator !== 'undefined' && !navigator.onLine ? ' (Çevrimdışı - Bağlantı sağlandığında eşitlenecektir)' : ''} Toplam mesai süreniz: ${durationText}.`,
    };
  };

  // Staff break tracking: startBreak (0ms instant optimistic UI reflex)
  const startBreak = async (note?: string): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const recordIndex = attendanceRecords.findIndex(
      (r) => r.userId === user.id && r.date === todayStr && r.status === 'checked_in'
    );

    if (recordIndex === -1) {
      return { success: false, message: 'Aktif bir mesai kaydınız bulunmuyor. Önce işe giriş yapmalısınız.' };
    }

    const record = attendanceRecords[recordIndex];
    if (record.isOnBreak) {
      return { success: false, message: 'Zaten moladasınız.' };
    }

    const now = Date.now();

    // Determine break quota minutes from branch or central workplace
    let branchBreakMins: number | undefined;
    const assignedBranch = branches.find((b) => b.assignedUserIds && b.assignedUserIds.includes(user.id));
    if (assignedBranch?.maxBreakMinutes) {
      branchBreakMins = assignedBranch.maxBreakMinutes;
    }
    if (!branchBreakMins && record.branchId) {
      const b = branches.find((item) => item.id === record.branchId);
      if (b?.maxBreakMinutes) {
        branchBreakMins = b.maxBreakMinutes;
      }
    }
    const quotaMinutes = branchBreakMins || workplaceLocation?.maxBreakMinutes || 15;
    const existingBreaks = Array.isArray(record.breaks) ? record.breaks : [];
    const alreadyUsedMinutes = existingBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    const allowedMinutes = quotaMinutes > alreadyUsedMinutes ? (quotaMinutes - alreadyUsedMinutes) : quotaMinutes;
    const targetIsoDate = new Date(now + allowedMinutes * 60 * 1000).toISOString();

    const newBreak: BreakItem = {
      id: generateId(),
      startTime: now,
      note: note || 'Mola',
    };

    const updatedRecord: AttendanceRecord = {
      ...record,
      isOnBreak: true,
      currentBreakStartTime: now,
      breaks: [...existingBreaks, newBreak],
    };

    const updated = [...attendanceRecords];
    updated[recordIndex] = updatedRecord;

    // Optimistic instant state update (0ms UI latency!)
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);

    // Schedule hardware push notification via OneSignal cloud server
    // Fires at targetIsoDate even if the phone is locked or app is killed!
    OneSignalService.scheduleBreakOverPush({
      userId: user.id,
      userName: user.name,
      targetIsoDate,
      breakMinutes: allowedMinutes,
      companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
    }).then((scheduledId) => {
      if (scheduledId) {
        newBreak.scheduledNotificationId = scheduledId;
        updatedRecord.currentBreakNotificationId = scheduledId;
        StorageService.saveAttendanceRecords(updated).catch(() => {});
      }
    }).catch((err) => {
      console.warn('Failed to schedule break over push notification:', err);
    });

    // Push notification to admins about break start
    OneSignalService.sendPushNotification({
      title: '☕ Personel Molaya Çıktı',
      message: `${user.name}, saat ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla molaya çıktı.${note ? ` (Not: ${note})` : ''}`,
      targetMode: 'admin',
      excludeUserIds: [user.id],
      companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch(() => {});

    return {
      success: true,
      message: 'Molaya çıkışınız kaydedildi. İyi dinlenmeler!',
    };
  };

  // Staff break tracking: endBreak (0ms instant optimistic UI reflex)
  const endBreak = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Oturum açmış kullanıcı bulunamadı.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const recordIndex = attendanceRecords.findIndex(
      (r) => r.userId === user.id && (r.isOnBreak || (r.date === todayStr && (r.status === 'checked_in' || r.status === 'pending_checkin_approval')))
    );

    if (recordIndex === -1) {
      return { success: false, message: 'Aktif bir mesai kaydınız bulunmuyor.' };
    }

    const record = attendanceRecords[recordIndex];
    if (!record.isOnBreak) {
      return { success: false, message: 'Aktif bir molanız bulunmuyor.' };
    }

    const now = Date.now();
    const startTime =
      record.currentBreakStartTime ||
      (record.breaks && record.breaks.length > 0
        ? record.breaks[record.breaks.length - 1].startTime
        : now);
    const durationMinutes = Math.max(1, Math.round((now - startTime) / (1000 * 60)));

    // Cancel scheduled break-over cloud notification since break ended earlier
    const notifIdToCancel =
      record.currentBreakNotificationId ||
      (record.breaks && record.breaks.length > 0
        ? record.breaks[record.breaks.length - 1].scheduledNotificationId
        : undefined);

    if (notifIdToCancel) {
      OneSignalService.cancelNotification(notifIdToCancel).catch(() => {});
    }

    const existingBreaks = Array.isArray(record.breaks) ? [...record.breaks] : [];
    if (existingBreaks.length > 0) {
      const lastIndex = existingBreaks.length - 1;
      existingBreaks[lastIndex] = {
        ...existingBreaks[lastIndex],
        endTime: now,
        durationMinutes,
      };
    } else {
      existingBreaks.push({
        id: generateId(),
        startTime,
        endTime: now,
        durationMinutes,
      });
    }

    const totalBreakMinutes = existingBreaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

    const updatedRecord: AttendanceRecord = {
      ...record,
      isOnBreak: false,
      currentBreakStartTime: undefined,
      currentBreakNotificationId: undefined,
      breaks: existingBreaks,
      totalBreakMinutes,
    };

    const updated = [...attendanceRecords];
    updated[recordIndex] = updatedRecord;

    // Optimistic instant state update (0ms UI latency!)
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);

    // Push notification to admins about break end
    OneSignalService.sendPushNotification({
      title: '🔄 Personel Moladan Döndü',
      message: `${user.name}, saat ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla molasını tamamlayıp mesaiye döndü. (Mola Süresi: ${durationMinutes} dk)`,
      targetMode: 'admin',
      excludeUserIds: [user.id],
      companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch(() => {});

    return {
      success: true,
      message: `Molanız sonlandırıldı (${durationMinutes} dakika). Mesainize başarıyla döndünüz!`,
    };
  };

  // Staff break tracking: Force end break for any staff member (Admin action)
  const endBreakForStaff = async (recordId: string): Promise<{ success: boolean; message: string }> => {
    const recordIndex = attendanceRecords.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) {
      return { success: false, message: 'Mesai kaydı bulunamadı.' };
    }

    const record = attendanceRecords[recordIndex];
    if (!record.isOnBreak) {
      return { success: false, message: 'Bu personel şu anda molada görünmüyor.' };
    }

    const now = Date.now();
    const startTime =
      record.currentBreakStartTime ||
      (record.breaks && record.breaks.length > 0
        ? record.breaks[record.breaks.length - 1].startTime
        : now);
    const durationMinutes = Math.max(1, Math.round((now - startTime) / (1000 * 60)));

    // Cancel scheduled break-over cloud notification
    const notifIdToCancel =
      record.currentBreakNotificationId ||
      (record.breaks && record.breaks.length > 0
        ? record.breaks[record.breaks.length - 1].scheduledNotificationId
        : undefined);

    if (notifIdToCancel) {
      OneSignalService.cancelNotification(notifIdToCancel).catch(() => {});
    }

    const existingBreaks = Array.isArray(record.breaks) ? [...record.breaks] : [];
    if (existingBreaks.length > 0) {
      const lastIndex = existingBreaks.length - 1;
      existingBreaks[lastIndex] = {
        ...existingBreaks[lastIndex],
        endTime: now,
        durationMinutes,
      };
    } else {
      existingBreaks.push({
        id: generateId(),
        startTime,
        endTime: now,
        durationMinutes,
      });
    }

    const totalBreakMinutes = existingBreaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

    const updatedRecord: AttendanceRecord = {
      ...record,
      isOnBreak: false,
      currentBreakStartTime: undefined,
      currentBreakNotificationId: undefined,
      breaks: existingBreaks,
      totalBreakMinutes,
    };

    const updated = [...attendanceRecords];
    updated[recordIndex] = updatedRecord;

    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);

    return {
      success: true,
      message: `${record.userName} personelinin molası başarıyla sonlandırıldı (${durationMinutes} dk). Mesaiye döndürüldü.`,
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
        companyCode: (record.companyCode || user.companyCode || compCode || 'POLATLAR').toUpperCase(),
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
        companyCode: (record.companyCode || user.companyCode || compCode || 'POLATLAR').toUpperCase(),
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
      await StorageService.saveAttendanceRecords(updated, { deletedRecordId: recordId });

      OneSignalService.sendPushNotification({
        title: '❌ İşe Giriş Talebiniz Reddedildi',
        message: `Yönetici ${user.name}, konum dışı işe giriş talebinizi onaylamadı.${reason ? ' Gerekçe: ' + reason : ''}`,
        targetMode: 'custom',
        targetUserIds: [record.userId],
        companyCode: (record.companyCode || user.companyCode || compCode || 'POLATLAR').toUpperCase(),
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
        companyCode: (record.companyCode || user.companyCode || compCode || 'POLATLAR').toUpperCase(),
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
    await StorageService.saveAttendanceRecords(updated, { deletedRecordId: id });
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

    // Send OneSignal Push Notification to Admins (non-blocking)
    OneSignalService.sendPushNotification({
      title: `📝 Yeni İzin Talebi: ${user.name}`,
      message: `${user.name}, ${details} ${
        params.leaveType === 'hourly' ? 'Saatlik' : 'Günlük'
      } İzin talebinde bulundu. Neden: ${params.reason}`,
      targetMode: 'admin',
      excludeUserIds: [user.id],
      companyCode: (user.companyCode || compCode || 'POLATLAR').toUpperCase(),
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch((pushErr) => {
      console.warn('İzin talebi bildirim gönderim hatası:', pushErr);
    });

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

    // Notify employee via push notification (non-blocking)
    OneSignalService.sendPushNotification({
      title: '✅ İzin Talebiniz Onaylandı',
      message: `Sayın ${req.userName}, ${
        req.leaveType === 'hourly' ? 'saatlik' : 'günlük'
      } izin talebiniz (${req.durationText}) onaylandı.`,
      targetUserIds: [req.userId],
      targetMode: 'custom',
      companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch((e) => {
      console.warn('İzin onay bildirimi hatası:', e);
    });

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

    // Notify employee via push notification (non-blocking)
    OneSignalService.sendPushNotification({
      title: '❌ İzin Talebiniz Reddedildi',
      message: `Sayın ${req.userName}, ${
        req.leaveType === 'hourly' ? 'saatlik' : 'günlük'
      } izin talebiniz reddedildi.${reason ? ` Gerekçe: ${reason}` : ''}`,
      targetUserIds: [req.userId],
      targetMode: 'custom',
      companyCode: (user?.companyCode || compCode || 'POLATLAR').toUpperCase(),
      url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
    }).catch((e) => {
      console.warn('İzin ret bildirimi hatası:', e);
    });

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
    const targetComp = (user?.companyCode || compCode || 'POLATLAR').toUpperCase();
    await StorageService.saveLeaveRequests(updated, targetComp);

    if (req.status === 'approved' && isUserAdmin(user) && req.userId !== user.id) {
      OneSignalService.sendPushNotification({
        title: 'ℹ️ İzin İptal Bilgisi',
        message: `Sayın ${req.userName}, ${req.date} tarihindeki izniniz yöneticiniz (${user.name}) tarafından kaldırılmıştır. Mesainiz aktiftir.`,
        targetUserIds: [req.userId],
        targetMode: 'custom',
        companyCode: targetComp,
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch((e) => {
        console.warn('İzin iptal bildirim hatası:', e);
      });
    }

    return {
      success: true,
      message: `${req.userName} kullanıcısının izin kaydı başarıyla kaldırıldı.`,
    };
  };

  const deleteLeaveRequest = async (requestId: string): Promise<void> => {
    const req = leaveRequests.find((r) => r.id === requestId);
    const updated = leaveRequests.filter((r) => r.id !== requestId);
    setLeaveRequests(updated);
    const targetComp = (user?.companyCode || compCode || 'POLATLAR').toUpperCase();
    await StorageService.saveLeaveRequests(updated, targetComp);

    // If was approved and canceled by admin, send push notification to user
    if (req && req.status === 'approved' && user && isUserAdmin(user) && req.userId !== user.id) {
      OneSignalService.sendPushNotification({
        title: 'ℹ️ İzin İptal Bilgisi',
        message: `Sayın ${req.userName}, ${req.date} tarihindeki izniniz yöneticiniz (${user.name}) tarafından kaldırılmıştır. Mesainiz aktiftir.`,
        targetUserIds: [req.userId],
        targetMode: 'custom',
        companyCode: targetComp,
        url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
      }).catch((e) => {
        console.warn('İzin iptal bildirim hatası:', e);
      });
    }
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

  // Active alarm checker for managers (Only admins hear/see timed follow-up alarms)
  useEffect(() => {
    if (!user || !isUserAdmin(user)) {
      if (activeRingingAlarm) {
        NotificationService.stopAlarmSound();
        setActiveRingingAlarm(null);
      }
      return;
    }

    const checkAlarms = () => {
      const now = Date.now();
      let triggeredAlarm: TimedFollowUp | null = null;
      let triggerResult: ReturnType<typeof checkMilestoneTrigger> = null;

      for (const item of timedFollowUps) {
        if (item.status !== 'pending') continue;
        const res = checkMilestoneTrigger(item, now);
        if (res && res.shouldTrigger) {
          triggeredAlarm = item;
          triggerResult = res;
          break;
        }
      }

      if (triggeredAlarm && triggerResult) {
        const { milestoneKey, milestoneLabel, consumedMilestones } = triggerResult;

        if (
          !activeRingingAlarm ||
          activeRingingAlarm.id !== triggeredAlarm.id ||
          activeRingingAlarm.currentMilestoneKey !== milestoneKey
        ) {
          const alarmWithMilestone: TimedFollowUp = {
            ...triggeredAlarm,
            currentMilestoneLabel: milestoneLabel,
            currentMilestoneKey: milestoneKey,
          };
          setActiveRingingAlarm(alarmWithMilestone);

          if (triggeredAlarm.soundAlarm !== false) {
            NotificationService.playAlarmSound();
          }

          const title = `⏰ Süreli Takip (${milestoneLabel}): ${triggeredAlarm.cariName}`;
          const body = triggeredAlarm.description || `Cari takip hatırlatması: ${milestoneLabel}`;
          const followUpUrl = 'https://saha-takip-beige.vercel.app/?tab=timed_follow_ups';
          NotificationService.sendNotification(title, body, followUpUrl);

          if (triggeredAlarm.sendPush !== false) {
            OneSignalService.sendPushNotification({
              title,
              message: body,
              targetMode: 'admin',
              companyCode: user.companyCode || 'POLATLAR',
              url: followUpUrl,
            }).catch(() => {});
          }

          // Persist the consumed milestone(s) immediately so that the same milestone never fires again
          const existingMilestones = triggeredAlarm.notifiedMilestones || [];
          const mergedMilestones = Array.from(new Set([...existingMilestones, ...consumedMilestones]));
          const updated = timedFollowUps.map((it) =>
            it.id === triggeredAlarm!.id
              ? {
                  ...it,
                  notifiedMilestones: mergedMilestones,
                  currentMilestoneLabel: milestoneLabel,
                  currentMilestoneKey: milestoneKey,
                  notified: milestoneKey === 'due' ? true : it.notified,
                }
              : it
          );
          setTimedFollowUps(updated);
          StorageService.saveTimedFollowUps(updated).catch(() => {});
        }
      }
    };

    checkAlarms();
    const timer = setInterval(checkAlarms, 8000);
    return () => {
      clearInterval(timer);
    };
  }, [timedFollowUps, user, activeRingingAlarm]);

  const addTimedFollowUp = async (data: {
    cariName: string;
    description: string;
    dueDate: string;
    soundAlarm?: boolean;
    sendPush?: boolean;
  }) => {
    const newItemId = generateId();
    const companyCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    let onesignalNotificationId: string | undefined = undefined;

    // Pre-schedule cloud push notification via OneSignal send_after
    // This ensures notifications ring on locked phones even if the app is killed/closed!
    const targetDate = parseDueDateTime(data.dueDate);
    const now = Date.now();
    if (data.sendPush !== false && targetDate && targetDate.getTime() > now) {
      try {
        const pushRes = await OneSignalService.sendPushNotification({
          title: `⏰ Süreli Takip: ${data.cariName.trim()}`,
          message: data.description.trim() || 'Vakti gelen cari takip hatırlatması!',
          targetMode: 'admin',
          companyCode,
          url: 'https://saha-takip-beige.vercel.app/?tab=timed_follow_ups',
          sendAfter: targetDate.toISOString(),
          collapseId: `tfu_${newItemId}`,
        });
        if (pushRes?.data?.id) {
          onesignalNotificationId = pushRes.data.id;
        }
      } catch (err) {
        console.warn('Failed to pre-schedule OneSignal push for timed follow-up:', err);
      }
    }

    const newItem: TimedFollowUp = {
      id: newItemId,
      companyCode,
      cariName: data.cariName.trim(),
      description: data.description.trim(),
      dueDate: data.dueDate,
      status: 'pending',
      notified: false,
      soundAlarm: data.soundAlarm ?? true,
      sendPush: data.sendPush ?? true,
      onesignalNotificationId,
      createdAt: now,
      createdBy: user?.id,
      createdByName: user?.name || 'Yönetici',
    };
    const updated = [newItem, ...timedFollowUps];
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
  };

  const updateTimedFollowUp = async (id: string, updates: Partial<TimedFollowUp>) => {
    const existingItem = timedFollowUps.find((item) => item.id === id);
    let newNotificationId = updates.onesignalNotificationId ?? existingItem?.onesignalNotificationId;

    // If dueDate changed and sendPush is enabled, cancel old schedule and schedule new one
    if (updates.dueDate && updates.dueDate !== existingItem?.dueDate) {
      if (existingItem?.onesignalNotificationId) {
        OneSignalService.cancelNotification(existingItem.onesignalNotificationId).catch(() => {});
        newNotificationId = undefined;
      }
      const targetDate = parseDueDateTime(updates.dueDate);
      if (
        (updates.sendPush !== false && existingItem?.sendPush !== false) &&
        targetDate &&
        targetDate.getTime() > Date.now()
      ) {
        try {
          const pushRes = await OneSignalService.sendPushNotification({
            title: `⏰ Süreli Takip: ${(updates.cariName || existingItem?.cariName || '').trim()}`,
            message: (updates.description || existingItem?.description || '').trim() || 'Vakti gelen cari takip hatırlatması!',
            targetMode: 'admin',
            companyCode: (user?.companyCode || 'POLATLAR').trim().toUpperCase(),
            url: 'https://saha-takip-beige.vercel.app/?tab=timed_follow_ups',
            sendAfter: targetDate.toISOString(),
            collapseId: `tfu_${id}`,
          });
          if (pushRes?.data?.id) {
            newNotificationId = pushRes.data.id;
          }
        } catch (err) {
          console.warn('Failed to update scheduled OneSignal push:', err);
        }
      }
    }

    const updated = timedFollowUps.map((item) => {
      if (item.id === id) {
        const res: TimedFollowUp = { ...item, ...updates, onesignalNotificationId: newNotificationId };
        if (updates.dueDate && updates.dueDate !== item.dueDate) {
          res.notified = false;
          res.snoozedUntil = undefined;
          res.notifiedMilestones = [];
          res.currentMilestoneLabel = undefined;
          res.currentMilestoneKey = undefined;
        }
        return res;
      }
      return item;
    });
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
  };

  const deleteTimedFollowUp = async (id: string) => {
    if (activeRingingAlarm?.id === id) {
      NotificationService.stopAlarmSound();
      setActiveRingingAlarm(null);
    }
    const itemToDelete = timedFollowUps.find((item) => item.id === id);
    if (itemToDelete?.onesignalNotificationId) {
      OneSignalService.cancelNotification(itemToDelete.onesignalNotificationId).catch(() => {});
    }
    const updated = timedFollowUps.filter((item) => item.id !== id);
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
  };

  const completeTimedFollowUp = async (id: string) => {
    if (activeRingingAlarm?.id === id) {
      NotificationService.stopAlarmSound();
      setActiveRingingAlarm(null);
    }
    const itemToComplete = timedFollowUps.find((item) => item.id === id);
    if (itemToComplete?.onesignalNotificationId) {
      OneSignalService.cancelNotification(itemToComplete.onesignalNotificationId).catch(() => {});
    }
    const updated = timedFollowUps.map((item) =>
      item.id === id
        ? {
            ...item,
            status: 'completed' as const,
            completedAt: Date.now(),
            completedByName: user?.name || 'Yönetici',
            notified: true,
          }
        : item
    );
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
  };

  const snoozeTimedFollowUp = async (id: string, minutes: number = 15) => {
    NotificationService.stopAlarmSound();
    setActiveRingingAlarm(null);

    const existingItem = timedFollowUps.find((item) => item.id === id);
    if (existingItem?.onesignalNotificationId) {
      OneSignalService.cancelNotification(existingItem.onesignalNotificationId).catch(() => {});
    }

    const snoozeTargetDate = new Date(Date.now() + minutes * 60 * 1000);
    const newDueDate = snoozeTargetDate.toISOString();
    let newNotificationId: string | undefined = undefined;

    if (existingItem && existingItem.sendPush !== false) {
      try {
        const pushRes = await OneSignalService.sendPushNotification({
          title: `⏰ [Ertelendi] Süreli Takip: ${existingItem.cariName}`,
          message: existingItem.description || 'Ertelenen cari takip hatırlatması!',
          targetMode: 'admin',
          companyCode: (user?.companyCode || 'POLATLAR').trim().toUpperCase(),
          url: 'https://saha-takip-beige.vercel.app/?tab=timed_follow_ups',
          sendAfter: snoozeTargetDate.toISOString(),
          collapseId: `tfu_${id}`,
        });
        if (pushRes?.data?.id) {
          newNotificationId = pushRes.data.id;
        }
      } catch (err) {
        console.warn('Failed to schedule snoozed OneSignal push:', err);
      }
    }

    const updated = timedFollowUps.map((item) =>
      item.id === id
        ? {
            ...item,
            snoozedUntil: newDueDate,
            notified: false,
            onesignalNotificationId: newNotificationId,
          }
        : item
    );
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
  };

  const dismissAlarm = async () => {
    NotificationService.stopAlarmSound();
    if (activeRingingAlarm) {
      const alarmId = activeRingingAlarm.id;
      const milestoneKey = activeRingingAlarm.currentMilestoneKey;
      setActiveRingingAlarm(null);
      const updated = timedFollowUps.map((item) => {
        if (item.id !== alarmId) return item;
        const currentMilestones = item.notifiedMilestones || [];
        const nextMilestones =
          milestoneKey && !currentMilestones.includes(milestoneKey)
            ? [...currentMilestones, milestoneKey]
            : currentMilestones;
        return {
          ...item,
          notified: milestoneKey === 'due' ? true : item.notified,
          notifiedMilestones: nextMilestones,
        };
      });
      setTimedFollowUps(updated);
      await StorageService.saveTimedFollowUps(updated);
    }
  };

  const refreshPersonalNotes = async () => {
    if (!user) return;
    try {
      const notes = await StorageService.getPersonalNotes(user.id);
      setPersonalNotes(notes);
    } catch (e) {
      console.warn('refreshPersonalNotes error:', e);
    }
  };

  const addPersonalNote = async (initialData?: Partial<PersonalNote>): Promise<PersonalNote> => {
    if (!user) throw new Error('Oturum açılmamış');
    const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
    const newNoteId = generateId();

    const newNote: PersonalNote = {
      id: newNoteId,
      userId: user.id,
      companyCode: compCode,
      title: initialData?.title || '',
      content: initialData?.content || '',
      color: initialData?.color || 'amber',
      isPinned: initialData?.isPinned || false,
      reminderDate: initialData?.reminderDate,
      reminderTime: initialData?.reminderTime,
      notified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...initialData,
    };

    // Pre-schedule cloud push notification via OneSignal send_after
    // Delivers push even if app is killed / browser closed!
    if (newNote.reminderDate) {
      const timeStr = (newNote.reminderTime || '09:00').trim();
      const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
      const targetTime = new Date(`${newNote.reminderDate}T${normalizedTime}`);
      if (!isNaN(targetTime.getTime()) && targetTime.getTime() > Date.now()) {
        try {
          const pushRes = await OneSignalService.sendPushNotification({
            title: '⏰ Kişisel Not Hatırlatıcısı',
            message: newNote.title
              ? `${newNote.title}: ${newNote.content || 'Hatırlatma vakti geldi.'}`
              : (newNote.content || 'Kişisel notunuz için hatırlatma vakti geldi.'),
            targetMode: 'custom',
            targetUserIds: [user.id],
            companyCode: compCode,
            url: 'https://saha-takip-beige.vercel.app/?tab=personal_notes',
            sendAfter: targetTime.toISOString(),
            collapseId: `pnote_${newNoteId}`,
          });
          if (pushRes?.data?.id) {
            newNote.onesignalNotificationId = pushRes.data.id;
          }
        } catch (err) {
          console.warn('Failed to schedule OneSignal push for personal note:', err);
        }
      }
    }

    const updated = [newNote, ...personalNotes];
    setPersonalNotes(updated);
    StorageService.savePersonalNotes(user.id, updated).catch(console.error);
    return newNote;
  };

  const updatePersonalNote = async (id: string, updates: Partial<PersonalNote>) => {
    if (!user) return;
    const compCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
    const existing = personalNotes.find((n) => n.id === id);
    let newNotifId = updates.onesignalNotificationId ?? existing?.onesignalNotificationId;

    const dateChanged = updates.reminderDate !== undefined && updates.reminderDate !== existing?.reminderDate;
    const timeChanged = updates.reminderTime !== undefined && updates.reminderTime !== existing?.reminderTime;
    const nextDate = updates.reminderDate !== undefined ? updates.reminderDate : existing?.reminderDate;
    const nextTime = updates.reminderTime !== undefined ? updates.reminderTime : existing?.reminderTime;

    const shouldReschedule = dateChanged || timeChanged || (Boolean(nextDate) && !newNotifId);

    // 1. ANINDA GÜNCELLEME: UI ve state hiç beklemeden anında güncellensin
    const immediateProps: Partial<PersonalNote> = {
      ...updates,
      updatedAt: Date.now(),
      ...(dateChanged || timeChanged ? { notified: false } : {}),
    };

    setPersonalNotes((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, ...immediateProps } : n));
      StorageService.savePersonalNotes(user.id, next).catch((err) => {
        console.warn('Error saving personal note updates:', err);
      });
      return next;
    });

    // 2. OneSignal bildirim zamanlamasını arka planda yönet
    if (!nextDate && existing?.onesignalNotificationId) {
      OneSignalService.cancelNotification(existing.onesignalNotificationId).catch(() => {});
      newNotifId = undefined;
    } else if (shouldReschedule && nextDate) {
      if (existing?.onesignalNotificationId) {
        OneSignalService.cancelNotification(existing.onesignalNotificationId).catch(() => {});
        newNotifId = undefined;
      }

      const timeStr = (nextTime || '09:00').trim();
      const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
      const targetTime = new Date(`${nextDate}T${normalizedTime}`);
      if (!isNaN(targetTime.getTime()) && targetTime.getTime() > Date.now()) {
        const nextTitle = updates.title !== undefined ? updates.title : existing?.title;
        const nextContent = updates.content !== undefined ? updates.content : existing?.content;
        try {
          const pushRes = await OneSignalService.sendPushNotification({
            title: '⏰ Kişisel Not Hatırlatıcısı',
            message: nextTitle
              ? `${nextTitle}: ${nextContent || 'Hatırlatma vakti geldi.'}`
              : (nextContent || 'Kişisel notunuz için hatırlatma vakti geldi.'),
            targetMode: 'custom',
            targetUserIds: [user.id],
            companyCode: compCode,
            url: 'https://saha-takip-beige.vercel.app/?tab=personal_notes',
            sendAfter: targetTime.toISOString(),
            collapseId: `pnote_${id}`,
          });
          if (pushRes?.data?.id) {
            newNotifId = pushRes.data.id;
            setPersonalNotes((prev) => {
              const next = prev.map((n) => (n.id === id ? { ...n, onesignalNotificationId: newNotifId } : n));
              StorageService.savePersonalNotes(user.id, next).catch(() => {});
              return next;
            });
          }
        } catch (err) {
          console.warn('Failed to reschedule OneSignal push for personal note:', err);
        }
      }
    }
  };

  const deletePersonalNote = async (id: string) => {
    if (!user) return;
    const target = personalNotes.find((n) => n.id === id);
    if (target?.onesignalNotificationId) {
      OneSignalService.cancelNotification(target.onesignalNotificationId).catch(() => {});
    }
    const updated = personalNotes.filter((n) => n.id !== id);
    setPersonalNotes(updated);
    await StorageService.savePersonalNotes(user.id, updated);
  };

  const togglePinPersonalNote = async (id: string) => {
    if (!user) return;
    const target = personalNotes.find((n) => n.id === id);
    if (!target) return;
    await updatePersonalNote(id, { isPinned: !target.isPinned });
  };

  // Check personal notes reminders while app is open / foreground
  useEffect(() => {
    if (!user || !personalNotes || personalNotes.length === 0) return;

    const checkPersonalNotesReminders = () => {
      const now = Date.now();
      const myNotes = personalNotes.filter((n) => n && n.userId === user.id);

      for (const note of myNotes) {
        if (!note.reminderDate || note.notified) continue;
        const timeStr = note.reminderTime || '09:00';
        const target = new Date(`${note.reminderDate}T${timeStr}:00`).getTime();
        if (!isNaN(target) && target <= now && now - target < 2 * 60 * 60 * 1000) {
          NotificationService.playAlarmSound();
          const title = '⏰ Kişisel Not Hatırlatıcısı';
          const body = note.title
            ? `${note.title}: ${note.content || 'Hatırlatma vakti geldi.'}`
            : (note.content || 'Kişisel notunuz için hatırlatma vakti geldi.');
          NotificationService.sendNotification(
            title,
            body,
            'https://saha-takip-beige.vercel.app/?tab=personal_notes'
          );
          updatePersonalNote(note.id, { notified: true });
        }
      }
    };

    checkPersonalNotesReminders();
    const interval = setInterval(checkPersonalNotesReminders, 8000);
    return () => clearInterval(interval);
  }, [personalNotes, user?.id]);

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
        localStorage.setItem('@saha_takip_last_read_time', String(now));
      } catch {
        // ignore
      }
    }
    // Clear iOS PWA App Badge & Service Worker badge
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      try {
        (navigator as any).clearAppBadge().catch(() => {});
      } catch {}
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'saha:clear-badge-notifications',
          count: 0,
        });
      } catch {}
    }
    // Stop any active ringing alarm
    if (activeRingingAlarm) {
      NotificationService.stopAlarmSound();
      setActiveRingingAlarm(null);
    }
    // Mark due timed follow-ups as notified so they don't ring or stay pending notification
    const hasDueUnnotified = timedFollowUps.some((item) => {
      if (item.status !== 'pending' || item.notified) return false;
      const targetDate = parseDueDateTime(item.snoozedUntil || item.dueDate);
      const targetTime = targetDate ? targetDate.getTime() : NaN;
      return !isNaN(targetTime) && targetTime <= now;
    });

    if (hasDueUnnotified) {
      const updatedFollowUps = timedFollowUps.map((item) => {
        if (item.status === 'pending' && !item.notified) {
          const targetDate = parseDueDateTime(item.snoozedUntil || item.dueDate);
          const targetTime = targetDate ? targetDate.getTime() : NaN;
          if (!isNaN(targetTime) && targetTime <= now) {
            return { ...item, notified: true };
          }
        }
        return item;
      });
      setTimedFollowUps(updatedFollowUps);
      StorageService.saveTimedFollowUps(updatedFollowUps).catch(() => {});
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
        (s) => s.createdBy !== user.id && s.createdAt > lastReadTime
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

      // 9. Timed follow-up alarms due (only unnotified and newer than lastReadTime)
      count += timedFollowUps.filter((item) => {
        if (item.status !== 'pending' || item.notified) return false;
        const targetDate = parseDueDateTime(item.snoozedUntil || item.dueDate);
        const targetTime = targetDate ? targetDate.getTime() : NaN;
        return !isNaN(targetTime) && targetTime <= Date.now() && targetTime > lastReadTime;
      }).length;
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
    timedFollowUps,
    user,
    lastReadTime,
  ]);

  // --- App Badging API & Dynamic Launcher / Favicon Badge ---
  useEffect(() => {
    // 1. W3C App Badging API (Android PWA Launcher Icon / iOS 16.4+ / Windows & Mac Desktop PWA)
    if (typeof navigator !== 'undefined') {
      try {
        if ('setAppBadge' in navigator) {
          if (badgeCount > 0) {
            (navigator as any).setAppBadge(badgeCount).catch((err: any) => {
              console.debug('setAppBadge error:', err);
            });
          } else {
            (navigator as any).clearAppBadge().catch((err: any) => {
              console.debug('clearAppBadge error:', err);
            });
          }
        }
      } catch (e) {
        console.debug('App Badging API not supported:', e);
      }

      // 2. Clear any lingering tray/pop-up badge notifications and sync icon badge only
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(async (reg) => {
            if (reg.active) {
              reg.active.postMessage({
                type: 'saha:clear-badge-notifications',
                count: badgeCount,
              });
            }

            // Explicitly close ANY lingering or pop-up badge notifications across all tags
            if (typeof window !== 'undefined' && 'Notification' in window) {
              try {
                const activeNotifs = await reg.getNotifications();
                activeNotifs.forEach((n) => {
                  if (
                    n.tag === 'saha-takip-badge' ||
                    (n.body && n.body.includes('bekleyen bildirim')) ||
                    (n.title === 'İş Takip' && n.body && n.body.includes('bekleyen'))
                  ) {
                    n.close();
                  }
                });
              } catch (e) {
                // ignore
              }
            }
          }).catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Dynamic Title Update (e.g. "(3) İş Takip Portalı")
    if (typeof document !== 'undefined') {
      try {
        const baseTitle = 'İş Takip Sistemi';
        if (badgeCount > 0) {
          document.title = `(${badgeCount}) ${baseTitle}`;
        } else {
          document.title = baseTitle;
        }
      } catch (e) {
        // ignore
      }

      // 4. Dynamic Favicon Badge for Browser Tabs
      try {
        const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
        if (link) {
          if (badgeCount <= 0) {
            link.href = '/favicon.png';
          } else {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = '/favicon.png';
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Draw base icon
                ctx.drawImage(img, 0, 0, 64, 64);

                // Draw notification circle in top-right
                const radius = 18;
                const x = 46;
                const y = 18;

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = '#ef4444'; // Red badge
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                // Draw badge count text
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const text = badgeCount > 99 ? '99+' : String(badgeCount);
                ctx.fillText(text, x, y + 1);

                link.href = canvas.toDataURL('image/png');
              } catch (e) {
                // ignore
              }
            };
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }, [badgeCount]);

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
        timedFollowUps,
        activeRingingAlarm,
        addTimedFollowUp,
        updateTimedFollowUp,
        deleteTimedFollowUp,
        completeTimedFollowUp,
        snoozeTimedFollowUp,
        dismissAlarm,
        personalNotes,
        addPersonalNote,
        updatePersonalNote,
        deletePersonalNote,
        togglePinPersonalNote,
        refreshPersonalNotes,
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
        approveMultipleNotes,
        completeMultipleNotes,
        processNote,
        unprocessNote,
        processMultipleNotes,
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
        updateBranchBreakMinutes,
        updateWorkplaceBreakMinutes,
        shifts,
        shiftAssignments,
        createShift,
        updateShift,
        deleteShift,
        assignUserShift,
        removeUserShift,
        refreshShifts,
        checkInStaff,
        checkOutStaff,
        startBreak,
        endBreak,
        endBreakForStaff,
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
