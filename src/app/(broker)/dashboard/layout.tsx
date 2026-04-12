import type { Metadata } from "next";
import DashboardHeader from "./DashboardHeader";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function BrokerDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="min-h-screen bg-[#f9fdfc]"
      style={{
        fontFamily: "var(--font-cairo), var(--font-geist-sans), Cairo, system-ui, sans-serif",
        direction: "rtl",
      }}
    >
      <DashboardHeader />
      {children}
    </div>
  );
}
