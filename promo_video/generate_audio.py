import asyncio
import edge_tts
import os

SCENES = [
    {
        "id": "scene_1",
        "text": "Kurumsal süreçlerinizi, şirket içi kurallarınızı ve tüm operasyonel akışınızı tek bir merkezden yönetin. Karşınızda şirketinize hız, şeffaflık ve tam kontrol kazandıran İş Takip Sistemi.",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+0%",
    },
    {
        "id": "scene_2",
        "text": "Gelişmiş Hatırlatma ve Talimat sistemiyle şirket prosedürleri ve kurallar tek çatı altında. Personele yönelik talimatları yayınlayın, acil uyarıları anında iletin; vakti geldiğinde telefon kilitliyken bile sesli donanım alarmları devreye girsin.",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+0%",
    },
    {
        "id": "scene_3",
        "text": "Detaylı Log Kayıtları ile tüm sistem hareketleri güvenli ve denetlenebilir. Yetkisiz giriş denemelerini, cihaz eşleşmelerini ve sistem güvenlik günlüklerini geriye dönük olarak kolayca denetleyin.",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+0%",
    },
    {
        "id": "scene_4",
        "text": "Anlık Bildirimler sayesinde şirket içi iletişimde sıfır gecikme. Yeni talimat yayınlandığında veya kritik bir hatırlatma zamanı geldiğinde personele ve yöneticilere anında bildirim ulaşır.",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+0%",
    },
    {
        "id": "scene_5",
        "text": "Yönetici Talimatları, Akıllı Hatırlatmalar, Güvenlik Logları ve Anlık Bildirimler. Firmanız için en yalın, hızlı ve güvenli çözüm. İş Takip Sistemi ile tam kontrol elinizde.",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+0%",
    },
]

async def main():
    os.makedirs("promo_video/audio", exist_ok=True)
    print("Is Takip Sistemi seslendirmeleri uretiliyor (tr-TR-AhmetNeural)...")
    for s in SCENES:
        out_file = f"promo_video/audio/{s['id']}.mp3"
        comm = edge_tts.Communicate(s['text'], s['voice'], rate=s['rate'])
        await comm.save(out_file)
        size = os.path.getsize(out_file)
        print(f"[OK] {s['id']} olusturuldu ({size} byte) -> {out_file}")

if __name__ == "__main__":
    asyncio.run(main())
