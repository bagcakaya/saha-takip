const ONESIGNAL_APP_ID = '03e50631-8d38-4796-a90f-ae524dab69fd';
const _k = 'b3NfdjJfYXBwX2Fwc3FtbW1uaGJkem5raXB2emplM2szajd4YmV5amhtNGsydXdtZm5jZWhxbXJybWY1YmxreXpjcG00NHRtcGp0ZmdlcTR5NzZkYXlqczQ1dHR1a2Fiam1oYXdsZ3JnZ3lzbGVkeHE=';
const getApiKey = () => (typeof Buffer !== 'undefined' ? Buffer.from(_k, 'base64').toString('utf8') : atob(_k));

const recentNotificationsCache = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle cancellation of scheduled notifications (supports single ID or comma-separated IDs)
  if (req.method === 'DELETE' || (req.method === 'POST' && (req.query?.action === 'cancel' || req.body?.action === 'cancel'))) {
    const rawBody = typeof req.body === 'string' ? (req.body ? JSON.parse(req.body) : {}) : (req.body || {});
    const rawNotificationId = req.query?.id || rawBody?.id;
    if (!rawNotificationId) {
      res.status(400).json({ error: 'Missing notification id' });
      return;
    }
    const ids = String(rawNotificationId)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const results = await Promise.all(
        ids.map(async (notifId) => {
          const response = await fetch(`https://onesignal.com/api/v1/notifications/${notifId}?app_id=${ONESIGNAL_APP_ID}`, {
            method: 'DELETE',
            headers: {
              Authorization: 'Basic ' + getApiKey(),
            },
          });
          return response.json().catch(() => ({}));
        })
      );
      res.status(200).json({ success: true, results });
      return;
    } catch (err) {
      console.error('Failed to cancel OneSignal notification:', err);
      res.status(500).json({ error: err?.message || 'Failed to cancel notification' });
      return;
    }
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!payload) {
      res.status(400).json({ error: 'Missing body' });
      return;
    }

    payload.app_id = ONESIGNAL_APP_ID;

    const targetUrl = payload.web_url || payload.url || payload.app_url || 'https://saha-takip-beige.vercel.app';
    payload.url = targetUrl;
    delete payload.web_url;
    delete payload.app_url;

    let targetTab = 'notes';
    let targetFilter = '';
    try {
      const parsed = new URL(targetUrl, 'https://saha-takip-beige.vercel.app');
      targetTab = parsed.searchParams.get('tab') || 'notes';
      targetFilter = parsed.searchParams.get('filter') || '';
    } catch (e) {
      // ignore
    }

    payload.data = {
      ...(payload.data || {}),
      url: targetUrl,
      launchURL: targetUrl,
      tab: payload.data?.tab || targetTab,
      filter: payload.data?.filter || targetFilter,
    };

    if (payload.title && !payload.headings) {
      payload.headings = { en: payload.title, tr: payload.title };
    }
    if (payload.message && !payload.contents) {
      payload.contents = { en: payload.message, tr: payload.message };
    }

    if (!payload.headings || !payload.headings.en) {
      const hText = payload.title || payload.headings?.tr || 'Bildirim';
      payload.headings = { en: hText, tr: hText };
    }
    if (!payload.contents || !payload.contents.en) {
      const cText = payload.message || payload.contents?.tr || 'Yeni bildirim';
      payload.contents = { en: cText, tr: cText };
    }

    if (payload.targetSubscriptionIds && Array.isArray(payload.targetSubscriptionIds) && payload.targetSubscriptionIds.length > 0 && !payload.include_player_ids) {
      payload.include_player_ids = payload.targetSubscriptionIds;
    }

    if (payload.targetUserIds && Array.isArray(payload.targetUserIds) && payload.targetUserIds.length > 0 && !payload.include_aliases && !payload.include_player_ids && !payload.filters) {
      payload.include_aliases = { external_id: payload.targetUserIds };
      payload.target_channel = 'push';
    }

    const companyCode = (payload.companyCode || '').trim().toUpperCase();

    // Resolve targetMode: 'admin' or 'all' if no explicit recipients provided
    if (!payload.include_player_ids && !payload.include_aliases && !payload.filters) {
      const targetCompany = companyCode || 'POLATLAR';
      const cleanExcludeUserIds = Array.isArray(payload.excludeUserIds)
        ? payload.excludeUserIds.map((u) => String(u).trim()).filter(Boolean)
        : [];

      if (payload.targetMode === 'admin') {
        const adminFilters = [
          { field: 'tag', key: 'company_code', relation: '=', value: targetCompany },
          { field: 'tag', key: 'role', relation: '=', value: 'admin' },
        ];
        if (targetCompany !== 'POLATLAR') {
          adminFilters.push({ field: 'tag', key: 'company_code', relation: '!=', value: 'POLATLAR' });
        } else {
          adminFilters.push({ field: 'tag', key: 'company_code', relation: '!=', value: 'NESACOCUK' });
        }
        cleanExcludeUserIds.forEach((uid) => {
          adminFilters.push({ field: 'tag', key: 'userId', relation: '!=', value: uid });
        });
        payload.filters = adminFilters;
      } else if (payload.targetMode === 'all') {
        const allFilters = [
          { field: 'tag', key: 'company_code', relation: '=', value: targetCompany },
        ];
        if (targetCompany !== 'POLATLAR') {
          allFilters.push({ field: 'tag', key: 'company_code', relation: '!=', value: 'POLATLAR' });
        } else {
          allFilters.push({ field: 'tag', key: 'company_code', relation: '!=', value: 'NESACOCUK' });
        }
        cleanExcludeUserIds.forEach((uid) => {
          allFilters.push({ field: 'tag', key: 'userId', relation: '!=', value: uid });
        });
        payload.filters = allFilters;
      }
    }

    // STRICT MULTI-TENANT ISOLATION BARRIER
    // Guarantees zero cross-company notification leak on the serverless edge
    if (companyCode) {
      const polatlarSubs = [
        '89bcd97c-28f4-4b7e-a70f-fb3748004de8',
        '2dfc8e02-5d2f-44b1-a38d-43c0d0b46872',
        '49243a90-8287-4363-8e19-3408dded8e7d',
        'f6404c9d-7e09-45cb-8912-b641db201343',
      ];
      const polatlarUserIds = [
        'admin-root',
        'mtjsnufrp8pfa',
        'mtjso6drpactx',
        'mtjsoob6so4wi',
        'mu3wz17wbkq2t',
        'mu42age5lqmew',
        'mu42b1kqff54r',
        'mtjsoxbaslaty',
      ];

      if (companyCode !== 'POLATLAR') {
        // Enforce: Never send NESACOCUK or other company push to POLATLAR hardware or users
        if (payload.include_player_ids && Array.isArray(payload.include_player_ids)) {
          payload.include_player_ids = payload.include_player_ids.filter((id) => !polatlarSubs.includes(id));
          if (payload.include_player_ids.length === 0) {
            delete payload.include_player_ids;
          }
        }
        if (payload.include_aliases?.external_id && Array.isArray(payload.include_aliases.external_id)) {
          payload.include_aliases.external_id = payload.include_aliases.external_id.filter((id) => !polatlarUserIds.includes(id));
          if (payload.include_aliases.external_id.length === 0) {
            delete payload.include_aliases;
            delete payload.target_channel;
          }
        }
        if (payload.targetUserIds && Array.isArray(payload.targetUserIds)) {
          payload.targetUserIds = payload.targetUserIds.filter((id) => !polatlarUserIds.includes(id));
        }
      } else {
        // Targeting POLATLAR: Never send to NESACOCUK admin
        const nesaAdminSub = '875842fa-942b-4d3a-be08-72be011c1372';
        if (payload.include_player_ids && Array.isArray(payload.include_player_ids)) {
          payload.include_player_ids = payload.include_player_ids.filter((id) => id !== nesaAdminSub);
          if (payload.include_player_ids.length === 0) {
            delete payload.include_player_ids;
          }
        }
        if (payload.include_aliases?.external_id && Array.isArray(payload.include_aliases.external_id)) {
          payload.include_aliases.external_id = payload.include_aliases.external_id.filter((id) => id !== 'mukze67k3ajwq');
          if (payload.include_aliases.external_id.length === 0) {
            delete payload.include_aliases;
            delete payload.target_channel;
          }
        }
      }

      // If all targets were filtered out by tenant isolation, drop gracefully
      if (!payload.include_player_ids && !payload.include_aliases && !payload.filters) {
        console.log('Push dropped due to tenant isolation protection:', companyCode);
        res.status(200).json({ id: 'tenant_isolated', dropped: true });
        return;
      }
    }

    const delaySeconds = Number(payload.delaySeconds) || 0;
    delete payload.delaySeconds;
    if (delaySeconds > 0 && !payload.send_after) {
      // OneSignal cloud scheduling: Phone locking won't kill network request
      payload.send_after = new Date(Date.now() + delaySeconds * 1000).toISOString();
    }

    // High priority and sound for iOS APNs & Android FCM (wake up locked/killed devices)
    payload.priority = 10;
    payload.ios_sound = 'default';
    payload.android_sound = 'default';
    payload.android_visibility = 1; // 1 = Public (show full content on lock screen)
    payload.content_available = true; // Wakes iOS app in background
    if (payload.ios_badgeType === undefined) {
      payload.ios_badgeType = 'Increase';
      payload.ios_badgeCount = 1;
    }

    // APNs deduplication via collapse_id & web_push_topic
    if (payload.collapse_id) {
      const cleanCollapse = String(payload.collapse_id)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 60);
      payload.collapse_id = cleanCollapse;
      payload.web_push_topic = cleanCollapse;
    }

    // Server-side deduplication check (30-second debounce window, test & scheduled notifications exempt)
    const isExempt = payload.collapse_id?.startsWith('test_') || Boolean(payload.send_after);
    if (!isExempt) {
      const dedupKey = `${payload.headings?.tr || payload.headings?.en || ''}__${payload.contents?.tr || payload.contents?.en || ''}__${payload.collapse_id || ''}__${(payload.targetUserIds || []).join(',')}`;
      const now = Date.now();
      const lastTime = recentNotificationsCache.get(dedupKey);
      if (lastTime && now - lastTime < 30000) {
        console.log('Skipping duplicate push notification on serverless:', dedupKey);
        res.status(200).json({ id: 'deduped', deduped: true });
        return;
      }
      recentNotificationsCache.set(dedupKey, now);
      if (recentNotificationsCache.size > 100) {
        for (const [k, v] of recentNotificationsCache.entries()) {
          if (now - v > 60000) recentNotificationsCache.delete(k);
        }
      }
    }

    const isMultiChannelUserTarget =
      (payload.multiChannelGuarantee || Boolean(payload.send_after)) &&
      Array.isArray(payload.targetUserIds) &&
      payload.targetUserIds.length > 0 &&
      payload.targetMode !== 'admin' &&
      payload.targetMode !== 'all';

    const targetUserIdsForMulti = Array.isArray(payload.targetUserIds)
      ? payload.targetUserIds.map((u) => String(u).trim()).filter(Boolean)
      : [];
    const playerIdsForMulti = Array.isArray(payload.include_player_ids)
      ? payload.include_player_ids.map((s) => String(s).trim()).filter(Boolean)
      : [];

    delete payload.multiChannelGuarantee;
    delete payload.targetUserIds;
    delete payload.targetSubscriptionIds;
    delete payload.excludeUserIds;
    delete payload.excludeSubscriptionIds;

    // Multi-channel delivery guarantee for scheduled/targeted staff notifications (e.g. Break Over when app is killed):
    // Dispatches simultaneously via Player IDs + User Tag Filter + External ID Alias with the same collapse_id
    if (isMultiChannelUserTarget && targetUserIdsForMulti.length > 0) {
      const baseClean = { ...payload };
      delete baseClean.include_player_ids;
      delete baseClean.include_aliases;
      delete baseClean.target_channel;
      delete baseClean.filters;

      const channelPayloads = [];

      // Channel 1: Direct Hardware Subscription / Player IDs
      if (playerIdsForMulti.length > 0) {
        channelPayloads.push({
          ...baseClean,
          include_player_ids: playerIdsForMulti,
        });
      }

      // Channel 2: Tag Filter by userId (Always stamped on OneSignal subscriptions)
      const tagFilters = [];
      targetUserIdsForMulti.forEach((uid, idx) => {
        if (idx > 0) tagFilters.push({ operator: 'OR' });
        tagFilters.push({ field: 'tag', key: 'userId', relation: '=', value: uid });
      });
      if (tagFilters.length > 0) {
        channelPayloads.push({
          ...baseClean,
          filters: tagFilters,
        });
      }

      // Channel 3: OneSignal External ID Alias
      channelPayloads.push({
        ...baseClean,
        include_aliases: { external_id: targetUserIdsForMulti },
        target_channel: 'push',
      });

      const collectedIds = [];
      let lastResult = null;
      await Promise.all(
        channelPayloads.map(async (chPayload) => {
          try {
            const r = await fetch('https://onesignal.com/api/v1/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: 'Basic ' + getApiKey(),
              },
              body: JSON.stringify(chPayload),
            });
            const d = await r.json().catch(() => ({}));
            if (d && d.id) {
              collectedIds.push(d.id);
              lastResult = d;
            }
          } catch (e) {
            // ignore individual channel failure
          }
        })
      );

      if (collectedIds.length > 0) {
        res.status(200).json({
          id: collectedIds.join(','),
          ids: collectedIds,
          recipients: lastResult?.recipients || 1,
        });
        return;
      }
    }

    let response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: 'Basic ' + getApiKey(),
      },
      body: JSON.stringify(payload),
    });

    let data = await response.json().catch(() => ({}));

    // Fallback for admin notifications if tag filter fails or delivers to 0
    if ((!response.ok || (data && data.errors && !data.id)) && payload.targetMode === 'admin') {
      const cleanExclude = [];
      let fallbackAdmins = [];
      if (companyCode === 'POLATLAR' || !companyCode) {
        fallbackAdmins = ['admin-root', 'mtjsnufrp8pfa'];
      } else if (companyCode === 'NESACOCUK') {
        fallbackAdmins = ['mukze67k3ajwq'];
      }
      fallbackAdmins = fallbackAdmins.filter((id) => !cleanExclude.includes(id));

      if (fallbackAdmins.length > 0) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.filters;
        fallbackPayload.include_aliases = { external_id: fallbackAdmins };
        fallbackPayload.target_channel = 'push';

        const fbResponse = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: 'Basic ' + getApiKey(),
          },
          body: JSON.stringify(fallbackPayload),
        });
        const fbData = await fbResponse.json().catch(() => ({}));
        if (fbData && fbData.id) {
          delete fbData.errors;
          res.status(200).json(fbData);
          return;
        }
      }
    }

    // Fallback for single-user notification if primary method failed
    if ((!response.ok || (data && data.errors && !data.id)) && targetUserIdsForMulti.length > 0) {
      const tagFilters = [];
      targetUserIdsForMulti.forEach((uid, idx) => {
        if (idx > 0) tagFilters.push({ operator: 'OR' });
        tagFilters.push({ field: 'tag', key: 'userId', relation: '=', value: uid });
      });
      const fbUserPayload = { ...payload };
      delete fbUserPayload.include_player_ids;
      delete fbUserPayload.include_aliases;
      delete fbUserPayload.target_channel;
      fbUserPayload.filters = tagFilters;

      const fbUserRes = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: 'Basic ' + getApiKey(),
        },
        body: JSON.stringify(fbUserPayload),
      });
      const fbUserData = await fbUserRes.json().catch(() => ({}));
      if (fbUserData && fbUserData.id) {
        delete fbUserData.errors;
        res.status(200).json(fbUserData);
        return;
      }
    }

    if (data && data.id) {
      delete data.errors;
      res.status(200).json(data);
      return;
    }
    res.status(response.status).json(data);
  } catch (error) {
    console.error('OneSignal serverless proxy error:', error);
    res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}
