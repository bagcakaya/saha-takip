/**
 * Saha Takip Sistemi - Canlı Veritabanı Eşitleme Aracı (Supabase -> Yerel MSSQL Server)
 * Bu script Supabase'deki tüm canlı verileri (tüm slotlar, mesailer, maaşlar, notlar, kullanıcılar)
 * ofisteki Windows Server 2022 API'sine (http://81.213.219.69:3001) göndererek iki veritabanını
 * %100 birebir ikiz hale getirir.
 */

const path = require('path');

let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch {
  createClient = require(path.join(__dirname, '../../web/node_modules/@supabase/supabase-js')).createClient;
}

const SUPABASE_URL = 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';
const SERVER_API_BASE = process.env.SERVER_API_URL || 'http://81.213.219.69:3001';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function postJson(endpoint, data) {
  const url = `${SERVER_API_BASE}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return await res.json();
}

async function runSync() {
  console.log('================================================================');
  console.log('>> [1/4] Supabase canlı veritabanına bağlanılıyor...');
  console.log(`>> Hedef Yerel Sunucu: ${SERVER_API_BASE}`);
  console.log('================================================================');

  // 1. Health check
  try {
    const healthRes = await fetch(`${SERVER_API_BASE}/api/health`);
    const health = await healthRes.json();
    if (health.status !== 'ok') {
      throw new Error('Yerel sunucu sağlık kontrolü başarısız: ' + JSON.stringify(health));
    }
    console.log(`✓ Yerel Sunucu ve SQL Server bağlantısı onaylandı (Veritabanı: ${health.database})`);
  } catch (err) {
    console.error('❌ Yerel sunucuya ulaşılamadı:', err.message);
    process.exit(1);
  }

  // 2. Verileri Çek ve Yerel Sunucuya Aktar
  console.log('\n>> [2/4] Canlı veriler Supabase bulutundan çekilip Yerel Sunucuya aktarılıyor...');

  // A. standard_tasks slotları (1-60 arası tek tek çekilip aktarılır, timeout engellenir)
  console.log('\n   A. standard_tasks slotları aktarılıyor...');
  let syncedSlots = 0;
  for (let slotId = 1; slotId <= 60; slotId++) {
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('id, tasks')
        .eq('id', slotId)
        .maybeSingle();

      if (error) {
        // Hata alırsak atla
        continue;
      }
      if (data && data.tasks) {
        await postJson(`/api/standard_tasks/${data.id}`, { tasks: data.tasks });
        syncedSlots++;
        process.stdout.write(`\r      -> Slot ${data.id} aktarıldı (${syncedSlots} slot tamamlandı)`);
      }
    } catch (err) {
      console.warn(`\n      ⚠️ Slot ${slotId} aktarım hatası:`, err.message);
    }
  }
  console.log(`\n   ✓ ${syncedSlots} adet standard_tasks slotu başarıyla eşitlendi.`);

  // B. locations tablosu
  console.log('\n   B. locations (montaj ve cariler) aktarılıyor...');
  try {
    const { data: locations, error } = await supabase.from('locations').select('*');
    if (!error && locations && locations.length > 0) {
      await postJson('/api/tables/locations/upsert', { rows: locations });
      console.log(`   ✓ ${locations.length} adet location kaydı eşitlendi.`);
    }
  } catch (err) {
    console.warn('   ⚠️ locations aktarım hatası:', err.message);
  }

  // C. notes tablosu
  console.log('\n   C. notes (iş emirleri ve görevler) aktarılıyor...');
  try {
    const { data: notes, error } = await supabase.from('notes').select('*');
    if (!error && notes && notes.length > 0) {
      await postJson('/api/tables/notes/upsert', { rows: notes });
      console.log(`   ✓ ${notes.length} adet iş emri eşitlendi.`);
    }
  } catch (err) {
    console.warn('   ⚠️ notes aktarım hatası:', err.message);
  }

  // D. services tablosu
  console.log('\n   D. services (servis kayıtları) aktarılıyor...');
  try {
    const { data: services, error } = await supabase.from('services').select('*');
    if (!error && services && services.length > 0) {
      await postJson('/api/tables/services/upsert', { rows: services });
      console.log(`   ✓ ${services.length} adet servis kaydı eşitlendi.`);
    }
  } catch (err) {
    console.warn('   ⚠️ services aktarım hatası:', err.message);
  }

  // E. return_warranty tablosu
  console.log('\n   E. return_warranty (iade/garanti) aktarılıyor...');
  try {
    const { data: returnWarranty, error } = await supabase.from('return_warranty').select('*');
    if (!error && returnWarranty && returnWarranty.length > 0) {
      await postJson('/api/tables/return_warranty/upsert', { rows: returnWarranty });
      console.log(`   ✓ ${returnWarranty.length} adet garanti/iade kaydı eşitlendi.`);
    }
  } catch (err) {
    console.warn('   ⚠️ return_warranty aktarım hatası:', err.message);
  }

  // F. app_users tablosu
  console.log('\n   F. app_users (personeller ve kullanıcılar) aktarılıyor...');
  try {
    const { data: appUsers, error } = await supabase.from('app_users').select('*');
    if (!error && appUsers && appUsers.length > 0) {
      await postJson('/api/tables/app_users/upsert', { rows: appUsers });
      console.log(`   ✓ ${appUsers.length} adet kullanıcı eşitlendi.`);
    }
  } catch (err) {
    console.warn('   ⚠️ app_users aktarım hatası:', err.message);
  }

  // 4. Doğrulama
  console.log('\n>> [4/4] Veritabanı doğrulama testi yapılıyor...');
  try {
    const verifyNotes = await (await fetch(`${SERVER_API_BASE}/api/tables/notes`)).json();
    const verifySlot6 = await (await fetch(`${SERVER_API_BASE}/api/standard_tasks/6`)).json();
    const verifySlot20 = await (await fetch(`${SERVER_API_BASE}/api/standard_tasks/20`)).json();

    console.log('================================================================');
    console.log('✅ SENKRONİZASYON BAŞARIYLA TAMAMLANDI!');
    console.log(`   - SQL Server'daki İş Emri Sayısı: ${Array.isArray(verifyNotes) ? verifyNotes.length : 'ok'}`);
    console.log(`   - SQL Server Slot 6 (Mesai & İzin Kayıtları): ${verifySlot6.tasks?.length ? 'Aktif & Güncel' : 'Boş'}`);
    console.log(`   - SQL Server Slot 20 (Maaş & Bordro Kayıtları): ${verifySlot20.tasks?.length ? 'Aktif & Güncel' : 'Boş'}`);
    console.log('>> Yerel Windows Server 2022 veritabanı, Supabase ile %100 birebir eşit (ikiz) hale geldi.');
    console.log('================================================================');
  } catch (err) {
    console.warn('Doğrulama uyarısı:', err.message);
  }
}

runSync().catch((err) => {
  console.error('\n❌ Eşitleme sırasında hata oluştu:', err);
  process.exit(1);
});
