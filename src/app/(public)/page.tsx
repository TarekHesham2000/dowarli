// ─── SERVER COMPONENT ────────────────────────────────────────────────────────
// Intentionally NO "use client" — Next.js resolves `metadata` on the server
// before rendering. All interactive logic lives in ./PublicPageClient.tsx
import type { Metadata } from "next";
import PublicPageClient from "./PublicPageClient";

export const metadata: Metadata = {
  title: "دَورلي - Dowarly | ابحث عن شقتك المثالية في مصر",
  description:
    "دَورلي Dowarly — منصة الإيجار الأولى في مصر. آلاف الإعلانات من ملاك موثوقين: سكن طلاب، سكن عائلي، ستوديو، سكن مشترك في المنصورة والقاهرة والإسكندرية وأكثر.",
  keywords: "إيجار, شقق, سكن طلاب, Dowarly, دَورلي, مصر, عقارات",
  openGraph: {
    title: "دَورلي - Dowarly | منصة الإيجار الأولى في مصر",
    description: "اعثر على مسكنك المثالي بكل سهولة وأمان مع دَورلي.",
    type: "website",
    locale: "ar_EG",
  },
};

export default function PublicPage() {
  return <PublicPageClient />;
}
