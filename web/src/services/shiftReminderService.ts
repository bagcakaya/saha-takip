import { AttendanceRecord, ShiftDefinition, ShiftAssignment } from '../types/storage';
import { OneSignalService } from './oneSignalService';
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

function getLocalDedupKey(dateStr: string, userId: string, type: 'staff' | 'admin' | '10m' | '20m'): string {
  return `${LOCAL_DEDUP_PREFIX}${dateStr}_${userId}_${type}`;
}

function hasSentLocalAlert(dateStr: string, userId: string, type: 'staff' | 'admin' | '10m' | '20m'): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLocalDedupKey(dateStr, userId, type)) === '1';
  } catch {
    return false;
  }
}

function markSentLocalAlert(dateStr: string, userId: string, type: 'staff' | 'admin' | '10m' | '20m'): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalDedupKey(dateStr, userId, type), '1');
  } catch {}
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
   * Calculates exact shift end and reminder thresholds for today:
   * - shiftEndMs / targetStaffMs: Exact shift end time
   * - targetAdminMs: 10 minutes after shift end time (+10m)
   */
  calculateShiftTimestamps(
    shift: ShiftDefinition,
    assignment?: ShiftAssignment
  ): {
    shiftEndMs: number;
    targetStaffMs: number;
    targetAdminMs: number;
    target10mMs: number;
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
    const targetStaffMs = shiftEndMs; // Tam vardiya saatinde personele
    const targetAdminMs = shiftEndMs + 10 * 60 * 1000; // 10 dakika sonra yöneticiye
    const target20mMs = shiftEndMs + 20 * 60 * 1000;

    return {
      shiftEndMs,
      targetStaffMs,
      targetAdminMs,
      target10mMs: targetAdminMs,
      target20mMs,
    };
  },

  /**
   * Pre-schedules push notifications via OneSignal cloud server when staff checks in:
   * 1. At EXACT shift end time: Delivered directly to staff member's locked phone.
   *    "Mesai saatiniz bitmiştir. İşten Çıkış yapmayı lütfen unutmayın!"
   * 2. At shift end + 10 min: Delivered directly to admin(s) if staff hasn't checked out.
   *    "XXXX XXXXX mesai saati bitmesine rağmen İşten Çıktım işlemi yapmamıştır."
   * If staff clicks "İşten Çıkış Yaptım", these pre-scheduled pushes are instantly cancelled!
   */
  async scheduleShiftCheckoutReminders(params: {
    record: AttendanceRecord;
    shift: ShiftDefinition;
    companyCode: string;
  }): Promise<{
    shiftStaffId?: string;
    shiftAdminId?: string;
    shift10mId?: string;
    shift20mId?: string;
  }> {
    const { record, shift, companyCode } = params;
    const timestamps = this.calculateShiftTimestamps(shift);
    if (!timestamps) return {};

    const now = Date.now();
    let shiftStaffId: string | undefined;
    let shiftAdminId: string | undefined;

    const comp = (record.companyCode || shift.companyCode || companyCode || 'POLATLAR').trim().toUpperCase();
    const dateStr = record.date || this.getTodayDateString();
    const staffName = record.userName || 'Personel';

    try {
      // 1. Pre-schedule reminder to staff at EXACT shift end time if target is in the future
      if (timestamps.targetStaffMs > now) {
        const isoStaff = new Date(timestamps.targetStaffMs).toISOString();
        const resStaff = await OneSignalService.sendPushNotification({
          title: '🔔 Mesai Çıkış Hatırlatması',
          message: 'Mesai saatiniz bitmiştir. İşten Çıkış yapmayı lütfen unutmayın!',
          targetMode: 'custom',
          targetUserIds: [record.userId],
          companyCode: comp,
          sendAfter: isoStaff,
          collapseId: `shift_staff_${dateStr}_${record.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=attendance',
        });
        if (resStaff?.success && resStaff.data?.id) {
          shiftStaffId = resStaff.data.id;
        }
      }

      // 2. Pre-schedule reminder to admin at shift end + 10 min if target is in the future
      if (timestamps.targetAdminMs > now) {
        const isoAdmin = new Date(timestamps.targetAdminMs).toISOString();
        const resAdmin = await OneSignalService.sendPushNotification({
          title: `⚠️ Vardiya Çıkış Gecikmesi: ${staffName}`,
          message: `${staffName} mesai saati bitmesine rağmen İşten Çıktım işlemi yapmamıştır.`,
          targetMode: 'admin',
          companyCode: comp,
          sendAfter: isoAdmin,
          collapseId: `shift_admin_${dateStr}_${record.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        });
        if (resAdmin?.success && resAdmin.data?.id) {
          shiftAdminId = resAdmin.data.id;
        }
      }
    } catch (e) {
      console.warn('[ShiftReminderService] scheduleShiftCheckoutReminders error:', e);
    }

    return {
      shiftStaffId,
      shiftAdminId,
      shift10mId: shiftStaffId,
      shift20mId: shiftAdminId,
    };
  },

  /**
   * Cancels pre-scheduled notifications when staff checks out or checkout is approved
   */
  cancelShiftCheckoutReminders(record: AttendanceRecord, companyCode?: string): void {
    const comp = (companyCode || record.companyCode || 'POLATLAR').toUpperCase();
    if (record.shiftCheckoutStaffNotificationId) {
      FastActionAgent.enqueueCancelNotification(record.shiftCheckoutStaffNotificationId, comp);
    }
    if (record.shiftCheckoutAdminNotificationId) {
      FastActionAgent.enqueueCancelNotification(record.shiftCheckoutAdminNotificationId, comp);
    }
    if (record.shiftCheckout10mNotificationId && record.shiftCheckout10mNotificationId !== record.shiftCheckoutStaffNotificationId) {
      FastActionAgent.enqueueCancelNotification(record.shiftCheckout10mNotificationId, comp);
    }
    if (record.shiftCheckout20mNotificationId && record.shiftCheckout20mNotificationId !== record.shiftCheckoutAdminNotificationId) {
      FastActionAgent.enqueueCancelNotification(record.shiftCheckout20mNotificationId, comp);
    }
  },

  /**
   * Periodic runner / client-side agent check:
   * Evaluates all staff with assigned shifts for today.
   * If shift end has arrived:
   *   -> Sends instant reminder push to staff: "Mesai saatiniz bitmiştir. İşten Çıkış yapmayı lütfen unutmayın!"
   * If shift end has elapsed by 10 minutes and staff hasn't checked out:
   *   -> Sends escalation push to Admin: "XXXX XXXXX mesai saati bitmesine rağmen İşten Çıktım işlemi yapmamıştır."
   * STRICT: ONLY applies to staff members with an active shift assignment!
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

    for (const assignment of shiftAssignments) {
      // 1. Strict Scope Check: Must have a shift assigned and valid for today
      const assigned = this.getAssignedShiftForToday(assignment.userId, shifts, shiftAssignments);
      if (!assigned) continue;

      const { shift } = assigned;
      const timestamps = this.calculateShiftTimestamps(shift, assignment);
      if (!timestamps) continue;

      const { shiftEndMs, targetStaffMs, targetAdminMs } = timestamps;

      // Has shift end time arrived yet?
      if (now < targetStaffMs) continue;

      // Ignore stale checks if shift ended more than 6 hours ago
      if (now - shiftEndMs > 6 * 60 * 60 * 1000) continue;

      // Find staff member's today attendance record
      const record = attendanceRecords.find(
        (r) => r.userId === assignment.userId && r.date === todayStr
      );

      // Must have checked in today
      if (!record || !record.checkInTime) continue;

      // If already checked out or completed, skip! (User did not forget)
      if (record.checkOutTime || record.status === 'completed') continue;

      let recordUpdated = false;
      const updatedRecord: AttendanceRecord = { ...record };
      const staffName = assignment.userName || record.userName || 'Personel';
      const staffCompany = (record.companyCode || assignment.companyCode || shift.companyCode || comp).trim().toUpperCase();

      // --- CHECK 1: TAM VARDİYA SAATİNDE (Personele Hatırlatma) ---
      const isStaffNotified =
        updatedRecord.shiftCheckoutStaffNotified ||
        updatedRecord.shiftCheckout10mNotified ||
        hasSentLocalAlert(todayStr, assignment.userId, 'staff') ||
        hasSentLocalAlert(todayStr, assignment.userId, '10m');

      if (!isStaffNotified && now >= targetStaffMs) {
        markSentLocalAlert(todayStr, assignment.userId, 'staff');
        updatedRecord.shiftCheckoutStaffNotified = true;
        updatedRecord.shiftCheckoutStaffNotifiedAt = now;
        updatedRecord.shiftCheckout10mNotified = true;
        recordUpdated = true;

        const title = '🔔 Mesai Çıkış Hatırlatması';
        const message = 'Mesai saatiniz bitmiştir. İşten Çıkış yapmayı lütfen unutmayın!';

        // If the current logged-in user is this staff member, sound in-app chime and show notification
        if (currentUser?.id === assignment.userId) {
          NotificationService.playChime();
          NotificationService.sendNotification(
            title,
            message,
            'https://saha-takip-beige.vercel.app/?tab=attendance'
          );
        }

        // Send hardware push notification via FastActionAgent / OneSignal
        FastActionAgent.enqueuePushNotification({
          title,
          message,
          targetMode: 'custom',
          targetUserIds: [assignment.userId],
          companyCode: staffCompany,
          collapseId: `shift_staff_${todayStr}_${assignment.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=attendance',
        });
      }

      // --- CHECK 2: VARDİYA BİTİMİNDEN 10 DK SONRA (Yalnızca Kendi Şirketinin Yöneticisine Bildirim) ---
      const isAdminNotified =
        updatedRecord.shiftCheckoutAdminNotified ||
        updatedRecord.shiftCheckout20mNotified ||
        hasSentLocalAlert(todayStr, assignment.userId, 'admin') ||
        hasSentLocalAlert(todayStr, assignment.userId, '20m');

      if (!isAdminNotified && now >= targetAdminMs) {
        markSentLocalAlert(todayStr, assignment.userId, 'admin');
        updatedRecord.shiftCheckoutAdminNotified = true;
        updatedRecord.shiftCheckoutAdminNotifiedAt = now;
        updatedRecord.shiftCheckout20mNotified = true;
        recordUpdated = true;

        const title = `⚠️ Vardiya Çıkış Gecikmesi: ${staffName}`;
        const message = `${staffName} mesai saati bitmesine rağmen İşten Çıktım işlemi yapmamıştır.`;

        // If current logged-in user is an admin of THIS company, alert locally as well
        const currentAdminComp = (currentUser?.companyCode || comp).trim().toUpperCase();
        if (currentUser?.role === 'admin' && (!currentUser?.companyCode || currentAdminComp === staffCompany)) {
          NotificationService.playChime();
          NotificationService.sendNotification(
            title,
            message,
            'https://saha-takip-beige.vercel.app/?tab=staff_tracking'
          );
        }

        // Send hardware push notification strictly to admins of THIS staff's company
        FastActionAgent.enqueuePushNotification({
          title,
          message,
          targetMode: 'admin',
          companyCode: staffCompany,
          collapseId: `shift_admin_${todayStr}_${assignment.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        });
      }

      if (recordUpdated && onUpdateRecord) {
        onUpdateRecord(updatedRecord);
      }
    }
  },
};
