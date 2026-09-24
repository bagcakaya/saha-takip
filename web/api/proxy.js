// Vercel Serverless Function: HTTPS -> HTTP Proxy Köprüsü
// Web sitesi HTTPS (https://saha-takip-beige.vercel.app) iken tarayıcının 
// Mixed-Content (Güvenli olmayan içerik) engelini tamamen ortadan kaldırır.

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

  const { endpoint, target } = req.query;
  const baseUrl = (target || 'http://81.213.219.69:3001').replace(/\/+$/, '');
  const cleanEndpoint = (endpoint || '/api/health').startsWith('/') ? endpoint : `/${endpoint}`;
  const targetUrl = `${baseUrl}${cleanEndpoint}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Accept': 'application/json',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000); // 9sn timeout
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
    console.error('Proxy Error to', targetUrl, err);
    res.status(502).json({
      status: 'error',
      message: `Yerel sunucuya ulaşılamadı (${err.message}). IP ve 3001 portunu kontrol edin.`,
    });
  }
}
