import { createClient } from '@supabase/supabase-js';

// Single Operator Mode: there is no per-user JWT to scope requests by, so
// every route uses the service-role client directly (RLS is bypassed by
// design here — it stays defined in the migrations, dormant, ready for
// when multi-tenant auth comes back). Not parameterized with our
// hand-written `Database` type — see supabase/migrations for the schema
// and @/types/database for row types used to cast results where needed.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
}

export function getServiceClient() {
  return createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
