"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  Check,
  Copy,
  Menu,
  MessageCircle,
  Phone,
  Search,
  Share2,
  X,
} from "lucide-react";
import Footer from "@/components/shared/Footer";
import ChatBot from "@/components/shared/ChatBot";
import {
  FLOATING_WHATSAPP_FAB_BOTTOM,
  Z_INDEX_FLOATING_WHATSAPP,
} from "@/lib/floatingFabLayout";
import { agencyLandingThemeStyle } from "@/lib/agencyTheme";
import { propertyPathFromRecord } from "@/lib/propertySlug";
import type { UnitType } from "@/lib/parseHomeSearchQuery";
import type { AgencySubscriptionStatus } from "@/lib/agencySubscription";

export type AgencyPublic = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  bio: string | null;
  subscription_status: AgencySubscriptionStatus;
  /** Primary accent (preset hex); drives `--agency-*` on the landing page. */
  theme_color: string;
};

export type AgencyProperty = {
  id: number;
  title: string;
  price: number;
  area: string;
  governorate?: string | null;
  district?: string | null;
  landmark?: string | null;
  address: string;
  unit_type: string;
  images: string[];
  slug?: string | null;
  listing_type?: string | null;
  listing_purpose?: string | null;
  is_featured?: boolean | null;
  availability_status?: string | null;
};

const TYPE_LABELS: Record<UnitType, string> = {
  student: "سكن طلاب",
  family: "سكن عائلي",
  studio: "ستوديو",
  shared: "مشترك",
  employee: "سكن موظفين",
};

// Luxury palette: dark surfaces, teal brand, gold accent.
const GOLD = "#c8a96a";
const GOLD_SOFT = "rgba(200,169,106,0.18)";
const SURFACE = "#0b1220";
const SURFACE_2 = "#111a2c";
const BORDER = "rgba(200,169,106,0.22)";

function listingLocationLine(p: Pick<AgencyProperty, "governorate" | "district" | "area">): string {
  const parts = [p.governorate, p.district].map((x) => (x ?? "").trim()).filter(Boolean);
  if (parts.length) return parts.join(" — ");
  return (p.area ?? "").trim();
}

function listingDetailLine(p: Pick<AgencyProperty, "landmark" | "address">): string {
  return ((p.landmark ?? "").trim() || (p.address ?? "").trim()).trim();
}

function effectiveListingKind(p: Pick<AgencyProperty, "listing_type" | "listing_purpose">): "rent" | "sale" {
  const raw = (p.listing_type ?? p.listing_purpose ?? "rent").toString().trim().toLowerCase();
  return raw === "sale" ? "sale" : "rent";
}

