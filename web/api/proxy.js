// Vercel Serverless Function: HTTPS -> HTTP Güvenli Proxy Köprüsü (SSRF & Open-Proxy Korumalı)
// Web sitesi HTTPS (https://saha-takip-beige.vercel.app) iken tarayıcının
// Mixed-Content (Güvenli olmayan içerik) engelini güvenli şekilde ortadan kaldırır.

const DEFAULT_LOCAL_SERVER = process.env.LOCAL_SERVER_URL || 'http://81.213.219.69:3001';

function isAllowedOrigin(originHeader) {
  if (!originHeader) return true; // Same-origin veya sunucu-içi istekler
  try {
    const parsed = new URL(originHeader);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'saha-takip-beige.vercel.app' ||
      host.endsWith('.vercel.app') ||
      host === '81.213.219.69' ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function resolveSafeTargetBaseUrl(rawTarget) {
  if (!rawTarget || typeof rawTarget !== 'string') {
    return DEFAULT_LOCAL_SERVER;
  }
  try {
    const parsed = new URL(rawTarget.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    // SSRF Koruması: Bulut metadata (169.254.169.254), loopback ve iç ağ adreslerini kesin olarak reddet
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host === '::1' ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return null;
    }
    const port = parsed.port || '3001';
    if (port !== '3001') {
      return null;
    }
    return `${parsed.protocol}//${parsed.hostname}:${port}`;
  } catch {
    return null;
  }
}

function resolveSafeEndpoint(rawEndpoint) {
  const ep = typeof rawEndpoint === 'string' && rawEndpoint.trim() ? rawEndpoint.trim() : '/api/health';
  const normalized = ep.startsWith('/') ? ep : `/${ep}`;
  // Yalnızca /api/ altındaki uç noktalara izin ver, dizin geçişlerini (..) reddet
  if (!normalized.startsWith('/api/') || normalized.includes('..') || normalized.includes('//') || normalized.includes('\\')) {
    return null;
  }
  return normalized;
}

export default async function handler(req, res) {
  const origin = req.headers?.origin;
  if (!isAllowedOrigin(origin)) {
    res.status(403).json({ status: 'error', message: 'Yetkisiz kaynak (Origin) erişimi engellendi.' });
    return;
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://saha-takip-beige.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Saha-Client-Token'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { endpoint, target } = req.query || {};
  const baseUrl = resolveSafeTargetBaseUrl(target);
  const cleanEndpoint = resolveSafeEndpoint(endpoint);

  if (!baseUrl || !cleanEndpoint) {
    res.status(400).json({
      status: 'error',
      message: 'Güvenlik politikası: Geçersiz hedef sunucu veya API uç noktası.',
    });
    return;
  }

  const targetUrl = `${baseUrl}${cleanEndpoint}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        Accept: 'application/json',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    fetchOptions.signal = controller.signal;

    const backendRes = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeout);

    const contentType = backendRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await backendRes.json();
      res.status(backendRes.status).json(data);
    } else {
      const text = await backendRes.text();
      res.status(backendRes.status).send(text);
    }
  } catch (err) {
    const rawErr = String(err?.cause?.code || err?.message || '');
    const isTimeout = err?.name === 'AbortError' || /aborted|timeout|ETIMEDOUT/i.test(rawErr);
    const isRefused = /ECONNREFUSED/i.test(rawErr);

    let friendlyMessage = `Yerel sunucuya (${baseUrl}) ulaşılamadı.`;
    if (isRefused) {
      friendlyMessage = `Sunucuya ulaşıldı ancak Port 3001 kapalı (ECONNREFUSED). Windows Server üzerinde 'yerel_sunucu\\Baslat.bat' servisini başlatın.`;
    } else if (isTimeout) {
      friendlyMessage = `Yerel sunucu (${baseUrl}) yanıt vermedi (Zaman aşımı). Windows Server'da 'yerel_sunucu\\Baslat.bat' servisinin açık olduğundan ve 3001 port yönlendirmesinin aktif olduğundan emin olun.`;
    } else if (rawErr) {
      friendlyMessage = `Yerel sunucuya ulaşılamadı (${rawErr}). Sunucu servisini ve 3001 portunu kontrol edin.`;
    }

    console.error('Proxy Error to', targetUrl, err);
    res.status(502).json({
      status: 'error',
      proxyError: true,
      reason: isRefused ? 'refused' : isTimeout ? 'timeout' : 'unreachable',
      message: friendlyMessage,
    });
  }
}
