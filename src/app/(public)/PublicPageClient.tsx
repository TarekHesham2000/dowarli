"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Banner from "@/components/shared/Banner";
import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import AdBanner from '@/components/ads/AdBanner'
import ChatBot from '@/components/shared/ChatBot'
import Footer from '@/components/shared/Footer'
import Navbar from '@/components/Navbar'
import PartnerMarquee from '@/components/partners/PartnerMarquee'
import { type ParsedFilters, type UnitType, parseSearchQuery } from "@/lib/parseHomeSearchQuery";
import type { SavedSearchFiltersV1 } from "@/lib/matchSavedSearch";
import { propertyPathFromRecord } from "@/lib/propertySlug";
// ─── Types ────────────────────────────────────────────────────────────────────
type Property = {
  id: number;
  title: string;
  description: string;
  price: number;
  area: string;
  address: string;
  unit_type: UnitType;
  images: string[];
  slug?: string | null;
  /** إيجار / بيع — يُملأ من قاعدة البيانات عند توفر العمود */
  listing_type?: string | null;
  listing_purpose?: string | null;
  profiles: { name: string; phone: string };
};

function effectiveListingKind(p: Pick<Property, "listing_type" | "listing_purpose">): "rent" | "sale" {
  const raw = (p.listing_type ?? p.listing_purpose ?? "rent").toString().trim().toLowerCase();
  return raw === "sale" ? "sale" : "rent";
}

/** أعمدة واضحة + active فقط في الاستعلام (لا نعتمد على select *) */
const HOME_PROPERTY_SELECT =
  "id, title, description, price, area, address, unit_type, images, slug, listing_type, listing_purpose, availability_status, created_at, profiles(name, phone, low_trust)";

const HOME_PROPERTY_SELECT_FALLBACK =
  "id, title, description, price, area, address, unit_type, images, slug, availability_status, created_at, profiles(name, phone, low_trust)";

function filterHomeLowTrustRows(rows: unknown[]): Property[] {
  const filtered = rows.filter((row) => {
    const r = row as {
      profiles?: { low_trust?: boolean } | { low_trust?: boolean }[] | null;
    };
    const p = r.profiles;
    const o = Array.isArray(p) ? p[0] : p;
    return o?.low_trust !== true;
  });
  return filtered as Property[];
}

/** active فقط؛ يحاول مع/بدون availability ومع أعمدة listing_* إن وُجدت */
async function fetchActiveHomeProperties(
  client: typeof supabase,
  parsed: ParsedFilters,
  selectedType: string,
): Promise<Property[]> {
  const rawKw = parsed.keywords?.trim() || "";
  const cleanKeywords = rawKw
    ? rawKw.replace(/[,،]/g, " ").replace(/\s+/g, " ").trim()
    : "";

  const applyFilters = (selectList: string) => {
    let q = client.from("properties").select(selectList).eq("status", "active");
    if (parsed.area) q = q.ilike("area", `%${parsed.area}%`);
    if (parsed.maxPrice) q = q.lte("price", parsed.maxPrice);
    if (selectedType && selectedType !== "all") q = q.eq("unit_type", selectedType);
    if (cleanKeywords.length > 2) {
      q = q.or(
        `title.ilike.%${cleanKeywords}%,description.ilike.%${cleanKeywords}%,address.ilike.%${cleanKeywords}%`,
      );
    }
    return q;
  };

  const attempts: { sel: string; avail: boolean }[] = [
    { sel: HOME_PROPERTY_SELECT, avail: true },
    { sel: HOME_PROPERTY_SELECT, avail: false },
    { sel: HOME_PROPERTY_SELECT_FALLBACK, avail: true },
    { sel: HOME_PROPERTY_SELECT_FALLBACK, avail: false },
  ];

  let lastMsg = "";
  for (const a of attempts) {
    let q = applyFilters(a.sel);
    if (a.avail) q = q.eq("availability_status", "available");
    const { data, error } = await q.order("created_at", { ascending: false });
    if (!error) {
      return filterHomeLowTrustRows(data || []);
    }
    lastMsg = error.message || String(error);
  }
  console.error("Home properties fetch failed:", lastMsg);
  return [];
}

