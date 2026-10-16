const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { sql, getPool } = require('./db');
const { runCloudSync } = require('./cloudSync');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Fotoğraf Yükleme Dizini
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Statik Dosya Erişimi (Fotoğraflar için)
app.use('/uploads', express.static(uploadDir));

// Multer Disk Storage Yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25 MB max

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
    const slotId = parseInt(req.params.id, 10);
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

// Tabloya toplu veya tekil upsert
app.post('/api/tables/:table/upsert', async (req, res) => {
  try {
    const tableName = req.params.table;
    validateTable(tableName);

    const rawRows = req.body.rows || (req.body.id ? [req.body] : []);
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const pool = await getPool();

    for (const row of rawRows) {
      if (!row.id) continue;

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
      } else if (tableName === 'services') {
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

// Tablodan kayıt sil
app.post('/api/tables/:table/delete', async (req, res) => {
  try {
    const tableName = req.params.table;
    validateTable(tableName);

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const pool = await getPool();
    // Parametreli güvenli silme
    const tableParam = new sql.Table();
    tableParam.columns.add('id', sql.NVarChar(100));
    for (const id of ids) tableParam.rows.add(String(id));

    await pool
      .request()
      .query(`DELETE FROM dbo.[${tableName}] WHERE id IN ('${ids.map((i) => String(i).replace(/'/g, "''")).join("','")}')`);

    res.json({ success: true, count: ids.length });
  } catch (err) {
    console.error(`POST /api/tables/${req.params.table}/delete error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 4. FOTOĞRAF YÜKLEME (Yerel Sunucu Sabit Diski)
// =========================================================================
app.post('/api/upload', upload.single('photo'), (req, res) => {
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

// =========================================================================
// 5. ONESIGNAL BİLDİRİM VEKİLİ (PROXY)
// =========================================================================
const serverRecentNotifications = new Map();

app.delete('/api/send-notification', async (req, res) => {
  try {
    const notificationId = req.query.id;
    const apiKey = process.env.ONESIGNAL_REST_KEY;
    const appId = process.env.ONESIGNAL_APP_ID;
    if (!notificationId) {
      return res.status(400).json({ error: 'notificationId gerekli' });
    }
    const response = await fetch(`https://onesignal.com/api/v1/notifications/${notificationId}?app_id=${appId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${apiKey}`,
      },
    });
    const data = await response.json();
    console.log(`>> [Yerel Sunucu] Zamanlanmış bildirim OneSignal üzerinden iptal edildi (ID: ${notificationId})`);
    res.json(data);
  } catch (err) {
    console.error('OneSignal bildirim iptal hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send-notification', async (req, res) => {
  try {
    const payload = req.body;
    const apiKey = process.env.ONESIGNAL_REST_KEY;
    const appId = process.env.ONESIGNAL_APP_ID;

    // Bildirim İptal Talebi
    if (payload.action === 'cancel' && payload.id) {
      const response = await fetch(`https://onesignal.com/api/v1/notifications/${payload.id}?app_id=${appId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${apiKey}`,
        },
      });
      const data = await response.json();
      console.log(`>> [Yerel Sunucu] Zamanlanmış bildirim OneSignal üzerinden iptal edildi (ID: ${payload.id})`);
      return res.json(data);
    }

    if (!payload.app_id) payload.app_id = appId;

    if (payload.url) {
      delete payload.web_url;
      delete payload.app_url;
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
      payload.send_after = new Date(Date.now() + delaySeconds * 1000).toISOString();
    }

    // Deduplication check (30-second debounce window, test notifications exempt)
    const isTest = payload.collapse_id?.startsWith('test_');
    if (!isTest) {
      const dedupKey = `${payload.headings?.tr || payload.headings?.en || ''}__${payload.contents?.tr || payload.contents?.en || ''}__${payload.collapse_id || ''}__${(payload.targetUserIds || []).join(',')}`;
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
    const item = req.body;
    if (!item) return res.status(400).json({ error: 'Log payload is empty' });

    const now = new Date();
    const dateStr = item.dateStr || now.toISOString().replace('T', ' ').substring(0, 19);
    const level = item.level || 'INFO';
    const category = item.category || 'SISTEM_GENEL';
    const userStr = item.userName ? `[Kullanıcı: ${item.userName}${item.companyCode ? ' / ' + item.companyCode : ''}] ` : '';
    const message = item.message || '';
    const details = item.details ? `\n   -> Detay: ${String(item.details).replace(/\n/g, '\n      ')}` : '';
    const device = item.deviceInfo ? `\n   -> Cihaz: ${item.deviceInfo}` : '';

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
    const mainLogFile = path.join(logsDir, 'is_takip_hatalari.log');
    if (!fs.existsSync(mainLogFile)) {
      return res.json({ content: 'Henüz log kaydı bulunmuyor.' });
    }
    const content = fs.readFileSync(mainLogFile, 'utf8');
    res.json({ content });
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

// Tanı ve durum kontrol endpoint'i
app.get('/api/web-status', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0-web-hosted',
    serverTime: new Date().toISOString(),
    dirname: __dirname,
    cwd: process.cwd(),
    webDistPath: webDistPath || null,
    hasIndexHtml: webDistPath ? fs.existsSync(path.join(webDistPath, 'index.html')) : false,
    candidates: webDistCandidates.map((c) => ({
      path: c,
      exists: fs.existsSync(c),
      hasIndexHtml: fs.existsSync(path.join(c, 'index.html')),
    })),
  });
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
app.listen(PORT, '0.0.0.0', () => {
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
});
