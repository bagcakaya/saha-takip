import React, { useState } from 'react';
import {
  X,
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  Building2,
  ChevronRight,
  Smartphone,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { TabType } from '../layout/Header';
import { NotificationStatusCard } from './NotificationStatusCard';

export interface AppNotification {
  id: string;
  type:
    | 'note_assigned'
    | 'note_pending_approval'
    | 'note_approved'
    | 'note_rejected'
    | 'reminder'
    | 'location_added'
    | 'service_added';
  title: string;
  senderName: string;
  senderRole?: string;
  content: string;
  createdAt: number;
  tab: TabType;
  filter?: string;
}

interface NotificationListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: TabType, filter?: string) => void;
  lastReadTime: number;
  onMarkAllAsRead: () => void;
}

export const NotificationListModal: React.FC<NotificationListModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  lastReadTime,
  onMarkAllAsRead,
}) => {
  const { user } = useAuth();
  const { allNotes, allServices, allLocations } = useStorage();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  if (!isOpen || !user) return null;

  const isAdmin = user.role === 'admin';

  // Build real notification feed based on current user role
  const notifications: AppNotification[] = [];

  if (isAdmin) {
    // 1. Work orders awaiting admin approval
    allNotes.forEach((n) => {
      if (n.status === 'pending_approval') {
        notifications.push({
          id: `approval_${n.id}_${n.completedAt || n.createdAt}`,
          type: 'note_pending_approval',
          title: '📋 İş Emri Onay Bekliyor',
          senderName: n.completedByName || n.createdByName || 'Saha Personeli',
          senderRole: 'Saha Yetkilisi',
          content: `${n.content}${n.completionNote ? ` (Açıklama: ${n.completionNote})` : ''}`,
          createdAt: n.completedAt || n.createdAt,
          tab: 'notes',
          filter: 'pending',
        });
      }
    });

    // 2. Work orders created by other users or shared
    allNotes.forEach((n) => {
      if (n.createdBy !== user.id && n.status !== 'pending_approval') {
        notifications.push({
          id: `note_${n.id}`,
          type: 'note_assigned',
          title: '📋 Yeni İş Emri',
          senderName: n.createdByName || 'Yönetici',
          senderRole: 'Yönetici',
          content: n.content,
          createdAt: n.createdAt,
          tab: 'notes',
          filter: 'all',
        });
      }
    });

    // 3. New services from staff
    allServices.forEach((s) => {
      if (s.createdBy !== user.id) {
        notifications.push({
          id: `service_${s.id}`,
          type: 'service_added',
          title: '🔧 Yeni Servis Kaydı',
          senderName: s.createdByName || 'Saha Personeli',
          senderRole: 'Saha Yetkilisi',
          content: `${s.companyName} - ${s.workDone}`,
          createdAt: s.createdAt,
          tab: 'services',
        });
      }
    });

    // 4. New locations from staff
    allLocations.forEach((loc) => {
      if (loc.createdBy !== user.id) {
        notifications.push({
          id: `loc_${loc.id}`,
          type: 'location_added',
          title: '📍 Yeni Kurulum Kaydı',
          senderName: loc.createdByName || 'Saha Personeli',
          senderRole: 'Saha Yetkilisi',
          content: loc.name,
          createdAt: loc.createdAt,
          tab: 'installations',
        });
      }
    });

    // 5. Active reminders
    allNotes.forEach((n) => {
      if (n.reminderActive && n.reminderDate) {
        notifications.push({
          id: `rem_${n.id}`,
          type: 'reminder',
          title: '⏰ Hatırlatıcı / Alarm',
          senderName: n.createdByName || 'Sistem',
          senderRole: 'Sistem',
          content: n.content,
          createdAt: new Date(n.reminderDate).getTime(),
          tab: 'notes',
          filter: 'reminders',
        });
      }
    });
  } else {
    // STAFF (Saha Yetkilisi) Feed
    // 1. Work orders assigned to this staff
    allNotes.forEach((n) => {
      const isTargetedToMe =
        n.createdBy !== user.id &&
        (n.targetMode === 'all' ||
          n.targetUserId === 'all' ||
          (n.targetMode === 'custom' && Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
          n.targetUserId === user.id);

      if (isTargetedToMe) {
        notifications.push({
          id: `note_${n.id}`,
          type: 'note_assigned',
          title: '📋 Yeni İş Emri İletildi',
          senderName: n.createdByName || 'Yönetici',
          senderRole: 'Yönetici',
          content: n.content,
          createdAt: n.createdAt,
          tab: 'notes',
          filter: 'pending',
        });
      }

      // 2. Approved work orders
      if (
        n.status === 'approved' &&
        (n.completedBy === user.id ||
          (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
          n.targetUserId === user.id)
      ) {
        notifications.push({
          id: `approved_${n.id}_${n.approvedAt || n.createdAt}`,
          type: 'note_approved',
          title: '✅ İş Emriniz Onaylandı',
          senderName: n.approvedByName || 'Yönetici',
          senderRole: 'Yönetici',
          content: n.content,
          createdAt: n.approvedAt || n.createdAt,
          tab: 'notes',
          filter: 'approved',
        });
      }

      // 3. Rejected work orders
      if (
        n.status === 'rejected' &&
        (n.completedBy === user.id ||
          (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
          n.targetUserId === user.id)
      ) {
        notifications.push({
          id: `rejected_${n.id}_${n.rejectedAt || n.createdAt}`,
          type: 'note_rejected',
          title: '❌ İş Emriniz Reddedildi',
          senderName: n.rejectedByName || 'Yönetici',
          senderRole: 'Yönetici',
          content: `${n.content} (Gerekçe: ${n.rejectionReason || 'Eksikler var'})`,
          createdAt: n.rejectedAt || n.createdAt,
          tab: 'notes',
          filter: 'rejected',
        });
      }

      // 4. Active reminders for staff
      if (
        n.reminderActive &&
        n.reminderDate &&
        (n.createdBy === user.id || isTargetedToMe)
      ) {
        notifications.push({
          id: `rem_${n.id}`,
          type: 'reminder',
          title: '⏰ Hatırlatıcı / Alarm',
          senderName: n.createdByName || 'Sistem',
          senderRole: 'Sistem',
          content: n.content,
          createdAt: new Date(n.reminderDate).getTime(),
          tab: 'notes',
          filter: 'reminders',
        });
      }
    });
  }

  // Sort newest first
  notifications.sort((a, b) => b.createdAt - a.createdAt);

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) return 'Az önce';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} dk önce`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} saat önce`;
    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'note_pending_approval':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'note_approved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'note_rejected':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'location_added':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'service_added':
        return <Wrench className="w-4 h-4 text-orange-500" />;
      case 'reminder':
        return <Bell className="w-4 h-4 text-indigo-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleItemClick = (item: AppNotification) => {
    onMarkAllAsRead();
    onClose();
    onNavigate(item.tab, item.filter);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-850 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Gelen Bildirimler
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {notifications.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAdmin ? 'Saha yetkililerinden gelen güncellemeler' : 'Yöneticiden gelen iş emirleri & güncellemeler'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={`p-2 rounded-xl text-xs font-bold transition-all ${
                showDiagnostics
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Cihaz Bağlantı Durumu & Test"
            >
              <Smartphone className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagnostic Card Collapsible Panel */}
        {showDiagnostics && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 animate-in slide-in-from-top-2 duration-200">
            <NotificationStatusCard isEmbedded className="shadow-none border-slate-200 dark:border-slate-700" />
          </div>
        )}

        {/* Notification Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {notifications.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Bell className="w-6 h-6 opacity-40" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Henüz yeni bildirim yok
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Gelen iş emirleri, onaylar ve servis kayıtları burada listelenecektir.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isUnread = item.createdAt > lastReadTime;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-4 flex items-start gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all active:scale-[0.99] group ${
                    isUnread ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                  }`}
                >
                  {/* Category Icon */}
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    {getIcon(item.type)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Header Row: Sender + Relative Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                          {item.senderName}
                        </span>
                        {item.senderRole && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                            {item.senderRole}
                          </span>
                        )}
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                        )}
                      </div>

                      <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <span>{item.title}</span>
                    </div>

                    {/* Content Snippet */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-medium">
                      {item.content}
                    </p>
                  </div>

                  {/* Right Arrow */}
                  <div className="shrink-0 self-center text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Tümünü Okundu Say</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
