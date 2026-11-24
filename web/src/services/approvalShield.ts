import {
  AttendanceRecord,
  LeaveRequest,
  GeneralNote,
  LocationItem,
  ServiceItem,
  ReturnWarrantyItem,
} from '../types/storage';

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
  isOnBreak?: boolean;
  currentBreakStartTime?: number;
  breaks?: AttendanceRecord['breaks'];
  totalBreakMinutes?: number;
  hasBreakShield?: boolean;
  isDeleted?: boolean;
  resolvedAt: number;
}

export interface ShieldedLeaveApproval {
  requestId: string;
  status: LeaveRequest['status'];
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNote?: string;
  fullRequest?: LeaveRequest;
  resolvedAt: number;
}

export interface ShieldedEntityMutation<T> {
  id: string;
  item: T;
  isDeleted?: boolean;
  resolvedAt: number;
}

const ATTENDANCE_SHIELD_STORAGE_KEY = '@saha_takip_approval_shield_att';
const LEAVE_SHIELD_STORAGE_KEY = '@saha_takip_approval_shield_leave';
const NOTE_SHIELD_STORAGE_KEY = '@saha_takip_approval_shield_note';
const LOCATION_SHIELD_STORAGE_KEY = '@saha_takip_approval_shield_loc';
const SERVICE_SHIELD_STORAGE_KEY = '@saha_takip_approval_shield_srv';
const RETURN_SHIELD_STORAGE_KEY = '@saha_takip_approval_shield_ret';
const SHIELD_TTL_MS = 5 * 60 * 1000; // 5 dakika boyunca tüm kayıt, onay, ret ve durum değişiklikleri kesin korumalıdır

function statusRank(status?: string): number {
  switch (status) {
    case 'processed':
      return 4;
    case 'approved':
    case 'rejected':
    case 'delivered':
    case 'cancelled':
    case 'completed':
      return 3;
    case 'pending_approval':
    case 'pending_checkout_approval':
    case 'received':
      return 2;
    case 'checked_in':
    case 'pending_checkin_approval':
    case 'sent':
    case 'pending':
    default:
      return 1;
  }
}

class ApprovalShieldService {
  private attMap = new Map<string, ShieldedAttendanceApproval>();
  private attFullMap = new Map<string, AttendanceRecord>();
  private leaveMap = new Map<string, ShieldedLeaveApproval>();
  private noteMap = new Map<string, ShieldedEntityMutation<GeneralNote>>();
  private locMap = new Map<string, ShieldedEntityMutation<LocationItem>>();
  private srvMap = new Map<string, ShieldedEntityMutation<ServiceItem>>();
  private retMap = new Map<string, ShieldedEntityMutation<ReturnWarrantyItem>>();

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

