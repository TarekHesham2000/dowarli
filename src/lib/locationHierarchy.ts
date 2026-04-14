/** Arabic governorate labels + districts for listing forms and AI normalization. */

export const GOVERNORATE_CAIRO_AR = "القاهرة";
export const GOVERNORATE_GIZA_AR = "الجيزة";

export const DISTRICTS_BY_GOVERNORATE: Record<string, readonly string[]> = {
  [GOVERNORATE_CAIRO_AR]: [
    "التجمع الخامس",
    "العاصمة الإدارية",
    "مدينة نصر",
    "المقطم",
    "المستقبل سيتي",
    "بدر",
    "الشروق",
    "مدينتي",
    "المعادي",
    "مصر الجديدة",
    "حلوان",
    "حدائق القبة",
  ],
  [GOVERNORATE_GIZA_AR]: [
    "أكتوبر",
    "الشيخ زايد",
    "حدائق أكتوبر",
    "فيصل",
    "الهرم",
    "الدقي",
    "المهندسين",
    "المنصورية",
  ],
} as const;

export const GOVERNORATE_OPTIONS: { value: string; label: string }[] = [
  { value: GOVERNORATE_CAIRO_AR, label: `${GOVERNORATE_CAIRO_AR} (Cairo)` },
  { value: GOVERNORATE_GIZA_AR, label: `${GOVERNORATE_GIZA_AR} (Giza)` },
];

/** Longest-first for greedy matching in parsers. */
const DISTRICT_TO_GOVERNORATE: { district: string; governorate: string }[] = (() => {
  const pairs: { district: string; governorate: string }[] = [];
  for (const [gov, list] of Object.entries(DISTRICTS_BY_GOVERNORATE)) {
    for (const d of list) pairs.push({ district: d, governorate: gov });
  }
  pairs.sort((a, b) => b.district.length - a.district.length);
  return pairs;
})();

export function districtsForGovernorate(governorate: string): string[] {
  const list = DISTRICTS_BY_GOVERNORATE[governorate.trim()];
  return list ? [...list] : [];
}

export function governorateForDistrict(district: string): string | null {
  const d = district.trim();
  if (!d) return null;
  for (const [gov, list] of Object.entries(DISTRICTS_BY_GOVERNORATE)) {
    if (list.includes(d)) return gov;
  }
  return null;
}

/** If `text` contains a known district phrase, return { district, governorate }. */
export function matchDistrictInText(text: string): {
  district: string;
  governorate: string;
} | null {
  const blob = text.trim();
  if (!blob) return null;
  for (const { district, governorate } of DISTRICT_TO_GOVERNORATE) {
    if (blob.includes(district)) return { district, governorate };
  }
  return null;
}

/** أحياء مجاورة داخل نفس المحافظة فقط — بدون قفز للجيزة من القاهرة والعكس. */
const NEIGHBOR_RULES: { test: RegExp; neighbors: readonly string[] }[] = [
  { test: /تجمع|الخامس/i, neighbors: ["مدينتي", "الشروق", "مدينة نصر", "المستقبل سيتي", "بدر"] },
  { test: /مدينتي/i, neighbors: ["التجمع الخامس", "الشروق", "مدينة نصر", "بدر"] },
  { test: /شروق/i, neighbors: ["التجمع الخامس", "مدينتي", "بدر", "مدينة نصر"] },
  { test: /نصر/i, neighbors: ["التجمع الخامس", "مصر الجديدة", "المعادي", "حدائق القبة"] },
  { test: /معادي/i, neighbors: ["مدينة نصر", "مصر الجديدة", "المقطم"] },
  { test: /مصر الجديدة/i, neighbors: ["مدينة نصر", "المعادي", "حلوان"] },
  { test: /مقطم/i, neighbors: ["المعادي", "مدينة نصر"] },
  { test: /عاصمة إدارية|العاصمة الإدارية/i, neighbors: ["بدر", "الشروق", "مدينتي"] },
  { test: /بدر/i, neighbors: ["الشروق", "التجمع الخامس", "مدينتي"] },
  { test: /مستقبل|حدائق القبة|حلوان/i, neighbors: ["مدينة نصر", "المقطم", "مصر الجديدة"] },
  { test: /زايد|الشيخ زايد/i, neighbors: ["أكتوبر", "حدائق أكتوبر", "المهندسين"] },
  { test: /أكتوبر|٦\s*أكتوبر|6\s*أكتوبر|حدائق أكتوبر/i, neighbors: ["الشيخ زايد", "فيصل", "الهرم"] },
  { test: /فيصل|الهرم/i, neighbors: ["أكتوبر", "الدقي", "المهندسين", "المنصورية"] },
  { test: /دقي|المهندسين|المنصورية/i, neighbors: ["فيصل", "أكتوبر", "الشيخ زايد"] },
];

export function neighborDistrictsInSameGovernorate(
  district: string,
  governorate: string,
): string[] {
  const d = district.trim();
  const gIn = governorate.trim();
  const inferredGov = gIn || (d ? governorateForDistrict(d) ?? "" : "");

  const sameGovOnly = (names: readonly string[]) =>
    names.filter((nb) => governorateForDistrict(nb) === inferredGov && nb !== d);

  if (d) {
    for (const { test, neighbors } of NEIGHBOR_RULES) {
      if (test.test(d)) return sameGovOnly(neighbors);
    }
  }

  if (inferredGov) {
    const rest = districtsForGovernorate(inferredGov).filter((x) => x !== d);
    return rest.slice(0, 10);
  }
  return [];
}
