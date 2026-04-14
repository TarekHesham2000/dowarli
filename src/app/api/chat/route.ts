import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  governorateForDistrict,
  matchDistrictInText,
  neighborDistrictsInSameGovernorate,
} from "@/lib/locationHierarchy";

type Role = "user" | "assistant" | "system";
type Message = { role: Role; content: string };

type RequestBody = {
  messages: Message[];
  /** When set (and validated against DB), property search + system prompt are scoped to this agency */
  agency_id?: string | null;
};

type AgencyChatScope = { id: string; name: string };

function parseAgencyIdParam(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    )
  ) {
    return null;
  }
  return s;
}

type ListingPurposeFilter = "" | "rent" | "sale";

/** band = نطاق 0.8–1.25 حول الميزانية | higher = سعر >= minPrice (طلب أسعار أعلى) */
type PriceSearchMode = "band" | "higher";

type FilterAction = {
  type: "FILTER";
  unitType: string;
  /** محافظة (القاهرة، الجيزة، …) */
  governorate: string;
  /** حي أو كومباوند محدد — أولوية البحث عند ذكر المستخدم لمنطقة */
  district: string;
  /** فلتر قديم / موسع عندما لا تُحدَّد محافظة+حي صراحة */
  area: string;
  /** مرجع ميزانية المستخدم (وسط النطاق في وضع band) */
  maxPrice: number | null;
  /** أرضية السعر عند وضع higher أو حدود دنيا إضافية */
  minPrice: number | null;
  priceSearchMode: PriceSearchMode;
  keywords: string;
  /** إيجار أو بيع — يُستنتج من السياق لو المستخدم ذكر رقم شهري في منطقة راقية */
  listingPurpose: ListingPurposeFilter;
};

