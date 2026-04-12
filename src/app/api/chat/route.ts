import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type Role = "user" | "assistant" | "system";
type Message = { role: Role; content: string };

type RequestBody = {
  messages: Message[];
};

type FilterAction = {
  type: "FILTER";
  unitType: string;
  area: string;
  maxPrice: number | null;
  keywords: string;
};

type PropertyResult = {
  id: number;
  title: string;
  price: number;
  area: string;
  address: string | null;
  unit_type: string;
  images: string[];
  slug?: string | null;
  /** ISO — تأكيد التوافر من الوسيط */
  last_verified_at?: string;
  report_count?: number;
};

type PropertyQueryRow = PropertyResult & {
  profiles?: { low_trust?: boolean | null } | { low_trust?: boolean | null }[] | null;
  owner_id?: string;
};

type ChatResponse = {
  message: string;
  action: FilterAction | null;
  results?: PropertyResult[];
  /** عروض من خارج المنطقة المختارة (يُعرض في قسم منفصل في الشات) */
  resultsOtherAreas?: PropertyResult[];
};

const AREA_ALIASES: Record<string, string> = {
  المنيا: "المنيا",
  مينيا: "المنيا",
  منيا: "المنيا",
  المنصورة: "المنصورة",
  القاهرة: "القاهرة",
  قاهرة: "القاهرة",
  اسكندرية: "الإسكندرية",
  اسكندريه: "الإسكندرية",
  الجيزة: "الجيزة",
  جيزة: "الجيزة",
  طنطا: "طنطا",
};

function normalizeArea(area: string): string {
  if (!area) return "";
  const clean = area.trim();
  return AREA_ALIASES[clean] ?? clean;
}

/** Commas break PostgREST `.or()` / logic tree — strip Arabic and English commas. */
function sanitizeSearchKeywords(raw: string): string {
  if (!raw) return "";
  return raw.replace(/[,،]/g, " ").replace(/\s+/g, " ").trim();
}

/** أحياء/مناطق شائعة تُعد ضمن نطاق المحافظة عندما يكون الفلتر اسم المحافظة */
const CAIRO_DISTRICT_RE =
  /مدينة نصر|مصر الجديدة|التجمع|المعادي|زمالك|شبرا|عين شمس|طرة|دار السلام|حدائق القبة|السيدة|المطرية|الزيتون|المرج|الوايلي|المقطم|بولاق|قصر النيل|الدرب الأحمر|الموسكي|الخليفة|المعصرة|التبين|15 مايو|السلام|النزهة|المنيل|الزاوية|العباسية|الشرابية|روض الفرج|الجمالية|باب الشعرية|الأزبكية/i;
const GIZA_DISTRICT_RE =
  /الهرم|فيصل|الدقي|المهندسين|العجوزة|العمرانية|الجيزة|الوراق|بشتيل|كرداسة|أوسيم|أكتوبر|اكتوبر|٦\s*أكتوبر|الشيخ زايد|زايد|حدائق الأهرام|المنيب|الكيت كات|ترسا|بين السرايات|المنصورية|صفط اللبن/i;
const ALEX_DISTRICT_RE =
  /إسكندرية|اسكندرية|سموحة|سيدي بشر|جليم|رشدي|لوران|ميامي|العصافرة|ستانلي|سيدي جابر|العجمي|برج العرب|المنتزه|الأنفوشي|الجمرك|محرم بك|العطارين|كرموز/i;

/** هل سطر المنطقة في العقار يُعتبر ضمن المحافظة/النطاق الذي اختاره المستخدم؟ */
function rowMatchesSelectedGovernorate(propArea: string, selectedRaw: string): boolean {
  const s = normalizeArea(selectedRaw).trim();
  if (!s) return true;
  const p = propArea.trim();
  if (!p) return false;
  const sn = normalizeArea(s);
  const pn = normalizeArea(p);
  if (pn === sn) return true;
  if (p.includes(s) || p.includes(sn)) return true;
  if (s.includes(p) && p.length >= 4) return true;
  if (sn === "القاهرة") {
    if (p.includes("القاهرة") || pn.includes("القاهرة")) return true;
    if (CAIRO_DISTRICT_RE.test(p) && !GIZA_DISTRICT_RE.test(p)) return true;
  }
  if (sn === "الجيزة") {
    if (p.includes("الجيزة") || GIZA_DISTRICT_RE.test(p)) return true;
  }
  if (sn === "الإسكندرية") {
    if (ALEX_DISTRICT_RE.test(p) || p.includes("الإسكندرية") || p.includes("اسكندرية")) return true;
  }
  return false;
}

