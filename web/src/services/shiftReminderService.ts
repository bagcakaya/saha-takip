import { AttendanceRecord, ShiftDefinition, ShiftAssignment } from '../types/storage';
import { OneSignalService } from './oneSignalService';
import { NotificationService } from './notificationService';
import { FastActionAgent } from './fastActionAgent';

export interface ShiftReminderCheckParams {
  attendanceRecords: AttendanceRecord[];
  shifts: ShiftDefinition[];
  shiftAssignments: ShiftAssignment[];
  companyCode: string;
  currentUser?: { id: string; role?: string; name?: string };
  onUpdateRecord?: (record: AttendanceRecord) => void;
}

const LOCAL_DEDUP_PREFIX = '@shift_checkout_alert_';

function getLocalDedupKey(dateStr: string, userId: string, type: '10m' | '20m'): string {
  return `${LOCAL_DEDUP_PREFIX}${dateStr}_${userId}_${type}`;
}

function hasSentLocalAlert(dateStr: string, userId: string, type: '10m' | '20m'): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLocalDedupKey(dateStr, userId, type)) === '1';
  } catch {
    return false;
  }
}

function markSentLocalAlert(dateStr: string, userId: string, type: '10m' | '20m'): void {
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
   * - shiftEndMs
   * - target10mMs (+10 minutes after shift end)
   * - target20mMs (+20 minutes after shift end)
   */
  calculateShiftTimestamps(
    shift: ShiftDefinition,
    assignment?: ShiftAssignment
  ): { shiftEndMs: number; target10mMs: number; target20mMs: number } | null {
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
    const target10mMs = shiftEndMs + 10 * 60 * 1000;
    const target20mMs = shiftEndMs + 20 * 60 * 1000;

    return { shiftEndMs, target10mMs, target20mMs };
  },

  /**
   * Pre-schedules push notifications via OneSignal cloud server when staff checks in:
   * 1. At shift end + 10 min: Delivered directly to staff member's locked phone.
   * 2. At shift end + 20 min: Delivered directly to admin(s).
   * If staff clicks "İşten Çıkış Yaptım", these pre-scheduled pushes are instantly cancelled!
   */
  async scheduleShiftCheckoutReminders(params: {
    record: AttendanceRecord;
    shift: ShiftDefinition;
    companyCode: string;
  }): Promise<{ shift10mId?: string; shift20mId?: string }> {
    const { record, shift, companyCode } = params;
    const timestamps = this.calculateShiftTimestamps(shift);
    if (!timestamps) return {};

    const now = Date.now();
    let shift10mId: string | undefined;
    let shift20mId: string | undefined;

    const comp = (companyCode || record.companyCode || 'POLATLAR').toUpperCase();
    const dateStr = record.date || this.getTodayDateString();

    try {
      // 1. Pre-schedule 10m reminder to staff if target is in the future
      if (timestamps.target10mMs > now) {
        const iso10m = new Date(timestamps.target10mMs).toISOString();
        const res10m = await OneSignalService.sendPushNotification({
          title: '🔔 Mesai Çıkış Hatırlatması',
          message: `Sayın ${record.userName || 'Personelimiz'}, vardiya saatiniz (${shift.name || shift.endTime}) sona erdi. İşten çıkış yapmayı unuttuysanız lütfen mesai çıkışınızı yapınız.`,
          targetMode: 'custom',
          targetUserIds: [record.userId],
          companyCode: comp,
          sendAfter: iso10m,
          collapseId: `shift_10m_${dateStr}_${record.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=attendance',
        });
        if (res10m?.success && res10m.data?.id) {
          shift10mId = res10m.data.id;
        }
      }

      // 2. Pre-schedule 20m reminder to admin if target is in the future
      if (timestamps.target20mMs > now) {
        const iso20m = new Date(timestamps.target20mMs).toISOString();
        const res20m = await OneSignalService.sendPushNotification({
          title: `⚠️ Vardiya Çıkış Gecikmesi: ${record.userName}`,
          message: `${record.userName} isimli personelin vardiya saati (${shift.name || shift.endTime}) bitiminden 20 dakika geçmesine rağmen işten çıkış kaydı yapılmadı.`,
          targetMode: 'admin',
          companyCode: comp,
          sendAfter: iso20m,
          collapseId: `shift_20m_${dateStr}_${record.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        });
        if (res20m?.success && res20m.data?.id) {
          shift20mId = res20m.data.id;
        }
      }
    } catch (e) {
      console.warn('[ShiftReminderService] scheduleShiftCheckoutReminders error:', e);
    }

    return { shift10mId, shift20mId };
  },

  /**
   * Cancels pre-scheduled notifications when staff checks out or checkout is approved
   */
  cancelShiftCheckoutReminders(record: AttendanceRecord, companyCode?: string): void {
    const comp = (companyCode || record.companyCode || 'POLATLAR').toUpperCase();
    if (record.shiftCheckout10mNotificationId) {
      FastActionAgent.enqueueCancelNotification(record.shiftCheckout10mNotificationId, comp);
    }
    if (record.shiftCheckout20mNotificationId) {
      FastActionAgent.enqueueCancelNotification(record.shiftCheckout20mNotificationId, comp);
    }
  },

  /**
   * Periodic runner / client-side agent check:
   * Evaluates all staff with assigned shifts for today.
   * If shift end has elapsed by 10 minutes and staff hasn't checked out:
   *   -> Sends 10m reminder push to staff.
   * If shift end has elapsed by 20 minutes and staff still hasn't checked out:
   *   -> Sends 20m escalation push to Admin.
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

      const { shiftEndMs, target10mMs, target20mMs } = timestamps;

      // Has 10 minutes passed yet since shift end?
      if (now < target10mMs) continue;

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

      // --- CHECK 1: +10 MINUTES (Reminder to Staff member) ---
      const is10mNotified =
        updatedRecord.shiftCheckout10mNotified ||
        hasSentLocalAlert(todayStr, assignment.userId, '10m');

      if (!is10mNotified && now >= target10mMs) {
        markSentLocalAlert(todayStr, assignment.userId, '10m');
        updatedRecord.shiftCheckout10mNotified = true;
        updatedRecord.shiftCheckout10mNotifiedAt = now;
        recordUpdated = true;

        const title = '🔔 Mesai Çıkış Hatırlatması';
        const message = `Sayın ${assignment.userName || record.userName}, vardiya saatiniz (${shift.name || shift.endTime}) sona erdi. İşten çıkış yapmayı unuttuysanız lütfen mesai çıkışınızı yapınız.`;

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
          companyCode: comp,
          collapseId: `shift_10m_${todayStr}_${assignment.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=attendance',
        });
      }

      // --- CHECK 2: +20 MINUTES (Escalation to Admins) ---
      const is20mNotified =
        updatedRecord.shiftCheckout20mNotified ||
        hasSentLocalAlert(todayStr, assignment.userId, '20m');

      if (!is20mNotified && now >= target20mMs) {
        markSentLocalAlert(todayStr, assignment.userId, '20m');
        updatedRecord.shiftCheckout20mNotified = true;
        updatedRecord.shiftCheckout20mNotifiedAt = now;
        recordUpdated = true;

        const title = `⚠️ Vardiya Çıkış Gecikmesi: ${assignment.userName || record.userName}`;
        const message = `${assignment.userName || record.userName} isimli personelin vardiya saati (${shift.name || shift.endTime}) bitiminden 20 dakika geçmesine rağmen işten çıkış kaydı yapılmadı.`;

        // If current logged-in user is an admin, alert locally as well
        if (currentUser?.role === 'admin') {
          NotificationService.playChime();
          NotificationService.sendNotification(
            title,
            message,
            'https://saha-takip-beige.vercel.app/?tab=staff_tracking'
          );
        }

        // Send hardware push notification to all admins of this company
        FastActionAgent.enqueuePushNotification({
          title,
          message,
          targetMode: 'admin',
          companyCode: comp,
          collapseId: `shift_20m_${todayStr}_${assignment.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        });
      }

      if (recordUpdated && onUpdateRecord) {
        onUpdateRecord(updatedRecord);
      }
    }
  },
};
