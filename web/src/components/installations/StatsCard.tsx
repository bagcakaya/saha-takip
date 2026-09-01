import React from 'react';
import { Building2, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

interface StatsCardProps {
  totalLocations: number;
  completionRate: number;
  notPresentRate: number;
  activeFilter?: string;
  onFilterSelect?: (filter: string) => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  totalLocations,
  completionRate,
  notPresentRate,
  activeFilter = 'all',
  onFilterSelect,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
      {/* 1. Toplam Lokasyon */}
      <div
        onClick={() => onFilterSelect && onFilterSelect('all')}
        className={`bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs border transition-all duration-200 cursor-pointer hover:shadow-md active:scale-[0.99] flex items-center justify-between ${
          activeFilter === 'all'
            ? 'border-blue-500/80 ring-2 ring-blue-500/20'
            : 'border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="space-y-1">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 block">
            Toplam Lokasyon
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">
              {totalLocations}
            </span>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              Kayıtlı
            </span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
          <Building2 className="w-6 h-6" />
        </div>
      </div>

      {/* 2. Tamamlanma Oranı */}
      <div
        onClick={() => onFilterSelect && onFilterSelect('completed')}
        className={`bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs border transition-all duration-200 cursor-pointer hover:shadow-md active:scale-[0.99] flex items-center justify-between ${
          activeFilter === 'completed'
            ? 'border-emerald-500/80 ring-2 ring-emerald-500/20'
            : 'border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="space-y-1">
          <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 block">
            Genel Tamamlanma
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              %{completionRate}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
              <TrendingUp className="w-3 h-3" /> Başarı
            </span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      </div>

      {/* 3. Mevcut Değil Oranı */}
      <div
        onClick={() => onFilterSelect && onFilterSelect('not_present')}
        className={`bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs border transition-all duration-200 cursor-pointer hover:shadow-md active:scale-[0.99] flex items-center justify-between ${
          activeFilter === 'not_present'
            ? 'border-amber-500/80 ring-2 ring-amber-500/20'
            : 'border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="space-y-1">
          <span className="text-[11px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400 block">
            Mevcut Değil / Muaf
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              %{notPresentRate}
            </span>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              Oran
            </span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
