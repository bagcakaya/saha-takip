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