function filterRowsByGovernorate(rows: PropertyResult[], selectedArea: string): PropertyResult[] {
  return rows.filter((r) => rowMatchesSelectedGovernorate(r.area ?? "", selectedArea));
}

const STALE_VERIFICATION_MS = 7 * 24 * 60 * 60 * 1000;

function isVerificationStale(iso: string | undefined): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > STALE_VERIFICATION_MS;
}

function anyStaleVerification(rows: PropertyResult[]): boolean {
  return rows.some((r) => isVerificationStale(r.last_verified_at));
}

/** تنبيه المستخدم عند عرض عقارات لم يُحدَّث تأكيد توافرها منذ أكثر من 7 أيام */
function appendStaleVerificationNote(
  message: string,
  primary: PropertyResult[],
  other: PropertyResult[] | undefined,
): string {
  const all = [...primary, ...(other ?? [])];
  if (!all.length || !anyStaleVerification(all)) return message;
  const note =
    "هذا الإعلان قديم نسبياً، سأقوم بالتأكد من توافره فور تواصلك مع المعلن.";
  return message.trim() ? `${message.trim()}\n\n${note}` : note;
}

function anyPriorUserReports(rows: PropertyResult[]): boolean {
  return rows.some(
    (r) =>
      typeof r.report_count === "number" && r.report_count > 0 && r.report_count < 3,
  );
}

function appendPriorReportsNote(
  message: string,
  primary: PropertyResult[],
  other: PropertyResult[] | undefined,
): string {
  const all = [...primary, ...(other ?? [])];
  if (!all.length || !anyPriorUserReports(all)) return message;
  const note =
    "ملاحظة: هناك إبلاغات سابقة عن عدم توافر هذا العقار، يرجى التأكد من المعلن";
  return message.trim() ? `${message.trim()}\n\n${note}` : note;
}

function profileLowTrust(row: PropertyQueryRow): boolean {
  const p = row.profiles;
  if (!p) return false;
  const o = Array.isArray(p) ? p[0] : p;
  return o?.low_trust === true;
}

function mapRowsForChat(rows: PropertyQueryRow[], limit: number): PropertyResult[] {
  const filtered = rows.filter((r) => !profileLowTrust(r)).slice(0, limit);
  return filtered.map(({ profiles: _pr, owner_id: _o, ...rest }) => rest);
}

