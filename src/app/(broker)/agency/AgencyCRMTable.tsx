"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AgencyLeadDetailsModal } from "./AgencyLeadDetailsModal";
import { formatTimeAgoAr } from "./agencyRelativeTime";
import { useCrmOpenedLeadIds } from "./useCrmOpenedLeadIds";

export type CrmStatus = "new" | "contacted" | "closed";
export type CrmPriority = "low" | "medium" | "high";
export type LeadSource = "whatsapp" | "call" | "message" | "website" | "other";

export type AgencyLeadRow = {
  id: string | number;
  client_name: string;
  client_phone: string;
  created_at: string;
  property_id: number;
  crm_status?: string | null;
  agency_notes?: string | null;
  lead_source?: string | null;
  assignee_display?: string | null;
  crm_priority?: string | null;
  lead_notes_history?: unknown;
  properties:
    | {
        title: string;
        unit_type?: string | null;
        governorate?: string | null;
        district?: string | null;
        area?: string | null;
        listing_purpose?: string | null;
        listing_type?: string | null;
        images?: unknown;
        price?: number | null;
        slug?: string | null;
        status?: string | null;
      }
    | Array<{
        title: string;
        unit_type?: string | null;
        governorate?: string | null;
        district?: string | null;
        area?: string | null;
        listing_purpose?: string | null;
        listing_type?: string | null;
        images?: unknown;
        price?: number | null;
        slug?: string | null;
        status?: string | null;
      }>
    | null;
};

const PAGE_SIZE = 10;

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: "whatsapp", label: "واتساب" },
  { value: "call", label: "مكالمة" },
  { value: "message", label: "رسالة" },
  { value: "website", label: "الموقع" },
  { value: "other", label: "أخرى" },
];

const PRIORITY_OPTIONS: { value: CrmPriority; label: string }[] = [
  { value: "high", label: "عالية" },
  { value: "medium", label: "متوسطة" },
  { value: "low", label: "منخفضة" },
];

function propertyTitle(p: AgencyLeadRow["properties"]): string {
  if (!p) return "—";
  if (Array.isArray(p)) return p[0]?.title ?? "—";
  return p.title ?? "—";
}

function normalizeStatus(s: string | null | undefined): CrmStatus {
  if (s === "contacted" || s === "closed") return s;
  return "new";
}

function normalizePriority(s: string | null | undefined): CrmPriority {
  if (s === "high" || s === "low") return s;
  return "medium";
}

function parseHistoryArray(raw: unknown): { at: string; text: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { at: string; text: string }[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const at = typeof o.at === "string" ? o.at : typeof o.created_at === "string" ? o.created_at : "";
    const text = typeof o.text === "string" ? o.text : "";
    if (at && text) out.push({ at, text });
  }
  return out;
}

function statusRank(s: string | null | undefined): number {
  const v = normalizeStatus(s);
  if (v === "new") return 0;
  if (v === "contacted") return 1;
  return 2;
}

const STATUS_STYLE: Record<CrmStatus, string> = {
  new: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
  contacted: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/35",
  closed: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/35",
};

const STATUS_LABEL: Record<CrmStatus, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  closed: "مغلق",
};

const PRIORITY_RING: Record<CrmPriority, string> = {
  high: "ring-1 ring-red-500/45 border-red-500/20",
  medium: "",
  low: "opacity-95",
};

function leadEqId(a: string | number, b: string | number): boolean {
  return String(a) === String(b);
}

type LeadPatch = {
  crm_status?: CrmStatus;
  agency_notes?: string | null;
  lead_notes_history?: unknown;
  lead_source?: string | null;
  assignee_display?: string | null;
  crm_priority?: CrmPriority;
};

type SortKey = "date_desc" | "date_asc" | "status";

