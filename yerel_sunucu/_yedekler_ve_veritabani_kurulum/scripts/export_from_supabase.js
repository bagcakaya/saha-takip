/**
 * Supabase -> Microsoft SQL Server Veri Aktarım ve Yedekleme Aracı
 * Bu script Supabase'deki tüm canlı verileri çeker ve SSMS'te (SQL Server Management Studio)
 * tek tıkla çalıştırabileceğiniz '02_mevcut_veriler_yedek.sql' dosyasını oluşturur.
 */

const fs = require('fs');
const path = require('path');

let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch {
  createClient = require(path.join(__dirname, '../../web/node_modules/@supabase/supabase-js')).createClient;
}

const SUPABASE_URL = 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'object') {
    // Array or Object -> JSON string
    return `N'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `N'${String(val).replace(/'/g, "''")}'`;
}

async function exportAll() {
  console.log('>> Supabase veritabanına bağlanılıyor...');

  // 1. Verileri Çek
  const [stRes, locRes, notesRes, srvRes, rwRes, usersRes] = await Promise.all([
    supabase.from('standard_tasks').select('*'),
    supabase.from('locations').select('*'),
    supabase.from('notes').select('*'),
    supabase.from('services').select('*'),
    supabase.from('return_warranty').select('*'),
    supabase.from('app_users').select('*'),
  ]);

  if (stRes.error) console.warn('standard_tasks uyarısı:', stRes.error.message);
  if (locRes.error) console.warn('locations uyarısı:', locRes.error.message);
  if (notesRes.error) console.warn('notes uyarısı:', notesRes.error.message);
  if (srvRes.error) console.warn('services uyarısı:', srvRes.error.message);
  if (rwRes.error) console.warn('return_warranty uyarısı:', rwRes.error.message);
  if (usersRes.error) console.warn('app_users uyarısı:', usersRes.error.message);

  const standardTasks = stRes.data || [];
  const locations = locRes.data || [];
  const notes = notesRes.data || [];
  const services = srvRes.data || [];
  const returnWarranty = rwRes.data || [];
  const appUsers = usersRes.data || [];

  console.log(`>> Çekilen Kayıt Sayıları:`);
  console.log(`   - standard_tasks: ${standardTasks.length} adet (kullanıcılar, ayarlar, modül slotları)`);
  console.log(`   - locations: ${locations.length} adet`);
  console.log(`   - notes: ${notes.length} adet`);
  console.log(`   - services: ${services.length} adet`);
  console.log(`   - return_warranty: ${returnWarranty.length} adet`);
  console.log(`   - app_users: ${appUsers.length} adet`);

  // Raw JSON yedeği de saklayalım
  const fullBackup = {
    exportedAt: new Date().toISOString(),
    standardTasks,
    locations,
    notes,
    services,
    returnWarranty,
    appUsers,
  };
  const jsonPath = path.join(__dirname, '..', 'data_backup.json');
  fs.writeFileSync(jsonPath, JSON.stringify(fullBackup, null, 2), 'utf-8');
  console.log(`>> Ham JSON yedeği kaydedildi: ${jsonPath}`);

  // 2. T-SQL Dosyası Üret
  let sql = `-- ==================================================================================\n`;
  sql += `-- SAHA TAKİP SİSTEMİ - SUPABASE'DEN AKTARILAN MEVCUT VERİLER YEDEĞİ\n`;
  sql += `-- Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}\n`;
  sql += `-- ==================================================================================\n\n`;
  sql += `USE [SahaTakipDB];\nGO\n\n`;
  sql += `SET NOCOUNT ON;\nGO\n\n`;

  // Standard Tasks
  if (standardTasks.length > 0) {
    sql += `-- 1. STANDARD_TASKS AKTARIMI (${standardTasks.length} kayıt)\n`;
    for (const r of standardTasks) {
      const id = r.id;
      const tasksJson = escapeSql(r.tasks || []);
      sql += `IF NOT EXISTS (SELECT 1 FROM dbo.standard_tasks WHERE id = ${id})\n`;
      sql += `    INSERT INTO dbo.standard_tasks (id, tasks) VALUES (${id}, ${tasksJson});\n`;
      sql += `ELSE\n`;
      sql += `    UPDATE dbo.standard_tasks SET tasks = ${tasksJson}, updated_at = SYSUTCDATETIME() WHERE id = ${id};\n`;
    }
    sql += `PRINT '>> [standard_tasks] verileri başarıyla aktarıldı.';\nGO\n\n`;
  }

  // Locations
  if (locations.length > 0) {
    sql += `-- 2. LOCATIONS AKTARIMI (${locations.length} kayıt)\n`;
    for (const r of locations) {
      const id = escapeSql(r.id);
      const name = escapeSql(r.name);
      const address = escapeSql(r.address);
      const notesVal = escapeSql(r.notes);
      const photos = escapeSql(r.photos || []);
      const latitude = escapeSql(r.latitude);
      const longitude = escapeSql(r.longitude);
      const createdAt = escapeSql(r.created_at);
      const createdBy = escapeSql(r.created_by);
      const createdByName = escapeSql(r.created_by_name);
      const tasks = escapeSql(r.tasks || []);
      const status = escapeSql(r.status || 'pending');
      const completedAt = escapeSql(r.completed_at);
      const completedBy = escapeSql(r.completed_by);
      const completedByName = escapeSql(r.completed_by_name);
      const completionNote = escapeSql(r.completion_note);
      const completionPhotos = escapeSql(r.completion_photos || []);
      const approvedAt = escapeSql(r.approved_at);
      const approvedBy = escapeSql(r.approved_by);
      const approvedByName = escapeSql(r.approved_by_name);
      const rejectedAt = escapeSql(r.rejected_at);
      const rejectedBy = escapeSql(r.rejected_by);
      const rejectedByName = escapeSql(r.rejected_by_name);
      const rejectionReason = escapeSql(r.rejection_reason);

      sql += `IF NOT EXISTS (SELECT 1 FROM dbo.locations WHERE id = ${id})\n`;
      sql += `    INSERT INTO dbo.locations (id, name, address, notes, photos, latitude, longitude, created_at, created_by, created_by_name, tasks, status, completed_at, completed_by, completed_by_name, completion_note, completion_photos, approved_at, approved_by, approved_by_name, rejected_at, rejected_by, rejected_by_name, rejection_reason)\n`;
      sql += `    VALUES (${id}, ${name}, ${address}, ${notesVal}, ${photos}, ${latitude}, ${longitude}, ${createdAt}, ${createdBy}, ${createdByName}, ${tasks}, ${status}, ${completedAt}, ${completedBy}, ${completedByName}, ${completionNote}, ${completionPhotos}, ${approvedAt}, ${approvedBy}, ${approvedByName}, ${rejectedAt}, ${rejectedBy}, ${rejectedByName}, ${rejectionReason});\n`;
    }
    sql += `PRINT '>> [locations] verileri başarıyla aktarıldı.';\nGO\n\n`;
  }

  // Notes
  if (notes.length > 0) {
    sql += `-- 3. NOTES AKTARIMI (${notes.length} kayıt)\n`;
    for (const r of notes) {
      const id = escapeSql(r.id);
      const content = escapeSql(r.content);
      const createdAt = escapeSql(r.created_at);
      const createdBy = escapeSql(r.created_by);
      const createdByName = escapeSql(r.created_by_name);
      const targetMode = escapeSql(r.target_mode || 'self');
      const targetUserIds = escapeSql(r.target_user_ids || []);
      const targetUserNames = escapeSql(r.target_user_names || []);
      const targetUserId = escapeSql(r.target_user_id);
      const targetUserName = escapeSql(r.target_user_name);
      const reminderActive = r.reminder_active ? 1 : 0;
      const reminderDate = escapeSql(r.reminder_date);
      const notified = r.notified ? 1 : 0;
      const status = escapeSql(r.status || 'pending');
      const completedAt = escapeSql(r.completed_at);
      const completedBy = escapeSql(r.completed_by);
      const completedByName = escapeSql(r.completed_by_name);
      const completionNote = escapeSql(r.completion_note);
      const approvedAt = escapeSql(r.approved_at);
      const approvedBy = escapeSql(r.approved_by);
      const approvedByName = escapeSql(r.approved_by_name);
      const rejectedAt = escapeSql(r.rejected_at);
      const rejectedBy = escapeSql(r.rejected_by);
      const rejectedByName = escapeSql(r.rejected_by_name);
      const rejectionReason = escapeSql(r.rejection_reason);

      sql += `IF NOT EXISTS (SELECT 1 FROM dbo.notes WHERE id = ${id})\n`;
      sql += `    INSERT INTO dbo.notes (id, content, created_at, created_by, created_by_name, target_mode, target_user_ids, target_user_names, target_user_id, target_user_name, reminder_active, reminder_date, notified, status, completed_at, completed_by, completed_by_name, completion_note, approved_at, approved_by, approved_by_name, rejected_at, rejected_by, rejected_by_name, rejection_reason)\n`;
      sql += `    VALUES (${id}, ${content}, ${createdAt}, ${createdBy}, ${createdByName}, ${targetMode}, ${targetUserIds}, ${targetUserNames}, ${targetUserId}, ${targetUserName}, ${reminderActive}, ${reminderDate}, ${notified}, ${status}, ${completedAt}, ${completedBy}, ${completedByName}, ${completionNote}, ${approvedAt}, ${approvedBy}, ${approvedByName}, ${rejectedAt}, ${rejectedBy}, ${rejectedByName}, ${rejectionReason});\n`;
    }
    sql += `PRINT '>> [notes] verileri başarıyla aktarıldı.';\nGO\n\n`;
  }

  // Services
  if (services.length > 0) {
    sql += `-- 4. SERVICES AKTARIMI (${services.length} kayıt)\n`;
    for (const r of services) {
      const id = escapeSql(r.id);
      const companyName = escapeSql(r.company_name);
      const location = escapeSql(r.location);
      const latitude = escapeSql(r.latitude);
      const longitude = escapeSql(r.longitude);
      const workDone = escapeSql(r.work_done);
      const dateVal = escapeSql(r.date);
      const createdAt = escapeSql(r.created_at);
      const createdBy = escapeSql(r.created_by);
      const createdByName = escapeSql(r.created_by_name);

      sql += `IF NOT EXISTS (SELECT 1 FROM dbo.services WHERE id = ${id})\n`;
      sql += `    INSERT INTO dbo.services (id, company_name, location, latitude, longitude, work_done, [date], created_at, created_by, created_by_name)\n`;
      sql += `    VALUES (${id}, ${companyName}, ${location}, ${latitude}, ${longitude}, ${workDone}, ${dateVal}, ${createdAt}, ${createdBy}, ${createdByName});\n`;
    }
    sql += `PRINT '>> [services] verileri başarıyla aktarıldı.';\nGO\n\n`;
  }

  // Return Warranty
  if (returnWarranty.length > 0) {
    sql += `-- 5. RETURN_WARRANTY AKTARIMI (${returnWarranty.length} kayıt)\n`;
    for (const r of returnWarranty) {
      const id = escapeSql(r.id);
      const typeVal = escapeSql(r.type || 'warranty');
      const companyName = escapeSql(r.company_name);
      const sentDate = escapeSql(r.sent_date);
      const serialNumber = escapeSql(r.serial_number);
      const trackingCode = escapeSql(r.tracking_code);
      const serialNumberPhoto = escapeSql(r.serial_number_photo);
      const trackingCodePhoto = escapeSql(r.tracking_code_photo);
      const notesVal = escapeSql(r.notes);
      const status = escapeSql(r.status || 'pending');
      const reminderDate = escapeSql(r.reminder_date);
      const reminderActive = r.reminder_active ? 1 : 0;
      const notified = r.notified ? 1 : 0;
      const createdAt = escapeSql(r.created_at);
      const createdBy = escapeSql(r.created_by);
      const createdByName = escapeSql(r.created_by_name);
      const cariName = escapeSql(r.cari_name);

      sql += `IF NOT EXISTS (SELECT 1 FROM dbo.return_warranty WHERE id = ${id})\n`;
      sql += `    INSERT INTO dbo.return_warranty (id, [type], company_name, sent_date, serial_number, tracking_code, serial_number_photo, tracking_code_photo, notes, status, reminder_date, reminder_active, notified, created_at, created_by, created_by_name, cari_name)\n`;
      sql += `    VALUES (${id}, ${typeVal}, ${companyName}, ${sentDate}, ${serialNumber}, ${trackingCode}, ${serialNumberPhoto}, ${trackingCodePhoto}, ${notesVal}, ${status}, ${reminderDate}, ${reminderActive}, ${notified}, ${createdAt}, ${createdBy}, ${createdByName}, ${cariName});\n`;
    }
    sql += `PRINT '>> [return_warranty] verileri başarıyla aktarıldı.';\nGO\n\n`;
  }

  // App Users
  if (appUsers.length > 0) {
    sql += `-- 6. APP_USERS AKTARIMI (${appUsers.length} kayıt)\n`;
    for (const r of appUsers) {
      const id = escapeSql(r.id);
      const username = escapeSql(r.username);
      const password = escapeSql(r.password);
      const name = escapeSql(r.name);
      const role = escapeSql(r.role || 'user');
      const createdAt = escapeSql(r.created_at);

      sql += `IF NOT EXISTS (SELECT 1 FROM dbo.app_users WHERE id = ${id})\n`;
      sql += `    INSERT INTO dbo.app_users (id, username, password, name, role, created_at)\n`;
      sql += `    VALUES (${id}, ${username}, ${password}, ${name}, ${role}, ${createdAt});\n`;
    }
    sql += `PRINT '>> [app_users] verileri başarıyla aktarıldı.';\nGO\n\n`;
  }

  sql += `PRINT '==================================================================================';\n`;
  sql += `PRINT '>> TEBRİKLER: Tüm mevcut verileriniz eksiksiz SQL Server veritabanına aktarıldı!';\n`;
  sql += `PRINT '==================================================================================';\n`;

  const sqlPath = path.join(__dirname, '..', '02_mevcut_veriler_yedek.sql');
  fs.writeFileSync(sqlPath, sql, 'utf-8');
  console.log(`>> T-SQL aktarım dosyası başarıyla üretildi: ${sqlPath}`);
  console.log(`>> Toplam dosya boyutu: ${(fs.statSync(sqlPath).size / 1024).toFixed(1)} KB`);
}

exportAll().catch(err => {
  console.error('Hata oluştu:', err);
  process.exit(1);
});
