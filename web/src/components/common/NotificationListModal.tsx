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
  ShieldAlert,
  Calendar,
  UserCheck,
  UserX,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';
import { useStorage } from '../../context/StorageContext';
import { TabType } from '../layout/Header';
import { NotificationStatusCard } from './NotificationStatusCard';
import { parseDueDateTime } from '../../utils/dateUtils';

export interface AppNotification {
  id: string;
  type:
    | 'note_assigned'
    | 'note_pending_approval'
    | 'note_approved'
    | 'note_rejected'
    | 'service_pending_approval'
    | 'service_approved'
    | 'service_rejected'
    | 'location_pending_approval'
    | 'location_approved'
    | 'location_rejected'
    | 'reminder'
    | 'location_added'
    | 'service_added'
    | 'leave_requested'
    | 'leave_approved'
    | 'leave_rejected'
    | 'attendance_pending'
    | 'attendance_approved'
    | 'attendance_rejected'
    | 'attendance_checked_in'
    | 'attendance_checked_out'
    | 'security_log'
    | 'return_completed'
    | 'timed_follow_up';
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
  const {
    allNotes,
    allServices,
    allLocations,
    attendanceRecords,
    leaveRequests,
    securityLogs,
    returnWarrantyItems,
    timedFollowUps,
  } = useStorage();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  if (!isOpen || !user) return null;

  const isAdmin = isUserAdmin(user);

  // Build real notification feed based on current user role
  const notifications: AppNotification[] = [];

