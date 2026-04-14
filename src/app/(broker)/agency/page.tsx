"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  Camera,
  Download,
  Eye,
  FileText,
  Home,
  LayoutDashboard,
  MousePointerClick,
  Percent,
  Plus,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AgencySubscriptionStatus } from "@/lib/agencySubscription";
import { safeRouterRefresh } from "@/lib/safeRouterRefresh";
import {
  DeviceMixMiniChart,
  GeographyHotBarChart,
  LeadIntelligencePieChart,
  ViewsLeadsLineChart,
} from "./AgencyDashboardCharts";
import { AgencyCRMTable, type AgencyLeadRow } from "./AgencyCRMTable";
import {
  aggregateDeviceMix,
  aggregateGeographyHotBar,
  aggregateLeadIntelligencePie,
  hasDeviceHints,
  leadMatchesGeoBar,
  leadMatchesPieSegment,
  type GeoHotBarRow,
  type ViewEventRow,
  parseLeadPropertyAnalytics,
} from "./agencyLeadAnalytics";
import { aggregateSeries, type DateRangeKey, DATE_RANGE_OPTIONS } from "./agencyDashboardUtils";
import { fetchAgencyDashboardData } from "./fetchAgencyDashboardData";
import { downloadLeadsCsv } from "./agencyCrmExport";
import { buildPlatformInsight, type PlatformInsightVariant } from "./agencyPlatformInsights";
import { useCountUp } from "./useCountUp";

const AgencyPdfReportIsland = dynamic(() => import("./AgencyPdfReportIsland"), { ssr: false });

type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  bio: string | null;
  subscription_status: AgencySubscriptionStatus;
};

type DashboardTab = "overview" | "analytics" | "crm" | "settings";

type PdfToast = { kind: "success" | "error"; message: string } | null;

type CrmChartFilter =
  | { kind: "none" }
  | { kind: "pie"; segment: string }
  | { kind: "geo"; bar: GeoHotBarRow };

function parseSubscriptionStatus(v: unknown): AgencySubscriptionStatus {
  if (v === "pro" || v === "expired" || v === "free") return v;
  return "free";
}

function agencyFromRow(row: Record<string, unknown>): AgencyRow | null {
  if (typeof row.id !== "string") return null;
  return {
    id: row.id,
    name: typeof row.name === "string" ? row.name : "",
    slug: typeof row.slug === "string" ? row.slug : "",
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    bio: typeof row.bio === "string" ? row.bio : null,
    subscription_status: parseSubscriptionStatus(row.subscription_status),
  };
}

