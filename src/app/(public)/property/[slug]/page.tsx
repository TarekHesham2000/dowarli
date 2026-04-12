import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";
import PropertyPageClient from "./PropertyPageClient";

type Props = { params: Promise<{ slug: string }> };

type PropertyMetaRow = {
  title: string;
  description: string | null;
  images: string[] | null;
  area: string;
  price: number;
  status: string;
  availability_status: string | null;
  slug: string | null;
};

function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const segment = decodeSegment(raw);
  const baseUrl = getSiteUrl();
  const supabase = createSupabaseAnonServer();

  if (/^\d+$/.test(segment)) {
    const numericId = Number(segment);
    const { data } = await supabase
      .from("properties")
      .select("slug, title, description, images, area, price, status, availability_status")
      .eq("id", numericId)
      .maybeSingle();
    const row = data as (PropertyMetaRow & { slug: string | null }) | null;
    if (row?.slug) {
      const canonical = `${baseUrl}/property/${row.slug}`;
      return {
        title: `${row.title} — ${row.area} | دَورلي`,
        alternates: { canonical },
        robots: { index: false, follow: true },
      };
    }
    return { title: "عقار | دَورلي", robots: { index: false, follow: false } };
  }

  const { data } = await supabase
    .from("properties")
    .select("title, description, images, area, price, status, availability_status, slug")
    .eq("slug", segment)
    .maybeSingle();
  const row = data as PropertyMetaRow | null;

  if (!row) {
    return {
      title: "عقار غير موجود | دَورلي",
      robots: { index: false, follow: false },
    };
  }

  const title = `${row.title} — ${row.area} | دَورلي`;
  const plainDesc = row.description?.replace(/\s+/g, " ").trim() ?? "";
  const description =
    plainDesc.slice(0, 160) ||
    `إيجار في ${row.area} — ${row.price?.toLocaleString("ar-EG")} ج.م شهرياً على دَورلي`;
  const isActive = row.status === "active";
  const isListedAsAvailable = (row.availability_status ?? "available") === "available";
  const indexable = isActive && isListedAsAvailable;
  const ogImage = row.images?.[0];
  const canonicalSlug = row.slug ?? segment;
  const canonical = `${baseUrl}/property/${canonicalSlug}`;

  return {
    title,
    description,
    robots: indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      locale: "ar_EG",
      url: canonical,
      siteName: "دَورلي",
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage, alt: row.title }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
    },
    alternates: { canonical },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug: raw } = await params;
  const segment = decodeSegment(raw);
  const supabase = createSupabaseAnonServer();

  if (/^\d+$/.test(segment)) {
    const { data } = await supabase.from("properties").select("slug").eq("id", Number(segment)).maybeSingle();
    const s = (data as { slug: string | null } | null)?.slug;
    if (s) {
      permanentRedirect(`/property/${s}`);
    }
    notFound();
  }

  const { data } = await supabase.from("properties").select("id").eq("slug", segment).maybeSingle();
  if (!data) {
    notFound();
  }

  return <PropertyPageClient />;
}
