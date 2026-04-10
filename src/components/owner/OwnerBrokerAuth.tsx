"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

const EGYPTIAN_PHONE_REGEX = /^(010|011|012|015)\d{8}$/;

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function toE164Egypt(local11: string): string {
  const c = local11.replace(/\s|-/g, "");
  if (c.startsWith("+20")) return c;
  if (c.startsWith("0") && c.length === 11) return `+20${c.slice(1)}`;
  return `+20${c}`;
}

function parseLoginIdentifier(raw: string):
  | { kind: "email"; email: string }
  | { kind: "phone"; e164: string }
  | null {
  const t = raw.trim();
  if (!t) return null;
  if (looksLikeEmail(t)) return { kind: "email", email: t.toLowerCase() };
  const cleaned = t.replace(/\s|-/g, "");
  if (EGYPTIAN_PHONE_REGEX.test(cleaned)) return { kind: "phone", e164: toE164Egypt(cleaned) };
  return null;
}

export type OwnerAuthMode = "login" | "register";

export type OwnerBrokerAuthProps = {
  mode?: OwnerAuthMode;
  variant?: "page" | "modal";
  open?: boolean;
  onClose?: () => void;
  bannerMessage?: string;
  onAuthSuccess?: () => void;
  oauthNextPath?: string;
};

