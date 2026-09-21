/**
 * Safely parses any date/time string format into a valid Date object.
 * Supports:
 * - HTML5 datetime-local: "YYYY-MM-DDTHH:mm"
 * - Turkish mobile format: "DD.MM.YYYY HH:mm" or "DD.MM.YYYY"
 * - Slash format: "DD/MM/YYYY HH:mm" or "YYYY/MM/DD HH:mm"
 * - ISO 8601: "2026-09-19T14:30:00.000Z"
 * - Millisecond timestamp: number / numeric string
 */
export function parseDueDateTime(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Numeric string timestamp
  if (/^\d{10,13}$/.test(str)) {
    const d = new Date(Number(str));
    if (!isNaN(d.getTime())) return d;
  }

  // 1. Direct standard parse if no dot present
  if (!str.includes('.')) {
    const directDate = new Date(str);
    if (!isNaN(directDate.getTime())) {
      return directDate;
    }
  }

  // 2. Turkish dot format: "DD.MM.YYYY HH:mm[:ss]" or "DD.MM.YYYY"
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10) - 1;
    const year = parseInt(dotMatch[3], 10);
    const hours = dotMatch[4] ? parseInt(dotMatch[4], 10) : 0;
    const minutes = dotMatch[5] ? parseInt(dotMatch[5], 10) : 0;
    const seconds = dotMatch[6] ? parseInt(dotMatch[6], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // 3. Fallback direct Date parse
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export interface RemainingDaysInfo {
  days: number;
  label: string;
  status: 'expired' | 'today' | 'expiring_soon' | 'active';
  isExpired: boolean;
}

export function getRemainingDaysInfo(value: string | number | null | undefined): RemainingDaysInfo | null {
  const targetDate = parseDueDateTime(value);
  if (!targetDate) return null;

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    const minutesAgo = Math.floor(Math.abs(diffMs) / 60000);
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);

    let expiredLabel = 'Süresi Doldu';
    if (daysAgo > 0) {
      expiredLabel = `${daysAgo} Gün Önce Doldu`;
    } else if (hoursAgo > 0) {
      expiredLabel = `${hoursAgo} Sa Önce Doldu`;
    }

    return {
      days: 0,
      label: expiredLabel,
      status: 'expired',
      isExpired: true,
    };
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1 && targetDate.getDate() === now.getDate()) {
    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / 60000);
    const label = hoursLeft > 0 ? `${hoursLeft} Saat Kaldı` : `${minsLeft || 1} Dk Kaldı`;
    return {
      days: 0,
      label,
      status: 'expiring_soon',
      isExpired: false,
    };
  }

    return {
      days: diffDays,
      label: `${diffDays} Gün Kaldı`,
      status: diffDays <= 7 ? 'expiring_soon' : 'active',
      isExpired: false,
    };
  }

/**
 * Calculates remaining whole days until due date/time.
 * If target is past or now, returns 0.
 * If invalid date, returns null.
 */
export function getRemainingDays(value: string | number | null | undefined): number | null {
  const targetDate = parseDueDateTime(value);
  if (!targetDate) return null;

  const now = Date.now();
  const diffMs = targetDate.getTime() - now;

  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export type FollowUpMilestone = '30d' | '15d' | '7d' | '3d' | 'due' | 'snooze_due';

export interface MilestoneTriggerResult {
  shouldTrigger: boolean;
  milestoneKey: FollowUpMilestone;
  milestoneLabel: string;
  consumedMilestones: FollowUpMilestone[];
}

/**
 * Checks whether a timed follow-up should trigger an alarm:
 * - 1 ay (30 gün) kala ('30d')
 * - 15 gün kala ('15d')
 * - 7 gün kala ('7d')
 * - 3 gün kala ('3d')
 * - Vadesi geldiğinde ('due')
 * - Ertelenen süresi bittiğinde ('snooze_due')
 */
export function checkMilestoneTrigger(
  item: {
    status?: string;
    dueDate: string;
    snoozedUntil?: string;
    notified?: boolean;
    notifiedMilestones?: string[];
  },
  nowMs: number = Date.now()
): MilestoneTriggerResult | null {
  if (item.status && item.status !== 'pending') return null;

  // 1. Check snooze if active
  if (item.snoozedUntil) {
    const snoozeDate = parseDueDateTime(item.snoozedUntil);
    const snoozeTime = snoozeDate ? snoozeDate.getTime() : NaN;
    if (!isNaN(snoozeTime)) {
      if (nowMs >= snoozeTime && !item.notified) {
        return {
          shouldTrigger: true,
          milestoneKey: 'snooze_due',
          milestoneLabel: 'Erteleme Süresi Doldu!',
          consumedMilestones: ['snooze_due'],
        };
      }
      // If snoozed and snooze time hasn't arrived, wait
      if (nowMs < snoozeTime) {
        return null;
      }
    }
  }

  // 2. Check due date
  const targetDate = parseDueDateTime(item.dueDate);
  if (!targetDate) return null;
  const targetTime = targetDate.getTime();
  if (isNaN(targetTime)) return null;

  const notifiedMilestones = item.notifiedMilestones || [];

  // If due date has passed
  if (nowMs >= targetTime) {
    if (!item.notified && !notifiedMilestones.includes('due')) {
      return {
        shouldTrigger: true,
        milestoneKey: 'due',
        milestoneLabel: 'Vadesi Geldi!',
        consumedMilestones: ['30d', '15d', '7d', '3d', 'due'],
      };
    }
    return null;
  }

  // Future due date: calculate remaining days
  const diffMs = targetTime - nowMs;
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (remainingDays <= 3) {
    if (!notifiedMilestones.includes('3d')) {
      return {
        shouldTrigger: true,
        milestoneKey: '3d',
        milestoneLabel: '3 Gün Kaldı!',
        consumedMilestones: ['30d', '15d', '7d', '3d'],
      };
    }
  } else if (remainingDays <= 7) {
    if (!notifiedMilestones.includes('7d')) {
      return {
        shouldTrigger: true,
        milestoneKey: '7d',
        milestoneLabel: '7 Gün Kaldı!',
        consumedMilestones: ['30d', '15d', '7d'],
      };
    }
  } else if (remainingDays <= 15) {
    if (!notifiedMilestones.includes('15d')) {
      return {
        shouldTrigger: true,
        milestoneKey: '15d',
        milestoneLabel: '15 Gün Kaldı!',
        consumedMilestones: ['30d', '15d'],
      };
    }
  } else if (remainingDays <= 30) {
    if (!notifiedMilestones.includes('30d')) {
      return {
        shouldTrigger: true,
        milestoneKey: '30d',
        milestoneLabel: '1 Ay Kaldı! (30 Gün)',
        consumedMilestones: ['30d'],
      };
    }
  }

  return null;
}

