import { createClient } from '@supabase/supabase-js';

/* Single shared anonymous browser client for the public site (schema: website).
   It never signs anyone in, so it doesn't persist a session — this avoids the
   "Multiple GoTrueClient instances" warning from several clients sharing one storage key. */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'website' },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
