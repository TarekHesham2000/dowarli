import { getAdPostPointsCost, type ListingPurpose } from "@/lib/pointsConfig";

export type PropertyLike = {
  listing_type?: string | null;
  listing_purpose?: string | null;
  was_charged?: boolean | null;
};

export function listingPurposeFromProperty(p: PropertyLike): ListingPurpose {
  const raw = (p.listing_type ?? p.listing_purpose ?? "rent").toString().trim().toLowerCase();
  return raw === "sale" ? "sale" : "rent";
}

export function activationCostLabelAr(p: PropertyLike, effectivePoints?: number): string {
  if (!p.was_charged) return "تفعيل مجاني (ضمن الحد المسموح)";
  const n =
    typeof effectivePoints === "number" && Number.isFinite(effectivePoints)
      ? Math.max(0, Math.floor(effectivePoints))
      : getAdPostPointsCost(listingPurposeFromProperty(p));
  return `تكلفة التفعيل: ${n} نقطة`;
}

export function isAwaitingPropertyApproval(status: string) {
  return status === "pending" || status === "pending_approval";
}

export function getEmbedUrl(url?: string): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();

  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;

  const tt = u.match(/tiktok\.com\/(?:@[\w.]+\/video\/|vm\/|v\/|t\/)(\d+|[a-zA-Z0-9]+)/);
  if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`;

  const gd = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`;

  if (u.includes("facebook.com") || u.includes("fb.watch"))
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=0`;

  return null;
}
