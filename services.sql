-- ====================================================================
-- SAHA TAKİP RAPORU: SERVİSLER (TEKNİK SERVİS & MÜDAHALE) TABLOSU
-- Supabase SQL Editor'de bu sorguyu 1 kez çalıştırabilirsiniz:
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  work_done TEXT NOT NULL,
  date TEXT,
  created_at BIGINT NOT NULL,
  created_by TEXT,
  created_by_name TEXT
);

-- Tablo önceden oluşturulmuşsa sütunları ekleyin:
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Realtime dinleyicisi için tabloyu yayına açın:
ALTER PUBLICATION supabase_realtime ADD TABLE services;
