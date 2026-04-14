import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";
import AgencyPageClient, { type AgencyProperty, type AgencyPublic } from "./AgencyPageClient";

type Props = { params: Promise<{ slug: string }> };

function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** PostgREST ILIKE: escape % and _ so the slug is matched literally (case-insensitive). */
function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const segment = decodeSegment(raw);
  const supabase = createSupabaseAnonServer();

  const { data } = await supabase
    .from("agencies")
    .select("name, bio, logo_url, slug")
    .ilike("slug", escapeIlike(segment))
    .maybeSingle();

  if (!data) {
    return { title: "وكالة غير موجودة", robots: { index: false, follow: false } };
  }

  const row = data as { name: string; bio: string | null; logo_url: string | null; slug: string };
  const baseUrl = getSiteUrl();
  const title = `${row.name} | دَورلي`;
  const plainBio = row.bio?.replace(/\s+/g, " ").trim() ?? "";
  const description =
    plainBio.slice(0, 160) || `عروض وكالة ${row.name} — شقق ووحدات على دَورلي`;

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/agency/${row.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ar_EG",
      url: `${baseUrl}/agency/${row.slug}`,
      siteName: "دَورلي",
      ...(row.logo_url ? { images: [{ url: row.logo_url, alt: row.name }] } : {}),
    },
    twitter: {
      card: row.logo_url ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function AgencyLandingPage({ params }: Props) {
  const { slug: raw } = await params;
  const segment = decodeSegment(raw);
  const supabase = createSupabaseAnonServer();

  const { data: agencyRow, error: agencyError } = await supabase
    .from("agencies")
    .select("id, name, slug, logo_url, bio, subscription_status")
    .ilike("slug", escapeIlike(segment))
    .maybeSingle();

  if (agencyError || !agencyRow) {
    notFound();
  }

  const agency = agencyRow as AgencyPublic;

  const { data: propRows } = await supabase
    .from("properties")
    .select(
      "id, title, price, area, governorate, district, landmark, address, unit_type, images, slug, listing_type, listing_purpose, is_featured, availability_status, created_at",
    )
    .eq("agency_id", agency.id)
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  const list = (propRows ?? []) as AgencyProperty[];
  const properties = list.filter(
    (r) => (r.availability_status ?? "available") === "available",
  );

  return <AgencyPageClient agency={agency} properties={properties} />;
}
