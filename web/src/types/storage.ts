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

export interface BackupData {
  locations: LocationItem[];
  standardTasks: string[];
  notes?: GeneralNote[];
  returnWarrantyItems?: ReturnWarrantyItem[];
}
