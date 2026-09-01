# Saha Takip Raporu - Web Uygulaması

Bu proje, **Saha Takip Raporu** mobil uygulamasının tüm özelliklerini, şablonlarını, veri modellerini ve PDF teslim tutanağı üretim yeteneklerini barındıran; hem mobil cihazlarda (telefon/tablet) hem de masaüstü tarayıcılarda kusursuz çalışan **Mobil Uyumlu (Responsive) Web Sitesi** sürümüdür.

## 🚀 Hızlı Başlangıç

Web uygulamasını yerel sunucuda çalıştırmak için bu dizinde (`web/`) terminal açarak aşağıdaki komutları kullanabilirsiniz:

### 1. Geliştirme Sunucusunu Başlatma (Dev Mode)
```bash
npm run dev
```
Terminalde çıkan adresi (örn: `http://localhost:5173`) tarayıcınızda açın.

### 2. Üretim Derlemesi (Build)
```bash
npm run build
```
Derlenmiş statik dosyalar `dist/` klasörü içerisine oluşturulur.

### 3. Derlemeyi Önizleme (Preview)
```bash
npm run preview
```

---

## 📱 Özellikler

1. **Kurulum Yönetimi & İstatistikler**:
   - Toplam lokasyon, genel tamamlanma yüzdesi ve mevcut değil istatistikleri.
   - Lokasyon arama ve yeni kurulum ekleme.
   - Harita kısayolu ile tek tıkla Google Haritalar'da yol tarifi açma.
   - İlerleme çubukları (Tamamlanan / Mevcut Değil / Beklemede).

2. **Detay Paneli & Görev Listesi**:
   - 3 Durumlu butonlar: `Beklemede`, `Tamamlandı`, `Mevcut Değil`.
   - Kuruluma özel ek görev ekleme ve silme.
   - Anlık görev arama.

3. **Notlar, GPS Konum & Fotoğraf Galerisi**:
   - Firma/Lokasyon ismi ve adresi düzenleme.
   - **GPS Konum Al**: Tek tıkla cihazın anlık koordinatlarını alma ve otomatik açık adrese dönüştürme.
   - **Kamera & Galeri**: Doğrudan fotoğraf çekme veya galeriden çoklu görsel seçme.
   - **Lightbox**: Fotoğrafları tam ekranda inceleme ve silme.

4. **PDF Teslim Tutanağı Üretimi**:
   - Kurumsal şablonla tek tıkla `.pdf` dosyası indirme veya tarayıcıdan yazdırma.

5. **Not Defteri & Alarmlı Hatırlatıcılar**:
   - Genel notlar oluşturma ve düzenleme.
   - Tarih/Saat seçerek hatırlatıcı kurma.
   - Tarayıcı bildirimleri ve sesli alarm uyarısı.

6. **Şablon Yönetimi & Yedekleme (JSON)**:
   - 12 standart görevi yönetme, yeni standart görev ekleme ve varsayılana sıfırlama.
   - **JSON Yedek Al / Yedek Yükle**: Mobil uygulama ile %100 uyumlu tam veri yedekleme.

7. **Çevrimdışı Çalışma (Offline-First)**:
   - `IndexedDB` ve `LocalStorage` sayesinde internet olmasa dahi tüm veriler ve fotoğraflar cihazınızda güvenle saklanır.
