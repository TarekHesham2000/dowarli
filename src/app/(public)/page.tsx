"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Banner from "@/components/shared/Banner";
type UnitType = "student" | "family" | "studio" | "shared";

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

const AREAS = [
  "الكل",
  "المنصورة",
  "القاهرة",
  "الإسكندرية",
  "الجيزة",
  "أسيوط",
  "سوهاج",
  "المنيا",
];

const TYPES: { value: UnitType | ""; label: string }[] = [
  { value: "", label: "الكل" },
  { value: "student", label: "سكن طلاب" },
  { value: "family", label: "سكن عائلي" },
  { value: "studio", label: "ستوديو" },
  { value: "shared", label: "مشترك" },
];

const TYPE_LABELS: Record<UnitType, string> = {
  student: "سكن طلاب",
  family: "سكن عائلي",
  studio: "ستوديو",
  shared: "مشترك",
};

const TYPE_COLORS: Record<
  UnitType,
  { bg: string; color: string; border: string }
> = {
  student: { bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7" },
  family: { bg: "#eff6ff", color: "#1e40af", border: "#93c5fd" },
  studio: { bg: "#fdf4ff", color: "#7e22ce", border: "#d8b4fe" },
  shared: { bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
};

export default function PublicPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState("الكل");
  const [type, setType] = useState<UnitType | "">("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );
  const [leadForm, setLeadForm] = useState({ name: "", phone: "" });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);

  useEffect(() => {
    loadProperties();
  }, [area, type, maxPrice]);

  const loadProperties = async () => {
    setLoading(true);
    let query = supabase
      .from("properties")
      .select(
        "id, title, description, price, area, address, unit_type, images, profiles(name, phone)",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (area !== "الكل") query = query.eq("area", area);
    if (type) query = query.eq("unit_type", type);
    if (maxPrice) query = query.lte("price", Number(maxPrice));

    const { data } = await query;
    setProperties((data as unknown as Property[]) ?? []);
    setLoading(false);
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
      const phone = selectedProperty.profiles?.phone;
      const cleanPhone = phone?.replace(/\D/g, "") ?? "";
      const waPhone = cleanPhone.startsWith("0")
        ? "2" + cleanPhone
        : cleanPhone;
      const message = `أنا مهتم بالعقار رقم ${selectedProperty.id} المعروض على أجرلي`;
      window.open(
        "https://wa.me/" + waPhone + "?text=" + encodeURIComponent(message),
        "_blank",
      );
    }, 500);
  };

  const closeModal = () => {
    setSelectedProperty(null);
    setLeadSubmitted(false);
    setLeadForm({ name: "", phone: "" });
  };

  const tc = (unitType: UnitType) =>
    TYPE_COLORS[unitType] || TYPE_COLORS.family;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        direction: "rtl",
        fontFamily: "Cairo, sans-serif",
      }}
    >
      <Banner />
      {/* NAV */}
      <nav
        style={{
          background: "#fff",
          borderBottom: "1px solid #e8f5e9",
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <a
            href="/register"
            style={{
              border: "1.5px solid #1B783C",
              color: "#1B783C",
              padding: "7px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            انضم كمالك
          </a>
          <a
            href="/login"
            style={{
              background: "#1B783C",
              color: "#fff",
              padding: "7px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            دخول
          </a>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1B783C" }}>
          أجرلي
        </div>
      </nav>

      {/* HERO */}
      <div
        style={{
          background: "#1B783C",
          padding: "4rem 1.5rem 5rem",
          textAlign: "center",
          color: "white",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(255,255,255,0.15)",
            padding: "5px 16px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: "1rem",
          }}
        >
          منصة الإيجار الاولى في مصر
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            marginBottom: "0.75rem",
            lineHeight: 1.2,
          }}
        >
          لاقي سكنك بسهولة وأمان
        </h1>
        <p style={{ fontSize: 16, opacity: 0.8, marginBottom: "2rem" }}>
          آلاف الإعلانات من ملاك موثوقين في كل مكان
        </p>

        {/* SEARCH */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: "1rem 1.25rem",
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            maxWidth: 780,
            margin: "0 auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}
        >
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            style={{
              flex: 1,
              minWidth: 130,
              border: "1.5px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 12px",
              fontFamily: "Cairo, sans-serif",
              fontSize: 14,
              color: "#374151",
            }}
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as UnitType | "")}
            style={{
              flex: 1,
              minWidth: 130,
              border: "1.5px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 12px",
              fontFamily: "Cairo, sans-serif",
              fontSize: 14,
              color: "#374151",
            }}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="أقصى سعر (ج.م)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            style={{
              flex: 1,
              minWidth: 130,
              border: "1.5px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 12px",
              fontFamily: "Cairo, sans-serif",
              fontSize: 14,
              color: "#374151",
            }}
          />
        </div>
      </div>

      {/* LISTINGS */}
      <div
        style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 1.5rem" }}
      >
        {/* FILTER CHIPS */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "1.5rem",
          }}
        >
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value as UnitType | "")}
              style={{
                padding: "8px 18px",
                borderRadius: 25,
                border: "1.5px solid",
                borderColor: type === t.value ? "#1B783C" : "#d1fae5",
                background: type === t.value ? "#1B783C" : "white",
                color: type === t.value ? "white" : "#374151",
                fontFamily: "Cairo, sans-serif",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "3rem" }}>
            جاري التحميل...
          </p>
        ) : properties.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "3rem" }}>
            مفيش إعلانات دلوقتي
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {properties.map((p) => {
              const colors = tc(p.unit_type);
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/property/${p.id}`)}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "all 0.25s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 32px rgba(27,120,60,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      style={{ width: "100%", height: 180, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 180,
                        background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 48,
                      }}
                    >
                      🏠
                    </div>
                  )}
                  <div style={{ padding: "1rem 1.25rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        background: colors.bg,
                        color: colors.color,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        marginBottom: 8,
                      }}
                    >
                      {TYPE_LABELS[p.unit_type]}
                    </span>
                    <h3
                      style={{
                        margin: "0 0 6px",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#111",
                      }}
                    >
                      {p.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 10,
                      }}
                    >
                      📍 {p.area} — {p.address}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 900,
                          color: "#1B783C",
                        }}
                      >
                        {p.price.toLocaleString()}{" "}
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 400,
                            color: "#9ca3af",
                          }}
                        >
                          ج.م/شهر
                        </span>
                      </span>
                      <span
                        style={{
                          background: "#ecfdf5",
                          color: "#065f46",
                          border: "1px solid #6ee7b7",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "5px 12px",
                        }}
                      >
                        تفاصيل
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {selectedProperty && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 20,
              width: "100%",
              maxWidth: 480,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #1B783C, #166534)",
                padding: "1.5rem",
                color: "white",
                borderRadius: "20px 20px 0 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h2
                    style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800 }}
                  >
                    {selectedProperty.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                    📍 {selectedProperty.area} — {selectedProperty.address}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    color: "white",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "1.25rem" }}>
              {selectedProperty.images?.[0] && (
                <img
                  src={selectedProperty.images[0]}
                  alt={selectedProperty.title}
                  style={{
                    width: "100%",
                    height: 200,
                    objectFit: "cover",
                    borderRadius: 12,
                    marginBottom: "1rem",
                  }}
                />
              )}

              <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
                <div
                  style={{
                    flex: 1,
                    background: "#ecfdf5",
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}
                  >
                    السعر الشهري
                  </div>
                  <div
                    style={{ fontSize: 18, fontWeight: 900, color: "#1B783C" }}
                  >
                    {selectedProperty.price.toLocaleString()} ج.م
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "#f9fafb",
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}
                  >
                    نوع الوحدة
                  </div>
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}
                  >
                    {TYPE_LABELS[selectedProperty.unit_type]}
                  </div>
                </div>
              </div>

              {selectedProperty.description && (
                <p
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    lineHeight: 1.8,
                    marginBottom: "1rem",
                    borderBottom: "1px solid #f3f4f6",
                    paddingBottom: "1rem",
                  }}
                >
                  {selectedProperty.description}
                </p>
              )}

              {!leadSubmitted ? (
                <form
                  onSubmit={handleLeadSubmit}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#111",
                      margin: "0 0 6px",
                    }}
                  >
                    أدخل بياناتك للتواصل مع المالك
                  </p>
                  <input
                    type="text"
                    placeholder="اسمك الكامل"
                    required
                    value={leadForm.name}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, name: e.target.value })
                    }
                    style={{
                      border: "1.5px solid #e5e7eb",
                      borderRadius: 10,
                      padding: "12px 14px",
                      fontSize: 14,
                      fontFamily: "Cairo, sans-serif",
                      outline: "none",
                    }}
                  />
                  <input
                    type="tel"
                    placeholder="رقم هاتفك"
                    required
                    value={leadForm.phone}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, phone: e.target.value })
                    }
                    style={{
                      border: "1.5px solid #e5e7eb",
                      borderRadius: 10,
                      padding: "12px 14px",
                      fontSize: 14,
                      fontFamily: "Cairo, sans-serif",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={leadLoading}
                    style={{
                      background: "#25D366",
                      color: "white",
                      border: "none",
                      borderRadius: 12,
                      padding: "14px",
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "Cairo, sans-serif",
                    }}
                  >
                    {leadLoading
                      ? "جاري الإرسال..."
                      : "تواصل مع المالك على واتساب"}
                  </button>
                </form>
              ) : (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #6ee7b7",
                    borderRadius: 12,
                    padding: "1.25rem",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#065f46",
                      margin: 0,
                    }}
                  >
                    جاري تحويلك لواتساب المالك...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          background: "#f0fdf4",
          border: "1.5px solid #bbf7d0",
          borderRadius: 24,
          padding: "2.5rem 2rem",
          margin: "0 5% 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#0f172a",
              marginBottom: 6,
            }}
          >
            أنت مالك عقار؟
          </h2>
          <p style={{ color: "#64748b", fontSize: 15 }}>
            ارفع أول إعلانين مجاناً وابدأ تستقبل عملاء من أول يوم
          </p>
        </div>
        <a
          href="/register"
          style={{
            background: "#166534",
            color: "white",
            borderRadius: 14,
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 900,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          ابدأ مجاناً الآن
        </a>
      </div>
      {/* FOOTER */}
      <footer
        style={{
          background: "#022c22",
          color: "#a7f3d0",
          padding: "2rem 1.5rem",
          textAlign: "center",
          marginTop: "2rem",
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "white",
            marginBottom: "1rem",
          }}
        >
          أجرلي
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1.5rem",
            fontSize: 13,
            opacity: 0.8,
            flexWrap: "wrap",
          }}
        >
          <a href="/about" style={{ color: "inherit", textDecoration: "none" }}>
            من نحن
          </a>
          <a
            href="/privacy"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            سياسة الخصوصية
          </a>
          <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
            الشروط والأحكام
          </a>
          <a
            href="/contact"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            تواصل معنا
          </a>
        </div>
        <p style={{ fontSize: 12, opacity: 0.5, marginTop: "1rem" }}>
          جميع الحقوق محفوظة 2026 أجرلي
        </p>
      </footer>
    </div>
  );
}
