-- ====================================================================
-- SAHA TAKİP RAPORU: İŞ EMİRLERİ ONAY / RED VE TAMAMLAMA ALANLARI
-- Supabase SQL Editor'de bu sorguyu 1 kez çalıştırabilirsiniz:
-- ====================================================================

-- notes tablosuna durum ve onay sütunlarını ekleyin:
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS completed_at BIGINT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS completed_by TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS completed_by_name TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS approved_at BIGINT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS approved_by_name TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS rejected_at BIGINT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS rejected_by_name TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS cari_name TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS photos TEXT[];
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS completion_photos TEXT[];

-- Realtime yayını açık değilse ekleyin:
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