function subscriptionPillLabel(status: AgencySubscriptionStatus): string {
  if (status === "pro") return "«اشتراك Pro»";
  if (status === "expired") return "منتهي";
  return "مجاني";
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm font-medium text-slate-100 outline-none transition focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30";

function agencyInitials(name: string): string {
  const t = name.trim();
  if (!t) return "؟";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
  return t.slice(0, 2);
}

function safeCsvFilenameBase(slug: string, id: string): string {
  const raw = (slug.trim() || id.trim() || "agency").replace(/[/\\?%*:|"<>]/g, "-");
  return raw.slice(0, 120) || "agency";
}

const GLASS_SECTION =
  "rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-xl";
const GLASS_HEADER =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-slate-900/40 to-slate-950/90 p-6 shadow-xl shadow-black/30 backdrop-blur-xl";
const GLASS_STAT =
  "rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-lg shadow-black/25 backdrop-blur-md";

const INSIGHT_VARIANT_CLASS: Record<PlatformInsightVariant, string> = {
  emerald: "border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-50",
  amber: "border-amber-500/40 bg-amber-500/[0.09] text-amber-50",
  sky: "border-sky-500/35 bg-sky-500/[0.08] text-sky-50",
  slate: "border-slate-500/30 bg-slate-500/[0.07] text-slate-100",
  indigo: "border-indigo-500/35 bg-indigo-500/[0.09] text-indigo-50",
};

function DashboardAnalyticsEmpty({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <section
      className={`${GLASS_SECTION} relative overflow-hidden p-6 ring-1 ring-indigo-500/10 before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-indigo-500/[0.06] before:via-transparent before:to-amber-500/[0.05]`}
    >
      <h2 className="relative text-lg font-black text-white">{title}</h2>
      <div className="relative mt-10 flex flex-col items-center justify-center px-4 pb-8 text-center">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-indigo-200 shadow-inner shadow-indigo-950/40"
          aria-hidden
        >
          <Sparkles className="h-8 w-8" />
        </div>
        <p className="max-w-md text-base font-black leading-relaxed text-white">{message}</p>
        {hint ? <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">{hint}</p> : null}
      </div>
    </section>
  );
}

function AgencyDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<AgencyRow | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [dateRange, setDateRange] = useState<DateRangeKey>("7d");
  const [propCount, setPropCount] = useState(0);
  const [activeListingsCount, setActiveListingsCount] = useState(0);
  const [agencyLeads, setAgencyLeads] = useState<AgencyLeadRow[]>([]);
  const [viewEvents, setViewEvents] = useState<ViewEventRow[]>([]);
  const [viewsTableAvailable, setViewsTableAvailable] = useState(true);
  const [crmFilter, setCrmFilter] = useState<CrmChartFilter>({ kind: "none" });
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [ownerDisplayName, setOwnerDisplayName] = useState("");
  const [showCreatedWelcome, setShowCreatedWelcome] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [pendingLogoRemoval, setPendingLogoRemoval] = useState(false);
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaveOk, setProfileSaveOk] = useState("");

  useEffect(() => {
    if (searchParams.get("created") !== "1") return;
    setShowCreatedWelcome(true);
    router.replace("/agency", { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    if (!profileSaveOk) return;
    const t = globalThis.setTimeout(() => setProfileSaveOk(""), 5000);
    return () => globalThis.clearTimeout(t);
  }, [profileSaveOk]);

  useEffect(() => {
    if (!editLogoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(editLogoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editLogoFile]);

  const openProfileEditor = useCallback(() => {
    if (!agency) return;
    setEditName(agency.name);
    setEditBio(agency.bio ?? "");
    setEditLogoFile(null);
    setPendingLogoRemoval(false);
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    setProfileSaveError("");
    setProfileSaveOk("");
    setProfileEditOpen(true);
    setActiveTab("settings");
  }, [agency]);

  const closeProfileEditor = useCallback(() => {
    setProfileEditOpen(false);
    setEditLogoFile(null);
    setPendingLogoRemoval(false);
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    setProfileSaveError("");
  }, []);

  const clearLogoSelection = useCallback(() => {
    setEditLogoFile(null);
    setPendingLogoRemoval(false);
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
  }, []);

  const hasProfileChanges = useMemo(() => {
    if (!agency) return false;
    const nameDirty = editName.trim() !== agency.name.trim();
    const bioDirty = (editBio.trim() || "") !== (agency.bio ?? "").trim();
    const logoDirty = editLogoFile !== null || pendingLogoRemoval;
    return nameDirty || bioDirty || logoDirty;
  }, [agency, editName, editBio, editLogoFile, pendingLogoRemoval]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSessionUserId(null);
        router.push("/login");
        return;
      }
      setSessionUserId(user.id);

      const { data: prof } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      const profName =
        prof && typeof (prof as { name?: unknown }).name === "string" ? (prof as { name: string }).name.trim() : "";
      if (profName) {
        setOwnerDisplayName(profName);
      } else if (typeof user.email === "string" && user.email.trim()) {
        setOwnerDisplayName(user.email.split("@")[0]?.trim() || user.email.trim());
      } else {
        setOwnerDisplayName("مالك الوكالة");
      }

      const { data: row, error: aErr } = await supabase.from("agencies").select("*").eq("owner_id", user.id).single();

      if (aErr) {
        if (aErr.code === "PGRST116") {
          setAgency(null);
          return;
        }
        console.error(aErr);
        setAgency(null);
        return;
      }

      if (!row || typeof row !== "object") {
        setAgency(null);
        return;
      }

      const a = agencyFromRow(row as Record<string, unknown>);
      if (!a) {
        setAgency(null);
        return;
      }
      setAgency(a);

      const dash = await fetchAgencyDashboardData(supabase, a.id, dateRange);
      setPropCount(dash.propCount);
      setActiveListingsCount(dash.activeListingsCount);
      setAgencyLeads(dash.leads);
      setViewEvents(dash.viewEvents);
      setViewsTableAvailable(dash.viewsTableAvailable);
    } finally {
      setLoading(false);
    }
  }, [router, dateRange]);

  const saveAgencyProfile = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!agency) return;
      if (!hasProfileChanges) return;
      const n = editName.trim();
      if (!n) {
        setProfileSaveError("أدخل اسم الوكالة.");
        return;
      }
      setProfileSaveLoading(true);
      setProfileSaveError("");
      setProfileSaveOk("");
      try {
        let logoUrl: string | null = agency.logo_url;
        if (editLogoFile) {
          const rawExt = editLogoFile.name.split(".").pop()?.toLowerCase() ?? "png";
          const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt) ? rawExt.replace("jpeg", "jpg") : "png";
          const path = `agency-logos/${agency.id}/logo.${safeExt}`;
          const { error: upErr } = await supabase.storage.from("properties").upload(path, editLogoFile, {
            upsert: true,
            contentType: editLogoFile.type || undefined,
          });
          if (upErr) {
            setProfileSaveError(`فشل رفع الشعار: ${upErr.message}`);
            return;
          }
          const { data: pub } = supabase.storage.from("properties").getPublicUrl(path);
          logoUrl = (pub.publicUrl ?? "").trim() || agency.logo_url;
        } else if (pendingLogoRemoval) {
          logoUrl = null;
        }
        const { error: upRowErr } = await supabase
          .from("agencies")
          .update({
            name: n,
            bio: editBio.trim() || null,
            logo_url: logoUrl,
          })
          .eq("id", agency.id);
        if (upRowErr) {
          setProfileSaveError(upRowErr.message);
          return;
        }
        setProfileSaveOk("تم حفظ بيانات الوكالة بنجاح.");
        setEditLogoFile(null);
        setPendingLogoRemoval(false);
        if (logoFileInputRef.current) logoFileInputRef.current.value = "";
        setProfileEditOpen(false);
        await load();
        safeRouterRefresh(router);
      } finally {
        setProfileSaveLoading(false);
      }
    },
    [agency, editName, editBio, editLogoFile, pendingLogoRemoval, hasProfileChanges, load, router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCrmFilter({ kind: "none" });
  }, [dateRange]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      load()
        .then(() => safeRouterRefresh(router))
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, router]);

  useEffect(() => {
    if (!agency?.id || !sessionUserId) return;
    const channel = supabase
      .channel(`agency-subscription-${agency.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agencies", filter: `id=eq.${agency.id}` },
        () => {
          load()
            .then(() => safeRouterRefresh(router))
            .catch(() => undefined);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [agency?.id, sessionUserId, load, router]);

  const showUpgradeCta = agency ? agency.subscription_status !== "pro" : false;

  const totalLeadsInRange = agencyLeads.length;
  const totalViewsInRange = viewEvents.length;
  const viewTimestamps = useMemo(() => viewEvents.map((e) => e.created_at), [viewEvents]);

  /** Lead-to-View ratio: (Total Leads / Total Views) × 100 */
  const leadToViewRatioPct =
    totalViewsInRange > 0 ? Math.min(100, Math.round((totalLeadsInRange / totalViewsInRange) * 10000) / 100) : null;

  const conversionBadge =
    leadToViewRatioPct === null
      ? null
      : leadToViewRatioPct >= 5
        ? { text: "جيد", className: "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40" }
        : leadToViewRatioPct < 2
          ? { text: "يحتاج تحسيناً", className: "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40" }
          : { text: "متوسط", className: "bg-slate-600/40 text-slate-200 ring-1 ring-slate-500/35" };

  const lineSeries = useMemo(
    () => aggregateSeries(dateRange, viewTimestamps, agencyLeads.map((l) => l.created_at)),
    [dateRange, viewTimestamps, agencyLeads],
  );

  const leadAnalyticsRows = useMemo(
    () => agencyLeads.map((l) => parseLeadPropertyAnalytics(l.properties)),
    [agencyLeads],
  );
  const pieData = useMemo(() => aggregateLeadIntelligencePie(leadAnalyticsRows), [leadAnalyticsRows]);
  const barData = useMemo(() => aggregateGeographyHotBar(leadAnalyticsRows, 10), [leadAnalyticsRows]);
  const deviceMixData = useMemo(() => aggregateDeviceMix(viewEvents), [viewEvents]);

  const filteredLeads = useMemo(() => {
    if (crmFilter.kind === "pie") {
      return agencyLeads.filter((l) => leadMatchesPieSegment(l.properties, crmFilter.segment));
    }
    if (crmFilter.kind === "geo") {
      return agencyLeads.filter((l) => leadMatchesGeoBar(l.properties, crmFilter.bar));
    }
    return agencyLeads;
  }, [agencyLeads, crmFilter]);

  const exportFilteredLeadsCsv = useCallback(() => {
    if (!agency) return;
    downloadLeadsCsv(filteredLeads, safeCsvFilenameBase(agency.slug, agency.id));
  }, [agency, filteredLeads]);

  const chartAnimKey = `${dateRange}-${activeTab}-${agencyLeads.length}-${viewEvents.length}`;
  const showDeviceSection = viewsTableAvailable && viewEvents.length > 0;

  const noListings = propCount === 0;
  const noSignalsInRange = totalLeadsInRange === 0 && totalViewsInRange === 0;

  const dateRangeLabel = useMemo(
    () => DATE_RANGE_OPTIONS.find((o) => o.key === dateRange)?.label ?? dateRange,
    [dateRange],
  );

  const platformInsight = useMemo(
    () =>
      buildPlatformInsight({
        totalViews: totalViewsInRange,
        totalLeads: totalLeadsInRange,
        activeListings: activeListingsCount,
        propCount,
        barData,
        noListings,
        noSignalsInRange,
        dateRangeLabel,
      }),
    [
      totalViewsInRange,
      totalLeadsInRange,
      activeListingsCount,
      propCount,
      barData,
      noListings,
      noSignalsInRange,
      dateRangeLabel,
    ],
  );

  const countAnimKey = `${agency?.id ?? "none"}-${dateRange}-${totalViewsInRange}-${totalLeadsInRange}-${activeListingsCount}-${leadToViewRatioPct ?? "x"}`;
  const animViews = useCountUp(totalViewsInRange, countAnimKey);
  const animLeads = useCountUp(totalLeadsInRange, countAnimKey);
  const animActive = useCountUp(activeListingsCount, countAnimKey);
  const animRatio = useCountUp(leadToViewRatioPct ?? 0, countAnimKey);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfGeneratedAtLabel, setPdfGeneratedAtLabel] = useState(() =>
    new Date().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }),
  );
  const [pdfToast, setPdfToast] = useState<PdfToast>(null);

  useEffect(() => {
    if (!pdfToast) return;
    const t = globalThis.setTimeout(() => setPdfToast(null), 5200);
    return () => globalThis.clearTimeout(t);
  }, [pdfToast]);

  const handlePdfDownload = useCallback(async () => {
    if (!agency) return;
    setPdfGeneratedAtLabel(new Date().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    setPdfBusy(true);
    try {
      const reportEl =
        typeof document !== "undefined" ? document.getElementById("dashboard-report-content") : null;
      if (!reportEl) {
        setPdfToast({ kind: "error", message: "تعذّر إعداد التقرير. أعد تحميل الصفحة وحاول مرة أخرى." });
        return;
      }
      const { downloadAgencyPerformancePdf } = await import("./agencyPdfDownload");
      await downloadAgencyPerformancePdf(reportEl, safeCsvFilenameBase(agency.slug, agency.id));
      setPdfToast({ kind: "success", message: "تم تنزيل تقرير الأداء بنجاح." });
    } catch (e) {
      console.error(e);
      setPdfToast({
        kind: "error",
        message: "فشل تصدير PDF (مشكلة في الرسم أو الألوان). حاول مرة أخرى أو استخدم متصفحاً محدّثاً.",
      });
    } finally {
      setPdfBusy(false);
    }
  }, [agency]);

  const onPieSliceForCrm = useCallback((segmentName: string) => {
    setCrmFilter({ kind: "pie", segment: segmentName });
    setActiveTab("crm");
  }, []);

  const onGeoBarForCrm = useCallback((row: GeoHotBarRow) => {
    setCrmFilter({ kind: "geo", bar: row });
    setActiveTab("crm");
  }, []);

  const tabBtn = (id: DashboardTab, label: string, Icon: typeof LayoutDashboard) => (
    <button
      key={id}
      type="button"
      onClick={() => setActiveTab(id)}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
        activeTab === id
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
    >
      <Icon className="h-4 w-4 opacity-90" aria-hidden />
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,_#312e81_0%,_#020617_55%)]">
        <div className={`${GLASS_STAT} px-10 py-8 text-center`}>
          <p className="m-0 text-sm font-black text-indigo-100">جاري التحميل…</p>
          <p className="mt-2 text-xs font-medium text-slate-400">نُجهّز لوحة وكالتك وبياناتك</p>
        </div>
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-100">
        <div className={`${GLASS_SECTION} p-8`}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-3xl" aria-hidden>
            🏢
          </div>
          <h1 className="text-xl font-black text-white">لا توجد وكالة مرتبطة بحسابك</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            سجّل وكالتك لتظهر صفحة عامة احترافية وربط كل إعلاناتك بها — خطوة واحدة تفصلك عن ظهور أقوى في السوق.
          </p>
          <Link
            href="/become-an-agency"
            className="mt-6 inline-flex rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 no-underline shadow-lg shadow-emerald-900/40 hover:bg-emerald-400"
          >
            تسجيل وكالة
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(79,70,229,0.12),transparent_50%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(16,185,129,0.06),transparent_45%)] pb-16 text-slate-100">
      {pdfToast ? (
        <div
          className={`fixed left-1/2 top-4 z-[120] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur-md rtl:text-right ${
            pdfToast.kind === "success"
              ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-100"
              : "border-red-500/45 bg-red-950/90 text-red-100"
          }`}
          role="status"
        >
          {pdfToast.message}
        </div>
      ) : null}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {showCreatedWelcome ? (
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm font-bold text-emerald-100 shadow-lg shadow-emerald-900/20">
            <p className="m-0 flex-1 leading-relaxed">تم إنشاء وكالتك بنجاح — يمكنك الآن إدارة الطلبات والتحليلات من لوحة التحكم.</p>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-emerald-500/40 bg-slate-900 px-3 py-1.5 text-xs font-black text-emerald-200 hover:bg-slate-800"
              onClick={() => setShowCreatedWelcome(false)}
            >
              حسناً
            </button>
          </div>
        ) : null}
        {profileSaveOk ? (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm font-bold text-emerald-100">{profileSaveOk}</div>
        ) : null}

        {/* Header */}
        <div className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${GLASS_HEADER}`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-400/90">لوحة الوكالة</p>
            <h1 className="mt-1 text-2xl font-black text-white">{agency.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              الصفحة العامة:{" "}
              <Link href={`/agency/${agency.slug}`} className="font-bold text-emerald-400 underline-offset-2 hover:underline">
                /agency/{agency.slug}
              </Link>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
                {subscriptionPillLabel(agency.subscription_status)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <p className="text-xs font-bold text-slate-500">الفترة الزمنية</p>
            <div className="flex flex-wrap gap-2">
              {DATE_RANGE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setDateRange(o.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    dateRange === o.key
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-900/40"
                      : "border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabBtn("overview", "نظرة عامة", LayoutDashboard)}
          {tabBtn("analytics", "التحليلات", BarChart3)}
          {tabBtn("crm", "العملاء", Users)}
          {tabBtn("settings", "الإعدادات", Settings)}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`rounded-2xl border px-5 py-4 shadow-lg backdrop-blur-md ${INSIGHT_VARIANT_CLASS[platformInsight.variant]}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-xs font-black uppercase tracking-wide text-white/75">نصيحة المنصة الذكية</p>
                  <p className="m-0 mt-2 text-sm font-bold leading-relaxed text-white">{platformInsight.message}</p>
                </div>
                <Sparkles className="h-7 w-7 shrink-0 text-white/45" aria-hidden />
              </div>
            </motion.div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-xs font-bold text-slate-500">تقرير احترافي للطباعة أو الإرسال للإدارة</p>
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() => void handlePdfDownload()}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/45 bg-indigo-500/15 px-4 py-2.5 text-sm font-black text-indigo-100 shadow-lg shadow-indigo-950/30 hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                {pdfBusy ? "جاري التحضير…" : "تحميل تقرير الأداء (PDF)"}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.35 }}
                className={GLASS_STAT}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">مشاهدات</p>
                  <Eye className="h-5 w-5 text-indigo-400/90" aria-hidden />
                </div>
                <p className="mt-3 text-3xl font-black tabular-nums text-white">{animViews}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {viewsTableAvailable
                    ? "زيارات صفحة الإعلان ضمن الفترة المحددة"
                    : "جدول المشاهدات غير متاح — تحقق من نشر sql/agency_analytics_and_crm.sql"}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className={GLASS_STAT}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">طلبات</p>
                  <MousePointerClick className="h-5 w-5 text-emerald-400/90" aria-hidden />
                </div>
                <p className="mt-3 text-3xl font-black tabular-nums text-white">{animLeads}</p>
                <p className="mt-1 text-[11px] text-slate-500">طلبات مهتمين في الفترة</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
                className={GLASS_STAT}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">نسبة الطلب للمشاهدة</p>
                  <Percent className="h-5 w-5 text-amber-400/90" aria-hidden />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-3xl font-black tabular-nums text-white">
                    {leadToViewRatioPct !== null ? `${animRatio}٪` : "—"}
                  </p>
                  {conversionBadge ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${conversionBadge.className}`}>
                      {conversionBadge.text}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">(إجمالي الطلبات ÷ إجمالي المشاهدات) × 100 في الفترة</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.35 }}
                className={GLASS_STAT}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">إعلانات نشطة</p>
                  <Home className="h-5 w-5 text-emerald-400/80" aria-hidden />
                </div>
                <p className="mt-3 text-3xl font-black tabular-nums text-white">{animActive}</p>
                <p className="mt-1 text-[11px] text-slate-500">من أصل {propCount} مرتبطة بالوكالة</p>
              </motion.div>
            </div>

            {noListings ? (
              <DashboardAnalyticsEmpty
                title="المشاهدات مقابل الطلبات"
                message="ابدأ بنشر عقاراتك لمشاهدة التحليلات هنا"
                hint="اربط إعلاناتك بوكالتك من لوحة الوسيط، أو أضف إعلاناً جديداً — ستظهر المشاهدات والطلبات حسب الفترة التي تختارها أعلاه."
              />
            ) : noSignalsInRange ? (
              <DashboardAnalyticsEmpty
                title="المشاهدات مقابل الطلبات"
                message="لا بيانات في هذه الفترة"
                hint="جرّب «٣٠ يوماً» أو «سنة»، أو انتظر زيارات صفحات الإعلان وطلبات العملاء."
              />
            ) : (
              <section className={`${GLASS_SECTION} p-6`}>
                <h2 className="text-lg font-black text-white">المشاهدات مقابل الطلبات</h2>
                <p className="mt-1 text-xs text-slate-500">كل نقطة في المحور تشمل الأيام بصفر مشاهدات أو صفر طلبات عند الحاجة</p>
                <div className="mt-6">
                  <ViewsLeadsLineChart data={lineSeries} animKey={chartAnimKey} />
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="grid gap-8 lg:grid-cols-2">
            {noListings ? (
              <>
                <DashboardAnalyticsEmpty
                  title="ذكاء الطلبات (فئات × نوع المعاملة)"
                  message="ابدأ بنشر عقاراتك لمشاهدة التحليلات هنا"
                  hint="سكني / تجاري / أراضي مقابل بيع أو إيجار — انقر على شريحة لاحقاً لتصفية جدول العملاء."
                />
                <DashboardAnalyticsEmpty
                  title="المناطق الأكثر طلباً"
                  message="ابدأ بنشر عقاراتك لمشاهدة التحليلات هنا"
                  hint="محافظة + حي لكل طلب — انقر على شريط لتصفية العملاء."
                />
              </>
            ) : totalLeadsInRange === 0 ? (
              <>
                <DashboardAnalyticsEmpty
                  title="ذكاء الطلبات (فئات × نوع المعاملة)"
                  message="لا طلبات في الفترة الحالية"
                  hint="وسّع نطاق التاريخ أو راقب تبويب «نظرة عامة» للمشاهدات."
                />
                <DashboardAnalyticsEmpty
                  title="المناطق الأكثر طلباً"
                  message="لا طلبات في الفترة الحالية"
                  hint="يُحسب الطلب حسب محافظة وحي العقار المرتبط."
                />
              </>
            ) : (
              <div className="space-y-8">
                <div className="grid gap-8 lg:grid-cols-2">
                  <section className={`${GLASS_SECTION} p-6`}>
                    <h2 className="text-lg font-black text-white">ذكاء الطلبات</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      فئة العقار (سكني / تجاري / أراضي) × نوع المعاملة (بيع / إيجار) — انقر على شريحة لفتح «العملاء» مصفّاة.
                    </p>
                    <div className="mt-4">
                      <LeadIntelligencePieChart data={pieData} animKey={chartAnimKey} onSliceClick={onPieSliceForCrm} />
                    </div>
                  </section>
                  <section className={`${GLASS_SECTION} p-6`}>
                    <h2 className="text-lg font-black text-white">المناطق الأكثر طلباً</h2>
                    <p className="mt-1 text-xs text-slate-500">محافظة — حي من جدول الطلبات — انقر على شريط لتصفية العملاء.</p>
                    <div className="mt-4">
                      <GeographyHotBarChart data={barData} animKey={chartAnimKey} onBarClick={onGeoBarForCrm} />
                    </div>
                  </section>
                </div>
                <section className={`${GLASS_SECTION} p-6`}>
                  <h2 className="text-lg font-black text-white">أجهزة المستخدمين (مشاهدات الإعلان)</h2>
                  <p className="mt-1 text-xs text-slate-500">جوال مقابل سطح مكتب — بيانات اختيارية من تتبع المشاهدات</p>
                  {showDeviceSection && !hasDeviceHints(viewEvents) ? (
                    <p className="mt-2 text-xs text-amber-200/90">
                      لم يُخزَّن نوع الجهاز بعد — نفّذ sql/property_listing_view_device_hint.sql وافتح الإعلان من الجوال أو الكمبيوتر.
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <DeviceMixMiniChart data={deviceMixData} animKey={chartAnimKey} />
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {activeTab === "crm" && (
          <section>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">إدارة الطلبات</h2>
                <p className="mt-1 text-sm text-slate-400">حدّث الحالة والملاحظات — تُحفظ الملاحظات عند مغادرة الحقل.</p>
              </div>
              {agency && !noListings ? (
                <button
                  type="button"
                  onClick={exportFilteredLeadsCsv}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-4 py-2.5 text-sm font-black text-emerald-100 shadow-lg shadow-emerald-950/30 hover:bg-emerald-500/25"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  تصدير الطلبات (CSV)
                </button>
              ) : null}
            </div>
            {noListings ? (
              <DashboardAnalyticsEmpty
                title="لا طلبات بعد"
                message="ابدأ بنشر عقاراتك لمشاهدة التحليلات هنا"
                hint="عند ربط إعلانات نشطة بالوكالة سيصل الطلبات إلى هذا الجدول تلقائياً."
              />
            ) : (
              <>
                {crmFilter.kind !== "none" ? (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-4 py-3 text-sm shadow-inner">
                    <p className="m-0 font-bold text-emerald-100">
                      {crmFilter.kind === "pie"
                        ? `تصفية من الرسم: ${crmFilter.segment}`
                        : `تصفية من الخريطة: ${crmFilter.bar.name}`}
                    </p>
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-500/40 bg-slate-900 px-3 py-1.5 text-xs font-black text-emerald-200 hover:bg-slate-800"
                      onClick={() => setCrmFilter({ kind: "none" })}
                    >
                      إزالة التصفية
                    </button>
                  </div>
                ) : null}
                <AgencyCRMTable
                  leads={filteredLeads}
                  onUpdated={() => void load()}
                  agencyName={agency?.name ?? ""}
                  ownerAssigneeName={ownerDisplayName || "المسؤول"}
                />
              </>
            )}
          </section>
        )}

        {activeTab === "settings" && (
          <div className="space-y-8">
            {showUpgradeCta ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 p-5 text-center shadow-lg">
                <p className="text-sm font-bold text-amber-100">
                  {agency.subscription_status === "expired"
                    ? "انتهى اشتراك Pro — جدّد للاستمرار في المزايا المتقدمة."
                    : "فعّل باقة Pro للمزايا الإضافية والدعم."}
                </p>
                <Link
                  href="/wallet?package=pro"
                  className="mt-4 inline-flex rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-slate-950 no-underline hover:bg-emerald-400"
                >
                  ترقية إلى Pro
                </Link>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-black text-white">بيانات الوكالة</h2>
                <button
                  type="button"
                  onClick={() => (profileEditOpen ? closeProfileEditor() : openProfileEditor())}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-200 hover:bg-emerald-500/20"
                >
                  {profileEditOpen ? "إخفاء المحرر" : "تعديل الملف"}
                </button>
              </div>
              {!profileEditOpen ? (
                <p className="text-sm text-slate-400">اضغط «تعديل الملف» لتحديث الاسم، النبذة، أو الشعار.</p>
              ) : null}
            </div>

            {profileEditOpen ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-black text-white">تعديل بيانات الوكالة</h2>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800"
                    onClick={closeProfileEditor}
                  >
                    إغلاق
                  </button>
                </div>
                <form className="space-y-4" onSubmit={saveAgencyProfile}>
                  <div>
                    <label htmlFor="agency-edit-name" className="mb-1 block text-xs font-bold text-slate-400">
                      اسم الوكالة
                    </label>
                    <input
                      id="agency-edit-name"
                      className={inputClass}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label htmlFor="agency-edit-slug" className="mb-1 block text-xs font-bold text-slate-400">
                      المعرّف في الرابط (slug)
                    </label>
                    <input
                      id="agency-edit-slug"
                      className={`${inputClass} cursor-not-allowed opacity-70`}
                      value={agency.slug}
                      readOnly
                      disabled
                      dir="ltr"
                    />
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                      ثابت بعد الإنشاء. للطلبات الاستثنائية تواصل مع الإدارة.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="agency-edit-bio" className="mb-1 block text-xs font-bold text-slate-400">
                      نبذة عن الوكالة
                    </label>
                    <textarea
                      id="agency-edit-bio"
                      className={`${inputClass} min-h-[100px] resize-y`}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      maxLength={2000}
                    />
                  </div>
                  <div className="border-t border-slate-800 pt-6">
                    <h3 className="text-center text-base font-black tracking-tight text-white">شعار الوكالة</h3>
                    <p className="mx-auto mt-1 max-w-md text-center text-[11px] leading-relaxed text-slate-500">
                      PNG, JPG, WEBP — يُفضّل 512×512.
                    </p>
                    <input
                      id="agency-edit-logo-file"
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setEditLogoFile(f);
                        if (f) setPendingLogoRemoval(false);
                      }}
                    />
                    <div className="relative mx-auto mt-5 w-44 shrink-0">
                      {(editLogoFile || pendingLogoRemoval) && (
                        <button
                          type="button"
                          className="absolute -top-1 left-0 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-300 shadow-md transition hover:border-red-500/50 hover:bg-red-950/50 hover:text-red-300"
                          aria-label="إلغاء تغيير الشعار"
                          onClick={(ev) => {
                            ev.preventDefault();
                            clearLogoSelection();
                          }}
                        >
                          <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                        </button>
                      )}
                      <label
                        htmlFor="agency-edit-logo-file"
                        className="group relative mx-auto flex h-44 w-44 cursor-pointer flex-col overflow-hidden rounded-3xl border-2 border-dashed border-emerald-500/30 bg-slate-900/80 shadow-inner transition hover:border-emerald-400/60 hover:shadow-md focus-within:ring-2 focus-within:ring-emerald-500/40"
                      >
                        {logoPreviewUrl || (!pendingLogoRemoval && agency.logo_url?.trim()) ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element -- remote URL + blob preview */}
                            <img src={String(logoPreviewUrl ?? agency.logo_url)} alt="" className="h-full w-full object-cover" />
                            <span
                              className="pointer-events-none absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/85 text-white shadow-lg ring-2 ring-white/20"
                              aria-hidden
                            >
                              <Camera className="h-5 w-5" strokeWidth={2} />
                            </span>
                          </>
                        ) : (
                          <span className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
                            <Building2 className="h-12 w-12 text-emerald-500/35" strokeWidth={1.25} aria-hidden />
                            <span className="text-xl font-black text-emerald-200/90 tabular-nums">{agencyInitials(editName || agency.name)}</span>
                            <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black text-slate-950 shadow-sm">رفع شعار</span>
                          </span>
                        )}
                      </label>
                    </div>
                    {agency.logo_url && !editLogoFile && !pendingLogoRemoval ? (
                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          className="text-xs font-bold text-slate-500 underline-offset-2 hover:text-red-400 hover:underline"
                          onClick={() => {
                            setPendingLogoRemoval(true);
                            setEditLogoFile(null);
                            if (logoFileInputRef.current) logoFileInputRef.current.value = "";
                          }}
                        >
                          إزالة الشعار من الصفحة العامة
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {profileSaveError ? <p className="text-sm font-bold text-red-400">{profileSaveError}</p> : null}
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={profileSaveLoading || !hasProfileChanges}
                      className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-900/30 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {profileSaveLoading ? "جاري الحفظ…" : "حفظ التعديلات"}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800"
                      onClick={closeProfileEditor}
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Link
        href="/broker/add-property"
        className="fixed bottom-6 start-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-900/50 ring-2 ring-white/10 transition hover:scale-[1.03] hover:shadow-emerald-500/40"
        title="إضافة إعلان جديد"
        aria-label="إضافة إعلان جديد"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
      </Link>

      <AgencyPdfReportIsland
        agencyName={agency.name}
        dateRangeLabel={dateRangeLabel}
        generatedAtLabel={pdfGeneratedAtLabel}
        totalViews={totalViewsInRange}
        totalLeads={totalLeadsInRange}
        leadToViewRatioPct={leadToViewRatioPct}
        activeListingsCount={activeListingsCount}
        propCount={propCount}
        lineSeries={lineSeries}
        barData={barData}
        pieData={pieData}
        deviceMix={deviceMixData}
      />
    </div>
  );
}

export default function AgencyDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,_#312e81_0%,_#020617_55%)]">
          <div className={`${GLASS_STAT} px-10 py-8 text-center`}>
            <p className="m-0 text-sm font-black text-indigo-100">جاري التحميل…</p>
            <p className="mt-2 text-xs text-slate-400">لوحة الوكالة</p>
          </div>
        </div>
      }
    >
      <AgencyDashboardContent />
    </Suspense>
  );
}
