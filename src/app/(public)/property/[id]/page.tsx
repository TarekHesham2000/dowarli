import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";
import PropertyPageClient from "./PropertyPageClient";

type Props = { params: Promise<{ id: string }> };

type PropertyMetaRow = {
  title: string;
  description: string | null;
  images: string[] | null;
  area: string;
  price: number;
  status: string;
  availability_status: string | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const numericId = Number(id);
  const baseUrl = getSiteUrl();

  if (!Number.isFinite(numericId)) {
    return {
      title: "عقار | دَورلي",
      robots: { index: false, follow: false },
    };
  }

  let row: PropertyMetaRow | null = null;

  try {
    const supabase = createSupabaseAnonServer();
    const { data } = await supabase
      .from("properties")
      .select("title, description, images, area, price, status, availability_status")
      .eq("id", numericId)
      .maybeSingle();
    row = data as PropertyMetaRow | null;
  } catch {
    row = null;
  }

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

  return {
    title,
    description,
    robots: indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      locale: "ar_EG",
      url: `${baseUrl}/property/${numericId}`,
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
    alternates: { canonical: `${baseUrl}/property/${numericId}` },
  };
}

export default function PropertyPage() {
  return <PropertyPageClient />;
}
