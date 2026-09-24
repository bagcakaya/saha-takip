import React, { useEffect, useState, useMemo } from 'react';
import {
  Compass,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  Calendar,
  RefreshCw,
  Loader2,
  Shield,
  Trash2,
  AlertTriangle,
  Send,
  X,
  MessageSquare,
  CalendarPlus,
  FileText,
  Check,
  Store,
  FileSpreadsheet,
  FileDown,
  CalendarRange,
  Users,
  MapPinOff,
  ChevronDown,
  Coffee,
  Play,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../types/auth';
import { useStorage } from '../context/StorageContext';
import { AttendanceRecord, LeaveRequest } from '../types/storage';
import { LocationService } from '../services/locationService';
import {
  exportAttendanceToExcel,
  exportAttendanceToPdf,
  formatMinutesToDuration,
  calculateRecordDurationMinutes,
  calculateRecordBreakMinutes,
  calculateRecordNetWorkMinutes,
  StaffAttendanceSummary,
} from '../services/attendanceExportService';
import { StaffMultiSelect } from '../components/common/StaffMultiSelect';

export const StaffTrackingView: React.FC = () => {
  const { user, users, company } = useAuth();
  const {
    workplaceLocation,
    branches,
    attendanceRecords,
    updateWorkplaceLocation,
    checkInStaff,
    checkOutStaff,
    startBreak,
    endBreak,
    approveAttendance,
    rejectAttendance,
    cancelAttendanceRequest,
    deleteAttendanceRecord,
    leaveRequests,
    requestLeave,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    deleteLeaveRequest,
  } = useStorage();

  const isAdmin = isUserAdmin(user);

  // User's assigned branch
  const userAssignedBranch = useMemo(() => {
    if (!branches || branches.length === 0 || !user) return null;
    return branches.find(
      (b) =>
        (b.assignedUserIds && b.assignedUserIds.includes(user.id)) ||
        (user.branchId && b.id === user.branchId)
    );
  }, [branches, user]);

  // Target location for live distance calculation & geofence UI
  const targetLocation = useMemo(() => {
    if (userAssignedBranch) {
      return {
        name: userAssignedBranch.name,
        address: userAssignedBranch.address,
        latitude: userAssignedBranch.latitude,
        longitude: userAssignedBranch.longitude,
        radius: userAssignedBranch.radiusMeters || 20,
        isBranch: true,
      };
    }
    if (workplaceLocation?.latitude && workplaceLocation?.longitude) {
      return {
        name: 'Merkez İş Yeri',
        address: workplaceLocation.address,
        latitude: workplaceLocation.latitude,
        longitude: workplaceLocation.longitude,
        radius:
          workplaceLocation.radiusMeters && workplaceLocation.radiusMeters !== 10
            ? workplaceLocation.radiusMeters
            : 20,
        isBranch: false,
      };
    }
    if (branches && branches.length > 0) {
      return {
        name: branches[0].name,
        address: branches[0].address,
        latitude: branches[0].latitude,
        longitude: branches[0].longitude,
        radius: branches[0].radiusMeters || 20,
        isBranch: true,
      };
    }
    return null;
  }, [userAssignedBranch, workplaceLocation, branches]);

  const allowedRadius = targetLocation?.radius || 20;

  // --- 1. Admin Workplace Location State ---
  const [addressText, setAddressText] = useState(workplaceLocation?.address || '');
  const [lat, setLat] = useState<number | undefined>(workplaceLocation?.latitude);
  const [lon, setLon] = useState<number | undefined>(workplaceLocation?.longitude);
  const [radius, setRadius] = useState<number>(
    workplaceLocation?.radiusMeters && workplaceLocation.radiusMeters !== 10
      ? workplaceLocation.radiusMeters
      : 20
  );
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');

  // Keep synced if workplaceLocation loads later
  useEffect(() => {
    if (workplaceLocation) {
      setAddressText(workplaceLocation.address || '');
      setLat(workplaceLocation.latitude);
      setLon(workplaceLocation.longitude);
      setRadius(
        workplaceLocation.radiusMeters && workplaceLocation.radiusMeters !== 10
          ? workplaceLocation.radiusMeters
          : 20
      );
    }
  }, [workplaceLocation]);

  // Handle Admin GPS Acquisition (Görsel-1 UI)
  const handleGetWorkplaceGPS = async () => {
    try {
      setIsFetchingLocation(true);
      const pos = await LocationService.getCurrentPosition();
      setLat(pos.latitude);
      setLon(pos.longitude);
      if (pos.address) {
        setAddressText(pos.address);
      }
    } catch (err: any) {
      alert(err?.message || 'GPS konumu alınamadı.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Handle Admin Save Workplace Location
  const handleSaveWorkplaceLocation = async () => {
    if (!lat || !lon) {
      alert('Lütfen önce GPS ikonuna tıklayarak veya haritadan iş yeri koordinatlarını belirleyin.');
      return;
    }
    try {
      setIsSavingLocation(true);
      await updateWorkplaceLocation(addressText, lat, lon, radius);
      setLocationSuccessMsg('İş yeri lokasyonu başarıyla kaydedildi!');
      setTimeout(() => setLocationSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('Lokasyon kaydedilirken bir hata oluştu.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Open in Google Maps
  const handleOpenGoogleMaps = () => {
    LocationService.openInGoogleMaps(addressText, lat, lon);
  };

  // --- 2. Live Distance Checker ---
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [isCheckingDistance, setIsCheckingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  const [isLocationDisabled, setIsLocationDisabled] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState('');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const checkLiveDistance = async (showSuccessFeedback = false) => {
    if (!targetLocation?.latitude || !targetLocation?.longitude) {
      setDistanceError('İş yeri veya şube lokasyonu henüz belirlenmemiş.');
      return;
    }
    try {
      setIsCheckingDistance(true);
      setDistanceError('');
      const pos = await LocationService.getCurrentPosition();
      const dist = LocationService.calculateDistance(
        pos.latitude,
        pos.longitude,
        targetLocation.latitude,
        targetLocation.longitude
      );
      setCurrentDistance(dist);
      setIsLocationDisabled(false);
      setLocationErrorMessage('');
      setIsLocationModalOpen(false);
      if (showSuccessFeedback) {
        setActionFeedback({
          type: 'success',
          text: 'Konum servisleri başarıyla açıldı ve doğrulandı! Şimdi işe giriş veya çıkış yapabilirsiniz.',
          distance: dist,
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Cihazınızın konum servisleri (GPS) kapalı veya ulaşılamıyor.';
      setDistanceError(msg);
      setIsLocationDisabled(true);
      setLocationErrorMessage(msg);
      setCurrentDistance(null);
    } finally {
      setIsCheckingDistance(false);
    }
  };

  useEffect(() => {
    if (targetLocation?.latitude && targetLocation?.longitude) {
      checkLiveDistance();
    }
  }, [targetLocation]);

  // --- 3. Check-in / Check-out Actions & Approval Flow ---
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    distance?: number;
  } | null>(null);

  // Confirmation modal state for out-of-location checkin/checkout
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'checkin' | 'checkout';
    distance?: number;
    address?: string;
    note: string;
  }>({
    isOpen: false,
    type: 'checkin',
    note: '',
  });

  // State to confirm accidental click on "İşten Çıkış Yaptım"
  const [showCheckOutConfirmModal, setShowCheckOutConfirmModal] = useState(false);

  const handleCheckIn = async (allowOutside = false, customNote?: string) => {
    // If location is disabled, block check-in and display informative modal
    if (isLocationDisabled) {
      setIsLocationModalOpen(true);
      return;
    }

    try {
      setIsProcessingAction(true);
      setActionFeedback(null);
      const res = await checkInStaff({ allowOutside, note: customNote });

      if (res.isLocationDisabled) {
        setIsLocationDisabled(true);
        setLocationErrorMessage(res.message);
        setCurrentDistance(null);
        setIsLocationModalOpen(true);
        return;
      }

      if (res.requiresConfirmation) {
        setConfirmModal({
          isOpen: true,
          type: 'checkin',
          distance: res.distance,
          address: res.address,
          note: '',
        });
        if (res.distance !== undefined) setCurrentDistance(res.distance);
        return;
      }

      if (res.success) {
        setActionFeedback({ type: 'success', text: res.message, distance: res.distance });
        if (res.distance !== undefined) setCurrentDistance(res.distance);
        setConfirmModal((prev) => ({ ...prev, isOpen: false, note: '' }));
      } else {
        setActionFeedback({ type: 'error', text: res.message, distance: res.distance });
        if (res.distance !== undefined) setCurrentDistance(res.distance);
      }
    } catch (e: any) {
      if (e?.isLocationDisabled || e?.message?.toLowerCase().includes('konum')) {
        setIsLocationDisabled(true);
        setLocationErrorMessage(e?.message || 'Konum servisleri kapalı.');
        setIsLocationModalOpen(true);
      } else {
        setActionFeedback({ type: 'error', text: e?.message || 'İşlem gerçekleştirilemedi.' });
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCheckOut = async (allowOutside = false, customNote?: string) => {
    // If location is disabled, block check-out and display informative modal
    if (isLocationDisabled) {
      setIsLocationModalOpen(true);
      return;
    }

    try {
      setIsProcessingAction(true);
      setActionFeedback(null);
      const res = await checkOutStaff({ allowOutside, note: customNote });

      if (res.isLocationDisabled) {
        setIsLocationDisabled(true);
        setLocationErrorMessage(res.message);
        setCurrentDistance(null);
        setIsLocationModalOpen(true);
        return;
      }

      if (res.requiresConfirmation) {
        setConfirmModal({
          isOpen: true,
          type: 'checkout',
          distance: res.distance,
          address: res.address,
          note: '',
        });
        if (res.distance !== undefined) setCurrentDistance(res.distance);
        return;
      }

      if (res.success) {
        setActionFeedback({ type: 'success', text: res.message, distance: res.distance });
        if (res.distance !== undefined) setCurrentDistance(res.distance);
        setConfirmModal((prev) => ({ ...prev, isOpen: false, note: '' }));
      } else {
        setActionFeedback({ type: 'error', text: res.message, distance: res.distance });
        if (res.distance !== undefined) setCurrentDistance(res.distance);
      }
    } catch (e: any) {
      if (e?.isLocationDisabled || e?.message?.toLowerCase().includes('konum')) {
        setIsLocationDisabled(true);
        setLocationErrorMessage(e?.message || 'Konum servisleri kapalı.');
        setIsLocationModalOpen(true);
      } else {
        setActionFeedback({ type: 'error', text: e?.message || 'İşlem gerçekleştirilemedi.' });
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (confirmModal.type === 'checkin') {
      await handleCheckIn(true, confirmModal.note);
    } else {
      await handleCheckOut(true, confirmModal.note);
    }
  };

  const handleApprove = async (recordId: string, type: 'checkin' | 'checkout') => {
    try {
      setProcessingApprovalId(recordId);
      const res = await approveAttendance(recordId, type);
      if (res.success) {
        setActionFeedback({ type: 'success', text: res.message });
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e?.message || 'Onaylama sırasında hata oluştu.');
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleReject = async (recordId: string, type: 'checkin' | 'checkout') => {
    const reason = window.prompt('Reddetme gerekçesi (İsteğe bağlı):');
    if (reason === null) return; // User pressed Cancel
    try {
      setProcessingApprovalId(recordId);
      const res = await rejectAttendance(recordId, type, reason);
      if (res.success) {
        setActionFeedback({ type: 'success', text: res.message });
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e?.message || 'Reddetme sırasında hata oluştu.');
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleCancelMyRequest = async (recordId: string) => {
    if (!window.confirm('Bekleyen onay talebinizi iptal etmek istediğinizden emin misiniz?')) return;
    try {
      setIsProcessingAction(true);
      const res = await cancelAttendanceRequest(recordId);
      setActionFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (e: any) {
      setActionFeedback({ type: 'error', text: e?.message || 'İptal edilemedi.' });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // --- 4. Today's Status for Current User & Pending Approvals ---
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Most recent attendance record for current user today
  const currentUserTodayRecord = useMemo(() => {
    if (!user) return null;
    return attendanceRecords.find(
      (r) => r.userId === user.id && r.date === todayStr
    );
  }, [attendanceRecords, user, todayStr]);

  const isCheckedIn = currentUserTodayRecord?.status === 'checked_in';
  const isCompletedToday = currentUserTodayRecord?.status === 'completed';
  const isPendingCheckIn = currentUserTodayRecord?.status === 'pending_checkin_approval';
  const isPendingCheckOut = currentUserTodayRecord?.status === 'pending_checkout_approval';
  const isOnBreak = !!currentUserTodayRecord?.isOnBreak;

  // Current active company code (e.g. 'POLATLAR', 'BURAKDEV')
  const currentCompanyCode = useMemo(() => {
    return (user?.companyCode || company?.code || 'POLATLAR').trim().toUpperCase();
  }, [user?.companyCode, company?.code]);

  // Users strictly belonging to the current company only
  const companyUsers = useMemo(() => {
    if (!users || users.length === 0) return [];
    return users.filter(
      (u) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === currentCompanyCode
    );
  }, [users, currentCompanyCode]);

  const companyUserIds = useMemo(() => {
    return new Set(companyUsers.map((u) => u.id));
  }, [companyUsers]);

  // Admin: All pending approval requests (for current company only)
  const pendingRequests = useMemo(() => {
    return attendanceRecords.filter((r) => {
      const isPending = r.status === 'pending_checkin_approval' || r.status === 'pending_checkout_approval';
      if (!isPending) return false;
      if (companyUserIds.size > 0 && !companyUserIds.has(r.userId)) return false;
      return true;
    });
  }, [attendanceRecords, companyUserIds]);

  // --- 5. Date Range & Staff Filters for Table & Analytics ---
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<
    'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'all' | 'custom'
  >('today');

  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [breakAdminDate, setBreakAdminDate] = useState<string>(todayStr);

  // Quick Date Preset Handler
  const applyPreset = (
    preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'all'
  ) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setStartDate(`${year}-${month}-01`);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      setStartDate(`${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-01`);
      setEndDate(`${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Staff options for filter dropdown (strictly for current company)
  const staffOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();
    companyUsers.forEach((u) => {
      map.set(u.id, { id: u.id, name: u.name || u.username, role: u.role });
    });
    attendanceRecords.forEach((r) => {
      if (companyUserIds.size === 0 || companyUserIds.has(r.userId)) {
        if (!map.has(r.userId)) {
          map.set(r.userId, { id: r.userId, name: r.userName, role: r.userRole });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [companyUsers, companyUserIds, attendanceRecords]);

// Helper to generate all dates between startDate and endDate (inclusive)
const getDatesInRange = (startDateStr: string, endDateStr?: string): string[] => {
  if (!endDateStr || endDateStr === startDateStr) {
    return [startDateStr];
  }
  const dates: string[] = [];
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [startDateStr];

  const curr = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  let safety = 0;
  while (curr <= end && safety < 90) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
    safety++;
  }
  return dates.length > 0 ? dates : [startDateStr];
};

  // Filtered records based on company, date range, selected staff, user role, and approved leaves
  const filteredRecords = useMemo(() => {
    let list: AttendanceRecord[] = [...attendanceRecords];

    // Find all approved leave requests
    const approvedLeaves = leaveRequests.filter((l) => l.status === 'approved');

    // Map: key `${userId}_${date}` -> LeaveRequest
    const userLeaveMap = new Map<string, LeaveRequest>();
    approvedLeaves.forEach((leave) => {
      const dates = getDatesInRange(leave.date, leave.endDate);
      dates.forEach((d) => {
        userLeaveMap.set(`${leave.userId}_${d}`, leave);
      });
    });

    const processedLeaveKeys = new Set<string>();
    const updatedList: AttendanceRecord[] = [];

    // 1. Process existing attendance records
    list.forEach((record) => {
      const leaveKey = `${record.userId}_${record.date}`;
      const matchingLeave = userLeaveMap.get(leaveKey);

      if (matchingLeave) {
        // If there's an approved leave for this user on this date:
        // Deduplicate: only keep ONE record for this user on this leave date
        if (!processedLeaveKeys.has(leaveKey)) {
          processedLeaveKeys.add(leaveKey);
          updatedList.push({
            ...record,
            status: 'on_leave',
            checkInTime: 0,
            checkOutTime: undefined,
            checkInDistance: undefined,
            checkOutDistance: undefined,
            workDurationMinutes: 0,
            notes: 'İzinli',
            approvalNote: matchingLeave.reason || record.approvalNote,
          });
        }
      } else {
        updatedList.push(record);
      }
    });

    // 2. Synthesize on_leave records for approved leaves where staff didn't clock in
    userLeaveMap.forEach((leave, leaveKey) => {
      if (!processedLeaveKeys.has(leaveKey)) {
        processedLeaveKeys.add(leaveKey);
        const [userId, dateStr] = leaveKey.split('_');
        const targetUser = companyUsers.find((u) => u.id === userId);
        const userRole = leave.userRole || targetUser?.role || 'staff';
        const branchName = targetUser?.branchName || 'Merkez';

        updatedList.push({
          id: `leave_${leave.id}_${dateStr}`,
          userId,
          userName: leave.userName,
          userRole,
          date: dateStr,
          checkInTime: 0,
          status: 'on_leave',
          branchName,
          notes: 'İzinli',
          approvalNote: leave.reason,
        });
      }
    });

    list = updatedList;

    if (companyUserIds.size > 0) {
      list = list.filter((r) => companyUserIds.has(r.userId));
    }
    if (startDate) {
      list = list.filter((r) => r.date >= startDate);
    }
    if (endDate) {
      list = list.filter((r) => r.date <= endDate);
    }
    if (selectedStaffIds.length > 0) {
      list = list.filter((r) => selectedStaffIds.includes(r.userId));
    }
    // If not admin, only show own records
    if (!isAdmin && user) {
      list = list.filter((r) => r.userId === user.id);
    }

    const getApprovalSortScore = (r: AttendanceRecord) => {
      const isPending =
        r.status === 'pending_checkout_approval' ||
        r.status === 'pending_checkin_approval' ||
        (r.checkOutOutside && r.checkOutApprovalStatus === 'pending') ||
        (r.checkInOutside && r.checkInApprovalStatus === 'pending');

      let approvedAt = 0;
      if (r.checkOutApprovalStatus === 'approved') {
        approvedAt = Math.max(approvedAt, r.checkOutApprovedAt || r.checkOutTime || r.checkInTime || 1);
      }
      if (r.checkInApprovalStatus === 'approved') {
        approvedAt = Math.max(approvedAt, r.checkInApprovedAt || r.checkInTime || 1);
      }

      return { isPending, approvedAt };
    };

    list.sort((a, b) => {
      const scoreA = getApprovalSortScore(a);
      const scoreB = getApprovalSortScore(b);

      // 1. Bekleyen onaylar en başta (yönetici işlem yapsın)
      if (scoreA.isPending && !scoreB.isPending) return -1;
      if (!scoreA.isPending && scoreB.isPending) return 1;
      if (scoreA.isPending && scoreB.isPending) {
        return (b.checkOutTime || b.checkInTime || 0) - (a.checkOutTime || a.checkInTime || 0);
      }

      // 2. Yönetici tarafından onaylananlar en üstte (en son onaylanan en başta)
      if (scoreA.approvedAt > 0 && scoreB.approvedAt > 0) {
        return scoreB.approvedAt - scoreA.approvedAt;
      }
      if (scoreA.approvedAt > 0 && scoreB.approvedAt === 0) return -1;
      if (scoreA.approvedAt === 0 && scoreB.approvedAt > 0) return 1;

      // 3. Normal kayıtlar: Tarihe göre azalan, ardından giriş saatine göre azalan
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.checkInTime || 0) - (a.checkInTime || 0);
    });

    return list;
  }, [attendanceRecords, leaveRequests, companyUsers, companyUserIds, startDate, endDate, selectedStaffIds, isAdmin, user]);

  // Staff Attendance Summaries (for the selected date range, strictly current company)
  const staffSummaries = useMemo<StaffAttendanceSummary[]>(() => {
    let rangeRecords = attendanceRecords;
    if (companyUserIds.size > 0) {
      rangeRecords = rangeRecords.filter((r) => companyUserIds.has(r.userId));
    }
    if (startDate) {
      rangeRecords = rangeRecords.filter((r) => r.date >= startDate);
    }
    if (endDate) {
      rangeRecords = rangeRecords.filter((r) => r.date <= endDate);
    }
    if (!isAdmin && user) {
      rangeRecords = rangeRecords.filter((r) => r.userId === user.id);
    }

    const staffMap = new Map<
      string,
      {
        userName: string;
        userRole?: string;
        branchName?: string;
        uniqueDates: Set<string>;
        totalMinutes: number;
        completed: number;
        active: number;
        pending: number;
        totalBreakMinutes: number;
        totalNetMinutes: number;
      }
    >();

    rangeRecords.forEach((r) => {
      if (r.status === 'on_leave') return;
      if (!staffMap.has(r.userId)) {
        staffMap.set(r.userId, {
          userName: r.userName,
          userRole: r.userRole,
          branchName: r.branchName,
          uniqueDates: new Set(),
          totalMinutes: 0,
          totalBreakMinutes: 0,
          totalNetMinutes: 0,
          completed: 0,
          active: 0,
          pending: 0,
        });
      }
      const entry = staffMap.get(r.userId)!;
      entry.uniqueDates.add(r.date);
      const min = calculateRecordDurationMinutes(r);
      const brkMin = calculateRecordBreakMinutes(r);
      const netMin = Math.max(0, min - brkMin);
      entry.totalMinutes += min;
      entry.totalBreakMinutes = (entry.totalBreakMinutes || 0) + brkMin;
      entry.totalNetMinutes = (entry.totalNetMinutes || 0) + netMin;
      if (r.status === 'completed') entry.completed++;
      else if (r.status === 'checked_in') entry.active++;
      else if (r.status.startsWith('pending_')) entry.pending++;
    });

    // Also include company staff from current company only if admin
    if (isAdmin && companyUsers.length > 0) {
      companyUsers.forEach((u) => {
        if (!staffMap.has(u.id)) {
          staffMap.set(u.id, {
            userName: u.name || u.username,
            userRole: u.role,
            branchName: u.branchName,
            uniqueDates: new Set(),
            totalMinutes: 0,
            totalBreakMinutes: 0,
            totalNetMinutes: 0,
            completed: 0,
            active: 0,
            pending: 0,
          });
        }
      });
    }

    const summaries: StaffAttendanceSummary[] = [];
    staffMap.forEach((entry, uid) => {
      const days = entry.uniqueDates.size;
      const avgMin = days > 0 ? Math.round(entry.totalMinutes / days) : 0;
      const brkMin = entry.totalBreakMinutes || 0;
      const netMin = entry.totalNetMinutes ?? Math.max(0, entry.totalMinutes - brkMin);

      summaries.push({
        userId: uid,
        userName: entry.userName,
        userRole: entry.userRole,
        branchName: entry.branchName,
        totalDays: days,
        totalMinutes: entry.totalMinutes,
        totalDurationFormatted: formatMinutesToDuration(entry.totalMinutes),
        totalBreakMinutes: brkMin,
        totalBreakFormatted: formatMinutesToDuration(brkMin),
        totalNetMinutes: netMin,
        totalNetFormatted: formatMinutesToDuration(netMin),
        averageMinutesPerDay: avgMin,
        averageDurationFormatted: formatMinutesToDuration(avgMin),
        completedSessions: entry.completed,
        activeSessions: entry.active,
        pendingSessions: entry.pending,
      });
    });

    summaries.sort((a, b) => b.totalMinutes - a.totalMinutes || a.userName.localeCompare(b.userName));
    return summaries;
  }, [attendanceRecords, companyUserIds, companyUsers, startDate, endDate, isAdmin, user]);

  // Aggregated stats for the filtered records
  const stats = useMemo(() => {
    const totalMinutes = filteredRecords.reduce((acc, r) => acc + calculateRecordDurationMinutes(r), 0);
    const totalBreakMinutes = filteredRecords.reduce((acc, r) => acc + calculateRecordBreakMinutes(r), 0);
    const totalNetMinutes = Math.max(0, totalMinutes - totalBreakMinutes);
    const onBreakCount = filteredRecords.filter((r) => r.isOnBreak && r.status === 'checked_in').length;

    const uniqueDays = new Set(filteredRecords.map((r) => r.date)).size;
    const active = filteredRecords.filter((r) => r.status === 'checked_in').length;
    const completed = filteredRecords.filter((r) => r.status === 'completed').length;
    const pending = filteredRecords.filter((r) => r.status.startsWith('pending_')).length;
    const distinctStaff = new Set(filteredRecords.map((r) => r.userId)).size;

    return {
      total: filteredRecords.length,
      totalMinutes,
      totalDurationFormatted: formatMinutesToDuration(totalMinutes),
      totalBreakMinutes,
      totalBreakFormatted: formatMinutesToDuration(totalBreakMinutes),
      totalNetMinutes,
      netWorkFormatted: formatMinutesToDuration(totalNetMinutes),
      onBreakCount,
      uniqueDays,
      active,
      completed,
      pending,
      distinctStaff,
      avgMinutesPerDay: uniqueDays > 0 ? Math.round(totalMinutes / uniqueDays) : 0,
      avgDurationPerDayFormatted: formatMinutesToDuration(
        uniqueDays > 0 ? Math.round(totalMinutes / uniqueDays) : 0
      ),
    };
  }, [filteredRecords]);

  // Excel export handler
  const handleExportExcel = () => {
    try {
      setIsExportingExcel(true);
      const compName = company?.name || user?.companyName || user?.companyCode || 'Firma';
      const exportSummaries =
        selectedStaffIds.length > 0
          ? staffSummaries.filter((s) => selectedStaffIds.includes(s.userId))
          : staffSummaries;
      exportAttendanceToExcel({
        records: filteredRecords,
        summaries: exportSummaries,
        startDate,
        endDate,
        companyName: compName,
      });
    } catch (err: any) {
      alert('Excel dosyası oluşturulurken bir hata oluştu: ' + (err?.message || err));
    } finally {
      setIsExportingExcel(false);
    }
  };

  // PDF export handler
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const compName = company?.name || user?.companyName || user?.companyCode || 'Firma';
      const exportSummaries =
        selectedStaffIds.length > 0
          ? staffSummaries.filter((s) => selectedStaffIds.includes(s.userId))
          : staffSummaries;
      await exportAttendanceToPdf({
        records: filteredRecords,
        summaries: exportSummaries,
        startDate,
        endDate,
        companyName: compName,
      });
    } catch (err: any) {
      alert('PDF raporu oluşturulurken bir hata oluştu: ' + (err?.message || err));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Calculate live work duration for active check-in
  const [activeDurationText, setActiveDurationText] = useState('');
  useEffect(() => {
    if (!isCheckedIn || !currentUserTodayRecord?.checkInTime) {
      setActiveDurationText('');
      return;
    }

    const updateDuration = () => {
      const diffMs = Date.now() - currentUserTodayRecord.checkInTime;
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setActiveDurationText(hours > 0 ? (hours + ' sa ' + mins + ' dk') : (mins + ' dk'));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 30000);
    return () => clearInterval(interval);
  }, [isCheckedIn, currentUserTodayRecord]);

  // Break state & live stopwatch timer (1-second tick)
  const [liveBreakTimerText, setLiveBreakTimerText] = useState('');
  const [isProcessingBreak, setIsProcessingBreak] = useState(false);
  const [expandedBreakRecordIds, setExpandedBreakRecordIds] = useState<Set<string>>(new Set());

  const toggleRecordBreakAccordion = (recordId: string) => {
    setExpandedBreakRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isOnBreak || !currentUserTodayRecord?.currentBreakStartTime) {
      setLiveBreakTimerText('');
      return;
    }

    const updateBreakTimer = () => {
      const start = currentUserTodayRecord.currentBreakStartTime || Date.now();
      const diffMs = Math.max(0, Date.now() - start);
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const remSecs = totalSecs % 3600;
      const mins = Math.floor(remSecs / 60);
      const secs = remSecs % 60;

      if (hours > 0) {
        setLiveBreakTimerText(`${hours} sa ${mins.toString().padStart(2, '0')} dk ${secs.toString().padStart(2, '0')} sn`);
      } else {
        setLiveBreakTimerText(`${mins.toString().padStart(2, '0')} dk ${secs.toString().padStart(2, '0')} sn`);
      }
    };

    updateBreakTimer();
    const interval = setInterval(updateBreakTimer, 1000);
    return () => clearInterval(interval);
  }, [isOnBreak, currentUserTodayRecord?.currentBreakStartTime]);

  const handleStartBreak = async () => {
    if (isProcessingBreak) return;
    setIsProcessingBreak(true);
    try {
      const res = await startBreak();
      if (!res.success) {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Mola başlatılırken bir hata oluştu: ' + (err?.message || err));
    } finally {
      setIsProcessingBreak(false);
    }
  };

  const handleEndBreak = async () => {
    if (isProcessingBreak) return;
    setIsProcessingBreak(true);
    try {
      const res = await endBreak();
      if (!res.success) {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Mola sonlandırılırken bir hata oluştu: ' + (err?.message || err));
    } finally {
      setIsProcessingBreak(false);
    }
  };

  // Ana Menü stili 5 alt bölüm yönetimi (Varsayılan olarak URL veya 'menu' başlar)
  type ActiveSection = 'menu' | 'checkin_checkout' | 'breaks' | 'summary' | 'leaves' | 'workplace';
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const sec = params.get('section');
        if (sec && ['checkin_checkout', 'breaks', 'summary', 'leaves', 'workplace'].includes(sec)) {
          return sec as ActiveSection;
        }
      } catch {}
    }
    return 'menu';
  });

  const SECTION_INFO_WEB: Record<string, { title: string; subtitle: string; icon: any; color: string; bg: string }> = {
    checkin_checkout: {
      title: 'İşe Giriş & Çıkış',
      subtitle: 'GPS doğrulaması ile anlık işe geliş ve çıkış kayıtları',
      icon: UserCheck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/15',
    },
    breaks: {
      title: 'Mola Yönetimi',
      subtitle: 'Canlı mola sayacı ve günlük mola takibi',
      icon: Coffee,
      color: 'text-amber-500',
      bg: 'bg-amber-500/15',
    },
    summary: {
      title: 'Mesai Özeti & Tablo',
      subtitle: 'Çalışma geçmişi, dönem filtreleri ve raporlar',
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-500/15',
    },
    leaves: {
      title: 'İzin Takibi',
      subtitle: 'Saatlik ve günlük izin talepleri ve yönetici onayları',
      icon: CalendarRange,
      color: 'text-purple-500',
      bg: 'bg-purple-500/15',
    },
    workplace: {
      title: 'Merkez İş Yeri Lokasyonu',
      subtitle: '20 metre toleranslı merkez GPS koordinatları',
      icon: Store,
      color: 'text-teal-500',
      bg: 'bg-teal-500/15',
    },
  };
  const [isStaffSummaryOpen, setIsStaffSummaryOpen] = useState(false);

  const navigateToSection = (section: ActiveSection) => {
    setActiveSection(section);
    if (typeof window !== 'undefined' && section !== 'menu') {
      try {
        window.history.pushState(
          { tab: 'staff_tracking', staffSection: section },
          '',
          `?tab=staff_tracking&section=${section}`
        );
      } catch {}
    }
  };

  const handleBackToSectionMenu = () => {
    if (typeof window !== 'undefined' && window.history.state?.staffSection) {
      window.history.back();
    } else {
      setActiveSection('menu');
    }
  };

  useEffect(() => {
    const handleSetSubTab = (e: any) => {
      if (e?.detail?.subTab === 'leaves' || e?.detail?.filter === 'leaves') {
        navigateToSection('leaves');
      } else if (e?.detail?.subTab === 'attendance' || e?.detail?.filter === 'attendance') {
        navigateToSection('checkin_checkout');
      }
    };
    window.addEventListener('saha:set-staff-subtab' as any, handleSetSubTab);
    return () => window.removeEventListener('saha:set-staff-subtab' as any, handleSetSubTab);
  }, []);

  // Android Geri Tuşu (Browser popstate) Desteği
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const section = e.state?.staffSection;
      if (section && ['checkin_checkout', 'breaks', 'summary', 'leaves', 'workplace'].includes(section)) {
        setActiveSection(section);
      } else {
        // If not in a sub-section state, return to staff tracking menu
        setActiveSection('menu');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // iOS ve Mobil Cihazlar için Sağa Kaydırma (Swipe Right) Desteği
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const timeDiff = Date.now() - touchStartTime;

        // Sağa kaydırma: yatay hareket 50px'den büyük ve dikey hareketten en az 1.4 kat fazla
        if (deltaX > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4 && timeDiff < 650) {
          if (activeSection !== 'menu') {
            handleBackToSectionMenu();
          } else {
            // Ana Menüye dön
            if (typeof window !== 'undefined' && window.history.length > 1 && !window.history.state?.isRoot) {
              window.history.back();
            } else {
              window.dispatchEvent(new CustomEvent('saha:navigate', { detail: { tab: 'home' } }));
            }
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeSection]);

  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<'hourly' | 'daily'>('hourly');
  const [leaveDate, setLeaveDate] = useState<string>(todayStr);
  const [leaveEndDate, setLeaveEndDate] = useState<string>(todayStr);
  const [leaveStartTime, setLeaveStartTime] = useState<string>('13:00');
  const [leaveEndTime, setLeaveEndTime] = useState<string>('15:00');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);

  // Auto calculate duration text
  const calculatedDuration = useMemo(() => {
    if (leaveType === 'hourly') {
      if (!leaveStartTime || !leaveEndTime) return '1 Saat';
      const [sh, sm] = leaveStartTime.split(':').map(Number);
      const [eh, em] = leaveEndTime.split(':').map(Number);
      const diffMinutes = eh * 60 + em - (sh * 60 + sm);
      if (diffMinutes <= 0) return '1 Saat';
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      if (hours > 0 && mins > 0) return `${hours} Saat ${mins} Dk`;
      if (hours > 0) return `${hours} Saat`;
      return `${mins} Dk`;
    } else {
      if (!leaveDate) return '1 Gün';
      if (!leaveEndDate || leaveEndDate === leaveDate) return '1 Gün';
      const start = new Date(leaveDate).getTime();
      const end = new Date(leaveEndDate).getTime();
      const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
      return `${diffDays} Gün`;
    }
  }, [leaveType, leaveStartTime, leaveEndTime, leaveDate, leaveEndDate]);

  const handleOpenLeaveModal = () => {
    setLeaveDate(todayStr);
    setLeaveEndDate(todayStr);
    setLeaveStartTime('13:00');
    setLeaveEndTime('15:00');
    setLeaveReason('');
    setIsLeaveModalOpen(true);
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      alert('Lütfen izin alma nedeninizi kısaca belirtin.');
      return;
    }
    try {
      setIsSubmittingLeave(true);
      const res = await requestLeave({
        leaveType,
        date: leaveDate,
        endDate: leaveType === 'daily' ? leaveEndDate : undefined,
        startTime: leaveType === 'hourly' ? leaveStartTime : undefined,
        endTime: leaveType === 'hourly' ? leaveEndTime : undefined,
        durationText: calculatedDuration,
        reason: leaveReason.trim(),
      });

      if (res.success) {
        setIsLeaveModalOpen(false);
        setActionFeedback({ type: 'success', text: res.message });
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err?.message || 'İzin talebi gönderilemedi.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleApproveLeave = async (requestId: string) => {
    try {
      setProcessingLeaveId(requestId);
      const res = await approveLeaveRequest(requestId);
      if (res.success) {
        setActionFeedback({ type: 'success', text: res.message });
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err?.message || 'Onaylama hatası');
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleRejectLeave = async (requestId: string) => {
    const reason = window.prompt('Reddetme gerekçesi (İsteğe bağlı):');
    if (reason === null) return;
    try {
      setProcessingLeaveId(requestId);
      const res = await rejectLeaveRequest(requestId, reason);
      if (res.success) {
        setActionFeedback({ type: 'success', text: res.message });
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err?.message || 'Ret işlemi hatası');
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleCancelMyLeave = async (requestId: string) => {
    if (!window.confirm('Bu izin talebinizi iptal etmek istediğinize emin misiniz?')) return;
    try {
      setProcessingLeaveId(requestId);
      const res = await cancelLeaveRequest(requestId);
      if (res.success) {
        setActionFeedback({ type: 'success', text: res.message });
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err?.message || 'İptal hatası');
    } finally {
      setProcessingLeaveId(null);
    }
  };

  // Leave requests filtered for display
  const userLeaveRequests = useMemo(() => {
    let list = leaveRequests;
    if (!isAdmin && user) {
      list = list.filter((r) => r.userId === user.id);
    }
    if (leaveStatusFilter !== 'all') {
      list = list.filter((r) => r.status === leaveStatusFilter);
    }
    return list;
  }, [leaveRequests, isAdmin, user, leaveStatusFilter]);

  const pendingLeaveCount = useMemo(() => {
    if (isAdmin) {
      return leaveRequests.filter((r) => r.status === 'pending').length;
    }
    return leaveRequests.filter((r) => r.userId === user?.id && r.status === 'pending').length;
  }, [leaveRequests, isAdmin, user]);

  // Canlı moladaki personeller (Yönetici için)
  const activeStaffOnBreak = useMemo(() => {
    return attendanceRecords.filter((r) => r.date === todayStr && r.isOnBreak && r.status === 'checked_in');
  }, [attendanceRecords, todayStr]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ============================================================ */}
      {/* 2. ANA MENÜ STİLİ LAUNCHER BUTONLARI (activeSection === 'menu') */}
      {/* ============================================================ */}
      {activeSection === 'menu' && (
        <div className="pt-4 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-y-8 gap-x-4 sm:gap-6 py-6">
            {[
              {
                id: 'checkin_checkout' as const,
                title: 'İşe Giriş / Çıkış',
                icon: UserCheck,
                glowColor: 'text-emerald-500',
                borderColor: 'border-emerald-500',
                bgGlow: 'bg-emerald-500/15',
                badgeText: isCheckedIn ? 'Mesaide' : isCompletedToday ? 'Çıkış' : undefined,
                badgeCount: isAdmin && pendingRequests.length > 0 ? pendingRequests.length : undefined,
              },
              {
                id: 'breaks' as const,
                title: 'Mola',
                icon: Coffee,
                glowColor: 'text-amber-500',
                borderColor: 'border-amber-500',
                bgGlow: 'bg-amber-500/15',
                badgeText: isOnBreak ? 'MOLADA' : undefined,
                badgeCount: isAdmin && activeStaffOnBreak.length > 0 ? activeStaffOnBreak.length : undefined,
              },
              {
                id: 'summary' as const,
                title: 'Mesai Özeti',
                icon: Clock,
                glowColor: 'text-blue-500',
                borderColor: 'border-blue-500',
                bgGlow: 'bg-blue-500/15',
              },
              {
                id: 'leaves' as const,
                title: 'İzin Takibi',
                icon: CalendarRange,
                glowColor: 'text-purple-500',
                borderColor: 'border-purple-500',
                bgGlow: 'bg-purple-500/15',
                badgeCount: pendingLeaveCount > 0 ? pendingLeaveCount : undefined,
              },
              ...(isAdmin
                ? [
                    {
                      id: 'workplace' as const,
                      title: 'Merkez İş Yeri',
                      icon: Store,
                      glowColor: 'text-teal-500',
                      borderColor: 'border-teal-500',
                      bgGlow: 'bg-teal-500/15',
                      badgeText: '20m',
                    },
                  ]
                : []),
            ].map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => navigateToSection(mod.id)}
                  className="flex flex-col items-center justify-start group cursor-pointer focus:outline-none transition-transform active:scale-95 p-4 rounded-3xl hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                >
                  {/* Dairesel Neon Çerçeveli İkon */}
                  <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-full transition-all duration-200 flex items-center justify-center shadow-xl shadow-black/20 bg-slate-900 border-2 border-slate-700/60 group-hover:scale-105 group-hover:border-emerald-500">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-emerald-500/15 transition-colors">
                      <Icon className={`w-8 h-8 ${mod.glowColor}`} />
                    </div>

                    {/* Rozet */}
                    {mod.badgeCount !== undefined && mod.badgeCount > 0 ? (
                      <span className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black border-2 border-slate-950 shadow-md">
                        {mod.badgeCount > 99 ? '99+' : mod.badgeCount}
                      </span>
                    ) : mod.badgeText ? (
                      <span
                        className={`absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-black border border-slate-950 text-white ${
                          mod.id === 'breaks' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                        }`}
                      >
                        {mod.badgeText}
                      </span>
                    ) : null}
                  </div>

                  {/* İkon Altındaki Başlık */}
                  <span className="mt-3 text-sm font-extrabold text-center leading-tight text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {mod.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SEÇİLEN MODÜL İÇİNDE ÜST KART (activeSection !== 'menu') */}
      {/* ============================================================ */}
      {activeSection !== 'menu' && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${SECTION_INFO_WEB[activeSection]?.bg || 'bg-emerald-500/15'}`}>
              {React.createElement(SECTION_INFO_WEB[activeSection]?.icon || UserCheck, {
                className: `w-6 h-6 ${SECTION_INFO_WEB[activeSection]?.color || 'text-emerald-500'}`,
              })}
            </div>
            <div>
              <div className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{SECTION_INFO_WEB[activeSection]?.title}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {SECTION_INFO_WEB[activeSection]?.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBackToSectionMenu}
            className="inline-flex items-center gap-2 px-4 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer min-h-[44px] shadow-xs active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Personel Takibi Menüsü</span>
          </button>
        </div>
      )}

      {/* --- ADMIN: ONAY BEKLEYEN PERSONEL TALEPLERİ PANELİ --- */}
      {activeSection === 'checkin_checkout' && isAdmin && pendingRequests.length > 0 && (
        <div className="bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-orange-500/15 dark:from-amber-950/50 dark:via-slate-900 dark:to-orange-950/50 rounded-3xl p-5 sm:p-6 border-2 border-amber-400 dark:border-amber-600 shadow-xl shadow-amber-500/10 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-amber-200 dark:border-amber-800/80 pb-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  <span>Yönetici Onayı Bekleyen Personel Talepleri</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white shadow-sm">
                    {pendingRequests.length}
                  </span>
                </h3>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 font-medium">
                  Personellerin konum dışından (iş yeri dışından) gönderdiği giriş/çıkış talepleri onayınızı bekliyor.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {pendingRequests.map((req) => {
              const isCheckInReq = req.status === 'pending_checkin_approval';
              const reqDistance = isCheckInReq ? req.checkInDistance : req.checkOutDistance;
              const reqAddress = isCheckInReq ? req.checkInAddress : req.checkOutAddress;
              const reqTime = isCheckInReq ? req.checkInTime : (req.checkOutTime || Date.now());
              const reqLat = isCheckInReq ? req.checkInLat : req.checkOutLat;
              const reqLon = isCheckInReq ? req.checkInLon : req.checkOutLon;

              return (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-800/95 border border-amber-200 dark:border-amber-800 shadow-md flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                          {req.userName}
                        </span>
                        {req.userRole && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {req.userRole}
                          </span>
                        )}
                      </div>
                      <span
                        className={"px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border " + (
                          isCheckInReq
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                            : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                        )}
                      >
                        {isCheckInReq ? '🟢 Giriş Talebi' : '🔴 Çıkış Talebi'}
                      </span>
                    </div>

                    {/* Mesafe ve Konum Bilgisi */}
                    <div className="space-y-1.5 text-xs">
                      {req.branchName && (
                        <div className="flex items-center gap-1.5 font-bold">
                          <Store className="w-3.5 h-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                          {req.isOtherBranch ? (
                            <span className="text-amber-700 dark:text-amber-300">
                              ⚠️ Farklı Şube Talebi: <strong>{req.branchName}</strong> (Asıl Şube: {req.assignedBranchName || 'Bilinmiyor'})
                            </span>
                          ) : (
                            <span className="text-teal-800 dark:text-teal-300">
                              Şube: <strong>{req.branchName}</strong>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {req.branchName ? `${req.branchName} Şubesinden` : 'İş Yerinden'}{' '}
                          {reqDistance !== undefined ? LocationService.formatDistance(reqDistance) : 'Bilinmiyor'} Uzakta
                        </span>
                      </div>
                      {reqAddress && (
                        <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                          <span className="line-clamp-2">{reqAddress}</span>
                        </div>
                      )}
                      {req.approvalNote && (
                        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200">
                          <strong>Personel Notu:</strong> "{req.approvalNote}"
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        Talep Saati: {new Date(reqTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} ({req.date})
                      </div>
                    </div>
                  </div>

                  {/* Onay / Ret Butonları */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    {reqLat && reqLon && (
                      <button
                        type="button"
                        onClick={() => LocationService.openInGoogleMaps(reqAddress || '', reqLat, reqLon)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Haritada İncele"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Harita</span>
                      </button>
                    )}
                    <div className="flex-1" />
                    <button
                      type="button"
                      disabled={processingApprovalId === req.id}
                      onClick={() => handleReject(req.id, isCheckInReq ? 'checkin' : 'checkout')}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Reddet
                    </button>
                    <button
                      type="button"
                      disabled={processingApprovalId === req.id}
                      onClick={() => handleApprove(req.id, isCheckInReq ? 'checkin' : 'checkout')}
                      className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {processingApprovalId === req.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Onayla</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- ADMIN: ONAY BEKLEYEN İZİN TALEPLERİ PANELİ --- */}
      {activeSection === 'leaves' && isAdmin && pendingLeaveCount > 0 && (
        <div className="bg-gradient-to-br from-blue-500/15 via-indigo-500/5 to-purple-500/15 dark:from-blue-950/50 dark:via-slate-900 dark:to-indigo-950/50 rounded-3xl p-5 sm:p-6 border-2 border-blue-400 dark:border-blue-600 shadow-xl shadow-blue-500/10 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-blue-200 dark:border-blue-800/80 pb-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-blue-950 dark:text-blue-200 flex items-center gap-2">
                  <span>Onay Bekleyen İzin Talepleri</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-sm">
                    {pendingLeaveCount}
                  </span>
                </h3>
                <p className="text-xs text-blue-800/90 dark:text-blue-300/90 font-medium">
                  Personellerden gelen saatlik veya günlük izin başvuruları onayınızı bekliyor.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('leaves')}
              className="text-xs font-bold text-blue-700 dark:text-blue-300 underline cursor-pointer"
            >
              Tümünü Gör
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {leaveRequests
              .filter((r) => r.status === 'pending')
              .map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/80 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {req.userName}
                        </strong>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            req.leaveType === 'hourly'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-700 dark:text-purple-950 dark:text-purple-300'
                          }`}
                        >
                          {req.leaveType === 'hourly' ? '🕒 Saatlik İzin' : '📅 Günlük İzin'} ({req.durationText})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {new Date(req.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {req.leaveType === 'hourly' && req.startTime && req.endTime && (
                          <span className="font-bold text-slate-700 dark:text-slate-300"> • {req.startTime} - {req.endTime}</span>
                        )}
                        {req.leaveType === 'daily' && req.endDate && req.endDate !== req.date && (
                          <span> - {new Date(req.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                      <strong>Gerekçe:</strong> "{req.reason}"
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={processingLeaveId === req.id}
                      onClick={() => handleRejectLeave(req.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Reddet
                    </button>
                    <button
                      type="button"
                      disabled={processingLeaveId === req.id}
                      onClick={() => handleApproveLeave(req.id)}
                      className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {processingLeaveId === req.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Onayla</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* --- SECTION 1: YÖNETİCİ LOKASYON BELİRLEME (Görsel-1 Tasarımı) --- */}
      {activeSection === 'workplace' && isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>İş Yeri / Merkez Lokasyonu</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    Yönetici Yetkisi
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Personelin 20 metre çapında işe giriş ve çıkış yapacağı merkezi belirleyin.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Yarıçap:
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-black">
                {radius} Metre (Sabit)
              </span>
            </div>
          </div>

          {/* Görsel-1 UI: Adres Çubuğu + Compass Butonu + MapPin Butonu */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              İş Yeri Adresi / Koordinatı
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="Firma / İş yeri adresi veya koordinatı..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-medium"
              />

              {/* GPS Button (Pusula İkonu) */}
              <button
                type="button"
                onClick={handleGetWorkplaceGPS}
                disabled={isFetchingLocation}
                className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                title="GPS ile Şu Anki Konumu İş Yeri Olarak Al"
                aria-label="Konum Al"
              >
                {isFetchingLocation ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Compass className="w-5 h-5" />
                )}
              </button>

              {/* Map Button (Harita İkonu) */}
              <button
                type="button"
                onClick={handleOpenGoogleMaps}
                disabled={!addressText.trim() && !lat}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                title="Haritada Göster"
                aria-label="Haritada Göster"
              >
                <MapPin className="w-5 h-5" />
              </button>
            </div>

            {/* GPS Koordinat Rozeti (Görsel-1'deki Yeşil İşaretli Kısım) */}
            {lat && lon && (
              <div className="flex items-center justify-between flex-wrap gap-2 mt-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Coğrafi konum işaretlendi ({lat.toFixed(5)}, {lon.toFixed(5)})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveWorkplaceLocation}
                  disabled={isSavingLocation}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSavingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Konumu Kaydet & Güncelle</span>
                </button>
              </div>
            )}

            {locationSuccessMsg && (
              <div className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
                {locationSuccessMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SECTION 2: CANLI MESAFE KARTI & İŞE GİRİŞ / ÇIKIŞ BUTONLARI --- */}
      {activeSection === 'checkin_checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sol Kolon: Canlı Geofence ve Şube / İş Yeri Bilgisi */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {targetLocation?.isBranch ? (
                  <Store className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                ) : (
                  <MapPin className="w-4 h-4 text-emerald-500" />
                )}
                <span>
                  {targetLocation
                    ? targetLocation.isBranch
                      ? `Şube: ${targetLocation.name}`
                      : targetLocation.name
                    : 'İş Yeri Konumu'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => checkLiveDistance()}
                disabled={isCheckingDistance}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 transition-all cursor-pointer"
                title="Mesafeyi Yeniden Ölç"
              >
                <RefreshCw className={"w-3.5 h-3.5 " + (isCheckingDistance ? "animate-spin" : "")} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  {targetLocation?.isBranch ? 'Şube Lokasyon Adresi' : 'Merkez Adresi'}
                </p>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {allowedRadius} Metre Sınırı
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                {targetLocation?.address || workplaceLocation?.address || 'Yönetici henüz bir konum belirlemedi.'}
              </p>
              {userAssignedBranch && (
                <div className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold pt-1 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Bağlı Olduğunuz Şube: <strong>{userAssignedBranch.name}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Mesafe Ölçüm Durum Kartı */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">Anlık Mesafe:</span>
              <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                {isCheckingDistance ? (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Ölçülüyor...
                  </span>
                ) : currentDistance !== null ? (
                  LocationService.formatDistance(currentDistance)
                ) : (
                  'Hesaplanmadı'
                )}
              </span>
            </div>

            {/* Geofence Durumu */}
            {currentDistance !== null && (
              <div
                className={"p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 " + (
                  currentDistance <= allowedRadius
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                )}
              >
                {currentDistance <= allowedRadius ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>
                      {targetLocation?.isBranch ? `${targetLocation.name} Şubesindesiniz` : 'İş Yerindesiniz'} ({allowedRadius}m Alanı İçindesiniz) ✅
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      {targetLocation?.isBranch ? `${targetLocation.name} Şubesi Dışındasınız` : 'İş Yeri Dışındasınız'} ({LocationService.formatDistance(currentDistance)})
                    </span>
                  </>
                )}
              </div>
            )}

            {isLocationDisabled ? (
              <div className="p-2.5 rounded-xl text-xs font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-start gap-2">
                <MapPinOff className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-black">Konum Servisleri Kapalı</p>
                  <p className="text-[10px] font-normal leading-tight text-rose-600 dark:text-rose-400">
                    Mesafe ölçülemiyor. Giriş ve çıkış yapabilmek için konum servislerini açmalısınız.
                  </p>
                </div>
              </div>
            ) : distanceError ? (
              <p className="text-[11px] text-red-500 font-semibold">{distanceError}</p>
            ) : null}
          </div>
        </div>

        {/* Sağ Kolon: Büyük Butonlar ve Bugünkü Durum (2 span) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                Bugünkü Mesai Durumunuz ({new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personel: <strong className="text-slate-800 dark:text-slate-200">{user?.name}</strong>
              </p>
            </div>

            {/* Durum Rozeti */}
            <div>
              {isPendingCheckIn ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Giriş Onayı Bekleniyor
                </span>
              ) : isPendingCheckOut ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Çıkış Onayı Bekleniyor
                </span>
              ) : isCheckedIn ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Mesaidesiniz ({activeDurationText || 'Hesaplanıyor'})
                </span>
              ) : isCompletedToday ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  Mesai Tamamlandı
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Henüz Giriş Yapılmadı
                </span>
              )}
            </div>
          </div>

          {/* Feedback Uyarısı */}
          {actionFeedback && (
            <div
              className={"p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-in zoom-in-95 " + (
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
              )}
            >
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="flex-1">
                <span>{actionFeedback.text}</span>
              </div>
            </div>
          )}

          {/* Personel Bekleyen Onay Banner'ı */}
          {isPendingCheckIn && (
            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-black text-xs sm:text-sm">
                  <Clock className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                  <span>İşe Girişiniz İçin Yönetici Onayı Bekleniyor</span>
                </div>
                {currentUserTodayRecord && (
                  <button
                    type="button"
                    onClick={() => handleCancelMyRequest(currentUserTodayRecord.id)}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline cursor-pointer"
                  >
                    Talebi İptal Et
                  </button>
                )}
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed font-medium">
                Konum dışından yaptığınız işe giriş talebi yöneticilere iletildi. Yönetici onayladığında mesainiz aktifleşecektir.
              </p>
            </div>
          )}

          {isPendingCheckOut && (
            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-black text-xs sm:text-sm">
                  <Clock className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                  <span>İşten Çıkışınız İçin Yönetici Onayı Bekleniyor</span>
                </div>
                {currentUserTodayRecord && (
                  <button
                    type="button"
                    onClick={() => handleCancelMyRequest(currentUserTodayRecord.id)}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline cursor-pointer"
                  >
                    Talebi İptal Et
                  </button>
                )}
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed font-medium">
                Konum dışından yaptığınız çıkış talebi yöneticilere iletildi. Yönetici onayladığında mesainiz sonlanacaktır.
              </p>
            </div>
          )}

          {/* Konum Servisleri Kapalı İkaz Banner'ı */}
          {isLocationDisabled && (
            <div className="p-4 rounded-2xl bg-rose-500/10 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <MapPinOff className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-rose-900 dark:text-rose-100 flex items-center gap-2">
                      <span>Konum Servisleri Kapalı!</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200">
                        İşe Giriş / Çıkış Engellendi
                      </span>
                    </h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed font-medium">
                      {locationErrorMessage || 'İşe giriş ve çıkış yapabilmeniz için konum (GPS) servisinin açık olması gerekmektedir.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Nasıl Açılır?
                  </button>
                  <button
                    type="button"
                    onClick={() => checkLiveDistance(true)}
                    disabled={isCheckingDistance}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white shadow-md shadow-rose-600/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingDistance ? 'animate-spin' : ''}`} />
                    <span>Konumu Açtım, Yeniden Dene</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Büyük Butonlar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Buton 1: İşe Geldim (Yeşil) */}
            <button
              type="button"
              onClick={() => {
                if (isLocationDisabled) {
                  setIsLocationModalOpen(true);
                } else {
                  handleCheckIn(false);
                }
              }}
              disabled={isProcessingAction || isCheckedIn || isPendingCheckIn || isPendingCheckOut}
              className={"relative overflow-hidden rounded-2xl p-5 text-left flex flex-col justify-between transition-all duration-200 " + (
                isCheckedIn || isPendingCheckIn || isPendingCheckOut
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                  : isLocationDisabled
                  ? 'bg-gradient-to-br from-emerald-700/60 to-teal-800/60 text-white/80 border-2 border-dashed border-rose-400 hover:scale-[1.01] cursor-pointer'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-700 hover:from-emerald-600 hover:to-teal-800 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black">
                  {isProcessingAction ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <UserCheck className="w-5 h-5" />
                  )}
                </div>
                <span className={"text-[10px] font-black uppercase px-2 py-0.5 rounded-full " + (
                  isLocationDisabled ? 'bg-rose-500/80 text-white' : 'bg-white/20'
                )}>
                  {isLocationDisabled ? 'Konum Kapalı' : isPendingCheckIn ? 'Onay Bekliyor' : 'Giriş Yap'}
                </span>
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>🟢 İşe Geldim</span>
                  {isLocationDisabled && <MapPinOff className="w-4 h-4 text-rose-300" />}
                </h4>
                <p className="text-[11px] opacity-90 mt-1 leading-relaxed">
                  {isLocationDisabled
                    ? 'Konum kapalı olduğu için giriş yapılamaz. Açmak için dokunun.'
                    : 'İş yerinde veya konum dışındaysanız yönetici onayıyla mesainizi başlatın.'}
                </p>
              </div>
            </button>

            {/* Buton 2: İşten Çıkış Yaptım (Kırmızı) */}
            <button
              type="button"
              onClick={() => {
                if (isLocationDisabled) {
                  setIsLocationModalOpen(true);
                } else {
                  setShowCheckOutConfirmModal(true);
                }
              }}
              disabled={isProcessingAction || !isCheckedIn || isPendingCheckOut}
              className={"relative overflow-hidden rounded-2xl p-5 text-left flex flex-col justify-between transition-all duration-200 " + (
                !isCheckedIn || isPendingCheckOut
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                  : isLocationDisabled
                  ? 'bg-gradient-to-br from-rose-700/60 to-red-800/60 text-white/80 border-2 border-dashed border-rose-400 hover:scale-[1.01] cursor-pointer'
                  : 'bg-gradient-to-br from-rose-500 to-red-700 hover:from-rose-600 hover:to-red-800 text-white shadow-lg shadow-rose-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer animate-pulse'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black">
                  {isProcessingAction ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <UserX className="w-5 h-5" />
                  )}
                </div>
                <span className={"text-[10px] font-black uppercase px-2 py-0.5 rounded-full " + (
                  isLocationDisabled ? 'bg-rose-500/80 text-white' : 'bg-white/20'
                )}>
                  {isLocationDisabled ? 'Konum Kapalı' : isPendingCheckOut ? 'Onay Bekliyor' : 'Çıkış Yap'}
                </span>
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>🔴 İşten Çıkış Yaptım</span>
                  {isLocationDisabled && <MapPinOff className="w-4 h-4 text-rose-300" />}
                </h4>
                <p className="text-[11px] opacity-90 mt-1 leading-relaxed">
                  {isLocationDisabled
                    ? 'Konum kapalı olduğu için çıkış yapılamaz. Açmak için dokunun.'
                    : 'İş yerinde veya konum dışındaysanız yönetici onayıyla mesaiyi bitirin.'}
                </p>
              </div>
            </button>
          </div>

          {/* Bugünkü Giriş & Çıkış Detay Kartı */}
          {currentUserTodayRecord && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              {currentUserTodayRecord.branchName && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300">
                    <Store className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>Mesai Şubesi: <strong>{currentUserTodayRecord.branchName}</strong></span>
                  </div>
                  {currentUserTodayRecord.isOtherBranch && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300">
                      ⚠️ Farklı Şube (Asıl: {currentUserTodayRecord.assignedBranchName || 'Bilinmiyor'})
                    </span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[10px]">
                  GİRİŞ SAATİ
                </span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {new Date(currentUserTodayRecord.checkInTime).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[10px]">
                  GİRİŞ MESAFESİ
                </span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {currentUserTodayRecord.checkInDistance !== undefined
                    ? `${currentUserTodayRecord.checkInDistance} m ${
                        currentUserTodayRecord.checkInOutside
                          ? currentUserTodayRecord.checkInApprovalStatus === 'pending'
                            ? '(Onay Bekliyor)'
                            : '(Yönetici Onaylı)'
                          : `(${allowedRadius}m içi)`
                      }`
                    : `${allowedRadius}m içi`}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[10px]">
                  ÇIKIŞ SAATİ
                </span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {currentUserTodayRecord.checkOutTime
                    ? new Date(currentUserTodayRecord.checkOutTime).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }) + (currentUserTodayRecord.status === 'pending_checkout_approval' ? ' (Onay Bekliyor)' : '')
                    : 'Devam ediyor'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[10px]">
                  BRÜT MESAİ
                </span>
                <span className="font-black text-blue-600 dark:text-blue-400">
                  {currentUserTodayRecord.workDurationMinutes
                    ? (Math.floor(currentUserTodayRecord.workDurationMinutes / 60) + ' sa ' + (currentUserTodayRecord.workDurationMinutes % 60) + ' dk')
                    : activeDurationText || '-'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[10px]">
                  TOPLAM MOLA
                </span>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  {calculateRecordBreakMinutes(currentUserTodayRecord) > 0
                    ? `${calculateRecordBreakMinutes(currentUserTodayRecord)} dk (${currentUserTodayRecord.breaks?.length || 0} mola)`
                    : '-'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[10px]">
                  NET ÇALIŞMA
                </span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {formatMinutesToDuration(calculateRecordNetWorkMinutes(currentUserTodayRecord))}
                </span>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ============================================================ */}
      {/* MODÜL 2: MOLA YÖNETİMİ VE TAKİP PANELİ */}
      {/* ============================================================ */}
      {activeSection === 'breaks' && (
        <div className="space-y-5">
          {/* Personel Mola Kartı */}
          {isCheckedIn ? (
            <div className={`p-5 rounded-3xl border-2 transition-all duration-200 ${
              isOnBreak
                ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500 shadow-xl shadow-amber-500/15'
                : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 shadow-sm'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    isOnBreak
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40 animate-pulse'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  }`}>
                    <Coffee className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                        {isOnBreak ? '☕ Şu Anda Moladasınız' : 'Personel Mola Yönetimi'}
                      </h3>
                      {isOnBreak ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white animate-pulse">
                          Canlı Mola
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Mesaide Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {isOnBreak ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-300">
                          Geçen Mola Süresi: <span className="font-black text-base tracking-wide text-amber-600 dark:text-amber-400">{liveBreakTimerText || 'Hesaplanıyor...'}</span>
                        </span>
                      ) : (
                        <span>
                          Bugünkü mola özeti:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {currentUserTodayRecord?.breaks && currentUserTodayRecord.breaks.length > 0
                              ? `${currentUserTodayRecord.breaks.length} mola (${currentUserTodayRecord.totalBreakMinutes || currentUserTodayRecord.breaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0)} dk)`
                              : 'Henüz molaya çıkılmadı'}
                          </strong>
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOnBreak ? (
                    <button
                      type="button"
                      onClick={handleEndBreak}
                      disabled={isProcessingBreak}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isProcessingBreak ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                      <span>Molayı Bitir ve Mesaiye Dön</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartBreak}
                      disabled={isProcessingBreak}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs sm:text-sm text-amber-900 dark:text-amber-100 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900/90 border border-amber-300 dark:border-amber-700 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isProcessingBreak ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4 text-amber-700 dark:text-amber-300" />}
                      <span>Molaya Çık</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bugünkü Molalarım Dökümü */}
              {currentUserTodayRecord?.breaks && currentUserTodayRecord.breaks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-800/60">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Bugünkü Molalarınız ({currentUserTodayRecord.breaks.length} Adet)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {currentUserTodayRecord.breaks.map((b, idx) => {
                      const bStart = new Date(b.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                      const bEnd = b.endTime ? new Date(b.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Devam ediyor';
                      const bDur = b.durationMinutes || (b.endTime ? Math.max(1, Math.round((b.endTime - b.startTime) / 60000)) : Math.max(1, Math.round((Date.now() - b.startTime) / 60000)));
                      return (
                        <div
                          key={b.id || idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            ☕ {idx + 1}. Mola: {bStart} - {bEnd}
                          </span>
                          <span className="font-black text-amber-600 dark:text-amber-400">
                            {bDur} dk
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <Coffee className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Henüz İşe Giriş Yapmadınız
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Molaya çıkabilmek için önce işe giriş yapmış olmanız gerekmektedir.
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('checkin_checkout')}
                className="mt-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>İşe Giriş Bölümüne Git</span>
              </button>
            </div>
          )}

          {/* YÖNETİCİ PANELİ: Personel Mola Detayları ve Ayrı Ayrı Alt Alta Döküm */}
          {isAdmin && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              {/* Başlık ve Tarih Filtresi */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>Personel Mola Detayları ve Dökümü</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Yönetici Paneli
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Personellerin molaya giriş ve çıkış saatleri, süreleri ve günlük mola dökümleri.
                    </p>
                  </div>
                </div>

                {/* Tarih Seçimi Butonları & Date Input */}
                <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                  <button
                    type="button"
                    onClick={() => setBreakAdminDate(todayStr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      breakAdminDate === todayStr
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Bugün
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      setBreakAdminDate(y.toISOString().split('T')[0]);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      (() => {
                        const y = new Date();
                        y.setDate(y.getDate() - 1);
                        return breakAdminDate === y.toISOString().split('T')[0];
                      })()
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Dün
                  </button>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={breakAdminDate}
                      onChange={(e) => setBreakAdminDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Canlı Moladaki Personeller (Eğer varsa öne çıkar) */}
              {breakAdminDate === todayStr && activeStaffOnBreak.length > 0 && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400 dark:border-amber-600 space-y-3 shadow-md shadow-amber-500/10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                      <span>Şu Anda Canlı Molada Olan Personeller ({activeStaffOnBreak.length})</span>
                    </h4>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Canlı Takip
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {activeStaffOnBreak.map((rec) => {
                      const startTime = rec.currentBreakStartTime ? new Date(rec.currentBreakStartTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-';
                      const durMins = rec.currentBreakStartTime ? Math.max(1, Math.round((Date.now() - rec.currentBreakStartTime) / 60000)) : 1;
                      return (
                        <div key={rec.id} className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-700 flex items-center justify-between shadow-xs">
                          <div>
                            <div className="font-black text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <Coffee className="w-3.5 h-3.5 text-amber-500" />
                              <span>{rec.userName}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Molaya Giriş: <strong>{startTime}</strong>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-500 text-white shadow-xs animate-pulse">
                            {durMins} dk'dır molada
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Günün Mola İstatistikleri ve Detaylı Personel Mola Dökümleri */}
              {(() => {
                const dateStaffRecords = attendanceRecords.filter((r) => r.date === breakAdminDate && ((r.breaks && r.breaks.length > 0) || r.isOnBreak));
                const totalBreaksTaken = dateStaffRecords.reduce((acc, r) => acc + (r.breaks?.length || 0), 0);
                const totalBreakMinsAll = dateStaffRecords.reduce((acc, r) => acc + calculateRecordBreakMinutes(r), 0);

                return (
                  <div className="space-y-4">
                    {/* Özet Mini Sayaçlar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Mola Alan Personel</span>
                        <span className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {dateStaffRecords.length} Kişi
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Toplam Mola Adedi</span>
                        <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
                          {totalBreaksTaken} Defa
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Toplam Mola Süresi</span>
                        <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
                          {totalBreakMinsAll} dk ({formatMinutesToDuration(totalBreakMinsAll)})
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Seçili Tarih</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 mt-1 block truncate">
                          {new Date(breakAdminDate + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Personellerin Ayrı Ayrı Alt Alta Mola Dökümleri */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <Coffee className="w-4 h-4 text-amber-500" />
                          <span>Detaylı Personel Mola Döküm Listesi</span>
                        </h4>
                        <span className="text-xs text-slate-400">
                          {dateStaffRecords.length} personel mola kaydı
                        </span>
                      </div>

                      {dateStaffRecords.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-center space-y-2">
                          <Coffee className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Seçilen tarihte ({new Date(breakAdminDate + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}) mola kullanan personel bulunmuyor.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {dateStaffRecords.map((rec) => {
                            const recBreakTotal = calculateRecordBreakMinutes(rec);
                            const breaksCount = rec.breaks?.length || 0;

                            return (
                              <div
                                key={rec.id}
                                className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700/70 shadow-xs space-y-3.5"
                              >
                                {/* Personel Üst Kartı */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black text-sm shrink-0">
                                      {rec.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100">
                                          {rec.userName}
                                        </span>
                                        {rec.userRole && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                            {rec.userRole}
                                          </span>
                                        )}
                                        {rec.branchName && (
                                          <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                                            <Store className="w-3 h-3" />
                                            {rec.branchName}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                                        <span>İşe Giriş: <strong>{new Date(rec.checkInTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                                        {rec.checkOutTime && (
                                          <span>İşten Çıkış: <strong>{new Date(rec.checkOutTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                                    {rec.isOnBreak ? (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-white animate-pulse shadow-xs">
                                        <Coffee className="w-3.5 h-3.5" />
                                        <span>Şu Anda Canlı Molada</span>
                                      </span>
                                    ) : rec.status === 'checked_in' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span>Mesaide Aktif</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                        <span>Mesai Tamamlandı</span>
                                      </span>
                                    )}

                                    <span className="px-3 py-1 rounded-xl text-xs font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                      Toplam Mola: {recBreakTotal} dk ({breaksCount} Adet)
                                    </span>
                                  </div>
                                </div>

                                {/* Ayrı Ayrı Alt Alta Mola Tablosu */}
                                {rec.breaks && rec.breaks.length > 0 ? (
                                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xs">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/70 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                                          <th className="py-2.5 px-3.5">Mola No</th>
                                          <th className="py-2.5 px-3.5">Molaya Giriş Saati</th>
                                          <th className="py-2.5 px-3.5">Moladan Çıkış Saati</th>
                                          <th className="py-2.5 px-3.5">Mola Süresi</th>
                                          <th className="py-2.5 px-3.5">Not / Açıklama</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {rec.breaks.map((b, bIdx) => {
                                          const isCurrentBreak = rec.isOnBreak && (!b.endTime || (bIdx === rec.breaks!.length - 1 && !b.endTime));
                                          const startStr = new Date(b.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                                          const endStr = b.endTime
                                            ? new Date(b.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                                            : (isCurrentBreak ? '🟡 Halen Molada' : '-');
                                          const durMins = b.durationMinutes !== undefined
                                            ? b.durationMinutes
                                            : (b.endTime
                                                ? Math.max(1, Math.round((b.endTime - b.startTime) / 60000))
                                                : Math.max(1, Math.round((Date.now() - b.startTime) / 60000)));

                                          return (
                                            <tr
                                              key={b.id || bIdx}
                                              className={isCurrentBreak ? 'bg-amber-500/10 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}
                                            >
                                              <td className="py-2.5 px-3.5 font-black text-slate-800 dark:text-slate-200">
                                                <div className="flex items-center gap-1.5">
                                                  <Coffee className="w-3.5 h-3.5 text-amber-500" />
                                                  <span>{bIdx + 1}. Mola</span>
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3.5 font-bold text-slate-700 dark:text-slate-300">
                                                {startStr}
                                              </td>
                                              <td className="py-2.5 px-3.5">
                                                {isCurrentBreak ? (
                                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-black animate-pulse">
                                                    <Clock className="w-3 h-3" />
                                                    <span>Halen Molada (Devam Ediyor)</span>
                                                  </span>
                                                ) : (
                                                  <span className="font-bold text-slate-700 dark:text-slate-300">{endStr}</span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3.5">
                                                <span
                                                  className={`px-2.5 py-0.5 rounded-lg text-xs font-black inline-block ${
                                                    isCurrentBreak
                                                      ? 'bg-amber-500 text-white shadow-xs animate-pulse'
                                                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                                  }`}
                                                >
                                                  {durMins} dakika {isCurrentBreak && '(canlı)'}
                                                </span>
                                              </td>
                                              <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400">
                                                {b.note || 'Mola'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="py-2 px-3 text-xs text-slate-400 italic">
                                    Mola detayı bulunmuyor.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODÜL 3: MESAİ ÖZETİ KISMI */}
      {/* ============================================================ */}
      {activeSection === 'summary' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  {isAdmin ? 'Personel Mesai Tablosu ve Dönem Özetleri' : 'Mesai Geçmişim ve Süreler'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {isAdmin ? 'Personellerin çalışma saatleri, dönem özetleri ve mola detayları.' : 'Giriş-çıkış saatleriniz, brüt ve net mesai süreleriniz.'}
                </p>
              </div>
            </div>

            {/* Dışa Aktarma Butonları (Yönetici & Personel) */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingExcel || filteredRecords.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Excel (.xlsx) olarak indir"
              >
                {isExportingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>Excel İndir (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf || filteredRecords.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                title="PDF Raporu olarak indir"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>PDF Raporu İndir</span>
              </button>
            </div>
          </div>
          <>
            {/* 1. Tarih Aralığı Filtre Barı ve Hızlı Seçim Butonları */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Hızlı Seçim Butonları */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
                    <CalendarRange className="w-3.5 h-3.5" />
                    <span>Dönem:</span>
                  </span>
                  {[
                    { id: 'today', label: 'Bugün' },
                    { id: 'this_week', label: 'Bu Hafta' },
                    { id: 'this_month', label: 'Bu Ay' },
                    { id: 'last_month', label: 'Geçen Ay' },
                    { id: 'yesterday', label: 'Dün' },
                    { id: 'all', label: 'Tümü' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activePreset === p.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Personel Seçici (Admin için - Çoklu Seçim) */}
                {isAdmin && (
                  <StaffMultiSelect
                    options={staffOptions}
                    selectedIds={selectedStaffIds}
                    onChange={setSelectedStaffIds}
                    placeholder="Tüm Personeller"
                  />
                )}
              </div>

              {/* Bilgilendirme Rozeti (Bugün modu) */}
              {activePreset === 'today' && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Sadece Bugünün ({new Date().toLocaleDateString('tr-TR')}) Mesai Kayıtları Görüntüleniyor. Geçmiş için Dönem butonlarını veya Tarih Aralığını kullanabilirsiniz.</span>
                </div>
              )}

              {/* Özel Tarih Aralığı Seçicileri */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold">Başlangıç:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setActivePreset('custom');
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold">Bitiş:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setActivePreset('custom');
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {(startDate !== todayStr || endDate !== todayStr || activePreset !== 'today' || selectedStaffIds.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      applyPreset('today');
                      setSelectedStaffIds([]);
                    }}
                    className="text-xs text-rose-500 hover:text-rose-600 font-semibold underline ml-auto cursor-pointer"
                  >
                    Filtreleri Sıfırla (Bugün)
                  </button>
                )}
              </div>

              {/* Seçili Personel Rozetleri (Chips) */}
              {selectedStaffIds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Seçili ({selectedStaffIds.length}):
                  </span>
                  {selectedStaffIds.map((id) => {
                    const staff = staffOptions.find((s) => s.id === id);
                    if (!staff) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-2xs"
                      >
                        <span>{staff.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedStaffIds((prev) => prev.filter((item) => item !== id))}
                          className="w-3.5 h-3.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 flex items-center justify-center cursor-pointer text-emerald-700 dark:text-emerald-300 transition-colors"
                          title="Kaldır"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setSelectedStaffIds([])}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline font-semibold ml-1 cursor-pointer"
                  >
                    Tümünü Temizle
                  </button>
                </div>
              )}
            </div>

            {/* 2. Mesai İstatistik Kartları */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                <span className="text-[10px] sm:text-xs font-bold text-sky-600 dark:text-sky-400 block">
                  Toplam Brüt Mesai
                </span>
                <span className="text-base sm:text-xl font-black text-sky-800 dark:text-sky-200">
                  {stats.totalDurationFormatted}
                </span>
                <span className="text-[10px] text-sky-600/80 dark:text-sky-400/80 block mt-0.5">
                  ({stats.totalMinutes} dakika)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-300 block">
                    Mola & Net Mesai
                  </span>
                  {stats.onBreakCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white animate-pulse">
                      {stats.onBreakCount} Molada
                    </span>
                  )}
                </div>
                <span className="text-base sm:text-xl font-black text-amber-800 dark:text-amber-200">
                  {stats.totalBreakFormatted}
                </span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 block mt-0.5">
                  Net: <strong className="text-emerald-700 dark:text-emerald-300 font-black">{stats.netWorkFormatted}</strong>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                  Çalışılan Gün / Ort.
                </span>
                <span className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-300">
                  {stats.uniqueDays} Gün
                </span>
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block mt-0.5">
                  Ort: {stats.avgDurationPerDayFormatted} / gün
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 block">
                  Mesai Kayıtları
                </span>
                <span className="text-base sm:text-xl font-black text-blue-700 dark:text-blue-300">
                  {stats.total} Giriş
                </span>
                <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 block mt-0.5">
                  {stats.completed} Tamamlandı • {stats.active} Mesaide
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  {isAdmin ? 'Personel Sayısı' : 'Durum'}
                </span>
                <span className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100">
                  {isAdmin ? `${stats.distinctStaff} Kişi` : (stats.active > 0 ? 'Mesaide' : 'Mesaide Değil')}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {isAdmin ? `${staffOptions.length} kayıtlı personelden` : 'Kendi kayıtlarınız'}
                </span>
              </div>
            </div>

            {/* 3. Personel Bazlı Mesai Özet Grid'i (Admin için - Okla Açılır Panel) */}
            {isAdmin && staffSummaries.length > 0 && (
              <div className="space-y-2 pt-1">
                <div
                  onClick={() => setIsStaffSummaryOpen(!isStaffSummaryOpen)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 cursor-pointer transition-all select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      Personel Mesai Özeti
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {staffSummaries.length} Personel
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {isStaffSummaryOpen && selectedStaffIds.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStaffIds([]);
                        }}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        Tümünü Göster ({selectedStaffIds.length} seçili)
                      </button>
                    )}
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {isStaffSummaryOpen ? 'Gizle' : 'Göster'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
                        isStaffSummaryOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                {isStaffSummaryOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  {staffSummaries.map((s) => {
                    const isSelected = selectedStaffIds.includes(s.userId);
                    return (
                      <div
                        key={s.userId}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStaffIds((prev) => prev.filter((id) => id !== s.userId));
                          } else {
                            setSelectedStaffIds((prev) => [...prev, s.userId]);
                          }
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs transition-colors ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : (
                                s.userName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-black text-xs text-slate-800 dark:text-slate-200 leading-tight">
                                {s.userName}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {s.userRole === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-600 text-white shadow-2xs">
                                Seçili
                              </span>
                            )}
                            {s.activeSessions > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
                                Mesaide
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block">BRÜT</span>
                            <span className="font-extrabold text-blue-600 dark:text-blue-400 text-[10px]">
                              {s.totalDurationFormatted}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block">MOLA</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400 text-[10px]">
                              {s.totalBreakFormatted || '0 dk'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block">NET</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[10px]">
                              {s.totalNetFormatted || s.totalDurationFormatted}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block">GÜN</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300 text-[10px]">
                              {s.totalDays} gün
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

            {/* 4. Kayıtlar Listesi */}
            {filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Clock className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-xs sm:text-sm font-bold">
                  Seçilen tarih aralığına ait herhangi bir mesai kaydı bulunamadı.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                      <th className="py-3 px-3">Tarih</th>
                      <th className="py-3 px-3">Personel</th>
                      {isAdmin && <th className="py-3 px-3 text-center">Onay / İşlem</th>}
                      <th className="py-3 px-3">Şube</th>
                      <th className="py-3 px-3">Durum</th>
                      <th className="py-3 px-3">Giriş Saati</th>
                      <th className="py-3 px-3">Giriş Mesafesi</th>
                      <th className="py-3 px-3">Çıkış Saati</th>
                      <th className="py-3 px-3">Çıkış Mesafesi</th>
                      <th className="py-3 px-3">Brüt Süre</th>
                      <th className="py-3 px-3">Mola Özeti</th>
                      <th className="py-3 px-3">Net Mesai</th>
                      <th className="py-3 px-3">Not / Açıklama</th>
                      {isAdmin && <th className="py-3 px-3 text-right">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                    {filteredRecords.map((record) => {
                      const checkInDate = new Date(record.checkInTime);
                      const checkOutDate = record.checkOutTime
                        ? new Date(record.checkOutTime)
                        : null;
                      const durationMinutes = calculateRecordDurationMinutes(record);
                      const breakMinutes = calculateRecordBreakMinutes(record);
                      const netMinutes = calculateRecordNetWorkMinutes(record);
                      const isExpanded = expandedBreakRecordIds.has(record.id);

                      return (
                        <React.Fragment key={record.id}>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            {/* Tarih */}
                            <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{record.date}</span>
                              </div>
                            </td>

                            {/* Personel */}
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-xs">
                                  {record.userName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div>{record.userName}</div>
                                  {record.userRole && (
                                    <div className="text-[10px] text-slate-400 font-normal">
                                      {record.userRole === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Onay / İşlem (Şubeden Önce) */}
                            {isAdmin && (
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                {record.status === 'pending_checkin_approval' ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={processingApprovalId === record.id}
                                      onClick={() => handleApprove(record.id, 'checkin')}
                                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Onayla</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={processingApprovalId === record.id}
                                      onClick={() => handleReject(record.id, 'checkin')}
                                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Reddet</span>
                                    </button>
                                  </div>
                                ) : record.status === 'pending_checkout_approval' ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={processingApprovalId === record.id}
                                      onClick={() => handleApprove(record.id, 'checkout')}
                                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Onayla</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={processingApprovalId === record.id}
                                      onClick={() => handleReject(record.id, 'checkout')}
                                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Reddet</span>
                                    </button>
                                  </div>
                                ) : (record.checkOutOutside && record.checkOutApprovalStatus === 'approved') || (record.checkInOutside && record.checkInApprovalStatus === 'approved') || record.checkOutApprovalStatus === 'approved' || record.checkInApprovalStatus === 'approved' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    <Check className="w-3 h-3" />
                                    <span>Onaylandı</span>
                                  </span>
                                ) : (record.checkOutOutside && record.checkOutApprovalStatus === 'rejected') || (record.checkInOutside && record.checkInApprovalStatus === 'rejected') || record.checkOutApprovalStatus === 'rejected' || record.checkInApprovalStatus === 'rejected' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                    <X className="w-3 h-3" />
                                    <span>Reddedildi</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            )}

                            {/* Şube */}
                            <td className="py-3 px-3">
                              {record.branchName ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                    <Store className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                                    {record.branchName}
                                  </span>
                                  {record.isOtherBranch && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                      (Asıl: {record.assignedBranchName || 'Bilinmiyor'})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Merkez</span>
                              )}
                            </td>

                            {/* Durum */}
                            <td className="py-3 px-3">
                              {record.status === 'on_leave' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  İzinli
                                </span>
                              ) : record.isOnBreak ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                                  <Coffee className="w-3 h-3 text-amber-600" />
                                  Molada ({record.currentBreakStartTime ? Math.max(1, Math.round((Date.now() - record.currentBreakStartTime) / 60000)) + ' dk' : ''})
                                </span>
                              ) : record.status === 'pending_checkin_approval' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Giriş Onayı Bekliyor
                                </span>
                              ) : record.status === 'pending_checkout_approval' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Çıkış Onayı Bekliyor
                                </span>
                              ) : record.status === 'checked_in' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Mesaide
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  Çıkış Yaptı
                                </span>
                              )}
                            </td>

                            {/* Giriş Saati */}
                            <td className="py-3 px-3 font-bold">
                              {record.status === 'on_leave' || !record.checkInTime ? (
                                <span className="text-slate-400 italic font-normal">-</span>
                              ) : (
                                checkInDate.toLocaleTimeString('tr-TR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              )}
                            </td>

                            {/* Giriş Mesafesi */}
                            <td className="py-3 px-3">
                              {record.status === 'on_leave' ? (
                                <span className="text-slate-400 italic font-normal">-</span>
                              ) : record.checkInDistance !== undefined ? (
                                <div className="flex flex-col">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                    {LocationService.formatDistance(record.checkInDistance)}
                                  </span>
                                  {record.checkInOutside && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                      {record.checkInApprovalStatus === 'pending'
                                        ? '⏳ Onay Bekliyor'
                                        : '✅ Yönetici Onaylı'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">≤ {allowedRadius} m</span>
                              )}
                            </td>

                            {/* Çıkış Saati */}
                            <td className="py-3 px-3 font-bold">
                              {record.status === 'on_leave' || !checkOutDate ? (
                                <span className="text-slate-400 italic font-normal">-</span>
                              ) : (
                                checkOutDate.toLocaleTimeString('tr-TR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              )}
                            </td>

                            {/* Çıkış Mesafesi */}
                            <td className="py-3 px-3">
                              {record.status === 'on_leave' || record.checkOutDistance === undefined ? (
                                <span className="text-slate-400 italic font-normal">-</span>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                                    {LocationService.formatDistance(record.checkOutDistance)}
                                  </span>
                                  {record.checkOutOutside && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                      {record.checkOutApprovalStatus === 'pending'
                                        ? '⏳ Onay Bekliyor'
                                        : '✅ Yönetici Onaylı'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Brüt Süre */}
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                              {record.status === 'on_leave' ? (
                                <span className="text-slate-400 italic font-normal">-</span>
                              ) : durationMinutes > 0 ? (
                                <span>{formatMinutesToDuration(durationMinutes)}</span>
                              ) : record.status === 'checked_in' || record.status === 'pending_checkout_approval' ? (
                                <span className="text-blue-600 font-semibold">Devam ediyor</span>
                              ) : record.status === 'pending_checkin_approval' ? (
                                <span className="text-amber-600 font-semibold text-xs">Onay Bekliyor</span>
                              ) : (
                                '-'
                              )}
                            </td>

                            {/* Mola Özeti */}
                            <td className="py-3 px-3">
                              {record.breaks && record.breaks.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRecordBreakAccordion(record.id)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800/80 transition-all cursor-pointer group"
                                  title="Mola dökümünü ve detaylarını aç/kapat"
                                >
                                  <Coffee className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>
                                    {record.breaks.length} Mola ({breakMinutes} dk)
                                  </span>
                                  <ChevronDown
                                    className={`w-3 h-3 text-amber-600 transition-transform duration-200 ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>

                            {/* Net Mesai */}
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                              {record.status === 'on_leave' ? (
                                <span className="text-slate-400 italic font-normal">-</span>
                              ) : durationMinutes > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                                  {formatMinutesToDuration(netMinutes)}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold text-xs">Devam ediyor</span>
                              )}
                            </td>

                            {/* Not / Açıklama */}
                            <td className="py-3 px-3">
                              {record.status === 'on_leave' ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 font-black text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <span>İzinli</span>
                                  </span>
                                  {record.approvalNote && (
                                    <span
                                      className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[140px] hidden sm:inline"
                                      title={record.approvalNote}
                                    >
                                      ({record.approvalNote})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span
                                  className="text-slate-500 text-[11px] max-w-[150px] truncate block"
                                  title={record.notes || record.approvalNote || ''}
                                >
                                  {record.notes || record.approvalNote || '-'}
                                </span>
                              )}
                            </td>

                            {/* İşlem (Admin Only) */}
                            {isAdmin && (
                              <td className="py-3 px-3 text-right">
                                {record.status === 'on_leave' ? (
                                  <div className="flex items-center justify-end">
                                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                                      Onaylı İzin
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    {record.status === 'pending_checkin_approval' && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={processingApprovalId === record.id}
                                          onClick={() => handleApprove(record.id, 'checkin')}
                                          className="px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors"
                                        >
                                          Onayla
                                        </button>
                                        <button
                                          type="button"
                                          disabled={processingApprovalId === record.id}
                                          onClick={() => handleReject(record.id, 'checkin')}
                                          className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors"
                                        >
                                          Reddet
                                        </button>
                                      </>
                                    )}

                                    {record.status === 'pending_checkout_approval' && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={processingApprovalId === record.id}
                                          onClick={() => handleApprove(record.id, 'checkout')}
                                          className="px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors"
                                        >
                                          Onayla
                                        </button>
                                        <button
                                          type="button"
                                          disabled={processingApprovalId === record.id}
                                          onClick={() => handleReject(record.id, 'checkout')}
                                          className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors"
                                        >
                                          Reddet
                                        </button>
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(record.userName + ' kullanıcısının bu mesai kaydını silmek istediğinize emin misiniz?')) {
                                          deleteAttendanceRecord(record.id);
                                        }
                                      }}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                      title="Kaydı Sil"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>

                          {/* Mola Akordeon Detay Çekmecesi */}
                          {isExpanded && (
                            <tr className="bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200/40 dark:border-amber-800/40 animate-in fade-in">
                              <td colSpan={isAdmin ? 14 : 12} className="p-3 sm:p-4">
                                <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 shadow-xs space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black">
                                        <Coffee className="w-4 h-4" />
                                      </div>
                                      <span className="font-black text-xs text-slate-800 dark:text-slate-200">
                                        {record.userName} - Mola Detay Çekmecesi ({record.date})
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="text-slate-500">
                                        Brüt: <strong>{formatMinutesToDuration(durationMinutes)}</strong>
                                      </span>
                                      <span className="text-slate-300 dark:text-slate-700">•</span>
                                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                                        Toplam Mola: {formatMinutesToDuration(breakMinutes)}
                                      </span>
                                      <span className="text-slate-300 dark:text-slate-700">•</span>
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                        Net Çalışma: {formatMinutesToDuration(netMinutes)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Mola Kartları */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                                    {record.breaks?.map((b, idx) => {
                                      const bStart = new Date(b.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                                      const bEnd = b.endTime ? new Date(b.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Devam ediyor';
                                      const bDur = b.durationMinutes || (b.endTime ? Math.max(1, Math.round((b.endTime - b.startTime) / 60000)) : Math.max(1, Math.round((Date.now() - b.startTime) / 60000)));
                                      const isOngoing = !b.endTime;

                                      return (
                                        <div
                                          key={b.id || idx}
                                          className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                                            isOngoing
                                              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 shadow-xs ring-1 ring-amber-400/30'
                                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                              <span>☕ {idx + 1}. Mola</span>
                                              {isOngoing && (
                                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white animate-pulse">
                                                  Aktif
                                                </span>
                                              )}
                                            </span>
                                            <span className="font-black text-amber-600 dark:text-amber-400 text-xs">
                                              {bDur} dk
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                            <span>{bStart} - {bEnd}</span>
                                            {b.note && <span className="italic text-slate-400 max-w-[80px] truncate" title={b.note}>({b.note})</span>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODÜL 4: İZİN TAKİBİ */}
      {/* ============================================================ */}
      {activeSection === 'leaves' && (
        <div className="space-y-5">
          {/* Üst Bar: Başlık ve Yeni İzin Butonu */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <CalendarRange className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Personel İzin Yönetimi ve Talepler</span>
                  {pendingLeaveCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-600 text-white">
                      {pendingLeaveCount} Bekleyen
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Saatlik ve günlük izin başvuruları, yönetici onayları ve geçmiş izin takibi.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenLeaveModal}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-black shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Yeni İzin Talebi Oluştur</span>
            </button>
          </div>

          {/* İzin Filtresi ve İzin Talepleri Tablosu */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">İzin Durumu:</span>
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setLeaveStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    leaveStatusFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Tümü ({leaveRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    leaveStatusFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Bekleyen ({leaveRequests.filter((l) => l.status === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveStatusFilter('approved')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    leaveStatusFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Onaylanan
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveStatusFilter('rejected')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    leaveStatusFilter === 'rejected'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Reddedilen
                </button>
              </div>
            </div>
        {userLeaveRequests.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-sm">
              {leaveStatusFilter === 'all'
                ? 'Kayıtlı herhangi bir izin talebi bulunamadı.'
                : 'Bu filtreye uygun izin talebi bulunamadı.'}
            </p>
            <button
              type="button"
              onClick={handleOpenLeaveModal}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>İlk İzin Talebini Oluştur</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/40 uppercase font-black text-[10px] text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3">Personel</th>
                  <th className="py-3 px-3">Tür</th>
                  <th className="py-3 px-3">Tarih / Saat</th>
                  <th className="py-3 px-3">Süre</th>
                  <th className="py-3 px-3">Gerekçe</th>
                  <th className="py-3 px-3">Durum</th>
                  <th className="py-3 px-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {userLeaveRequests.map((req) => {
                  const isOwner = user?.id === req.userId;
                  const isProcessing = processingLeaveId === req.id;

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Personel */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{req.userName}</span>
                          {req.userRole === 'admin' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                              Yönetici
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(req.requestedAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Tür */}
                      <td className="py-3 px-3">
                        {req.leaveType === 'hourly' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            ⏱️ Saatlik
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                            📅 Günlük
                          </span>
                        )}
                      </td>

                      {/* Tarih / Saat */}
                      <td className="py-3 px-3">
                        {req.leaveType === 'hourly' ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {new Date(req.date).toLocaleDateString('tr-TR', {
                                day: 'numeric',
                                month: 'long',
                                weekday: 'short',
                              })}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {req.startTime} - {req.endTime}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {new Date(req.date).toLocaleDateString('tr-TR', {
                                day: 'numeric',
                                month: 'short',
                              })}
                              {req.endDate && req.endDate !== req.date && (
                                <span>
                                  {' '}
                                  -{' '}
                                  {new Date(req.endDate).toLocaleDateString('tr-TR', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Süre */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-slate-100">
                          {req.durationText}
                        </span>
                      </td>

                      {/* Gerekçe */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate" title={req.reason}>
                          {req.reason}
                        </p>
                        {req.reviewNote && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5 truncate" title={req.reviewNote}>
                            Not: {req.reviewNote}
                          </p>
                        )}
                      </td>

                      {/* Durum */}
                      <td className="py-3 px-3">
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>Onay Bekliyor</span>
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Onaylandı</span>
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                            <UserX className="w-3 h-3" />
                            <span>Reddedildi</span>
                          </span>
                        )}
                        {req.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                            İptal Edildi
                          </span>
                        )}
                      </td>

                      {/* İşlemler */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Admin Onayla / Reddet */}
                          {isAdmin && req.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleApproveLeave(req.id)}
                                className="px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                <span>Onayla</span>
                              </button>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleRejectLeave(req.id)}
                                className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                <span>Reddet</span>
                              </button>
                            </>
                          )}

                          {/* Personel İptal Et */}
                          {isOwner && req.status === 'pending' && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleCancelMyLeave(req.id)}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              İptal Et
                            </button>
                          )}

                          {/* Admin Silme */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`${req.userName} kullanıcısının izin talebini silmek istediğinize emin misiniz?`)) {
                                  deleteLeaveRequest(req.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Talebi Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

      {/* --- MODAL: KONUM DIŞI GİRİŞ / ÇIKIŞ YÖNETİCİ ONAY MODALI --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-300 dark:border-amber-800 space-y-5">
            {/* Modal Başlık */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {confirmModal.type === 'checkin' ? 'Konum Dışı Giriş' : 'Konum Dışı Çıkış'}
                  </h3>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    İş Yeri Alanı Dışındasınız
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, note: '' }))}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Kullanıcının İstediği Birebir İkaz Metni */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2">
              <p className="text-sm font-black text-amber-900 dark:text-amber-200 leading-snug">
                {confirmModal.type === 'checkin'
                  ? 'Konum dışında giriş yapıyorsunuz. Yönetici onayına gönderilsin mi?'
                  : 'Konum dışında çıkış yapıyorsunuz. Yönetici onayına gönderilsin mi?'}
              </p>
              <div className="pt-2 border-t border-amber-200/70 dark:border-amber-900/60 space-y-1 text-xs text-amber-800/90 dark:text-amber-300/90">
                <div className="flex items-center gap-1.5 font-bold">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    İş yerine olan mesafeniz: {confirmModal.distance !== undefined ? LocationService.formatDistance(confirmModal.distance) : 'Hesaplanıyor...'}
                  </span>
                </div>
                {confirmModal.address && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 pl-5">
                    {confirmModal.address}
                  </div>
                )}
              </div>
            </div>

            {/* İsteğe Bağlı Açıklama Notu */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Yöneticiye Not / Açıklama (İsteğe bağlı):</span>
              </label>
              <textarea
                value={confirmModal.note}
                onChange={(e) => setConfirmModal((prev) => ({ ...prev, note: e.target.value }))}
                placeholder={
                  confirmModal.type === 'checkin'
                    ? 'Örn: Doğrudan servise / başka kuruma geçtim...'
                    : 'Örn: İş yerinden çıktım, çıkış yapmayı unuttuğum için şu an yapıyorum...'
                }
                rows={2}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
              />
            </div>

            {/* Butonlar */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, note: '' }))}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Yönetici Onayına Gönder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: İŞTEN ÇIKIŞ "EMİN MİSİNİZ?" ONAY MODALI --- */}
      {showCheckOutConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm sm:max-w-md w-full p-6 shadow-2xl border border-rose-200 dark:border-rose-900/60 space-y-5">
            {/* Modal Başlık */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    İşten Çıkış Onayı
                  </h3>
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Mesai Sonlandırma
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckOutConfirmModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* İkaz Metni */}
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2 text-center">
              <p className="text-base font-black text-rose-950 dark:text-rose-100 leading-snug">
                İşten çıkış yapmak istiyorsunuz, Emin misiniz?
              </p>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
                Yanlışlıkla bastıysanız <strong>"Hayır"</strong> butonuna dokunarak mesainize kesintisiz devam edebilirsiniz.
              </p>
            </div>

            {/* Seçim Butonları: Hayır / Evet */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowCheckOutConfirmModal(false)}
                className="w-full py-3 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer text-center"
              >
                Hayır (Mesaiye Devam Et)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCheckOutConfirmModal(false);
                  handleCheckOut(false);
                }}
                className="w-full py-3 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white shadow-lg shadow-rose-600/25 active:scale-95 transition-all cursor-pointer text-center"
              >
                Evet (Çıkış Yap)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: KONUM SERVİSLERİ KAPALI / AÇILMASI GEREKİYOR BİLGİLENDİRME MODALI --- */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-rose-300 dark:border-rose-800 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Başlık */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-sm">
                  <MapPinOff className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Konum Servisleri Kapalı
                  </h3>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    İşe Giriş ve Çıkış Yapılamaz
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* İkaz Metni Kutusu */}
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2">
              <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-black text-sm">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Konum Servislerinin Açılması Gerekmektedir</span>
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-300/90 leading-relaxed font-medium">
                {locationErrorMessage || 'İşe giriş ve çıkış işlemlerinin doğrulanabilmesi için cihazınızın konum (GPS) servisinin açık olması zorunludur.'}
              </p>
            </div>

            {/* Nasıl Açılır Rehberi */}
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Nasıl Açılır?
              </span>
              <ul className="space-y-1.5 pl-4 list-disc text-[11px] leading-relaxed">
                <li>
                  <strong>Telefon veya Tablet:</strong> Bildirim çubuğunu / Denetim Merkezini aşağı kaydırıp <strong>"Konum" (GPS)</strong> simgesini açın.
                </li>
                <li>
                  <strong>Tarayıcı İzni:</strong> Adres çubuğundaki kilit 🔒 veya site ayarları simgesine dokunup <strong>Konum</strong> iznini <em>"İzin Ver"</em> olarak ayarlayın.
                </li>
                <li>
                  <strong>Bilgisayar:</strong> İşletim sistemi ayarlarından (Windows/Mac) Konum Servislerinin etkin olduğunu kontrol edin.
                </li>
              </ul>
            </div>

            {/* Aksiyon Butonları */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Kapat
              </button>
              <button
                type="button"
                disabled={isCheckingDistance}
                onClick={() => checkLiveDistance(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCheckingDistance ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Konumu Açtım, Yeniden Dene</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: İZİN TALEBİ OLUŞTURMA MODALI --- */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-blue-200 dark:border-blue-900/60 space-y-5">
            {/* Modal Başlık */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <CalendarPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    İzin Talebi Oluştur
                  </h3>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Yönetici onayına sunulacak izin
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              {/* İzin Türü Seçici (Saatlik / Günlük) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  İzin Türü
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setLeaveType('hourly')}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      leaveType === 'hourly'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <span>⏱️ Saatlik İzin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('daily')}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      leaveType === 'daily'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <span>📅 Günlük İzin</span>
                  </button>
                </div>
              </div>

              {/* Saatlik İzin Form Alanları */}
              {leaveType === 'hourly' && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      İzin Tarihi
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Başlangıç Saati
                      </label>
                      <input
                        type="time"
                        required
                        value={leaveStartTime}
                        onChange={(e) => setLeaveStartTime(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Bitiş Saati
                      </label>
                      <input
                        type="time"
                        required
                        value={leaveEndTime}
                        onChange={(e) => setLeaveEndTime(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500">Hesaplanan Süre:</span>
                    <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg">
                      {calculatedDuration}
                    </span>
                  </div>
                </div>
              )}

              {/* Günlük İzin Form Alanları */}
              {leaveType === 'daily' && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Başlangıç Tarihi
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveDate}
                        onChange={(e) => {
                          setLeaveDate(e.target.value);
                          if (!leaveEndDate || leaveEndDate < e.target.value) {
                            setLeaveEndDate(e.target.value);
                          }
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Bitiş Tarihi
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveEndDate}
                        min={leaveDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500">Hesaplanan Gün:</span>
                    <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg">
                      {calculatedDuration}
                    </span>
                  </div>
                </div>
              )}

              {/* Gerekçe */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>İzin Alma Nedeni / Mazeret</span>
                  <span className="text-[10px] text-rose-500 font-semibold">* Zorunlu</span>
                </label>
                <textarea
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Örn: Doktor randevusu, resmi daire işleri, ailevi durum vb."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>

              {/* Bilgilendirme Notu */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                ℹ️ Talebiniz yöneticilere <strong>anında bildirim (push)</strong> olarak iletilecektir. Sonuçlandığında telefonunuza bildirim gelecektir.
              </div>

              {/* Butonlar */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLeave}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingLeave ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Yönetici Onayına Gönder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
