import React, { useState } from 'react';
import {
  Edit3,
  Trash2,
  Bell,
  BellRing,
  User,
  Users,
  Lock,
  Mail,
  MessageCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Check,
  X,
  RotateCcw,
  Building2,
  Loader2,
  Package,
} from 'lucide-react';
import { GeneralNote } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';
import { useStorage } from '../../context/StorageContext';
import { WhatsappService } from '../../services/whatsappService';
import { CompleteNoteModal } from './CompleteNoteModal';
import { RejectNoteModal } from './RejectNoteModal';
import { UsedMaterialsModal } from './UsedMaterialsModal';
import { ImageLightboxModal } from '../common/ImageLightboxModal';

interface NoteCardProps {
  note: GeneralNote;
  onEdit: () => void;
  onDelete: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onEdit,
  onDelete,
  selectionMode,
  isSelected,
  onToggleSelect,
}) => {
  const { user: currentUser, users } = useAuth();
  const { completeNote, approveNote, rejectNote, processNote, unprocessNote, markNoteAsRead } = useStorage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [showReadList, setShowReadList] = useState(false);
  const [localHasRead, setLocalHasRead] = useState(false);

  const isAdmin = isUserAdmin(currentUser);
  const isCreatedByMe = note.createdBy === currentUser?.id;
  const hasRead = Boolean((currentUser?.id && note.readBy?.includes(currentUser.id)) || localHasRead);

  // Resolve user names who read this work order
  const readUserIds = Array.from(
    new Set([...(note.readBy || []), ...(localHasRead && currentUser?.id ? [currentUser.id] : [])])
  );
  const readUserNames = readUserIds
    .map((uid) => users.find((u) => u.id === uid)?.name || (uid === currentUser?.id ? currentUser?.name : 'Personel'))
    .filter(Boolean);

  const handleMarkAsRead = async () => {
    if (isMarkingRead || !note.id) return;
    setLocalHasRead(true);
    setIsMarkingRead(true);
    try {
      await markNoteAsRead(note.id);
    } catch (err) {
      console.error('Mark note as read error:', err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const handleToggleProcess = async () => {
    if (!isAdmin || isProcessing) return;
    setIsProcessing(true);
    try {
      if (note.status === 'processed') {
        if (
          window.confirm(
            'Bu iş emrini "Sisteme İşlenenler" kısmından çıkarıp tekrar "Onaylananlar" kısmına almak istediğinize emin misiniz?'
          )
        ) {
          await unprocessNote(note.id);
        }
      } else {
        await processNote(note.id);
      }
    } catch (err) {
      console.error('Process note error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isMaterialsModalOpen, setIsMaterialsModalOpen] = useState(false);
  const [lightboxData, setLightboxData] = useState<{
    images: string[];
    initialIndex: number;
    title: string;
  } | null>(null);

  // Kullanılan malzemeler kontrolü ve yönetici / personel görünürlük kuralı
  const hasMaterials = Boolean(note.usedMaterials && note.usedMaterials.trim().length > 0);
  const showMaterialsBtn = !isAdmin || hasMaterials;

  // Only the creator or an Admin can edit or delete a note
  const canModify = isAdmin || isCreatedByMe;

  const isDirectToMe =
    !isCreatedByMe &&
    ((note.targetMode === 'custom' &&
      Array.isArray(note.targetUserIds) &&
      note.targetUserIds.includes(currentUser?.id || '')) ||
      note.targetUserId === currentUser?.id);

  const isReminderPast = note.reminderDate
    ? new Date(note.reminderDate).getTime() < Date.now()
    : false;

  const formattedCreated = new Date(note.createdAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedReminder = note.reminderDate
    ? new Date(note.reminderDate).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const handleApprove = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await approveNote(note.id);
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine target description for admin
  const isCustomTarget =
    note.targetMode === 'custom' ||
    (note.targetUserId && note.targetUserId !== 'self' && note.targetUserId !== 'all');

  const targetCount = note.targetUserNames?.length || (note.targetUserId ? 1 : 0);
  const targetNamesText =
    note.targetUserNames && note.targetUserNames.length > 0
      ? note.targetUserNames.join(', ')
      : note.targetUserName || 'Seçilen Kişiler';

  const isAllTarget = note.targetMode === 'all' || note.targetUserId === 'all';
  const isSelfTarget =
    (!note.targetMode && !note.targetUserId) ||
    note.targetMode === 'self' ||
    note.targetUserId === 'self';

  // Card border highlight based on status
  // Tamamlanmayan işler için yaşlandırma / renk dönüşümü (Yeşil \ Sarı \ Turuncu \ Kırmızı)
  const isCompleted = note.status === 'approved' || note.status === 'processed';
  const agingInfo = React.useMemo(() => {
    if (isCompleted) return null;

    const now = Date.now();
    const createdTime = Number(note.createdAt) || now;
    const diffMs = Math.max(0, now - createdTime);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    // Yeşil (0-1 Gün) -> Sarı (2-3 Gün) -> Turuncu (4-6 Gün) -> Kırmızı (7+ Gün)
    if (diffDays <= 1) {
      return {
        stage: 'green' as const,
        days: diffDays,
        hours: diffHours,
        label: diffDays === 0 ? 'Bugün Açıldı' : '1. Gün (Yeni)',
        subLabel: 'Yeşil Aşama: Taze İş Emri',
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        dotColor: 'bg-emerald-500',
        borderLeft: 'border-l-[5px] border-l-emerald-500',
        cardBorder: 'border-emerald-200/80 dark:border-emerald-900/60',
        cardBg: isDirectToMe ? 'bg-emerald-50/20 dark:bg-emerald-950/20' : 'bg-gradient-to-r from-emerald-500/[0.04] to-transparent',
        ringClass: 'ring-1 ring-emerald-500/20',
      };
    } else if (diffDays <= 3) {
      return {
        stage: 'yellow' as const,
        days: diffDays,
        hours: diffHours,
        label: `${diffDays}. Gün (Bekliyor)`,
        subLabel: 'Sarı Aşama: Bekleyen İş Emri',
        badgeBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        dotColor: 'bg-amber-400',
        borderLeft: 'border-l-[5px] border-l-amber-400',
        cardBorder: 'border-amber-300/80 dark:border-amber-800/80',
        cardBg: isDirectToMe ? 'bg-amber-50/25 dark:bg-amber-950/25' : 'bg-gradient-to-r from-amber-500/[0.05] to-transparent',
        ringClass: 'ring-1 ring-amber-500/25',
      };
    } else if (diffDays <= 6) {
      return {
        stage: 'orange' as const,
        days: diffDays,
        hours: diffHours,
        label: `${diffDays}. Gün (Gecikiyor)`,
        subLabel: 'Turuncu Aşama: Geciken İş Emri',
        badgeBg: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800',
        dotColor: 'bg-orange-500',
        borderLeft: 'border-l-[5px] border-l-orange-500',
        cardBorder: 'border-orange-300/90 dark:border-orange-800/90',
        cardBg: isDirectToMe ? 'bg-orange-50/30 dark:bg-orange-950/30' : 'bg-gradient-to-r from-orange-500/[0.07] to-transparent',
        ringClass: 'ring-1 ring-orange-500/30',
      };
    } else {
      return {
        stage: 'red' as const,
        days: diffDays,
        hours: diffHours,
        label: `${diffDays}. Gün (Kritik)`,
        subLabel: 'Kırmızı Aşama: Kritik Gecikme!',
        badgeBg: 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse',
        dotColor: 'bg-rose-600',
        borderLeft: 'border-l-[5px] border-l-rose-600',
        cardBorder: 'border-rose-400 dark:border-rose-700',
        cardBg: isDirectToMe ? 'bg-rose-50/40 dark:bg-rose-950/35' : 'bg-gradient-to-r from-rose-500/[0.09] to-transparent',
        ringClass: 'ring-1 ring-rose-500/35',
      };
    }
  }, [note.createdAt, isCompleted, isDirectToMe]);

  const cardBorderClass = () => {
    if (note.status === 'approved') {
      return 'border-emerald-300/80 dark:border-emerald-800/80 ring-1 ring-emerald-500/20';
    }
    if (note.status === 'pending_approval') {
      return 'border-amber-300/80 dark:border-amber-800/80 ring-1 ring-amber-500/20';
    }
    if (note.status === 'rejected') {
      return 'border-rose-300/80 dark:border-rose-800/80 ring-1 ring-rose-500/20';
    }
    if (agingInfo) {
      return `${agingInfo.cardBorder} ${agingInfo.borderLeft} ${agingInfo.ringClass}`;
    }
    if (isDirectToMe) {
      return 'border-blue-200 dark:border-blue-800/80 ring-1 ring-blue-500/20';
    }
    return 'border-slate-200/80 dark:border-slate-700/80';
  };

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 shadow-xs border mb-3 space-y-3 transition-all ${
        agingInfo
          ? `${agingInfo.cardBg} bg-white dark:bg-slate-800`
          : isDirectToMe
          ? 'bg-blue-50/40 dark:bg-blue-950/25'
          : 'bg-white dark:bg-slate-800'
      } ${cardBorderClass()}`}
    >
      {/* Cari Banner at the very top */}
      {note.cariName && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-xs">
          <Building2 className="w-4 h-4 text-blue-200 shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
              Cari
            </span>
            <span className="text-xs sm:text-sm font-black truncate">
              {note.cariName}
            </span>
          </div>
        </div>
      )}

      {/* Header & Badges */}
      <div className="flex items-start justify-between gap-2">
        {selectionMode && onToggleSelect && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="cursor-pointer mr-1 mt-0.5 shrink-0"
            title={isSelected ? 'Seçimi Kaldır' : 'Seç'}
          >
            <div
              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-400'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
        )}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 flex-wrap">
            <span>{formattedCreated}</span>
            {note.createdByName && (
              <>
                <span>•</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {note.createdByName}
                </span>
              </>
            )}
          </div>

          {/* Status & Visibility Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status Badge */}
            {note.status === 'processed' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                <span className="text-xs">🆗</span>
                <span>Sisteme İşlendi</span>
              </span>
            )}

            {note.status === 'approved' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Onaylandı</span>
              </span>
            )}

            {note.status === 'pending_approval' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Onay Bekliyor</span>
              </span>
            )}

            {note.status === 'rejected' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Reddedildi</span>
              </span>
            )}

            {(!note.status || note.status === 'pending') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Beklemede</span>
              </span>
            )}

            {/* Aging Indicator Badge (Yeşil \ Sarı \ Turuncu \ Kırmızı) for uncompleted work orders */}
            {agingInfo && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black border shadow-2xs ${agingInfo.badgeBg}`}
                title={`İş Emri Yaşı: ${agingInfo.days} gün (${agingInfo.hours} saat). ${agingInfo.subLabel}`}
              >
                <span className={`w-2 h-2 rounded-full ${agingInfo.dotColor} ${agingInfo.stage === 'red' ? 'animate-ping' : ''}`} />
                <span>{agingInfo.label}</span>
              </span>
            )}

            {/* Visibility Badge */}
            {isDirectToMe && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Mail className="w-3 h-3" />
                <span>Size Atandı</span>
              </span>
            )}

            {isAdmin && isCustomTarget && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                title={targetNamesText}
              >
                <Users className="w-3 h-3" />
                <span>
                  {targetCount > 1
                    ? `Seçilen Kişiler (${targetCount} Kişi: ${targetNamesText})`
                    : `Kişiye Özel: ${targetNamesText}`}
                </span>
              </span>
            )}

            {isAllTarget && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <Users className="w-3 h-3" />
                <span>Tüm Personel</span>
              </span>
            )}

            {isAdmin && isSelfTarget && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                <Lock className="w-3 h-3" />
                <span>Sadece Kendim</span>
              </span>
            )}
          </div>
        </div>

        {/* Top Right Quick Actions (🆗 Sisteme İşle / WhatsApp, Edit, Delete) */}
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (note.status === 'approved' || note.status === 'processed') ? (
            <button
              type="button"
              onClick={handleToggleProcess}
              disabled={isProcessing}
              className={`p-1.5 rounded-lg text-xs font-black transition-all active:scale-90 cursor-pointer flex items-center justify-center border shadow-xs ${
                note.status === 'processed'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border-emerald-300 dark:border-emerald-800'
              }`}
              title={
                note.status === 'processed'
                  ? 'Sisteme İşlendi (Tekrar tıklayarak Onaylananlar kısmına geri alabilirsiniz)'
                  : 'Sisteme İşlendi Olarak Kaydet (Onaylananlar kısmından kaldırıp Sisteme İşlenenler\'e taşır)'
              }
              aria-label="Sisteme İşle"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin text-current" />
              ) : (
                <span className="text-sm leading-none font-bold select-none">🆗</span>
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                WhatsappService.shareNote({
                  content: note.content,
                  senderName: note.createdByName || 'Yetkili',
                  targetUserName: note.targetUserName,
                });
              }}
              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
              title="WhatsApp ile İlet / Paylaş"
              aria-label="WhatsApp ile Paylaş"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}

          {canModify && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              title="İş Emrini Düzenle / Hatırlatıcıyı Ertele"
              aria-label="Düzenle"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            title="İş Emrini Sil"
            aria-label="Sil"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Note Main Content & Kullanılan Malzemeler Button */}
      <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
        <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap flex-1 min-w-0">
          {note.content}
        </p>

        {showMaterialsBtn && (
          <button
            type="button"
            onClick={() => setIsMaterialsModalOpen(true)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer ${
              hasMaterials
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
            }`}
            title={hasMaterials ? 'Kullanılan Malzemeleri Görüntüle / Düzenle' : 'Kullanılan Malzemeleri Ekle'}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Kullanılan Malzemeler</span>
          </button>
        )}
      </div>

      {/* Attached Job Order Photos */}
      {note.photos && note.photos.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
            İş Emri Fotoğrafları ({note.photos.length})
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {note.photos.map((photo, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() =>
                  setLightboxData({
                    images: note.photos!,
                    initialIndex: pIdx,
                    title: `${note.cariName || 'İş Emri'} - Fotoğraflar`,
                  })
                }
                className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group/img cursor-pointer hover:opacity-90 transition-all shadow-xs"
              >
                <img
                  src={photo}
                  alt={`İş Emri Fotoğrafı ${pIdx + 1}`}
                  className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reminder Badge */}
      {note.reminderActive && note.reminderDate && (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
            isReminderPast
              ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 animate-pulse'
          }`}
        >
          {isReminderPast ? (
            <Bell className="w-3.5 h-3.5" />
          ) : (
            <BellRing className="w-3.5 h-3.5" />
          )}
          <span>
            {isReminderPast ? 'Hatırlatıldı: ' : 'Hatırlatıcı: '}
            {formattedReminder}
          </span>
        </div>
      )}

      {/* Personnel Completion Details Box */}
      {(note.completedByName || note.completionNote || (note.completionPhotos && note.completionPhotos.length > 0)) && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>Tamamlayan: {note.completedByName || 'Saha Personeli'}</span>
            </div>
            {note.completedAt && (
              <span className="text-[11px] text-slate-400">
                {new Date(note.completedAt).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          {note.completionNote && (
            <div className="text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-bold text-slate-900 dark:text-slate-100">Personel Açıklaması: </span>
              {note.completionNote}
            </div>
          )}
          {/* Completion Proof Photos */}
          {note.completionPhotos && note.completionPhotos.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Tamamlama / Kanıt Fotoğrafları ({note.completionPhotos.length})
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {note.completionPhotos.map((photo, cIdx) => (
                  <button
                    key={cIdx}
                    type="button"
                    onClick={() =>
                      setLightboxData({
                        images: note.completionPhotos!,
                        initialIndex: cIdx,
                        title: `${note.cariName || 'İş Emri'} - Tamamlama Fotoğrafları`,
                      })
                    }
                    className="relative aspect-square rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800 group/cimg cursor-pointer hover:opacity-90 transition-all shadow-xs"
                  >
                    <img
                      src={photo}
                      alt={`Tamamlama Kanıtı ${cIdx + 1}`}
                      className="w-full h-full object-cover group-hover/cimg:scale-105 transition-transform"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approved Details Box */}
      {(note.status === 'approved' || note.status === 'processed') && note.approvedByName && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Onaylayan: {note.approvedByName || 'Yönetici'}</span>
          </div>
          {note.approvedAt && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              {new Date(note.approvedAt).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      )}

      {/* Sisteme İşlendi Details Box */}
      {note.status === 'processed' && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-sm leading-none">🆗</span>
            <span>Sisteme İşleyen: {note.processedByName || 'Yönetici'}</span>
          </div>
          {note.processedAt && (
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
              {new Date(note.processedAt).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      )}

      {/* Rejection Alert Box */}
      {note.status === 'rejected' && (
        <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 space-y-1.5 text-xs text-rose-800 dark:text-rose-300">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Reddeden: {note.rejectedByName || 'Yönetici'}</span>
            </div>
            {note.rejectedAt && (
              <span className="text-[11px] text-rose-500 dark:text-rose-400">
                {new Date(note.rejectedAt).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          {note.rejectionReason && (
            <div className="font-medium bg-white/90 dark:bg-slate-900/70 p-2.5 rounded-lg border border-rose-200/60 dark:border-rose-900/40 whitespace-pre-wrap">
              <span className="font-bold text-rose-900 dark:text-rose-200">Red Gerekçesi: </span>
              {note.rejectionReason}
            </div>
          )}
        </div>
      )}

      {/* Read Status / Confirmation (Okundu Bilgisi - Görsel-1) */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. Mark as Read Confirmation (If user is not the creator) */}
          {!isCreatedByMe && (
            hasRead ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Okudunuz & Anladınız</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleMarkAsRead}
                disabled={isMarkingRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                {isMarkingRead ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>{isMarkingRead ? 'İşleniyor...' : 'Okudum / Anladım'}</span>
              </button>
            )
          )}

          {/* 2. Admin & Creator View: Who read the work order */}
          {(isAdmin || isCreatedByMe) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReadList(!showReadList)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer shadow-2xs"
              >
                <Users className="w-3.5 h-3.5" />
                <span>
                  {readUserNames.length > 0
                    ? `${readUserNames.length} Personel Okudu`
                    : 'Henüz Okunmadı'}
                </span>
              </button>

              {showReadList && readUserNames.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowReadList(false)}
                  />
                  <div className="absolute left-0 bottom-full mb-2 w-56 p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 space-y-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Okuyan Personeller
                      </span>
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                        {readUserNames.length}
                      </span>
                    </div>
                    <ul className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                      {readUserNames.map((name, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-700/50 font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">{name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Workflow Action Buttons */}
      {/* 1. Admin Actions */}
      {isAdmin ? (
        <>
          {note.status === 'pending_approval' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
              <button
                disabled={isProcessing}
                onClick={handleApprove}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{isProcessing ? 'Onaylanıyor...' : 'Onayla'}</span>
              </button>
              <button
                disabled={isProcessing}
                onClick={() => setIsRejectModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-95 disabled:opacity-60 font-extrabold text-xs transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Reddet</span>
              </button>
            </div>
          )}

          {note.status === 'rejected' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end">
              <button
                disabled={isProcessing}
                onClick={handleApprove}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-60 font-bold text-xs transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{isProcessing ? 'Onaylanıyor...' : 'Yine de Onayla'}</span>
              </button>
            </div>
          )}
        </>
      ) : (
        /* 2. Field Staff Actions */
        <>
          {(!note.status || note.status === 'pending') && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <button
                onClick={() => setIsCompleteModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>✓ İşi Tamamla (Onaya Gönder)</span>
              </button>
            </div>
          )}

          {note.status === 'rejected' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <button
                onClick={() => setIsCompleteModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>↻ Eksikleri Giderdim / Tekrar Onaya Gönder</span>
              </button>
            </div>
          )}

          {note.status === 'pending_approval' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-center py-1">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 animate-spin" />
                <span>Yöneticinin Onayı Bekleniyor</span>
              </span>
            </div>
          )}

          {note.status === 'approved' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-center py-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Yönetici Tarafından Onaylandı</span>
              </span>
            </div>
          )}
        </>
      )}

      {/* Complete Note Modal */}
      <CompleteNoteModal
        isOpen={isCompleteModalOpen}
        note={note}
        onClose={() => setIsCompleteModalOpen(false)}
        onConfirm={async (completionNote, completionPhotos) => {
          await completeNote(note.id, completionNote, completionPhotos);
        }}
      />

      {/* Reject Note Modal */}
      <RejectNoteModal
        isOpen={isRejectModalOpen}
        note={note}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={async (reason) => {
          await rejectNote(note.id, reason);
        }}
      />

      {/* Used Materials Modal */}
      <UsedMaterialsModal
        isOpen={isMaterialsModalOpen}
        note={note}
        onClose={() => setIsMaterialsModalOpen(false)}
        isAdmin={isAdmin}
      />

      {/* Lightbox Modal for Fullscreen Photo View */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxData)}
        images={lightboxData?.images || []}
        initialIndex={lightboxData?.initialIndex || 0}
        title={lightboxData?.title || 'İş Emri Fotoğrafı'}
        onClose={() => setLightboxData(null)}
      />
    </div>
  );
};
