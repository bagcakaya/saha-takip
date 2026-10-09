import { Company, User, getCompanyLicenseInfo, isCompanyExempt, isSuperAdmin } from '../types/auth';
import { OneSignalService } from './oneSignalService';
import { NotificationService } from './notificationService';
import { CompanyService } from './companyService';

export const LicenseAlertService = {
  /**
   * Checks company license expiration status.
   * If remaining days <= 3 and > 0, sends an attention-grabbing push notification to company admins.
   * Prevents duplicate spamming by enforcing a once-per-day rule per company per remaining-day count.
   */
  async checkAndSendAlerts(currentUser?: User | null, activeCompany?: Company | null): Promise<void> {
    if (typeof window === 'undefined') return;

    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Check for the currently viewed/active customer company (if not POLATLAR)
    if (activeCompany && !isCompanyExempt(activeCompany.code)) {
      await this.checkSingleCompany(activeCompany, todayStr);
    }

    // 2. If Super Admin (POLATLAR / Murat Bey), scan all customer companies to ensure alerts reach managers even if they haven't logged in
    if (isSuperAdmin(currentUser)) {
      try {
        const companies = await CompanyService.fetchCompanies();
        for (const comp of companies) {
          if (!isCompanyExempt(comp.code)) {
            await this.checkSingleCompany(comp, todayStr);
          }
        }
      } catch (err) {
        console.warn('[LicenseAlertService] Super admin companies scan error:', err);
      }
    }
  },

  async checkSingleCompany(company: Company, todayStr: string): Promise<boolean> {
    const info = getCompanyLicenseInfo(company);

    // Only alert when 1, 2, or 3 days are remaining, and license is not lifetime or expired
    if (!info.active || info.isLifetime || info.remainingDays > 3 || info.remainingDays <= 0) {
      return false;
    }

    const dedupKey = `@license_expiry_alert_v1_${company.code}_${info.remainingDays}d_${todayStr}`;
    if (localStorage.getItem(dedupKey)) {
      return false; // Already sent today
    }

    const daysText = info.remainingDays === 1 ? '1 gün' : `${info.remainingDays} gün`;
    const title = '⚠️ DİKKAT: LİSANS SÜRENİZ DOLUYOR!';
    const message = `Firmanıza ait Lisans süresinin bitmesine ${daysText} kalmıştır. Hizmete kesintisiz devam edebilmek için lütfen Sistem Sağlayıcınızla irtibata geçiniz.`;

    try {
      // 1. Mark as sent today immediately
      localStorage.setItem(dedupKey, Date.now().toString());

      // 2. Send high-priority Push Notification targeting all admins of this company
      await OneSignalService.sendPushNotification({
        title,
        message,
        targetMode: 'admin',
        companyCode: company.code,
        collapseId: `license-exp-${company.code}`,
        url: '/?tab=home',
      });

      // 3. Play audible alarm/chime in browser
      NotificationService.playChime();

      console.log(`[LicenseAlertService] ⚠️ Lisans uyarı bildirimi gönderildi: ${company.name} (${daysText} kaldı)`);
      return true;
    } catch (err) {
      console.warn(`[LicenseAlertService] Bildirim gönderilirken hata (${company.code}):`, err);
      return false;
    }
  },
};
