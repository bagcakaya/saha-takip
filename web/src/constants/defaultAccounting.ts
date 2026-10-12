import { AccountingCategory, CashRegister } from '../types/storage';

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
