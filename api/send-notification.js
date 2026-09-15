const ONESIGNAL_APP_ID = '03e50631-8d38-4796-a90f-ae524dab69fd';
const _k = 'b3NfdjJfYXBwX2Fwc3FtbW1uaGJkem5raXB2emplM2szajd4YmV5amhtNGsydXdtZm5jZWhxbXJybWY1YmxreXpjcG00NHRtcGp0ZmdlcTR5NzZkYXlqczQ1dHR1a2Fiam1oYXdsZ3JnZ3lzbGVkeHE=';
const getApiKey = () => (typeof Buffer !== 'undefined' ? Buffer.from(_k, 'base64').toString('utf8') : atob(_k));

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
    delete payload.url;
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

    const delaySeconds = Number(payload.delaySeconds) || 0;
    delete payload.delaySeconds;

    // High priority and sound for iOS APNs & Android FCM
    payload.priority = 10;
    payload.ios_sound = 'default';

    if (delaySeconds > 0 && delaySeconds <= 30) {
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
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
