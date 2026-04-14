"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import type { AgencyLeadRow } from "./AgencyCRMTable";

function getProp(row: AgencyLeadRow): Record<string, unknown> | null {
  const p = row.properties;
  if (!p) return null;
  const o = Array.isArray(p) ? p[0] : p;
  if (!o || typeof o !== "object") return null;
  return o as Record<string, unknown>;
}

function firstImageUrl(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") return images[0];
  return null;
}

function toInternationalEG(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("20")) return clean;
  if (clean.startsWith("0")) return `2${clean}`;
  return `2${clean}`;
}

function parseNotesHistory(raw: unknown): { at: string; text: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { at: string; text: string }[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const at = typeof o.at === "string" ? o.at : typeof o.created_at === "string" ? o.created_at : "";
    const text = typeof o.text === "string" ? o.text : "";
    if (at && text) out.push({ at, text });
  }
  return out.reverse();
}

type Props = {
  readonly lead: AgencyLeadRow | null;
  readonly open: boolean;
  readonly agencyName: string;
  readonly onClose: () => void;
  /** Fires once when the modal opens (for CRM «fresh» / opened tracking). */
  readonly onViewed?: (leadId: string) => void;
};

export function AgencyLeadDetailsModal({ lead, open, agencyName, onClose, onViewed }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !lead) return;
    onViewed?.(String(lead.id));
  }, [open, lead?.id, onViewed]);

  const waHref = useCallback(() => {
    if (!lead) return "#";
    const phone = toInternationalEG(lead.client_phone);
    const title = (() => {
      const pr = getProp(lead);
      return typeof pr?.title === "string" ? pr.title : "العقار";
    })();
    const msg = `أهلاً ${lead.client_name.trim()}، معك ${agencyName.trim()} بخصوص استفسارك عن «${title}». كيف يمكننا مساعدتك؟`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }, [lead, agencyName]);

  if (!open || !lead) return null;

  const pr = getProp(lead);
  const title = typeof pr?.title === "string" ? pr.title : "—";
  const price = typeof pr?.price === "number" ? pr.price : Number(pr?.price ?? NaN);
  const slug = typeof pr?.slug === "string" && pr.slug.trim() ? pr.slug.trim() : null;
  const img = firstImageUrl(pr?.images);
  const path = slug ? `/property/${encodeURIComponent(slug)}` : `/property/${lead.property_id}`;
  const history = parseNotesHistory(lead.lead_notes_history);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="lead-modal-title" className="m-0 text-lg font-black text-white">
            تفاصيل الطلب
          </h2>
          <button
            type="button"
            className="rounded-lg border border-slate-600 px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {lead.client_name} — <span dir="ltr">{lead.client_phone}</span>
        </p>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote storage URL
            <img src={img} alt="" className="h-44 w-full object-cover" />
          ) : (
            <div className="flex h-44 items-center justify-center bg-slate-800 text-slate-500">لا صورة</div>
          )}
          <div className="p-4">
            <p className="m-0 font-black text-white">{title}</p>
            <p className="mt-2 text-lg font-black text-emerald-400 tabular-nums">
              {Number.isFinite(price) ? `${price.toLocaleString("ar-EG")} ج.م` : "—"}
            </p>
            <Link
              href={path}
              className="mt-3 inline-flex text-sm font-bold text-sky-400 underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              فتح صفحة الإعلان
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">سجل الملاحظات</p>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">لا يوجد سجل بعد — تُحفظ اللقطات عند كل حفظ لملاحظة من الجدول.</p>
          ) : (
            <ul className="space-y-2 border-t border-slate-800 pt-3">
              {history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
                  <span className="font-mono text-[10px] text-slate-500">
                    {new Date(h.at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap text-slate-200">{h.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={waHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 min-w-[140px] items-center justify-center rounded-xl bg-[#25D366] px-4 py-3 text-sm font-black text-white no-underline hover:opacity-95"
          >
            فتح واتساب
          </a>
        </div>
      </div>
    </div>
  );
}
