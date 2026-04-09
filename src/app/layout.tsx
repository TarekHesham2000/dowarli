import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
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

const inter = Inter({
  variable: "--font-inter",
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
        <meta name="theme-color" content="#2D5A27" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="دَورلي" />
      </head>
      <body suppressHydrationWarning={true} className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} font-sans min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
