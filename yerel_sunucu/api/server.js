const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { sql, getPool } = require('./db');
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
app.post('/api/send-notification', async (req, res) => {
  try {
    const payload = req.body;
    const apiKey = process.env.ONESIGNAL_REST_KEY;
    const appId = process.env.ONESIGNAL_APP_ID;

    if (!payload.app_id) payload.app_id = appId;

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

// Başlat
app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`>> Saha Takip Yerel API çalışıyor: http://0.0.0.0:${PORT}`);
  console.log(`>> Fotoğraf Depolama Klasörü: ${uploadDir}`);
  console.log('================================================================');
});
