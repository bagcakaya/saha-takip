import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  RefreshControl,
  Platform,
  Modal,
  Dimensions,
  BackHandler,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { LocationService, GeolocationResult } from '../../services/locationService';
import {
  Shield,
  MapPin,
  Compass,
  CheckCircle2,
  Clock,
  RotateCw,
  LogOut,
  Calendar,
  Users,
  Store,
  Bell,
  Sun,
  Moon,
  ArrowLeft,
  Settings,
  FileSpreadsheet,
  FileText,
  Check,
  ChevronDown,
  X,
  Radio,
  CalendarDays,
  UserCheck,
  Building2,
  UserX,
  Trash2,
  Coffee,
  Play,
  Plus,
  Send,
} from 'lucide-react-native';
import { AttendanceRecord, WorkplaceLocation } from '../../types/storage';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';
import { NotificationStatusModal } from '../../components/NotificationStatusModal';
import {
  exportAttendanceToExcel,
  exportAttendanceToPdf,
  calculateRecordDurationMinutes,
  calculateRecordBreakMinutes,
  calculateRecordNetWorkMinutes,
  formatMinutesToDuration,
  StaffAttendanceSummary,
} from '../../services/attendanceExportService';

const ALL_STAFF = [
  { id: 'usr_burak', name: 'Burak AĞCAKAYA', role: 'Saha Yetkilisi' },
  { id: 'usr_azizcan', name: 'Azizcan ISIYEL', role: 'Saha Yetkilisi' },
  { id: 'usr_murat', name: 'Murat POLAT', role: 'Yönetici' },
  { id: 'usr_admin', name: 'Sistem Yöneticisi', role: 'Yönetici' },
  { id: 'usr_soner', name: 'Soner ISIYEL', role: 'Saha Yetkilisi' },
];

type PeriodFilter = 'bugun' | 'bu_hafta' | 'bu_ay' | 'gecen_ay' | 'dun' | 'tumu';

const formatToDDMMYYYY = (iso: string) => {
  const p = iso.split('-');
  if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
  return iso;
};

const getTodayIsoDate = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2) / 3;

