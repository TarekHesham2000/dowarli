import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  getSupabaseGlobalClientOptions(),
);