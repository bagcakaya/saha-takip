import { AccountingCategory, CashRegister, QuotationFooterTemplate } from '../types/storage';

export const DEFAULT_CASH_REGISTERS: CashRegister[] = [
  { id: 'cr-merkez', name: 'Merkez Kasa', isDefault: true, description: 'Ana Merkez Kasası' },
  { id: 'cr-banka', name: 'Banka Hesabı', isDefault: false, description: 'Şirket Banka Hesabı / POS' },
];

export const DEFAULT_ACCOUNTING_CATEGORIES: AccountingCategory[] = [
  // Gider Kalemleri (Masraf Kalemleri) - Standart ERP Muhasebe Kodları
  { id: 'cat-exp-1', code: '770.01', name: 'Yemek & Mutfak Gideri', type: 'expense', isActive: true, createdAt: 1 },
  { id: 'cat-exp-2', code: '770.02', name: 'Yol & Ulaşım Masrafı', type: 'expense', isActive: true, createdAt: 2 },
  { id: 'cat-exp-3', code: '770.03', name: 'Ofis & Kırtasiye Gideri', type: 'expense', isActive: true, createdAt: 3 },
  { id: 'cat-exp-4', code: '770.04', name: 'Akaryakıt / Yakıt Gideri', type: 'expense', isActive: true, createdAt: 4 },
  { id: 'cat-exp-5', code: '770.05', name: 'Kargo & Nakliye Masrafı', type: 'expense', isActive: true, createdAt: 5 },
  { id: 'cat-exp-6', code: '770.06', name: 'Bakım & Onarım Gideri', type: 'expense', isActive: true, createdAt: 6 },
  { id: 'cat-exp-7', code: '770.07', name: 'Kira & Aidat Gideri', type: 'expense', isActive: true, createdAt: 7 },
  { id: 'cat-exp-8', code: '770.08', name: 'Fatura (Elektrik / Su / Gaz / Net)', type: 'expense', isActive: true, createdAt: 8 },
  { id: 'cat-exp-9', code: '770.09', name: 'Personel Avans & Harcırah', type: 'expense', isActive: true, createdAt: 9 },
  { id: 'cat-exp-10', code: '770.99', name: 'Muhtelif Genel Masraflar', type: 'expense', isActive: true, createdAt: 10 },

  // Gelir Kalemleri
  { id: 'cat-inc-1', code: '600.01', name: 'Hizmet & Servis Geliri', type: 'income', isActive: true, createdAt: 11 },
  { id: 'cat-inc-2', code: '600.02', name: 'Mal & Ürün Satış Geliri', type: 'income', isActive: true, createdAt: 12 },
  { id: 'cat-inc-3', code: '600.03', name: 'Montaj & Kurulum Geliri', type: 'income', isActive: true, createdAt: 13 },
  { id: 'cat-inc-4', code: '602.01', name: 'Diğer Faaliyet Gelirleri', type: 'income', isActive: true, createdAt: 14 },
];

export const DEFAULT_QUOTATION_FOOTER_TEMPLATES: QuotationFooterTemplate[] = [
  {
    id: 'qft-payment-1',
    title: 'Ödeme Koşulları',
    category: 'payment',
    content: '%50 sipariş onayında avans, kalan %50 bakiye ürün ve hizmet teslimatında nakit veya banka havalesi (EFT) ile tahsil edilir.',
    isDefaultSelected: true,
    createdAt: 1,
  },
  {
    id: 'qft-payment-2',
    title: 'Ödeme Koşulları (Peşin / Kredi Kartı)',
    category: 'payment',
    content: 'Fatura kesim ve teslimat tarihinde peşin (Nakit / Havale / EFT) veya kredi kartı ile ödeme yapılır.',
    isDefaultSelected: false,
    createdAt: 2,
  },
  {
    id: 'qft-delivery-1',
    title: 'Teslimat Koşulları',
    category: 'delivery',
    content: 'Ürünlerin teslimatı, montajı ve devreye alınması firmamız teknik ekibi tarafından müşteri lokasyonunda gerçekleştirilecektir.',
    isDefaultSelected: true,
    createdAt: 3,
  },
  {
    id: 'qft-leadtime-1',
    title: 'Termin Tarihi',
    category: 'lead_time',
    content: 'Sipariş ve ön ödeme onayını takip eden 3 - 5 iş günü içerisinde teslimat ve kurulum tamamlanacaktır.',
    isDefaultSelected: true,
    createdAt: 4,
  },
  {
    id: 'qft-validity-1',
    title: 'Teklif Geçerlilik Süresi',
    category: 'validity',
    content: 'İşbu fiyat teklifi düzenlenme tarihinden itibaren 7 (yedi) takvim günü süreyle geçerlidir. Döviz kuru veya üretici fiyat değişimlerinde revize hakkı saklıdır.',
    isDefaultSelected: true,
    createdAt: 5,
  },
  {
    id: 'qft-warranty-1',
    title: 'Garanti ve Teknik Destek Koşulları',
    category: 'warranty',
    content: 'Teklif kapsamındaki sıfır donanım ürünleri 2 (iki) yıl üretici/distribütör garantisi altındadır. Kullanıcı hatası, sıvı teması ve voltaj kaynaklı arızalar garanti kapsamı dışındadır.',
    isDefaultSelected: true,
    createdAt: 6,
  },
];

// POLATLAR Kurumsal Vektörel Logo (Özel logo yüklenmemişse bile her teklifin en başında net çıkar)
export const POLATLAR_CORPORATE_LOGO_SVG_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 110" width="420" height="110">
  <defs>
    <linearGradient id="polatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e3a8a" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  </defs>
  <!-- Emblem Box -->
  <rect x="6" y="10" width="90" height="90" rx="20" fill="url(#polatGrad)" />
  <rect x="12" y="16" width="78" height="78" rx="15" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.45" />
  <!-- Stylized P & Shield/Tech Emblem -->
  <path d="M34 32 H56 C67 32 74 38 74 48 C74 58 67 64 56 64 H45 V78 H34 V32 Z M45 42 V54 H55 C60 54 63 52 63 48 C63 44 60 42 55 42 H45 Z" fill="#ffffff" />
  <circle cx="66" cy="73" r="6" fill="#10b981" />
  <!-- Typography -->
  <text x="114" y="58" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900" fill="#0f172a" letter-spacing="2">POLATLAR</text>
  <rect x="114" y="67" width="290" height="4" rx="2" fill="url(#accentGrad)" />
  <text x="114" y="88" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#475569" letter-spacing="2.2">KURUMSAL ÇÖZÜM &amp; SİSTEM MERKEZİ</text>
</svg>
`);

