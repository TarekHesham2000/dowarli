"use client";

import { usePwaInstall } from "@/contexts/PwaInstallProvider";

export default function Footer() {
  const { isInstallable, promptInstall } = usePwaInstall();

  return (
    <footer
      style={{
        background: "rgba(2,6,23,0.98)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "3rem 1.5rem 2rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 23, fontWeight: 900, color: "#ffffff", marginBottom: "0.3rem" }}>
        دَورلي{" "}
        <span style={{ color: "var(--brand-500)", fontSize: 16, fontWeight: 600 }}>Dowarly</span>
      </div>
      <p style={{ fontSize: 12, color: "#475569", marginBottom: "2rem" }}>
        منصة الإيجار الأولى في مصر
      </p>

      {isInstallable ? (
        <div style={{ marginBottom: "1.75rem" }}>
          <button
            type="button"
            onClick={() => void promptInstall()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: "none",
              cursor: "pointer",
              borderRadius: 14,
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 800,
              color: "#fff",
              background: "linear-gradient(135deg, #fb923c 0%, #f97316 45%, #ea580c 100%)",
              boxShadow:
                "0 0 0 1px rgba(251, 146, 60, 0.35), 0 8px 28px rgba(234, 88, 12, 0.42)",
              transition: "transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.transform = "translateY(-3px) scale(1.02)";
              el.style.filter = "brightness(1.08)";
              el.style.boxShadow =
                "0 0 0 1px rgba(253, 186, 116, 0.55), 0 14px 40px rgba(234, 88, 12, 0.55)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.transform = "translateY(0) scale(1)";
              el.style.filter = "brightness(1)";
              el.style.boxShadow =
                "0 0 0 1px rgba(251, 146, 60, 0.35), 0 8px 28px rgba(234, 88, 12, 0.42)";
            }}
          >
            <span aria-hidden>⬇</span>
            Download App
          </button>
        </div>
      ) : null}

      <nav
        aria-label="روابط التذييل"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "2.25rem",
          fontSize: 13,
          flexWrap: "wrap",
          marginBottom: "2rem",
        }}
      >
        {[
          { href: "/about", label: "من نحن" },
          { href: "/privacy", label: "سياسة الخصوصية" },
          { href: "/terms", label: "الشروط والأحكام" },
          { href: "/contact", label: "تواصل معنا" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="nav-link"
            style={{ color: "#64748b", textDecoration: "none" }}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <p style={{ fontSize: 12, color: "#334155" }}>
        جميع الحقوق محفوظة © 2026 دَورلي - Dowarly
      </p>
    </footer>
  );
}