/** Normalize an arbitrary Egyptian phone string to a tel/WhatsApp-friendly form. */
function normalizePhone(raw: string | null): { tel: string; wa: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  let intl = digits.replace(/^0+/, "");
  if (!intl.startsWith("20")) intl = `20${intl}`;
  return { tel: `+${intl}`, wa: `https://wa.me/${intl}` };
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function AgencyPageClient({
  agency,
  properties,
  contactPhone,
}: {
  agency: AgencyPublic;
  properties: AgencyProperty[];
  contactPhone: string | null;
}) {
  const router = useRouter();
  const [chatOpenSignal, setChatOpenSignal] = useState(0);
  const [contactPrompt, setContactPrompt] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "rent" | "sale">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | UnitType>("all");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");
  const [shareUrl, setShareUrl] = useState<string>("");
  const shareResetRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
    return () => {
      if (shareResetRef.current) window.clearTimeout(shareResetRef.current);
    };
  }, []);

  const phone = useMemo(() => normalizePhone(contactPhone), [contactPhone]);
  const onConsumePrompt = useCallback(() => setContactPrompt(null), []);

  const openAgencyChat = () => {
    setContactPrompt(
      `بدي أتواصل مع وكالة «${agency.name}» — عرّفني على العروض المتاحة والأسعار.`,
    );
    setChatOpenSignal((n) => n + 1);
    setMobileMenuOpen(false);
  };

  const handleShare = async () => {
    const url =
      typeof window !== "undefined" ? window.location.href : shareUrl;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: agency.name, url });
        setShareStatus("copied");
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(url);
        setShareStatus("copied");
      } else {
        // Legacy fallback.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setShareStatus("copied");
      }
    } catch {
      setShareStatus("error");
    }
    if (shareResetRef.current) window.clearTimeout(shareResetRef.current);
    shareResetRef.current = window.setTimeout(() => setShareStatus("idle"), 2400);
  };

  const themeVars = useMemo(() => agencyLandingThemeStyle(agency.theme_color), [agency.theme_color]);

  const filteredProperties = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((p) => {
      if (kindFilter !== "all" && effectiveListingKind(p) !== kindFilter) return false;
      if (typeFilter !== "all" && p.unit_type !== typeFilter) return false;
      if (!q) return true;
      const haystack = [
        p.title,
        p.governorate,
        p.district,
        p.area,
        p.landmark,
        p.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [properties, query, kindFilter, typeFilter]);

  const typeOptions: Array<{ value: "all" | UnitType; label: string }> = [
    { value: "all", label: "كل الأنواع" },
    { value: "family", label: TYPE_LABELS.family },
    { value: "student", label: TYPE_LABELS.student },
    { value: "studio", label: TYPE_LABELS.studio },
    { value: "shared", label: TYPE_LABELS.shared },
    { value: "employee", label: TYPE_LABELS.employee },
  ];

  return (
    <div className="min-h-full" dir="rtl" style={themeVars}>
      {/* ── Custom Agency Header (replaces the Dowarly navbar on this route) ── */}
      <header
        dir="rtl"
        className="sticky top-0 z-[100] border-b backdrop-blur"
        style={{
          background: "rgba(8,13,24,0.86)",
          borderColor: BORDER,
          boxShadow: "0 1px 0 rgba(200,169,106,0.08), 0 12px 30px -24px rgba(0,0,0,0.6)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:py-3.5">
          {/* Agency brand — right side in RTL */}
          <Link
            href={`/agency/${agency.slug}`}
            className="flex min-w-0 items-center gap-3 no-underline"
            aria-label={`${agency.name} — الصفحة الرئيسية`}
          >
            {agency.logo_url ? (
              <span
                className="relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-xl sm:h-11 sm:w-11"
                style={{
                  background: SURFACE_2,
                  border: `1px solid ${BORDER}`,
                  boxShadow: `0 0 0 2px rgba(200,169,106,0.08)`,
                }}
              >
                <Image
                  src={agency.logo_url}
                  alt={`شعار ${agency.name}`}
                  fill
                  className="object-cover"
                  sizes="44px"
                  quality={72}
                />
              </span>
            ) : (
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"
                style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: GOLD }}
                aria-hidden
              >
                <Building2 className="h-5 w-5" strokeWidth={1.75} />
              </span>
            )}
            <span className="min-w-0">
              <span
                className="block truncate text-[15px] font-extrabold leading-tight text-white sm:text-base"
                style={{ fontFamily: "var(--font-cairo), sans-serif" }}
              >
                {agency.name}
              </span>
              <span
                className="block truncate text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: GOLD }}
              >
                Premium Realty
              </span>
            </span>
          </Link>

          {/* Desktop nav — centered */}
          <nav
            aria-label="قائمة الوكالة"
            className="ms-4 hidden flex-1 items-center justify-center gap-1 md:flex"
          >
            <a href="#top" className="px-3 py-2 text-[13px] font-bold text-white/80 no-underline transition hover:text-white">
              الرئيسية
            </a>
            <span aria-hidden className="text-white/15">·</span>
            <a href="#properties" className="px-3 py-2 text-[13px] font-bold text-white/80 no-underline transition hover:text-white">
              عقاراتنا
            </a>
            <span aria-hidden className="text-white/15">·</span>
            <a href="#contact" className="px-3 py-2 text-[13px] font-bold text-white/80 no-underline transition hover:text-white">
              تواصل معنا
            </a>
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            {phone ? (
              <a
                href={phone.wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-extrabold no-underline transition sm:px-4 sm:text-[13px]"
                style={{
                  background: "var(--agency-primary)",
                  color: "var(--agency-on-primary)",
                  boxShadow: "var(--agency-primary-shadow)",
                }}
                aria-label="تواصل عبر واتساب"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                <span className="hidden sm:inline">واتساب</span>
                <span className="sm:hidden">WA</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={openAgencyChat}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-extrabold transition sm:px-4 sm:text-[13px]"
                style={{
                  background: "var(--agency-primary)",
                  color: "var(--agency-on-primary)",
                  boxShadow: "var(--agency-primary-shadow)",
                }}
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                تواصل
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl md:hidden"
              style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: GOLD }}
              aria-expanded={mobileMenuOpen}
              aria-controls="agency-mobile-menu"
              aria-label={mobileMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen ? (
          <nav
            id="agency-mobile-menu"
            aria-label="قائمة الوكالة (جوال)"
            className="border-t md:hidden"
            style={{ borderColor: BORDER, background: "rgba(8,13,24,0.95)" }}
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              <a
                href="#top"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[14px] font-bold text-white/85 no-underline transition hover:bg-white/5"
              >
                الرئيسية
              </a>
              <a
                href="#properties"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[14px] font-bold text-white/85 no-underline transition hover:bg-white/5"
              >
                عقاراتنا
              </a>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[14px] font-bold text-white/85 no-underline transition hover:bg-white/5"
              >
                تواصل معنا
              </a>
            </div>
          </nav>
        ) : null}
      </header>

      <main id="top" className="min-h-screen" style={{ background: SURFACE }}>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section
          aria-label={`عن ${agency.name}`}
          className="relative overflow-hidden"
          style={{
            background: `radial-gradient(1100px 480px at 85% -10%, rgba(200,169,106,0.18), transparent 60%), radial-gradient(900px 420px at 10% 10%, var(--agency-primary-a14), transparent 55%), ${SURFACE}`,
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%), repeating-linear-gradient(45deg, rgba(200,169,106,0.04) 0 1px, transparent 1px 14px)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20 md:py-24">
            <div className="md:flex md:items-center md:gap-10">
              <div className="mb-6 flex justify-center md:mb-0 md:justify-start">
                {agency.logo_url ? (
                  <div
                    className="relative h-28 w-28 overflow-hidden rounded-2xl sm:h-36 sm:w-36"
                    style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, boxShadow: "0 30px 60px -30px rgba(0,0,0,0.9)" }}
                  >
                    <Image
                      src={agency.logo_url}
                      alt={`شعار ${agency.name}`}
                      fill
                      className="object-cover"
                      sizes="144px"
                      quality={80}
                      priority
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-28 w-28 items-center justify-center rounded-2xl sm:h-36 sm:w-36"
                    style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: GOLD }}
                    aria-hidden
                  >
                    <Building2 className="h-14 w-14" strokeWidth={1.4} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center md:text-right">
                <div
                  className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em]"
                  style={{ background: GOLD_SOFT, borderColor: BORDER, color: GOLD }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />
                  Luxury Real Estate
                </div>
                <h1
                  className="mb-4 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl"
                  style={{ fontFamily: "var(--font-cairo), sans-serif" }}
                >
                  {agency.name}
                </h1>
                <p
                  className="mx-auto max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-white/75 sm:text-base md:mx-0"
                  style={{ fontFamily: "var(--font-cairo), sans-serif" }}
                >
                  {agency.bio?.trim()
                    ? agency.bio
                    : `وكالة ${agency.name} — تصفّح أحدث عروضنا من الوحدات السكنية، وتواصل مباشرةً مع فريقنا للحصول على استشارة مخصّصة.`}
                </p>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                  {phone ? (
                    <>
                      <a
                        href={phone.wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-extrabold no-underline transition hover:brightness-110 sm:text-sm"
                        style={{
                          background: "var(--agency-primary)",
                          color: "var(--agency-on-primary)",
                          boxShadow: "var(--agency-primary-shadow-lg)",
                        }}
                      >
                        <MessageCircle className="h-5 w-5" strokeWidth={2.3} aria-hidden />
                        تواصل عبر واتساب
                      </a>
                      <a
                        href={`tel:${phone.tel}`}
                        className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-[13px] font-extrabold no-underline transition hover:bg-white/5 sm:text-sm"
                        style={{ borderColor: BORDER, color: GOLD }}
                      >
                        <Phone className="h-5 w-5" strokeWidth={2.3} aria-hidden />
                        اتصل الآن
                      </a>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={openAgencyChat}
                      className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-extrabold transition hover:brightness-110 sm:text-sm"
                      style={{
                        background: "var(--agency-primary)",
                        color: "var(--agency-on-primary)",
                        boxShadow: "var(--agency-primary-shadow-lg)",
                      }}
                    >
                      <MessageCircle className="h-5 w-5" strokeWidth={2.3} aria-hidden />
                      تواصل مع الوكالة
                    </button>
                  )}
                  <span className="text-xs font-bold text-white/60">
                    {properties.length} إعلان نشط
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Search / filter bar (scoped to this agency) ─────────── */}
        <section
          aria-label="بحث داخل عروض الوكالة"
          className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 sm:-mt-10"
        >
          <div
            className="rounded-2xl border p-4 shadow-2xl backdrop-blur sm:p-5"
            style={{
              background: "rgba(17,26,44,0.85)",
              borderColor: BORDER,
              boxShadow: "0 30px 80px -40px rgba(0,0,0,0.8)",
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="relative flex-1" htmlFor="agency-search">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center" style={{ color: GOLD }}>
                  <Search className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <input
                  id="agency-search"
                  type="search"
                  inputMode="search"
                  placeholder="ابحث في عروض الوكالة (عنوان، منطقة، معلم)…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-xl border bg-transparent py-3 pe-10 ps-10 text-[14px] font-semibold text-white placeholder:text-white/40 outline-none transition focus:ring-2"
                  style={{
                    borderColor: BORDER,
                    background: SURFACE_2,
                  }}
                  aria-label="بحث"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute inset-y-0 end-3 my-auto h-7 w-7 rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                    aria-label="مسح البحث"
                  >
                    <X className="mx-auto h-4 w-4" />
                  </button>
                ) : null}
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { v: "all", l: "الكل" },
                    { v: "rent", l: "إيجار" },
                    { v: "sale", l: "بيع" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setKindFilter(opt.v)}
                    className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition"
                    style={{
                      borderColor: kindFilter === opt.v ? GOLD : BORDER,
                      background: kindFilter === opt.v ? GOLD_SOFT : "transparent",
                      color: kindFilter === opt.v ? GOLD : "rgba(255,255,255,0.75)",
                    }}
                    aria-pressed={kindFilter === opt.v}
                  >
                    {opt.l}
                  </button>
                ))}
                <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "all" | UnitType)}
                  className="rounded-full border px-3 py-1.5 text-[12px] font-bold text-white outline-none transition"
                  style={{
                    borderColor: BORDER,
                    background: SURFACE_2,
                  }}
                  aria-label="نوع الوحدة"
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ background: SURFACE_2, color: "#fff" }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-white/55">
              <span>
                {filteredProperties.length} / {properties.length} عرض
              </span>
              {(query || kindFilter !== "all" || typeFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setKindFilter("all");
                    setTypeFilter("all");
                  }}
                  className="rounded-full px-2 py-1 transition hover:text-white"
                  style={{ color: GOLD }}
                >
                  إعادة ضبط الفلاتر
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Property grid ──────────────────────────────────────── */}
        <section id="properties" className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2
              className="text-lg font-black text-white sm:text-xl"
              style={{ fontFamily: "var(--font-cairo), sans-serif" }}
            >
              عقاراتنا
            </h2>
            <span className="h-px flex-1 mx-4" style={{ background: `linear-gradient(to left, ${BORDER}, transparent)` }} />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
              Our Listings
            </span>
          </div>

          {properties.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed py-16 text-center"
              style={{ borderColor: BORDER, background: SURFACE_2 }}
            >
              <p className="text-white/70">لا توجد عقارات نشطة لهذه الوكالة حالياً.</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div
              className="rounded-2xl border py-16 text-center"
              style={{ borderColor: BORDER, background: SURFACE_2 }}
            >
              <p className="text-white/70">لا توجد نتائج مطابقة للفلاتر الحالية.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setKindFilter("all");
                  setTypeFilter("all");
                }}
                className="mt-4 rounded-xl border px-4 py-2 text-[13px] font-bold transition hover:bg-white/5"
                style={{ borderColor: BORDER, color: GOLD }}
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            <motion.section
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.05 } },
              }}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="عقارات الوكالة"
            >
              {filteredProperties.map((p) => {
                const ut =
                  (p.unit_type as UnitType) in TYPE_LABELS ? (p.unit_type as UnitType) : "family";
                const kind = effectiveListingKind(p);
                return (
                  <motion.article
                    key={p.id}
                    variants={cardVariants}
                    whileHover={{ y: -4, transition: { duration: 0.22 } }}
                    onClick={() => router.push(propertyPathFromRecord(p))}
                    className="group cursor-pointer overflow-hidden rounded-2xl border transition"
                    style={{
                      background: SURFACE_2,
                      borderColor: BORDER,
                      boxShadow: "0 20px 40px -32px rgba(0,0,0,0.9)",
                    }}
                  >
                    <div className="relative h-52 w-full overflow-hidden" style={{ background: "#0a111e" }}>
                      {p.images?.[0] ? (
                        <Image
                          src={p.images[0]}
                          alt={`صورة: ${p.title}`}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-[1.04]"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          quality={72}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-5xl text-white/20">🏠</div>
                      )}
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to top, rgba(5,10,20,0.85) 0%, rgba(5,10,20,0.2) 45%, transparent 70%)",
                        }}
                        aria-hidden
                      />
                      {p.is_featured ? (
                        <span
                          className="absolute start-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black tracking-wider"
                          style={{
                            background: GOLD,
                            color: "#1a1407",
                            boxShadow: "0 8px 24px -8px rgba(200,169,106,0.8)",
                          }}
                        >
                          ★ مميّز
                        </span>
                      ) : null}
                      <span
                        className="absolute bottom-3 start-3 rounded-lg px-2.5 py-1 text-xs font-black"
                        style={{
                          background: "rgba(10,17,30,0.9)",
                          color: "var(--agency-primary)",
                          border: `1px solid ${BORDER}`,
                        }}
                      >
                        {p.price.toLocaleString("ar-EG")} {kind === "sale" ? "ج.م" : "ج.م/شهر"}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                          style={{
                            background: GOLD_SOFT,
                            color: GOLD,
                            border: `1px solid ${BORDER}`,
                          }}
                        >
                          {TYPE_LABELS[ut]}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                          style={{
                            background: "var(--agency-primary-a10)",
                            color: "var(--agency-primary)",
                            border: "1px solid var(--agency-primary-a35)",
                          }}
                        >
                          {kind === "sale" ? "🏷️ بيع" : "🔑 إيجار"}
                        </span>
                      </div>
                      <h3
                        className="mb-2 line-clamp-2 text-[15px] font-extrabold leading-snug text-white"
                        style={{ fontFamily: "var(--font-cairo), sans-serif" }}
                      >
                        {p.title}
                      </h3>
                      <p className="flex items-start gap-1 text-xs text-white/55">
                        <span className="mt-0.5" aria-hidden style={{ color: GOLD }}>
                          ◉
                        </span>
                        <span>
                          {listingLocationLine(p)}
                          {listingDetailLine(p) ? ` — ${listingDetailLine(p)}` : ""}
                        </span>
                      </p>
                    </div>
                  </motion.article>
                );
              })}
            </motion.section>
          )}
        </section>

        {/* ── Contact / Share CTA ───────────────────────────────── */}
        <section id="contact" className="mx-auto max-w-6xl px-4 pb-16">
          <div
            className="relative overflow-hidden rounded-3xl border p-6 sm:p-10"
            style={{
              background: `linear-gradient(140deg, ${SURFACE_2} 0%, #0a1322 100%)`,
              borderColor: BORDER,
              boxShadow: "0 40px 100px -40px rgba(0,0,0,0.9)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full"
              style={{ background: "radial-gradient(closest-side, rgba(200,169,106,0.25), transparent 70%)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full"
              style={{ background: "radial-gradient(closest-side, var(--agency-primary-a14), transparent 70%)" }}
            />

            <div className="relative grid gap-6 md:grid-cols-2 md:items-center">
              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em]" style={{ color: GOLD }}>
                  Share & Connect
                </p>
                <h2
                  className="mb-2 text-2xl font-black text-white sm:text-3xl"
                  style={{ fontFamily: "var(--font-cairo), sans-serif" }}
                >
                  شارك موقع الوكالة مع عميلك
                </h2>
                <p className="text-sm leading-relaxed text-white/70">
                  انسخ رابط صفحة «{agency.name}» بضغطة واحدة وأرسله لعملائك على واتساب أو
                  أي تطبيق مراسلة — اعرض كل عروضك من مكان واحد، بأسلوب احترافي.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-extrabold transition hover:brightness-110"
                  style={{
                    background: GOLD,
                    color: "#1a1407",
                    boxShadow: "0 20px 40px -20px rgba(200,169,106,0.7)",
                  }}
                  aria-live="polite"
                >
                  {shareStatus === "copied" ? (
                    <>
                      <Check className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                      تم نسخ الرابط
                    </>
                  ) : shareStatus === "error" ? (
                    <>
                      <Copy className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                      حدث خطأ — انسخ يدوياً
                    </>
                  ) : (
                    <>
                      <Share2 className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                      شارك هذا الموقع
                    </>
                  )}
                </button>

                {shareUrl ? (
                  <div
                    className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ background: SURFACE, borderColor: BORDER, color: "rgba(255,255,255,0.7)" }}
                    dir="ltr"
                  >
                    <span className="truncate">{shareUrl}</span>
                  </div>
                ) : null}

                {phone ? (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={phone.wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-extrabold no-underline transition hover:brightness-110"
                      style={{ background: "var(--agency-primary)", color: "var(--agency-on-primary)" }}
                    >
                      <MessageCircle className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                      واتساب
                    </a>
                    <a
                      href={`tel:${phone.tel}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-extrabold no-underline transition hover:bg-white/5"
                      style={{ borderColor: BORDER, color: GOLD }}
                    >
                      <Phone className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                      اتصال
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openAgencyChat}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-extrabold transition hover:bg-white/5"
                    style={{ borderColor: BORDER, color: GOLD }}
                  >
                    <MessageCircle className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                    افتح محادثة مع الوكالة
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Fixed floating WhatsApp (agency) — always visible ── */}
        {phone ? (
          <a
            href={phone.wa}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition hover:brightness-110"
            style={{
              right: "max(20px, env(safe-area-inset-right, 0px))",
              bottom: FLOATING_WHATSAPP_FAB_BOTTOM,
              zIndex: Z_INDEX_FLOATING_WHATSAPP,
              background: "var(--agency-primary)",
              boxShadow: "var(--agency-primary-fab-ring)",
            }}
            aria-label={`تواصل مع ${agency.name} عبر واتساب`}
            title="تواصل عبر واتساب"
          >
            <MessageCircle
              className="h-7 w-7"
              strokeWidth={2.4}
              aria-hidden
              style={{ color: "var(--agency-on-primary)" }}
            />
          </a>
        ) : null}
      </main>

      <Footer />
      <ChatBot
        agencyId={agency.id}
        agencyName={agency.name}
        agencySubscriptionStatus={agency.subscription_status}
        openSignal={chatOpenSignal}
        pendingPrompt={contactPrompt}
        onPendingPromptConsumed={onConsumePrompt}
      />
    </div>
  );
}
