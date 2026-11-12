const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { sql, getPool } = require('./db');
const { runCloudSync } = require('./cloudSync');
const { runShiftWatchdog } = require('./shiftWatchdog');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const errorLogPath = path.join(__dirname, 'sunucu_hata.log');

function appendServerErrorLog(tag, err) {
  try {
    const detail = err && err.stack ? err.stack : String(err);
    const line = `[${new Date().toISOString()}] [${tag}] ${detail}\n`;
    fs.appendFileSync(errorLogPath, line, 'utf8');
  } catch {
    // ignore file logging errors
  }
}

// Beklenmeyen hatalarda Node.js servisinin kapanmasını önleyen koruma kalkanı
process.on('uncaughtException', (err) => {
  console.error('>> [KRİTİK KORUMA] Yakalanmamış Hata (Servis çalışmaya devam ediyor):', err);
  appendServerErrorLog('uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('>> [KRİTİK KORUMA] İşlenmemiş Promise Hatası (Servis çalışmaya devam ediyor):', reason);
  appendServerErrorLog('unhandledRejection', reason);
});

// Middleware & Güvenlik Başlıkları
app.disable('x-powered-by');

function isTrustedHostName(host) {
  if (!host) return false;
  const clean = String(host).toLowerCase().trim();
  return (
    clean === 'saha-takip-beige.vercel.app' ||
    clean.endsWith('.vercel.app') ||
    clean === '81.213.219.69' ||
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    clean === '[::1]'
  );
}

function isLoopbackIp(req) {
  const rawIp = req.socket?.remoteAddress || '';
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return false;
  return rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '::ffff:127.0.0.1';
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const parsed = new URL(origin);
        if (
          parsed.protocol === 'capacitor:' ||
          parsed.protocol === 'ionic:' ||
          isTrustedHostName(parsed.hostname)
        ) {
          return callback(null, true);
        }
      } catch {}
      return callback(new Error('Yetkisiz CORS kaynağı (Origin) engellendi.'));
    },
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // API uç noktalarını dış ağdan gelen tarayıcı-dışı bot/script (curl, python, scanner) saldırılarına karşı koru
  if (req.path.startsWith('/api/') && req.method !== 'OPTIONS' && !isLoopbackIp(req)) {
    const clientToken = String(req.headers['x-saha-client-token'] || '');
    const origin = String(req.headers['origin'] || '');
    const referer = String(req.headers['referer'] || '');
    const secFetchSite = String(req.headers['sec-fetch-site'] || '');
    const ua = String(req.headers['user-agent'] || '').toLowerCase();

    let hasTrustedOriginOrReferer = false;
    for (const candidate of [origin, referer]) {
      if (!candidate) continue;
      try {
        const u = new URL(candidate);
        if (u.protocol === 'capacitor:' || u.protocol === 'ionic:' || isTrustedHostName(u.hostname)) {
          hasTrustedOriginOrReferer = true;
        } else {
          return res.status(403).json({ error: 'Yetkisiz kaynak (Origin/Referer) erişimi engellendi.' });
        }
      } catch {}
    }

    const isAutomatedScanner =
      /curl\/|python-requests|python-urllib|go-http-client|postmanruntime|insomnia|sqlmap|nikto|nmap|masscan|zgrab/i.test(ua);
    if (isAutomatedScanner && !clientToken.startsWith('saha-')) {
      return res.status(403).json({ error: 'Otomatik tarama / bot aracı erişimi engellendi.' });
    }

    const isVerifiedClient =
      clientToken.startsWith('saha-') ||
      hasTrustedOriginOrReferer ||
      secFetchSite === 'same-origin' ||
      secFetchSite === 'same-site';

    // Hassas veri okuma/yazma uç noktalarında doğrulanmış istemci veya tarayıcı bağlamı zorunludur
    if (!isVerifiedClient && req.path !== '/api/health' && req.path !== '/api/web-status') {
      return res.status(403).json({ error: 'Yetkisiz doğrudan API erişimi engellendi.' });
    }
  }

  next();
});
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Hafif Bellek İçi Hız Sınırlayıcı (DoS / Taşma Saldırı Koruması - Normal kullanımı asla etkilemez)
const ipRateBuckets = new Map();
function checkIpRateLimit(req, bucketName, maxRequestsPerMinute = 180) {
  try {
    if (isLoopbackIp(req)) {
      return true;
    }
    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local';
    const ip = String(rawIp).split(',')[0].trim();
    const key = `${bucketName}:${ip}`;
    const now = Date.now();
    const entry = ipRateBuckets.get(key);
    if (!entry || now - entry.windowStart > 60000) {
      ipRateBuckets.set(key, { windowStart: now, count: 1 });
      if (ipRateBuckets.size > 1000) {
        for (const [k, v] of ipRateBuckets.entries()) {
          if (now - v.windowStart > 120000) ipRateBuckets.delete(k);
        }
      }
      return true;
    }
    entry.count += 1;
    return entry.count <= maxRequestsPerMinute;
  } catch {
    return true;
  }
}

// Fotoğraf Yükleme Dizini
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Statik Dosya Erişimi (Fotoğraflar için - Script çalıştırma korumalı)
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
    next();
  },
  express.static(uploadDir)
);

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.bmp']);
const BLOCKED_UPLOAD_EXTS = new Set([
  '.html', '.htm', '.svg', '.xml', '.xhtml', '.js', '.mjs', '.cjs', '.ts',
  '.php', '.asp', '.aspx', '.jsp', '.exe', '.bat', '.cmd', '.ps1', '.sh', '.vbs',
]);

// Multer Disk Storage Yapılandırması (Güvenli Uzantı ve MIME Kontrolü)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const rawExt = (path.extname(file.originalname || '') || '.jpg').toLowerCase();
    const safeExt = ALLOWED_IMAGE_EXTS.has(rawExt) ? rawExt : '.jpg';
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${safeExt}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const rawExt = (path.extname(file.originalname || '') || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    if (
      BLOCKED_UPLOAD_EXTS.has(rawExt) ||
      mime.includes('html') ||
      mime.includes('svg') ||
      mime.includes('javascript') ||
      mime.includes('ecmascript') ||
      mime.includes('x-msdownload')
    ) {
      return cb(new Error('Güvenlik nedeniyle yalnızca fotoğraf/görsel dosyaları yüklenebilir.'));
    }
    cb(null, true);
  },
});

