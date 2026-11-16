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
export const POLATLAR_CORPORATE_LOGO_SVG_DATA_URI = 'data:image/png;base64,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';

export const POLATLAR_NAVY_LOGO_DATA_URI = 'data:image/png;base64,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';
