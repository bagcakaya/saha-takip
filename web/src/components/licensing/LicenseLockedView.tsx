import React, { useState } from 'react';
import { ShieldAlert, LogOut, RefreshCw, Mail, Database, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LicenseLockedView: React.FC = () => {
  const { user, company, licenseInfo, logout, refreshCompany } = useAuth();
  const [isChecking, setIsChecking] = useState(false);

  const handleRecheck = async () => {
    setIsChecking(true);
    try {
      await refreshCompany();
    } catch (e) {
      console.warn('Lisans kontrolü başarısız:', e);
    } finally {
      setTimeout(() => setIsChecking(false), 800);
    }
  };

  const isSuspended = licenseInfo.status === 'suspended';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-500/30 overflow-hidden text-center">
        {/* Glow Header */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Status Badge & Icon */}
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 mb-5 shadow-inner">
          <ShieldAlert className="w-10 h-10 animate-pulse" />
        </div>

        {/* Institution Pill */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="px-3 py-1 text-xs font-black tracking-wider uppercase rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {company?.name || user?.companyCode || 'Kurum'}
          </span>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            {isSuspended ? '❄️ Donduruldu' : '🔴 Lisans Süresi Doldu'}
          </span>
        </div>

        {/* Main Title */}
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-3">
          {isSuspended ? 'Hizmet Geçici Olarak Donduruldu' : 'Lisans Kullanım Süresi Sona Erdi'}
        </h2>

        {/* Descriptive Body */}
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          {company?.name || 'Kurumunuzun'} İş Takip Sistemi lisansı süresi dolmuş veya hizmeti geçici olarak durdurulmuştur.
        </p>

        {/* Data Security Guarantee Notice Box */}
        <div className="p-4 mb-6 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-left">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <Database className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <span>Verileriniz Güvenle Saklanmaktadır</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </h4>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed">
                Tüm kurulumlarınız, servis formlarınız, iş emirleriniz ve personel hareketleriniz sistemde eksiksiz olarak muhafaza edilmektedir. Lisansınız uzatıldığı anda hiçbir veri kaybı olmadan kaldığınız yerden devam edebilirsiniz.
              </p>
            </div>
          </div>
        </div>

        {/* Reason / Expiry Details */}
        {(company?.freezeReason || licenseInfo.expiresDateFormatted) && (
          <div className="p-3.5 mb-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 text-left space-y-1">
            {licenseInfo.expiresDateFormatted && (
              <div className="flex justify-between items-center py-0.5">
                <span className="font-medium text-slate-500">Son Geçerlilik:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{licenseInfo.expiresDateFormatted}</span>
              </div>
            )}
            {company?.freezeReason && (
              <div className="flex justify-between items-start py-0.5 gap-2">
                <span className="font-medium text-slate-500 shrink-0">Açıklama:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 text-right">{company.freezeReason}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <button
            onClick={handleRecheck}
            disabled={isChecking}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Kontrol Ediliyor...' : 'Lisansı Yeniden Kontrol Et'}</span>
          </button>

          <button
            onClick={logout}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-300 dark:border-slate-700"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Oturumu Kapat</span>
          </button>
        </div>

        {/* Contact Support Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium">İş Takip Sistemi bir Polatlar Yazılım ürünüdür</span>
          <div className="flex items-center gap-4">
            <a
              href="mailto:info@polatlaryazilim.com"
              className="hover:text-blue-500 flex items-center gap-1 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>info@polatlaryazilim.com</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
