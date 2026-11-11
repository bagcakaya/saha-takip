/**
 * Saha Takip Sistemi - 7/24 Otonom Vardiya Giriş (+15dk) & Çıkış (+5dk / +10dk) Bekçisi
 *
 * Hiçbir tarayıcı veya telefon uygulaması açık olmasa bile Windows Server üzerinde 20 saniyede bir çalışarak:
 * 1. Vardiyası başladıktan 15 dakika sonra hala işe giriş yapmamış (ve onaylı izni olmayan) personele
 *    canlı veritabanı doğrulamasıyla tek seferlik giriş hatırlatma bildirimi gönderir.
 * 2. Vardiyası bittikten +5 dk ve +10 dk sonra hala çıkış yapmamış (ve onaylı izni olmayan) personele
 *    çıkış hatırlatma / uyarı bildirimlerini gönderir.
 * 3. Supabase + Yerel MSSQL Slot 23 (23001 / 23002) ortak tekilleştirme kaydı ve vardiya saat anahtarı
 *    (cleanStartKey / cleanEndKey) sayesinde web/mobil istemcilerle %100 uyumlu çalışır,
 *    mükerrer bildirim göndermez ve yöneticiye ASLA gecikme bildirimi göndermez.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';

let isWatchdogRunning = false;

function normalizeShiftTimeKey(timeStr, fallback = '0900') {
  if (!timeStr) return fallback;
  const cleaned = String(timeStr).replace(/[^0-9]/g, '');
  return cleaned || fallback;
}

function getSlotIdForCompany(moduleId, companyCode, companyId) {
  const cleanCode = String(companyCode || 'POLATLAR').trim().toUpperCase();
  const resolvedId =
    cleanCode === 'POLATLAR'
      ? 1
      : companyId && companyId > 1
      ? companyId
      : cleanCode === 'NESACOCUK'
      ? 2
      : ((Math.abs(
          Array.from(cleanCode).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) & 0xffff, 0)
        ) %
          1000) +
        2);

  if (moduleId > 20) {
    return moduleId * 1000 + resolvedId;
  }
  if (cleanCode === 'POLATLAR') {
    return moduleId;
  }
  return (resolvedId - 1) * 20 + moduleId;
}

function getIstanbulClock() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const year = map.year;
  const month = map.month;
  const day = map.day;
  const hour = Number(map.hour === '24' ? 0 : map.hour);
  const minute = Number(map.minute);

  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const dayOfWeek = weekdayMap[map.weekday] || (now.getDay() === 0 ? 7 : now.getDay());

  return {
    nowMs: now.getTime(),
    dateStr: `${year}-${month}-${day}`,
    dayOfWeek,
    currentMinutes: hour * 60 + minute,
  };
}

function computeShiftWindowTimestamps(dateStr, dayOfWeek, currentMinutes, shift, assignment) {
  const startStr = shift.startTime || assignment.startTime;
  const endStr = shift.endTime || assignment.endTime || '18:00';
  if (!startStr || !String(startStr).includes(':')) return null;

  const [sh, sm] = String(startStr).split(':').map(Number);
  const [ehRaw, emRaw] = String(endStr).split(':').map(Number);
  if (isNaN(sh) || isNaN(sm)) return null;

  const eh = isNaN(ehRaw) ? 18 : ehRaw;
  const em = isNaN(emRaw) ? 0 : emRaw;

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  let checkDay = dayOfWeek;
  if (endMin <= startMin && currentMinutes < startMin) {
    checkDay = dayOfWeek === 1 ? 7 : dayOfWeek - 1;
  }

  if (Array.isArray(shift.daysOfWeek) && shift.daysOfWeek.length > 0) {
    if (!shift.daysOfWeek.includes(checkDay)) {
      return null;
    }
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  let shiftStartMs;
  let shiftEndMs;

  if (endMin > startMin) {
    shiftStartMs = Date.parse(`${dateStr}T${pad2(sh)}:${pad2(sm)}:00+03:00`);
    shiftEndMs = Date.parse(`${dateStr}T${pad2(eh)}:${pad2(em)}:00+03:00`);
  } else {
    const durationMs = (24 * 60 - startMin + endMin) * 60 * 1000;
    if (currentMinutes < startMin) {
      shiftEndMs = Date.parse(`${dateStr}T${pad2(eh)}:${pad2(em)}:00+03:00`);
      shiftStartMs = shiftEndMs - durationMs;
    } else {
      shiftStartMs = Date.parse(`${dateStr}T${pad2(sh)}:${pad2(sm)}:00+03:00`);
      shiftEndMs = shiftStartMs + durationMs;
    }
  }

  if (isNaN(shiftStartMs) || isNaN(shiftEndMs)) return null;

  return {
    shiftStartStr: String(startStr),
    shiftEndStr: String(endStr),
    startMin,
    endMin,
    shiftStartMs,
    targetCheckIn15mMs: shiftStartMs + 15 * 60 * 1000,
    shiftEndMs,
    target5mMs: shiftEndMs + 5 * 60 * 1000,
    target10mMs: shiftEndMs + 10 * 60 * 1000,
  };
}

function chunkString(str, size = 8000) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

async function readSupabaseSlot(slotId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/standard_tasks?id=eq.${slotId}&select=id,tasks`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Supabase HTTP ${res.status}`);
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows[0] || !Array.isArray(rows[0].tasks)) return null;
    const raw = rows[0].tasks.join('');
    if (!raw) return null;
    return JSON.parse(raw);
  } finally {
    clearTimeout(timer);
  }
}

async function readLocalSlot(port, slotId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/standard_tasks/${slotId}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.notFound || !Array.isArray(json.tasks) || json.tasks.length === 0) return null;
    if (typeof json.tasks[0] === 'string') {
      const raw = json.tasks.join('');
      return raw ? JSON.parse(raw) : null;
    }
    return json.tasks;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readAuthoritativeSlot(port, slotId) {
  try {
    return await readSupabaseSlot(slotId);
  } catch {
    return await readLocalSlot(port, slotId);
  }
}

async function writeSupabaseAndLocalSlot(port, slotId, dataObj) {
  const chunks = chunkString(JSON.stringify(dataObj));
  await Promise.allSettled([
    fetch(`${SUPABASE_URL}/rest/v1/standard_tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ id: slotId, tasks: chunks }),
    }),
    fetch(`http://127.0.0.1:${port}/api/standard_tasks/${slotId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: chunks }),
    }),
  ]);
}

function isCheckedInOrExcused(records, leaveRequests, userId, dateStr, shiftStartMs, shiftStartMinutes) {
  if (Array.isArray(records) && records.length > 0) {
    const hasCheckIn = records.some((r) => {
      if (!r || r.userId !== userId) return false;
      if (r.checkInApprovalStatus === 'rejected') return false;

      const isSameDate =
        r.date === dateStr ||
        (r.checkInTime && Number(r.checkInTime) >= shiftStartMs - 4 * 60 * 60 * 1000);
      if (!isSameDate) return false;

      // Vardiya başlamadan çok önce tamamlanmış (çıkış yapılmış) eski mesaiyi yeni vardiya girişi sayma
      if (
        r.status === 'completed' &&
        r.checkOutTime &&
        Number(r.checkOutTime) > 0 &&
        Number(r.checkOutTime) < shiftStartMs - 15 * 60 * 1000
      ) {
        return false;
      }

      if (r.checkInTime && Number(r.checkInTime) > 0) return true;
      return (
        r.status === 'checked_in' ||
        r.status === 'pending_checkin_approval' ||
        r.status === 'completed' ||
        r.status === 'pending_checkout_approval' ||
        r.status === 'on_leave'
      );
    });
    if (hasCheckIn) return true;
  }

  if (Array.isArray(leaveRequests) && leaveRequests.length > 0) {
    const hasLeave = leaveRequests.some((req) => {
      if (!req || req.userId !== userId || req.status !== 'approved') return false;
      if (req.leaveType === 'daily') {
        const start = req.date;
        const end = req.endDate || req.date;
        if (start && dateStr >= start && dateStr <= end) return true;
      } else if (req.leaveType === 'hourly' && req.date === dateStr && req.startTime && req.endTime) {
        const [sh, sm] = String(req.startTime).split(':').map(Number);
        const [eh, em] = String(req.endTime).split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          const lStart = sh * 60 + sm;
          const lEnd = eh * 60 + em;
          if (shiftStartMinutes >= lStart && shiftStartMinutes < lEnd) return true;
        }
      }
      return false;
    });
    if (hasLeave) return true;
  }

  return false;
}

function evaluateUserCheckoutStatus(
  records,
  leaveRequests,
  userId,
  dateStr,
  shiftStartMs,
  shiftEndMs,
  shiftEndMinutes
) {
  // 1. Onaylı günlük izin veya vardiya bitişini kapsayan onaylı saatlik izin kontrolü
  if (Array.isArray(leaveRequests) && leaveRequests.length > 0) {
    const hasApprovedLeave = leaveRequests.some((req) => {
      if (!req || req.userId !== userId || req.status !== 'approved') return false;
      if (req.leaveType === 'daily') {
        const start = req.date;
        const end = req.endDate || req.date;
        if (start && dateStr >= start && dateStr <= end) return true;
      } else if (req.leaveType === 'hourly' && req.date === dateStr && req.startTime && req.endTime) {
        const [sh, sm] = String(req.startTime).split(':').map(Number);
        const [eh, em] = String(req.endTime).split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          const lStart = sh * 60 + sm;
          const lEnd = eh * 60 + em;
          if (shiftEndMinutes > lStart && shiftEndMinutes <= lEnd) return true;
        }
      }
      return false;
    });
    if (hasApprovedLeave) {
      return { hasCheckedOutOrExcused: true, hasActiveCheckIn: false, activeRecord: null };
    }
  }

  if (!Array.isArray(records) || records.length === 0) {
    return { hasCheckedOutOrExcused: false, hasActiveCheckIn: false, activeRecord: null };
  }

  const hasOnLeaveRecord = records.some(
    (r) => r && r.userId === userId && r.date === dateStr && r.status === 'on_leave'
  );
  if (hasOnLeaveRecord) {
    return { hasCheckedOutOrExcused: true, hasActiveCheckIn: false, activeRecord: null };
  }

  const relevantRecords = records
    .filter((r) => {
      if (!r || r.userId !== userId) return false;
      if (r.checkInApprovalStatus === 'rejected') return false;
      if (r.status === 'on_leave') return false;

      const checkInTs = Number(r.checkInTime || 0);
      const inShiftTimeRange =
        checkInTs > 0 &&
        checkInTs >= shiftStartMs - 6 * 60 * 60 * 1000 &&
        checkInTs <= shiftEndMs + 6 * 60 * 60 * 1000;

      return r.date === dateStr || inShiftTimeRange;
    })
    .sort((a, b) => Number(b.checkInTime || 0) - Number(a.checkInTime || 0));

  if (relevantRecords.length === 0) {
    return { hasCheckedOutOrExcused: false, hasActiveCheckIn: false, activeRecord: null };
  }

  let latestCheckOutTs = 0;
  for (const r of relevantRecords) {
    const outTs = Number(r.checkOutTime || 0);
    if (outTs > latestCheckOutTs) {
      latestCheckOutTs = outTs;
    }
  }

  // Açık mesai kaydı (hem onaylı hem yönetici onayı bekleyen girişler dahil; eski çıkış yeni girişi ezmez)
  const activeRecord =
    relevantRecords.find((r) => {
      const inTs = Number(r.checkInTime || 0);
      if (inTs <= 0) return false;
      if (r.checkOutTime && Number(r.checkOutTime) > 0) return false;
      if (r.status === 'completed' || r.status === 'pending_checkout_approval') return false;
      if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return false;
      if (latestCheckOutTs > inTs) return false;
      return r.status === 'checked_in' || r.status === 'pending_checkin_approval';
    }) || null;

  if (activeRecord) {
    return {
      hasCheckedOutOrExcused: false,
      hasActiveCheckIn: true,
      activeRecord,
    };
  }

  const hasCheckedOutForShift = relevantRecords.some((r) => {
    const outTs = Number(r.checkOutTime || 0);
    if (outTs > 0 && outTs < shiftStartMs - 15 * 60 * 1000) {
      return false;
    }
    if (outTs > 0) return true;
    if (r.status === 'completed' || r.status === 'pending_checkout_approval') return true;
    if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return true;
    return false;
  });

  return {
    hasCheckedOutOrExcused: hasCheckedOutForShift,
    hasActiveCheckIn: false,
    activeRecord: null,
  };
}

async function dispatchStaffShiftPush(port, params) {
  const targetUrl = 'https://saha-takip-beige.vercel.app/?tab=staff_tracking';
  const payload = {
    title: params.title,
    message: params.message,
    targetMode: 'custom',
    targetUserIds: [params.userId],
    targetSubscriptionIds:
      params.subscriptionIds && params.subscriptionIds.length > 0 ? params.subscriptionIds : undefined,
    multiChannelGuarantee: true,
    companyCode: params.companyCode,
    collapse_id: params.collapseId,
    url: targetUrl,
    data: {
      url: targetUrl,
      launchURL: targetUrl,
      tab: 'staff_tracking',
      companyCode: params.companyCode,
    },
  };

  try {
    const localRes = await fetch(`http://127.0.0.1:${port}/api/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (localRes.ok) return true;
  } catch {}

  try {
    const cloudRes = await fetch('https://saha-takip-beige.vercel.app/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return cloudRes.ok;
  } catch {
    return false;
  }
}

async function runShiftWatchdog(port = 3001) {
  if (isWatchdogRunning) return { status: 'already_running' };
  isWatchdogRunning = true;
  const dispatchedAlerts = [];

  try {
    const clock = getIstanbulClock();
    const companies = [
      { code: 'POLATLAR', id: 1 },
      { code: 'NESACOCUK', id: 2 },
    ];

    try {
      const dir = await readAuthoritativeSlot(port, 102);
      if (Array.isArray(dir)) {
        for (const c of dir) {
          if (c && c.code) {
            const clean = String(c.code).trim().toUpperCase();
            if (!companies.some((x) => x.code === clean)) {
              companies.push({ code: clean, id: Number(c.id) || undefined });
            }
          }
        }
      }
    } catch {}

    for (const company of companies) {
      const shiftSlotId = getSlotIdForCompany(18, company.code, company.id);
      let shiftData = null;
      try {
        shiftData = await readAuthoritativeSlot(port, shiftSlotId);
      } catch {
        continue;
      }

      const definitions = Array.isArray(shiftData?.definitions) ? shiftData.definitions : [];
      const assignments = Array.isArray(shiftData?.assignments) ? shiftData.assignments : [];
      if (assignments.length === 0) continue;

      const activeCandidates = [];
      for (const assignment of assignments) {
        if (!assignment || !assignment.userId) continue;
        const shift = definitions.find((s) => s.id === assignment.shiftId) || {
          id: assignment.shiftId,
          companyCode: assignment.companyCode || company.code,
          name: assignment.shiftName,
          startTime: assignment.startTime,
          endTime: assignment.endTime,
          daysOfWeek: [1, 2, 3, 4, 5, 6],
        };

        const win = computeShiftWindowTimestamps(
          clock.dateStr,
          clock.dayOfWeek,
          clock.currentMinutes,
          shift,
          assignment
        );
        if (!win) continue;

        const inCheckinWindow =
          clock.nowMs >= win.targetCheckIn15mMs &&
          clock.nowMs < win.shiftEndMs &&
          clock.nowMs - win.shiftStartMs <= 6 * 60 * 60 * 1000;

        const inCheckoutWindow =
          clock.nowMs >= win.target5mMs &&
          clock.nowMs - win.shiftEndMs <= 6 * 60 * 60 * 1000;

        if (inCheckinWindow || inCheckoutWindow) {
          activeCandidates.push({
            assignment,
            shift,
            ...win,
            inCheckinWindow,
            inCheckoutWindow,
          });
        }
      }

      if (activeCandidates.length === 0) continue;

      const attSlotId = getSlotIdForCompany(6, company.code, company.id);
      const leaveSlotId = getSlotIdForCompany(10, company.code, company.id);
      const devSlotId = getSlotIdForCompany(8, company.code, company.id);
      const alertLogSlotId = getSlotIdForCompany(23, company.code, company.id);

      const [attendanceRecords, leaveRequests, supaDevices, localDevices, rawAlertLogs] =
        await Promise.all([
          readAuthoritativeSlot(port, attSlotId).catch(() => []),
          readAuthoritativeSlot(port, leaveSlotId).catch(() => []),
          readSupabaseSlot(devSlotId).catch(() => []),
          readLocalSlot(port, devSlotId).catch(() => []),
          readAuthoritativeSlot(port, alertLogSlotId).catch(() => ({})),
        ]);

      const alertLogs =
        rawAlertLogs && typeof rawAlertLogs === 'object' && !Array.isArray(rawAlertLogs)
          ? { ...rawAlertLogs }
          : {};
      let alertLogsDirty = false;
      let attendanceDirty = false;
      const updatedAttendance = Array.isArray(attendanceRecords) ? [...attendanceRecords] : [];

      const getSubIdsForUser = (uid) => {
        const subSet = new Set();
        for (const list of [supaDevices, localDevices]) {
          if (Array.isArray(list)) {
            for (const d of list) {
              if (d && d.userId === uid && d.pushSubscriptionId) {
                subSet.add(d.pushSubscriptionId);
              }
            }
          }
        }
        return Array.from(subSet);
      };

      const pruneOldAlertLogs = () => {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        for (const [k, ts] of Object.entries(alertLogs)) {
          if (typeof ts !== 'number' || clock.nowMs - ts > sevenDaysMs) {
            delete alertLogs[k];
          }
        }
      };

      for (const item of activeCandidates) {
        const {
          assignment,
          shiftStartStr,
          shiftEndStr,
          startMin,
          endMin,
          shiftStartMs,
          shiftEndMs,
          target5mMs,
          target10mMs,
          inCheckinWindow,
          inCheckoutWindow,
        } = item;
        const uid = assignment.userId;

        // 1. VARDİYA GİRİŞ (+15. DAKİKA) KONTROLÜ
        if (inCheckinWindow) {
          const cleanStartKey = normalizeShiftTimeKey(shiftStartStr, '0900');
          const checkinKey = `checkin_15m_${clock.dateStr}_${cleanStartKey}_${uid}`;
          if (!alertLogs[checkinKey]) {
            const alreadyIn = isCheckedInOrExcused(
              updatedAttendance,
              leaveRequests,
              uid,
              clock.dateStr,
              shiftStartMs,
              startMin
            );
            if (!alreadyIn) {
              alertLogs[checkinKey] = clock.nowMs;
              pruneOldAlertLogs();
              await writeSupabaseAndLocalSlot(port, alertLogSlotId, alertLogs);
              alertLogsDirty = false;

              console.log(
                `>> [Vardiya Bekçisi] +15dk işe giriş hatırlatması gönderiliyor: ${assignment.userName || uid} (${company.code})`
              );
              await dispatchStaffShiftPush(port, {
                userId: uid,
                subscriptionIds: getSubIdsForUser(uid),
                companyCode: company.code,
                collapseId: `shift_in_15m_${clock.dateStr}_${cleanStartKey}_${uid}`,
                title: '🔔 Vardiya Giriş Hatırlatması (15. Dakika)',
                message: `Saat ${shiftStartStr} vardiyanız 15 dakika önce başladı ancak henüz işe giriş yapmadınız. Lütfen işe giriş işleminizi yapmayı unutmayın!`,
              });
              dispatchedAlerts.push(checkinKey);
            }
          }
        }

        // 2. VARDİYA ÇIKIŞ (+5. VE +10. DAKİKA) KONTROLÜ
        if (inCheckoutWindow) {
          const cleanEndKey = normalizeShiftTimeKey(shiftEndStr, '1800');
          const key5m = `checkout_5m_${clock.dateStr}_${cleanEndKey}_${uid}`;
          const key10m = `checkout_10m_${clock.dateStr}_${cleanEndKey}_${uid}`;

          const needs5m =
            clock.nowMs >= target5mMs &&
            clock.nowMs < target10mMs &&
            !alertLogs[key5m];
          const needs10m =
            clock.nowMs >= target10mMs &&
            !alertLogs[key10m];

          if (needs5m || needs10m) {
            const checkoutStatus = evaluateUserCheckoutStatus(
              updatedAttendance,
              leaveRequests,
              uid,
              clock.dateStr,
              shiftStartMs,
              shiftEndMs,
              endMin
            );

            if (!checkoutStatus.hasCheckedOutOrExcused) {
              const activeRecord = checkoutStatus.activeRecord;

              if (needs5m) {
                alertLogs[key5m] = clock.nowMs;
                pruneOldAlertLogs();
                await writeSupabaseAndLocalSlot(port, alertLogSlotId, alertLogs);
                alertLogsDirty = false;

                if (activeRecord) {
                  activeRecord.shiftCheckout5mNotified = true;
                  activeRecord.shiftCheckout5mNotifiedAt = clock.nowMs;
                  activeRecord.shiftCheckoutStaffNotified = true;
                  activeRecord.shiftCheckoutStaffNotifiedAt = clock.nowMs;
                  attendanceDirty = true;
                }

                console.log(
                  `>> [Vardiya Bekçisi] +5dk işten çıkış hatırlatması gönderiliyor: ${assignment.userName || uid} (${company.code})`
                );
                await dispatchStaffShiftPush(port, {
                  userId: uid,
                  subscriptionIds: getSubIdsForUser(uid),
                  companyCode: company.code,
                  collapseId: `shift_5m_${clock.dateStr}_${cleanEndKey}_${uid}`,
                  title: '🔔 Vardiya Çıkış Hatırlatması (5. Dakika)',
                  message: `Saat ${shiftEndStr} vardiyanız 5 dakika önce sona erdi ancak henüz işten çıkış yapmadınız. Lütfen işten çıkış işleminizi yapmayı unutmayın!`,
                });
                dispatchedAlerts.push(key5m);
              } else if (needs10m) {
                alertLogs[key10m] = clock.nowMs;
                pruneOldAlertLogs();
                await writeSupabaseAndLocalSlot(port, alertLogSlotId, alertLogs);
                alertLogsDirty = false;

                if (activeRecord) {
                  activeRecord.shiftCheckout5mNotified = true;
                  activeRecord.shiftCheckoutStaffNotified = true;
                  activeRecord.shiftCheckout10mNotified = true;
                  activeRecord.shiftCheckout10mNotifiedAt = clock.nowMs;
                  attendanceDirty = true;
                }

                console.log(
                  `>> [Vardiya Bekçisi] +10dk işten çıkış uyarısı gönderiliyor: ${assignment.userName || uid} (${company.code})`
                );
                await dispatchStaffShiftPush(port, {
                  userId: uid,
                  subscriptionIds: getSubIdsForUser(uid),
                  companyCode: company.code,
                  collapseId: `shift_10m_${clock.dateStr}_${cleanEndKey}_${uid}`,
                  title: '⚠️ Vardiya Çıkış Uyarısı (10. Dakika)',
                  message: `Saat ${shiftEndStr} vardiyanız 10 dakika önce sona erdi ve hala işten çıkış yapmadınız! Lütfen işten çıkış işleminizi gerçekleştiriniz.`,
                });
                dispatchedAlerts.push(key10m);
              }
            }
          }
        }
      }

      if (alertLogsDirty) {
        await writeSupabaseAndLocalSlot(port, alertLogSlotId, alertLogs);
      }
      if (attendanceDirty) {
        await writeSupabaseAndLocalSlot(port, attSlotId, updatedAttendance);
      }
    }

    return { status: 'ok', dateStr: clock.dateStr, dispatchedAlerts };
  } catch (err) {
    console.warn('>> [Vardiya Bekçisi Uyarısı]:', err.message);
    return { status: 'error', error: err.message };
  } finally {
    isWatchdogRunning = false;
  }
}

module.exports = { runShiftWatchdog };
