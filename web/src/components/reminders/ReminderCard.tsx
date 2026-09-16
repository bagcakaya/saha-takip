import React, { useState } from 'react';
import {
  Pin,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ShieldAlert,
  Info,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { AdminReminder, AdminReminderCategory } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';
import { ImageLightboxModal } from '../common/ImageLightboxModal';

interface ReminderCardProps {
  reminder: AdminReminder;
  onEdit: (reminder: AdminReminder) => void;
  onDelete: (id: string) => void;
  onMarkAsRead: (id: string) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onEdit,
  onDelete,
  onMarkAsRead,
}) => {
  const { user, users } = useAuth();
  const isAdmin = isUserAdmin(user);
  const hasRead = Boolean(user?.id && reminder.readBy?.includes(user.id));

  const [lightboxData, setLightboxData] = useState<{
    images: string[];
    initialIndex: number;
    title: string;
  } | null>(null);
  const [showReadList, setShowReadList] = useState(false);

  // Format date
  const dateObj = new Date(reminder.createdAt);
  const formattedDate = dateObj.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const getCategoryBadge = (cat?: AdminReminderCategory) => {
    switch (cat) {
      case 'procedure':
        return {
          label: 'İş Prosedürü',
          icon: BookOpen,
          badgeClass: 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        };
      case 'rule':
        return {
          label: 'Önemli Kural',
          icon: AlertTriangle,
          badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'urgent':
        return {
          label: 'Acil Uyarı',
          icon: ShieldAlert,
          badgeClass: 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
        };
      default:
        return {
          label: 'Genel Bilgi',
          icon: Info,
          badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  const badgeInfo = getCategoryBadge(reminder.category);
  const BadgeIcon = badgeInfo.icon;

  // Resolve user names who read this reminder
  const readUserNames = (reminder.readBy || [])
    .map((uid) => users.find((u) => u.id === uid)?.name || (uid === user?.id ? user?.name : 'Personel'))
    .filter(Boolean);

  return (
    <>
      <div
        className={`relative rounded-3xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between space-y-3.5 group shadow-xs hover:shadow-md ${
          reminder.isPinned
            ? 'bg-gradient-to-br from-amber-500/5 via-white to-amber-500/10 dark:from-amber-950/20 dark:via-slate-900 dark:to-amber-900/20 border-amber-300 dark:border-amber-800/80 ring-1 ring-amber-400/30'
            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
        }`}
      >
        {/* Top Row: Category, Pin & Date */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Category Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${badgeInfo.badgeClass}`}
            >
              <BadgeIcon className="w-3.5 h-3.5" />
              <span>{badgeInfo.label}</span>
            </span>

            {/* Pinned Badge */}
            {reminder.isPinned && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40">
                <Pin className="w-3 h-3 fill-amber-500" />
                <span>Sabitlendi</span>
              </span>
            )}
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formattedDate}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formattedTime}</span>
            </span>
          </div>
        </div>

        {/* Title & Author */}
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
            {reminder.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <User className="w-3 h-3 text-indigo-500" />
            <span>Yayınlayan: <strong className="text-slate-700 dark:text-slate-200">{reminder.createdByName || 'Yönetici'}</strong></span>
          </div>
        </div>

        {/* Content Box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium whitespace-pre-wrap leading-relaxed">
          {reminder.content}
        </div>

        {/* Photos Grid */}
        {reminder.photos && reminder.photos.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Ekli Görseller / Belgeler ({reminder.photos.length})
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {reminder.photos.map((photo, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() =>
                    setLightboxData({
                      images: reminder.photos!,
                      initialIndex: pIdx,
                      title: `${reminder.title} - Ekli Görseller`,
                    })
                  }
                  className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group/img cursor-pointer hover:opacity-90 transition-all shadow-xs"
                >
                  <img
                    src={photo}
                    alt={`Görsel ${pIdx + 1}`}
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Row: Read status & Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
          {/* Read Status / Confirmation */}
          <div className="flex items-center gap-2">
            {!isAdmin ? (
              hasRead ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Okudunuz & Anladınız</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onMarkAsRead(reminder.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Okudum / Anladım</span>
                </button>
              )
            ) : (
              /* Admin view of who read */
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReadList(!showReadList)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    {readUserNames.length > 0
                      ? `${readUserNames.length} Personel Okudu`
                      : 'Henüz Okunmadı'}
                  </span>
                </button>

                {showReadList && readUserNames.length > 0 && (
                  <div className="absolute left-0 bottom-full mb-2 w-56 p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 space-y-1 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                      Okuyan Personeller
                    </span>
                    <ul className="space-y-1">
                      {readUserNames.map((name, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-700/50 font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin Controls: Edit & Delete */}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(reminder)}
                className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                title="Düzenle"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`"${reminder.title}" talimatını silmek istediğinize emin misiniz?`)) {
                    onDelete(reminder.id);
                  }
                }}
                className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                title="Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Fullscreen Photo View */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxData)}
        images={lightboxData?.images || []}
        initialIndex={lightboxData?.initialIndex || 0}
        title={lightboxData?.title || reminder.title}
        onClose={() => setLightboxData(null)}
      />
    </>
  );
};
