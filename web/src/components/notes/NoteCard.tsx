import React from 'react';
import { Edit3, Trash2, Bell, BellRing, User, Users, Lock, Mail } from 'lucide-react';
import { GeneralNote } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';

interface NoteCardProps {
  note: GeneralNote;
  onEdit: () => void;
  onDelete: () => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onEdit, onDelete }) => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isCreatedByMe = note.createdBy === currentUser?.id;
  const isDirectToMe = note.targetUserId === currentUser?.id && !isCreatedByMe;

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

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 shadow-xs border mb-3 space-y-3 transition-all ${
        isDirectToMe
          ? 'bg-blue-50/40 dark:bg-blue-950/25 border-blue-200 dark:border-blue-800/80 ring-1 ring-blue-500/20'
          : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80'
      }`}
    >
      {/* Header & Badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
            <span>{formattedCreated}</span>
            {isAdmin && note.createdByName && (
              <>
                <span>•</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {note.createdByName}
                </span>
              </>
            )}
          </div>

          {/* Visibility / Sharing Badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {isDirectToMe && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Mail className="w-3 h-3" />
                <span>Yönetici Tarafından Size Gönderildi</span>
              </span>
            )}

            {isAdmin && note.targetUserId && note.targetUserId !== 'self' && note.targetUserId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <User className="w-3 h-3" />
                <span>Kişiye Özel: {note.targetUserName}</span>
              </span>
            )}

            {note.targetUserId === 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <Users className="w-3 h-3" />
                <span>Tüm Personel (Genel)</span>
              </span>
            )}

            {isAdmin && (!note.targetUserId || note.targetUserId === 'self') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                <Lock className="w-3 h-3" />
                <span>Sadece Kendim</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            title="Notu Düzenle / Hatırlatıcıyı Ertele"
            aria-label="Düzenle"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            title="Notu Sil"
            aria-label="Sil"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Note Content */}
      <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
        {note.content}
      </p>

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
    </div>
  );
};
