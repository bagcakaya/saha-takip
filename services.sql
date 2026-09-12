-- ====================================================================
-- SAHA TAKİP RAPORU: SERVİSLER (TEKNİK SERVİS & MÜDAHALE) TABLOSU
-- Supabase SQL Editor'de bu sorguyu 1 kez çalıştırabilirsiniz:
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  location TEXT,
  work_done TEXT NOT NULL,
  date TEXT,
  created_at BIGINT NOT NULL,
  created_by TEXT,
  created_by_name TEXT
);

-- Realtime dinleyicisi için tabloyu yayına açın:
ALTER PUBLICATION supabase_realtime ADD TABLE services;