type PropertyResult = {
  id: number;
  title: string;
  price: number;
  listing_purpose?: string | null;
  area: string;
  governorate?: string | null;
  district?: string | null;
  landmark?: string | null;
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

function inferListingPurposeFromUserBlob(blob: string): ListingPurposeFilter {
  const b = blob.trim();
  if (!b) return "";
  if (/بيع|للبيع|اشتري|شراء|تمليك|عايز\s*أشتري|عاوز\s*أشتري|كاش\s*بيع/i.test(b))
    return "sale";
  if (/إيجار|ايجار|للإيجار|كراء|مستأجر|أجر|إيجاري|مؤجر/i.test(b)) return "rent";
  const dm = matchDistrictInText(b);
  const m = b.match(/(\d[\d,\s]{3,9})\s*(?:ج\.?\s*م|جنيه|ج\.م|EGP|egp|\bج\b)?/i);
  if (m) {
    const n = parseInt(m[1].replace(/[\s,]/g, ""), 10);
    if (dm && n >= 2_000 && n <= 150_000) return "rent";
  }
  return "";
}

/** يبقى آخر rent/sale صريح من المستخدم عبر المحادثة ما لم يغيّر الـ AI صراحة. */
function resolvePersistedListingPurpose(
  messages: Message[],
  fromAi: string | undefined,
): ListingPurposeFilter {
  let persisted: ListingPurposeFilter = "";
  for (const m of messages) {
    if (m.role !== "user") continue;
    const x = inferListingPurposeFromUserBlob(m.content);
    if (x) persisted = x;
  }
  const ai = fromAi?.trim().toLowerCase();
  if (ai === "sale" || ai === "rent") return ai;
  return persisted;
}

const CHAT_PRICE_CEILING = 80_000_000;

function extractPricesFromText(text: string): number[] {
  const out: number[] = [];
  const re = /(\d[\d,\s]{2,10})\s*(?:ج\.?\s*م|جنيه|ج\.م|EGP|egp|\bج\b)?/gi;
  let m: RegExpExecArray | null;
  const s = text.replace(/[,،]/g, "");
  while ((m = re.exec(s)) !== null) {
    const n = parseInt(m[1].replace(/\s/g, ""), 10);
    if (Number.isFinite(n) && n >= 500 && n < 200_000_000) out.push(n);
  }
  return out;
}

function lastBudgetBeforeLatestUserMessage(messages: Message[]): number | null {
  const users = messages.filter((m) => m.role === "user");
  if (users.length < 2) return null;
  const blob = users
    .slice(0, -1)
    .map((m) => m.content)
    .join(" ");
  const xs = extractPricesFromText(blob);
  return xs.length ? xs[xs.length - 1] : null;
}

function detectHigherPriceIntent(blob: string): boolean {
  return /عايز\s*أغلى|عاوز\s*أغلى|أسعار\s*أعلى|سعر\s*أعلى|أغلى\s*شوية|أعلى\s*شوية|زود\s*السقف|علّي\s*السقف|اعلى\s*من\s*كده|أعلى\s*من\s*كده|فئة\s*سعرية\s*أعلى|أغلى\s*من/i.test(
    blob.trim(),
  );
}

function detectLowerPriceIntent(blob: string): boolean {
  return /أرخص|ارخص|أقل\s*سعر|اقل\s*سعر|ميزانية\s*أقل|سقف\s*أقل/i.test(blob.trim());
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

function locationMatchBlob(row: PropertyResult): string {
  return [row.governorate, row.district, row.area, row.landmark]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function rowMatchesSelectedLocation(row: PropertyResult, selectedRaw: string): boolean {
  const sel = selectedRaw.trim();
  if (!sel) return true;
  const blob = locationMatchBlob(row);
  if (!blob) return rowMatchesSelectedGovernorate(row.area ?? "", selectedRaw);
  if (blob.includes(sel)) return true;
  const ns = normalizeArea(sel);
  if (ns && blob.includes(ns)) return true;
  return rowMatchesSelectedGovernorate(row.area ?? "", selectedRaw);
}

function filterRowsByLocationFocus(
  rows: PropertyResult[],
  selected: string,
): PropertyResult[] {
  return rows.filter((r) => rowMatchesSelectedLocation(r, selected));
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

function rowsToMappedResults(rows: PropertyQueryRow[]): PropertyResult[] {
  return rows
    .filter((r) => !profileLowTrust(r))
    .map(({ profiles: _pr, owner_id: _o, ...rest }) => rest);
}

/** إعلانات بسعر منخفض جداً مقارنة بميزانية إيجار في منطقة راقية — غالباً ضوضاء/تجربة */
function isSuspiciouslyLowVsBudget(r: PropertyResult, filters: FilterAction): boolean {
  const anchor =
    filters.priceSearchMode === "higher"
      ? typeof filters.minPrice === "number"
        ? filters.minPrice
        : null
      : typeof filters.maxPrice === "number"
        ? filters.maxPrice
        : null;
  if (anchor == null || anchor < 6000) return false;
  if (filters.listingPurpose !== "rent") return false;
  const blob = locationMatchBlob(r);
  if (
    !/(تجمع|زايد|نصر|معادي|مقطم|مستقبل|مدينتي|شروق|العاصمة|رحاب|نيو\s*كايرو)/i.test(
      blob,
    )
  )
    return false;
  const ref =
    filters.priceSearchMode === "band" ? Math.max(anchor * 0.8, 1) : anchor;
  if (r.price >= ref * 0.55) return false;
  if (r.price >= 5500) return false;
  return true;
}

/** صلة بالميزانية أولاً، ثم السعر، ثم حداثة التأكيد */
function rankChatPropertyRows(rows: PropertyResult[], filters: FilterAction): PropertyResult[] {
  return [...rows].sort((a, b) => {
    const sa = isSuspiciouslyLowVsBudget(a, filters) ? 1 : 0;
    const sb = isSuspiciouslyLowVsBudget(b, filters) ? 1 : 0;
    if (sa !== sb) return sa - sb;

    if (filters.priceSearchMode === "higher") {
      if (a.price !== b.price) return a.price - b.price;
    } else {
      const t = typeof filters.maxPrice === "number" ? filters.maxPrice : null;
      if (t != null && t > 0) {
        const da = Math.abs(a.price - t);
        const db = Math.abs(b.price - t);
        if (da !== db) return da - db;
      }
      if (a.price !== b.price) return a.price - b.price;
    }

    const va = isVerificationStale(a.last_verified_at) ? 1 : 0;
    const vb = isVerificationStale(b.last_verified_at) ? 1 : 0;
    return va - vb;
  });
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
    ["التجمع", "التجمع الخامس"],
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

  let governorate = "";
  let district = "";
  let area = "";

  const dm = matchDistrictInText(blob);
  if (dm) {
    district = dm.district;
    governorate = normalizeArea(dm.governorate);
  } else {
    for (const [needle, canon] of needleCanon) {
      if (blob.includes(needle)) {
        const g = governorateForDistrict(canon);
        if (g) {
          district = canon;
          governorate = normalizeArea(g);
        } else {
          area = normalizeArea(canon);
        }
        break;
      }
    }
  }
  if (!district && !governorate && !area) {
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

  if (!district && !governorate && !area.trim() && maxPrice === null && !unitType)
    return null;

  const latestUser =
    messages.filter((m) => m.role === "user").slice(-1)[0]?.content?.trim() ?? "";
  const higher =
    detectHigherPriceIntent(latestUser) && !detectLowerPriceIntent(latestUser);
  let minPrice: number | null = null;
  let priceSearchMode: PriceSearchMode = "band";
  let maxOut = maxPrice;
  if (higher) {
    priceSearchMode = "higher";
    maxOut = null;
    const prev = lastBudgetBeforeLatestUserMessage(messages);
    const latestPrices = extractPricesFromText(latestUser);
    const fromLatest =
      latestPrices.length > 0 ? latestPrices[latestPrices.length - 1] : null;
    const floor = prev ?? maxPrice ?? fromLatest;
    minPrice = typeof floor === "number" && floor > 0 ? floor : null;
    if (minPrice == null) {
      priceSearchMode = "band";
      maxOut = maxPrice;
    }
  }

  const allowed = ["student", "family", "studio", "shared", "employee", ""];
  return {
    type: "FILTER",
    unitType: allowed.includes(unitType) ? unitType : "",
    governorate: governorate.trim(),
    district: district.trim(),
    area: area.trim(),
    maxPrice: maxOut,
    minPrice,
    priceSearchMode,
    keywords: "",
    listingPurpose: resolvePersistedListingPurpose(messages, ""),
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
function buildSystemPrompt(recentUserBlock: string, agency: AgencyChatScope | null): string {
  const agencyBlock = agency
    ? `

## سياق الوكالة (إلزامي)
المستخدم يتصفح صفحة الوكالة «${agency.name.replace(/\\/g, "/").replace(/\s+/g, " ").trim().slice(0, 160)}» (المعرّف: ${agency.id}). أي بحث أو عروض في الكروت يجب أن تُجلب **فقط** من إعلانات هذه الوكالة (\`agency_id\` = هذا المعرّف). لا تقترح عقارات من وكلاء آخرين أو من المنصة خارج هذه الوكالة. عند الإجابة عن الأسعار والمناطق، اعتمد على إعلانات الوكالة المعروضة في الصفحة فقط.
`
    : "";

  return `أنت خبير عقاري في منصة دَورلي، تساعد المستخدمين في العثور على أفضل العقارات في مصر بناءً على البيانات المتوفرة في قاعدة بياناتنا فقط. ردك يجب أن يكون باللهجة المصرية المهذبة والمحترفة.

## آخر ما ذكره المستخدم (آخر 5 رسائل user)
${recentUserBlock}
${agencyBlock}

## قواعد البيانات والسلوك
- لا تذكر عقارات أو أسعاراً من خارج منصة دَورلي؛ النظام يجلب النتائج من قاعدة البيانات حسب الفلتر الذي تُخرجه.
- لأي استفسار عن عروض، بحث، منطقة، ميزانية، أو نوع وحدة: أرجع دائماً \`action\` من نوع \`FILTER\` (ما لم يكن آخر الرسائل تحية أو موضوعاً لا علاقة له بالعقار → \`action: null\`).
- **الفلتر الجغرافي**: استخدم **governorate** (محافظة: مثل القاهرة، الجيزة) و **district** (حي/كمبوند محدد مثل فيصل، التجمع الخامس، مدينة نصر، الشيخ زايد). عندما يذكر المستخدم حياً صريحاً ضع الاسم في **district** ولا تترك العمود فارغاً؛ اربط **governorate** بالمحافظة الصحيحة. حقل **area** اختياري للتوافق مع صياغة قديمة أو منطقة عامة فقط عند الحاجة.
- **إيجار مقابل بيع (\`listingPurpose\`)**: إذا ذكر المستخدم بيعاً أو شراءً صراحة ضع \`"sale"\`. إذا ذكر إيجاراً أو كراءً ضع \`"rent"\`. إذا ذكر رقماً مثل 15000 أو 20000 مع حي راقٍ (التجمع، زايد، …) بدون كلمة بيع → اعتبره **إيجار شهري** وضع \`"rent"\`. اترك \`""\` فقط عندما لا يمكن التمييز.
- **keywords**: لعبارات الشارع أو العلامة المميزة أو أي وصف نصي يضيّق البحث في العنوان/العنوان التفصيلي؛ بدون فواصل \`,\` أو \`،\` (استبدلها بمسافات).
- **أسلوب مستشار**: لا تقل «ملقتش» أو «مفيش نتائج» لو النظام قد يعرض عروضاً قريبة من الميزانية أو أعلى بشوية؛ ركّز على القيمة والبدائل اللطيفة. لا تقترح محافظة أخرى (مثلاً الجيزة بدل القاهرة) إلا إذا طلب المستخدم ذلك صراحة.
- كن لطيفاً ومهنياً؛ اقترح منطقة أو ميزانية عند الغموض بدل الجفاف.

- **الميزانية والسعر**: عندما يذكر المستخدم رقم ميزانية (مثلاً 20000) ضع \`maxPrice\` = هذا الرقم كـ**مرجع وسط النطاق**؛ النظام يبحث تلقائياً في نطاق تقريبي 80%–125% حوله. لا تضع سقفاً أقل من الميزانية فقط.
- **طلب أسعار أعلى** (مثل: عايز أغلى، أسعار أعلى): اضبط \`priceSearchMode\`: \`"higher"\` و \`minPrice\` = آخر ميزانية/سقف ذكرها المستخدم (أو نفس \`maxPrice\` إن كان المرجع الوحيد)، واجعل \`maxPrice\`: null. عند \`"higher"\` تُرتَّب النتائج من الأرخص ضمن الفئة الأعلى تصاعدياً.
- **ثبات الغرض**: احتفظ بـ\`listingPurpose\` كما في السياق (إيجار/بيع) ما لم يغيّر المستخدم صراحة؛ النظام يثبّت آخر rent/sale من رسائل المستخدم تلقائياً.

## مخرجاتك (JSON فقط — بلا Markdown أو code fences)
{
  "message": "نص للمستخدم",
  "action": { "type": "FILTER", "unitType": "" | "student"|"family"|"studio"|"shared"|"employee", "governorate": "", "district": "", "area": "", "maxPrice": null أو رقم مرجعي للميزانية, "minPrice": null أو رقم (أرضية عند طلب فئة أعلى), "priceSearchMode": "band" | "higher", "keywords": "", "listingPurpose": "" | "rent" | "sale" }
}

مثال: إذا سأل عن «إيه العقارات المتاحة» بدون تفاصيل، اجعل message ترحيباً مختصراً وaction FILTER بحقول فارغة أو null حيث يناسب ليعرض النظام عينة من العقارات المتاحة.`;
}

const SELECT_ROW =
  "id, title, price, listing_purpose, area, governorate, district, landmark, address, unit_type, images, slug, last_verified_at, report_count, owner_id, profiles(low_trust)";

async function queryTopProperties(
  filters: FilterAction,
  limit = 3,
  agencyId: string | null = null,
): Promise<PropertyResult[]> {
  const supabase = getSupabaseServerClient();

  let q = supabase
    .from("properties")
    .select(SELECT_ROW)
    .eq("status", "active")
    .eq("availability_status", "available");
  if (agencyId) q = q.eq("agency_id", agencyId);

  const g = filters.governorate?.trim() ?? "";
  const d = filters.district?.trim() ?? "";
  const a = filters.area?.trim() ?? "";
  if (d) q = q.or(`district.ilike.%${d}%,area.ilike.%${d}%`);
  if (g) q = q.or(`governorate.ilike.%${g}%,area.ilike.%${g}%`);
  if (!d && !g && a) {
    q = q.or(`governorate.ilike.%${a}%,district.ilike.%${a}%,area.ilike.%${a}%`);
  }
  const lp = filters.listingPurpose?.trim().toLowerCase();
  if (lp === "rent" || lp === "sale") q = q.eq("listing_purpose", lp);
  if (filters.unitType) q = q.eq("unit_type", filters.unitType);

  if (filters.priceSearchMode === "higher") {
    const lo = typeof filters.minPrice === "number" ? filters.minPrice : 0;
    if (lo > 0) q = q.gte("price", lo);
    q = q.lte("price", CHAT_PRICE_CEILING);
    q = q
      .order("price", { ascending: true })
      .order("last_verified_at", { ascending: false });
  } else if (typeof filters.maxPrice === "number" && filters.maxPrice > 0) {
    const hi = Math.round(filters.maxPrice * 1.25);
    const lo = Math.max(0, Math.floor(filters.maxPrice * 0.8));
    q = q.gte("price", lo).lte("price", hi);
    q = q
      .order("last_verified_at", { ascending: false })
      .order("created_at", { ascending: false });
  } else {
    q = q
      .order("last_verified_at", { ascending: false })
      .order("created_at", { ascending: false });
  }

  const safeKw = sanitizeSearchKeywords(filters.keywords?.trim() ?? "");
  if (safeKw.length >= 2) {
    q = q.or(
      `title.ilike.%${safeKw}%,address.ilike.%${safeKw}%,landmark.ilike.%${safeKw}%`,
    );
  }

  const fetchCap = Math.max(limit * 6, 24);
  const { data, error } = await q.limit(fetchCap);
  if (error) throw error;
  const mapped = rowsToMappedResults((data as PropertyQueryRow[]) ?? []);
  return rankChatPropertyRows(mapped, filters).slice(0, limit);
}

async function queryFallback(
  filters: FilterAction,
  agencyId: string | null = null,
): Promise<PropertyResult[]> {
  if (filters.priceSearchMode === "higher") {
    const relaxed: FilterAction = {
      ...filters,
      keywords: "",
      minPrice:
        typeof filters.minPrice === "number" && filters.minPrice > 0
          ? Math.max(500, Math.floor(filters.minPrice * 0.92))
          : filters.minPrice,
    };
    return queryTopProperties(relaxed, 5, agencyId);
  }
  const relaxed: FilterAction = {
    ...filters,
    keywords: "",
    maxPrice:
      typeof filters.maxPrice === "number"
        ? Math.round(filters.maxPrice * 1.25)
        : null,
  };
  return queryTopProperties(relaxed, 5, agencyId);
}

/** تحليل سوقي خفيف يُشغَّل بالتوازي مع البحث (analyze_market_trends مبسّط على بيانات المنصة) */
async function analyzeMarketTrends(
  filters: FilterAction,
  agencyId: string | null = null,
): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    let q = supabase
      .from("properties")
      .select("price")
      .eq("status", "active")
      .eq("availability_status", "available");
    if (agencyId) q = q.eq("agency_id", agencyId);
    const g = filters.governorate?.trim() ?? "";
    const d = filters.district?.trim() ?? "";
    const ar = filters.area?.trim() ?? "";
    if (d) q = q.or(`district.ilike.%${d}%,area.ilike.%${d}%`);
    if (g) q = q.or(`governorate.ilike.%${g}%,area.ilike.%${g}%`);
    if (!d && !g && ar) {
      q = q.or(`governorate.ilike.%${ar}%,district.ilike.%${ar}%,area.ilike.%${ar}%`);
    }
    const lp = filters.listingPurpose?.trim().toLowerCase();
    if (lp === "rent" || lp === "sale") q = q.eq("listing_purpose", lp);
    if (
      filters.priceSearchMode === "band" &&
      typeof filters.maxPrice === "number" &&
      filters.maxPrice > 0
    ) {
      const lo = Math.max(0, Math.floor(filters.maxPrice * 0.8));
      const hi = Math.round(filters.maxPrice * 1.25);
      q = q.gte("price", lo).lte("price", hi);
    } else if (
      filters.priceSearchMode === "higher" &&
      typeof filters.minPrice === "number" &&
      filters.minPrice > 0
    ) {
      q = q.gte("price", filters.minPrice).lte("price", CHAT_PRICE_CEILING);
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
    const loc =
      filters.district?.trim() ||
      filters.governorate?.trim() ||
      filters.area?.trim() ||
      "";
    const where = loc ? `في نطاق ${loc}` : "على المنصة";
    return `📊 لمحة سوق ${where}: الإعلانات النشطة غالباً بين حوالي ${Math.round(low).toLocaleString("ar-EG")} و ${Math.round(hi).toLocaleString("ar-EG")} ج.م/شهر (وسطياً ~${Math.round(mid).toLocaleString("ar-EG")}). دي إشارة من إعلانات دَورلي مش تسعير رسمي.`;
  } catch {
    return null;
  }
}

type PivotKind =
  | "none"
  | "budget_plus_10"
  | "neighbor"
  | "budget_plus_25"
  | "explore"
  | "higher_prices";

const SLIDER_LIMIT = 3;
const takeSlider = (rows: PropertyResult[]) => rows.slice(0, SLIDER_LIMIT);

/** بحث بدون التزام محافظة: السلوك السابق (جيران، سقف أوسع، استكشاف). */
async function searchPropertiesWithFallbackLegacy(
  filters: FilterAction,
  agencyId: string | null = null,
): Promise<{
  results: PropertyResult[];
  resultsOtherAreas: PropertyResult[];
  pivot: PivotKind;
  neighborUsed?: string;
  marketNote: string | null;
}> {
  const [primary, marketNote] = await Promise.all([
    queryTopProperties(filters, 6, agencyId),
    analyzeMarketTrends(filters, agencyId),
  ]);

  if (primary.length > 0) {
    return {
      results: takeSlider(primary),
      resultsOtherAreas: [],
      pivot: filters.priceSearchMode === "higher" ? "higher_prices" : "none",
      marketNote,
    };
  }

  if (
    filters.priceSearchMode !== "higher" &&
    typeof filters.maxPrice === "number" &&
    filters.maxPrice > 0
  ) {
    const wider10 = await queryTopProperties(
      {
        ...filters,
        maxPrice: Math.round(filters.maxPrice * 1.1),
      },
      6,
      agencyId,
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

  const nbs =
    filters.district?.trim() || filters.governorate?.trim()
      ? neighborDistrictsInSameGovernorate(
          filters.district?.trim() ?? "",
          filters.governorate?.trim() ?? "",
        )
      : neighborAreasFor(filters.area || "");
  for (const nb of nbs) {
    const gNb = governorateForDistrict(nb);
    const alt = await queryTopProperties(
      {
        ...filters,
        district: gNb ? nb : "",
        governorate: gNb ? normalizeArea(gNb) : "",
        area: gNb ? "" : nb,
      },
      6,
      agencyId,
    );
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

  const fallback25 = await queryFallback(filters, agencyId);
  if (fallback25.length > 0) {
    return {
      results: takeSlider(fallback25),
      resultsOtherAreas: [],
      pivot: "budget_plus_25",
      marketNote,
    };
  }

  const exploratory = await queryExploratorySuggestions(filters, agencyId);
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

/**
 * عند تحديد منطقة/محافظة: نتائج من نفس النطاق أو أحياء مجاورة داخل المحافظة فقط.
 * لا نعرض عروضاً من محافظة أخرى (مثلاً الجيزة بدل القاهرة) إلا بطلب صريح من المستخدم.
 */
async function searchPropertiesWithStrictGovernorate(
  filters: FilterAction,
  agencyId: string | null = null,
): Promise<{
  results: PropertyResult[];
  resultsOtherAreas: PropertyResult[];
  pivot: PivotKind;
  neighborUsed?: string;
  marketNote: string | null;
}> {
  const userLocationFocus =
    filters.district?.trim() ||
    filters.governorate?.trim() ||
    filters.area?.trim() ||
    "";
  const marketNote = await analyzeMarketTrends(filters, agencyId);
  let pivot: PivotKind = "none";

  async function collectFor(f: FilterAction, rowFocus: string): Promise<PropertyResult[]> {
    const raw = await queryTopProperties(f, 28, agencyId);
    return filterRowsByLocationFocus(raw, rowFocus);
  }

  let inGov = await collectFor(filters, userLocationFocus);
  if (
    inGov.length === 0 &&
    filters.priceSearchMode !== "higher" &&
    typeof filters.maxPrice === "number" &&
    filters.maxPrice > 0
  ) {
    inGov = await collectFor(
      { ...filters, maxPrice: Math.round(filters.maxPrice * 1.1) },
      userLocationFocus,
    );
    if (inGov.length) pivot = "budget_plus_10";
  }
  if (
    inGov.length === 0 &&
    filters.priceSearchMode !== "higher" &&
    typeof filters.maxPrice === "number" &&
    filters.maxPrice > 0
  ) {
    inGov = await collectFor(
      { ...filters, maxPrice: Math.round(filters.maxPrice * 1.25) },
      userLocationFocus,
    );
    if (inGov.length) pivot = "budget_plus_25";
  }

  if (inGov.length > 0) {
    const pivotOut =
      filters.priceSearchMode === "higher"
        ? pivot === "none"
          ? "higher_prices"
          : pivot
        : pivot;
    return {
      results: takeSlider(inGov),
      resultsOtherAreas: [],
      pivot: pivotOut,
      marketNote,
    };
  }

  const govFocus =
    filters.governorate?.trim() ||
    governorateForDistrict(filters.district?.trim() ?? "") ||
    "";
  const nbs = neighborDistrictsInSameGovernorate(
    filters.district?.trim() ?? "",
    govFocus,
  );

  for (const nb of nbs) {
    const gNb = governorateForDistrict(nb);
    if (!gNb) continue;
    const cand = await collectFor(
      {
        ...filters,
        district: nb,
        governorate: normalizeArea(gNb),
        area: "",
      },
      nb,
    );
    if (cand.length) {
      return {
        results: takeSlider(cand),
        resultsOtherAreas: [],
        pivot: "neighbor",
        neighborUsed: nb,
        marketNote,
      };
    }
  }

  if (
    filters.priceSearchMode !== "higher" &&
    typeof filters.maxPrice === "number" &&
    filters.maxPrice > 0
  ) {
    const relaxedMax = Math.round(filters.maxPrice * 1.25);
    for (const nb of nbs) {
      const gNb = governorateForDistrict(nb);
      if (!gNb) continue;
      const cand = await collectFor(
        {
          ...filters,
          district: nb,
          governorate: normalizeArea(gNb),
          area: "",
          maxPrice: relaxedMax,
        },
        nb,
      );
      if (cand.length) {
        return {
          results: takeSlider(cand),
          resultsOtherAreas: [],
          pivot: "budget_plus_25",
          neighborUsed: nb,
          marketNote,
        };
      }
    }
  }

  if (govFocus && (filters.district?.trim() || filters.area?.trim())) {
    const cand = await collectFor(
      {
        ...filters,
        district: "",
        area: "",
        governorate: govFocus,
        maxPrice:
          typeof filters.maxPrice === "number"
            ? Math.round(filters.maxPrice * 1.25)
            : filters.maxPrice,
      },
      govFocus,
    );
    if (cand.length) {
      return {
        results: takeSlider(cand),
        resultsOtherAreas: [],
        pivot: "budget_plus_25",
        marketNote,
      };
    }
  }

  return {
    results: [],
    resultsOtherAreas: [],
    pivot: "none",
    marketNote,
  };
}

async function searchPropertiesWithFallback(
  filters: FilterAction,
  agencyId: string | null = null,
): Promise<{
  results: PropertyResult[];
  resultsOtherAreas: PropertyResult[];
  pivot: PivotKind;
  neighborUsed?: string;
  marketNote: string | null;
}> {
  if (
    filters.district?.trim() ||
    filters.governorate?.trim() ||
    filters.area?.trim()
  ) {
    return searchPropertiesWithStrictGovernorate(filters, agencyId);
  }
  return searchPropertiesWithFallbackLegacy(filters, agencyId);
}

function pickHighlightPhrase(title: string): string {
  const t = title.trim();
  if (/تشطيب|لوكس|سوبر\s*لوكس|ديلوكس|حديث/i.test(t)) return "التشطيب والموقع";
  if (/مفروش|مفرش|فرش/i.test(t)) return "إنها جاهزة ومفروشة";
  if (/مساح|فيو|واسع|كبير/i.test(t)) return "المساحة والإطلالة";
  if (/روف|بلكون|جنينة|حديقة/i.test(t)) return "البلكونة والإضاءة";
  return "القيمة مقابل السعر";
}

function buildSalesmanOverBudgetLine(
  filters: FilterAction,
  results: PropertyResult[],
): string | null {
  if (filters.priceSearchMode === "higher") return null;
  const cap = filters.maxPrice;
  if (typeof cap !== "number" || cap <= 0 || results.length === 0) return null;
  const above = results.filter((r) => r.price > cap * 1.008);
  if (above.length === 0) return null;
  const best = above.reduce((a, b) => (a.price <= b.price ? a : b));
  const loc =
    best.district?.trim() ||
    filters.district?.trim() ||
    filters.governorate?.trim() ||
    filters.area?.trim() ||
    "المنطقة";
  const shortTitle =
    best.title.length > 38 ? `${best.title.slice(0, 36)}…` : best.title;
  const priceStr = Math.round(best.price).toLocaleString("ar-EG");
  return `لقيتلك "${shortTitle}" في ${loc} بـ ${priceStr} ج.م — أعلى من ميزانيتك بشوية بس تستاهل عشان ${pickHighlightPhrase(best.title)}، تحب تشوفها؟`;
}

function composeConsultantMessage(
  aiMessage: string,
  filters: FilterAction,
  pivot: PivotKind,
  neighborUsed: string | undefined,
  marketNote: string | null,
  hasStrictResults: boolean,
  _hasOtherAreaResults: boolean,
  primaryResults: PropertyResult[],
): string {
  const blocks: string[] = [];
  const locationLabel =
    filters.district?.trim() ||
    filters.governorate?.trim() ||
    filters.area?.trim() ||
    "المنطقة";
  const trimmed = aiMessage?.trim();
  const pessimisticAi =
    trimmed &&
    /ملقتش|مفيش\s*نتائج|لم\s*أجد|لا\s*توجد|مش\s*لاقي|مش\s*موجود/i.test(trimmed);

  const sales =
    hasStrictResults ? buildSalesmanOverBudgetLine(filters, primaryResults) : null;
  const closeBudgetIntro =
    hasStrictResults &&
    !sales &&
    (pivot === "budget_plus_10" || pivot === "budget_plus_25")
      ? `دي أقرب حاجات لميزانيتك في ${locationLabel} — راجع الكروت تحت 👇`
      : null;

  if (filters.priceSearchMode === "higher" && hasStrictResults) {
    const mn = filters.minPrice ?? 0;
    const purposePhrase =
      filters.listingPurpose === "rent"
        ? `إيجارات أعلى من ${mn.toLocaleString("ar-EG")} ج.م`
        : filters.listingPurpose === "sale"
          ? `عروض بيع بأسعار أعلى من ${mn.toLocaleString("ar-EG")} ج.م`
          : `عروض بأسعار أعلى من ${mn.toLocaleString("ar-EG")} ج.م`;
    blocks.push(
      `تمام، بدأت أدورلك على فئة سعرية أعلى في ${locationLabel} عشان نلاقي مساحات أكبر أو تشطيب ألترا سوبر لوكس. ${purposePhrase} — شوف النتائج دي:`,
    );
  }

  if (sales) blocks.push(sales);
  else if (closeBudgetIntro) blocks.push(closeBudgetIntro);

  if (!hasStrictResults) {
    blocks.push(
      trimmed && !pessimisticAi
        ? trimmed
        : encouragingCopy(filters, false, locationLabel),
    );
    if (marketNote) blocks.push(marketNote);
    return blocks.filter(Boolean).join("\n\n").trim();
  }

  if (!sales) {
    if (pivot === "neighbor" && neighborUsed) {
      blocks.push(
        filters.priceSearchMode === "higher"
          ? `وسّعت البحث لأحياء مجاورة في نفس المحافظة (${neighborUsed}) مع الحفاظ على فئة السعر الأعلى اللي طلبتها.`
          : `في ${locationLabel} السقف كان ضيّق شوية، فلقيت لك خيارات في ${neighborUsed} — نفس المحافظة ومفيش قفزة لمحافظة تانية. شوف الكروت تحت.`,
      );
    } else if (pivot === "budget_plus_10" && !closeBudgetIntro) {
      blocks.push(
        `وسّعتلك البحث حوالي 10% فوق الميزانية عشان يبان أقرب خيارات في ${locationLabel}.`,
      );
    } else if (pivot === "budget_plus_25" && !closeBudgetIntro) {
      blocks.push(
        `دي أقرب حاجات لميزانيتك في ${locationLabel} — لحد حوالي 25% فوق السقف اللي ذكرته عشان السوق يبقى أوضح.`,
      );
    } else if (pivot === "explore") {
      blocks.push(
        `دي بدائل بنفس النفسية (سكن طلاب / مشترك / سقف أوضح) ضمن نفس روح طلبك.`,
      );
    }
  }

  if (trimmed && !pessimisticAi) blocks.push(trimmed);
  if (marketNote) blocks.push(marketNote);

  const joined = blocks.filter(Boolean).join("\n\n").trim();
  if (joined) return joined;
  return encouragingCopy(filters, true, locationLabel);
}

async function buildFilterResponse(
  filters: FilterAction,
  aiMessage: string,
  degradedPrefix?: string,
  agencyId: string | null = null,
): Promise<NextResponse> {
  try {
    const { results, resultsOtherAreas, pivot, neighborUsed, marketNote } =
      await searchPropertiesWithFallback(filters, agencyId);

    let message = composeConsultantMessage(
      aiMessage,
      filters,
      pivot,
      neighborUsed,
      marketNote,
      results.length > 0,
      (resultsOtherAreas?.length ?? 0) > 0,
      results,
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
async function queryExploratorySuggestions(
  filters: FilterAction,
  agencyId: string | null = null,
): Promise<PropertyResult[]> {
  const supabase = getSupabaseServerClient();
  let q = supabase
    .from("properties")
    .select(SELECT_ROW)
    .eq("status", "active")
    .eq("availability_status", "available");
  if (agencyId) q = q.eq("agency_id", agencyId);

  const g = filters.governorate?.trim() ?? "";
  const d = filters.district?.trim() ?? "";
  const ar = filters.area?.trim() ?? "";
  if (d) q = q.or(`district.ilike.%${d}%,area.ilike.%${d}%`);
  if (g) q = q.or(`governorate.ilike.%${g}%,area.ilike.%${g}%`);
  if (!d && !g && ar) {
    q = q.or(`governorate.ilike.%${ar}%,district.ilike.%${ar}%,area.ilike.%${ar}%`);
  }
  const lp = filters.listingPurpose?.trim().toLowerCase();
  if (lp === "rent" || lp === "sale") q = q.eq("listing_purpose", lp);
  const maxP = filters.maxPrice;
  const explicitUnitType = filters.unitType?.trim() ?? "";

  if (
    filters.priceSearchMode === "higher" &&
    typeof filters.minPrice === "number" &&
    filters.minPrice > 0
  ) {
    q = q.gte("price", filters.minPrice).lte("price", CHAT_PRICE_CEILING);
    q = q
      .order("price", { ascending: true })
      .order("last_verified_at", { ascending: false });
  } else if (typeof maxP === "number" && maxP < 2200) {
    q = q.lte("price", Math.max(maxP * 2, 2800));
    if (!explicitUnitType) {
      q = q.in("unit_type", ["shared", "student"]);
    } else {
      q = q.eq("unit_type", explicitUnitType);
    }
    q = q
      .order("last_verified_at", { ascending: false })
      .order("price", { ascending: true });
  } else if (typeof maxP === "number") {
    q = q.lte("price", Math.round(maxP * 1.6));
    q = q
      .order("last_verified_at", { ascending: false })
      .order("price", { ascending: true });
  } else {
    q = q
      .order("last_verified_at", { ascending: false })
      .order("price", { ascending: true });
  }

  const { data, error } = await q.limit(24);
  if (error) throw error;
  const mapped = rowsToMappedResults((data as PropertyQueryRow[]) ?? []);
  return rankChatPropertyRows(mapped, filters).slice(0, 5);
}

function encouragingCopy(
  filters: FilterAction,
  hasAlts: boolean,
  locationLabel = "المنطقة",
): string {
  const mp = filters.maxPrice;
  if (typeof mp === "number" && mp < 2000) {
    return hasAlts
      ? "يا بطل، الميزانية دي تحت ضغط السوق شوية — تحت شوية خيارات قريبة من فكرتك (أوضة مشتركة / سكن طلاب). شوف الكروت ولو حابب نعلّي السقف شوية أو نفكّر في حي لُزِق في نفس المحافظة قولّي."
      : "يا بطل، السوق النهاردة محتاج نرفع السقف شوية أو نفكّر في بديل أنسب — أنا معاك نضبط الإيجار أو الحي في نفس المحافظة خطوة بخطوة.";
  }
  return hasAlts
    ? "يا فندم، للمواصفات الدقيقة اختيار محدود، لكن جهزت لحضرتك بدائل قريبة من نفس الاتجاه — راجع الكروت ونظبط الفلتر سوا."
    : `يا فندم، في ${locationLabel} مفيش تطابق بنفس السقف حالياً — نقدر نعلّي الميزانية بلطف (مثلاً لحد ٢٥٪) أو نشوف حي لُزِق في نفس المحافظة. قولّي إيه اللي يناسبك وأنا أظبطلك البحث.`;
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

  const agencyIdRaw = parseAgencyIdParam(body.agency_id);
  let agencyScope: AgencyChatScope | null = null;
  if (agencyIdRaw) {
    try {
      const sb = getSupabaseServerClient();
      const { data } = await sb
        .from("agencies")
        .select("id, name")
        .eq("id", agencyIdRaw)
        .maybeSingle();
      if (data?.id) {
        agencyScope = {
          id: data.id,
          name:
            typeof data.name === "string" && data.name.trim()
              ? data.name.trim()
              : "وكالة",
        };
      }
    } catch {
      /* ignore — chat continues without agency scope */
    }
  }
  const scopedAgencyId = agencyScope?.id ?? null;

  const history = messages.slice(-MAX_HISTORY_MESSAGES);
  const systemPrompt = buildSystemPrompt(lastUserUtterances(history, 5), agencyScope);

  let openaiRes: Response;
  try {
    openaiRes = await fetchOpenAiChatCompletion(openaiApiKey, {
      model: openaiModel,
      max_tokens: 640,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, ...history],
    });
  } catch {
    const guessed = inferFilterFromMessages(history);
    if (guessed) {
      return buildFilterResponse(guessed, "", DEGRADED_AI_PREFIX, scopedAgencyId);
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
    let governorate =
      typeof a.governorate === "string" ? normalizeArea(a.governorate.trim()) : "";
    let district = typeof a.district === "string" ? a.district.trim() : "";
    let area = typeof a.area === "string" ? normalizeArea(a.area.trim()) : "";
    const aiMax = typeof a.maxPrice === "number" ? a.maxPrice : null;
    const aiMin = typeof a.minPrice === "number" ? a.minPrice : null;
    const aiModeRaw = a.priceSearchMode;
    const keywords = sanitizeSearchKeywords(
      typeof a.keywords === "string" ? a.keywords : "",
    );

    if (district && !governorate) {
      const inf = governorateForDistrict(district);
      if (inf) governorate = normalizeArea(inf);
    }
    if (!district && !governorate && area) {
      const m = matchDistrictInText(area);
      if (m) {
        district = m.district;
        governorate = normalizeArea(m.governorate);
        area = "";
      }
    }

    const latestUser =
      history.filter((m) => m.role === "user").slice(-1)[0]?.content?.trim() ?? "";
    const lowerFromText = detectLowerPriceIntent(latestUser);
    const higherFromText =
      detectHigherPriceIntent(latestUser) && !lowerFromText;

    let maxPrice = aiMax;
    let minPrice: number | null = aiMin;
    let priceSearchMode: PriceSearchMode =
      aiModeRaw === "higher" ? "higher" : "band";

    if (lowerFromText) {
      priceSearchMode = "band";
      minPrice = null;
      maxPrice = aiMax;
    } else if (higherFromText || priceSearchMode === "higher") {
      priceSearchMode = "higher";
      maxPrice = null;
      const prev = lastBudgetBeforeLatestUserMessage(history);
      const latestPrices = extractPricesFromText(latestUser);
      const fromLatest =
        latestPrices.length > 0 ? latestPrices[latestPrices.length - 1] : null;
      const floor =
        (typeof aiMin === "number" && aiMin > 0 ? aiMin : null) ??
        prev ??
        (typeof aiMax === "number" && aiMax > 0 ? aiMax : null) ??
        fromLatest;
      minPrice = typeof floor === "number" && floor > 0 ? floor : null;
      if (minPrice == null) {
        priceSearchMode = "band";
        maxPrice = aiMax;
      }
    }

    const filters: FilterAction = {
      type: "FILTER",
      unitType: ["student", "family", "studio", "shared", "employee", ""].includes(
        unitType,
      )
        ? unitType
        : "",
      governorate,
      district,
      area,
      maxPrice,
      minPrice,
      priceSearchMode,
      keywords,
      listingPurpose: resolvePersistedListingPurpose(
        history,
        typeof a.listingPurpose === "string" ? a.listingPurpose : "",
      ),
    };

    return buildFilterResponse(filters, parsed.message, undefined, scopedAgencyId);
  }

  return NextResponse.json(parsed satisfies ChatResponse);
}