/** استنتاج فلتر من آخر رسائل المستخدم عند تعطّل اتصال Groq (503) */
function inferFilterFromMessages(messages: Message[]): FilterAction | null {
  const blob = messages
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content)
    .join(" ");
  if (!blob.trim()) return null;

  const needleCanon: [string, string][] = [
    ["الشيخ زايد", "الشيخ زايد"],
    ["شبرا الخيمة", "شبرا الخيمة"],
    ["٦ أكتوبر", "أكتوبر"],
    ["6 أكتوبر", "أكتوبر"],
    ["الإسكندرية", "الإسكندرية"],
    ["إسكندرية", "الإسكندرية"],
    ["اسكندرية", "الإسكندرية"],
    ["القاهرة", "القاهرة"],
    ["القاهره", "القاهرة"],
    ["مصر الجديدة", "مصر الجديدة"],
    ["مدينة نصر", "مدينة نصر"],
    ["التجمع الخامس", "التجمع الخامس"],
    ["التجمع", "التجمع"],
    ["المعادي", "المعادي"],
    ["الجيزة", "الجيزة"],
    ["المنصورة", "المنصورة"],
    ["منصورة", "المنصورة"],
    ["المنيا", "المنيا"],
    ["مينيا", "المنيا"],
    ["منيا", "المنيا"],
    ["طنطا", "طنطا"],
    ["أسوان", "أسوان"],
    ["اسوان", "أسوان"],
    ["الأقصر", "الأقصر"],
    ["الغردقة", "الغردقة"],
    ["أكتوبر", "أكتوبر"],
    ["اكتوبر", "أكتوبر"],
    ["زايد", "الشيخ زايد"],
    ["قاهرة", "القاهرة"],
    ["جيزة", "الجيزة"],
  ];

  let area = "";
  for (const [needle, canon] of needleCanon) {
    if (blob.includes(needle)) {
      area = normalizeArea(canon);
      break;
    }
  }
  if (!area) {
    for (const k of Object.keys(AREA_ALIASES)) {
      if (blob.includes(k)) {
        area = normalizeArea(AREA_ALIASES[k] ?? k);
        break;
      }
    }
  }

  const priceMatch = blob.match(/(\d[\d,\s]{2,10})\s*(?:ج\.?\s*م|جنيه|ج\.م|EGP|egp|\bج\b)?/);
  let maxPrice: number | null = null;
  if (priceMatch) {
    const n = parseInt(priceMatch[1].replace(/[\s,]/g, ""), 10);
    if (Number.isFinite(n) && n >= 500 && n < 200_000_000) maxPrice = n;
  }

  let unitType = "";
  if (/سكن\s*طلاب|طلاب|طالبة/i.test(blob)) unitType = "student";
  else if (/عائلي|أسرة|عيلة|عايلة/i.test(blob)) unitType = "family";
  else if (/ستوديو/i.test(blob)) unitType = "studio";
  else if (/مشترك|أوضة\s*مشتركة|غرفة\s*مشتركة/i.test(blob)) unitType = "shared";
  else if (/موظف|موظفين/i.test(blob)) unitType = "employee";

  if (!area.trim() && maxPrice === null && !unitType) return null;

  const allowed = ["student", "family", "studio", "shared", "employee", ""];
  return {
    type: "FILTER",
    unitType: allowed.includes(unitType) ? unitType : "",
    area: area.trim(),
    maxPrice,
    keywords: "",
  };
}

/** مناطق مجاورة لـ Smart pivot (Upselling) عند صفر نتائج */
function neighborAreasFor(areaRaw: string): string[] {
  const a = areaRaw.trim();
  if (!a) return [];
  const rules: { test: RegExp; neighbors: string[] }[] = [
    { test: /تجمع|الرحاب|مدينتي/i, neighbors: ["مدينة نصر", "القاهرة", "مصر الجديدة"] },
    { test: /زايد|الشيخ زايد/i, neighbors: ["أكتوبر", "الجيزة", "الهرم"] },
    { test: /أكتوبر|اكتوبر|٦\s*أكتوبر/i, neighbors: ["الشيخ زايد", "الجيزة"] },
    { test: /دقي|المهندسين|العجوزة/i, neighbors: ["الجيزة", "القاهرة", "الهرم"] },
    { test: /منصورة|دقهلية/i, neighbors: ["طنطا", "الزقازيق", "المنيا"] },
    { test: /نصر/i, neighbors: ["التجمع", "مصر الجديدة", "القاهرة"] },
    { test: /معادي|زمالك/i, neighbors: ["القاهرة", "مدينة نصر"] },
    { test: /إسكندرية|اسكندرية/i, neighbors: ["الساحل الشمالي", "برج العرب"] },
  ];
  for (const { test, neighbors } of rules) {
    if (test.test(a)) return neighbors;
  }
  return [];
}

function lastUserUtterances(messages: Message[], n: number): string {
  const users = messages.filter((m) => m.role === "user").slice(-n);
  if (!users.length) return "(لا يوجد)";
  return users.map((m, i) => `${i + 1}) ${m.content.replace(/\s+/g, " ").trim()}`).join("\n");
}

