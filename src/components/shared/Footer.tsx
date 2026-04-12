"use client";

import { usePwaInstall } from "@/contexts/PwaInstallProvider";

export default function Footer() {
  const { isInstallable, promptInstall } = usePwaInstall();

  return (
    <footer
      style={{
        background: "#ffffff",
        borderTop: "1px solid #e5e7eb",
        padding: "3rem 1.5rem 2.5rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900, color: "#00d38d", marginBottom: "0.35rem", fontFamily: "var(--font-cairo), Cairo, sans-serif" }}>
        دورلي{" "}
        <span style={{ color: "#64748b", fontSize: 15, fontWeight: 600 }}>Dowarly</span>
      </div>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: "2rem" }}>
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
              borderRadius: 8,
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 800,
              color: "#fff",
              background: "#00d38d",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#00bf7f";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#00d38d";
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
