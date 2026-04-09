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

/** تعليمات Dowrly AI — استشاري عقاري (مصر) */
function buildSystemPrompt(recentUserBlock: string): string {
  return `أنت **Dowrly AI** — أقوى استراتيجي عقاري رقمي في مصر. أنت لا "تبحث" فقط؛ أنت **تستشير** وتقود المحادثة بحكمة.

## عقلية المستشار
- **ممنوع حلقات التأكيد المملة**: إذا عندك منطقة + ميزانية (أو نوع واضح) من السياق — **نفّذ فوراً** في action (FILTER) ولا تسأل "متأكد؟" مرة تانية.
- إذا المستخدم **مبهم** (مثل "عايز شقة" بدون تفاصيل): **لا** تسأل "فين؟" فقط. قدّم **خيارات توجيهية** في message، مثل:
  "تحب حاجة قريبة من المترو في الدقي، ولا هدوء التجمع؟" أو "نمشي على ميزانية محددة الأول ولا المنطقة؟"
- **ذاكرة السياق**: آخر ما ذكره المستخدم (انظر الأسفل). إذا غيّر رأيه (مثلاً من زايد لأكتوبر)، **اعترف صراحة** في message: "تمام، نقلنا الدفّة لأكتوبر… خليني أشوفلك الأنسب هناك."

## آخر ذكرات المستخدم (آخر 5 رسائل user — التزم بها)
${recentUserBlock}

## ذكاء مالي (سوق مصري)
- لو الميزانية **غير واقعية** للمنطقة أو النوع (مثلاً شقة عائلي في التجمع بسعر يبدو "حلم"):
  في message حذّر بلطف دون إهانة، مثل: "يا بطل السعر ده في المكان ده قليل جداً — خد بالك، غالباً يكون **مقدم** مش إيجار كامل، أو إعلان مش دقيق. نمشي على سقف أوضح عشان نلاقي لقطة حقيقية؟"
- فسّر الفرق بين مقدم وشهري عند الحاجة بجملة واحدة.

## صفر نتائج (Pivot / Smart Upselling)
- **ممنوع** تقول "ملقتش حاجة" أو "مفيش نتائج" بشكل جاف.
- عندما يكون للمستخدم **منطقة/محافظة محددة** في الفلتر: النظام يعرض **عروضاً من نفس المحافظة فقط** في الكروت الرئيسية؛ إن لم يوجد، يضع **بدائل من محافظات أخرى في قسم منفصل** ويُثبت نصاً جاهزاً من الخادم — لا تتعارض مع ذلك في message (يمكنك إضافة جملة قصيرة فقط عن الميزانية أو السوق).
- بدون منطقة محددة: اعرض **بديل مجاور أو ميزانية مرنة** بأسلوب استشاري كالسابق.

## تنفيذ متوازٍ (مفهومياً)
- أنت تُخرج فلترة دقيقة؛ النظام يشغّل **بحث العقارات** و**لمحة سوقية** معاً. اكتب message كأنك اطلعت على السياقين (طلب المستخدم + واقع السوق).

## النبرة
- مشجّع واحترافي. مصرية معتدلة: **يا بطل، لقطة، على المفتاح، نظبط، دفّة** — بدون مبالغة أو لغة غير لائقة.
- "يا فندم" للنبرة الرسمية عند طلب عائلي/استثمار واضح.

## استخراج JSON (إلزامي)
- أجب **JSON فقط** بدون Markdown أو code fences.
- تحية/شكر/سؤال عام بدون بحث → action = null.
- طلب بحث أو تعديل فلتر → action.type = "FILTER":
  - unitType: student | family | studio | shared | employee | ""
  - area: عربي أو "" (لا تخمّن منطقة لم تُذكر في السياق)
  - maxPrice: رقم بالجنيه الشهري أو null
  - keywords: إضافي

صيغة JSON:
{
  "message": "نص للمستخدم",
  "action": { "type": "FILTER", "unitType": "", "area": "", "maxPrice": null, "keywords": "" }
}`;
}

const SELECT_ROW =
  "id, title, price, area, address, unit_type, images";

async function queryTopProperties(
  filters: FilterAction,
  limit = 3,
): Promise<PropertyResult[]> {
  const supabase = getSupabaseServerClient();

  let q = supabase
    .from("properties")
    .select(SELECT_ROW)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (filters.area?.trim()) q = q.ilike("area", `%${filters.area.trim()}%`);
  if (filters.unitType) q = q.eq("unit_type", filters.unitType);
  if (typeof filters.maxPrice === "number") q = q.lte("price", filters.maxPrice);

  const kw = filters.keywords?.trim();
  if (kw && kw.length >= 2) {
    q = q.or(`title.ilike.%${kw}%,address.ilike.%${kw}%`);
  }

  const { data, error } = await q.limit(limit);
  if (error) throw error;
  return (data as PropertyResult[]) ?? [];
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
    let q = supabase.from("properties").select("price").eq("status", "active");
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

  const { data, error } = await q.limit(5);
  if (error) throw error;
  return (data as PropertyResult[]) ?? [];
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

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const MAX_HISTORY_MESSAGES = 28;

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_FETCH_ATTEMPTS = 3;

const DEGRADED_GROQ_PREFIX =
  "مساعد الذكاء متاحش دلوقتي بسبب تعطّل في الشبكة — ده بحث أولي من كلامك. جرّب ترسل تاني بعد لحظة، وقولّي الميزانية بالأرقام عشان نضبطها.";

async function fetchGroqChatCompletion(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < GROQ_FETCH_ATTEMPTS; attempt++) {
    try {
      return await fetch(GROQ_ENDPOINT, {
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
          `[api/chat] Groq fetch failed (attempt ${attempt + 1}/${GROQ_FETCH_ATTEMPTS}):`,
          e,
        );
      }
      if (attempt < GROQ_FETCH_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

export async function POST(req: NextRequest) {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  const groqModel =
    process.env.GROQ_MODEL?.trim() ||
    process.env.GROQ_CHAT_MODEL?.trim() ||
    DEFAULT_GROQ_MODEL;

  if (!groqApiKey) {
    return NextResponse.json(
      { message: "خطأ في الإعدادات.", action: null } satisfies ChatResponse,
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

  let groqRes: Response;
  try {
    groqRes = await fetchGroqChatCompletion(groqApiKey, {
      model: groqModel,
      max_tokens: 640,
      temperature: 0.32,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, ...history],
    });
  } catch {
    const guessed = inferFilterFromMessages(history);
    if (guessed) {
      return buildFilterResponse(guessed, "", DEGRADED_GROQ_PREFIX);
    }
    return NextResponse.json(
      { message: "مش قادر أوصل للسيرفر.", action: null } satisfies ChatResponse,
      { status: 503 },
    );
  }

  const groqBodyText = await groqRes.text();
  type GroqOk = {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  let groqPayload: GroqOk;
  try {
    groqPayload = JSON.parse(groqBodyText) as GroqOk;
  } catch {
    return NextResponse.json(
      { message: "رد غير متوقع من مزود الذكاء.", action: null } satisfies ChatResponse,
      { status: 502 },
    );
  }

  if (!groqRes.ok) {
    const detail = groqPayload.error?.message?.trim() ?? "";
    return NextResponse.json(
      {
        message: detail
          ? `خطأ من مزود الذكاء: ${detail}`
          : "في مشكلة مؤقتة. جرب تاني.",
        action: null,
      } satisfies ChatResponse,
      { status: 502 },
    );
  }

  const rawContent = groqPayload.choices?.[0]?.message?.content ?? "";

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
    const keywords = typeof a.keywords === "string" ? a.keywords : "";

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