  if (isAdmin) {
    // 1. Güvenlik & Cihaz Uyuşmazlığı İhlal Logları
    securityLogs.forEach((l) => {
      notifications.push({
        id: `sec_${l.id}`,
        type: 'security_log',
        title: '🚨 Güvenlik & Cihaz İhlali',
        senderName: l.attemptedName || l.attemptedUsername || 'Personel',
        senderRole: 'Güvenlik Uyarısı',
        content: l.message,
        createdAt: l.timestamp,
        tab: 'logs',
      });
    });

    // 2. Personellerin İzin Talepleri (Onay Bekleyen & Yeni)
    leaveRequests.forEach((req) => {
      const isPending = req.status === 'pending';
      notifications.push({
        id: `leave_${req.id}`,
        type: 'leave_requested',
        title: isPending ? '🏖️ Yeni İzin Talebi (Onay Bekliyor)' : '🏖️ İzin Talebi',
        senderName: req.userName,
        senderRole: req.userRole || 'Saha Yetkilisi',
        content: `${req.userName} - ${req.durationText} (${req.date}) ${req.leaveType === 'hourly' ? 'saatlik' : 'günlük'} izin talebi.${req.reason ? ' Mazeret: ' + req.reason : ''}`,
        createdAt: req.requestedAt,
        tab: 'staff_tracking',
        filter: 'leaves',
      });
    });

    // 3. Personellerin Mesai Giriş / Çıkış Bildirimleri & Onay Talepleri
    attendanceRecords.forEach((att) => {
      // Check-in pending approval (outside location)
      if (att.checkInOutside && att.checkInApprovalStatus === 'pending') {
        notifications.push({
          id: `att_cin_pend_${att.id}`,
          type: 'attendance_pending',
          title: '⚠️ Konum Dışı Giriş Onay Bekliyor',
          senderName: att.userName,
          senderRole: att.userRole || 'Saha Yetkilisi',
          content: `${att.userName} iş yeri konumundan uzakta işe giriş onay talebi gönderdi.${att.approvalNote ? ' Not: ' + att.approvalNote : ''}`,
          createdAt: att.checkInTime,
          tab: 'staff_tracking',
          filter: 'attendance',
        });
      }
      // Check-out pending approval (outside location)
      if (att.checkOutOutside && att.checkOutApprovalStatus === 'pending') {
        notifications.push({
          id: `att_cout_pend_${att.id}`,
          type: 'attendance_pending',
          title: '⚠️ Konum Dışı Çıkış Onay Bekliyor',
          senderName: att.userName,
          senderRole: att.userRole || 'Saha Yetkilisi',
          content: `${att.userName} iş yeri konumundan uzakta işten çıkış onay talebi gönderdi.${att.approvalNote ? ' Not: ' + att.approvalNote : ''}`,
          createdAt: att.checkOutTime || att.checkInTime,
          tab: 'staff_tracking',
          filter: 'attendance',
        });
      }
      // Normal mesai girişi
      if (!att.checkInOutside && att.checkInTime) {
        notifications.push({
          id: `att_cin_${att.id}`,
          type: 'attendance_checked_in',
          title: '🟢 Personel Mesaiye Başladı',
          senderName: att.userName,
          senderRole: att.userRole || 'Saha Yetkilisi',
          content: `${att.userName} saat ${new Date(att.checkInTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla iş yerine giriş yaptı.`,
          createdAt: att.checkInTime,
          tab: 'staff_tracking',
          filter: 'attendance',
        });
      }
      // Normal mesai çıkışı
      if (att.checkOutTime && att.status === 'completed' && !att.checkOutOutside) {
        notifications.push({
          id: `att_cout_${att.id}`,
          type: 'attendance_checked_out',
          title: '🔴 Personel Mesaiyi Bitirdi',
          senderName: att.userName,
          senderRole: att.userRole || 'Saha Yetkilisi',
          content: `${att.userName} saat ${new Date(att.checkOutTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla mesaisini tamamladı.`,
          createdAt: att.checkOutTime,
          tab: 'staff_tracking',
          filter: 'attendance',
        });
      }
    });

    // 4. Work orders awaiting admin approval
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

    // 5. Work orders created by other users or shared
    allNotes.forEach((n) => {
      if (n.createdBy !== user.id && n.status !== 'pending_approval') {
        notifications.push({
          id: `note_${n.id}`,
          type: 'note_assigned',
          title: n.cariName ? `📋 [${n.cariName}] İş Emri` : '📋 Yeni İş Emri',
          senderName: n.createdByName || 'Yönetici',
          senderRole: 'Yönetici',
          content: n.cariName ? `[${n.cariName}] ${n.content}` : n.content,
          createdAt: n.createdAt,
          tab: 'notes',
          filter: 'all',
        });
      }
    });

    // 6. Services from staff (newly added)
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

    // 7. Locations from staff (pending approval or newly added)
    allLocations.forEach((loc) => {
      if (loc.status === 'pending_approval') {
        notifications.push({
          id: `loc_pend_${loc.id}_${loc.completedAt || loc.createdAt}`,
          type: 'location_pending_approval',
          title: '📍 Kurulum Onay Bekliyor',
          senderName: loc.completedByName || loc.createdByName || 'Saha Personeli',
          senderRole: 'Saha Yetkilisi',
          content: `${loc.name}${loc.completionNote ? ` (Açıklama: ${loc.completionNote})` : ''}`,
          createdAt: loc.completedAt || loc.createdAt,
          tab: 'installations',
          filter: 'pending_approval',
        });
      } else if (loc.createdBy !== user.id) {
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

    // 8. Active reminders
    allNotes.forEach((n) => {
      if (n.reminderActive && n.reminderDate) {
        notifications.push({
          id: `rem_${n.id}`,
          type: 'reminder',
          title: n.cariName ? `⏰ [${n.cariName}] Hatırlatıcı` : '⏰ Hatırlatıcı / Alarm',
          senderName: n.createdByName || 'Sistem',
          senderRole: 'Sistem',
          content: n.cariName ? `[${n.cariName}] ${n.content}` : n.content,
          createdAt: new Date(n.reminderDate).getTime(),
          tab: 'notes',
          filter: 'reminders',
        });
      }
    });

    // 9. İade / Garanti "Ürün Döndü" Bildirimleri
    returnWarrantyItems.forEach((item) => {
      if (item.status === 'completed' && item.completedAt) {
        const typeLabel = item.type === 'warranty' ? 'Garanti' : 'İade';
        const cariText = item.cariName ? `[${item.cariName}] ` : '';
        const serialText = item.serialNumber ? ` (Seri No: ${item.serialNumber})` : '';
        notifications.push({
          id: `ret_comp_${item.id}_${item.completedAt}`,
          type: 'return_completed',
          title: `📦 ${typeLabel} Ürünü Geri Döndü`,
          senderName: item.completedByName || 'Yetkili',
          senderRole: `${typeLabel} Takibi`,
          content: `${cariText}${item.companyName} firmasına ait ${typeLabel.toLowerCase()} ürünü "Geri Döndü" olarak tamamlandı.${serialText}`,
          createdAt: item.completedAt,
          tab: 'returns',
        });
      }
    });

    // 10. Süreli Takipler (Vakti gelen alarmlar & takip hatırlatmaları)
    timedFollowUps.forEach((tfu) => {
      if (tfu.status === 'pending') {
        const targetDate = parseDueDateTime(tfu.snoozedUntil || tfu.dueDate);
        const targetTime = targetDate ? targetDate.getTime() : NaN;
        if (!isNaN(targetTime)) {
          const isDue = targetTime <= Date.now();
          notifications.push({
            id: `tfu_${tfu.id}_${targetTime}`,
            type: 'timed_follow_up',
            title: isDue ? `⏰ Süreli Takip Vakti: ${tfu.cariName}` : `⏰ Süreli Takip: ${tfu.cariName}`,
            senderName: tfu.createdByName || 'Yönetici',
            senderRole: 'Süreli Takip',
            content: `${tfu.description || 'Cari takip hatırlatması'}${tfu.dueDate ? ` (Vade: ${tfu.dueDate})` : ''}`,
            createdAt: targetTime,
            tab: 'timed_follow_ups',
          });
        }
      }
    });
  } else {
    // STAFF (Saha Yetkilisi) Feed
    // 1. Yöneticinin İzin Talebini Onaylaması / Reddetmesi
    leaveRequests.forEach((req) => {
      if (req.userId === user.id) {
        if (req.status === 'approved') {
          notifications.push({
            id: `leave_app_${req.id}_${req.reviewedAt || req.requestedAt}`,
            type: 'leave_approved',
            title: '✅ İzin Talebiniz Onaylandı',
            senderName: req.reviewedBy || 'Yönetici',
            senderRole: 'Yönetici',
            content: `${req.durationText} süreli (${req.date}) izin talebiniz yönetici tarafından onaylandı.${req.reviewNote ? ` (Not: ${req.reviewNote})` : ''}`,
            createdAt: req.reviewedAt || req.requestedAt,
            tab: 'staff_tracking',
            filter: 'leaves',
          });
        } else if (req.status === 'rejected') {
          notifications.push({
            id: `leave_rej_${req.id}_${req.reviewedAt || req.requestedAt}`,
            type: 'leave_rejected',
            title: '❌ İzin Talebiniz Reddedildi',
            senderName: req.reviewedBy || 'Yönetici',
            senderRole: 'Yönetici',
            content: `${req.durationText} süreli (${req.date}) izin talebiniz yönetici tarafından reddedildi.${req.reviewNote ? ` (Gerekçe: ${req.reviewNote})` : ''}`,
            createdAt: req.reviewedAt || req.requestedAt,
            tab: 'staff_tracking',
            filter: 'leaves',
          });
        }
      }
    });

    // 2. Yöneticinin Mesai Giriş / Çıkışını Onaylaması / Reddetmesi
    attendanceRecords.forEach((att) => {
      if (att.userId === user.id) {
        // İşe Giriş Onayı
        if (att.checkInApprovalStatus === 'approved' && att.checkInOutside) {
          notifications.push({
            id: `att_cin_app_${att.id}_${att.checkInApprovedAt || att.checkInTime}`,
            type: 'attendance_approved',
            title: '✅ Mesai Girişiniz Onaylandı',
            senderName: att.checkInApprovedBy || 'Yönetici',
            senderRole: 'Yönetici',
            content: `${att.date} tarihindeki konum dışı işe giriş talebiniz yönetici tarafından onaylandı.`,
            createdAt: att.checkInApprovedAt || att.checkInTime,
            tab: 'staff_tracking',
            filter: 'attendance',
          });
        }
        // İşe Giriş Reddi
        if (att.checkInApprovalStatus === 'rejected') {
          notifications.push({
            id: `att_cin_rej_${att.id}_${att.checkInTime}`,
            type: 'attendance_rejected',
            title: '❌ Mesai Girişiniz Reddedildi',
            senderName: 'Yönetici',
            senderRole: 'Yönetici',
            content: `${att.date} tarihindeki konum dışı işe giriş talebiniz yönetici tarafından reddedildi.`,
            createdAt: att.checkInTime,
            tab: 'staff_tracking',
            filter: 'attendance',
          });
        }
        // İşten Çıkış Onayı
        if (att.checkOutApprovalStatus === 'approved' && att.checkOutOutside) {
          const durationText = att.workDurationMinutes
            ? `${Math.floor(att.workDurationMinutes / 60)} saat ${att.workDurationMinutes % 60} dakika`
            : '';
          notifications.push({
            id: `att_cout_app_${att.id}_${att.checkOutApprovedAt || att.checkOutTime || att.checkInTime}`,
            type: 'attendance_approved',
            title: '✅ Mesai Çıkışınız Onaylandı',
            senderName: att.checkOutApprovedBy || 'Yönetici',
            senderRole: 'Yönetici',
            content: `${att.date} tarihindeki konum dışı işten çıkış onay talebiniz yönetici tarafından onaylandı.${durationText ? ` (Toplam Mesai: ${durationText})` : ''}`,
            createdAt: att.checkOutApprovedAt || att.checkOutTime || att.checkInTime,
            tab: 'staff_tracking',
            filter: 'attendance',
          });
        }
        // İşten Çıkış Reddi
        if (att.checkOutApprovalStatus === 'rejected') {
          notifications.push({
            id: `att_cout_rej_${att.id}_${att.checkOutTime || att.checkInTime}`,
            type: 'attendance_rejected',
            title: '❌ Mesai Çıkışınız Reddedildi',
            senderName: 'Yönetici',
            senderRole: 'Yönetici',
            content: `${att.date} tarihindeki konum dışı işten çıkış talebiniz yönetici tarafından reddedildi.`,
            createdAt: att.checkOutTime || att.checkInTime,
            tab: 'staff_tracking',
            filter: 'attendance',
          });
        }
      }
    });

    // 3. Work orders assigned to this staff
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
          title: n.cariName ? `📋 [${n.cariName}] İş Emri` : '📋 Yeni İş Emri İletildi',
          senderName: n.createdByName || 'Yönetici',
          senderRole: 'Yönetici',
          content: n.cariName ? `[${n.cariName}] ${n.content}` : n.content,
          createdAt: n.createdAt,
          tab: 'notes',
          filter: 'pending',
        });
      }

      // 4. Approved work orders
      if (
        n.status === 'approved' &&
        (n.completedBy === user.id ||
          (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
          n.targetUserId === user.id)
      ) {
        notifications.push({
          id: `approved_${n.id}_${n.approvedAt || n.createdAt}`,
          type: 'note_approved',
          title: n.cariName ? `✅ [${n.cariName}] İş Emriniz Onaylandı` : '✅ İş Emriniz Onaylandı',
          senderName: n.approvedByName || 'Yönetici',
          senderRole: 'Yönetici',
          content: n.cariName ? `[${n.cariName}] ${n.content}` : n.content,
          createdAt: n.approvedAt || n.createdAt,
          tab: 'notes',
          filter: 'approved',
        });
      }

      // 5. Rejected work orders
      if (
        n.status === 'rejected' &&
        (n.completedBy === user.id ||
          (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(user.id)) ||
          n.targetUserId === user.id)
      ) {
        notifications.push({
          id: `rejected_${n.id}_${n.rejectedAt || n.createdAt}`,
          type: 'note_rejected',
          title: n.cariName ? `❌ [${n.cariName}] İş Emriniz Reddedildi` : '❌ İş Emriniz Reddedildi',
          senderName: n.rejectedByName || 'Yönetici',
          senderRole: 'Yönetici',
          content: `${n.cariName ? `[${n.cariName}] ` : ''}${n.content} (Gerekçe: ${n.rejectionReason || 'Eksikler var'})`,
          createdAt: n.rejectedAt || n.createdAt,
          tab: 'notes',
          filter: 'rejected',
        });
      }

      // 6. Active reminders for staff
      if (
        n.reminderActive &&
        n.reminderDate &&
        (n.createdBy === user.id || isTargetedToMe)
      ) {
        notifications.push({
          id: `rem_${n.id}`,
          type: 'reminder',
          title: n.cariName ? `⏰ [${n.cariName}] Hatırlatıcı` : '⏰ Hatırlatıcı / Alarm',
          senderName: n.createdByName || 'Sistem',
          senderRole: 'Sistem',
          content: n.cariName ? `[${n.cariName}] ${n.content}` : n.content,
          createdAt: new Date(n.reminderDate).getTime(),
          tab: 'notes',
          filter: 'reminders',
        });
      }
    });


