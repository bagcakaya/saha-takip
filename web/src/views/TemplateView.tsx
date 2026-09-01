import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { BackupSection } from '../components/templates/BackupSection';
import { TemplateTaskList } from '../components/templates/TemplateTaskList';

export const TemplateView: React.FC = () => {
  const { standardTasks, resetStandardTasks } = useStorage();

  const handleReset = () => {
    if (
      window.confirm(
        'Şablon görev listesini ilk haline (12 adet varsayılan kurulum görevi) sıfırlamak istediğinize emin misiniz? Kendi eklediğiniz tüm şablon görevler silinecektir.'
      )
    ) {
      resetStandardTasks();
    }
  };

  return (
    <div className="space-y-5 pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 dark:border-slate-700/80">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
            Standart Şablon Yönetimi
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Yeni açılacak kurulumlar için toplam {standardTasks.length} adet otomatik tanımlı görev
          </span>
        </div>

        {standardTasks.length > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shrink-0"
            title="Varsayılan 12 Göreve Sıfırla"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Varsayılana Sıfırla</span>
          </button>
        )}
      </div>

      {/* Desktop 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Backup & Data Portability */}
        <div className="lg:col-span-5 space-y-5">
          <BackupSection />
        </div>

        {/* Right Column: Standard Tasks List & Addition */}
        <div className="lg:col-span-7">
          <TemplateTaskList />
        </div>
      </div>
    </div>
  );
};
