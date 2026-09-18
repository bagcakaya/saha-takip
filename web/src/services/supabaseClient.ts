import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tftzengmncgyuhccacrh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_25IlzAkxESu2kVJhUQ15zQ_vw5nx265';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