    // 8. Approved / Rejected Locations for staff
    allLocations.forEach((loc) => {
      if (loc.completedBy === user.id || loc.createdBy === user.id) {
        if (loc.status === 'approved') {
          notifications.push({
            id: `loc_app_${loc.id}_${loc.approvedAt || loc.createdAt}`,
            type: 'location_approved',
            title: '✅ Kurulumunuz Onaylandı',
            senderName: loc.approvedByName || 'Yönetici',
            senderRole: 'Yönetici',
            content: `"${loc.name}" kurulum kaydınız yönetici tarafından onaylandı.`,
            createdAt: loc.approvedAt || loc.createdAt,
            tab: 'installations',
            filter: 'approved',
          });
        } else if (loc.status === 'rejected') {
          notifications.push({
            id: `loc_rej_${loc.id}_${loc.rejectedAt || loc.createdAt}`,
            type: 'location_rejected',
            title: '❌ Kurulumunuz Reddedildi',
            senderName: loc.rejectedByName || 'Yönetici',
            senderRole: 'Yönetici',
            content: `"${loc.name}" kurulum kaydınız reddedildi. Gerekçe: ${loc.rejectionReason || 'Eksikler var'}`,
            createdAt: loc.rejectedAt || loc.createdAt,
            tab: 'installations',
            filter: 'rejected',
          });
        }
      }
    });

