import AsyncStorage from '@react-native-async-storage/async-storage';
import { Company, User, getCompanyLicenseInfo, isCompanyExempt, isSuperAdmin } from '../types/auth';
import { MobileOneSignalService } from './oneSignalService';
import { CompanyService } from './companyService';

export const MobileLicenseAlertService = {
  /**
   * Checks company license expiration status in mobile.
   * If remaining days <= 3 and > 0, sends an attention-grabbing push notification to company admins.
   * Enforces once-per-day deduplication per company per remaining-day count.
   */
  async checkAndSendAlerts(currentUser?: User | null, activeCompany?: Company | null): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Check active company if customer company
    if (activeCompany && !isCompanyExempt(activeCompany.code)) {
      await this.checkSingleCompany(activeCompany, todayStr);
    }

    // 2. If Super Admin (POLATLAR), check all companies
    if (isSuperAdmin(currentUser)) {
      try {
        const companies = await CompanyService.fetchCompanies();
        for (const comp of companies) {
          if (!isCompanyExempt(comp.code)) {
            await this.checkSingleCompany(comp, todayStr);
          }
        }
      } catch (err) {
        console.warn('[MobileLicenseAlertService] Companies scan error:', err);
      }
    }
  },

  async checkSingleCompany(company: Company, todayStr: string): Promise<boolean> {
    const info = getCompanyLicenseInfo(company);

    if (!info.active || info.isLifetime || info.remainingDays > 3 || info.remainingDays <= 0) {
      return false;
    }

    const dedupKey = `@license_expiry_alert_v1_${company.code}_${info.remainingDays}d_${todayStr}`;
    try {
      const alreadySent = await AsyncStorage.getItem(dedupKey);
      if (alreadySent) {
        return false;
      }

      await AsyncStorage.setItem(dedupKey, Date.now().toString());

      const daysText = info.remainingDays === 1 ? '1 gün' : `${info.remainingDays} gün`;
      const title = '⚠️ DİKKAT: LİSANS SÜRENİZ DOLUYOR!';
      const message = `Firmanıza ait Lisans süresinin bitmesine ${daysText} kalmıştır. Hizmete kesintisiz devam edebilmek için lütfen Sistem Sağlayıcınızla irtibata geçiniz.`;

      await MobileOneSignalService.sendPushNotification({
        title,
        message,
        targetMode: 'admin',
        companyCode: company.code,
        collapseId: `license-exp-${company.code}`,
        data: { tab: 'home' },
      });

      console.log(`[MobileLicenseAlertService] ⚠️ Lisans uyarı bildirimi gönderildi: ${company.name} (${daysText} kaldı)`);
      return true;
    } catch (err) {
      console.warn(`[MobileLicenseAlertService] Bildirim gönderilirken hata (${company.code}):`, err);
      return false;
    }
  },
};
