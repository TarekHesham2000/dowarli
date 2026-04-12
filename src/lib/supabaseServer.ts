import { createClient } from "@supabase/supabase-js";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE env vars");
  }

  return createClient(url, serviceKey, {
    ...getSupabaseGlobalClientOptions(),
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

