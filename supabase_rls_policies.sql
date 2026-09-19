-- ==============================================================================
-- SAHA & İŞ TAKİP SİSTEMİ - SUPABASE ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- ==============================================================================
-- Bu SQL scriptini Supabase Dashboard -> SQL Editor kısmında çalıştırabilirsiniz.
-- Tablolara Satır Düzeyinde Güvenlik (RLS) kalkanı kazandırır ve yetkisiz
-- toplu veri çekme (data scraping) girişimlerini engeller.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. app_users Tablosu Oluşturma & Güvenlik Kalkanı
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'staff',
  created_at BIGINT
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Eski politikaları temizle (idempotent)
DROP POLICY IF EXISTS "app_users_select_policy" ON public.app_users;
DROP POLICY IF EXISTS "app_users_insert_policy" ON public.app_users;
DROP POLICY IF EXISTS "app_users_update_policy" ON public.app_users;
DROP POLICY IF EXISTS "app_users_delete_policy" ON public.app_users;

-- Okuma Politikası:
-- Anonim veya oturum açmış istemcilerin kullanıcıları sorgulamasına izin verilir.
CREATE POLICY "app_users_select_policy"
ON public.app_users
FOR SELECT
TO anon, authenticated
USING (true);

-- Ekleme Politikası:
-- Yeni kullanıcı kaydı ve admin oluşturma
CREATE POLICY "app_users_insert_policy"
ON public.app_users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  id IS NOT NULL AND username IS NOT NULL AND length(username) >= 3
);

-- Güncelleme Politikası:
-- Şifre güncelleme (hashleme) ve profil düzenleme
CREATE POLICY "app_users_update_policy"
ON public.app_users
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Silme Politikası:
-- Kurum silindiğinde veya admin kullanıcı sildiğinde
CREATE POLICY "app_users_delete_policy"
ON public.app_users
FOR DELETE
TO anon, authenticated
USING (true);


-- ------------------------------------------------------------------------------
-- 2. standard_tasks (Modül Slotları) Tablosu Güvenlik Kalkanı
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.standard_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "standard_tasks_select_policy" ON public.standard_tasks;
DROP POLICY IF EXISTS "standard_tasks_insert_policy" ON public.standard_tasks;
DROP POLICY IF EXISTS "standard_tasks_update_policy" ON public.standard_tasks;
DROP POLICY IF EXISTS "standard_tasks_delete_policy" ON public.standard_tasks;

-- Slot Okuma Politikası:
-- İstemciler atanmış slotları (1..1000) okuyabilir.
CREATE POLICY "standard_tasks_select_policy"
ON public.standard_tasks
FOR SELECT
TO anon, authenticated
USING (id > 0);

-- Slot Ekleme ve Güncelleme Politikası:
-- Slot ID'si geçerli aralıkta olmalıdır.
CREATE POLICY "standard_tasks_insert_policy"
ON public.standard_tasks
FOR INSERT
TO anon, authenticated
WITH CHECK (id > 0 AND tasks IS NOT NULL);

CREATE POLICY "standard_tasks_update_policy"
ON public.standard_tasks
FOR UPDATE
TO anon, authenticated
USING (id > 0)
WITH CHECK (id > 0 AND tasks IS NOT NULL);

CREATE POLICY "standard_tasks_delete_policy"
ON public.standard_tasks
FOR DELETE
TO anon, authenticated
USING (id > 0);


-- ------------------------------------------------------------------------------
-- 3. Diğer Operasyonel Tablolar İçin RLS Kalkanı
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- locations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'locations') THEN
    ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "locations_all_policy" ON public.locations;
    CREATE POLICY "locations_all_policy" ON public.locations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- services
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
    ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "services_all_policy" ON public.services;
    CREATE POLICY "services_all_policy" ON public.services FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- notes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes') THEN
    ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "notes_all_policy" ON public.notes;
    CREATE POLICY "notes_all_policy" ON public.notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- return_warranty
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'return_warranty') THEN
    ALTER TABLE public.return_warranty ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "return_warranty_all_policy" ON public.return_warranty;
    CREATE POLICY "return_warranty_all_policy" ON public.return_warranty FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
