-- ====================================================================
-- SAHA TAKİP SİSTEMİ: TÜM TABLOLAR VE GERÇEK ZAMANLI (REALTIME) KURULUMU
-- Supabase sol menüdeki SQL Editor (>_) sayfasına yapıştırıp RUN butonuna basın
-- ====================================================================

-- 1. STANDARD TASKS TABLOSU (Çoklu Modüller & Mesai / Slot Kayıtları)
CREATE TABLE IF NOT EXISTS public.standard_tasks (
  id INTEGER PRIMARY KEY,
  tasks TEXT[] NOT NULL DEFAULT '{}'
);

-- 2. LOCATIONS TABLOSU (Keşif & Montaj Görevleri)
CREATE TABLE IF NOT EXISTS public.locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  photos TEXT[],
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at BIGINT,
  created_by TEXT,
  created_by_name TEXT,
  tasks JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  completed_at BIGINT,
  completed_by TEXT,
  completed_by_name TEXT,
  completion_note TEXT,
  completion_photos TEXT[],
  approved_at BIGINT,
  approved_by TEXT,
  approved_by_name TEXT,
  rejected_at BIGINT,
  rejected_by TEXT,
  rejected_by_name TEXT,
  rejection_reason TEXT
);

-- 3. NOTES TABLOSU (Genel & İş Emri Notları)
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  created_by TEXT,
  created_by_name TEXT,
  target_mode TEXT DEFAULT 'self',
  target_user_ids TEXT[],
  target_user_names TEXT[],
  target_user_id TEXT,
  target_user_name TEXT,
  reminder_active BOOLEAN DEFAULT false,
  reminder_date TEXT,
  notified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  completed_at BIGINT,
  completed_by TEXT,
  completed_by_name TEXT,
  completion_note TEXT,
  approved_at BIGINT,
  approved_by TEXT,
  approved_by_name TEXT,
  rejected_at BIGINT,
  rejected_by TEXT,
  rejected_by_name TEXT,
  rejection_reason TEXT
);

-- 4. SERVICES TABLOSU (Teknik Servis & Müdahale)
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

-- 5. RETURN_WARRANTY TABLOSU (İade & Garanti Takibi)
CREATE TABLE IF NOT EXISTS public.return_warranty (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'warranty',
  company_name TEXT NOT NULL,
  sent_date TEXT NOT NULL,
  serial_number TEXT,
  tracking_code TEXT,
  serial_number_photo TEXT,
  tracking_code_photo TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  reminder_date TEXT,
  reminder_active BOOLEAN DEFAULT false,
  notified BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL,
  created_by TEXT,
  created_by_name TEXT,
  cari_name TEXT
);

-- RLS (Güvenlik Kısıtlamaları) Devre Dışı Bırakma
ALTER TABLE public.standard_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_warranty DISABLE ROW LEVEL SECURITY;

-- REALTIME (Canlı Yayın) Dinleyicilerini Açma
ALTER PUBLICATION supabase_realtime ADD TABLE standard_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE services;
ALTER PUBLICATION supabase_realtime ADD TABLE return_warranty;