      const loadEntityMap = <T extends { id: string }>(
        storageKey: string,
        targetMap: Map<string, ShieldedEntityMutation<T>>
      ) => {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry: ShieldedEntityMutation<T>) => {
            if (entry && entry.id && now - entry.resolvedAt < SHIELD_TTL_MS) {
              targetMap.set(entry.id, entry);
            }
          });
        }
      };

      loadEntityMap(NOTE_SHIELD_STORAGE_KEY, this.noteMap);
      loadEntityMap(LOCATION_SHIELD_STORAGE_KEY, this.locMap);
      loadEntityMap(SERVICE_SHIELD_STORAGE_KEY, this.srvMap);
      loadEntityMap(RETURN_SHIELD_STORAGE_KEY, this.retMap);
    } catch {
      // ignore
    }
  }

  private persistToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(ATTENDANCE_SHIELD_STORAGE_KEY, JSON.stringify(Array.from(this.attMap.values())));
      localStorage.setItem(LEAVE_SHIELD_STORAGE_KEY, JSON.stringify(Array.from(this.leaveMap.values())));

      const stripPhotos = <T extends Record<string, any>>(entries: ShieldedEntityMutation<T>[]) =>
        entries.map((e) => {
          if (!e.item) return e;
          const copy: Record<string, any> = { ...e.item };
          delete copy.photos;
          delete copy.completionPhotos;
          delete copy.serialNumberPhoto;
          delete copy.trackingCodePhoto;
          return { ...e, item: copy };
        });

      localStorage.setItem(NOTE_SHIELD_STORAGE_KEY, JSON.stringify(stripPhotos(Array.from(this.noteMap.values()))));
      localStorage.setItem(LOCATION_SHIELD_STORAGE_KEY, JSON.stringify(stripPhotos(Array.from(this.locMap.values()))));
      localStorage.setItem(SERVICE_SHIELD_STORAGE_KEY, JSON.stringify(stripPhotos(Array.from(this.srvMap.values()))));
      localStorage.setItem(RETURN_SHIELD_STORAGE_KEY, JSON.stringify(stripPhotos(Array.from(this.retMap.values()))));
    } catch {
      // ignore
    }
  }

  // =================== MESAI ONAYLARI ===================

  recordAttendance(record: AttendanceRecord): void {
    if (!record || !record.id) return;
    this.attFullMap.set(record.id, { ...record });
    const prev = this.attMap.get(record.id);
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
      isOnBreak: record.isOnBreak ?? prev?.isOnBreak,
      currentBreakStartTime: record.currentBreakStartTime ?? prev?.currentBreakStartTime,
      breaks: record.breaks ?? prev?.breaks,
      totalBreakMinutes: record.totalBreakMinutes ?? prev?.totalBreakMinutes,
      hasBreakShield: prev?.hasBreakShield,
      isDeleted: false,
      resolvedAt: Date.now(),
    };
    this.attMap.set(record.id, item);
    this.persistToStorage();
  }

  recordBreakState(record: AttendanceRecord): void {
    if (!record || !record.id) return;
    const prev = this.attMap.get(record.id);
    const item: ShieldedAttendanceApproval = {
      recordId: record.id,
      status: record.status ?? prev?.status ?? 'checked_in',
      checkInApprovalStatus: record.checkInApprovalStatus ?? prev?.checkInApprovalStatus,
      checkOutApprovalStatus: record.checkOutApprovalStatus ?? prev?.checkOutApprovalStatus,
      checkInApprovedBy: record.checkInApprovedBy ?? prev?.checkInApprovedBy,
      checkInApprovedAt: record.checkInApprovedAt ?? prev?.checkInApprovedAt,
      checkOutApprovedBy: record.checkOutApprovedBy ?? prev?.checkOutApprovedBy,
      checkOutApprovedAt: record.checkOutApprovedAt ?? prev?.checkOutApprovedAt,
      checkOutTime: record.checkOutTime ?? prev?.checkOutTime,
      workDurationMinutes: record.workDurationMinutes ?? prev?.workDurationMinutes,
      isOnBreak: Boolean(record.isOnBreak),
      currentBreakStartTime: record.isOnBreak ? record.currentBreakStartTime : undefined,
      breaks: Array.isArray(record.breaks) ? [...record.breaks] : prev?.breaks,
      totalBreakMinutes: record.totalBreakMinutes ?? prev?.totalBreakMinutes ?? 0,
      hasBreakShield: true,
      isDeleted: false,
      resolvedAt: Date.now(),
    };
    this.attMap.set(record.id, item);
    this.persistToStorage();
  }

  isBreakShielded(recordId: string): boolean {
    if (!recordId) return false;
    const item = this.attMap.get(recordId);
    if (!item || !item.hasBreakShield) return false;
    if (Date.now() - item.resolvedAt > SHIELD_TTL_MS) {
      return false;
    }
    return true;
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
    const safeRecords = Array.isArray(records) ? records : [];
    const now = Date.now();
    const seenIds = new Set<string>();

    const mapped = safeRecords
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
        seenIds.add(rec.id);
        const shielded = this.attMap.get(rec.id);
        if (!shielded) return rec;

        if (now - shielded.resolvedAt > SHIELD_TTL_MS) {
          this.attMap.delete(rec.id);
          return rec;
        }

        // Zırh koruması: Pending veya eski veri gelirse zırhtaki kararı koru
        const result: AttendanceRecord = {
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

        if (shielded.hasBreakShield) {
          if (!shielded.isOnBreak) {
            // Bu cihazda mola sonlandırıldı: Buluttan eski 'isOnBreak: true' gelse bile KESİNLİKLE kapalı tut!
            result.isOnBreak = false;
            result.currentBreakStartTime = undefined;
            result.currentBreakNotificationId = undefined;
            if (Array.isArray(shielded.breaks) && shielded.breaks.length >= (rec.breaks?.length || 0)) {
              result.breaks = shielded.breaks;
              result.totalBreakMinutes = shielded.totalBreakMinutes ?? result.totalBreakMinutes;
            } else if (Array.isArray(result.breaks) && result.breaks.length > 0) {
              result.breaks = result.breaks.map((b) =>
                b.endTime
                  ? b
                  : {
                      ...b,
                      endTime: shielded.resolvedAt,
                      durationMinutes: Math.max(1, Math.round((shielded.resolvedAt - b.startTime) / 60000)),
                    }
              );
              result.totalBreakMinutes = result.breaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
            }
          } else {
            // Bu cihazda mola başlatıldı: Eğer yönetici uzaktan bu molayı kapatmadıysa açık tut
            const shieldedLastBrk = Array.isArray(shielded.breaks) ? shielded.breaks[shielded.breaks.length - 1] : undefined;
            const closedRemotely =
              !rec.isOnBreak &&
              Array.isArray(rec.breaks) &&
              rec.breaks.some(
                (b) =>
                  Boolean(b.endTime && b.endTime > 0) &&
                  ((shieldedLastBrk?.id && b.id === shieldedLastBrk.id) ||
                    (shielded.currentBreakStartTime && Math.abs(b.startTime - shielded.currentBreakStartTime) < 60000))
              );
            if (closedRemotely) {
              // Yönetici uzaktan molayı bitirmiş, zırhı da kapalıya güncelle
              shielded.isOnBreak = false;
              shielded.currentBreakStartTime = undefined;
              shielded.breaks = rec.breaks;
              shielded.totalBreakMinutes = rec.totalBreakMinutes;
              this.persistToStorage();
              result.isOnBreak = false;
              result.currentBreakStartTime = undefined;
              result.currentBreakNotificationId = undefined;
            } else {
              result.isOnBreak = true;
              result.currentBreakStartTime = shielded.currentBreakStartTime ?? rec.currentBreakStartTime;
              if (Array.isArray(shielded.breaks) && shielded.breaks.length >= (rec.breaks?.length || 0)) {
                result.breaks = shielded.breaks;
                result.totalBreakMinutes = shielded.totalBreakMinutes ?? result.totalBreakMinutes;
              }
            }
          }
        }

        return result;
      });

    for (const [id, shielded] of this.attMap.entries()) {
      if (!seenIds.has(id) && !shielded.isDeleted && now - shielded.resolvedAt <= SHIELD_TTL_MS) {
        const fullRec = this.attFullMap.get(id);
        if (fullRec) {
          mapped.unshift({
            ...fullRec,
            status: shielded.status ?? fullRec.status,
            checkOutTime: shielded.checkOutTime ?? fullRec.checkOutTime,
            workDurationMinutes: shielded.workDurationMinutes ?? fullRec.workDurationMinutes,
          });
        }
      }
    }

    return mapped;
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
      fullRequest: { ...request },
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
    const safeList = Array.isArray(requests) ? requests : [];
    const now = Date.now();
    const seenIds = new Set<string>();

    const updated = safeList.map((req) => {
      if (!req || !req.id) return req;
      seenIds.add(req.id);
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

    for (const [id, shielded] of this.leaveMap.entries()) {
      if (!seenIds.has(id) && shielded.fullRequest && now - shielded.resolvedAt <= SHIELD_TTL_MS) {
        updated.unshift(shielded.fullRequest);
      }
    }

    return updated;
  }

  // =================== İŞ EMRİ (NOTE), KURULUM (LOCATION), SERVİS & İADE ZIRHI ===================

  private applyGenericEntityShield<T extends { id: string; status?: string; photos?: string[]; completionPhotos?: string[] }>(
    list: T[],
    map: Map<string, ShieldedEntityMutation<T>>
  ): T[] {
    const safeList = Array.isArray(list) ? list : [];
    const now = Date.now();
    const seenIds = new Set<string>();

    const filteredAndMapped = safeList
      .filter((item) => {
        if (!item || !item.id) return false;
        const shielded = map.get(item.id);
        if (shielded && shielded.isDeleted) {
          if (now - shielded.resolvedAt <= SHIELD_TTL_MS) return false;
          map.delete(item.id);
        }
        return true;
      })
      .map((item) => {
        seenIds.add(item.id);
        const shielded = map.get(item.id);
        if (!shielded || !shielded.item) return item;
        if (now - shielded.resolvedAt > SHIELD_TTL_MS) {
          map.delete(item.id);
          return item;
        }
        const sItem = shielded.item;
        // Eğer sunucudan gelen durum daha ileri bir aşamadaysa (örn: personel pending_approval iken yönetici approved yaptıysa) sunucuyu koru
        if (item.status && sItem.status && statusRank(item.status) > statusRank(sItem.status)) {
          return item;
        }
        return {
          ...item,
          ...sItem,
          photos:
            Array.isArray(sItem.photos) && sItem.photos.length > 0
              ? sItem.photos
              : item.photos || [],
          completionPhotos:
            Array.isArray(sItem.completionPhotos) && sItem.completionPhotos.length > 0
              ? sItem.completionPhotos
              : item.completionPhotos || [],
        };
      });

    // Henüz sunucu yanıtına yansımamış yeni kayıtları listenin başına ekle
    for (const [id, shielded] of map.entries()) {
      if (
        !seenIds.has(id) &&
        !shielded.isDeleted &&
        shielded.item &&
        now - shielded.resolvedAt <= SHIELD_TTL_MS
      ) {
        filteredAndMapped.unshift(shielded.item);
      }
    }

    return filteredAndMapped;
  }

  recordNote(note: GeneralNote): void {
    if (!note || !note.id) return;
    this.noteMap.set(note.id, { id: note.id, item: { ...note }, isDeleted: false, resolvedAt: Date.now() });
    this.persistToStorage();
  }

  recordNoteDeleted(id: string): void {
    if (!id) return;
    this.noteMap.set(id, { id, item: { id } as GeneralNote, isDeleted: true, resolvedAt: Date.now() });
    this.persistToStorage();
  }

  applyToNotes(notes: GeneralNote[]): GeneralNote[] {
    return this.applyGenericEntityShield(notes, this.noteMap);
  }

  recordLocation(loc: LocationItem): void {
    if (!loc || !loc.id) return;
    this.locMap.set(loc.id, { id: loc.id, item: { ...loc }, isDeleted: false, resolvedAt: Date.now() });
    this.persistToStorage();
  }

  recordLocationDeleted(id: string): void {
    if (!id) return;
    this.locMap.set(id, { id, item: { id } as LocationItem, isDeleted: true, resolvedAt: Date.now() });
    this.persistToStorage();
  }

  applyToLocations(locs: LocationItem[]): LocationItem[] {
    return this.applyGenericEntityShield(locs, this.locMap);
  }

  recordService(srv: ServiceItem): void {
    if (!srv || !srv.id) return;
    this.srvMap.set(srv.id, { id: srv.id, item: { ...srv }, isDeleted: false, resolvedAt: Date.now() });
    this.persistToStorage();
  }

  recordServiceDeleted(id: string): void {
    if (!id) return;
    this.srvMap.set(id, { id, item: { id } as ServiceItem, isDeleted: true, resolvedAt: Date.now() });
    this.persistToStorage();
  }

  applyToServices(srvs: ServiceItem[]): ServiceItem[] {
    return this.applyGenericEntityShield(srvs, this.srvMap);
  }

  recordReturnWarranty(ret: ReturnWarrantyItem): void {
    if (!ret || !ret.id) return;
    this.retMap.set(ret.id, { id: ret.id, item: { ...ret }, isDeleted: false, resolvedAt: Date.now() });
    this.persistToStorage();
  }

  recordReturnWarrantyDeleted(id: string): void {
    if (!id) return;
    this.retMap.set(id, { id, item: { id } as ReturnWarrantyItem, isDeleted: true, resolvedAt: Date.now() });
    this.persistToStorage();
  }

  applyToReturnWarranty(items: ReturnWarrantyItem[]): ReturnWarrantyItem[] {
    return this.applyGenericEntityShield(items as any, this.retMap as any) as ReturnWarrantyItem[];
  }
}

export const ApprovalShield = new ApprovalShieldService();