export function AgencyCRMTable({
  leads,
  onUpdated,
  agencyName,
  ownerAssigneeName,
}: {
  readonly leads: AgencyLeadRow[];
  onUpdated: () => void;
  agencyName: string;
  ownerAssigneeName: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [modalLead, setModalLead] = useState<AgencyLeadRow | null>(null);
  const { opened: openedLeadIds, markOpened, ready: openedHydrated } = useCrmOpenedLeadIds();
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [savingStatusId, setSavingStatusId] = useState<string | number | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | number | null>(null);
  const [savingMetaId, setSavingMetaId] = useState<string | number | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteSuccessId, setNoteSuccessId] = useState<string | null>(null);
  const [statusSuccessId, setStatusSuccessId] = useState<string | null>(null);
  const [noteErrorId, setNoteErrorId] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sorted = useMemo(() => {
    const arr = [...leads];
    if (sortKey === "date_desc") {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortKey === "date_asc") {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      arr.sort((a, b) => statusRank(a.crm_status) - statusRank(b.crm_status) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [leads, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  useEffect(() => {
    setPage(1);
  }, [leads]);

  useEffect(() => {
    setSelected(new Set());
  }, [leads]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

  const persist = useCallback(
    async (row: AgencyLeadRow, patch: LeadPatch, mode: "status" | "note" | "meta"): Promise<boolean> => {
      const id = row.id;
      if (mode === "status") setSavingStatusId(id);
      else if (mode === "note") setSavingNoteId(id);
      else setSavingMetaId(id);
      setNoteErrorId(null);
      try {
        const payload: Record<string, unknown> = { ...patch };
        if (patch.agency_notes !== undefined) {
          payload.agency_notes = patch.agency_notes && String(patch.agency_notes).length > 0 ? patch.agency_notes : null;
        }
        const { data, error } = await supabase.from("leads").update(payload).eq("id", id).select("id").maybeSingle();
        if (error) {
          console.error("Lead CRM update:", error);
          if (mode === "note") setNoteErrorId(String(id));
          return false;
        }
        if (!data) {
          console.error("Lead CRM update: no row returned");
          if (mode === "note") setNoteErrorId(String(id));
          return false;
        }
        if (successTimerRef.current) {
          clearTimeout(successTimerRef.current);
          successTimerRef.current = null;
        }
        if (mode === "note") {
          setNoteSuccessId(String(id));
          successTimerRef.current = setTimeout(() => {
            setNoteSuccessId(null);
            successTimerRef.current = null;
          }, 2200);
        } else if (mode === "status") {
          setStatusSuccessId(String(id));
          successTimerRef.current = setTimeout(() => {
            setStatusSuccessId(null);
            successTimerRef.current = null;
          }, 1600);
        }
        onUpdated();
        return true;
      } finally {
        if (mode === "status") setSavingStatusId(null);
        else if (mode === "note") setSavingNoteId(null);
        else setSavingMetaId(null);
      }
    },
    [onUpdated],
  );

  const toggleSelect = useCallback((id: string | number) => {
    const k = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const toggleSelectAllPage = useCallback(() => {
    const keys = pageRows.map((r) => String(r.id));
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) {
        for (const k of keys) next.delete(k);
      } else {
        for (const k of keys) next.add(k);
      }
      return next;
    });
  }, [pageRows, selected]);

  const bulkSetStatus = useCallback(
    async (st: CrmStatus) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      setBulkSaving(true);
      try {
        const { error } = await supabase.from("leads").update({ crm_status: st }).in("id", ids);
        if (error) {
          console.error("Bulk CRM update:", error);
          return;
        }
        setSelected(new Set());
        onUpdated();
      } finally {
        setBulkSaving(false);
      }
    },
    [selected, onUpdated],
  );

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center shadow-xl shadow-black/25 backdrop-blur-xl">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-2xl text-indigo-200/90"
          aria-hidden
        >
          ✨
        </div>
        <p className="m-0 text-base font-black text-white">لا طلبات في هذه الفترة</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          عند وصول عملاء جدد سيظهرون هنا فوراً — شارك روابط إعلاناتك وفعّل إشعارات الوكالة للمتابعة.
        </p>
      </div>
    );
  }

  const pageIds = pageRows.map((r) => String(r.id));
  const allPageSelected = pageIds.length > 0 && pageIds.every((k) => selected.has(k));

  return (
    <div className="space-y-4">
      <AgencyLeadDetailsModal
        lead={modalLead}
        open={modalLead !== null}
        agencyName={agencyName}
        onClose={() => setModalLead(null)}
        onViewed={markOpened}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-slate-500">
            ترتيب
            <select
              className="mr-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-bold text-slate-200"
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setPage(1);
              }}
            >
              <option value="date_desc">الأحدث أولاً</option>
              <option value="date_asc">الأقدم أولاً</option>
              <option value="status">حسب الحالة</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          {sorted.length} طلب — الصفحة {page} من {totalPages}
        </p>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm">
          <span className="font-bold text-amber-100">محدد: {selected.size}</span>
          <select
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs font-bold text-white"
            disabled={bulkSaving}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value as CrmStatus | "";
              e.target.value = "";
              if (v) void bulkSetStatus(v);
            }}
          >
            <option value="">تحديث جماعي للحالة…</option>
            {(Object.keys(STATUS_LABEL) as CrmStatus[]).map((k) => (
              <option key={k} value={k}>
                تعيين «{STATUS_LABEL[k]}»
              </option>
            ))}
          </select>
          {bulkSaving ? <span className="text-xs text-amber-200">جاري التطبيق…</span> : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/25 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-bold uppercase tracking-wide text-slate-500">
                <th className="w-10 px-2 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAllPage}
                    className="h-4 w-4 accent-emerald-500"
                    aria-label="تحديد الصفحة"
                  />
                </th>
                <th className="px-2 py-3 w-8" aria-hidden />
                <th className="px-3 py-3">العميل</th>
                <th className="px-3 py-3">الهاتف</th>
                <th className="px-3 py-3">المصدر</th>
                <th className="px-3 py-3">المسؤول</th>
                <th className="px-3 py-3">الأولوية</th>
                <th className="px-3 py-3">العقار</th>
                <th className="px-3 py-3 min-w-[130px]">الوقت</th>
                <th className="px-3 py-3">الحالة</th>
                <th className="px-3 py-3 min-w-[180px]">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const st = normalizeStatus(row.crm_status);
                const pr = normalizePriority(row.crm_priority);
                const nid = String(row.id);
                const notesVal = nid in localNotes ? (localNotes[nid] ?? "") : (row.agency_notes ?? "");
                const statusBusy = savingStatusId !== null && leadEqId(savingStatusId, row.id);
                const noteBusy = savingNoteId !== null && leadEqId(savingNoteId, row.id);
                const metaBusy = savingMetaId !== null && leadEqId(savingMetaId, row.id);
                const rowRing = pr === "high" ? PRIORITY_RING.high : "";
                const showFreshDot = openedHydrated && st === "new" && !openedLeadIds.has(nid);
                return (
                  <tr
                    key={nid}
                    data-time-tick={nowTick}
                    className={`cursor-pointer border-b border-slate-800/80 last:border-0 hover:bg-slate-800/30 ${rowRing}`}
                    onClick={() => setModalLead(row)}
                  >
                    <td className="px-2 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(nid)}
                        onChange={() => toggleSelect(row.id)}
                        className="h-4 w-4 accent-emerald-500"
                        aria-label={`تحديد ${row.client_name}`}
                      />
                    </td>
                    <td className="px-1 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                      {pr === "high" ? (
                        <span title="أولوية عالية">
                          <AlertTriangle className="h-4 w-4 text-red-400/90" aria-hidden />
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-100">{row.client_name}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-300" dir="ltr" onClick={(e) => e.stopPropagation()}>
                      {row.client_phone}
                    </td>
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="max-w-[120px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-200"
                        value={(row.lead_source as LeadSource | undefined) ?? ""}
                        disabled={metaBusy}
                        onChange={(e) => {
                          const v = e.target.value as LeadSource | "";
                          void persist(row, { lead_source: v ? v : null }, "meta");
                        }}
                      >
                        <option value="">—</option>
                        {SOURCE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="max-w-[160px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-200"
                        value={(row.assignee_display ?? "").trim() || ownerAssigneeName}
                        disabled={metaBusy}
                        onChange={(e) => {
                          void persist(row, { assignee_display: e.target.value || null }, "meta");
                        }}
                      >
                        <option value={ownerAssigneeName}>{ownerAssigneeName}</option>
                        {row.assignee_display && row.assignee_display.trim() !== ownerAssigneeName ? (
                          <option value={row.assignee_display.trim()}>{row.assignee_display.trim()}</option>
                        ) : null}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`rounded-lg border px-2 py-1 text-[11px] font-bold outline-none ${
                          pr === "high"
                            ? "border-red-500/40 bg-red-950/30 text-red-100"
                            : pr === "low"
                              ? "border-slate-600 bg-slate-950 text-slate-300"
                              : "border-amber-500/30 bg-amber-950/20 text-amber-100"
                        }`}
                        value={pr}
                        disabled={metaBusy}
                        onChange={(e) => {
                          void persist(row, { crm_priority: e.target.value as CrmPriority }, "meta");
                        }}
                      >
                        {PRIORITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-slate-300">{propertyTitle(row.properties)}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      <div className="flex items-start gap-2">
                        {showFreshDot ? (
                          <span className="relative mt-1.5 inline-flex h-2 w-2 shrink-0" title="لم تُعرض التفاصيل بعد">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                          </span>
                        ) : (
                          <span className="mt-1.5 inline-block h-2 w-2 shrink-0" aria-hidden />
                        )}
                        <div>
                          <p className="m-0 font-bold text-slate-200">{formatTimeAgoAr(row.created_at, Date.now())}</p>
                          <p className="m-0 mt-0.5 text-[10px] text-slate-600">
                            {new Date(row.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`rounded-lg px-2 py-1.5 text-xs font-bold outline-none ${STATUS_STYLE[st]}`}
                        value={st}
                        disabled={statusBusy}
                        onChange={(e) => {
                          const next = e.target.value as CrmStatus;
                          void persist(row, { crm_status: next }, "status");
                        }}
                      >
                        {(Object.keys(STATUS_LABEL) as CrmStatus[]).map((k) => (
                          <option key={k} value={k} className="bg-slate-900 text-slate-100">
                            {STATUS_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      {statusBusy ? (
                        <span className="mt-1 block text-[10px] font-bold text-emerald-400/90">جاري الحفظ…</span>
                      ) : null}
                      {!statusBusy && statusSuccessId === nid ? (
                        <span className="mt-1 block text-[10px] font-bold text-emerald-400">تم الحفظ</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        className="min-h-[64px] w-full resize-y rounded-xl border border-slate-700 bg-slate-950/60 px-2 py-2 text-xs text-slate-200 outline-none transition focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                        dir="auto"
                        placeholder="ملاحظات…"
                        value={notesVal}
                        disabled={noteBusy}
                        onChange={(e) => setLocalNotes((prev) => ({ ...prev, [nid]: e.target.value }))}
                        onBlur={() => {
                          const next = (localNotes[nid] ?? row.agency_notes ?? "").trim();
                          const prev = (row.agency_notes ?? "").trim();
                          if (next === prev) return;
                          const hist = parseHistoryArray(row.lead_notes_history);
                          if (next) hist.push({ at: new Date().toISOString(), text: next });
                          void persist(row, { agency_notes: next || null, lead_notes_history: hist }, "note");
                        }}
                      />
                      {noteBusy ? (
                        <span className="mt-1 block text-[10px] font-bold text-emerald-400/90">جاري الحفظ…</span>
                      ) : null}
                      {!noteBusy && noteSuccessId === nid ? (
                        <span className="mt-1 block text-[10px] font-bold text-emerald-400">تم حفظ الملاحظة</span>
                      ) : null}
                      {!noteBusy && noteErrorId === nid ? (
                        <span className="mt-1 block text-[10px] font-bold text-red-400">تعذّر الحفظ</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </button>
          <span className="text-xs text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            التالي
          </button>
        </div>
      ) : null}
    </div>
  );
}
