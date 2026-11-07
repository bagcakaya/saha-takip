import { AttendanceRecord, ShiftDefinition, ShiftAssignment, LeaveRequest } from '../types/storage';
import { StorageService } from './storageService';
import { NotificationService } from './notificationService';
import { FastActionAgent } from './fastActionAgent';

export interface ShiftReminderCheckParams {
  attendanceRecords: AttendanceRecord[];
  shifts: ShiftDefinition[];
  shiftAssignments: ShiftAssignment[];
  leaveRequests?: LeaveRequest[];
  companyCode: string;
  currentUser?: { id: string; role?: string; name?: string; companyCode?: string };
  onUpdateRecord?: (record: AttendanceRecord) => void;
}

const LOCAL_DEDUP_PREFIX = '@shift_checkout_alert_';
const LOCAL_CHECKIN_DEDUP_PREFIX = '@shift_checkin_alert_';

type DedupAlertType = '5m' | '10m' | 'staff' | 'admin' | '20m';
type CheckinDedupAlertType = '15m';

const inFlightAlertKeys = new Set<string>();

function getLocalDedupKey(dateStr: string, userId: string, type: DedupAlertType): string {
  return `${LOCAL_DEDUP_PREFIX}${dateStr}_${userId}_${type}`;
}

function hasSentLocalAlert(dateStr: string, userId: string, type: DedupAlertType): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLocalDedupKey(dateStr, userId, type)) === '1';
  } catch {
    return false;
  }
}

function markSentLocalAlert(dateStr: string, userId: string, type: DedupAlertType): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalDedupKey(dateStr, userId, type), '1');
  } catch {}
}

function getLocalCheckinDedupKey(dateStr: string, userId: string, type: CheckinDedupAlertType): string {
  return `${LOCAL_CHECKIN_DEDUP_PREFIX}${dateStr}_${userId}_${type}`;
}

function hasSentLocalCheckinAlert(dateStr: string, userId: string, type: CheckinDedupAlertType): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLocalCheckinDedupKey(dateStr, userId, type)) === '1';
  } catch {
    return false;
  }
}

function markSentLocalCheckinAlert(dateStr: string, userId: string, type: CheckinDedupAlertType): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalCheckinDedupKey(dateStr, userId, type), '1');
  } catch {}
}

function isUserCheckedInOrExcused(
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  userId: string,
  dateStr: string,
  shiftStartMs: number,
  shiftStartMinutes: number
): boolean {
  // 1. Check attendance records (checked in today, pending check-in approval, completed, or marked on_leave)
  if (Array.isArray(records) && records.length > 0) {
    const hasCheckIn = records.some((r) => {
      if (!r || r.userId !== userId) return false;
      const isSameDate =
        r.date === dateStr ||
        (r.checkInTime && Number(r.checkInTime) >= shiftStartMs - 4 * 60 * 60 * 1000);
      if (!isSameDate) return false;

      if (r.checkInTime && Number(r.checkInTime) > 0) return true;
      if (
        r.status === 'checked_in' ||
        r.status === 'pending_checkin_approval' ||
        r.status === 'completed' ||
        r.status === 'pending_checkout_approval' ||
        r.status === 'on_leave'
      ) {
        return true;
      }
      return false;
    });
    if (hasCheckIn) return true;
  }

  // 2. Check approved leave requests covering today's shift start
  if (Array.isArray(leaveRequests) && leaveRequests.length > 0) {
    const hasApprovedLeave = leaveRequests.some((req) => {
      if (!req || req.userId !== userId || req.status !== 'approved') return false;
      if (req.leaveType === 'daily') {
        const start = req.date;
        const end = req.endDate || req.date;
        if (start && dateStr >= start && dateStr <= end) return true;
      } else if (req.leaveType === 'hourly' && req.date === dateStr && req.startTime && req.endTime) {
        const [sh, sm] = req.startTime.split(':').map(Number);
        const [eh, em] = req.endTime.split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          const leaveStartMin = sh * 60 + sm;
          const leaveEndMin = eh * 60 + em;
          if (shiftStartMinutes >= leaveStartMin && shiftStartMinutes < leaveEndMin) {
            return true;
          }
        }
      }
      return false;
    });
    if (hasApprovedLeave) return true;
  }

  return false;
}

