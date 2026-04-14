import type { Metadata } from "next";
import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";
import AgenciesDirectoryClient, { type AgencyListRow } from "./AgenciesDirectoryClient";

export const metadata: Metadata = {
  title: "دليل الوكالات",
  description: "تصفّح الوكالات العقارية المعتمدة على دَورلي.",
};

const AGENCY_ID_CHUNK = 80;

export default async function AgenciesDirectoryPage() {
  const supabase = createSupabaseAnonServer();
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, slug, logo_url, bio")
    .eq("is_verified", true)
    .order("name", { ascending: true });

  const rows = !error && data ? data : [];
  const ids = rows.map((r) => r.id).filter(Boolean);
  const counts = new Map<string, number>();

  for (let i = 0; i < ids.length; i += AGENCY_ID_CHUNK) {
    const slice = ids.slice(i, i + AGENCY_ID_CHUNK);
    if (slice.length === 0) continue;
    const { data: props, error: pErr } = await supabase
      .from("properties")
      .select("agency_id")
      .in("agency_id", slice)
      .eq("status", "active");
    if (pErr) {
      console.error("Agencies directory listing counts:", pErr);
      continue;
    }
    for (const p of props ?? []) {
      const aid = p.agency_id as string | null;
      if (!aid) continue;
      counts.set(aid, (counts.get(aid) ?? 0) + 1);
    }
  }

  const initial: AgencyListRow[] = rows.map((a) => ({
    ...(a as AgencyListRow),
    active_listings_count: counts.get(a.id) ?? 0,
  }));

  return <AgenciesDirectoryClient initial={initial} />;
}
