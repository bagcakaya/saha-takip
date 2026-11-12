/**
 * Saha Takip Sistemi - Bağımsız 7/24 Vardiya Bildirim Bekçisi (Daemon)
 *
 * Hiçbir telefon veya tarayıcı açık olmasa bile (uygulama kill edilmiş / ekran kilitli iken)
 * her 20 saniyede bir kesintisiz çalışarak:
 * - Vardiya başlangıcından +15. dakikada işe giriş yapmamış personele bildirim gönderir.
 * - Vardiya bitişinden +5. ve +10. dakikada işten çıkış yapmamış personele bildirim gönderir.
 */

const { runShiftWatchdog } = require('./shiftWatchdog');

const INTERVAL_MS = 20 * 1000;
const PORT = process.env.PORT || 3001;

process.on('uncaughtException', (err) => {
  console.error('>> [WatchdogDaemon] Yakalanmamış hata (çalışmaya devam ediyor):', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('>> [WatchdogDaemon] İşlenmemiş Promise hatası (çalışmaya devam ediyor):', reason);
});

async function tick() {
  try {
    const res = await runShiftWatchdog(PORT);
    if (res && Array.isArray(res.dispatchedAlerts) && res.dispatchedAlerts.length > 0) {
      console.log(
        `[${new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })}] >> Bildirim gönderildi:`,
        res.dispatchedAlerts.join(', ')
      );
    }
  } catch (err) {
    console.warn('>> [WatchdogDaemon] Kontrol hatası:', err?.message || err);
  }
}

console.log('================================================================');
console.log('>> 7/24 Otonom Vardiya Bekçisi (Watchdog Agent) Başlatıldı (Periyot: 20sn)');
console.log('>> Giriş (+15. dk) ve Çıkış (+5. dk / +10. dk) kontrolleri aktif.');
console.log('================================================================');

tick();
setInterval(tick, INTERVAL_MS);
