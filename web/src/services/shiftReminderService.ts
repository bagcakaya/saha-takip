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

    const comp = (record.companyCode || shift.companyCode || companyCode || 'POLATLAR').trim().toUpperCase();
    const dateStr = record.date || this.getTodayDateString();

    try {
      // 1. SADECE Personele tam vardiya bitiş saatinde hatırlatma zamanla (isteğe bağlı)
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
          url: `${typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://81.213.219.69:3001'}/?tab=attendance`,
        });
        if (resStaff?.success && resStaff.data?.id) {
          shiftStaffId = resStaff.data.id;
        }
      }

      // KESİN KURAL: Yönetici eskalasyon bildirimi ASLA önceden OneSignal'a zamanlanmaz!
      // Önceden zamanlandığında personel vaktinde çıksa bile OneSignal sunucusundaki kuyruk yanlış alarmlara sebep oluyordu.
      // Yöneticiye bildirim; vardiya bitiminden tam 10 dakika sonra, yalnızca personel HALEN çıkış yapmamışsa canlı olarak gönderilir.
    } catch (e) {
      console.warn('[ShiftReminderService] scheduleShiftCheckoutReminders error:', e);
    }

    return {
      shiftStaffId,
      shiftAdminId: undefined,
      shift10mId: shiftStaffId,
      shift20mId: undefined,
    };
  },

  /**
   * Cancels pre-scheduled notifications when staff checks out or checkout is approved
   */
  cancelShiftCheckoutReminders(record: AttendanceRecord, companyCode?: string): void {
    const comp = (companyCode || record.companyCode || 'POLATLAR').toUpperCase();
    const dateStr = record.date || this.getTodayDateString();

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

    // Personel çıkış yaptığı için bugünün bildirim anahtarlarını kalıcı olarak bloke et
    // Böylece periyodik denetleyici bu kullanıcı için yöneticiye ASLA bildirim tetiklemez
    if (record.userId) {
      markSentLocalAlert(dateStr, record.userId, 'staff');
      markSentLocalAlert(dateStr, record.userId, 'admin');
      markSentLocalAlert(dateStr, record.userId, '10m');
      markSentLocalAlert(dateStr, record.userId, '20m');
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

      // Vardiya bitiş saati henüz gelmediyse kontrol etmeye gerek yok
      if (now < targetStaffMs) continue;

      // Vardiya bitişi üzerinden 6 saatten fazla geçtiyse eski kayıtları es geç
      if (now - shiftEndMs > 6 * 60 * 60 * 1000) continue;

      // Kullanıcının bugüne ait tüm kayıtlarını topla
      const userTodayRecords = attendanceRecords.filter(
        (r) => r.userId === assignment.userId && r.date === todayStr
      );

      // Bugün hiç giriş kaydı yoksa (izinli/çalışmıyor) bildirim gönderilmez
      if (userTodayRecords.length === 0) continue;

      // Personel bugün herhangi bir kaydında çıkış yapmış mı?
      const hasCheckedOut = userTodayRecords.some((r) => {
        // Çıkış saati girilmişse çıkış yapmıştır
        if (r.checkOutTime && Number(r.checkOutTime) > 0) return true;
        // Durumu tamamlandı veya çıkış onayında ise çıkış yapmıştır
        if (r.status === 'completed' || r.status === 'pending_checkout_approval') return true;
        // Çıkış onayı onaylandı veya beklemede ise çıkış yapmıştır
        if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return true;
        return false;
      });

      // Aktif açık mesai kaydı var mı? (Giriş yapılmış ama çıkış yapılmamış)
      const activeRecord = userTodayRecords.find((r) => {
        if (!r.checkInTime) return false;
        if (r.checkOutTime && Number(r.checkOutTime) > 0) return false;
        if (r.status === 'completed' || r.status === 'pending_checkout_approval') return false;
        if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return false;
        return r.status === 'checked_in';
      });

      // KESİN KURAL: Eğer personel çıkış yaptıysa VEYA açıkta kalan aktif bir mesaisi yoksa:
      // YÖNETİCİYE KESİNLİKLE BİLDİRİM GİTMEZ!
      if (hasCheckedOut || !activeRecord) {
        markSentLocalAlert(todayStr, assignment.userId, 'staff');
        markSentLocalAlert(todayStr, assignment.userId, 'admin');
        continue;
      }

      let recordUpdated = false;
      const updatedRecord: AttendanceRecord = { ...activeRecord };
      const staffName = assignment.userName || activeRecord.userName || 'Personel';
      const staffCompany = (activeRecord.companyCode || assignment.companyCode || shift.companyCode || comp).trim().toUpperCase();
      const appUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://81.213.219.69:3001';

      // --- KONTROL 1: TAM VARDİYA BİTİŞ SAATİNDE (Personele Kendi Çıkış Hatırlatması) ---
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

        // Kullanıcı şu an sisteme bağlı olan personelin kendisi ise bildirim ve zil çal
        if (currentUser?.id === assignment.userId) {
          NotificationService.playChime();
          NotificationService.sendNotification(
            title,
            message,
            `${appUrl}/?tab=attendance`
          );
        }

        // Personelin telefonuna push bildirim gönder
        FastActionAgent.enqueuePushNotification({
          title,
          message,
          targetMode: 'custom',
          targetUserIds: [assignment.userId],
          companyCode: staffCompany,
          collapseId: `shift_staff_${todayStr}_${assignment.userId}`,
          url: `${appUrl}/?tab=attendance`,
        });
      }

      // --- KONTROL 2: VARDİYA BİTİMİNDEN 10 DK SONRA (Hala Çıkış Yapmayan Personel İçin YÖNETİCİYE BİLDİRİM) ---
      // Kesin şart: now >= targetAdminMs (Vardiya bitiş saati + 10 dakika)
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
        const message = `${staffName} vardiya bitiş saatinin üzerinden 10 dakika geçmesine rağmen henüz çıkış yapmamıştır.`;

        // Eğer şu an bağlı kullanıcı bu firmanın yöneticisi ise sesli ve yerel uyar
        const currentAdminComp = (currentUser?.companyCode || comp).trim().toUpperCase();
        if (currentUser?.role === 'admin' && (!currentUser?.companyCode || currentAdminComp === staffCompany)) {
          NotificationService.playChime();
          NotificationService.sendNotification(
            title,
            message,
            `${appUrl}/?tab=staff_tracking`
          );
        }

        // SADECE ilgili firmanın yöneticilerine push bildirim gönder
        FastActionAgent.enqueuePushNotification({
          title,
          message,
          targetMode: 'admin',
          companyCode: staffCompany,
          collapseId: `shift_admin_${todayStr}_${assignment.userId}`,
          url: `${appUrl}/?tab=staff_tracking`,
        });
      }

      if (recordUpdated && onUpdateRecord) {
        onUpdateRecord(updatedRecord);
      }
    }
  },
};
