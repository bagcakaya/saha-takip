import React, { useRef, useState } from 'react';
import { Building2, Download, Upload, Eye, CheckCircle2, Database, FileSpreadsheet, Sparkles } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { CariListModal } from '../common/CariListModal';

export const CariSection: React.FC = () => {
  const { user, company } = useAuth();
  const {
    cariler,
    cariItems,
    carilerUpdatedAt,
    carilerTotal,
    importCarilerFromExcelFile,
    exportCarilerToExcelFile,
    downloadCariTemplateExcel,
    loadBundledCarilerTemplate,
  } = useStorage();

  const compCode = (user?.companyCode || 'POLATLAR').toUpperCase();
  const isPolatlar = compCode === 'POLATLAR';
  const compName = company?.name || user?.companyName || compCode;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadMessage(null);
      const count = await importCarilerFromExcelFile(file);
      setUploadMessage(`${count} Cari başarıyla içe aktarıldı ve Cariler modülüne kaydedildi!`);
      setTimeout(() => setUploadMessage(null), 4000);
    } catch (err: any) {
      alert('Excel dosyası yüklenirken hata oluştu: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLoadBundled = async () => {
    try {
      setIsUploading(true);
      setUploadMessage(null);
      const count = await loadBundledCarilerTemplate();
      setUploadMessage(`${count} Cari hazır şablondan yüklendi ve Cariler modülüne kaydedildi!`);
      setTimeout(() => setUploadMessage(null), 4000);
    } catch (err: any) {
      alert('Hazır şablon yüklenirken hata oluştu: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsUploading(false);
    }
  };

  const formattedDate = carilerUpdatedAt
    ? new Date(carilerUpdatedAt).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Cari Hesap Veritabanı
              </h3>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                {isPolatlar ? 'POLATLAR2025 & Excel Entegrasyonu' : `${compName} Excel Cari Entegrasyonu`}
              </span>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-xs">
            {cariItems.length || carilerTotal || cariler.length} Cari
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">{compName}</strong> firmasına ait cari hesap şablonu yönetimi. Buradan örnek Excel şablonunu indirip doldurarak veya mevcut cari Excel dosyanızı (.xlsx) yükleyerek <strong>Cariler</strong> modülünde, İş Emirlerinde, Servislerde ve Kurulumlarda carilerinizi görüntüleyebilirsiniz.
        </p>

        {formattedDate && (
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span>Son Güncelleme: {formattedDate}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? 'Yükleniyor...' : 'Excel Şablonundan Cari Yükle (.xlsx / .xls)'}</span>
          </button>

          <button
            type="button"
            onClick={downloadCariTemplateExcel}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Örnek Cari Şablonu İndir (.xlsx)</span>
          </button>

          {isPolatlar && (
            <button
              type="button"
              onClick={handleLoadBundled}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>POLATLAR2025 Hazır Cari Şablonunu Yükle</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              <span>Listeyi İncele</span>
            </button>

            <button
              type="button"
              onClick={exportCarilerToExcelFile}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span>Excel İndir (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Hidden Excel File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx,.xls"
          className="hidden"
        />

        {uploadMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{uploadMessage}</span>
          </div>
        )}
      </div>

      <CariListModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
