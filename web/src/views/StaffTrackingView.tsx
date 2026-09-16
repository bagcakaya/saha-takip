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
  History,
  Trash2,
  AlertTriangle,
  Send,
  X,
  MessageSquare,
  CalendarPlus,
  FileText,
  Check,
  Store,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../types/auth';
import { useStorage } from '../context/StorageContext';
import { LocationService } from '../services/locationService';

export const StaffTrackingView: React.FC = () => {
  const { user } = useAuth();
  const {
    workplaceLocation,
    branches,
    attendanceRecords,
    updateWorkplaceLocation,
    checkInStaff,
    checkOutStaff,
    approveAttendance,
    rejectAttendance,
    cancelAttendanceRequest,
    deleteAttendanceRecord,
    refreshAttendance,
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

  const checkLiveDistance = async () => {
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
    } catch (err: any) {
      setDistanceError(err?.message || 'Konum alınamadı.');
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
    try {
      setIsProcessingAction(true);
      setActionFeedback(null);
      const res = await checkInStaff({ allowOutside, note: customNote });

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
      setActionFeedback({ type: 'error', text: e?.message || 'İşlem gerçekleştirilemedi.' });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCheckOut = async (allowOutside = false, customNote?: string) => {
    try {
      setIsProcessingAction(true);
      setActionFeedback(null);
      const res = await checkOutStaff({ allowOutside, note: customNote });

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
      setActionFeedback({ type: 'error', text: e?.message || 'İşlem gerçekleştirilemedi.' });
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

  // Admin: All pending approval requests
  const pendingRequests = useMemo(() => {
    return attendanceRecords.filter(
      (r) => r.status === 'pending_checkin_approval' || r.status === 'pending_checkout_approval'
    );
  }, [attendanceRecords]);

  // --- 5. Date Filter for Table (Admin & Staff) ---
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const filteredRecords = useMemo(() => {
    let list = attendanceRecords;
    if (selectedDate) {
      list = list.filter((r) => r.date === selectedDate);
    }
    // If not admin, only show own records
    if (!isAdmin && user) {
      list = list.filter((r) => r.userId === user.id);
    }
    return list;
  }, [attendanceRecords, selectedDate, isAdmin, user]);

  // Statistics for selected date
  const stats = useMemo(() => {
    const list = attendanceRecords.filter((r) => r.date === selectedDate);
    const active = list.filter((r) => r.status === 'checked_in').length;
    const completed = list.filter((r) => r.status === 'completed').length;
    return {
      total: list.length,
      active,
      completed,
    };
  }, [attendanceRecords, selectedDate]);

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

  // --- 6. Staff Leave Requests State & Handlers ---
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'leaves'>('attendance');

  useEffect(() => {
    const handleSetSubTab = (e: any) => {
      if (e?.detail?.subTab === 'leaves' || e?.detail?.filter === 'leaves') {
        setActiveSubTab('leaves');
      } else if (e?.detail?.subTab === 'attendance' || e?.detail?.filter === 'attendance') {
        setActiveSubTab('attendance');
      }
    };
    window.addEventListener('saha:set-staff-subtab' as any, handleSetSubTab);
    return () => window.removeEventListener('saha:set-staff-subtab' as any, handleSetSubTab);
  }, []);

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-emerald-500/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider mb-2 border border-white/20">
            <UserCheck className="w-3.5 h-3.5" />
            <span>GPS Geofencing Takip</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
            Personel Giriş / Çıkış Takibi
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-1">
            İşe giriş ve çıkışlar, yöneticinin belirlediği 20 metre çap doğrulaması ile anlık denetlenir.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleOpenLeaveModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-emerald-900 hover:bg-emerald-50 active:scale-95 text-xs font-black shadow-lg shadow-black/10 transition-all cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4 text-emerald-600" />
            <span>İzin Talebi Oluştur</span>
          </button>
          <button
            onClick={() => refreshAttendance()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 active:scale-95 text-white text-xs font-black backdrop-blur-md border border-white/30 transition-all cursor-pointer"
            title="Kayıtları Yenile"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* --- ADMIN: ONAY BEKLEYEN PERSONEL TALEPLERİ PANELİ --- */}
      {isAdmin && pendingRequests.length > 0 && (
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
      {isAdmin && pendingLeaveCount > 0 && (
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
              onClick={() => setActiveSubTab('leaves')}
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
      {isAdmin && (
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
                onClick={checkLiveDistance}
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

            {distanceError && (
              <p className="text-[11px] text-red-500 font-semibold">{distanceError}</p>
            )}
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

          {/* Büyük Butonlar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Buton 1: İşe Geldim (Yeşil) */}
            <button
              type="button"
              onClick={() => handleCheckIn(false)}
              disabled={isProcessingAction || isCheckedIn || isPendingCheckIn || isPendingCheckOut}
              className={"relative overflow-hidden rounded-2xl p-5 text-left flex flex-col justify-between transition-all duration-200 " + (
                isCheckedIn || isPendingCheckIn || isPendingCheckOut
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
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
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/20">
                  {isPendingCheckIn ? 'Onay Bekliyor' : 'Giriş Yap'}
                </span>
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black tracking-tight">
                  🟢 İşe Geldim
                </h4>
                <p className="text-[11px] opacity-90 mt-1 leading-relaxed">
                  İş yerinde veya <strong>konum dışındaysanız yönetici onayıyla</strong> mesainizi başlatın.
                </p>
              </div>
            </button>

            {/* Buton 2: İşten Çıkış Yaptım (Kırmızı) */}
            <button
              type="button"
              onClick={() => setShowCheckOutConfirmModal(true)}
              disabled={isProcessingAction || !isCheckedIn || isPendingCheckOut}
              className={"relative overflow-hidden rounded-2xl p-5 text-left flex flex-col justify-between transition-all duration-200 " + (
                !isCheckedIn || isPendingCheckOut
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
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
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/20">
                  {isPendingCheckOut ? 'Onay Bekliyor' : 'Çıkış Yap'}
                </span>
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black tracking-tight">
                  🔴 İşten Çıkış Yaptım
                </h4>
                <p className="text-[11px] opacity-90 mt-1 leading-relaxed">
                  İş yerinde veya <strong>konum dışındaysanız yönetici onayıyla</strong> mesaiyi bitirin.
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                  TOPLAM MESAİ
                </span>
                <span className="font-black text-blue-600 dark:text-blue-400">
                  {currentUserTodayRecord.workDurationMinutes
                    ? (Math.floor(currentUserTodayRecord.workDurationMinutes / 60) + ' sa ' + (currentUserTodayRecord.workDurationMinutes % 60) + ' dk')
                    : activeDurationText || '-'}
                </span>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      {/* --- SECTION 3: CANLI İZLEME TABLOSU VE GEÇMİŞ KAYITLAR --- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 w-fit">
            <button
              type="button"
              onClick={() => setActiveSubTab('attendance')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSubTab === 'attendance'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4 text-emerald-600" />
              <span>{isAdmin ? 'Mesai Tablosu' : 'Mesai Geçmişim'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('leaves')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSubTab === 'leaves'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>{isAdmin ? 'İzin Talepleri' : 'İzinlerim'}</span>
              {pendingLeaveCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black animate-pulse">
                  {pendingLeaveCount}
                </span>
              )}
            </button>
          </div>

          {activeSubTab === 'attendance' ? (
            /* Tarih Seçici */
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 text-xs font-bold cursor-pointer"
                >
                  Bugün
                </button>
              )}
            </div>
          ) : (
            /* İzin Filtresi ve Yeni İzin Butonu */
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setLeaveStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
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
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
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
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    leaveStatusFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Onaylanan
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenLeaveModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>İzin Al</span>
              </button>
            </div>
          )}
        </div>

        {activeSubTab === 'attendance' && (
          <>
            {/* İstatistik Çubukları (Admin için) */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 block">
                Toplam Giriş
              </span>
              <span className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100">
                {stats.total} Kişi
              </span>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                Şu An Mesaide
              </span>
              <span className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                {stats.active} Kişi
              </span>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
              <span className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 block">
                Çıkış Yapanlar
              </span>
              <span className="text-base sm:text-xl font-black text-blue-700 dark:text-blue-300">
                {stats.completed} Kişi
              </span>
            </div>
          </div>
        )}

        {/* Kayıtlar Listesi */}
        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Clock className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-xs sm:text-sm font-bold">
              Bu tarihe ait herhangi bir giriş / çıkış kaydı bulunamadı.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="py-3 px-3">Personel</th>
                  <th className="py-3 px-3">Şube</th>
                  <th className="py-3 px-3">Durum</th>
                  <th className="py-3 px-3">Giriş Saati</th>
                  <th className="py-3 px-3">Giriş Mesafesi</th>
                  <th className="py-3 px-3">Çıkış Saati</th>
                  <th className="py-3 px-3">Çıkış Mesafesi</th>
                  <th className="py-3 px-3">Toplam Süre</th>
                  {isAdmin && <th className="py-3 px-3 text-right">İşlem</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {filteredRecords.map((record) => {
                  const checkInDate = new Date(record.checkInTime);
                  const checkOutDate = record.checkOutTime
                    ? new Date(record.checkOutTime)
                    : null;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
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
                        {record.status === 'pending_checkin_approval' ? (
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
                        {checkInDate.toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Giriş Mesafesi */}
                      <td className="py-3 px-3">
                        {record.checkInDistance !== undefined ? (
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
                        {checkOutDate ? (
                          checkOutDate.toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span className="text-slate-400 italic font-normal">-</span>
                        )}
                      </td>

                      {/* Çıkış Mesafesi */}
                      <td className="py-3 px-3">
                        {record.checkOutDistance !== undefined ? (
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
                        ) : (
                          <span className="text-slate-400 italic font-normal">-</span>
                        )}
                      </td>

                      {/* Toplam Süre */}
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {record.workDurationMinutes ? (
                          <span>
                            {Math.floor(record.workDurationMinutes / 60)} sa{' '}
                            {record.workDurationMinutes % 60} dk
                          </span>
                        ) : record.status === 'checked_in' || record.status === 'pending_checkout_approval' ? (
                          <span className="text-emerald-600 font-semibold">Devam ediyor</span>
                        ) : record.status === 'pending_checkin_approval' ? (
                          <span className="text-amber-600 font-semibold text-xs">Onay Bekliyor</span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* İşlem (Admin Only) */}
                      {isAdmin && (
                        <td className="py-3 px-3 text-right">
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
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    )}

    {/* SUB-TAB 2: İZİN TALEPLERİ */}
    {activeSubTab === 'leaves' && (
      <div className="space-y-4">
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
    )}
  </div>

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
