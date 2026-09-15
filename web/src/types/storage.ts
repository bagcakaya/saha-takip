export type TaskStatus = 'pending' | 'completed' | 'not_present';

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
}

export interface LocationItem {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  photos?: string[]; // base64 / data URLs
  latitude?: number;
  longitude?: number;
  createdAt: number;
  createdBy?: string; // User ID who created this installation
  createdByName?: string; // User name who created this installation
  tasks: Task[];
}

export type NoteTargetMode = 'self' | 'all' | 'custom';
export type NoteStatus = 'pending' | 'pending_approval' | 'approved' | 'rejected';

export interface GeneralNote {
  id: string;
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
}

export interface ServiceItem {
  id: string;
  companyName: string; // Firma / Müşteri Adı
  location?: string;   // Lokasyon / Adres
  latitude?: number;   // Coğrafi Enlem
  longitude?: number;  // Coğrafi Boylam
  workDone: string;    // Yapılan İş / Servis Notu
  date?: string;       // Tarih / Saat (ISO string veya formatlanmış tarih)
  photos?: string[];   // Servis fotoğrafları (base64 / data URLs)
  createdAt: number;
  createdBy?: string;
  createdByName?: string;
}

export interface WorkplaceLocation {
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // default: 10 meters
  updatedAt: number;
  updatedBy?: string;
  updatedByName?: string;
}

export type AttendanceStatus = 'checked_in' | 'completed';

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
  checkOutTime?: number; // timestamp
  checkOutLat?: number;
  checkOutLon?: number;
  checkOutAddress?: string;
  checkOutDistance?: number; // distance in meters from workplace
  status: AttendanceStatus;
  workDurationMinutes?: number;
  notes?: string;
}

export interface BackupData {
  locations: LocationItem[];
  standardTasks: string[];
  notes?: GeneralNote[];
  returnWarrantyItems?: ReturnWarrantyItem[];
  services?: ServiceItem[];
  workplaceLocation?: WorkplaceLocation;
  attendanceRecords?: AttendanceRecord[];
  adminReminders?: AdminReminder[];
  cariler?: string[];
}

export interface CariData {
  updatedAt: string;
  database?: string;
  total: number;
  cariler: string[];
}

