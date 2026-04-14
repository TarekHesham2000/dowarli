"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, MessageCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/shared/Footer";
import ChatBot from "@/components/shared/ChatBot";
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

const TYPE_COLORS: Record<UnitType, { bg: string; text: string; border: string }> = {
  student: { bg: "rgba(0,211,141,0.08)", text: "#00a86b", border: "rgba(0,211,141,0.35)" },
  family: { bg: "rgba(59,130,246,0.08)", text: "#2563eb", border: "rgba(59,130,246,0.3)" },
  studio: { bg: "rgba(167,139,250,0.1)", text: "#9333ea", border: "rgba(167,139,250,0.35)" },
  shared: { bg: "rgba(251,146,60,0.1)", text: "#ea580c", border: "rgba(251,146,60,0.35)" },
  employee: { bg: "rgba(234,179,8,0.12)", text: "#ca8a04", border: "rgba(234,179,8,0.35)" },
};

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
}: {
  agency: AgencyPublic;
  properties: AgencyProperty[];
}) {
  const router = useRouter();
  const [chatOpenSignal, setChatOpenSignal] = useState(0);
  const [contactPrompt, setContactPrompt] = useState<string | null>(null);

  const tc = (unitType: string) =>
    TYPE_COLORS[(unitType as UnitType) in TYPE_COLORS ? (unitType as UnitType) : "family"];

  const onConsumePrompt = useCallback(() => setContactPrompt(null), []);

  const openAgencyChat = () => {
    setContactPrompt(
      `بدي أتواصل مع وكالة «${agency.name}» — عرّفني على العروض المتاحة والأسعار.`,
    );
    setChatOpenSignal((n) => n + 1);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f8fafc]">
        <header className="relative overflow-hidden border-b border-slate-200/80 bg-white">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-emerald-50/90 via-transparent to-slate-50"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14 md:flex md:items-start md:gap-10">
            <div className="mb-6 flex shrink-0 justify-center md:mb-0 md:justify-start">
              {agency.logo_url ? (
                <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-32 sm:w-32">
                  <Image
                    src={agency.logo_url}
                    alt={`شعار ${agency.name}`}
                    fill
                    className="object-cover"
                    sizes="128px"
                    quality={72}
                  />
                </div>
              ) : (
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-100 to-teal-50 sm:h-32 sm:w-32"
                  aria-hidden
                >
                  <Building2 className="h-14 w-14 text-emerald-700/45" strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center md:text-right">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-600/90">
                وكالة على دَورلي
              </p>
              <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
                {agency.name}
              </h1>
              {agency.bio ? (
                <p className="mx-auto max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-slate-600 sm:text-base md:mx-0">
                  {agency.bio}
                </p>
              ) : (
                <p className="text-sm text-slate-500">تصفّح عروض الوكالة أدناه.</p>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <button
                  type="button"
                  onClick={openAgencyChat}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#00d38d] px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition hover:bg-[#00bf7f]"
                >
                  <MessageCircle className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                  تواصل مع الوكالة
                </button>
                <span className="text-xs text-slate-500">{properties.length} إعلان نشط</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="mb-6 text-lg font-bold text-slate-800">عروض الوكالة</h2>
          {properties.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <p className="text-slate-600">لا توجد عقارات نشطة لهذه الوكالة حالياً.</p>
            </div>
          ) : (
            <motion.section
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06 } },
              }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="عقارات الوكالة"
            >
              {properties.map((p) => {
                const colors = tc(p.unit_type);
                const ut = (p.unit_type as UnitType) in TYPE_LABELS ? (p.unit_type as UnitType) : "family";
                return (
                  <motion.article
                    key={p.id}
                    variants={cardVariants}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    onClick={() => router.push(propertyPathFromRecord(p))}
                    className="cursor-pointer overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition hover:border-emerald-300/60 hover:shadow-md"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                      {p.images?.[0] ? (
                        <Image
                          src={p.images[0]}
                          alt={`صورة: ${p.title}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          quality={72}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-5xl text-slate-300">
                          🏠
                        </div>
                      )}
                      {p.is_featured ? (
                        <span className="absolute start-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-white shadow">
                          مميّز
                        </span>
                      ) : null}
                      <div
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
                        aria-hidden
                      />
                      <span className="absolute bottom-3 start-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">
                        {p.price.toLocaleString("ar-EG")}{" "}
                        {effectiveListingKind(p) === "sale" ? "ج.م" : "ج.م/شهر"}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                          style={{
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {TYPE_LABELS[ut]}
                        </span>
                        <span
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700"
                        >
                          {effectiveListingKind(p) === "sale" ? "🏷️ بيع" : "🔑 إيجار"}
                        </span>
                      </div>
                      <h3 className="mb-2 line-clamp-2 text-base font-extrabold leading-snug text-slate-900">
                        {p.title}
                      </h3>
                      <p className="flex items-start gap-1 text-xs text-slate-500">
                        <span className="mt-0.5 text-emerald-600" aria-hidden>
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
        </div>
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
    </>
  );
}
