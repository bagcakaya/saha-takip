import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import {
  Bell,
  Pin,
  Camera,
  Image as ImageIcon,
  X,
  Loader2,
  Send,
  AlertTriangle,
  BookOpen,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { AdminReminder, AdminReminderCategory } from '../../types/storage';
import { compressImage } from '../../utils/imageUtils';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingReminder?: AdminReminder | null;
  onSave: (data: {
    title: string;
    content: string;
    category?: AdminReminderCategory;
    isPinned?: boolean;
    photos?: string[];
    sendPush?: boolean;
  }) => Promise<void>;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  editingReminder,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AdminReminderCategory>('procedure');
  const [isPinned, setIsPinned] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [sendPush, setSendPush] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  useEffect(() => {
    if (editingReminder) {
      setTitle(editingReminder.title || '');
      setContent(editingReminder.content || '');
      setCategory(editingReminder.category || 'procedure');
      setIsPinned(Boolean(editingReminder.isPinned));
      setPhotos(editingReminder.photos || []);
      setSendPush(false);
    } else {
      setTitle('');
      setContent('');
      setCategory('procedure');
      setIsPinned(false);
      setPhotos([]);
      setSendPush(true);
    }
  }, [editingReminder, isOpen]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPhoto(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i]);
        newPhotos.push(compressed);
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
    } catch (err: any) {
      alert(err?.message || 'Fotoğraf yüklenirken hata oluştu.');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Lütfen başlık ve talimat metnini doldurun.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        content: content.trim(),
        category,
        isPinned,
        photos,
        sendPush,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions: { key: AdminReminderCategory; label: string; icon: any; color: string }[] = [
    {
      key: 'procedure',
      label: 'İş Prosedürü',
      icon: BookOpen,
      color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    },
    {
      key: 'rule',
      label: 'Önemli Kural',
      icon: AlertTriangle,
      color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    },
    {
      key: 'urgent',
      label: 'Acil Uyarı',
      icon: ShieldAlert,
      color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    },
    {
      key: 'general',
      label: 'Genel Bilgi',
      icon: Info,
      color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingReminder ? 'Talimatı / Hatırlatmayı Düzenle' : 'Yeni Yönetici Hatırlatması & Talimatı'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Talimat Kategorisi
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {categoryOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = category === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setCategory(opt.key)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? `${opt.color} ring-2 ring-blue-500 shadow-xs scale-[1.02]`
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Başlık <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Cihaz Montajında Dikkat Edilecek Yeni Kural"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Content Textarea */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Talimat / Açıklama Metni <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Personele aktarılacak talimatı detaylıca yazın (Örn: Bundan sonra müşteri ziyaretlerinde cihaz teslim formu imzalatılıp sisteme fotoğrafı yüklenecektir...)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none leading-relaxed"
          />
        </div>

        {/* Photo Attachments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Fotoğraf / Belge Ekle ({photos.length})
            </label>
            <div className="flex items-center gap-2">
              {/* Camera Button */}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold cursor-pointer hover:bg-blue-100 transition-colors">
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isProcessingPhoto}
                />
              </label>

              {/* Gallery Button */}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-200 transition-colors">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Galeri</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isProcessingPhoto}
                />
              </label>
            </div>
          </div>

          {/* Photo Previews */}
          {isProcessingPhoto && (
            <div className="flex items-center justify-center p-3 text-xs text-blue-600 dark:text-blue-400 gap-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fotoğraf işleniyor ve optimize ediliyor...</span>
            </div>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
              {photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-xs"
                >
                  <img
                    src={photo}
                    alt={`Ek ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors cursor-pointer"
                    title="Fotoğrafı Kaldır"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pin & Push Toggles */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          {/* Pin Toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${isPinned ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                <Pin className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  En Üste Sabitle
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Önemli talimatlar listenin en başında görünür
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
          </label>

          {/* Send Push Toggle */}
          {!editingReminder && (
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${sendPush ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Personele Kilit Ekranı Bildirimi Gönder
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tüm personellerin telefonuna anlık sesli bildirim gider
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          )}
        </div>

        {/* Submit & Cancel Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{editingReminder ? 'Güncelle' : 'Talimatı Yayınla'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
