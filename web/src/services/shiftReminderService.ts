import { AttendanceRecord, ShiftDefinition, ShiftAssignment } from '../types/storage';
import { StorageService } from './storageService';
import { NotificationService } from './notificationService';
import { FastActionAgent } from './fastActionAgent';

export interface ShiftReminderCheckParams {
  attendanceRecords: AttendanceRecord[];
  shifts: ShiftDefinition[];
  shiftAssignments: ShiftAssignment[];
  companyCode: string;
  currentUser?: { id: string; role?: string; name?: string; companyCode?: string };
  onUpdateRecord?: (record: AttendanceRecord) => void;
}

const LOCAL_DEDUP_PREFIX = '@shift_checkout_alert_';

type DedupAlertType = '5m' | '10m' | 'staff' | 'admin' | '20m';

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

      // CANLI VERİTABANI DOĞRULAMASI:
      // Bildirim göndermeden hemen önce sunucudan/buluttan en güncel mesai kayıtlarını çekerek
      // personelin başka bir cihazdan/telefondan çıkış yapıp yapmadığını kesin olarak doğrula!
      try {
        if (!freshCloudRecords) {
          freshCloudRecords = await StorageService.getAttendanceRecords();
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
      const staffCompany = (activeRecord.companyCode || assignment.companyCode || shift.companyCode || comp).trim().toUpperCase();
      const appUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://81.213.219.69:3001';

      // --- KONTROL 1: VARDİYA BİTİMİNDEN 5 DAKİKA SONRA (SADECE PERSONELE 1. BİLDİRİM) ---
      if (needs5m) {
        markSentLocalAlert(todayStr, assignment.userId, '5m');
        markSentLocalAlert(todayStr, assignment.userId, 'staff');
        updatedRecord.shiftCheckout5mNotified = true;
        updatedRecord.shiftCheckout5mNotifiedAt = now;
        updatedRecord.shiftCheckoutStaffNotified = true;
        updatedRecord.shiftCheckoutStaffNotifiedAt = now;
        recordUpdated = true;

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
    }
  },
};
