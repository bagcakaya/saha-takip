// 24/7 Autonomous Tenant & Shift Watchdog (+15m Check-In & +5m/+10m Check-Out Push Service)
// Runs periodically via Vercel Cron, Server Watchdog Daemon, and Client Heartbeat
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '03e50631-8d38-4796-a90f-ae524dab69fd';
const _k =
  'b3NfdjJfYXBwX2Fwc3FtbW1uaGJkem5raXB2emplM2szajd4YmV5amhtNGsydXdtZm5jZWhxbXJybWY1YmxreXpjcG00NHRtcGp0ZmdlcTR5NzZkYXlqczQ1dHR1a2Fiam1oYXdsZ3JnZ3lzbGVkeHE=';
const getApiKey = () =>
  process.env.ONESIGNAL_REST_KEY ||
  (typeof Buffer !== 'undefined' ? Buffer.from(_k, 'base64').toString('utf8') : atob(_k));

const LOCAL_SERVER_URL = process.env.LOCAL_SERVER_URL || 'http://81.213.219.69:3001';
const watchdogRateCache = new Map();

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isAllowedWatchdogRequest(req) {
  const origin = req.headers?.origin;
  const referer = req.headers?.referer;
  const ua = String(req.headers?.['user-agent'] || '').toLowerCase();
  const token = String(req.headers?.['x-saha-client-token'] || '');
  const isVercelCron = Boolean(req.headers?.['x-vercel-cron'] || ua.includes('vercel-cron'));

  if (isVercelCron || token.startsWith('saha-')) return true;

  for (const h of [origin, referer]) {
    if (!h) continue;
    try {
      const u = new URL(h);
      const host = u.hostname.toLowerCase();
      if (
        u.protocol === 'capacitor:' ||
        u.protocol === 'ionic:' ||
        host === 'saha-takip-beige.vercel.app' ||
        host.endsWith('.vercel.app') ||
        host === '81.213.219.69' ||
        host === 'localhost' ||
        host === '127.0.0.1'
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  if (/curl\/|python-requests|python-urllib|go-http-client|postmanruntime|insomnia|sqlmap|nikto/i.test(ua)) {
    return false;
  }
  return true;
}

function checkWatchdogRate(req) {
  try {
    const rawIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ip = String(rawIp).split(',')[0].trim();
    const now = Date.now();
    const entry = watchdogRateCache.get(ip);
    if (!entry || now - entry.start > 60000) {
      watchdogRateCache.set(ip, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= 60;
  } catch {
    return true;
  }
}

const KNOWN_POLATLAR_SUBS = [
  '89bcd97c-28f4-4b7e-a70f-fb3748004de8',
  '2dfc8e02-5d2f-44b1-a38d-43c0d0b46872',
  '49243a90-8287-4363-8e19-3408dded8e7d',
  'f6404c9d-7e09-45cb-8912-b641db201343',
];

const KNOWN_POLATLAR_USERS = [
  'admin-root',
  'mtjsnufrp8pfa',
  'mtjso6drpactx',
  'mtjsoob6so4wi',
  'mtjsoxbaslaty',
];

const NESA_ADMIN_SUB = '875842fa-942b-4d3a-be08-72be011c1372';

async function supabaseGet(table, query) {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
    6000
  );
  return await res.json();
}

async function localServerUpsertSlot(slotId, chunks) {
  try {
    const res = await fetchWithTimeout(
      `${LOCAL_SERVER_URL}/api/standard_tasks/${slotId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Saha-Client-Token': 'saha-watchdog-v2',
        },
        body: JSON.stringify({ tasks: chunks }),
      },
      3000
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function supabaseUpsert(table, body) {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(body),
    },
    6000
  );
  return res.ok;
}

function chunkString(str, size = 8000) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

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

async function readSupabaseSlotData(slotId) {
  try {
    const rows = await supabaseGet('standard_tasks', `id=eq.${slotId}&select=id,tasks`);
    if (!Array.isArray(rows) || !rows[0] || !Array.isArray(rows[0].tasks)) return null;
    const raw = rows[0].tasks.join('');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeSlotEverywhere(slotId, dataObj) {
  const chunks = chunkString(JSON.stringify(dataObj));
  await Promise.allSettled([
    supabaseUpsert('standard_tasks', { id: slotId, tasks: chunks }),
    localServerUpsertSlot(slotId, chunks),
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

async function dispatchCloudShiftPush(params) {
  const apiKey = getApiKey();
  const targetUrl = 'https://saha-takip-beige.vercel.app/?tab=staff_tracking';
  const baseBody = {
    app_id: ONESIGNAL_APP_ID,
    headings: { tr: params.title, en: params.title },
    contents: { tr: params.message, en: params.message },
    url: targetUrl,
    collapse_id: params.collapseId,
    web_push_topic: params.collapseId,
    priority: 10,
    ios_sound: 'default',
    android_visibility: 1,
    ttl: 86400,
    data: {
      url: targetUrl,
      launchURL: targetUrl,
      tab: 'staff_tracking',
      companyCode: params.companyCode,
    },
  };

  const payloads = [];
  if (Array.isArray(params.subscriptionIds) && params.subscriptionIds.length > 0) {
    payloads.push({
      ...baseBody,
      include_player_ids: params.subscriptionIds,
    });
  }
  payloads.push({
    ...baseBody,
    filters: [{ field: 'tag', key: 'userId', relation: '=', value: params.userId }],
  });
  payloads.push({
    ...baseBody,
    include_aliases: { external_id: [params.userId] },
    target_channel: 'push',
  });

  let anyDelivered = false;
  await Promise.allSettled(
    payloads.map(async (p) => {
      const res = await fetchWithTimeout(
        'https://onesignal.com/api/v1/notifications',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Basic ${apiKey}`,
          },
          body: JSON.stringify(p),
        },
        6000
      );
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d && d.id) anyDelivered = true;
      }
    })
  );

  return anyDelivered;
}

