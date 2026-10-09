import React, { useState } from 'react';
import { AlertTriangle, MessageCircle, Phone, ShieldCheck, X } from 'lucide-react';
import { LicenseInfo, Company, isCompanyExempt } from '../../types/auth';

interface EmergencyLicenseAlertBannerProps {
  licenseInfo: LicenseInfo;
  company?: Company | null;
  onOpenDetails?: () => void;
}

export const EmergencyLicenseAlertBanner: React.FC<EmergencyLicenseAlertBannerProps> = ({
  licenseInfo,
  company,
  onOpenDetails,
}) => {
  const [dismissed, setDismissed] = useState(false);

  // Conditions to show: Active license, not exempt, not lifetime, remainingDays <= 3 and > 0
  if (
    dismissed ||
    !company ||
    isCompanyExempt(company.code) ||
    !licenseInfo.active ||
    licenseInfo.isLifetime ||
    licenseInfo.remainingDays > 3 ||
    licenseInfo.remainingDays <= 0
  ) {
    return null;
  }

  const daysText = licenseInfo.remainingDays === 1 ? '1 gün' : `${licenseInfo.remainingDays} gün`;
  const compName = company.name || company.code;
  const whatsappText = encodeURIComponent(
    `Merhaba Murat Bey, ${compName} (${company.code}) firmamızın Lisans süresinin bitmesine ${daysText} kalmıştır. Hizmete kesintisiz devam edebilmek için lisansımızı yenilemek istiyoruz.`
  );

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-red-500 bg-gradient-to-r from-red-600 via-rose-700 to-amber-600 p-4 sm:p-5 text-white shadow-xl shadow-red-600/25 animate-in fade-in slide-in-from-top-3 duration-300">
      {/* Decorative ambient glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-start gap-3 sm:gap-4 flex-1">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner animate-pulse">
            <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-300" />
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-black/40 text-yellow-300 border border-yellow-400/50 shadow-xs">
                ⚠️ DİKKAT: LİSANS SÜRENİZ DOLUYOR!
              </span>
              <span className="text-xs font-black text-yellow-200">
                (Son {daysText}!)
              </span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-white/95 leading-relaxed">
              Firmanıza ait Lisans süresinin bitmesine <span className="font-black text-yellow-300 underline">{daysText}</span> kalmıştır. Hizmete kesintisiz devam edebilmek için lütfen Sistem Sağlayıcınızla irtibata geçiniz.
            </p>

            {/* Quick Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-2 sm:gap-3">
              <a
                href={`https://wa.me/905336082353?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md shadow-emerald-950/30 transition-transform active:scale-95 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Sistem Sağlayıcı ile İrtibata Geç (WhatsApp)</span>
              </a>

              <a
                href="tel:05336082353"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs backdrop-blur-xs border border-white/30 transition-colors cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>0533 608 23 53</span>
              </a>

              {onOpenDetails && (
                <button
                  type="button"
                  onClick={onOpenDetails}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 text-yellow-200 font-bold text-xs border border-yellow-300/30 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Lisans Bilgileri</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer shrink-0"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
