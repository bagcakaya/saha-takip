import React, { useState, useEffect } from 'react';
import { X, Package, Save, Building2, FileText, Edit2 } from 'lucide-react';
import { GeneralNote } from '../../types/storage';
import { useStorage } from '../../context/StorageContext';

interface UsedMaterialsModalProps {
  isOpen: boolean;
  note: GeneralNote | null;
  onClose: () => void;
  isAdmin?: boolean;
}

export const UsedMaterialsModal: React.FC<UsedMaterialsModalProps> = ({
  isOpen,
  note,
  onClose,
  isAdmin = false,
}) => {
  const { updateNoteMaterials } = useStorage();
  const [materials, setMaterials] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(!isAdmin);

  useEffect(() => {
    if (isOpen && note) {
      setMaterials(note.usedMaterials || '');
      setIsEditing(!isAdmin);
      setIsSaving(false);
    }
  }, [isOpen, note, isAdmin]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !note) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      await updateNoteMaterials(note.id, materials.trim());
      onClose();
    } catch (err) {
      console.error('Save materials error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const hasExistingMaterials = Boolean(note.usedMaterials && note.usedMaterials.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="used-materials-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                hasExistingMaterials
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}
            >
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 id="used-materials-title" className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Kullanılan Malzemeler</span>
                {hasExistingMaterials ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold">
                    Kayıtlı (Yeşil)
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-extrabold">
                    Kayıt Yok (Kırmızı)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAdmin
                  ? hasExistingMaterials
                    ? 'Personel tarafından kaydedilen malzemeler'
                    : 'Personel henüz malzeme kaydı yapmadı veya kaydetmedi'
                  : hasExistingMaterials
                  ? 'Kaydettiğiniz malzeme listesini güncelleyebilirsiniz'
                  : 'İş emrinde kullanılan malzemeleri kaydediniz (Kaydedilmezse kırmızı kalır)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Note Context Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            {note.cariName && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{note.cariName}</span>
              </div>
            )}
            <div className="flex items-start gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>İş Emri Açıklaması</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-3">
              {note.content}
            </p>
          </div>

          {/* Manager View Mode (when not editing) */}
          {isAdmin && !isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {hasExistingMaterials
                    ? 'Personel Tarafından Girilen Malzemeler:'
                    : 'Malzeme Kayıt Durumu:'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{hasExistingMaterials ? 'Düzenle' : 'El İle Malzeme Ekle'}</span>
                </button>
              </div>

              {hasExistingMaterials ? (
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed min-h-[90px]">
                  {note.usedMaterials}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-300 leading-relaxed min-h-[90px] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold block">Personel henüz herhangi bir malzeme kaydetmedi.</span>
                    <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                      Personel bu kısma herhangi bir malzeme girmediği veya kaydet demediği için buton kırmızı renkte gösterilmektedir.
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Edit / Input Mode (Staff or Admin in edit mode) */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Kullanılan Malzeme Listesi / Açıklama
                </label>
                <textarea
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Bu iş emrinde kullanılan malzemeleri ve adetlerini buraya yazınız...&#10;Örn:&#10;• 1 Adet 12V 5A Güç Kaynağı&#10;• 15 Metre Cat6 Kablo&#10;• 2 Adet BNC Konnektör"
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-y"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {materials.trim().length > 0
                    ? 'Kaydettiğinizde buton Yeşil renge dönecek ve yöneticiye iletilecektir.'
                    : 'Boş bırakırsanız veya kaydetmezseniz buton Kırmızı kalacaktır.'}
                </p>
              </div>

              {/* Actions for Edit Mode */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <span>Kaydediliyor...</span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Kaydet</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Manager View Actions (when not editing) */}
          {isAdmin && !isEditing && (
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
