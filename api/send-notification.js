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

  // Handle cancellation of scheduled notifications
  if (req.method === 'DELETE' || (req.method === 'POST' && (req.query?.action === 'cancel' || req.body?.action === 'cancel'))) {
    const rawBody = typeof req.body === 'string' ? (req.body ? JSON.parse(req.body) : {}) : (req.body || {});
    const notificationId = req.query?.id || rawBody?.id;
    if (!notificationId) {
      res.status(400).json({ error: 'Missing notification id' });
      return;
    }
    try {
      const response = await fetch(`https://onesignal.com/api/v1/notifications/${notificationId}?app_id=${ONESIGNAL_APP_ID}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Basic ' + getApiKey(),
        },
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
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
    payload.web_url = targetUrl;
    payload.app_url = targetUrl;

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

    if (payload.targetUserIds && Array.isArray(payload.targetUserIds) && payload.targetUserIds.length > 0 && !payload.include_aliases && !payload.include_player_ids) {
      payload.include_aliases = { external_id: payload.targetUserIds };
      payload.target_channel = 'push';
    }

    const delaySeconds = Number(payload.delaySeconds) || 0;
    delete payload.delaySeconds;
    if (delaySeconds > 0 && !payload.send_after) {
      // OneSignal cloud scheduling: Phone locking won't kill network request
      payload.send_after = new Date(Date.now() + delaySeconds * 1000).toISOString();
    }

    // High priority and sound for iOS APNs & Android FCM
    payload.priority = 10;
    payload.ios_sound = 'default';

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

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: 'Basic ' + getApiKey(),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
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
