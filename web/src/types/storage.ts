export type TaskStatus = 'pending' | 'completed' | 'not_present';
export type ApprovalStatus = 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'processed';

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
  processedAt?: number; // Sisteme işlenme tarihi
  processedBy?: string; // Sisteme işleyen yönetici ID
  processedByName?: string; // Sisteme işleyen yönetici adı
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

export type PersonalNoteColor = 'amber' | 'blue' | 'emerald' | 'purple' | 'rose' | 'slate';

export interface PersonalNote {
  id: string;
  userId: string; // The user who owns this note (Strictly private)
  companyCode: string;
  title: string;
  content: string;
  color?: PersonalNoteColor;
  isPinned?: boolean;
  reminderDate?: string; // YYYY-MM-DD
  reminderTime?: string; // HH:mm
  onesignalNotificationId?: string; // OneSignal cloud scheduled notification id for cancellation
  notified?: boolean;
  createdAt: number;
  updatedAt: number;
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
  maxBreakMinutes?: number;   // Şube için belirlenen günlük maksimum mola süresi (dakika)
  createdAt: number;
  updatedAt: number;
}

export interface ShiftDefinition {
  id: string;
  companyCode: string;
  name: string;                 // Örn: "Sabah Vardiyası (08:30 - 17:30)"
  startTime: string;            // 'HH:mm' e.g. "08:30"
  endTime: string;              // 'HH:mm' e.g. "17:30"
  earlyCheckInMinutes?: number; // Kaç dakika önceden girişe izin verilir? (Varsayılan 30 dk)
  daysOfWeek?: number[];        // 1 = Pazartesi, ..., 7 = Pazar (Varsayılan: [1,2,3,4,5,6])
  color?: string;               // Renk teması: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose' | 'indigo'
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ShiftAssignment {
  id: string;
  companyCode: string;
  userId: string;
  userName: string;
  shiftId: string;
  shiftName: string;
  startTime: string;            // Anlık başlangıç saati
  endTime: string;              // Anlık bitiş saati
  branchId?: string;
  branchName?: string;
  updatedAt: number;
  updatedBy?: string;
}

export interface ShiftDataPayload {
  definitions: ShiftDefinition[];
  assignments: ShiftAssignment[];
}

export interface WorkplaceLocation {
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // default: 20 meters
  maxBreakMinutes?: number; // Günlük maksimum mola süresi (dakika)
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
  scheduledNotificationId?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  companyCode?: string;
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
  currentBreakNotificationId?: string;

  // Vardiya Çıkış Hatırlatıcı Alanları (Shift checkout reminders: +10m staff, +20m admin)
  shiftCheckout10mNotified?: boolean;
  shiftCheckout10mNotifiedAt?: number;
  shiftCheckout10mNotificationId?: string;
  shiftCheckout20mNotified?: boolean;
  shiftCheckout20mNotifiedAt?: number;
  shiftCheckout20mNotificationId?: string;
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
  personalNotes?: PersonalNote[];
  shifts?: ShiftDefinition[];
  shiftAssignments?: ShiftAssignment[];
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
  companyCode?: string;
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
  companyCode?: string;
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

export type JobApplicationStatus =
  | 'new'
  | 'call_scheduled'
  | 'interview_scheduled'
  | 'offer_made'
  | 'hired'
  | 'rejected';

export interface JobApplication {
  id: string;
  companyCode: string;
  fullName: string;
  phone: string;
  address: string;
  education: string;
  appliedPosition: string;
  militaryStatus: string; // 'Yapıldı' | 'Muaf' | 'Tecilli' | 'Muaf / Yok'
  experience: string;
  cvFileName?: string;
  cvFileData?: string; // base64 / data url
  photoData?: string; // base64 image data url
  status: JobApplicationStatus;
  statusNotes?: string;
  interviewDate?: string;
  salaryExpectation?: string;
  createdAt: number;
  updatedAt?: number;
  createdBy?: string;
  createdByName?: string;
  convertedToUserId?: string;
  convertedToUsername?: string;
  convertedAt?: number;
}

// ==========================================
// MAAŞ & BORDRO TAKİBİ VERİ MODELLERİ
// ==========================================

export type SalaryPaymentMethod = 'cash' | 'bank'; // 💵 Elden Nakit | 🏦 Banka (Havale / EFT)
export type SalaryPaymentType = 'salary' | 'advance' | 'bonus' | 'other'; // Maaş | Avans | Prim/İkramiye | Diğer

export interface SalaryPaymentItem {
  id: string;
  amount: number; // Ödenen Tutar (₺)
  paymentMethod: SalaryPaymentMethod; // 'cash' | 'bank'
  paymentType: SalaryPaymentType; // 'salary' | 'advance' | 'bonus' | 'other'
  date: string; // YYYY-MM-DD
  description?: string; // Örn: 'Avans verildi', 'Ekim maaşı'
  receiptUrl?: string; // Dekont / Makbuz görseli veya PDF (base64 / data URL)
  receiptFileName?: string; // Yüklenen dosyanın adı (örn: dekont.pdf)
  receiptFileType?: 'image' | 'pdf'; // Yüklenen dosya türü
  branchId?: string; // Ödemenin yapıldığı şube / kasa
  branchName?: string;
  createdAt: number;
  createdBy?: string;
  createdByName?: string;
}

export interface StaffSalaryMonthRecord {
  id: string; // örn: `${companyCode}_${userId}_${year}_${month}`
  companyCode: string;
  userId: string;
  staffName: string;
  branchId?: string;
  branchName?: string;
  year: number; // örn: 2026
  month: number; // 1 - 12 (1 = Ocak, 12 = Aralık)
  agreedAmount?: number; // İsteğe bağlı o ay için anlaşılan hak ediş tutarı (girilirse kalan hesaplanır)
  notes?: string; // Yönetici notu
  payments: SalaryPaymentItem[]; // O aya ait ödeme hareketleri (parçalı nakit/banka)
  createdAt: number;
  updatedAt: number;
}
