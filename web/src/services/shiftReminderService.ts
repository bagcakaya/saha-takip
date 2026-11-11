import { AttendanceRecord, ShiftDefinition, ShiftAssignment, LeaveRequest } from '../types/storage';
import { StorageService } from './storageService';
import { NotificationService } from './notificationService';
import { FastActionAgent } from './fastActionAgent';
import { OneSignalService } from './oneSignalService';

export interface ShiftReminderCheckParams {
  attendanceRecords: AttendanceRecord[];
  shifts: ShiftDefinition[];
  shiftAssignments: ShiftAssignment[];
  leaveRequests?: LeaveRequest[];
  companyCode: string;
  currentUser?: { id: string; role?: string; name?: string; companyCode?: string };
  onUpdateRecord?: (record: AttendanceRecord) => void;
  onShowToast?: (toast: { key: string; title: string; body: string; tab?: any }) => void;
}

const LOCAL_DEDUP_PREFIX = '@shift_checkout_alert_';
const LOCAL_CHECKIN_DEDUP_PREFIX = '@shift_checkin_alert_';

type DedupAlertType = '5m' | '10m' | 'staff' | 'admin' | '20m';
type CheckinDedupAlertType = '15m';

const inFlightAlertKeys = new Set<string>();

function normalizeShiftTimeKey(timeStr?: string, fallback: string = '0900'): string {
  if (!timeStr) return fallback;
  const cleaned = timeStr.replace(/[^0-9]/g, '');
  return cleaned || fallback;
}

function getLocalDedupKey(dateStr: string, userId: string, type: DedupAlertType, endTimeKey?: string): string {
  const suffix = endTimeKey ? `_${endTimeKey}` : '';
  return `${LOCAL_DEDUP_PREFIX}${dateStr}${suffix}_${userId}_${type}`;
}

function hasSentLocalAlert(dateStr: string, userId: string, type: DedupAlertType, endTimeKey?: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLocalDedupKey(dateStr, userId, type, endTimeKey)) === '1';
  } catch {
    return false;
  }
}

function markSentLocalAlert(dateStr: string, userId: string, type: DedupAlertType, endTimeKey?: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalDedupKey(dateStr, userId, type, endTimeKey), '1');
  } catch {}
}

function getLocalCheckinDedupKey(
  dateStr: string,
  userId: string,
  type: CheckinDedupAlertType,
  startTimeKey?: string
): string {
  const suffix = startTimeKey ? `_${startTimeKey}` : '';
  return `${LOCAL_CHECKIN_DEDUP_PREFIX}${dateStr}${suffix}_${userId}_${type}`;
}

function hasSentLocalCheckinAlert(
  dateStr: string,
  userId: string,
  type: CheckinDedupAlertType,
  startTimeKey?: string
): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLocalCheckinDedupKey(dateStr, userId, type, startTimeKey)) === '1';
  } catch {
    return false;
  }
}

