import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/supabaseClient';
import { useAuth } from './AuthContext';
import { StorageService } from '../services/storageService';
import { LocationService } from '../services/locationService';
import { parseDueDateTime } from '../utils/dateUtils';
import { MobilePushService } from '../services/pushService';
import {
  LocationItem,
  ServiceItem,
  ReturnWarrantyItem,
  AttendanceRecord,
  WorkplaceLocation,
  LeaveRequest,
  GeneralNote,
  Branch,
  HeadquarterCompany,
  TimedFollowUp,
  AdminReminder,
  AdminReminderCategory,
  SecurityLogItem,
} from '../types/storage';

interface StorageContextType {
  locations: LocationItem[];
  services: ServiceItem[];
  returnWarrantyItems: ReturnWarrantyItem[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  workplaceLocation: WorkplaceLocation | null;
  branches: Branch[];
  headquarters: HeadquarterCompany[];
  notes: GeneralNote[];
  timedFollowUps: TimedFollowUp[];
  adminReminders: AdminReminder[];
  securityLogs: SecurityLogItem[];
  standardTasks: string[];
  cariler: string[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  checkInStaff: (branchId?: string) => Promise<{ success: boolean; message: string }>;
  checkOutStaff: (notes?: string) => Promise<{ success: boolean; message: string }>;
  approveAttendance: (recordId: string, actionType: 'checkin' | 'checkout') => Promise<{ success: boolean; message: string }>;
  rejectAttendance: (recordId: string, actionType: 'checkin' | 'checkout', reason?: string) => Promise<{ success: boolean; message: string }>;
  deleteAttendanceRecord: (recordId: string) => Promise<{ success: boolean; message: string }>;
  requestLeave: (params: {
    startDate: string;
    endDate?: string;
    leaveType?: 'daily' | 'hourly';
    durationText?: string;
    reason: string;
  }) => Promise<{ success: boolean; message: string }>;
  addService: (params: {
    companyName: string;
    cariName?: string;
    location?: string;
    workDone: string;
    latitude?: number;
    longitude?: number;
    photos?: string[];
  }) => Promise<{ success: boolean; message: string }>;
  addLocation: (params: {
    name: string;
    cariName?: string;
    address?: string;
    notes?: string;
    photos?: string[];
    tasks?: string[];
    latitude?: number;
    longitude?: number;
  }) => Promise<{ success: boolean; message: string }>;
  completeLocation: (id: string, note?: string, photos?: string[]) => Promise<{ success: boolean; message: string }>;
  deleteLocation: (id: string) => Promise<{ success: boolean; message: string }>;
  addReturnWarranty: (params: {
    type: 'warranty' | 'return';
    companyName: string;
    cariName?: string;
    sentDate: string;
    serialNumber?: string;
    trackingCode?: string;
    notes?: string;
    followUpNote?: string;
    followUpDate?: string;
    serialNumberPhoto?: string;
    trackingCodePhoto?: string;
  }) => Promise<{ success: boolean; message: string }>;
  deleteService: (id: string) => Promise<{ success: boolean; message: string }>;
  addNote: (params: {
    content: string;
    cariName?: string;
    targetMode?: 'self' | 'all' | 'custom';
    targetUserIds?: string[];
    targetUserNames?: string[];
    reminderActive?: boolean;
    reminderDate?: string;
    photos?: string[];
  }) => Promise<{ success: boolean; message: string }>;
  deleteNote: (id: string) => Promise<{ success: boolean; message: string }>;
  updateNoteStatus: (id: string, status: any) => Promise<{ success: boolean; message: string }>;
  addBranch: (params: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    phone?: string;
    headquarterId?: string;
    headquarterName?: string;
    companyCode?: string;
  }) => Promise<{ success: boolean; message: string }>;
  updateBranch: (id: string, updates: Partial<Branch>, targetCompanyCode?: string) => Promise<{ success: boolean; message: string }>;
  deleteBranch: (id: string, targetCompanyCode?: string) => Promise<{ success: boolean; message: string }>;
  assignStaffToBranch: (branchId: string, userIds: string[], targetCompanyCode?: string) => Promise<{ success: boolean; message?: string }>;
  addHeadquarter: (params: {
    name: string;
    phone?: string;
    address?: string;
    contactPerson?: string;
    taxNumber?: string;
    notes?: string;
  }) => Promise<{ success: boolean; message: string; headquarter?: HeadquarterCompany }>;
  deleteHeadquarter: (id: string) => Promise<{ success: boolean; message: string }>;
  updateHeadquarter: (id: string, updates: Partial<HeadquarterCompany>) => Promise<{ success: boolean; message: string }>;
  updateBranchHeadquarter: (branchId: string, headquarterId: string, headquarterName: string) => Promise<{ success: boolean; message: string }>;
  updateWorkplaceLocation: (loc: WorkplaceLocation) => Promise<{ success: boolean; message: string }>;
  // Timed Follow-ups
  addTimedFollowUp: (params: {
    cariName: string;
    description: string;
    dueDate: string;
    soundAlarm?: boolean;
    sendPush?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
  updateTimedFollowUp: (id: string, updates: Partial<TimedFollowUp>) => Promise<{ success: boolean; message: string }>;
  deleteTimedFollowUp: (id: string) => Promise<{ success: boolean; message: string }>;
  completeTimedFollowUp: (id: string) => Promise<{ success: boolean; message: string }>;
  // Admin Reminders
  addAdminReminder: (params: {
    title: string;
    content: string;
    category?: AdminReminderCategory;
    isPinned?: boolean;
    photos?: string[];
    sendPush?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
  updateAdminReminder: (id: string, updates: Partial<AdminReminder>) => Promise<{ success: boolean; message: string }>;
  deleteAdminReminder: (id: string) => Promise<{ success: boolean; message: string }>;
  markReminderAsRead: (id: string) => Promise<{ success: boolean; message: string }>;
  // Security Logs
  deleteSecurityLog: (id: string) => Promise<{ success: boolean; message: string }>;
  clearAllSecurityLogs: () => Promise<{ success: boolean; message: string }>;
  markSecurityLogsAsRead: () => Promise<{ success: boolean; message: string }>;
  // Standard Tasks (Şablon Yönetimi)
  addStandardTask: (task: string) => Promise<{ success: boolean; message: string }>;
  deleteStandardTask: (index: number) => Promise<{ success: boolean; message: string }>;
  resetStandardTasks: () => Promise<{ success: boolean; message: string }>;
  // Cari Entegrasyonu (Excel & DB)
  carilerUpdatedAt: string | null;
  carilerDatabase: string | null;
  importCarilerFromExcelBuffer: (buffer: ArrayBuffer, fileName?: string) => Promise<{ success: boolean; total: number; message: string }>;
  exportCarilerToExcel: (fileName?: string) => Promise<void>;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [returnWarrantyItems, setReturnWarrantyItems] = useState<ReturnWarrantyItem[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [workplaceLocation, setWorkplaceLocation] = useState<WorkplaceLocation | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [headquarters, setHeadquarters] = useState<HeadquarterCompany[]>([]);
  const [notes, setNotes] = useState<GeneralNote[]>([]);
  const [timedFollowUps, setTimedFollowUps] = useState<TimedFollowUp[]>([]);
  const [adminReminders, setAdminReminders] = useState<AdminReminder[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLogItem[]>([]);
  const [standardTasks, setStandardTasks] = useState<string[]>([]);
  const [cariler, setCariler] = useState<string[]>([]);
  const [carilerUpdatedAt, setCarilerUpdatedAt] = useState<string | null>(null);
  const [carilerDatabase, setCarilerDatabase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const compCode = user.companyCode || 'POLATLAR';
      StorageService.setCompany(compCode);

      const [locs, srvs, retItems, attRecs, lReqs, wpLoc, brs, hqs, nts, tfus, rems, logs, sTasks, cData] = await Promise.all([
        StorageService.getLocations(),
        StorageService.getServices(),
        StorageService.getReturnWarrantyItems(),
        StorageService.getAttendanceRecords(),
        StorageService.getLeaveRequests(),
        StorageService.getWorkplaceLocation(),
        StorageService.getBranches(),
        StorageService.getHeadquarters(),
        StorageService.getNotes(),
        StorageService.getTimedFollowUps(),
        StorageService.getAdminReminders(),
        StorageService.getSecurityLogs(),
        StorageService.getStandardTasks(),
        StorageService.getCarilerData(),
      ]);

      const defaultHq = hqs && hqs.length > 0 ? hqs[0] : undefined;
      const normalizedBranches = brs.map((b) => {
        if (!b.headquarterName && defaultHq) {
          return { ...b, headquarterId: defaultHq.id, headquarterName: defaultHq.name };
        }
        return b;
      });

      setLocations(locs);
      setServices(srvs);
      setReturnWarrantyItems(retItems);
      setAttendanceRecords(attRecs);
      setLeaveRequests(lReqs);
      setWorkplaceLocation(wpLoc);
      setBranches(normalizedBranches);
      setHeadquarters(hqs);
      setNotes(nts);
      setTimedFollowUps(tfus);
      setAdminReminders(rems);
      setSecurityLogs(logs);
      setStandardTasks(sTasks);
      setCariler(cData.cariler);
      setCarilerUpdatedAt(cData.updatedAt);
      setCarilerDatabase(cData.database);
    } catch (err) {
      console.warn('loadData error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();

      // Realtime listener for live sync without full polling
      const channel = supabase
        .channel(`mobile-db-changes-${user.companyCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, async () => {
          const l = await StorageService.getLocations();
          setLocations(l);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, async () => {
          const s = await StorageService.getServices();
          setServices(s);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'return_warranty' }, async () => {
          const r = await StorageService.getReturnWarrantyItems();
          setReturnWarrantyItems(r);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, async () => {
          const n = await StorageService.getNotes();
          setNotes(n);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'standard_tasks' }, async () => {
          const [att, lReq, wp, br] = await Promise.all([
            StorageService.getAttendanceRecords(),
            StorageService.getLeaveRequests(),
            StorageService.getWorkplaceLocation(),
            StorageService.getBranches(),
          ]);
          setAttendanceRecords(att);
          setLeaveRequests(lReq);
          setWorkplaceLocation(wp);
          setBranches(br);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, loadData]);

  // 1. MESAI: İşe Geldim (Check-in)
  const checkInStaff = async (branchId?: string) => {
    if (!user) return { success: false, message: 'Oturum açılmamış.' };

    try {
      const pos = await LocationService.getCurrentPosition();
      const todayStr = new Date().toISOString().split('T')[0];

      let checkInDistance = 0;
      let checkInOutside = false;
      let branchName: string | undefined = undefined;

      // Determine target location: specific branch, or closest branch, or workplaceLocation
      if (branches && branches.length > 0) {
        let selectedBranch = branches.find((b) => b.id === branchId);
        if (!selectedBranch) {
          // Find closest branch
          let minD = Infinity;
          for (const b of branches) {
            const d = LocationService.calculateDistance(pos.latitude, pos.longitude, b.latitude, b.longitude);
            if (d < minD) {
              minD = d;
              selectedBranch = b;
            }
          }
        }
        if (selectedBranch) {
          branchName = selectedBranch.name;
          const radius = selectedBranch.radiusMeters || 20;
          const check = LocationService.isWithinRadius(
            pos.latitude,
            pos.longitude,
            selectedBranch.latitude,
            selectedBranch.longitude,
            radius
          );
          checkInDistance = check.distanceMeters;
          checkInOutside = !check.isWithin;
        }
      } else if (workplaceLocation) {
        const radius = workplaceLocation.radiusMeters || 20;
        const check = LocationService.isWithinRadius(
          pos.latitude,
          pos.longitude,
          workplaceLocation.latitude,
          workplaceLocation.longitude,
          radius
        );
        checkInDistance = check.distanceMeters;
        checkInOutside = !check.isWithin;
      }

      const newRec: AttendanceRecord = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        date: todayStr,
        checkInTime: Date.now(),
        checkInLat: pos.latitude,
        checkInLon: pos.longitude,
        checkInAddress: pos.address,
        checkInDistance,
        checkInOutside,
        branchId,
        branchName,
        status: checkInOutside ? 'pending_checkin_approval' : 'checked_in',
        checkInApprovalStatus: checkInOutside ? 'pending' : 'approved',
      };

      const updated = [newRec, ...attendanceRecords.filter((r) => r.id !== newRec.id)];
      setAttendanceRecords(updated);
      await StorageService.saveAttendanceRecords(updated);

      const msg = checkInOutside
        ? `Mesai başlatıldı (İş yerine ${LocationService.formatDistance(checkInDistance)} mesafedesiniz, onay bekleniyor).`
        : 'Mesai başarıyla başlatıldı. İyi çalışmalar!';

      return { success: true, message: msg };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Konum alınamadı.' };
    }
  };

  // 2. MESAI: Çıkış Yap (Check-out)
  const checkOutStaff = async (notesParam?: string) => {
    if (!user) return { success: false, message: 'Oturum açılmamış.' };
    const todayStr = new Date().toISOString().split('T')[0];
    const activeRec = attendanceRecords.find(
      (r) =>
        r.userId === user.id &&
        r.date === todayStr &&
        (r.status === 'checked_in' || r.status === 'pending_checkin_approval' || r.status === 'pending_checkout_approval') &&
        !r.checkOutTime
    );

    if (!activeRec) {
      return { success: false, message: 'Bugüne ait aktif bir mesai kaydı bulunamadı.' };
    }

    try {
      const pos = await LocationService.getCurrentPosition();
      let checkOutDistance = 0;
      let checkOutOutside = false;

      if (branches && branches.length > 0) {
        let matchedBranch = branches.find((b) => b.id === activeRec.branchId) || branches[0];
        const radius = matchedBranch.radiusMeters || 20;
        const check = LocationService.isWithinRadius(
          pos.latitude,
          pos.longitude,
          matchedBranch.latitude,
          matchedBranch.longitude,
          radius
        );
        checkOutDistance = check.distanceMeters;
        checkOutOutside = !check.isWithin;
      } else if (workplaceLocation) {
        const radius = workplaceLocation.radiusMeters || 20;
        const check = LocationService.isWithinRadius(
          pos.latitude,
          pos.longitude,
          workplaceLocation.latitude,
          workplaceLocation.longitude,
          radius
        );
        checkOutDistance = check.distanceMeters;
        checkOutOutside = !check.isWithin;
      }

      const now = Date.now();
      const durationMin = Math.round((now - activeRec.checkInTime) / 60000);

      const updatedRec: AttendanceRecord = {
        ...activeRec,
        checkOutTime: now,
        checkOutLat: pos.latitude,
        checkOutLon: pos.longitude,
        checkOutAddress: pos.address,
        checkOutDistance,
        checkOutOutside,
        workDurationMinutes: durationMin,
        notes: notesParam || activeRec.notes,
        status: checkOutOutside ? 'pending_checkout_approval' : 'completed',
        checkOutApprovalStatus: checkOutOutside ? 'pending' : 'approved',
      };

      const updated = attendanceRecords.map((r) => (r.id === activeRec.id ? updatedRec : r));
      setAttendanceRecords(updated);
      await StorageService.saveAttendanceRecords(updated);

      return { success: true, message: 'Mesai çıkışı başarıyla kaydedildi.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Konum alınamadı.' };
    }
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
      return { success: false, message: 'İlgili mesai kaydı bulunamadı.' };
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
    } else {
      const now = Date.now();
      const checkoutTime = record.checkOutTime || now;
      const durationMinutes = Math.max(1, Math.round((checkoutTime - record.checkInTime) / 60000));

      updatedRecord = {
        ...record,
        status: 'completed',
        checkOutTime: checkoutTime,
        checkOutApprovalStatus: 'approved',
        checkOutApprovedBy: user.name,
        checkOutApprovedAt: now,
        workDurationMinutes: durationMinutes,
      };
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
      return { success: false, message: 'İlgili mesai kaydı bulunamadı.' };
    }
    const record = attendanceRecords[idx];
    let updatedRecord: AttendanceRecord;

    if (actionType === 'checkin') {
      updatedRecord = {
        ...record,
        status: 'completed',
        checkInApprovalStatus: 'rejected',
        approvalNote: reason || 'Yönetici tarafından işe giriş reddedildi.',
      };
    } else {
      updatedRecord = {
        ...record,
        status: 'checked_in',
        checkOutApprovalStatus: 'rejected',
        approvalNote: reason || 'Yönetici tarafından çıkış reddedildi.',
      };
    }

    const updated = [...attendanceRecords];
    updated[idx] = updatedRecord;
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);
    return { success: true, message: 'Talep reddedildi.' };
  };

  const deleteAttendanceRecord = async (
    recordId: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: 'Bu işlemi yapmaya sadece yöneticiler yetkilidir.' };
    }
    const updated = attendanceRecords.filter((r) => r.id !== recordId);
    setAttendanceRecords(updated);
    await StorageService.saveAttendanceRecords(updated);
    return { success: true, message: 'Kayıt silindi.' };
  };

  // 3. IZIN TALEBI
  const requestLeave = async (params: {
    startDate: string;
    endDate?: string;
    leaveType?: 'daily' | 'hourly';
    durationText?: string;
    reason: string;
  }) => {
    if (!user) return { success: false, message: 'Oturum açılmamış.' };

    const newLeave: LeaveRequest = {
      id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      leaveType: params.leaveType || (params.endDate && params.endDate !== params.startDate ? 'daily' : 'daily'),
      date: params.startDate,
      endDate: params.endDate || params.startDate,
      durationText: params.durationText || '1 Gün',
      reason: params.reason,
      status: 'pending',
      requestedAt: Date.now(),
    };

    const updated = [newLeave, ...leaveRequests];
    setLeaveRequests(updated);
    await StorageService.saveLeaveRequests(updated);
    return { success: true, message: 'İzin talebiniz yönetici onayına iletildi.' };
  };

  // 4. SERVIS EKLE
  const addService = async (params: {
    companyName: string;
    cariName?: string;
    location?: string;
    workDone: string;
    latitude?: number;
    longitude?: number;
    photos?: string[];
  }) => {
    if (!user) return { success: false, message: 'Oturum açılmamış.' };
    const todayStr = new Date().toISOString().split('T')[0];

    const newSrv: ServiceItem = {
      id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyName: params.companyName,
      cariName: params.cariName,
      location: params.location || '',
      latitude: params.latitude,
      longitude: params.longitude,
      workDone: params.workDone,
      date: todayStr,
      photos: params.photos || [],
      createdAt: Date.now(),
      createdBy: user.id,
      createdByName: user.name,
      status: 'pending',
    };

    const updated = [newSrv, ...services];
    setServices(updated);
    await StorageService.saveServices(updated);
    return { success: true, message: 'Servis kaydı başarıyla eklendi.' };
  };

  const deleteService = async (id: string) => {
    const updated = services.filter((s) => s.id !== id);
    setServices(updated);
    await StorageService.deleteService(id);
    return { success: true, message: 'Servis kaydı silindi.' };
  };

  // 5. GÖREV / İŞ EMRİ EKLE
  const addLocation = async (params: {
    name: string;
    cariName?: string;
    address?: string;
    notes?: string;
    photos?: string[];
    tasks?: string[];
    latitude?: number;
    longitude?: number;
  }) => {
    if (!user) return { success: false, message: 'Oturum açılmamış.' };

    const newLoc: LocationItem = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: params.name,
      cariName: params.cariName,
      address: params.address || '',
      notes: params.notes || '',
      photos: params.photos || [],
      latitude: params.latitude,
      longitude: params.longitude,
      createdAt: Date.now(),
      createdBy: user.id,
      createdByName: user.name,
      tasks: (params.tasks || []).map((t, idx) => ({ id: `task_${idx}_${Date.now()}`, name: t, status: 'pending' })),
      status: 'pending',
    };

    const updated = [newLoc, ...locations];
    setLocations(updated);
    await StorageService.saveLocations(updated);
    return { success: true, message: 'İş emri başarıyla oluşturuldu.' };
  };

  // 6. GÖREVİ TAMAMLA
  const completeLocation = async (id: string, note?: string, photos?: string[]) => {
    if (!user) return { success: false, message: 'Oturum açılmamış.' };
    const target = locations.find((l) => l.id === id);
    if (!target) return { success: false, message: 'İş emri bulunamadı.' };

    const updatedLoc: LocationItem = {
      ...target,
      status: 'completed',
      completedAt: Date.now(),
      completedBy: user.id,
      completedByName: user.name,
      completionNote: note,
      completionPhotos: photos || [],
      tasks: target.tasks.map((t) => ({ ...t, status: 'completed' })),
    };

    const updated = locations.map((l) => (l.id === id ? updatedLoc : l));
    setLocations(updated);
    await StorageService.saveLocations(updated);
    return { success: true, message: 'İş emri tamamlandı olarak kaydedildi.' };
  };

  const deleteLocation = async (id: string) => {
    const updated = locations.filter((l) => l.id !== id);
    setLocations(updated);
    await StorageService.deleteLocation(id);
    return { success: true, message: 'Kurulum silindi.' };
  };

  // 7. İADE & GARANTİ EKLE
  const addReturnWarranty = async (params: {
    type: 'warranty' | 'return';
    companyName: string;
    cariName?: string;
    sentDate: string;
    serialNumber?: string;
    trackingCode?: string;
    notes?: string;
    followUpNote?: string;
    followUpDate?: string;
    serialNumberPhoto?: string;
    trackingCodePhoto?: string;
  }) => {
    if (!user) return { success: false, message: 'Oturum açılmamış.' };

    const newItem: ReturnWarrantyItem = {
      id: `rw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: params.type,
      companyName: params.companyName,
      cariName: params.cariName,
      sentDate: params.sentDate,
      serialNumber: params.serialNumber,
      trackingCode: params.trackingCode,
      notes: params.notes,
      followUpNote: params.followUpNote,
      followUpDate: params.followUpDate,
      serialNumberPhoto: params.serialNumberPhoto,
      trackingCodePhoto: params.trackingCodePhoto,
      status: 'pending',
      reminderActive: true,
      createdAt: Date.now(),
      createdBy: user.id,
      createdByName: user.name,
    };

    const updated = [newItem, ...returnWarrantyItems];
    setReturnWarrantyItems(updated);
    await StorageService.saveReturnWarrantyItems(updated);
    return { success: true, message: 'İade/Garanti kaydı başarıyla oluşturuldu.' };
  };

  // 8. NOT / İŞ EMRİ EKLE
  const addNote = async (params: {
    content: string;
    cariName?: string;
    targetMode?: 'self' | 'all' | 'custom';
    targetUserIds?: string[];
    targetUserNames?: string[];
    reminderActive?: boolean;
    reminderDate?: string;
    photos?: string[];
  }) => {
    if (!user) return { success: false, message: 'Oturum açılmamış.' };

    const newNote: GeneralNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      content: params.content,
      cariName: params.cariName,
      createdAt: Date.now(),
      createdBy: user.id,
      createdByName: user.name,
      targetMode: params.targetMode || 'self',
      targetUserIds: params.targetUserIds || [],
      targetUserNames: params.targetUserNames || [],
      reminderActive: params.reminderActive || false,
      reminderDate: params.reminderDate,
      photos: params.photos || [],
      notified: false,
      status: 'pending',
    };

    const updated = [newNote, ...notes];
    setNotes(updated);
    await StorageService.saveNotes(updated);
    return { success: true, message: 'İş emri başarıyla kaydedildi.' };
  };

  const deleteNote = async (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    await StorageService.deleteNote(id);
    return { success: true, message: 'İş emri silindi.' };
  };

  const updateNoteStatus = async (id: string, status: any) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, status } : n));
    setNotes(updated);
    await StorageService.updateNoteStatus(id, status);
    return { success: true, message: 'İş emri durumu güncellendi.' };
  };

  const addBranch = async (params: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    phone?: string;
    headquarterId?: string;
    headquarterName?: string;
    companyCode?: string;
  }) => {
    if (!user) return { success: false, message: 'Oturum açılmadı.' };
    const currentCompCode = (user.companyCode || 'POLATLAR').trim().toUpperCase();
    const targetCompCode = (params.companyCode || currentCompCode).trim().toUpperCase();
    const defaultHq = headquarters && headquarters.length > 0 ? headquarters[0] : undefined;
    const newBranch: Branch = {
      id: 'br_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      companyCode: targetCompCode,
      headquarterId: params.headquarterId || defaultHq?.id,
      headquarterName: params.headquarterName || defaultHq?.name || 'Merkez Firma',
      name: params.name.trim(),
      address: params.address.trim(),
      latitude: params.latitude,
      longitude: params.longitude,
      radiusMeters: params.radiusMeters || 20,
      phone: params.phone,
      assignedUserIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (targetCompCode === currentCompCode) {
      const updated = [...branches, newBranch];
      setBranches(updated);
      await StorageService.saveBranches(updated);
    } else {
      const targetExisting = await StorageService.getBranchesForCompany(targetCompCode);
      const targetUpdated = [...targetExisting, newBranch];
      await StorageService.saveBranchesForCompany(targetCompCode, targetUpdated);
    }
    return { success: true, message: 'Şube başarıyla eklendi.' };
  };

  const updateBranch = async (id: string, updates: Partial<Branch>, targetCompanyCode?: string) => {
    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const branchCompCode = (targetCompanyCode || currentCompCode).trim().toUpperCase();

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
    return { success: true, message: 'Şube güncellendi.' };
  };

  const deleteBranch = async (id: string, targetCompanyCode?: string) => {
    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const branchCompCode = (targetCompanyCode || currentCompCode).trim().toUpperCase();

    if (branchCompCode === currentCompCode) {
      const updated = branches.filter((b) => b.id !== id);
      setBranches(updated);
      await StorageService.saveBranches(updated);
    } else {
      const targetExisting = await StorageService.getBranchesForCompany(branchCompCode);
      const targetUpdated = targetExisting.filter((b) => b.id !== id);
      await StorageService.saveBranchesForCompany(branchCompCode, targetUpdated);
    }
    return { success: true, message: 'Şube silindi.' };
  };

  const assignStaffToBranch = async (branchId: string, userIds: string[], targetCompanyCode?: string) => {
    const currentCompCode = (user?.companyCode || 'POLATLAR').trim().toUpperCase();
    let branchCompCode = targetCompanyCode ? targetCompanyCode.trim().toUpperCase() : currentCompCode;

    if (!targetCompanyCode) {
      const found = branches.find((b) => b.id === branchId);
      if (found?.companyCode) {
        branchCompCode = found.companyCode.trim().toUpperCase();
      }
    }

    if (branchCompCode === currentCompCode) {
      const updated = branches.map((b) =>
        b.id === branchId ? { ...b, assignedUserIds: userIds, updatedAt: Date.now() } : b
      );
      setBranches(updated);
      await StorageService.saveBranches(updated);
    } else {
      const targetExisting = await StorageService.getBranchesForCompany(branchCompCode);
      const targetUpdated = targetExisting.map((b) =>
        b.id === branchId ? { ...b, assignedUserIds: userIds, updatedAt: Date.now() } : b
      );
      await StorageService.saveBranchesForCompany(branchCompCode, targetUpdated);
    }
    return { success: true, message: 'Personel şubeye atandı.' };
  };

  const addHeadquarter = async (params: {
    name: string;
    phone?: string;
    address?: string;
    contactPerson?: string;
    taxNumber?: string;
    notes?: string;
  }) => {
    if (!user) return { success: false, message: 'Oturum açılmadı.' };
    const trimmed = params.name.trim();
    if (!trimmed) return { success: false, message: 'Lütfen Merkez Firma adını girin.' };

    const newHq: HeadquarterCompany = {
      id: 'hq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      companyCode: user.companyCode || 'POLATLAR',
      name: trimmed,
      phone: params.phone?.trim() || undefined,
      address: params.address?.trim() || undefined,
      contactPerson: params.contactPerson?.trim() || undefined,
      taxNumber: params.taxNumber?.trim() || undefined,
      notes: params.notes?.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [...headquarters, newHq];
    setHeadquarters(updated);
    await StorageService.saveHeadquarters(updated);
    return { success: true, message: `"${trimmed}" merkez firması başarıyla eklendi.`, headquarter: newHq };
  };

  const deleteHeadquarter = async (id: string) => {
    if (headquarters.length <= 1) {
      return { success: false, message: 'En az bir merkez firma bulunmalıdır.' };
    }
    const updatedHqs = headquarters.filter((h) => h.id !== id);
    setHeadquarters(updatedHqs);
    await StorageService.saveHeadquarters(updatedHqs);

    // Eğer silinen firmaya bağlı şube varsa, ilk kalan firmaya aktar
    const fallbackHq = updatedHqs[0];
    const updatedBranches = branches.map((b) =>
      b.headquarterId === id
        ? { ...b, headquarterId: fallbackHq?.id, headquarterName: fallbackHq?.name }
        : b
    );
    setBranches(updatedBranches);
    await StorageService.saveBranches(updatedBranches);

    return { success: true, message: 'Merkez firma silindi.' };
  };

  const updateHeadquarter = async (id: string, updates: Partial<HeadquarterCompany>) => {
    const updatedHqs = headquarters.map((h) => (h.id === id ? { ...h, ...updates, updatedAt: Date.now() } : h));
    setHeadquarters(updatedHqs);
    await StorageService.saveHeadquarters(updatedHqs);

    if (updates.name) {
      const updatedBranches = branches.map((b) =>
        b.headquarterId === id ? { ...b, headquarterName: updates.name } : b
      );
      setBranches(updatedBranches);
      await StorageService.saveBranches(updatedBranches);
    }
    return { success: true, message: 'Merkez firma güncellendi.' };
  };

  const updateBranchHeadquarter = async (branchId: string, headquarterId: string, headquarterName: string) => {
    const updated = branches.map((b) =>
      b.id === branchId ? { ...b, headquarterId, headquarterName, updatedAt: Date.now() } : b
    );
    setBranches(updated);
    await StorageService.saveBranches(updated);
    return { success: true, message: 'Şubenin bağlı olduğu merkez firma güncellendi.' };
  };

  const updateWorkplaceLocation = async (loc: WorkplaceLocation) => {
    setWorkplaceLocation(loc);
    await StorageService.saveWorkplaceLocation(loc);
    return { success: true, message: 'İş yeri konumu başarıyla kaydedildi.' };
  };

  // 10. Timed Follow-ups
  const addTimedFollowUp = async (params: {
    cariName: string;
    description: string;
    dueDate: string;
    soundAlarm?: boolean;
    sendPush?: boolean;
  }) => {
    if (!params.cariName.trim() || !params.description.trim()) {
      return { success: false, message: 'Lütfen cari ve takip konusunu doldurun.' };
    }

    const newItemId = 'tfu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const companyCode = user?.companyCode || 'POLATLAR';
    let onesignalNotificationId: string | undefined = undefined;

    // Pre-schedule push notification via OneSignal cloud server
    // This wakes up locked phones and delivers notifications even if the app is killed!
    const targetDate = parseDueDateTime(params.dueDate);
    if (params.sendPush !== false && targetDate && targetDate.getTime() > Date.now()) {
      try {
        const notifId = await MobilePushService.scheduleTimedFollowUpPush({
          followUpId: newItemId,
          cariName: params.cariName.trim(),
          description: params.description.trim(),
          targetIsoDate: targetDate.toISOString(),
          companyCode,
        });
        if (notifId) {
          onesignalNotificationId = notifId;
        }
      } catch (err) {
        console.warn('Failed to pre-schedule push notification from mobile:', err);
      }
    }

    const newItem: TimedFollowUp = {
      id: newItemId,
      companyCode,
      cariName: params.cariName.trim(),
      description: params.description.trim(),
      dueDate: params.dueDate,
      status: 'pending',
      soundAlarm: params.soundAlarm !== false,
      sendPush: params.sendPush !== false,
      onesignalNotificationId,
      createdAt: Date.now(),
      createdBy: user?.id,
      createdByName: user?.name || user?.username || 'Yönetici',
    };
    const updated = [newItem, ...timedFollowUps];
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
    return { success: true, message: 'Süreli takip alarmı başarıyla kuruldu.' };
  };

  const updateTimedFollowUp = async (id: string, updates: Partial<TimedFollowUp>) => {
    const existingItem = timedFollowUps.find((item) => item.id === id);
    let newNotificationId = updates.onesignalNotificationId ?? existingItem?.onesignalNotificationId;

    if (updates.dueDate && updates.dueDate !== existingItem?.dueDate) {
      if (existingItem?.onesignalNotificationId) {
        MobilePushService.cancelScheduledPush(existingItem.onesignalNotificationId).catch(() => {});
        newNotificationId = undefined;
      }
      const targetDate = parseDueDateTime(updates.dueDate);
      if (
        (updates.sendPush !== false && existingItem?.sendPush !== false) &&
        targetDate &&
        targetDate.getTime() > Date.now()
      ) {
        try {
          const notifId = await MobilePushService.scheduleTimedFollowUpPush({
            followUpId: id,
            cariName: (updates.cariName || existingItem?.cariName || '').trim(),
            description: (updates.description || existingItem?.description || '').trim(),
            targetIsoDate: targetDate.toISOString(),
            companyCode: user?.companyCode || 'POLATLAR',
          });
          if (notifId) {
            newNotificationId = notifId;
          }
        } catch (err) {
          console.warn('Failed to update scheduled push from mobile:', err);
        }
      }
    }

    const updated = timedFollowUps.map((item) =>
      item.id === id ? { ...item, ...updates, onesignalNotificationId: newNotificationId } : item
    );
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
    return { success: true, message: 'Takip güncellendi.' };
  };

  const deleteTimedFollowUp = async (id: string) => {
    const itemToDelete = timedFollowUps.find((item) => item.id === id);
    if (itemToDelete?.onesignalNotificationId) {
      MobilePushService.cancelScheduledPush(itemToDelete.onesignalNotificationId).catch(() => {});
    }
    const updated = timedFollowUps.filter((item) => item.id !== id);
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
    return { success: true, message: 'Takip silindi.' };
  };

  const completeTimedFollowUp = async (id: string) => {
    const itemToComplete = timedFollowUps.find((item) => item.id === id);
    if (itemToComplete?.onesignalNotificationId) {
      MobilePushService.cancelScheduledPush(itemToComplete.onesignalNotificationId).catch(() => {});
    }
    const updated = timedFollowUps.map((item) =>
      item.id === id
        ? {
            ...item,
            status: 'completed' as const,
            completedAt: Date.now(),
            completedByName: user?.name || user?.username || 'Yönetici',
          }
        : item
    );
    setTimedFollowUps(updated);
    await StorageService.saveTimedFollowUps(updated);
    return { success: true, message: 'Takip tamamlandı olarak işaretlendi.' };
  };

  // 11. Admin Reminders
  const addAdminReminder = async (params: {
    title: string;
    content: string;
    category?: AdminReminderCategory;
    isPinned?: boolean;
    photos?: string[];
    sendPush?: boolean;
  }) => {
    if (!params.title.trim() || !params.content.trim()) {
      return { success: false, message: 'Lütfen başlık ve talimat metnini doldurun.' };
    }
    const newReminder: AdminReminder = {
      id: 'rem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: params.title.trim(),
      content: params.content.trim(),
      category: params.category || 'procedure',
      isPinned: params.isPinned || false,
      photos: params.photos || [],
      createdAt: Date.now(),
      createdBy: user?.id,
      createdByName: user?.name || user?.username || 'Murat POLAT',
      readBy: user?.id ? [user.id] : [],
    };
    const updated = [newReminder, ...adminReminders];
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);
    return { success: true, message: 'Talimat başarıyla yayınlandı.' };
  };

  const updateAdminReminder = async (id: string, updates: Partial<AdminReminder>) => {
    const updated = adminReminders.map((r) =>
      r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
    );
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);
    return { success: true, message: 'Talimat güncellendi.' };
  };

  const deleteAdminReminder = async (id: string) => {
    const updated = adminReminders.filter((r) => r.id !== id);
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);
    return { success: true, message: 'Talimat silindi.' };
  };

  const markReminderAsRead = async (id: string) => {
    if (!user?.id) return { success: false, message: 'Kullanıcı bulunamadı.' };
    const updated = adminReminders.map((r) => {
      if (r.id === id) {
        const readList = r.readBy || [];
        if (!readList.includes(user.id)) {
          return { ...r, readBy: [...readList, user.id] };
        }
      }
      return r;
    });
    setAdminReminders(updated);
    await StorageService.saveAdminReminders(updated);
    return { success: true, message: 'Okundu olarak işaretlendi.' };
  };

  // 12. Security Logs
  const deleteSecurityLog = async (id: string) => {
    const updated = securityLogs.filter((l) => l.id !== id);
    setSecurityLogs(updated);
    await StorageService.saveSecurityLogs(updated);
    return { success: true, message: 'Log kaydı silindi.' };
  };

  const clearAllSecurityLogs = async () => {
    setSecurityLogs([]);
    await StorageService.saveSecurityLogs([]);
    return { success: true, message: 'Tüm log kayıtları temizlendi.' };
  };

  const markSecurityLogsAsRead = async () => {
    const updated = securityLogs.map((l) => ({ ...l, read: true }));
    setSecurityLogs(updated);
    await StorageService.saveSecurityLogs(updated);
    return { success: true, message: 'Tüm loglar okundu sayıldı.' };
  };

  // 13. Standard Tasks (Şablon Yönetimi)
  const addStandardTask = async (task: string) => {
    if (!task.trim()) return { success: false, message: 'Görev açıklaması boş olamaz.' };
    const updated = [...standardTasks, task.trim()];
    setStandardTasks(updated);
    await StorageService.saveStandardTasks(updated);
    return { success: true, message: 'Şablon görevi eklendi.' };
  };

  const deleteStandardTask = async (index: number) => {
    const updated = standardTasks.filter((_, i) => i !== index);
    setStandardTasks(updated);
    await StorageService.saveStandardTasks(updated);
    return { success: true, message: 'Şablon görevi silindi.' };
  };

  const resetStandardTasks = async () => {
    const defaultTasks = await StorageService.resetStandardTasks();
    setStandardTasks(defaultTasks);
    return { success: true, message: 'Şablon görevleri varsayılana sıfırlandı.' };
  };

  const importCarilerFromExcelBuffer = async (buffer: ArrayBuffer, fileName?: string) => {
    try {
      const res = await StorageService.importCarilerFromExcel(buffer, fileName);
      setCariler(res.cariler);
      setCarilerUpdatedAt(res.updatedAt);
      setCarilerDatabase(res.database);
      return {
        success: true,
        total: res.total,
        message: `${res.total} adet cari başarıyla içe aktarıldı ve kaydedildi!`,
      };
    } catch (err: any) {
      return {
        success: false,
        total: 0,
        message: err?.message || 'Excel dosyası işlenirken hata oluştu.',
      };
    }
  };

  const exportCarilerToExcel = async (fileName = 'Cariler.xlsx') => {
    StorageService.exportCarilerToExcel(cariler, fileName);
  };

  return (
    <StorageContext.Provider
      value={{
        locations,
        services,
        returnWarrantyItems,
        attendanceRecords,
        leaveRequests,
        workplaceLocation,
        branches,
        headquarters,
        notes,
        timedFollowUps,
        adminReminders,
        securityLogs,
        standardTasks,
        cariler,
        carilerUpdatedAt,
        carilerDatabase,
        isLoading,
        refreshData: loadData,
        checkInStaff,
        checkOutStaff,
        approveAttendance,
        rejectAttendance,
        deleteAttendanceRecord,
        requestLeave,
        addService,
        deleteService,
        addLocation,
        completeLocation,
        deleteLocation,
        addReturnWarranty,
        addNote,
        deleteNote,
        updateNoteStatus,
        addBranch,
        updateBranch,
        deleteBranch,
        assignStaffToBranch,
        addHeadquarter,
        deleteHeadquarter,
        updateHeadquarter,
        updateBranchHeadquarter,
        updateWorkplaceLocation,
        addTimedFollowUp,
        updateTimedFollowUp,
        deleteTimedFollowUp,
        completeTimedFollowUp,
        addAdminReminder,
        updateAdminReminder,
        deleteAdminReminder,
        markReminderAsRead,
        deleteSecurityLog,
        clearAllSecurityLogs,
        markSecurityLogsAsRead,
        addStandardTask,
        deleteStandardTask,
        resetStandardTasks,
        importCarilerFromExcelBuffer,
        exportCarilerToExcel,
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