/** تعليمات المساعد — شخصية دَورلي + تنسيق JSON للفلترة وSupabase */
function buildSystemPrompt(recentUserBlock: string): string {
  return `أنت خبير عقاري في منصة دَورلي، تساعد المستخدمين في العثور على أفضل العقارات في مصر بناءً على البيانات المتوفرة في قاعدة بياناتنا فقط. ردك يجب أن يكون باللهجة المصرية المهذبة والمحترفة.

## آخر ما ذكره المستخدم (آخر 5 رسائل user)
${recentUserBlock}

## قواعد البيانات والسلوك
- لا تذكر عقارات أو أسعاراً من خارج منصة دَورلي؛ النظام يجلب النتائج من قاعدة البيانات حسب الفلتر الذي تُخرجه.
- لأي استفسار عن عروض، بحث، منطقة، ميزانية، أو نوع وحدة: أرجع دائماً \`action\` من نوع \`FILTER\` (ما لم يكن آخر الرسائل تحية أو موضوعاً لا علاقة له بالعقار → \`action: null\`).
- **keywords**: بدون فواصل \`,\` أو \`،\` (استبدلها بمسافات).
- كن لطيفاً ومهنياً؛ اقترح منطقة أو ميزانية عند الغموض بدل الجفاف.
- **بياع شاطر**: لو الميزانية محددة ومفيش عروض مناسبة في النتائج (أو المتوقع ضعيف)، ما تقولش جمل عامة زي «جاري البحث» أو «Searching…» — قدّم في **message** اقتراحات واضحة: زيادة الميزانية شوية بشكل معقول، أو التفكير في مناطق مجاورة بنفس السعر، بلهجة مصرية مهذبة ومقنعة.

## مخرجاتك (JSON فقط — بلا Markdown أو code fences)
{
  "message": "نص للمستخدم",
  "action": { "type": "FILTER", "unitType": "" | "student"|"family"|"studio"|"shared"|"employee", "area": "", "maxPrice": null أو رقم بالجنيه الشهري, "keywords": "" }
}

مثال: إذا سأل عن «إيه العقارات المتاحة» بدون تفاصيل، اجعل message ترحيباً مختصراً وaction FILTER بحقول فارغة أو null حيث يناسب ليعرض النظام عينة من العقارات المتاحة.`;
}

const SELECT_ROW =
  "id, title, price, area, address, unit_type, images, slug, last_verified_at, report_count, owner_id, profiles(low_trust)";

async function queryTopProperties(
  filters: FilterAction,
  limit = 3,
): Promise<PropertyResult[]> {
  const supabase = getSupabaseServerClient();

  let q = supabase
    .from("properties")
    .select(SELECT_ROW)
    .eq("status", "active")
    .eq("availability_status", "available")
    .order("last_verified_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.area?.trim()) q = q.ilike("area", `%${filters.area.trim()}%`);
  if (filters.unitType) q = q.eq("unit_type", filters.unitType);
  if (typeof filters.maxPrice === "number") q = q.lte("price", filters.maxPrice);

  const safeKw = sanitizeSearchKeywords(filters.keywords?.trim() ?? "");
  if (safeKw.length >= 2) {
    q = q.or(`title.ilike.%${safeKw}%,address.ilike.%${safeKw}%`);
  }

  const fetchCap = Math.max(limit * 4, 16);
  const { data, error } = await q.limit(fetchCap);
  if (error) throw error;
  return mapRowsForChat((data as PropertyQueryRow[]) ?? [], limit);
}

async function queryFallback(filters: FilterAction): Promise<PropertyResult[]> {
  const relaxed: FilterAction = {
    ...filters,
    keywords: "",
    maxPrice:
      typeof filters.maxPrice === "number"
        ? Math.round(filters.maxPrice * 1.25)
        : null,
  };
  return queryTopProperties(relaxed, 5);
}

/** تحليل سوقي خفيف يُشغَّل بالتوازي مع البحث (analyze_market_trends مبسّط على بيانات المنصة) */
async function analyzeMarketTrends(filters: FilterAction): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    let q = supabase
      .from("properties")
      .select("price")
      .eq("status", "active")
      .eq("availability_status", "available");
    if (filters.area?.trim()) {
      q = q.ilike("area", `%${filters.area.trim()}%`);
    }
    const { data, error } = await q.limit(120);
    if (error || !data?.length) return null;
    const prices = data
      .map((r) => Number((r as { price: number }).price))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (prices.length < 4) return null;
    prices.sort((a, b) => a - b);
    const low = prices[0];
    const hi = prices[prices.length - 1];
    const mid = prices[Math.floor(prices.length / 2)];
    const where = filters.area?.trim()
      ? `في نطاق ${filters.area.trim()}`
      : "على المنصة";
    return `📊 لمحة سوق ${where}: الإعلانات النشطة غالباً بين حوالي ${Math.round(low).toLocaleString("ar-EG")} و ${Math.round(hi).toLocaleString("ar-EG")} ج.م/شهر (وسطياً ~${Math.round(mid).toLocaleString("ar-EG")}). دي إشارة من إعلانات دَورلي مش تسعير رسمي.`;
  } catch {
    return null;
  }
}