// مناطق موسّعة للـ Parsing — لماذا؟ → المستخدم يكتب طبيعي مش بالقائمة
const EXTENDED_AREAS: Record<string, string> = {
  // المناطق الرسمية في DB
  "المنصورة": "المنصورة", "القاهرة": "القاهرة",
  "الإسكندرية": "الإسكندرية", "الجيزة": "الجيزة",
  "أسيوط": "أسيوط", "سوهاج": "سوهاج", "المنيا": "المنيا",
  // أحياء شائعة — mapped للـ canonical area
  "المعادي": "القاهرة", "مدينة نصر": "القاهرة",
  "الزمالك": "القاهرة", "الدقي": "الجيزة",
  "المهندسين": "الجيزة", "الهرم": "الجيزة",
  "شبرا": "القاهرة", "عين شمس": "القاهرة",
  "التجمع": "القاهرة", "الرحاب": "القاهرة",
  "أكتوبر": "الجيزة", "الشيخ زايد": "الجيزة",
};

// كلمات → unit_type — مرتبة من الأكثر تحديداً للأقل
const UNIT_TYPE_KEYWORDS: [string, UnitType][] = [
  ["سكن طلاب", "student"], ["طلاب", "student"], ["طالب", "student"], ["طلبة", "student"],
  ["موظفين", "employee"], ["موظف", "employee"], ["للعمل", "employee"],
  ["مشترك", "shared"], ["شيرينج", "shared"], ["سرير", "shared"],
  ["ستوديو", "studio"], ["استوديو", "studio"],
  ["عائلي", "family"], ["عائلة", "family"], ["أسرة", "family"], ["شقة", "family"],
];

// ─── Constants ────────────────────────────────────────────────────────────────
const AREAS = ["الكل","المنصورة","القاهرة","الإسكندرية","الجيزة","أسيوط","سوهاج","المنيا"];

const TYPES: { value: UnitType | ""; label: string; icon: string }[] = [
  { value: "",        label: "الكل",      icon: "✦"  },
  { value: "student", label: "سكن طلاب", icon: "🎓" },
  { value: "family",  label: "سكن عائلي",icon: "🏡" },
  { value: "studio",  label: "ستوديو",   icon: "🛋️" },
  { value: "shared",  label: "مشترك",    icon: "🤝" },
  { value: 'employee', label: 'سكن موظفين', icon: "💼" },
];

const TYPE_LABELS: Record<UnitType, string> = {
  student: "سكن طلاب",
  family:  "سكن عائلي",
  studio:  "ستوديو",
  shared:  "مشترك",
  employee: 'سكن موظفين',
};

const TYPE_COLORS: Record<UnitType, { bg: string; text: string; border: string }> = {
  student: { bg: "rgba(0,211,141,0.08)", text: "#00a86b", border: "rgba(0,211,141,0.35)" },
  family: { bg: "rgba(59,130,246,0.08)", text: "#2563eb", border: "rgba(59,130,246,0.3)" },
  studio: { bg: "rgba(167,139,250,0.1)", text: "#9333ea", border: "rgba(167,139,250,0.35)" },
  shared: { bg: "rgba(251,146,60,0.1)", text: "#ea580c", border: "rgba(251,146,60,0.35)" },
  employee: { bg: "rgba(234,179,8,0.12)", text: "#ca8a04", border: "rgba(234,179,8,0.35)" },
};

