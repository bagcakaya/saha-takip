-- ====================================================================
-- SAHA TAKİP RAPORU: İADE VE GARANTİ TAKİBİ TABLOSU
-- Supabase SQL Editor'de bu sorguyu 1 kez çalıştırabilirsiniz:
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.return_warranty (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'warranty', -- 'warranty' veya 'return'
  company_name TEXT NOT NULL,
  sent_date TEXT NOT NULL,
  serial_number TEXT,
  tracking_code TEXT,
  serial_number_photo TEXT,
  tracking_code_photo TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' (Süreçte) veya 'completed' (Sonuçlandı)
  reminder_date TEXT,
  reminder_active BOOLEAN DEFAULT false,
  notified BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL,
  created_by TEXT,
  created_by_name TEXT
);

-- Realtime dinleyicisi için tabloyu yayına açın:
ALTER PUBLICATION supabase_realtime ADD TABLE return_warranty;
