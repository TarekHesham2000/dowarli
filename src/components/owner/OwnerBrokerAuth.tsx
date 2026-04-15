"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { WELCOME_POINTS_BONUS } from "@/lib/pointsConfig";
import { EGYPTIAN_PHONE_REGEX, toE164Egypt, validateEgyptianPhone } from "@/lib/egyptianPhone";

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
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
  const [oauthLoading, setOauthLoading] = useState<"" | "google">("");
  const [error, setError] = useState("");

  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  /** If true, phone login uses SMS OTP instead of password (optional fallback). */
  const [loginSmsMode, setLoginSmsMode] = useState(false);
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
    setLoginSmsMode(false);
  }, [tab]);

  const validatePhone = (phone: string): string => validateEgyptianPhone(phone) ?? "";

  const oauthRedirect = () => {
    if (typeof globalThis.window === "undefined") return "";
    const w = globalThis.window;
    const next =
      oauthNextPath ??
      (variant === "modal" ? `${w.location.pathname}${w.location.search}` : "/dashboard");
    return `${w.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  const signInOAuthGoogle = async () => {
    setError("");
    setOauthLoading("google");
    const { error: oErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: oauthRedirect() },
    });
    if (oErr) {
      setError(oErr.message);
      setOauthLoading("");
    }
  };

  const profilePhoneMissing = (phone: string | null | undefined) =>
    !phone || !String(phone).replace(/\s|-/g, "").trim();

  const routeAfterSession = async (userId: string) => {
    if (variant === "modal") {
      try {
        await fetch("/api/auth/ensure-profile", { method: "POST", credentials: "same-origin" });
      } catch {
        /* non-fatal */
      }
      const { data: prof } = await supabase.from("profiles").select("phone, role").eq("id", userId).maybeSingle();
      if (prof?.role !== "admin" && profilePhoneMissing(prof?.phone)) {
        const nextPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/dashboard";
        router.push(`/complete-profile?next=${encodeURIComponent(nextPath || "/dashboard")}`);
        onClose?.();
        return;
      }
      onAuthSuccess?.();
      onClose?.();
      return;
    }
    try {
      await fetch("/api/auth/ensure-profile", { method: "POST", credentials: "same-origin" });
    } catch {
      /* non-fatal */
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, phone")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.role !== "admin" && profilePhoneMissing(profile?.phone)) {
      router.push(`/complete-profile?next=${encodeURIComponent("/dashboard")}`);
      return;
    }
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

      // Phone: password login (Supabase Auth must have this phone on the user — enable Phone provider + link phone)
      if (loginSmsMode) {
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
        setLoginInfo("تم إرسال رمز التحقق عبر SMS — أدخل الرمز أدناه.");
        return;
      }

      if (!loginForm.password) {
        setError("أدخل كلمة المرور — أو فعّل «دخول برمز SMS» إن لم تضبط كلمة مرور للهاتف في Supabase.");
        return;
      }

      const { data: phoneAuth, error: phoneSignErr } = await supabase.auth.signInWithPassword({
        phone: parsed.e164,
        password: loginForm.password,
      });
      if (phoneSignErr) {
        const m = phoneSignErr.message.toLowerCase();
        if (m.includes("invalid") || m.includes("credentials")) {
          setError(
            "تسجيل الدخول بالهاتف يعتمد على رقم مسجّل في نظام المصادقة (ليس فقط في الملف الشخصي). إن سجّلت سابقًا بالبريد: سجّل الدخول مرة واحدة بالبريد وكلمة المرور (لنُحدّث الرقم تلقائيًا)، ثم جرّب الهاتف مرة أخرى؛ أو استخدم «دخول برمز SMS»، أو تحقق من كلمة المرور.",
          );
        } else {
          setError(phoneSignErr.message);
        }
        return;
      }
      if (!phoneAuth.user?.id) return;
      await routeAfterSession(phoneAuth.user.id);
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
        points: WELCOME_POINTS_BONUS,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      if (profileError.code === "23505") {
        setError("رقم الهاتف أو البريد مسجّل مسبقًا");
      } else {
        setError(profileError.message);
      }
      setLoading(false);
      return;
    }

    try {
      await fetch("/api/auth/ensure-profile", { method: "POST", credentials: "same-origin" });
    } catch {
      /* non-fatal */
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

            <div style={{ marginBottom: "1.25rem" }}>
              <motion.button
                type="button"
                whileHover={{ scale: oauthLoading ? 1 : 1.015 }}
                whileTap={{ scale: oauthLoading ? 1 : 0.99 }}
                disabled={!!oauthLoading}
                onClick={() => void signInOAuthGoogle()}
                aria-label="تسجيل الدخول بحساب Google"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.85)",
                  background: "#ffffff",
                  color: "#1e293b",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: oauthLoading ? "wait" : "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.28), 0 0 0 1px rgba(15,23,42,0.06)",
                }}
              >
                <svg aria-hidden width={22} height={22} viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {oauthLoading === "google" ? "جاري التحويل إلى Google…" : "المتابعة مع Google"}
              </motion.button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: "1.25rem",
                color: "#64748b",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <div style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.22)" }} />
              أو بالبريد / الموبايل وكلمة المرور
              <div style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.22)" }} />
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
                          setLoginSmsMode(false);
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
                          الموبايل: أدخل كلمة المرور إذا كان الرقم مربوطًا بحسابك في Supabase، أو استخدم «دخول برمز SMS».
                        </p>
                      </div>
                      <div>
                        <label htmlFor="ob-pass" style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                          كلمة المرور {!loginSmsMode && <span style={{ fontWeight: 500, color: "#64748b" }}>(البريد أو الموبايل)</span>}
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
                      <button
                        type="button"
                        onClick={() => {
                          setLoginSmsMode((v) => {
                            if (!v) setLoginForm((f) => ({ ...f, password: "" }));
                            return !v;
                          });
                          setError("");
                          setLoginInfo("");
                        }}
                        style={{
                          alignSelf: "flex-start",
                          background: "none",
                          border: "none",
                          color: "#38bdf8",
                          fontSize: 13,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          padding: 0,
                          textDecoration: "underline",
                          textUnderlineOffset: 3,
                        }}
                      >
                        {loginSmsMode ? "العودة لتسجيل الدخول بكلمة المرور" : "دخول برمز SMS بدل كلمة المرور"}
                      </button>
                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={{ scale: loading ? 1 : 1.02 }}
                        whileTap={{ scale: loading ? 1 : 0.98 }}
                        style={submitStyle(loading)}
                      >
                        {loading
                          ? "جاري المعالجة…"
                          : loginSmsMode
                            ? "إرسال رمز SMS"
                            : "تسجيل الدخول"}
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
