import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../common/Modal';
import { ReturnWarrantyItem, ReturnWarrantyType, ReturnWarrantyStatus } from '../../types/storage';
import {
  ShieldCheck,
  RotateCcw,
  Calendar,
  Clock,
  Camera,
  Upload,
  Trash2,
  Bell,
  MessageCircle,
  Building2,
  Hash,
  Truck,
} from 'lucide-react';
import { WhatsappService } from '../../services/whatsappService';
import { useAuth } from '../../context/AuthContext';

interface ReturnWarrantyModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: ReturnWarrantyItem | null;
  onSave: (
    data: Omit<ReturnWarrantyItem, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>
  ) => Promise<void>;
}

export const ReturnWarrantyModal: React.FC<ReturnWarrantyModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  onSave,
}) => {
  const { user } = useAuth();

  const [type, setType] = useState<ReturnWarrantyType>('warranty');
  const [companyName, setCompanyName] = useState('');
  const [sentDateStr, setSentDateStr] = useState('');
  const [sentTimeStr, setSentTimeStr] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [serialNumberPhoto, setSerialNumberPhoto] = useState<string>('');
  const [trackingCodePhoto, setTrackingCodePhoto] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ReturnWarrantyStatus>('pending');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [hasCustomReminder, setHasCustomReminder] = useState(false);
  const [customReminderDateStr, setCustomReminderDateStr] = useState('');
  const [customReminderTimeStr, setCustomReminderTimeStr] = useState('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hidden file inputs
  const serialCameraInputRef = useRef<HTMLInputElement>(null);
  const serialFileInputRef = useRef<HTMLInputElement>(null);
  const trackingCameraInputRef = useRef<HTMLInputElement>(null);
  const trackingFileInputRef = useRef<HTMLInputElement>(null);

  // Reset or populate fields
  useEffect(() => {
    if (editingItem) {
      setType(editingItem.type);
      setCompanyName(editingItem.companyName);
      setSerialNumber(editingItem.serialNumber || '');
      setTrackingCode(editingItem.trackingCode || '');
      setSerialNumberPhoto(editingItem.serialNumberPhoto || '');
      setTrackingCodePhoto(editingItem.trackingCodePhoto || '');
      setNotes(editingItem.notes || '');
      setStatus(editingItem.status);

      const d = new Date(editingItem.sentDate);
      if (!isNaN(d.getTime())) {
        setSentDateStr(d.toISOString().split('T')[0]);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        setSentTimeStr(`${hh}:${mm}`);
      } else {
        setDefaultDateTime();
      }

      if (editingItem.reminderDate) {
        const rd = new Date(editingItem.reminderDate);
        if (!isNaN(rd.getTime())) {
          setCustomReminderDateStr(rd.toISOString().split('T')[0]);
          const rhh = String(rd.getHours()).padStart(2, '0');
          const rmm = String(rd.getMinutes()).padStart(2, '0');
          setCustomReminderTimeStr(`${rhh}:${rmm}`);
          setHasCustomReminder(true);
        }
      } else {
        setHasCustomReminder(false);
        initDefaultReminder();
      }
    } else {
      setType('warranty');
      setCompanyName('');
      setSerialNumber('');
      setTrackingCode('');
      setSerialNumberPhoto('');
      setTrackingCodePhoto('');
      setNotes('');
      setStatus('pending');
      setDefaultDateTime();
      initDefaultReminder();
      setHasCustomReminder(false);
      setNotifyWhatsapp(false);
    }
  }, [editingItem, isOpen]);

  const setDefaultDateTime = () => {
    const now = new Date();
    setSentDateStr(now.toISOString().split('T')[0]);
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setSentTimeStr(`${hh}:${mm}`);
  };

  const initDefaultReminder = () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setCustomReminderDateStr(nextWeek.toISOString().split('T')[0]);
    setCustomReminderTimeStr('09:00');
  };

  // Image compressor & reader
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1400;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'serial' | 'tracking'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await processImageFile(file);
      if (target === 'serial') {
        setSerialNumberPhoto(compressed);
      } else {
        setTrackingCodePhoto(compressed);
      }
    } catch (err) {
      console.error('Fotoğraf yükleme hatası:', err);
      alert('Fotoğraf yüklenirken bir sorun oluştu.');
    } finally {
      e.target.value = '';
    }
  };

  // Calculate 1 week preview date
  const getOneWeekPreview = () => {
    if (!sentDateStr) return '';
    try {
      const [y, m, d] = sentDateStr.split('-').map(Number);
      const sent = new Date(y, m - 1, d);
      sent.setDate(sent.getDate() + 7);
      return sent.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      alert('Lütfen gönderilen firma ismini girin.');
      return;
    }

    if (!sentDateStr || !sentTimeStr) {
      alert('Lütfen gönderim tarih ve saatini girin.');
      return;
    }

    const [year, month, day] = sentDateStr.split('-').map(Number);
    const [hours, minutes] = sentTimeStr.split(':').map(Number);
    const combinedSentDate = new Date(year, month - 1, day, hours, minutes, 0);

    // Calculate reminder: if custom reminder set, use it; otherwise 1 week after sentDate
    let reminderDate: string | undefined = undefined;
    const reminderActive = true;

    if (hasCustomReminder && customReminderDateStr && customReminderTimeStr) {
      const [ry, rm, rd] = customReminderDateStr.split('-').map(Number);
      const [rh, rmin] = customReminderTimeStr.split(':').map(Number);
      reminderDate = new Date(ry, rm - 1, rd, rh, rmin, 0).toISOString();
    } else {
      // 1 week (7 days) automatic reminder
      const targetAutoDate = new Date(combinedSentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      reminderDate = targetAutoDate.toISOString();
    }

    try {
      setIsSubmitting(true);
      await onSave({
        type,
        companyName: companyName.trim(),
        sentDate: combinedSentDate.toISOString(),
        serialNumber: serialNumber.trim() || undefined,
        trackingCode: trackingCode.trim() || undefined,
        serialNumberPhoto: serialNumberPhoto || undefined,
        trackingCodePhoto: trackingCodePhoto || undefined,
        notes: notes.trim() || undefined,
        status,
        reminderDate,
        reminderActive,
      });

      if (notifyWhatsapp) {
        WhatsappService.shareReturnWarranty({
          type,
          companyName: companyName.trim(),
          sentDate: combinedSentDate.toISOString(),
          serialNumber: serialNumber.trim() || undefined,
          trackingCode: trackingCode.trim() || undefined,
          notes: notes.trim() || undefined,
          staffName: user?.name || user?.username || 'Yetkili',
        });
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? 'İade / Garanti Kaydını Düzenle' : 'Yeni İade / Garanti Kaydı'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Type Selector (Garanti vs İade) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            İşlem Türü
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setType('warranty')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
                type === 'warranty'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>GARANTİ</span>
            </button>

            <button
              type="button"
              onClick={() => setType('return')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
                type === 'return'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>İADE</span>
            </button>
          </div>
        </div>

        {/* Hatırlatıcı & Bildirim Ayarları */}
        <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Hatırlatıcı & Bildirim Ayarı
              </span>
            </div>

            <button
              type="button"
              onClick={() => setHasCustomReminder(!hasCustomReminder)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                hasCustomReminder
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {hasCustomReminder ? '✓ Özel Tarih Belirlendi' : '+ Özel Hatırlatıcı Kur'}
            </button>
          </div>

          {hasCustomReminder ? (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <p className="text-[11px] text-blue-900 dark:text-blue-200 font-medium">
                Belirttiğiniz bu tarih ve saatte tüm kullanıcılara durum sorgulama bildirimi gönderilecektir:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Hatırlatıcı Tarihi
                  </label>
                  <input
                    type="date"
                    required={hasCustomReminder}
                    value={customReminderDateStr}
                    onChange={(e) => setCustomReminderDateStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Hatırlatıcı Saati
                  </label>
                  <input
                    type="time"
                    required={hasCustomReminder}
                    value={customReminderTimeStr}
                    onChange={(e) => setCustomReminderTimeStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
              <span className="font-extrabold block mb-0.5">⚡ Otomatik 1 Haftalık Takip Bildirimi:</span>
              Özel hatırlatıcı seçilmediğinde, gönderim tarihinden 1 hafta sonra{' '}
              {getOneWeekPreview() && (
                <strong className="underline decoration-blue-500 underline-offset-2 font-black">
                  ({getOneWeekPreview()})
                </strong>
              )}{' '}
              tüm kullanıcılara otomatik durum sorgulama bildirimi düşecektir. Ürün 1 haftadan önce dönerse kart üzerindeki &ldquo;İşlemi Tamamla&rdquo; butonuna basılarak bildirim otomatik iptal edilir.
            </div>
          )}
        </div>

        {/* Company Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Gönderilen Firma İsmi *</span>
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Örn: Ingenico, Beko, Hugin, Verifone..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium"
          />
        </div>

        {/* Date and Time Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Gönderim Tarihi</span>
            </label>
            <input
              type="date"
              required
              value={sentDateStr}
              onChange={(e) => setSentDateStr(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Saat</span>
            </label>
            <input
              type="time"
              required
              value={sentTimeStr}
              onChange={(e) => setSentTimeStr(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Section: 1. Serial Number & Photo */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-blue-500" />
            <span>1. Ürün Seri Numarası & Fotoğrafı</span>
          </label>

          <input
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Seri no yazın (isteğe bağlı)..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Photo Upload Area for Serial Number */}
          <div>
            {serialNumberPhoto ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/10">
                <img
                  src={serialNumberPhoto}
                  alt="Seri No"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSerialNumberPhoto('')}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 hover:bg-red-700 text-white shadow-md transition-colors"
                  title="Fotoğrafı Kaldır"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => serialCameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 text-xs font-bold transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>Kamera Çek</span>
                </button>

                <button
                  type="button"
                  onClick={() => serialFileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Galeriden Seç</span>
                </button>
              </div>
            )}

            {/* Hidden Inputs */}
            <input
              ref={serialCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePhotoUpload(e, 'serial')}
            />
            <input
              ref={serialFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoUpload(e, 'serial')}
            />
          </div>
        </div>

        {/* Section: 2. Cargo Tracking Code & Photo */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-blue-500" />
            <span>2. Kargo Gönderim Takip Kodu & Fiş Fotoğrafı</span>
          </label>

          <input
            type="text"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            placeholder="Kargo takip kodu / fiş no yazın..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Photo Upload Area for Tracking Code */}
          <div>
            {trackingCodePhoto ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/10">
                <img
                  src={trackingCodePhoto}
                  alt="Kargo Fişi"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setTrackingCodePhoto('')}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 hover:bg-red-700 text-white shadow-md transition-colors"
                  title="Fotoğrafı Kaldır"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => trackingCameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 text-xs font-bold transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>Kamera Çek</span>
                </button>

                <button
                  type="button"
                  onClick={() => trackingFileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Galeriden Seç</span>
                </button>
              </div>
            )}

            {/* Hidden Inputs */}
            <input
              ref={trackingCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePhotoUpload(e, 'tracking')}
            />
            <input
              ref={trackingFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoUpload(e, 'tracking')}
            />
          </div>
        </div>

        {/* Notes / Description */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Açıklama / Arıza & İade Detayı
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Arıza nedeni, ürün modeli veya diğer detaylar..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium resize-none"
          />
        </div>

        {/* Status Toggle if Editing */}
        {editingItem && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              İşlem Durumu:
            </span>
            <button
              type="button"
              onClick={() => setStatus(status === 'completed' ? 'pending' : 'completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                status === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              }`}
            >
              {status === 'completed' ? '✅ Sonuçlandı' : '⏳ Süreçte / Bekliyor'}
            </button>
          </div>
        )}

        {/* WhatsApp Notification Option */}
        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 cursor-pointer transition-colors hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40">
          <input
            type="checkbox"
            checked={notifyWhatsapp}
            onChange={(e) => setNotifyWhatsapp(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
          />
          <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
            Kaydedildiğinde WhatsApp ile İlet
          </span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs sm:text-sm font-semibold transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={!companyName.trim() || isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-md disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'Kaydediliyor...' : editingItem ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
