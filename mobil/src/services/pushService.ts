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
   * Schedules shift checkout reminders for staff (+10 min) and escalation to admin (+20 min)
   */
  async scheduleShiftCheckoutPush(params: {
    recordId: string;
    userId: string;
    userName: string;
    shiftName: string;
    target10mIso: string;
    target20mIso: string;
    companyCode: string;
  }): Promise<{ shift10mId?: string; shift20mId?: string }> {
    let shift10mId: string | undefined;
    let shift20mId: string | undefined;

    try {
      // 1. +10m reminder to staff
      const res10m = await fetch(NOTIFICATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🔔 Mesai Çıkış Hatırlatması',
          message: `Sayın ${params.userName}, vardiya saatiniz (${params.shiftName}) sona erdi. İşten çıkış yapmayı unuttuysanız lütfen mesai çıkışınızı yapınız.`,
          targetUserIds: [params.userId],
          companyCode: params.companyCode || 'POLATLAR',
          send_after: params.target10mIso,
          collapse_id: `shift_10m_${params.recordId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=attendance',
        }),
      });
      if (res10m.ok) {
        const d10 = await res10m.json();
        if (d10?.id) shift10mId = d10.id;
      }

      // 2. +20m escalation to admins
      const res20m = await fetch(NOTIFICATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `⚠️ Vardiya Çıkış Gecikmesi: ${params.userName}`,
          message: `${params.userName} isimli personelin vardiya saati (${params.shiftName}) bitiminden 20 dakika geçmesine rağmen işten çıkış kaydı yapılmadı.`,
          targetMode: 'admin',
          companyCode: params.companyCode || 'POLATLAR',
          send_after: params.target20mIso,
          collapse_id: `shift_20m_${params.recordId}`,
          url: 'https://saha-takip-beige.vercel.app/?tab=staff_tracking',
        }),
      });
      if (res20m.ok) {
        const d20 = await res20m.json();
        if (d20?.id) shift20mId = d20.id;
      }
    } catch (err) {
      console.warn('Failed to schedule shift checkout push from mobile:', err);
    }

    return { shift10mId, shift20mId };
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
