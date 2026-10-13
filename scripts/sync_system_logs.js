/**
 * sync_system_logs.js
 * Supabase Bulut Veritabanından (Slot 13) İş Takip Sisteminde oluşan tüm hata ve olay loglarını çeker
 * ve C:\Users\Mert\Desktop\Görev_Tamamlama\Logs\is_takip_hatalari.log dosyasına yazar.
 * Sıfır bağımlılık: Tamamen dahili 'https' ve 'fs' modülleri ile çalışır.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';
const SLOT_ID = 13;

const logsDir = path.resolve(__dirname, '../Logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const mainLogFile = path.join(logsDir, 'is_takip_hatalari.log');

function fetchCloudLogs() {
  return new Promise((resolve, reject) => {
    const endpoint = `${SUPABASE_URL}/rest/v1/standard_tasks?id=eq.${SLOT_ID}&select=tasks`;
    const options = {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    };

    https.get(endpoint, options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${rawData}`));
          }
          const parsed = JSON.parse(rawData);
          if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0].tasks)) {
            const fullJson = parsed[0].tasks.join('');
            const logs = JSON.parse(fullJson);
            resolve(Array.isArray(logs) ? logs : []);
          } else {
            resolve([]);
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('  İŞ TAKİP SİSTEMİ - BULUT HATA VE SİSTEM GÜNLÜĞÜ EŞİTLEME');
  console.log('  Zaman:', new Date().toLocaleString('tr-TR'));
  console.log('================================================================');
  console.log('-> Supabase (Slot 13) üzerinden hata kayıtları sorgulanıyor...');

  try {
    const logs = await fetchCloudLogs();
    console.log(`-> Buluttan ${logs.length} adet hata/olay kaydı alındı.`);

    if (logs.length === 0) {
      console.log('-> Bulutta henüz kayıtlı bir sistem hatası bulunmuyor.');
      if (!fs.existsSync(mainLogFile)) {
        const initialHeader = [
          '================================================================================',
          '                     İŞ TAKİP SİSTEMİ - HATA VE SİSTEM GÜNLÜĞÜ                   ',
          `  Oluşturulma: ${new Date().toLocaleString('tr-TR')}`,
          '  Durum: Sistem aktif, henüz kayıtlı hata bulunmuyor.',
          '================================================================================\n',
        ].join('\n');
        fs.writeFileSync(mainLogFile, initialHeader, 'utf8');
      }
      console.log(`-> Log dosyası hazır: ${mainLogFile}`);
      return;
    }

    // Tarihe göre artan (kronolojik) sırala
    logs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const lines = [
      '================================================================================',
      '                     İŞ TAKİP SİSTEMİ - HATA VE SİSTEM GÜNLÜĞÜ                   ',
      `  Son Güncelleme : ${new Date().toLocaleString('tr-TR')}`,
      `  Toplam Kayıt   : ${logs.length}`,
      '  Hedef Dosya    : ' + mainLogFile,
      '================================================================================\n',
    ];

    for (const item of logs) {
      const userInfo = item.userName
        ? `[Kullanıcı: ${item.userName}${item.companyCode ? ' / ' + item.companyCode : ''}] `
        : '';
      let line = `[${item.dateStr}] [${item.level}] [${item.category}] ${userInfo}${item.message}`;
      if (item.details) {
        line += `\n   -> Detay: ${String(item.details).replace(/\n/g, '\n      ')}`;
      }
      if (item.deviceInfo) {
        line += `\n   -> Cihaz: ${item.deviceInfo}`;
      }
      lines.push(line);
      lines.push('--------------------------------------------------------------------------------');
    }

    fs.writeFileSync(mainLogFile, lines.join('\n') + '\n', 'utf8');
    console.log(`-> [BAŞARILI] Log dosyası güncellendi: ${mainLogFile}`);
  } catch (err) {
    console.error('Hata:', err.message);
    process.exit(1);
  }
}

main();
