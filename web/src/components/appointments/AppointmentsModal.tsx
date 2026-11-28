import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Bell,
  Building2,
  Repeat,
  Plus,
  Check,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Volume2,
  Sparkles,
  PenTool,
  BellRing,
  RotateCcw,
  FolderOpen,
  FolderCheck,
} from 'lucide-react';
import { AppointmentItem } from '../../types/storage';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { CariSelect } from '../common/CariSelect';
import { NotificationService } from '../../services/notificationService';
import { OneSignalService } from '../../services/oneSignalService';

interface AppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REPEAT_PRESETS: { label: string; minutes: number; badge: string }[] = [
  { label: "5 Dk'da Bir", minutes: 5, badge: 'Çok Sık' },
  { label: "10 Dk'da Bir", minutes: 10, badge: 'Sık' },
  { label: "15 Dk'da Bir", minutes: 15, badge: 'Önerilen' },
  { label: "30 Dk'da Bir", minutes: 30, badge: 'Popüler' },
  { label: '1 Saatte Bir', minutes: 60, badge: 'Saatlik' },
  { label: '2 Saatte Bir', minutes: 120, badge: '2 Saat' },
  { label: '3 Saatte Bir', minutes: 180, badge: '3 Saat' },
  { label: '6 Saatte Bir', minutes: 360, badge: '6 Saat' },
  { label: '12 Saatte Bir', minutes: 720, badge: 'Yarım Gün' },
  { label: 'Günde 1 Kez', minutes: 1440, badge: 'Günlük' },
  { label: 'Sadece Randevu Saatinde', minutes: 0, badge: 'Tek Sefer' },
];

export function formatRepeatIntervalLabel(minutes: number): string {
  if (!minutes || minutes <= 0) return 'Sadece Randevu Saatinde';
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? 'Günde 1 Kez (24 Saatte Bir)' : `${days} Günde Bir`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 Saatte Bir' : `${hours} Saatte Bir`;
  }
  return `${minutes} Dakikada Bir`;
}

export function getAppointmentTimestamp(dateStr: string, timeStr: string): number {
  if (!dateStr) return NaN;
  const cleanTime = (timeStr || '09:00').trim();
  const normalizedTime = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
  const parsed = new Date(`${dateStr}T${normalizedTime}`).getTime();
  return parsed;
}