async function runCloudShiftWatchdog() {
  const dispatchedAlerts = [];
  const clock = getIstanbulClock();
  const companies = [
    { code: 'POLATLAR', id: 1 },
    { code: 'NESACOCUK', id: 2 },
  ];

  try {
    const dir = await readSupabaseSlotData(102);
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
    const shiftData = await readSupabaseSlotData(shiftSlotId);
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

    const [attendanceRecords, leaveRequests, supaDevices, rawAlertLogs] = await Promise.all([
      readSupabaseSlotData(attSlotId).catch(() => []),
      readSupabaseSlotData(leaveSlotId).catch(() => []),
      readSupabaseSlotData(devSlotId).catch(() => []),
      readSupabaseSlotData(alertLogSlotId).catch(() => ({})),
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
      if (Array.isArray(supaDevices)) {
        for (const d of supaDevices) {
          if (d && d.userId === uid && d.pushSubscriptionId) {
            subSet.add(d.pushSubscriptionId);
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
            await writeSlotEverywhere(alertLogSlotId, alertLogs);
            alertLogsDirty = false;

            await dispatchCloudShiftPush({
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
              await writeSlotEverywhere(alertLogSlotId, alertLogs);
              alertLogsDirty = false;

              if (activeRecord) {
                activeRecord.shiftCheckout5mNotified = true;
                activeRecord.shiftCheckout5mNotifiedAt = clock.nowMs;
                activeRecord.shiftCheckoutStaffNotified = true;
                activeRecord.shiftCheckoutStaffNotifiedAt = clock.nowMs;
                attendanceDirty = true;
              }

              await dispatchCloudShiftPush({
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
              await writeSlotEverywhere(alertLogSlotId, alertLogs);
              alertLogsDirty = false;

              if (activeRecord) {
                activeRecord.shiftCheckout5mNotified = true;
                activeRecord.shiftCheckoutStaffNotified = true;
                activeRecord.shiftCheckout10mNotified = true;
                activeRecord.shiftCheckout10mNotifiedAt = clock.nowMs;
                attendanceDirty = true;
              }

              await dispatchCloudShiftPush({
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
      await writeSlotEverywhere(alertLogSlotId, alertLogs);
    }
    if (attendanceDirty) {
      await writeSlotEverywhere(attSlotId, updatedAttendance);
    }
  }

  return dispatchedAlerts;
}

export default async function handler(req, res) {
  if (!isAllowedWatchdogRequest(req)) {
    res.status(403).json({ status: 'error', message: 'Forbidden' });
    return;
  }

  const origin = req.headers?.origin;
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://saha-takip-beige.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Saha-Client-Token'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!checkWatchdogRate(req)) {
    res.status(429).json({ status: 'rate_limited' });
    return;
  }

  const results = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    actionsTakenCount: 0,
    dispatchedShiftAlerts: [],
  };

  try {
    // 0. Run 24/7 Cloud Shift Watchdog (+15m Check-In & +5m/+10m Check-Out)
    try {
      const shiftAlerts = await runCloudShiftWatchdog();
      results.dispatchedShiftAlerts = shiftAlerts;
      results.actionsTakenCount += shiftAlerts.length;
    } catch (shiftErr) {
      console.warn('Cloud shift watchdog warning:', shiftErr?.message);
    }

    // 1. Load users from Slot 101 to build authoritative user -> company map
    const slot101 = await supabaseGet('standard_tasks', 'id=eq.101&select=*');
    const rawUsers = slot101[0]?.tasks?.join('');
    const users = rawUsers ? JSON.parse(rawUsers) : [];
    const userCompanyMap = new Map();
    users.forEach((u) => {
      userCompanyMap.set(u.id, (u.companyCode || 'POLATLAR').trim().toUpperCase());
    });

    // 2. Audit Slot 28 (NESACOCUK registered devices)
    let nesaCleanedCount = 0;
    const slot28 = await supabaseGet('standard_tasks', 'id=eq.28&select=*');
    if (slot28[0]?.tasks) {
      const dev28 = JSON.parse(slot28[0].tasks.join(''));
      const initialCount = dev28.length;

      const cleanDev28 = dev28.filter((d) => {
        if (d.pushSubscriptionId && KNOWN_POLATLAR_SUBS.includes(d.pushSubscriptionId)) {
          return false;
        }
        if (d.userId && (KNOWN_POLATLAR_USERS.includes(d.userId) || userCompanyMap.get(d.userId) === 'POLATLAR')) {
          return false;
        }
        if (d.companyCode && d.companyCode.toUpperCase() !== 'NESACOCUK') {
          return false;
        }
        return true;
      });

      if (cleanDev28.length !== initialCount) {
        nesaCleanedCount = initialCount - cleanDev28.length;
        const chunks = chunkString(JSON.stringify(cleanDev28));
        await Promise.allSettled([
          supabaseUpsert('standard_tasks', { id: 28, tasks: chunks }),
          localServerUpsertSlot(28, chunks),
        ]);
        results.actionsTakenCount += nesaCleanedCount;
      }
    }

    // 3. Audit Slot 8 (POLATLAR registered devices)
    let polatlarCleanedCount = 0;
    const slot8 = await supabaseGet('standard_tasks', 'id=eq.8&select=*');
    if (slot8[0]?.tasks) {
      const dev8 = JSON.parse(slot8[0].tasks.join(''));
      const initialCount = dev8.length;

      const cleanDev8 = dev8.filter((d) => {
        if (d.pushSubscriptionId && d.pushSubscriptionId === NESA_ADMIN_SUB) {
          return false;
        }
        const uComp = userCompanyMap.get(d.userId);
        if (uComp && uComp !== 'POLATLAR') {
          return false;
        }
        if (d.companyCode && d.companyCode.toUpperCase() !== 'POLATLAR') {
          return false;
        }
        return true;
      });

      if (cleanDev8.length !== initialCount) {
        polatlarCleanedCount = initialCount - cleanDev8.length;
        const chunks = chunkString(JSON.stringify(cleanDev8));
        await Promise.allSettled([
          supabaseUpsert('standard_tasks', { id: 8, tasks: chunks }),
          localServerUpsertSlot(8, chunks),
        ]);
        results.actionsTakenCount += polatlarCleanedCount;
      }
    }

    // 4. OneSignal REST API Health & Connection Check
    try {
      const osRes = await fetchWithTimeout(
        `https://onesignal.com/api/v1/apps/${ONESIGNAL_APP_ID}`,
        {
          headers: { Authorization: `Basic ${getApiKey()}` },
        },
        4000
      );
      results.pushService = osRes.ok ? 'ok' : 'degraded';
    } catch {
      results.pushService = 'unreachable';
    }

    res.status(200).json(results);
  } catch (err) {
    console.error('Tenant Watchdog execution error:', err);
    res.status(500).json({ status: 'error' });
  }
}
