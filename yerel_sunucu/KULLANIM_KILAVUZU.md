# 🏢 Saha Takip Sistemi - Windows Server 2022 & SSMS Taşıma Kılavuzu

Bu klasör, Saha Takip Sistemi'ni Supabase bulutundan **ofisinizdeki yerel Windows Server 2022 + Microsoft SQL Server (SSMS)** ortamına eksiksiz ve sıfır veri kaybıyla taşımak için hazırlanmıştır.

---

## 📁 Klasör İçeriği

1. **`01_kurulum_tablolar.sql`**  
   SSMS içinde çalıştırılacak T-SQL scripti. `SahaTakipDB` veritabanını ve `locations`, `notes`, `services`, `return_warranty`, `standard_tasks` tablolarını oluşturur.
2. **`02_mevcut_veriler_yedek.sql`**  
   Supabase'den çekilen **tüm canlı verilerin (174 montaj, 311 not, 377 servis kaydı, 124 garanti/iade, kullanıcılar ve tüm ayarlar)** SQL Server `INSERT` komutlarıdır.
3. **`data_backup.json`**  
   Tüm veritabanının bağımsız ham JSON yedeği.
4. **`api/`**  
   Windows Server üzerinde arka planda çalışacak, mobil uygulama ve web'den gelen istekleri SQL Server'a yazacak hafif Node.js API köprüsü.
5. **`scripts/export_from_supabase.js`**  
   Pazartesi günü sistemi taşımadan hemen önce, son dakikaya kadar girilen yeni verileri de alıp `02_mevcut_veriler_yedek.sql` dosyasını güncellemek isterseniz tek tıkla çalıştırabileceğiniz güncelleme aracı.

---

## 🚀 Pazartesi Günü Kurulum Adımları (15 Dakika)

### ADIM 1: Veritabanını SSMS'te Oluşturma ve Verileri Yükleme
1. Windows Server 2022 üzerinde **SQL Server Management Studio (SSMS)** uygulamasını açın ve sunucuya bağlanın.
2. **`01_kurulum_tablolar.sql`** dosyasını SSMS içine sürükleyip bırakın ve üstteki **Execute (F5)** butonuna basın.  
   *(Ekranda `SahaTakipDB veritabanı başarıyla oluşturuldu` mesajı görünecektir.)*
3. **`02_mevcut_veriler_yedek.sql`** dosyasını SSMS içine sürükleyip bırakın ve **Execute (F5)** butonuna basın.  
   *(Mevcut tüm verileriniz SQL Server tablolarına saniyeler içinde yazılacaktır.)*

---

### ADIM 2: Yerel API Servisini Başlatma
1. `yerel_sunucu/api` klasörüne gidin.
2. `.env.example` dosyasının bir kopyasını alıp adını **`.env`** yapın ve içine SQL Server bilgilerinizi yazın:
   ```env
   PORT=3000
   DB_SERVER=localhost
   DB_NAME=SahaTakipDB
   DB_USER=sa
   DB_PASSWORD=BurayaSifreniziYazin
   ```
3. Klasördeki **`Baslat.bat`** dosyasına çift tıklayın.  
   *(Gerekli paketler otomatik yüklenecek ve `Saha Takip Yerel API çalışıyor: http://0.0.0.0:3000` yazısı gelecektir.)*
4. Tarayıcınızdan `http://localhost:3000/api/health` adresine girdiğinizde `{"status":"ok","database":"connected"}` görüyorsanız veritabanı köprünüz hazırdır!

---

### ADIM 3: Dışa Açma (Cloudflare Tunnel - 2 Dakika, Ücretsiz & Portsuz)
Sahadaki personelin (4.5G ile gezen mobil uygulamanın) ve Vercel'deki sitenin ofisteki bu sunucuya güvenle bağlanması için:
* Modemden port açmaya veya statik IP satın almaya **gerek yoktur**.
* Windows Server 2022'ye ücretsiz Cloudflare Tunnel (`cloudflared`) kurulur ve `http://localhost:3000` portuna yönlendirilir.
* Size güvenli bir HTTPS adresi verilir (örn: `https://api-saha.sirketiniz.com` veya `https://xxx.trycloudflare.com`).

---

### ADIM 4: Web ve Mobilin Bağlanması
Web ve Mobil koddaki veri kaynağı URL'si tek bir satırla bu yeni adrese yönlendirilir.
* Supabase tamamen devreden çıkar.
* Fotoğraflar doğrudan Windows Server sabit diskinde (`C:\SahaTakipUploads`) depolanır.
* Sistem aylık hiçbir bulut veritabanı ücreti ödemeden kendi sunucunuzda çalışır.
