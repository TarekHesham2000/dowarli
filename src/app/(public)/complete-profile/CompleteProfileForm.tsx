"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { validateEgyptianPhone } from "@/lib/egyptianPhone";
import { nameFromUserMetadata } from "@/lib/userDisplayName";

function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(15,23,42,0.6)",
  color: "#e2e8f0",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
};

export default function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent("/complete-profile")}`);
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("phone, role, name").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      if (prof?.role === "admin") {
        router.replace(next);
        return;
      }
      const hasPhone = prof?.phone && String(prof.phone).replace(/\s|-/g, "").trim().length > 0;
      if (hasPhone) {
        router.replace(next);
        return;
      }
      const initialName =
        (typeof prof?.name === "string" && prof.name.trim()) || nameFromUserMetadata(user) || "";
      setName(initialName);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("أدخل الاسم بالكامل");
      return;
    }
    const msg = validateEgyptianPhone(phone);
    if (msg) {
      setError(msg);
      return;
    }
    const cleaned = phone.replace(/\s|-/g, "");

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setError("انتهت الجلسة — سجّل الدخول من جديد");
        return;
      }

      const { data: taken } = await supabase.from("profiles").select("id").eq("phone", cleaned).maybeSingle();
      if (taken && taken.id !== user.id) {
        setError("رقم الهاتف مسجّل لحساب آخر");
        return;
      }

      const nameToSave =
        trimmedName ||
        nameFromUserMetadata(user) ||
        user.email?.split("@")[0]?.trim() ||
        "مستخدم جديد";

      const { error: upErr } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          name: nameToSave,
          phone: cleaned,
          role: "broker",
        },
        { onConflict: "id" },
      );
      if (upErr) {
        setError(upErr.message);
        return;
      }

      try {
        await fetch("/api/auth/ensure-profile", { method: "POST", credentials: "same-origin" });
      } catch {
        /* non-fatal */
      }

      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#030712",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        جاري التحميل…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#030712",
        fontFamily: "var(--font-geist-sans), Cairo, system-ui, sans-serif",
        direction: "rtl",
        color: "#e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <motion.div
          animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: "-20%",
            right: "-10%",
            width: "55vw",
            height: "55vw",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          padding: "2rem 1.75rem",
          borderRadius: 20,
          border: "1px solid rgba(148,163,184,0.15)",
          background: "linear-gradient(165deg, rgba(15,23,42,0.95) 0%, rgba(3,7,18,0.98) 100%)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.45)",
        }}
      >
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0 0 0.5rem", color: "#f8fafc" }}>
          أكمل ملفك
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 1.5rem", lineHeight: 1.65 }}>
          تأكد من اسمك وأضف رقم هاتفك المصري لاستخدام لوحة المالك والوسيط. لا يمكن نشر إعلانات بدون رقم محفوظ.
        </p>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="cp-name" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
              الاسم بالكامل / Full name
            </label>
            <input
              id="cp-name"
              type="text"
              autoComplete="name"
              required
              placeholder="الاسم كما يظهر في الحساب"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="cp-phone" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
              رقم الهاتف
            </label>
            <input
              id="cp-phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="010xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error ? (
            <p role="alert" style={{ fontSize: 13, color: "#fca5a5", margin: 0 }}>
              {error}
            </p>
          ) : null}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            style={{
              marginTop: 4,
              width: "100%",
              padding: "14px 18px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(180deg, #0d9488 0%, #0f766e 100%)",
              color: "#ecfdf5",
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: loading ? 0.85 : 1,
            }}
          >
            {loading ? "جاري الحفظ…" : "حفظ والمتابعة"}
          </motion.button>
        </form>

        <p style={{ margin: "1.25rem 0 0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#38bdf8",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              textDecoration: "underline",
              padding: 0,
            }}
          >
            تسجيل الخروج
          </button>
        </p>
      </motion.div>
    </div>
  );
}
