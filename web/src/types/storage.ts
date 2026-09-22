export type TaskStatus = 'pending' | 'completed' | 'not_present';
export type ApprovalStatus = 'pending' | 'pending_approval' | 'approved' | 'rejected';

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
}

export interface LocationItem {
  id: string;
  name: string;
  cariName?: string; // İlgili Cari / Müşteri Adı (İsteğe bağlı)
  address?: string;
  notes?: string;
  photos?: string[]; // base64 / data URLs
  latitude?: number;
  longitude?: number;
  createdAt: number;
  createdBy?: string; // User ID who created this installation
  createdByName?: string; // User name who created this installation
  tasks: Task[];
  // Approval and Completion workflow
  status?: ApprovalStatus;
  completedAt?: number;
  completedBy?: string;
  completedByName?: string;
  completionNote?: string;
  completionPhotos?: string[];
  approvedAt?: number;
  approvedBy?: string;
  approvedByName?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectionReason?: string;
}

export type NoteTargetMode = 'self' | 'all' | 'custom';
export type NoteStatus = ApprovalStatus;

export interface GeneralNote {
  id: string;
  cariName?: string; // İlgili Cari Adı (Excel / POLATLAR2025)
  content: string;
  createdAt: number;
  createdBy?: string; // User ID who created this note
  createdByName?: string; // User name
  targetMode?: NoteTargetMode; // 'self' | 'all' | 'custom'
  targetUserIds?: string[]; // Array of target user IDs
  targetUserNames?: string[]; // Array of target user names
  targetUserId?: string; // Legacy single user ID / fallback
  targetUserName?: string; // Legacy single user name / fallback
  reminderActive: boolean;
  reminderDate?: string; // ISO String
  notified?: boolean;
  photos?: string[]; // İş emri oluştururken eklenen fotoğraflar
  completionPhotos?: string[]; // İşi tamamlarken personelin eklediği fotoğraflar
  // Approval and Completion workflow
  status?: NoteStatus;
  completedAt?: number;
  completedBy?: string;
  completedByName?: string;
  completionNote?: string; // Personelin işi tamamlarken girdiği açıklama
  approvedAt?: number;
  approvedBy?: string;
  approvedByName?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectionReason?: string; // Yöneticinin reddederken girdiği gerekçe
}

export type AdminReminderCategory = 'general' | 'procedure' | 'rule' | 'urgent';

export interface AdminReminder {
  id: string;
  title: string;
  content: string;
  category?: AdminReminderCategory;
  isPinned?: boolean;
  photos?: string[];
  createdAt: number;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: number;
  readBy?: string[]; // Array of user IDs who acknowledged/read this reminder
}

export type ReturnWarrantyType = 'warranty' | 'return';
export type ReturnWarrantyStatus = 'pending' | 'completed';

export interface ReturnWarrantyItem {
  id: string;
  type: ReturnWarrantyType;
  companyName: string;
  cariName?: string; // İlgili Cari / Müşteri Adı (İsteğe bağlı)
  sentDate: string; // ISO string: YYYY-MM-DDTHH:mm
  serialNumber?: string;
  trackingCode?: string;
  serialNumberPhoto?: string; // base64 / data URL
  trackingCodePhoto?: string; // base64 / data URL
  notes?: string;
  status: ReturnWarrantyStatus;
  reminderDate?: string; // ISO string for 20-day warranty check
  reminderActive: boolean;
  notified?: boolean;
  createdAt: number;
  createdBy?: string;
  createdByName?: string;
  // 7 gün sonu / Süreç Takip Aşama Açıklaması
  followUpNote?: string;
  followUpDate?: string; // ISO string
  followUpByName?: string;
  // Geri Dönüş / Tamamlanma Bilgileri
  completedAt?: number;
  completedBy?: string;
  completedByName?: string;
}

export interface ServiceItem {
  id: string;
  companyName: string; // Firma / Müşteri Adı
  cariName?: string;   // İlgili Cari / Müşteri Adı (İsteğe bağlı)
  location?: string;   // Lokasyon / Adres
  latitude?: number;   // Coğrafi Enlem
  longitude?: number;  // Coğrafi Boylam
  workDone: string;    // Yapılan İş / Servis Notu
  date?: string;       // Tarih / Saat (ISO string veya formatlanmış tarih)
  photos?: string[];   // Servis fotoğrafları (base64 / data URLs)
  createdAt: number;
  createdBy?: string;
  createdByName?: string;
  // Approval and Completion workflow
  status?: ApprovalStatus;
  completedAt?: number;
  completedBy?: string;
  completedByName?: string;
  completionNote?: string;
  completionPhotos?: string[];
  approvedAt?: number;
  approvedBy?: string;
  approvedByName?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectionReason?: string;
}

export interface Branch {
  id: string;
  companyCode: string;
  name: string;               // e.g. "Merkez Şube", "Kadıköy Şubesi", "İkitelli Depo"
  address: string;            // Açık adres
  latitude: number;           // Coğrafi Enlem
  longitude: number;          // Coğrafi Boylam
  radiusMeters: number;       // Varsayılan: 20 metre
  phone?: string;             // Şube telefonu (opsiyonel)
  assignedUserIds: string[];  // Şubeye atanmış personellerin ID listesi
  createdAt: number;
  updatedAt: number;
}