type PivotKind = "none" | "budget_plus_10" | "neighbor" | "budget_plus_25" | "explore";

const SLIDER_LIMIT = 3;
const takeSlider = (rows: PropertyResult[]) => rows.slice(0, SLIDER_LIMIT);

/** بحث بدون التزام محافظة: السلوك السابق (جيران، سقف أوسع، استكشاف). */
async function searchPropertiesWithFallbackLegacy(
  filters: FilterAction,
): Promise<{
  results: PropertyResult[];
  resultsOtherAreas: PropertyResult[];
  pivot: PivotKind;
  neighborUsed?: string;
  marketNote: string | null;
}> {
  const [primary, marketNote] = await Promise.all([
    queryTopProperties(filters, 6),
    analyzeMarketTrends(filters),
  ]);

  if (primary.length > 0) {
    return {
      results: takeSlider(primary),
      resultsOtherAreas: [],
      pivot: "none",
      marketNote,
    };
  }

  if (typeof filters.maxPrice === "number" && filters.maxPrice > 0) {
    const wider10 = await queryTopProperties(
      {
        ...filters,
        maxPrice: Math.round(filters.maxPrice * 1.1),
      },
      6,
    );
    if (wider10.length > 0) {
      return {
        results: takeSlider(wider10),
        resultsOtherAreas: [],
        pivot: "budget_plus_10",
        marketNote,
      };
    }
  }

  const nbs = neighborAreasFor(filters.area || "");
  for (const nb of nbs) {
    const alt = await queryTopProperties({ ...filters, area: nb }, 6);
    if (alt.length > 0) {
      return {
        results: takeSlider(alt),
        resultsOtherAreas: [],
        pivot: "neighbor",
        neighborUsed: nb,
        marketNote,
      };
    }
  }

  const fallback25 = await queryFallback(filters);
  if (fallback25.length > 0) {
    return {
      results: takeSlider(fallback25),
      resultsOtherAreas: [],
      pivot: "budget_plus_25",
      marketNote,
    };
  }

  const exploratory = await queryExploratorySuggestions(filters);
  if (exploratory.length > 0) {
    return {
      results: takeSlider(exploratory),
      resultsOtherAreas: [],
      pivot: "explore",
      marketNote,
    };
  }

  return { results: [], resultsOtherAreas: [], pivot: "none", marketNote };
}

/** عروض من خارج المحافظة المختارة (نفس نوع/سقف تقريبي، بدون فرض area في الاستعلام ثم استبعاد ما يطابق المحافظة). */
async function querySuggestionsOutsideGovernorate(
  filters: FilterAction,
  excludeGovernorate: string,
): Promise<PropertyResult[]> {
  const ex = normalizeArea(excludeGovernorate).trim();
  const relaxed: FilterAction = {
    ...filters,
    area: "",
    keywords: "",
    maxPrice:
      typeof filters.maxPrice === "number"
        ? Math.round(filters.maxPrice * 1.25)
        : null,
  };
  const raw = await queryTopProperties(relaxed, 36);
  let outside = raw.filter((r) => !rowMatchesSelectedGovernorate(r.area ?? "", ex));
  if (outside.length > 0) return outside;

  const exploratory = await queryExploratorySuggestions({ ...filters, area: "", keywords: "" });
  outside = exploratory.filter((r) => !rowMatchesSelectedGovernorate(r.area ?? "", ex));
  return outside;
}

/**
 * عند تحديد منطقة/محافظة: الكروت الرئيسية من نفس المحافظة فقط (بعد تصفية صارمة).
 * لا تُعرض فيها نتائج من محافظة أخرى. إن لم يوجد شيء داخل المحافظة، تُملأ resultsOtherAreas.
 */
