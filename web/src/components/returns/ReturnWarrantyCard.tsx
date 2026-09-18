import React, { useState } from 'react';
import {
  ShieldCheck,
  RotateCcw,
  Calendar,
  Clock,
  User,
  MessageCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  Hourglass,
  Maximize2,
  Building2,
} from 'lucide-react';
import { ReturnWarrantyItem } from '../../types/storage';
import { WhatsappService } from '../../services/whatsappService';
import { Lightbox } from '../common/Lightbox';
import { Modal } from '../common/Modal';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';

interface ReturnWarrantyCardProps {
  item: ReturnWarrantyItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onUpdateFollowUp?: (note: string) => Promise<void>;
}

export const ReturnWarrantyCard: React.FC<ReturnWarrantyCardProps> = ({
  item,
  onEdit,
  onDelete,
  onToggleStatus,
  onUpdateFollowUp,
}) => {
  const { updateReturnWarrantyItem } = useStorage();
  const { user } = useAuth();
  const [lightboxData, setLightboxData] = useState<{
    images: string[];
    initialIndex: number;
    title: string;
  } | null>(null);

  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  const returnPhotos = [item.serialNumberPhoto, item.trackingCodePhoto].filter(Boolean) as string[];

  const isWarranty = item.type === 'warranty';
  const isCompleted = item.status === 'completed';

  // Format sent date
  const d = new Date(item.sentDate);
  const formattedDate = !isNaN(d.getTime())
    ? d.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : item.sentDate;

  const formattedTime = !isNaN(d.getTime())
    ? d.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // Format follow-up date
  const formattedFollowUpDate = item.followUpDate
    ? new Date(item.followUpDate).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingFollowUp(true);
      const noteTrimmed = followUpInput.trim();
      if (onUpdateFollowUp) {
        await onUpdateFollowUp(noteTrimmed);
      } else {
        await updateReturnWarrantyItem(item.id, {
          followUpNote: noteTrimmed || undefined,
          followUpDate: noteTrimmed ? new Date().toISOString() : undefined,
          followUpByName: noteTrimmed ? (user?.name || user?.username || 'Yetkili') : undefined,
        });
      }
      setIsEditingFollowUp(false);
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Calculate reminder countdown for both Warranty and Return
  const getReminderCountdown = () => {
    if (!item.reminderDate) return null;

    if (isCompleted) {
      return {
        type: 'completed',
        text: '✅ Ürün Döndü / İşlem Tamamlandı',
        badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold',
      };
    }

    const reminderTime = new Date(item.reminderDate).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((reminderTime - now) / (1000 * 60 * 60 * 24));

    const reminderDateFormatted = new Date(item.reminderDate).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
    });

    if (diffDays > 0) {
      return {
        type: 'upcoming',
        text: `📅 Durum Takibi: Kalan ${diffDays} Gün (${reminderDateFormatted})`,
        badgeClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-medium',
      };
    } else if (diffDays === 0) {
      return {
        type: 'due',
        text: '⚠️ Takip Günü Bugün Doldu! (Son Durumu Sorgulayın)',
        badgeClass: 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 animate-pulse font-black',
      };
    } else {
      return {
        type: 'overdue',
        text: `🚨 Takip Süresi Aşıldı (${Math.abs(diffDays)} Gün Geçti)`,
        badgeClass: 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 font-black',
      };
    }
  };

  const reminderCountdown = getReminderCountdown();

  return (
    <>
      <div
        className={`rounded-2xl p-4 sm:p-5 shadow-xs border mb-3 space-y-4 transition-all duration-200 ${
          isCompleted
            ? 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800 opacity-85'
            : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 hover:shadow-md'
        }`}
      >
        {/* Cari Banner at the very top */}
        {item.cariName && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-xs">
            <Building2 className="w-4 h-4 text-blue-200 shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                Cari / Müşteri
              </span>
              <span className="text-xs sm:text-sm font-black truncate">
                {item.cariName}
              </span>
            </div>
          </div>
        )}

        {/* Top Badges & Actions */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          {/* Left Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black tracking-wide border ${
                isWarranty
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              {isWarranty ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>GARANTİ</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>İADE</span>
                </>
              )}
            </span>

            {/* Status Button / Badge */}
            <button
              onClick={onToggleStatus}
              title="Durumu değiştirmek için tıklayın"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                isCompleted
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Sonuçlandı</span>
                </>
              ) : (
                <>
                  <Hourglass className="w-3 h-3 text-amber-500 animate-spin-slow" />
                  <span>Süreçte</span>
                </>
              )}
            </button>

            {/* Creator Badge */}
            {item.createdByName && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <User className="w-3 h-3 text-slate-400" />
                <span>{item.createdByName}</span>
              </span>
            )}
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1">
            {/* WhatsApp Share */}
            <button
              onClick={() => {
                WhatsappService.shareReturnWarranty({
                  type: item.type,
                  companyName: item.companyName,
                  cariName: item.cariName,
                  sentDate: item.sentDate,
                  serialNumber: item.serialNumber,
                  trackingCode: item.trackingCode,
                  notes: item.notes,
                  followUpNote: item.followUpNote,
                  staffName: item.createdByName || 'Yetkili',
                });
              }}
              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
              title="WhatsApp ile İlet"
              aria-label="WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            {/* Edit */}
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              title="Düzenle"
              aria-label="Düzenle"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              title="Sil"
              aria-label="Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Company Name & Date */}
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>{item.companyName}</span>
          </h3>

          <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>{formattedDate}</span>
            </span>
            {formattedTime && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formattedTime}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Reminder Countdown Badge */}
        {reminderCountdown && (
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border ${reminderCountdown.badgeClass}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{reminderCountdown.text}</span>
            </div>
            {!isCompleted && !item.followUpNote && (reminderCountdown.type === 'due' || reminderCountdown.type === 'overdue') && (
              <button
                type="button"
                onClick={() => {
                  setFollowUpInput('');
                  setIsEditingFollowUp(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-[11px] font-black shrink-0 transition-colors shadow-xs cursor-pointer ml-auto"
              >
                + Aşama Notu Gir
              </button>
            )}
          </div>
        )}

        {/* Serial Number & Cargo Code Info Rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {item.serialNumber && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Seri Numarası
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block truncate">
                  {item.serialNumber}
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(item.serialNumber || '');
                  alert('Seri numarası kopyalandı!');
                }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
              >
                Kopyala
              </button>
            </div>
          )}

          {item.trackingCode && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Kargo Takip Kodu
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block truncate">
                  {item.trackingCode}
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(item.trackingCode || '');
                  alert('Kargo takip kodu kopyalandı!');
                }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
              >
                Kopyala
              </button>
            </div>
          )}
        </div>

        {/* Photos Preview Section */}
        {(item.serialNumberPhoto || item.trackingCodePhoto) && (
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Serial Number Photo */}
            {item.serialNumberPhoto ? (
              <div
                onClick={() =>
                  setLightboxData({
                    images: returnPhotos,
                    initialIndex: returnPhotos.indexOf(item.serialNumberPhoto!),
                    title: `${item.companyName} - Seri No Fotoğrafı`,
                  })
                }
                className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 cursor-pointer"
              >
                <img
                  src={item.serialNumberPhoto}
                  alt="Seri No"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-5 h-5" />
                </div>
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white">
                  📷 Seri No
                </span>
              </div>
            ) : (
              <div className="aspect-video rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 text-[11px]">
                Seri No Fotoğrafı Yok
              </div>
            )}

            {/* Tracking Code Photo */}
            {item.trackingCodePhoto ? (
              <div
                onClick={() =>
                  setLightboxData({
                    images: returnPhotos,
                    initialIndex: returnPhotos.indexOf(item.trackingCodePhoto!),
                    title: `${item.companyName} - Kargo Takip Fişi`,
                  })
                }
                className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 cursor-pointer"
              >
                <img
                  src={item.trackingCodePhoto}
                  alt="Kargo Takip Fişi"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-5 h-5" />
                </div>
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white">
                  📦 Kargo Fişi
                </span>
              </div>
            ) : (
              <div className="aspect-video rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 text-[11px]">
                Kargo Fişi Yok
              </div>
            )}
          </div>
        )}

        {/* Optional Notes */}
        {item.notes && (
          <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
            {item.notes}
          </p>
        )}

        {/* Süreç Takip / 7 Gün Sonu Aşama Açıklaması */}
        {item.followUpNote ? (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-900/60 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-wider">
                  Süreç Takip Açıklaması
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFollowUpInput(item.followUpNote || '');
                  setIsEditingFollowUp(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 text-[10px] font-extrabold transition-colors inline-flex items-center gap-1 cursor-pointer"
                title="Takip açıklamasını güncelle"
              >
                <Edit3 className="w-3 h-3" />
                <span>Güncelle</span>
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white/90 dark:bg-slate-900/70 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/40 whitespace-pre-wrap leading-relaxed">
              {item.followUpNote}
            </p>

            {(item.followUpByName || formattedFollowUpDate) && (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800/80 dark:text-amber-400/80">
                {item.followUpByName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{item.followUpByName}</span>
                  </span>
                )}
                {item.followUpByName && formattedFollowUpDate && <span>•</span>}
                {formattedFollowUpDate && <span>{formattedFollowUpDate}</span>}
              </div>
            )}
          </div>
        ) : (
          !isCompleted && (
            <button
              type="button"
              onClick={() => {
                setFollowUpInput('');
                setIsEditingFollowUp(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-bold transition-all cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>+ 7 Gün Sonu Aşama Açıklaması Ekle</span>
            </button>
          )
        )}

        {/* Prominent Action Button: Ürün Döndü / İşlemi Tamamla */}
        <div className="pt-1">
          {!isCompleted ? (
            <button
              type="button"
              onClick={onToggleStatus}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-[0.99] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>✅ Ürün Döndü / İşlemi Tamamla</span>
            </button>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
              <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Ürün Döndü {item.completedByName ? `(${item.completedByName})` : '(İşlem Tamamlandı)'}</span>
              </span>
              <button
                type="button"
                onClick={onToggleStatus}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
              >
                Geri Al
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for Fullscreen Photo View */}
      {lightboxData && (
        <Lightbox
          images={lightboxData.images}
          initialIndex={lightboxData.initialIndex}
          title={lightboxData.title}
          onClose={() => setLightboxData(null)}
        />
      )}

      {/* Quick Follow-up Modal */}
      {isEditingFollowUp && (
        <Modal
          isOpen={isEditingFollowUp}
          onClose={() => setIsEditingFollowUp(false)}
          title="Süreç Takip / Aşama Açıklaması"
        >
          <form onSubmit={handleSaveFollowUp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {item.companyName}
                </label>
                {item.cariName && (
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {item.cariName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                7 gün sonunda veya süreç takibinde firmanın/servisin verdiği son durumu ve aşama bilgisini girin:
              </p>
              <textarea
                rows={4}
                required
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                placeholder="Örn: Servisle görüşüldü, anakart onarımı bekleniyor. Haftaya salı kargoya verilecek..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingFollowUp(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={isSavingFollowUp}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold shadow-md disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSavingFollowUp ? 'Kaydediliyor...' : 'Açıklamayı Kaydet'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
