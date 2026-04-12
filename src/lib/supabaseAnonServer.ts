import { createClient } from "@supabase/supabase-js";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

/** Server-side reads using the anon key (respects RLS). For public pages / metadata. */
export function createSupabaseAnonServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, key, {
    ...getSupabaseGlobalClientOptions(),
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
