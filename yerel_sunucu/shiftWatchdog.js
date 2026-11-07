/**
 * Saha Takip Sistemi - 7/24 Otonom Vardiya Giriş (+15dk) & Çıkış (+5dk / +10dk) Bekçisi
 *
 * Hiçbir tarayıcı veya telefon uygulaması açık olmasa bile Windows Server üzerinde dakikada bir çalışarak:
 * 1. Vardiyası başladıktan 15 dakika sonra hala işe giriş yapmamış (ve onaylı izni olmayan) personele
 *    canlı veritabanı doğrulamasıyla tek seferlik giriş hatırlatma bildirimi gönderir.
 * 2. Vardiyası bittikten +5 dk ve +10 dk sonra hala çıkış yapmamış personele çıkış hatırlatması gönderir.
 * 3. Supabase Slot 23 (23001 / 23002) ortak tekilleştirme kaydı sayesinde web/mobil istemcilerle çakışmaz,
 *    mükerrer bildirim göndermez ve yöneticiye ASLA gecikme bildirimi göndermez.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';

let isWatchdogRunning = false;

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
  const dayOfWeek = weekdayMap[map.weekday] || ((now.getDay() === 0 ? 7 : now.getDay()));

  return {
    nowMs: now.getTime(),
    dateStr: `${year}-${month}-${day}`,
    dayOfWeek,
    currentMinutes: hour * 60 + minute,
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/standard_tasks?id=eq.${slotId}&select=id,tasks`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows[0] || !Array.isArray(rows[0].tasks)) return null;
  const raw = rows[0].tasks.join('');
  if (!raw) return null;
  return JSON.parse(raw);
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

function isCheckedInOrExcused(records, leaveRequests, userId, dateStr, nowMs, shiftStartMinutes) {
  if (Array.isArray(records)) {
    const hasCheckIn = records.some((r) => {
      if (!r || r.userId !== userId) return false;
      const recentEnough = r.checkInTime && Number(r.checkInTime) >= nowMs - 14 * 60 * 60 * 1000;
      if (r.date !== dateStr && !recentEnough) return false;
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

  if (Array.isArray(leaveRequests)) {
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

function checkUserCheckoutState(records, userId, dateStr) {
  if (!Array.isArray(records)) return { hasCheckedOut: false, activeRecord: null };
  const todayList = records.filter((r) => r && r.userId === userId && r.date === dateStr);
  if (todayList.length === 0) return { hasCheckedOut: false, activeRecord: null };

  const hasCheckedOut = todayList.some((r) => {
    if (r.checkOutTime && Number(r.checkOutTime) > 0) return true;
    if (r.status === 'completed' || r.status === 'pending_checkout_approval') return true;
    if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return true;
    return false;
  });

  const activeRecord =
    todayList.find((r) => {
      if (!r.checkInTime) return false;
      if (r.checkOutTime && Number(r.checkOutTime) > 0) return false;
      if (r.status === 'completed' || r.status === 'pending_checkout_approval') return false;
      if (r.checkOutApprovalStatus === 'approved' || r.checkOutApprovalStatus === 'pending') return false;
      return r.status === 'checked_in';
    }) || null;

  return { hasCheckedOut, activeRecord };
}

async function dispatchStaffShiftPush(port, params) {
  const payload = {
    title: params.title,
    message: params.message,
    targetMode: 'custom',
    targetUserIds: [params.userId],
    targetSubscriptionIds: params.subscriptionIds && params.subscriptionIds.length > 0 ? params.subscriptionIds : undefined,
    multiChannelGuarantee: true,
    companyCode: params.companyCode,
    collapse_id: params.collapseId,
    url: 'https://saha-takip-beige.vercel.app/?tab=attendance',
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
  if (isWatchdogRunning) return;
  isWatchdogRunning = true;

  try {
    const clock = getIstanbulClock();
    const companies = [
      { code: 'POLATLAR', id: 1 },
      { code: 'NESACOCUK', id: 2 },
    ];

    try {
      const dir = await readSupabaseSlot(102);
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
        shiftData = await readSupabaseSlot(shiftSlotId);
      } catch {
        continue;
      }

      const definitions = Array.isArray(shiftData?.definitions) ? shiftData.definitions : [];
      const assignments = Array.isArray(shiftData?.assignments) ? shiftData.assignments : [];
      if (assignments.length === 0) continue;

      // Aktif pencereye giren en az bir vardiya var mı ön-kontrol yap (gereksiz ağ trafiğini önler)
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

        if (Array.isArray(shift.daysOfWeek) && shift.daysOfWeek.length > 0) {
          if (!shift.daysOfWeek.includes(clock.dayOfWeek)) continue;
        }

        const startStr = shift.startTime || assignment.startTime;
        const endStr = shift.endTime || assignment.endTime;
        if (!startStr || !String(startStr).includes(':')) continue;

        const [sh, sm] = String(startStr).split(':').map(Number);
        const [eh, em] = String(endStr || '18:00').split(':').map(Number);
        if (isNaN(sh) || isNaN(sm)) continue;

        const startMin = sh * 60 + sm;
        const endMin = (isNaN(eh) ? 18 : eh) * 60 + (isNaN(em) ? 0 : em);

        // Normal gündüz vardiyası pencere hesabı
        const inCheckinWindow =
          endMin > startMin &&
          clock.currentMinutes >= startMin + 15 &&
          clock.currentMinutes < endMin &&
          clock.currentMinutes - startMin <= 240;

        const inCheckoutWindow =
          endMin > startMin &&
          clock.currentMinutes >= endMin + 5 &&
          clock.currentMinutes - endMin <= 360;

        if (inCheckinWindow || inCheckoutWindow) {
          activeCandidates.push({
            assignment,
            shift,
            startMin,
            endMin,
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

      const [attendanceRecords, leaveRequests, registeredDevices, rawAlertLogs] = await Promise.all([
        readSupabaseSlot(attSlotId).catch(() => []),
        readSupabaseSlot(leaveSlotId).catch(() => []),
        readSupabaseSlot(devSlotId).catch(() => []),
        readSupabaseSlot(alertLogSlotId).catch(() => ({})),
      ]);

      const alertLogs =
        rawAlertLogs && typeof rawAlertLogs === 'object' && !Array.isArray(rawAlertLogs)
          ? { ...rawAlertLogs }
          : {};
      let alertLogsDirty = false;
      let attendanceDirty = false;
      const updatedAttendance = Array.isArray(attendanceRecords) ? [...attendanceRecords] : [];

      const getSubIdsForUser = (uid) => {
        if (!Array.isArray(registeredDevices)) return [];
        return registeredDevices
          .filter((d) => d && d.userId === uid && d.pushSubscriptionId)
          .map((d) => d.pushSubscriptionId);
      };

      for (const item of activeCandidates) {
        const { assignment, startMin, endMin, inCheckinWindow, inCheckoutWindow } = item;
        const uid = assignment.userId;

        // 1. VARDİYA GİRİŞ (+15. DAKİKA) KONTROLÜ
        if (inCheckinWindow) {
          const checkinKey = `checkin_15m_${clock.dateStr}_${uid}`;
          if (!alertLogs[checkinKey]) {
            const alreadyIn = isCheckedInOrExcused(
              updatedAttendance,
              leaveRequests,
              uid,
              clock.dateStr,
              clock.nowMs,
              startMin
            );
            if (!alreadyIn) {
              alertLogs[checkinKey] = clock.nowMs;
              alertLogsDirty = true;

              // Önce Slot 23'ü mühürle (yarış durumunu engelle)
              const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
              for (const [k, ts] of Object.entries(alertLogs)) {
                if (typeof ts !== 'number' || clock.nowMs - ts > sevenDaysMs) delete alertLogs[k];
              }
              await writeSupabaseAndLocalSlot(port, alertLogSlotId, alertLogs);
              alertLogsDirty = false;

              console.log(
                `>> [Vardiya Bekçisi] +15dk işe giriş hatırlatması gönderiliyor: ${assignment.userName || uid} (${company.code})`
              );
              await dispatchStaffShiftPush(port, {
                userId: uid,
                subscriptionIds: getSubIdsForUser(uid),
                companyCode: company.code,
                collapseId: `shift_in_15m_${clock.dateStr}_${uid}`,
                title: '🔔 Vardiya Giriş Hatırlatması (15. Dakika)',
                message:
                  'Vardiya saatiniz 15 dakika önce başladı ancak henüz işe giriş yapmadınız. Lütfen işe giriş işleminizi yapmayı unutmayın!',
              });
            }
          }
        }

        // 2. VARDİYA ÇIKIŞ (+5. VE +10. DAKİKA) KONTROLÜ
        if (inCheckoutWindow) {
          const { hasCheckedOut, activeRecord } = checkUserCheckoutState(updatedAttendance, uid, clock.dateStr);
          if (!hasCheckedOut && activeRecord) {
            const key5m = `checkout_5m_${clock.dateStr}_${uid}`;
            const key10m = `checkout_10m_${clock.dateStr}_${uid}`;
            const needs5m =
              clock.currentMinutes >= endMin + 5 &&
              clock.currentMinutes < endMin + 10 &&
              !activeRecord.shiftCheckout5mNotified &&
              !activeRecord.shiftCheckoutStaffNotified &&
              !alertLogs[key5m];
            const needs10m =
              clock.currentMinutes >= endMin + 10 &&
              !activeRecord.shiftCheckout10mNotified &&
              !alertLogs[key10m];

            if (needs5m) {
              alertLogs[key5m] = clock.nowMs;
              alertLogsDirty = true;
              activeRecord.shiftCheckout5mNotified = true;
              activeRecord.shiftCheckout5mNotifiedAt = clock.nowMs;
              activeRecord.shiftCheckoutStaffNotified = true;
              activeRecord.shiftCheckoutStaffNotifiedAt = clock.nowMs;
              attendanceDirty = true;

              await writeSupabaseAndLocalSlot(port, alertLogSlotId, alertLogs);
              alertLogsDirty = false;

              console.log(
                `>> [Vardiya Bekçisi] +5dk işten çıkış hatırlatması gönderiliyor: ${assignment.userName || uid} (${company.code})`
              );
              await dispatchStaffShiftPush(port, {
                userId: uid,
                subscriptionIds: getSubIdsForUser(uid),
                companyCode: company.code,
                collapseId: `shift_5m_${clock.dateStr}_${uid}`,
                title: '🔔 Vardiya Çıkış Hatırlatması (5. Dakika)',
                message:
                  'Vardiya saatiniz 5 dakika önce sona erdi ancak henüz çıkış yapmadınız. Lütfen işten çıkış işleminizi yapmayı unutmayın!',
              });
            } else if (needs10m) {
              alertLogs[key10m] = clock.nowMs;
              alertLogsDirty = true;
              activeRecord.shiftCheckout5mNotified = true;
              activeRecord.shiftCheckoutStaffNotified = true;
              activeRecord.shiftCheckout10mNotified = true;
              activeRecord.shiftCheckout10mNotifiedAt = clock.nowMs;
              attendanceDirty = true;

              await writeSupabaseAndLocalSlot(port, alertLogSlotId, alertLogs);
              alertLogsDirty = false;

              console.log(
                `>> [Vardiya Bekçisi] +10dk işten çıkış uyarısı gönderiliyor: ${assignment.userName || uid} (${company.code})`
              );
              await dispatchStaffShiftPush(port, {
                userId: uid,
                subscriptionIds: getSubIdsForUser(uid),
                companyCode: company.code,
                collapseId: `shift_10m_${clock.dateStr}_${uid}`,
                title: '⚠️ Vardiya Çıkış Uyarısı (10. Dakika)',
                message:
                  'Vardiya saatiniz 10 dakika önce sona erdi ve hala çıkış yapmadınız! Lütfen işten çıkış işleminizi gerçekleştiriniz.',
              });
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
  } catch (err) {
    console.warn('>> [Vardiya Bekçisi Uyarısı]:', err.message);
  } finally {
    isWatchdogRunning = false;
  }
}

module.exports = { runShiftWatchdog };
