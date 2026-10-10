const NOTIFICATION_API_URL = 'https://saha-takip-beige.vercel.app/api/send-notification';

export const MobilePushService = {
  /**
   * Schedules a hardware push notification via OneSignal cloud server
   * The notification will be delivered by OneSignal FCM/APNs at the exact scheduled date/time,
   * even if the app is killed or device is locked.
   */
  async scheduleTimedFollowUpPush(params: {
    followUpId: string;
    cariName: string;
    description: string;
    targetIsoDate: string;
    companyCode: string;
  }): Promise<string | undefined> {
    try {
      const response = await fetch(NOTIFICATION_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `⏰ Süreli Takip: ${params.cariName}`,
          message: params.description || 'Vakti gelen cari takip hatırlatması!',
          targetMode: 'admin',
          companyCode: params.companyCode || 'POLATLAR',
          send_after: params.targetIsoDate,
          collapse_id: `tfu_${params.followUpId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=timed-follow-ups',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.id) {
          return data.id;
        }
      }
    } catch (err) {
      console.warn('Failed to pre-schedule push notification from mobile:', err);
    }
    return undefined;
  },

  /**
   * Schedules a break end push notification for staff.
   * Delivered by OneSignal FCM/APNs at targetIsoDate even if the app is killed or device is locked.
   */
  async scheduleBreakOverPush(params: {
    userId: string;
    userName?: string;
    targetIsoDate: string;
    breakMinutes: number;
    companyCode: string;
  }): Promise<string | undefined> {
    try {
      const response = await fetch(NOTIFICATION_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: '☕ Mola Süreniz Doldu!',
          message: `Mola süreniz (${params.breakMinutes} dk) doldu, lütfen mesaiye dönünüz!`,
          targetUserIds: [params.userId],
          companyCode: params.companyCode || 'POLATLAR',
          send_after: params.targetIsoDate,
          collapse_id: `break_over_${params.userId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=attendance',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.id) {
          return data.id;
        }
      }
    } catch (err) {
      console.warn('Failed to schedule break over push from mobile:', err);
    }
    return undefined;
  },

  /**
   * Schedules shift checkout reminders:
   * 1. Staff: Exact shift end time ("Mesai saatiniz bitmiştir. İşten Çıkış yapmayı lütfen unutmayın!")
   * 2. Admin: +10 min after shift end if staff hasn't checked out ("[Personel Adı-Soyadı] mesai saati bitmesine rağmen İşten Çıktım işlemi yapmamıştır.")
   */
  async scheduleShiftCheckoutPush(params: {
    recordId: string;
    userId: string;
    userName: string;
    shiftName: string;
    targetStaffIso?: string;
    targetAdminIso?: string;
    target10mIso?: string;
    target20mIso?: string;
    companyCode: string;
  }): Promise<{ shiftStaffId?: string; shiftAdminId?: string; shift10mId?: string; shift20mId?: string }> {
    let shiftStaffId: string | undefined;
    let shiftAdminId: string | undefined;

    const staffIso = params.targetStaffIso || params.target10mIso;
    const adminIso = params.targetAdminIso || params.target20mIso;

    try {
      // 1. Exact shift end time reminder to staff
      if (staffIso) {
        const resStaff = await fetch(NOTIFICATION_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '🔔 Mesai Çıkış Hatırlatması',
            message: 'Mesai saatiniz bitmiştir. İşten Çıkış yapmayı lütfen unutmayın!',
            targetUserIds: [params.userId],
            companyCode: params.companyCode || 'POLATLAR',
            send_after: staffIso,
            collapse_id: `shift_staff_${params.recordId}`,
            url: 'https://saha-takip-beige.vercel.app/?tab=attendance',
          }),
        });
        if (resStaff.ok) {
          const dStaff = await resStaff.json();
          if (dStaff?.id) shiftStaffId = dStaff.id;
        }
      }

      // 2. +10m escalation to admins
      if (adminIso) {
        const resAdmin = await fetch(NOTIFICATION_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `⚠️ Vardiya Çıkış Gecikmesi: ${params.userName}`,
            message: `${params.userName} mesai saati bitmesine rağmen İşten Çıktım işlemi yapmamıştır.`,
            targetMode: 'admin',
            companyCode: params.companyCode || 'POLATLAR',
            send_after: adminIso,
            collapse_id: `shift_admin_${params.recordId}`,
            url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
          }),
        });
        if (resAdmin.ok) {
          const dAdmin = await resAdmin.json();
          if (dAdmin?.id) shiftAdminId = dAdmin.id;
        }
      }
    } catch (err) {
      console.warn('Failed to schedule shift checkout push from mobile:', err);
    }

    return {
      shiftStaffId,
      shiftAdminId,
      shift10mId: shiftStaffId,
      shift20mId: shiftAdminId,
    };
  },

  /**
   * Cancels a scheduled push notification from OneSignal cloud
   */
  async cancelScheduledPush(notificationId: string): Promise<boolean> {
    if (!notificationId) return false;
    try {
      const response = await fetch(`${NOTIFICATION_API_URL}?id=${encodeURIComponent(notificationId)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        return true;
      }
      // Fallback POST
      const postRes = await fetch(NOTIFICATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', id: notificationId }),
      });
      return postRes.ok;
    } catch (err) {
      console.warn('Failed to cancel scheduled push notification from mobile:', err);
      return false;
    }
  },
};