// =========================================================================
// 1. HEALTH CHECK ENDPOINT
// =========================================================================
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 AS ok');
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      database: result.recordset[0].ok === 1 ? 'connected' : 'unknown',
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// =========================================================================
// 2. STANDARD_TASKS ENDPOINTS (Slot Mimarisi: Mesai, İzin, Şablon, vb.)
// =========================================================================
app.get('/api/standard_tasks/:id', async (req, res) => {
  try {
    const slotId = parseInt(req.params.id, 10);
    if (!Number.isInteger(slotId) || slotId <= 0) {
      return res.status(400).json({ error: 'Geçersiz slot ID' });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, slotId)
      .query('SELECT tasks FROM dbo.standard_tasks WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ tasks: [], notFound: true });
    }

    const rawTasks = result.recordset[0].tasks;
    let parsed = [];
    try {
      parsed = JSON.parse(rawTasks);
    } catch {
      parsed = [rawTasks];
    }

    res.json({ id: slotId, tasks: parsed, notFound: false });
  } catch (err) {
    console.error('standard_tasks GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/standard_tasks/:id', async (req, res) => {
  try {
    if (!checkIpRateLimit(req, 'slot_write', 300)) {
      return res.status(429).json({ error: 'Çok fazla yazma isteği gönderildi.' });
    }
    const slotId = parseInt(req.params.id, 10);
    if (!Number.isInteger(slotId) || slotId <= 0) {
      return res.status(400).json({ error: 'Geçersiz slot ID' });
    }
    const { tasks } = req.body;
    const tasksJson = JSON.stringify(Array.isArray(tasks) ? tasks : []);

    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.Int, slotId)
      .input('tasks', sql.NVarChar(sql.MAX), tasksJson)
      .query(`
        MERGE dbo.standard_tasks AS target
        USING (SELECT @id AS id) AS source
        ON (target.id = source.id)
        WHEN MATCHED THEN
          UPDATE SET tasks = @tasks, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (id, tasks, updated_at) VALUES (@id, @tasks, SYSUTCDATETIME());
      `);

    res.json({ success: true, id: slotId });
  } catch (err) {
    console.error('standard_tasks POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 3. GENEL TABLOLAR (locations, notes, services, return_warranty, app_users)
// =========================================================================
const ALLOWED_TABLES = ['locations', 'notes', 'services', 'return_warranty', 'app_users'];

function validateTable(tableName) {
  if (!ALLOWED_TABLES.includes(tableName)) {
    throw new Error(`Geçersiz tablo adı: ${tableName}`);
  }
}

// Tablo verilerini listele
app.get('/api/tables/:table', async (req, res) => {
  try {
    const tableName = req.params.table;
    validateTable(tableName);

    const pool = await getPool();
    const result = await pool.request().query(`SELECT * FROM dbo.[${tableName}]`);

    // Array / JSON alanlarını parse ederek döndür
    const formatted = result.recordset.map((row) => {
      const copy = { ...row };
      for (const key of Object.keys(copy)) {
        if (typeof copy[key] === 'string' && (copy[key].startsWith('[') || copy[key].startsWith('{'))) {
          try {
            copy[key] = JSON.parse(copy[key]);
          } catch {
            // normal metin
          }
        }
      }
      return copy;
    });

    res.json(formatted);
  } catch (err) {
    console.error(`GET /api/tables/${req.params.table} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Tabloya toplu veya tekil upsert (Satır Sınırı & Hız Sınırı Korumalı)
app.post('/api/tables/:table/upsert', async (req, res) => {
  try {
    if (!checkIpRateLimit(req, 'table_upsert', 240)) {
      return res.status(429).json({ error: 'Çok fazla tablo güncelleme isteği gönderildi.' });
    }
    const tableName = req.params.table;
    validateTable(tableName);

    const rawRows = req.body.rows || (req.body.id ? [req.body] : []);
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const safeRows = rawRows.slice(0, 2500);
    const pool = await getPool();

    for (const row of safeRows) {
      if (!row || typeof row !== 'object' || !row.id) continue;

      if (tableName === 'locations') {
        await pool
          .request()
          .input('id', sql.NVarChar(100), String(row.id))
          .input('name', sql.NVarChar(255), row.name || '')
          .input('address', sql.NVarChar(500), row.address || null)
          .input('notes', sql.NVarChar(sql.MAX), row.notes || null)
          .input('photos', sql.NVarChar(sql.MAX), JSON.stringify(row.photos || []))
          .input('latitude', sql.Float, row.latitude || null)
          .input('longitude', sql.Float, row.longitude || null)
          .input('created_at', sql.BigInt, row.created_at || null)
          .input('created_by', sql.NVarChar(100), row.created_by || null)
          .input('created_by_name', sql.NVarChar(255), row.created_by_name || null)
          .input('tasks', sql.NVarChar(sql.MAX), JSON.stringify(row.tasks || []))
          .input('status', sql.NVarChar(50), row.status || 'pending')
          .input('completed_at', sql.BigInt, row.completed_at || null)
          .input('completed_by', sql.NVarChar(100), row.completed_by || null)
          .input('completed_by_name', sql.NVarChar(255), row.completed_by_name || null)
          .input('completion_note', sql.NVarChar(sql.MAX), row.completion_note || null)
          .input('completion_photos', sql.NVarChar(sql.MAX), JSON.stringify(row.completion_photos || []))
          .input('approved_at', sql.BigInt, row.approved_at || null)
          .input('approved_by', sql.NVarChar(100), row.approved_by || null)
          .input('approved_by_name', sql.NVarChar(255), row.approved_by_name || null)
          .input('rejected_at', sql.BigInt, row.rejected_at || null)
          .input('rejected_by', sql.NVarChar(100), row.rejected_by || null)
          .input('rejected_by_name', sql.NVarChar(255), row.rejected_by_name || null)
          .input('rejection_reason', sql.NVarChar(sql.MAX), row.rejection_reason || null)
          .query(`
            MERGE dbo.locations AS target
            USING (SELECT @id AS id) AS source
            ON (target.id = source.id)
            WHEN MATCHED THEN
              UPDATE SET name=@name, address=@address, notes=@notes, photos=@photos, latitude=@latitude, longitude=@longitude,
                         created_at=@created_at, created_by=@created_by, created_by_name=@created_by_name, tasks=@tasks,
                         status=@status, completed_at=@completed_at, completed_by=@completed_by, completed_by_name=@completed_by_name,
                         completion_note=@completion_note, completion_photos=@completion_photos, approved_at=@approved_at,
                         approved_by=@approved_by, approved_by_name=@approved_by_name, rejected_at=@rejected_at,
                         rejected_by=@rejected_by, rejected_by_name=@rejected_by_name, rejection_reason=@rejection_reason,
                         updated_at=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
              INSERT (id, name, address, notes, photos, latitude, longitude, created_at, created_by, created_by_name, tasks, status, completed_at, completed_by, completed_by_name, completion_note, completion_photos, approved_at, approved_by, approved_by_name, rejected_at, rejected_by, rejected_by_name, rejection_reason, updated_at)
              VALUES (@id, @name, @address, @notes, @photos, @latitude, @longitude, @created_at, @created_by, @created_by_name, @tasks, @status, @completed_at, @completed_by, @completed_by_name, @completion_note, @completion_photos, @approved_at, @approved_by, @approved_by_name, @rejected_at, @rejected_by, @rejected_by_name, @rejection_reason, SYSUTCDATETIME());
          `);
      } else if (tableName === 'notes') {
        try {
          await pool
            .request()
            .input('id', sql.NVarChar(100), String(row.id))
            .input('content', sql.NVarChar(sql.MAX), row.content || '')
            .input('cari_name', sql.NVarChar(255), row.cari_name || null)
            .input('created_at', sql.BigInt, row.created_at || Date.now())
            .input('created_by', sql.NVarChar(100), row.created_by || null)
            .input('created_by_name', sql.NVarChar(255), row.created_by_name || null)
            .input('target_mode', sql.NVarChar(50), row.target_mode || 'self')
            .input('target_user_ids', sql.NVarChar(sql.MAX), JSON.stringify(row.target_user_ids || []))
            .input('target_user_names', sql.NVarChar(sql.MAX), JSON.stringify(row.target_user_names || []))
            .input('target_user_id', sql.NVarChar(100), row.target_user_id || null)
            .input('target_user_name', sql.NVarChar(255), row.target_user_name || null)
            .input('reminder_active', sql.Bit, row.reminder_active ? 1 : 0)
            .input('reminder_date', sql.NVarChar(50), row.reminder_date || null)
            .input('notified', sql.Bit, row.notified ? 1 : 0)
            .input('status', sql.NVarChar(50), row.status || 'pending')
            .input('completed_at', sql.BigInt, row.completed_at || null)
            .input('completed_by', sql.NVarChar(100), row.completed_by || null)
            .input('completed_by_name', sql.NVarChar(255), row.completed_by_name || null)
            .input('completion_note', sql.NVarChar(sql.MAX), row.completion_note || null)
            .input('approved_at', sql.BigInt, row.approved_at || null)
            .input('approved_by', sql.NVarChar(100), row.approved_by || null)
            .input('approved_by_name', sql.NVarChar(255), row.approved_by_name || null)
            .input('rejected_at', sql.BigInt, row.rejected_at || null)
            .input('rejected_by', sql.NVarChar(100), row.rejected_by || null)
            .input('rejected_by_name', sql.NVarChar(255), row.rejected_by_name || null)
            .input('rejection_reason', sql.NVarChar(sql.MAX), row.rejection_reason || null)
            .input('processed_at', sql.BigInt, row.processed_at || null)
            .input('processed_by', sql.NVarChar(100), row.processed_by || null)
            .input('processed_by_name', sql.NVarChar(255), row.processed_by_name || null)
            .input('used_materials', sql.NVarChar(sql.MAX), row.used_materials || null)
            .input('photos', sql.NVarChar(sql.MAX), JSON.stringify(row.photos || []))
            .input('completion_photos', sql.NVarChar(sql.MAX), JSON.stringify(row.completion_photos || []))
            .input('read_by', sql.NVarChar(sql.MAX), JSON.stringify(row.read_by || []))
            .query(`
              IF COL_LENGTH('dbo.notes', 'cari_name') IS NULL
                ALTER TABLE dbo.notes ADD cari_name NVARCHAR(255) NULL;
              IF COL_LENGTH('dbo.notes', 'used_materials') IS NULL
                ALTER TABLE dbo.notes ADD used_materials NVARCHAR(MAX) NULL;
              IF COL_LENGTH('dbo.notes', 'photos') IS NULL
                ALTER TABLE dbo.notes ADD photos NVARCHAR(MAX) NULL;
              IF COL_LENGTH('dbo.notes', 'completion_photos') IS NULL
                ALTER TABLE dbo.notes ADD completion_photos NVARCHAR(MAX) NULL;
              IF COL_LENGTH('dbo.notes', 'read_by') IS NULL
                ALTER TABLE dbo.notes ADD read_by NVARCHAR(MAX) NULL;
              IF COL_LENGTH('dbo.notes', 'processed_at') IS NULL
                ALTER TABLE dbo.notes ADD processed_at BIGINT NULL;
              IF COL_LENGTH('dbo.notes', 'processed_by') IS NULL
                ALTER TABLE dbo.notes ADD processed_by NVARCHAR(100) NULL;
              IF COL_LENGTH('dbo.notes', 'processed_by_name') IS NULL
                ALTER TABLE dbo.notes ADD processed_by_name NVARCHAR(255) NULL;

              MERGE dbo.notes AS target
              USING (SELECT @id AS id) AS source
              ON (target.id = source.id)
              WHEN MATCHED THEN
                UPDATE SET content=@content, cari_name=COALESCE(@cari_name, target.cari_name), created_at=@created_at, created_by=@created_by, created_by_name=@created_by_name,
                           target_mode=@target_mode, target_user_ids=@target_user_ids, target_user_names=@target_user_names,
                           target_user_id=@target_user_id, target_user_name=@target_user_name, reminder_active=@reminder_active,
                           reminder_date=@reminder_date, notified=@notified, status=@status, completed_at=@completed_at,
                           completed_by=@completed_by, completed_by_name=@completed_by_name, completion_note=@completion_note,
                           approved_at=@approved_at, approved_by=@approved_by, approved_by_name=@approved_by_name,
                           rejected_at=@rejected_at, rejected_by=@rejected_by, rejected_by_name=@rejected_by_name,
                           rejection_reason=@rejection_reason, processed_at=@processed_at, processed_by=@processed_by,
                           processed_by_name=@processed_by_name, used_materials=COALESCE(@used_materials, target.used_materials),
                           photos=CASE WHEN @photos = '[]' AND target.photos IS NOT NULL THEN target.photos ELSE @photos END,
                           completion_photos=CASE WHEN @completion_photos = '[]' AND target.completion_photos IS NOT NULL THEN target.completion_photos ELSE @completion_photos END,
                           read_by=CASE WHEN @read_by = '[]' AND target.read_by IS NOT NULL THEN target.read_by ELSE @read_by END,
                           updated_at=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN
                INSERT (id, content, cari_name, created_at, created_by, created_by_name, target_mode, target_user_ids, target_user_names, target_user_id, target_user_name, reminder_active, reminder_date, notified, status, completed_at, completed_by, completed_by_name, completion_note, approved_at, approved_by, approved_by_name, rejected_at, rejected_by, rejected_by_name, rejection_reason, processed_at, processed_by, processed_by_name, used_materials, photos, completion_photos, read_by, updated_at)
                VALUES (@id, @content, @cari_name, @created_at, @created_by, @created_by_name, @target_mode, @target_user_ids, @target_user_names, @target_user_id, @target_user_name, @reminder_active, @reminder_date, @notified, @status, @completed_at, @completed_by, @completed_by_name, @completion_note, @approved_at, @approved_by, @approved_by_name, @rejected_at, @rejected_by, @rejected_by_name, @rejection_reason, @processed_at, @processed_by, @processed_by_name, @used_materials, @photos, @completion_photos, @read_by, SYSUTCDATETIME());
            `);
        } catch {
          await pool
            .request()
            .input('id', sql.NVarChar(100), String(row.id))
            .input('content', sql.NVarChar(sql.MAX), row.content || '')
            .input('created_at', sql.BigInt, row.created_at || Date.now())
            .input('created_by', sql.NVarChar(100), row.created_by || null)
            .input('created_by_name', sql.NVarChar(255), row.created_by_name || null)
            .input('target_mode', sql.NVarChar(50), row.target_mode || 'self')
            .input('target_user_ids', sql.NVarChar(sql.MAX), JSON.stringify(row.target_user_ids || []))
            .input('target_user_names', sql.NVarChar(sql.MAX), JSON.stringify(row.target_user_names || []))
            .input('target_user_id', sql.NVarChar(100), row.target_user_id || null)
            .input('target_user_name', sql.NVarChar(255), row.target_user_name || null)
            .input('reminder_active', sql.Bit, row.reminder_active ? 1 : 0)
            .input('reminder_date', sql.NVarChar(50), row.reminder_date || null)
            .input('notified', sql.Bit, row.notified ? 1 : 0)
            .input('status', sql.NVarChar(50), row.status || 'pending')
            .input('completed_at', sql.BigInt, row.completed_at || null)
            .input('completed_by', sql.NVarChar(100), row.completed_by || null)
            .input('completed_by_name', sql.NVarChar(255), row.completed_by_name || null)
            .input('completion_note', sql.NVarChar(sql.MAX), row.completion_note || null)
            .input('approved_at', sql.BigInt, row.approved_at || null)
            .input('approved_by', sql.NVarChar(100), row.approved_by || null)
            .input('approved_by_name', sql.NVarChar(255), row.approved_by_name || null)
            .input('rejected_at', sql.BigInt, row.rejected_at || null)
            .input('rejected_by', sql.NVarChar(100), row.rejected_by || null)
            .input('rejected_by_name', sql.NVarChar(255), row.rejected_by_name || null)
            .input('rejection_reason', sql.NVarChar(sql.MAX), row.rejection_reason || null)
            .query(`
              MERGE dbo.notes AS target
              USING (SELECT @id AS id) AS source
              ON (target.id = source.id)
              WHEN MATCHED THEN
                UPDATE SET content=@content, created_at=@created_at, created_by=@created_by, created_by_name=@created_by_name,
                           target_mode=@target_mode, target_user_ids=@target_user_ids, target_user_names=@target_user_names,
                           target_user_id=@target_user_id, target_user_name=@target_user_name, reminder_active=@reminder_active,
                           reminder_date=@reminder_date, notified=@notified, status=@status, completed_at=@completed_at,
                           completed_by=@completed_by, completed_by_name=@completed_by_name, completion_note=@completion_note,
                           approved_at=@approved_at, approved_by=@approved_by, approved_by_name=@approved_by_name,
                           rejected_at=@rejected_at, rejected_by=@rejected_by, rejected_by_name=@rejected_by_name,
                           rejection_reason=@rejection_reason, updated_at=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN
                INSERT (id, content, created_at, created_by, created_by_name, target_mode, target_user_ids, target_user_names, target_user_id, target_user_name, reminder_active, reminder_date, notified, status, completed_at, completed_by, completed_by_name, completion_note, approved_at, approved_by, approved_by_name, rejected_at, rejected_by, rejected_by_name, rejection_reason, updated_at)
                VALUES (@id, @content, @created_at, @created_by, @created_by_name, @target_mode, @target_user_ids, @target_user_names, @target_user_id, @target_user_name, @reminder_active, @reminder_date, @notified, @status, @completed_at, @completed_by, @completed_by_name, @completion_note, @approved_at, @approved_by, @approved_by_name, @rejected_at, @rejected_by, @rejected_by_name, @rejection_reason, SYSUTCDATETIME());
            `);
        }
      } else if (tableName === 'services') {
        try {
          await pool
            .request()
            .input('id', sql.NVarChar(100), String(row.id))
            .input('company_name', sql.NVarChar(255), row.company_name || '')
            .input('cari_name', sql.NVarChar(255), row.cari_name || null)
            .input('location', sql.NVarChar(255), row.location || null)
            .input('latitude', sql.Float, row.latitude || null)
            .input('longitude', sql.Float, row.longitude || null)
            .input('work_done', sql.NVarChar(sql.MAX), row.work_done || '')
            .input('date', sql.NVarChar(50), row.date || null)
            .input('photos', sql.NVarChar(sql.MAX), JSON.stringify(row.photos || []))
            .input('created_at', sql.BigInt, row.created_at || Date.now())
            .input('created_by', sql.NVarChar(100), row.created_by || null)
            .input('created_by_name', sql.NVarChar(255), row.created_by_name || null)
            .input('status', sql.NVarChar(50), row.status || 'approved')
            .input('completion_note', sql.NVarChar(sql.MAX), row.completion_note || null)
            .input('completion_photos', sql.NVarChar(sql.MAX), JSON.stringify(row.completion_photos || []))
            .query(`
              IF COL_LENGTH('dbo.services', 'photos') IS NULL
                ALTER TABLE dbo.services ADD photos NVARCHAR(MAX) NULL;
              IF COL_LENGTH('dbo.services', 'cari_name') IS NULL
                ALTER TABLE dbo.services ADD cari_name NVARCHAR(255) NULL;
              IF COL_LENGTH('dbo.services', 'status') IS NULL
                ALTER TABLE dbo.services ADD status NVARCHAR(50) NULL;
              IF COL_LENGTH('dbo.services', 'completion_note') IS NULL
                ALTER TABLE dbo.services ADD completion_note NVARCHAR(MAX) NULL;
              IF COL_LENGTH('dbo.services', 'completion_photos') IS NULL
                ALTER TABLE dbo.services ADD completion_photos NVARCHAR(MAX) NULL;

              MERGE dbo.services AS target
              USING (SELECT @id AS id) AS source
              ON (target.id = source.id)
              WHEN MATCHED THEN
                UPDATE SET company_name=@company_name, cari_name=@cari_name, location=@location, latitude=@latitude, longitude=@longitude,
                           work_done=@work_done, [date]=@date, photos=@photos, created_at=@created_at, created_by=@created_by,
                           created_by_name=@created_by_name, status=@status, completion_note=@completion_note,
                           completion_photos=@completion_photos, updated_at=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN
                INSERT (id, company_name, cari_name, location, latitude, longitude, work_done, [date], photos, created_at, created_by, created_by_name, status, completion_note, completion_photos, updated_at)
                VALUES (@id, @company_name, @cari_name, @location, @latitude, @longitude, @work_done, @date, @photos, @created_at, @created_by, @created_by_name, @status, @completion_note, @completion_photos, SYSUTCDATETIME());
            `);
        } catch {
          await pool
            .request()
            .input('id', sql.NVarChar(100), String(row.id))
            .input('company_name', sql.NVarChar(255), row.company_name || '')
            .input('location', sql.NVarChar(255), row.location || null)
            .input('latitude', sql.Float, row.latitude || null)
            .input('longitude', sql.Float, row.longitude || null)
            .input('work_done', sql.NVarChar(sql.MAX), row.work_done || '')
            .input('date', sql.NVarChar(50), row.date || null)
            .input('created_at', sql.BigInt, row.created_at || Date.now())
            .input('created_by', sql.NVarChar(100), row.created_by || null)
            .input('created_by_name', sql.NVarChar(255), row.created_by_name || null)
            .query(`
              MERGE dbo.services AS target
              USING (SELECT @id AS id) AS source
              ON (target.id = source.id)
              WHEN MATCHED THEN
                UPDATE SET company_name=@company_name, location=@location, latitude=@latitude, longitude=@longitude,
                           work_done=@work_done, [date]=@date, created_at=@created_at, created_by=@created_by,
                           created_by_name=@created_by_name, updated_at=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN
                INSERT (id, company_name, location, latitude, longitude, work_done, [date], created_at, created_by, created_by_name, updated_at)
                VALUES (@id, @company_name, @location, @latitude, @longitude, @work_done, @date, @created_at, @created_by, @created_by_name, SYSUTCDATETIME());
            `);
        }
      } else if (tableName === 'return_warranty') {
        await pool
          .request()
          .input('id', sql.NVarChar(100), String(row.id))
          .input('type', sql.NVarChar(50), row.type || 'warranty')
          .input('company_name', sql.NVarChar(255), row.company_name || '')
          .input('sent_date', sql.NVarChar(50), row.sent_date || '')
          .input('serial_number', sql.NVarChar(100), row.serial_number || null)
          .input('tracking_code', sql.NVarChar(100), row.tracking_code || null)
          .input('serial_number_photo', sql.NVarChar(sql.MAX), row.serial_number_photo || null)
          .input('tracking_code_photo', sql.NVarChar(sql.MAX), row.tracking_code_photo || null)
          .input('notes', sql.NVarChar(sql.MAX), row.notes || null)
          .input('status', sql.NVarChar(50), row.status || 'pending')
          .input('reminder_date', sql.NVarChar(50), row.reminder_date || null)
          .input('reminder_active', sql.Bit, row.reminder_active ? 1 : 0)
          .input('notified', sql.Bit, row.notified ? 1 : 0)
          .input('created_at', sql.BigInt, row.created_at || Date.now())
          .input('created_by', sql.NVarChar(100), row.created_by || null)
          .input('created_by_name', sql.NVarChar(255), row.created_by_name || null)
          .input('cari_name', sql.NVarChar(255), row.cari_name || null)
          .query(`
            MERGE dbo.return_warranty AS target
            USING (SELECT @id AS id) AS source
            ON (target.id = source.id)
            WHEN MATCHED THEN
              UPDATE SET [type]=@type, company_name=@company_name, sent_date=@sent_date, serial_number=@serial_number,
                         tracking_code=@tracking_code, serial_number_photo=@serial_number_photo, tracking_code_photo=@tracking_code_photo,
                         notes=@notes, status=@status, reminder_date=@reminder_date, reminder_active=@reminder_active, notified=@notified,
                         created_at=@created_at, created_by=@created_by, created_by_name=@created_by_name, cari_name=@cari_name,
                         updated_at=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
              INSERT (id, [type], company_name, sent_date, serial_number, tracking_code, serial_number_photo, tracking_code_photo, notes, status, reminder_date, reminder_active, notified, created_at, created_by, created_by_name, cari_name, updated_at)
              VALUES (@id, @type, @company_name, @sent_date, @serial_number, @tracking_code, @serial_number_photo, @tracking_code_photo, @notes, @status, @reminder_date, @reminder_active, @notified, @created_at, @created_by, @created_by_name, @cari_name, SYSUTCDATETIME());
          `);
      } else if (tableName === 'app_users') {
        await pool
          .request()
          .input('id', sql.NVarChar(100), String(row.id))
          .input('username', sql.NVarChar(255), row.username || '')
          .input('password', sql.NVarChar(255), row.password || '')
          .input('name', sql.NVarChar(255), row.name || '')
          .input('role', sql.NVarChar(50), row.role || 'user')
          .input('created_at', sql.BigInt, row.created_at || Date.now())
          .query(`
            MERGE dbo.app_users AS target
            USING (SELECT @id AS id) AS source
            ON (target.id = source.id)
            WHEN MATCHED THEN
              UPDATE SET username=@username, password=@password, name=@name, role=@role, created_at=@created_at, updated_at=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
              INSERT (id, username, password, name, role, created_at, updated_at)
              VALUES (@id, @username, @password, @name, @role, @created_at, SYSUTCDATETIME());
          `);
      }
    }

    res.json({ success: true, count: rawRows.length });
  } catch (err) {
    console.error(`POST /api/tables/${req.params.table}/upsert error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Tablodan kayıt sil (%100 Parametreli SQL - SQL Injection Korumalı)
app.post('/api/tables/:table/delete', async (req, res) => {
  try {
    const tableName = req.params.table;
    validateTable(tableName);

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const cleanIds = ids
      .map((i) => (i !== null && i !== undefined ? String(i).trim() : ''))
      .filter((i) => i.length > 0 && i.length <= 100);

    if (cleanIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const pool = await getPool();
    const batchSize = 500;
    for (let start = 0; start < cleanIds.length; start += batchSize) {
      const batch = cleanIds.slice(start, start + batchSize);
      const request = pool.request();
      const paramNames = batch.map((idVal, idx) => {
        const pName = `id${idx}`;
        request.input(pName, sql.NVarChar(100), idVal);
        return `@${pName}`;
      });
      await request.query(`DELETE FROM dbo.[${tableName}] WHERE id IN (${paramNames.join(', ')})`);
    }

    res.json({ success: true, count: cleanIds.length });
  } catch (err) {
    console.error(`POST /api/tables/${req.params.table}/delete error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 4. FOTOĞRAF YÜKLEME (Yerel Sunucu Sabit Diski - Güvenli Yükleme)
// =========================================================================
app.post('/api/upload', (req, res) => {
  if (!checkIpRateLimit(req, 'upload', 90)) {
    return res.status(429).json({ error: 'Çok fazla dosya yükleme isteği gönderildi. Lütfen biraz bekleyin.' });
  }
  upload.single('photo')(req, res, (uploadErr) => {
    if (uploadErr) {
      console.warn('Güvenli fotoğraf yükleme reddi:', uploadErr.message);
      return res.status(400).json({ error: uploadErr.message || 'Geçersiz dosya.' });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Dosya yüklenmedi' });
      }
      const relativeUrl = `/uploads/${req.file.filename}`;
      res.json({ success: true, url: relativeUrl, filename: req.file.filename });
    } catch (err) {
      console.error('Fotoğraf yükleme hatası:', err);
      res.status(500).json({ error: err.message });
    }
  });
});

// =========================================================================
// 5. ONESIGNAL BİLDİRİM VEKİLİ (PROXY)
// =========================================================================
const DEFAULT_ONESIGNAL_APP_ID = '03e50631-8d38-4796-a90f-ae524dab69fd';
const _osK = 'b3NfdjJfYXBwX2Fwc3FtbW1uaGJkem5raXB2emplM2szajd4YmV5amhtNGsydXdtZm5jZWhxbXJybWY1YmxreXpjcG00NHRtcGp0ZmdlcTR5NzZkYXlqczQ1dHR1a2Fiam1oYXdsZ3JnZ3lzbGVkeHE=';
const getOneSignalApiKey = () => process.env.ONESIGNAL_REST_KEY || Buffer.from(_osK, 'base64').toString('utf8');
const getOneSignalAppId = () => process.env.ONESIGNAL_APP_ID || DEFAULT_ONESIGNAL_APP_ID;

const serverRecentNotifications = new Map();

app.delete('/api/send-notification', async (req, res) => {
  try {
    const rawNotificationId = req.query.id;
    const apiKey = getOneSignalApiKey();
    const appId = getOneSignalAppId();
    if (!rawNotificationId) {
      return res.status(400).json({ error: 'notificationId gerekli' });
    }
    const ids = String(rawNotificationId)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const results = await Promise.all(
      ids.map(async (notifId) => {
        const response = await fetch(`https://onesignal.com/api/v1/notifications/${notifId}?app_id=${appId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${apiKey}`,
          },
        });
        return response.json().catch(() => ({}));
      })
    );
    console.log(`>> [Yerel Sunucu] Zamanlanmış bildirim OneSignal üzerinden iptal edildi (ID: ${rawNotificationId})`);
    res.json({ success: true, results });
  } catch (err) {
    console.error('OneSignal bildirim iptal hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

function sanitizeNotificationUrl(rawUrl) {
  const defaultBase = 'https://saha-takip-beige.vercel.app';
  if (!rawUrl || typeof rawUrl !== 'string') return defaultBase;
  const trimmed = rawUrl.trim();
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return defaultBase;
  try {
    const parsed = new URL(trimmed, defaultBase);
    const allowedHosts = new Set([
      'saha-takip-beige.vercel.app',
      '81.213.219.69',
      'localhost',
      '127.0.0.1',
    ]);
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
      const safeRedirect = new URL(defaultBase);
      const tab = parsed.searchParams.get('tab');
      const filter = parsed.searchParams.get('filter');
      if (tab) safeRedirect.searchParams.set('tab', tab);
      if (filter) safeRedirect.searchParams.set('filter', filter);
      return safeRedirect.toString();
    }
    return parsed.toString();
  } catch {
    return defaultBase;
  }
}

app.post('/api/send-notification', async (req, res) => {
  try {
    if (!checkIpRateLimit(req, 'push', 180)) {
      return res.status(429).json({ error: 'Çok fazla bildirim isteği gönderildi.' });
    }
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Geçersiz bildirim verisi' });
    }
    const apiKey = getOneSignalApiKey();
    const appId = getOneSignalAppId();

    // Bildirim İptal Talebi (Tekil veya virgülle ayrılmış çoklu ID destekli)
    if (payload.action === 'cancel' && payload.id) {
      const ids = String(payload.id)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const results = await Promise.all(
        ids.map(async (notifId) => {
          const response = await fetch(`https://onesignal.com/api/v1/notifications/${notifId}?app_id=${appId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Basic ${apiKey}`,
            },
          });
          return response.json().catch(() => ({}));
        })
      );
      console.log(`>> [Yerel Sunucu] Zamanlanmış bildirim OneSignal üzerinden iptal edildi (ID: ${payload.id})`);
      return res.json({ success: true, results });
    }

    payload.app_id = appId;

    const targetUrl = sanitizeNotificationUrl(
      payload.web_url || payload.url || payload.app_url || 'https://saha-takip-beige.vercel.app'
    );
    payload.url = targetUrl;
    delete payload.web_url;
    delete payload.app_url;

    let targetTab = 'notes';
    let targetFilter = '';
    try {
      const parsed = new URL(targetUrl, 'https://saha-takip-beige.vercel.app');
      targetTab = parsed.searchParams.get('tab') || 'notes';
      targetFilter = parsed.searchParams.get('filter') || '';
    } catch {
      // ignore
    }

    payload.data = {
      ...(payload.data || {}),
      url: targetUrl,
      launchURL: targetUrl,
      tab: payload.data?.tab || targetTab,
      filter: payload.data?.filter || targetFilter,
    };

    if (!payload.headings || !payload.headings.en) {
      const hText = payload.title || payload.headings?.tr || 'Bildirim';
      payload.headings = { en: hText, tr: hText };
    }
    if (!payload.contents || !payload.contents.en) {
      const cText = payload.message || payload.contents?.tr || 'Yeni bildirim';
      payload.contents = { en: cText, tr: cText };
    }

    // KESİN KURAL: Yöneticiye vardiya gecikmesi bildirimi gönderilmesini sunucu seviyesinde de engelle
    const headingCheck = String(payload.headings?.tr || payload.headings?.en || payload.title || '');
    const collapseCheck = String(payload.collapse_id || payload.collapseId || '');
    if (
      collapseCheck.startsWith('shift_admin_') ||
      headingCheck.includes('Vardiya Çıkış Gecikmesi') ||
      headingCheck.includes('Vardiya Giriş Gecikmesi')
    ) {
      console.log('>> [Yerel Sunucu] Yönetici vardiya çıkış gecikmesi bildirimi kural gereği engellendi:', headingCheck);
      return res.json({ id: 'blocked_admin_shift_alert', blocked: true });
    }

    if (payload.targetSubscriptionIds && Array.isArray(payload.targetSubscriptionIds) && payload.targetSubscriptionIds.length > 0 && !payload.include_player_ids) {
      payload.include_player_ids = payload.targetSubscriptionIds;
    }

    if (payload.targetUserIds && Array.isArray(payload.targetUserIds) && payload.targetUserIds.length > 0 && !payload.include_aliases && !payload.include_player_ids && !payload.filters) {
      payload.include_aliases = { external_id: payload.targetUserIds };
      payload.target_channel = 'push';
    }

    const delaySeconds = Number(payload.delaySeconds) || 0;
    delete payload.delaySeconds;
    if (delaySeconds > 0 && !payload.send_after) {
      payload.send_after = new Date(Date.now() + delaySeconds * 1000).toISOString();
    }

    // High priority and sound for iOS APNs & Android FCM (wake up locked/killed devices)
    payload.priority = 10;
    payload.ios_sound = 'default';
    payload.android_sound = 'default';
    payload.android_visibility = 1;
    payload.content_available = true;
    if (payload.ios_badgeType === undefined) {
      payload.ios_badgeType = 'Increase';
      payload.ios_badgeCount = 1;
    }

    if (payload.collapse_id) {
      const cleanCollapse = String(payload.collapse_id)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 60);
      payload.collapse_id = cleanCollapse;
      payload.web_push_topic = cleanCollapse;
    }

    // Deduplication check (30-second channel-aware debounce window; test, scheduled & multi-channel notifications exempt)
    const isExempt =
      Boolean(payload.bypassServerDedup) ||
      Boolean(payload.multiChannelGuarantee) ||
      payload.collapse_id?.startsWith('test_') ||
      Boolean(payload.send_after);
    if (!isExempt) {
      const channelType = payload.include_player_ids
        ? `player:${(payload.include_player_ids || []).join(',')}`
        : payload.filters
        ? `filter:${JSON.stringify(payload.filters)}`
        : payload.include_aliases
        ? `alias:${(payload.include_aliases?.external_id || []).join(',')}`
        : `users:${(payload.targetUserIds || []).join(',')}`;
      const dedupKey = `${payload.headings?.tr || payload.headings?.en || ''}__${payload.contents?.tr || payload.contents?.en || ''}__${payload.collapse_id || ''}__${channelType}`;
      const now = Date.now();
      const lastTime = serverRecentNotifications.get(dedupKey);
      if (lastTime && now - lastTime < 30000) {
        console.log('>> [Yerel Sunucu] Mükerrer bildirim engellendi (30s):', payload.headings?.tr || 'Bildirim');
        return res.json({ id: 'deduped', deduped: true });
      }
      serverRecentNotifications.set(dedupKey, now);
      if (serverRecentNotifications.size > 100) {
        for (const [k, v] of serverRecentNotifications.entries()) {
          if (now - v > 60000) serverRecentNotifications.delete(k);
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
    delete payload.bypassServerDedup;
    delete payload.targetUserIds;
    delete payload.targetSubscriptionIds;
    delete payload.excludeUserIds;
    delete payload.excludeSubscriptionIds;

    if (isMultiChannelUserTarget && targetUserIdsForMulti.length > 0) {
      const baseClean = { ...payload };
      delete baseClean.include_player_ids;
      delete baseClean.include_aliases;
      delete baseClean.target_channel;
      delete baseClean.filters;

      const channelPayloads = [];
      if (playerIdsForMulti.length > 0) {
        channelPayloads.push({
          ...baseClean,
          include_player_ids: playerIdsForMulti,
        });
      }

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
                Authorization: `Basic ${apiKey}`,
              },
              body: JSON.stringify(chPayload),
            });
            const d = await r.json().catch(() => ({}));
            if (d && d.id) {
              collectedIds.push(d.id);
              lastResult = d;
            }
          } catch (e) {}
        })
      );

      if (collectedIds.length > 0) {
        return res.json({
          id: collectedIds.join(','),
          ids: collectedIds,
          recipients: lastResult?.recipients || 1,
        });
      }
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('OneSignal proxy hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 8. CLOUD SYNC ENDPOINTS (Supabase -> Yerel MSSQL Eşitleme)
// =========================================================================
app.all('/api/sync-cloud', async (req, res) => {
  try {
    if (!checkIpRateLimit(req, 'sync_cloud', 12)) {
      return res.status(429).json({ success: false, error: 'Çok fazla eşitleme isteği gönderildi.' });
    }
    const result = await runCloudSync(PORT, false);
    res.json({ success: true, message: 'Bulut eşitlemesi başarıyla tamamlandı.', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 9. SYSTEM LOGS ENDPOINTS (İş Takip Sistemi Hata ve Olay Günlüğü)
// =========================================================================
const logsDir = process.env.LOGS_DIR || path.resolve(__dirname, '../../Logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch {}
}

app.post('/api/logs', (req, res) => {
  try {
    if (!checkIpRateLimit(req, 'logs', 180)) {
      return res.status(429).json({ error: 'Çok fazla log isteği gönderildi.' });
    }
    const item = req.body;
    if (!item || typeof item !== 'object') return res.status(400).json({ error: 'Log payload is empty' });

    const cleanField = (val, maxLen = 500) =>
      String(val || '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .slice(0, maxLen);

    const now = new Date();
    const dateStr = cleanField(item.dateStr || now.toISOString().replace('T', ' ').substring(0, 19), 40);
    const level = cleanField(item.level || 'INFO', 20);
    const category = cleanField(item.category || 'SISTEM_GENEL', 50);
    const userName = cleanField(item.userName, 80);
    const companyCode = cleanField(item.companyCode, 40);
    const userStr = userName ? `[Kullanıcı: ${userName}${companyCode ? ' / ' + companyCode : ''}] ` : '';
    const message = cleanField(item.message, 1000);
    const details = item.details
      ? `\n   -> Detay: ${cleanField(item.details, 2000).replace(/\n/g, '\n      ')}`
      : '';
    const device = item.deviceInfo ? `\n   -> Cihaz: ${cleanField(item.deviceInfo, 250)}` : '';

    const logLine = `[${dateStr}] [${level}] [${category}] ${userStr}${message}${details}${device}\n`;

    // 1. Ana kümülatif hata log dosyasına yaz
    const mainLogFile = path.join(logsDir, 'is_takip_hatalari.log');
    fs.appendFileSync(mainLogFile, logLine, 'utf8');

    // 2. Günlük log dosyasına yaz
    const yyyymmdd = now.toISOString().split('T')[0].replace(/-/g, '');
    const dailyLogFile = path.join(logsDir, `is_takip_${yyyymmdd}.log`);
    fs.appendFileSync(dailyLogFile, logLine, 'utf8');

    res.json({ success: true, loggedAt: dateStr });
  } catch (err) {
    console.error('Log yazma hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs', (req, res) => {
  try {
    if (!checkIpRateLimit(req, 'logs_read', 60)) {
      return res.status(429).json({ error: 'Çok fazla log okuma isteği gönderildi.' });
    }
    const mainLogFile = path.join(logsDir, 'is_takip_hatalari.log');
    if (!fs.existsSync(mainLogFile)) {
      return res.json({ content: 'Henüz log kaydı bulunmuyor.' });
    }
    const stat = fs.statSync(mainLogFile);
    const maxBytes = 256 * 1024; // Son 256 KB
    if (stat.size <= maxBytes) {
      const content = fs.readFileSync(mainLogFile, 'utf8');
      return res.json({ content });
    }
    const fd = fs.openSync(mainLogFile, 'r');
    const buf = Buffer.alloc(maxBytes);
    fs.readSync(fd, buf, 0, maxBytes, stat.size - maxBytes);
    fs.closeSync(fd);
    res.json({ content: buf.toString('utf8') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 8. WEB PANELİ STATİK SUNUMU (Vercel Yerine Doğrudan Sunucu Yayını)
// =========================================================================
const webDistCandidates = [
  path.resolve(__dirname, 'dist'),
  path.resolve(__dirname, '../dist'),
  path.resolve(process.cwd(), 'dist'),
  path.resolve(process.cwd(), 'api/dist'),
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(__dirname, '../web/dist'),
  path.resolve(__dirname, './web/dist'),
];
const webDistPath = webDistCandidates.find((p) => fs.existsSync(path.join(p, 'index.html')) || fs.existsSync(p));

// Tanı ve durum kontrol endpoint'i (Yol İfşası / Path Disclosure Korumalı)
app.get('/api/web-status', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0-web-hosted',
    serverTime: new Date().toISOString(),
    hasIndexHtml: webDistPath ? fs.existsSync(path.join(webDistPath, 'index.html')) : false,
  });
});

// Anlık Vardiya Bekçisi tetikleme ve tanı endpoint'i
app.all('/api/shift-watchdog', async (req, res) => {
  try {
    if (!checkIpRateLimit(req, 'shift_watchdog', 30)) {
      return res.status(429).json({ ok: false, error: 'Çok fazla vardiya kontrol isteği gönderildi.' });
    }
    const result = await runShiftWatchdog(PORT);
    res.json({ ok: true, ...(result || {}) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

if (webDistPath && fs.existsSync(webDistPath)) {
  console.log(`>> Web Paneli statik yayını devrede: ${webDistPath}`);
  app.use(express.static(webDistPath));

  // Ana Sayfa Açılışı (GET /)
  app.get('/', (req, res) => {
    const indexPath = path.join(webDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    res.status(404).send('Web Paneli index.html bulunamadı.');
  });

  // Single Page Application (SPA) Rota Desteği - API & Uploads dışındaki tüm istekleri index.html'e yönlendir
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    const indexPath = path.join(webDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
} else {
  console.log('>> Bilgi: Web build klasörü (dist) bulunamadı. Yalnızca API modunda çalışıyor.');
  app.get('/', (req, res) => {
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="tr">
        <head><meta charset="utf-8"><title>Saha Takip - Web Kurulum Rehberi</title></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;max-width:700px;margin:40px auto;padding:24px;line-height:1.6;color:#1e293b;">
          <h2 style="color:#0f766e;">✅ Saha Takip API Servisi Başarıyla Çalışıyor</h2>
          <p>Sunucunuz hazır ve istekleri karşılıyor. Ancak web arayüzünün <b>dist</b> klasörü eksik olduğu için web paneli açılamadı.</p>
          <div style="background:#f1f5f9;padding:16px;border-radius:12px;margin:20px 0;font-family:monospace;font-size:13px;">
            <b>Aranan Konumlar:</b><br/>
            ${webDistCandidates.map((c) => `• ${c} (Mevcut: ${fs.existsSync(c) ? 'VAR' : 'YOK'})`).join('<br/>')}
          </div>
          <p><b>Çözüm:</b> Bilgisayarınızdaki <code>yerel_sunucu/api/dist</code> klasörünü sunucudaki <code>api</code> klasörünün içine kopyalayınız.</p>
        </body>
      </html>
    `);
  });
}

// Başlat
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`>> Saha Takip Yerel API çalışıyor: http://0.0.0.0:${PORT}`);
  console.log(`>> Fotoğraf Depolama Klasörü: ${uploadDir}`);
  console.log('================================================================');

  // Sunucu her açıldığında kapalı kalınan süredeki verileri Supabase'den otomatik çek
  setTimeout(() => {
    runCloudSync(PORT, false).catch((err) => {
      console.warn('>> [Açılış Eşitlemesi Uyarısı]:', err.message);
    });
  }, 2500);

  // Periyodik Otomatik Eşitleme (Her 30 dakikada bir kontrol)
  setInterval(() => {
    runCloudSync(PORT, true).catch(() => {});
  }, 30 * 60 * 1000);

  // 7/24 Otonom Vardiya Giriş (+15dk) ve Çıkış (+5dk/+10dk) Hatırlatıcı Kontrolü (Her 20 saniyede bir)
  setTimeout(() => {
    runShiftWatchdog(PORT).catch(() => {});
  }, 5000);
  setInterval(() => {
    runShiftWatchdog(PORT).catch(() => {});
  }, 20 * 1000);
});

server.on('error', (err) => {
  console.error(`>> [SUNUCU PORT HATASI] Port ${PORT} başlatılamadı:`, err.message);
  appendServerErrorLog('serverListenError', err);
  process.exit(1);
});
