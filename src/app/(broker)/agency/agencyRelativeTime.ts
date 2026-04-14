/** Short Arabic relative phrase e.g. «منذ ساعتين» (best-effort with Intl). */
export function formatTimeAgoAr(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffSec = Math.round((nowMs - t) / 1000);
  if (diffSec < 0) return "الآن";
  try {
    const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
    if (diffSec < 60) return rtf.format(-diffSec, "second");
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 48) return rtf.format(-diffHr, "hour");
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 30) return rtf.format(-diffDay, "day");
    const diffWk = Math.round(diffDay / 7);
    if (diffWk < 8) return rtf.format(-diffWk, "week");
    const diffMo = Math.round(diffDay / 30);
    if (diffMo < 24) return rtf.format(-diffMo, "month");
    const diffYr = Math.round(diffDay / 365);
    return rtf.format(-Math.max(1, diffYr), "year");
  } catch {
    return `${Math.max(1, Math.round(diffSec / 3600))} س`;
  }
}