function getTodayDateInput(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultTimeInput(offsetMinutes = 60): { date: string; time: string } {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

export const AppointmentsModal: React.FC<AppointmentsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const {
    appointments,
    cariler,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    completeAppointment,
    triggerAppointmentTestNotification,
  } = useStorage();

  // Tek ekranda hem Kayıtlı Cari Seçimi hem Manuel Cari Yazımı
  const [selectedCariName, setSelectedCariName] = useState('');
  const [manualCariName, setManualCariName] = useState('');

  const [description, setDescription] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => getDefaultTimeInput(120).date);
  const [appointmentTime, setAppointmentTime] = useState(() => getDefaultTimeInput(120).time);

  // Repeat reminder state
  const [selectedRepeatPreset, setSelectedRepeatPreset] = useState<number | 'custom'>(30);
  const [customRepeatValue, setCustomRepeatValue] = useState<string>('45');
  const [customRepeatUnit, setCustomRepeatUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [remindBeforeDue, setRemindBeforeDue] = useState<boolean>(true);

  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);
  // 3 Ana Sekme: 'form' (Yeni Randevu), 'open' (Açık Randevular), 'closed' (Kapalı Randevular)
  const [activeTab, setActiveTab] = useState<'form' | 'open' | 'closed'>('form');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(t);
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && !editingItem) {
      const def = getDefaultTimeInput(120);
      setAppointmentDate(def.date);
      setAppointmentTime(def.time);
      setError('');
    }
  }, [isOpen, editingItem]);

  // Aktif Cari Adı: Manuel kutuya yazıldıysa manuel, listeden seçildiyse seçilen cari
  const effectiveCariName = useMemo(() => {
    if (manualCariName.trim()) return manualCariName.trim();
    if (selectedCariName.trim()) return selectedCariName.trim();
    return '';
  }, [manualCariName, selectedCariName]);

  const isManualCariActive = Boolean(manualCariName.trim());

  const effectiveRepeatMinutes = useMemo(() => {
    if (selectedRepeatPreset !== 'custom') {
      return selectedRepeatPreset;
    }
    const val = Math.max(1, parseInt(customRepeatValue || '15', 10) || 15);
    if (customRepeatUnit === 'days') return val * 1440;
    if (customRepeatUnit === 'hours') return val * 60;
    return val;
  }, [selectedRepeatPreset, customRepeatValue, customRepeatUnit]);

  const myAppointments = useMemo(() => {
    const safe = Array.isArray(appointments) ? appointments : [];
    if (!user) return [];
    return safe
      .filter((a) => a && a.userId === user.id)
      .sort((a, b) => {
        const tA = getAppointmentTimestamp(a.appointmentDate, a.appointmentTime) || 0;
        const tB = getAppointmentTimestamp(b.appointmentDate, b.appointmentTime) || 0;
        return tA - tB;
      });
  }, [appointments, user]);

  // Açık Randevular: Tamamlandı denmeyen tüm randevular (vakti geçmiş olsa bile Tamamlandı denene kadar Açık Randevularda kalır!)
  const openAppointments = useMemo(
    () => myAppointments.filter((a) => a.status !== 'completed'),
    [myAppointments]
  );

  // Kapalı Randevular: Yalnızca "Tamamlandı" işaretlenen randevular
  const closedAppointments = useMemo(
    () =>
      myAppointments
        .filter((a) => a.status === 'completed')
        .sort((a, b) => (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0)),
    [myAppointments]
  );

  if (!isOpen) return null;

  const applyQuickTimePreset = (offsetMinutes: number) => {
    const res = getDefaultTimeInput(offsetMinutes);
    setAppointmentDate(res.date);
    setAppointmentTime(res.time);
  };

  const applyTomorrowAt = (hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setAppointmentDate(`${yyyy}-${mm}-${dd}`);
    setAppointmentTime(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };

  const applyDaysLaterAt = (days: number, hour = 10, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setAppointmentDate(`${yyyy}-${mm}-${dd}`);
    setAppointmentTime(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };

  const startEditing = (item: AppointmentItem) => {
    setEditingItem(item);
    const existsInCariler = (cariler || []).some(
      (c) => c.trim().toLocaleLowerCase('tr') === (item.cariName || '').trim().toLocaleLowerCase('tr')
    );
    if (item.isManualCari || (!existsInCariler && item.cariName && item.cariName !== 'Genel Randevu')) {
      setManualCariName(item.cariName || '');
      setSelectedCariName('');
    } else {
      setSelectedCariName(item.cariName === 'Genel Randevu' ? '' : item.cariName || '');
      setManualCariName('');
    }
    setDescription(item.description || '');
    setAppointmentDate(item.appointmentDate || getTodayDateInput());
    setAppointmentTime(item.appointmentTime || '09:00');
    setRemindBeforeDue(item.remindBeforeDue !== false);

    const mins = item.repeatMinutes ?? 30;
    const isPreset = REPEAT_PRESETS.some((p) => p.minutes === mins);
    if (isPreset) {
      setSelectedRepeatPreset(mins);
    } else {
      setSelectedRepeatPreset('custom');
      if (mins % 1440 === 0) {
        setCustomRepeatValue(String(mins / 1440));
        setCustomRepeatUnit('days');
      } else if (mins % 60 === 0) {
        setCustomRepeatValue(String(mins / 60));
        setCustomRepeatUnit('hours');
      } else {
        setCustomRepeatValue(String(mins));
        setCustomRepeatUnit('minutes');
      }
    }
    setActiveTab('form');
    setError('');
  };

  const resetForm = () => {
    setEditingItem(null);
    setSelectedCariName('');
    setManualCariName('');
    setDescription('');
    const def = getDefaultTimeInput(120);
    setAppointmentDate(def.date);
    setAppointmentTime(def.time);
    setSelectedRepeatPreset(30);
    setRemindBeforeDue(true);
    setError('');
  };

  const handleReopenAppointment = async (item: AppointmentItem) => {
    await updateAppointment(item.id, {
      status: 'pending',
      completedAt: undefined,
      dueNotified: false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCari = effectiveCariName || 'Genel Randevu';
    const cleanDesc = description.trim();

    if (!cleanDesc) {
      setError('Lütfen randevu açıklamasını / konusunu yazınız.');
      return;
    }
    if (!appointmentDate || !appointmentTime) {
      setError('Lütfen randevu tarih ve saatini seçiniz.');
      return;
    }

    const targetTs = getAppointmentTimestamp(appointmentDate, appointmentTime);
    if (isNaN(targetTs)) {
      setError('Geçersiz randevu tarihi veya saati.');
      return;
    }

    setIsSubmitting(true);
    try {
      await NotificationService.requestPermission().catch(() => {});
      if (user) {
        OneSignalService.requestPermission({
          id: user.id,
          name: user.name,
          role: user.role,
        }).catch(() => {});
      }

      const repeatLabel = formatRepeatIntervalLabel(effectiveRepeatMinutes);

      if (editingItem) {
        await updateAppointment(editingItem.id, {
          cariName: cleanCari,
          isManualCari: isManualCariActive,
          description: cleanDesc,
          appointmentDate,
          appointmentTime,
          repeatMinutes: effectiveRepeatMinutes,
          repeatLabel,
          remindBeforeDue,
        });
      } else {
        await addAppointment({
          cariName: cleanCari,
          isManualCari: isManualCariActive,
          description: cleanDesc,
          appointmentDate,
          appointmentTime,
          repeatMinutes: effectiveRepeatMinutes,
          repeatLabel,
          remindBeforeDue,
        });
      }

      resetForm();
      setActiveTab('open');
    } catch (err: any) {
      setError(err?.message || 'Randevu kaydedilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCountdownBadge = (dateStr: string, timeStr: string, status?: string) => {
    if (status === 'completed') {
      return {
        label: 'Kapalı (Tamamlandı)',
        cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      };
    }
    const ts = getAppointmentTimestamp(dateStr, timeStr);
    if (isNaN(ts)) {
      return {
        label: 'Tarih Yok',
        cls: 'bg-slate-800 text-slate-400 border-slate-700',
      };
    }
    const diff = ts - nowMs;
    if (diff <= 0) {
      const passedMins = Math.floor(Math.abs(diff) / 60000);
      return {
        label:
          passedMins < 2
            ? '🔔 Randevu Vakti Geldi!'
            : passedMins < 60
            ? `🚨 ${passedMins} dk geçti (Açık)`
            : '🚨 Randevu Saati Geçti (Açık)',
        cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
      };
    }
    const totalMins = Math.ceil(diff / 60000);
    if (totalMins < 60) {
      return {
        label: `⏳ ${totalMins} dk kaldı`,
        cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    }
    const hours = Math.floor(totalMins / 60);
    const remMins = totalMins % 60;
    if (hours < 24) {
      return {
        label: remMins > 0 ? `⏳ ${hours} sa ${remMins} dk kaldı` : `⏳ ${hours} saat kaldı`,
        cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      };
    }
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return {
      label: remHours > 0 ? `📅 ${days} gün ${remHours} sa kaldı` : `📅 ${days} gün kaldı`,
      cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
  };

  const formCountdown = getCountdownBadge(appointmentDate, appointmentTime);

  const renderAppointmentList = (list: AppointmentItem[], isClosedTab: boolean) => {
    if (list.length === 0) {
      return (
        <div className="py-12 px-4 text-center rounded-2xl bg-slate-800/40 border border-dashed border-slate-700 space-y-3">
          {isClosedTab ? (
            <FolderCheck className="w-10 h-10 text-emerald-500/60 mx-auto" />
          ) : (
            <FolderOpen className="w-10 h-10 text-amber-400/70 mx-auto" />
          )}
          <div className="text-sm font-bold text-slate-300">
            {isClosedTab
              ? 'Henüz tamamlanmış (kapalı) randevunuz bulunmuyor.'
              : 'Şu anda açık randevunuz bulunmuyor.'}
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isClosedTab
              ? 'Açık randevularınızda "Tamamlandı" butonuna bastığınızda randevular buraya aktarılır ve bildirimleri durdurulur.'
              : 'Yeni bir randevu oluşturduğunuzda siz "Tamamlandı" diyene kadar Açık Randevular sekmesinde kalır ve belirlediğiniz aralıkla bildirim gönderir.'}
          </p>
          {!isClosedTab && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveTab('form');
              }}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black shadow-md hover:bg-cyan-400 transition cursor-pointer"
            >
              + Yeni Randevu Oluştur
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {list.map((item) => {
          const badge = getCountdownBadge(item.appointmentDate, item.appointmentTime, item.status);
          const isCompleted = item.status === 'completed';
          const nextRemDiff =
            item.nextReminderAt && item.repeatMinutes > 0 && !isCompleted
              ? Math.max(0, Math.ceil((item.nextReminderAt - nowMs) / 60000))
              : null;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition space-y-3 ${
                isCompleted
                  ? 'bg-slate-800/35 border-emerald-500/25'
                  : 'bg-slate-800/75 border-slate-700 hover:border-cyan-500/40 shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-2 rounded-xl border shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                        : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-white text-sm sm:text-base truncate">
                        {item.cariName || 'Genel Randevu'}
                      </span>
                      <span
                        className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                          isCompleted
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isCompleted ? 'Kapalı Randevu' : 'Açık Randevu'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                      <span className="font-bold text-cyan-300">
                        📅 {item.appointmentDate} • 🕒 {item.appointmentTime}
                      </span>
                      <span>•</span>
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        {item.repeatLabel || formatRepeatIntervalLabel(item.repeatMinutes)}
                      </span>
                    </div>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-black border shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>

              {/* Description */}
              <div
                className={`p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap ${
                  isCompleted ? 'line-through text-slate-400' : ''
                }`}
              >
                {item.description}
              </div>

              {/* Bottom Info & Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  {!isCompleted && nextRemDiff !== null ? (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/25 font-bold flex items-center gap-1">
                      <BellRing className="w-3 h-3 animate-pulse" />
                      {nextRemDiff <= 0
                        ? 'Bildirim gönderiliyor...'
                        : `Sonraki hatırlatma: ~${nextRemDiff} dk sonra`}
                    </span>
                  ) : isCompleted ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tamamlandı • Bildirimler durduruldu
                    </span>
                  ) : (
                    <span>Randevu saatinde bildirim gönderilecek</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {!isCompleted ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          triggerAppointmentTestNotification(item.cariName, item.description)
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Bu Randevu İçin Şimdi Bildirim Gönder"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>Şimdi Hatırlat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Düzenle</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => completeAppointment(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 shadow transition cursor-pointer"
                        title="Tamamlandı Olarak İşaretle ve Kapalı Randevulara Taşı"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Tamamlandı</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReopenAppointment(item)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      title="Tekrar Açık Randevulara Geri Al"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Açık Randevulara Al</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `"${item.cariName}" randevusunu silmek istediğinize emin misiniz?`
                        )
                      ) {
                        deleteAppointment(item.id);
                      }
                    }}
                    className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/25 transition cursor-pointer"
                    title="Randevuyu Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-inner shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Randevu & Akıllı Hatırlatıcı
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <BellRing className="w-3 h-3 animate-bounce" />
                  Bildirim Garantili
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Cari seçin veya manuel yazın, istediğiniz sıklıkta kesintisiz bildirim alın
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs: Yeni Randevu | Açık Randevular | Kapalı Randevular */}
        <div className="px-5 pt-3 pb-2.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingItem ? 'Randevuyu Düzenle' : 'Yeni Randevu'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('open')}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'open'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Açık Randevular</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'open'
                    ? 'bg-slate-950/30 text-slate-950'
                    : openAppointments.length > 0
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {openAppointments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('closed')}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'closed'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <FolderCheck className="w-3.5 h-3.5" />
              <span>Kapalı Randevular</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'closed'
                    ? 'bg-slate-950/30 text-slate-950'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {closedAppointments.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerAppointmentTestNotification(
                effectiveCariName || 'Örnek Cari / Müşteri',
                description.trim() || 'Randevu bildirim ve ses testi başarıyla çalışıyor!'
              );
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Cihazınıza Anında Test Bildirimi ve Ses Gönderin"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Bildirimi Test Et</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. CARİ SEÇİMİ VE MANUEL YAZMA TEK EKRANDA */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>1. Cari / Müşteri Bilgisi</span>
                  </label>
                  {effectiveCariName && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 truncate max-w-[260px]">
                      Aktif Cari: {effectiveCariName}
                    </span>
                  )}
                </div>

                {/* A) Kayıtlı Carilerden Seçme */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-slate-300">
                    Kayıtlı Carilerden Seçin:
                  </span>
                  <CariSelect
                    value={selectedCariName}
                    onChange={(val) => {
                      setSelectedCariName(val);
                      if (val) {
                        setManualCariName('');
                      }
                    }}
                    placeholder="Kayıtlı carilerden seçin veya arayın..."
                  />
                </div>

                {/* Ayırıcı */}
                <div className="flex items-center gap-3">
                  <div className="h-px bg-slate-700/80 flex-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    VEYA MANUEL YAZIN
                  </span>
                  <div className="h-px bg-slate-700/80 flex-1" />
                </div>

                {/* B) Manuel Cari / Müşteri Yazma (Aynı Ekranda Doğrudan Açık) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Manuel Cari / Müşteri / Kişi Adı Yazın:</span>
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualCariName}
                      onChange={(e) => {
                        setManualCariName(e.target.value);
                        if (e.target.value.trim()) {
                          setSelectedCariName('');
                        }
                      }}
                      placeholder="Listede olmayan cari, müşteri veya kişi adını buraya direkt yazabilirsiniz..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    {manualCariName && (
                      <button
                        type="button"
                        onClick={() => setManualCariName('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        title="Temizle"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. RANDEVU AÇIKLAMASI / KONUSU */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-2">
                <label className="block text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span>2. Randevu Açıklaması / Konusu</span>
                  <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Randevu detayı, yapılacak görüşme, keşif, tahsilat veya hatırlatılacak konuyu yazınız..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>

              {/* 3. TARİH VE SAAT SEÇİMİ */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>3. Randevu Tarihi ve Saati</span>
                    <span className="text-rose-400">*</span>
                  </label>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${formCountdown.cls}`}
                  >
                    {formCountdown.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 mb-1">
                      Randevu Tarihi
                    </span>
                    <input
                      type="date"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 mb-1">
                      Randevu Saati
                    </span>
                    <input
                      type="time"
                      value={appointmentTime}
                      onChange={(e) => setAppointmentTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                {/* Hızlı Tarih/Saat Kısayolları */}
                <div className="pt-1">
                  <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    Hızlı Randevu Zamanı Seçimi:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyQuickTimePreset(30)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      +30 Dk Sonra
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickTimePreset(60)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      +1 Saat Sonra
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickTimePreset(180)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      +3 Saat Sonra
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTomorrowAt(9, 0)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      Yarın 09:00
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTomorrowAt(14, 0)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      Yarın 14:00
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDaysLaterAt(3, 10, 0)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      +3 Gün Sonra
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDaysLaterAt(7, 10, 0)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      +1 Hafta Sonra
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. NE KADARDA BİR HATIRLATILACAĞI (PERİYODİK BİLDİRİM SIKLIĞI) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-800/70 to-slate-900 border border-amber-500/30 space-y-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Repeat className="w-4 h-4 text-amber-400" />
                    <span>4. Ne Kadarda Bir Hatırlatılsın? (Bildirim Sıklığı)</span>
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/40">
                    Seçili: {formatRepeatIntervalLabel(effectiveRepeatMinutes)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {REPEAT_PRESETS.map((preset) => {
                    const isSelected = selectedRepeatPreset === preset.minutes;
                    return (
                      <button
                        key={preset.minutes}
                        type="button"
                        onClick={() => setSelectedRepeatPreset(preset.minutes)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-lg shadow-amber-500/20'
                            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 font-bold'
                        }`}
                      >
                        <span className="text-xs leading-tight">{preset.label}</span>
                        <span
                          className={`text-[10px] mt-1 inline-block ${
                            isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-400'
                          }`}
                        >
                          {preset.badge}
                        </span>
                      </button>
                    );
                  })}

                  {/* Özel Süre Seçeneği */}
                  <button
                    type="button"
                    onClick={() => setSelectedRepeatPreset('custom')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      selectedRepeatPreset === 'custom'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-lg shadow-cyan-500/20'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border-cyan-500/30 font-bold'
                    }`}
                  >
                    <span className="text-xs leading-tight flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      Özel Süre Gir
                    </span>
                    <span
                      className={`text-[10px] mt-1 inline-block ${
                        selectedRepeatPreset === 'custom' ? 'text-slate-900 font-extrabold' : 'text-cyan-400/80'
                      }`}
                    >
                      Dk / Saat / Gün
                    </span>
                  </button>
                </div>

                {/* Özel Süre Giriş Kutusu */}
                {selectedRepeatPreset === 'custom' && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/40 flex flex-wrap items-center gap-2.5 animate-in fade-in duration-150">
                    <span className="text-xs font-bold text-cyan-300">Her</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={customRepeatValue}
                      onChange={(e) => setCustomRepeatValue(e.target.value)}
                      className="w-20 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm font-black text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <select
                      value={customRepeatUnit}
                      onChange={(e) => setCustomRepeatUnit(e.target.value as any)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="minutes">Dakikada Bir</option>
                      <option value="hours">Saatte Bir</option>
                      <option value="days">Günde Bir</option>
                    </select>
                    <span className="text-xs font-bold text-slate-300">
                      bildirim gönder ({formatRepeatIntervalLabel(effectiveRepeatMinutes)})
                    </span>
                  </div>
                )}

                {/* Periyodik Hatırlatmanın Ne Zaman Başlayacağı */}
                {effectiveRepeatMinutes > 0 && (
                  <div className="pt-1 space-y-2">
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 cursor-pointer hover:border-amber-500/40 transition">
                      <input
                        type="checkbox"
                        checked={remindBeforeDue}
                        onChange={(e) => setRemindBeforeDue(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-extrabold text-white block">
                          Şimdiden İtibaren Randevu Tamamlanana Kadar Periyodik Hatırlat
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          İşaretli olduğunda randevu vaktine kadar her{' '}
                          <b className="text-amber-300">{formatRepeatIntervalLabel(effectiveRepeatMinutes)}</b>{' '}
                          hatırlatır, tam randevu saatinde alarm çalar ve siz <b>"Tamamlandı"</b> diyene kadar Açık Randevularda kalıp hatırlatmaya devam eder.
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Canlı Bildirim Garantisi Özeti */}
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-2.5">
                  <BellRing className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="text-[11px] sm:text-xs text-emerald-200 leading-relaxed">
                    <span className="font-black text-emerald-300">Kesintisiz Bildirim Garantisi:</span>{' '}
                    {effectiveRepeatMinutes > 0 ? (
                      <>
                        <b>{effectiveCariName || 'Genel Randevu'}</b> için{' '}
                        <b>{formatRepeatIntervalLabel(effectiveRepeatMinutes)}</b> ve tam randevu zamanında (
                        <b>
                          {appointmentDate} • {appointmentTime}
                        </b>
                        ) siz randevuyu <b>Tamamlandı</b> olarak kapatana kadar bildirim gönderilecektir.
                      </>
                    ) : (
                      <>
                        <b>{effectiveCariName || 'Genel Randevu'}</b> için tam randevu zamanında (
                        <b>
                          {appointmentDate} • {appointmentTime}
                        </b>
                        ) sesli alarm ve kilit ekranı bildirimi gönderilecektir.
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                {editingItem && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-bold border border-slate-700 transition cursor-pointer"
                  >
                    Düzenlemeyi İptal Et
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <BellRing className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Kaydediliyor...'
                      : editingItem
                      ? 'Randevuyu ve Hatırlatıcıyı Güncelle'
                      : 'Randevuyu Kaydet & Bildirimleri Başlat'}
                  </span>
                </button>
              </div>
            </form>
          ) : activeTab === 'open' ? (
            /* AÇIK RANDEVULAR SEKMESİ */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                <div className="flex items-center gap-2 text-xs text-amber-200 font-bold">
                  <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Açık Randevular ({openAppointments.length}) — "Tamamlandı" denene kadar burada kalır ve bildirim göndermeye devam eder.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('form');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Yeni Randevu</span>
                </button>
              </div>

              {renderAppointmentList(openAppointments, false)}
            </div>
          ) : (
            /* KAPALI RANDEVULAR SEKMESİ */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                <div className="flex items-center gap-2 text-xs text-emerald-200 font-bold">
                  <FolderCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Kapalı Randevular ({closedAppointments.length}) — Tamamlanan ve bildirimleri durdurulan randevular.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('open')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer shrink-0"
                >
                  Açık Randevulara Dön ({openAppointments.length})
                </button>
              </div>

              {renderAppointmentList(closedAppointments, true)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