export default function OwnerBrokerAuth({
  mode: initialMode = "login",
  variant = "page",
  open = true,
  onClose,
  bannerMessage,
  onAuthSuccess,
  oauthNextPath,
}: OwnerBrokerAuthProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<OwnerAuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"" | "google" | "facebook">("");
  const [error, setError] = useState("");

  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [loginOtpPending, setLoginOtpPending] = useState(false);
  const [loginOtpE164, setLoginOtpE164] = useState("");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginInfo, setLoginInfo] = useState("");
  const [regForm, setRegForm] = useState({ name: "", phone: "", email: "", password: "" });

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "oauth" || err === "oauth_exchange") {
      setError("تعذّر إكمال تسجيل الدخول عبر الشبكة. حاول مرة أخرى.");
    } else if (err === "config") {
      setError("إعدادات الخادم غير مكتملة.");
    } else if (err === "no_user") {
      setError("لم يتم العثور على المستخدم بعد المصادقة.");
    }
  }, [searchParams]);

  useEffect(() => {
    setTab(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setLoginOtpPending(false);
    setLoginOtpE164("");
    setLoginOtpCode("");
    setLoginInfo("");
  }, [tab]);

  const validatePhone = (phone: string): string => {
    const cleaned = phone.replace(/\s|-/g, "");
    if (!cleaned) return "رقم الهاتف مطلوب";
    if (!EGYPTIAN_PHONE_REGEX.test(cleaned)) {
      return "رقم غير صحيح — يجب أن يبدأ بـ 010، 011، 012، أو 015 ويكون 11 رقم";
    }
    return "";
  };

  const oauthRedirect = () => {
    if (typeof globalThis.window === "undefined") return "";
    const w = globalThis.window;
    const next =
      oauthNextPath ??
      (variant === "modal" ? `${w.location.pathname}${w.location.search}` : "/dashboard");
    return `${w.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  const signInOAuth = async (provider: "google" | "facebook") => {
    setError("");
    setOauthLoading(provider);
    const { error: oErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthRedirect() },
    });
    if (oErr) {
      setError(oErr.message);
      setOauthLoading("");
    }
  };

  const routeAfterSession = async (userId: string) => {
    if (variant === "modal") {
      try {
        await fetch("/api/auth/ensure-profile", { method: "POST", credentials: "same-origin" });
      } catch {
        /* non-fatal */
      }
      onAuthSuccess?.();
      onClose?.();
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role === "admin") router.push("/admin");
    else router.push("/dashboard");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setLoginInfo("");

    try {
      if (loginOtpPending) {
        const code = loginOtpCode.replace(/\s/g, "");
        if (code.length < 4) {
          setError("أدخل رمز التحقق المرسل إلى هاتفك");
          return;
        }
        const { data, error: vErr } = await supabase.auth.verifyOtp({
          phone: loginOtpE164,
          token: code,
          type: "sms",
        });
        if (vErr) {
          setError(vErr.message.includes("expired") ? "انتهت صلاحية الرمز — اطلب رمزًا جديدًا" : "رمز غير صحيح");
          return;
        }
        if (!data.user?.id) {
          setError("تعذّر إكمال الدخول");
          return;
        }
        await routeAfterSession(data.user.id);
        return;
      }

      const parsed = parseLoginIdentifier(loginForm.identifier);
      if (!parsed) {
        setError("أدخل بريدًا إلكترونيًا صالحًا أو رقم موبايل مصري (010/011/012/015)");
        return;
      }

      if (parsed.kind === "email") {
        if (!loginForm.password) {
          setError("أدخل كلمة المرور");
          return;
        }
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password: loginForm.password,
        });
        if (signInError) {
          setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          return;
        }
        if (!data.user?.id) return;
        await routeAfterSession(data.user.id);
        return;
      }

      if (loginForm.password.trim()) {
        setError("تسجيل الدخول بالموبايل يتم برمز SMS — اترك كلمة المرور فارغة ثم اضغط إرسال الرمز.");
        return;
      }

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: parsed.e164,
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        if (otpErr.message.toLowerCase().includes("signups not allowed")) {
          setError("لا يوجد حساب بهذا الرقم — أنشئ حسابًا من تبويب «حساب جديد»");
        } else {
          setError(otpErr.message);
        }
        return;
      }
      setLoginOtpPending(true);
      setLoginOtpE164(parsed.e164);
      setLoginOtpCode("");
      setLoginInfo("تم إرسال رمز التحقق عبر SMS — أدخل الرقم أدناه.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const phoneError = validatePhone(regForm.phone);
    if (phoneError) {
      setError(phoneError);
      setLoading(false);
      return;
    }

    const cleanedPhone = regForm.phone.replace(/\s|-/g, "");
    const emailNorm = regForm.email.trim().toLowerCase();

    const { data: phoneTaken } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", cleanedPhone)
      .maybeSingle();
    if (phoneTaken) {
      setError("رقم الهاتف مسجّل بالفعل — سجّل الدخول أو استخدم رقمًا آخر");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: emailNorm,
      password: regForm.password,
    });

    if (signUpError) {
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        setError("هذا البريد مستخدم بالفعل في حساب آخر");
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (!data.user?.id) {
      setError("تحقق من بريدك لتأكيد الحساب ثم سجّل الدخول");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        name: regForm.name.trim(),
        phone: cleanedPhone,
        email: emailNorm,
        role: "broker",
        wallet_balance: 0,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      if (profileError.code === "23505") {
        setError("رقم الهاتف أو البريد مسجّل مسبقًا");
      } else {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    if (variant === "modal") {
      setLoginInfo("تم إنشاء الحساب — سجّل الدخول من تبويب «تسجيل الدخول» للمتابعة.");
      setTab("login");
      setLoading(false);
      return;
    }
    router.push("/login?registered=1");
  };

  if (variant === "modal" && !open) return null;

  const pageBody = (
    <div
      className="owner-auth-root"
      style={{
        minHeight: variant === "modal" ? "auto" : "100vh",
        fontFamily: "var(--font-geist-sans), Cairo, system-ui, sans-serif",
        direction: "rtl",
        position: "relative",
        overflow: "hidden",
        background: "#030712",
        color: "#e2e8f0",
      }}
    >
      {variant === "page" ? (
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
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2], x: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            bottom: "-15%",
            left: "-5%",
            width: "45vw",
            height: "45vw",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 60%)",
            filter: "blur(48px)",
          }}
        />
      </div>
      ) : null}

      {variant === "page" ? (
      <nav
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1.5rem",
          height: 64,
          borderBottom: "1px solid rgba(148,163,184,0.12)",
          backdropFilter: "blur(12px)",
          background: "rgba(3,7,18,0.6)",
        }}
      >
        <Link href="/" style={{ fontSize: 22, fontWeight: 900, color: "#fff", textDecoration: "none" }}>
          دَورلي
          <span style={{ color: "#34d399", fontSize: 11, fontWeight: 600, marginRight: 8 }}>مالك / وسيط</span>
        </Link>
        <Link href="/" style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none" }}>
          العودة للرئيسية
        </Link>
      </nav>
      ) : null}

      <main
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: variant === "modal" ? 0 : "2rem 1rem 3rem",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: "100%", maxWidth: 440 }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, type: "spring", stiffness: 260, damping: 22 }}
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 1rem",
                borderRadius: 20,
                background: "linear-gradient(135deg, #10b981, #059669)",
                boxShadow: "0 0 40px rgba(16,185,129,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
              aria-hidden
            >
              ⌂
            </motion.div>
            <h1 style={{ fontSize: "clamp(1.35rem, 4vw, 1.75rem)", fontWeight: 900, margin: "0 0 0.35rem", color: "#fff" }}>
              بوابة الملاك والوسطاء
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>إدارة الإعلانات والعملاء — دخول آمن</p>
          </div>

          <div
            role="tablist"
            aria-label="تسجيل الدخول أو إنشاء حساب"
            style={{
              display: "flex",
              gap: 8,
              marginBottom: "1.25rem",
              padding: 6,
              borderRadius: 16,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(148,163,184,0.12)",
            }}
          >
            {(
              [
                { id: "login" as const, label: "تسجيل الدخول" },
                { id: "register" as const, label: "حساب جديد" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setError("");
                }}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: tab === t.id ? "linear-gradient(135deg, #10b981, #047857)" : "transparent",
                  color: tab === t.id ? "#fff" : "#94a3b8",
                  boxShadow: tab === t.id ? "0 8px 24px rgba(16,185,129,0.25)" : "none",
                  transition: "color 0.2s, background 0.2s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <motion.div
            layout
            style={{
              background: "rgba(15,23,42,0.75)",
              borderRadius: 24,
              padding: "1.75rem",
              border: "1px solid rgba(148,163,184,0.15)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
              backdropFilter: "blur(16px)",
            }}
          >
            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key="err"
                  role="alert"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(248,113,113,0.35)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "#fca5a5",
                    marginBottom: "1rem",
                  }}
                >
                  {error}
                </motion.div>
              ) : null}
            </AnimatePresence>
            {loginInfo ? (
              <div
                role="status"
                style={{
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(52,211,153,0.35)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 13,
                  color: "#6ee7b7",
                  marginBottom: "1rem",
                }}
              >
                {loginInfo}
              </div>
            ) : null}

            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 1rem", textAlign: "center" }}>
              مخصص لملّاك العقارات والوسطاء فقط — الضيوف يتصفحون بدون حساب
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.25rem" }}>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!!oauthLoading}
                onClick={() => signInOAuth("google")}
                aria-label="تسجيل الدخول بحساب Google"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.2)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f1f5f9",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: oauthLoading ? "wait" : "pointer",
                  fontFamily: "inherit",
                  opacity: oauthLoading && oauthLoading !== "google" ? 0.5 : 1,
                }}
              >
                <span aria-hidden style={{ fontSize: 18 }}>G</span>
                {oauthLoading === "google" ? "جاري التحويل…" : "Google"}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!!oauthLoading}
                onClick={() => signInOAuth("facebook")}
                aria-label="تسجيل الدخول بحساب فيسبوك"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(24,119,242,0.45)",
                  background: "linear-gradient(180deg, rgba(24,119,242,0.22) 0%, rgba(24,119,242,0.08) 100%)",
                  color: "#e0f2fe",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: oauthLoading ? "wait" : "pointer",
                  fontFamily: "inherit",
                  opacity: oauthLoading && oauthLoading !== "facebook" ? 0.5 : 1,
                  boxShadow: "0 4px 20px rgba(24,119,242,0.12)",
                }}
              >
                <svg aria-hidden width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <path
                    fill="currentColor"
                    d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
                  />
                </svg>
                {oauthLoading === "facebook" ? "جاري التحويل…" : "تسجيل الدخول من فيسبوك"}
              </motion.button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: "1.25rem",
                color: "#475569",
                fontSize: 12,
              }}
            >
              <div style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.2)" }} />
              أو بالبريد / الموبايل
              <div style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.2)" }} />
            </div>

            <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleLogin}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  {loginOtpPending ? (
                    <>
                      <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
                        أدخل رمز التحقق المرسل إلى{" "}
                        <span dir="ltr" style={{ color: "#e2e8f0" }}>
                          {loginOtpE164}
                        </span>
                      </p>
                      <div>
                        <label htmlFor="ob-otp" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                          رمز SMS
                        </label>
                        <input
                          id="ob-otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          dir="ltr"
                          placeholder="••••••"
                          value={loginOtpCode}
                          onChange={(e) => setLoginOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                          style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.35em", fontSize: 18 }}
                        />
                      </div>
                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={{ scale: loading ? 1 : 1.02 }}
                        whileTap={{ scale: loading ? 1 : 0.98 }}
                        style={submitStyle(loading)}
                      >
                        {loading ? "جاري التحقق…" : "تأكيد الدخول"}
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginOtpPending(false);
                          setLoginOtpCode("");
                          setLoginInfo("");
                          setError("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#64748b",
                          fontSize: 13,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          padding: 4,
                        }}
                      >
                        ← العودة لتغيير الرقم
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="ob-identifier" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                          البريد الإلكتروني أو رقم الموبايل
                        </label>
                        <input
                          id="ob-identifier"
                          type="text"
                          autoComplete="username"
                          required
                          placeholder="name@example.com أو 010xxxxxxxx"
                          value={loginForm.identifier}
                          onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                          style={inputStyle}
                        />
                        <p style={{ fontSize: 11, color: "#64748b", margin: "6px 0 0", lineHeight: 1.5 }}>
                          للموبايل: اترك كلمة المرور فارغة — سنرسل رمز تحقق عبر SMS (فعّل Phone في Supabase).
                        </p>
                      </div>
                      <div>
                        <label htmlFor="ob-pass" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                          كلمة المرور <span style={{ fontWeight: 500, color: "#64748b" }}>(للبريد فقط)</span>
                        </label>
                        <input
                          id="ob-pass"
                          type="password"
                          autoComplete="current-password"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={{ scale: loading ? 1 : 1.02 }}
                        whileTap={{ scale: loading ? 1 : 0.98 }}
                        style={submitStyle(loading)}
                      >
                        {loading ? "جاري المعالجة…" : "تسجيل الدخول / إرسال الرمز"}
                      </motion.button>
                    </>
                  )}
                </motion.form>
              ) : (
                <motion.form
                  key="reg"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleRegister}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div>
                    <label htmlFor="ob-name" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                      الاسم الكامل
                    </label>
                    <input
                      id="ob-name"
                      type="text"
                      autoComplete="name"
                      required
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="ob-phone" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                      رقم الهاتف
                    </label>
                    <input
                      id="ob-phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="ob-reg-email" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                      البريد الإلكتروني
                    </label>
                    <input
                      id="ob-reg-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      style={{ ...inputStyle, direction: "ltr", textAlign: "right" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="ob-reg-pass" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                      كلمة المرور
                    </label>
                    <input
                      id="ob-reg-pass"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    style={submitStyle(loading)}
                  >
                    {loading ? "جاري إنشاء الحساب…" : "إنشاء حساب وسيط"}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>

            <p style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: "1.25rem", lineHeight: 1.7 }}>
              بالمتابعة توافق على{" "}
              <Link href="/terms" style={{ color: "#34d399", fontWeight: 700 }}>
                الشروط
              </Link>{" "}
              و{" "}
              <Link href="/privacy" style={{ color: "#34d399", fontWeight: 700 }}>
                الخصوصية
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );

  if (variant === "modal") {
    return (
      <AnimatePresence>
        {open ? (
          <motion.div
            key="ob-auth-overlay"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center p-3 sm:p-6"
            onClick={() => onClose?.()}
          >
            <motion.div
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-500/30 bg-slate-950/98 p-4 shadow-2xl shadow-amber-950/30 sm:p-5"
            >
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => onClose?.()}
                className="absolute left-3 top-3 z-10 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-slate-400 transition hover:bg-amber-950/40 hover:text-amber-200"
              >
                ✕
              </button>
              {bannerMessage ? (
                <p className="mb-4 mt-10 text-center text-sm leading-relaxed text-amber-100/95">{bannerMessage}</p>
              ) : null}
              {pageBody}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  return pageBody;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "rgba(3,7,18,0.5)",
  color: "#f1f5f9",
};

function submitStyle(loading: boolean): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 4,
    border: "none",
    borderRadius: 14,
    padding: "14px",
    fontSize: 15,
    fontWeight: 900,
    cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    background: loading ? "rgba(16,185,129,0.4)" : "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    boxShadow: loading ? "none" : "0 12px 32px rgba(16,185,129,0.25)",
  };
}