function isUserCheckedOutInRecords(records: AttendanceRecord[], userId: string, dateStr: string): {
  hasCheckedOut: boolean;
  activeRecord: AttendanceRecord | undefined;
} {
  const userTodayRecords = records.filter((r) => r.userId === userId && r.date === dateStr);
  if (userTodayRecords.length === 0) {
    return { hasCheckedOut: false, activeRecord: undefined };
  }

  const hasCheckedOut = userTodayRecords.some((r) => {
    if (r.checkOutTime && Number(r.checkOutTime) > 0) return true;
    if (r.status === 'completed' || r.status === 'pending_checkout_approval') return true;
    if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return true;
    return false;
  });

  const activeRecord = userTodayRecords.find((r) => {
    if (!r.checkInTime) return false;
    if (r.checkOutTime && Number(r.checkOutTime) > 0) return false;
    if (r.status === 'completed' || r.status === 'pending_checkout_approval') return false;
    if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return false;
    return r.status === 'checked_in';
  });

  return { hasCheckedOut, activeRecord };
}

export const ShiftReminderService = {
  /**
   * Returns today's date in local YYYY-MM-DD format based on system clock
   */
  getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Determines if a staff member has an assigned shift that is scheduled for today.
   * STRICT: Returns null if no shift assignment or today is not in daysOfWeek.
   */
  getAssignedShiftForToday(
    userId: string,
    shifts: ShiftDefinition[],
    shiftAssignments: ShiftAssignment[]
  ): { assignment: ShiftAssignment; shift: ShiftDefinition } | null {
    if (!userId || !shiftAssignments || shiftAssignments.length === 0) return null;

    const assignment = shiftAssignments.find((a) => a.userId === userId);
    if (!assignment) return null;

    const shift = (shifts && shifts.find((s) => s.id === assignment.shiftId)) || {
      id: assignment.shiftId,
      companyCode: assignment.companyCode,
      name: assignment.shiftName,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      daysOfWeek: [1, 2, 3, 4, 5, 6],
      createdAt: 0,
      updatedAt: 0,
    };

    // Day check: 1 = Pazartesi ... 7 = Pazar
    let currentDay = new Date().getDay();
    if (currentDay === 0) currentDay = 7;

    if (shift.daysOfWeek && shift.daysOfWeek.length > 0 && !shift.daysOfWeek.includes(currentDay)) {
      return null; // Today is not an active workday for this shift
    }

    return { assignment, shift };
  },

  /**
   * Calculates exact shift start and +15m check-in reminder threshold for today:
   * - shiftStartMs: Exact shift start time
   * - targetCheckIn15mMs: 15 minutes after shift start (+15m) -> Check-in reminder to staff
   * - shiftEndMs: Exact shift end time
   */
  calculateShiftStartTimestamps(
    shift: ShiftDefinition,
    assignment?: ShiftAssignment
  ): {
    shiftStartMs: number;
    targetCheckIn15mMs: number;
    shiftEndMs: number;
    shiftStartMinutes: number;
  } | null {
    const startTimeStr = shift.startTime || assignment?.startTime;
    if (!startTimeStr || !startTimeStr.includes(':')) return null;

    const endTimeStr = shift.endTime || assignment?.endTime || '18:00';
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    if (isNaN(startH) || isNaN(startM)) return null;

    const now = new Date();
    const shiftStartDate = new Date();
    shiftStartDate.setHours(startH, startM, 0, 0);

    const shiftEndDate = new Date();
    const safeEndH = isNaN(endH) ? 18 : endH;
    const safeEndM = isNaN(endM) ? 0 : endM;
    shiftEndDate.setHours(safeEndH, safeEndM, 0, 0);

    const startTotalMin = startH * 60 + startM;
    const endTotalMin = safeEndH * 60 + safeEndM;

    // Cross-midnight / overnight shift handling (e.g. 22:00 to 06:00)
    if (endTotalMin <= startTotalMin) {
      const currentTotalMin = now.getHours() * 60 + now.getMinutes();
      if (currentTotalMin <= endTotalMin) {
        shiftStartDate.setDate(shiftStartDate.getDate() - 1);
      } else {
        shiftEndDate.setDate(shiftEndDate.getDate() + 1);
      }
    }

    const shiftStartMs = shiftStartDate.getTime();
    const targetCheckIn15mMs = shiftStartMs + 15 * 60 * 1000; // Vardiya başlangıcından 15 dk sonra personele hatırlatma
    const shiftEndMs = shiftEndDate.getTime();

    return {
      shiftStartMs,
      targetCheckIn15mMs,
      shiftEndMs,
      shiftStartMinutes: startTotalMin,
    };
  },

  /**
   * Calculates exact shift end and staff reminder thresholds for today:
   * - shiftEndMs: Exact shift end time
   * - target5mMs: 5 minutes after shift end time (+5m) -> 1st reminder to staff
   * - target10mMs: 10 minutes after shift end time (+10m) -> 2nd reminder to staff
   */
  calculateShiftTimestamps(
    shift: ShiftDefinition,
    assignment?: ShiftAssignment
  ): {
    shiftEndMs: number;
    target5mMs: number;
    target10mMs: number;
    targetStaffMs: number;
    targetAdminMs: number;
    target20mMs: number;
  } | null {
    const endTimeStr = shift.endTime || assignment?.endTime;
    if (!endTimeStr || !endTimeStr.includes(':')) return null;

    const startTimeStr = shift.startTime || assignment?.startTime || '08:30';

    const [endH, endM] = endTimeStr.split(':').map(Number);
    const [startH, startM] = startTimeStr.split(':').map(Number);

    if (isNaN(endH) || isNaN(endM)) return null;

    const now = new Date();
    const shiftEndDate = new Date();
    shiftEndDate.setHours(endH, endM, 0, 0);

    // Cross-midnight / overnight shift handling (e.g. 22:00 to 06:00)
    const startTotalMin = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 30 : startM);
    const endTotalMin = endH * 60 + endM;
    if (endTotalMin <= startTotalMin) {
      const currentTotalMin = now.getHours() * 60 + now.getMinutes();
      if (currentTotalMin >= startTotalMin) {
        shiftEndDate.setDate(shiftEndDate.getDate() + 1);
      }
    }

    const shiftEndMs = shiftEndDate.getTime();
    const target5mMs = shiftEndMs + 5 * 60 * 1000; // Vardiya bitiminden 5 dk sonra personele 1. bildirim
    const target10mMs = shiftEndMs + 10 * 60 * 1000; // Vardiya bitiminden 10 dk sonra personele 2. bildirim
    const target20mMs = shiftEndMs + 20 * 60 * 1000;

    return {
      shiftEndMs,
      target5mMs,
      target10mMs,
      targetStaffMs: target5mMs,
      targetAdminMs: target10mMs,
      target20mMs,
    };
  },

  /**
   * KESİN KURAL:
   * Vardiya çıkış bildirimleri sabah işe girişte OneSignal sunucusuna saatler öncesinden ZAMANLANMAZ!
   * Önceden zamanlanan bildirimler, personel vardiya saatinde çıkış yapsa bile OneSignal kuyruğunda kalarak
   * yanlış bildirim gitmesine yol açabilmektedir.
   * Bunun yerine bildirimler yalnızca vardiya bitiminden +5 dk ve +10 dk sonra personel HALA çıkış yapmamışsa
   * canlı veritabanı kontrolü yapılarak SADECE ilgili personele gönderilir (Yöneticiye ASLA bildirim gitmez).
   */
  async scheduleShiftCheckoutReminders(_params: {
    record: AttendanceRecord;
    shift: ShiftDefinition;
    companyCode: string;
  }): Promise<{
    shiftStaffId?: string;
    shiftAdminId?: string;
    shift10mId?: string;
    shift20mId?: string;
  }> {
    return {
      shiftStaffId: undefined,
      shiftAdminId: undefined,
      shift10mId: undefined,
      shift20mId: undefined,
    };
  },

  /**
   * Blocks local check-in alert key immediately when staff checks in so no reminder is ever triggered
   */
  cancelShiftCheckinReminders(userId: string, dateStr?: string, _companyCode?: string): void {
    if (!userId) return;
    const targetDate = dateStr || this.getTodayDateString();
    markSentLocalCheckinAlert(targetDate, userId, '15m');
  },

  /**
   * Cancels any pre-scheduled notifications and blocks local alert keys when staff checks out
   */
  cancelShiftCheckoutReminders(record: AttendanceRecord, companyCode?: string): void {
    const comp = (companyCode || record.companyCode || 'POLATLAR').toUpperCase();
    const dateStr = record.date || this.getTodayDateString();

    const idsToCancel = new Set<string>();
    if (record.shiftCheckout5mNotificationId) idsToCancel.add(record.shiftCheckout5mNotificationId);
    if (record.shiftCheckoutStaffNotificationId) idsToCancel.add(record.shiftCheckoutStaffNotificationId);
    if (record.shiftCheckoutAdminNotificationId) idsToCancel.add(record.shiftCheckoutAdminNotificationId);
    if (record.shiftCheckout10mNotificationId) idsToCancel.add(record.shiftCheckout10mNotificationId);
    if (record.shiftCheckout20mNotificationId) idsToCancel.add(record.shiftCheckout20mNotificationId);

    for (const notifId of idsToCancel) {
      FastActionAgent.enqueueCancelNotification(notifId, comp);
    }

    // Personel çıkış yaptığı için bugünün bildirim anahtarlarını kalıcı olarak bloke et
    if (record.userId) {
      markSentLocalAlert(dateStr, record.userId, '5m');
      markSentLocalAlert(dateStr, record.userId, '10m');
      markSentLocalAlert(dateStr, record.userId, 'staff');
      markSentLocalAlert(dateStr, record.userId, 'admin');
      markSentLocalAlert(dateStr, record.userId, '20m');
    }
  },

  /**
   * VARDİYA BAŞLANGIÇ (İŞE GİRİŞ) HATIRLATICISI (+15. DAKİKA):
   * İşten çıkarkenki prosedürün işe giriş karşılığıdır:
   * - Önceden zamanlanmaz; vardiya başlangıcından 15 dakika geçtikten sonra canlı veritabanı kontrolü yapılır.
   * - Kullanıcı bugün işe giriş yapmışsa (onaylı veya yönetici onayı bekleyen) ya da onaylı izni varsa BİLDİRİM GİTMEZ.
   * - Hala giriş yapmadıysa SADECE ilgili kullanıcıya bildirim gönderilir (Yöneticiye ASLA gitmez) ve
   *   bulut Slot 23 kaydı ile aynı gün mükerrer bildirim gitmesi engellenir.
   */
  async checkShiftCheckinReminders(params: ShiftReminderCheckParams): Promise<void> {
    const {
      attendanceRecords,
      shifts,
      shiftAssignments,
      leaveRequests = [],
      companyCode,
      currentUser,
    } = params;

    if (!shiftAssignments || shiftAssignments.length === 0) {
      return;
    }

    const todayStr = this.getTodayDateString();
    const now = Date.now();
    const comp = (companyCode || 'POLATLAR').toUpperCase();

    let freshCloudRecords: AttendanceRecord[] | null = null;
    let freshCloudLeaves: LeaveRequest[] | null = null;
    let freshAlertLogs: Record<string, number> | null = null;

    for (const assignment of shiftAssignments) {
      // 1. Bugün aktif vardiyası tanımlı mı kontrol et
      const assigned = this.getAssignedShiftForToday(assignment.userId, shifts, shiftAssignments);
      if (!assigned) continue;

      const { shift } = assigned;
      const startTimestamps = this.calculateShiftStartTimestamps(shift, assignment);
      if (!startTimestamps) continue;

      const { shiftStartMs, targetCheckIn15mMs, shiftEndMs, shiftStartMinutes } = startTimestamps;

      // Vardiya başlangıcının üzerinden henüz 15 dakika geçmediyse bekle
      if (now < targetCheckIn15mMs) continue;

      // Vardiya bittiyse veya başlangıçtan itibaren 4 saatten fazla geçtiyse eski kontrolleri es geç
      if (now >= shiftEndMs || now - shiftStartMs > 4 * 60 * 60 * 1000) continue;

      const cloudAlertKey = `checkin_15m_${todayStr}_${assignment.userId}`;

      // Yerel önbellekte veya devam eden istekte zaten işaretlenmişse atla
      if (hasSentLocalCheckinAlert(todayStr, assignment.userId, '15m') || inFlightAlertKeys.has(cloudAlertKey)) {
        continue;
      }

      // Önce mevcut bellek kayıtlarından kontrol et (Giriş yapmışsa veya onaylı izinliyse bildirim gitmez)
      if (
        isUserCheckedInOrExcused(
          attendanceRecords || [],
          leaveRequests,
          assignment.userId,
          todayStr,
          shiftStartMs,
          shiftStartMinutes
        )
      ) {
        markSentLocalCheckinAlert(todayStr, assignment.userId, '15m');
        continue;
      }

      const staffCompany = (assignment.companyCode || shift.companyCode || comp).trim().toUpperCase();
      inFlightAlertKeys.add(cloudAlertKey);

      try {
        // CANLI VERİTABANI DOĞRULAMASI:
        // Bildirim göndermeden hemen önce sunucudan/buluttan en güncel mesai kayıtlarını, izinleri
        // ve gönderilmiş bildirim günlüğünü (Slot 23) çekerek başka cihazdan giriş yapılmadığını doğrula!
        try {
          if (!freshCloudRecords) {
            freshCloudRecords = await StorageService.getAttendanceRecords();
          }
          if (!freshCloudLeaves) {
            freshCloudLeaves = await StorageService.getLeaveRequests(staffCompany);
          }
          if (!freshAlertLogs) {
            freshAlertLogs = await StorageService.getShiftAlertLogs(staffCompany);
          }

          if (freshAlertLogs && freshAlertLogs[cloudAlertKey]) {
            markSentLocalCheckinAlert(todayStr, assignment.userId, '15m');
            continue;
          }

          if (
            isUserCheckedInOrExcused(
              freshCloudRecords || attendanceRecords || [],
              freshCloudLeaves || leaveRequests,
              assignment.userId,
              todayStr,
              shiftStartMs,
              shiftStartMinutes
            )
          ) {
            markSentLocalCheckinAlert(todayStr, assignment.userId, '15m');
            continue;
          }
        } catch {
          // Ağ hatası olursa yerel veriye göre devam et
        }

        // Aynı gün ikinci kez bildirim gitmemesi için hem yerel hem bulut Slot 23 anahtarını mühürle
        markSentLocalCheckinAlert(todayStr, assignment.userId, '15m');
        if (freshAlertLogs) {
          freshAlertLogs[cloudAlertKey] = now;
        }
        await StorageService.markShiftAlertSent(cloudAlertKey, staffCompany);

        const appUrl =
          typeof window !== 'undefined' && window.location.origin
            ? window.location.origin
            : 'https://saha-takip-beige.vercel.app';

        const title = '🔔 Vardiya Giriş Hatırlatması (15. Dakika)';
        const message =
          'Vardiya saatiniz 15 dakika önce başladı ancak henüz işe giriş yapmadınız. Lütfen işe giriş işleminizi yapmayı unutmayın!';

        // Kullanıcı şu an sisteme bağlı olan personelin kendisi ise yerel bildirim ve ses çal
        if (currentUser?.id === assignment.userId) {
          NotificationService.playChime();
          NotificationService.sendNotification(title, message, `${appUrl}/?tab=attendance`);
        }

        // SADECE ilgili personelin telefonuna donanım push bildirimi gönder (Yöneticiye ASLA gitmez)
        FastActionAgent.enqueuePushNotification({
          title,
          message,
          targetMode: 'custom',
          targetUserIds: [assignment.userId],
          companyCode: staffCompany,
          collapseId: `shift_in_15m_${todayStr}_${assignment.userId}`,
          url: `${appUrl}/?tab=attendance`,
        });
      } finally {
        inFlightAlertKeys.delete(cloudAlertKey);
      }
    }
  },

  /**
   * Periodic runner / client-side agent check:
   * Evaluates all staff with assigned shifts for today.
   * - Yöneticiye (Admin) ASLA bildirim gönderilmez!
   * - Vardiya saati bittiği halde HALA çıkış yapmayan personele:
   *   1) +5. dakikada (target5mMs) 1. çıkış hatırlatma bildirimi gönderilir.
   *   2) +10. dakikada (target10mMs) hala çıkış yapmadıysa 2. çıkış uyarı bildirimi gönderilir.
   * - Personel çıkış yapmışsa hiçbir bildirim gönderilmez.
   */
  async checkShiftCheckoutReminders(params: ShiftReminderCheckParams): Promise<void> {
    const {
      attendanceRecords,
      shifts,
      shiftAssignments,
      companyCode,
      currentUser,
      onUpdateRecord,
    } = params;

    if (!shiftAssignments || shiftAssignments.length === 0 || !attendanceRecords || attendanceRecords.length === 0) {
      return;
    }

    const todayStr = this.getTodayDateString();
    const now = Date.now();
    const comp = (companyCode || 'POLATLAR').toUpperCase();

    let freshCloudRecords: AttendanceRecord[] | null = null;
    let freshAlertLogs: Record<string, number> | null = null;

    for (const assignment of shiftAssignments) {
      // 1. Strict Scope Check: Must have a shift assigned and valid for today
      const assigned = this.getAssignedShiftForToday(assignment.userId, shifts, shiftAssignments);
      if (!assigned) continue;

      const { shift } = assigned;
      const timestamps = this.calculateShiftTimestamps(shift, assignment);
      if (!timestamps) continue;

      const { shiftEndMs, target5mMs, target10mMs } = timestamps;

      // Vardiya bitişinin üzerinden henüz 5 dakika geçmediyse kontrol etmeye gerek yok
      if (now < target5mMs) continue;

      // Vardiya bitişi üzerinden 6 saatten fazla geçtiyse eski kayıtları es geç
      if (now - shiftEndMs > 6 * 60 * 60 * 1000) continue;

      // Önce mevcut bellek kayıtlarından kontrol et
      const localCheck = isUserCheckedOutInRecords(attendanceRecords, assignment.userId, todayStr);

      if (localCheck.hasCheckedOut || !localCheck.activeRecord) {
        markSentLocalAlert(todayStr, assignment.userId, '5m');
        markSentLocalAlert(todayStr, assignment.userId, '10m');
        markSentLocalAlert(todayStr, assignment.userId, 'staff');
        continue;
      }

      const activeRecord = localCheck.activeRecord;

      const is5mNotified =
        activeRecord.shiftCheckout5mNotified ||
        activeRecord.shiftCheckoutStaffNotified ||
        hasSentLocalAlert(todayStr, assignment.userId, '5m') ||
        hasSentLocalAlert(todayStr, assignment.userId, 'staff');

      const is10mNotified =
        activeRecord.shiftCheckout10mNotified ||
        hasSentLocalAlert(todayStr, assignment.userId, '10m');

      const needs5m = !is5mNotified && now >= target5mMs && now < target10mMs;
      const needs10m = !is10mNotified && now >= target10mMs;

      if (!needs5m && !needs10m) continue;

      const cloudKey5m = `checkout_5m_${todayStr}_${assignment.userId}`;
      const cloudKey10m = `checkout_10m_${todayStr}_${assignment.userId}`;
      const inFlightKey = needs10m ? cloudKey10m : cloudKey5m;
      if (inFlightAlertKeys.has(inFlightKey)) continue;

      const staffCompany = (activeRecord.companyCode || assignment.companyCode || shift.companyCode || comp).trim().toUpperCase();
      inFlightAlertKeys.add(inFlightKey);

      try {
        // CANLI VERİTABANI DOĞRULAMASI:
        // Bildirim göndermeden hemen önce sunucudan/buluttan en güncel mesai kayıtlarını çekerek
        // personelin başka bir cihazdan/telefondan çıkış yapıp yapmadığını kesin olarak doğrula!
        try {
          if (!freshCloudRecords) {
            freshCloudRecords = await StorageService.getAttendanceRecords();
          }
          if (!freshAlertLogs) {
            freshAlertLogs = await StorageService.getShiftAlertLogs(staffCompany);
          }

          if (freshAlertLogs) {
            if (needs5m && freshAlertLogs[cloudKey5m]) {
              markSentLocalAlert(todayStr, assignment.userId, '5m');
              markSentLocalAlert(todayStr, assignment.userId, 'staff');
              continue;
            }
            if (needs10m && freshAlertLogs[cloudKey10m]) {
              markSentLocalAlert(todayStr, assignment.userId, '10m');
              continue;
            }
          }

          if (freshCloudRecords && freshCloudRecords.length > 0) {
            const freshCheck = isUserCheckedOutInRecords(freshCloudRecords, assignment.userId, todayStr);
            if (freshCheck.hasCheckedOut || !freshCheck.activeRecord) {
              markSentLocalAlert(todayStr, assignment.userId, '5m');
              markSentLocalAlert(todayStr, assignment.userId, '10m');
              markSentLocalAlert(todayStr, assignment.userId, 'staff');
              continue;
            }
            if (
              (needs5m && (freshCheck.activeRecord.shiftCheckout5mNotified || freshCheck.activeRecord.shiftCheckoutStaffNotified)) ||
              (needs10m && freshCheck.activeRecord.shiftCheckout10mNotified)
            ) {
              if (freshCheck.activeRecord.shiftCheckout5mNotified || freshCheck.activeRecord.shiftCheckoutStaffNotified) {
                markSentLocalAlert(todayStr, assignment.userId, '5m');
                markSentLocalAlert(todayStr, assignment.userId, 'staff');
              }
              if (freshCheck.activeRecord.shiftCheckout10mNotified) {
                markSentLocalAlert(todayStr, assignment.userId, '10m');
              }
              continue;
            }
          }
        } catch {
          // Ağ hatası olursa mevcut kayda göre devam et
        }

        let recordUpdated = false;
        const updatedRecord: AttendanceRecord = { ...activeRecord };
        const appUrl =
          typeof window !== 'undefined' && window.location.origin
            ? window.location.origin
            : 'https://saha-takip-beige.vercel.app';

        // --- KONTROL 1: VARDİYA BİTİMİNDEN 5 DAKİKA SONRA (SADECE PERSONELE 1. BİLDİRİM) ---
        if (needs5m) {
          markSentLocalAlert(todayStr, assignment.userId, '5m');
          markSentLocalAlert(todayStr, assignment.userId, 'staff');
          updatedRecord.shiftCheckout5mNotified = true;
          updatedRecord.shiftCheckout5mNotifiedAt = now;
          updatedRecord.shiftCheckoutStaffNotified = true;
          updatedRecord.shiftCheckoutStaffNotifiedAt = now;
          recordUpdated = true;
          await StorageService.markShiftAlertSent(cloudKey5m, staffCompany);

          const title = '🔔 Vardiya Çıkış Hatırlatması (5. Dakika)';
          const message = 'Vardiya saatiniz 5 dakika önce sona erdi ancak henüz çıkış yapmadınız. Lütfen işten çıkış işleminizi yapmayı unutmayın!';

          // Kullanıcı şu an sisteme bağlı olan personelin kendisi ise yerel bildirim ve ses çal
          if (currentUser?.id === assignment.userId) {
            NotificationService.playChime();
            NotificationService.sendNotification(
              title,
              message,
              `${appUrl}/?tab=attendance`
            );
          }

          // SADECE ilgili personelin telefonuna push bildirim gönder (Yöneticiye ASLA gitmez)
          FastActionAgent.enqueuePushNotification({
            title,
            message,
            targetMode: 'custom',
            targetUserIds: [assignment.userId],
            companyCode: staffCompany,
            collapseId: `shift_5m_${todayStr}_${assignment.userId}`,
            url: `${appUrl}/?tab=attendance`,
          });
        }

        // --- KONTROL 2: VARDİYA BİTİMİNDEN 10 DAKİKA SONRA (SADECE PERSONELE 2. BİLDİRİM) ---
        if (needs10m) {
          markSentLocalAlert(todayStr, assignment.userId, '5m');
          markSentLocalAlert(todayStr, assignment.userId, 'staff');
          markSentLocalAlert(todayStr, assignment.userId, '10m');
          updatedRecord.shiftCheckout5mNotified = true;
          updatedRecord.shiftCheckoutStaffNotified = true;
          updatedRecord.shiftCheckout10mNotified = true;
          updatedRecord.shiftCheckout10mNotifiedAt = now;
          recordUpdated = true;
          await StorageService.markShiftAlertSent(cloudKey10m, staffCompany);

          const title = '⚠️ Vardiya Çıkış Uyarısı (10. Dakika)';
          const message = 'Vardiya saatiniz 10 dakika önce sona erdi ve hala çıkış yapmadınız! Lütfen işten çıkış işleminizi gerçekleştiriniz.';

          // Kullanıcı şu an sisteme bağlı olan personelin kendisi ise yerel bildirim ve ses çal
          if (currentUser?.id === assignment.userId) {
            NotificationService.playChime();
            NotificationService.sendNotification(
              title,
              message,
              `${appUrl}/?tab=attendance`
            );
          }

          // SADECE ilgili personelin telefonuna push bildirim gönder (Yöneticiye ASLA gitmez)
          FastActionAgent.enqueuePushNotification({
            title,
            message,
            targetMode: 'custom',
            targetUserIds: [assignment.userId],
            companyCode: staffCompany,
            collapseId: `shift_10m_${todayStr}_${assignment.userId}`,
            url: `${appUrl}/?tab=attendance`,
          });
        }

        if (recordUpdated && onUpdateRecord) {
          onUpdateRecord(updatedRecord);
        }
      } finally {
        inFlightAlertKeys.delete(inFlightKey);
      }
    }
  },
};