export default function AttendanceScreen() {
  const {
    attendanceRecords,
    leaveRequests,
    workplaceLocation,
    branches,
    checkInStaff,
    checkOutStaff,
    startBreak,
    endBreak,
    approveAttendance,
    rejectAttendance,
    requestLeave,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    refreshData,
    updateWorkplaceLocation,
  } = useStorage();
  const { user, users, logout } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();
  const router = useRouter();

  const isAdmin = user?.role === 'admin';

  // Ana Menü stili 5 alt bölüm yönetimi (Varsayılan olarak 'menu' başlar)
  type AttendanceSection = 'menu' | 'checkin_checkout' | 'breaks' | 'summary' | 'leaves' | 'workplace';
  const [activeSection, setActiveSection] = useState<AttendanceSection>('menu');

  // Android donanım geri tuşu dinleyicisi (Önceki menüye / Ana Menüye dönüş)
  useEffect(() => {
    const onBackPress = () => {
      if (activeSection !== 'menu') {
        setActiveSection('menu');
        return true;
      }
      router.push('/(tabs)');
      return true;
    };

    const backHandlerSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandlerSubscription.remove();
  }, [activeSection, router]);

  // iOS ve dokunmatik sağa kaydırma (Swipe Right) ile bir önceki menüye dönüş
  const swipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Yatay sağa kaydırma: dx > 25 ve yatay hareket dikey hareketten en az 1.8 kat baskın
          return gestureState.dx > 25 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 50 || (gestureState.dx > 25 && gestureState.vx > 0.35)) {
            if (activeSection !== 'menu') {
              setActiveSection('menu');
            } else {
              router.push('/(tabs)');
            }
          }
        },
      }),
    [activeSection, router]
  );

  const SECTION_INFO: Record<string, { title: string; subtitle: string; icon: any; color: string }> = {
    checkin_checkout: {
      title: 'İşe Giriş & Çıkış',
      subtitle: 'GPS doğrulaması ile anlık işe geliş ve çıkış kayıtları',
      icon: UserCheck,
      color: '#10b981',
    },
    breaks: {
      title: 'Mola Yönetimi',
      subtitle: 'Canlı mola sayacı ve günlük mola takibi',
      icon: Coffee,
      color: '#f59e0b',
    },
    summary: {
      title: 'Mesai Özeti & Tablo',
      subtitle: 'Çalışma geçmişi, dönem filtreleri ve raporlar',
      icon: Clock,
      color: '#3b82f6',
    },
    leaves: {
      title: 'İzin Takibi',
      subtitle: 'Saatlik ve günlük izin talepleri ve yönetici onayları',
      icon: CalendarDays,
      color: '#8b5cf6',
    },
    workplace: {
      title: 'Merkez İş Yeri Lokasyonu',
      subtitle: '20 metre toleranslı merkez GPS koordinatları',
      icon: Building2,
      color: '#0d9488',
    },
  };

  // İzin Takibi Durumları
  const [leaveFilter, setLeaveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [newLeaveType, setNewLeaveType] = useState<'daily' | 'hourly'>('daily');
  const [newLeaveStartDate, setNewLeaveStartDate] = useState(() => getTodayIsoDate());
  const [newLeaveEndDate, setNewLeaveEndDate] = useState(() => getTodayIsoDate());
  const [newLeaveStartTime, setNewLeaveStartTime] = useState('09:00');
  const [newLeaveEndTime, setNewLeaveEndTime] = useState('13:00');
  const [newLeaveDuration, setNewLeaveDuration] = useState('1 Gün');
  const [newLeaveReason, setNewLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const handleOpenNewLeaveModal = () => {
    const today = getTodayIsoDate();
    setNewLeaveStartDate(today);
    setNewLeaveEndDate(today);
    setNewLeaveStartTime('09:00');
    setNewLeaveEndTime('13:00');
    setNewLeaveType('daily');
    setNewLeaveDuration('1 Gün');
    setNewLeaveReason('');
    setIsLeaveModalOpen(true);
  };

  const handleSaveLeaveRequest = async () => {
    if (!newLeaveReason.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen izin alma gerekçenizi / mazeretinizi belirtin.');
      return;
    }
    setIsSubmittingLeave(true);
    try {
      const res = await requestLeave({
        startDate: newLeaveStartDate,
        endDate: newLeaveType === 'daily' ? newLeaveEndDate : newLeaveStartDate,
        startTime: newLeaveType === 'hourly' ? newLeaveStartTime : undefined,
        endTime: newLeaveType === 'hourly' ? newLeaveEndTime : undefined,
        leaveType: newLeaveType,
        durationText: newLeaveDuration,
        reason: newLeaveReason.trim(),
      });
      setIsSubmittingLeave(false);
      if (res.success) {
        setIsLeaveModalOpen(false);
        Alert.alert('Başarılı', res.message || 'İzin talebiniz oluşturuldu.');
      } else {
        Alert.alert('Hata', res.message);
      }
    } catch (err: any) {
      setIsSubmittingLeave(false);
      Alert.alert('Hata', err?.message || 'İzin talebi gönderilemedi.');
    }
  };

  const handleApproveLeave = (requestId: string, staffName: string) => {
    Alert.alert(
      'İzin Onayı',
      `"${staffName}" personeline ait izin talebini onaylamak istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          onPress: async () => {
            const res = await approveLeaveRequest(requestId);
            if (res.success) {
              Alert.alert('Başarılı', res.message);
            } else {
              Alert.alert('Hata', res.message);
            }
          },
        },
      ]
    );
  };

  const handleRejectLeave = (requestId: string, staffName: string) => {
    Alert.alert(
      'İzin Reddi',
      `"${staffName}" personeline ait izin talebini reddetmek istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Reddet',
          style: 'destructive',
          onPress: async () => {
            const res = await rejectLeaveRequest(requestId, 'Yönetici tarafından reddedildi.');
            if (res.success) {
              Alert.alert('Bilgi', res.message);
            } else {
              Alert.alert('Hata', res.message);
            }
          },
        },
      ]
    );
  };

  const handleCancelLeave = (requestId: string) => {
    Alert.alert(
      'İzin Talebini İptal Et',
      'İzin talebinizi geri çekmek istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İptal Et',
          style: 'destructive',
          onPress: async () => {
            const res = await cancelLeaveRequest(requestId);
            if (res.success) {
              Alert.alert('Bilgi', res.message);
            } else {
              Alert.alert('Hata', res.message);
            }
          },
        },
      ]
    );
  };

  const handleActionApprove = (record: AttendanceRecord, type: 'checkin' | 'checkout') => {
    const actionText = type === 'checkin' ? 'işe giriş' : 'işten çıkış';
    Alert.alert(
      'Mesai Onayı',
      `${record.userName} personeline ait 20 m dışı ${actionText} talebini onaylamak istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          style: 'default',
          onPress: async () => {
            const res = await approveAttendance(record.id, type);
            if (res.success) {
              Alert.alert('Başarılı', res.message);
            } else {
              Alert.alert('Hata', res.message);
            }
          },
        },
      ]
    );
  };

  const handleActionReject = (record: AttendanceRecord, type: 'checkin' | 'checkout') => {
    const actionText = type === 'checkin' ? 'işe giriş' : 'işten çıkış';
    Alert.alert(
      'Mesai Reddi',
      `${record.userName} personeline ait 20 m dışı ${actionText} talebini reddetmek istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Reddet',
          style: 'destructive',
          onPress: async () => {
            const res = await rejectAttendance(record.id, type, 'Yönetici tarafından reddedildi.');
            if (res.success) {
              Alert.alert('Bilgi', res.message);
            } else {
              Alert.alert('Hata', res.message);
            }
          },
        },
      ]
    );
  };

  // Live GPS
  const [currentPos, setCurrentPos] = useState<GeolocationResult | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mockWarning, setMockWarning] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Top bar modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

  // Workplace Geofencing Admin Form
  const [wpAddress, setWpAddress] = useState(
    workplaceLocation?.address || 'Millet Bahçe Caddesi, Lalapaşa Mahallesi, Yakutiye, Erzurum'
  );
  const [wpLat, setWpLat] = useState(workplaceLocation?.latitude || 39.9107);
  const [wpLon, setWpLon] = useState(workplaceLocation?.longitude || 41.27138);
  const [savingWp, setSavingWp] = useState(false);

  // Filters (Görsel-2)
  const [activePeriod, setActivePeriod] = useState<PeriodFilter>('bugun');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
  const [startDateStr, setStartDateStr] = useState(() => formatToDDMMYYYY(getTodayIsoDate()));
  const [endDateStr, setEndDateStr] = useState(() => formatToDDMMYYYY(getTodayIsoDate()));
  const [isExporting, setIsExporting] = useState(false);
  const [isStaffSummaryOpen, setIsStaffSummaryOpen] = useState(false);

  const fetchGps = async () => {
    setGpsLoading(true);
    setMockWarning('');
    try {
      const pos = await LocationService.getCurrentPosition();
      setCurrentPos(pos);
    } catch (e: any) {
      if (e?.isMockLocation) {
        setMockWarning(e.message);
        setCurrentPos(null);
        Alert.alert('🚨 Sahte Konum Uyarısı', e.message);
      } else {
        console.warn('GPS error:', e);
      }
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    fetchGps();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), fetchGps()]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Oturumu kapatmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // Workplace Geofence coordinate update
  const handleGetGpsForWorkplace = async () => {
    setGpsLoading(true);
    try {
      const pos = await LocationService.getCurrentPosition();
      setWpLat(pos.latitude);
      setWpLon(pos.longitude);
      if (pos.address) setWpAddress(pos.address);
      Alert.alert('Konum Alındı', `Enlem: ${pos.latitude}, Boylam: ${pos.longitude}`);
    } catch (e: any) {
      Alert.alert('Hata', 'GPS konumu alınamadı.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSaveWorkplace = async () => {
    setSavingWp(true);
    try {
      const updated: WorkplaceLocation = {
        address: wpAddress.trim(),
        latitude: wpLat,
        longitude: wpLon,
        radiusMeters: 20,
        updatedAt: Date.now(),
        updatedBy: user?.id,
        updatedByName: user?.name,
      };
      await updateWorkplaceLocation(updated);
      Alert.alert('Başarılı', 'İş yeri konumu 20 metre sabit yarıçap ile güncellendi.');
    } finally {
      setSavingWp(false);
    }
  };

  // Distance calculation from current pos to workplace
  const currentDistanceKm = useMemo(() => {
    const lat = workplaceLocation?.latitude || wpLat;
    const lon = workplaceLocation?.longitude || wpLon;
    if (!currentPos || !lat || !lon) return 5.07; // Default match to screenshot if no GPS yet
    const d = LocationService.calculateDistance(currentPos.latitude, currentPos.longitude, lat, lon);
    return Number((d / 1000).toFixed(2));
  }, [currentPos, workplaceLocation, wpLat, wpLon]);

  const isWithinGeofence = currentDistanceKm <= 0.02; // 20m

  // Today's attendance state
  const todayStr = useMemo(() => getTodayIsoDate(), []);
  const todayRecord = useMemo(() => {
    if (!user) return null;
    return attendanceRecords.find(
      (r) => (r.userId === user.id || r.userName === user.name) && r.date === todayStr
    );
  }, [attendanceRecords, user, todayStr]);

  const isCheckedIn = Boolean(todayRecord && todayRecord.checkInTime && !todayRecord.checkOutTime);
  const isCheckedOut = Boolean(todayRecord && todayRecord.checkOutTime);
  const isOnBreak = Boolean(todayRecord?.isOnBreak);

  // Rozet sayıları
  const pendingLeaveCount = useMemo(() => {
    return leaveRequests.filter((l) => l.status === 'pending').length;
  }, [leaveRequests]);

  const pendingAttendanceCount = useMemo(() => {
    if (!isAdmin) return 0;
    return attendanceRecords.filter(
      (r) =>
        r.status === 'pending_checkin_approval' ||
        r.status === 'pending_checkout_approval' ||
        (r.checkInOutside && r.checkInApprovalStatus === 'pending') ||
        (r.checkOutOutside && r.checkOutApprovalStatus === 'pending')
    ).length;
  }, [attendanceRecords, isAdmin]);

  const activeStaffOnBreak = useMemo(() => {
    return attendanceRecords.filter((r) => r.date === todayStr && r.isOnBreak);
  }, [attendanceRecords, todayStr]);

  const [isProcessingBreak, setIsProcessingBreak] = useState(false);
  const [liveBreakTimerText, setLiveBreakTimerText] = useState('');
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

  const handlePeriodChange = (period: PeriodFilter) => {
    setActivePeriod(period);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    if (period === 'bugun') {
      const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
      setStartDateStr(formatToDDMMYYYY(iso));
      setEndDateStr(formatToDDMMYYYY(iso));
    } else if (period === 'dun') {
      const prev = new Date(now);
      prev.setDate(d - 1);
      const iso = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;
      setStartDateStr(formatToDDMMYYYY(iso));
      setEndDateStr(formatToDDMMYYYY(iso));
    } else if (period === 'bu_hafta') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(d - diffToMonday);
      const monIso = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
      const todayIso = `${y}-${pad(m + 1)}-${pad(d)}`;
      setStartDateStr(formatToDDMMYYYY(monIso));
      setEndDateStr(formatToDDMMYYYY(todayIso));
    } else if (period === 'bu_ay') {
      const startIso = `${y}-${pad(m + 1)}-01`;
      const todayIso = `${y}-${pad(m + 1)}-${pad(d)}`;
      setStartDateStr(formatToDDMMYYYY(startIso));
      setEndDateStr(formatToDDMMYYYY(todayIso));
    } else if (period === 'gecen_ay') {
      const firstDay = new Date(y, m - 1, 1);
      const lastDay = new Date(y, m, 0);
      const sIso = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-01`;
      const eIso = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
      setStartDateStr(formatToDDMMYYYY(sIso));
      setEndDateStr(formatToDDMMYYYY(eIso));
    } else if (period === 'tumu') {
      setStartDateStr('Tümü');
      setEndDateStr('Tümü');
    }
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    const res = await checkInStaff();
    setActionLoading(false);
    if (res.success) {
      setMockWarning('');
      Alert.alert('Mesai Başladı', res.message);
    } else {
      if (res.isMockLocation) {
        setMockWarning(res.message);
        Alert.alert('🚨 Sahte Konum Engellendi', res.message);
      } else {
        Alert.alert('Bilgi', res.message);
      }
    }
  };

  const handleCheckOut = async () => {
    Alert.alert('Mesaiyi Bitir', 'Bugünkü mesainizi sonlandırmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Evet, Bitir',
        onPress: async () => {
          setActionLoading(true);
          const res = await checkOutStaff();
          setActionLoading(false);
          if (res.success) {
            setMockWarning('');
            Alert.alert('Mesai Tamamlandı', res.message);
          } else {
            if (res.isMockLocation) {
              setMockWarning(res.message);
              Alert.alert('🚨 Sahte Konum Engellendi', res.message);
            } else {
              Alert.alert('Bilgi', res.message);
            }
          }
        },
      },
    ]);
  };

  // Live break stopwatch
  useEffect(() => {
    if (!isOnBreak || !todayRecord?.currentBreakStartTime) {
      setLiveBreakTimerText('');
      return;
    }

    const updateBreakTimer = () => {
      const startTime = todayRecord.currentBreakStartTime || Date.now();
      const diffMs = Math.max(0, Date.now() - startTime);
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
  }, [isOnBreak, todayRecord?.currentBreakStartTime]);

  const handleStartBreak = async () => {
    if (isProcessingBreak) return;
    setIsProcessingBreak(true);
    try {
      const res = await startBreak();
      if (!res.success) {
        Alert.alert('Bilgi', res.message);
      }
    } catch (err: any) {
      Alert.alert('Hata', 'Mola başlatılırken bir hata oluştu: ' + (err?.message || err));
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
        Alert.alert('Bilgi', res.message);
      }
    } catch (err: any) {
      Alert.alert('Hata', 'Mola sonlandırılırken bir hata oluştu: ' + (err?.message || err));
    } finally {
      setIsProcessingBreak(false);
    }
  };
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const prev = new Date(now);
    prev.setDate(now.getDate() - 1);
    const yesterdayIso = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;

    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    const mondayIso = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;

    const firstDayMonthIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const firstDayLastMonthIso = `${firstDayLastMonth.getFullYear()}-${pad(firstDayLastMonth.getMonth() + 1)}-01`;
    const lastDayLastMonthIso = `${lastDayLastMonth.getFullYear()}-${pad(lastDayLastMonth.getMonth() + 1)}-${pad(lastDayLastMonth.getDate())}`;

    const list = attendanceRecords.filter((r) => {
      // Staff filter
      if (selectedStaffFilter !== 'all') {
        const staffObj = ALL_STAFF.find((s) => s.id === selectedStaffFilter);
        if (staffObj && r.userName !== staffObj.name) return false;
      }

      // Period filter
      if (activePeriod === 'bugun') {
        return r.date === todayIso;
      }
      if (activePeriod === 'dun') {
        return r.date === yesterdayIso;
      }
      if (activePeriod === 'bu_hafta') {
        return r.date >= mondayIso && r.date <= todayIso;
      }
      if (activePeriod === 'bu_ay') {
        return r.date >= firstDayMonthIso && r.date <= todayIso;
      }
      if (activePeriod === 'gecen_ay') {
        return r.date >= firstDayLastMonthIso && r.date <= lastDayLastMonthIso;
      }

      return true;
    });

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

    return [...list].sort((a, b) => {
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
  }, [attendanceRecords, selectedStaffFilter, activePeriod]);

  // 4 Stat Box Calculations (Görsel-3)
  const stats = useMemo(() => {
    let totalMinutes = 0;
    let totalBreakMinutes = 0;
    let totalNetMinutes = 0;
    const uniqueDays = new Set<string>();
    const staffSet = new Set<string>();
    let checkInCount = 0;
    let completedCount = 0;
    let inWorkCount = 0;
    let onBreakCount = 0;

    filteredRecords.forEach((r) => {
      const gross = calculateRecordDurationMinutes(r);
      const bMin = calculateRecordBreakMinutes(r);
      const net = calculateRecordNetWorkMinutes(r);

      totalMinutes += gross;
      totalBreakMinutes += bMin;
      totalNetMinutes += net;

      if (r.date && gross > 0) uniqueDays.add(r.date);
      if (r.userName) staffSet.add(r.userName);
      if (r.checkInTime) checkInCount++;
      if (r.status === 'completed') completedCount++;
      if (r.isOnBreak) onBreakCount++;
      else if (r.status === 'checked_in') inWorkCount++;
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    const netHours = Math.floor(totalNetMinutes / 60);
    const netMins = totalNetMinutes % 60;

    const breakHours = Math.floor(totalBreakMinutes / 60);
    const breakMins = totalBreakMinutes % 60;

    const daysCount = uniqueDays.size;
    const avgNetMinsPerDay = daysCount > 0 ? Math.round(totalNetMinutes / daysCount) : 0;
    const avgH = Math.floor(avgNetMinsPerDay / 60);
    const avgM = avgNetMinsPerDay % 60;

    return {
      totalFormatted: `${hours} sa ${mins} dk`,
      totalMinutes,
      netFormatted: `${netHours} sa ${netMins} dk`,
      totalNetMinutes,
      breakFormatted: `${breakHours} sa ${breakMins} dk`,
      totalBreakMinutes,
      daysCount,
      avgPerDayFormatted: `Ort. Net: ${avgH} sa ${avgM} dk / gün`,
      checkInCount,
      completedCount,
      inWorkCount,
      onBreakCount,
      activeStaffCount: staffSet.size,
      totalRegisteredStaff: ALL_STAFF.length,
    };
  }, [filteredRecords]);

  // Per-staff summary stats (Görsel-3)
  const staffSummaries = useMemo(() => {
    return ALL_STAFF.map((staff) => {
      const records = filteredRecords.filter((r) => r.userName === staff.name);
      let totalM = 0;
      let breakM = 0;
      let netM = 0;
      const days = new Set<string>();

      records.forEach((r) => {
        const gross = calculateRecordDurationMinutes(r);
        const b = calculateRecordBreakMinutes(r);
        const n = calculateRecordNetWorkMinutes(r);

        totalM += gross;
        breakM += b;
        netM += n;

        if (r.date && gross > 0) days.add(r.date);
      });

      const dCount = days.size;
      const avgNetM = dCount > 0 ? Math.round(netM / dCount) : 0;

      return {
        ...staff,
        totalText: totalM > 0 ? `${Math.floor(totalM / 60)} sa ${totalM % 60} dk` : '0 dk',
        breakText: breakM > 0 ? `${Math.floor(breakM / 60)} sa ${breakM % 60} dk` : '0 dk',
        netText: netM > 0 ? `${Math.floor(netM / 60)} sa ${netM % 60} dk` : '0 dk',
        daysText: `${dCount} gün`,
        avgText: avgNetM > 0 ? `${Math.floor(avgNetM / 60)} sa ${avgNetM % 60} dk` : '0 dk',
      };
    });
  }, [filteredRecords]);

  // Export summaries for Excel & PDF
  const exportSummaries: StaffAttendanceSummary[] = useMemo(() => {
    return ALL_STAFF.map((staff) => {
      const records = filteredRecords.filter((r) => r.userName === staff.name);
      let totalMinutes = 0;
      let totalBreakMinutes = 0;
      let totalNetMinutes = 0;
      const days = new Set<string>();
      let completedSessions = 0;
      let activeSessions = 0;
      let pendingSessions = 0;
      let branchName = 'Merkez';

      records.forEach((r) => {
        const d = calculateRecordDurationMinutes(r);
        const b = calculateRecordBreakMinutes(r);
        const n = calculateRecordNetWorkMinutes(r);

        totalMinutes += d;
        totalBreakMinutes += b;
        totalNetMinutes += n;

        if (r.date && d > 0) days.add(r.date);
        if (r.branchName) branchName = r.branchName;
        if (r.status === 'completed') completedSessions++;
        else if (r.status === 'checked_in') activeSessions++;
        else if (r.status === 'pending_checkin_approval' || r.status === 'pending_checkout_approval') pendingSessions++;
      });

      const totalDays = days.size;
      const averageMinutesPerDay = totalDays > 0 ? Math.round(totalNetMinutes / totalDays) : 0;

      return {
        userId: staff.id,
        userName: staff.name,
        userRole: staff.role === 'Yönetici' ? 'admin' : 'staff',
        branchName,
        totalDays,
        totalMinutes,
        totalDurationFormatted: formatMinutesToDuration(totalMinutes),
        totalBreakMinutes,
        totalBreakFormatted: formatMinutesToDuration(totalBreakMinutes),
        totalNetMinutes,
        totalNetFormatted: formatMinutesToDuration(totalNetMinutes),
        averageMinutesPerDay,
        averageDurationFormatted: formatMinutesToDuration(averageMinutesPerDay),
        completedSessions,
        activeSessions,
        pendingSessions,
      };
    }).filter((s) => selectedStaffFilter === 'all' || s.userId === selectedStaffFilter || s.userName === ALL_STAFF.find(st => st.id === selectedStaffFilter)?.name);
  }, [filteredRecords, selectedStaffFilter]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await exportAttendanceToExcel({
        records: filteredRecords,
        summaries: exportSummaries,
        startDate: startDateStr,
        endDate: endDateStr,
        companyName: 'POLATLAR',
      });
    } catch (e: any) {
      Alert.alert('Hata', 'Excel export hatası: ' + e?.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      await exportAttendanceToPdf({
        records: filteredRecords,
        summaries: exportSummaries,
        startDate: startDateStr,
        endDate: endDateStr,
        companyName: 'POLATLAR',
      });
    } catch (e: any) {
      Alert.alert('Hata', 'PDF export hatası: ' + e?.message);
    } finally {
      setIsExporting(false);
    }
  };

  const resetFilters = () => {
    handlePeriodChange('bugun');
    setSelectedStaffFilter('all');
  };

  const formatDistance = (meters?: number, isOutside?: boolean, isApproved?: boolean) => {
    if (meters === undefined || meters === null) {
      return { distStr: '-', isOutside: false, isApproved: false };
    }
    let distStr = '';
    if (meters >= 1000) {
      distStr = `${(meters / 1000).toFixed(2)} km`;
    } else {
      distStr = `${meters} metre`;
    }
    return { distStr, isOutside: Boolean(isOutside), isApproved: Boolean(isApproved) };
  };

  const formatMinutes = (mins?: number) => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} dk`;
    return `${h} sa ${m} dk`;
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <View
      style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}
      {...swipePanResponder.panHandlers}
    >
      {/* 1. Top Navigation Bar (Consistent with Görsel-1 format) */}
      <View
        style={[
          styles.navBar,
          {
            backgroundColor: isDark ? '#0b1329' : '#ffffff',
            borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
          },
        ]}
      >
        <View style={styles.topBarContainer}>
          {/* Ana Menü / Personel Takibi Menüsü Geri Butonu */}
          <TouchableOpacity
            style={[
              styles.homeBtn,
              activeSection !== 'menu' && { backgroundColor: '#3b82f6' },
            ]}
            onPress={() => {
              if (activeSection !== 'menu') {
                setActiveSection('menu');
              } else {
                router.push('/(tabs)');
              }
            }}
            activeOpacity={0.8}
          >
            <ArrowLeft size={18} color="#ffffff" />
            <Text style={styles.homeBtnText}>
              {activeSection !== 'menu' ? 'Geri' : 'Ana Menü'}
            </Text>
          </TouchableOpacity>

          {/* Right 5 Icon Buttons */}
          <View style={styles.topBarIconsRow}>
            {isAdmin && (
              <TouchableOpacity
                style={styles.topIconBtnUsers}
                onPress={() => setIsUserModalOpen(true)}
                activeOpacity={0.7}
              >
                <Users size={17} color="#f59e0b" />
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={styles.topIconBtnBranch}
                onPress={() => setIsCreateCompanyOpen(true)}
                activeOpacity={0.7}
              >
                <Building2 size={17} color="#3b82f6" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.topIconBtnSettings}
              onPress={() => setIsNotificationSettingsOpen(true)}
              activeOpacity={0.7}
            >
              <Settings size={17} color="#818cf8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topIconBtnTheme}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              {isDark ? (
                <Sun size={17} color="#f59e0b" />
              ) : (
                <Moon size={17} color="#6366f1" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topIconBtnLogout}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut size={17} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
      >
        {/* ============================================================ */}
        {/* 1. ANA MENÜ LAUNCHER GÖRÜNÜMÜ (activeSection === 'menu') */}
        {/* ============================================================ */}
        {activeSection === 'menu' && (
          <View style={{ paddingTop: 8 }}>
            {/* ANA MENÜ STİLİ LAUNCHER BUTONLARI (5 MODÜL) */}
            <View style={styles.attendanceLauncherGrid}>
              {[
                {
                  id: 'checkin_checkout' as const,
                  title: 'İşe Giriş / Çıkış',
                  icon: UserCheck,
                  glowColor: '#10b981',
                  badgeText: isCheckedIn ? 'Mesaide' : isCheckedOut ? 'Çıkış' : undefined,
                  badgeCount: isAdmin && pendingAttendanceCount > 0 ? pendingAttendanceCount : undefined,
                },
                {
                  id: 'breaks' as const,
                  title: 'Mola',
                  icon: Coffee,
                  glowColor: '#f59e0b',
                  badgeText: isOnBreak ? 'MOLADA' : undefined,
                  badgeCount: isAdmin && activeStaffOnBreak.length > 0 ? activeStaffOnBreak.length : undefined,
                },
                {
                  id: 'summary' as const,
                  title: 'Mesai Özeti',
                  icon: Clock,
                  glowColor: '#3b82f6',
                },
                {
                  id: 'leaves' as const,
                  title: 'İzin Takibi',
                  icon: CalendarDays,
                  glowColor: '#8b5cf6',
                  badgeCount: pendingLeaveCount > 0 ? pendingLeaveCount : undefined,
                },
                ...(isAdmin
                  ? [
                      {
                        id: 'workplace' as const,
                        title: 'Merkez İş Yeri',
                        icon: Building2,
                        glowColor: '#0d9488',
                        badgeText: '20m',
                      },
                    ]
                  : []),
              ].map((mod) => {
                const IconComponent = mod.icon;
                return (
                  <TouchableOpacity
                    key={mod.id}
                    style={styles.attendanceLauncherItem}
                    onPress={() => setActiveSection(mod.id)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.attendanceLauncherCircle,
                        {
                          borderColor: isDark ? '#334155' : '#cbd5e1',
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          shadowColor: mod.glowColor,
                          borderWidth: 1.5,
                          elevation: 3,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.attendanceLauncherIconInner,
                          { backgroundColor: mod.glowColor + '18' },
                        ]}
                      >
                        <IconComponent size={28} color={mod.glowColor} />
                      </View>

                      {/* Active Badge */}
                      {mod.badgeCount !== undefined && mod.badgeCount > 0 ? (
                        <View style={styles.launcherBadgeRed}>
                          <Text style={styles.launcherBadgeRedText}>
                            {mod.badgeCount > 99 ? '99+' : mod.badgeCount}
                          </Text>
                        </View>
                      ) : mod.badgeText ? (
                        <View style={[styles.launcherBadgePill, { backgroundColor: mod.glowColor }]}>
                          <Text style={styles.launcherBadgePillText}>{mod.badgeText}</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text
                      style={[
                        styles.attendanceLauncherLabel,
                        {
                          color: isDark ? '#ffffff' : '#0f172a',
                          fontWeight: '800',
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {mod.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* SEÇİLEN MODÜL BAŞLIK KARTI (activeSection !== 'menu') */}
        {/* ============================================================ */}
        {activeSection !== 'menu' && (
          <View
            style={[
              styles.cardBox,
              {
                backgroundColor: isDark ? '#0c152e' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
                marginBottom: 6,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: (SECTION_INFO[activeSection]?.color || '#10b981') + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {React.createElement(SECTION_INFO[activeSection]?.icon || UserCheck, {
                    size: 22,
                    color: SECTION_INFO[activeSection]?.color || '#10b981',
                  })}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>
                    {SECTION_INFO[activeSection]?.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }} numberOfLines={1}>
                    {SECTION_INFO[activeSection]?.subtitle}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                }}
                onPress={() => setActiveSection('menu')}
                activeOpacity={0.7}
              >
                <ArrowLeft size={13} color={isDark ? '#cbd5e1' : '#475569'} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#cbd5e1' : '#475569' }}>
                  Menü
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* MODÜL 5: MERKEZ İŞ YERİ (SADECE YÖNETİCİLER İÇİN) */}
        {/* ============================================================ */}
        {activeSection === 'workplace' && isAdmin && (
          <View style={{ gap: 12 }}>
            <View
              style={[
                styles.cardBox,
                {
                  backgroundColor: isDark ? '#0c152e' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                },
              ]}
            >
              <View style={styles.wpHeaderRow}>
                <View style={styles.wpIconCircle}>
                  <Shield size={18} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={[
                        styles.wpTitle,
                        { color: isDark ? '#f8fafc' : '#0f172a' },
                      ]}
                    >
                      İş Yeri / Merkez Lokasyonu
                    </Text>
                    <View style={styles.adminBadgePill}>
                      <Text style={styles.adminBadgeText}>Yönetici Yetkisi</Text>
                    </View>
                  </View>
                  <Text style={styles.wpSubtitle}>
                    Personelin 20 metre çapında işe giriş ve çıkış yapacağı merkezi belirleyin.
                  </Text>
                </View>
              </View>

              <View style={styles.radiusRow}>
                <Text style={styles.radiusLabel}>Yarıçap:</Text>
                <View style={styles.radiusFixedBadge}>
                  <Text style={styles.radiusFixedText}>20 Metre (Sabit)</Text>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={styles.fieldLabel}>İŞ YERİ ADRESİ / KOORDİNATI</Text>
                <View style={styles.inputWithButtonsRow}>
                  <TextInput
                    style={[
                      styles.wpInput,
                      {
                        backgroundColor: isDark ? '#080e21' : '#f8fafc',
                        color: isDark ? '#f8fafc' : '#0f172a',
                      },
                    ]}
                    value={wpAddress}
                    onChangeText={setWpAddress}
                    placeholder="İş yeri açık adresi..."
                    placeholderTextColor="#64748b"
                  />
                  <TouchableOpacity
                    style={styles.gpsActionBtn}
                    onPress={handleGetGpsForWorkplace}
                    activeOpacity={0.8}
                  >
                    <Compass size={18} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mapActionBtn}
                    onPress={() => LocationService.openInMaps(wpAddress, wpLat, wpLon)}
                    activeOpacity={0.8}
                  >
                    <MapPin size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.coordStatusRow}>
                <CheckCircle2 size={15} color="#10b981" />
                <Text style={styles.coordStatusText}>
                  Coğrafi konum işaretlendi ({wpLat.toFixed(5)}, {wpLon.toFixed(5)})
                </Text>
              </View>

              <TouchableOpacity
                style={styles.saveWpBtn}
                onPress={handleSaveWorkplace}
                disabled={savingWp}
                activeOpacity={0.85}
              >
                {savingWp ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Check size={16} color="#ffffff" />
                    <Text style={styles.saveWpBtnText}>Konumu Kaydet & Güncelle</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Canlı Geofence ve Mesafe Doğrulama Test Kartı */}
            <View
              style={[
                styles.cardBox,
                {
                  backgroundColor: isDark ? '#0c152e' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                },
              ]}
            >
              <View style={styles.centerWpHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={18} color="#10b981" />
                  <Text style={[styles.centerWpTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    Merkez Konumu Canlı Mesafe Testi
                  </Text>
                </View>
                <TouchableOpacity onPress={fetchGps} activeOpacity={0.7}>
                  <RotateCw size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.centerAddressText, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                {workplaceLocation?.address || wpAddress}
              </Text>

              <View
                style={[
                  styles.distanceAlertContainer,
                  { backgroundColor: isDark ? '#080e21' : '#f1f5f9' },
                ]}
              >
                <View style={styles.distanceTopRow}>
                  <Text style={styles.distanceLabel}>Anlık Mesafe:</Text>
                  <Text style={[styles.distanceValue, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    {currentDistanceKm >= 1 ? `${currentDistanceKm} km` : `${Math.round(currentDistanceKm * 1000)} metre`}
                  </Text>
                </View>

                <View
                  style={[
                    styles.distanceWarningPill,
                    isWithinGeofence ? styles.distanceSuccessPill : styles.distanceDangerPill,
                  ]}
                >
                  <Text
                    style={[
                      styles.distanceWarningText,
                      isWithinGeofence ? { color: '#34d399' } : { color: '#fb923c' },
                    ]}
                  >
                    {isWithinGeofence
                      ? `✓ İş Yeri Alanındasınız (${currentDistanceKm} km)`
                      : `⚠️ İş Yeri Dışındasınız (${currentDistanceKm} km)`}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* MODÜL 1: İŞE GİRİŞ VE ÇIKIŞ KISMI */}
        {/* ============================================================ */}
        {activeSection === 'checkin_checkout' && (
          <View style={{ gap: 12 }}>
            {/* Canlı Mesafe Kartı */}
            <View
              style={[
                styles.cardBox,
                {
                  backgroundColor: isDark ? '#0c152e' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                },
              ]}
            >
              <View style={styles.centerWpHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={18} color="#10b981" />
                  <Text style={[styles.centerWpTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    Merkez İş Yeri
                  </Text>
                </View>
                <TouchableOpacity onPress={fetchGps} activeOpacity={0.7}>
                  <RotateCw size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.centerAddressRow}>
                <Text style={styles.fieldLabel}>MERKEZ ADRESİ</Text>
                <View style={styles.limit20mBadge}>
                  <Text style={styles.limit20mText}>20 Metre Sınırı</Text>
                </View>
              </View>
              <Text style={[styles.centerAddressText, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                {workplaceLocation?.address || wpAddress}
              </Text>

              <View
                style={[
                  styles.distanceAlertContainer,
                  { backgroundColor: isDark ? '#080e21' : '#f1f5f9' },
                ]}
              >
                <View style={styles.distanceTopRow}>
                  <Text style={styles.distanceLabel}>Anlık Mesafe:</Text>
                  <Text style={[styles.distanceValue, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    {currentDistanceKm >= 1 ? `${currentDistanceKm} km` : `${Math.round(currentDistanceKm * 1000)} metre`}
                  </Text>
                </View>

                <View
                  style={[
                    styles.distanceWarningPill,
                    isWithinGeofence ? styles.distanceSuccessPill : styles.distanceDangerPill,
                  ]}
                >
                  <Text
                    style={[
                      styles.distanceWarningText,
                      isWithinGeofence ? { color: '#34d399' } : { color: '#fb923c' },
                    ]}
                  >
                    {isWithinGeofence
                      ? `✓ İş Yeri Alanındasınız (${currentDistanceKm} km)`
                      : `⚠️ İş Yeri Dışındasınız (${currentDistanceKm} km)`}
                  </Text>
                </View>

                {!!mockWarning && (
                  <View
                    style={{
                      backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                      borderColor: '#ef4444',
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 11 }}>
                      🚨 SAHTE KONUM (FAKE GPS) ENGELLENDİ
                    </Text>
                    <Text style={{ color: isDark ? '#fca5a5' : '#b91c1c', fontSize: 10, marginTop: 3 }}>
                      Yalnızca Android / iOS işletim sisteminin orijinal GPS uydularından aldığı gerçek konum geçerlidir. Lütfen sahte konum uygulamasını kapatın.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Yönetici Onayı Bekleyen Giriş/Çıkış Talepleri */}
            {isAdmin && pendingAttendanceCount > 0 && (
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                    borderColor: '#f59e0b',
                    borderWidth: 1.5,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Shield size={16} color="#d97706" />
                  <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>
                    Onay Bekleyen Personel Mesaileri ({pendingAttendanceCount})
                  </Text>
                </View>
                {attendanceRecords
                  .filter(
                    (r) =>
                      r.status === 'pending_checkin_approval' ||
                      r.status === 'pending_checkout_approval' ||
                      (r.checkInOutside && r.checkInApprovalStatus === 'pending') ||
                      (r.checkOutOutside && r.checkOutApprovalStatus === 'pending')
                  )
                  .map((rec) => {
                    const isCheckIn = rec.status === 'pending_checkin_approval' || (rec.checkInOutside && rec.checkInApprovalStatus === 'pending');
                    return (
                      <View
                        key={rec.id}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          borderWidth: 1,
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          marginBottom: 8,
                          gap: 6,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                            {rec.userName}
                          </Text>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: isCheckIn ? '#10b981' : '#ef4444' }}>
                            {isCheckIn ? '🟢 Giriş Talebi' : '🔴 Çıkış Talebi'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '600' }}>
                          ⚠️ Konum dışından ({isCheckIn ? `${Math.round(rec.checkInDistance || 0)}m` : `${Math.round(rec.checkOutDistance || 0)}m`})
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                          <TouchableOpacity
                            style={styles.leaveActionRejectBtn}
                            onPress={() => handleActionReject(rec, isCheckIn ? 'checkin' : 'checkout')}
                            activeOpacity={0.8}
                          >
                            <X size={12} color="#ef4444" />
                            <Text style={styles.leaveActionRejectBtnText}>Reddet</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.leaveActionApproveBtn}
                            onPress={() => handleActionApprove(rec, isCheckIn ? 'checkin' : 'checkout')}
                            activeOpacity={0.8}
                          >
                            <Check size={12} color="#ffffff" />
                            <Text style={styles.leaveActionApproveBtnText}>Onayla</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}

            {/* Bugünkü Mesai Durumunuz & 2 Büyük Aksiyon Kartı */}
            <View
              style={[
                styles.cardBox,
                {
                  backgroundColor: isDark ? '#0c152e' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                },
              ]}
            >
              <View style={styles.todayHeaderRow}>
                <View>
                  <Text style={[styles.todayTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    Bugünkü Mesai Durumunuz ({new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })})
                  </Text>
                  <Text style={styles.todaySubtitle}>
                    Personel: <Text style={{ color: isDark ? '#cbd5e1' : '#334155' }}>{user?.name || 'Sistem Yöneticisi'}</Text>
                  </Text>
                </View>

                <View style={[styles.todayStatusBadge, isOnBreak && { backgroundColor: '#f59e0b' }]}>
                  <Text style={[styles.todayStatusBadgeText, isOnBreak && { color: '#ffffff' }]}>
                    {isCheckedOut
                      ? 'Çıkış Yapıldı'
                      : isOnBreak
                      ? '🟡 Molada'
                      : isCheckedIn
                      ? 'Mesaide'
                      : 'Henüz Giriş Yapılmadı'}
                  </Text>
                </View>
              </View>

              {/* Kart 1: İŞE GELDİM */}
              <TouchableOpacity
                style={[
                  styles.checkInCard,
                  isCheckedIn && styles.checkInCardDisabled,
                ]}
                onPress={handleCheckIn}
                disabled={isCheckedIn || actionLoading}
                activeOpacity={0.85}
              >
                <View style={styles.actionCardTop}>
                  <View style={styles.actionUserCircle}>
                    <Users size={18} color="#ffffff" />
                  </View>
                  <View style={styles.actionPillWhite}>
                    <Text style={styles.actionPillWhiteText}>GİRİŞ YAP</Text>
                  </View>
                </View>

                <View style={styles.actionRadioRow}>
                  <View style={styles.radioDotGreen} />
                  <Text style={styles.actionMainTitle}>İşe Geldim</Text>
                </View>
                <Text style={styles.actionDescText}>
                  İş yerinde veya konum dışındaysanız yönetici onayıyla mesainizi başlatın.
                </Text>
              </TouchableOpacity>

              {/* Kart 2: İŞTEN ÇIKIŞ YAPTIM */}
              <TouchableOpacity
                style={[
                  styles.checkOutCard,
                  !isCheckedIn && styles.checkOutCardDisabled,
                ]}
                onPress={handleCheckOut}
                disabled={!isCheckedIn || isCheckedOut || actionLoading}
                activeOpacity={0.85}
              >
                <View style={styles.actionCardTop}>
                  <View style={styles.actionUserCircleDark}>
                    <LogOut size={18} color="#94a3b8" />
                  </View>
                  <View style={styles.actionPillDark}>
                    <Text style={styles.actionPillDarkText}>ÇIKIŞ YAP</Text>
                  </View>
                </View>

                <View style={styles.actionRadioRow}>
                  <View style={styles.radioDotRed} />
                  <Text style={[styles.actionMainTitle, { color: isCheckedIn ? '#f87171' : '#94a3b8' }]}>
                    İşten Çıkış Yaptım
                  </Text>
                </View>
                <Text style={styles.actionDescTextDark}>
                  İş yerinde veya konum dışındaysanız yönetici onayıyla mesaiyi bitirin.
                </Text>
              </TouchableOpacity>

              {/* Bugünkü Giriş & Çıkış Detay Kartı */}
              {todayRecord && (
                <View
                  style={[
                    styles.todaySummaryBox,
                    {
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
                >
                  {todayRecord.branchName && (
                    <View style={styles.todayBranchRow}>
                      <Store size={14} color="#0d9488" />
                      <Text style={[styles.todayBranchText, { color: isDark ? '#5eead4' : '#0f766e' }]}>
                        Mesai Şubesi: <Text style={{ fontWeight: '900' }}>{todayRecord.branchName}</Text>
                      </Text>
                    </View>
                  )}

                  <View style={styles.todaySummaryGrid}>
                    <View style={styles.todayGridCol}>
                      <Text style={styles.todayGridLabel}>GİRİŞ SAATİ</Text>
                      <Text style={[styles.todayGridVal, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                        {formatTime(todayRecord.checkInTime)}
                      </Text>
                    </View>

                    <View style={styles.todayGridCol}>
                      <Text style={styles.todayGridLabel}>GİRİŞ MESAFESİ</Text>
                      <Text style={[styles.todayGridVal, { color: '#10b981' }]}>
                        {todayRecord.checkInDistance !== undefined
                          ? `${Math.round(todayRecord.checkInDistance)} m`
                          : '≤ 20 m'}
                      </Text>
                    </View>

                    <View style={styles.todayGridCol}>
                      <Text style={styles.todayGridLabel}>ÇIKIŞ SAATİ</Text>
                      <Text style={[styles.todayGridVal, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                        {todayRecord.checkOutTime ? formatTime(todayRecord.checkOutTime) : (isOnBreak ? 'Molada' : 'Devam ediyor')}
                      </Text>
                    </View>

                    <View style={styles.todayGridCol}>
                      <Text style={styles.todayGridLabel}>BRÜT MESAİ</Text>
                      <Text style={[styles.todayGridVal, { color: '#0284c7' }]}>
                        {formatMinutesToDuration(calculateRecordDurationMinutes(todayRecord))}
                      </Text>
                    </View>

                    <View style={styles.todayGridCol}>
                      <Text style={styles.todayGridLabel}>TOPLAM MOLA</Text>
                      <Text style={[styles.todayGridVal, { color: '#d97706' }]}>
                        {formatMinutesToDuration(calculateRecordBreakMinutes(todayRecord))}
                      </Text>
                    </View>

                    <View style={styles.todayGridCol}>
                      <Text style={styles.todayGridLabel}>NET ÇALIŞMA</Text>
                      <Text style={[styles.todayGridVal, { color: '#10b981', fontWeight: '900' }]}>
                        {formatMinutesToDuration(calculateRecordNetWorkMinutes(todayRecord))}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* MODÜL 2: MOLA KISMI */}
        {/* ============================================================ */}
        {activeSection === 'breaks' && (
          <View style={{ gap: 12 }}>
            {/* Personel Mola Yönetim Kartı */}
            {isCheckedIn ? (
              <View
                style={[
                  styles.molaBox,
                  isOnBreak
                    ? styles.molaBoxActive
                    : {
                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                        borderColor: isDark ? '#b45309' : '#fde68a',
                      },
                ]}
              >
                <View style={styles.molaHeaderRow}>
                  <View style={[styles.molaIconContainer, isOnBreak && styles.molaIconContainerActive]}>
                    <Coffee size={22} color={isOnBreak ? '#ffffff' : '#d97706'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.molaTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                        {isOnBreak ? '☕ Şu Anda Moladasınız' : 'Personel Mola Yönetimi'}
                      </Text>
                      <View style={[styles.molaBadge, isOnBreak ? styles.molaBadgePulse : styles.molaBadgeNormal]}>
                        <Text style={[styles.molaBadgeText, isOnBreak && { color: '#ffffff' }]}>
                          {isOnBreak ? 'Canlı Mola' : 'Mesaide Aktif'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.molaSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      {isOnBreak ? (
                        <Text style={{ color: '#d97706', fontWeight: '700' }}>
                          Geçen Mola: <Text style={{ fontWeight: '900', color: '#b45309' }}>{liveBreakTimerText || 'Hesaplanıyor...'}</Text>
                        </Text>
                      ) : (
                        `Bugün: ${
                          todayRecord?.breaks && todayRecord.breaks.length > 0
                            ? `${todayRecord.breaks.length} mola (${calculateRecordBreakMinutes(todayRecord)} dk)`
                            : 'Henüz molaya çıkılmadı'
                        }`
                      )}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.molaActionBtn,
                    isOnBreak ? styles.molaActionBtnEnd : styles.molaActionBtnStart,
                  ]}
                  onPress={isOnBreak ? handleEndBreak : handleStartBreak}
                  disabled={isProcessingBreak}
                  activeOpacity={0.85}
                >
                  {isProcessingBreak ? (
                    <ActivityIndicator size="small" color={isOnBreak ? '#ffffff' : '#78350f'} />
                  ) : isOnBreak ? (
                    <>
                      <Play size={16} color="#ffffff" fill="#ffffff" />
                      <Text style={styles.molaActionBtnEndText}>Molayı Bitir ve Mesaiye Dön</Text>
                    </>
                  ) : (
                    <>
                      <Coffee size={16} color="#78350f" />
                      <Text style={styles.molaActionBtnStartText}>Molaya Çık</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Bugünkü Kendi Molalarınız Dökümü */}
                {todayRecord?.breaks && todayRecord.breaks.length > 0 && (
                  <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(217, 119, 6, 0.2)' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#cbd5e1' : '#475569', marginBottom: 8 }}>
                      Bugünkü Molalarınız ({todayRecord.breaks.length} Adet - Toplam {calculateRecordBreakMinutes(todayRecord)} dk)
                    </Text>
                    <View style={{ gap: 6 }}>
                      {todayRecord.breaks.map((b, idx) => {
                        const bStart = new Date(b.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        const bEnd = b.endTime ? new Date(b.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Devam ediyor';
                        const bDur = b.durationMinutes || (b.endTime ? Math.max(1, Math.round((b.endTime - b.startTime) / 60000)) : Math.max(1, Math.round((Date.now() - b.startTime) / 60000)));
                        return (
                          <View
                            key={b.id || idx}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: 8,
                              borderRadius: 8,
                              backgroundColor: isDark ? '#1e293b' : '#ffffff',
                              borderWidth: 1,
                              borderColor: isDark ? '#334155' : '#e2e8f0',
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#ffffff' : '#0f172a' }}>
                              ☕ {idx + 1}. Mola: {bStart} - {bEnd}
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#d97706' }}>
                              {bDur} dk
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#0c152e' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    alignItems: 'center',
                    paddingVertical: 24,
                  },
                ]}
              >
                <Coffee size={32} color="#f59e0b" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a', marginTop: 8 }}>
                  Henüz İşe Giriş Yapmadınız
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'center', marginTop: 4, maxWidth: 260 }}>
                  Molaya çıkabilmek için önce işe giriş yapmış olmanız gerekmektedir.
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 14,
                    backgroundColor: '#10b981',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                  onPress={() => setActiveSection('checkin_checkout')}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>
                    İşe Giriş Bölümüne Git
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* YÖNETİCİ İÇİN: Mola Takip Paneli */}
            {isAdmin && (
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#0c152e' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Users size={16} color="#f59e0b" />
                  <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>
                    Personel Mola Detayları (Yönetici Paneli)
                  </Text>
                </View>

                {/* Canlı Moladaki Personeller */}
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#f59e0b', marginBottom: 6 }}>
                  🟡 Şu Anda Canlı Molada Olanlar ({activeStaffOnBreak.length})
                </Text>
                {activeStaffOnBreak.length === 0 ? (
                  <Text style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginBottom: 12 }}>
                    Şu anda molada olan personel bulunmuyor.
                  </Text>
                ) : (
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    {activeStaffOnBreak.map((rec) => {
                      const startTime = rec.currentBreakStartTime ? new Date(rec.currentBreakStartTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-';
                      const durMins = rec.currentBreakStartTime ? Math.max(1, Math.round((Date.now() - rec.currentBreakStartTime) / 60000)) : 1;
                      return (
                        <View
                          key={rec.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 10,
                            borderRadius: 10,
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                            borderWidth: 1,
                            borderColor: '#f59e0b',
                          }}
                        >
                          <View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                              {rec.userName}
                            </Text>
                            <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                              Başlangıç: {startTime}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#b45309' }}>
                              {durMins} dk'dır molada
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Bugünkü Personel Mola Dökümleri */}
                <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#cbd5e1' : '#475569', marginBottom: 8, marginTop: 4 }}>
                  ☕ Personel Mola Dökümleri (Alt Alta Detay Listesi)
                </Text>
                {(() => {
                  const todayBreakStaff = attendanceRecords.filter((r) => r.date === todayStr && ((r.breaks && r.breaks.length > 0) || r.isOnBreak));
                  if (todayBreakStaff.length === 0) {
                    return (
                      <View style={{ padding: 16, alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Coffee size={24} color="#94a3b8" />
                        <Text style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 }}>
                          Bugün henüz hiçbir personel molaya çıkmadı.
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View style={{ gap: 10 }}>
                      {todayBreakStaff.map((rec) => {
                        const totalMins = calculateRecordBreakMinutes(rec);
                        const breaksCount = rec.breaks?.length || 0;

                        return (
                          <View
                            key={rec.id}
                            style={{
                              padding: 12,
                              borderRadius: 12,
                              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                              borderWidth: 1,
                              borderColor: isDark ? '#334155' : '#e2e8f0',
                              gap: 8,
                            }}
                          >
                            {/* Personel Başlık Satırı */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>
                                    {rec.userName}
                                  </Text>
                                  {rec.userRole && (
                                    <View style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                      <Text style={{ fontSize: 9, fontWeight: '700', color: isDark ? '#cbd5e1' : '#475569' }}>
                                        {rec.userRole}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                {rec.branchName && (
                                  <Text style={{ fontSize: 10, color: '#0d9488', fontWeight: '700', marginTop: 1 }}>
                                    Şube: {rec.branchName}
                                  </Text>
                                )}
                              </View>

                              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                {rec.isOnBreak && (
                                  <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#ffffff' }}>
                                      🟡 Molada
                                    </Text>
                                  </View>
                                )}
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#d97706' }}>
                                  Toplam: {totalMins} dk ({breaksCount} Mola)
                                </Text>
                              </View>
                            </View>

                            {/* Ayrı Ayrı Alt Alta Mola Dökümü */}
                            {rec.breaks && rec.breaks.length > 0 && (
                              <View style={{ gap: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#e2e8f0', paddingTop: 8 }}>
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
                                    <View
                                      key={b.id || bIdx}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: 8,
                                        borderRadius: 8,
                                        backgroundColor: isCurrentBreak
                                          ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb')
                                          : (isDark ? '#0f172a' : '#ffffff'),
                                        borderWidth: 1,
                                        borderColor: isCurrentBreak ? '#f59e0b' : (isDark ? '#334155' : '#e2e8f0'),
                                      }}
                                    >
                                      <View style={{ gap: 2 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                          <Coffee size={12} color="#f59e0b" />
                                          <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                                            {bIdx + 1}. Mola
                                          </Text>
                                        </View>
                                        <Text style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' }}>
                                          Giriş: <Text style={{ fontWeight: '800', color: isDark ? '#cbd5e1' : '#334155' }}>{startStr}</Text> ➔ Çıkış: <Text style={{ fontWeight: '800', color: isCurrentBreak ? '#f59e0b' : (isDark ? '#cbd5e1' : '#334155') }}>{endStr}</Text>
                                        </Text>
                                        {b.note && b.note !== 'Mola' && (
                                          <Text style={{ fontSize: 9, color: isDark ? '#64748b' : '#94a3b8', fontStyle: 'italic' }}>
                                            Not: {b.note}
                                          </Text>
                                        )}
                                      </View>

                                      <View style={{ alignItems: 'flex-end' }}>
                                        <View
                                          style={{
                                            backgroundColor: isCurrentBreak ? '#f59e0b' : (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'),
                                            paddingHorizontal: 8,
                                            paddingVertical: 3,
                                            borderRadius: 6,
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: 11,
                                              fontWeight: '900',
                                              color: isCurrentBreak ? '#ffffff' : '#b45309',
                                            }}
                                          >
                                            {durMins} dk {isCurrentBreak && '(canlı)'}
                                          </Text>
                                        </View>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        )}

        {/* ============================================================ */}
        {/* MODÜL 3: MESAİ ÖZETİ KISMI */}
        {/* ============================================================ */}
        {activeSection === 'summary' && (
          <View style={{ gap: 12 }}>
            <View
              style={[
                styles.cardBox,
                {
                  backgroundColor: isDark ? '#0c152e' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                },
              ]}
            >

          {/* 2 Export Download Buttons */}
          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={styles.excelBtn}
              onPress={handleExportExcel}
              disabled={isExporting}
              activeOpacity={0.8}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <FileSpreadsheet size={16} color="#ffffff" />
                  <Text style={styles.excelBtnText}>Excel İndir (.xlsx)</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pdfBtn}
              onPress={handleExportPdf}
              disabled={isExporting}
              activeOpacity={0.8}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <FileText size={16} color="#ffffff" />
                  <Text style={styles.pdfBtnText}>PDF Raporu İndir</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Dönem Filtre Hapları */}
          <View style={{ gap: 8, marginTop: 6 }}>
            <View style={styles.periodRow}>
              <Calendar size={15} color="#94a3b8" />
              <Text style={styles.periodLabel}>Dönem:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[
                  { id: 'bugun', label: 'Bugün' },
                  { id: 'bu_hafta', label: 'Bu Hafta' },
                  { id: 'bu_ay', label: 'Bu Ay' },
                  { id: 'gecen_ay', label: 'Geçen Ay' },
                  { id: 'dun', label: 'Dün' },
                  { id: 'tumu', label: 'Tümü' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.periodPill,
                      activePeriod === item.id ? styles.periodPillActive : styles.periodPillInactive,
                    ]}
                    onPress={() => handlePeriodChange(item.id as PeriodFilter)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.periodPillText,
                        activePeriod === item.id && styles.periodPillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Bilgilendirme Rozeti (Bugün modu) */}
            {activePeriod === 'bugun' && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#10b981',
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    color: isDark ? '#6ee7b7' : '#047857',
                    fontWeight: '600',
                    flex: 1,
                  }}
                >
                  Sadece Bugünün ({startDateStr}) kayıtları gösteriliyor. Geçmiş için Dönem butonlarını kullanabilirsiniz.
                </Text>
              </View>
            )}

            {/* Personel Seçici Dropdown (Görsel-2) */}
            <TouchableOpacity
              style={styles.staffDropdownBtn}
              onPress={() => setIsStaffPickerOpen(true)}
              activeOpacity={0.8}
            >
              <Users size={16} color="#94a3b8" />
              <Text style={styles.staffDropdownText}>
                {selectedStaffFilter === 'all'
                  ? `Tüm Personeller (${ALL_STAFF.length})`
                  : ALL_STAFF.find((s) => s.id === selectedStaffFilter)?.name}
              </Text>
              <ChevronDown size={16} color="#94a3b8" />
            </TouchableOpacity>

            {/* Tarih Aralığı Seçimi */}
            <View style={styles.dateRangeRow}>
              <View style={styles.dateInputWrapper}>
                <Text style={styles.dateSubLabel}>Başlangıç:</Text>
                <View style={styles.dateBox}>
                  <Text style={styles.dateTextVal}>{startDateStr}</Text>
                  <Calendar size={13} color="#94a3b8" />
                </View>
              </View>

              <View style={styles.dateInputWrapper}>
                <Text style={styles.dateSubLabel}>Bitiş:</Text>
                <View style={styles.dateBox}>
                  <Text style={styles.dateTextVal}>{endDateStr}</Text>
                  <Calendar size={13} color="#94a3b8" />
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={resetFilters}
              style={{ alignSelf: 'flex-end', marginTop: 4 }}
              activeOpacity={0.7}
            >
              <Text style={styles.resetFiltersText}>Filtreleri Sıfırla (Bugün)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================ */}
        {/* GÖRSEL-3: 4 İSTATİSTİK KUTUSU (2x2 GRID) */}
        {/* ============================================================ */}
        <View style={styles.statsGrid}>
          {/* Box 1: Net Mesai Süresi (Mavi) */}
          <View style={[styles.statCard, styles.statCardBlue]}>
            <Text style={styles.statLabelBlue}>Net Mesai Süresi</Text>
            <Text style={styles.statValueLarge}>{stats.netFormatted}</Text>
            <Text style={styles.statSubText}>Brüt: {stats.totalFormatted} • Mola: {stats.breakFormatted}</Text>
          </View>

          {/* Box 2: Çalışılan Gün / Ort. (Yeşil) */}
          <View style={[styles.statCard, styles.statCardGreen]}>
            <Text style={styles.statLabelGreen}>Çalışılan Gün / Ort.</Text>
            <Text style={styles.statValueLargeGreen}>{stats.daysCount} Gün</Text>
            <Text style={styles.statSubTextGreen}>{stats.avgPerDayFormatted}</Text>
          </View>

          {/* Box 3: Mesai Kayıtları (Mavi) */}
          <View style={[styles.statCard, styles.statCardBlue]}>
            <Text style={styles.statLabelBlue}>Mesai Kayıtları</Text>
            <Text style={styles.statValueLarge}>{stats.checkInCount} Giriş</Text>
            <Text style={styles.statSubText}>
              {stats.completedCount} Tamamlandı • {stats.inWorkCount} Mesaide{stats.onBreakCount > 0 ? ` • ${stats.onBreakCount} Molada` : ''}
            </Text>
          </View>

          {/* Box 4: Personel Sayısı (Koyu) */}
          <View style={[styles.statCard, styles.statCardDark]}>
            <Text style={styles.statLabelDark}>Personel Sayısı</Text>
            <Text style={styles.statValueLargeDark}>{stats.activeStaffCount} Kişi</Text>
            <Text style={styles.statSubTextDark}>
              {stats.totalRegisteredStaff} kayıtlı personelden
            </Text>
          </View>
        </View>

        {/* ============================================================ */}
        {/* GÖRSEL-3: PERSONEL MESAİ ÖZETİ LİSTESİ (OKLA AÇILIR PANEL) */}
        {/* ============================================================ */}
        {isAdmin && (
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              style={[
                styles.summaryToggleBtn,
                {
                  backgroundColor: isDark ? '#0c152e' : '#f8fafc',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                },
              ]}
              onPress={() => setIsStaffSummaryOpen(!isStaffSummaryOpen)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#38bdf8" />
                <Text style={styles.sectionHeadingText}>PERSONEL MESAİ ÖZETİ</Text>
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      color: '#0284c7',
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {staffSummaries.length} Personel
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' }}>
                  {isStaffSummaryOpen ? 'Gizle' : 'Göster'}
                </Text>
                <ChevronDown
                  size={18}
                  color={isDark ? '#94a3b8' : '#64748b'}
                  style={{
                    transform: [{ rotate: isStaffSummaryOpen ? '180deg' : '0deg' }],
                  }}
                />
              </View>
            </TouchableOpacity>

            {isStaffSummaryOpen &&
              staffSummaries.map((staff) => (
                <View
                  key={staff.id}
                  style={[
                    styles.staffSummaryCard,
                    {
                      backgroundColor: isDark ? '#0c152e' : '#ffffff',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                >
                  {/* Header: Initial avatar + name + role */}
                  <View style={styles.staffHeaderRow}>
                    <View style={styles.initialBadge}>
                      <Text style={styles.initialText}>{staff.name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={[styles.staffNameText, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                        {staff.name}
                      </Text>
                      <Text style={styles.staffRoleText}>{staff.role}</Text>
                    </View>
                  </View>

                  {/* 4 Metric Columns: BRÜT | MOLA | NET | GÜN */}
                  <View style={styles.staffMetricsRow}>
                    <View style={styles.metricCol}>
                      <Text style={styles.metricLabel}>BRÜT</Text>
                      <Text style={styles.metricValBlue}>{staff.totalText}</Text>
                    </View>

                    <View style={styles.metricCol}>
                      <Text style={styles.metricLabel}>MOLA</Text>
                      <Text style={[styles.metricValBlue, { color: '#d97706' }]}>{(staff as any).breakText || '0 dk'}</Text>
                    </View>

                    <View style={styles.metricCol}>
                      <Text style={styles.metricLabel}>NET</Text>
                      <Text style={styles.metricValGreen}>{(staff as any).netText || staff.totalText}</Text>
                    </View>

                    <View style={styles.metricCol}>
                      <Text style={styles.metricLabel}>GÜN</Text>
                      <Text style={[styles.metricValWhite, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                        {staff.daysText}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* ============================================================ */}
        {/* GÖRSEL-4 & 5: 10 SÜTUNLU DETAYLI MESAİ GİRİŞ-ÇIKIŞ TABLOSU */}
        {/* (Görsel-5 Görsel-4'ün Sağ Tarafındaki Sütun Devamıdır) */}
        {/* ============================================================ */}
        <View style={{ gap: 10, marginTop: 10 }}>
          <View style={styles.sectionHeaderRow}>
            <Clock size={18} color="#38bdf8" />
            <Text style={styles.sectionHeadingText}>MESAİ GİRİŞ-ÇIKIŞ VE MESAFE TABLOSU</Text>
            <Text style={{ color: '#64748b', fontSize: 11, marginLeft: 'auto' }}>
              (Yana kaydırın ➔)
            </Text>
          </View>

          <View
            style={[
              styles.tableCardContainer,
              {
                backgroundColor: isDark ? '#0c152e' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={styles.tableInner}>
                {/* 13 Columns Header (Brüt, Mola Akordeon ve Net Mesai Entegre) */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, { width: 120 }]}>TARİH</Text>
                  <Text style={[styles.thCell, { width: 170 }]}>PERSONEL</Text>
                  {isAdmin && <Text style={[styles.thCell, { width: 145, textAlign: 'center' }]}>ONAY / İŞLEM</Text>}
                  <Text style={[styles.thCell, { width: 85 }]}>ŞUBE</Text>
                  <Text style={[styles.thCell, { width: 110 }]}>DURUM</Text>
                  <Text style={[styles.thCell, { width: 90 }]}>GİRİŞ SAATİ</Text>
                  <Text style={[styles.thCell, { width: 130 }]}>GİRİŞ MESAFESİ</Text>
                  <Text style={[styles.thCell, { width: 90 }]}>ÇIKIŞ SAATİ</Text>
                  <Text style={[styles.thCell, { width: 130 }]}>ÇIKIŞ MESAFESİ</Text>
                  <Text style={[styles.thCell, { width: 105 }]}>BRÜT SÜRE</Text>
                  <Text style={[styles.thCell, { width: 130, textAlign: 'center' }]}>MOLA ÖZETİ</Text>
                  <Text style={[styles.thCell, { width: 105 }]}>NET MESAİ</Text>
                  <Text style={[styles.thCell, { width: 220 }]}>NOT / AÇIKLAMA</Text>
                </View>

                {/* Table Data Rows */}
                {filteredRecords.map((item, idx) => {
                  const inDist = formatDistance(
                    item.checkInDistance,
                    item.checkInOutside,
                    item.checkInApprovalStatus === 'approved'
                  );
                  const outDist = formatDistance(
                    item.checkOutDistance,
                    item.checkOutOutside,
                    item.checkOutApprovalStatus === 'approved'
                  );

                  const isLeave = item.status === 'on_leave';
                  const durationMin = calculateRecordDurationMinutes(item);
                  const breakMin = calculateRecordBreakMinutes(item);
                  const netMin = calculateRecordNetWorkMinutes(item);
                  const isExpanded = expandedBreakRecordIds.has(item.id);
                  const hasBreaks = Boolean(item.breaks && item.breaks.length > 0);

                  return (
                    <React.Fragment key={item.id || idx}>
                      <View
                        style={[
                          styles.tableDataRow,
                          idx % 2 === 1 && {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                          },
                        ]}
                      >
                        {/* Sütun 1: TARİH */}
                        <View style={[styles.tdCell, { width: 120 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Calendar size={13} color="#94a3b8" />
                            <Text
                              style={[
                                styles.dateCellText,
                                { color: isDark ? '#ffffff' : '#0f172a' },
                              ]}
                            >
                              {item.date}
                            </Text>
                          </View>
                        </View>

                        {/* Sütun 2: PERSONEL */}
                        <View style={[styles.tdCell, { width: 170 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.tableInitialBadge}>
                              <Text style={styles.tableInitialText}>
                                {item.userName ? item.userName.charAt(0) : 'P'}
                              </Text>
                            </View>
                            <View>
                              <Text
                                style={[
                                  styles.personelNameText,
                                  { color: isDark ? '#ffffff' : '#0f172a' },
                                ]}
                              >
                                {item.userName}
                              </Text>
                              <Text style={styles.personelRoleText}>
                                {item.userRole || 'Saha Yetkilisi'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Sütun: ONAY / İŞLEM (Şubeden Önce, Sola-Sağa Kaydırmadan Görünsün!) */}
                        {isAdmin && (
                          <View style={[styles.tdCell, { width: 145, alignItems: 'center', justifyContent: 'center' }]}>
                            {item.status === 'pending_checkout_approval' || (item.checkOutOutside && item.checkOutApprovalStatus === 'pending') ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <TouchableOpacity
                                  style={styles.inlineApproveBtn}
                                  onPress={() => handleActionApprove(item, 'checkout')}
                                  activeOpacity={0.8}
                                >
                                  <Check size={12} color="#ffffff" />
                                  <Text style={styles.inlineApproveBtnText}>Onayla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.inlineRejectBtn}
                                  onPress={() => handleActionReject(item, 'checkout')}
                                  activeOpacity={0.8}
                                >
                                  <X size={12} color="#ffffff" />
                                  <Text style={styles.inlineRejectBtnText}>Reddet</Text>
                                </TouchableOpacity>
                              </View>
                            ) : item.status === 'pending_checkin_approval' || (item.checkInOutside && item.checkInApprovalStatus === 'pending') ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <TouchableOpacity
                                  style={styles.inlineApproveBtn}
                                  onPress={() => handleActionApprove(item, 'checkin')}
                                  activeOpacity={0.8}
                                >
                                  <Check size={12} color="#ffffff" />
                                  <Text style={styles.inlineApproveBtnText}>Onayla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.inlineRejectBtn}
                                  onPress={() => handleActionReject(item, 'checkin')}
                                  activeOpacity={0.8}
                                >
                                  <X size={12} color="#ffffff" />
                                  <Text style={styles.inlineRejectBtnText}>Reddet</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (item.checkOutOutside && item.checkOutApprovalStatus === 'approved') || (item.checkInOutside && item.checkInApprovalStatus === 'approved') || item.checkOutApprovalStatus === 'approved' || item.checkInApprovalStatus === 'approved' ? (
                              <View style={styles.inlineApprovedBadge}>
                                <Check size={11} color="#10b981" />
                                <Text style={styles.inlineApprovedBadgeText}>Onaylandı</Text>
                              </View>
                            ) : (item.checkOutOutside && item.checkOutApprovalStatus === 'rejected') || (item.checkInOutside && item.checkInApprovalStatus === 'rejected') || item.checkOutApprovalStatus === 'rejected' || item.checkInApprovalStatus === 'rejected' ? (
                              <View style={styles.inlineRejectedBadge}>
                                <X size={11} color="#f43f5e" />
                                <Text style={styles.inlineRejectedBadgeText}>Reddedildi</Text>
                              </View>
                            ) : (
                              <Text style={styles.emptyDashText}>-</Text>
                            )}
                          </View>
                        )}

                        {/* Sütun 3: ŞUBE */}
                        <View style={[styles.tdCell, { width: 85 }]}>
                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                            {item.branchName || 'Merkez'}
                          </Text>
                        </View>

                        {/* Sütun 4: DURUM */}
                        <View style={[styles.tdCell, { width: 110 }]}>
                          {isLeave ? (
                            <View style={styles.leavePill}>
                              <Calendar size={11} color="#10b981" />
                              <Text style={styles.leavePillText}>İzinli</Text>
                            </View>
                          ) : item.isOnBreak ? (
                            <View style={styles.onBreakPill}>
                              <Coffee size={11} color="#b45309" />
                              <Text style={styles.onBreakPillText}>
                                Molada{item.currentBreakStartTime ? ` (${Math.max(1, Math.round((Date.now() - item.currentBreakStartTime) / 60000))} dk)` : ''}
                              </Text>
                            </View>
                          ) : item.status === 'completed' ? (
                            <View style={styles.checkOutPill}>
                              <Text style={styles.checkOutPillText}>Çıkış Yaptı</Text>
                            </View>
                          ) : (
                            <View style={styles.inWorkPill}>
                              <Text style={styles.inWorkPillText}>Mesaide</Text>
                            </View>
                          )}
                        </View>

                        {/* Sütun 5: GİRİŞ SAATİ */}
                        <View style={[styles.tdCell, { width: 90 }]}>
                          <Text
                            style={[
                              styles.timeText,
                              { color: isDark ? '#ffffff' : '#0f172a' },
                            ]}
                          >
                            {isLeave ? '-' : formatTime(item.checkInTime)}
                          </Text>
                        </View>

                        {/* Sütun 6: GİRİŞ MESAFESİ (Görsel-5 Devamı) */}
                        <View style={[styles.tdCell, { width: 130 }]}>
                          {isLeave ? (
                            <Text style={styles.emptyDashText}>-</Text>
                          ) : (
                            <View>
                              <Text
                                style={[
                                  styles.distanceTextVal,
                                  inDist.isOutside ? { color: '#fb923c' } : { color: '#34d399' },
                                ]}
                              >
                                {inDist.distStr}
                              </Text>
                              {inDist.isApproved && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Check size={10} color="#10b981" />
                                  <Text style={styles.approvedLabelText}>Yönetici Onaylı</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>

                        {/* Sütun 7: ÇIKIŞ SAATİ */}
                        <View style={[styles.tdCell, { width: 90 }]}>
                          <Text
                            style={[
                              styles.timeText,
                              { color: isDark ? '#ffffff' : '#0f172a' },
                            ]}
                          >
                            {isLeave ? '-' : formatTime(item.checkOutTime)}
                          </Text>
                        </View>

                        {/* Sütun 8: ÇIKIŞ MESAFESİ */}
                        <View style={[styles.tdCell, { width: 130 }]}>
                          {isLeave ? (
                            <Text style={styles.emptyDashText}>-</Text>
                          ) : (
                            <View>
                              <Text
                                style={[
                                  styles.distanceTextVal,
                                  { color: '#f87171' },
                                ]}
                              >
                                {outDist.distStr}
                              </Text>
                              {outDist.isApproved && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Check size={10} color="#10b981" />
                                  <Text style={styles.approvedLabelText}>Yönetici Onaylı</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>

                        {/* Sütun 9: BRÜT SÜRE */}
                        <View style={[styles.tdCell, { width: 105 }]}>
                          <Text
                            style={[
                              styles.durationTextVal,
                              { color: isDark ? '#ffffff' : '#0f172a' },
                            ]}
                          >
                            {isLeave ? '-' : durationMin > 0 ? formatMinutesToDuration(durationMin) : item.status === 'checked_in' ? 'Devam ediyor' : '-'}
                          </Text>
                        </View>

                        {/* Sütun 10: MOLA ÖZETİ (Akordeon Butonu) */}
                        <View style={[styles.tdCell, { width: 130, alignItems: 'center', justifyContent: 'center' }]}>
                          {hasBreaks ? (
                            <TouchableOpacity
                              style={styles.breakAccordionBtn}
                              onPress={() => toggleRecordBreakAccordion(item.id)}
                              activeOpacity={0.7}
                            >
                              <Coffee size={12} color="#b45309" />
                              <Text style={styles.breakAccordionBtnText}>
                                {item.breaks!.length} Mola ({breakMin} dk)
                              </Text>
                              <ChevronDown
                                size={12}
                                color="#b45309"
                                style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                              />
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.emptyDashText}>-</Text>
                          )}
                        </View>

                        {/* Sütun 11: NET MESAİ */}
                        <View style={[styles.tdCell, { width: 105 }]}>
                          <Text
                            style={[
                              styles.durationTextVal,
                              { color: '#10b981', fontWeight: '900' },
                            ]}
                          >
                            {isLeave ? '-' : durationMin > 0 ? formatMinutesToDuration(netMin) : item.status === 'checked_in' ? 'Devam ediyor' : '-'}
                          </Text>
                        </View>

                        {/* Sütun 12: NOT / AÇIKLAMA */}
                        <View style={[styles.tdCell, { width: 220 }]}>
                          <Text
                            style={styles.notesTextVal}
                            numberOfLines={2}
                          >
                            {item.notes || '-'}
                          </Text>
                        </View>
                      </View>

                      {/* Mola Akordeon Detay Çekmecesi (Açıldığında) */}
                      {isExpanded && hasBreaks && (
                        <View
                          style={[
                            styles.breakDrawerRow,
                            {
                              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                              borderColor: isDark ? '#b45309' : '#fde68a',
                            },
                          ]}
                        >
                          <View style={styles.breakDrawerHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Coffee size={14} color="#d97706" />
                              <Text style={[styles.breakDrawerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                                {item.userName} - Mola Detayları ({item.date})
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                                Brüt: <Text style={{ fontWeight: 'bold' }}>{formatMinutesToDuration(durationMin)}</Text>
                              </Text>
                              <Text style={{ fontSize: 11, color: '#d97706', fontWeight: 'bold' }}>
                                Mola: {formatMinutesToDuration(breakMin)}
                              </Text>
                              <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '900' }}>
                                Net Mesai: {formatMinutesToDuration(netMin)}
                              </Text>
                            </View>
                          </View>

                          {/* Mola Kartları */}
                          <View style={styles.breakCardsGrid}>
                            {item.breaks!.map((b, bIdx) => {
                              const bStart = new Date(b.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                              const bEnd = b.endTime ? new Date(b.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Devam ediyor';
                              const bDur = b.durationMinutes || (b.endTime ? Math.max(1, Math.round((b.endTime - b.startTime) / 60000)) : Math.max(1, Math.round((Date.now() - b.startTime) / 60000)));
                              const isOngoing = !b.endTime;

                              return (
                                <View
                                  key={b.id || bIdx}
                                  style={[
                                    styles.breakCardItem,
                                    isOngoing
                                      ? styles.breakCardItemActive
                                      : { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' },
                                  ]}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={[styles.breakCardNum, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                                      ☕ {bIdx + 1}. Mola
                                    </Text>
                                    {isOngoing && (
                                      <View style={styles.breakActivePill}>
                                        <Text style={styles.breakActivePillText}>Aktif</Text>
                                      </View>
                                    )}
                                  </View>

                                  <Text style={[styles.breakCardTime, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                                    {bStart} - {bEnd}
                                  </Text>
                                  <Text style={styles.breakCardDurText}>
                                    Süre: <Text style={{ fontWeight: 'bold' }}>{bDur} dk</Text>
                                  </Text>
                                  {b.note ? (
                                    <Text style={styles.breakCardNoteText} numberOfLines={1}>
                                      "{b.note}"
                                    </Text>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
        </View>
        )}

        {/* ============================================================ */}
        {/* MODÜL 4: İZİN TAKİBİ */}
        {/* ============================================================ */}
        {activeSection === 'leaves' && (
          <View style={{ gap: 12 }}>
            {/* Üst Eylem Butonu: Yeni İzin Talebi Oluştur */}
            <TouchableOpacity
              style={styles.leaveCreateHeaderBtn}
              onPress={handleOpenNewLeaveModal}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#ffffff" />
              <Text style={styles.leaveCreateHeaderBtnText}>Yeni İzin Talebi Oluştur</Text>
            </TouchableOpacity>

            {/* İzin Filtre Hapları */}
            <View
              style={[
                styles.cardBox,
                {
                  backgroundColor: isDark ? '#0c152e' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  paddingVertical: 10,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CalendarDays size={16} color="#8b5cf6" />
                <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                  Filtrele:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[
                    { id: 'all' as const, label: `Tümü (${leaveRequests.length})` },
                    { id: 'pending' as const, label: `Bekleyen (${pendingLeaveCount})` },
                    { id: 'approved' as const, label: `Onaylanan (${leaveRequests.filter((l) => l.status === 'approved').length})` },
                    { id: 'rejected' as const, label: `Reddedilen (${leaveRequests.filter((l) => l.status === 'rejected').length})` },
                  ].map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.periodPill,
                        leaveFilter === f.id
                          ? { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }
                          : styles.periodPillInactive,
                      ]}
                      onPress={() => setLeaveFilter(f.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.periodPillText,
                          leaveFilter === f.id && { color: '#ffffff', fontWeight: '900' },
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* İzin Talepleri Listesi */}
            {(() => {
              const filteredLeaves = leaveRequests.filter((l) => {
                if (leaveFilter === 'all') return true;
                return l.status === leaveFilter;
              });

              if (filteredLeaves.length === 0) {
                return (
                  <View
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#0c152e' : '#ffffff',
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                        alignItems: 'center',
                        paddingVertical: 32,
                      },
                    ]}
                  >
                    <CalendarDays size={36} color="#8b5cf6" style={{ opacity: 0.6 }} />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '800',
                        color: isDark ? '#ffffff' : '#0f172a',
                        marginTop: 10,
                      }}
                    >
                      İzin Kaydı Bulunmuyor
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDark ? '#94a3b8' : '#64748b',
                        textAlign: 'center',
                        marginTop: 4,
                      }}
                    >
                      {leaveFilter === 'pending'
                        ? 'Onay bekleyen izin talebi bulunmuyor.'
                        : 'Bu filtre kriterinde kayıtlı izin bulunamadı.'}
                    </Text>
                  </View>
                );
              }

              return (
                <View style={{ gap: 10 }}>
                  {filteredLeaves.map((leave) => {
                    const isMyLeave = leave.userId === user?.id || leave.userName === user?.name;
                    const isPending = leave.status === 'pending';
                    const isApproved = leave.status === 'approved';
                    const isRejected = leave.status === 'rejected';
                    const isCancelled = leave.status === 'cancelled';

                    const statusBg = isApproved
                      ? 'rgba(16, 185, 129, 0.12)'
                      : isRejected
                      ? 'rgba(239, 68, 68, 0.12)'
                      : isCancelled
                      ? 'rgba(100, 116, 139, 0.12)'
                      : 'rgba(245, 158, 11, 0.12)';

                    const statusTextColor = isApproved
                      ? '#10b981'
                      : isRejected
                      ? '#ef4444'
                      : isCancelled
                      ? '#94a3b8'
                      : '#f59e0b';

                    const statusText = isApproved
                      ? 'Onaylandı'
                      : isRejected
                      ? 'Reddedildi'
                      : isCancelled
                      ? 'İptal Edildi'
                      : 'Onay Bekliyor';

                    const typeLabel =
                      leave.leaveType === 'hourly'
                        ? `Saatlik İzin (${leave.startTime || ''} - ${leave.endTime || ''})`
                        : `Günlük İzin (${leave.durationText || '1 Gün'})`;

                    return (
                      <View
                        key={leave.id}
                        style={[
                          styles.leaveCardItem,
                          {
                            backgroundColor: isDark ? '#0c152e' : '#ffffff',
                            borderColor: isPending
                              ? 'rgba(245, 158, 11, 0.4)'
                              : isApproved
                              ? 'rgba(16, 185, 129, 0.3)'
                              : isDark ? '#334155' : '#e2e8f0',
                          },
                        ]}
                      >
                        {/* Top: İsim & Durum Rozeti */}
                        <View style={styles.leaveCardTop}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text
                                style={[
                                  styles.leaveCardStaffName,
                                  { color: isDark ? '#ffffff' : '#0f172a' },
                                ]}
                              >
                                {leave.userName}
                              </Text>
                              {isMyLeave && (
                                <View
                                  style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                    paddingHorizontal: 6,
                                    paddingVertical: 1,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#3b82f6' }}>
                                    BEN
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.leaveCardDates, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                              📅 {leave.date} {leave.endDate && leave.endDate !== leave.date ? `➔ ${leave.endDate}` : ''} • {typeLabel}
                            </Text>
                          </View>

                          <View style={[styles.leaveStatusPill, { backgroundColor: statusBg }]}>
                            {isApproved ? (
                              <Check size={12} color={statusTextColor} />
                            ) : isRejected ? (
                              <X size={12} color={statusTextColor} />
                            ) : (
                              <Clock size={12} color={statusTextColor} />
                            )}
                            <Text style={[styles.leaveStatusPillText, { color: statusTextColor }]}>
                              {statusText}
                            </Text>
                          </View>
                        </View>

                        {/* Orta: Gerekçe / Mazeret */}
                        <View
                          style={[
                            styles.leaveCardReasonBox,
                            {
                              backgroundColor: isDark ? '#080e21' : '#f8fafc',
                              borderColor: isDark ? '#1e293b' : '#f1f5f9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.leaveCardReasonText,
                              { color: isDark ? '#cbd5e1' : '#334155' },
                            ]}
                          >
                            {leave.reason || 'Açıklama belirtilmedi.'}
                          </Text>
                        </View>

                        {/* Alt: Yönetici veya Kullanıcı Aksiyonları */}
                        <View style={styles.leaveCardBottom}>
                          <Text style={{ fontSize: 10, color: '#64748b' }}>
                            {new Date(leave.requestedAt).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {/* Personel İptal Butonu (beklemedeyse) */}
                            {isPending && isMyLeave && (
                              <TouchableOpacity
                                style={styles.leaveActionCancelBtn}
                                onPress={() => handleCancelLeave(leave.id)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.leaveActionCancelBtnText}>İptal Et</Text>
                              </TouchableOpacity>
                            )}

                            {/* Yönetici Onay / Ret Butonları (beklemedeyse) */}
                            {isPending && isAdmin && (
                              <>
                                <TouchableOpacity
                                  style={styles.leaveActionRejectBtn}
                                  onPress={() => handleRejectLeave(leave.id, leave.userName)}
                                  activeOpacity={0.8}
                                >
                                  <X size={12} color="#ef4444" />
                                  <Text style={styles.leaveActionRejectBtnText}>Reddet</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.leaveActionApproveBtn}
                                  onPress={() => handleApproveLeave(leave.id, leave.userName)}
                                  activeOpacity={0.8}
                                >
                                  <Check size={12} color="#ffffff" />
                                  <Text style={styles.leaveActionApproveBtnText}>Onayla</Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        )}
      </ScrollView>

      {/* Staff Picker Modal */}
      <Modal
        visible={isStaffPickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsStaffPickerOpen(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Personel Filtrele</Text>
              <TouchableOpacity onPress={() => setIsStaffPickerOpen(false)}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.pickerOption,
                selectedStaffFilter === 'all' && styles.pickerOptionActive,
              ]}
              onPress={() => {
                setSelectedStaffFilter('all');
                setIsStaffPickerOpen(false);
              }}
            >
              <Text style={styles.pickerOptionText}>Tüm Personeller</Text>
            </TouchableOpacity>

            {ALL_STAFF.map((staff) => (
              <TouchableOpacity
                key={staff.id}
                style={[
                  styles.pickerOption,
                  selectedStaffFilter === staff.id && styles.pickerOptionActive,
                ]}
                onPress={() => {
                  setSelectedStaffFilter(staff.id);
                  setIsStaffPickerOpen(false);
                }}
              >
                <Text style={styles.pickerOptionText}>{staff.name}</Text>
                <Text style={{ color: '#64748b', fontSize: 11 }}>{staff.role}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Create Leave Request Modal */}
      <Modal
        visible={isLeaveModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLeaveModalOpen(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={[styles.leaveModalCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <View style={styles.pickerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={20} color="#8b5cf6" />
                <Text style={[styles.pickerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  İzin Talebi Oluştur
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsLeaveModalOpen(false)}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* İzin Türü Seçimi */}
              <Text style={[styles.leaveFieldLabel, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                İZİN TÜRÜ
              </Text>
              <View style={styles.leaveTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.leaveTypeBtn,
                    newLeaveType === 'daily' && styles.leaveTypeBtnActive,
                    { borderColor: newLeaveType === 'daily' ? '#10b981' : (isDark ? '#334155' : '#cbd5e1') },
                  ]}
                  onPress={() => {
                    setNewLeaveType('daily');
                    setNewLeaveDuration('1 Gün');
                  }}
                >
                  <Calendar size={16} color={newLeaveType === 'daily' ? '#10b981' : '#64748b'} />
                  <Text
                    style={[
                      styles.leaveTypeBtnText,
                      { color: newLeaveType === 'daily' ? '#10b981' : '#64748b' },
                    ]}
                  >
                    Günlük İzin
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.leaveTypeBtn,
                    newLeaveType === 'hourly' && styles.leaveTypeBtnActive,
                    { borderColor: newLeaveType === 'hourly' ? '#10b981' : (isDark ? '#334155' : '#cbd5e1') },
                  ]}
                  onPress={() => {
                    setNewLeaveType('hourly');
                    setNewLeaveDuration('2 Saat');
                  }}
                >
                  <Clock size={16} color={newLeaveType === 'hourly' ? '#10b981' : '#64748b'} />
                  <Text
                    style={[
                      styles.leaveTypeBtnText,
                      { color: newLeaveType === 'hourly' ? '#10b981' : '#64748b' },
                    ]}
                  >
                    Saatlik İzin
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tarihler */}
              <Text style={[styles.leaveFieldLabel, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 12 }]}>
                {newLeaveType === 'daily' ? 'BAŞLANGIÇ TARİHİ' : 'İZİN TARİHİ'}
              </Text>
              <TextInput
                style={[
                  styles.leaveModalInput,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  },
                ]}
                value={newLeaveStartDate}
                onChangeText={setNewLeaveStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748b"
              />

              {newLeaveType === 'daily' && (
                <>
                  <Text style={[styles.leaveFieldLabel, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 12 }]}>
                    BİTİŞ TARİHİ
                  </Text>
                  <TextInput
                    style={[
                      styles.leaveModalInput,
                      {
                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                        borderColor: isDark ? '#334155' : '#cbd5e1',
                        color: isDark ? '#f8fafc' : '#0f172a',
                      },
                    ]}
                    value={newLeaveEndDate}
                    onChangeText={setNewLeaveEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748b"
                  />
                </>
              )}

              {newLeaveType === 'hourly' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.leaveFieldLabel, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                      BAŞLANGIÇ SAATİ
                    </Text>
                    <TextInput
                      style={[
                        styles.leaveModalInput,
                        {
                          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                          borderColor: isDark ? '#334155' : '#cbd5e1',
                          color: isDark ? '#f8fafc' : '#0f172a',
                        },
                      ]}
                      value={newLeaveStartTime}
                      onChangeText={setNewLeaveStartTime}
                      placeholder="09:00"
                      placeholderTextColor="#64748b"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.leaveFieldLabel, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                      BİTİŞ SAATİ
                    </Text>
                    <TextInput
                      style={[
                        styles.leaveModalInput,
                        {
                          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                          borderColor: isDark ? '#334155' : '#cbd5e1',
                          color: isDark ? '#f8fafc' : '#0f172a',
                        },
                      ]}
                      value={newLeaveEndTime}
                      onChangeText={setNewLeaveEndTime}
                      placeholder="13:00"
                      placeholderTextColor="#64748b"
                    />
                  </View>
                </View>
              )}

              {/* Süre */}
              <Text style={[styles.leaveFieldLabel, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 12 }]}>
                SÜRE (Örn: 1 Gün, 3 Gün, 2 Saat)
              </Text>
              <TextInput
                style={[
                  styles.leaveModalInput,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  },
                ]}
                value={newLeaveDuration}
                onChangeText={setNewLeaveDuration}
                placeholder="1 Gün"
                placeholderTextColor="#64748b"
              />

              {/* Mazeret / Gerekçe */}
              <Text style={[styles.leaveFieldLabel, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 12 }]}>
                İZİN GEREKÇESİ / MAZERET *
              </Text>
              <TextInput
                style={[
                  styles.leaveModalTextArea,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  },
                ]}
                value={newLeaveReason}
                onChangeText={setNewLeaveReason}
                placeholder="İzin gerekçenizi belirtiniz..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.leaveSubmitBtn, isSubmittingLeave && { opacity: 0.6 }]}
                onPress={handleSaveLeaveRequest}
                disabled={isSubmittingLeave}
                activeOpacity={0.85}
              >
                {isSubmittingLeave ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Send size={16} color="#ffffff" />
                    <Text style={styles.leaveSubmitBtnText}>Talebi Gönder</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Top Bar Modals */}
      <UserManagementModal
        visible={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />
      <CreateCompanyModal
        visible={isCreateCompanyOpen}
        onClose={() => setIsCreateCompanyOpen(false)}
      />
      <BranchManagementModal
        visible={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
      />
      <NotificationListModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />
      <NotificationStatusModal
        visible={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    paddingTop: Platform.OS === 'ios' ? 52 : 42,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 14,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  homeBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  topBarIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIconBtnUsers: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1.2,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnBranch: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1.2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnSettings: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1.2,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnNotif: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnTheme: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnLogout: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
    gap: 16,
  },

  /* Hero Banner (Görsel-1) */
  heroBanner: {
    backgroundColor: '#047857',
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  geofencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  geofencePillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  heroButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  leaveRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  leaveRequestBtnText: {
    color: '#064e3b',
    fontSize: 13,
    fontWeight: '800',
  },
  heroRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  heroRefreshBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Card Box Container */
  cardBox: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },

  /* İş Yeri Lokasyonu (Görsel-1) */
  wpHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  wpIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wpTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  adminBadgePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  wpSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radiusLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  radiusFixedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  radiusFixedText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inputWithButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  wpInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  gpsActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coordStatusText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  saveWpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveWpBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Merkez İş Yeri (Görsel-1) */
  centerWpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centerWpTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  centerAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  limit20mBadge: {
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  limit20mText: {
    color: '#14b8a6',
    fontSize: 11,
    fontWeight: '800',
  },
  centerAddressText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  distanceAlertContainer: {
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  distanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  distanceWarningPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  distanceDangerPill: {
    backgroundColor: 'rgba(234, 88, 12, 0.12)',
    borderColor: 'rgba(234, 88, 12, 0.4)',
  },
  distanceSuccessPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  distanceWarningText: {
    fontSize: 13,
    fontWeight: '800',
  },

  /* Bugünkü Mesai Durumunuz (Görsel-2) */
  todayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  todayTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  todaySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  todayStatusBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  todayStatusBadgeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },

  /* 2 Büyük Mesai Kartı (Görsel-2) */
  checkInCard: {
    backgroundColor: '#059669',
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  checkInCardDisabled: {
    opacity: 0.6,
  },
  actionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionUserCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillWhite: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionPillWhiteText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioDotGreen: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
  },
  actionMainTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  actionDescText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    lineHeight: 16,
  },

  checkOutCard: {
    backgroundColor: '#162038',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  checkOutCardDisabled: {
    opacity: 0.5,
  },
  actionUserCircleDark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionPillDarkText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  radioDotRed: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
  },
  actionDescTextDark: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },

  /* Nav Segments & Exports (Görsel-2) */
  navSegmentsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  activeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0c1a38',
    borderWidth: 1,
    borderColor: '#1e3a8a',
    borderRadius: 12,
    paddingVertical: 10,
  },
  activeTabBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  inactiveTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#080e21',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 10,
  },
  inactiveTabBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  excelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 10,
  },
  excelBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 10,
  },
  pdfBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Period & Filters (Görsel-2) */
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  periodPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  periodPillActive: {
    backgroundColor: '#059669',
  },
  periodPillInactive: {
    backgroundColor: '#0a1024',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  periodPillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  periodPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  staffDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a1024',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  staffDropdownText: {
    flex: 1,
    marginLeft: 8,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  dateInputWrapper: {
    flex: 1,
    gap: 4,
  },
  dateSubLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a1024',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateTextVal: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  resetFiltersText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },

  /* 4 Stat Boxes (Görsel-3) */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  statCardBlue: {
    backgroundColor: 'rgba(30, 58, 138, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  statLabelBlue: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '800',
  },
  statCardGreen: {
    backgroundColor: 'rgba(6, 78, 59, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  statLabelGreen: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  statCardDark: {
    backgroundColor: '#0c152e',
    borderColor: '#1e293b',
  },
  statLabelDark: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
  },
  statValueLarge: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  statValueLargeGreen: {
    color: '#34d399',
    fontSize: 20,
    fontWeight: '900',
  },
  statValueLargeDark: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  statSubText: {
    color: '#60a5fa',
    fontSize: 11,
  },
  statSubTextGreen: {
    color: '#10b981',
    fontSize: 11,
  },
  statSubTextDark: {
    color: '#64748b',
    fontSize: 11,
  },

  /* Personel Mesai Özeti (Görsel-3) */
  summaryToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeadingText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  staffSummaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  staffHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  initialBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  staffNameText: {
    fontSize: 15,
    fontWeight: '900',
  },
  staffRoleText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  staffMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#080e21',
    borderRadius: 12,
    padding: 10,
  },
  metricCol: {
    alignItems: 'flex-start',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricValBlue: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
  },
  metricValWhite: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricValGreen: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '800',
  },

  /* 10 Sütunlu Mesai Tablosu (Görsel-4 & 5) */
  tableCardContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableInner: {
    minWidth: 1630,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#080e21',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  thCell: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#162038',
  },
  tdCell: {
    justifyContent: 'center',
  },
  dateCellText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tableInitialBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableInitialText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  personelNameText: {
    fontSize: 12,
    fontWeight: '800',
  },
  personelRoleText: {
    fontSize: 10,
    color: '#64748b',
  },
  checkOutPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  checkOutPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  leavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  leavePillText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  inWorkPill: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  inWorkPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  distanceTextVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  approvedLabelText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  durationTextVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  notesTextVal: {
    color: '#94a3b8',
    fontSize: 12,
  },
  inlineApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  inlineApproveBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  inlineRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  inlineRejectBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  inlineApprovedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  inlineApprovedBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  inlineRejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  inlineRejectedBadgeText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyDashText: {
    color: '#64748b',
    fontSize: 14,
  },

  /* Staff Picker Modal */
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: {
    backgroundColor: '#0c152e',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 6,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 8,
  },
  pickerOptionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteAccountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginTop: 14,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    gap: 8,
  },
  deleteStaffAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    marginBottom: 4,
  },
  deleteStaffAdminBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  deleteAccountBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  deleteAccountSubtext: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
  },

  /* Mola Paneli */
  molaBox: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginTop: 10,
    gap: 12,
  },
  molaBoxActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
  },
  molaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  molaIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  molaIconContainerActive: {
    backgroundColor: '#f59e0b',
  },
  molaTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  molaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  molaBadgeNormal: {
    backgroundColor: '#dcfce7',
  },
  molaBadgePulse: {
    backgroundColor: '#f59e0b',
  },
  molaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },
  molaSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  molaActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  molaActionBtnStart: {
    backgroundColor: '#fef3c7',
    borderWidth: 1.2,
    borderColor: '#fde68a',
  },
  molaActionBtnStartText: {
    color: '#78350f',
    fontSize: 13,
    fontWeight: '900',
  },
  molaActionBtnEnd: {
    backgroundColor: '#d97706',
  },
  molaActionBtnEndText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },

  /* Bugünkü Detay Kutusu */
  todaySummaryBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  todayBranchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  todayBranchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  todaySummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  todayGridCol: {
    width: '31%',
    gap: 2,
  },
  todayGridLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.2,
  },
  todayGridVal: {
    fontSize: 12,
    fontWeight: '800',
  },

  /* Tablo Mola Öğeleri */
  onBreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  onBreakPillText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '900',
  },
  breakAccordionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  breakAccordionBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  breakDrawerRow: {
    width: '100%',
    padding: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  breakDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217, 119, 6, 0.2)',
  },
  breakDrawerTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  breakCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  breakCardItem: {
    minWidth: 130,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  breakCardItemActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  breakCardNum: {
    fontSize: 10,
    fontWeight: '800',
  },
  breakCardTime: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  breakCardDurText: {
    fontSize: 10,
    color: '#d97706',
    marginTop: 2,
  },
  breakCardNoteText: {
    fontSize: 9,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 2,
  },
  breakActivePill: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  breakActivePillText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },

  /* Ana Menü Stili 5 Buton Launcher */
  attendanceLauncherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 16,
    marginBottom: 16,
  },
  attendanceLauncherItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  attendanceLauncherCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    position: 'relative',
  },
  attendanceLauncherIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceLauncherLabel: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 14,
    maxWidth: 95,
  },
  launcherBadgeRed: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  launcherBadgeRedText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },
  launcherBadgePill: {
    position: 'absolute',
    top: -4,
    right: -6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  launcherBadgePillText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ffffff',
  },

  /* İzin Yönetim Stilleri */
  leaveFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 5,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  leaveTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  leaveTypeBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  leaveTypeBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  leaveModalCard: {
    width: '92%',
    maxWidth: 440,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  leaveModalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '600',
  },
  leaveModalTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '600',
    textAlignVertical: 'top',
    minHeight: 65,
  },
  leaveSubmitBtn: {
    marginTop: 16,
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  leaveSubmitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  leaveCardItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  leaveCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaveCardStaffName: {
    fontSize: 14,
    fontWeight: '900',
  },
  leaveCardDates: {
    fontSize: 11,
    marginTop: 2,
  },
  leaveCardReasonBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  leaveCardReasonText: {
    fontSize: 11,
    lineHeight: 16,
  },
  leaveCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  leaveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  leaveStatusPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  leaveActionCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  leaveActionCancelBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ef4444',
  },
  leaveActionApproveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaveActionApproveBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  leaveActionRejectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaveActionRejectBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ef4444',
  },
  leaveCreateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  leaveCreateHeaderBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
