/** Arabic relative time for listing cards (e.g. منذ ساعتين). */
export function formatRelativeTimeAr(iso: string | null | undefined): string {
  if (!iso || !String(iso).trim()) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return "";
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  const diffSec = Math.round((t - Date.now()) / 1000);
  const a = Math.abs(diffSec);
  if (a < 45) return rtf.format(0, "second");
  if (a < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (a < 604800) return rtf.format(Math.round(diffSec / 86400), "day");
  return rtf.format(Math.round(diffSec / 604800), "week");
}
