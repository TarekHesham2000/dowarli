"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

type Property = {
  id: number;
  title: string;
  area: string;
  price: number;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  description: string | null;
  address: string | null;
  images: string[];
  unit_type: string;
};

type LeadRow = {
  id: number;
  client_name: string;
  client_phone: string;
  created_at: string;
  property_id: number;
  properties: { title: string } | { title: string }[] | null;
};

function propertyTitle(p: LeadRow["properties"]): string {
  if (!p) return "—";
  if (Array.isArray(p)) return p[0]?.title ?? "—";
  return p.title ?? "—";
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "قيد المراجعة", bg: "#fef3c7", color: "#92400e" },
  active: { label: "نشط", bg: "#dcfce7", color: "#2D5A27" },
  rejected: { label: "مرفوض", bg: "#fee2e2", color: "#991b1b" },
  archived: { label: "مؤرشف", bg: "#f1f5f9", color: "#475569" },
};

export default function BrokerDashboardHomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [listingCost, setListingCost] = useState(50);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        router.push("/login");
        return;
      }

      const [profileRes, settingsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, email, phone, role, wallet_balance, is_active, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("settings").select("value").eq("key", "listing_cost").maybeSingle(),
      ]);

      const profile = profileRes.data;
      if (profileRes.error) {
        console.error("Dashboard profile:", profileRes.error);
        setLoadError("تعذّر تحميل الملف الشخصي. جرّب تحديث الصفحة.");
        return;
      }
      if (!profile) {
        setLoadError("لم يُعثر على ملفك في المنصة بعد — انتظر ثم حدّث الصفحة، أو سجّل الخروج وادخل مرة أخرى.");
        return;
      }
      if (settingsRes.error) {
        console.warn("Dashboard settings:", settingsRes.error);
      }
      setListingCost(Number(settingsRes.data?.value ?? 50));

      if (!profile.is_active) {
        alert("حسابك متوقف، يرجى التواصل مع الإدارة");
        router.push("/login");
        return;
      }

      setName(profile.name ?? "");
      setWalletBalance(profile.wallet_balance ?? 0);
      setAvatarUrl(typeof profile.avatar_url === "string" && profile.avatar_url.startsWith("http") ? profile.avatar_url : null);

      const { data: userProperties, error: propsError } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (propsError) throw propsError;
      const propsList = userProperties ?? [];
      setProperties(propsList as Property[]);

      if (propsList.length > 0) {
        const ids = propsList.map((p) => p.id);
        const { data: leadRows, error: leadsError } = await supabase
          .from("leads")
          .select("id, client_name, client_phone, created_at, property_id, properties(title)")
          .in("property_id", ids)
          .order("created_at", { ascending: false });
        if (leadsError) console.error("Leads:", leadsError);
        setLeads((leadRows as LeadRow[]) ?? []);
      } else {
        setLeads([]);
      }
    } catch (e) {
      console.error("Dashboard load:", e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const deleteMyProperty = async (propertyId: number) => {
    if (deletingId) return;
    const ok = confirm("هل أنت متأكد من حذف هذا الإعلان؟ لا يمكن التراجع.");
    if (!ok) return;
    setDeletingId(propertyId);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { error } = await supabase.from("properties").delete().eq("id", propertyId).eq("owner_id", user.id);
      if (error) {
        alert(`فشل الحذف: ${error.message}`);
        return;
      }
      setProperties((prev) => prev.filter((p) => p.id !== propertyId));
      setLeads((prev) => prev.filter((l) => l.property_id !== propertyId));
      if (selectedProperty?.id === propertyId) setSelectedProperty(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #dcfce7",
              borderTop: "3px solid #166534",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <p style={{ color: "#64748b", fontSize: 14 }}>جاري التحميل…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 480, margin: "3rem auto", padding: "1.5rem", textAlign: "center" }}>
        <p style={{ color: "#b45309", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{loadError}</p>
            <button
              type="button"
              onClick={() => load()}
              style={{
                background: "#2D5A27",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "10px 20px",
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
                marginInlineEnd: 8,
              }}
            >
              إعادة المحاولة
            </button>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          style={{
            background: "#f1f5f9",
            color: "#475569",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "10px 20px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          تسجيل الخروج
        </button>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {selectedProperty ? (
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProperty(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.55)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 60,
              padding: "1rem",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                borderRadius: 22,
                width: "100%",
                maxWidth: 480,
                maxHeight: "88vh",
                overflowY: "auto",
                boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
              }}
            >
              <div
              style={{
                background: "linear-gradient(135deg, #2D5A27, #1e3a1f)",
                padding: "1.25rem",
                borderRadius: "22px 22px 0 0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
              >
                <div>
                  <h2 id="dash-modal-title" style={{ fontSize: 17, fontWeight: 900, color: "white", margin: "0 0 4px" }}>
                    {selectedProperty.title}
                  </h2>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0 }}>
                    {selectedProperty.area}
                    {selectedProperty.address ? ` — ${selectedProperty.address}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="إغلاق"
                  onClick={() => setSelectedProperty(null)}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    color: "white",
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: "1.25rem" }}>
                {selectedProperty.images?.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: "1rem" }}>
                    {selectedProperty.images.map((img, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={img} alt="" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8 }} />
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
                  <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>السعر الشهري</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#2D5A27" }}>{selectedProperty.price.toLocaleString()} ج.م</div>
                  </div>
                  <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>الحالة</div>
                    <span
                      style={{
                        background: STATUS_MAP[selectedProperty.status]?.bg,
                        color: STATUS_MAP[selectedProperty.status]?.color,
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "3px 10px",
                      }}
                    >
                      {STATUS_MAP[selectedProperty.status]?.label}
                    </span>
                  </div>
                </div>
                {selectedProperty.description && (
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.8, marginBottom: "1rem" }}>{selectedProperty.description}</p>
                )}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => deleteMyProperty(selectedProperty.id)}
                  disabled={deletingId === selectedProperty.id}
                  style={{
                    width: "100%",
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: 12,
                    padding: "12px",
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: deletingId === selectedProperty.id ? "not-allowed" : "pointer",
                    opacity: deletingId === selectedProperty.id ? 0.7 : 1,
                  }}
                >
                  {deletingId === selectedProperty.id ? "جاري الحذف…" : "حذف الإعلان"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: "0 0 4px" }}>أهلاً، {name || "وسيط"}</h1>
            <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>عقاراتك وطلبات التواصل في مكان واحد</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: avatarUrl ? "#fff" : "#f0fdf4",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 900,
                color: "#2D5A27",
                overflow: "hidden",
                flexShrink: 0,
                border: avatarUrl ? "2px solid #2D5A27" : "none",
              }}
              aria-hidden
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (name || "?").charAt(0)
              )}
            </div>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              خروج
            </button>
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, #2D5A27, #1e3a1f)",
            borderRadius: 16,
            padding: "1.25rem 1.5rem",
            marginBottom: "1.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>رصيد المحفظة</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: "white", margin: 0 }}>{walletBalance} ج.م</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: "6px 0 0" }}>تكلفة الإعلان بعد المجاني: {listingCost} ج.م</p>
          </div>
          <Link
            href="/broker/wallet"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              borderRadius: 12,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            شحن الرصيد
          </Link>
        </div>

        <section aria-labelledby="sec-listings" style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 id="sec-listings" style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 }}>
              عقاراتي
            </h2>
            <Link
              href="/broker/add-property"
              style={{
                background: "#2D5A27",
                color: "white",
                borderRadius: 12,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              + إضافة / تعديل عبر النموذج
            </Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 1rem" }}>اضغط على إعلان للتفاصيل أو الحذف</p>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {properties.length === 0 ? (
              <div style={{ padding: "2.5rem", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🏠</div>
                <p style={{ color: "#64748b", fontWeight: 700 }}>لا توجد عقارات بعد</p>
                <Link href="/broker/add-property" style={{ display: "inline-block", marginTop: 14, color: "#2D5A27", fontWeight: 800 }}>
                  أضف أول عقار
                </Link>
              </div>
            ) : (
              properties.map((p) => (
                <motion.button
                  type="button"
                  key={p.id}
                  onClick={() => setSelectedProperty(p)}
                  whileHover={{ backgroundColor: "#f8fafc" }}
                  style={{
                    width: "100%",
                    textAlign: "right",
                    padding: "1rem 1.25rem",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title}
                    </p>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                      {p.area} · {p.price.toLocaleString()} ج.م/شهر
                    </p>
                  </div>
                  <span
                    style={{
                      background: STATUS_MAP[p.status]?.bg,
                      color: STATUS_MAP[p.status]?.color,
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 12px",
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_MAP[p.status]?.label}
                  </span>
                </motion.button>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="sec-leads">
          <h2 id="sec-leads" style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: "0 0 0.5rem" }}>
            طلبات التواصل
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 1rem" }}>أسماء وأرقام الضيوف الذين طلبوا التواصل بخصوص عقاراتك</p>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {leads.length === 0 ? (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>لا توجد طلبات بعد</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {leads.map((l, idx) => (
                  <motion.li
                    key={l.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    style={{
                      padding: "1rem 1.25rem",
                      borderBottom: "1px solid #f1f5f9",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0 }}>{l.client_name}</p>
                        <p style={{ fontSize: 14, color: "#166534", fontWeight: 700, margin: "4px 0 0", direction: "ltr", textAlign: "right" }}>
                          <a href={`tel:${l.client_phone}`} style={{ color: "inherit", textDecoration: "none" }}>
                            {l.client_phone}
                          </a>
                        </p>
                      </div>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(l.created_at).toLocaleString("ar-EG")}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                      بخصوص: <strong style={{ color: "#334155" }}>{propertyTitle(l.properties)}</strong>
                    </p>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
