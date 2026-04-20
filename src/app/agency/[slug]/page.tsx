import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildAgencyPublicUrl, getCanonicalPublicSiteUrl, toAbsolutePublicUrl } from "@/lib/site";
import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { normalizeAgencyThemeColor } from "@/lib/agencyTheme";
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
  const baseUrl = getCanonicalPublicSiteUrl();
  const pageUrl = buildAgencyPublicUrl(row.slug);
  const title = `${row.name} | دَورلي`;
  const plainBio = row.bio?.replace(/\s+/g, " ").trim() ?? "";
  const description =
    plainBio.slice(0, 160) || `عروض وكالة ${row.name} — شقق ووحدات على دَورلي`;

  const logoAbsolute = row.logo_url ? toAbsolutePublicUrl(row.logo_url, baseUrl) : null;

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ar_EG",
      url: pageUrl,
      siteName: "دَورلي",
      ...(logoAbsolute
        ? {
            images: [
              {
                url: logoAbsolute,
                width: 1200,
                height: 630,
                alt: row.name,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: logoAbsolute ? "summary_large_image" : "summary",
      title,
      description,
      ...(logoAbsolute ? { images: [logoAbsolute] } : {}),
    },
  };
}

export default async function AgencyLandingPage({ params }: Props) {
  const { slug: raw } = await params;
  const segment = decodeSegment(raw);
  const supabase = createSupabaseAnonServer();

  const { data: agencyRow, error: agencyError } = await supabase
    .from("agencies")
    .select("id, name, slug, logo_url, bio, subscription_status, owner_id, theme_color")
    .ilike("slug", escapeIlike(segment))
    .maybeSingle();

  if (agencyError || !agencyRow) {
    notFound();
  }

  type AgencyRowLoaded = Omit<AgencyPublic, "theme_color"> & {
    owner_id: string | null;
    theme_color?: string | null;
  };
  const agencyFull = agencyRow as AgencyRowLoaded;

  // Contact phone: owner's profile phone (profiles is RLS-locked, so use the
  // service-role client — only used to surface the click-to-call link).
  let contactPhone: string | null = null;
  if (agencyFull.owner_id) {
    try {
      const svc = getSupabaseServerClient();
      const { data: ownerProfile } = await svc
        .from("profiles")
        .select("phone")
        .eq("id", agencyFull.owner_id)
        .maybeSingle();
      const raw = typeof ownerProfile?.phone === "string" ? ownerProfile.phone.trim() : "";
      contactPhone = raw.length > 0 ? raw : null;
    } catch {
      contactPhone = null;
    }
  }

  const agency: AgencyPublic = {
    id: agencyFull.id,
    name: agencyFull.name,
    slug: agencyFull.slug,
    logo_url: agencyFull.logo_url,
    bio: agencyFull.bio,
    subscription_status: agencyFull.subscription_status,
    theme_color: normalizeAgencyThemeColor(
      typeof agencyFull.theme_color === "string" ? agencyFull.theme_color : null,
    ),
  };

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

  const publicShareUrl = buildAgencyPublicUrl(agency.slug);

  return (
    <AgencyPageClient
      agency={agency}
      properties={properties}
      contactPhone={contactPhone}
      publicShareUrl={publicShareUrl}
    />
  );
}
