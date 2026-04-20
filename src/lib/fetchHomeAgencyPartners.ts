import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";
import { resolveAgencyLogoPublicUrl } from "@/lib/agencyLogoUrl";

export type HomeAgencyPartner = {
  id: string;
  name: string;
  slug: string;
  /** Ready for <img src={…} /> when non-null. */
  logoUrl: string | null;
};

type Row = { id: string; name: string | null; slug: string | null; logo_url: string | null };

function toPartners(rows: Row[] | null | undefined): HomeAgencyPartner[] {
  const list = (rows ?? []).filter((r) => r.name?.trim() && r.logo_url?.trim() && r.slug?.trim());
  return list.map((r) => ({
    id: r.id,
    name: r.name!.trim(),
    slug: r.slug!.trim(),
    logoUrl: resolveAgencyLogoPublicUrl(r.logo_url),
  }));
}

type Attempt = { visibility: "is_active" | "is_verified" | "any"; order: "created_at" | "id" };

export async function fetchHomeAgencyPartners(): Promise<HomeAgencyPartner[]> {
  const supabase = createSupabaseAnonServer();

  const run = async ({ visibility, order }: Attempt) => {
    const baseSelect: string =
      order === "created_at" ? "id, name, slug, logo_url, created_at" : "id, name, slug, logo_url";
    let q = supabase.from("agencies").select(baseSelect).not("logo_url", "is", null).not("name", "is", null);
    if (visibility === "is_active") {
      q = q.eq("is_active", true);
    } else if (visibility === "is_verified") {
      q = q.eq("is_verified", true);
    }
    if (order === "created_at") {
      q = q.order("created_at", { ascending: false });
    } else {
      q = q.order("id", { ascending: false });
    }
    return q.limit(48);
  };

  const attempts: Attempt[] = [
    { visibility: "is_active", order: "created_at" },
    { visibility: "is_verified", order: "created_at" },
    { visibility: "is_active", order: "id" },
    { visibility: "is_verified", order: "id" },
  ];

  for (const att of attempts) {
    const { data, error } = await run(att);
    if (!error && data?.length) {
      return toPartners(data as unknown as Row[]);
    }
  }

  return [];
}
