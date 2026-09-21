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
} from 'lucide-react';
import { GeneralNote } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';
import { useStorage } from '../../context/StorageContext';
import { WhatsappService } from '../../services/whatsappService';
import { CompleteNoteModal } from './CompleteNoteModal';
import { RejectNoteModal } from './RejectNoteModal';
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
  const { user: currentUser } = useAuth();
  const { completeNote, approveNote, rejectNote } = useStorage();
  const [isProcessing, setIsProcessing] = useState(false);

  const isAdmin = isUserAdmin(currentUser);
  const isCreatedByMe = note.createdBy === currentUser?.id;

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [lightboxData, setLightboxData] = useState<{
    images: string[];
    initialIndex: number;
    title: string;
  } | null>(null);

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
    if (isDirectToMe) {
      return 'border-blue-200 dark:border-blue-800/80 ring-1 ring-blue-500/20';
    }
    return 'border-slate-200/80 dark:border-slate-700/80';
  };

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 shadow-xs border mb-3 space-y-3 transition-all ${
        isDirectToMe
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

        {/* Top Right Quick Actions (WhatsApp, Edit, Delete) */}
        <div className="flex items-center gap-1 shrink-0">
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

          {canModify ? (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                title="İş Emrini Düzenle / Hatırlatıcıyı Ertele"
                aria-label="Düzenle"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                title="İş Emrini Sil"
                aria-label="Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-400 text-[10px] font-bold">
              <Lock className="w-3 h-3" />
              <span>Kilitli</span>
            </div>
          )}
        </div>
      </div>

      {/* Note Main Content */}
      <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
        {note.content}
      </p>

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
      {note.status === 'approved' && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Onaylayan: {note.approvedByName || 'Yönetici'}</span>
          </div>
          {note.approvedAt && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
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