async function searchPropertiesWithStrictGovernorate(
  filters: FilterAction,
): Promise<{
  results: PropertyResult[];
  resultsOtherAreas: PropertyResult[];
  pivot: PivotKind;
  neighborUsed?: string;
  marketNote: string | null;
}> {
  const area = filters.area!.trim();
  const marketNote = await analyzeMarketTrends(filters);
  let pivot: PivotKind = "none";

  async function collectInGovernorate(f: FilterAction): Promise<PropertyResult[]> {
    const raw = await queryTopProperties(f, 28);
    return filterRowsByGovernorate(raw, area);
  }

  let inGov = await collectInGovernorate(filters);
  if (inGov.length === 0 && typeof filters.maxPrice === "number" && filters.maxPrice > 0) {
    inGov = await collectInGovernorate({
      ...filters,
      maxPrice: Math.round(filters.maxPrice * 1.1),
    });
    if (inGov.length) pivot = "budget_plus_10";
  }
  if (inGov.length === 0 && typeof filters.maxPrice === "number" && filters.maxPrice > 0) {
    inGov = await collectInGovernorate({
      ...filters,
      maxPrice: Math.round(filters.maxPrice * 1.25),
    });
    if (inGov.length) pivot = "budget_plus_25";
  }

  if (inGov.length > 0) {
    return {
      results: takeSlider(inGov),
      resultsOtherAreas: [],
      pivot,
      marketNote,
    };
  }

  const other = await querySuggestionsOutsideGovernorate(filters, area);
  return {
    results: [],
    resultsOtherAreas: takeSlider(other),
    pivot: "none",
    marketNote,
  };
}

async function searchPropertiesWithFallback(
  filters: FilterAction,
): Promise<{
  results: PropertyResult[];
  resultsOtherAreas: PropertyResult[];
  pivot: PivotKind;
  neighborUsed?: string;
  marketNote: string | null;
}> {
  if (filters.area?.trim()) {
    return searchPropertiesWithStrictGovernorate(filters);
  }
  return searchPropertiesWithFallbackLegacy(filters);
}

function composeConsultantMessage(
  aiMessage: string,
  filters: FilterAction,
  pivot: PivotKind,
  neighborUsed: string | undefined,
  marketNote: string | null,
  hasStrictResults: boolean,
  hasOtherAreaResults: boolean,
): string {
  const blocks: string[] = [];
  const area = filters.area?.trim() || "المنطقة";
  const trimmed = aiMessage?.trim();

  if (filters.area?.trim() && hasOtherAreaResults && !hasStrictResults) {
    blocks.push(
      `ملقتش شقق بالسعر ده في ${area} حالياً، بس دي اختيارات في محافظات تانية ممكن تناسب ميزانيتك`,
    );
    if (marketNote) blocks.push(marketNote);
    return blocks.join("\n\n").trim();
  }

  if (!hasStrictResults && !hasOtherAreaResults) {
    blocks.push(trimmed || encouragingCopy(filters, false));
    if (marketNote) blocks.push(marketNote);
    return blocks.join("\n\n").trim();
  }

  if (pivot === "budget_plus_10") {
    blocks.push(
      `يا بطل، السقف في ${area} كان ضيّق شوية — وسّعتلك البحث تلقائياً بحوالي 10% ولقيت لقطات قريبة من طلبك. شوف الكروت تحت 👇`,
    );
  } else if (pivot === "neighbor" && neighborUsed) {
    blocks.push(
      `الميزانية دي في ${area} حالياً صعبة شوية — جبتلك لقطات في ${neighborUsed} قريبة من نفس روح طلبك. تحب تشوفها؟ 👇`,
    );
  } else if (pivot === "budget_plus_25") {
    blocks.push(
      `وسّعتلك نطاق السعر شوية عشان يبان خيارات أوضح — راجع الكروت ونظبط سوا على المفتاح.`,
    );
  } else if (pivot === "explore") {
    blocks.push(
      `جهزت لك بدائل بنفس النفسية (سكن طلاب/مشترك/سقف أوسع شوية) — اختار اللي يقرب ليك.`,
    );
  }

  if (trimmed) blocks.push(trimmed);
  if (marketNote) blocks.push(marketNote);

  const joined = blocks.join("\n\n").trim();
  if (joined) return joined;
  return encouragingCopy(filters, true);
}

