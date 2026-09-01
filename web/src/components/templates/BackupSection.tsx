import React, { useRef } from 'react';
import { CloudUpload, CloudDownload, Database } from 'lucide-react';
import { StorageService } from '../../services/storageService';
import { useStorage } from '../../context/StorageContext';
import { BackupData } from '../../types/storage';

export const BackupSection: React.FC = () => {
  const { importBackupData } = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const jsonString = await StorageService.exportBackup();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gorev_tamamlama_yedek_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Yedek dışa aktarılamadı:', err);
      alert('Yedek dosyası oluşturulurken bir hata oluştu.');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed: BackupData = JSON.parse(content);

        if (!parsed.locations || !parsed.standardTasks) {
          alert('Hata: Seçilen dosya geçerli bir Saha Takip Raporu yedek dosyası değil.');
          return;
        }

        if (
          window.confirm(
            'Bu yedeği içe aktarmak, cihazınızdaki tüm mevcut kurulum kayıtlarını ve şablon görevleri yedeğin üzerine yazacaktır. Devam etmek istiyor musunuz?'
          )
        ) {
          await importBackupData(parsed);
          alert('Yedek dosyasından veriler başarıyla geri yüklendi.');
        }
      } catch (err) {
        console.error('Yedek okunamadı:', err);
        alert('Yedek yüklenirken bir hata oluştu. Dosyanın geçerli bir JSON olduğundan emin olun.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            Yedekleme ve Veri Taşıma
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            JSON formatında tam veri yedekleme
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Tüm geçmiş kurulumlarınızı, görev durumlarını, adresleri, fotoğrafları ve notları JSON dosyası olarak yedekleyin veya başka bir cihaza/tarayıcıya aktarın.
      </p>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all active:scale-[0.98]"
        >
          <CloudUpload className="w-4 h-4 text-blue-500" />
          <span>Yedek Al</span>
        </button>

        <input
          type="file"
          accept=".json,application/json"
          ref={fileInputRef}
          onChange={handleFileImport}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all active:scale-[0.98]"
        >
          <CloudDownload className="w-4 h-4 text-emerald-500" />
          <span>Yedek Yükle</span>
        </button>
      </div>
    </div>
  );
};
