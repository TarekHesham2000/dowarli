import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "دَورلي - منصة الإيجار الأولى في مصر",
  description: "ابحث عن شقتك أو سكن الطلاب بسهولة وأمان",
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: "دَورلي",
    title: "دَورلي - منصة الإيجار الأولى في مصر",
    description: "ابحث عن شقتك أو سكن الطلاب بسهولة وأمان",
  },
  twitter: {
    card: "summary_large_image",
    title: "دَورلي - منصة الإيجار الأولى في مصر",
    description: "ابحث عن شقتك أو سكن الطلاب بسهولة وأمان",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1B783C" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="دَورلي" />
      </head>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}