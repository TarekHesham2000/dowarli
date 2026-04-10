"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Banner from "@/components/shared/Banner";
import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import ChatBot from '@/components/shared/ChatBot'
import Footer from '@/components/shared/Footer'
import Navbar from '@/components/Navbar'
// ─── Types ────────────────────────────────────────────────────────────────────
type UnitType = 'student' | 'family' | 'studio' | 'shared' | 'employee'
type Property = {
  id: number;
  title: string;
  description: string;
  price: number;
  area: string;
  address: string;
  unit_type: UnitType;
  images: string[];
  profiles: { name: string; phone: string };
};

// ─── Parsed Filters Type ─────────────────────────────────────────────────────
type ParsedFilters = {
  area: string;
  maxPrice: number | null;
  unitType: string;
  keywords: string;
};

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
  student: { bg: "rgba(27,120,60,0.18)",  text: "var(--brand-500)", border: "rgba(27,120,60,0.4)"  },
  family:  { bg: "rgba(59,130,246,0.18)",  text: "#60a5fa", border: "rgba(59,130,246,0.4)"  },
  studio:  { bg: "rgba(167,139,250,0.18)", text: "#c084fc", border: "rgba(167,139,250,0.4)" },
  shared:  { bg: "rgba(251,146,60,0.18)",  text: "#fb923c", border: "rgba(251,146,60,0.4)"  },
  employee: { bg: 'rgba(234,179,8,0.18)', text: '#eab308', border: 'rgba(234,179,8,0.4)' },
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
// ─── Smart Query Parser ───────────────────────────────────────────────────────
// لماذا خارج الـ Component؟ → pure function، لا تحتاج re-render، سهلة الـ testing
function parseSearchQuery(query: string): ParsedFilters {
  if (!query.trim()) return { area: "", maxPrice: null, unitType: "", keywords: "" };

  let remaining = query.trim();

  // ── 1. استخراج السعر (يدعم: 6000، 6 آلاف، 6k) ──────────────────────────────
  let maxPrice: number | null = null;
  const priceMatch = remaining.match(/(\d+(?:[.,]\d+)?)\s*(?:آلاف|الف|ألف|k)/i);
  const rawMatch   = remaining.match(/(\d{3,})/); 

  if (priceMatch) {
    maxPrice = parseFloat(priceMatch[1]) * 1000;
    remaining = remaining.replace(priceMatch[0], " ");
  } else if (rawMatch) {
    maxPrice = parseFloat(rawMatch[1]);
    remaining = remaining.replace(rawMatch[0], " ");
  }

  // ── 2. خريطة المناطق (AREAS_MAP) ──────────────────────────────────────────
const AREAS_MAP: Record<string, string> = {
    // --- الدقهلية والمنصورة (قلب المشروع) ---
    "المنصورة": "المنصورة", "منصورة": "المنصورة", "طلخا": "المنصورة","جامعة المنصورة": "المنصورة", "جامعة المنصوره": "المنصورة",
    "المشاية": "المنصورة", "توريل": "المنصورة", "حي الجامعة": "المنصورة", "المشايه": "المنصورة","الجامعه": "المنصورة",
    "الترعة": "المنصورة", "الترعه": "المنصورة", "جديلة": "المنصورة", "سندوب": "المنصورة",
    "المجزر": "المنصورة", "الدراسات": "المنصورة", "عزبة عقل": "المنصورة",

    // --- القاهرة الكبرى (العاصمة والأحياء) ---
    "القاهرة": "القاهرة", "قاهرة": "القاهرة", "مدينة نصر": "القاهرة", "مدينه نصر": "القاهرة",
    "التجمع": "القاهرة", "تجمع": "القاهرة", "الخامس": "القاهرة", "الرحاب": "القاهرة",
    "مدينتي": "القاهرة", "مدينتى": "القاهرة", "المعادي": "القاهرة", "المعادى": "القاهرة",
    "حلوان": "القاهرة", "شبرا": "القاهرة", "وسط البلد": "القاهرة", "الزمالك": "القاهرة",
    "مصر الجديدة": "القاهرة", "مصر الجديده": "القاهرة", "عين شمس": "القاهرة", "المقطم": "القاهرة",

    // --- الجيزة وضواحيها ---
    "الجيزة": "الجيزة", "جيزة": "الجيزة", "الدقي": "الجيزة", "الدقى": "الجيزة",
    "المهندسين": "الجيزة", "مهندسين": "الجيزة", "الهرم": "الجيزة", "فيصل": "الجيزة",
    "أكتوبر": "الجيزة", "اكتوبر": "الجيزة", "زايد": "الجيزة", "الشيخ زايد": "الجيزة",
    "حدائق الأهرام": "الجيزة", "المنيب": "الجيزة",

    // --- الإسكندرية والساحل (المصايف) ---
    "الإسكندرية": "الإسكندرية", "اسكندرية": "الإسكندرية", "إسكندرية": "الإسكندرية",
    "سموحة": "الإسكندرية", "سموحه": "الإسكندرية", "ميامي": "الإسكندرية", "ميامى": "الإسكندرية",
    "المنتدة": "الإسكندرية", "العجمي": "الإسكندرية", "السيوف": "الإسكندرية",
    "الساحل": "الإسكندرية", "الساحل الشمالي": "الإسكندرية", "الساحل الشمالى": "الإسكندرية",
    "مارينا": "الإسكندرية", "سيدي جابر": "الإسكندرية",

    // --- محافظات الدلتا والقناة ---
    "طنطا": "الغربية", "المحلة": "الغربية", "الزقازيق": "الشرقية", "بنها": "القليوبية",
    "بورسعيد": "بورسعيد", "الإسماعيلية": "الإسماعيلية", "السويس": "السويس", "دمياط": "دمياط",
    "راس البر": "دمياط", "رأس البر": "دمياط",

    // --- الصعيد ---
    "أسيوط": "أسيوط", "اسيوط": "أسيوط", "المنيا": "المنيا", "منيا": "المنيا",
    "سوهاج": "سوهاج", "قنا": "قنا", "الأقصر": "الأقصر", "اسوان": "أسوان", "أسوان": "أسوان",

    // --- مناطق ساحلية أخرى ---
    "الغردقة": "البحر الأحمر", "شرم الشيخ": "جنوب سيناء", "مرسى مطروح": "مطروح", "مطروح": "مطروح"
  };

  let area = "";
  for (const [keyword, canonical] of Object.entries(AREAS_MAP)) {
    if (remaining.includes(keyword)) {
      area = canonical;
      remaining = remaining.replace(new RegExp(keyword, 'g'), " ");
      break; 
    }
  }

  // ── 3. تحديد نوع الوحدة (TYPE_MAP) ────────────────────────────────────────
  const TYPE_MAP: [string[], UnitType][] = [
    [["سكن طلاب","طلاب","طالب","طلبة","جامعة"], "student"],
    [["موظفين","موظف","للعمل","عمال"], "employee"],
    [["مشترك","شيرينج","شير"], "shared"],
    [["ستوديو","استوديو"], "studio"],
    [["عائلي","عائلة","أسرة","عيلة"], "family"],
  ];

  let unitType: UnitType | "" = "";
  for (const [keywords, type] of TYPE_MAP) {
    if (keywords.some(k => remaining.includes(k))) {
      unitType = type;
      keywords.forEach(k => { remaining = remaining.replace(new RegExp(k, 'g'), " "); });
      break;
    }
  }

  // ── 4. الكلمات الدالة والكلمات التي يجب تجاهلها (Stop Words) ───────────────
  const stopWords = [
    // 1. أفعال الطلب والبحث (User Intent)
    "عايز", "عاوز", "محتاج", "ابحث", "لاقي", "دورلي", "شوفلي", "بدور", "ببحث", 
    "محتاجين", "عاوزين", "نفسي", "نفسنا", "دور", "فتش", "ألاقي", "الاقي", "متاح", "موجود",

    // 2. حروف الجر والروابط (العامية والفصحى)
    "في", "فى", "بـ", "ب", "على", "ع", "من", "إلى", "الى", "و", "أو", "او", 
    "مع", "عند", "جنب", "بجوار", "قدام", "ورا", "تحت", "فوق", "بين",

    // 3. كلمات وصف العقار الحشوية (Object Fillers)
    "شقة", "شقه", "وحدة", "وحده", "عقار", "مكان", "سكن", "أوضة", "اوضة", "غرفة", "غرفه",
    "بيت", "منزل", "عمارة", "عماره", "دور", "ارضي", "أرضي", "روف", "سطوح", "بلكونة", "بلكونه",

    // 4. كلمات المال والأسعار (Financial Fillers)
    "ايجار", "إيجار", "بإيجار", "سعر", "سعرها", "سعره", "تمن", "ثمن", "فلوس", "رخيص", 
    "غالي", "لقطة", "لقطه", "حدود", "بحدود", "رينج", "رينج", "تقريبا", "حوالي", "جنيه", 
    "جم", "ج.م", "كاش", "قسط", "مطلوب", "بكام",

    // 5. الضمائر والأسماء الموصولة
    "اللي", "اللى", "الذي", "التي", "هو", "هي", "ده", "دي", "دى", "هنا", "هناك",

    // 6. كلمات الحشو والذوقيات (Politeness & Fillers)
    "لو سمحت", "من فضلك", "يا", "ياريت", "يا ريت", "بقولك", "ممكن", "العلم", "بص", 
    "كده", "كدا", "حاجة", "حاجه", "تمام", "أوي", "قوي", "خالص", "جداً", "جدا", "يكون", "تكون",

    // 7. كلمات النفي والاستدراك (Crucial for filtering)
    "مش", "لا", "لأ", "مفيش", "بدون", "غير", "إلا", "الا", "بس",

    // 8. كلمات الحالة (Status words)
    "نضيف", "نظيف", "جديد", "لوكس", "سوبر", "مفروش", "فاضي", "فاضى", "هادي", "هادى",
    // 📍 كلمات الموقع والمسافة (اللي سألت عليها)
    "جنب", "جمب", "بجوار", "قريب", "قريبة", "قريبه", "عند", "عندي", "قدام", 
    "ورا", "خلف", "أمام", "ناحية", "ناحيه", "على", "ع", "بين", 
    "وسط", "قلب", "داخل", "برا", "بره", "حوالين", "من", "بتاع", "بتاعة",
    // كلمات عامة
    "في", "فى", "بـ", "ب", "حدود", "جنيه", "اللي", "ده", "دي", "ممكن", "ياريت"
  ];

  let keywords = remaining;
  
  // التنظيف باستخدام Regex الذكي اللي بيحافظ على الكلمات المستقلة
  stopWords.forEach(w => {
    const regex = new RegExp(`(^|\\s)${w}(\\s|$)`, "gi");
    keywords = keywords.replace(regex, " ");
  });

  // التنظيف النهائي
  keywords = keywords.replace(/\d+/g, " ").replace(/\s+/g, " ").trim();

  return { area, maxPrice, unitType, keywords };
}
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
  const [listLayoutMobile, setListLayoutMobile] = useState(false);

  useEffect(() => {
    loadProperties();
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

// 1. تعديل الفانكشن لتقبل فلاتر اختيارية مباشرة
// عدل السطر الأول في الفانكشن عشان يقبل فلاتر مباشرة
const loadProperties = async (overrideFilters?: any) => {
  setLoading(true);
  try {
    const parsed = overrideFilters || parseSearchQuery(searchQuery);

    let query = supabase
      .from('properties')
      .select('*, profiles(name, phone, low_trust)')
      .eq('status', 'active')
      .eq('availability_status', 'available');

    if (parsed.area) {
      query = query.ilike('area', `%${parsed.area}%`);
    }

    if (parsed.maxPrice) {
      query = query.lte('price', parsed.maxPrice);
    }

    // الأولوية: قيمة صريحة من الشات (حتى لو "") ثم activeFilter ثم parsed — لا تستخدم || لأن "" falsy
    const selectedType =
      overrideFilters?.unitType ??
      (activeFilter !== 'all' ? activeFilter : parsed.unitType);

    if (selectedType && selectedType !== 'all') {
      query = query.eq('unit_type', selectedType);
    }

    const rawKw = parsed.keywords?.trim() || '';
    const cleanKeywords = rawKw
      ? rawKw.replace(/[,،]/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    if (cleanKeywords.length > 2) {
      query = query.or(
        `title.ilike.%${cleanKeywords}%,description.ilike.%${cleanKeywords}%,address.ilike.%${cleanKeywords}%`
      );
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    const filtered = rows.filter(
      (row: { profiles?: { low_trust?: boolean } | { low_trust?: boolean }[] | null }) => {
        const p = row.profiles;
        const o = Array.isArray(p) ? p[0] : p;
        return o?.low_trust !== true;
      },
    );
    setProperties(filtered as unknown as Property[]);

  } catch (error: any) {
    console.error('Search Error:', error.message);
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

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Cairo', sans-serif; background: #020617; }

        /* Scrollbar */
        ::-webkit-scrollbar       { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--brand-500); border-radius: 99px; }

        /* Select options dark theme */
        select option { background: #0f172a; color: #f8fafc; }

        /* Hide number input arrows */
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

        /* Nav hover */
        .nav-link { transition: color 0.2s ease, border-color 0.2s ease; }
        .nav-link:hover { color: var(--brand-500) !important; border-color: var(--brand-500) !important; }

        /* Input focus glow */
        .field:focus {
          border-color: rgba(27,120,60,0.6) !important;
          box-shadow: 0 0 0 3px rgba(27,120,60,0.12);
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

        /* Active chip glow */
        .chip-active {
          box-shadow: 0 0 16px rgba(27,120,60,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
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
          /* Vibrant soft-dark radial background — emerald-900/20 → slate-950 */
          background: "radial-gradient(ellipse 120% 80% at 100% 0%, rgba(6,78,59,0.22) 0%, #020617 55%)",
          fontFamily: "'Cairo', sans-serif",
          color: "#f8fafc",
          overflowX: "hidden",
          position: "relative",
        }}
      >
        {/* Secondary ambient glow — bottom-left */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(27,120,60,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div
          className={[
            "transition-opacity duration-200 ease-out",
            mobileChatFocus ? "max-md:pointer-events-none max-md:select-none max-md:opacity-0" : "",
          ].join(" ")}
          {...(mobileChatFocus ? { "aria-hidden": true as const } : {})}
        >
        <Banner />

        {/* ══════════════════ NAVIGATION ══════════════════ */}
        <Navbar />

        {/* ══════════════════ HERO ══════════════════ */}
        <motion.header
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          style={{
            padding: "6rem 1.5rem 7rem",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} // قللنا الـ scale عشان ما يكبرش بزيادة
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                delay: 0.3, // انتظار بسيط عشان العين تركز
                duration: 0.8, 
                ease: [0.16, 1, 0.3, 1] as any // Apple-style curve
              }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(27,120,60,0.1)",
              border: "1px solid rgba(27,120,60,0.3)",
              padding: "7px 22px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--brand-500)",
              marginBottom: "1.75rem",
              backdropFilter: "blur(8px)",
            }}
          >
            <span style={{ fontSize: 10 }}>●</span>
            منصة الإيجار الأولى في مصر
          </motion.div>

          {/* H1 */}
          <h1
            style={{
              fontSize: "clamp(2.1rem, 5.5vw, 3.75rem)",
              fontWeight: 900,
              lineHeight: 1.18,
              marginBottom: "1.1rem",
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            لاقي{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--brand-600) 0%, var(--brand-400) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              سكنك
            </span>{" "}
            بسهولة وأمان
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 17,
              color: "#94a3b8",
              maxWidth: 500,
              margin: "0 auto 3rem",
              lineHeight: 1.85,
            }}
          >

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
                marginBottom: "0.9rem", lineHeight: 1.7,
              }}
            >
              اكتب طلبك هنا — هنوجّه مباشرة لمساعد دَورلي الذكي 🤖✨
            </motion.p>

            {/* Input Row */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding: "0.75rem 0.75rem 0.75rem 0.9rem",
                display: "flex",
                gap: "0.65rem",
                alignItems: "center",
                boxShadow: "0 32px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
                transition: "border-color 0.25s",
              }}
              onFocus={() => {/* يمكن إضافة glow لاحقاً */}}
            >
              {/* Search icon */}
              <span style={{ fontSize: 18, flexShrink: 0, opacity: 0.5 }}>🔍</span>

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
                  fontFamily: "'Cairo', sans-serif",
                  color: "#f8fafc",
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
                    // شغّل البحث بدون فلاتر مباشرة
                    setLoading(true);
                    const { data } = await supabase
                      .from("properties")
                      .select("id, title, description, price, area, address, unit_type, images, profiles(name, phone, low_trust)")
                      .eq("status", "active")
                      .eq("availability_status", "available")
                      .order("created_at", { ascending: false });
                    const raw = (data as unknown as Property[]) ?? [];
                    setProperties(
                      raw.filter((row) => {
                        const p = row.profiles as { low_trust?: boolean } | undefined;
                        return p?.low_trust !== true;
                      }),
                    );
                    setLoading(false);
                  }}
                >✕</button>
              )}

              {/* Search Button */}
              <button
                type="button"
                onClick={submitHeroToAi}
                style={{
                  background: "var(--brand-gradient-chat)",
                  color: "#fff", border: "none", borderRadius: 14,
                  padding: "11px 22px", fontFamily: "'Cairo', sans-serif",
                  fontSize: 13, fontWeight: 800, cursor: "pointer",
                  whiteSpace: "nowrap", flexShrink: 0,
                  boxShadow: "0 0 0 1px rgba(27,120,60,0.4), 0 8px 28px rgba(27,120,60,0.35)",
                  transition: "box-shadow 0.25s, transform 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(27,120,60,0.6), 0 12px 36px rgba(27,120,60,0.5)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(27,120,60,0.4), 0 8px 28px rgba(27,120,60,0.35)";
                  e.currentTarget.style.transform = "translateY(0)";
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
                  <span style={{ background: "rgba(27,120,60,0.12)", border: "1px solid rgba(27,120,60,0.3)", borderRadius: 99, fontSize: 11, fontWeight: 700, color: "var(--brand-500)", padding: "4px 12px" }}>
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
                      padding: "0.8rem 1.6rem",
                      borderRadius: "1.2rem",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      // التعديل هنا: نربط الألوان بـ isActive الجديدة
                      border: `1.5px solid ${isActive ? "rgba(27,120,60,0.7)" : "rgba(255,255,255,0.06)"}`,
                      background: isActive ? "rgba(27,120,60,0.12)" : "rgba(255,255,255,0.03)",
                      color: isActive ? "var(--brand-500)" : "#94a3b8",
                      whiteSpace: "nowrap",
                      boxShadow: isActive ? "0 0 20px rgba(27,120,60,0.15)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
          </div>

          {/* Results count */}
          {!loading && properties.length > 0 && (
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: "1.5rem" }}>
              تم العثور على{" "}
              <strong style={{ color: "var(--brand-500)" }}>{properties.length}</strong> إعلان
            </p>
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
                  border: "3px solid rgba(27,120,60,0.15)",
                  borderTop: "3px solid var(--brand-500)",
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
                    background: "rgba(27,120,60,0.1)", color: "var(--brand-500)",
                    border: "1px solid rgba(27,120,60,0.3)", borderRadius: 12,
                    padding: "10px 24px", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  إلغاء الفلاتر وعرض الكل
                </button>
              </div>
          ) : (
            /* Staggered grid */
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
              {properties.map((p) => {
                const colors = tc(p.unit_type);
                return (
                  <motion.article
                    key={p.id}
                    variants={cardVariants}
                    whileHover={
                      listLayoutMobile
                        ? undefined
                        : { scale: 1.03, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as any } }
                    }
                    onClick={() => router.push(`/property/${p.id}`)}
                    aria-label={`عقار: ${p.title}`}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 24,
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "border-color 0.3s, box-shadow 0.3s",
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
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(27,120,60,0.45)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 24px 64px rgba(27,120,60,0.14)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
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
                            background: "linear-gradient(135deg, rgba(27,120,60,0.08), rgba(27,120,60,0.18))",
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
                          background: "linear-gradient(to top, rgba(2,6,23,0.75) 0%, transparent 55%)",
                        }}
                      />
                      {/* Type badge */}
                      <span
                        style={{
                          position: "absolute",
                          top: 14,
                          right: 14,
                          background: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 13px",
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                        }}
                      >
                        {TYPE_LABELS[p.unit_type]}
                      </span>
                    </div>

                    {/* Body */}
                    <div style={{ padding: "1.25rem 1.4rem 1.4rem" }}>
                      <h2
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: "#ffffff",
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
                          <circle cx="12" cy="9" r="2.5" fill="#020617"/>
                        </svg>
                        {p.area} — {p.address}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          paddingTop: "1rem",
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 22, fontWeight: 900, color: "var(--brand-500)" }}>
                            {p.price.toLocaleString()}
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>ج.م/شهر</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/property/${p.id}`); }}
                          style={{
                            background: "rgba(27,120,60,0.1)",
                            color: "var(--brand-500)",
                            border: "1px solid rgba(27,120,60,0.3)",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "8px 16px",
                            cursor: "pointer",
                            fontFamily: "'Cairo', sans-serif",
                            transition: "background 0.2s, box-shadow 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(27,120,60,0.2)";
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(27,120,60,0.3)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(27,120,60,0.1)";
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                          }}
                        >
                          تفاصيل ←
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.section>
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
                background: "rgba(2,6,23,0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
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
                  background: "rgba(10,20,38,0.97)",
                  border: "1px solid rgba(27,120,60,0.2)",
                  borderRadius: 28,
                  width: "100%",
                  maxWidth: 500,
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxShadow: "0 48px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(27,120,60,0.08) inset",
                }}
              >
                {/* Modal header */}
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(27,120,60,0.18), rgba(27,120,60,0.08))",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    padding: "1.6rem",
                    borderRadius: "28px 28px 0 0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
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
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#94a3b8",
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
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
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
                        border: "1px solid rgba(255,255,255,0.06)",
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
                        background: "rgba(27,120,60,0.08)",
                        border: "1px solid rgba(27,120,60,0.22)",
                        borderRadius: 14,
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
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 14,
                        padding: "13px 16px",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>نوع الوحدة</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>
                        {TYPE_LABELS[selectedProperty.unit_type]}
                      </div>
                    </div>
                  </div>

                  {selectedProperty.description && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#94a3b8",
                        lineHeight: 1.9,
                        marginBottom: "1.4rem",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
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
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 2 }}>
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
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 12,
                            padding: "13px 16px",
                            fontSize: 14,
                            fontFamily: "'Cairo', sans-serif",
                            color: "#f8fafc",
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
                        background: "rgba(27,120,60,0.1)",
                        border: "1px solid rgba(27,120,60,0.3)",
                        borderRadius: 16,
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
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(27,120,60,0.18)",
              borderRadius: 28,
              padding: "3rem 2.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1.5rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: -80,
                top: -80,
                width: 280,
                height: 280,
                background: "radial-gradient(circle, rgba(27,120,60,0.12) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", marginBottom: 10 }}>
                أنت مالك عقار؟
              </h2>
              <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.75 }}>
                ارفع أول إعلانين مجاناً مع{" "}
                <strong style={{ color: "var(--brand-500)" }}>دَورلي</strong>{" "}
                وابدأ تستقبل عملاء من أول يوم
              </p>
            </div>
            <a
              href="/register"
              style={{
                background: "var(--brand-gradient-chat)",
                color: "#fff",
                borderRadius: 16,
                padding: "16px 40px",
                fontSize: 15,
                fontWeight: 900,
                textDecoration: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 0 0 1px rgba(27,120,60,0.4), 0 10px 36px rgba(27,120,60,0.4)",
                position: "relative",
                transition: "box-shadow 0.25s, transform 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  "0 0 0 1px rgba(27,120,60,0.6), 0 14px 44px rgba(27,120,60,0.6)";
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  "0 0 0 1px rgba(27,120,60,0.4), 0 10px 36px rgba(27,120,60,0.4)";
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
              }}
            >
              ابدأ مجاناً الآن ✦
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
            background: "rgba(2,6,23,0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-around",
            padding: "0.8rem 0 1.1rem",
            zIndex: 150,
          }}
        >
          {[
            { href: "/",         icon: "🏠", label: "الرئيسية" },
            { href: "/search",   icon: "🔍", label: "بحث"      },
            { href: "/register", icon: "➕", label: "إعلان"    },
            { href: "/login",    icon: "👤", label: "حسابي"    },
          ].map((item) => (
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
          ))}
        </nav>
        </div>

        <ChatBot
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