async function buildFilterResponse(
  filters: FilterAction,
  aiMessage: string,
  degradedPrefix?: string,
): Promise<NextResponse> {
  try {
    const { results, resultsOtherAreas, pivot, neighborUsed, marketNote } =
      await searchPropertiesWithFallback(filters);

    let message = composeConsultantMessage(
      aiMessage,
      filters,
      pivot,
      neighborUsed,
      marketNote,
      results.length > 0,
      (resultsOtherAreas?.length ?? 0) > 0,
    );
    if (degradedPrefix) {
      message = `${degradedPrefix}\n\n${message}`;
    }

    message = appendStaleVerificationNote(message, results, resultsOtherAreas);
    message = appendPriorReportsNote(message, results, resultsOtherAreas);

    return NextResponse.json({
      message,
      action: filters,
      ...(results.length ? { results } : {}),
      ...(resultsOtherAreas?.length ? { resultsOtherAreas } : {}),
    } satisfies ChatResponse);
  } catch {
    const fallbackMsg = degradedPrefix
      ? `${degradedPrefix}\n\nمش قدرنا نكمّل البحث دلوقتي — جرّب تاني بعد لحظة.`
      : "حصل تعارض مؤقت مع البحث. جرّب تاني بعد لحظة.";
    return NextResponse.json({
      message: fallbackMsg,
      action: filters,
    } satisfies ChatResponse);
  }
}

/** عروض أرخص / أوسع عند ضيق النتائج */
async function queryExploratorySuggestions(filters: FilterAction): Promise<PropertyResult[]> {
  const supabase = getSupabaseServerClient();
  let q = supabase
    .from("properties")
    .select(SELECT_ROW)
    .eq("status", "active")
    .eq("availability_status", "available")
    .order("last_verified_at", { ascending: false })
    .order("price", { ascending: true });

  if (filters.area?.trim()) q = q.ilike("area", `%${filters.area.trim()}%`);
  const maxP = filters.maxPrice;
  const explicitUnitType = filters.unitType?.trim() ?? "";
  if (typeof maxP === "number" && maxP < 2200) {
    q = q.lte("price", Math.max(maxP * 2, 2800));
    // بدون نوع محدد: نوسّع نحو أنواع غالباً أرخص. مع نوع صريح (عائلي، ستوديو، …): نحترمه ولا نستبدله بصمت.
    if (!explicitUnitType) {
      q = q.in("unit_type", ["shared", "student"]);
    } else {
      q = q.eq("unit_type", explicitUnitType);
    }
  } else if (typeof maxP === "number") {
    q = q.lte("price", Math.round(maxP * 1.6));
  }

  const { data, error } = await q.limit(24);
  if (error) throw error;
  return mapRowsForChat((data as PropertyQueryRow[]) ?? [], 5);
}

function encouragingCopy(filters: FilterAction, hasAlts: boolean): string {
  const mp = filters.maxPrice;
  if (typeof mp === "number" && mp < 2000) {
    return hasAlts
      ? "يا بطل، الميزانية دي تحت ضغط السوق شوية — تحت شوية خيارات قريبة من فكرتك (أوضة مشتركة / سكن طلاب). شوف الكروت ولو حابب نوسّع المنطقة أو الميزانية قولّي."
      : "يا بطل، السوق النهاردة صعب يطلع حاجة مريحة تحت الميزانية دي بسهولة. جرّب نفكر في أوضة مشتركة، أو منطقة لُزمة للجامعة، أو نرفع الميزانية شوية — وأنا معاك خطوة بخطوة.";
  }
  return hasAlts
    ? "يا فندم، للمواصفات الدقيقة اختيار محدود، لكن جهزت لحضرتك بدائل قريبة من نفس الاتجاه — راجع الكروت ونظبط الفلتر سوا."
    : "يا فندم، السوق في النطاق ده بيتحرك بسرعة. لو تحب نوسّع المساحة الجغرافية أو نعدّل السقف المالي بلطف، هنلاقي خيارات أقوى.";
}

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const MAX_HISTORY_MESSAGES = 28;

const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_FETCH_ATTEMPTS = 3;