    // 9. İade / Garanti "Ürün Döndü" Bildirimleri (Personelin eklediği veya ilgilendiği ürünler)
    returnWarrantyItems.forEach((item) => {
      if (item.status === 'completed' && item.completedAt && (item.createdBy === user.id || item.completedBy === user.id)) {
        const typeLabel = item.type === 'warranty' ? 'Garanti' : 'İade';
        const cariText = item.cariName ? `[${item.cariName}] ` : '';
        const serialText = item.serialNumber ? ` (Seri No: ${item.serialNumber})` : '';
        notifications.push({
          id: `ret_comp_staff_${item.id}_${item.completedAt}`,
          type: 'return_completed',
          title: `📦 ${typeLabel} Ürünü Geri Döndü`,
          senderName: item.completedByName || 'Yetkili',
          senderRole: `${typeLabel} Takibi`,
          content: `${cariText}${item.companyName} firmasına ait ${typeLabel.toLowerCase()} ürününün işlemi tamamlandı.${serialText}`,
          createdAt: item.completedAt,
          tab: 'returns',
        });
      }
    });
  }

  // Sort newest first
  notifications.sort((a, b) => b.createdAt - a.createdAt);

  const unreadCount = notifications.filter((n) => n.createdAt > lastReadTime).length;

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
      case 'return_completed':
        return <RotateCcw className="w-4 h-4 text-emerald-500" />;
      case 'note_pending_approval':
      case 'service_pending_approval':
      case 'location_pending_approval':
      case 'attendance_pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'note_approved':
      case 'service_approved':
      case 'location_approved':
      case 'leave_approved':
      case 'attendance_approved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'note_rejected':
      case 'service_rejected':
      case 'location_rejected':
      case 'leave_rejected':
      case 'attendance_rejected':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'security_log':
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'leave_requested':
        return <Calendar className="w-4 h-4 text-amber-500" />;
      case 'attendance_checked_in':
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
      case 'attendance_checked_out':
        return <UserX className="w-4 h-4 text-slate-500" />;
      case 'location_added':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'service_added':
        return <Wrench className="w-4 h-4 text-orange-500" />;
      case 'reminder':
        return <Bell className="w-4 h-4 text-indigo-500" />;
      case 'timed_follow_up':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleItemClick = (item: AppNotification) => {
    onMarkAllAsRead();
    onClose();
    if (item.tab === 'staff_tracking' && item.filter) {
      window.dispatchEvent(
        new CustomEvent('saha:set-staff-subtab', { detail: { subTab: item.filter } })
      );
    }
    if (item.tab === 'notes' && item.filter) {
      window.dispatchEvent(
        new CustomEvent('saha:set-notes-filter', { detail: { filter: item.filter } })
      );
    }
    if (item.tab === 'services' && item.filter) {
      window.dispatchEvent(
        new CustomEvent('saha:set-services-filter', { detail: { filter: item.filter } })
      );
    }
    if (item.tab === 'installations' && item.filter) {
      window.dispatchEvent(
        new CustomEvent('saha:set-installations-filter', { detail: { filter: item.filter } })
      );
    }
    onNavigate(item.tab, item.filter);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg md:max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-950 dark:text-slate-100">
                  Gelen Bildirimler
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  unreadCount > 0
                    ? 'bg-blue-600 text-white animate-pulse'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {unreadCount > 0 ? `${unreadCount} Yeni` : `${notifications.length} Bildirim`}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isAdmin ? 'Saha yetkililerinden gelen güncellemeler' : 'Yöneticiden gelen iş emirleri & güncellemeler'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={`p-2 rounded-xl text-xs font-bold transition-all ${
                showDiagnostics
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
              title="Cihaz Bağlantı Durumu & Test"
            >
              <Smartphone className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unified Scrollable Modal Body (Diagnostics + Notifications) */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/80 bg-white dark:bg-slate-900 overscroll-contain">
          {/* Diagnostic Card Collapsible Panel */}
          {showDiagnostics && (
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 animate-in slide-in-from-top-2 duration-200">
              <NotificationStatusCard isEmbedded className="shadow-none border-slate-200 dark:border-slate-700" />
            </div>
          )}
          {notifications.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Bell className="w-6 h-6 opacity-40" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-slate-200">
                Henüz yeni bildirim yok
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-400 max-w-xs mx-auto font-semibold">
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
                  className={`p-4 flex items-start gap-3.5 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 cursor-pointer transition-all active:scale-[0.99] group ${
                    isUnread ? 'bg-blue-50/80 dark:bg-blue-950/40' : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  {/* Category Icon */}
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    {getIcon(item.type)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Header Row: Sender + Relative Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-black text-slate-950 dark:text-slate-100 truncate">
                          {item.senderName}
                        </span>
                        {item.senderRole && (
                          <span className="text-[10px] font-black text-slate-800 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-300/80 dark:border-slate-700">
                            {item.senderRole}
                          </span>
                        )}
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                        )}
                      </div>

                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-400 shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="text-xs font-black text-blue-700 dark:text-blue-400 flex items-center gap-1">
                      <span>{item.title}</span>
                    </div>

                    {/* Content Snippet */}
                    <p className="text-xs text-slate-900 dark:text-slate-200 line-clamp-2 leading-relaxed font-bold">
                      {item.content}
                    </p>
                  </div>

                  {/* Right Arrow */}
                  <div className="shrink-0 self-center text-slate-500 dark:text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all">
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50">
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 stroke-[2.5]" />
            <span>Tümünü Okundu Say</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
