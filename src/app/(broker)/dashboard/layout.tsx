import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function BrokerDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "var(--font-geist-sans), Cairo, system-ui, sans-serif",
        direction: "rtl",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 1.25rem",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: 10,
            }}
          >
            <Image
              src="/images/full-logo.png"
              alt="دَورلي — Dowarly"
              width={180}
              height={36}
              style={{ height: 34, width: "auto", objectFit: "contain" }}
              quality={75}
            />
          </Link>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#166534",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              padding: "4px 12px",
              borderRadius: 999,
            }}
          >
            لوحة الوسيط
          </span>
        </div>
        <nav aria-label="لوحة الوسيط" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/dashboard"
            style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", textDecoration: "none", padding: "8px 12px", borderRadius: 10 }}
          >
            الرئيسية
          </Link>
          <Link
            href="/broker/add-property"
            style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textDecoration: "none", padding: "8px 12px", borderRadius: 10 }}
          >
            إضافة عقار
          </Link>
          <Link
            href="/broker/wallet"
            style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textDecoration: "none", padding: "8px 12px", borderRadius: 10 }}
          >
            المحفظة
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