const DEGRADED_AI_PREFIX =
  "مساعد الذكاء متاحش دلوقتي بسبب تعطّل في الشبكة — ده بحث أولي من كلامك. جرّب ترسل تاني بعد لحظة، وقولّي الميزانية بالأرقام عشان نضبطها.";

async function fetchOpenAiChatCompletion(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < OPENAI_FETCH_ATTEMPTS; attempt++) {
    try {
      return await fetch(OPENAI_CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastErr = e;
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[api/chat] OpenAI fetch failed (attempt ${attempt + 1}/${OPENAI_FETCH_ATTEMPTS}):`,
          e,
        );
      }
      if (attempt < OPENAI_FETCH_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

export async function POST(req: NextRequest) {
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  const openaiModel =
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_OPENAI_MODEL;

  if (!openaiApiKey) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[api/chat] OPENAI_API_KEY is missing or empty. Add OPENAI_API_KEY to .env.local (local) or Vercel → Environment Variables, then restart the dev server.",
      );
    }
    return NextResponse.json(
      {
        message:
          "إعدادات الخادم ناقصة: لم يُضبط مفتاح OpenAI (OPENAI_API_KEY). أضِف المفتاح في .env.local ثم أعد تشغيل الخادم.",
        action: null,
      } satisfies ChatResponse,
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "طلب غير صحيح.", action: null } satisfies ChatResponse,
      { status: 400 },
    );
  }

  const { messages = [] } = body;
  if (!messages.length) {
    return NextResponse.json(
      { message: "مفيش رسايل.", action: null } satisfies ChatResponse,
      { status: 400 },
    );
  }

  const history = messages.slice(-MAX_HISTORY_MESSAGES);
  const systemPrompt = buildSystemPrompt(lastUserUtterances(history, 5));

  let openaiRes: Response;
  try {
    openaiRes = await fetchOpenAiChatCompletion(openaiApiKey, {
      model: openaiModel,
      max_tokens: 640,
      temperature: 0.32,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, ...history],
    });
  } catch {
    const guessed = inferFilterFromMessages(history);
    if (guessed) {
      return buildFilterResponse(guessed, "", DEGRADED_AI_PREFIX);
    }
    return NextResponse.json(
      { message: "مش قادر أوصل للسيرفر.", action: null } satisfies ChatResponse,
      { status: 503 },
    );
  }

  const openaiBodyText = await openaiRes.text();
  type OpenAiOk = {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  let openaiPayload: OpenAiOk;
  try {
    openaiPayload = JSON.parse(openaiBodyText) as OpenAiOk;
  } catch {
    return NextResponse.json(
      { message: "رد غير متوقع من مزود الذكاء.", action: null } satisfies ChatResponse,
      { status: 502 },
    );
  }

  if (!openaiRes.ok) {
    const detail = openaiPayload.error?.message?.trim() ?? "";
    return NextResponse.json(
      {
        message: detail
          ? `خطأ من OpenAI: ${detail}`
          : "في مشكلة مؤقتة. جرب تاني.",
        action: null,
      } satisfies ChatResponse,
      { status: 502 },
    );
  }

  const rawContent = openaiPayload.choices?.[0]?.message?.content ?? "";

  let parsed: ChatResponse = {
    message: "معلش، مش قادر أساعدك دلوقتي.",
    action: null,
  };

  try {
    const clean = rawContent
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    /* keep default */
  }

  if (parsed.action && typeof parsed.action === "object") {
    const a = parsed.action as Record<string, unknown>;
    const unitType = typeof a.unitType === "string" ? a.unitType : "";
    const area = typeof a.area === "string" ? normalizeArea(a.area) : "";
    const maxPrice = typeof a.maxPrice === "number" ? a.maxPrice : null;
    const keywords = sanitizeSearchKeywords(
      typeof a.keywords === "string" ? a.keywords : "",
    );

    const filters: FilterAction = {
      type: "FILTER",
      unitType: ["student", "family", "studio", "shared", "employee", ""].includes(
        unitType,
      )
        ? unitType
        : "",
      area,
      maxPrice,
      keywords,
    };

    return buildFilterResponse(filters, parsed.message);
  }

  return NextResponse.json(parsed satisfies ChatResponse);
}
