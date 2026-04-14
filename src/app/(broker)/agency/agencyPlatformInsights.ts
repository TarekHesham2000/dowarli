import type { GeoHotBarRow } from "./agencyLeadAnalytics";

export type PlatformInsightVariant = "emerald" | "amber" | "sky" | "slate" | "indigo";

export type PlatformInsight = {
  readonly message: string;
  readonly variant: PlatformInsightVariant;
};

/**
 * Rule-based «smart» copy for the agency dashboard (no LLM).
 */
export function buildPlatformInsight(input: {
  readonly totalViews: number;
  readonly totalLeads: number;
  readonly activeListings: number;
  readonly propCount: number;
  readonly barData: readonly GeoHotBarRow[];
  readonly noListings: boolean;
  readonly noSignalsInRange: boolean;
  readonly dateRangeLabel: string;
}): PlatformInsight {
  const {
    totalViews,
    totalLeads,
    activeListings,
    propCount,
    barData,
    noListings,
    noSignalsInRange,
    dateRangeLabel,
  } = input;

  if (noListings) {
    return {
      message:
        "انشر أول إعلان مرتبط بوكالتك لتظهر المشاهدات والطلبات هنا — العملاء يبحثون عن عروض واضحة وصور احترافية.",
      variant: "sky",
    };
  }

  if (noSignalsInRange) {
    return {
      message: `لا مشاهدات ولا طلبات في «${dateRangeLabel}». جرّب توسيع الفترة الزمنية أعلاه، أو شارك روابط إعلاناتك على وسائل التواصل لزيادة الزيارات.`,
      variant: "slate",
    };
  }

  const ratio = totalViews > 0 ? totalLeads / totalViews : 0;
  const highTrafficLowLeads =
    totalViews >= 28 && totalLeads >= 0 && ratio < 0.028 && totalLeads <= Math.max(3, Math.floor(totalViews * 0.035));

  if (highTrafficLowLeads) {
    return {
      message:
        "إعلاناتك تحقق مشاهدات ممتازة، ولكن جرب تحسين الصور أو تعديل السعر أو صياغة العنوان لزيادة الطلبات.",
      variant: "amber",
    };
  }

  const totalGeoDemand = barData.reduce((s, b) => s + b.demand, 0);
  const top = barData[0];
  if (top && top.demand >= 3 && totalGeoDemand > 0 && top.demand / totalGeoDemand >= 0.3) {
    return {
      message: `هناك إقبال كبير على «${top.name}» خلال ${dateRangeLabel}، ننصحك بتكثيف إعلاناتك في هذه المنطقة أو إضافة عروض مشابهة.`,
      variant: "emerald",
    };
  }

  if (totalLeads >= 8 && ratio >= 0.045) {
    return {
      message:
        "أداء قوي: نسبة جيدة بين المشاهدات والطلبات. حافظ على الرد السريع والمتابعة في تبويب العملاء لتحويل الاهتمام إلى صفقات.",
      variant: "emerald",
    };
  }

  if (activeListings < propCount && propCount > 0) {
    return {
      message: `لديك ${propCount - activeListings} إعلان غير نشط من أصل ${propCount}. تفعيل الإعلانات المناسبة يزيد فرص الظهور والطلبات.`,
      variant: "indigo",
    };
  }

  if (totalViews < 20 && totalLeads >= 1) {
    return {
      message:
        "الطلبات موجودة رغم عدد المشاهدات المتواضع — جرّب تحسين ظهور الإعلان في البحث أو مشاركة الرابط لزيادة الوصول.",
      variant: "sky",
    };
  }

  return {
    message: `تابع أداءك في ${dateRangeLabel} من البطاقات أدناه، واستخدم تبويب التحليلات لفهم المناطق والفئات الأكثر طلباً.`,
    variant: "indigo",
  };
}
