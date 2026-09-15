import React, { useMemo, useState, useRef } from 'react';
import {
  Search,
  Building2,
  Upload,
  Download,
  CheckCircle2,
  Copy,
  Check,
  X,
  Database,
} from 'lucide-react';
import { Modal } from './Modal';
import { useStorage } from '../../context/StorageContext';

interface CariListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCari?: (cariName: string) => void;
}

export const CariListModal: React.FC<CariListModalProps> = ({
  isOpen,
  onClose,
  onSelectCari,
}) => {
  const {
    cariler,
    carilerUpdatedAt,
    carilerTotal,
    importCarilerFromExcelFile,
    exportCarilerToExcelFile,
  } = useStorage();

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter cariler based on search query
  const filteredCariler = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    if (!q) return cariler;
    return cariler.filter((c) => c.toLocaleLowerCase('tr').includes(q));
  }, [cariler, searchQuery]);

  const handleCopy = (name: string) => {
    navigator.clipboard?.writeText(name);
    setCopiedName(name);
    setTimeout(() => {
      setCopiedName(null);
    }, 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadSuccessMessage(null);
      const count = await importCarilerFromExcelFile(file);
      setUploadSuccessMessage(`${count} adet Cari başarıyla Excel'den yüklendi ve güncellendi!`);
      setTimeout(() => setUploadSuccessMessage(null), 4000);
    } catch (err: any) {
      alert('Excel dosyası okunurken hata oluştu: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formattedDate = useMemo(() => {
    if (!carilerUpdatedAt) return null;
    try {
      const d = new Date(carilerUpdatedAt);
      return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [carilerUpdatedAt]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cari Hesap Listesi (POLATLAR2025)"
    >
      <div className="space-y-4 max-h-[80vh] flex flex-col">
        {/* Top Info Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/80 dark:border-blue-800/60 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-blue-950 dark:text-blue-200">
                SSMS Veritabanı: POLATLAR2025
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-600 text-white shadow-xs">
                {carilerTotal || cariler.length} Cari
              </span>
              {formattedDate && (
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {formattedDate}
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Veritabanına yeni bir Cari eklendiğinde masaüstünüzdeki{' '}
            <strong className="text-blue-700 dark:text-blue-300">Cari_Guncelle.bat</strong>{' '}
            dosyasını çift tıklayarak tek tıkla Excel ve uygulamayı anında senkronize edebilirsiniz.
          </p>

          {/* Action Buttons: Upload Excel & Download Excel */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{isUploading ? 'Yükleniyor...' : "Excel'den Yükle (.xlsx)"}</span>
            </button>

            <button
              type="button"
              onClick={exportCarilerToExcelFile}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel İndir (.xlsx)</span>
            </button>
          </div>

          {uploadSuccessMessage && (
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{uploadSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* Live Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari adı veya firma ara..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>
            {searchQuery ? `${filteredCariler.length} sonuç bulundu` : `Toplam ${cariler.length} Cari`}
          </span>
          {onSelectCari && (
            <span className="text-blue-600 dark:text-blue-400 font-bold text-[11px]">
              Seçmek için cariye tıklayın
            </span>
          )}
        </div>

        {/* Scrollable Cari List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[380px] pr-1 select-none">
          {filteredCariler.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Aramanıza uygun Cari bulunamadı.
              </p>
            </div>
          ) : (
            filteredCariler.map((name, index) => {
              const isCopied = copiedName === name;
              return (
                <div
                  key={name}
                  onClick={() => {
                    if (onSelectCari) {
                      onSelectCari(name);
                      onClose();
                    }
                  }}
                  className={`group flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 transition-all ${
                    onSelectCari
                      ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-700'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-[10px] font-bold text-slate-400 dark:text-slate-500 text-right shrink-0">
                      {index + 1}.
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {onSelectCari ? (
                      <span className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-extrabold group-hover:scale-105 transition-transform">
                        Seç
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(name);
                        }}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          isCopied
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        title="Adı Kopyala"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Close Button */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
};
