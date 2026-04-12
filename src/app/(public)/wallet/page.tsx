"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  AD_POST_COST_RENT,
  AD_POST_COST_SALE,
  getWalletDisplayNumber,
  POINTS_PACKAGES,
  type PointsPackage,
} from "@/lib/pointsConfig";
import { POINTS_CHANGED_EVENT } from "@/lib/profilePointsSync";
import { safeRouterRefresh } from "@/lib/safeRouterRefresh";

type TxRow = {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  package_name: string | null;
  points_requested: number | null;
};

export default function WalletPage() {
  const router = useRouter();
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [selected, setSelected] = useState<PointsPackage | null>(null);
  const [senderPhone, setSenderPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [copyHint, setCopyHint] = useState("");
  const walletNo = getWalletDisplayNumber();

  const copyWithHint = (text: string, hint: string) => {
    void navigator.clipboard.writeText(text.replace(/\s/g, ""));
    setCopyHint(hint);
    setTimeout(() => setCopyHint(""), 2200);
  };

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login?next=/wallet");
      return;
    }
    setUserId(user.id);
    const { data: profile } = await supabase.from("profiles").select("points").eq("id", user.id).maybeSingle();
    setPoints(profile?.points ?? 0);
    const { data: trans } = await supabase
      .from("transactions")
      .select("id, amount, status, created_at, rejection_reason, package_name, points_requested")
      .eq("broker_id", user.id)
      .order("created_at", { ascending: false });
    setTransactions((trans as TxRow[]) ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount bootstrap for Supabase
    void load();
  }, [load]);

  useEffect(() => {
    const onSync = () => {
      void load();
    };
    window.addEventListener(POINTS_CHANGED_EVENT, onSync);
    return () => window.removeEventListener(POINTS_CHANGED_EVENT, onSync);
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`wallet-profile-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const submitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !userId) return;
    if (!senderPhone.trim()) {
      setError("أدخل رقم الهاتف الكامل للمحوّل");
      return;
    }
    if (!file) {
      setError("ارفع لقطة شاشة للتحويل");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");

    const fileName = `receipts/${userId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("properties").upload(fileName, file);
    if (uploadError) {
      setError("فشل رفع الصورة");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("properties").getPublicUrl(fileName);

    const { error: insErr } = await supabase.from("transactions").insert({
      broker_id: userId,
      amount: selected.priceEGP,
      screenshot_url: urlData.publicUrl,
      status: "pending",
      sender_phone: senderPhone.trim(),
      points_requested: selected.points,
      package_name: selected.id,
    });

    if (insErr) {
      setError(insErr.message);
      setUploading(false);
      return;
    }

    setSuccess("تم إرسال الطلب! سنراجع التحويل ونضيف النقاط قريباً.");
    setSenderPhone("");
    setFile(null);
    setSelected(null);
    const input = document.getElementById("wallet-receipt") as HTMLInputElement | null;
    if (input) input.value = "";
    setUploading(false);
    void load();
    safeRouterRefresh(router);
  };

  const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "قيد المراجعة", color: "#92400e", bg: "#fef3c7" },
    verified: { label: "تم التأكيد", color: "#166534", bg: "#dcfce7" },
    rejected: { label: "مرفوض", color: "#991b1b", bg: "#fee2e2" },
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
        <p className="text-slate-500">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 to-slate-50 pb-10 font-sans" dir="rtl">
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-emerald-100 bg-white/90 px-3 py-3 shadow-sm backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-lg font-black text-emerald-800 no-underline">
            دَورلي
          </Link>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            المحفظة
          </span>
        </div>
        <Link
          href="/dashboard"
          className="min-h-[44px] min-w-[44px] content-center rounded-xl px-3 text-center text-sm font-bold text-emerald-700 no-underline hover:bg-emerald-50"
        >
          لوحة التحكم
        </Link>
      </nav>

      <div className="mx-auto w-full max-w-full px-3 pt-5 sm:max-w-lg sm:px-4">
        {copyHint ? (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-800">
            {copyHint}
          </div>
        ) : null}
        <div className="mb-6 w-full max-w-full rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 p-6 text-center text-white shadow-lg shadow-emerald-900/20">
          <p className="mb-1 text-base font-semibold text-emerald-100/90">رصيد النقاط</p>
          <p className="flex items-center justify-center gap-2 text-4xl font-black tracking-tight sm:text-5xl">
            <span aria-hidden>💎</span>
            {points.toLocaleString("ar-EG")}
          </p>
          <p className="mt-2 text-sm text-emerald-100/85">
            بعد الحد المجاني: تُخصم عند موافقة الإدارة — إيجار {AD_POST_COST_RENT} نقطة · بيع {AD_POST_COST_SALE} نقطة
          </p>
        </div>

        <h2 className="mb-3 text-lg font-black text-slate-900">باقات الشحن</h2>
        <div className="mb-8 grid w-full max-w-full grid-cols-1 gap-3">
          {POINTS_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => {
                setSelected(pkg);
                setSuccess("");
                setError("");
              }}
              className={`relative w-full max-w-full rounded-2xl border-2 p-4 text-right transition-all active:scale-[0.99] ${
                selected?.id === pkg.id
                  ? "border-amber-500 bg-gradient-to-l from-amber-50 to-emerald-50 shadow-md ring-2 ring-amber-400/40"
                  : "border-slate-200 bg-white hover:border-emerald-300"
              }`}
            >
              {pkg.popular ? (
                <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
                  الأكثر طلباً
                </span>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-900">{pkg.nameAr}</p>
                  <p className="text-xs text-slate-500">{pkg.nameEn}</p>
                </div>
                <div className="text-left">
                  <p className="text-xl font-black text-emerald-700">{pkg.points} 💎</p>
                  <p className="text-sm font-bold text-amber-700">{pkg.priceEGP} ج.م</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="mb-8 w-full max-w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-base font-black text-slate-900">إتمام الطلب — {selected.nameAr}</h3>
            <div className="mb-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4">
              <p className="mb-2 text-sm font-bold text-slate-600">حوّل المبلغ إلى:</p>
              <div className="flex flex-wrap items-center gap-3">
                <span dir="ltr" className="min-w-0 flex-1 font-mono text-base font-bold text-slate-900">
                  {walletNo}
                </span>
                <button
                  type="button"
                  title="نسخ إلى الحافظة"
                  aria-label="نسخ رقم المحفظة"
                  onClick={() => copyWithHint(walletNo.replace(/[^\d+]/g, "") || walletNo, "تم نسخ رقم المحفظة")}
                  className="inline-flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Copy className="h-5 w-5" strokeWidth={2.25} />
                </button>
              </div>
            </div>

            {success ? (
              <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                {success}
              </div>
            ) : null}
            {error ? (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
            ) : null}

            <form onSubmit={(e) => void submitRecharge(e)} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">رقم هاتف المحوّل (كامل)</label>
                <div className="flex gap-2">
                  <input
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="مثال: 01001234567"
                    dir="ltr"
                    className="min-h-[52px] w-full flex-1 rounded-xl border border-slate-200 px-3 font-mono text-base outline-none ring-emerald-500/30 focus:ring-2"
                  />
                  <button
                    type="button"
                    title="نسخ الرقم المدخل"
                    aria-label="نسخ رقم المحوّل"
                    disabled={!senderPhone.trim()}
                    onClick={() => copyWithHint(senderPhone, "تم نسخ رقم المحوّل")}
                    className="inline-flex min-h-[52px] min-w-[52px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">لقطة شاشة التحويل</label>
                <label
                  htmlFor="wallet-receipt"
                  className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-emerald-200 bg-slate-50 px-3 text-sm font-bold text-slate-600"
                >
                  {file ? file.name : "اضغط لرفع الصورة"}
                </label>
                <input
                  id="wallet-receipt"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-l from-amber-600 to-emerald-700 text-lg font-black text-white shadow-lg shadow-amber-900/25 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : null}
                {uploading ? "جاري الإرسال..." : "إرسال طلب الشحن"}
              </button>
            </form>
          </div>
        ) : (
          <p className="mb-8 text-center text-sm text-slate-500">اختر باقة أعلاه لعرض رقم المحفظة ورفع الإيصال</p>
        )}

        <div className="w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-black text-slate-900">سجل الطلبات</h2>
          </div>
          {transactions.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">لا توجد طلبات بعد</p>
          ) : (
            transactions.map((t) => (
              <div key={t.id} className="w-full border-b border-slate-50 px-4 py-4 last:border-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">رقم الطلب</span>
                  <span dir="ltr" className="font-mono text-sm font-black text-slate-800">
                    #{t.id}
                  </span>
                  <button
                    type="button"
                    title="نسخ رقم المعاملة"
                    aria-label="نسخ رقم المعاملة"
                    onClick={() => copyWithHint(String(t.id), "تم نسخ رقم المعاملة")}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-black text-slate-900">
                      {t.points_requested != null ? `${t.points_requested} 💎` : `${t.amount} ج.م`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {t.package_name ? `${t.package_name} · ` : ""}
                      {new Date(t.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      background: STATUS_MAP[t.status]?.bg,
                      color: STATUS_MAP[t.status]?.color,
                    }}
                  >
                    {STATUS_MAP[t.status]?.label}
                  </span>
                </div>
                {t.status === "rejected" && t.rejection_reason ? (
                  <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{t.rejection_reason}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
