/**
 * Saha Takip Sistemi - Otomatik Bulut Eşitleme Modülü (Supabase -> Yerel MSSQL Server)
 * 
 * Sunucu her başlatıldığında ve periyodik aralıklarla çalışarak:
 * Sunucunun kapalı kaldığı sürede mobil veya web üzerinden Supabase'e yazılan
 * tüm verileri (görevler, mesailer, izinler, notlar, cariler) çeker ve MSSQL'e aktarır.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';

let isSyncRunning = false;

async function fetchFromSupabase(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase ${table} okunamadı (${res.status}): ${errText}`);
  }
  return await res.json();
}

async function postLocal(port, endpoint, data) {
  const url = `http://127.0.0.1:${port}${endpoint}`;
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
    throw new Error(`Yerel API ${endpoint} hatası (${res.status}): ${errText}`);
  }
  return await res.json();
}

/**
 * Supabase bulut veritabanındaki verileri yerel MSSQL veritabanına eşitler.
 * @param {number} port - Yerel API port numarası (varsayılan: 3001)
 * @param {boolean} isQuiet - Konsola detaylı log basılıp basılmayacağı
 */
async function runCloudSync(port = 3001, isQuiet = false) {
  if (isSyncRunning) {
    if (!isQuiet) console.log('>> [Bulut Eşitleme] Bir eşitleme işlemi zaten çalışıyor, atlandı.');
    return { status: 'already_running' };
  }

  isSyncRunning = true;
  const startTime = Date.now();

  try {
    if (!isQuiet) {
      console.log('----------------------------------------------------------------');
      console.log('>> [Bulut Eşitleme] Supabase bulutundan veriler çekiliyor...');
      console.log('>> (Sunucunun kapalı kaldığı süredeki tüm güncellemeler aktarılıyor)');
    }

    let syncedSlots = 0;
    let syncedTables = 0;

    // 1. standard_tasks slotları (Tüm modüller: mesai, maaş, izin, pano vb.)
    try {
      const slots = await fetchFromSupabase('standard_tasks', '?select=id,tasks&order=id.asc');
      if (Array.isArray(slots)) {
        for (const slot of slots) {
          if (slot.tasks) {
            await postLocal(port, `/api/standard_tasks/${slot.id}`, { tasks: slot.tasks });
            syncedSlots++;
          }
        }
        if (!isQuiet) console.log(`   ✓ ${syncedSlots} adet veri slotu (mesai, izin, maaş vb.) eşitlendi.`);
      }
    } catch (err) {
      console.warn('   ⚠️ standard_tasks eşitleme uyarısı:', err.message);
    }

    // 2. Ana Tablolar
    const tables = [
      { name: 'locations', label: 'Montaj & Cariler' },
      { name: 'notes', label: 'İş Emirleri & Notlar' },
      { name: 'services', label: 'Servis Fişleri' },
      { name: 'return_warranty', label: 'İade & Garanti' },
      { name: 'app_users', label: 'Personel & Kullanıcılar' },
    ];

    for (const tbl of tables) {
      try {
        const rows = await fetchFromSupabase(tbl.name, '?select=*');
        if (Array.isArray(rows) && rows.length > 0) {
          await postLocal(port, `/api/tables/${tbl.name}/upsert`, { rows });
          syncedTables++;
          if (!isQuiet) console.log(`   ✓ ${tbl.label} (${rows.length} kayıt) eşitlendi.`);
        }
      } catch (err) {
        console.warn(`   ⚠️ ${tbl.label} eşitleme uyarısı:`, err.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (!isQuiet) {
      console.log(`>> [Bulut Eşitleme Tamamlandı] Süre: ${elapsed}s | Slot: ${syncedSlots} | Tablo: ${syncedTables}`);
      console.log('----------------------------------------------------------------');
    }

    return {
      success: true,
      durationSeconds: Number(elapsed),
      syncedSlots,
      syncedTables,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('>> [Bulut Eşitleme Hatası]:', err.message);
    throw err;
  } finally {
    isSyncRunning = false;
  }
}

module.exports = { runCloudSync };
