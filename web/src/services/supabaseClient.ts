import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jxqtwwpwaalgxpwmeqbc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qetbs8PTG54vWFr2zDCl4g_mCTqzqpC';

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
