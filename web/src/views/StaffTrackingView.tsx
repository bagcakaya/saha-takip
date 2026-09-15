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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStorage } from '../context/StorageContext';
import { LocationService } from '../services/locationService';

export const StaffTrackingView: React.FC = () => {
  const { user } = useAuth();
  const {
    workplaceLocation,
    attendanceRecords,
    updateWorkplaceLocation,
    checkInStaff,
    checkOutStaff,
    approveAttendance,
    rejectAttendance,
    cancelAttendanceRequest,
    deleteAttendanceRecord,
    refreshAttendance,
  } = useStorage();

  const isAdmin = user?.role === 'admin';
  const allowedRadius =
    workplaceLocation?.radiusMeters && workplaceLocation.radiusMeters !== 10
      ? workplaceLocation.radiusMeters
      : 20;

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
    if (!workplaceLocation?.latitude || !workplaceLocation?.longitude) {
      setDistanceError('İş yeri lokasyonu henüz belirlenmemiş.');
      return;
    }
    try {
      setIsCheckingDistance(true);
      setDistanceError('');
      const pos = await LocationService.getCurrentPosition();
      const dist = LocationService.calculateDistance(
        pos.latitude,
        pos.longitude,
        workplaceLocation.latitude,
        workplaceLocation.longitude
      );
      setCurrentDistance(dist);
    } catch (err: any) {
      setDistanceError(err?.message || 'Konum alınamadı.');
    } finally {
      setIsCheckingDistance(false);
    }
  };

  useEffect(() => {
    if (workplaceLocation?.latitude && workplaceLocation?.longitude) {
      checkLiveDistance();
    }
  }, [workplaceLocation]);

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

        <div className="flex items-center gap-2 self-start md:self-auto">
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
                      <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>İş Yerinden {reqDistance !== undefined ? LocationService.formatDistance(reqDistance) : 'Bilinmiyor'} Uzakta</span>
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
        {/* Sol Kolon: Canlı Geofence ve İş Yeri Bilgisi */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>İş Yeri Konumu</span>
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
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                Merkez Adresi
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                {workplaceLocation?.address || 'Yönetici henüz bir iş yeri konumu kaydetmedi.'}
              </p>
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
                    <span>İş Yerindesiniz ({allowedRadius}m Alanı İçindesiniz) ✅</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>İş Yeri Dışındasınız ({LocationService.formatDistance(currentDistance)})</span>
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
              onClick={() => handleCheckOut(false)}
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
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
          )}
        </div>
      </div>

      {/* --- SECTION 3: CANLI İZLEME TABLOSU VE GEÇMİŞ KAYITLAR --- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              <span>{isAdmin ? 'Tüm Personel Mesai Tablosu' : 'Mesai Geçmişim'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAdmin
                ? 'Tüm çalışanların giriş, çıkış saatleri ve lokasyon doğrulama kayıtları'
                : 'Geçmiş işe giriş ve çıkış saatleriniz'}
            </p>
          </div>

          {/* Tarih Seçici */}
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
        </div>

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
    </div>
  );
};
