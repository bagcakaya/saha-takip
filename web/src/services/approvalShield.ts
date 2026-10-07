import { AttendanceRecord, LeaveRequest } from '../types/storage';

export interface ShieldedAttendanceApproval {
  recordId: string;
  status: AttendanceRecord['status'];
  checkInApprovalStatus?: 'pending' | 'approved' | 'rejected';
  checkOutApprovalStatus?: 'pending' | 'approved' | 'rejected';
  checkInApprovedBy?: string;
  checkInApprovedAt?: number;
  checkOutApprovedBy?: string;
  checkOutApprovedAt?: number;
  checkOutTime?: number;
  workDurationMinutes?: number;
  isDeleted?: boolean;
  resolvedAt: number;
}

export interface ShieldedLeaveApproval {
  requestId: string;
  status: LeaveRequest['status'];
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNote?: string;
  resolvedAt: number;
}

const ATTENDANCE_SHIELD_STORAGE_KEY = '@saha_takip_approval_shield_att';
const LEAVE_SHIELD_STORAGE_KEY = '@saha_takip_approval_shield_leave';
const SHIELD_TTL_MS = 5 * 60 * 1000; // 5 dakika boyunca onay/ret kesin korumalıdır

class ApprovalShieldService {
  private attMap = new Map<string, ShieldedAttendanceApproval>();
  private leaveMap = new Map<string, ShieldedLeaveApproval>();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const now = Date.now();
      const rawAtt = localStorage.getItem(ATTENDANCE_SHIELD_STORAGE_KEY);
      if (rawAtt) {
        const parsed = JSON.parse(rawAtt);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: ShieldedAttendanceApproval) => {
            if (item && item.recordId && now - item.resolvedAt < SHIELD_TTL_MS) {
              this.attMap.set(item.recordId, item);
            }
          });
        }
      }

      const rawLeave = localStorage.getItem(LEAVE_SHIELD_STORAGE_KEY);
      if (rawLeave) {
        const parsedLeave = JSON.parse(rawLeave);
        if (Array.isArray(parsedLeave)) {
          parsedLeave.forEach((item: ShieldedLeaveApproval) => {
            if (item && item.requestId && now - item.resolvedAt < SHIELD_TTL_MS) {
              this.leaveMap.set(item.requestId, item);
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }

  private persistToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(ATTENDANCE_SHIELD_STORAGE_KEY, JSON.stringify(Array.from(this.attMap.values())));
      localStorage.setItem(LEAVE_SHIELD_STORAGE_KEY, JSON.stringify(Array.from(this.leaveMap.values())));
    } catch {
      // ignore
    }
  }

  // =================== MESAI ONAYLARI ===================

  recordAttendance(record: AttendanceRecord): void {
    if (!record || !record.id) return;
    const item: ShieldedAttendanceApproval = {
      recordId: record.id,
      status: record.status,
      checkInApprovalStatus: record.checkInApprovalStatus,
      checkOutApprovalStatus: record.checkOutApprovalStatus,
      checkInApprovedBy: record.checkInApprovedBy,
      checkInApprovedAt: record.checkInApprovedAt,
      checkOutApprovedBy: record.checkOutApprovedBy,
      checkOutApprovedAt: record.checkOutApprovedAt,
      checkOutTime: record.checkOutTime,
      workDurationMinutes: record.workDurationMinutes,
      isDeleted: false,
      resolvedAt: Date.now(),
    };
    this.attMap.set(record.id, item);
    this.persistToStorage();
  }

  recordAttendanceDeleted(recordId: string): void {
    if (!recordId) return;
    const item: ShieldedAttendanceApproval = {
      recordId,
      status: 'completed',
      isDeleted: true,
      resolvedAt: Date.now(),
    };
    this.attMap.set(recordId, item);
    this.persistToStorage();
  }

  // Alias for backward compatibility
  record(record: AttendanceRecord): void {
    this.recordAttendance(record);
  }

  isAttendanceResolved(recordId: string): boolean {
    if (!recordId) return false;
    const item = this.attMap.get(recordId);
    if (!item) return false;
    if (Date.now() - item.resolvedAt > SHIELD_TTL_MS) {
      this.attMap.delete(recordId);
      this.persistToStorage();
      return false;
    }
    return true;
  }

  // Alias for backward compatibility
  isResolved(recordId: string): boolean {
    return this.isAttendanceResolved(recordId);
  }

  applyToAttendance(records: AttendanceRecord[]): AttendanceRecord[] {
    if (!records || records.length === 0) return records;
    const now = Date.now();

    return records
      .filter((rec) => {
        if (!rec || !rec.id) return false;
        const shielded = this.attMap.get(rec.id);
        if (shielded && shielded.isDeleted) {
          if (now - shielded.resolvedAt <= SHIELD_TTL_MS) {
            return false;
          }
          this.attMap.delete(rec.id);
        }
        return true;
      })
      .map((rec) => {
        if (!rec || !rec.id) return rec;
        const shielded = this.attMap.get(rec.id);
        if (!shielded) return rec;

        if (now - shielded.resolvedAt > SHIELD_TTL_MS) {
          this.attMap.delete(rec.id);
          return rec;
        }

        // Zırh koruması: Pending veya eski veri gelirse zırhtaki kararı koru
        return {
          ...rec,
          status: shielded.status ?? rec.status,
          checkInApprovalStatus: shielded.checkInApprovalStatus ?? rec.checkInApprovalStatus,
          checkOutApprovalStatus: shielded.checkOutApprovalStatus ?? rec.checkOutApprovalStatus,
          checkInApprovedBy: shielded.checkInApprovedBy ?? rec.checkInApprovedBy,
          checkInApprovedAt: shielded.checkInApprovedAt ?? rec.checkInApprovedAt,
          checkOutApprovedBy: shielded.checkOutApprovedBy ?? rec.checkOutApprovedBy,
          checkOutApprovedAt: shielded.checkOutApprovedAt ?? rec.checkOutApprovedAt,
          checkOutTime: shielded.checkOutTime ?? rec.checkOutTime,
          workDurationMinutes: shielded.workDurationMinutes ?? rec.workDurationMinutes,
        };
      });
  }

  // Alias for backward compatibility
  applyToRecords(records: AttendanceRecord[]): AttendanceRecord[] {
    return this.applyToAttendance(records);
  }

  // =================== İZİN ONAYLARI ===================

  recordLeave(request: LeaveRequest): void {
    if (!request || !request.id) return;
    const item: ShieldedLeaveApproval = {
      requestId: request.id,
      status: request.status,
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      resolvedAt: Date.now(),
    };
    this.leaveMap.set(request.id, item);
    this.persistToStorage();
  }

  isLeaveResolved(requestId: string): boolean {
    if (!requestId) return false;
    const item = this.leaveMap.get(requestId);
    if (!item) return false;
    if (Date.now() - item.resolvedAt > SHIELD_TTL_MS) {
      this.leaveMap.delete(requestId);
      this.persistToStorage();
      return false;
    }
    return true;
  }

  applyToLeaveRequests(requests: LeaveRequest[]): LeaveRequest[] {
    if (!requests || requests.length === 0) return requests;
    const now = Date.now();

    return requests.map((req) => {
      if (!req || !req.id) return req;
      const shielded = this.leaveMap.get(req.id);
      if (!shielded) return req;

      if (now - shielded.resolvedAt > SHIELD_TTL_MS) {
        this.leaveMap.delete(req.id);
        return req;
      }

      return {
        ...req,
        status: shielded.status,
        reviewedBy: shielded.reviewedBy ?? req.reviewedBy,
        reviewedAt: shielded.reviewedAt ?? req.reviewedAt,
        reviewNote: shielded.reviewNote ?? req.reviewNote,
      };
    });
  }
}

export const ApprovalShield = new ApprovalShieldService();