function markSentLocalCheckinAlert(
  dateStr: string,
  userId: string,
  type: CheckinDedupAlertType,
  startTimeKey?: string
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalCheckinDedupKey(dateStr, userId, type, startTimeKey), '1');
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
  // 1. Check attendance records (checked in today, pending check-in approval, completed for current shift, or marked on_leave)
  if (Array.isArray(records) && records.length > 0) {
    const hasCheckIn = records.some((r) => {
      if (!r || r.userId !== userId) return false;
      if (r.checkInApprovalStatus === 'rejected') return false;

      const isSameDate =
        r.date === dateStr ||
        (r.checkInTime && Number(r.checkInTime) >= shiftStartMs - 4 * 60 * 60 * 1000);
      if (!isSameDate) return false;

      // If this record was already completed (checked out) BEFORE the current shift window even started,
      // do not count it as checked-in for the new/updated shift.
      if (
        r.status === 'completed' &&
        r.checkOutTime &&
        Number(r.checkOutTime) > 0 &&
        Number(r.checkOutTime) < shiftStartMs - 15 * 60 * 1000
      ) {
        return false;
      }

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

/**
 * Evaluates whether a shift-assigned staff member has already checked out (or is excused on approved leave)
 * for today's shift:
 * - If the user has an approved daily/hourly leave covering shift end (or `on_leave` attendance record) -> excused (`hasCheckedOutOrExcused: true`).
 * - If the user has an open attendance record (`checked_in` or `pending_checkin_approval`, no `checkOutTime`, not rejected)
 *   newer than any earlier checkout -> NOT checked out (`hasCheckedOutOrExcused: false`, `activeRecord` returned).
 * - If the user has a completed / pending-checkout record for this shift (`checkOutTime >= shiftStartMs - 15m`)
 *   and no newer open check-in -> ALREADY checked out (`hasCheckedOutOrExcused: true`).
 * - Otherwise (assigned shift active today, not on leave, and has not checked out) -> NOT checked out (`hasCheckedOutOrExcused: false`).
 */
function evaluateUserCheckoutStatus(
  records: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  userId: string,
  dateStr: string,
  shiftStartMs: number,
  shiftEndMs: number,
  shiftEndMinutes: number
): {
  hasCheckedOutOrExcused: boolean;
  hasActiveCheckIn: boolean;
  activeRecord?: AttendanceRecord;
} {
  // 1. Approved leave check (daily leave or hourly leave covering shift end)
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
          if (shiftEndMinutes > leaveStartMin && shiftEndMinutes <= leaveEndMin) {
            return true;
          }
        }
      }
      return false;
    });
    if (hasApprovedLeave) {
      return { hasCheckedOutOrExcused: true, hasActiveCheckIn: false };
    }
  }

  if (!Array.isArray(records) || records.length === 0) {
    return { hasCheckedOutOrExcused: false, hasActiveCheckIn: false };
  }

  // On-leave attendance record check
  const hasOnLeaveRecord = records.some(
    (r) => r && r.userId === userId && r.date === dateStr && r.status === 'on_leave'
  );
  if (hasOnLeaveRecord) {
    return { hasCheckedOutOrExcused: true, hasActiveCheckIn: false };
  }

  // Filter attendance records relevant to today / current shift window (handles UTC vs local date & overnight shifts)
  const relevantRecords = records
    .filter((r) => {
      if (!r || r.userId !== userId) return false;
      if (r.checkInApprovalStatus === 'rejected') return false;
      if (r.status === 'on_leave') return false;

      const checkInTs = Number(r.checkInTime || 0);
      const inShiftTimeRange =
        checkInTs > 0 &&
        checkInTs >= shiftStartMs - 6 * 60 * 60 * 1000 &&
        checkInTs <= shiftEndMs + 6 * 60 * 60 * 1000;

      return r.date === dateStr || inShiftTimeRange;
    })
    .sort((a, b) => Number(b.checkInTime || 0) - Number(a.checkInTime || 0));

  if (relevantRecords.length === 0) {
    return { hasCheckedOutOrExcused: false, hasActiveCheckIn: false };
  }

  // Latest checkout timestamp among relevant records
  let latestCheckOutTs = 0;
  for (const r of relevantRecords) {
    const outTs = Number(r.checkOutTime || 0);
    if (outTs > latestCheckOutTs) {
      latestCheckOutTs = outTs;
    }
  }

  // Check if there is a currently open check-in session (either approved or pending manager approval)
  const activeRecord = relevantRecords.find((r) => {
    const inTs = Number(r.checkInTime || 0);
    if (inTs <= 0) return false;
    if (r.checkOutTime && Number(r.checkOutTime) > 0) return false;
    if (r.status === 'completed' || r.status === 'pending_checkout_approval') return false;
    if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return false;
    if (latestCheckOutTs > inTs) return false;
    return r.status === 'checked_in' || r.status === 'pending_checkin_approval';
  });

  if (activeRecord) {
    return {
      hasCheckedOutOrExcused: false,
      hasActiveCheckIn: true,
      activeRecord,
    };
  }

  // No open check-in session -> check if user completed/submitted checkout for this shift
  const hasCheckedOutForShift = relevantRecords.some((r) => {
    const outTs = Number(r.checkOutTime || 0);
    // Ignore old completed records that finished before the current shift window started
    if (outTs > 0 && outTs < shiftStartMs - 15 * 60 * 1000) {
      return false;
    }
    if (outTs > 0) return true;
    if (r.status === 'completed' || r.status === 'pending_checkout_approval') return true;
    if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return true;
    return false;
  });

  return {
    hasCheckedOutOrExcused: hasCheckedOutForShift,
    hasActiveCheckIn: false,
  };
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
   * STRICT: Returns null if no shift assignment or today (or overnight shift start day) is not in daysOfWeek.
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

    const now = new Date();
    // Day check: 1 = Pazartesi ... 7 = Pazar
    let checkDay = now.getDay();
    if (checkDay === 0) checkDay = 7;

    // Overnight shift check (e.g. 22:00 -> 06:00 evaluated at 06:05 AM belongs to previous day's shift)
    const startStr = shift.startTime || assignment.startTime;
    const endStr = shift.endTime || assignment.endTime;
    if (startStr && endStr && startStr.includes(':') && endStr.includes(':')) {
      const [sh, sm] = startStr.split(':').map(Number);
      const [eh, em] = endStr.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const curMin = now.getHours() * 60 + now.getMinutes();
        if (endMin <= startMin && curMin < startMin) {
          checkDay = checkDay === 1 ? 7 : checkDay - 1;
        }
      }
    }

    if (shift.daysOfWeek && shift.daysOfWeek.length > 0 && !shift.daysOfWeek.includes(checkDay)) {
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
      if (currentTotalMin < startTotalMin) {
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
   * - shiftStartMs: Exact shift start time
   * - shiftEndMs: Exact shift end time
   * - target5mMs: 5 minutes after shift end time (+5m) -> 1st reminder to staff
   * - target10mMs: 10 minutes after shift end time (+10m) -> 2nd reminder to staff
   */
  calculateShiftTimestamps(
    shift: ShiftDefinition,
    assignment?: ShiftAssignment
  ): {
    shiftStartMs: number;
    shiftEndMs: number;
    target5mMs: number;
    target10mMs: number;
    targetStaffMs: number;
    targetAdminMs: number;
    target20mMs: number;
    shiftEndMinutes: number;
  } | null {
    const endTimeStr = shift.endTime || assignment?.endTime;
    if (!endTimeStr || !endTimeStr.includes(':')) return null;

    const startTimeStr = shift.startTime || assignment?.startTime || '08:30';

    const [endH, endM] = endTimeStr.split(':').map(Number);
    const [startH, startM] = startTimeStr.split(':').map(Number);

    if (isNaN(endH) || isNaN(endM)) return null;

    const safeStartH = isNaN(startH) ? 8 : startH;
    const safeStartM = isNaN(startM) ? 30 : startM;

    const now = new Date();
    const shiftStartDate = new Date();
    shiftStartDate.setHours(safeStartH, safeStartM, 0, 0);

    const shiftEndDate = new Date();
    shiftEndDate.setHours(endH, endM, 0, 0);

    // Cross-midnight / overnight shift handling (e.g. 22:00 to 06:00)
    const startTotalMin = safeStartH * 60 + safeStartM;
    const endTotalMin = endH * 60 + endM;
    if (endTotalMin <= startTotalMin) {
      const currentTotalMin = now.getHours() * 60 + now.getMinutes();
      if (currentTotalMin >= startTotalMin) {
        shiftEndDate.setDate(shiftEndDate.getDate() + 1);
      } else {
        shiftStartDate.setDate(shiftStartDate.getDate() - 1);
      }
    }

    const shiftStartMs = shiftStartDate.getTime();
    const shiftEndMs = shiftEndDate.getTime();
    const target5mMs = shiftEndMs + 5 * 60 * 1000; // Vardiya bitiminden 5 dk sonra personele 1. bildirim
    const target10mMs = shiftEndMs + 10 * 60 * 1000; // Vardiya bitiminden 10 dk sonra personele 2. bildirim
    const target20mMs = shiftEndMs + 20 * 60 * 1000;

    return {
      shiftStartMs,
      shiftEndMs,
      target5mMs,
      target10mMs,
      targetStaffMs: target5mMs,
      targetAdminMs: target10mMs,
      target20mMs,
      shiftEndMinutes: endTotalMin,
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
   * Blocks local check-in alert key when staff checks in (for the specific shift start key if known)
   */
  cancelShiftCheckinReminders(
    userId: string,
    dateStr?: string,
    _companyCode?: string,
    shiftStartTime?: string
  ): void {
    if (!userId) return;
    const targetDate = dateStr || this.getTodayDateString();
    if (shiftStartTime) {
      const cleanStartKey = normalizeShiftTimeKey(shiftStartTime, '0900');
      markSentLocalCheckinAlert(targetDate, userId, '15m', cleanStartKey);
    }
  },

  /**
   * Clears checkout alert dedup keys when a staff member starts a new check-in session on the same day
   * so +5m and +10m checkout reminders are freshly armed for the new active session.
   */
  resetCheckoutAlertsForUser(userId: string, dateStr?: string, companyCode?: string): void {
    if (!userId) return;
    const targetDate = dateStr || this.getTodayDateString();
    if (typeof localStorage !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith(LOCAL_DEDUP_PREFIX) && k.includes(targetDate) && k.includes(userId)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
    }

    NotificationService.clearShiftDedupCache('checkout');
    OneSignalService.clearShiftPushDedupCache('checkout');
    StorageService.clearShiftAlertLogsForUsers([userId], targetDate, companyCode, 'checkout_').catch(() => {});
  },

  /**
   * Clears local and cloud check-in/check-out alert dedup keys for given users
   * (e.g. when shift time is updated, shift is reassigned, or attendance record is deleted)
   */
  resetShiftAlertsForUsers(userIds: string[], dateStr?: string, companyCode?: string): void {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    const targetDate = dateStr || this.getTodayDateString();
    if (typeof localStorage !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (
            (k.startsWith(LOCAL_CHECKIN_DEDUP_PREFIX) || k.startsWith(LOCAL_DEDUP_PREFIX)) &&
            (!dateStr || k.includes(targetDate)) &&
            userIds.some((uid) => uid && k.includes(uid))
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
    }

    NotificationService.clearShiftDedupCache('all');
    OneSignalService.clearShiftPushDedupCache('all');
    StorageService.clearShiftAlertLogsForUsers(userIds, dateStr, companyCode).catch(() => {});
  },

  /**
   * Cancels any legacy pre-scheduled notifications when staff checks out
   */
  cancelShiftCheckoutReminders(
    record: AttendanceRecord,
    companyCode?: string,
    shiftEndTime?: string
  ): void {
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

    if (record.userId && shiftEndTime) {
      const cleanEndKey = normalizeShiftTimeKey(shiftEndTime, '1800');
      markSentLocalAlert(dateStr, record.userId, '5m', cleanEndKey);
      markSentLocalAlert(dateStr, record.userId, '10m', cleanEndKey);
      markSentLocalAlert(dateStr, record.userId, 'staff', cleanEndKey);
    }
  },

  /**
   * VARDİYA BAŞLANGIÇ (İŞE GİRİŞ) HATIRLATICISI (+15. DAKİKA):
   * - Önceden zamanlanmaz; vardiya başlangıcından 15 dakika geçtikten sonra canlı veritabanı kontrolü yapılır.
   * - Kullanıcı bugün işe giriş yapmışsa (onaylı veya yönetici onayı bekleyen) ya da onaylı izni varsa BİLDİRİM GİTMEZ.
   * - Hala giriş yapmadıysa SADECE ilgili kullanıcıya bildirim gönderilir (Yöneticiye ASLA gitmez) ve
   *   bulut Slot 23 kaydı ile aynı gün aynı vardiya saati için mükerrer bildirim gitmesi engellenir.
   */
  async checkShiftCheckinReminders(params: ShiftReminderCheckParams): Promise<void> {
    const {
      attendanceRecords,
      shifts,
      shiftAssignments,
      leaveRequests = [],
      companyCode,
      currentUser,
      onShowToast,
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
      if (!assignment || !assignment.userId) continue;

      // 1. Bugün aktif vardiyası tanımlı mı kontrol et
      const assigned = this.getAssignedShiftForToday(assignment.userId, shifts, shiftAssignments);
      if (!assigned) continue;

      const { shift } = assigned;
      const startTimestamps = this.calculateShiftStartTimestamps(shift, assignment);
      if (!startTimestamps) continue;

      const { shiftStartMs, targetCheckIn15mMs, shiftEndMs, shiftStartMinutes } = startTimestamps;

      // Vardiya başlangıcının üzerinden henüz 15 dakika geçmediyse bekle
      if (now < targetCheckIn15mMs) continue;

      // Vardiya bittiyse veya başlangıçtan itibaren 6 saatten fazla geçtiyse eski kontrolleri es geç
      if (now >= shiftEndMs || now - shiftStartMs > 6 * 60 * 60 * 1000) continue;

      const shiftStartStr = shift.startTime || assignment.startTime || '09:00';
      const cleanStartKey = normalizeShiftTimeKey(shiftStartStr, '0900');
      const cloudAlertKey = `checkin_15m_${todayStr}_${cleanStartKey}_${assignment.userId}`;

      // Yerel önbellekte (bu vardiya başlangıç saati için) veya devam eden istekte zaten gönderilmişse atla
      if (
        hasSentLocalCheckinAlert(todayStr, assignment.userId, '15m', cleanStartKey) ||
        inFlightAlertKeys.has(cloudAlertKey)
      ) {
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
            markSentLocalCheckinAlert(todayStr, assignment.userId, '15m', cleanStartKey);
            continue;
          }

          if (
            isUserCheckedInOrExcused(
              freshCloudRecords && freshCloudRecords.length > 0 ? freshCloudRecords : attendanceRecords || [],
              freshCloudLeaves && freshCloudLeaves.length > 0 ? freshCloudLeaves : leaveRequests,
              assignment.userId,
              todayStr,
              shiftStartMs,
              shiftStartMinutes
            )
          ) {
            continue;
          }
        } catch {
          // Ağ hatası olursa yerel veriye göre devam et
        }

        // Aynı gün aynı vardiya saati için ikinci kez bildirim gitmemesi adına hem yerel hem bulut Slot 23 anahtarını mühürle
        markSentLocalCheckinAlert(todayStr, assignment.userId, '15m', cleanStartKey);
        if (freshAlertLogs) {
          freshAlertLogs[cloudAlertKey] = now;
        }
        await StorageService.markShiftAlertSent(cloudAlertKey, staffCompany);

        const appUrl =
          typeof window !== 'undefined' && window.location.origin
            ? window.location.origin
            : 'https://saha-takip-beige.vercel.app';

        const title = '🔔 Vardiya Giriş Hatırlatması (15. Dakika)';
        const message = `Saat ${shiftStartStr} vardiyanız 15 dakika önce başladı ancak henüz işe giriş yapmadınız. Lütfen işe giriş işleminizi yapmayı unutmayın!`;

        // Kullanıcı şu an sisteme bağlı olan personelin kendisi ise hem uygulama açıkken hem arka planda bildirim, ses ve toast göster!
        if (currentUser?.id === assignment.userId) {
          NotificationService.playChime();
          NotificationService.sendNotification(title, message, `${appUrl}/?tab=staff_tracking`, {
            tag: cloudAlertKey,
            skipIfVisible: false,
          });
          if (onShowToast) {
            onShowToast({
              key: cloudAlertKey,
              title,
              body: message,
              tab: 'staff_tracking',
            });
          }
        }

        // SADECE ilgili personelin telefonuna anında donanım push bildirimi gönder (Yöneticiye ASLA gitmez)
        const pushParams = {
          title,
          message,
          targetMode: 'custom' as const,
          targetUserIds: [assignment.userId],
          companyCode: staffCompany,
          collapseId: `shift_in_15m_${todayStr}_${cleanStartKey}_${assignment.userId}`,
          url: `${appUrl}/?tab=staff_tracking`,
        };

        OneSignalService.sendPushNotification(pushParams)
          .then((res) => {
            if (!res || !res.success) {
              FastActionAgent.enqueuePushNotification(pushParams);
            }
          })
          .catch(() => {
            FastActionAgent.enqueuePushNotification(pushParams);
          });
      } finally {
        inFlightAlertKeys.delete(cloudAlertKey);
      }
    }
  },

  /**
   * VARDİYA BİTİŞ (İŞTEN ÇIKIŞ) HATIRLATICISI (+5. VE +10. DAKİKA):
   * - Yöneticiye (Admin) ASLA bildirim gönderilmez!
   * - Bugün aktif vardiyası olan ve onaylı izni bulunmayan personel, vardiya saati bittiği halde HALA çıkış yapmamışsa:
   *   1) +5. dakikada (target5mMs) 1. çıkış hatırlatma bildirimi gönderilir.
   *   2) +10. dakikada (target10mMs) hala çıkış yapmadıysa 2. çıkış uyarı bildirimi gönderilir.
   * - Bellek içi attendanceRecords boş/eski olsa dahi vardiya bitiş penceresinde canlı veritabanı (Slot 6 + Slot 10 + Slot 23)
   *   kontrol edilerek 100% doğrulukla çalışır.
   */
  async checkShiftCheckoutReminders(params: ShiftReminderCheckParams): Promise<void> {
    const {
      attendanceRecords = [],
      shifts,
      shiftAssignments,
      leaveRequests = [],
      companyCode,
      currentUser,
      onUpdateRecord,
      onShowToast,
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
      if (!assignment || !assignment.userId) continue;

      // 1. Bugün aktif vardiyası tanımlı mı kontrol et
      const assigned = this.getAssignedShiftForToday(assignment.userId, shifts, shiftAssignments);
      if (!assigned) continue;

      const { shift } = assigned;
      const timestamps = this.calculateShiftTimestamps(shift, assignment);
      if (!timestamps) continue;

      const { shiftStartMs, shiftEndMs, target5mMs, target10mMs, shiftEndMinutes } = timestamps;

      // Vardiya bitişinin üzerinden henüz 5 dakika geçmediyse kontrol etmeye gerek yok
      if (now < target5mMs) continue;

      // Vardiya bitişi üzerinden 6 saatten fazla geçtiyse eski kontrolleri es geç
      if (now - shiftEndMs > 6 * 60 * 60 * 1000) continue;

      const shiftEndStr = shift.endTime || assignment.endTime || '18:00';
      const cleanEndKey = normalizeShiftTimeKey(shiftEndStr, '1800');

      const is5mLocalSent = hasSentLocalAlert(todayStr, assignment.userId, '5m', cleanEndKey);
      const is10mLocalSent = hasSentLocalAlert(todayStr, assignment.userId, '10m', cleanEndKey);

      const needs5m = !is5mLocalSent && now >= target5mMs && now < target10mMs;
      const needs10m = !is10mLocalSent && now >= target10mMs;

      if (!needs5m && !needs10m) continue;

      const cloudKey5m = `checkout_5m_${todayStr}_${cleanEndKey}_${assignment.userId}`;
      const cloudKey10m = `checkout_10m_${todayStr}_${cleanEndKey}_${assignment.userId}`;
      const inFlightKey = needs10m ? cloudKey10m : cloudKey5m;
      if (inFlightAlertKeys.has(inFlightKey)) continue;

      // Bellek içi hızlı ön kontrol: SADECE kullanıcı bu vardiya için zaten kesin çıkış yapmışsa veya onaylı izinliyse atla!
      // (Bellekte henüz kayıt yoksa asla atlama; aşağıdaki canlı bulut doğrulaması en güncel kayıtları çekecek!)
      const memStatus = evaluateUserCheckoutStatus(
        attendanceRecords,
        leaveRequests,
        assignment.userId,
        todayStr,
        shiftStartMs,
        shiftEndMs,
        shiftEndMinutes
      );
      if (memStatus.hasCheckedOutOrExcused) {
        continue;
      }

      const staffCompany = (
        memStatus.activeRecord?.companyCode ||
        assignment.companyCode ||
        shift.companyCode ||
        comp
      )
        .trim()
        .toUpperCase();

      inFlightAlertKeys.add(inFlightKey);

      try {
        // CANLI VERİTABANI DOĞRULAMASI:
        // Bildirim göndermeden hemen önce sunucudan/buluttan en güncel mesai kayıtlarını, izinleri
        // ve Slot 23 bildirim günlüğünü çekerek personelin başka bir cihazdan çıkış yapıp yapmadığını doğrula!
        let activeRecord = memStatus.activeRecord;
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

          if (freshAlertLogs) {
            if (needs5m && freshAlertLogs[cloudKey5m]) {
              markSentLocalAlert(todayStr, assignment.userId, '5m', cleanEndKey);
              markSentLocalAlert(todayStr, assignment.userId, 'staff', cleanEndKey);
              continue;
            }
            if (needs10m && freshAlertLogs[cloudKey10m]) {
              markSentLocalAlert(todayStr, assignment.userId, '10m', cleanEndKey);
              continue;
            }
          }

          const liveStatus = evaluateUserCheckoutStatus(
            freshCloudRecords && freshCloudRecords.length > 0 ? freshCloudRecords : attendanceRecords,
            freshCloudLeaves && freshCloudLeaves.length > 0 ? freshCloudLeaves : leaveRequests,
            assignment.userId,
            todayStr,
            shiftStartMs,
            shiftEndMs,
            shiftEndMinutes
          );

          if (liveStatus.hasCheckedOutOrExcused) {
            continue;
          }

          activeRecord = liveStatus.activeRecord || activeRecord;
        } catch {
          // Ağ hatası olursa mevcut yerel veriye göre devam et
        }

        const appUrl =
          typeof window !== 'undefined' && window.location.origin
            ? window.location.origin
            : 'https://saha-takip-beige.vercel.app';

        // --- KONTROL 1: VARDİYA BİTİMİNDEN 5 DAKİKA SONRA (SADECE PERSONELE 1. BİLDİRİM) ---
        if (needs5m) {
          markSentLocalAlert(todayStr, assignment.userId, '5m', cleanEndKey);
          markSentLocalAlert(todayStr, assignment.userId, 'staff', cleanEndKey);
          if (freshAlertLogs) {
            freshAlertLogs[cloudKey5m] = now;
          }
          await StorageService.markShiftAlertSent(cloudKey5m, staffCompany);

          const title = '🔔 Vardiya Çıkış Hatırlatması (5. Dakika)';
          const message = `Saat ${shiftEndStr} vardiyanız 5 dakika önce sona erdi ancak henüz işten çıkış yapmadınız. Lütfen işten çıkış işleminizi yapmayı unutmayın!`;

          // Kullanıcı şu an sisteme bağlı olan personelin kendisi ise yerel bildirim, ses ve toast göster
          if (currentUser?.id === assignment.userId) {
            NotificationService.playChime();
            NotificationService.sendNotification(title, message, `${appUrl}/?tab=staff_tracking`, {
              tag: cloudKey5m,
              skipIfVisible: false,
            });
            if (onShowToast) {
              onShowToast({
                key: cloudKey5m,
                title,
                body: message,
                tab: 'staff_tracking',
              });
            }
          }

          // SADECE ilgili personelin telefonuna donanım push bildirimi gönder (Yöneticiye ASLA gitmez)
          const pushParams5m = {
            title,
            message,
            targetMode: 'custom' as const,
            targetUserIds: [assignment.userId],
            companyCode: staffCompany,
            collapseId: `shift_5m_${todayStr}_${cleanEndKey}_${assignment.userId}`,
            url: `${appUrl}/?tab=staff_tracking`,
          };
          OneSignalService.sendPushNotification(pushParams5m)
            .then((res) => {
              if (!res || !res.success) FastActionAgent.enqueuePushNotification(pushParams5m);
            })
            .catch(() => FastActionAgent.enqueuePushNotification(pushParams5m));

          if (activeRecord && onUpdateRecord) {
            onUpdateRecord({
              ...activeRecord,
              shiftCheckout5mNotified: true,
              shiftCheckout5mNotifiedAt: now,
              shiftCheckoutStaffNotified: true,
              shiftCheckoutStaffNotifiedAt: now,
            });
          }
        }

        // --- KONTROL 2: VARDİYA BİTİMİNDEN 10 DAKİKA SONRA (SADECE PERSONELE 2. BİLDİRİM) ---
        if (needs10m) {
          markSentLocalAlert(todayStr, assignment.userId, '5m', cleanEndKey);
          markSentLocalAlert(todayStr, assignment.userId, 'staff', cleanEndKey);
          markSentLocalAlert(todayStr, assignment.userId, '10m', cleanEndKey);
          if (freshAlertLogs) {
            freshAlertLogs[cloudKey10m] = now;
          }
          await StorageService.markShiftAlertSent(cloudKey10m, staffCompany);

          const title = '⚠️ Vardiya Çıkış Uyarısı (10. Dakika)';
          const message = `Saat ${shiftEndStr} vardiyanız 10 dakika önce sona erdi ve hala işten çıkış yapmadınız! Lütfen işten çıkış işleminizi gerçekleştiriniz.`;

          // Kullanıcı şu an sisteme bağlı olan personelin kendisi ise yerel bildirim, ses ve toast göster
          if (currentUser?.id === assignment.userId) {
            NotificationService.playChime();
            NotificationService.sendNotification(title, message, `${appUrl}/?tab=staff_tracking`, {
              tag: cloudKey10m,
              skipIfVisible: false,
            });
            if (onShowToast) {
              onShowToast({
                key: cloudKey10m,
                title,
                body: message,
                tab: 'staff_tracking',
              });
            }
          }

          // SADECE ilgili personelin telefonuna donanım push bildirimi gönder (Yöneticiye ASLA gitmez)
          const pushParams10m = {
            title,
            message,
            targetMode: 'custom' as const,
            targetUserIds: [assignment.userId],
            companyCode: staffCompany,
            collapseId: `shift_10m_${todayStr}_${cleanEndKey}_${assignment.userId}`,
            url: `${appUrl}/?tab=staff_tracking`,
          };
          OneSignalService.sendPushNotification(pushParams10m)
            .then((res) => {
              if (!res || !res.success) FastActionAgent.enqueuePushNotification(pushParams10m);
            })
            .catch(() => FastActionAgent.enqueuePushNotification(pushParams10m));

          if (activeRecord && onUpdateRecord) {
            onUpdateRecord({
              ...activeRecord,
              shiftCheckout5mNotified: true,
              shiftCheckoutStaffNotified: true,
              shiftCheckout10mNotified: true,
              shiftCheckout10mNotifiedAt: now,
            });
          }
        }
      } finally {
        inFlightAlertKeys.delete(inFlightKey);
      }
    }
  },
};
