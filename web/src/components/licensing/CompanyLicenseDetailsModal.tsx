import React from 'react';
import {
  ShieldCheck,
  Sparkles,
  Calendar,
  Building2,
  Clock,
  Phone,
  MessageCircle,
  X,
  Database,
  CheckCircle2,
  AlertTriangle,
  Users,
  Store,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isCompanyExempt } from '../../types/auth';

interface CompanyLicenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompanyLicenseDetailsModal: React.FC<CompanyLicenseDetailsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, company, licenseInfo } = useAuth();

  if (!isOpen) return null;

  const isExempt = isCompanyExempt(company?.code || user?.companyCode);
  const remainingDays = licenseInfo.remainingDays;
  const isExpiringSoon = licenseInfo.status === 'expiring_soon';
  const isExpired = licenseInfo.status === 'expired';
  const isSuspended = licenseInfo.status === 'suspended';

  // Format License Type in Turkish
  const formatLicenseType = (type?: string) => {
    switch (type) {
      case 'monthly':
        return 'Aylık Abonelik';
      case 'quarterly':
        return '3 Aylık (Çeyrek)';
      case 'semi_annual':
        return '6 Aylık Paket';
      case 'annual':
        return 'Yıllık Kurumsal Lisans';
      case 'lifetime':
        return 'Sınırsız / Ömür Boyu';
      case 'custom':
        return 'Özel Anlaşmalı';
      default:
        return 'Yıllık Standart';
    }
  };

  const compName = company?.name || user?.companyName || user?.companyCode || 'Kurum';
  const compCode = (company?.code || user?.companyCode || 'KURUM').toUpperCase();

  const whatsappMessage = encodeURIComponent(
    `Merhaba Murat Bey, ${compName} (${compCode}) firmamızın İş Takip Sistemi lisans süresi hakkında bilgi almak / yenilemek istiyoruz.`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs shrink-0 ${
                isExpired || isSuspended
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : isExpiringSoon
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isExpired || isSuspended ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isExpiringSoon ? (
                <Clock className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight truncate">
                Kurumsal Lisansım
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {compName} ({compCode})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Kalan Süre Büyük Vurgu Kartı */}
        <div
          className={`p-4 rounded-2xl border text-center transition-all ${
            isExpired || isSuspended
              ? 'bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40 border-rose-200 dark:border-rose-800'
              : isExpiringSoon
              ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-amber-200 dark:border-amber-800'
              : 'bg-gradient-to-br from-emerald-50/80 via-teal-50/60 to-emerald-50/80 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Kalan Lisans Süresi
          </div>

          <div
            className={`text-2xl sm:text-3xl font-black tracking-tight ${
              isExpired || isSuspended
                ? 'text-rose-600 dark:text-rose-400'
                : isExpiringSoon
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isExempt || licenseInfo.isLifetime
              ? 'Sınırsız / Ömür Boyu'
              : isExpired
              ? 'Süresi Doldu'
              : isSuspended
              ? 'Donduruldu'
              : `${remainingDays} Gün Kaldı`}
          </div>

          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {isExempt || licenseInfo.isLifetime
                ? 'Süresiz Kurumsal Erişim'
                : licenseInfo.expiresDateFormatted
                ? `Bitiş Tarihi: ${licenseInfo.expiresDateFormatted}`
                : 'Son gün belirlenmedi'}
            </span>
          </div>
        </div>

        {/* 2. Lisans Detay Tablosu */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Building2 className="w-3 h-3 text-blue-500" />
              Kurum
            </span>
            <div className="font-black text-slate-800 dark:text-slate-100 truncate">
              {compName}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Paket Türü
            </span>
            <div className="font-black text-slate-800 dark:text-slate-100 truncate">
              {formatLicenseType(company?.licenseType)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Store className="w-3 h-3 text-emerald-500" />
              Şube Limiti
            </span>
            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {company?.maxBranches ? `${company.maxBranches} Şube` : 'Sınırsız'}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Users className="w-3 h-3 text-amber-500" />
              Personel Limiti
            </span>
            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {company?.maxUsers ? `${company.maxUsers} Personel` : 'Sınırsız'}
            </div>
          </div>
        </div>

        {/* 3. Veri Güvenliği Garantisi Kutusu */}
        <div className="p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-left">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <Database className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                <span>Verileriniz Güvenle Saklanır</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              </div>
              <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200/90 leading-relaxed">
                Lisans süreniz dolsa dahi tüm iş emirleriniz, servis formlarınız ve personel kayıtlarınız sistemde güvenle korunur. Lisans uzatıldığında anında kaldığınız yerden devam edebilirsiniz.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Lisans Uzatma / İletişim Alanı */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Lisansınızı uzatmak veya paket değişikliği için:
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={`https://wa.me/905336082353?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp ile Uzat</span>
            </a>

            <a
              href="tel:05336082353"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>0533 608 23 53</span>
            </a>
          </div>
        </div>

        {/* Modal Kapat Butonu */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Pencereyi Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