// ─── Framer Motion Variants ───────────────────────────────────────────────────
const heroVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.8, 
      ease: "easeOut" 
    } 
  }
};

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any },
  },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 }, // خليه يبدأ من تحت شوية وبحجم أصغر
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    transition: { duration: 0.8, ease: "easeOut" } // 0.8 ثانية هي السرعة المثالية للفخامة
  },
  exit: { 
    opacity: 0, 
    y: 30, 
    transition: { duration: 0.4 } 
  }
};
// ─── Component ────────────────────────────────────────────────────────────────
export default function PublicPageClient() {
  const router = useRouter();
  const [properties, setProperties]         = useState<Property[]>([]);
  const [loading, setLoading]               = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatBootstrap, setChatBootstrap] = useState<string | null>(null);
  const [parsedFilters, setParsedFilters] = useState<ParsedFilters>({
    area: "", maxPrice: null, unitType: "", keywords: ""
  });
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [leadForm, setLeadForm]             = useState({ name: "", phone: "" });
  const [leadSubmitted, setLeadSubmitted]   = useState(false);
  const [leadLoading, setLeadLoading]       = useState(false);
  const [activeFilter, setActiveFilter] = useState<UnitType | "all">("all");
  const [mobileChatFocus, setMobileChatFocus] = useState(false);
  const [chatOpenSignal, setChatOpenSignal] = useState(0);
  const [listLayoutMobile, setListLayoutMobile] = useState(false);
  const [saveAlertBusy, setSaveAlertBusy] = useState(false);
  const [saveAlertTip, setSaveAlertTip] = useState<string | null>(null);

  useEffect(() => {
    void loadProperties();
    // Only refetch when unit-type chip changes; search uses submitHeroToAi / loadProperties() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit loadProperties/searchQuery
  }, [activeFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setListLayoutMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const submitHeroToAi = () => {
    const q = searchQuery.trim();
    if (q) setChatBootstrap(q);
    else void loadProperties();
  };

  const handleChatBootstrapConsumed = useCallback(() => setChatBootstrap(null), []);

  const loadProperties = async (overrideFilters?: Partial<ParsedFilters> & { unitType?: string }) => {
    setLoading(true);
    try {
      const parsed = overrideFilters
        ? {
            area: overrideFilters.area ?? "",
            maxPrice: overrideFilters.maxPrice ?? null,
            unitType: overrideFilters.unitType ?? "",
            keywords: overrideFilters.keywords ?? "",
          }
        : parseSearchQuery(searchQuery);

      const selectedType =
        overrideFilters?.unitType !== undefined
          ? overrideFilters.unitType
          : activeFilter !== "all"
            ? activeFilter
            : parsed.unitType;

      const rows = await fetchActiveHomeProperties(supabase, parsed, selectedType);
      setProperties(rows);
    } catch (error: unknown) {
      console.error("Search Error:", error instanceof Error ? error.message : error);
    } finally {
      setLoading(false);
    }
  };
 const handleLeadSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!selectedProperty) return;

    setLeadLoading(true);



    await supabase.from("leads").insert({

      property_id: selectedProperty.id,

      client_name: leadForm.name,

      client_phone: leadForm.phone,

    });



    setLeadSubmitted(true);

    setLeadLoading(false);



    setTimeout(() => {

      const phone      = selectedProperty.profiles?.phone;

      const cleanPhone = phone?.replace(/\D/g, "") ?? "";

      const waPhone    = cleanPhone.startsWith("0") ? "2" + cleanPhone : cleanPhone;

      const message    = `أنا مهتم بالعقار رقم ${selectedProperty.id} المعروض على دَورلي هل هو متاح`;

      window.open("https://wa.me/" + waPhone + "?text=" + encodeURIComponent(message), "_blank");

    }, 500);

  };

  const closeModal = () => {
    setSelectedProperty(null);
    setLeadSubmitted(false);
    setLeadForm({ name: "", phone: "" });
  };

  const tc = (unitType: UnitType) => TYPE_COLORS[unitType] || TYPE_COLORS.family;

  const saveSearchAlert = async () => {
    if (!searchQuery.trim() && activeFilter === "all") {
      setSaveAlertTip("اكتب بحثاً أو اختر نوع وحدة أولاً");
      window.setTimeout(() => setSaveAlertTip(null), 4000);
      return;
    }
    setSaveAlertBusy(true);
    setSaveAlertTip(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?next=/");
        return;
      }
      const parsed = parseSearchQuery(searchQuery);
      const filters: SavedSearchFiltersV1 = {
        v: 1,
        searchQuery,
        activeFilter,
        parsed: {
          area: parsed.area,
          maxPrice: parsed.maxPrice,
          unitType: parsed.unitType,
          keywords: parsed.keywords,
        },
      };
      const { error } = await supabase.from("saved_searches").insert({
        user_id: user.id,
        filters,
      });
      if (error) {
        setSaveAlertTip("تعذّر حفظ التنبيه. تأكد من تسجيل الدخول وتشغيل سكربت قاعدة البيانات (saved_searches).");
        return;
      }
      setSaveAlertTip("تم حفظ التنبيه — سنُبلغك عند ظهور عقار مشابه");
    } finally {
      setSaveAlertBusy(false);
      window.setTimeout(() => setSaveAlertTip(null), 6000);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: var(--font-cairo), 'Cairo', sans-serif; background: #f9fdfc; }

        ::-webkit-scrollbar       { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #00d38d; border-radius: 99px; }

        select option { background: #fff; color: #0f172a; }

        /* Hide number input arrows */
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

        /* Nav hover */
        .nav-link { transition: color 0.2s ease, border-color 0.2s ease; }
        .nav-link:hover { color: #00d38d !important; border-color: #00d38d !important; }

        /* Input focus glow */
        .field:focus {
          border-color: rgba(0,211,141,0.45) !important;
          box-shadow: 0 0 0 2px rgba(0,211,141,0.15);
        }

        /* WhatsApp pulse */
        @keyframes wa-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0.45); }
          60%       { box-shadow: 0 0 0 12px rgba(37,211,102,0); }
        }
        .wa-btn { animation: wa-pulse 2.2s ease infinite; }

        /* Spinner */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin 0.75s linear infinite; }

        .chip-active {
          box-shadow: none;
          border-color: #00d38d !important;
          background: rgba(0,211,141,0.08) !important;
          color: #009e6a !important;
        }

        /* Bottom nav – show only on mobile */
        @media (min-width: 768px) { .mobile-nav { display: none !important; } }

        /* Horizontal property row — hide scrollbar, snap (mobile) */
        .property-row-snap {
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .property-row-snap::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#f9fdfc",
          fontFamily: "var(--font-cairo), 'Cairo', sans-serif",
          color: "#0f172a",
          overflowX: "hidden",
          position: "relative",
        }}
      >
        <div
          className={[
            "transition-opacity duration-200 ease-out",
            mobileChatFocus ? "max-md:pointer-events-none max-md:select-none max-md:opacity-0" : "",
          ].join(" ")}
          {...(mobileChatFocus ? { "aria-hidden": true as const } : {})}
        >
        <Banner />

        {/* Soft green gradient band: nav + hero + search sit above mint page bg */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(0, 211, 141, 0.14) 0%, rgba(0, 211, 141, 0.07) 28%, rgba(249, 253, 252, 0.92) 72%, #f9fdfc 100%)",
          }}
        >
        {/* ══════════════════ NAVIGATION ══════════════════ */}
        <Navbar />

        {/* ══════════════════ HERO ══════════════════ */}
        <motion.header
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          style={{
            padding: "4rem 1.5rem 3.5rem",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                delay: 0.2,
                duration: 0.5, 
                ease: [0.16, 1, 0.3, 1] as any
              }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(0,211,141,0.08)",
              border: "1px solid rgba(0,211,141,0.25)",
              padding: "6px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              color: "#00a86b",
              marginBottom: "1.5rem",
            }}
          >
            <span style={{ fontSize: 10 }}>●</span>
            منصة الإيجار الأولى في مصر
          </motion.div>

          {/* H1 */}
          <h1
            style={{
              fontSize: "clamp(1.85rem, 5vw, 3rem)",
              fontWeight: 900,
              lineHeight: 1.2,
              marginBottom: "1rem",
              color: "#0f172a",
              letterSpacing: "-0.5px",
            }}
          >
            لاقي{" "}
            <span style={{ color: "#00d38d" }}>سكنك</span> بسهولة وأمان
          </h1>

          <p
            style={{
              fontSize: 17,
              color: "#64748b",
              maxWidth: 500,
              margin: "0 auto 2.25rem",
              lineHeight: 1.85,
            }}
          >
            ابحث بالعربي عن المنطقة والسعر ونوع الوحدة — بدون تعقيد.
          </p>

          {/* ── SEARCH BOX ── */}
          {/* ── SMART SEARCH BOX ── */}
          <section
            aria-label="بحث ذكي عن عقارات"
            style={{ maxWidth: 780, margin: "0 auto" }}
          >
            {/* Marketing text */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              style={{
                fontSize: 14, color: "#64748b", textAlign: "center",
                marginBottom: "0.75rem", lineHeight: 1.7,
              }}
            >
              اكتب طلبك هنا — هنوجّه مباشرة لمساعد دَورلي الذكي 🤖✨
            </motion.p>

            {/* Input Row */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid rgba(226, 232, 240, 0.95)",
                borderRadius: 12,
                padding: "0.65rem 0.75rem",
                display: "flex",
                gap: "0.65rem",
                alignItems: "center",
                boxShadow:
                  "0 10px 40px rgba(15, 23, 42, 0.07), 0 2px 10px rgba(0, 211, 141, 0.06), 0 0 0 1px rgba(255,255,255,0.8) inset",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            >
              {/* Search icon */}
              <span style={{ fontSize: 18, flexShrink: 0, opacity: 0.45 }}>🔍</span>

              {/* The Smart Input */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitHeroToAi();
                  }
                }}
                placeholder="مثال: سكن طلاب رخيص قريب من الجامعة — أو شقة عائلي في التجمع 🏠"
                aria-label="بحث ذكي"
                className="field"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 15,
                  fontFamily: "var(--font-cairo), 'Cairo', sans-serif",
                  color: "#0f172a",
                  padding: "8px 4px",
                }}
              />

              {/* Clear button */}
              {searchQuery && (
                <button
                  onClick={async () => {
                    setSearchQuery("");
                    setParsedFilters({ area: "", maxPrice: null, unitType: "", keywords: "" });
                    setActiveFilter("all");
                    setLoading(true);
                    try {
                      const rows = await fetchActiveHomeProperties(supabase, {
                        area: "",
                        maxPrice: null,
                        unitType: "",
                        keywords: "",
                      }, "");
                      setProperties(rows);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >✕</button>
              )}

              {/* Search Button — soft pulse on md+ (globals: .chat-invite-pulse) */}
              <button
                type="button"
                onClick={submitHeroToAi}
                className="chat-invite-pulse chat-invite-pulse--desktop-only"
                style={{
                  background: "#00d38d",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontFamily: "var(--font-cairo), 'Cairo', sans-serif",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "opacity 0.2s, background 0.2s, filter 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#00bf7f";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#00d38d";
                }}
              >
                اسأل دَورلي ✦
              </button>
            </div>

            {/* Parsed Filters Feedback — يوضح للمستخدم إيه اللي فهمه */}
            {(parsedFilters.area || parsedFilters.maxPrice || parsedFilters.unitType) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: "flex", gap: 8, flexWrap: "wrap",
                  marginTop: "0.75rem", justifyContent: "center",
                }}
              >
                {parsedFilters.area && (
                  <span style={{ background: "rgba(0,211,141,0.1)", border: "1px solid rgba(0,211,141,0.3)", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#00a86b", padding: "4px 12px" }}>
                    📍 {parsedFilters.area}
                  </span>
                )}
                {parsedFilters.maxPrice && (
                  <span style={{ background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.3)", borderRadius: 99, fontSize: 11, fontWeight: 700, color: "#fb923c", padding: "4px 12px" }}>
                    💰 حتى {parsedFilters.maxPrice.toLocaleString()} ج.م
                  </span>
                )}
                {parsedFilters.unitType && (
                  <span style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 99, fontSize: 11, fontWeight: 700, color: "#60a5fa", padding: "4px 12px" }}>
                    🏠 {TYPE_LABELS[parsedFilters.unitType as UnitType]}
                  </span>
                )}
              </motion.div>
            )}
          </section>
        </motion.header>
        </div>

        {/* ══════════════════ LISTINGS ══════════════════ */}
        <main
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 1.5rem 9rem",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Filter chips */}
          <div
            role="group"
            aria-label="تصفية النوع"
            style={{
              display: "flex",
              gap: "0.6rem",
              flexWrap: "wrap",
              marginBottom: "2.5rem",
            }}
          >
              {TYPES.map((t) => {
                // التعديل هنا: نستخدم activeFilter بدل type
                const isActive = activeFilter === (t.value || "all"); 
                
                return (
                  <button
                    key={t.value || "all"}
                    // التعديل هنا: نحدث الحالة الجديدة عند الضغط
                    onClick={() => setActiveFilter((t.value || "all") as UnitType | "all")}
                    className={isActive ? "chip-active" : ""}
                    style={{
                      cursor: "pointer",
                      padding: "0.65rem 1.25rem",
                      borderRadius: 8,
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      transition: "border-color 0.2s, background 0.2s, color 0.2s",
                      border: `1px solid ${isActive ? "#00d38d" : "#e5e7eb"}`,
                      background: isActive ? "rgba(0,211,141,0.08)" : "#ffffff",
                      color: isActive ? "#009e6a" : "#64748b",
                      whiteSpace: "nowrap",
                      boxShadow: "none",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
          </div>

          <PartnerMarquee className="mt-8 rounded-2xl" />

          {/* Results count */}
          {!loading && properties.length > 0 && (
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: "1.5rem" }}>
              تم العثور على{" "}
              <strong style={{ color: "var(--brand-500)" }}>{properties.length}</strong> إعلان
            </p>
          )}

          {!loading && (searchQuery.trim() || activeFilter !== "all") && (
            <div style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <button
                type="button"
                disabled={saveAlertBusy}
                onClick={() => void saveSearchAlert()}
                style={{
                  background: "#ffffff",
                  color: "#00a86b",
                  border: "1px solid rgba(0,211,141,0.4)",
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: saveAlertBusy ? "wait" : "pointer",
                  fontFamily: "var(--font-cairo), 'Cairo', sans-serif",
                  opacity: saveAlertBusy ? 0.75 : 1,
                }}
              >
                🔔 نبهني عند توفر عقار مشابه
              </button>
              {saveAlertTip ? (
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", maxWidth: 420, lineHeight: 1.6 }}>{saveAlertTip}</p>
              ) : null}
            </div>
          )}

          {/* States */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "6rem 0" }}>
              <div
                className="spinner"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "3px solid rgba(0,211,141,0.2)",
                  borderTop: "3px solid #00d38d",
                  margin: "0 auto 1.25rem",
                }}
              />
              <p style={{ color: "#64748b", fontSize: 14 }}>جاري التحميل...</p>
            </div>
          ) : properties.length === 0 ? (
              <div style={{ textAlign: "center", padding: "6rem 0" }}>
                <div style={{ fontSize: 60, marginBottom: "1rem" }}>🏚️</div>
                <p style={{ color: "#64748b", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                  ملقناش طلبك بالظبط
                </p>
                <p style={{ color: "#475569", fontSize: 13, lineHeight: 1.8, marginBottom: 20 }}>
                  سيب مواصفاتك في &quot;اطلب شقتك&quot; وهنبلغك فوراً 📩
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    background: "#00d38d",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-cairo), 'Cairo', sans-serif",
                  }}
                >
                  إلغاء الفلاتر وعرض الكل
                </button>
              </div>
          ) : (
            <>
            <AdBanner slotId="dowarli-home-leaderboard" layout="leaderboard" className="mb-6" />
            {/* Staggered grid */}
            <motion.section
              aria-label="قائمة العقارات"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className={listLayoutMobile ? "property-row-snap" : undefined}
              style={
                listLayoutMobile
                  ? {
                      display: "flex",
                      flexDirection: "row",
                      gap: "1rem",
                      overflowX: "auto",
                      paddingLeft: 4,
                      paddingRight: 4,
                      paddingBottom: 6,
                    }
                  : {
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
                      gap: "1.75rem",
                    }
              }
            >
              {properties.flatMap((p, i) => {
                const colors = tc(p.unit_type);
                const card = (
                  <motion.article
                    key={p.id}
                    variants={cardVariants}
                    whileHover={
                      listLayoutMobile
                        ? undefined
                        : { scale: 1.03, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as any } }
                    }
                    onClick={() => router.push(propertyPathFromRecord(p))}
                    aria-label={`عقار: ${p.title}`}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "border-color 0.2s",
                      ...(listLayoutMobile
                        ? {
                            flex: "0 0 min(86vw, 320px)",
                            width: "min(86vw, 320px)",
                            maxWidth: "min(86vw, 320px)",
                            scrollSnapAlign: "center",
                            scrollSnapStop: "always",
                          }
                        : {}),
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,211,141,0.45)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
                    }}
                  >
                    {/* Image */}
                    <div style={{ position: "relative", height: listLayoutMobile ? 200 : 210, overflow: "hidden" }}>
                      {p.images?.[0] ? (
                        <Image
                          src={p.images[0]}
                          alt={`صورة عقار: ${p.title} في ${p.area}`}
                          fill
                          sizes="(max-width: 768px) 86vw, 33vw"
                          style={{ objectFit: "cover" }}
                          loading="lazy"
                          quality={72}
                          priority={false}
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          style={{
                            height: "100%",
                            background: "linear-gradient(135deg, rgba(0,211,141,0.06), rgba(0,211,141,0.12))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 54,
                          }}
                        >
                          🏠
                        </div>
                      )}
                      {/* Bottom fade */}
                      <div
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "linear-gradient(to top, rgba(15,23,42,0.45) 0%, transparent 55%)",
                        }}
                      />
                      {/* Type badge */}
                      <span
                        style={{
                          position: "absolute",
                          top: 14,
                          right: 14,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          justifyContent: "flex-end",
                          maxWidth: "calc(100% - 28px)",
                        }}
                      >
                        <span
                          style={{
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 13px",
                          }}
                        >
                          {TYPE_LABELS[p.unit_type]}
                        </span>
                        <span
                          style={{
                            background: "rgba(255,255,255,0.92)",
                            color: effectiveListingKind(p) === "sale" ? "#ca8a04" : "#059669",
                            border: "1px solid #e5e7eb",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 13px",
                          }}
                        >
                          {effectiveListingKind(p) === "sale" ? "🏷️ بيع" : "🔑 إيجار"}
                        </span>
                      </span>
                    </div>

                    {/* Body */}
                    <div style={{ padding: "1.25rem 1.4rem 1.4rem" }}>
                      <h2
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: "#0f172a",
                          marginBottom: "0.45rem",
                          lineHeight: 1.45,
                        }}
                      >
                        {p.title}
                      </h2>
                      <p
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          marginBottom: "1.1rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="var(--brand-500)"/>
                          <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
                        </svg>
                        {p.area} — {p.address}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderTop: "1px solid #f1f5f9",
                          paddingTop: "1rem",
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 22, fontWeight: 900, color: "var(--brand-500)" }}>
                            {p.price.toLocaleString()}
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>
                            {effectiveListingKind(p) === "sale" ? "ج.م" : "ج.م/شهر"}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(propertyPathFromRecord(p)); }}
                          style={{
                            background: "#00d38d",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "8px 16px",
                            cursor: "pointer",
                            fontFamily: "var(--font-cairo), 'Cairo', sans-serif",
                            transition: "opacity 0.2s, background 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#00bf7f";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#00d38d";
                          }}
                        >
                          تفاصيل ←
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
                if ((i + 1) % 5 !== 0) return [card];
                const feedSlot = Math.ceil((i + 1) / 5);
                return [
                  card,
                  <AdBanner
                    key={`ad-infeed-${p.id}-${feedSlot}`}
                    slotId={`dowarli-infeed-${feedSlot}`}
                    layout="in-feed"
                    scrollerItem={listLayoutMobile}
                  />,
                ];
              })}
            </motion.section>
            </>
          )}
        </main>

        {/* ══════════════════ MODAL ══════════════════ */}
        <AnimatePresence>
          {selectedProperty && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`تفاصيل عقار: ${selectedProperty.title}`}
              onClick={closeModal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 200,
                padding: "1rem",
              }}
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  width: "100%",
                  maxWidth: 500,
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                }}
              >
                {/* Modal header */}
                <div
                  style={{
                    background: "#f9fafb",
                    borderBottom: "1px solid #e5e7eb",
                    padding: "1.35rem 1.5rem",
                    borderRadius: "12px 12px 0 0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                        {selectedProperty.title}
                      </h2>
                      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                        📍 {selectedProperty.area} — {selectedProperty.address}
                      </p>
                    </div>
                    <button
                      onClick={closeModal}
                      aria-label="إغلاق"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        color: "#64748b",
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        cursor: "pointer",
                        fontSize: 15,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ffffff"; }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Modal body */}
                <div style={{ padding: "1.6rem" }}>
                  {selectedProperty.images?.[0] && (
                    <div
                      style={{
                        position: "relative",
                        height: 220,
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: "1.4rem",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <Image
                        src={selectedProperty.images[0]}
                        alt={`صورة: ${selectedProperty.title}`}
                        fill
                        sizes="500px"
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  )}

                  {/* Price + type row */}
                  <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.4rem" }}>
                    <div
                      style={{
                        flex: 1,
                        background: "rgba(0,211,141,0.06)",
                        border: "1px solid rgba(0,211,141,0.2)",
                        borderRadius: 8,
                        padding: "13px 16px",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>السعر الشهري</div>
                      <div style={{ fontSize: 21, fontWeight: 900, color: "var(--brand-500)" }}>
                        {selectedProperty.price.toLocaleString()} ج.م
                      </div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "13px 16px",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>نوع الوحدة</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                        {TYPE_LABELS[selectedProperty.unit_type]}
                      </div>
                    </div>
                  </div>

                  {selectedProperty.description && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#64748b",
                        lineHeight: 1.9,
                        marginBottom: "1.4rem",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "1.4rem",
                      }}
                    >
                      {selectedProperty.description}
                    </p>
                  )}

                  {!leadSubmitted ? (
                    <form
                      onSubmit={handleLeadSubmit}
                      style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
                    >
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
                        أدخل بياناتك للتواصل مع المالك
                      </p>
                      {["text", "tel"].map((inputType, i) => (
                        <input
                          key={inputType}
                          type={inputType}
                          placeholder={i === 0 ? "اسمك الكامل" : "رقم هاتفك"}
                          required
                          value={i === 0 ? leadForm.name : leadForm.phone}
                          onChange={(e) =>
                            setLeadForm(
                              i === 0
                                ? { ...leadForm, name: e.target.value }
                                : { ...leadForm, phone: e.target.value }
                            )
                          }
                          className="field"
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "13px 16px",
                            fontSize: 14,
                            fontFamily: "var(--font-cairo), 'Cairo', sans-serif",
                            color: "#0f172a",
                            outline: "none",
                            transition: "border-color 0.2s, box-shadow 0.2s",
                          }}
                        />
                      ))}
                      <button
                        type="submit"
                        disabled={leadLoading}
                        className="wa-btn"
                        style={{
                          background: "linear-gradient(135deg, #25D366, #128C7E)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 14,
                          padding: "15px",
                          fontSize: 15,
                          fontWeight: 700,
                          cursor: leadLoading ? "not-allowed" : "pointer",
                          fontFamily: "'Cairo', sans-serif",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          opacity: leadLoading ? 0.7 : 1,
                          marginTop: "0.25rem",
                        }}
                      >
                        {leadLoading ? "جاري الإرسال..." : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                              <path d="M11.999 2C6.477 2 2 6.478 2 12.004a9.958 9.958 0 001.362 5.042L2 22l5.09-1.34A9.938 9.938 0 0012 22c5.523 0 10-4.478 10-10.004C22 6.478 17.523 2 12 2zm0 18.343a8.315 8.315 0 01-4.24-1.163l-.304-.18-3.02.796.804-2.954-.198-.32A8.34 8.34 0 013.657 12c0-4.6 3.742-8.343 8.342-8.343 4.601 0 8.344 3.743 8.344 8.343 0 4.6-3.743 8.343-8.344 8.343z"/>
                            </svg>
                            تواصل مع المالك على واتساب
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{
                        background: "rgba(0,211,141,0.08)",
                        border: "1px solid rgba(0,211,141,0.25)",
                        borderRadius: 8,
                        padding: "1.75rem",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 44, marginBottom: "0.75rem" }}>✅</div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--brand-500)", margin: 0 }}>
                        جاري تحويلك لواتساب المالك...
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════ CTA BANNER ══════════════════ */}
        <section
          aria-label="دعوة الملاك للانضمام"
          style={{
            maxWidth: 1240,
            margin: "0 auto 4rem",
            padding: "0 1.5rem",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "2.5rem 2rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1.5rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                أنت مالك عقار؟
              </h2>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.75, margin: 0 }}>
                انضم إلى <strong style={{ color: "#00d38d" }}>دورلي</strong> وانشر إعلانك بسهولة مع نظام النقاط
                والمراجعة.
              </p>
            </div>
            <a
              href="/register"
              style={{
                background: "#00d38d",
                color: "#fff",
                borderRadius: 8,
                padding: "14px 32px",
                fontSize: 15,
                fontWeight: 800,
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "#00bf7f";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "#00d38d";
              }}
            >
              سجّل الآن
            </a>
          </div>
        </section>

        {/* ══════════════════ FOOTER ══════════════════ */}
        <Footer />

        {/* ══════════════════ MOBILE BOTTOM NAV ══════════════════ */}
        <nav
          role="navigation"
          aria-label="التنقل السريع"
          className="mobile-nav"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#ffffff",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-around",
            padding: "0.65rem 0 calc(0.85rem + env(safe-area-inset-bottom))",
            zIndex: 150,
          }}
        >
          {(
            [
              { kind: "link" as const, href: "/", icon: "🏠", label: "الرئيسية" },
              { kind: "chat" as const, icon: "🔍", label: "بحث" },
              { kind: "link" as const, href: "/register", icon: "➕", label: "إعلان" },
              { kind: "link" as const, href: "/login", icon: "👤", label: "حسابي" },
            ] as const
          ).map((item) => {
            if (item.kind === "chat") {
              const active = mobileChatFocus;
              return (
                <button
                  key="nav-chat-search"
                  type="button"
                  aria-label="فتح مساعد دورلي للبحث"
                  aria-pressed={active}
                  onClick={() => setChatOpenSignal((n) => n + 1)}
                  className="flex flex-col items-center gap-1 border-0 bg-transparent p-0"
                  style={{
                    color: active ? "#00d38d" : "#64748b",
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 56,
                    transition: "color 0.2s, background 0.2s, box-shadow 0.2s",
                    cursor: "pointer",
                    fontFamily: "var(--font-cairo), Cairo, sans-serif",
                    borderRadius: 12,
                    padding: "2px 8px 0",
                    boxShadow: active ? "0 0 0 2px rgba(0,211,141,0.35)" : "none",
                    background: active ? "rgba(0,211,141,0.08)" : "transparent",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            }
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  textDecoration: "none",
                  color: "#64748b",
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 56,
                  transition: "color 0.2s",
                }}
              >
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>
        </div>

        <ChatBot
          openSignal={chatOpenSignal}
          pendingPrompt={chatBootstrap}
          onPendingPromptConsumed={handleChatBootstrapConsumed}
          onMobileSheetOpenChange={setMobileChatFocus}
          onFilter={(filters) => {
            // حدّث كل الـ states أولاً
            if (filters.unitType) {
              setActiveFilter(filters.unitType);   // ← التابة اللي فوق
            } else {
              setActiveFilter('all');
            }

            // ابني الـ overrideFilters وابعته لـ loadProperties مباشرة
            // (مش هتستنى الـ state يتحدث لأن ده async)
            // ابني الـ overrideFilters ونظف الكلمات
            const keywordsCleaned = filters.keywords
              ? filters.keywords
                  .replace(/[,،]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
              : '';

            const overrideFilters = {
              area:      filters.area     || '',
              maxPrice:  filters.maxPrice ?? null,
              unitType:  filters.unitType || '',
              keywords:  keywordsCleaned, // ابعت الكلمات نظيفة
            };

            loadProperties(overrideFilters);  // ← بنبعت الداتا مباشرة = مفيش stale closure
          }}
        />
      </div>
    </>
  );
}