import React from 'react';
import { BarChart3, FileSpreadsheet, PieChart, TrendingUp, Clock } from 'lucide-react';

export const ReportsView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Üst Bilgi Kartı */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Raporlar Modülü
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60">
                  Yeni Modül
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Saha operasyonları, servis kayıtları, iş emirleri, personel mesai ve finansal analiz raporları merkezi.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hazırlanıyor / İçerik Bilgilendirme Alanı */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-5 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
          <PieChart className="w-8 h-8" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
            Raporlar Modülü Altyapısı Hazır
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Bu modülün detaylı rapor içerikleri, filtreleri ve dışa aktarma (PDF / Excel) şablonları belirleyeceğiniz kriterlere göre eklenecektir.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 flex flex-col items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Operasyon & Servis Analizi</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 flex flex-col items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Personel & İş Emri Performansı</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 flex flex-col items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Özel Excel & PDF Raporları</span>
          </div>
        </div>
      </div>
    </div>
  );
};