export interface WorkplaceLocation {
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // default: 20 meters
  updatedAt: number;
  updatedBy?: string;
  updatedByName?: string;
}

export type AttendanceStatus =
  | 'checked_in'
  | 'completed'
  | 'pending_checkin_approval'
  | 'pending_checkout_approval'
  | 'on_leave';

export interface BreakItem {
  id: string;
  startTime: number;
  endTime?: number;
  durationMinutes?: number;
  note?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  date: string; // 'YYYY-MM-DD'
  checkInTime: number; // timestamp
  checkInLat?: number;
  checkInLon?: number;
  checkInAddress?: string;
  checkInDistance?: number; // distance in meters from workplace
  checkInOutside?: boolean;
  checkInApprovalStatus?: 'pending' | 'approved' | 'rejected';
  checkInApprovedBy?: string;
  checkInApprovedAt?: number;
  
  // Multi-branch tracking fields
  branchId?: string;
  branchName?: string;
  assignedBranchName?: string;
  isOtherBranch?: boolean; // True if checked in at a different branch than assigned
  
  checkOutTime?: number; // timestamp
  checkOutLat?: number;
  checkOutLon?: number;
  checkOutAddress?: string;
  checkOutDistance?: number; // distance in meters from workplace
  checkOutOutside?: boolean;
  checkOutApprovalStatus?: 'pending' | 'approved' | 'rejected';
  checkOutApprovedBy?: string;
  checkOutApprovedAt?: number;

  status: AttendanceStatus;
  workDurationMinutes?: number;
  approvalNote?: string;
  notes?: string;

  // Mola (Break) Tracking
  breaks?: BreakItem[];
  isOnBreak?: boolean;
  currentBreakStartTime?: number;
  totalBreakMinutes?: number;
}

export interface BackupData {
  locations: LocationItem[];
  standardTasks: string[];
  notes?: GeneralNote[];
  returnWarrantyItems?: ReturnWarrantyItem[];
  services?: ServiceItem[];
  workplaceLocation?: WorkplaceLocation;
  branches?: Branch[];
  attendanceRecords?: AttendanceRecord[];
  adminReminders?: AdminReminder[];
  cariler?: string[];
  leaveRequests?: LeaveRequest[];
  securityLogs?: SecurityLogItem[];
  timedFollowUps?: TimedFollowUp[];
}

export interface CariData {
  updatedAt: string | null;
  database?: string;
  total: number;
  cariler: string[];
}

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  userId: string;
  userName: string;
  userRole: string;
  platform: 'ios' | 'android' | 'desktop';
  isStandalone: boolean;
  pushSubscriptionId: string | null;
  pushStatus: 'connected' | 'pending' | 'denied';
  lastSeen: string;
  createdAt: string;
}

export interface UserDeviceBinding {
  userId: string;
  username: string;
  userName: string;
  boundDeviceId: string;
  boundDeviceName: string;
  boundPlatform: 'ios' | 'android' | 'desktop';
  boundAt: string;
  isLocked: boolean;
}

export type LeaveType = 'hourly' | 'daily';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  leaveType: LeaveType;
  date: string; // 'YYYY-MM-DD' (Tarih veya Başlangıç Tarihi)
  endDate?: string; // 'YYYY-MM-DD' (Günlük izin için bitiş tarihi)
  startTime?: string; // 'HH:mm' (Saatlik izin için başlangıç saati)
  endTime?: string; // 'HH:mm' (Saatlik izin için bitiş saati)
  durationText: string; // Örn: '2 Saat' veya '3 Gün'
  reason: string; // İzin nedeni / mazeret
  status: LeaveStatus;
  requestedAt: number; // timestamp
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNote?: string;
}

export interface SecurityLogItem {
  id: string;
  companyCode: string;
  timestamp: number;
  attemptedUsername: string;
  attemptedName?: string;
  attemptedUserId?: string;
  boundUserId?: string;
  boundUserName?: string;
  deviceId: string;
  deviceName?: string;
  platform?: string;
  message: string;
  status: 'warning' | 'danger';
  read: boolean;
}

export interface TimedFollowUp {
  id: string;
  companyCode: string;
  cariName: string;
  title?: string;
  description: string;
  dueDate: string; // 'YYYY-MM-DDTHH:mm' or ISO string
  status: 'pending' | 'completed' | 'dismissed';
  notified?: boolean; // true when alarm has triggered
  soundAlarm?: boolean; // play sound when due (default true)
  sendPush?: boolean; // hardware push notification via OneSignal (default true)
  createdAt: number;
  createdBy?: string;
  createdByName?: string;
  completedAt?: number;
  completedByName?: string;
  snoozedUntil?: string;
  onesignalNotificationId?: string; // OneSignal cloud scheduled notification id for cancellation
  notifiedMilestones?: string[]; // e.g. ['30d', '15d', '7d', '3d', 'due']
  currentMilestoneLabel?: string; // e.g. '1 Ay Kaldı! (30 Gün)', '15 Gün Kaldı!', '7 Gün Kaldı!', '3 Gün Kaldı!', 'Vadesi Geldi!'
  currentMilestoneKey?: string;
}

