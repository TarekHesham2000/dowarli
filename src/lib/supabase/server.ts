import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

/**
 * Supabase browser client for **Server Components / Route Handlers** using the anon key.
 * Uses the Next.js cookie store so the session stays aligned with `proxy` + `updateSession`.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    ...getSupabaseGlobalClientOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Server Components: set() can throw — edge proxy refresh should have updated cookies */
        }
      },
    },
  });
}
