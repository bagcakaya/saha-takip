import React, { useState, useMemo, useRef } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  MapPin,
  Hash,
  FileSpreadsheet,
  Upload,
  Download,
  Edit3,
  Trash2,
  X,
  Check,
  Copy,
  CheckCircle2,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { CariItem } from '../types/storage';

interface CarilerViewProps {
  onNavigateToTemplates?: () => void;
}

export const CarilerView: React.FC<CarilerViewProps> = ({ onNavigateToTemplates }) => {
  const { user } = useAuth();
  const {
    cariItems,
    carilerUpdatedAt,
    addCariItem,
    updateCariItem,
    deleteCariItem,
    clearAllCariler,
    loadBundledCarilerTemplate,
    downloadCariTemplateExcel,
    importCarilerFromExcelFile,
    exportCarilerToExcelFile,
  } = useStorage();

  const isPolatlar = (user?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR';

  // Search & UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCari, setEditingCari] = useState<CariItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [taxNo, setTaxNo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showSuccessBanner = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Numeric-only keydown guard for Phone, T.C. Kimlik No, and Vergi No
  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (
      allowedKeys.includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const resetForm = () => {
    setName('');
    setAddress('');
    setPhone('');
    setTcNo('');
    setTaxNo('');
    setFormError(null);
    setEditingCari(null);
  };

  const handleOpenAddForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: CariItem) => {
    setEditingCari(item);
    setName(item.name || '');
    setAddress(item.address || '');
    setPhone((item.phone || '').replace(/\D/g, ''));
    setTcNo((item.tcNo || '').replace(/\D/g, '').slice(0, 11));
    setTaxNo((item.taxNo || '').replace(/\D/g, '').slice(0, 10));
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    resetForm();
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Lütfen Cari İsmi giriniz. (Cari İsmi zorunludur)');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const cleanTc = tcNo.replace(/\D/g, '').slice(0, 11);
    const cleanTax = taxNo.replace(/\D/g, '').slice(0, 10);

    try {
      setIsSaving(true);
      setFormError(null);

      if (editingCari) {
        await updateCariItem(editingCari.id, {
          name: cleanName,
          address: address.trim(),
          phone: cleanPhone,
          tcNo: cleanTc,
          taxNo: cleanTax,
        });
        showSuccessBanner(`"${cleanName}" cari bilgileri güncellendi.`);
      } else {
        await addCariItem({
          name: cleanName,
          address: address.trim(),
          phone: cleanPhone,
          tcNo: cleanTc,
          taxNo: cleanTax,
        });
        showSuccessBanner(`"${cleanName}" cariler listesine eklendi.`);
      }
      handleCloseForm();
    } catch (err: any) {
      setFormError(err?.message || 'Cari kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCari = async (item: CariItem) => {
    if (!window.confirm(`"${item.name}" adlı cariyi silmek istediğinize emin misiniz?`)) {
      return;
    }
    await deleteCariItem(item.id);
    showSuccessBanner(`"${item.name}" silindi.`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const totalCount = await importCarilerFromExcelFile(file);
      showSuccessBanner(`Şablondan yükleme tamamlandı! Toplam ${totalCount} cari aktif.`);
    } catch (err: any) {
      alert('Excel şablonu yüklenirken hata oluştu: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLoadBundledTemplate = async () => {
    try {
      setIsUploading(true);
      const totalCount = await loadBundledCarilerTemplate();
      showSuccessBanner(`Hazır şablondan ${totalCount} cari başarıyla yüklendi!`);
    } catch (err: any) {
      alert('Hazır şablon yüklenirken hata oluştu: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyCari = (item: CariItem) => {
    const parts = [
      item.name,
      item.phone ? `Tel: ${item.phone}` : '',
      item.address ? `Adres: ${item.address}` : '',
      item.tcNo ? `T.C.: ${item.tcNo}` : '',
      item.taxNo ? `Vergi No: ${item.taxNo}` : '',
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join(' | '));
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredCariler = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    if (!q) return cariItems;
    return cariItems.filter((item) => {
      return (
        item.name.toLocaleLowerCase('tr-TR').includes(q) ||
        (item.address && item.address.toLocaleLowerCase('tr-TR').includes(q)) ||
        (item.phone && item.phone.includes(q)) ||
        (item.tcNo && item.tcNo.includes(q)) ||
        (item.taxNo && item.taxNo.includes(q))
      );
    });
  }, [cariItems, searchQuery]);

  const formattedUpdatedAt = carilerUpdatedAt
    ? new Date(carilerUpdatedAt).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* Top Header & Actions Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 dark:border-slate-700/80 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100">
                  Cariler
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {cariItems.length} Kayıtlı Cari
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Carilerinizi kendiniz ekleyebilir veya isterseniz Şablonlardan Excel ile toplu yükleyebilirsiniz.
                {formattedUpdatedAt && (
                  <span className="ml-2 text-slate-400 dark:text-slate-500 font-semibold">
                    • Son Güncelleme: {formattedUpdatedAt}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-black shadow-md shadow-blue-600/25 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Yeni Cari Ekle</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Excel Şablonundan Carileri Yükle (.xlsx / .xls)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Yükleniyor...' : 'Şablondan Yükle (.xlsx)'}</span>
            </button>

            <button
              type="button"
              onClick={downloadCariTemplateExcel}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              title="Cari Yükleme Excel Şablonunu İndir"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Örnek Şablon İndir</span>
            </button>

            {cariItems.length > 0 && (
              <button
                type="button"
                onClick={exportCarilerToExcelFile}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                title="Mevcut Carileri Excel Olarak İndir"
              >
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Excel&apos;e Aktar</span>
              </button>
            )}

            {onNavigateToTemplates && (
              <button
                type="button"
                onClick={onNavigateToTemplates}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                title="Şablonlar Modülüne Git"
              >
                <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                <span>Şablonlar</span>
              </button>
            )}
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

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ismi, telefon numarası, adres, T.C. kimlik veya vergi numarası ile ara..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {cariItems.length > 0 && (
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
              <span>
                Gösterilen: <strong className="text-slate-800 dark:text-slate-200">{filteredCariler.length}</strong> / {cariItems.length}
              </span>
              {cariItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Listedeki tüm (${cariItems.length}) cari kaydını temizlemek istediğinize emin misiniz?`
                      )
                    ) {
                      clearAllCariler();
                      showSuccessBanner('Tüm cari listesi temizlendi.');
                    }
                  }}
                  className="text-red-500 hover:text-red-600 dark:text-red-400 font-bold underline ml-2 cursor-pointer"
                >
                  Tümünü Temizle
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Cari Form Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={handleCloseForm}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {editingCari ? 'Cari Bilgilerini Düzenle' : 'Yeni Cari Ekle'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cari İsmi zorunludur, diğer alanlar isteğe bağlıdır.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-4 sm:p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold">
                  {formError}
                </div>
              )}

              {/* 1. Cari İsmi (Zorunlu) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">
                  Cari İsmi <span className="text-red-500">* (Zorunlu)</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Hacı Baba Lokanta Gıda Turizm Ltd. Şti."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 2. Adresi (Opsiyonel) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Adresi
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    Opsiyonel
                  </span>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Açık adres bilgisi (Mahalle, Cadde, Sokak, No, İlçe/İl)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* 3. Telefon Numarası (Opsiyonel - Sadece Rakam) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Telefon Numarası
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    Opsiyonel • Sadece Numara
                  </span>
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={15}
                    value={phone}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Örn: 05321234567"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 4. T.C. Kimlik Numarası & 5. Vergi Numarası (Opsiyonel - Sadece Rakam) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      T.C. Kimlik Numarası
                    </label>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      Opsiyonel
                    </span>
                  </div>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      value={tcNo}
                      onKeyDown={handleNumericKeyDown}
                      onChange={(e) => setTcNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="11 haneli T.C. No"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Vergi Numarası
                    </label>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      Opsiyonel
                    </span>
                  </div>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      value={taxNo}
                      onKeyDown={handleNumericKeyDown}
                      onChange={(e) => setTaxNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10 haneli Vergi No"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{isSaving ? 'Kaydediliyor...' : editingCari ? 'Değişiklikleri Kaydet' : 'Cariyi Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cariler List or Empty State */}
      {cariItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-8 sm:p-12 border border-dashed border-slate-300 dark:border-slate-700 text-center max-w-2xl mx-auto space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
              Henüz Kayıtlı Cari Bulunmuyor
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Carilerinizi <strong>Yeni Cari Ekle</strong> butonuyla kendiniz girebilir veya isterseniz <strong>Şablonlardan</strong> yükleyerek tüm carilerinizi burada görebilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-lg shadow-blue-600/25 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Yeni Cari Ekle</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Şablondan Excel Yükle (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={downloadCariTemplateExcel}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Örnek Şablon İndir</span>
            </button>

            {isPolatlar && (
              <button
                type="button"
                onClick={handleLoadBundledTemplate}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Hazır Şablondan Yükle (POLATLAR2025)</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredCariler.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-8 text-center border border-slate-200/80 dark:border-slate-700/80">
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            &quot;{searchQuery}&quot; aramasına uygun cari bulunamadı.
          </p>
          <button
            type="button"
            onClick={() => {
              setName(searchQuery);
              setIsFormOpen(true);
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>&quot;{searchQuery}&quot; İsimli Yeni Cari Ekle</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredCariler.map((item, idx) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400/60 dark:hover:border-blue-500/50 transition-all flex flex-col justify-between gap-3 group"
            >
              <div className="space-y-2.5">
                {/* Cari Header */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug break-words">
                      {item.name}
                    </h3>
                  </div>

                  {/* Quick Edit / Copy / Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyCari(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors cursor-pointer"
                      title="Cari Bilgilerini Kopyala"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditForm(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                      title="Cariyi Düzenle"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCari(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      title="Cariyi Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Optional Details */}
                {(item.address || item.phone || item.tcNo || item.taxNo) ? (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                    {item.address && (
                      <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span className="leading-relaxed break-words">{item.address}</span>
                      </div>
                    )}

                    {item.phone && (
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <a
                          href={`tel:${item.phone}`}
                          className="font-mono hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted"
                        >
                          {item.phone}
                        </a>
                      </div>
                    )}

                    {(item.tcNo || item.taxNo) && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {item.tcNo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-semibold">
                            <strong className="font-sans text-slate-500 dark:text-slate-400">T.C.:</strong> {item.tcNo}
                          </span>
                        )}
                        {item.taxNo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-semibold">
                            <strong className="font-sans text-slate-500 dark:text-slate-400">Vergi No:</strong> {item.taxNo}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                      Ek bilgi (adres / telefon / vergi no) girilmemiş
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditForm(item)}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      + Bilgi Ekle
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
