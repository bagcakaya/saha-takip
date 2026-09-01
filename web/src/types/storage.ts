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

export interface GeneralNote {
  id: string;
  content: string;
  createdAt: number;
  createdBy?: string; // User ID who created this note
  createdByName?: string; // User name
  targetUserId?: string; // 'self' | 'all' | specific user ID
  targetUserName?: string; // 'Sadece Kendim' | 'Tüm Personel' | specific user name
  reminderActive: boolean;
  reminderDate?: string; // ISO String
  notified?: boolean;
}

export interface BackupData {
  locations: LocationItem[];
  standardTasks: string[];
  notes?: GeneralNote[];
}
