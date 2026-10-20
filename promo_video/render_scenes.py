import os
from playwright.sync_api import sync_playwright

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
  }
  
  body {
    width: 1920px;
    height: 1080px;
    background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 40%, #030712 100%);
    color: #f8fafc;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .grid-bg {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(circle at 50% 50%, black 50%, transparent 90%);
    pointer-events: none;
  }

  .glow-1 {
    position: absolute;
    width: 650px;
    height: 650px;
    top: -150px;
    left: 20%;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, transparent 70%);
    filter: blur(60px);
    pointer-events: none;
  }

  .glow-2 {
    position: absolute;
    width: 650px;
    height: 650px;
    bottom: -150px;
    right: 15%;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.20) 0%, transparent 70%);
    filter: blur(60px);
    pointer-events: none;
  }

  .top-bar {
    width: 100%;
    padding: 40px 80px 20px 80px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .brand-logo-img {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    object-fit: contain;
    background: #ffffff;
    padding: 4px;
    box-shadow: 0 0 25px rgba(56, 189, 248, 0.45);
    border: 1.5px solid rgba(255, 255, 255, 0.25);
  }

  .brand-text {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 1.8px;
    background: linear-gradient(to right, #ffffff, #e2e8f0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .top-tag {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 24px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-size: 15px;
    font-weight: 700;
    color: #38bdf8;
    backdrop-filter: blur(10px);
  }

  .pulse-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 12px #10b981;
  }

  .main-content {
    flex: 1;
    padding: 20px 80px 40px 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    z-index: 10;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    border-radius: 9999px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 22px;
    width: fit-content;
  }

  .badge-cyan {
    background: rgba(14, 165, 233, 0.15);
    border: 1px solid rgba(14, 165, 233, 0.4);
    color: #38bdf8;
  }

  .badge-amber {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
  }

  .badge-emerald {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
  }

  .badge-purple {
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.4);
    color: #c084fc;
  }

  .hero-title {
    font-size: 60px;
    font-weight: 900;
    line-height: 1.15;
    margin-bottom: 18px;
    letter-spacing: -1px;
    max-width: 1450px;
  }

  .highlight-cyan {
    background: linear-gradient(135deg, #38bdf8, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .highlight-amber {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .highlight-emerald {
    background: linear-gradient(135deg, #34d399, #10b981);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .highlight-purple {
    background: linear-gradient(135deg, #c084fc, #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .hero-subtitle {
    font-size: 23px;
    color: #94a3b8;
    line-height: 1.5;
    margin-bottom: 42px;
    max-width: 1250px;
    font-weight: 500;
  }

  .cards-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }

  .glass-card {
    background: rgba(15, 23, 42, 0.70);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 34px;
    backdrop-filter: blur(20px);
    position: relative;
    overflow: hidden;
    box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
  }

  .card-top-border {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
  }

  .card-icon {
    width: 60px;
    height: 60px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    margin-bottom: 20px;
  }

  .card-title {
    font-size: 23px;
    font-weight: 800;
    color: #f1f5f9;
    margin-bottom: 12px;
  }

  .card-desc {
    font-size: 16px;
    color: #94a3b8;
    line-height: 1.6;
    font-weight: 500;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 800;
    font-family: 'JetBrains Mono', monospace;
    margin-top: 20px;
  }

  /* Two Column Layout for Görsel-1 showcase */
  .two-column-layout {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 50px;
    align-items: center;
  }

  .mockup-container {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
  }

  .mockup-glow {
    position: absolute;
    inset: -20px;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%);
    filter: blur(35px);
    pointer-events: none;
  }

  .mockup-frame {
    background: #0f172a;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(245, 158, 11, 0.2);
    position: relative;
    max-width: 460px;
  }

  .mockup-top-bar {
    background: #1e293b;
    padding: 12px 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .mockup-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .mockup-dot.red { background: #ef4444; }
  .mockup-dot.yellow { background: #f59e0b; }
  .mockup-dot.green { background: #10b981; }

  .mockup-label {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    margin-left: 8px;
    letter-spacing: 0.5px;
  }

  .mockup-img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
  }

  .feature-item {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 18px 22px;
  }

  .feature-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    shrink: 0;
  }

  .bottom-info {
    padding: 0 80px 30px 80px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 15px;
    color: #64748b;
    font-weight: 600;
    z-index: 10;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow-1"></div>
  <div class="glow-2"></div>

  <div class="top-bar">
    <div class="brand">
      <img src="../assets/app_logo.png" class="brand-logo-img" alt="İş Takip Sistemi Logo" />
      <span class="brand-text">İŞ TAKİP SİSTEMİ</span>
    </div>
    <div class="top-tag">
      <span class="pulse-dot"></span>
      <span>Kurumsal Yönetim & Denetim</span>
    </div>
  </div>

  <div class="main-content">
    __CONTENT__
  </div>

  <div class="bottom-info">
    <span>İş Takip Sistemi &copy; 2026 • Kurumsal Süreç ve Denetim Çözümü</span>
    <span>Kurumsal Ekipler İçin Güvenli & Modüler Yönetim</span>
  </div>
</body>
</html>
"""

SCENE_CONTENTS = {
    # 1. GİRİŞ
    "scene_1": """
      <div class="badge badge-cyan">
        <span>🚀 KURUMSAL YÖNETİM SİSTEMİ</span>
      </div>
      <h1 class="hero-title">
        Kurumsal Süreçlerinizi ve Kurallarınızı <span class="highlight-cyan">Tek Merkezden Yönetin</span>
      </h1>
      <p class="hero-subtitle">
        Şirket içi iletişimsizliğe, unutulan talimatlara ve güvenlik açıklarına son verin. İş Takip Sistemi ile firmanızda tam kontrol ve şeffaflık sağlayın.
      </p>

      <div class="cards-grid-3">
        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #fbbf24, transparent);"></div>
          <div class="card-icon" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">📌</div>
          <div class="card-title">Yönetici Talimatları & Kurallar</div>
          <div class="card-desc">Çalışma kuralları, prosedürler, acil uyarılar ve kilitli ekranda çalan sesli donanım alarmları.</div>
          <div class="status-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">MODÜL 1: HATIRLATMA</div>
        </div>

        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #10b981, transparent);"></div>
          <div class="card-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">🛡️</div>
          <div class="card-title">Detaylı Güvenlik Logları</div>
          <div class="card-desc">Yetkisiz cihaz eşleşmeleri, oturum geçmişi ve tüm sistem aktivitelerinin eksiksiz denetimi.</div>
          <div class="status-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">MODÜL 2: LOG KAYITLARI</div>
        </div>

        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #a855f7, transparent);"></div>
          <div class="card-icon" style="background: rgba(168, 85, 247, 0.15); color: #a855f7;">📲</div>
          <div class="card-title">Anlık Push Bildirimleri</div>
          <div class="card-desc">Yeni talimat ve alarmlarda telefona anında donanım push bildirimi ve çan bildirim merkezi.</div>
          <div class="status-pill" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">MODÜL 3: ANLIK BİLDİRİMLER</div>
        </div>
      </div>
    """,

    # 2. HATIRLATMA & ÇALIŞMA KURALLARI (GÖRSEL-1 UI ÖNE ÇIKARILDI!)
    "scene_2": """
      <div class="two-column-layout">
        <div>
          <div class="badge badge-amber">
            <span>📌 MODÜL 1: GELİŞMİŞ HATIRLATMA & TALİMATLAR</span>
          </div>
          <h1 class="hero-title" style="font-size: 52px; margin-bottom: 16px;">
            Yönetici Talimatları ve <span class="highlight-amber">Akıllı Hatırlatmalar</span>
          </h1>
          <p class="hero-subtitle" style="font-size: 20px; margin-bottom: 30px;">
            Şirket prosedürleri, çalışma kuralları ve acil talimatlar tek merkezden personele tebliğ edilir; kritik detaylar asla unutulmaz.
          </p>

          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">📢</div>
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">Standart Prosedür ve Kural Yayını</div>
              <div style="font-size: 14px; color: #94a3b8; line-height: 1.5;">Yöneticiler çalışma kurallarını, talimatları ve acil uyarıları anında tüm personele yayınlar.</div>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8;">⏰</div>
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">Tarihli ve Saatli Hatırlatıcılar</div>
              <div style="font-size: 14px; color: #94a3b8; line-height: 1.5;">İleri tarihli kritik işler veya teslimatlar için tam gün ve saatinde hatırlatıcı alarmlar kurulur.</div>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">🔊</div>
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">Kilitli Ekranda Sesli Donanım Alarmı</div>
              <div style="font-size: 14px; color: #94a3b8; line-height: 1.5;">Uygulama kapalı olsa dahi telefon sesli olarak çalar ve personeli anında uyarır.</div>
            </div>
          </div>
        </div>

        <div class="mockup-container">
          <div class="mockup-glow"></div>
          <div class="mockup-frame">
            <div class="mockup-top-bar">
              <span class="mockup-dot red"></span>
              <span class="mockup-dot yellow"></span>
              <span class="mockup-dot green"></span>
              <span class="mockup-label">Hatırlatmalar & Çalışma Kuralları</span>
            </div>
            <img src="../assets/gorsel_1.png" class="mockup-img" alt="Hatırlatmalar & Çalışma Kuralları UI" />
          </div>
        </div>
      </div>
    """,

    # 3. LOG KAYITLARI (GÖRSEL-2 Şeffaf Aktivite Günlüğü ÇIKARILDI!)
    "scene_3": """
      <div class="badge badge-emerald">
        <span>🛡️ MODÜL 2: DETAYLI LOG KAYITLARI</span>
      </div>
      <h1 class="hero-title">
        Tüm Sistem Hareketleri <span class="highlight-emerald">Güvenli ve Denetlenebilir</span>
      </h1>
      <p class="hero-subtitle">
        Cihaz uyuşmazlığı, yetkisiz giriş denemeleri ve kilitlenme logları. Yöneticiler için eksiksiz ve şeffaf denetim izi.
      </p>

      <div class="cards-grid-3">
        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #10b981, transparent);"></div>
          <div class="card-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">🔒</div>
          <div class="card-title">Güvenlik ve Cihaz Takibi</div>
          <div class="card-desc">Farklı cihazlardan yetkisiz giriş denemeleri, şüpheli hareketler veya yetki aşımları kırmızı bayrakla güvenlik günlüğüne işlenir.</div>
          <div class="status-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">GÜVENLİK GÜNLÜĞÜ</div>
        </div>

        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #0ea5e9, transparent);"></div>
          <div class="card-icon" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9;">📋</div>
          <div class="card-title">Oturum ve Erişim Geçmişi</div>
          <div class="card-desc">Sisteme hangi kullanıcının ne zaman erişim sağladığı kesin saat ve IP/cihaz bilgisiyle kayıt altında tutulur.</div>
          <div class="status-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8;">OTURUM DENETİMİ</div>
        </div>

        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #6366f1, transparent);"></div>
          <div class="card-icon" style="background: rgba(99, 102, 241, 0.15); color: #6366f1;">🔎</div>
          <div class="card-title">Geriye Dönük Kolay İnceleme</div>
          <div class="card-desc">Geçmişe ait tüm sistem ve güvenlik kayıtlarını tek tıkla filtreleyin; şeffaf denetim ile tüm soru işaretlerini ortadan kaldırın.</div>
          <div class="status-pill" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">KOLAY DENETİM</div>
        </div>
      </div>
    """,

    # 4. ANLIK BİLDİRİMLER
    "scene_4": """
      <div class="badge badge-purple">
        <span>📲 MODÜL 3: ANLIK PUSH VE BİLDİRİMLER</span>
      </div>
      <h1 class="hero-title">
        Ekibinizle <span class="highlight-cyan">Sıfır Gecikme ile Kesintisiz İletişim</span>
      </h1>
      <p class="hero-subtitle">
        Yeni bir kural, talimat veya hatırlatma eklendiğinde personele ve yöneticiye anında donanım seviyesinde bildirim iletilir.
      </p>

      <div class="cards-grid-3">
        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #a855f7, transparent);"></div>
          <div class="card-icon" style="background: rgba(168, 85, 247, 0.15); color: #a855f7;">⚡</div>
          <div class="card-title">Donanım Push Bildirimi</div>
          <div class="card-desc">OneSignal bulut altyapısıyla telefon kilitliyken bile doğrudan sesli bildirim gider. Uygulamayı açık tutmaya gerek kalmaz.</div>
          <div class="status-pill" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">KİLİTLİ EKRANDA PUSH</div>
        </div>

        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #0ea5e9, transparent);"></div>
          <div class="card-icon" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9;">🔔</div>
          <div class="card-title">Çan & Rozet Sistemi</div>
          <div class="card-desc">Uygulama içi bildirim merkezi okunmamış talimatları ve duyuruları sayar; tek tıkla doğrudan ilgili duyuruya odaklar.</div>
          <div class="status-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8;">ÇAN BİLDİRİM MERKEZİ</div>
        </div>

        <div class="glass-card">
          <div class="card-top-border" style="background: linear-gradient(90deg, transparent, #10b981, transparent);"></div>
          <div class="card-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">🔄</div>
          <div class="card-title">Çevrimdışı Kuyruk Güvencesi</div>
          <div class="card-desc">İnternet bağlantısı kesilse dahi arka plan kuyruk sistemi bildirimleri bellekte saklar; bağlantı sağlandığı an iletir.</div>
          <div class="status-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">KAYIPSIZ İLETİM</div>
        </div>
      </div>
    """,

    # 5. KAPANIŞ (İŞ TAKİP SİSTEMİ)
    "scene_5": """
      <div class="badge badge-cyan">
        <span>🚀 KURUMSAL ÇÖZÜM ORTAĞINIZ</span>
      </div>
      <h1 class="hero-title" style="font-size: 70px;">
        İş Takip Sistemi ile <span class="highlight-cyan">Tam Kontrol Elinizde</span>
      </h1>
      <p class="hero-subtitle" style="font-size: 25px;">
        Yönetici Talimatları • Akıllı Hatırlatmalar • Güvenlik Logları • Anlık Bildirimler
      </p>

      <div class="cards-grid-3" style="margin-bottom: 40px;">
        <div class="glass-card" style="text-align: center; padding: 30px;">
          <div class="card-title" style="color: #fbbf24; font-size: 26px;">📌 Hatırlatma & Talimat</div>
          <div class="card-desc">Standart Kurallar, Duyurular ve Sesli Donanım Alarmları</div>
        </div>
        <div class="glass-card" style="text-align: center; padding: 30px;">
          <div class="card-title" style="color: #34d399; font-size: 26px;">🛡️ Güvenlik Logları</div>
          <div class="card-desc">Yetkisiz Girişler, Cihaz Eşleşmeleri ve Şeffaf Denetim</div>
        </div>
        <div class="glass-card" style="text-align: center; padding: 30px;">
          <div class="card-title" style="color: #c084fc; font-size: 26px;">📲 Anlık Bildirimler</div>
          <div class="card-desc">Kilitli Ekranda Push Bildirimi ve Çan Rozet Merkezi</div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 24px;">
        <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 18px 48px; border-radius: 16px; font-size: 22px; font-weight: 800; color: #ffffff; box-shadow: 0 0 35px rgba(99, 102, 241, 0.6);">
          Hemen Başlayın
        </div>
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="../assets/app_logo.png" style="width: 44px; height: 44px; border-radius: 12px; background: white; padding: 3px;" />
          <span style="font-size: 24px; color: #ffffff; font-weight: 900; letter-spacing: 1.5px;">İŞ TAKİP SİSTEMİ</span>
        </div>
      </div>
    """
}

def render_all_scenes():
    os.makedirs("promo_video/frames", exist_ok=True)
    os.makedirs("promo_video/html", exist_ok=True)

    print("Playwright ile 1920x1080 sahne kareleri render ediliyor...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        for scene_id, content in SCENE_CONTENTS.items():
            html = HTML_TEMPLATE.replace("__CONTENT__", content)
            html_path = os.path.abspath(f"promo_video/html/{scene_id}.html")
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(html)

            page.goto(f"file:///{html_path.replace(os.sep, '/')}")
            page.wait_for_timeout(600)
            out_png = f"promo_video/frames/{scene_id}.png"
            page.screenshot(path=out_png)
            print(f"[OK] {scene_id} -> {out_png}")

        browser.close()

if __name__ == "__main__":
    render_all_scenes()
