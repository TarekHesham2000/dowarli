/**
 * Client + server Supabase requests carry this version (header + no-store fetch)
 * so deploys don’t reuse stale HTTP caches. Value is set at build time in next.config.
 */
export const SUPABASE_DATA_VERSION =
  process.env.NEXT_PUBLIC_SUPABASE_DATA_VERSION?.trim() || "local";

function createCacheBustingFetch(version: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("X-Dowarli-Data-Version", version);
    return fetch(input, {
      ...init,
      cache: "no-store",
      headers,
    });
  };
}

const cacheBustingFetch = createCacheBustingFetch(SUPABASE_DATA_VERSION);

/**
 * Spread into `createBrowserClient`, `createServerClient`, or `createClient`:
 * `createServerClient(url, key, { ...getSupabaseGlobalClientOptions(), cookies: {...} })`
 */
export function getSupabaseGlobalClientOptions(): {
  global: {
    headers: Record<string, string>;
    fetch: typeof fetch;
  };
} {
  return {
    global: {
      headers: { "X-Dowarli-Data-Version": SUPABASE_DATA_VERSION },
      fetch: cacheBustingFetch,
    },
  };
}
