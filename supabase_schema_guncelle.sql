-- ============================================================================
-- SAHA TAKİP SİSTEMİ - SUPABASE ŞEMA GÜNCELLEME BETİĞİ (İSTEĞE BAĞLI)
-- Bu betik mevcut verilere zarar vermez (IF NOT EXISTS kullanır).
-- Supabase Dashboard -> SQL Editor ekranına yapıştırıp "Run" diyerek çalıştırabilirsiniz.
-- ============================================================================

-- 1. notes (İş Emirleri & Notlar) tablosu eksik sütunlar
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS cari_name text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS processed_at bigint;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS processed_by text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS processed_by_name text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS used_materials text;

-- 2. services (Servis Fişleri) tablosu genişletilmiş sütunlar
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS cari_name text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS completed_at bigint;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS completed_by text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS completed_by_name text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS completion_note text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS completion_photos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS approved_at bigint;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS approved_by_name text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS rejected_at bigint;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS rejected_by text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS rejected_by_name text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 3. return_warranty (İade & Garanti) tablosu genişletilmiş sütunlar
ALTER TABLE public.return_warranty ADD COLUMN IF NOT EXISTS cari_name text;
ALTER TABLE public.return_warranty ADD COLUMN IF NOT EXISTS follow_up_note text;
ALTER TABLE public.return_warranty ADD COLUMN IF NOT EXISTS follow_up_date text;
ALTER TABLE public.return_warranty ADD COLUMN IF NOT EXISTS follow_up_by_name text;

-- 4. PostgREST şema önbelleğini yenile
NOTIFY pgrst, 'reload schema';
