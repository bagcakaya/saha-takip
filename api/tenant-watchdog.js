// 24/7 Autonomous Tenant Watchdog & Self-Healing Service
// Runs periodically via Vercel Cron and on-demand via Client Heartbeat
const SUPABASE_URL = 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';

const ONESIGNAL_APP_ID = '03e50631-8d38-4796-a90f-ae524dab69fd';
const _k = 'b3NfdjJfYXBwX2Fwc3FtbW1uaGJkem5raXB2emplM2szajd4YmV5amhtNGsydXdtZm5jZWhxbXJybWY1YmxreXpjcG00NHRtcGp0ZmdlcTR5NzZkYXlqczQ1dHR1a2Fiam1oYXdsZ3JnZ3lzbGVkeHE=';
const getApiKey = () => (typeof Buffer !== 'undefined' ? Buffer.from(_k, 'base64').toString('utf8') : atob(_k));

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
  'mu3wz17wbkq2t',
  'mu42age5lqmew',
  'mu42b1kqff54r',
  'mtjsoxbaslaty',
];

const NESA_ADMIN_SUB = '875842fa-942b-4d3a-be08-72be011c1372';

async function supabaseGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  return await res.json();
}

async function supabaseUpsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const results = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    actionsTaken: [],
    details: {},
  };

  try {
    // 1. Load users from Slot 101 to build authoritative user -> company map
    const slot101 = await supabaseGet('standard_tasks', 'id=eq.101&select=*');
    const rawUsers = slot101[0]?.tasks?.join('');
    const users = rawUsers ? JSON.parse(rawUsers) : [];
    const userCompanyMap = new Map();
    users.forEach((u) => {
      userCompanyMap.set(u.id, (u.companyCode || 'POLATLAR').trim().toUpperCase());
    });

    results.details.totalUsers = users.length;

    // 2. Audit Slot 28 (NESACOCUK registered devices)
    let nesaCleanedCount = 0;
    const slot28 = await supabaseGet('standard_tasks', 'id=eq.28&select=*');
    if (slot28[0]?.tasks) {
      const dev28 = JSON.parse(slot28[0].tasks.join(''));
      const initialCount = dev28.length;

      const cleanDev28 = dev28.filter((d) => {
        // Exclude any known Polatlar hardware subscription ID
        if (d.pushSubscriptionId && KNOWN_POLATLAR_SUBS.includes(d.pushSubscriptionId)) {
          return false;
        }
        // Exclude any device registered to a Polatlar user
        if (d.userId && (KNOWN_POLATLAR_USERS.includes(d.userId) || userCompanyMap.get(d.userId) === 'POLATLAR')) {
          return false;
        }
        // Exclude if explicit companyCode says POLATLAR
        if (d.companyCode && d.companyCode.toUpperCase() !== 'NESACOCUK') {
          return false;
        }
        return true;
      });

      if (cleanDev28.length !== initialCount) {
        nesaCleanedCount = initialCount - cleanDev28.length;
        const rawJson = JSON.stringify(cleanDev28);
        const chunks = [];
        const chunkSize = 8000;
        for (let i = 0; i < rawJson.length; i += chunkSize) {
          chunks.push(rawJson.slice(i, i + chunkSize));
        }
        await supabaseUpsert('standard_tasks', { id: 28, tasks: chunks });
        results.actionsTaken.push(`Cleaned ${nesaCleanedCount} cross-tenant contaminant device(s) from NESACOCUK Slot 28`);
      }

      results.details.nesaDevicesCount = cleanDev28.length;
      results.details.nesaCleaned = nesaCleanedCount;
    }

    // 3. Audit Slot 8 (POLATLAR registered devices)
    let polatlarCleanedCount = 0;
    const slot8 = await supabaseGet('standard_tasks', 'id=eq.8&select=*');
    if (slot8[0]?.tasks) {
      const dev8 = JSON.parse(slot8[0].tasks.join(''));
      const initialCount = dev8.length;

      const cleanDev8 = dev8.filter((d) => {
        // Exclude Nesa admin sub if accidentally registered in Polatlar
        if (d.pushSubscriptionId && d.pushSubscriptionId === NESA_ADMIN_SUB) {
          return false;
        }
        // Exclude any device registered to a Nesa user
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
        const rawJson = JSON.stringify(cleanDev8);
        const chunks = [];
        const chunkSize = 8000;
        for (let i = 0; i < rawJson.length; i += chunkSize) {
          chunks.push(rawJson.slice(i, i + chunkSize));
        }
        await supabaseUpsert('standard_tasks', { id: 8, tasks: chunks });
        results.actionsTaken.push(`Cleaned ${polatlarCleanedCount} cross-tenant contaminant device(s) from POLATLAR Slot 8`);
      }

      results.details.polatlarDevicesCount = cleanDev8.length;
      results.details.polatlarCleaned = polatlarCleanedCount;
    }

    // 4. OneSignal REST API Health & Connection Check
    try {
      const osRes = await fetch(`https://onesignal.com/api/v1/apps/${ONESIGNAL_APP_ID}`, {
        headers: { Authorization: `Basic ${getApiKey()}` },
      });
      if (osRes.ok) {
        const appData = await osRes.json();
        results.details.oneSignal = {
          connected: true,
          appName: appData.name,
          playersCount: appData.players,
        };
      } else {
        results.details.oneSignal = { connected: false, status: osRes.status };
      }
    } catch (osErr) {
      results.details.oneSignal = { connected: false, error: osErr?.message };
    }

    res.status(200).json(results);
  } catch (err) {
    console.error('Tenant Watchdog execution error:', err);
    res.status(500).json({ status: 'error', error: err?.message || 'Watchdog error' });
  }
}
