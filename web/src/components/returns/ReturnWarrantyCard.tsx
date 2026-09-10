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
} from 'lucide-react';
import { ReturnWarrantyItem } from '../../types/storage';
import { WhatsappService } from '../../services/whatsappService';
import { Lightbox } from '../common/Lightbox';

interface ReturnWarrantyCardProps {
  item: ReturnWarrantyItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}

export const ReturnWarrantyCard: React.FC<ReturnWarrantyCardProps> = ({
  item,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

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

  // Calculate 20-day warranty countdown
  const getWarrantyCountdown = () => {
    if (!isWarranty || !item.reminderDate) return null;

    if (isCompleted) {
      return {
        type: 'completed',
        text: 'İşlem Tamamlandı',
        badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      };
    }

    const reminderTime = new Date(item.reminderDate).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((reminderTime - now) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return {
        type: 'upcoming',
        text: `20 Gün Süresi: Kalan ${diffDays} Gün`,
        badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      };
    } else if (diffDays === 0) {
      return {
        type: 'due',
        text: '⚠️ 20 Gün Bugün Doldu! (Durumu Sorgulayın)',
        badgeClass: 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 animate-pulse font-extrabold',
      };
    } else {
      return {
        type: 'overdue',
        text: `🚨 20 Gün Aşıldı (${Math.abs(diffDays)} Gün Geçti)`,
        badgeClass: 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 font-extrabold',
      };
    }
  };

  const warrantyCountdown = getWarrantyCountdown();

  return (
    <>
      <div
        className={`rounded-2xl p-4 sm:p-5 shadow-xs border mb-3 space-y-4 transition-all duration-200 ${
          isCompleted
            ? 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800 opacity-85'
            : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 hover:shadow-md'
        }`}
      >
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
                  sentDate: item.sentDate,
                  serialNumber: item.serialNumber,
                  trackingCode: item.trackingCode,
                  notes: item.notes,
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

        {/* 20 Days Warranty Countdown Badge */}
        {warrantyCountdown && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${warrantyCountdown.badgeClass}`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>{warrantyCountdown.text}</span>
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
                onClick={() => setLightboxPhoto(item.serialNumberPhoto!)}
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
                onClick={() => setLightboxPhoto(item.trackingCodePhoto!)}
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
      </div>

      {/* Lightbox for Fullscreen Photo View */}
      {lightboxPhoto && (
        <Lightbox photoUrl={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}
    </>
  );
};
