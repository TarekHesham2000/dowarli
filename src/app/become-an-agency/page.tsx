"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/shared/Footer";
import { isValidAgencySlugAscii, suggestedAgencySlugAsciiFromName } from "@/lib/agencySlug";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-400";

export default function BecomeAgencyPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  /** Once the broker edits the slug field, stop overwriting it from the name. */
  const [slugUserEdited, setSlugUserEdited] = useState(false);
  const [bio, setBio] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: existing } = await supabase.from("agencies").select("id").eq("owner_id", user.id).maybeSingle();
      if (!cancelled && existing?.id) {
        router.replace("/agency");
        return;
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    if (slugUserEdited) return;
    const n = name.trim();
    if (!n) {
      setSlug("");
      return;
    }
    setSlug(suggestedAgencySlugAsciiFromName(name));
  }, [name, slugUserEdited]);

  const applySuggestedSlug = () => {
    setSlugUserEdited(false);
    setSlug(suggestedAgencySlugAsciiFromName(name));
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError("");
    const n = name.trim();
    const s = slug.trim();
    const slugNorm = s.toLowerCase();
    if (!n) {
      setError("أدخل اسم الوكالة.");
      return;
    }
    if (!isValidAgencySlugAscii(slugNorm)) {
      setError("رابط الوكالة غير صالح — استخدم حروفاً إنجليزية صغيرة وأرقاماً وشرطات فقط، بدون مسافات.");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: slugTaken } = await supabase.from("agencies").select("id").eq("slug", slugNorm).maybeSingle();
      if (slugTaken?.id) {
        setError("هذا الرابط مستخدم بالفعل — اختر اسماً آخر (حروف إنجليزية وأرقام) لصفحة وكالتك.");
        return;
      }

      const { data: inserted, error: insErr } = await supabase
        .from("agencies")
        .insert({
          name: n,
          slug: slugNorm,
          bio: bio.trim() || null,
          logo_url: null,
          owner_id: user.id,
          subscription_status: "free",
          is_verified: false,
        })
        .select("id")
        .single();

      if (insErr) {
        if (insErr.code === "23505" || insErr.message.includes("unique")) {
          setError("هذا الرابط مستخدم بالفعل — اختر اسماً آخر (حروف إنجليزية وأرقام) لصفحة وكالتك.");
        } else {
          setError(insErr.message || "تعذّر إنشاء الوكالة.");
        }
        return;
      }

      const agencyId = inserted?.id;
      if (!agencyId) {
        setError("تعذّر إنشاء الوكالة.");
        return;
      }

      const { error: linkErr } = await supabase
        .from("properties")
        .update({ agency_id: agencyId })
        .eq("owner_id", user.id)
        .is("agency_id", null);
      if (linkErr) {
        console.error("Auto-link legacy listings:", linkErr);
      }

      if (logoFile) {
        const rawExt = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt) ? rawExt.replace("jpeg", "jpg") : "png";
        const path = `agency-logos/${agencyId}/logo.${safeExt}`;
        const { error: upErr } = await supabase.storage.from("properties").upload(path, logoFile, {
          upsert: true,
          contentType: logoFile.type || undefined,
        });
        if (upErr) {
          setError(`تم إنشاء الوكالة وربط العقارات، لكن فشل رفع الشعار: ${upErr.message}`);
          router.replace("/agency?created=1");
          router.refresh();
          return;
        }
        const { data: pub } = supabase.storage.from("properties").getPublicUrl(path);
        const logoUrl = pub.publicUrl?.trim() || null;
        if (logoUrl) {
          const { error: logoUpdErr } = await supabase.from("agencies").update({ logo_url: logoUrl }).eq("id", agencyId);
          if (logoUpdErr) {
            setError(`تم إنشاء الوكالة لكن تعذّر حفظ رابط الشعار: ${logoUpdErr.message}`);
            router.replace("/agency?created=1");
            router.refresh();
            return;
          }
        }
      }

      router.replace("/agency?created=1");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <p className="text-sm text-slate-500">جاري التحميل…</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">تسجيل وكالة</h1>
          <p className="mt-1 text-sm text-slate-600">بعد المراجعة تظهر وكالتك في الدليل العام عند الاعتماد.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="become-agency-name" className="mb-1 block text-xs font-bold text-slate-700">
                اسم الوكالة
              </label>
              <input
                id="become-agency-name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor="become-agency-slug" className="text-xs font-bold text-slate-700">
                  رابط الوكالة (Slug)
                </label>
                <button type="button" className="text-[11px] font-bold text-emerald-700 hover:underline" onClick={applySuggestedSlug}>
                  اقتراح من الاسم
                </button>
              </div>
              <input
                id="become-agency-slug"
                className={inputClass}
                value={slug}
                onChange={(e) => {
                  setSlugUserEdited(true);
                  setSlug(e.target.value);
                }}
                required
                maxLength={120}
                dir="ltr"
                autoComplete="off"
              />
              <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-500">
                يُولَّد تلقائياً من الاسم (ترجمة الحروف العربية إلى إنجليزية). يمكنك تعديله يدوياً أو
                استخدام «اقتراح من الاسم» بعد التعديل.
              </p>
            </div>
            <div>
              <label htmlFor="become-agency-bio" className="mb-1 block text-xs font-bold text-slate-700">
                نبذة
              </label>
              <textarea
                id="become-agency-bio"
                className={`${inputClass} min-h-[100px] resize-y`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={2000}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-bold text-slate-700">شعار الوكالة (اختياري)</span>
              <p className="mb-2 text-[11px] text-slate-500">صورة واضحة بصيغة JPG أو PNG أو WebP — تظهر في صفحتك العامة.</p>
              <input
                id="become-agency-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="w-full max-w-full text-sm file:me-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-emerald-800"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
              {logoPreviewUrl ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-[11px] font-bold text-slate-600">معاينة الشعار</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob: preview URL */}
                  <img
                    src={logoPreviewUrl}
                    alt="معاينة شعار الوكالة"
                    className="mx-auto max-h-32 w-auto max-w-full object-contain"
                  />
                </div>
              ) : null}
            </div>
            {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#00d38d] py-3 text-sm font-black text-white shadow-md hover:bg-[#00bf7f] disabled:opacity-60"
            >
              {submitting ? "جاري الحفظ…" : "إنشاء الوكالة"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            <Link href="/agency" className="font-bold text-emerald-700 hover:underline">
              لوحة الوكالة
            </Link>
            {" · "}
            <Link href="/agencies" className="font-bold text-emerald-700 hover:underline">
              دليل الوكالات
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
